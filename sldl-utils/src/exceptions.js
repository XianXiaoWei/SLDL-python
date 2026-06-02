class CompileException extends Error {
  /**
   * @param {string} msg 
   * @param {Token} token 
   */
  constructor(msg, token) {
    this.message = msg;
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
   * @param {Token}
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
  Unexpected: new DynamicCompileExceptionBuilder((token) => `unexpected "${token.content.toString()}"`),
  DuplicatedMember: new DynamicCompileExceptionBuilder((token) => `duplicated member "${token.content.toString()}"`),
});

module.exports = {
  CompileException,
  SimpleCompileExceptionBuilder,
  DynamicCompileExceptionBuilder,
  kBulitInExceptions
};
