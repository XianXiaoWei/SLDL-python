const {
  kBulitInExceptions,
  SimpleCompileExceptionBuilder,
  DynamicCompileExceptionBuilder,
  CompileException
} = require("./src/exceptions.js");
const { FileInterface } = require("./src/file/file.js");
const { FileSlice } = require("./src/file/slice.js");

module.exports = {
  FileInterface,
  FileSlice,

  CompileException,
  SimpleCompileExceptionBuilder,
  DynamicCompileExceptionBuilder,
  kBulitInExceptions
};
