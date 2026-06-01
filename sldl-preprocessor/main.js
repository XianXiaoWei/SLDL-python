/**
 * That Sky Preprocessor (TSPP)
 * for SLDL v1.0.0
 *
 * Copyright (c) 2026 That Sky Project
 *
 * LGPL License
 */

const { FileSlice } = require("sldl-utils");
const { FileInterface } = require("sldl-utils");
const {
  PreprocessLexer,
  PreprocessToken,
  PreprocessTokenContent
} = require("./src/lexer.js");
const {
  PreprocessMacro,
  PreprocessParser
} = require("./src/parser.js");

/**
 * Preprocess a source file, expanding all directives and macros.
 *
 * Supported directives:
 *   #include  — file inclusion
 *   #define   — object-like and function-like macros
 *   #undef    — remove a macro definition
 *   #if       — conditional compilation (expression evaluation)
 *   #ifdef    — conditional on macro defined
 *   #ifndef   — conditional on macro not defined
 *   #else     — alternate branch for #if/#ifdef/#ifndef
 *   #elif     — chained conditional
 *   #endif    — close conditional block
 *
 * @param {FileSlice} fileSlice - Input file slice to preprocess.
 * @param {Object} [options] - Preprocessor options.
 * @param {string[]} [options.includePaths] - Paths to search for #include files.
 * @param {Map<string, any>} [options.macros] - Predefined macros.
 * @param {FileInterface} [options.fileInterface] - File system accessor.
 * @returns {{ result: FileSlice, errors: Error[], warnings: Error[], macros: Map<string, any> }}
 */
function preprocess(fileSlice, options) {
  var opts = options || {}
    , includePaths = opts.includePaths || []
    , macros = opts.macros || new Map()
    , fileInterface = opts.fileInterface || new FileInterface();

  var parser = new PreprocessParser(fileSlice, macros, includePaths, fileInterface);
  parser.parse();

  return {
    result: parser.result,
    errors: parser.errors,
    warnings: parser.warnings,
    macros: parser.macros
  }
}

module.exports = {
  FileSlice,
  FileInterface,

  PreprocessTokenContent,
  PreprocessToken,
  PreprocessLexer,

  PreprocessMacro,
  PreprocessParser,

  preprocess
};
