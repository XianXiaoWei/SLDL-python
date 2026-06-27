"""
sldl-jsonify exceptions.

Ported from the JavaScript sldl-jsonify/src/exception.js
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later
"""

from ..utils import DynamicExceptionBuilder, SimpleExceptionBuilder


kJsonifyException = {
    # Declaration group errors.
    "DuplicateTypeName": DynamicExceptionBuilder(
        lambda name: f'duplicate type name "{name}"'),
    "DuplicateEnumConstant": DynamicExceptionBuilder(
        lambda name: f'duplicate enum constant "{name}"'),
    "InvalidAliasTarget": DynamicExceptionBuilder(
        lambda name, target: f'alias "{name}" cannot target "{target}"'),
    "UnresolvedTypeName": DynamicExceptionBuilder(
        lambda name: f'unresolved type name "{name}"'),
    "CircularInheritance": DynamicExceptionBuilder(
        lambda name: f'circular inheritance detected for "{name}"'),
    "InvalidMemberSyntax": DynamicExceptionBuilder(
        lambda expr: f'invalid member syntax "{expr}"'),
    "InvalidEnumBaseType": DynamicExceptionBuilder(
        lambda name, type_: f'enum "{name}" has invalid base type "{type_}"'),

    # Value parsing errors.
    "UnrecognizedType": DynamicExceptionBuilder(
        lambda clazz: f'unrecognized type "{clazz}"'),
    "UnresolvedEnumConstant": DynamicExceptionBuilder(
        lambda name: f'unresolved enum constant "{name}"'),
    "UnresolvedObjectReference": DynamicExceptionBuilder(
        lambda name: f'unresolved object reference "{name}"'),
    "InvalidValueFormat": DynamicExceptionBuilder(
        lambda val, type_: f'invalid value "{val}" for type "{type_}"'),
}
