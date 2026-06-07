/**
 * Constant literal AST node.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kBulitInExceptions } = require("../../../exceptions.js");
const { kTokenReserved, kTokenType, kInternalTypes } = require("../../../lexer/token.js");
const { Expression } = require("./expression.js");
const { TypeRef, kInternalTypedefs } = require("../../type.js");

/** Represents a compile-time constant literal (number, string, boolean). */
class Constant extends Expression {
  static maybe(P, E) {
    return P.test(kTokenType.String)
      || P.test(kTokenType.Number)
      || P.test(kTokenReserved.True)
      || P.test(kTokenReserved.False)
      || P.test(kTokenReserved.Infinity)
      || P.test(kTokenReserved.NaN);
  }

  /**
   * @param {Token} token - The literal token.
   */
  constructor(token) {
    super(token);

    /**
     * The inferred type of this constant.
     * @type {Type}
     */
    this.type = void 0;
  }

  /**
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  panic(P, E) {
    // Skip to next safe token.
    while (
      !P.done
      && !P.test(kTokenReserved.Comma)
      && !P.test(kTokenReserved.Semicolon)
      && !P.test(kTokenReserved.BraceR)
      && !P.test(kTokenReserved.BracketR)
      && !P.test(kTokenReserved.ParenR)
    ) {
      P.move();
    }
  }

  /**
   * Parse a literal constant.
   *
   * <Constant>:
   *   <Number>
   *   <String>
   *   true
   *   false
   *
   * Entry: look -> literal token.
   * Exit: look -> after literal token.
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    this.relocate(P.look);

    // Numeric literal.
    if (P.test(kTokenType.Number)) {
      this.retype(kInternalTypedefs.Uint32);
      P.move();
      return this;
    }

    // String literal.
    if (P.test(kTokenType.String)) {
      this.retype(kInternalTypedefs.Cstring);
      P.move();
      return this;
    }

    // Boolean literal.
    if (P.test(kTokenReserved.True)) {
      this.retype(kInternalTypedefs.Bool);
      P.move();
      return this;
    }

    if (P.test(kTokenReserved.False)) {
      this.retype(kInternalTypedefs.Bool);
      P.move();
      return this;
    }

    this.error(kBulitInExceptions.Unexpected, P.look);
  }

  /** @returns {any} */
  getValue() {
    if (!this.ctx)
      return void 0;

    var c = this.ctx.content;

    // NumericLiteral and StringLiteral carry .value directly.
    if (c.type === kTokenType.Number || c.type === kTokenType.String)
      return c.value;

    // Boolean literal.
    if (c === kTokenReserved.True)
      return true;
    if (c === kTokenReserved.False)
      return false;

    return void 0;
  }

  toString() {
    return this.ctx ? this.ctx.raw() : "";
  }
}

module.exports = {
  Constant
};
