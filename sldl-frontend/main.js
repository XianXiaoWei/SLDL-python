/**
 * HLCL Compiler Frontend
 *
 * for CBLDL v2.0
 *
 * Copyright (c) 2025 HTMonkeyG
 *
 * MIT License
 */

const { CompilerLexer } = require("./src/lexer/lexer.js");
const { CompilerParser, compile } = require("./src/parser/parser.js");

/**
 * Tokenize a preprocessed FileSlice into a stream of Token objects.
 *
 * @param {FileSlice} fileSlice - Preprocessed input (directives resolved,
 *   macros expanded, conditionals evaluated).
 * @returns {{ tokens: Token[], lexer: CompilerLexer }}
 */
function tokenize(fileSlice) {
  var lexer = new CompilerLexer(fileSlice)
    , tokens = []
    , t;

  while ((t = lexer.scan()) != null)
    tokens.push(t);

  return {
    tokens: tokens,
    lexer: lexer
  }
}

/**
 * Parse a token array into an AST.
 *
 * @param {Token[]} tokens - Token stream from tokenize().
 * @returns {object} Program AST.
 */
function parse(tokens) {
  var parser = new CompilerParser(tokens);
  return parser.parse();
}

module.exports = {
  tokenize: tokenize,
  parse: parse,
  compile: compile,
  CompilerLexer: CompilerLexer,
  CompilerParser: CompilerParser
};
