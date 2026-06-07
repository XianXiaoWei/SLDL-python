/**
 * Parser.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { FileSlice } = require("sldl-utils");
const { kBulitInExceptions } = require("../exceptions.js");
const { CompilerLexer } = require("../lexer/lexer.js");
const { TokenContent, kTokenType, kTokenReserved, Token, kInternalTypes } = require("../lexer/token.js");
const { Env, EnvEntry, kEnvEntryType } = require("./env.js");

class CompilerParser {
  /**
   * @param {FileSlice|string} input
   */
  constructor(input) {
    this.lexer = new CompilerLexer(input);

    this.errors = [];

    this.look = void 0;
    this.done = false;

    /** Stores all symbols (types, objects, identifiers). */
    this.env = new Env();

    this.env.initialize();
    this.move();
  }

  /**
   * @returns {TokenContent}
   */
  get content() {
    return this.look.content;
  }

  move() {
    this.look = this.lexer.scan();
    if (!this.look)
      this.done = true;
  }

  /**
   * Move until the given token. Used in panic mode.
   * After the function, loop points to the given token or end of the file.
   * @param {...number|string|TokenContent} cond 
   */
  moveTil(...cond) {
    while (!this.done && !cond.some(this.test.bind(this)))
      this.move();
  }

  /**
   * Check the token.
   * @param {number|string|TokenContent} cond 
   * @returns {boolean}
   */
  test(cond) {
    if (this.done)
      return false;

    if (typeof cond === "object") {
      if (this.content !== cond && this.content.content !== cond.content)
        return false;
      return true;
    }

    if (typeof cond === "number" && this.content.type != cond)
      return false;

    if (typeof cond === "string" && this.content.content !== cond)
      return false;

    return true;
  }

  match(cond) {
    if (!this.test(cond))
      throw kBulitInExceptions.Unexpected.from(this.look);
  }

  onerror(e) {
    if (this.errors.length >= 1024)
      throw kBulitInExceptions.TooManyError.from();
    this.errors.push(e);
  }
}

module.exports = {
  CompilerParser
};
