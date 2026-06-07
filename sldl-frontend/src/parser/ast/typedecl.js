/**
 * C-style type declaration parsing.
 *
 * Parses type declarations composed of a base type name followed by an optional
 * C-style declarator (pointers, array dimensions, parenthesised sub-declarators).
 *
 * Grammar:
 *   TypeDeclaration  ::= <Identifier> <TypeDeclarator>
 *   TypeDeclarator   ::= "*" <TypeDeclarator> | <DirectDeclarator>
 *   DirectDeclarator ::= <Identifier> <ArraySuffix>* |
 *                        "(" <TypeDeclarator> ")" <ArraySuffix>*
 *   ArraySuffix      ::= "[" <Constant> "]" | "[" "]"
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kBulitInExceptions } = require("../../exceptions.js");
const { kTokenReserved, kTokenType } = require("../../lexer/token.js");
const { AstNode } = require("./astNode.js");
const { Constant } = require("./expression/constant.js");
const { TypeRef, PointerTo, ArrayOf } = require("../type.js");

/** A reference to a named type (primitive or user-defined). */
class TypeRefNode extends AstNode {
  /**
   * True when P.look is an identifier that names a known type.
   * @param {CompilerParser} P
   * @param {Env} E
   * @returns {boolean}
   */
  static maybe(P, E) {
    if (!P.test(kTokenType.Identifier))
      return false;
    var entry = E.get(P.look);
    return !!(entry && entry.isType());
  }

  /**
   * @param {Token} token
   */
  constructor(token) {
    super(token);

    /**
     * The symbol-table entry for this type.
     * @type {EnvEntry}
     */
    this.def = void 0;
  }

  /**
   * Parse a type name.
   *
   * Entry: look -> Identifier for the type name.
   * Exit:  look -> token after the identifier.
   *
   * @param {CompilerParser} P
   * @param {Env} E
   */
  syntax(P, E) {
    P.match(kTokenType.Identifier);
    this.relocate(P.look);

    var def = E.get(P.look);
    if (!def)
      throw kBulitInExceptions.InvalidType.from(P.look);
    this.def = def;

    P.move();
  }
}

/**
 * Parses a C-style declarator: leading pointers, a direct declarator
 * (name + array suffixes, or a parenthesised sub-declarator + array suffixes),
 * and applies pointer indirection with the correct precedence
 * ([] binds tighter than *).
 */
class TypeDeclarator extends AstNode {
  /**
   * True when P.look starts any declarator form.
   * @param {CompilerParser} P
   * @param {Env} E
   * @returns {boolean}
   */
  static maybe(P, E) {
    return P.test(kTokenReserved.Mul)
      || P.test(kTokenType.Identifier)
      || P.test(kTokenReserved.ParenL);
  }

  /**
   * @param {Token} [token]
   */
  constructor(token) {
    super(token);

    /**
     * The full type chain (innermost base to outermost wrapper).
     * @type {Typedef}
     */
    this.typedef = void 0;

    /**
     * The variable / field name token, if one was parsed.
     * @type {Token}
     */
    this.name = void 0;
  }

  /**
   * Parse a C-style declarator.
   *
   * <TypeDeclarator>:
   *   * <TypeDeclarator>
   *   <DirectDeclarator>
   *
   * <DirectDeclarator>:
   *   <Identifier> <ArraySuffix>*
   *   ( <TypeDeclarator> ) <ArraySuffix>*
   *
   * Entry: look -> first token of declarator ("*", "(", or identifier).
   * Exit:  look -> after the last token of the declarator.
   *
   * @param {CompilerParser} P
   * @param {Env} E
   * @param {Typedef} base - the base type (TypeRef) to wrap.
   * @returns {boolean}
   */
  syntax(P, E, base) {
    // ---- collect leading pointers ----
    // Pointers are innermost modifiers - they wrap the base type directly.
    // Arrays are outermost - they wrap pointers.
    // E.g. "*p[10]" -> ArrayOf(PointerTo(base), 10).
    var ptrCount = 0;
    while (P.test(kTokenReserved.Mul)) {
      ptrCount++;
      P.move();
    }

    var resultType;

    if (P.test(kTokenReserved.ParenL)) {
      // ---- ( <TypeDeclarator> ) <ArraySuffix>* ----
      P.move();

      var inner = TypeDeclarator.parse(P, E, base)(P.look);
      this.name = inner.name;
      resultType = inner.typedef;

      P.match(kTokenReserved.ParenR);
      P.move();

      // Outer array suffixes go inside the inner chain (at the leaf).
      // E.g. "(*p)[10]" -> inner = PointerTo(base), outer [10] wraps
      // the leaf (base) -> PointerTo(ArrayOf(base, 10)).
      while (P.test(kTokenReserved.BracketL))
        resultType = this.wrapLeaf(resultType, this.parseArraySuffix(P, E));

      // Remaining leading pointers also wrap innermost.
      for (var i = 0; i < ptrCount; i++)
        resultType = new PointerTo(resultType, this);
    } else {
      // ---- <Identifier> <ArraySuffix>* ----
      P.match(kTokenType.Identifier);
      this.name = P.look;
      this.relocate(this.name);
      P.move();

      // Apply pointers first (innermost, closest to base type).
      resultType = base;
      for (var i = 0; i < ptrCount; i++)
        resultType = new PointerTo(resultType, this);

      // Apply array suffixes (outermost, closest to variable name).
      resultType = this.parseArraySuffixes(P, E, resultType);
    }

    this.typedef = resultType;
    return this;
  }

