const { Buffer } = require("./src/buffer.js");
const {
  SldlException,
  SimpleExceptionBuilder,
  DynamicExceptionBuilder
} = require("./src/exceptions.js");
const { FileInterface } = require("./src/file/file.js");
const { FileSlice } = require("./src/file/slice.js");

module.exports = {
  Buffer,

  FileInterface,
  FileSlice,

  SldlException,
  SimpleExceptionBuilder,
  DynamicExceptionBuilder
};
