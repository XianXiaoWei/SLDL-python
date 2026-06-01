const { AstNode } = require("../astNode.js");

class Statement extends AstNode {
  constructor(token) {
    super(token);
  }
}

module.exports = {
  Statement
};
