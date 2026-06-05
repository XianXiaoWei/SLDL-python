const kTokenType = Object.freeze({
  Eof: -1,
  Token: 0,
  Number: 1,
  String: 2,
  Identifier: 3
});

class TokenContent {
  /**
   * @param {number} type - Type.
   * @param {string} content - Original string.
   */
  constructor(type, content) {
    this.type = type;
    this.content = content;
  }

  toString() {
    return this.content;
  }
}

/** Numbers. */
class NumericLiteral extends TokenContent {
  /**
   * @param {string} content - Original string.
   * @param {number} value - Number value.
   */
  constructor(content, value) {
    super(kTokenType.Number, content);
    this.value = value
  }

  getValue() {
    return this.value
  }

  isInteger() {
    return Number.isInteger(this.value)
  }

  toString() {
    return this.value.toString()
  }
}

/** Strings. */
class StringLiteral extends TokenContent {
  /**
   * @param {string} content - Original string.
   * @param {string} value - String value without quote.
   */
  constructor(content, value) {
    super(kTokenType.String, content);
    this.value = value
  }

  getValue() {
    return this.value;
  }

  toString() {
    return '"' + this.value + '"'
  }
}

/** Identifiers. */
class Word extends TokenContent {
  /**
   * @param {string} content - Original string.
   */
  constructor(content) {
    super(kTokenType.Identifier, content);
    this.lexeme = content;
  }

  toString() {
    return this.lexeme;
  }
}

/** Boolean. */
class BooleanLiteral extends Word {
  /**
   * @param {string} content - Original string.
   * @param {boolean} value - Value.
   */
  constructor(content, value) {
    super(content);
    this.lexeme = content;
    this.value = value;
  }

  getValue() {
    return this.value;
  }

  toString() {
    return this.lexeme;
  }
}

/** Float constants. */
class FloatConstLiteral extends Word {
  /**
   * @param {string} content - Original string.
   * @param {number} value - Value.
   */
  constructor(content, value) {
    super(content);
    this.lexeme = content;
    this.value = value;
  }

  getValue() {
    return this.value;
  }

  toString() {
    return this.lexeme;
  }
}

class Type extends Word {
  /**
   * @param {string} name - Type name.
   */
  constructor(name) {
    super(name);
  }
}

class Token {
  /**
   * @param {Token} a 
   * @param {Token} b 
   * @returns {boolean}
   */
  static isSameLine(a, b) {
    return a.line == b.line && a.fileSlice == b.fileSlice
  }

  /**
   * @param {Token} a 
   * @param {Token} b 
   * @returns {boolean}
   */
  static equal(a, b) {
    if (
      a.content == b.content
      || a.content.content == b.content.content && a.content.type == b.content.type
    )
      return true;
    return false
  }

  /**
   * @param {TokenContent} tokenContent 
   * @param {number} begin 
   * @param {number} end 
   * @param {FileSlice} fileSlice 
   * @param {number} line 
   * @param {number} column 
   * @param {boolean} first 
   * @param {boolean} spaced 
   */
  constructor(tokenContent, begin, end, fileSlice, line, column, first, spaced) {
    this.content = tokenContent;

    /** Begin position in file. */
    this.begin = begin;
    /** End position in file. */
    this.end = end;

    /** File name. */
    this.fileName = fileSlice.file;
    /** FileSlice object which the token from. */
    this.fileSlice = fileSlice;
    /** Line number in the complete file. */
    this.line = line;
    /** Column number in the line. */
    this.column = column;
    /** The first token in the line. */
    this.first = !!first;
    /** This token is after whitespace. */
    this.spaced = !!spaced;
  }

  toString() {
    return `${this.line + 1}:${this.column + 1}: ${this.content}`;
  }

  raw() {
    return this.content.toString();
  }
}

