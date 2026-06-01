class Env {
  /**
   * @param {Env} [prev] 
   */
  constructor(prev = void 0) {
    this.prev = prev;
    this.symbols = new Map();
  }

  /**
   * Put a token and the related definition into the symbol table.
   * @param {EnvEntry} entry 
   */
  put(entry) {
    this.symbols.set(entry.token.raw(), entry);
  }

  /**
   * Get an identifier by a token.
   * @param {Token} token 
   * @returns {EnvEntry|undefined}
   */
  get(token) {
    var s = token.raw();
    for (var p = this; p; p = p.prev) {
      if (p.symbols.has(s))
        return p.symbols.get(s);
    }
    return void 0;
  }
}

/** Represents a register in symbol table. */
class EnvEntry {
  /**
   * @param {Token} token - Name.
   * @param {AstNode} node - Content.
   */
  constructor(token, node) {
    this.token = token;
    this.node = node;
  }

  isType() {
    return false;
  }
}

/** Represents a type definition. */
class Typedef extends EnvEntry {
  /**
   * @param {Token} typeName - Name of the type.
   * @param {AstNode} typeDef - Definition of the type.
   */
  constructor(typeName, typeDef) {
    super(typeName, typeDef);
  }

  isType() {
    return true;
  }
}

module.exports = {
  Env,
  EnvEntry,
  Typedef
};
