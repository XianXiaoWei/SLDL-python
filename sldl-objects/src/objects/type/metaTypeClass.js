const { Buffer } = require("sldl-utils");
const { LevelValueClass } = require("../value/levelValueClass.js");
const { MetaType, kMetaValueType, kMetaTypes } = require("./metaType.js");
const { kObjectExceptions } = require("../../exceptions.js");

class MetaTypeClassMember extends MetaType {
  constructor(def, name) {
    super(name);

    this.def = def;
    this.name = name;
  }

  /**
   * @returns {number}
   */
  getSize() {
    return this.def.getSize();
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
   * @param {number} off
   * @returns {LevelValue}
   */
  read(B, off) {
    return this.def.read(B, off);
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValue} val 
   * @param {number} off
   * @returns {number}
   */
  write(B, val, off) {
    return this.def.write(B, val, off);
  }
}

class MetaTypeClassMemberArray extends MetaTypeClassMember {
  /**
   * @param {MetaType} def 
   * @param {string} name 
   * @param {number} [count] 
   */
  constructor(def, name, count) {
    super(def, name);

    this.maxCount = count || 0;
  }

  /**
   * @param {Buffer} B 
   * @param {number} off
   * @returns {LevelValue[]}
   */
  read(B, off) {
    var count = B.readUint32LE(off)
      , cursor = off + 4;

    if (this.maxCount && count > this.maxCount)
      return void 0;

    var r = [];
    for (var i = 0; i < count; i++) {
      var v = this.def.read(B, cursor);
      r.push(v);
      cursor += v.getSize();
    }

    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValue[]} val 
   * @param {number} off
   * @returns {number}
   */
  write(B, val, off) {
    if (val.length > this.maxCount)
      return 0;

    B.writeUint32(val.length);

    var cursor = off + 4;
    for (var v of val) {
      var n = this.def.write(B, v, cursor);
      if (!n)
        return 0;
      cursor += n;
    }

    return cursor - off;
  }
}

class MetaTypeClass extends MetaType {
  constructor(name, parent) {
    super(name);

    this.parent = typeof parent === "undefined" ? require("../types.js").kMetaTypes.Object : parent;
    this.members = new Map();
  }

  /**
   * Check if the given type is in the inheritance chain.
   * @param {MetaType} def 
   * @returns {boolean}
   */
  isCompatible(def) {
    for (var p = this; p; p = p.parent)
      if (def == p)
        return true;
    return false;
  }

  valueType() {
    return kMetaValueType.Class;
  }

  /**
   * @param {MetaType} def 
   * @param {string} name 
   * @param {number} [count]
   * @returns {boolean}
   */
  addMember(def, name, count) {
    if (this.members.has(name))
      return false;

    var member = typeof count === "number"
      ? new MetaTypeClassMemberArray(def, this.name + "::" + name, count)
      : new MetaTypeClassMember(def, this.name + "::" + name);

    // Add member to lookup table.
    this.members.set(name, member);

    return true;
  }

  /**
   * @param {Buffer} B 
   * @param {number} off 
   * @param {LoIndices} L 
   * @returns {LevelValue|null|undefined}
   */
  read(B, off, L) {
    var cursor = off
      , classIdx = B.readUint32LE(cursor)
      , name = B.readStringZero(cursor + 4);

    // Verify the real class and dispatch.
    var raw = L.classes[classIdx];
    if (!raw)
      throw kObjectExceptions.InvalidClassIndex.from(classIdx);
    if (raw.def != this)
      return raw.def.read(B, off, L);

    // Found the correct class definition, read from the buffer.
    cursor += 4 + Buffer.from(name).length + 1;

    var r = new LevelValueClass(this, name);
    for (var member of raw.raw.keys()) {
      var m = this.members.get(member)
        , v = m.read(B, cursor);

      if (!v)
        return void 0;

      if (m.valueType() == kMetaValueType.Pointer) {
        Array.isArray(v)
          ? L.pointers.push(...v)
          : L.pointers.push(v);
      }

      r.setValue(member, v);
      cursor += Array.isArray(v)
        ? v.reduce((sum, val) => sum + val.getSize(), 0) + 4
        : v.getSize();
    }

    r.finalize();

    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValueStruct} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off, L) {

  }
}

module.exports = {
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass
};
