const { kBulitInExceptions } = require("sldl-utils");
const { kTokenReserved, kTokenType } = require("../../../lexer/token.js");
const { EnvEntry } = require("../../env.js");
const { AstNode } = require("../astNode.js");
const { Statement } = require("./statement.js");

/** Represents a member variable of a class. */
class StructMemberDecl extends AstNode {
  constructor() {
    super();

    this.typeName = void 0;
    this.id = void 0;
    this.defaultVal = void 0;
  }

  /**
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} clazz - Class statement.
   * @returns {boolean}
   */
  parse(P, E, clazz) {
    try {
      this.syntax(P, E, clazz);
      return true;
    } catch (e) {
      P.onerror(e);
      // Panic til ";"
      P.moveTil(kTokenReserved.Semicolon);
      P.move();
      return false;
    }
  }

  /**
   * Parse a class member declaration.
   * 
   * <StructMember>:
   *   <Identifier> <Identifier> ;
   *   <Identifier> <Identifier> = <Literal> ;
   * 
   * Entry: look -> <Identifier> for type name.
   * Exit: look -> After ";"
   * 
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} clazz - Class statement.
   */
  syntax(P, E, clazz) {
    var typeName = P.look
      , typedef = E.get(typeName);

    if (!typedef || !typedef.isPrimitive())
      this.error(kBulitInExceptions.InvalidType, typeName);

    this.typeName = typeName;

    // Member name.
    P.move();
    P.match(kTokenType.Identifier);
    this.id = P.look;
    this.relocate(this.id);

    // Skip member name.
    P.move();

    if (P.test(kTokenReserved.Assign)) {
      // Default value.
      P.move();
      this.defaultVal = P.exprConstant();
      P.move();
    }

    // ";"
    P.match(kTokenReserved.Semicolon);
    P.move();
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
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} clazz - Class statement.
   * @returns {boolean}
   */
  parse(P, E, clazz) {
    try {
      this.syntax(P, E, clazz);
      return true;
    } catch (e) {
      P.onerror(e);
      // Panic til "}"
      P.moveTil(kTokenReserved.BraceR);
      P.move();
      return false;
    }
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
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} clazz - Class statement.
   */
  syntax(P, E, clazz) {
    // "{"
    P.match(kTokenReserved.BraceL);
    P.move();

    while (P.test(kTokenType.Identifier)) {
      var decl = new StructMemberDecl();
      if (decl.parse(P, E, clazz)) {
        // Add member to class.
        clazz.addMember(decl);
      }
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

    this.name = void 0;
    this.members = new Map();
  }

  /**
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {StructStatement} struct - Class statement.
   * @returns {boolean}
   */
  parse(P, E, struct) {
    try {
      this.syntax(P, E, struct);
      return true;
    } catch (e) {
      P.onerror(e);
      // Panic til "}"
      P.moveTil(kTokenReserved.BraceR);
      P.move();
      return false;
    }
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
   * @param {Parser} P - Parser.
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

    new StructBlock(P.look).parse(P, E, this);
    E.put(EnvEntry.createStruct(this.name, this));
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
}

module.exports = {
  StructMemberDecl,
  StructStatement
};
