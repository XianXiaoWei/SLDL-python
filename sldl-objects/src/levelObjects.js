const { Buffer } = require("sldl-utils");
const { kObjectExceptions } = require("./exceptions.js");
const { kMetaTypes } = require("./types.js");
const { kMetaValueType } = require("./type/metaType.js");
const { MetaTypeClassMemberArray, MetaTypeClassMember } = require("./type/metaTypeClass.js");
const { MetaTypePointer } = require("./type/metaTypePointer.js");

const kMemvarTypes = Object.freeze({
  Raw: 0,
  String: 1,
  Ref: 2,
  Array: 3
});

class LoHeader {
  constructor() {
    this.magic = "TGCL";
    this.version = 1;
    this.numClasses = 0;
    this.numMemVars = 0;
    this.numObjects = 0;
    this.numRefs = 0;
    this.classesOffset = 0;
    this.memvarsOffset = 0;
    this.stringsOffset = 0;
    this.objectsOffset = 0;
    this.fileSize = 0;
  }

  initialize() {
    this.magic = "TGCL";
    this.version = 1;
    this.numClasses = 0;
    this.numMemVars = 0;
    this.numObjects = 0;
    this.numRefs = 0;
    this.classesOffset = 0;
    this.memvarsOffset = 0;
    this.stringsOffset = 0;
    this.objectsOffset = 0;
    this.fileSize = 0;
  }

  /**
   * @param {Buffer} B 
   * @returns {this}
   */
  read(B) {
    var magic = B.slice(0, 4).toString("ascii");
    if (magic !== "TGCL")
      throw new Error(`invalid magic: 0x${B.readUInt32LE(0).toString(16).padStart(8, "0")}, expected "TGCL"`);

    this.version = B.readUInt32LE(4);
    this.numClasses = B.readUInt32LE(8);
    this.numMemVars = B.readUInt32LE(12);
    this.numObjects = B.readUInt32LE(16);
    this.numRefs = B.readUInt32LE(20);
    this.classesOffset = B.readUInt32LE(24);
    this.memvarsOffset = B.readUInt32LE(28);
    this.stringsOffset = B.readUInt32LE(32);
    this.objectsOffset = B.readUInt32LE(36);
    this.fileSize = B.readUInt32LE(40);

    return this;
  }

  /**
   * @returns {Buffer}
   */
  write() {
    var r = Buffer.allocUnsafe(44);

    r.write(this.magic, 0, 4, "ascii");
    r.writeUInt32LE(this.version, 4);
    r.writeUInt32LE(this.numClasses, 8);
    r.writeUInt32LE(this.numMemVars, 12);
    r.writeUInt32LE(this.numObjects, 16);
    r.writeUInt32LE(this.numRefs, 20);
    r.writeUInt32LE(this.classesOffset, 24);
    r.writeUInt32LE(this.memvarsOffset, 28);
    r.writeUInt32LE(this.stringsOffset, 32);
    r.writeUInt32LE(this.objectsOffset, 36);
    r.writeUInt32LE(this.fileSize, 40);

    return r;
  }
}

class LoStringPool {
  /**
   * @param {Buffer} B 
   * @param {number} offset 
   * @returns {string}
   */
  static read(B, offset) {
    return B.readStringZero(offset);
  }

  constructor() {
    this.cursor = 0;
    this.buffer = Buffer.allocUnsafe(128);
    /** @type {Map<string, number>} */
    this.strings = new Map();
  }

  /**
   * Reset the string pool.
   */
  initialize() {
    this.cursor = 0;
    this.buffer = Buffer.allocUnsafe(128);
    this.strings.clear();
  }

  /**
   * @param {string} s 
   * @returns {number}
   */
  set(s) {
    if (typeof s !== "string")
      return -1;

    if (this.strings.has(s))
      return this.strings.get(s);

    var bytes = Buffer.from(s + "\0");
    if (this.cursor + bytes.length > this.buffer.length) {
      var newed = Buffer.allocUnsafe(this.buffer.length << 1);
      newed.set(this.buffer);
      this.buffer = newed;
    }

    var r = this.cursor;
    this.buffer.set(bytes, r);
    this.cursor += bytes.byteLength;

    return r;
  }

  /**
   * @returns {Buffer}
   */
  write() {
    return Buffer.from(this.buffer.subarray(0, this.cursor));
  }
}

class LoMemvar {
  constructor(type, name, size, aux) {
    this.type = type;
    this.name = name;
    this.size = size;
    this.aux = aux;
  }
}

class LoClass {
  constructor(name) {
    this.name = name;
    this.raw = new Map();
    this.def = void 0;
  }

  addMemvar(memvar) {
    this.raw.set(memvar.name, memvar);
  }

