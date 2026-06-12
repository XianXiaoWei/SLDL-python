var { Buffer } = require("buffer");
var { LevelValue } = require("./levelValue.js");

class LevelValueString extends LevelValue {
  constructor(def) {
    super(def);
  }

  getSize() {
    return typeof this.value === "string"
      ? Buffer.from(this.value).length + 1
      : 1;
  }

  getValue() {
    return typeof this.value === "string"
      ? this.value
      : "";
  }
}

module.exports = {
  LevelValueString
};
