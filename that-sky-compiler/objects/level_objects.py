"""
sldl-objects binary reader/writer for TGCL .level.bin files.

Ported from the JavaScript sldl-objects/src/levelObjects.js
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later

TGCL binary format:
  Header (44 bytes): magic "TGCL", version, counts, offsets
  Classes section: array of 12-byte entries (stringOffset, firstMemvar, numMemvars)
  Memvars section: array of 16-byte entries (type, stringOffset, size, aux)
  Strings section: null-terminated strings
  Objects section: classIndex (4B) + null-terminated name + member data
"""

from . import binaryio as bio
from .exceptions import kObjectExceptions
from .types import kMetaTypes
from .meta_type import (kMetaValueType, kMetaValueFlag, MetaType, MetaTypeForward,
                         MetaTypeClass, MetaTypeClassMember, MetaTypeClassMemberArray,
                         MetaTypeClump, MetaTypePointer, MetaTypeRaw)
from .level_value import LevelValueClass, LevelValuePointer


# --- LoHeader ---

class LoHeader:
    """TGCL file header (44 bytes)."""

    def __init__(self):
        self.initialize()

    def initialize(self):
        self.magic = "TGCL"
        self.version = 1
        self.num_classes = 0
        self.num_mem_vars = 0
        self.num_objects = 0
        self.num_refs = 0
        self.classes_offset = 0
        self.memvars_offset = 0
        self.strings_offset = 0
        self.objects_offset = 0
        self.file_size = 0

    def read(self, B):
        magic = bytes(B[0:4]).decode("ascii", errors="replace")
        if magic != "TGCL":
            raise kObjectExceptions["HeaderMagicMismatch"].build(bio.read_u32(B, 0))

        self.version = bio.read_u32(B, 4)
        self.num_classes = bio.read_u32(B, 8)
        self.num_mem_vars = bio.read_u32(B, 12)
        self.num_objects = bio.read_u32(B, 16)
        self.num_refs = bio.read_u32(B, 20)
        self.classes_offset = bio.read_u32(B, 24)
        self.memvars_offset = bio.read_u32(B, 28)
        self.strings_offset = bio.read_u32(B, 32)
        self.objects_offset = bio.read_u32(B, 36)
        self.file_size = bio.read_u32(B, 40)
        return self

    def write(self):
        r = bytearray(44)
        r[0:4] = self.magic.encode("ascii")
        bio.write_u32(r, self.version, 4)
        bio.write_u32(r, self.num_classes, 8)
        bio.write_u32(r, self.num_mem_vars, 12)
        bio.write_u32(r, self.num_objects, 16)
        bio.write_u32(r, self.num_refs, 20)
        bio.write_u32(r, self.classes_offset, 24)
        bio.write_u32(r, self.memvars_offset, 28)
        bio.write_u32(r, self.strings_offset, 32)
        bio.write_u32(r, self.objects_offset, 36)
        bio.write_u32(r, self.file_size, 40)
        return r


# --- LoStringPool ---

class LoStringPool:
    """String pool for interning strings in the binary format."""

    @staticmethod
    def read(B, offset):
        s, _ = bio.read_cstring(B, offset)
        return s

    def __init__(self):
        self.cursor = 0
        self.buffer = bytearray(128)
        self.strings = {}

    def initialize(self):
        self.cursor = 0
        self.buffer = bytearray(128)
        self.strings.clear()

    def set(self, s):
        if not isinstance(s, str):
            return -1

        if s in self.strings:
            return self.strings[s]

        b = (s + "\0").encode("utf-8")
        if self.cursor + len(b) > len(self.buffer):
            newed = bytearray(len(self.buffer) << 1)
            newed[:len(self.buffer)] = self.buffer
            self.buffer = newed

        r = self.cursor
        self.buffer[r:r + len(b)] = b
        self.cursor += len(b)
        self.strings[s] = r
        return r

    def write(self):
        return bytes(self.buffer[:self.cursor])


# --- LoMemvar ---

