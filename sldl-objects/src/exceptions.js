const { SimpleExceptionBuilder, DynamicExceptionBuilder } = require("sldl-utils");

const kObjectExceptions = Object.freeze({
  MemvarOutOfBound: new SimpleExceptionBuilder("memvar access out of bounds"),
  ReadObjectFailed: new SimpleExceptionBuilder("read object failed"),
  InvalidClassName: new DynamicExceptionBuilder((name) =>
    `unrecognized class name "${name}"`),
  MultipleObjectName: new DynamicExceptionBuilder((name) =>
    `multiple object name "${name}"`),
  MemberMismatch: new DynamicExceptionBuilder((clazz, name) =>
    `member mismatch ${clazz}${name ? "::" + name : ""}`),
  InvalidClassIndex: new DynamicExceptionBuilder((idx) =>
    `unrecognized class index "${idx}"`),
  InvalidObjectIndex: new DynamicExceptionBuilder((idx) =>
    `invalid object index "${idx}"`),
});

module.exports = {
  kObjectExceptions
};
