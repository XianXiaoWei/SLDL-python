const { kBulitInExceptions } = require("../../../exceptions.js");
const { kTokenReserved, kTokenType } = require("../../../lexer/token.js");
const { EnvEntry } = require("../../env.js");
const { AstNode } = require("../astNode.js");
const { Statement } = require("./statement.js");
const { Constant } = require("../expression/constant.js");
const { TypeDeclaration } = require("../typedecl.js");
const { TypeRef } = require("../../type.js");

/** Represents a member variable of a class. */
class StructMemberDecl extends AstNode {
  constructor() {
    super();

    this.typedef = void 0;
    this.id = void 0;
    this.defaultVal = void 0;
  }

  /**
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} struct - Class statement.
   */
  panic(P, E, struct) {
    // Panic til ";" or "}"
    P.moveTil(kTokenReserved.Semicolon, kTokenReserved.BraceR);
    if (P.test(kTokenReserved.Semicolon))
      // Prepare for the next member.
      P.move();
  }

  /**
   * Parse a struct member declaration.
   *
   * <StructMember>:
   *   <TypeDeclaration> ;
   *   <TypeDeclaration> = <Literal> ;
   *
   * Entry: look -> <Identifier> for type name.
   * Exit: look -> After ";"
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} struct - Struct statement.
   */
  syntax(P, E, struct) {
    var typeDecl = TypeDeclaration.parse(P, E)(P.look);

    if (!typeDecl || !typeDecl.name)
      this.error(kBulitInExceptions.InvalidType, P.look);

    this.typedef = typeDecl.typedef;
    this.id = typeDecl.name;
    this.relocate(this.id);

    if (P.test(kTokenReserved.Assign)) {
      // Default value.
      P.move();
      this.defaultVal = Constant.parse(P, E)(P.look);
    }

    // ";"
    P.match(kTokenReserved.Semicolon);
    P.move();

    // Struct members must have a primitive base type.
    var base = this.typedef;
    while (base && base.child)
      base = base.child;
    if (!(base instanceof TypeRef) || !base.ref.isPrimitive())
      this.error(kBulitInExceptions.StructInvalidMemberType, this.id);
  }

  /**
   * Get the name in a string.
   * @returns {string}
   */
  getName() {
    return this.id.raw();
  }
}

/** Represents the member declaration block of a class. */
class StructBlock extends AstNode {
  /**
   * @param {Token} token - Token "{"
   */
  constructor(token) {
    super(token);
  }

  /**
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} struct - Struct statement.
   */
  panic(P, E, struct) {
    // Panic til "}"
    P.moveTil(kTokenReserved.BraceR);
    P.move();
  }

  /**
   * Parse a class block.
   * 
   * <StructBlock>:
   *   { <StructMembers> }
   * 
   * <StructMembers>:
   *   <StructMember> <StructMembers>
   *   <StructMember>
   * 
   * Entry: look -> at "{"
   * Exit: look -> after "}"
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} struct - Class statement.
   */
  syntax(P, E, struct) {
    // "{"
    P.match(kTokenReserved.BraceL);
    P.move();

    while (
      P.test(kTokenType.Identifier)
      && !P.test(kTokenReserved.Class)
      && !P.test(kTokenReserved.Struct)
    ) {
      var decl = StructMemberDecl.parse(P, E, struct)();
      if (decl)
        // Add member to class.
        struct.addMember(decl);
    }

    // "}"
    P.match(kTokenReserved.BraceR);
    P.move();
  }
}

/** Represents a class. */
class StructStatement extends Statement {
  /**
   * @param {Token} token - The token "class".
   */
  constructor(token) {
    super(token);

    // - Ast subnodes.

    /** @type {Token} */
    this.name = void 0;
    /** @type {Map<string,StructMemberDecl>} */
    this.members = new Map();

    // - Env params.

    /** @type {EnvEntry} */
    this.entry = void 0;
  }

  /**
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} struct - Class statement.
   */
  panic(P, E, struct) {
    // Panic til "}"
    P.moveTil(kTokenReserved.BraceR);
    P.move();
  }

  /**
   * Parse a struct declaration.
   * 
   * <StructStatement>:
   *   struct <Identifier> <StructBlock>
   * 
   * Entry: look -> at "struct"
   * Exit: look -> after <StructBlock>
   * 
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    // Skip "struct".
    var start = P.look;

    P.move();
    P.match(kTokenType.Identifier);

    // Record class name.
    this.name = P.look;

    // Skip class name.
    P.move();

    StructBlock.parse(P, E, this)(P.look);
    var entry = EnvEntry.createStruct(this.name, this);
    E.put(entry);
  }

  /**
   * @param {StructMemberDecl} member
   */
  addMember(member) {
    var name = member.getName();
    if (this.members.has(name))
      this.error(kBulitInExceptions.DuplicatedMember, member.id);

    this.members.set(name, member);
  }

  toString() {
    return "struct " + this.name.raw();
  }
}

module.exports = {
  StructMemberDecl,
  StructStatement
};