class LoMemvar:
    """Member variable declaration in TGCL binary file."""

    @staticmethod
    def create_raw(name, size):
        return LoMemvar(kMemvarTypes.Raw, name, size, 0)

    @staticmethod
    def create_string(name):
        return LoMemvar(kMemvarTypes.String, name, 0, 0)

    @staticmethod
    def create_ref(name):
        return LoMemvar(kMemvarTypes.Ref, name, 0, 0)

    @staticmethod
    def create_array(name, aux):
        return LoMemvar(kMemvarTypes.Array, name, 0, aux)

    def __init__(self, type_, name, size, aux):
        self.type = type_
        self.name = name
        self.size = size
        self.aux = aux

    def to_dict(self):
        return {"type": self.type, "name": self.name, "size": self.size, "aux": self.aux}


# --- LoClass ---

class LoClass:
    """Class declaration in TGCL binary file."""

    def __init__(self, name):
        self.name = name
        self.raw = {}  # ordered dict: name -> LoMemvar
        self.defn = None
        self.first_memvar = 0

    def add_memvar(self, memvar):
        self.raw[memvar.name] = memvar

    def set_def(self, defn):
        self.defn = defn


# --- LoIndices ---

class LoIndices:
    """Collections of declarations of TGCL binary file."""

    def __init__(self):
        self.classes = []
        self.memvars = []
        self.objects = []
        self.pointers = []

        self.meta_types = {}
        self.meta_classes = {}
        self.class_indices = {}
        self.object_indices = {}

    def clear(self):
        self.classes = []
        self.memvars = []
        self.objects = []
        self.pointers = []
        self.class_indices.clear()
        self.object_indices.clear()

    def redefine(self):
        self.clear()
        self.define(list(self.meta_types.values()))

    def define(self, definitions):
        self.meta_types.clear()
        self.meta_classes.clear()
        for defn in definitions:
            self.meta_types[defn.get_name()] = defn
            if defn.value_type() == kMetaValueType.Class or defn.value_flag() == kMetaValueFlag.Clump:
                self.meta_classes[defn.get_name()] = defn

    def get_class_from_name(self, name):
        return self.meta_types.get(name)

    def get_class_idx(self, name):
        idx = self.class_indices.get(name)
        if idx is None:
            mt = self.meta_types.get(name)
            if mt is not None and mt.value_flag() == kMetaValueFlag.Clump:
                idx = self.class_indices.get("Clump")
        if idx is None:
            return -1
        return idx

    def get_object_idx(self, name):
        idx = self.object_indices.get(name)
        if idx is None:
            raise kObjectExceptions["InvalidObjectIndex"].build(name)
        return idx

    def add_memvar_from_blob(self, type_, name, size, aux):
        m = LoMemvar(type_, name, size, aux)
        self.memvars.append(m)
        return m

    def add_class_from_blob(self, name, first_memvar, num_memvars):
        c = LoClass(name)
        for i in range(num_memvars):
            m = self.memvars[first_memvar + i]
            if m is None:
                raise kObjectExceptions["MemvarOutOfBound"].build()
            c.add_memvar(m)

        if name in self.class_indices:
            raise kObjectExceptions["MultipleClassName"].build(name)

        self.class_indices[name] = len(self.classes)
        self.classes.append(c)
        return c

    def add_object(self, obj):
        name = obj.get_name()
        if name in self.object_indices:
            raise kObjectExceptions["MultipleObjectName"].build(name)

        self.object_indices[name] = len(self.objects)
        self.objects.append(obj)
        return obj

    def add_class_from_def(self, defn, used_members=None):
        name = defn.get_name()
        # Clump<T> variants share the "Clump" binary class.
        bin_name = "Clump" if defn.value_flag() == kMetaValueFlag.Clump else name

        c = None
        if bin_name in self.class_indices:
            existing = self.classes[self.class_indices[bin_name]]
            if len(existing.raw) > 0:
                return existing
            c = existing
        else:
            self.class_indices[bin_name] = len(self.classes)
            c = LoClass(bin_name)
            self.classes.append(c)

        member_list = defn.all_members(used_members)

        # Phase 1: Pre-register inline element class indices.
        for member_name, member in member_list:
            if member.value_flag() == kMetaValueFlag.Array:
                if (member.defn.value_type() == kMetaValueType.Class or
                        member.defn.value_flag() == kMetaValueFlag.Clump):
                    elem_bin_name = "Clump" if member.defn.value_flag() == kMetaValueFlag.Clump else member.defn.get_name()
                    if elem_bin_name not in self.class_indices:
                        self.class_indices[elem_bin_name] = len(self.classes)
                        self.classes.append(LoClass(elem_bin_name))

        # Phase 2: Add THIS class's own memvars.
        for member_name, member in member_list:
            type_, size, aux = 0, 0, 0

            if member.value_flag() == kMetaValueFlag.Array:
                type_ = kMemvarTypes.Array
                if member.defn.value_type() == kMetaValueType.Class or member.defn.value_flag() == kMetaValueFlag.Clump:
                    size = 0
                    mdbn = "Clump" if member.defn.value_flag() == kMetaValueFlag.Clump else member.defn.get_name()
                    aux = self.class_indices.get(mdbn, 0)
                elif member.value_type() == kMetaValueType.Pointer:
                    size = member.get_size()
                    aux = 0xFFFFFFFF
                else:
                    size = member.defn.get_size()
                    aux = member.max_count
            elif member.value_type() == kMetaValueType.Pointer:
                type_ = kMemvarTypes.Ref
                size = 0
                aux = 0
            elif member.value_type() == kMetaValueType.String:
                type_ = kMemvarTypes.String
                size = 0
                aux = 0
            else:
                type_ = kMemvarTypes.Raw
                size = member.get_size()
                aux = 0

            m = LoMemvar(type_, member_name, size, aux)
            self.memvars.append(m)
            c.add_memvar(m)

        self.meta_classes[name] = defn

        # Phase 3: Recursively fill element class memvars.
        for member_name, member in member_list:
            if member.value_flag() == kMetaValueFlag.Array:
                if (member.defn.value_type() == kMetaValueType.Class or
                        member.defn.value_flag() == kMetaValueFlag.Clump):
                    self.add_class_from_def(member.defn, None)

        return c