/** All of the tokens, reserved words and marks. */
const kTokenReserved = Object.freeze({
  Eof: new TokenContent(kTokenType.Eof, ""),

  LogicAnd: new TokenContent(kTokenType.Token, "&&"),
  LogicOr: new TokenContent(kTokenType.Token, "||"),
  AddTo: new TokenContent(kTokenType.Token, "+="),
  SubTo: new TokenContent(kTokenType.Token, "-="),
  MulTo: new TokenContent(kTokenType.Token, "*="),
  DivTo: new TokenContent(kTokenType.Token, "/="),
  ModTo: new TokenContent(kTokenType.Token, "%="),
  Inc: new TokenContent(kTokenType.Token, "++"),
  Dec: new TokenContent(kTokenType.Token, "--"),
  Add: new TokenContent(kTokenType.Token, "+"),
  Sub: new TokenContent(kTokenType.Token, "-"),
  Mul: new TokenContent(kTokenType.Token, "*"),
  Div: new TokenContent(kTokenType.Token, "/"),
  Mod: new TokenContent(kTokenType.Token, "%"),
  Eq: new TokenContent(kTokenType.Token, "=="),
  Neq: new TokenContent(kTokenType.Token, "!="),
  Leq: new TokenContent(kTokenType.Token, "<="),
  Geq: new TokenContent(kTokenType.Token, ">="),
  Lt: new TokenContent(kTokenType.Token, "<"),
  Gt: new TokenContent(kTokenType.Token, ">"),
  Assign: new TokenContent(kTokenType.Token, "="),
  And: new TokenContent(kTokenType.Token, "&"),
  Or: new TokenContent(kTokenType.Token, "|"),
  BracketL: new TokenContent(kTokenType.Token, "["),
  BracketR: new TokenContent(kTokenType.Token, "]"),
  BraceL: new TokenContent(kTokenType.Token, "{"),
  BraceR: new TokenContent(kTokenType.Token, "}"),
  ParenL: new TokenContent(kTokenType.Token, "("),
  ParenR: new TokenContent(kTokenType.Token, ")"),
  Dot: new TokenContent(kTokenType.Token, "."),
  Comma: new TokenContent(kTokenType.Token, ","),
  Question: new TokenContent(kTokenType.Token, "?"),
  Excl: new TokenContent(kTokenType.Token, "!"),
  Colon: new TokenContent(kTokenType.Token, ":"),
  Semicolon: new TokenContent(kTokenType.Token, ";"),

  // Literals.
  True: new BooleanLiteral("true", true),
  False: new BooleanLiteral("false", false),
  Infinity: new FloatConstLiteral("Infinity", Infinity),
  NaN: new FloatConstLiteral("NaN", NaN),

  // Keywords.
  Class: new Word("class"),
  Const: new Word("const"),
  Else: new Word("else"),
  Enum: new Word("enum"),
  Extends: new Word("extends"),
  Extern: new Word("extern"),
  If: new Word("if"),
  Struct: new Word("struct"),
  Var: new Word("var"),

  // Types.
  Bool: new Word("bool"),
  Int8: new Word("int8_t"),
  Uint8: new Word("uint8_t"),
  Int16: new Word("int16_t"),
  Uint16: new Word("uint16_t"),
  Int32: new Word("int32_t"),
  Uint32: new Word("uint32_t"),
  Int64: new Word("int64_t"),
  Uint64: new Word("uint64_t"),
  Float: new Word("float"),
  Double: new Word("double"),
  Cstring: new Word("cstring"),
  TgcString: new Word("TgcString"),
  Object: new Word("Object"),
  Clump: new Word("Clump")
});

const kInternalTypes = Object.freeze({
  Bool: kTokenReserved.Bool,
  Int8: kTokenReserved.Int8,
  Uint8: kTokenReserved.Uint8,
  Int16: kTokenReserved.Int16,
  Uint16: kTokenReserved.Uint16,
  Int32: kTokenReserved.Int32,
  Uint32: kTokenReserved.Uint32,
  Int64: kTokenReserved.Int64,
  Uint64: kTokenReserved.Uint64,
  Float: kTokenReserved.Float,
  Double: kTokenReserved.Double,
  Cstring: kTokenReserved.Cstring,
  TgcString: kTokenReserved.TgcString,
  Object: kTokenReserved.Object,
  Clump: kTokenReserved.Clump
});

module.exports = {
  TokenContent,
  NumericLiteral,
  StringLiteral,
  Word,
  BooleanLiteral,
  FloatConstLiteral,
  Type,
  Token,
  kTokenType,
  kTokenReserved,
  kInternalTypes
};
