const { Buffer } = require("sldl-utils");
const { MetaType, kMetaValueType, kMetaTypes } = require("./metaType.js");
const { LevelValueBool, LevelValueNumber } = require("../value/levelValueNumber.js");

class MetaTypeBool extends MetaType {
  constructor(name) {
    super(name);
  }

  getSize() {
    return 1;
  }

  getAlign() {
    return 1;
  }

  valueType() {
    return kMetaValueType.Number;
  }

  /**
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValueBool}
   */
  read(B, off) {
    var r = new LevelValueBool(this);
    r.setValue(!!B.readUInt8(off));
    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValueBool} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    if (val.def != this)
      return 0;
    B.writeUInt8(!!val.getValue(), off);
    return val.getSize();
  }
}

class MetaTypeNumber extends MetaType {
  /**
   * @param {string} name 
   * @param {number} size 
   * @param {(off:number)=>any} reader 
   * @param {(val:any, off:number)=>void} writer 
   */
  constructor(name, size, reader, writer) {
    super(name);
    this.size = size;
    this.reader = reader;
    this.writer = writer;
  }

  getSize() {
    return this.size;
  }

  getAlign() {
    return this.size;
  }

  valueType() {
    return kMetaValueType.Number;
  }

  /**
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValueNumber}
   */
  read(B, off) {
    var r = new LevelValueNumber(this);
    r.setValue(this.reader.call(B, off));
    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValueNumber} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    if (val.def != this)
      return 0;
    this.writer.call(B, val.getValue(), off);
    return val.getSize();
  }
}

module.exports = {
  MetaTypeBool,
  MetaTypeNumber,
};