# Memvar types constant (local copy to avoid circular dep).
kMemvarTypes = type('kMemvarTypes', (), {
    'Raw': 0,
    'String': 1,
    'Ref': 2,
    'Array': 3,
})()


# --- LevelObjects ---

class LevelObjects:
    """Main TGCL binary reader/writer."""

    def __init__(self, definitions):
        self.indices = LoIndices()

        defs = list(definitions)
        # Ensure built-in types are included.
        for key in kMetaTypes:
            defs.append(kMetaTypes[key])

        self.indices.define(defs)

        # Register all class definitions.
        for defn in definitions:
            if isinstance(defn, MetaTypeClass):
                self.indices.add_class_from_def(defn, None)

        self.objects = {}  # ordered dict: name -> LevelValueClass
        self.used_members = {}  # per-class set of used member names

    def get(self, name):
        return self.objects.get(name)

    def set(self, obj):
        name = obj.get_name()
        self.objects[name] = obj

        class_name = obj.get_def().get_name()
        if class_name not in self.used_members:
            self.used_members[class_name] = set()
        used_set = self.used_members[class_name]
        for member_name, val in obj.value.items():
            used_set.add(member_name)

    def read_binary(self, buffer):
        """Read a TGCL binary buffer. Returns dict of name -> LevelValueClass."""
        if not isinstance(buffer, (bytearray,)):
            buffer = bytearray(buffer)

        header = LoHeader().read(buffer)
        L = self.indices
        L.redefine()

        # Read memvars from binary.
        for i in range(header.num_mem_vars):
            off = header.memvars_offset + i * 16
            L.add_memvar_from_blob(
                bio.read_u32(buffer, off),
                LoStringPool.read(buffer, header.strings_offset + bio.read_u32(buffer, off + 4)),
                bio.read_u32(buffer, off + 8),
                bio.read_u32(buffer, off + 12),
            )

        # Read classes from binary.
        for i in range(header.num_classes):
            off = header.classes_offset + i * 12
            L.add_class_from_blob(
                LoStringPool.read(buffer, header.strings_offset + bio.read_u32(buffer, off)),
                bio.read_u32(buffer, off + 4),
                bio.read_u32(buffer, off + 8),
            )

        # Match binary classes to registered definitions.
        for c in L.classes:
            defn = L.meta_classes.get(c.name)

            if defn is not None:
                # Known class: register members present in binary but missing from definition.
                for mem_name, memvar in c.raw.items():
                    if defn.get_member(mem_name) is None:
                        _add_member_from_memvar(defn, L.classes, c.name, mem_name, memvar)
            else:
                # Unknown class: synthesize a definition from binary memvars.
                defn = MetaTypeClass(c.name, kMetaTypes["Object"])
                defn.is_auto_created = True
                for mem_name, memvar in c.raw.items():
                    _add_member_from_memvar(defn, L.classes, c.name, mem_name, memvar)
                L.meta_classes[c.name] = defn
                L.meta_types[c.name] = defn

            c.set_def(defn)

        # Read objects.
        cursor = header.objects_offset
        k = 0
        while k < header.num_objects and cursor < header.file_size:
            class_idx = bio.read_u32(buffer, cursor)
            name, name_end = bio.read_cstring(buffer, cursor + 4)
            if class_idx >= len(L.classes) or class_idx < 0:
                raise kObjectExceptions["InvalidClassIndex"].build(class_idx)

            # Advance past the inline name by its on-disk byte span.
            name_end = cursor + 4
            while name_end < len(buffer) and buffer[name_end] != 0:
                name_end += 1
            cursor = name_end + 1

            raw = L.classes[class_idx]
            if raw is None:
                raise kObjectExceptions["InvalidClassIndex"].build(class_idx)

            obj_def = raw.defn
            if obj_def is not None and getattr(obj_def, 'is_auto_created', False):
                raw_result = _read_raw_members(L, buffer, cursor, raw, obj_def, name)
                obj = raw_result["obj"]
                obj_size = raw_result["size"]
            else:
                obj = obj_def.read(L, buffer, cursor, raw)
                obj_size = obj.get_size()

            if obj is None or not isinstance(name, str):
                raise kObjectExceptions["ReadObjectFailed"].build()

            obj.name = name
            L.objects.append(obj)
            self.set(obj)

            cursor += obj_size
            k += 1

        # Backpatch pointers.
        for p in L.pointers:
            p.backpatch(L)

        # Reset indices for write use.
        L.redefine()

        return self.objects

    def write_binary(self, used_members=None):
        """Serialize stored objects to a TGCL binary buffer (bytes)."""
        L = self.indices
        strings = LoStringPool()

        um = used_members if used_members is not None else self.used_members

        # Reset indices and rebuild from meta types with pruning.
        L.redefine()

        # Collect which classes are directly used by objects.
        used_class_names = set()
        for name, obj in self.objects.items():
            used_class_names.add(obj.get_def().get_name())

        # Register classes with pruning.
        for class_name, class_def in L.meta_classes.items():
            if class_name not in used_class_names:
                continue
            member_set = um.get(class_name)
            L.add_class_from_def(class_def, member_set)

        # Register objects.
        for name, obj in self.objects.items():
            L.add_object(obj)

        # Collect and resolve pointers.
        for name, obj in self.objects.items():
            _recursive_objects(obj, L)

        # Write sections.
        memvar_buf = bytearray(len(L.memvars) * 16)
        for mi, m in enumerate(L.memvars):
            m_off = mi * 16
            bio.write_u32(memvar_buf, m.type, m_off)
            bio.write_u32(memvar_buf, strings.set(m.name), m_off + 4)
            bio.write_u32(memvar_buf, m.size, m_off + 8)
            bio.write_u32(memvar_buf, m.aux, m_off + 12)

        class_buf = bytearray(len(L.classes) * 12)
        first_memvar_acc = 0
        for ci, cc in enumerate(L.classes):
            c_off = ci * 12
            bio.write_u32(class_buf, strings.set(cc.name), c_off)
            bio.write_u32(class_buf, first_memvar_acc, c_off + 4)
            bio.write_u32(class_buf, len(cc.raw), c_off + 8)
            first_memvar_acc += len(cc.raw)

        string_buf = strings.write()

        # Build objects section dynamically to avoid buffer overflow when
        # actual write size exceeds get_size() (e.g. missing members get
        # default values written that weren't counted in finalize()).
        obj_buf = bytearray()
        for o in L.objects:
            c_idx = L.get_class_idx(o.get_def().get_name())
            if c_idx == -1:
                raise kObjectExceptions["InvalidClassName"].build(o.get_def().get_name())

            obj_buf.extend(bio.alloc(4))
            bio.write_u32(obj_buf, c_idx, len(obj_buf) - 4)

            name_buf = (o.get_name() + "\0").encode("utf-8")
            obj_buf.extend(name_buf)

            raw2 = L.classes[c_idx]
            # Write data into a temp buffer large enough to hold the object.
            # Start with 2x estimate + 1MB margin, grow if needed.
            temp_size = max(o.get_size() * 2 + 65536, 1024 * 1024)
            while True:
                temp_buf = bytearray(temp_size)
                n = o.get_def().write(L, temp_buf, o, 0, raw2)
                if n:
                    obj_buf.extend(temp_buf[:n])
                    break
                # write returned 0, likely buffer too small; double and retry
                temp_size *= 2
                if temp_size > 256 * 1024 * 1024:  # 256MB hard cap
                    raise kObjectExceptions["ReadObjectFailed"].build()

        header_size = 44
        classes_offset = header_size
        memvars_offset = classes_offset + len(class_buf)
        strings_offset = memvars_offset + len(memvar_buf)
        objects_offset = strings_offset + len(string_buf)
        file_size = objects_offset + len(obj_buf)

        header = LoHeader()
        header.num_classes = len(L.classes)
        header.num_mem_vars = len(L.memvars)
        header.num_objects = len(L.objects)
        header.num_refs = len(L.pointers)
        header.classes_offset = classes_offset
        header.memvars_offset = memvars_offset
        header.strings_offset = strings_offset
        header.objects_offset = objects_offset
        header.file_size = file_size

        result = bytearray(file_size)
        hdr_bytes = header.write()
        result[:len(hdr_bytes)] = hdr_bytes
        result[classes_offset:classes_offset + len(class_buf)] = class_buf
        result[memvars_offset:memvars_offset + len(memvar_buf)] = memvar_buf
        result[strings_offset:strings_offset + len(string_buf)] = string_buf
        result[objects_offset:objects_offset + len(obj_buf)] = obj_buf

        return bytes(result)


