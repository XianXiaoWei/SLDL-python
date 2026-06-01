const { FileSlice } = require("sldl-utils");
const { CompilerLexer } = require("../lexer/lexer.js");
const { TokenContent, kTokenType, kTokenReserved, Token, kPrimitiveTypes } = require("../lexer/token.js");
const { AstNode } = require("./ast/astNode.js");
const { ClassBlock, ClassMemberDecl, ClassStatement } = require("./ast/statement/classStatement.js");
const { Env, EnvEntry, Typedef } = require("./env.js");

function createEnvEntryType(content) {
  var token = new Token(
    content,
    0,
    0,
    FileSlice.Null,
    0,
    0,
    false,
    false
  );
  return new Typedef(token, new AstNode(token));
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
  env.put(createEnvEntryType(kPrimitiveTypes.Cstring));
  env.put(createEnvEntryType(kPrimitiveTypes.TgcString));
}

class CompilerParser {
  /**
   * @param {FileSlice|string} input
   */
  constructor(input) {
    this.lexer = new CompilerLexer(input);

    /** Stores all symbols (types, objects, identifiers). */
    this.env = new Env();
    this.look = void 0;
    this.done = false;

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
      throw new Error("unexpected " + this.content);
  }

  toplevel() {
    while (!this.done) {
      if (this.test(kTokenReserved.Class)) {
        var clazz = this.stmtClass();
        this.env.put(new Typedef(clazz.name, clazz));
      }
    }
  }

  /**
   * Parse a class statement.
   * 
   * <ClassStatement>:
   *   class <Identifier> <ClassBlock>
   *   class <Identifier> extends <Identifier> <ClassBlock>
   * 
   * Entry: at "class"
   * Exit: after <ClassBlock>
   * 
   * @returns {ClassStatement}
   */
  stmtClass() {
    // Skip "class".
    var start = this.look;

    this.move();
    this.match(kTokenType.Identifier);

    // Record class name.
    var className = this.look
      , parentClassDef = void 0;

    // Skip class name.
    this.move();

    // Process extends.
    if (this.content == kTokenReserved.Extends) {
      this.move();
      this.match(kTokenType.Identifier);
      var parentClassName = this.look;
      this.move();

      parentClassDef = this.env.get(parentClassName);
      if (!parentClassDef || !parentClassDef.isType())
        throw new Error("unrecognized type " + parentClassName.raw());
    }

    var result = new ClassStatement(start, className, parentClassDef);

    this.blockClass(result);

    return result;
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
   * <ClassMember>:
   *   <Identifier> <Identifier> ;
   *   <Identifier> <Identifier> = <Literal> ;
   * 
   * Entry: look -> at "{"
   * Exit: look -> after "}"
   * 
   * @param {ClassStatement} clazz 
   * @returns {ClassStatement}
   */
  blockClass(clazz) {
    // "{"
    this.match(kTokenReserved.BraceL);
    this.move();

    while (this.test(kTokenType.Identifier)) {
      var typeName = this.look
        , memberName
        , defaultValue;

      // Member name.
      this.move();
      this.match(kTokenType.Identifier);
      memberName = this.look;

      // Skip member name.
      this.move();

      if (this.test(kTokenReserved.Assign)) {
        // Default value.
        this.move();
        defaultValue = this.exprConstant();
        this.move();
      }

      // ";"
      this.match(kTokenReserved.Semicolon);
      this.move();

      // Add member to class.
      var typedef = this.env.get(typeName);
      if (!typedef || !typedef.isType())
        throw new Error("unrecognized type " + typeName.content);

      clazz.addMember(new ClassMemberDecl(typedef, memberName, defaultValue));
    }

    // "}"
    this.match(kTokenReserved.BraceR);
    this.move();

    return clazz;
  }

  /**
   * 
   */
  exprConstant() {

  }
}

var a = new CompilerParser("class A { uint32_t a; }class B extends A { uint32_t v; }");
a.toplevel();
