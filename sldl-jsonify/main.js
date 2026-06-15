/**
 * sldl-jsonify - JSON and Itanium frontend for sldl-objects.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

var {
  MetaTypeClass,
  MetaTypeClassMemberArray,
  LevelObjects,
  LevelValueClass,
  kMetaTypes,
  kMetaValueType
} = require("sldl-objects");
var { ItaniumResolver, kItaniumTypes } = require("./src/itanium.js");
var { DeclarationGroup } = require("./src/declGroup.js");
var jsonValue = require("./src/jsonValue.js");
var { kItaniumException } = require("./src/exception.js");

/**
 * High-level JSON-based reader/writer that wraps sldl-objects'
 * LevelObjects with JSON serialization.
 */
class JsonLevelObjects {
  /**
   * @param {Object|DeclarationGroup|string} declGroup - JSON declaration
   *   group, a pre-parsed DeclarationGroup instance, or an itanium string.
   * @param {boolean} [isItanium] - if true, declGroup is an itanium string.
   */
  constructor(declGroup, isItanium) {
    var defs;

    if (isItanium) {
      var resolved = ItaniumResolver.resolve(declGroup);
      if (!resolved)
        throw kItaniumException.Unexpected.from("unresolved types", 0);
      defs = resolved;
      this.declGroup = null;
      this.isItanium = true;
    } else {
      // Use a private copy of a pre-parsed group, or parse a raw JSON group.
      var dg = declGroup instanceof DeclarationGroup
        ? cloneDeclGroup(declGroup)
        : new DeclarationGroup(declGroup).parse();
      defs = buildDefs(dg);
      this.declGroup = dg;
      this.isItanium = false;
    }

    /** @type {LevelObjects} */
    this.lo = new LevelObjects(defs);
    /** @type {string|null} Original itanium string, stored for getDeclGroup. */
    this.itaniumSource = isItanium ? declGroup : null;
  }

  /**
   * Read a TGCL binary buffer. Unknown types encountered in the binary
   * are auto-added to the stored declaration group.
   * @param {Buffer} buffer
   * @returns {Object} Plain object with "O$name" keys.
   */
  read(buffer) {
    var valueMap = this.lo.readBinary(buffer);
    var result = {};

    for (var [name, obj] of valueMap) {
      var jsonObj = jsonValue.serializeClass(obj, null);
      result["O$" + name] = jsonObj;
    }

    // Rebuild declaration group from LevelObjects indices (includes
    // auto-created types discovered during read).
    this.declGroup = this.buildDeclGroup();

    return result;
  }

  /**
   * Write JSON objects to a TGCL binary buffer.
   * @param {Object} objects - plain objects with "O$name" keys.
   * @returns {Buffer}
   */
  write(objects) {
    for (var objKey of Object.keys(objects)) {
      if (!objKey.startsWith("O$"))
        continue;

      var objName = objKey.slice(2);
      var objData = objects[objKey];

      var className = objData.$type;
      if (typeof className !== "string")
        throw kItaniumException.UnrecognizedType.from(String(className));

      var classDef = this.lo.indices.metaClasses.get(className);
      if (!classDef)
        throw kItaniumException.UnrecognizedType.from(className);

      var lvc = new LevelValueClass(classDef, objName);

      for (var [memberName, member] of classDef.allMembers()) {
        var jv = objData[memberName];
        var lv;
        if (jv !== void 0) {
          lv = jsonValue.parse(jv, member, null);
        } else {
          lv = MetaTypeClass.memberTypeDefault(member);
        }
        lvc.setValue(memberName, lv);
      }

      lvc.finalize();
      this.lo.set(lvc);
    }

    return this.lo.writeBinary();
  }

