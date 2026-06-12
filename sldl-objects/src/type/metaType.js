var kMetaValueType = Object.freeze({
  None: 0,
  Number: 1,
  String: 2,
  Struct: 3,
  Class: 4,
  Pointer: 5,
  Raw: 6,
});

/** General type definition. */
class MetaType {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Get the name of the type.
   * @returns {string}
   */
  getName() {
    return this.name;
  }

  /**
   * Get the size of the type.
   * @returns {number}
   */
  getSize() {
    return 0;
  }

  /**
   * Get the alignment of the type.
   * @returns {number}
   */
  getAlign() {
    return 1;
  }

  /**
   * Get the value type enum.
   * @returns {number}
   */
  valueType() {
    return kMetaValueType.None;
  }

  /**
   * Read a LevelValue from the buffer.
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @returns {LevelValue}
   */
  read(L, B, off) {
    ;
  }

  /**
   * Write a LevelValue to the buffer.
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {LevelValue} val
   * @param {number} off
   * @returns {number} Number of bytes written.
   */
  write(L, B, val, off) {
    ;
  }
}

/** A base class for metatype forwarding (e.g. member types). */
class MetaTypeForward extends MetaType {
  /**
   * @param {MetaType} def
   * @param {string} name
   */
  constructor(def, name) {
    super(name);
    this.def = def;
  }

  getSize() {
    return this.def.getSize();
  }

  getAlign() {
    return this.def.getAlign();
  }

  valueType() {
    return this.def.valueType();
  }

  read(L, B, off) {
    return this.def.read(L, B, off);
  }

  write(L, B, val, off) {
    return this.def.write(L, B, val, off);
  }
}

module.exports = {
  MetaType,
  MetaTypeForward,
  kMetaValueType
};
