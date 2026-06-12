var { Buffer } = require("buffer");
var { MetaType, kMetaValueType } = require("./metaType.js");
var { LevelValueString } = require("../value/levelValueString.js");

class MetaTypeString extends MetaType {
  constructor(name) {
    super(name);
  }

  valueType() {
    return kMetaValueType.String;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @returns {LevelValueString}
   */
  read(L, B, off) {
    var r = new LevelValueString(this);
    r.setValue(B.readStringZero(off));
    return r;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {LevelValueString} val
   * @param {number} off
   * @returns {number}
   */
  write(L, B, val, off) {
    if (val.def != this)
      return 0;
    B.writeStringZero(val.getValue() + "\0", off);
    return val.getSize();
  }
}

module.exports = {
  MetaTypeString
};
