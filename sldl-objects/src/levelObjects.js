const { Buffer } = require("buffer");
const { kObjectExceptions } = require("./exceptions.js");
const { kMetaTypes } = require("./types.js");
const { kMetaValueType, kMetaValueFlag, MetaType } = require("./type/metaType.js");
const {
  MetaTypeClass,
  MetaTypeClassMemberArray,
  MetaTypeClump
} = require("./type/metaTypeClass.js");
const { MetaTypePointer } = require("./type/metaTypePointer.js");
const { MetaTypeRaw } = require("./type/metaTypeRaw.js");
const { LevelValueClass } = require("./value/levelValueClass.js");
const { LevelValuePointer } = require("./value/levelValuePointer.js");

// Install natively missing helpers on Buffer.
function readStringZero(B, offset, encoding) {
  return (function (offset, encoding) {
    offset >>>= 0;
    if (offset >= this.length) return "";
    var begin = offset, end = begin;
    while (end < this.length && this[end]) end++;
    return begin < end ? this.toString(encoding, begin, end) : "";
  }).call(B, offset, encoding);
}

/** Member variable types in TGCL file. */
const kMemvarTypes = Object.freeze({
  Raw: 0,
  String: 1,
  Ref: 2,
  Array: 3
});

/** TGCL Header. */
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

  read(B) {
    var magic = B.slice(0, 4).toString("ascii");
    if (magic !== "TGCL")
      throw kObjectExceptions.HeaderMagicMismatch.from(B.readUInt32LE(0));

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

/** String pool. */
class LoStringPool {
  static read(B, offset) {
    return readStringZero(B, offset);
  }

  constructor() {
    this.cursor = 0;
    this.buffer = Buffer.allocUnsafe(128);
    this.strings = new Map();
  }

  initialize() {
    this.cursor = 0;
    this.buffer = Buffer.allocUnsafe(128);
    this.strings.clear();
  }

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
    this.strings.set(s, r);

    return r;
  }

  write() {
    return Buffer.from(this.buffer.subarray(0, this.cursor));
  }
}

/** Member variable declaration in TGCL binary file. */
class LoMemvar {
  static createRaw(name, size) {
    return new LoMemvar(kMemvarTypes.Raw, name, size, 0);
  }

  static createString(name) {
    return new LoMemvar(kMemvarTypes.String, name, 0, 0);
  }

  static createRef(name) {
    return new LoMemvar(kMemvarTypes.Ref, name, 0, 0);
  }

  static createArray(name, aux) {
    return new LoMemvar(kMemvarTypes.Array, name, 0, aux);
  }

  constructor(type, name, size, aux) {
    this.type = type;
    this.name = name;
    this.size = size;
    this.aux = aux;
  }
}

/** Class declaration in TGCL binary file. */
class LoClass {
  constructor(name) {
    this.name = name;
    this.raw = new Map();
    this.def = void 0;
    this.firstMemvar = 0;
  }

  addMemvar(memvar) {
    this.raw.set(memvar.name, memvar);
  }

  setDef(def) {
    this.def = def;
  }
}

/** Collections of declarations of TGCL binary file. */
class LoIndices {
  constructor() {
    this.classes = [];
    this.memvars = [];
    this.objects = [];
    this.pointers = [];

    this.metaTypes = new Map();
    this.metaClasses = new Map();
    this.classIndices = new Map();
    this.objectIndices = new Map();
  }

  /**
   * Reset the table.
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
   * Reset the per-file tables and re-register the current meta type
   * definitions. Used to move between read and write phases.
   */
  redefine() {
    this.clear();
    this.define(Array.from(this.metaTypes.values()));
  }

  /**
   * Add all JS declarations to the table.
   * @param {MetaType[]} definitions 
   */
  define(definitions) {
    this.metaTypes.clear();
    this.metaClasses.clear();
    for (var def of definitions) {
      this.metaTypes.set(def.getName(), def);
      if (def.valueType() === kMetaValueType.Class || def.valueFlag() === kMetaValueFlag.Clump)
        this.metaClasses.set(def.getName(), def);
    }
  }