  /**
   * Parse one array suffix and return an ArrayOf factory.
   *
   * <ArraySuffix>:
   *   [ <Constant> ]
   *   [ ]
   *
   * @param {CompilerParser} P
   * @param {Env}            E
   * @returns {ArrayOf}
   */
  parseArraySuffix(P, E) {
    P.move();  // past "["

    var count = 0;
    if (!P.test(kTokenReserved.BracketR)) {
      var cNode = Constant.parse(P, E)(P.look);
      if (cNode)
        count = cNode.getValue();
    }

    P.match(kTokenReserved.BracketR);
    P.move();  // past "]"

    return new ArrayOf(null, count, this);
  }

  /**
   * Wrap the leaf node of a type chain.
   * Walks to the innermost child and replaces it with `wrapper`.
   * The wrapper's `.child` is set to the old leaf.
   *
   * @param {Typedef} type    - the type chain.
   * @param {Typedef} wrapper - the new node (its child will be set).
   * @returns {Typedef}
   */
  wrapLeaf(type, wrapper) {
    if (!type.child) {
      wrapper.child = type;
      return wrapper;
    }

    var parent = type;
    while (parent.child.child)
      parent = parent.child;
    wrapper.child = parent.child;
    parent.child = wrapper;
    return type;
  }

  /**
   * Parse zero or more array suffixes.
   *
   * @param {CompilerParser} P
   * @param {Env} E
   * @param {Typedef} current - type to wrap with array dimensions.
   * @returns {Typedef}
   */
  parseArraySuffixes(P, E, current) {
    while (P.test(kTokenReserved.BracketL)) {
      P.move();

      var count = 0;
      if (!P.test(kTokenReserved.BracketR)) {
        var cNode = Constant.parse(P, E)(P.look);
        if (cNode)
          count = cNode.getValue();
      }

      current = new ArrayOf(current, count, this);

      P.match(kTokenReserved.BracketR);
      P.move();
    }
    return current;
  }
}

/**
 * Top-level type declaration: a type name followed by an optional C-style
 * declarator.
 *
 * Builds a Typedef chain representing the full type and records the variable
 * / field name if one is present.
 */
class TypeDeclaration extends AstNode {
  constructor() {
    super();

    /**
     * The full type chain: base TypeRef -> ... -> outermost wrapper.
     * @type {Typedef}
     */
    this.typedef = void 0;

    /**
     * The base-type reference node.
     * @type {TypeRefNode}
     */
    this.baseType = void 0;

    /**
     * The declarator node (may be absent for plain type references).
     * @type {TypeDeclarator}
     */
    this.decl = void 0;

    /**
     * The variable / field name token, if a declarator was parsed.
     * @type {Token}
     */
    this.name = void 0;
  }

  /**
   * Parse a complete type declaration.
   *
   * <TypeDeclaration>:
   *   <Identifier> <TypeDeclarator>
   * 
   * Entry: look -> Identifier for the base type name.
   * Exit: look -> after the declarator (or after the type name if no
   *       declarator follows).
   *
   * @param {CompilerParser} P
   * @param {Env} E
   * @returns {boolean}
   */
  syntax(P, E) {
    // Base type name.
    if (!TypeRefNode.maybe(P, E))
      this.error(kBulitInExceptions.Unexpected, P.look);
    this.relocate(P.look);

    this.baseType = TypeRefNode.parse(P, E)(P.look);
    if (!this.baseType)
      this.error(kBulitInExceptions.InvalidType, P.look);

    var base = new TypeRef(this.baseType.def);

    // Optional declarator.
    if (!TypeDeclarator.maybe(P, E))
      // Plain type reference - no pointers, arrays, or name.
      this.typedef = base;

    this.decl = TypeDeclarator.parse(P, E, base)(P.look);
    if (!this.decl)
      this.error(kBulitInExceptions.Unexpected, P.look);

    this.typedef = this.decl.typedef;
    this.name = this.decl.name;
  }

  /**
   * Set an externally-provided identifier (e.g. when the name was parsed
   * before entering the type-declaration sub-grammar).
   * @param {Token} ident
   */
  setIdentifier(ident) {
    this.name = ident;
  }
}

module.exports = {
  TypeRefNode,
  TypeDeclarator,
  TypeDeclaration
};