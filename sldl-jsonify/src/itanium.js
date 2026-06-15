const { kMetaTypes, kMetaValueType, MetaTypeStruct, MetaTypeClass, MetaTypePointer } = require("sldl-objects");
const { kItaniumException } = require("./exception.js");

/**
 * Add a resolved member to a class, validating pointer targets and
 * wrapping pointer references in a typed MetaTypePointer.
 * @param {MetaTypeClass} clazz
 * @param {MetaType} type - the resolved base type
 * @param {string} name - member name
 * @param {number} count - -1 = scalar, 0 = dynamic array, >0 = fixed array
 * @param {boolean} isPointer
 */
function addResolvedMember(clazz, type, name, count, isPointer) {
  var base = type;

  if (isPointer) {
    // Only class types may be pointed to.
    if (type.valueType() !== kMetaValueType.Class)
      throw kItaniumException.InvalidPointer.from(type.getName());
    base = new MetaTypePointer(type.getName() + " *", type);
  }

  clazz.addMember(base, name, count === -1 ? void 0 : count);
}

class StringReader {
  constructor(s) {
    this.string = s;
    this.arr = Array.from(s);
    this.cursor = 0;
  }

  get pos() {
    return this.cursor;
  }

  get ch() {
    return this.arr[this.cursor];
  }

  read() {
    return this.arr[this.cursor++];
  }

  done() {
    return this.cursor >= this.arr.length;
  }

  isNumber() {
    return /\d/.test(this.ch);
  }

  skipSeparator() {
    while (this.ch == '_')
      this.read();
  }

  readInteger() {
    if (!this.isNumber())
      return void 0;

    var r = 0;
    while (this.isNumber()) {
      r *= 10;
      r += Number(this.read());
    }

    return r;
  }

  readString(length) {
    var r = "";
    while (length) {
      r += this.read();
      length--;
    }
    return r;
  }
}

const kItaniumTypes = Object.freeze({
  b: kMetaTypes.Bool,
  c: kMetaTypes.Int8,
  h: kMetaTypes.Uint8,
  s: kMetaTypes.Int16,
  t: kMetaTypes.Uint16,
  i: kMetaTypes.Int32,
  j: kMetaTypes.Uint32,
  x: kMetaTypes.Int64,
  y: kMetaTypes.Uint64,
  f: kMetaTypes.Float,
  d: kMetaTypes.Double,
  g: kMetaTypes.TgcString
});

class ItaniumResolver {
  static resolve(s) {
    var r = new ItaniumResolver(s);
    r.resolve();
    if (r.pending.size)
      return void 0;
    return [...r.names.values()].filter(c => {
      return c.valueType() == kMetaValueType.Class
        || c.valueType() == kMetaValueType.Struct
    });
  };

  constructor(s) {
    this.reader = new StringReader(s);
    /** @type {Map<string, {clazz:MetaTypeClass,name:string,count:number,isPointer:boolean}>} */
    this.pending = new Map();
    /** @type {Map<string, MetaType>} */
    this.names = new Map();

    // Pre-register built-in class types.
    this.names.set("Object", kMetaTypes.Object);
    this.names.set("Clump", kMetaTypes.Clump);
  }

  err() {
    throw kItaniumException.Unexpected.from(this.reader.ch, this.reader.cursor);
  }

  /**
   * @param {string} type 
   * @param {MetaTypeClass} clazz 
   * @param {string} name 
   * @param {number} count 
   * @param {boolean} isPointer 
   */
  record(type, clazz, name, count, isPointer) {
    this.pending.has(type) || this.pending.set(type, []);
    this.pending.get(type).push({ clazz, name, count, isPointer });
  }

  /**
   * @param {MetaType} type 
   * @param {string} name 
   */
  backpatch(type, name) {
    var typename = name || type.getName()
      , refs = this.pending.get(typename);
    refs && refs.forEach(function (t) {
      addResolvedMember(t.clazz, type, t.name, t.count, t.isPointer);
    });
    this.pending.delete(typename);
  }

  resolve() {
    while (!this.reader.done()) {
      var seg;
      if (this.reader.ch === 'U') {
        // Parse struct declaration.
        this.reader.read();
        seg = this.resolveStruct();
      } else if (this.reader.ch === 'C') {
        // Parse class declaration.
        this.reader.read();
        seg = this.resolveClass();
      } else if (this.reader.ch === 'D') {
        this.reader.read();
        this.resolveAlias();
        continue;
      } else
        this.err();

      if (this.reader.read() !== 'E')
        // Parse end mark.
        this.err();

      if (this.names.has(seg.getName())) {
        // Merge members into existing type (e.g., adding to built-in Clump).
        var existing = this.names.get(seg.getName());
        if (existing instanceof MetaTypeClass && seg instanceof MetaTypeClass) {
          for (var [mname, m] of seg.members)
            if (!existing.getMember(mname))
              existing.addMember(m.def, mname,
                m.maxCount !== void 0 ? m.maxCount : void 0);
          this.backpatch(existing);
        } else {
          throw new Error("duplicated declaration: " + seg.getName());
        }
      } else {
        this.names.set(seg.getName(), seg);
        this.backpatch(seg);
      }
    }
  }

  resolveAlias() {
    var name = this.lengthString()
      , typeId = this.reader.read()
      , type = kItaniumTypes[typeId];

    if (!type)
      this.err();

    this.names.set(name, type);
    this.backpatch(type, name);
  }