  getClassFromName(name) {
    return this.metaTypes.get(name);
  }

  getClassIdx(name) {
    var idx = this.classIndices.get(name);
    if (typeof idx === "undefined") {
      // Clump<T> variants share the "Clump" binary class.
      var mt = this.metaTypes.get(name);
      if (mt.valueFlag() === kMetaValueFlag.Clump)
        idx = this.classIndices.get("Clump");
    }
    if (typeof idx === "undefined")
      return -1;
    return idx;
  }

  getObjectIdx(name) {
    var idx = this.objectIndices.get(name);
    if (idx === undefined)
      throw kObjectExceptions.InvalidObjectIndex.from(name);
    return idx;
  }

  addMemvarFromBlob(type, name, size, aux) {
    var m = new LoMemvar(type, name, size, aux);
    this.memvars.push(m);
    return m;
  }

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

  addObject(obj) {
    var name = obj.getName();
    if (this.objectIndices.has(name))
      throw kObjectExceptions.MultipleObjectName.from(name);

    this.objectIndices.set(obj.getName(), this.objects.length);
    this.objects.push(obj);
    return obj;
  }

  addClassFromDef(def, usedMembers) {
    var name = def.getName();
    // Clump<T> variants share the "Clump" binary class.
    var binName = def.valueFlag() === kMetaValueFlag.Clump ? "Clump" : name;

    if (this.classIndices.has(binName)) {
      var existing = this.classes[this.classIndices.get(binName)];
      // If already fully populated, return early.
      // If pre-registered but not yet filled, fall through to add memvars.
      if (existing.raw.size > 0)
        return existing;
      var c = existing;
    } else {
      this.classIndices.set(binName, this.classes.length);
      c = new LoClass(binName);
      this.classes.push(c);
    }

    var memberList = def.allMembers(usedMembers);

    // Phase 1: Pre-register inline element class indices (no memvars yet)
    // so that aux values can be computed in phase 2.
    for (var mi = 0; mi < memberList.length; mi++) {
      var member = memberList[mi][1];
      if (member.valueFlag() === kMetaValueFlag.Array
        && (member.def.valueType() === kMetaValueType.Class || member.def.valueFlag() === kMetaValueFlag.Clump)) {
        var elemBinName = member.def.valueFlag() === kMetaValueFlag.Clump ? "Clump" : member.def.getName();
        if (!this.classIndices.has(elemBinName)) {
          this.classIndices.set(elemBinName, this.classes.length);
          this.classes.push(new LoClass(elemBinName));
        }
      }
    }

    // Phase 2: Add THIS class's own memvars (parent before children).
    for (var i = 0; i < memberList.length; i++) {
      var memberName = memberList[i][0]
        , member = memberList[i][1]
        , type, size, aux;

      if (member.valueFlag() === kMetaValueFlag.Array) {
        type = kMemvarTypes.Array;
        if ((member.def.valueType() === kMetaValueType.Class || member.def.valueFlag() === kMetaValueFlag.Clump)) {
          size = 0;
          var mdbn = member.def.valueFlag() === kMetaValueFlag.Clump ? "Clump" : member.def.getName();
          aux = this.classIndices.get(mdbn);
        } else if (member.valueType() == kMetaValueType.Pointer) {
          size = member.getSize();
          aux = 0xFFFFFFFF;
        } else {
          size = member.def.getSize();
          aux = member.maxCount;
        }
      } else if (member.valueType() == kMetaValueType.Pointer) {
        type = kMemvarTypes.Ref;
        size = 0;
        aux = 0;
      } else if (member.valueType() == kMetaValueType.String) {
        type = kMemvarTypes.String;
        size = 0;
        aux = 0;
      } else {
        type = kMemvarTypes.Raw;
        size = member.getSize();
        aux = 0;
      }

      var m = new LoMemvar(type, memberName, size, aux);
      this.memvars.push(m);
      c.addMemvar(m);
    }

    this.metaClasses.set(name, def);

    // Phase 3: Recursively fill element class memvars (after parent's memvars).
    for (var mi = 0; mi < memberList.length; mi++) {
      var member = memberList[mi][1];
      if (member.valueFlag() === kMetaValueFlag.Array
        && (member.def.valueType() === kMetaValueType.Class || member.def.valueFlag() === kMetaValueFlag.Clump)) {
        this.addClassFromDef(member.def, void 0);
      }
    }

    return c;
  }
}

