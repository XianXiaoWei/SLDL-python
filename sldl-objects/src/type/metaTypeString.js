const { MetaType, kMetaValueType } = require("./metaType.js");
const { LevelValueString } = require("../value/levelValueString.js");

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
   * @returns {LevelValueBool}
   */
  read(L, B, off) {
    var r = new LevelValueString(this);
    r.setValue(B.readStringZero(off));
    return r;
  }

  /**
   * @param {LoIndices} L 
   * @param {Buffer} B 
   * @param {LevelValueBool} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(L, B, val, off) {
    if (val.def != this)
      return 0;
    B.writeStringZero(val.getValue() + "\0", off);
    return val.getSize();
  }
}

const kTypeString = Object.freeze({
  CString: new MetaTypeString("cstring"),
  TgcString: new MetaTypeString("TgcString"),
});

module.exports = {
  MetaTypeString,
  kTypeString
};
