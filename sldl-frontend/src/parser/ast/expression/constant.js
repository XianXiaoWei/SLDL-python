/**
 * Constant literal AST node.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kBulitInExceptions } = require("sldl-utils");
const { kTokenReserved, kTokenType, kPrimitiveTypes } = require("../../../lexer/token.js");
const { Expression } = require("./expression.js");

/** Represents a compile-time constant literal (number, string, boolean). */
class Constant extends Expression {
  /**
   * @param {Token} token — The literal token.
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
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @returns {boolean}
   */
  parse(P, E) {
    try {
      this.syntax(P, E);
      return true;
    } catch (e) {
      P.onerror(e);
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
      return false;
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
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    this.relocate(P.look);

    // Numeric literal.
    if (P.test(kTokenType.Number)) {
      this.type = kPrimitiveTypes.Int32;
      P.move();
      return;
    }

    // String literal.
    if (P.test(kTokenType.String)) {
      this.type = kPrimitiveTypes.Cstring;
      P.move();
      return;
    }

    // Boolean literal.
    if (P.test(kTokenReserved.True)) {
      this.type = kPrimitiveTypes.Bool;
      P.move();
      return;
    }

    if (P.test(kTokenReserved.False)) {
      this.type = kPrimitiveTypes.Bool;
      P.move();
      return;
    }

    this.error(kBulitInExceptions.Unexpected.from(P.look));
  }

  /** @returns {*} */
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
