/**
 * Initializer list AST node for named / designated aggregate initializers.
 *
 * Supports C-style designated (.x = 1) and JSON-style named (x: 1) members.
 * Members are stored by name in a Map to prevent duplicates, consistent with
 * ClassStatement and StructStatement.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kBulitInExceptions } = require("../../exceptions.js");
const { kTokenReserved, kTokenType } = require("../../lexer/token.js");
const { AstNode } = require("./astNode.js");
const { Constant } = require("./expression/constant.js");
const { Reference } = require("./expression/reference.js");
const { AddressExpression } = require("./expression/addressExpression.js");

// ---------------------------------------------------------------------------
// InitMember
// ---------------------------------------------------------------------------

/** Represents a single named member inside an InitList. */
class InitMember extends AstNode {
  constructor() {
    super();

    /**
     * Property name token.
     * @type {Token}
     */
    this.name = void 0;
    /**
     * Value expression.
     * @type {AstNode}
     */
    this.value = void 0;
  }

  /**
   * Get the member name as a string.
   * @returns {string}
   */
  getName() {
    return this.name ? this.name.raw() : "";
  }
}

// ---------------------------------------------------------------------------
// InitList
// ---------------------------------------------------------------------------

/** Represents a brace-enclosed named initializer  { ... }. */
class InitList extends AstNode {
  /**
   * @param {Token} token - Token "{"
   */
  constructor(token) {
    super(token);

    /**
     * Named members, keyed by member name string.
     * @type {Map<string, InitMember>}
     */
    this.members = new Map();
  }

  /**
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {EnvEntry} [typeEntry] - Target struct/class type for validation.
   */
  panic(P, E, typeEntry) {
    // Panic til "}"
    P.moveTil(kTokenReserved.BraceR);
    P.move();
  }

  /**
   * Parse a brace-enclosed named initializer list.
   *
   * <InitList>:
   *   { }
   *   { <InitListMembers> }
   *
   * <InitListMembers>:
   *   <InitMember>
   *   <InitMember> , <InitListMembers>
   *
   * <InitMember>:
   *   . <Identifier> = <Expression>
   *   <Identifier> : <Expression>
   *
   * Entry: look -> "{"
   * Exit: look -> after "}"
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {EnvEntry} [typeEntry] - Target type for member validation.
   */
  syntax(P, E, typeEntry) {
    // "{"
    P.match(kTokenReserved.BraceL);
    this.relocate(P.look);
    P.move();

    // Empty list: { }
    if (P.test(kTokenReserved.BraceR)) {
      P.move();
      return;
    }

    // Non-empty list.
    while (true) {
      this._parseMember(P, E, typeEntry);

      if (!P.test(kTokenReserved.Comma))
        break;
      P.move();

      if (P.test(kTokenReserved.BraceR))
        break;
    }

    // "}"
    P.match(kTokenReserved.BraceR);
    P.move();
  }

  // -- internal ------------------------------------------------------------

  /**
   * Parse and register a single named initializer member.
   *
   * <InitMember>:
   *   . <Identifier> = <Expression>
   *   <Identifier> : <Expression>
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {EnvEntry} [typeEntry] - Target type for validation.
   */
  _parseMember(P, E, typeEntry) {
    var member = new InitMember();

    // C-style designated: .name = value
    if (P.test(kTokenReserved.Dot)) {
      // Skip "."
      P.move();

      P.match(kTokenType.Identifier);
      member.name = P.look;
      member.relocate(member.name);

      // Skip name.
      P.move();

      // "="
      P.match(kTokenReserved.Assign);
      P.move();

      member.value = this._parseValue(P, E);
      this.addMember(member, typeEntry);
      return;
    }

    // JSON-style named: name : value
    if (P.test(kTokenType.Identifier)) {
      member.name = P.look;
      member.relocate(member.name);

      // Skip name.
      P.move();

      // ":"
      P.match(kTokenReserved.Colon);
      P.move();

      member.value = this._parseValue(P, E);
      this.addMember(member, typeEntry);
      return;
    }

    throw kBulitInExceptions.Unexpected.from(P.look);
  }

  /**
   * Parse a value expression inside an initializer.
   *
   * <Value>:
   *   <Constant>
   *   <Reference>
   *   <AddressExpression>
   *   <InitList>
   *   <ArrayInit>
   *
   * @param {CompilerParser} P - Parser.
   * @param {Env} E - Symbol table.
   * @returns {AstNode}
   */
  _parseValue(P, E) {
    // Address-of expression.
    if (P.test(kTokenReserved.And)) {
      return AddressExpression.parse(P, E)(P.look);
    }

    // Nested init list.
    if (P.test(kTokenReserved.BraceL)) {
      var nested = new InitList(P.look);
      nested.syntax(P, E);
      return nested;
    }

    // Nested array init.
    if (P.test(kTokenReserved.BracketL)) {
      var { ArrayInit } = require("./arrayInit.js");
      var arr = new ArrayInit(P.look);
      arr.syntax(P, E);
      return arr;
    }

    // Numeric literal.
    if (P.test(kTokenType.Number)) {
      return Constant.parse(P, E)(P.look);
    }

    // String literal.
    if (P.test(kTokenType.String)) {
      return Constant.parse(P, E)(P.look);
    }

    // Boolean literal.
    if (P.test(kTokenReserved.True) || P.test(kTokenReserved.False)) {
      return Constant.parse(P, E)(P.look);
    }

    // Identifier reference.
    if (P.test(kTokenType.Identifier)) {
      return Reference.parse(P, E)();
    }

    throw kBulitInExceptions.Unexpected.from(P.look);
  }

  // -- member management ---------------------------------------------------

  /**
   * Add a member, checking for duplicates and validating against the type
   * definition when available.
   *
   * @param {InitMember} member
   * @param {EnvEntry} [typeEntry] - Target struct/class type entry.
   */
  addMember(member, typeEntry) {
    var name = member.getName();

    // Prevent duplicate member names.
    if (this.members.has(name))
      this.error(kBulitInExceptions.DuplicatedMember, member.name);

    // Type checking against the target struct / class.
    if (typeEntry && typeEntry.node) {
      var typeMembers = typeEntry.node.members;
      // Type members is a Map<string, ClassMemberDecl | StructMemberDecl>.
      if (typeMembers && !typeMembers.has(name))
        this.error(kBulitInExceptions.InvalidType, member.name);
    }

    this.members.set(name, member);
  }
}

module.exports = {
  InitMember,
  InitList
};
