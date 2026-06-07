const { kBulitInExceptions } = require("../../../exceptions.js");
const { kTokenReserved, kTokenType, kInternalTypes } = require("../../../lexer/token.js");
const { EnvEntry } = require("../../env.js");
const { AstNode } = require("../astNode.js");
const { Statement } = require("./statement.js");
const { Constant } = require("../expression/constant.js");
const { TypeDeclaration } = require("../typedecl.js");

/** Represents a member variable of a class. */
class ClassMemberDecl extends AstNode {
  constructor() {
    super();

    this.typedef = void 0;
    this.id = void 0;
    this.defaultVal = void 0;
  }

  /**
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
   */
  panic(P, E, clazz) {
    // Panic til ";" or "}"
    P.moveTil(kTokenReserved.Semicolon, kTokenReserved.BraceR);
    if (P.test(kTokenReserved.Semicolon))
      // Prepare for the next member.
      P.move();
  }

  /**
   * Parse a class member declaration.
   *
   * <ClassMember>:
   *   <TypeDeclaration> ;
   *   <TypeDeclaration> = <Literal> ;
   *
   * Entry: look -> <Identifier> for type name.
   * Exit: look -> After ";"
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
   */
  syntax(P, E, clazz) {
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
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
   */
  panic(P, E, clazz) {
    // Panic til "}"
    P.moveTil(kTokenReserved.BraceR);
    P.move();
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
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
   */
  syntax(P, E, clazz) {
    // "{"
    P.match(kTokenReserved.BraceL);
    P.move();

    while (
      P.test(kTokenType.Identifier)
      && !P.test(kTokenReserved.Class)
      && !P.test(kTokenReserved.Struct)
    ) {
      var decl = ClassMemberDecl.parse(P, E, clazz)();
      if (decl)
        // Skip incomplete member.
        clazz.addMember(decl);
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

    // - Ast subnodes.

    /** @type {Token} */
    this.name = void 0;
    /** @type {Map<string,ClassMemberDecl>} */
    this.members = new Map();

    // - Env params.

    /** @type {EnvEntry} */
    this.parent = void 0;
    /** @type {EnvEntry} */
    this.entry = void 0;
  }

  /**
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {ClassStatement} clazz - Class statement.
   */
  panic(P, E, clazz) {
    // Panic til "}"
    P.moveTil(kTokenReserved.BraceR);
    P.move();
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
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    // Skip "class".
    var start = P.look;

    P.move();
    P.match(kTokenType.Identifier);

    // Record class name.
    this.name = P.look;
    if (E.get(this.name))
      throw kBulitInExceptions.MultipleDefinition.from(this.name);

    // Skip class name.
    P.move();

    // Process extends.
    var parentName = kInternalTypes.Object;
    if (P.content == kTokenReserved.Extends) {
      P.move();
      P.match(kTokenType.Identifier);
      parentName = P.look;
      P.move();
    }

    // Process parent.
    var parent = E.get(parentName);
    if (!parent || !parent.isType())
      throw kBulitInExceptions.InvalidType.from(parentName);

    if (!parent.isExtendable())
      throw kBulitInExceptions.ClassInvalidParentType.from(parentName);

    // Merge the member variables from the parent.
    if (parent.node && parent.node.members)
      for (var kv of parent.node.members)
        this.members.set(kv[0], kv[1]);

    // Set the parent class.
    this.parent = parent;

    // Parse members.
    ClassBlock.parse(P, E, this)(P.look);

    // Register into the symbol table.
    var entry = EnvEntry.createClass(this.name, this);
    this.entry = entry;
    E.inherit(entry, parent.ident);
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

  toString() {
    return "class " + this.name.raw();
  }
}

module.exports = {
  ClassMemberDecl,
  ClassStatement
};
