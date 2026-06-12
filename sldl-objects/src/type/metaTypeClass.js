var { Buffer } = require("buffer");
var { LevelValueClass } = require("../value/levelValueClass.js");
var { MetaType, kMetaValueType, MetaTypeForward } = require("./metaType.js");
var { kObjectExceptions } = require("../exceptions.js");
var { MetaTypePointer } = require("./metaTypePointer.js");

class MetaTypeClassMember extends MetaTypeForward {
  constructor(def, name) {
    super(def, name);
  }
}

class MetaTypeClassMemberArray extends MetaTypeClassMember {
  /**
   * @param {MetaType} def
   * @param {string} name
   * @param {number} [count] - 0 = dynamic, >0 = fixed max count.
   */
  constructor(def, name, count) {
    super(def, name);
    this.maxCount = count || 0;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @param {LoClass} raw
   * @returns {LevelValue[]|undefined}
   */
  read(L, B, off, raw) {
    var count = B.readUInt32LE(off)
      , cursor = off + 4;

    if (this.maxCount && count > this.maxCount)
      return void 0;

    var r = [];
    for (var i = 0; i < count; i++) {
      var v = this.def.read(L, B, cursor, raw);
      r.push(v);
      cursor += v.getSize();
    }

    return r;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {LevelValue[]} val
   * @param {number} off
   * @returns {number}
   */
  write(L, B, val, off) {
    if (this.maxCount && val.length > this.maxCount)
      return 0;

    B.writeUInt32LE(val.length, off);

    var cursor = off + 4;
    for (var v of val) {
      var n = this.def.write(L, B, v, cursor);
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

    this.parent = typeof parent === "undefined"
      ? require("../types.js").kMetaTypes.Object
      : parent;
    /** @type {Map<string, MetaTypeClassMember>} */
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
    if (this.getMember(name))
      return false;

    var member;
    // If def is already a ClassMember (pre-wrapped by declGroup parser), use it.
    if (def instanceof MetaTypeClassMember || def instanceof MetaTypeClassMemberArray) {
      member = def;
    } else if (typeof count === "number") {
      member = new MetaTypeClassMemberArray(def, this.name + "::" + name, count);
    } else {
      member = new MetaTypeClassMember(def, this.name + "::" + name);
    }

    this.members.set(name, member);
    return true;
  }

  /**
   * @param {string} name
   * @returns {MetaTypeClassMemberArray|MetaTypeClassMember|undefined}
   */
  getMember(name) {
    var p = this;
    while (p) {
      var m = p.members.get(name);
      if (m)
        return m;
      p = p.parent;
    }
    return void 0;
  }

  /**
   * Get all members across the inheritance chain.
   * @param {Set<string>} [usedMembers] - if provided, only return members
   *   whose names are in this set (member pruning).
   * @returns {Array<[string, MetaTypeClassMember]>}
   */
  allMembers(usedMembers) {
    var r = []
      , seen = new Set();
    for (var p = this; p; p = p.parent) {
      for (var [memberName, member] of p.members) {
        if (seen.has(memberName))
          continue;
        if (usedMembers && !usedMembers.has(memberName))
          continue;
        seen.add(memberName);
        r.push([memberName, member]);
      }
    }
    return r;
  }

  /**
   * Read object member values from the binary buffer.
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @param {LoClass} [raw]
   * @returns {LevelValueClass|null|undefined}
   */
  read(L, B, off, raw) {
    var r = new LevelValueClass(this, "")
      , cursor = off
      , memberNames = raw
        ? Array.from(raw.raw.keys())
        : this.allMembers().map(function (e) { return e[0]; });

    for (var i = 0; i < memberNames.length; i++) {
      var memberName = memberNames[i]
        , m = this.getMember(memberName)
        , v;

      if (m) {
        // Known member - read with its type.
        v = m.read(L, B, cursor,
          m.def instanceof MetaTypeClass
            ? L.classes[L.getClassIdx(m.def.getName())]
            : void 0);
      } else {
        // Unknown member - read as raw. The caller has already added a
        // raw-type member to the definition if needed.
        var rawMemvar = raw ? raw.raw.get(memberName) : void 0;
        if (rawMemvar) {
          if (rawMemvar.type === 1 /* string */) {
            v = require("../types.js").kMetaTypes.CString.read(L, B, cursor);
          } else if (rawMemvar.type === 2 /* ref */) {
            v = require("../types.js").kMetaTypes.Pointer.read(L, B, cursor);
          } else {
            // raw or array - read raw bytes.
            var size = rawMemvar.size || 4;
            var MetaTypeRaw = require("./metaTypeRaw.js").MetaTypeRaw;
            v = new MetaTypeRaw("raw", size).read(L, B, cursor);
          }
        } else {
          // Fallback: skip 4 bytes.
          var MetaTypeRaw2 = require("./metaTypeRaw.js").MetaTypeRaw;
          v = new MetaTypeRaw2("raw", 4).read(L, B, cursor);
        }
      }

      if (!v)
        return void 0;

      if (m && m.valueType() == kMetaValueType.Pointer) {
        Array.isArray(v)
          ? L.pointers.push.apply(L.pointers, v)
          : L.pointers.push(v);
      }

      r.setValue(memberName, v);
      cursor += Array.isArray(v)
        ? v.reduce(function (sum, val) { return sum + val.getSize(); }, 4)
        : v.getSize();
    }

    r.finalize();
    return r;
  }

  /**
   * Write object member values into the binary buffer.
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {LevelValueClass} val
   * @param {number} off
   * @param {Set<string>} [usedMembers] - only write members in this set.
   * @returns {number} Number of bytes written, or 0 on failure.
   */
  write(L, B, val, off, usedMembers) {
    var cursor = off
      , members = this.allMembers(usedMembers);

    for (var i = 0; i < members.length; i++) {
      var memberName = members[i][0]
        , m = members[i][1]
        , v = val.getValue(memberName);

      if (!v) {
        // Fill with default.
        v = MetaTypeClass.memberTypeDefault(m);
      }

      var n = m.write(L, B, v, cursor);
      if (!n) {
        // Fallback: write value as raw bytes if the member def mismatch.
        if (Buffer.isBuffer(v.getValue ? v.getValue() : void 0)) {
          var buf = v.getValue();
          var len = Math.min(buf.length, m.getSize());
          buf.copy(B, cursor, 0, len);
          n = m.getSize();
        } else if (v && v.def && v.def.write && v.def !== m.def) {
          n = v.def.write(L, B, v, cursor);
        }
      }
      if (!n)
        return 0;
      cursor += n;
    }

    return cursor - off;
  }

  /**
   * Create a default LevelValue for a member type.
   * @param {MetaTypeClassMember} member
   * @returns {LevelValue|LevelValue[]}
   */
  static memberTypeDefault(member) {
    var vt = member.valueType();
    var def = member.def;

    if (member instanceof MetaTypeClassMemberArray) {
      return [];
    }

    if (vt === kMetaValueType.Pointer) {
      var p = new (require("../value/levelValuePointer.js").LevelValuePointer)();
      p.setIndex(0xFFFFFFFF);
      return p;
    }

    if (vt === kMetaValueType.String) {
      var s = new (require("../value/levelValueString.js").LevelValueString)(def);
      s.setValue("");
      return s;
    }

    if (vt === kMetaValueType.Number) {
      var n = new (require("../value/levelValueNumber.js").LevelValueNumber)(def);
      n.setValue(0);
      return n;
    }

    if (vt === kMetaValueType.Raw) {
      var r = new (require("../value/levelValueRaw.js").LevelValueRaw)(def);
      r.setValue(Buffer.alloc(def.getSize()));
      return r;
    }

    if (vt === kMetaValueType.Struct) {
      var st = new (require("../value/levelValueStruct.js").LevelValueStruct)(def);
      for (var [name, sm] of def.members) {
        var sv = MetaTypeClass.memberTypeDefault(sm);
        if (Array.isArray(sv)) {
          st.setValue(name, sv);
        } else {
          st.setValue(name, sv);
        }
      }
      return st;
    }

    // Fallback - return zero-valued number.
    var fallback = new (require("../value/levelValueNumber.js").LevelValueNumber)(def);
    fallback.setValue(0);
    return fallback;
  }
}

module.exports = {
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass
};
