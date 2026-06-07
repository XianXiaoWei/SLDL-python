/**
 * Object constant declaration statement.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kBulitInExceptions } = require("../../../exceptions.js");
const { kTokenReserved, kTokenType } = require("../../../lexer/token.js");
const { EnvEntry, kEnvEntryType } = require("../../env.js");
const { AstNode } = require("../astNode.js");
const { Statement } = require("./statement.js");
const { Reference } = require("../expression/reference.js");
const { InitList } = require("../initList.js");
const { TypeDeclaration } = require("../typedecl.js");

/** Represents a variable declaration. */
class VariableStatement extends Statement {
  /**
   * @param {Token} token - The type-name token.
   */
  constructor(token) {
    super(token);

    /** @type {AstNode} The type declaration. */
    this.typedecl = void 0;
    /** @type {Token} The variable name. */
    this.name = void 0;
    /** @type {InitList} The initializer. */
    this.init = void 0;
  }

  /**
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  panic(P, E) {
    // Panic til ";"
    P.moveTil(kTokenReserved.Semicolon);
    P.move();
  }

  /**
   * Parse an object constant declaration.
   *
   * <VariableStatement>:
   *   <TypeDeclaration> ;
   *   <TypeDeclaration> = <InitList> ;
   *
   * Entry: look -> <TypeDeclaration> for type name.
   * Exit: look -> after ";"
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    this.typedecl = TypeDeclaration.parse(P, E)();
    this.name = this.typedecl.name;
    this.relocate(this.name);

    if (!P.test(kTokenReserved.Semicolon)) {
      // "="
      P.match(kTokenReserved.Assign);
      P.move();

      // <InitList> - pass type entry for member validation.
      var typeEntry = this.typedecl.baseType
        ? this.typedecl.baseType.def
        : void 0;
      this.init = InitList.parse(P, E, typeEntry)(P.look);
    }

    // ";"
    P.match(kTokenReserved.Semicolon);
    P.move();

    // Register as a constant in the symbol table.
    if (E.get(this.name))
      this.error(kBulitInExceptions.MultipleDefinition, this.name);

    E.put(EnvEntry.createVariable(this.name, this, this.typedecl.typedef, this.init));
  }
}

module.exports = {
  VariableStatement
};