// --- LevelObjects ------------------------------------------------------------

class LevelObjects {
  /**
   * @param {MetaType[]} definitions - MetaType definitions.
   */
  constructor(definitions) {
    this.indices = new LoIndices();

    var defs = [];
    for (var i = 0; i < definitions.length; i++)
      defs.push(definitions[i]);
    // Ensure built-in types are included.
    for (var key of Object.keys(kMetaTypes))
      defs.push(kMetaTypes[key]);

    this.indices.define(defs);

    // Register all class definitions in LoIndices.
    for (var j = 0; j < definitions.length; j++) {
      var def = definitions[j];
      if (def instanceof MetaTypeClass)
        this.indices.addClassFromDef(def, void 0);
    }

    /** @type {Map<string, LevelValueClass>} */
    this.objects = new Map();
    /** @type {Set<string>} Per-class set of used member names for pruning. */
    this.usedMembers = new Map();
  }

  /**
   * Get an object by name.
   * @param {string} name
   * @returns {LevelValueClass|undefined}
   */
  get(name) {
    return this.objects.get(name);
  }

  /**
   * Store an object, tracking member usage for pruning.
   * @param {LevelValueClass} obj
   */
  set(obj) {
    var name = obj.getName();
    this.objects.set(name, obj);

    var className = obj.getDef().getName();
    if (!this.usedMembers.has(className))
      this.usedMembers.set(className, new Set());
    var usedSet = this.usedMembers.get(className);
    for (var [memberName, val] of obj.value)
      usedSet.add(memberName);
  }

  /**
   * Read a TGCL binary buffer. Objects are stored internally and
   * also returned.
   * @param {Buffer|Uint8Array} buffer
   * @returns {Map<string, LevelValueClass>}
   */
  readBinary(buffer) {
    Buffer.isBuffer(buffer) || (buffer = Buffer.from(buffer));

    var header = new LoHeader().read(buffer);
    var L = this.indices;

    L.redefine();

    // Read memvars from binary.
    for (var i = 0; i < header.numMemVars; i++) {
      var off = header.memvarsOffset + i * 16;
      L.addMemvarFromBlob(
        buffer.readUInt32LE(off),
        LoStringPool.read(buffer, header.stringsOffset + buffer.readUInt32LE(off + 4)),
        buffer.readUInt32LE(off + 8),
        buffer.readUInt32LE(off + 12)
      );
    }

    // Read classes from binary.
    for (var i = 0; i < header.numClasses; i++) {
      var off = header.classesOffset + i * 12;
      L.addClassFromBlob(
        LoStringPool.read(buffer, header.stringsOffset + buffer.readUInt32LE(off)),
        buffer.readUInt32LE(off + 4),
        buffer.readUInt32LE(off + 8)
      );
    }

    // Match binary classes to registered definitions.
    for (var j = 0; j < L.classes.length; j++) {
      var c = L.classes[j];
      var def = L.metaClasses.get(c.name);

      if (def) {
        // Known class: register members present in the binary but missing
        // from the definition.
        for (var [memName, memvar] of c.raw)
          if (!def.getMember(memName))
            addMemberFromMemvar(def, L.classes, c.name, memName, memvar);
      } else {
        // Unknown class: synthesize a definition from the binary memvars.
        def = new MetaTypeClass(c.name, kMetaTypes.Object);
        def.isAutoCreated = true;
        for (var [memName, memvar] of c.raw)
          addMemberFromMemvar(def, L.classes, c.name, memName, memvar);
        L.metaClasses.set(c.name, def);
        L.metaTypes.set(c.name, def);
      }

      c.setDef(def);
    }

    // Read objects.
    var cursor = header.objectsOffset;
    for (var k = 0; k < header.numObjects && cursor < header.fileSize; k++) {
      var classIdx = buffer.readUInt32LE(cursor)
        , name = readStringZero(buffer, cursor + 4);
      if (classIdx >= L.classes.length || classIdx < 0)
        throw kObjectExceptions.InvalidClassIndex.from(classIdx);

      // Advance past the inline name by its on-disk byte span, not the
      // re-encoded length of the decoded string.
      var nameEnd = cursor + 4;
      while (nameEnd < buffer.length && buffer[nameEnd])
        nameEnd++;
      cursor = nameEnd + 1;

      var raw = L.classes[classIdx];
      if (!raw)
        throw kObjectExceptions.InvalidClassIndex.from(classIdx);

      var objDef = raw.def;
      var obj, objSize;

      if (objDef && objDef.isAutoCreated) {
        var rawResult = readRawMembers(L, buffer, cursor, raw, objDef, name);
        obj = rawResult.obj;
        objSize = rawResult.size;
      } else {
        obj = objDef.read(L, buffer, cursor, raw);
        objSize = obj.getSize();
      }

      if (!obj || typeof name !== "string")
        throw kObjectExceptions.ReadObjectFailed.from();

      obj.name = name;
      L.objects.push(obj);
      this.set(obj);

      cursor += objSize;
    }

    // Backpatch pointers.
    for (var pi = 0; pi < L.pointers.length; pi++)
      L.pointers[pi].backpatch(L);

    // Reset indices for write use.
    L.redefine();

    return this.objects;
  }

