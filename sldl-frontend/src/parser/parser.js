const { FileSlice, kBulitInExceptions } = require("sldl-utils");
const { CompilerLexer } = require("../lexer/lexer.js");
const { TokenContent, kTokenType, kTokenReserved, Token, kPrimitiveTypes } = require("../lexer/token.js");
const { AstNode } = require("./ast/astNode.js");
const { ClassBlock, ClassMemberDecl, ClassStatement } = require("./ast/statement/classStatement.js");
const { Env, EnvEntry, kEnvEntryType } = require("./env.js");
const { ToplevelNode } = require("./ast/toplevel.js");

function createEnvEntryType(content) {
  return new EnvEntry(kEnvEntryType.Primitive, content);
}

/**
 * Initialize the symbol table.
 * @param {Env} env 
 */
function initialEnv(env) {
  env.put(createEnvEntryType(kPrimitiveTypes.Bool));
  env.put(createEnvEntryType(kPrimitiveTypes.Int8));
  env.put(createEnvEntryType(kPrimitiveTypes.Uint8));
  env.put(createEnvEntryType(kPrimitiveTypes.Int16));
  env.put(createEnvEntryType(kPrimitiveTypes.Uint16));
  env.put(createEnvEntryType(kPrimitiveTypes.Int32));
  env.put(createEnvEntryType(kPrimitiveTypes.Uint32));
  env.put(createEnvEntryType(kPrimitiveTypes.Int64));
  env.put(createEnvEntryType(kPrimitiveTypes.Uint64));
  env.put(createEnvEntryType(kPrimitiveTypes.Float));
  env.put(createEnvEntryType(kPrimitiveTypes.Double));
  env.put(createEnvEntryType(kPrimitiveTypes.Cstring));
  env.put(createEnvEntryType(kPrimitiveTypes.TgcString));
}

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

    initialEnv(this.env);

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
