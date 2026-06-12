var { SimpleExceptionBuilder, DynamicExceptionBuilder } = require("sldl-utils");

var kObjectExceptions = Object.freeze({
  // From bak - binary read errors.
  MemvarOutOfBound: new SimpleExceptionBuilder("memvar access out of bounds"),
  ReadObjectFailed: new SimpleExceptionBuilder("read object failed"),
  InvalidClassName: new DynamicExceptionBuilder(function (name) {
    return "unrecognized class name \"" + name + "\"";
  }),
  MultipleObjectName: new DynamicExceptionBuilder(function (name) {
    return "multiple object name \"" + name + "\"";
  }),
  MultipleClassName: new DynamicExceptionBuilder(function (name) {
    return "multiple class name \"" + name + "\"";
  }),
  MemberMismatch: new DynamicExceptionBuilder(function (clazz, name) {
    return "member mismatch " + clazz + (name ? "::" + name : "");
  }),
  InvalidClassIndex: new DynamicExceptionBuilder(function (idx) {
    return "unrecognized class index \"" + idx + "\"";
  }),
  InvalidObjectIndex: new DynamicExceptionBuilder(function (idx) {
    return "invalid object index \"" + idx + "\"";
  }),
  InvalidObjectName: new DynamicExceptionBuilder(function (name) {
    return "unrecognized object name \"" + name + "\"";
  }),

  // New - declaration group parsing.
  DuplicateTypeName: new DynamicExceptionBuilder(function (name) {
    return "duplicate type name \"" + name + "\"";
  }),
  DuplicateEnumConstant: new DynamicExceptionBuilder(function (name) {
    return "duplicate enum constant \"" + name + "\"";
  }),
  InvalidAliasTarget: new DynamicExceptionBuilder(function (name, target) {
    return "alias \"" + name + "\" cannot target \"" + target + "\"";
  }),
  UnresolvedTypeName: new DynamicExceptionBuilder(function (name) {
    return "unresolved type name \"" + name + "\"";
  }),
  CircularInheritance: new DynamicExceptionBuilder(function (name) {
    return "circular inheritance detected for \"" + name + "\"";
  }),
  InvalidMemberSyntax: new DynamicExceptionBuilder(function (expr) {
    return "invalid member syntax \"" + expr + "\"";
  }),
  MemberTypeMismatch: new DynamicExceptionBuilder(function (clazz, member, expected, got) {
    return "member \"" + member + "\" in \"" + clazz
      + "\" has type \"" + got + "\", expected \"" + expected + "\"";
  }),
  InvalidEnumBaseType: new DynamicExceptionBuilder(function (name, type) {
    return "enum \"" + name + "\" has invalid base type \"" + type + "\"";
  }),

  // New - value parsing.
  UnresolvedEnumConstant: new DynamicExceptionBuilder(function (name) {
    return "unresolved enum constant \"" + name + "\"";
  }),
  UnresolvedObjectReference: new DynamicExceptionBuilder(function (name) {
    return "unresolved object reference \"" + name + "\"";
  }),
  InvalidValueFormat: new DynamicExceptionBuilder(function (val, type) {
    return "invalid value \"" + val + "\" for type \"" + type + "\"";
  }),

  // New - write errors.
  UndeclaredSymbol: new DynamicExceptionBuilder(function (name) {
    return "symbol \"" + name + "\" is not declared in the declaration group";
  }),
});

module.exports = {
  kObjectExceptions
};
