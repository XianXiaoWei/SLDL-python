"""
sldl-objects type system - all MetaType classes.

Ported from the JavaScript sldl-objects/src/type/*.js files.
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later

All MetaType subclasses are combined here to avoid circular import issues
(the type classes create LevelValue instances in their read() methods).
"""

from . import binaryio as bio


# --- Value type and flag enums ---

class kMetaValueType:
    None_ = 0
    Number = 1
    String = 2
    Struct = 3
    Class = 4
    Pointer = 5
    Raw = 6

class kMetaValueFlag:
    None_ = 0
    Array = 1
    Clump = 2


# Memvar types (same as in levelObjects.js)
class kMemvarTypes:
    Raw = 0
    String = 1
    Ref = 2
    Array = 3


# --- Base MetaType ---

class MetaType:
    """General type definition."""

    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name

    def get_size(self):
        return 0

    def get_align(self):
        return 1

    def value_type(self):
        return kMetaValueType.None_

    def value_flag(self):
        return kMetaValueFlag.None_

    def read(self, L, B, off, raw=None):
        return None

    def write(self, L, B, val, off, raw=None):
        return 0


class MetaTypeForward(MetaType):
    """A type that forwards all operations to another MetaType."""

    def __init__(self, defn, name):
        super().__init__(name)
        self.defn = defn

    def get_size(self):
        return self.defn.get_size()

    def get_align(self):
        return self.defn.get_align()

    def value_type(self):
        return self.defn.value_type()

    def value_flag(self):
        return self.defn.value_flag()

    def read(self, L, B, off, raw=None):
        return self.defn.read(L, B, off, raw)

    def write(self, L, B, val, off, raw=None):
        return self.defn.write(L, B, val, off, raw)


# --- Bool ---

class MetaTypeBool(MetaType):
    def get_size(self):
        return 1

    def get_align(self):
        return 1

    def value_type(self):
        return kMetaValueType.Number

    def read(self, L, B, off, raw=None):
        from .level_value import LevelValueBool
        r = LevelValueBool(self)
        r.set_value(bool(bio.read_u8(B, off)))
        return r

    def write(self, L, B, val, off, raw=None):
        if val.defn is not self:
            return 0
        bio.write_u8(B, 1 if val.get_value() else 0, off)
        return val.get_size()


# --- Number ---

class MetaTypeNumber(MetaType):
    def __init__(self, name, size, reader, writer):
        super().__init__(name)
        self.size = size
        self.reader = reader
        self.writer = writer

    def get_size(self):
        return self.size

    def get_align(self):
        return self.size

    def value_type(self):
        return kMetaValueType.Number

    def read(self, L, B, off, raw=None):
        from .level_value import LevelValueNumber
        r = LevelValueNumber(self)
        r.set_value(self.reader(B, off))
        return r

    def write(self, L, B, val, off, raw=None):
        if val.defn is not self:
            return 0
        self.writer(B, val.get_value(), off)
        return val.get_size()


# --- Pointer ---

class MetaTypePointer(MetaType):
    def __init__(self, name, target):
        super().__init__(name)
        self.points = target

    def get_size(self):
        return 4

    def get_align(self):
        return 4

    def value_type(self):
        return kMetaValueType.Pointer

    def is_compatible(self, actual):
        if not self.points:
            return True
        return self.points.is_compatible(actual)

    def read(self, L, B, off, raw=None):
        from .level_value import LevelValuePointer
        r = LevelValuePointer(self)
        r.set_index(bio.read_u32(B, off))
        return r

    def write(self, L, B, val, off, raw=None):
        bio.write_u32(B, val.index, off)
        return self.get_size()


# --- String ---

class MetaTypeString(MetaType):
    def value_type(self):
        return kMetaValueType.String

    def read(self, L, B, off, raw=None):
        from .level_value import LevelValueString
        r = LevelValueString(self)
        end = off
        while end < len(B) and B[end] != 0:
            end += 1
        r.set_raw(bytes(B[off:end]))
        return r

    def write(self, L, B, val, off, raw=None):
        if val.defn is not self:
            return 0
        b = val.get_bytes()
        B[off:off + len(b)] = b
        B[off + len(b)] = 0
        return len(b) + 1


