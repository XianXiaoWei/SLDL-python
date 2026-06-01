class AstNode {
  constructor(token) {
    /** Complete initial token with context. */
    this.token = token;
  }

  toString() {
    return this.token.content.toString();
  }
}

module.exports = {
  AstNode
};
