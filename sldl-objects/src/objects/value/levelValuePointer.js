const { kObjectExceptions } = require("../../exceptions.js");
const { LevelValue } = require("./levelValue.js");

class LevelValuePointer extends LevelValue {
  constructor() {
    super(require("../types.js").kMetaTypes.Pointer);

    this.index = 0;
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
