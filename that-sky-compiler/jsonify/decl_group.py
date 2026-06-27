"""
sldl-jsonify DeclarationGroup - parses JSON declarations into MetaType instances.

Ported from the JavaScript sldl-jsonify/src/declGroup.js
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later
"""

import re

from ..objects import (kMetaTypes, get_clump_generic, clump_generic_cache,
                         MetaType, MetaTypeForward, kMetaValueType,
                         MetaTypeClass, MetaTypeClassMember, MetaTypeClassMemberArray,
                         MetaTypeStruct, MetaTypeRaw, MetaTypePointer, MetaTypeClump)
from .exceptions import kJsonifyException


class DeclarationGroup:
    """Parses a JSON declaration group into MetaType instances.

    JSON keys use prefixes:
      A$ - type alias
      E$ - enum
      S$ - struct
      C$ - class
    """

    def __init__(self, decl_group):
        self.types = {}       # name -> MetaType
        self.classes = {}     # name -> MetaTypeClass
        self.enum_constants = {}  # name -> value
        self.enum_info = {}   # name -> {name, value, enum_name}
        self.alias_map = None
        self.raw = decl_group

        # Register built-in types.
        for key, builtin in kMetaTypes.items():
            self.types[key] = builtin
            rt_name = builtin.get_name()
            if rt_name != key:
                self.types[rt_name] = builtin
        for key, val in self.types.items():
            if isinstance(val, MetaTypeClass):
                self.classes[key] = val

    def parse(self):
        if not isinstance(self.raw, dict):
            return self

        # Phase 1: Categorize entries.
        aliases = {}
        enums = {}
        structs = {}
        classes = {}
        all_names = set()

        for key, val in self.raw.items():
            if key.startswith("A$"):
                name = key[2:]
                self._check_duplicate(all_names, name)
                aliases[name] = val
            elif key.startswith("E$"):
                name = key[2:]
                self._check_duplicate(all_names, name)
                enums[name] = val
            elif key.startswith("S$"):
                name = key[2:]
                self._check_duplicate(all_names, name)
                structs[name] = val
            elif key.startswith("C$"):
                name = key[2:]
                self._check_duplicate(all_names, name)
                classes[name] = val

        # Phase 2: Resolve aliases (store for later).
        for name, target_name in aliases.items():
            if not isinstance(target_name, str):
                raise kJsonifyException["InvalidAliasTarget"].build(name, str(target_name))
            if self.alias_map is None:
                self.alias_map = {}
            self.alias_map[name] = target_name

        # Phase 3: Build enums.
        for name, enum_def in enums.items():
            if not isinstance(enum_def, dict):
                raise kJsonifyException["InvalidEnumBaseType"].build(name, str(enum_def))

            base_type_name = enum_def.get("$as")
            if not isinstance(base_type_name, str):
                raise kJsonifyException["InvalidEnumBaseType"].build(name, str(base_type_name))

            signed_ints = ["int8_t", "int16_t", "int32_t", "int64_t"]
            if base_type_name not in signed_ints:
                raise kJsonifyException["InvalidEnumBaseType"].build(name, base_type_name)

            for const_key, const_val in enum_def.items():
                if const_key.startswith("$"):
                    continue
                if const_key in self.enum_info:
                    raise kJsonifyException["DuplicateEnumConstant"].build(const_key)

                if isinstance(const_val, (int, float)):
                    parsed = int(const_val)
                elif isinstance(const_val, str):
                    parsed = int(const_val, 10) if const_val.strip() else 0
                else:
                    parsed = 0

                self.enum_info[const_key] = {"name": const_key, "value": parsed, "enum_name": name}
                self.enum_constants[const_key] = parsed

        # Phase 4-5: Forward-declare structs and classes.
        for name in structs:
            self._declare_struct(name)
        for name, raw in classes.items():
            self._declare_class(name, raw)

        # Phase 6: Populate struct members.
        for name, struct_def in [(n, self.types.get(n)) for n in structs]:
            if not isinstance(struct_def, MetaTypeStruct):
                continue

            struct_raw = structs[name]
            align = struct_raw.get("$align")
            if align is not None:
                if not isinstance(align, (int, float)) or align <= 0 or (int(align) & (int(align) - 1)):
                    raise kJsonifyException["InvalidValueFormat"].build(align, f"$align for struct {name}")

            for member_key, member_type_expr in struct_raw.items():
                if member_key.startswith("$"):
                    continue
                if not isinstance(member_type_expr, str):
                    raise kJsonifyException["InvalidMemberSyntax"].build(str(member_type_expr))

                result = self._parse_struct_member_type(member_type_expr, name, member_key)
                struct_def.add_member(result["type"], member_key, result["count"])

            struct_def.finalize(align)

        # Phase 7: Resolve class inheritance and populate members.
        for name, class_def in classes.items():
            cd = self.classes.get(name)
            if cd is None:
                continue

            class_raw = classes[name]

            # Resolve $parent.
            parent_name = class_raw.get("$parent")
            if parent_name is None:
                pass  # Use Object as default parent - already set.
            elif isinstance(parent_name, str):
                parent_def = self._resolve_type(parent_name)
                if parent_def is None or not isinstance(parent_def, MetaTypeClass):
                    raise kJsonifyException["UnresolvedTypeName"].build(parent_name)
                cd.parent = parent_def

            # Circular inheritance check.
            self._check_circular(cd, name)

            # Populate members.
            for member_key, member_type_expr in class_raw.items():
                if member_key.startswith("$"):
                    continue
                if not isinstance(member_type_expr, str):
                    raise kJsonifyException["InvalidMemberSyntax"].build(str(member_type_expr))

                member_result = self._parse_class_member_type(member_type_expr, name, member_key)
                cd.add_member(member_result["type"], member_key, member_result["count"])

        # Phase 8: Resolve aliases (deferred).
        if self.alias_map is not None:
            for name, target_name in self.alias_map.items():
                target = self._resolve_type(target_name)
                if target is None:
                    raise kJsonifyException["UnresolvedTypeName"].build(target_name)

                vt = target.value_type()
                if vt != kMetaValueType.Number and vt != kMetaValueType.Struct:
                    raise kJsonifyException["InvalidAliasTarget"].build(name, target_name)

                self.types[name] = MetaTypeForward(target, name)

        # Phase 9: Resolve Clump<T> generics.
        for key, clump_class in clump_generic_cache.items():
            if len(clump_class.members) > 0:
                continue  # Already resolved.

            type_param = key[6:-1]  # remove "Clump<" and ">"
            resolved_t = self._resolve_type(type_param)
            if resolved_t is None or not isinstance(resolved_t, MetaTypeClass):
                raise kJsonifyException["UnresolvedTypeName"].build(type_param)

            clump_class.add_member(MetaTypePointer("pointer", kMetaTypes["Object"]), "data", 0)
            self.classes[key] = clump_class

        return self

    def _resolve_type(self, name):
        # Direct match.
        if name in self.types:
            return self.types[name]

        # Enum name -> underlying integer type.
        if self.enum_info:
            for ek, ev in self.enum_info.items():
                if ev["enum_name"] == name:
                    raw_enum = self.raw.get("E$" + name)
                    if raw_enum and raw_enum.get("$as"):
                        return self.types.get(raw_enum["$as"])

        # Alias.
        if self.alias_map and name in self.alias_map:
            return self._resolve_type(self.alias_map[name])

        return None

    def _declare_struct(self, name):
        if name in self.types:
            return
        s = MetaTypeStruct(name)
        self.types[name] = s

    def _declare_class(self, name, raw):
        if name in self.classes:
            return
        c = MetaTypeClass(name, kMetaTypes["Object"])
        self.types[name] = c
        self.classes[name] = c

    def _check_circular(self, class_def, name):
        visited = set()
        p = class_def.parent
        while p is not None:
            if p.get_name() == name:
                raise kJsonifyException["CircularInheritance"].build(name)
            if p.get_name() in visited:
                break
            visited.add(p.get_name())
            p = p.parent

    def _check_duplicate(self, all_names, name):
        if name in all_names:
            raise kJsonifyException["DuplicateTypeName"].build(name)
        all_names.add(name)

    def _parse_struct_member_type(self, expr, struct_name, member_name):
        """Parse a struct member type expression: type_name or type_name[N]."""
        array_match = re.match(r'^(.+?)\[(\d+)\]$', expr)
        if array_match:
            type_name = array_match.group(1).strip()
            count = int(array_match.group(2), 10) or 1
            base_type = self._resolve_type(type_name)
            if base_type is None:
                raise kJsonifyException["UnresolvedTypeName"].build(type_name)
            if base_type.value_type() != kMetaValueType.Number and base_type.value_type() != kMetaValueType.Struct:
                raise kJsonifyException["InvalidMemberSyntax"].build(expr)
            return {"type": base_type, "count": count}

        base_type = self._resolve_type(expr.strip())
        if base_type is None:
            raise kJsonifyException["UnresolvedTypeName"].build(expr)
        if base_type.value_type() != kMetaValueType.Number and base_type.value_type() != kMetaValueType.Struct:
            raise kJsonifyException["InvalidMemberSyntax"].build(expr)
        return {"type": base_type, "count": None}

    def _parse_class_member_type(self, expr, class_name, member_name):
        """Parse a class member type expression.

        Grammar: <type-name> ["*"] [ "[" [<length>] "]" ]  or  R$<size>
        """
        expr = expr.strip()

        # R$<size> - raw binary.
        raw_match = re.match(r'^R\$(\d+)$', expr)
        if raw_match:
            size = int(raw_match.group(1), 10)
            return {"type": MetaTypeRaw(class_name + "::" + member_name, size), "count": None}

        has_pointer = "*" in expr
        bracket_match = re.search(r'\[(\d*)\]$', expr)
        has_bracket = bracket_match is not None
        count = None
        if has_bracket:
            count = int(bracket_match.group(1), 10) if bracket_match.group(1) else 0

        # Extract type name.
        type_name = expr.replace("*", "").replace("[]", "")
        type_name = re.sub(r'\[\d*\]$', '', type_name).strip()

        # Strip C$/S$/E$/A$ prefix.
        if type_name.startswith(("C$", "S$", "E$", "A$")):
            type_name = type_name[2:]

        # Handle Clump<T>.
        if type_name.startswith("Clump<") and type_name.endswith(">"):
            resolved_type = self.types.get(type_name)
            if resolved_type is None:
                inner_type = type_name[6:-1]
                resolved_type = get_clump_generic(inner_type)
                self.types[type_name] = resolved_type
                self.classes[type_name] = resolved_type
        else:
            resolved_type = self._resolve_type(type_name)

        if resolved_type is None:
            raise kJsonifyException["UnresolvedTypeName"].build(type_name)

        if has_pointer:
            if not isinstance(resolved_type, (MetaTypeClass, MetaTypeClump)):
                raise kJsonifyException["InvalidMemberSyntax"].build(expr)

            ptr_type = MetaTypePointer(resolved_type.get_name() + " *", resolved_type)

            if has_bracket:
                return {"type": MetaTypeClassMemberArray(ptr_type, class_name + "::" + member_name, count), "count": None}
            else:
                return {"type": MetaTypeClassMember(ptr_type, class_name + "::" + member_name), "count": None}

        if has_bracket:
            if isinstance(resolved_type, (MetaTypeClass, MetaTypeClump)):
                return {"type": MetaTypeClassMemberArray(resolved_type, class_name + "::" + member_name, count), "count": None}
            raise kJsonifyException["InvalidMemberSyntax"].build(expr)

        # Inline struct, number, or string.
        return {"type": MetaTypeClassMember(resolved_type, class_name + "::" + member_name), "count": None}
