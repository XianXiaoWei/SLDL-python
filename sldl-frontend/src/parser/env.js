/**
 * Symbol table on scope.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kBulitInExceptions } = require("../exceptions.js");
const { Token, TokenContent, kInternalTypes } = require("../lexer/token.js");

const kEnvEntryType = Object.freeze({
  Variable: 0,
  Constant: 1,
  Extern: 2,
  Primitive: 3,
  Typedef: 4,
  Struct: 5,
  Class: 6,
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
   * Create an EnvEntry.
   * @param {Token} token - The token of the variable identifier.
   * @param {AstNode} node - The declaration of the variable, usually VariableStatement.
   * @param {Typedef} type - The type of the variable.
   * @param {AstNode} [value] - The initial value of the variable.
   * @returns {EnvEntry}
   */
  static createVariable(token, node, type, value) {
    var r = new EnvEntry(
      kEnvEntryType.Variable,
      token.content,
      node
    );
    r.setParent(type);
    value && r.setValue(value);
    return r;
  }

  /**
   * @param {number} type - Type.
   * @param {Word} id - Name.
   * @param {StructStatement|ClassStatement|Reference} [node] - Content.
   */
  constructor(type, id, node) {
    this.type = type || kEnvEntryType.Variable;
    this.name = id;

    /**
     * The AstNode of the definition. Undefined if the entry a pre-defined.
     * @type {AstNode|undefined}
     */
    this.node = node || void 0;

    /**
     * When this.type == kEnvEntryType.Typedef: the parent field represents the
     * original type of the alias.
     * 
     * When this.type == kEnvEntryType.Class, it represents the parent class
     * inherited from.
     * 
     * When this.type == kEnvEntryType.Variable or kEnvEntryType.Extern, it
     * represents the type of the variable.
     * 
     * @type {EnvEntry|undefined}
     */
    this.parent = void 0;

    /**
     * Member variable defs of the class or struct. Only valid when this.type
     * == kEnvEntryType.Class || this.type == kEnvEntryType.Struct.
     * @type {Map<string,AstNode>}
     */
    this.members = new Map();

    /**
     * The initial value of a constant or variable.
     * @type {AstNode}
     */
    this.value = void 0;
  }

  /**
   * @returns {Word}
   */
  get ident() {
    return this.name;
  }

  /**
   * Type declaration of the variable or constant.
   * @returns {EnvEntry}
   */
  get vartype() {
    return this.parent;
  }

  /**
   * The initial value of a constant.
   */
  get initial() {
    return this.value;
  }

  /**
   * @param {EnvEntry} parent 
   * @returns {this}
   */
  setParent(parent) {
    this.parent = parent;
    return this;
  }

  /**
   * @param {AstNode} value 
   * @returns {this}
   */
  setValue(value) {
    this.value = value;
    return this;
  }

  /**
   * True if the entry represents a type declaration.
   * @returns {boolean}
   */
  isType() {
    return this.type == kEnvEntryType.Primitive
      || this.type == kEnvEntryType.Typedef
      || this.type == kEnvEntryType.Struct
      || this.type == kEnvEntryType.Class;
  }

  /**
   * True if the entry represents a internal type declaration.
   * @returns {boolean}
   */
  isInternalType() {
    return this.isPrimitive()
      || this.name == kInternalTypes.Object
      || this.name == kInternalTypes.Clump;
  }

  /**
   * True if the entry represents a variable or constant.
   * @returns {boolean}
   */
  isReference() {
    return !this.isType();
  }

  /**
   * True if the entry represents a constant with initial value.
   * @returns {boolean}
   */
  isConst() {
    return this.type == kEnvEntryType.Constant;
  }

  /**
   * Can be used in "extend" in class declarations.
   * @returns {boolean}
   */
  isExtendable() {
    return this.type == kEnvEntryType.Class;
  }

  /**
   * True if the entry represents a primitive type.
   * @returns {boolean}
   */
  isPrimitive() {
    return this.type == kEnvEntryType.Primitive;
  }
}

function prim(content) {
  return new EnvEntry(kEnvEntryType.Primitive, content);
}

