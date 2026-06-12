/**
 * sldl-objects - OO TGCL .level.bin binary reader/writer.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

var { kObjectExceptions } = require("./src/exceptions.js");
var {
  LoHeader,
  LoStringPool,
  LoMemvar,
  LoClass,
  LoIndices,
  LevelObjects,
  kMemvarTypes
} = require("./src/levelObjects.js");
var { kMetaTypes, getClumpGeneric, clumpGenericCache } = require("./src/types.js");
var { MetaType, MetaTypeForward, kMetaValueType } = require("./src/type/metaType.js");
var {
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass
} = require("./src/type/metaTypeClass.js");
var { MetaTypeBool, MetaTypeNumber } = require("./src/type/metaTypeNumber.js");
var { MetaTypePointer } = require("./src/type/metaTypePointer.js");
var { MetaTypeString } = require("./src/type/metaTypeString.js");
var { MetaTypeStructMember, MetaTypeStruct } = require("./src/type/metaTypeStruct.js");
var { MetaTypeRaw } = require("./src/type/metaTypeRaw.js");
var { LevelValue } = require("./src/value/levelValue.js");
var { LevelValueClass } = require("./src/value/levelValueClass.js");
var { LevelValueBool, LevelValueNumber } = require("./src/value/levelValueNumber.js");
var { LevelValuePointer } = require("./src/value/levelValuePointer.js");
var { LevelValueString } = require("./src/value/levelValueString.js");
var { LevelValueStruct } = require("./src/value/levelValueStruct.js");
var { LevelValueRaw } = require("./src/value/levelValueRaw.js");

module.exports = {
  // ./src/exceptions.js
  kObjectExceptions,

  // ./src/levelObjects.js
  LoHeader,
  LoStringPool,
  LoMemvar,
  LoClass,
  LoIndices,
  LevelObjects,
  kMemvarTypes,

  // ./src/types.js
  kMetaTypes,
  getClumpGeneric,
  clumpGenericCache,
  MetaType,
  MetaTypeForward,
  kMetaValueType,

  // ./src/type/metaTypeClass.js
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass,

  // ./src/type/metaTypeNumber.js
  MetaTypeBool,
  MetaTypeNumber,

  // ./src/type/metaTypePointer.js
  MetaTypePointer,

  // ./src/type/metaTypeString.js
  MetaTypeString,

  // ./src/type/metaTypeStruct.js
  MetaTypeStructMember,
  MetaTypeStruct,

  // ./src/type/metaTypeRaw.js
  MetaTypeRaw,

  // ./src/value/levelValue.js
  LevelValue,

  // ./src/value/levelValueClass.js
  LevelValueClass,

  // ./src/value/levelValueNumber.js
  LevelValueBool,
  LevelValueNumber,

  // ./src/value/levelValuePointer.js
  LevelValuePointer,

  // ./src/value/levelValueString.js
  LevelValueString,

  // ./src/value/levelValueStruct.js
  LevelValueStruct,

  // ./src/value/levelValueRaw.js
  LevelValueRaw,
};
