var { MetaType, kMetaValueType } = require("./metaType.js");
var { LevelValuePointer } = require("../value/levelValuePointer.js");

class MetaTypePointer extends MetaType {
  /**
   * @param {string} name
   */
  constructor(name) {
    super(name);
  }

  getSize() {
    return 4;
  }

  getAlign() {
    return 4;
  }

  valueType() {
    return kMetaValueType.Pointer;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @returns {LevelValuePointer}
   */
  read(L, B, off) {
    var r = new LevelValuePointer(this);
    r.setIndex(B.readUInt32LE(off));
    return r;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {LevelValuePointer} val
   * @param {number} off
   * @returns {number}
   */
  write(L, B, val, off) {
    B.writeUInt32LE(val.index, off);
    return this.getSize();
  }
}

module.exports = {
  MetaTypePointer
};
