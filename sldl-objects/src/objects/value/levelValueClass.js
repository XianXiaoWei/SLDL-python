const { LevelValue } = require("./levelValue.js");

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

  finalize() {
    var size = 0;
    for (var m of this.value.values()) {
      size += Array.isArray(m)
        ? m.reduce((sum, val) => sum + val.getSize(), 0) + 4
        : m.getSize();
    }
    this.size = size + 4 + Buffer.from(this.name).length + 1;
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
  LevelValueClass
};
