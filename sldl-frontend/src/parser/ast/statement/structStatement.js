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
   * @param {StructStatement} struct - Class statement.
   * @returns {boolean}
   */
  parse(P, E, struct) {
    try {
      this.syntax(P, E, struct);
      return true;
    } catch (e) {
      P.onerror(e);
      // Panic til ";" or "}"
      P.moveTil(kTokenReserved.Semicolon, kTokenReserved.BraceR);
      if (P.test(kTokenReserved.Semicolon))
        // Prepare for the next member.
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
   * @param {StructStatement} struct - Class statement.
   */
  syntax(P, E, struct) {
    var typeName = P.look
      , typedef = E.get(typeName);

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

    if (!typedef)
      this.error(kBulitInExceptions.InvalidType, typeName);
    if (!typedef.isPrimitive())
      this.error(kBulitInExceptions.StructInvalidMemberType, typeName);

    this.typeName = typeName;
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
   * @param {StructStatement} struct - Class statement.
   */
  syntax(P, E, struct) {
    // "{"
    P.match(kTokenReserved.BraceL);
    P.move();

    while (P.test(kTokenType.Identifier)) {
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

    // Ast subnodes.
    this.name = void 0;
    this.members = new Map();

    // Env params.
    this.entry = void 0;
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
}

module.exports = {
  StructMemberDecl,
  StructStatement
};
