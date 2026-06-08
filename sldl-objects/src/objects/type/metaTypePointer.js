const { MetaType, kMetaTypes, kMetaValueType } = require("./metaType.js");
const { LevelValuePointer } = require("../value/levelValuePointer.js");

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
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValuePointer}
   */
  read(B, off) {
    var r = new LevelValuePointer(this);
    r.setIndex(B.readUint32LE(off));
    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValuePointer} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    B.writeUint32LE(val.index, off);
    return this.getSize();
  }
}

module.exports = {
  MetaTypePointer
};
