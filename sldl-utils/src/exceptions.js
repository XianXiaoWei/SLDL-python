class CompileException extends Error {
  /**
   * @param {string} msg 
   * @param {Token} token 
   */
  constructor(msg, token) {
    super(msg);
    this.context = token;
  }

  as() {
    return this.message;
  }
}

class SimpleCompileExceptionBuilder {
  /**
   * @param {string} msg 
   */
  constructor(msg) {
    this.message = msg;
  }

  /**
   * @param {Token} [token]
   * @returns {CompileException}
   */
  from(token) {
    return new SimpleCompileException(this.message, token);
  }
}

class DynamicCompileExceptionBuilder {
  /**
   * 
   * @param {(token:Token,...args)=>string} builder 
   */
  constructor(builder) {
    this.builder = builder;
  }

  /**
   * @param {Token} token 
   * @param  {...any} args 
   * @returns {CompileException}
   */
  from(token, ...args) {
    return new CompileException(this.builder(token, ...args), token);
  }
}

const kBulitInExceptions = Object.freeze({
  Unexpected: new DynamicCompileExceptionBuilder((token) =>
    `unexpected "${token.raw()}"`),
  DuplicatedMember: new DynamicCompileExceptionBuilder((token) =>
    `duplicated member "${token.raw()}"`),
  InvalidType: new DynamicCompileExceptionBuilder((token) =>
    `unrecognized type "${token.raw()}"`),
  StructInvalidMemberType: new DynamicCompileExceptionBuilder((token) =>
    `invalid type "${token.raw()}" in struct, struct members must be primitive`),
  ClassInvalidParentType: new DynamicCompileExceptionBuilder((token) =>
    `invalid parent "${token.raw()}" in class`),
  MultipleDefinition: new DynamicCompileExceptionBuilder((token) =>
    `multiple definition "${token.raw()}"`),
  TooManyError: new SimpleCompileExceptionBuilder("too many errors"),
});

module.exports = {
  CompileException,
  SimpleCompileExceptionBuilder,
  DynamicCompileExceptionBuilder,
  kBulitInExceptions
};
