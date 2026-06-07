class SldlException extends Error {
  /**
   * @param {string} msg 
   * @param {SimpleExceptionBuilder|DynamicExceptionBuilder} type 
   * @param {Token} token 
   */
  constructor(msg, type) {
    super(msg, { cause: type });
    this.type = type;
  }
}

class SimpleExceptionBuilder {
  /**
   * @param {string} msg 
   */
  constructor(msg) {
    this.message = msg;
  }

  /**
   * @returns {SldlException}
   */
  from() {
    return new SldlException(this.message, this);
  }
}

class DynamicExceptionBuilder {
  /**
   * 
   * @param {(token:Token,...args)=>string} builder 
   */
  constructor(builder) {
    this.builder = builder;
  }

  /**
   * @param  {...any} args 
   * @returns {SldlException}
   */
  from(...args) {
    return new SldlException(this.builder(...args), this);
  }
}

module.exports = {
  SldlException,
  SimpleExceptionBuilder,
  DynamicExceptionBuilder
};
