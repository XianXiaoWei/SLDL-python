const kMetaValueType = Object.freeze({
  None: 0,
  Number: 1,
  String: 2,
  Struct: 3,
  Class: 4,
  Pointer: 5,
});

class MetaType {
  constructor(name) {
    return this.name = name;
  }

  getSize() {
    return 0;
  }

  getAlign() {
    return 1;
  }

  valueType() {
    return kMetaValueType.None;
  }

  /**
   * Read a LevelValue from the buffer.
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValue}
   */
  read(B, off) {
    ;
  }

  /**
   * Write a LevelValue to the buffer.
   * @param {Buffer} B 
   * @param {LevelValue} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    ;
  }
}

module.exports = {
  MetaType,
  kMetaValueType
};
