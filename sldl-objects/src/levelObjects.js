const { Buffer } = require("sldl-utils");
const { kObjectExceptions } = require("./exceptions.js");
const { kMetaTypes } = require("./types.js");
const { kMetaValueType, MetaType } = require("./type/metaType.js");
const { MetaTypeClassMemberArray, MetaTypeClassMember, MetaTypeClass } = require("./type/metaTypeClass.js");
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
    // - Blob variables.

    /** @type {LoClass[]} */
    this.classes = [];
    /** @type {LoMemvar[]} */
    this.memvars = [];
    /** @type {LevelValueClass[]} */
    this.objects = [];
    /** @type {LevelValuePointer[]} */
    this.pointers = [];

    // - JS variables.

    /** @type {Map<string, MetaType>} */
    this.metaTypes = new Map();
    /** @type {Map<string, MetaTypeClass>} */
    this.metaClasses = new Map();
    /** @type {Map<string, number>} */
    this.classIndices = new Map();
    /** @type {Map<string, number>} */
    this.objectIndices = new Map();
  }

  /**
   * Clear context for the next operation.
   */
  clear() {
    this.classes = [];
    this.memvars = [];
    this.objects = [];
    this.pointers = [];

    this.classIndices.clear();
    this.objectIndices.clear();
  }

  /**
   * Register MetaType definitions for lookup.
   * @param {MetaType[]} definitions
   */
  define(definitions) {
    this.metaTypes.clear();
    this.metaClasses.clear();
    for (var def of definitions) {
      this.metaTypes.set(def.getName(), def);
      if (def instanceof MetaTypeClass)
        this.metaClasses.set(def.getName(), def);
    }
  }

  /**
   * Rebuild internal lookup maps after all classes and objects have been added.
   */
  finalize() {
    var classes = new Map();
    for (var c of this.classes)
      classes.set(c.name, c);
  }

  /**
   * Get a MetaType by name from the registered definitions.
   * @param {string} name
   * @returns {MetaType|undefined}
   */
  getClassFromName(name) {
    return this.metaTypes.get(name);
  }

  /**
   * Get the index of a class by name.
   * @param {string} name
   * @returns {number}
   */
  getClassIdx(name) {
    var idx = this.classIndices.get(name);
    if (idx === undefined)
      throw kObjectExceptions.InvalidClassName.from(name);
    return idx;
  }

  /**
   * Get the index of an object by name.
   * @param {string} name
   * @returns {number}
   */
  getObjectIdx(name) {
    var idx = this.objectIndices.get(name);
    if (idx === undefined)
      throw kObjectExceptions.InvalidObjectIndex.from(name);
    return idx;
  }

  /**
   * Add a memvar.
   * @param {number} type 
   * @param {number} name 
   * @param {number} size 
   * @param {number} aux 
   * @returns {LoMemvar}
   */
  addMemvarFromBlob(type, name, size, aux) {
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
  addClassFromBlob(name, firstMemvar, numMemvars) {
    var c = new LoClass(name);
    for (var i = 0; i < numMemvars; i++) {
      var m = this.memvars[firstMemvar + i];
      if (!m)
        throw kObjectExceptions.MemvarOutOfBound.from();
      c.addMemvar(m);
    }

    if (this.classIndices.has(name))
      throw kObjectExceptions.MultipleClassName.from(name);

    this.classIndices.set(name, this.classes.length);
    this.classes.push(c);

    return c;
  }

  /**
   * @param {LevelValueClass} obj 
   * @returns {LevelValueClass}
   */
  addObject(obj) {
    var name = obj.getName();

    if (this.objectIndices.has(name))
      throw kObjectExceptions.MultipleObjectName.from(name);

    this.objectIndices.set(obj.getName(), this.objects.length);
    this.objects.push(obj);

    return obj;
  }

  /**
   * Add a class from a MetaTypeClass definition.
   * Creates LoMemvar entries for each member.
   * @param {MetaTypeClass} def
   * @returns {LoClass}
   */
  addClassFromDef(def) {
    var name = def.getName();

    if (this.classIndices.has(name))
      throw kObjectExceptions.MultipleClassName.from(name);

    this.classIndices.set(name, this.classes.length);

    var c = new LoClass(name);
    for (var [memberName, member] of def.members) {
      var type, size, aux;

      if (member instanceof MetaTypeClassMemberArray) {
        type = kMemvarTypes.Array;
        size = member.def.getSize();
        aux = member.maxCount;
      } else if (member.valueType() == kMetaValueType.Pointer) {
        type = kMemvarTypes.Ref;
        size = member.getSize();
        aux = 0;
      } else if (member.valueType() == kMetaValueType.String) {
        type = kMemvarTypes.String;
        size = member.getSize();
        aux = 0;
      } else {
        // Number, Struct, or Bool.
        type = kMemvarTypes.Raw;
        size = member.getSize();
        aux = 0;
      }

      var m = new LoMemvar(type, memberName, size, aux);
      this.memvars.push(m);
      c.addMemvar(m);
    }

    this.classes.push(c);
    this.metaClasses.set(name, def);

    return c;
  }
}

