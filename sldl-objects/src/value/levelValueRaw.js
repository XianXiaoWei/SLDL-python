var { Buffer } = require("buffer");
var { LevelValue } = require("./levelValue.js");

class LevelValueRaw extends LevelValue {
  constructor(def) {
    super(def);
  }

  getSize() {
    return this.def.getSize();
  }

  getValue() {
    return this.value || Buffer.alloc(0);
  }

  setValue(value) {
    if (Buffer.isBuffer(value))
      this.value = value;
    else if (typeof value === "string")
      this.value = Buffer.from(value, "hex");
    else
      this.value = Buffer.alloc(this.def.getSize());
  }
}

module.exports = {
  LevelValueRaw
};