  resolveClass() {
    var name = this.lengthString()
      , align = 0;

    if (this.reader.read() !== 'T')
      // Parse member list start mark.
      this.err();

    var parent = void 0;
    if (this.reader.ch === 'F') {
      // Parse parent class name.
      this.reader.read();
      var parentName = this.lengthString();
      if (!this.names.has(parentName))
        throw kItaniumException.UnrecognizedType.from(parentName);
      parent = this.names.get(parentName);
    }

    var result = new MetaTypeClass(name, parent);
    while (!this.reader.done() && this.reader.ch !== 'E')
      // Parse member list.
      this.resolveClassMember(result);

    // Parse end mark.
    if (this.reader.read() !== 'E')
      this.err();

    return result;
  }

  resolveClassMember(clazz) {
    var name = this.lengthString()
      , count = -1
      , isPointer = false
      , type = null;

    if (this.reader.ch === 'A') {
      this.reader.read();
      // Parse array type.
      if (!this.reader.isNumber())
        count = 0;
      else
        count = this.reader.readInteger();
      this.reader.skipSeparator();
    }

    if (this.reader.ch === 'P') {
      isPointer = true;
      this.reader.read();
    }

    var typeId;
    if (this.reader.isNumber()) {
      // Parse struct type.
      typeId = this.lengthString();
      if (!this.names.has(typeId))
        this.record(typeId, clazz, name, count, isPointer);
      else
        type = this.names.get(typeId);
    } else {
      // Parse primitive type.
      typeId = this.reader.read();
      type = kItaniumTypes[typeId];
      if (!type)
        this.err();
    }

    if (type) {
      // Skip members that still need backpatching.
      addResolvedMember(clazz, type, name, count, isPointer);
    }
  }

  resolveStruct() {
    var name = this.lengthString()
      , align = 0;

    if (this.reader.ch === 'L') {
      // Parse alignment.
      this.reader.read();
      align = this.reader.readInteger();
      if (!align)
        this.err();
    } else if (this.reader.ch !== 'T')
      // Parse member list start mark.
      this.err();

    var result = new MetaTypeStruct(name);
    this.reader.read();

    while (!this.reader.done() && this.reader.ch !== 'E')
      // Parse member list.
      this.resolveStructMember(result);

    if (this.reader.done())
      this.err();

    if (align && !result.finalize(align))
      throw kItaniumException.InvalidAlign.from(align);

    // Parse end mark.
    if (this.reader.read() !== 'E')
      this.err();

    return result;
  }

  /**
   * @param {MetaTypeStruct} struct 
   */
  resolveStructMember(struct) {
    var name = this.lengthString()
      , count = 0
      , type;

    if (this.reader.ch === 'A') {
      this.reader.read();
      // Parse array type.
      if (!this.reader.isNumber())
        this.err();

      count = this.reader.readInteger();
      this.reader.skipSeparator();
    }

    var typeId;
    if (this.reader.isNumber()) {
      // Parse struct type.
      typeId = this.lengthString();
      if (!this.names.has(typeId))
        throw kItaniumException.UnrecognizedType.from(typeId);
      type = this.names.get(typeId);
    } else {
      // Parse primitive type.
      typeId = this.reader.read();
      type = kItaniumTypes[typeId];
      if (!type)
        this.err();
    }

    struct.addMember(type, name, count);
  }

  /** @returns {string} */
  lengthString() {
    var l = this.reader.readInteger();
    if (!l)
      this.err();

    var s = this.reader.readString(l);
    if (s === "")
      this.err();

    return s;
  }

  /**
   * Resolve and produce a JSON-compatible declaration group object
   * that can be passed to DeclarationGroup or directly to LevelObjects.
   * @returns {Object|undefined} Plain object with C$/S$/A$ keys, or
   *   undefined if there are unresolved forward references.
   */
  resolveToDeclGroup() {
    this.resolve();
    if (this.pending.size)
      return void 0;

    var result = {};

    for (var [name, type] of this.names) {
      if (type instanceof MetaTypeClass) {
        var classObj = {};
        if (type.parent && type.parent.getName() !== "Object")
          classObj.$parent = type.parent.getName();

        for (var [memberName, member] of type.members) {
          classObj[memberName] = itaniumMemberToString(member);
        }

        result["C$" + name] = classObj;
      } else if (type instanceof MetaTypeStruct) {
        var structObj = {};
        for (var [memberName, member] of type.members)
          structObj[memberName] = itaniumMemberToString(member);

        result["S$" + name] = structObj;
      } else {
        // Alias (MetaTypeForward or primitive alias).
        result["A$" + name] = type.getName();
      }
    }

    return result;
  }
}

/**
 * Convert a MetaTypeClassMember to its string representation.
 */
function itaniumMemberToString(member) {
  var { MetaTypeClassMemberArray, kMetaValueType } = require("sldl-objects");
  var typeName = member.def.getName();

  if (member instanceof MetaTypeClassMemberArray) {
    var suffix = member.maxCount
      ? "[" + member.maxCount + "]"
      : "[]";

    if (member.valueType() === kMetaValueType.Pointer)
      return typeName + " *" + suffix;
    return typeName + " " + suffix;
  }

  if (member.valueType() === kMetaValueType.Pointer)
    return "Object *";

  return typeName;
}

module.exports = {
  ItaniumResolver,
  kItaniumTypes
};
