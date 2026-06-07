const { kBulitInExceptions } = require("../../../exceptions.js");
const { Expression } = require("./expression.js");
const { kTokenReserved, kTokenType } = require("../../../lexer/token.js");
const { Reference } = require("./reference.js");
const { Constant } = require("./constant.js");

/**
 * Primary expression - the atom of the expression grammar.
 * 
 * The <PrimaryExpression> node is usually hidden.
 *
 * <PrimaryExpression>:
 *   <Constant>
 *   <Reference>
 *   ( <Expression> )
 */
class PrimaryExpression extends Expression {
  /**
   * True when P.look can start a primary expression.
   * @param {CompilerParser} P
   * @param {Env} E
   * @returns {boolean}
   */
  static maybe(P, E) {
    return Constant.maybe(P, E)
      || P.test(kTokenType.Identifier)
      || P.test(kTokenReserved.ParenL);
  }

  constructor() {
    super();

    /** @type {Expression} The wrapped expression node. */
    this.child = void 0;
  }

  /**
   * Parse a primary expression.
   *
   * <PrimaryExpression>:
   *   <Constant>
   *   <Reference>
   *   ( <Expression> )
   *
   * Entry: look -> Constant, Identifier, or "(".
   * Exit: look -> after the primary expression.
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    // Parenthesised expression.
    if (P.test(kTokenReserved.ParenL)) {
      P.move();

      // TODO: when expression parser is available, use it here.
      // For now, parse a primary expression inside parens.
      var expr = PrimaryExpression.parse(P, E)(P.look);

      P.match(kTokenReserved.ParenR);
      P.move();

      // Return the next non-terminal as the result.
      return expr;
    }

    // Identifier reference.
    if (P.test(kTokenType.Identifier))
      // Hide <PrimaryExpression> node.
      return Reference.parse(P, E)();

    // Literal constant.
    if (Constant.maybe(P, E))
      // Hide <PrimaryExpression> node.
      return Constant.parse(P, E)(P.look);

    this.error(kBulitInExceptions.Unexpected, P.look);
  }
}

module.exports = {
  PrimaryExpression
};