# --- Raw ---

class MetaTypeRaw(MetaType):
    def __init__(self, name, size):
        super().__init__(name)
        self.size = size

    def get_size(self):
        return self.size

    def get_align(self):
        if self.size <= 4:
            return self.size
        elif self.size <= 8:
            return 4
        return 8

    def value_type(self):
        return kMetaValueType.Raw

    def read(self, L, B, off, raw=None):
        from .level_value import LevelValueRaw
        r = LevelValueRaw(self)
        r.set_value(bytes(B[off:off + self.size]))
        return r

    def write(self, L, B, val, off, raw=None):
        if val.defn is not self:
            return 0
        buf = val.get_value()
        length = min(len(buf), self.size)
        B[off:off + length] = buf[:length]
        return self.size


# --- Struct ---

class MetaTypeStructMember(MetaTypeForward):
    def __init__(self, defn, name, count=None):
        super().__init__(defn, name)
        self.offset = 0
        self.count = count or 1

    def get_size(self):
        return self.defn.get_size() * self.count

    def read(self, L, B, off, raw=None):
        begin = off + self.offset
        if self.count == 1:
            return self.defn.read(L, B, begin)
        r = []
        for i in range(self.count):
            r.append(self.defn.read(L, B, begin + i * self.defn.get_size()))
        return r

    def write(self, L, B, val, off, raw=None):
        begin = off + self.offset
        if self.count == 1:
            return self.defn.write(L, B, val, begin)
        if self.count != len(val):
            return 0
        for i in range(self.count):
            v = val[i]
            if v.defn is not self.defn:
                return 0
            if not self.defn.write(L, B, v, begin + i * self.defn.get_size()):
                return 0
        return self.defn.get_size() * self.count


class MetaTypeStruct(MetaType):
    def __init__(self, name):
        super().__init__(name)
        self.members = {}  # ordered dict: name -> MetaTypeStructMember
        self.size = 0
        self.align = 0
        self.cursor = 0

    def get_size(self):
        return self.size

    def get_align(self):
        return self.align

    def value_type(self):
        return kMetaValueType.Struct

    def add_member(self, defn, name, count=None):
        if defn.value_type() != kMetaValueType.Number and defn.value_type() != kMetaValueType.Struct:
            return False
        if name in self.members:
            return False

        member = MetaTypeStructMember(defn, self.name + "::" + name, count)
        align = member.get_align()
        # Align to integer multiple of alignment.
        if self.cursor % align:
            member.offset = self.cursor - (self.cursor % align) + align
        else:
            member.offset = self.cursor
        self.cursor = member.offset + member.get_size()
        self.align = max(self.align, align)
        if self.cursor % self.align:
            self.size = self.cursor - (self.cursor % self.align) + self.align
        else:
            self.size = self.cursor
        self.members[name] = member
        return True

    def finalize(self, align=None):
        if align is not None:
            align = int(align)
            if align <= 0 or (align & (align - 1)):
                return False
            self.align = align
        if self.cursor % self.align:
            self.size = self.cursor - (self.cursor % self.align) + self.align
        else:
            self.size = self.cursor
        return True

    def read(self, L, B, off, raw=None):
        if off + self.get_size() > len(B):
            return None
        from .level_value import LevelValueStruct
        r = LevelValueStruct(self)
        for name, member in self.members.items():
            m = member.read(L, B, off)
            r.set_value(name, m)
        return r

    def write(self, L, B, val, off, raw=None):
        if val.defn is not self:
            return 0
        for name, member in self.members.items():
            m = val.get_value(name)
            if m is None:
                return 0
            if not member.write(L, B, m, off):
                return 0
        return self.get_size()


# --- Class ---

class MetaTypeClassMember(MetaTypeForward):
    """A member of a class, wrapping another MetaType."""
    pass


