var { LevelValue } = require("./levelValue.js");

class LevelValueStruct extends LevelValue {
  constructor(def) {
    super(def);

    this.value = new Map();
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
}

module.exports = {
  LevelValueStruct
};
