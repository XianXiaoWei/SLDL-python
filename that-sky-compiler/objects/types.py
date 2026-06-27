"""
sldl-objects built-in type registry.

Ported from the JavaScript sldl-objects/src/types.js
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later
"""

from .meta_type import (MetaTypeBool, MetaTypeNumber, MetaTypePointer,
                         MetaTypeString, MetaTypeClass, MetaTypeClump)
from . import binaryio as bio


# Build the built-in type registry.
kMetaTypes = {
    # Boolean.
    "Bool": MetaTypeBool("bool"),

    # Integer.
    "Int8": MetaTypeNumber("int8_t", 1, bio.read_i8, bio.write_i8),
    "Uint8": MetaTypeNumber("uint8_t", 1, bio.read_u8, bio.write_u8),
    "Int16": MetaTypeNumber("int16_t", 2, bio.read_i16, bio.write_i16),
    "Uint16": MetaTypeNumber("uint16_t", 2, bio.read_u16, bio.write_u16),
    "Int32": MetaTypeNumber("int32_t", 4, bio.read_i32, bio.write_i32),
    "Uint32": MetaTypeNumber("uint32_t", 4, bio.read_u32, bio.write_u32),
    "Int64": MetaTypeNumber("int64_t", 8, bio.read_i64, bio.write_i64),
    "Uint64": MetaTypeNumber("uint64_t", 8, bio.read_u64, bio.write_u64),

    # Float.
    "Float": MetaTypeNumber("float", 4, bio.read_f32, bio.write_f32),
    "Double": MetaTypeNumber("double", 8, bio.read_f64, bio.write_f64),

    # String.
    "CString": MetaTypeString("cstring"),
    "TgcString": MetaTypeString("TgcString"),

    # Pointer (set below after Object is created).
    "Pointer": None,

    # Object - base of all classes.
    "Object": MetaTypeClass("Object", None),
    "Clump": None,
}

# Pointer targets Object.
kMetaTypes["Pointer"] = MetaTypePointer("Object *", kMetaTypes["Object"])

# Clump extends Object with a generic data member.
# The Clump class itself (without generic) defaults to data: Object*[].
kMetaTypes["Clump"] = MetaTypeClass("Clump", kMetaTypes["Object"])
kMetaTypes["Clump"].add_member(kMetaTypes["Pointer"], "data", 0)


# --- Clump<T> generic cache ---

clump_generic_cache = {}


def get_clump_generic(type_name):
    """Get or create a Clump<T> MetaTypeClass."""
    key = "Clump<" + type_name + ">"
    cached = clump_generic_cache.get(key)
    if cached is not None:
        return cached

    clump = MetaTypeClump(key, None)
    clump_generic_cache[key] = clump
    # Member resolution is deferred - the target type must be resolved later
    # via declGroup when all types are known.
    return clump