class LevelObjects {
  /**
   * @param {MetaType[]} definitions 
   */
  constructor(definitions) {
    /** @type {Map<string, MetaType>} */
    this.definitions = new Map();

    this.header = new LoHeader();
    this.strings = new LoStringPool();
    /** @type {Map<string, LevelValueClass>} */
    this.objects = new Map();

    this.define(definitions);
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
   * @param {LevelValueClass} object
   */
  set(object) {
    this.objects.set(object.name, object);
  }

  /**
   * Recalculate the association between names and references.
   */
  finalize() {
    // Update classes.
    var classes = new Map();
    for (var def of this.definitions.values())
      classes.set(def.name, def);
    this.definitions = classes;

    // Update objects.
    var objects = new Map();
    for (var obj of this.objects.values())
      objects.set(obj.name, obj);
    this.objects = objects;
  }

  /**
   * Set the type definition list.
   * @param {MetaType[]} definitions 
   */
  define(definitions) {
    this.definitions.clear();
    // Arrange the built-in types at the end of the array to ensure they are
    // not overwritten.
    definitions = definitions.concat([...Object.values(kMetaTypes)]);
    for (var def of definitions)
      this.definitions.set(def.name, def);
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
      indices.addMemvarFromBlob(
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
      indices.addClassFromBlob(
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
      var obj = kMetaTypes.Object.read(indices, B, cursor)
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
   * Serialize all objects to a TGCL binary buffer.
   * @returns {Buffer}
   */
  write() {
    // Reset string pool.
    this.strings.initialize();

    var indices = new LoIndices();
    indices.define([...this.definitions.values()]);

    // Register classes used by objects and collect pointers.
    for (var obj of this.objects.values()) {
      var className = obj.getDef().getName();
      if (!indices.classIndices.has(className))
        indices.addClassFromDef(obj.getDef());

      indices.addObject(obj);

      // Collect pointer members for front-patching.
      for (var [name, val] of obj.value) {
        var member = obj.getDef().members.get(name);
        if (member && member.valueType() == kMetaValueType.Pointer) {
          if (Array.isArray(val))
            indices.pointers.push(...val);
          else
            indices.pointers.push(val);
        }
      }
    }

    // Front-patch pointers: resolve object references to indices.
    for (var p of indices.pointers) {
      var target = p.getValue();
      if (target) {
        var idx = indices.objectIndices.get(target.getName());
        if (idx === undefined)
          throw kObjectExceptions.InvalidObjectIndex.from(target.getName());
        p.setIndex(idx);
      } else {
        p.setIndex(0xFFFFFFFF);
      }
    }

    // Write memvar buffer (16 bytes each).
    var memvarBuf = Buffer.allocUnsafe(indices.memvars.length * 16);
    for (var i = 0; i < indices.memvars.length; i++) {
      var m = indices.memvars[i]
        , mOff = i * 16;
      memvarBuf.writeUInt32LE(m.type, mOff);
      memvarBuf.writeUInt32LE(this.strings.set(m.name), mOff + 4);
      memvarBuf.writeUInt32LE(m.size, mOff + 8);
      memvarBuf.writeUInt32LE(m.aux, mOff + 12);
    }

    // Write class buffer (12 bytes each).
    var classBuf = Buffer.allocUnsafe(indices.classes.length * 12);
    for (var i = 0; i < indices.classes.length; i++) {
      var c = indices.classes[i]
        , cOff = i * 12;
      classBuf.writeUInt32LE(this.strings.set(c.name), cOff);

      // Calculate first memvar index for this class.
      var firstMemvar = 0;
      for (var j = 0; j < i; j++)
        firstMemvar += indices.classes[j].raw.size;
      classBuf.writeUInt32LE(firstMemvar, cOff + 4);
      classBuf.writeUInt32LE(c.raw.size, cOff + 8);
    }

    // Write string pool.
    var stringBuf = this.strings.write();

    // Write objects.
    var totalObjSize = 0;
    for (var obj of indices.objects)
      totalObjSize += obj.getSize();
    var objBuf = Buffer.allocUnsafe(totalObjSize);
    var cursor = 0;
    for (var obj of indices.objects) {
      var n = obj.getDef().write(indices, objBuf, obj, cursor);
      if (!n)
        throw kObjectExceptions.ReadObjectFailed.from();
      cursor += n;
    }

    // Calculate offsets.
    var headerSize = 44;
    var classesOffset = headerSize;
    var memvarsOffset = classesOffset + classBuf.length;
    var stringsOffset = memvarsOffset + memvarBuf.length;
    var objectsOffset = stringsOffset + stringBuf.length;
    var fileSize = objectsOffset + cursor;

    // Prepare header.
    this.header.initialize();
    this.header.numClasses = indices.classes.length;
    this.header.numMemVars = indices.memvars.length;
    this.header.numObjects = indices.objects.length;
    this.header.numRefs = indices.pointers.length;
    this.header.classesOffset = classesOffset;
    this.header.memvarsOffset = memvarsOffset;
    this.header.stringsOffset = stringsOffset;
    this.header.objectsOffset = objectsOffset;
    this.header.fileSize = fileSize;

    // Assemble final buffer.
    var result = Buffer.allocUnsafe(fileSize);
    this.header.write().copy(result, 0);
    classBuf.copy(result, classesOffset);
    memvarBuf.copy(result, memvarsOffset);
    stringBuf.copy(result, stringsOffset);
    objBuf.copy(result, objectsOffset, 0, cursor);

    return result;
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
