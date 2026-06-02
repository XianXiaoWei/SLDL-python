const { kBulitInExceptions } = require("sldl-utils");
const { kTokenReserved, kTokenType } = require("../../../lexer/token.js");
const { EnvEntry } = require("../../env.js");
const { AstNode } = require("../astNode.js");
const { Statement } = require("./statement.js");

/** Represents a member variable of a class. */
class ClassMemberDecl extends AstNode {
  constructor() {
    super();

    this.typeName = void 0;
    this.id = void 0;
    this.defaultVal = void 0;
  }

  /**
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
   * @returns {boolean}
   */
  parse(P, E, clazz) {
    try {
      this.syntax(P, E, clazz);
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
   * <ClassMember>:
   *   <Identifier> <Identifier> ;
   *   <Identifier> <Identifier> = <Literal> ;
   * 
   * Entry: look -> <Identifier> for type name.
   * Exit: look -> After ";"
   * 
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
   */
  syntax(P, E, clazz) {
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

    if (!typedef || !typedef.isType())
      this.error(kBulitInExceptions.InvalidType, typeName);

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
class ClassBlock extends AstNode {
  /**
   * @param {Token} token - Token "{"
   */
  constructor(token) {
    super(token);
  }

  /**
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
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
   * <ClassBlock>:
   *   { <ClassMembers> }
   * 
   * <ClassMembers>:
   *   <ClassMember> <ClassMembers>
   *   <ClassMember>
   * 
   * Entry: look -> at "{"
   * Exit: look -> after "}"
   *
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
   */
  syntax(P, E, clazz) {
    // "{"
    P.match(kTokenReserved.BraceL);
    P.move();

    while (P.test(kTokenType.Identifier)) {
      var decl = new ClassMemberDecl();
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
class ClassStatement extends Statement {
  /**
   * @param {Token} token - The token "class".
   */
  constructor(token) {
    super(token);

    this.name = void 0;
    this.parent = void 0;
    this.members = new Map();
  }

  /**
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
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
   * Parse a class declaration.
   * 
   * <ClassStatement>:
   *   class <Identifier> <ClassBlock>
   *   class <Identifier> extends <Identifier> <ClassBlock>
   * 
   * Entry: at "class"
   * Exit: after <ClassBlock>
   * 
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    // Skip "class".
    var start = P.look;

    P.move();
    P.match(kTokenType.Identifier);

    // Record class name.
    this.name = P.look;

    // Skip class name.
    P.move();

    // Process extends.
    if (P.content == kTokenReserved.Extends) {
      P.move();
      P.match(kTokenType.Identifier);
      var parentClassName = P.look;
      P.move();

      var parent = E.get(parentClassName);
      if (!parent || !parent.isType())
        throw kBulitInExceptions.InvalidType.from(parentClassName);

      if (!parent.isExtendable())
        throw kBulitInExceptions.ClassInvalidParentType.from(parentClassName);

      // Merge the member variables of the parent.
      for (var kv of parent.node.members)
        this.members.set(kv[0], kv[1]);

      this.parent = parent;
    }

    new ClassBlock(P.look).parse(P, E, this);
    E.put(EnvEntry.createClass(this.name, this));
  }

  /**
   * @param {ClassMemberDecl} member
   */
  addMember(member) {
    var name = member.getName();
    if (this.members.has(name))
      throw kBulitInExceptions.DuplicatedMember.from(member.id);

    this.members.set(name, member);
  }
}

module.exports = {
  ClassMemberDecl,
  ClassStatement
};
