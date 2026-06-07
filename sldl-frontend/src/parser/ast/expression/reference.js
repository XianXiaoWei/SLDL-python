/**
 * Reference AST node.
 * 
 * Represents an identifier reference or a named constant entry in the symbol
 * table.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kBulitInExceptions } = require("../../../exceptions.js");
const { kTokenType } = require("../../../lexer/token.js");
const { Expression } = require("./expression.js");

/** Represents an identifier reference or constant symbol-table entry. */
class Reference extends Expression {
  constructor() {
    super();

    /**
     * The identifier name token.
     * @type {Token}
     */
    this.name = void 0;
    /**
     * Reference to the original type declaration EnvEntry.
     * @type {EnvEntry}
     */
    this.type = void 0;
  }

  /**
   * @param {EnvEntry} type 
   */
  setType(type) {
    this.type = type;
  }

  /**
   * Parse a variable reference.
   * 
   * <Reference>:
   *   <Identifier>
   * 
   * Entry: look -> <Identifier>.
   * Exit: look -> After <Identifier>.
   * 
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {EnvEntry} [type] - Variable type.
   */
  syntax(P, E, type) {
    P.match(kTokenType.Identifier);
    this.name = P.look;
    this.relocate(this.name);

    this.type = type || void 0;

    P.move();
  }

  /**
   * Get the name in a string.
   * @returns {string}
   */
  getName() {
    return this.name ? this.name.raw() : "";
  }

  toString() {
    return this.getName();
  }
}

module.exports = {
  Reference
};
