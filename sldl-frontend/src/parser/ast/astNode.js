const { kBulitInExceptions } = require("../../exceptions.js");

/**
 * Node of abstract syntax tree.
 * 
 * Each AstNode can contain two types of other nodes: reference nodes and child
 * nodes. Reference nodes represent things like the original type declaration and
 * are used only for identification; child nodes are nodes directly derived from
 * productions and are used for semantic computation.
 */
class AstNode {
  /**
   * Check if P.look is the starting token of the current node.
   * @param {CompilerParser} P 
   * @param {Env} E 
   * @returns {boolean}
   */
  static maybe(P, E) {
    return true;
  }

  /**
   * Check if P.look is the starting token of the current node. This function is
   * used to throw an "unexpected ..." error before the caller enters parsing.
   * @param {CompilerParser} P 
   * @param {v} E 
   * @throws {CompileException}
   */
  static match(P, E) {
    if (!this.maybe(P, E))
      throw kBulitInExceptions.Unexpected.from(P.look);
  }

  /**
   * Parse the node from CompilerParser with panic mode.
   * @param {CompilerParser} P 
   * @param {Env} E 
   * @param  {...any} args 
   * @returns {(T:Token,...V:any[])=>AstNode|undefined}
   */
  static parse(P, E, ...args) {
    var self = this;
    return function (T, ...V) {
      var r = new self(T, ...V);
      try {
        // Try to parse the node from the CompilerParser.
        return r.syntax(P, E, ...args) || r;
      } catch (e) {
        P.onerror(e);
        // Panic mode.
        r.panic(P, E, ...args);
        return void 0;
      }
    };
  }

  /**
   * @param {Token} [token] 
   */
  constructor(token) {
    /** 
     * Complete initial token with context. Errors of the node will use this
     * token as context by default.
     */
    this.ctx = token || void 0;
  }

  /**
   * Triggers an error.
   * @param {SimpleCompileExceptionBuilder} e - Exception builder.
   * @param {Token} [token] - Override the default token.
   * @param {...any} args - Other arguments.
   */
  error(e, token, ...args) {
    throw e.from(token ? token : this.ctx, ...args);
  }

  /**
   * Relocate the node to a new context.
   * @param {Token} token 
   */
  relocate(token) {
    this.ctx = token;
  }

  /**
   * Enter panic mode to expect the next safe token. The function is called when
   * an error was thrown in this.syntax().
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  panic(P, E) {
    // Skip to next safe token.
    P.move();
  }

  /**
   * Parse the node from the Parser. Return undefine is equivalant to "this".
   * This function is called by this.constructor.parse().
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @returns {AstNode|undefined} Rarse result, can be other node than "this".
   */
  syntax(P, E) {
    return this;
  }

  /**
   * Do the semantic computation.
   * @param {Env} E - Symbol table.
   */
  semantic(E) {
    ;
  }

  /**
   * Default toString().
   * @returns {string}
   */
  toString() {
    return this.ctx ? this.ctx.raw() : "";
  }
}

module.exports = {
  AstNode,
};
