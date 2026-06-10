const { DynamicExceptionBuilder } = require("sldl-utils");

const kItaniumException = Object.freeze({
  Unexpected: new DynamicExceptionBuilder(
    (char, pos) => `unexpected char '${char}' at ${pos}`),
  Duplicated: new DynamicExceptionBuilder(
    name => `duplicated declaration "${name}"`),
  InvalidAlign: new DynamicExceptionBuilder(
    align => `invalid alignment 0x${align.toString(16)}`),
  InvalidPointer: new DynamicExceptionBuilder(
    type => `pointer of type "${type}" is invalid`),
});

module.exports = {
  kItaniumException
};
