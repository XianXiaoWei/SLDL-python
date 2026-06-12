var { Buffer } = require("buffer");
var { kObjectExceptions } = require("./exceptions.js");
var { kMetaTypes } = require("./types.js");
var { kMetaValueType, MetaType } = require("./type/metaType.js");
var { MetaTypeClass } = require("./type/metaTypeClass.js");
var { MetaTypePointer } = require("./type/metaTypePointer.js");
var { MetaTypeRaw } = require("./type/metaTypeRaw.js");
var { LevelValueClass } = require("./value/levelValueClass.js");
var { LevelValuePointer } = require("./value/levelValuePointer.js");

// Install natively missing helpers on Buffer.
if (typeof Buffer.prototype.readStringZero !== "function") {
  Buffer.prototype.readStringZero = function (offset, encoding) {
    offset >>>= 0;
    if (offset >= this.length) return "";
    var begin = offset, end = begin;
    while (end < this.length && this[end]) end++;
    return begin < end ? this.toString(encoding, begin, end) : "";
  };
}
if (typeof Buffer.prototype.writeStringZero !== "function") {
  Buffer.prototype.writeStringZero = function (string, offset, encoding) {
    var bytes = Buffer.from(string);
    offset >>>= 0;
    this.set(bytes, offset);
  };
}

// --- Memvar Types ------------------------------------------------------------

var kMemvarTypes = Object.freeze({
  Raw: 0,
  String: 1,
  Ref: 2,
  Array: 3
});

// --- LoHeader ----------------------------------------------------------------

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
      throw new Error("invalid magic: 0x"
        + B.readUInt32LE(0).toString(16).padStart(8, "0")
        + ", expected \"TGCL\"");

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

// --- LoStringPool ------------------------------------------------------------