  /**
   * Serialize stored objects to a TGCL binary buffer.
   * @param {Set<string>} [usedMembers] - per-class member usage for pruning.
   * @returns {Uint8Array}
   */
  writeBinary(usedMembers) {
    function recursiveObjects(obj) {
      for (var [mname, mval] of obj.value) {
        var memb = obj.getDef().getMember(mname);
        if (!memb)
          continue;

        if (memb.valueType() === kMetaValueType.Class) {
          var childs = Array.isArray(mval) ? mval : [mval];
          for (var c of childs)
            recursiveObjects(c);
          continue;
        }

        if (memb.valueType() !== kMetaValueType.Pointer)
          continue;

        var ptrs = Array.isArray(mval) ? mval : [mval];
        for (var pi = 0; pi < ptrs.length; pi++) {
          var p = ptrs[pi];
          if (!(p instanceof LevelValuePointer))
            continue;
          if (p.targetName !== null && p.targetName !== void 0) {
            var targetIdx = L.objectIndices.get(p.targetName);
            if (targetIdx === void 0)
              throw kObjectExceptions.UnresolvedObjectReference.from(p.targetName);
            p.setIndex(targetIdx);
          }
          L.pointers.push(p);
        }
      }
    }

    var L = this.indices;
    var strings = new LoStringPool();

    var um = usedMembers || this.usedMembers;

    // Reset indices and rebuild from meta types with pruning.
    L.redefine();

    // Collect which classes are directly used by objects.
    var usedClassNames = new Set();
    for (var [name, obj] of this.objects)
      usedClassNames.add(obj.getDef().getName());

    // Register classes with pruning — only directly-used classes.
    for (var [className, classDef] of L.metaClasses) {
      // Only register classes that objects directly instantiate.
      // Parent classes (e.g. Event for OnLevelStart) are NOT
      // registered; their members are inherited via allMembers().
      if (!usedClassNames.has(className))
        continue;
      var memberSet = um.get(className);
      L.addClassFromDef(classDef, memberSet);
    }

    // Register objects.
    for (var [name, obj] of this.objects)
      L.addObject(obj);

    // Collect and resolve pointers (separate pass for forward refs).
    for (var [name, obj] of this.objects)
      recursiveObjects(obj);

    // Write sections.
    var memvarBuf = Buffer.allocUnsafe(L.memvars.length * 16);
    for (var mi = 0; mi < L.memvars.length; mi++) {
      var m = L.memvars[mi]
        , mOff = mi * 16;
      memvarBuf.writeUInt32LE(m.type, mOff);
      memvarBuf.writeUInt32LE(strings.set(m.name), mOff + 4);
      memvarBuf.writeUInt32LE(m.size, mOff + 8);
      memvarBuf.writeUInt32LE(m.aux, mOff + 12);
    }

    var classBuf = Buffer.allocUnsafe(L.classes.length * 12);
    var firstMemvarAcc = 0;
    for (var ci = 0; ci < L.classes.length; ci++) {
      var cc = L.classes[ci]
        , cOff = ci * 12;
      classBuf.writeUInt32LE(strings.set(cc.name), cOff);
      classBuf.writeUInt32LE(firstMemvarAcc, cOff + 4);
      classBuf.writeUInt32LE(cc.raw.size, cOff + 8);
      firstMemvarAcc += cc.raw.size;
    }

    var stringBuf = strings.write();

    var totalObjSize = 0;
    for (var oi = 0; oi < L.objects.length; oi++) {
      var o = L.objects[oi];
      totalObjSize += 4 + Buffer.byteLength(o.getName()) + 1 + o.getSize();
    }

    var objBuf = Buffer.allocUnsafe(totalObjSize)
      , objCursor = 0;
    for (var oi = 0; oi < L.objects.length; oi++) {
      var o = L.objects[oi];
      var cIdx = L.getClassIdx(o.getDef().getName());
      if (cIdx === -1)
        throw kObjectExceptions.InvalidClassName.from(o.getDef().getName());

      objBuf.writeUInt32LE(cIdx, objCursor);
      objCursor += 4;

      var nameBuf = Buffer.from(o.getName() + "\0");
      nameBuf.copy(objBuf, objCursor);
      objCursor += nameBuf.length;

      var raw2 = L.classes[cIdx];
      var n = o.getDef().write(L, objBuf, o, objCursor, raw2);
      if (!n)
        throw kObjectExceptions.ReadObjectFailed.from();
      objCursor += n;
    }

    var headerSize = 44
      , classesOffset = headerSize
      , memvarsOffset = classesOffset + classBuf.length
      , stringsOffset = memvarsOffset + memvarBuf.length
      , objectsOffset = stringsOffset + stringBuf.length
      , fileSize = objectsOffset + objCursor;

    var header = new LoHeader();
    header.numClasses = L.classes.length;
    header.numMemVars = L.memvars.length;
    header.numObjects = L.objects.length;
    header.numRefs = L.pointers.length;
    header.classesOffset = classesOffset;
    header.memvarsOffset = memvarsOffset;
    header.stringsOffset = stringsOffset;
    header.objectsOffset = objectsOffset;
    header.fileSize = fileSize;

    var result = Buffer.allocUnsafe(fileSize);
    header.write().copy(result, 0);
    classBuf.copy(result, classesOffset);
    memvarBuf.copy(result, memvarsOffset);
    stringBuf.copy(result, stringsOffset);
    objBuf.copy(result, objectsOffset, 0, objCursor);

    return new Uint8Array(result);
  }
}

