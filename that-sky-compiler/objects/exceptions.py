"""
sldl-objects exceptions.

Ported from the JavaScript sldl-objects/src/exceptions.js
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later
"""

from ..utils import SimpleExceptionBuilder, DynamicExceptionBuilder


kObjectExceptions = {
    # Read errors.
    "HeaderMagicMismatch": DynamicExceptionBuilder(
        lambda u: f"invalid magic 0x{u & 0xFFFFFFFF:08x}, expected 0x4c434754"),
    "MemvarOutOfBound": SimpleExceptionBuilder("memvar access out of bounds"),
    "ReadObjectFailed": SimpleExceptionBuilder("read object failed"),
    "InvalidClassName": DynamicExceptionBuilder(
        lambda name: f"unrecognized class name: {name}"),
    "MultipleObjectName": DynamicExceptionBuilder(
        lambda name: f"multiple object name: {name}"),
    "MultipleClassName": DynamicExceptionBuilder(
        lambda name: f"multiple class name: {name}"),
    "MemberMismatch": DynamicExceptionBuilder(
        lambda clazz, name=None: f'member mismatch: {clazz}{("::" + name) if name else ""}'),
    "InvalidClassIndex": DynamicExceptionBuilder(
        lambda idx: f"unrecognized class index: {idx}"),
    "InvalidObjectIndex": DynamicExceptionBuilder(
        lambda idx: f"invalid object index: {idx}"),
    "InvalidObjectName": DynamicExceptionBuilder(
        lambda name: f"unrecognized object name: {name}"),

    # Write errors.
    "UndeclaredSymbol": DynamicExceptionBuilder(
        lambda name: f'symbol "{name}" is not declared in the declaration group'),
    "UnresolvedObjectReference": DynamicExceptionBuilder(
        lambda name: f"unresolved object reference: {name}"),
}