class LoStringPool {
  static read(B, offset) {
    return B.readStringZero(offset);
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

// --- LoMemvar ----------------------------------------------------------------

class LoMemvar {
  constructor(type, name, size, aux) {
    this.type = type;
    this.name = name;
    this.size = size;
    this.aux = aux;
  }
}

// --- LoClass -----------------------------------------------------------------

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

// --- LoIndices ---------------------------------------------------------------

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

  clear() {
    this.classes = [];
    this.memvars = [];
    this.objects = [];
    this.pointers = [];
    this.classIndices.clear();
    this.objectIndices.clear();
  }

  define(definitions) {
    this.metaTypes.clear();
    this.metaClasses.clear();
    for (var def of definitions) {
      this.metaTypes.set(def.getName(), def);
      if (def instanceof MetaTypeClass)
        this.metaClasses.set(def.getName(), def);
    }
  }

  getClassFromName(name) {
    return this.metaTypes.get(name);
  }

  getClassIdx(name) {
    var idx = this.classIndices.get(name);
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

    if (this.classIndices.has(name))
      return this.classes[this.classIndices.get(name)];

    this.classIndices.set(name, this.classes.length);

    var c = new LoClass(name);
    this.classes.push(c);

    var MetaTypeClassMemberArray = require("./type/metaTypeClass.js").MetaTypeClassMemberArray;

    for (var [memberName, member] of def.allMembers(usedMembers)) {
      if (member instanceof MetaTypeClassMemberArray
        && member.def instanceof MetaTypeClass) {
        this.addClassFromDef(member.def, void 0);
      }
    }

    var memberList = def.allMembers(usedMembers);
    for (var i = 0; i < memberList.length; i++) {
      var memberName = memberList[i][0]
        , member = memberList[i][1]
        , type, size, aux;

      if (member instanceof MetaTypeClassMemberArray) {
        type = kMemvarTypes.Array;
        if (member.def instanceof MetaTypeClass) {
          size = 0;
          aux = this.classIndices.get(member.def.getName());
        } else if (member.valueType() == kMetaValueType.Pointer) {
          size = member.getSize ? member.getSize() : 4;
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
    return c;
  }
}

// --- LevelObjects ------------------------------------------------------------

class LevelObjects {
  /**
   * @param {MetaType[]} definitions - MetaType definitions (from
   *   ItaniumResolver or DeclarationGroup).
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
   * @param {Buffer} buffer
   * @returns {Map<string, LevelValueClass>}
   */
  readBinary(buffer) {
    var header = new LoHeader().read(buffer);
    var L = this.indices;

    L.clear();
    L.define(Array.from(L.metaTypes.values()));

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

      if (!def) {
        // Auto-create unknown class.
        def = new MetaTypeClass(c.name, kMetaTypes.Object);
        def.isAutoCreated = true;

        for (var [memName, memvar] of c.raw) {
          if (memvar.type === kMemvarTypes.Raw)
            def.addMember(new MetaTypeRaw(c.name + "::" + memName, memvar.size || 4), memName);
          else if (memvar.type === kMemvarTypes.String)
            def.addMember(kMetaTypes.CString, memName);
          else if (memvar.type === kMemvarTypes.Ref)
            def.addMember(kMetaTypes.Pointer, memName);
          else if (memvar.type === kMemvarTypes.Array) {
            if (memvar.aux === 0xFFFFFFFF)
              def.addMember(kMetaTypes.Pointer, memName, 0);
            else if (memvar.aux >= 0 && memvar.aux < L.classes.length
              && L.classes[memvar.aux].def) {
              var elemDef = L.classes[memvar.aux].def;
              def.addMember(elemDef, memName, 0);
            } else
              def.addMember(kMetaTypes.Pointer, memName, 0);
          } else
            def.addMember(new MetaTypeRaw(c.name + "::" + memName, memvar.size || 4), memName);
        }

        L.metaClasses.set(c.name, def);
        L.metaTypes.set(c.name, def);
      } else {
        // Check for unknown members.
        for (var [memName, memvar] of c.raw) {
          if (!def.getMember(memName)) {
            if (memvar.type === kMemvarTypes.Raw)
              def.addMember(new MetaTypeRaw(c.name + "::" + memName, memvar.size || 4), memName);
            else if (memvar.type === kMemvarTypes.String)
              def.addMember(kMetaTypes.CString, memName);
            else if (memvar.type === kMemvarTypes.Ref)
              def.addMember(kMetaTypes.Pointer, memName);
            else if (memvar.type === kMemvarTypes.Array) {
              if (memvar.aux === 0xFFFFFFFF)
                def.addMember(kMetaTypes.Pointer, memName, 0);
              else if (memvar.aux >= 0 && memvar.aux < L.classes.length
                && L.classes[memvar.aux].def) {
                var elemDef2 = L.classes[memvar.aux].def;
                def.addMember(elemDef2, memName, 0);
              } else
                def.addMember(kMetaTypes.Pointer, memName, 0);
            } else
              def.addMember(new MetaTypeRaw(c.name + "::" + memName, 4), memName);
          }
        }
      }

      c.setDef(def);
    }

    // Read objects.
    var cursor = header.objectsOffset;
    for (var k = 0; k < header.numObjects && cursor < header.fileSize; k++) {
      var classIdx = buffer.readUInt32LE(cursor)
        , name = buffer.readStringZero(cursor + 4);
      if (classIdx >= L.classes.length || classIdx < 0)
        throw kObjectExceptions.InvalidClassIndex.from(classIdx);

      cursor += 4 + Buffer.from(name).length + 1;

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
    L.clear();
    var defs = [];
    for (var [dname, d] of L.metaTypes)
      defs.push(d);
    L.define(defs);

    return this.objects;
  }

  /**
   * Serialize stored objects to a TGCL binary buffer.
   * @param {Set<string>} [usedMembers] - per-class member usage for pruning.
   * @returns {Buffer}
   */
  writeBinary(usedMembers) {
    var L = this.indices;
    var strings = new LoStringPool();

    var um = usedMembers || this.usedMembers;

    // Register classes with pruning.
    for (var [className, classDef] of L.metaClasses) {
      var memberSet = um.get(className);
      L.addClassFromDef(classDef, memberSet);
    }

    // Register objects.
    for (var [name, obj] of this.objects)
      L.addObject(obj);

    // Collect and resolve pointers (separate pass for forward refs).
    for (var [name, obj] of this.objects) {
      for (var [mname, mval] of obj.value) {
        var memb = obj.getDef().getMember(mname);
        if (!memb || memb.valueType() !== kMetaValueType.Pointer)
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
      totalObjSize += 4 + Buffer.from(o.getName()).length + 1 + o.getSize();
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

      var um2 = um.get(o.getDef().getName());
      var n = o.getDef().write(L, objBuf, o, objCursor, um2);
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
    header.initialize();
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

    return result;
  }
}

/**
 * Read raw object member data using binary memvar information directly.
 * Used when no proper class definition is available (auto-created classes).
 */
function readRawMembers(L, B, off, raw, def, name) {
  var obj = new LevelValueClass(def, name)
    , cursor = off;

  for (var [memName, memvar] of raw.raw) {
    var v, size;

    if (memvar.type === kMemvarTypes.Raw) {
      size = memvar.size || 4;
      var rawType = new MetaTypeRaw(def.getName() + "::" + memName, size);
      v = rawType.read(L, B, cursor);
    } else if (memvar.type === kMemvarTypes.String) {
      v = kMetaTypes.CString.read(L, B, cursor);
      size = v.getSize();
    } else if (memvar.type === kMemvarTypes.Ref) {
      v = kMetaTypes.Pointer.read(L, B, cursor);
      size = 4;
    } else if (memvar.type === kMemvarTypes.Array) {
      var count = B.readUInt32LE(cursor);
      var elemCursor = cursor + 4;
      var elemType = memvar.aux;

      if (elemType === 0xFFFFFFFF) {
        var elements = [];
        for (var ei = 0; ei < count; ei++) {
          var p = kMetaTypes.Pointer.read(L, B, elemCursor);
          elements.push(p);
          elemCursor += 4;
        }
        size = 4 + count * 4;
        v = elements;
      } else if (elemType >= 0 && elemType < L.classes.length) {
        var elements = [];
        var subRaw = L.classes[elemType];
        var subDef = subRaw.def;
        for (var ei = 0; ei < count; ei++) {
          var subResult;
          if (subDef && subDef.isAutoCreated) {
            subResult = readRawMembers(L, B, elemCursor, subRaw, subDef, "");
          } else {
            var subObj = subDef.read(L, B, elemCursor, subRaw);
            subResult = { obj: subObj, size: subObj.getSize() };
          }
          elements.push(subResult.obj);
          elemCursor += subResult.size;
        }
        size = elemCursor - cursor;
        v = elements;
      } else {
        var elemSize = memvar.size || 4;
        size = 4 + count * elemSize;
        var rawArrType = new MetaTypeRaw(def.getName() + "::" + memName, size);
        v = rawArrType.read(L, B, cursor);
      }
    } else {
      size = memvar.size || 4;
      var rawType2 = new MetaTypeRaw(def.getName() + "::" + memName, size);
      v = rawType2.read(L, B, cursor);
    }

    if (!v)
      throw kObjectExceptions.ReadObjectFailed.from();

    if (memvar.type === kMemvarTypes.Ref)
      L.pointers.push(v);
    else if (memvar.type === kMemvarTypes.Array && memvar.aux === 0xFFFFFFFF)
      L.pointers.push.apply(L.pointers, v);

    obj.setValue(memName, v);
    cursor += size;
  }

  obj.finalize();
  return { obj: obj, size: cursor - off };
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