/**
 * Register a member on `def` from a binary memvar descriptor, choosing the
 * representation that matches the memvar type. `classes` is the binary class
 * table, used to resolve inline class-array element types.
 * @param {MetaTypeClass} def
 * @param {LoClass[]} classes
 * @param {string} className
 * @param {string} memName
 * @param {LoMemvar} memvar
 */
function addMemberFromMemvar(def, classes, className, memName, memvar) {
  if (memvar.type === kMemvarTypes.String)
    return def.addMember(kMetaTypes.CString, memName);
  if (memvar.type === kMemvarTypes.Ref)
    return def.addMember(kMetaTypes.Pointer, memName);
  if (memvar.type === kMemvarTypes.Array) {
    // Inline array of a known class; otherwise (ref array 0xFFFFFFFF or an
    // unresolved element type) fall back to a pointer array.
    if (memvar.aux !== 0xFFFFFFFF && memvar.aux >= 0
      && memvar.aux < classes.length && classes[memvar.aux].def)
      return def.addMember(classes[memvar.aux].def, memName, 0);
    return def.addMember(kMetaTypes.Pointer, memName, 0);
  }
  // Raw, and any unrecognized memvar type, are fixed-size byte blobs.
  return def.addMember(
    new MetaTypeRaw(className + "::" + memName, memvar.size || 4), memName);
}

