var { kObjectExceptions } = require("../exceptions.js");
var { LevelValue } = require("./levelValue.js");

class LevelValuePointer extends LevelValue {
  constructor() {
    super(require("../types.js").kMetaTypes.Pointer);

    this.index = 0;
    /** @type {string|null} Target object name for P$ resolution. */
    this.targetName = null;
  }

  backpatch(L) {
    if (this.index == 0xFFFFFFFF) {
      this.setValue(null);
      return;
    }

    var object = L.objects[this.index];
    if (!object)
      throw kObjectExceptions.InvalidObjectIndex.from(this.index);

    this.setValue(object);
  }

  setIndex(index) {
    this.index = index;
  }
}

module.exports = {
  LevelValuePointer
};
