var { DynamicExceptionBuilder, SimpleExceptionBuilder } = require("sldl-utils");

var kItaniumException = Object.freeze({
  // Itanium parser errors.
  Unexpected: new DynamicExceptionBuilder(
    (char, pos) => "unexpected char '" + char + "' at " + pos),
  Duplicated: new DynamicExceptionBuilder(
    name => "duplicated declaration \"" + name + "\""),
  InvalidAlign: new DynamicExceptionBuilder(
    align => "invalid alignment 0x" + align.toString(16)),
  InvalidPointer: new DynamicExceptionBuilder(
    type => "pointer of type \"" + type + "\" is invalid"),
  UnrecognizedType: new DynamicExceptionBuilder(
    clazz => "unrecognized type \"" + clazz + "\""),

  // Declaration group errors.
  DuplicateTypeName: new DynamicExceptionBuilder(
    name => "duplicate type name \"" + name + "\""),
  DuplicateEnumConstant: new DynamicExceptionBuilder(
    name => "duplicate enum constant \"" + name + "\""),
  InvalidAliasTarget: new DynamicExceptionBuilder(
    (name, target) => "alias \"" + name + "\" cannot target \"" + target + "\""),
  UnresolvedTypeName: new DynamicExceptionBuilder(
    name => "unresolved type name \"" + name + "\""),
  CircularInheritance: new DynamicExceptionBuilder(
    name => "circular inheritance detected for \"" + name + "\""),
  InvalidMemberSyntax: new DynamicExceptionBuilder(
    expr => "invalid member syntax \"" + expr + "\""),
  InvalidEnumBaseType: new DynamicExceptionBuilder(
    (name, type) => "enum \"" + name + "\" has invalid base type \"" + type + "\""),

  // Value parsing errors.
  UnresolvedEnumConstant: new DynamicExceptionBuilder(
    name => "unresolved enum constant \"" + name + "\""),
  UnresolvedObjectReference: new DynamicExceptionBuilder(
    name => "unresolved object reference \"" + name + "\""),
  InvalidValueFormat: new DynamicExceptionBuilder(
    (val, type) => "invalid value \"" + val + "\" for type \"" + type + "\""),
});

module.exports = {
  kItaniumException
};