class MetaTypeClassMemberArray(MetaTypeClassMember):
    """An array member of a class."""

    def __init__(self, defn, name, count=None):
        super().__init__(defn, name)
        self.max_count = count or 0

    def value_flag(self):
        return kMetaValueFlag.Array

    def read(self, L, B, off, raw=None):
        count = bio.read_u32(B, off)
        cursor = off + 4
        if self.max_count and count > self.max_count:
            return None
        r = []
        for i in range(count):
            v = self.defn.read(L, B, cursor, _class_raw_for(L, self.defn))
            r.append(v)
            cursor += v.get_size()
        return r

    def write(self, L, B, val, off, raw=None):
        if self.max_count and len(val) > self.max_count:
            return 0
        bio.write_u32(B, len(val), off)
        cursor = off + 4
        for v in val:
            n = self.defn.write(L, B, v, cursor)
            if not n:
                return 0
            cursor += n
        return cursor - off


def _class_raw_for(L, defn):
    """Get the binary class descriptor for a class/clump member."""
    if defn.value_type() == kMetaValueType.Class or defn.value_flag() == kMetaValueFlag.Clump:
        idx = L.get_class_idx(defn.get_name())
        if 0 <= idx < len(L.classes):
            return L.classes[idx]
    return None


def _read_unknown_member(L, B, off, raw_memvar):
    """Read a member that has no matching definition, using raw memvar info."""
    from .types import kMetaTypes
    if raw_memvar is None:
        return MetaTypeRaw("raw", 4).read(L, B, off)
    if raw_memvar["type"] == kMemvarTypes.String:
        return kMetaTypes["CString"].read(L, B, off)
    if raw_memvar["type"] == kMemvarTypes.Ref:
        return kMetaTypes["Pointer"].read(L, B, off)
    return MetaTypeRaw("raw", raw_memvar.get("size", 0) or 4).read(L, B, off)


