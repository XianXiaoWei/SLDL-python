var { Buffer } = require("buffer");
var { MetaTypeClass } = require("./type/metaTypeClass.js");
var { MetaTypeBool, MetaTypeNumber } = require("./type/metaTypeNumber.js");
var { MetaTypePointer } = require("./type/metaTypePointer.js");
var { MetaTypeString } = require("./type/metaTypeString.js");

var kMetaTypes = {
  // Boolean.
  Bool: new MetaTypeBool("bool"),

  // Integer.
  Int8: new MetaTypeNumber("int8_t", 1, Buffer.prototype.readInt8, Buffer.prototype.writeInt8),
  Uint8: new MetaTypeNumber("uint8_t", 1, Buffer.prototype.readUint8, Buffer.prototype.writeUint8),
  Int16: new MetaTypeNumber("int16_t", 2, Buffer.prototype.readInt16LE, Buffer.prototype.writeInt16LE),
  Uint16: new MetaTypeNumber("uint16_t", 2, Buffer.prototype.readUInt16LE, Buffer.prototype.writeUInt16LE),
  Int32: new MetaTypeNumber("int32_t", 4, Buffer.prototype.readInt32LE, Buffer.prototype.writeInt32LE),
  Uint32: new MetaTypeNumber("uint32_t", 4, Buffer.prototype.readUInt32LE, Buffer.prototype.writeUInt32LE),
  Int64: new MetaTypeNumber("int64_t", 8, Buffer.prototype.readBigInt64LE, Buffer.prototype.writeBigInt64LE),
  Uint64: new MetaTypeNumber("uint64_t", 8, Buffer.prototype.readBigUInt64LE, Buffer.prototype.writeBigUInt64LE),

  // Float.
  Float: new MetaTypeNumber("float", 4, Buffer.prototype.readFloatLE, Buffer.prototype.writeFloatLE),
  Double: new MetaTypeNumber("double", 8, Buffer.prototype.readDoubleLE, Buffer.prototype.writeDoubleLE),

  // String.
  CString: new MetaTypeString("cstring"),
  TgcString: new MetaTypeString("TgcString"),

  // Pointer.
  Pointer: new MetaTypePointer("pointer"),

  // Object - base of all classes.
  Object: new MetaTypeClass("Object", null),
};

// Clump extends Object with a generic data member.
// The Clump class itself (without generic) defaults to data: Object*[].
kMetaTypes.Clump = new MetaTypeClass("Clump", kMetaTypes.Object);
kMetaTypes.Clump.addMember(kMetaTypes.Pointer, "data", 0);

/**
 * Map from generic name string to MetaTypeClass.
 * e.g. "Clump<Actor>" -> MetaTypeClass
 * @type {Map<string, MetaTypeClass>}
 */
var clumpGenericCache = new Map();

/**
 * Get or create a Clump<T> MetaTypeClass.
 * @param {string} typeName - The type parameter name (e.g. "Actor").
 * @returns {MetaTypeClass}
 */
function getClumpGeneric(typeName) {
  var key = "Clump<" + typeName + ">";
  var cached = clumpGenericCache.get(key);
  if (cached)
    return cached;

  var clump = new MetaTypeClass(key, kMetaTypes.Clump);
  clumpGenericCache.set(key, clump);
  // Member resolution is deferred - the target type must be resolved later
  // via declGroup when all types are known.
  return clump;
}

module.exports = {
  kMetaTypes,
  getClumpGeneric,
  clumpGenericCache
};
