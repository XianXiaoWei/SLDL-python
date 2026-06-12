var { LevelValue } = require("./levelValue.js");

class LevelValueBool extends LevelValue {
  constructor(def) {
    super(def);
  }
}

class LevelValueNumber extends LevelValue {
  constructor(def) {
    super(def);
  }
}

module.exports = {
  LevelValueBool,
  LevelValueNumber
};
