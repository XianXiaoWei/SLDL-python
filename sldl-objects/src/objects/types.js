const { Buffer } = require("sldl-utils");
const { MetaTypeClass } = require("./type/metaTypeClass.js");
const { MetaTypeBool, MetaTypeNumber } = require("./type/metaTypeNumber.js");
const { MetaTypePointer } = require("./type/metaTypePointer.js");

const kMetaTypes = {
  // Boolean.
  Bool: new MetaTypeBool("bool"),

  // Integer.
  Int8: new MetaTypeNumber("int8_t", 1, Buffer.prototype.readInt8, Buffer.prototype.writeInt8),
  Uint8: new MetaTypeNumber("uint8_t", 1, Buffer.prototype.readUint8, Buffer.prototype.writeUint8),
  Int16: new MetaTypeNumber("int16_t", 2, Buffer.prototype.readInt16LE, Buffer.prototype.writeInt16LE),
  Uint16: new MetaTypeNumber("uint16_t", 2, Buffer.prototype.readUint16LE, Buffer.prototype.writeUint16LE),
  Int32: new MetaTypeNumber("int32_t", 4, Buffer.prototype.readInt32LE, Buffer.prototype.writeInt32LE),
  Uint32: new MetaTypeNumber("uint32_t", 4, Buffer.prototype.readUint32LE, Buffer.prototype.writeUint32LE),
  Int64: new MetaTypeNumber("int64_t", 8, Buffer.prototype.readBigInt64LE, Buffer.prototype.writeBigInt64LE),
  Uint64: new MetaTypeNumber("uint64_t", 8, Buffer.prototype.readBigUInt64LE, Buffer.prototype.writeBigUInt64LE),

  // Float.
  Float: new MetaTypeNumber("float", 4, Buffer.prototype.readFloatLE, Buffer.prototype.writeFloatLE),
  Double: new MetaTypeNumber("double", 8, Buffer.prototype.readDoubleLE, Buffer.prototype.writeDoubleLE),

  // Pointer.
  Pointer: new MetaTypePointer("pointer"),

  // Object.
  Object: new MetaTypeClass("Object", null),
};

module.exports = {
  kMetaTypes
};
