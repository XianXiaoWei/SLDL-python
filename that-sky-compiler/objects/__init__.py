"""
sldl-objects - OO TGCL .level.bin binary reader/writer.

Ported from the JavaScript sldl-objects package.
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later
"""

from .exceptions import kObjectExceptions
from .level_objects import (LoHeader, LoStringPool, LoMemvar, LoClass,
                             LoIndices, LevelObjects, kMemvarTypes)
from .types import kMetaTypes, get_clump_generic, clump_generic_cache
from .meta_type import (MetaType, MetaTypeForward, kMetaValueType, kMetaValueFlag,
                         MetaTypeClassMember, MetaTypeClassMemberArray,
                         MetaTypeClass, MetaTypeClump,
                         MetaTypeBool, MetaTypeNumber,
                         MetaTypePointer, MetaTypeString,
                         MetaTypeStructMember, MetaTypeStruct,
                         MetaTypeRaw)
from .level_value import (LevelValue, LevelValueClass,
                           LevelValueBool, LevelValueNumber,
                           LevelValuePointer, LevelValueString,
                           LevelValueStruct, LevelValueRaw)

__all__ = [
    # exceptions
    "kObjectExceptions",
    # level_objects
    "LoHeader", "LoStringPool", "LoMemvar", "LoClass", "LoIndices",
    "LevelObjects", "kMemvarTypes",
    # types
    "kMetaTypes", "getClumpGeneric", "clumpGenericCache",
    # meta_type
    "MetaType", "MetaTypeForward", "kMetaValueType", "kMetaValueFlag",
    "MetaTypeClassMember", "MetaTypeClassMemberArray",
    "MetaTypeClass", "MetaTypeClump",
    "MetaTypeBool", "MetaTypeNumber",
    "MetaTypePointer", "MetaTypeString",
    "MetaTypeStructMember", "MetaTypeStruct",
    "MetaTypeRaw",
    # level_value
    "LevelValue", "LevelValueClass",
    "LevelValueBool", "LevelValueNumber",
    "LevelValuePointer", "LevelValueString",
    "LevelValueStruct", "LevelValueRaw",
]
