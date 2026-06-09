const { kInternalTypeEntries } = require("./env.js");

class Typedef {
  /**
   * @param {Typedef} a
   * @param {Typedef} b
   * @returns {boolean}
   */
  static equal(a, b) {
    if (!a || !b)
      return false;

    if (a.constructor !== b.constructor)
      return false;

    if (a instanceof ArrayOf && a.count !== b.count)
      return false;

    if (a instanceof TypeRef && a.ref !== b.ref)
      return false;

    if (!a.child && !b.child)
      return true;

    if (a.child && b.child)
      return Typedef.equal(a.child, b.child);

    return false;
  }

  /**
   * @param {Typedef} child 
   * @param {AstNode} node 
   */
  constructor(child, node) {
    this.child = child || void 0;
    this.node = node || void 0;
  }
}

/**
 * Represents a reference to a declared type (class, struct, enum, primitive, ...).
 */
class TypeRef extends Typedef {
  /**
   * @param {EnvEntry} child 
   */
  constructor(entry) {
    super();

    this.ref = entry;
  }
}

/**
 * Represents a derived type from Clump (Clump<T>).
 */
class TypeDerive extends Typedef {
  /**
   * @param {Typedef} child 
   * @param {AstNode} node
   */
  constructor(child, node) {
    super(child, node);

    this.derived = kInternalTypeEntries.Clump;
  }
}

/**
 * Represents a pointer type to child.
 */
class PointerTo extends Typedef {
  /**
   * @param {Typedef} child 
   * @param {AstNode} node 
   */
  constructor(child, node) {
    super(child, node);
  }
}

/**
 * Represents an array of child.
 */
class ArrayOf extends Typedef {
  /**
   * @param {Typedef} child 
   * @param {number} count 
   * @param {AstNode} node 
   */
  constructor(child, count, node) {
    super(child, node);

    this.count = count || 0;
  }
}

const kInternalTypedefs = Object.freeze({
  // Integer types.
  Bool: new TypeRef(kInternalTypeEntries.Bool),
  Int8: new TypeRef(kInternalTypeEntries.Int8),
  Uint8: new TypeRef(kInternalTypeEntries.Uint8),
  Int16: new TypeRef(kInternalTypeEntries.Int16),
  Uint16: new TypeRef(kInternalTypeEntries.Uint16),
  Int32: new TypeRef(kInternalTypeEntries.Int32),
  Uint32: new TypeRef(kInternalTypeEntries.Uint32),
  Int64: new TypeRef(kInternalTypeEntries.Int64),
  Uint64: new TypeRef(kInternalTypeEntries.Uint64),
  // Float types.
  Float: new TypeRef(kInternalTypeEntries.Float),
  Double: new TypeRef(kInternalTypeEntries.Double),
  // String types.
  Cstring: new TypeRef(kInternalTypeEntries.Cstring),
  TgcString: new TypeRef(kInternalTypeEntries.TgcString),
  // Object types.
  Object: new TypeRef(kInternalTypeEntries.Object),
  Clump: new TypeRef(kInternalTypeEntries.Clump)
});

module.exports = {
  Typedef,
  TypeRef,
  TypeDerive,
  PointerTo,
  ArrayOf,
  kInternalTypedefs,
};