# --- Helper functions ---

def _recursive_objects(obj, L):
    """Recursively collect and resolve pointers from object members."""
    from .level_value import LevelValue
    for mname, mval in obj.value.items():
        memb = obj.get_def().get_member(mname)
        if memb is None:
            continue

        if memb.value_type() == kMetaValueType.Class:
            childs = mval if isinstance(mval, list) else [mval]
            for c in childs:
                _recursive_objects(c, L)
            continue

        if memb.value_type() != kMetaValueType.Pointer:
            continue

        ptrs = mval if isinstance(mval, list) else [mval]
        for p in ptrs:
            if not isinstance(p, LevelValuePointer):
                continue
            if p.target_name is not None:
                target_idx = L.object_indices.get(p.target_name)
                if target_idx is None:
                    raise kObjectExceptions["UnresolvedObjectReference"].build(p.target_name)
                p.set_index(target_idx)
            L.pointers.append(p)


def _add_member_from_memvar(defn, classes, class_name, mem_name, memvar):
    """Register a member on def from a binary memvar descriptor."""
    if memvar.type == kMemvarTypes.String:
        return defn.add_member(kMetaTypes["CString"], mem_name)
    if memvar.type == kMemvarTypes.Ref:
        return defn.add_member(kMetaTypes["Pointer"], mem_name)
    if memvar.type == kMemvarTypes.Array:
        if memvar.aux != 0xFFFFFFFF and 0 <= memvar.aux < len(classes) and classes[memvar.aux].defn is not None:
            return defn.add_member(classes[memvar.aux].defn, mem_name, 0)
        return defn.add_member(kMetaTypes["Pointer"], mem_name, 0)
    # Raw: fixed-size byte blobs.
    return defn.add_member(
        MetaTypeRaw(class_name + "::" + mem_name, memvar.size or 4), mem_name)


