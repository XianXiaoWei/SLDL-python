/**
 * sldl-jsonify - JSON and Itanium frontend for sldl-objects.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

var { LevelObjects, kMetaTypes, MetaTypeClass } = require("sldl-objects");
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
   * @param {Object} declGroup - JSON declaration group or itanium string.
   * @param {boolean} [isItanium] - if true, declGroup is an itanium string.
   */
  constructor(declGroup, isItanium) {
    var defs;

    if (isItanium) {
      var resolved = ItaniumResolver.resolve(declGroup);
      if (!resolved)
        throw kItaniumException.Unexpected.from("unresolved types", 0);
      defs = resolved;
    } else {
      var dg = new DeclarationGroup(declGroup).parse();
      defs = [];
      for (var [name, type] of dg.types)
        defs.push(type);
      for (var key of Object.keys(kMetaTypes))
        if (!dg.types.has(key))
          defs.push(kMetaTypes[key]);
    }

    /** @type {LevelObjects} */
    this.lo = new LevelObjects(defs);
    this.declGroup = declGroup;
    this.isItanium = !!isItanium;
  }

  /**
   * Read a TGCL binary buffer and return JSON objects with their
   * declaration group.
   * @param {Buffer} buffer
   * @returns {{ objects: Object, declGroup: Object }}
   */
  read(buffer) {
    var valueMap = this.lo.readBinary(buffer);
    var result = {};

    for (var [name, obj] of valueMap) {
      var jsonObj = jsonValue.serializeClass(obj, null);
      result["O$" + name] = jsonObj;
    }

    var dg;
    if (this.isItanium) {
      var resolver = new ItaniumResolver(this.declGroup);
      dg = resolver.resolveToDeclGroup() || {};
    } else {
      dg = this.declGroup;
    }

    return { objects: result, declGroup: dg };
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

      var { LevelValueClass } = require("sldl-objects");
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
