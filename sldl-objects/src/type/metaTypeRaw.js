var { Buffer } = require("buffer");
var { MetaType, kMetaValueType } = require("./metaType.js");
var { LevelValueRaw } = require("../value/levelValueRaw.js");

class MetaTypeRaw extends MetaType {
  /**
   * @param {string} name
   * @param {number} size
   */
  constructor(name, size) {
    super(name);
    this.size = size;
  }

  getSize() {
    return this.size;
  }

  getAlign() {
    return this.size <= 4 ? this.size
      : this.size <= 8 ? 4
      : 8;
  }

  valueType() {
    return kMetaValueType.Raw;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @returns {LevelValueRaw}
   */
  read(L, B, off) {
    var r = new LevelValueRaw(this);
    r.setValue(Buffer.from(B.subarray(off, off + this.size)));
    return r;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {LevelValueRaw} val
   * @param {number} off
   * @returns {number}
   */
  write(L, B, val, off) {
    if (val.def != this)
      return 0;
    var buf = val.getValue();
    var len = Math.min(buf.length, this.size);
    buf.copy(B, off, 0, len);
    return this.size;
  }
}

module.exports = {
  MetaTypeRaw
};
