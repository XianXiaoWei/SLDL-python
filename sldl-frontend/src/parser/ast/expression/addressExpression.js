const { kBulitInExceptions } = require("../../../exceptions.js");
const { kTokenReserved } = require("../../../lexer/token.js");
const { Expression } = require("./expression.js");
const { PrimaryExpression } = require("./primaryExpression.js");
const { PointerTo } = require("../../type.js");
const { Reference } = require("./reference.js");

/**
 * Address-of expression - takes the address of an object.
 *
 * <AddressExpression>:
 *   & <PrimaryExpression>
 *   <PrimaryExpression>
 */
class AddressExpression extends Expression {
  /**
   * True when P.look can start an address expression.
   * @param {CompilerParser} P
   * @param {Env} E
   * @returns {boolean}
   */
  static maybe(P, E) {
    return P.test(kTokenReserved.And) || PrimaryExpression.maybe(P, E);
  }

  constructor() {
    super();

    /** @type {Expression} The operand. */
    this.child = void 0;
  }

  /**
   * Parse an address-of expression.
   *
   * <AddressExpression>:
   *   & <PrimaryExpression>
   *   <PrimaryExpression>
   *
   * Entry: look -> "&" or start of primary expression.
   * Exit: look -> after the expression.
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @returns {AstNode}
   */
  syntax(P, E) {
    if (P.test(kTokenReserved.And)) {
      // <AddressExpression>: & <PrimaryExpression>
      this.relocate(P.look);
      P.move();

      this.child = PrimaryExpression.parse(P, E)(P.look);
      if (!(this.child instanceof Reference))
        this.error(kBulitInExceptions.InvalidRef, this.child.ctx);

      // Result type is pointer to operand type.
      if (this.child.type)
        // Clone the type chain from the operand.
        this.retype(new PointerTo(this.child.type, this));

      return this;
    }

    // Plain primary expression, the <AddressExpression> node's hidden.
    return PrimaryExpression.parse(P, E)(P.look);
  }
}

module.exports = {
  AddressExpression
};
