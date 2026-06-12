var { LevelValue } = require("./levelValue.js");
var { LevelValuePointer } = require("./levelValuePointer.js");
var { LevelValueRaw } = require("./levelValueRaw.js");
var { kMetaValueType } = require("../type/metaType.js");

class LevelValueClass extends LevelValue {
  constructor(def, name) {
    super(def);
    this.name = name;
    this.value = new Map();
    this.size = 0;
  }

  getSize() {
    return this.size;
  }

  getName() {
    return this.name;
  }

  finalize() {
    var size = 0;
    for (var m of this.value.values()) {
      size += Array.isArray(m)
        ? m.reduce(function (sum, val) { return sum + val.getSize(); }, 4)
        : m.getSize();
    }
    this.size = size;
  }

  /**
   * @param {string} name
   * @returns {LevelValue|LevelValue[]|undefined}
   */
  getValue(name) {
    return this.value.get(name);
  }

  /**
   * @param {string} name
   * @param {LevelValue|LevelValue[]} value
   */
  setValue(name, value) {
    this.value.set(name, value);
  }

  /**
   * Convert to a plain JSON object.
   * @param {DeclarationGroup} declGroup
   * @returns {Object}
   */
  toJSON(declGroup) {
    var result = {};

    for (var [key, val] of this.value) {
      result[key] = LevelValueClass.valueToJSON(val, declGroup);
    }

    return result;
  }

  /**
   * @param {LevelValue|LevelValue[]} val
   * @param {DeclarationGroup} declGroup
   * @returns {any}
   */
  static valueToJSON(val, declGroup) {
    if (Array.isArray(val)) {
      var arr = [];
      for (var i = 0; i < val.length; i++)
        arr.push(LevelValueClass.valueToJSON(val[i], declGroup));
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
      return buf.toString("hex");
    }

    if (vt === kMetaValueType.Struct) {
      var structResult = {};
      for (var [mk, mv] of val.value)
        structResult[mk] = LevelValueClass.valueToJSON(mv, declGroup);
      return structResult;
    }

    if (vt === kMetaValueType.Class) {
      return val.toJSON(declGroup);
    }

    // Number, String
    return val.getValue();
  }
}

module.exports = {
  LevelValueClass
};
