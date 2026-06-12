var { Buffer } = require("buffer");
var { LevelValueString, LevelValueNumber, LevelValueBool, LevelValuePointer,
  LevelValueRaw, LevelValueStruct, LevelValueClass } = require("sldl-objects");
var { kMetaValueType, MetaTypeClassMember, MetaTypeClassMemberArray } = require("sldl-objects");
var { kItaniumException } = require("./exception.js");

/**
 * Convert a JSON value to a LevelValue based on the member definition.
 * @param {any} jsonValue
 * @param {MetaTypeClassMember} member
 * @param {import("./declGroup.js").DeclarationGroup} declGroup
 * @returns {LevelValue|LevelValue[]}
 */
function parse(jsonValue, member, declGroup) {
  // Arrays.
  if (member instanceof MetaTypeClassMemberArray) {
    if (!Array.isArray(jsonValue))
      jsonValue = jsonValue === void 0 || jsonValue === null ? [] : [jsonValue];

    var elemDef = member.def;
    var result = [];
    for (var i = 0; i < jsonValue.length; i++) {
      result.push(parse(jsonValue[i],
        new MetaTypeClassMember(elemDef, member.name), declGroup));
    }
    return result;
  }

  // Pointers (P$ references).
  if (member.valueType() === kMetaValueType.Pointer) {
    var ptr = new LevelValuePointer();

    if (jsonValue === null || jsonValue === void 0) {
      ptr.setIndex(0xFFFFFFFF);
      ptr.targetName = null;
    } else if (typeof jsonValue === "string" && jsonValue.startsWith("P$")) {
      ptr.targetName = jsonValue.slice(2);
      ptr.setIndex(0xFFFFFFFF);
    } else if (typeof jsonValue === "number") {
      ptr.setIndex(jsonValue >>> 0);
      ptr.targetName = null;
    } else {
      throw kItaniumException.InvalidValueFormat.from(String(jsonValue),
        member.def.getName());
    }

    return ptr;
  }

  // Strings.
  if (member.valueType() === kMetaValueType.String) {
    var s = new LevelValueString(member.def);
    s.setValue(typeof jsonValue === "string" ? jsonValue
      : jsonValue === null || jsonValue === void 0 ? ""
      : String(jsonValue));
    return s;
  }

  // Raw (B$ prefix only).
  if (member.valueType() === kMetaValueType.Raw)
    return parseRaw(jsonValue, member.def);

  // Numbers.
  if (member.valueType() === kMetaValueType.Number)
    return parseNumber(jsonValue, member.def, declGroup);

  // Structs.
  if (member.valueType() === kMetaValueType.Struct) {
    var st = new LevelValueStruct(member.def);
    if (jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)) {
      for (var [smName, smDef] of member.def.members) {
        var sv = parse(jsonValue[smName], smDef, declGroup);
        st.setValue(smName, sv);
      }
    }
    return st;
  }

  // Inline class.
  if (member.valueType() === kMetaValueType.Class)
    return parseClass(jsonValue, member.def, declGroup);

  throw kItaniumException.InvalidValueFormat.from(String(jsonValue),
    member.def.getName());
}

/**
 * Parse a number value with B$/K$ prefix support.
 */
function parseNumber(jsonValue, def, declGroup) {
  var size = def.getSize();
  var isBool = def.getName() === "bool";

  if (isBool) {
    var b = new LevelValueBool(def);
    b.setValue(!!jsonValue);
    return b;
  }

  var num;
  if (typeof jsonValue === "number" || typeof jsonValue === "bigint") {
    num = jsonValue;
  } else if (typeof jsonValue === "string") {
    var s = jsonValue.trim();

    // B$ prefix - hex binary, big-endian value representation.
    if (s.startsWith("B$")) {
      var hex = s.slice(2);
      var buf = Buffer.from(hex, "hex");
      buf = rightAlign(buf, size);
      num = readIntFromBufferBE(buf, size);
    }
    // K$ prefix - enum constant.
    else if (s.startsWith("K$")) {
      var constName = s.slice(2);
      if (!declGroup.enumConstants.has(constName))
        throw kItaniumException.UnresolvedEnumConstant.from(constName);
      num = declGroup.enumConstants.get(constName);
    }
    // Plain numeric string.
    else {
      if (size <= 4)
        num = parseInt(s, 10);
      else
        num = BigInt(s);
      if (isNaN(num))
        num = size <= 4 ? 0 : 0n;
    }
  } else {
    num = 0;
  }

  var r = new LevelValueNumber(def);
  r.setValue(num);
  return r;
}