  /**
   * Get the current declaration group.
   * @param {boolean} [asJSON] - if true, return a plain JSON object with
   *   C$/S$/A$ keys suitable for serialization.
   * @returns {DeclarationGroup|Object}
   */
  getDeclGroup(asJSON) {
    if (!this.declGroup)
      return asJSON ? {} : new DeclarationGroup({});

    if (asJSON) {
      var result = {};
      var { MetaTypeClump } = require("sldl-objects");

      for (var [name, type] of this.declGroup.types) {
        // Exclude built-in types and Clump<T> generics.
        if (isBuiltin(name) || type instanceof MetaTypeClump)
          continue;
        var tn = type.getName()
          , vt = type.valueType();

        if (vt === kMetaValueType.Class) {
          var classObj = {};
          if (type.parent && type.parent.getName() !== "Object")
            classObj.$parent = type.parent.getName();
          for (var [mn, m] of type.members)
            classObj[mn] = memberToString(m);
          result["C$" + name] = classObj;
        } else if (vt === kMetaValueType.Struct) {
          var structObj = {};
          for (var [mn, m] of type.members)
            structObj[mn] = memberToString(m);
          result["S$" + name] = structObj;
        } else if (vt === kMetaValueType.Number) {
          result["A$" + name] = tn;
        }
      }

      // Include enum constants.
      for (var [ek, ev] of this.declGroup.enumInfo)
        result["E$" + ev.enumName] = result["E$" + ev.enumName]
          || { $as: "int32_t" };

      return result;
    }

    return this.declGroup;
  }

  /**
   * Build a DeclarationGroup from the current LevelObjects state.
   * Used after read to capture auto-created types.
   * @returns {DeclarationGroup}
   */
  buildDeclGroup() {
    var dg = new DeclarationGroup({});
    var L = this.lo.indices;

    for (var [name, type] of L.metaTypes) {
      var rn = type.getName();
      // Exclude built-in primitive types (bool, int8_t, float, cstring...).
      if (isBuiltin(name) || isBuiltin(rn))
        continue;
      dg.types.set(name, type);
      if (type.valueType() === kMetaValueType.Class)
        dg.classes.set(name, type);
    }

    return dg;
  }
}

/**
 * Build the MetaType[] definitions list for LevelObjects from a declaration
 * group: every declared type, plus any built-in type it does not override.
 * @param {DeclarationGroup} dg
 * @returns {Array}
 */
function buildDefs(dg) {
  var defs = [];
  for (var type of dg.types.values())
    defs.push(type);
  for (var key of Object.keys(kMetaTypes))
    if (!dg.types.has(key))
      defs.push(kMetaTypes[key]);
  return defs;
}

/**
 * Shallow-copy a pre-parsed DeclarationGroup into a fresh instance, so the
 * caller's group is not mutated by subsequent reads/writes.
 * @param {DeclarationGroup} src
 * @returns {DeclarationGroup}
 */
function cloneDeclGroup(src) {
  var dg = new DeclarationGroup({});
  for (var [name, type] of src.types)
    dg.types.set(name, type);
  for (var [name, cls] of src.classes)
    dg.classes.set(name, cls);
  for (var [name, val] of src.enumConstants)
    dg.enumConstants.set(name, val);
  for (var [name, info] of src.enumInfo)
    dg.enumInfo.set(name, info);
  if (src.aliasMap) {
    dg.aliasMap = {};
    for (var ak of Object.keys(src.aliasMap))
      dg.aliasMap[ak] = src.aliasMap[ak];
  }
  dg.raw = src.raw;
  return dg;
}

/**
 * Convert a MetaTypeClassMember to its string representation.
 */
function memberToString(member) {
  var typeName = member.def.getName();

  // Get the actual target name for pointer types.
  var pointerTarget = "Object";
  if (member.valueType() === kMetaValueType.Pointer
    && member.def.points
    && member.def.points !== kMetaTypes.Object) {
    pointerTarget = member.def.points.getName();
  }

  if (member instanceof MetaTypeClassMemberArray) {
    var suffix = member.maxCount
      ? "[" + member.maxCount + "]"
      : "[]";

    if (member.valueType() === kMetaValueType.Pointer)
      return pointerTarget + " *" + suffix;
    return typeName + " " + suffix;
  }

  if (member.valueType() === kMetaValueType.Pointer)
    return pointerTarget + " *";

  if (member.valueType() === kMetaValueType.Raw)
    return "R$" + member.getSize();

  return typeName;
}

/**
 * Check if a type name corresponds to a built-in type.
 */
function isBuiltin(name) {
  if (kMetaTypes[name])
    return true;
  // Also check by runtime name.
  for (var key of Object.keys(kMetaTypes))
    if (kMetaTypes[key].getName() === name)
      return true;
  return false;
}

module.exports = {
  // ./src/itanium.js
  ItaniumResolver,
  kItaniumTypes,

  // ./src/declGroup.js
  DeclarationGroup,

  // ./src/jsonValue.js
  jsonValue,

  // ./src/exception.js
  kItaniumException,

  // High-level facade
  JsonLevelObjects,
};