const kInternalTypeEntries = Object.freeze({
  // Integer types.
  Bool: prim(kInternalTypes.Bool),
  Int8: prim(kInternalTypes.Int8),
  Uint8: prim(kInternalTypes.Uint8),
  Int16: prim(kInternalTypes.Int16),
  Uint16: prim(kInternalTypes.Uint16),
  Int32: prim(kInternalTypes.Int32),
  Uint32: prim(kInternalTypes.Uint32),
  Int64: prim(kInternalTypes.Int64),
  Uint64: prim(kInternalTypes.Uint64),
  // Float types.
  Float: prim(kInternalTypes.Float),
  Double: prim(kInternalTypes.Double),
  // String types.
  Cstring: prim(kInternalTypes.Cstring),
  TgcString: prim(kInternalTypes.TgcString),
  // Object types.
  Object: new EnvEntry(kEnvEntryType.Class, kInternalTypes.Object),
  Clump: new EnvEntry(kEnvEntryType.Class, kInternalTypes.Clump)
});

class Env {
  /**
   * @param {Env} [prev] 
   */
  constructor(prev = void 0) {
    this.prev = prev;
    this.symbols = new Map();
  }

  /**
   * Initialize the symbol table. Internal types has no AstNode.
   */
  initialize() {
    this.put(kInternalTypeEntries.Bool);
    this.put(kInternalTypeEntries.Int8);
    this.put(kInternalTypeEntries.Uint8);
    this.put(kInternalTypeEntries.Int16);
    this.put(kInternalTypeEntries.Uint16);
    this.put(kInternalTypeEntries.Int32);
    this.put(kInternalTypeEntries.Uint32);
    this.put(kInternalTypeEntries.Int64);
    this.put(kInternalTypeEntries.Uint64);
    this.put(kInternalTypeEntries.Float);
    this.put(kInternalTypeEntries.Double);
    this.put(kInternalTypeEntries.Cstring);
    this.put(kInternalTypeEntries.TgcString);
    this.put(kInternalTypeEntries.Object);
    this.put(kInternalTypeEntries.Clump);
  }

  /**
   * Put a token and the related definition into the symbol table.
   * @param {EnvEntry} entry 
   * @param {Token|TokenContent|string} [related] 
   * @returns {boolean}
   */
  put(entry, related) {
    if (this.symbols.has(entry.name.toString()))
      return false;

    if (related) {
      var def = this.get(related);
      if (!def)
        return false;

      entry.setParent(def);
    }

    this.symbols.set(entry.name.toString(), entry);
    return true;
  }

  /**
   * Declare inherit from the entry specified by "parent".
   * @param {EnvEntry} entry 
   * @param {Token|TokenContent|string} [parent] 
   * @returns {boolean}
   */
  inherit(entry, parent) {
    if (entry.type != kEnvEntryType.Class)
      return false;

    return this.put(entry, parent);
  }

  /**
   * Declare an alias from the entry specified by "token".
   * @param {EnvEntry} entry 
   * @param {Token|TokenContent|string} [target] 
   * @returns {boolean}
   */
  alias(entry, target) {
    if (entry.type != kEnvEntryType.Typedef)
      return false;

    return this.put(entry, target);
  }

  /**
   * Declare a variable or constant.
   * @param {EnvEntry} entry 
   * @param {Token|TokenContent|string} typedef - Type of the variable or constant.
   */
  declare(entry, typedef) {
    if (entry.type != kEnvEntryType.Variable || entry.type != kEnvEntryType.Extern)
      return false;

    return this.put(entry, typedef);
  }

  /**
   * Get an identifier by a token.
   * @param {Token|TokenContent|string} token 
   * @returns {EnvEntry|undefined}
   */
  get(token) {
    var s = token instanceof Token
      ? token.raw()
      : token instanceof TokenContent
        ? token.content
        : token;
    for (var p = this; p; p = p.prev) {
      if (p.symbols.has(s))
        return p.symbols.get(s);
    }
    return void 0;
  }

  /**
   * Get an entry in current scope by a token.
   * @param {Token|TokenContent|string} token 
   * @returns {EnvEntry|undefined}
   */
  getOwn(token) {
    var s = token instanceof Token
      ? token.raw()
      : token instanceof TokenContent
        ? token.content
        : token;
    if (this.symbols.has(s))
      return this.symbols.get(s);
  }
}

module.exports = {
  Env,
  EnvEntry,
  kEnvEntryType,
  kInternalTypeEntries
};