/**
 * Parse a raw value - only B$ prefix and plain hex are supported.
 */
function parseRaw(jsonValue, def) {
  var targetSize = def.getSize();
  var r = new LevelValueRaw(def);

  if (Buffer.isBuffer(jsonValue)) {
    r.setValue(rightAlign(jsonValue, targetSize));
    return r;
  }

  if (typeof jsonValue !== "string") {
    r.setValue(Buffer.alloc(targetSize));
    return r;
  }

  var s = jsonValue.trim();

  // B$ prefix.
  if (s.startsWith("B$")) {
    var hex = s.slice(2);
    var buf = Buffer.from(hex, "hex");
    r.setValue(rightAlign(buf, targetSize));
    return r;
  }

  // Plain hex string.
  var buf2 = Buffer.from(s, "hex");
  r.setValue(rightAlign(buf2, targetSize));
  return r;
}

/**
 * Parse a JSON object into a LevelValueClass (for inline class members).
 */
function parseClass(jsonValue, classDef, declGroup) {
  var lvc = new LevelValueClass(classDef, "");

  if (jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)) {
    for (var [memberName, member] of classDef.allMembers()) {
      var val = jsonValue[memberName];
      if (val !== void 0) {
        var lv = parse(val, member, declGroup);
        lvc.setValue(memberName, lv);
      }
    }
  }

  lvc.finalize();
  return lvc;
}

/**
 * Right-align a buffer to targetSize bytes.
 * Pads with zeros on the LEFT (MSB), truncates from the LEFT.
 */
function rightAlign(buf, targetSize) {
  if (buf.length === targetSize)
    return buf;
  if (buf.length < targetSize) {
    var padding = Buffer.alloc(targetSize - buf.length);
    return Buffer.concat([padding, buf]);
  }
  return buf.subarray(buf.length - targetSize);
}

function readIntFromBuffer(buf, size) {
  switch (size) {
    case 1: return buf.readUInt8(0);
    case 2: return buf.readUInt16LE(0);
    case 4: return buf.readInt32LE(0);
    case 8: return buf.readBigInt64LE(0);
    default: return buf.readUInt32LE(0);
  }
}

function readIntFromBufferBE(buf, size) {
  switch (size) {
    case 1: return buf.readUInt8(0);
    case 2: return buf.readUInt16BE(0);
    case 4: return buf.readInt32BE(0);
    case 8: return buf.readBigInt64BE(0);
    default: return buf.readUInt32BE(0);
  }
}

/**
 * Convert a LevelValue to a plain JSON value.
 */
function serialize(val, declGroup) {
  if (Array.isArray(val)) {
    var arr = [];
    for (var i = 0; i < val.length; i++)
      arr.push(serialize(val[i], declGroup));
    return arr;
  }

  var vt = val.valueType();

  if (vt === kMetaValueType.Pointer) {
    var target = val.getValue();
    if (target === null || target === void 0)
      return null;
    if (target && typeof target.getName === "function")
      return "P$" + target.getName();
    return "P$" + String(target);
  }

  if (vt === kMetaValueType.Raw) {
    var buf = val.getValue();
    return "B$" + buf.toString("hex");
  }

  if (vt === kMetaValueType.Struct) {
    var structResult = {};
    for (var [mk, mv] of val.value)
      structResult[mk] = serialize(mv, declGroup);
    return structResult;
  }

  if (vt === kMetaValueType.Class)
    return serializeClass(val, declGroup);

  return val.getValue();
}

function serializeClass(lvc, declGroup) {
  var result = { $type: lvc.getDef().getName() };
  for (var [key, val] of lvc.value)
    result[key] = serialize(val, declGroup);
  return result;
}

module.exports = {
  parse,
  parseRaw,
  parseNumber,
  parseClass,
  serialize,
  serializeClass,
  rightAlign,
  readIntFromBuffer,
  readIntFromBufferBE,
};
