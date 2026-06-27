"""
sldl-jsonify - JSON frontend for sldl-objects.

Ported from the JavaScript sldl-jsonify package.
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later

Provides JsonLevelObjects: a high-level JSON-based reader/writer that wraps
sldl-objects' LevelObjects with JSON serialization.
"""

from ..objects import (MetaTypeClass, MetaTypeClump, MetaTypeClassMemberArray,
                         LevelObjects, LevelValueClass, kMetaTypes, kMetaValueType)
from .decl_group import DeclarationGroup
from . import json_value
from .exceptions import kJsonifyException


class JsonLevelObjects:
    """High-level JSON-based reader/writer for TGCL .level.bin files.

    Wraps sldl-objects' LevelObjects with JSON serialization.

    Usage:
        decl = DeclarationGroup(json_decl).parse()
        jlo = JsonLevelObjects(decl)
        # Read binary -> JSON
        objects = jlo.read(binary_data)
        # Write JSON -> binary
        binary_data = jlo.write(json_objects)
    """

    def __init__(self, decl_group):
        """Initialize with a JSON declaration group or a pre-parsed DeclarationGroup.

        Args:
            decl_group: A dict (JSON declaration group) or a DeclarationGroup instance.
        """
        if isinstance(decl_group, DeclarationGroup):
            dg = _clone_decl_group(decl_group)
        else:
            dg = DeclarationGroup(decl_group).parse()

        defs = _build_defs(dg)
        self.decl_group = dg
        self.lo = LevelObjects(defs)

    def read(self, buffer):
        """Read a TGCL binary buffer.

        Unknown types encountered in the binary are auto-added to the stored
        declaration group.

        Args:
            buffer: bytes/bytearray containing TGCL binary data.

        Returns:
            dict with "O$name" keys mapping to JSON objects.
        """
        value_map = self.lo.read_binary(buffer)
        result = {}

        for name, obj in value_map.items():
            json_obj = json_value.serialize_class(obj, None)
            result["O$" + name] = json_obj

        # Rebuild declaration group from LevelObjects indices.
        self.decl_group = self.build_decl_group()
        return result

    def write(self, objects):
        """Write JSON objects to a TGCL binary buffer.

        Args:
            objects: dict with "O$name" keys.

        Returns:
            bytes containing TGCL binary data.
        """
        for obj_key, obj_data in objects.items():
            if not obj_key.startswith("O$"):
                continue

            obj_name = obj_key[2:]
            class_name = obj_data.get("$type")
            if not isinstance(class_name, str):
                raise kJsonifyException["UnrecognizedType"].build(str(class_name))

            class_def = self.lo.indices.meta_classes.get(class_name)
            if class_def is None:
                raise kJsonifyException["UnrecognizedType"].build(class_name)

            lvc = LevelValueClass(class_def, obj_name)

            for member_name, member in class_def.all_members():
                jv = obj_data.get(member_name)
                if jv is not None:
                    lv = json_value.parse(jv, member, self.decl_group)
                else:
                    lv = MetaTypeClass.member_type_default(member)
                lvc.set_value(member_name, lv)

            lvc.finalize()
            self.lo.set(lvc)

        return self.lo.write_binary()

    def get_decl_group(self, as_json=False):
        """Get the current declaration group.

        Args:
            as_json: if True, return a plain dict with C$/S$/A$ keys.

        Returns:
            DeclarationGroup instance or plain dict.
        """
        if self.decl_group is None:
            return {} if as_json else DeclarationGroup({})

        if as_json:
            result = {}

            for name, type_ in self.decl_group.types.items():
                if _is_builtin(name) or isinstance(type_, MetaTypeClump):
                    continue
                tn = type_.get_name()
                vt = type_.value_type()

                if vt == kMetaValueType.Class:
                    class_obj = {}
                    if type_.parent is not None and type_.parent.get_name() != "Object":
                        class_obj["$parent"] = type_.parent.get_name()
                    for mn, m in type_.members.items():
                        class_obj[mn] = _member_to_string(m)
                    result["C$" + name] = class_obj
                elif vt == kMetaValueType.Struct:
                    struct_obj = {}
                    for mn, m in type_.members.items():
                        struct_obj[mn] = _member_to_string(m)
                    result["S$" + name] = struct_obj
                elif vt == kMetaValueType.Number:
                    result["A$" + name] = tn

            # Include enum constants.
            for ek, ev in self.decl_group.enum_info.items():
                key = "E$" + ev["enum_name"]
                if key not in result:
                    result[key] = {"$as": "int32_t"}

            return result

        return self.decl_group

    def build_decl_group(self):
        """Build a DeclarationGroup from the current LevelObjects state.

        Used after read to capture auto-created types.
        """
        dg = DeclarationGroup({})
        L = self.lo.indices

        for name, type_ in L.meta_types.items():
            rn = type_.get_name()
            if _is_builtin(name) or _is_builtin(rn):
                continue
            dg.types[name] = type_
            if type_.value_type() == kMetaValueType.Class:
                dg.classes[name] = type_

        return dg


def _build_defs(dg):
    """Build the MetaType[] definitions list from a declaration group."""
    defs = []
    for type_ in dg.types.values():
        defs.append(type_)
    for key, builtin in kMetaTypes.items():
        if key not in dg.types:
            defs.append(builtin)
    return defs


def _clone_decl_group(src):
    """Shallow-copy a pre-parsed DeclarationGroup into a fresh instance."""
    dg = DeclarationGroup({})
    for name, type_ in src.types.items():
        dg.types[name] = type_
    for name, cls in src.classes.items():
        dg.classes[name] = cls
    for name, val in src.enum_constants.items():
        dg.enum_constants[name] = val
    for name, info in src.enum_info.items():
        dg.enum_info[name] = info
    if src.alias_map is not None:
        dg.alias_map = {}
        for ak, av in src.alias_map.items():
            dg.alias_map[ak] = av
    dg.raw = src.raw
    return dg


def _member_to_string(member):
    """Convert a MetaTypeClassMember to its string representation."""
    type_name = member.defn.get_name()

    pointer_target = "Object"
    if (member.value_type() == kMetaValueType.Pointer
            and member.defn.points is not None
            and member.defn.points is not kMetaTypes["Object"]):
        pointer_target = member.defn.points.get_name()

    if isinstance(member, MetaTypeClassMemberArray):
        suffix = f"[{member.max_count}]" if member.max_count else "[]"

        if member.value_type() == kMetaValueType.Pointer:
            return pointer_target + " *" + suffix
        return type_name + " " + suffix

    if member.value_type() == kMetaValueType.Pointer:
        return pointer_target + " *"

    if member.value_type() == kMetaValueType.Raw:
        return "R$" + str(member.get_size())

    return type_name


def _is_builtin(name):
    """Check if a type name corresponds to a built-in type."""
    if name in kMetaTypes:
        return True
    for key, builtin in kMetaTypes.items():
        if builtin.get_name() == name:
            return True
    return False


__all__ = [
    "DeclarationGroup",
    "json_value",
    "kJsonifyException",
    "JsonLevelObjects",
]
