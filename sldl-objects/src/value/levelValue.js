class LevelValue {
  constructor(def) {
    /** @type {MetaType} */
    this.def = def;
    this.value = void 0;
  }

  /**
   * Get the type definition.
   * @returns {MetaType}
   */
  getDef() {
    return this.def;
  }

  /**
   * Get the size of the value.
   * @returns {number}
   */
  getSize() {
    return this.def.getSize();
  }

  /**
   * Get the alignment of the value.
   * @returns {number}
   */
  getAlign() {
    return this.def.getAlign();
  }

  /**
   * Get the value.
   * @returns {any}
   */
  getValue() {
    return this.value;
  }

  /**
   * Set the value of the instance.
   * @param {any} value
   */
  setValue(value) {
    this.value = value;
  }

  /**
   * Get the value type.
   * @returns {number}
   */
  valueType() {
    return this.def.valueType();
  }
}

module.exports = {
  LevelValue
};