  setDef(def) {
    function verifyMemvar(raw, def) {
      if (!(def instanceof MetaTypeClassMember))
        return false;

      if (raw.type == kMemvarTypes.Raw) {
        if (def.valueType() != kMetaValueType.Struct && def.valueType() != kMetaValueType.Number)
          return false;
      } else if (raw.type == kMemvarTypes.String) {
        if (def.valueType() != kMetaValueType.String)
          return false;
      } else if (raw.type == kMemvarTypes.Array) {
        if (!(def instanceof MetaTypeClassMemberArray))
          return false;
      } else if (raw.type == kMemvarTypes.Ref) {
        if (!(def.def instanceof MetaTypePointer))
          return false;
      } else
        return false;

      return true;
    }

    this.def = def;

    var count = 0;
    for (var kv of this.raw) {
      var m = def.members.get(kv[0]);

      if (!m || !verifyMemvar(kv[1], m))
        throw kObjectExceptions.MemberMismatch.from(this.name, kv[1].name);

      count++;
    }

    if (count != def.members.size)
      throw kObjectExceptions.MemberMismatch.from(this.name);
  }
}

class LoIndices {
  constructor() {
    /** @type {LoClass[]} */
    this.classes = [];
    /** @type {LoMemvar[]} */
    this.memvars = [];
    /** @type {LevelValueClass[]} */
    this.objects = [];
    /** @type {LevelValuePointer[]} */
    this.pointers = [];
  }

  /**
   * Add a memvar.
   * @param {number} type 
   * @param {number} name 
   * @param {number} size 
   * @param {number} aux 
   * @returns {LoMemvar}
   */
  addMemvar(type, name, size, aux) {
    var m = new LoMemvar(type, name, size, aux);
    this.memvars.push(m);
    return m;
  }

  /**
   * Add a class.
   * @param {number} name 
   * @param {number} firstMemvar 
   * @param {number} numMemvars 
   * @returns {LoClass}
   */
  addClass(name, firstMemvar, numMemvars) {
    var c = new LoClass(name);
    for (var i = 0; i < numMemvars; i++) {
      var m = this.memvars[firstMemvar + i];
      if (!m)
        throw kObjectExceptions.MemvarOutOfBound.from();
      c.addMemvar(m);
    }
    this.classes.push(c);
    return c;
  }
}

class LevelObjects {
  /**
   * @param {Map<string, MetaTypeClass>} definitions 
   */
  constructor(definitions) {
    /** @type {Map<string, MetaTypeClass>} */
    this.definitions = new Map(definitions.entries());

    this.header = new LoHeader();
    this.strings = new LoStringPool();
    /** @type {Map<string, LevelValueClass>} */
    this.objects = new Map();

    this.definitions.set("Object", kMetaTypes.Object);
  }

  /**
   * Get an object.
   * @param {string} name 
   * @returns {LevelValueClass|undefined}
   */
  get(name) {
    return this.objects.get(name);
  }

  /**
   * Set an object.
   * @param {string} name 
   * @param {LevelValueClass} object
   */
  set(name, object) {
    this.objects.set(name, object);
  }

  /**
   * @param {Buffer} B 
   * @returns {boolean}
   */
  read(B) {
    this.header.read(B);

    var indices = new LoIndices();

    // Read member variable defs from the buffer.
    for (var i = 0; i < this.header.numMemVars; i++) {
      var off = this.header.memvarsOffset + i * 16;
      indices.addMemvar(
        // Memvar type, onk of kMemvarTypes.
        B.readUInt32LE(off),
        // Memvar name.
        this.readDataString(B, B.readUInt32LE(off + 4)),
        // Memvar size.
        B.readUInt32LE(off + 8),
        // Memvar aux value (for array).
        B.readUInt32LE(off + 12)
      );
    }

    // Read raw classes from the buffer.
    for (var i = 0; i < this.header.numClasses; i++) {
      var off = this.header.classesOffset + i * 12;

      // Add a class.
      indices.addClass(
        // Name.
        this.readDataString(B, B.readUInt32LE(off)),
        // First memvar index.
        B.readUInt32LE(off + 4),
        // Memvar count.
        B.readUInt32LE(off + 8)
      );
    }

    // Lookup definition and set.
    for (var c of indices.classes) {
      // The object reader uses the memvar order from indices.memvars, instead of
      // the definition.
      var def = this.definitions.get(c.name);
      if (!def)
        throw kObjectExceptions.InvalidClassName.from(c.name);

      c.setDef(def, indices);
    }

    // Read objects.
    var cursor = this.header.objectsOffset;
    for (var i = 0; i < this.header.numObjects && cursor < this.header.fileSize; i++) {
      var obj = kMetaTypes.Object.read(B, cursor, indices)
        , name = obj?.name;

      if (!obj || typeof name !== "string")
        throw kObjectExceptions.ReadObjectFailed.from();

      if (this.objects.has(name))
        throw kObjectExceptions.MultipleObjectName.from(obj.name);

      indices.objects.push(obj);
      this.objects.set(name, obj);

      cursor += obj.getSize();
    }

    // Backpatch object pointers.
    for (var p of indices.pointers)
      p.backpatch(indices);
  }

  /**
   * @returns {Buffer}
   */
  write() {
    this.strings.initialize();
  }

  /**
   * @param {Buffer} B 
   * @param {number} offset 
   * @returns {string}
   */
  readDataString(B, offset) {
    return LoStringPool.read(B, this.header.stringsOffset + offset);
  }
}

module.exports = {
  LoHeader,
  LoStringPool,
  LoMemvar,
  LoClass,
  LoIndices,
  LevelObjects,
  kMemvarTypes
};