def _read_raw_members(L, B, off, raw, defn, name):
    """Read raw object member data using binary memvar info directly."""
    obj = LevelValueClass(defn, name)
    cursor = off

    for mem_name, memvar in raw.raw.items():
        result = None
        try:
            result = _read_raw_member(L, B, cursor, memvar, defn, mem_name)
        except Exception:
            result = None

        if result is None or result.get("value") is None:
            cursor += memvar.size or 4
            continue

        v = result["value"]
        if memvar.type == kMemvarTypes.Ref:
            L.pointers.append(v)
        elif memvar.type == kMemvarTypes.Array and memvar.aux == 0xFFFFFFFF:
            L.pointers.extend(v)

        obj.set_value(mem_name, v)
        cursor += result["size"]

    obj.finalize()
    return {"obj": obj, "size": cursor - off}


def _read_raw_member(L, B, off, memvar, defn, mem_name):
    """Read one raw member. Returns dict with 'value' and 'size'."""
    if memvar.type == kMemvarTypes.String:
        sv = kMetaTypes["CString"].read(L, B, off)
        return {"value": sv, "size": sv.get_size()}
    if memvar.type == kMemvarTypes.Ref:
        return {"value": kMetaTypes["Pointer"].read(L, B, off), "size": 4}
    if memvar.type == kMemvarTypes.Array:
        return _read_raw_array(L, B, off, memvar, defn, mem_name)

    # Raw: fixed-size byte blobs.
    size = memvar.size or 4
    return {
        "value": MetaTypeRaw(defn.get_name() + "::" + mem_name, size).read(L, B, off),
        "size": size,
    }


