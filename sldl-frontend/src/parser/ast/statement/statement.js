const { AstNode } = require("../astNode.js");

class Statement extends AstNode {
  /**
   * @param {Token} [token] 
   */
  constructor(token) {
    super(token);
  }
}

module.exports = {
  Statement
};