/**
 * Read raw object member data using binary memvar information directly.
 * Used when no proper class definition is available (auto-created classes).
 */
function readRawMembers(L, B, off, raw, def, name) {
  var obj = new LevelValueClass(def, name)
    , cursor = off;

  for (var [memName, memvar] of raw.raw) {
    var result;
    try {
      result = readRawMember(L, B, cursor, memvar, def, memName);
    } catch (e) {
      result = void 0;
    }

    if (!result || !result.value) {
      // Best-effort skip past the declared size.
      cursor += memvar.size || 4;
      continue;
    }

    var v = result.value;
    if (memvar.type === kMemvarTypes.Ref)
      L.pointers.push(v);
    else if (memvar.type === kMemvarTypes.Array && memvar.aux === 0xFFFFFFFF)
      L.pointers.push.apply(L.pointers, v);

    obj.setValue(memName, v);
    cursor += result.size;
  }

  obj.finalize();
  return { obj: obj, size: cursor - off };
}

/**
 * Read one raw member at `off`. Returns its value and on-disk byte size.
 * @returns {{value: LevelValue|LevelValue[], size: number}}
 */
function readRawMember(L, B, off, memvar, def, memName) {
  if (memvar.type === kMemvarTypes.String) {
    var sv = kMetaTypes.CString.read(L, B, off);
    return { value: sv, size: sv.getSize() };
  }
  if (memvar.type === kMemvarTypes.Ref)
    return { value: kMetaTypes.Pointer.read(L, B, off), size: 4 };
  if (memvar.type === kMemvarTypes.Array)
    return readRawArray(L, B, off, memvar, def, memName);

  // Raw, and any unrecognized memvar type, are fixed-size byte blobs.
  var size = memvar.size || 4;
  return {
    value: new MetaTypeRaw(def.getName() + "::" + memName, size).read(L, B, off),
    size: size
  };
}

/**
 * Read an Array member: a ref array, an inline class array, or — when the
 * element type is unknown — the whole array as a raw blob.
 * @returns {{value: LevelValue|LevelValue[], size: number}}
 */
function readRawArray(L, B, off, memvar, def, memName) {
  var count = B.readUInt32LE(off)
    , elemCursor = off + 4
    , elemType = memvar.aux
    , elements;

  // Ref array: object-index pointers.
  if (elemType === 0xFFFFFFFF) {
    elements = [];
    for (var i = 0; i < count; i++) {
      elements.push(kMetaTypes.Pointer.read(L, B, elemCursor));
      elemCursor += 4;
    }
    return { value: elements, size: 4 + count * 4 };
  }

  // Inline class array: each element is a sub-object of a known class.
  if (elemType >= 0 && elemType < L.classes.length) {
    elements = [];
    var subRaw = L.classes[elemType]
      , subDef = subRaw.def;
    for (var j = 0; j < count; j++) {
      var subObj, subSize;
      if (subDef && subDef.isAutoCreated) {
        var sub = readRawMembers(L, B, elemCursor, subRaw, subDef, "");
        subObj = sub.obj;
        subSize = sub.size;
      } else {
        subObj = subDef.read(L, B, elemCursor, subRaw);
        subSize = subObj.getSize();
      }
      elements.push(subObj);
      elemCursor += subSize;
    }
    return { value: elements, size: elemCursor - off };
  }

  // Unknown element type: capture the whole array as raw bytes.
  var size = 4 + count * (memvar.size || 4);
  return {
    value: new MetaTypeRaw(def.getName() + "::" + memName, size).read(L, B, off),
    size: size
  };
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
