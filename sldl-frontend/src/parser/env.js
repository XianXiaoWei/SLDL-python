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
    this.symbols.set(entry.name.toString(), entry);
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

const kEnvEntryType = Object.freeze({
  Variable: 0,
  Constant: 1,
  Primitive: 2,
  Typedef: 3,
  Struct: 5,
  Class: 4,
});

/** Represents a register in symbol table. */
class EnvEntry {
  static createStruct(token, node) {
    return new EnvEntry(
      kEnvEntryType.Struct,
      token.content,
      node
    );
  }

  static createClass(token, node) {
    return new EnvEntry(
      kEnvEntryType.Class,
      token.content,
      node
    );
  }

  /**
   * @param {number} type - Type.
   * @param {Word} [id] - Name.
   * @param {AstNode} [node] - Content.
   */
  constructor(type, id, node) {
    this.type = type || kEnvEntryType.Variable;
    this.name = id;
    this.node = node;
  }

  isType() {
    return this.type == kEnvEntryType.Primitive
      || this.type == kEnvEntryType.Typedef
      || this.type == kEnvEntryType.Struct
      || this.type == kEnvEntryType.Class;
  }

  isExtendable() {
    return this.type == kEnvEntryType.Class;
  }

  isPrimitive() {
    return this.type == kEnvEntryType.Primitive;
  }
}

module.exports = {
  Env,
  EnvEntry,
  kEnvEntryType
};
