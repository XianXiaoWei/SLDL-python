/**
 * TGCL binary level format.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kObjectExceptions } = require("./src/exceptions.js");
const {
  LoHeader,
  LoStringPool,
  LoMemvar,
  LoClass,
  LoIndices,
  LevelObjects,
  kMemvarTypes
} = require("./src/levelObjects.js");
const { kMetaTypes } = require("./src/types.js");
const { MetaType, kMetaValueType } = require("./src/type/metaType.js");
const {
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass
} = require("./src/type/metaTypeClass.js");
const { MetaTypeBool, MetaTypeNumber } = require("./src/type/metaTypeNumber.js");
const { MetaTypePointer } = require("./src/type/metaTypePointer.js");
const { MetaTypeString } = require("./src/type/metaTypeString.js");
const { MetaTypeStructMember, MetaTypeStruct } = require("./src/type/metaTypeStruct.js");
const { LevelValue } = require("./src/value/levelValue.js");
const { LevelValueClass } = require("./src/value/levelValueClass.js");
const { LevelValueBool, LevelValueNumber } = require("./src/value/levelValueNumber.js");
const { LevelValuePointer } = require("./src/value/levelValuePointer.js");
const { LevelValueString } = require("./src/value/levelValueString.js");
const { LevelValueStruct } = require("./src/value/levelValueStruct.js");

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

  // ./src/type/metaType.js
  MetaType,
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
};
