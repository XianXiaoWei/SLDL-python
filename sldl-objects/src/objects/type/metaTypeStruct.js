const { LevelValueStruct } = require("../value/levelValueStruct.js");
const { MetaType, kMetaValueType } = require("./metaType.js");

class MetaTypeStructMember extends MetaType {
  /**
   * @param {MetaType} def 
   * @param {string} name 
   * @param {number} [count] 
   */
  constructor(def, name, count) {
    super(name);

    this.def = def;
    this.name = name;
    this.offset = 0;
    this.count = count || 1;
  }

  /**
   * @returns {number}
   */
  getSize() {
    return this.def.getSize() * this.count;
  }

  /**
   * @returns {number}
   */
  getAlign() {
    return this.def.getAlign();
  }

  /**
   * @returns {number}
   */
  valueType() {
    return this.def.valueType();
  }

  /**
   * @param {Buffer} B 
   * @param {number} off - Offset of the struct.
   * @returns {LevelValue|LevelValue[]}
   */
  read(B, off) {
    var begin = off + this.offset;
    if (this.count == 1)
      return this.def.read(B, begin);

    var r = [];
    for (var i = 0; i < this.count; i++)
      r.push(this.def.read(B, begin + i * this.getSize()));
    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValue|LevelValue[]} val 
   * @param {number} off - Offset of the struct.
   * @returns {number}
   */
  write(B, val, off) {
    var begin = off + this.offset;
    if (this.count == 1)
      return this.def.write(B, val, begin);

    if (this.count != val.length)
      return 0;

    for (var i = 0; i < this.count; i++) {
      var v = val[i];
      if (v.def != this)
        return 0;
      if (!this.def.write(B, v, begin + i * this.getSize()))
        return 0;
    }

    return this.getSize() * this.count;
  }
}

class MetaTypeStruct extends MetaType {
  constructor(name) {
    super(name);

    /** @type {Map<string, MetaTypeStructMember>} */
    this.members = new Map();
    this.size = 0;
    this.align = 0;
    this.cursor = 0;
  }

  getSize() {
    return this.size;
  }

  getAlign() {
    return this.align;
  }

  valueType() {
    return kMetaValueType.Struct;
  }

  /**
   * @param {MetaType} def 
   * @param {string} name 
   * @param {number} [count]
   * @returns {boolean}
   */
  addMember(def, name, count) {
    if (def.valueType() != kMetaValueType.Number && def.valueType() != kMetaValueType.Struct)
      return false;
    if (this.members.has(name))
      return false;

    var member = new MetaTypeStructMember(def, this.name + "::" + name, count)
      , align = member.getAlign();
    // Aligned to an integer multiple of the alignment value.
    member.offset = this.cursor % align
      ? this.cursor - (this.cursor % align) + align
      : this.cursor;
    // Update cursor.
    this.cursor = member.offset + member.getSize();
    // Update alignment.
    this.align = Math.max(this.align, align);
    // Update size.
    this.size = this.cursor % this.align
      ? this.cursor - (this.cursor % this.align) + this.align
      : this.cursor;
    // Add member to lookup table.
    this.members.set(name, member);

    return true;
  }

  /**
   * Mark the struct as completed and force set the total alignment.
   * @param {number} [align] 
   */
  finalize(align) {
    if (align)
      this.align = align;
    this.size = this.cursor % this.align
      ? this.cursor - (this.cursor % this.align) + this.align
      : this.cursor;
  }

  /**
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValue}
   */
  read(B, off) {
    if (off + this.getSize() > B.length)
      return void 0;

    var r = new LevelValueStruct(this);
    for (var member of this.members.entries()) {
      var m = member[1].read(B, off);
      r.setValue(member[0], m);
    }

    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValueStruct} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    if (val.def != this)
      return 0;

    for (var member of this.members.entries()) {
      var m = val.getValue(member[0]);
      if (!m)
        return 0;

      var n = member[1].write(B, m, off);
      if (!n)
        return 0;
    }

    return this.getSize();
  }
}

module.exports = {
  MetaTypeStructMember,
  MetaTypeStruct
};