def _read_raw_array(L, B, off, memvar, defn, mem_name):
    """Read an Array member: ref array, inline class array, or raw blob."""
    count = bio.read_u32(B, off)
    elem_cursor = off + 4
    elem_type = memvar.aux

    # Ref array: object-index pointers.
    if elem_type == 0xFFFFFFFF:
        elements = []
        for i in range(count):
            elements.append(kMetaTypes["Pointer"].read(L, B, elem_cursor))
            elem_cursor += 4
        return {"value": elements, "size": 4 + count * 4}

    # Inline class array: each element is a sub-object of a known class.
    if 0 <= elem_type < len(L.classes):
        elements = []
        sub_raw = L.classes[elem_type]
        sub_def = sub_raw.defn
        for j in range(count):
            if sub_def is not None and getattr(sub_def, 'is_auto_created', False):
                sub = _read_raw_members(L, B, elem_cursor, sub_raw, sub_def, "")
                sub_obj = sub["obj"]
                sub_size = sub["size"]
            else:
                sub_obj = sub_def.read(L, B, elem_cursor, sub_raw)
                sub_size = sub_obj.get_size()
            elements.append(sub_obj)
            elem_cursor += sub_size
        return {"value": elements, "size": elem_cursor - off}

    # Unknown element type: capture as raw bytes.
    size = 4 + count * (memvar.size or 4)
    return {
        "value": MetaTypeRaw(defn.get_name() + "::" + mem_name, size).read(L, B, off),
        "size": size,
    }
