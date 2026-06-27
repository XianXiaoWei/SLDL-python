"""
sldl-jsonify json_value - convert between JSON values and LevelValues.

Ported from the JavaScript sldl-jsonify/src/jsonValue.js
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later
"""

import struct

from ..objects import (LevelValueString, LevelValueNumber, LevelValueBool,
                         LevelValuePointer, LevelValueRaw, LevelValueStruct,
                         LevelValueClass, kMetaValueType,
                         MetaTypeClassMember, MetaTypeClassMemberArray)
from .exceptions import kJsonifyException


def parse(json_value, member, decl_group):
    """Convert a JSON value to a LevelValue based on the member definition."""
    # Arrays.
    if isinstance(member, MetaTypeClassMemberArray):
        if not isinstance(json_value, list):
            json_value = [] if json_value is None else [json_value]

        elem_member = MetaTypeClassMember(member.defn, member.name)
        result = []
        for jv in json_value:
            result.append(parse(jv, elem_member, decl_group))
        return result

    # Pointers (P$ references).
    if member.value_type() == kMetaValueType.Pointer:
        ptr = LevelValuePointer(member.defn)

        if json_value is None:
            ptr.set_index(0xFFFFFFFF)
            ptr.target_name = None
        elif isinstance(json_value, str) and json_value.startswith("P$"):
            ptr.target_name = json_value[2:]
            ptr.set_index(0xFFFFFFFF)
        elif isinstance(json_value, (int, float)):
            ptr.set_index(int(json_value) & 0xFFFFFFFF)
            ptr.target_name = None
        else:
            raise kJsonifyException["InvalidValueFormat"].build(str(json_value), member.defn.get_name())

        return ptr

    # Strings.
    if member.value_type() == kMetaValueType.String:
        s = LevelValueString(member.defn)
        if isinstance(json_value, str):
            s.set_value(json_value)
        elif json_value is None:
            s.set_value("")
        else:
            s.set_value(str(json_value))
        return s

    # Raw (B$ prefix).
    if member.value_type() == kMetaValueType.Raw:
        return parse_raw(json_value, member.defn)

    # Numbers.
    if member.value_type() == kMetaValueType.Number:
        return parse_number(json_value, member.defn, decl_group)

    # Structs.
    if member.value_type() == kMetaValueType.Struct:
        st = LevelValueStruct(member.defn)
        if isinstance(json_value, dict) and not isinstance(json_value, list):
            for sm_name, sm_def in member.defn.members.items():
                sv = parse(json_value.get(sm_name), sm_def, decl_group)
                st.set_value(sm_name, sv)
        return st

    # Inline class.
    if member.value_type() == kMetaValueType.Class:
        return parse_class(json_value, member.defn, decl_group)

    raise kJsonifyException["InvalidValueFormat"].build(str(json_value), member.defn.get_name())


def parse_number(json_value, defn, decl_group):
    """Parse a number value with B$/K$ prefix support."""
    size = defn.get_size()
    is_bool = defn.get_name() == "bool"

    if is_bool:
        b = LevelValueBool(defn)
        b.set_value(bool(json_value))
        return b

    num = 0
    if isinstance(json_value, (int, float)):
        num = json_value
    elif isinstance(json_value, str):
        s = json_value.strip()

        if s.startswith("B$"):
            hex_str = s[2:]
            buf = bytes.fromhex(hex_str) if hex_str else b""
            buf = right_align(buf, size)
            num = read_int_from_buffer_be(buf, size)
        elif s.startswith("K$"):
            const_name = s[2:]
            if const_name not in decl_group.enum_constants:
                raise kJsonifyException["UnresolvedEnumConstant"].build(const_name)
            num = decl_group.enum_constants[const_name]
        else:
            try:
                num = int(s, 10) if size <= 4 else int(s, 10)
            except ValueError:
                num = 0
    else:
        num = 0

    r = LevelValueNumber(defn)
    r.set_value(num)
    return r


def parse_raw(json_value, defn):
    """Parse a raw value - only B$ prefix and plain hex are supported."""
    target_size = defn.get_size()
    r = LevelValueRaw(defn)

    from ..objects.binaryio import is_buffer
    if is_buffer(json_value):
        r.set_value(right_align(json_value, target_size))
        return r

    if not isinstance(json_value, str):
        r.set_value(bytearray(target_size))
        return r

    s = json_value.strip()

    if s.startswith("B$"):
        hex_str = s[2:]
        buf = bytes.fromhex(hex_str) if hex_str else b""
        r.set_value(right_align(buf, target_size))
        return r

    try:
        buf = bytes.fromhex(s)
    except ValueError:
        buf = b""
    r.set_value(right_align(buf, target_size))
    return r


def parse_class(json_value, class_def, decl_group):
    """Parse a JSON object into a LevelValueClass (for inline class members)."""
    lvc = LevelValueClass(class_def, "")

    if isinstance(json_value, dict) and not isinstance(json_value, list):
        for member_name, member in class_def.all_members():
            val = json_value.get(member_name)
            if val is not None:
                lv = parse(val, member, decl_group)
                lvc.set_value(member_name, lv)

    lvc.finalize()
    return lvc


def right_align(buf, target_size):
    """Right-align a buffer to target_size bytes.

    Pads with zeros on the LEFT (MSB), truncates from the LEFT.
    """
    if len(buf) == target_size:
        return bytes(buf)
    if len(buf) < target_size:
        padding = bytes(target_size - len(buf))
        return padding + bytes(buf)
    return bytes(buf[len(buf) - target_size:])


def read_int_from_buffer(buf, size):
    """Read a little-endian integer from buffer."""
    try:
        if size == 1:
            return struct.unpack_from('<B', buf, 0)[0]
        elif size == 2:
            return struct.unpack_from('<H', buf, 0)[0]
        elif size == 4:
            return struct.unpack_from('<i', buf, 0)[0]
        elif size == 8:
            return struct.unpack_from('<q', buf, 0)[0]
        return struct.unpack_from('<I', buf, 0)[0]
    except struct.error:
        return 0


def read_int_from_buffer_be(buf, size):
    """Read a big-endian integer from buffer."""
    try:
        if size == 1:
            return struct.unpack_from('<B', buf, 0)[0]
        elif size == 2:
            return struct.unpack_from('>H', buf, 0)[0]
        elif size == 4:
            return struct.unpack_from('>i', buf, 0)[0]
        elif size == 8:
            return struct.unpack_from('>q', buf, 0)[0]
        return struct.unpack_from('>I', buf, 0)[0]
    except struct.error:
        return 0


def serialize(val, decl_group=None):
    """Convert a LevelValue to a plain JSON value."""
    if isinstance(val, list):
        return [serialize(v, decl_group) for v in val]

    vt = val.value_type()

    if vt == kMetaValueType.Pointer:
        target = val.get_value()
        if target is None:
            return None
        if target is not None and hasattr(target, "get_name"):
            return "P$" + target.get_name()
        return "P$" + str(target)

    if vt == kMetaValueType.Raw:
        buf = val.get_value()
        return "B$" + buf.hex()

    if vt == kMetaValueType.Struct:
        struct_result = {}
        for mk, mv in val.value.items():
            struct_result[mk] = serialize(mv, decl_group)
        return struct_result

    if vt == kMetaValueType.Class:
        return serialize_class(val, decl_group)

    return val.get_value()


def serialize_class(lvc, decl_group=None):
    """Convert a LevelValueClass to a plain JSON object."""
    result = {"$type": lvc.get_def().get_name()}
    for key, val in lvc.value.items():
        result[key] = serialize(val, decl_group)
    return result