class MetaTypeClass(MetaType):
    def __init__(self, name, parent=None):
        super().__init__(name)
        # parent=None means "default to Object" (resolved lazily to avoid
        # circular import when Object itself is being created).
        self.parent = parent
        self.members = {}  # ordered dict: name -> member
        self.is_auto_created = False

    def _resolve_parent(self):
        """Lazily resolve None parent to the Object builtin."""
        if self.parent is None and self.name != "Object":
            from .types import kMetaTypes
            obj = kMetaTypes.get("Object")
            if obj is not None:
                self.parent = obj
        return self.parent

    def is_compatible(self, defn):
        p = self
        while p is not None:
            if defn is p:
                return True
            p = p._resolve_parent() if hasattr(p, '_resolve_parent') else p.parent
        return False

    def value_type(self):
        return kMetaValueType.Class

    def add_member(self, defn, name, count=None):
        if self.get_member(name) is not None:
            return False

        # If def is already a ClassMember or array, use it directly.
        if isinstance(defn, MetaTypeClassMember) or defn.value_flag() == kMetaValueFlag.Array:
            member = defn
        elif count is not None:
            member = MetaTypeClassMemberArray(defn, self.name + "::" + name, count)
        else:
            member = MetaTypeClassMember(defn, self.name + "::" + name)

        self.members[name] = member
        return True

    def get_member(self, name):
        p = self
        while p is not None:
            m = p.members.get(name)
            if m is not None:
                return m
            p = p._resolve_parent() if hasattr(p, '_resolve_parent') else p.parent
        return None

    def all_members(self, used_members=None):
        r = []
        seen = set()
        p = self
        while p is not None:
            for member_name, member in p.members.items():
                if member_name in seen:
                    continue
                if used_members is not None and member_name not in used_members:
                    continue
                seen.add(member_name)
                r.append((member_name, member))
            p = p._resolve_parent() if hasattr(p, '_resolve_parent') else p.parent
        return r

    def read(self, L, B, off, raw=None):
        from .level_value import LevelValueClass, LevelValue
        r = LevelValueClass(self, "")
        cursor = off
        if raw is not None:
            member_names = list(raw.raw.keys())
        else:
            member_names = [e[0] for e in self.all_members()]

        for member_name in member_names:
            m = self.get_member(member_name)
            raw_memvar = raw.raw.get(member_name) if raw else None
            v = None
            try:
                if m is not None:
                    v = m.read(L, B, cursor, _class_raw_for(L, m.defn))
                else:
                    v = _read_unknown_member(L, B, cursor, raw_memvar)
            except Exception:
                v = None

            if v is None:
                cursor += (raw_memvar.get("size", 0) or 4) if raw_memvar else (m.get_size() if m else 4)
                continue

            if m is not None and m.value_type() == kMetaValueType.Pointer:
                if isinstance(v, list):
                    L.pointers.extend(v)
                else:
                    L.pointers.append(v)

            r.set_value(member_name, v)
            cursor += LevelValue.size_of(v)

        r.finalize()
        return r

    def write(self, L, B, val, off, raw=None):
        cursor = off
        if raw is not None:
            member_names = list(raw.raw.keys())
        else:
            member_names = [e[0] for e in self.all_members()]

        for member_name in member_names:
            m = self.get_member(member_name)
            v = val.get_value(member_name)
            if v is None:
                v = MetaTypeClass.member_type_default(m)

            n = m.write(L, B, v, cursor)
            if not n:
                # Fallback: write value as raw bytes if member def mismatch.
                from .binaryio import is_buffer
                inner = v.get_value() if hasattr(v, 'get_value') else None
                if inner is not None and is_buffer(inner):
                    buf = inner
                    length = min(len(buf), m.get_size())
                    B[cursor:cursor + length] = buf[:length]
                    n = m.get_size()
                elif v is not None and hasattr(v, 'def') and v.defn is not None and hasattr(v.defn, 'write') and v.defn is not m.defn:
                    n = v.defn.write(L, B, v, cursor)
            if not n:
                return 0
            cursor += n

        return cursor - off

    @staticmethod
    def member_type_default(member):
        """Create a default LevelValue for a member type."""
        from .level_value import (LevelValuePointer, LevelValueString,
                                   LevelValueNumber, LevelValueRaw,
                                   LevelValueStruct)
        from .types import kMetaTypes

        vt = member.value_type()
        defn = member.defn

        if member.value_flag() == kMetaValueFlag.Array:
            return []

        if vt == kMetaValueType.Pointer:
            p = LevelValuePointer(defn)
            p.set_index(0xFFFFFFFF)
            return p

        if vt == kMetaValueType.String:
            s = LevelValueString(defn)
            s.set_value("")
            return s

        if vt == kMetaValueType.Number:
            n = LevelValueNumber(defn)
            n.set_value(0)
            return n

        if vt == kMetaValueType.Raw:
            r = LevelValueRaw(defn)
            r.set_value(bytearray(defn.get_size()))
            return r

        if vt == kMetaValueType.Struct:
            st = LevelValueStruct(defn)
            for name, sm in defn.members.items():
                sv = MetaTypeClass.member_type_default(sm)
                st.set_value(name, sv)
            return st

        # Fallback
        fallback = LevelValueNumber(defn)
        fallback.set_value(0)
        return fallback


class MetaTypeClump(MetaTypeForward):
    """Clump<T> generic type, forwarding to the base Clump class."""

    def __init__(self, name, generic_param=None):
        from .types import kMetaTypes
        super().__init__(kMetaTypes["Clump"], name)
        self.generic_param = generic_param

    @property
    def members(self):
        return self.defn.members

    @property
    def parent(self):
        return self.defn.parent

    @parent.setter
    def parent(self, v):
        self.defn.parent = v

    def all_members(self, used_members=None):
        return self.defn.all_members(used_members)

    def get_member(self, name):
        return self.defn.get_member(name)

    def add_member(self, defn, name, count=None):
        return self.defn.add_member(defn, name, count)

    def is_compatible(self, defn):
        return self.defn.is_compatible(defn)

    def value_type(self):
        return kMetaValueType.Class

    def value_flag(self):
        return kMetaValueFlag.Clump
