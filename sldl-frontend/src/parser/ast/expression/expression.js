const { Statement } = require("../statement/statement.js");

class Expression extends Statement {
  /**
   * @param {Token} [token] 
   * @param {Type} [type] 
   */
  constructor(token, type) {
    super(token);

    this.type = type || void 0;
  }
}

module.exports = {
  Expression
};
