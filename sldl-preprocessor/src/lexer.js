const { FileSlice } = require("sldl-utils");

class PreprocessTokenContent {
  static Type = {
    TOKEN: 0,
    WORD: 1,
    HASH: 2,
    STRING: 3
  };
  static Reserved = {
    LT: new PreprocessTokenContent(this.Type.TOKEN, "<"),
    LE: new PreprocessTokenContent(this.Type.TOKEN, "<="),
    EQ: new PreprocessTokenContent(this.Type.TOKEN, "=="),
    BT: new PreprocessTokenContent(this.Type.TOKEN, ">"),
    BE: new PreprocessTokenContent(this.Type.TOKEN, ">="),
    NE: new PreprocessTokenContent(this.Type.TOKEN, "!="),

    CONN: new PreprocessTokenContent(this.Type.TOKEN, "##"),
    LOGIC_AND: new PreprocessTokenContent(this.Type.TOKEN, "&&"),
    LOGIC_OR: new PreprocessTokenContent(this.Type.TOKEN, "||"),
    LOGIC_NOT: new PreprocessTokenContent(this.Type.TOKEN, "!"),

    HASH_DEFINE: new PreprocessTokenContent(this.Type.HASH, "#define"),
    HASH_UNDEF: new PreprocessTokenContent(this.Type.HASH, "#undef"),
    HASH_INCLUDE: new PreprocessTokenContent(this.Type.HASH, "#include"),
    HASH_IF: new PreprocessTokenContent(this.Type.HASH, "#if"),
    HASH_IFDEF: new PreprocessTokenContent(this.Type.HASH, "#ifdef"),
    HASH_ENDIF: new PreprocessTokenContent(this.Type.HASH, "#endif"),
    HASH_ELSE: new PreprocessTokenContent(this.Type.HASH, "#else"),
    HASH_ELIF: new PreprocessTokenContent(this.Type.HASH, "#elif"),
    HASH_IFNDEF: new PreprocessTokenContent(this.Type.HASH, "#ifndef"),
    HASH_DUP: new PreprocessTokenContent(this.Type.HASH, "#dup"),
    HASH_ENDDUP: new PreprocessTokenContent(this.Type.HASH, "#enddup")
  }

  constructor(type, content) {
    this.type = type;
    this.content = content;
  }

  toString() {
    return this.content
  }
}

class PreprocessToken {
  /**
   * @param {PreprocessToken} a 
   * @param {PreprocessToken} b 
   * @returns {boolean}
   */
  static isSameLine(a, b) {
    return a.line == b.line && a.fileSlice == b.fileSlice
  }

  /**
   * @param {PreprocessToken} a 
   * @param {PreprocessToken} b 
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
   * @param {PreprocessTokenContent} tokenContent 
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
    /** FileSlice object the token from. */
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

  /**
   * Get the raw string of this token.
   * @returns {string}
   */
  getRaw() {
    return this.content.content
  }

  /**
   * Get the type of the token content.
   * @returns {number}
   */
  getType() {
    return this.content.type
  }

  toString() {
    return `<${this.content}> L${this.line} P${this.begin}-${this.end}`
  }
}

class PreprocessLexer {
  static getLineOf(lexer, line) {
    return lexer.original.split("\n")[line]
  }

  /**
   * @param {FileSlice|string} input 
   */
  constructor(input) {
    if (!(input instanceof FileSlice))
      input = FileSlice.fromFile("", input, 0);

    this.original = input;
    this.currentFile = input;
    // Convert input to an char array, in order to support unicode.
    this.string = Array.from(this.currentFile.getContent());
    this.line = this.column = this.columnEnd = 0;
    this.cursor = -1;
    this.readingVaniCmd = 0;
    this.peek = " ";
    this.begin = 0;
    this.isFirstInLine = 1;
    this.afterWhitespace = 0;
    this.look = void 0;

    this.reserved = new Map();
  }

  buildToken(content, type) {
    var r;
    if (!(content instanceof PreprocessTokenContent))
      content = new PreprocessTokenContent(type, content);
    r = new PreprocessToken(
      content,
      this.begin,
      this.begin + content.content.length,
      this.currentFile,
      this.line + this.currentFile.parentLine,
      this.column,
      this.isFirstInLine,
      this.afterWhitespace
    );
    // Once you build a token from this line, the next token(s) won't be the
    // first token in the line.
    this.isFirstInLine = 0;
    this.look = r;
    return r
  }

  done() {
    return this.cursor >= this.string.length && !this.currentFile.next
  }

  isUnquotedStringStart() {
    return /[\p{ID_Start}_]/u.test(this.peek)
  }

  isUnquotedString() {
    return /[\p{ID_Continue}]/u.test(this.peek)
  }

  isWhitespace() {
    return /[\u0009\u000B\u000C\uFEFF\p{Space_Separator}]/u.test(this.peek)
  }

  readch(c) {
    if (this.cursor >= this.string.length && this.currentFile.next) {
      // Switch to the next file.
      this.currentFile = this.currentFile.next;
      this.cursor = -1;
      this.line = this.column = this.columnEnd = 0;
      this.peek = " ";
      this.isFirstInLine = 1;
      this.string = Array.from(this.currentFile.getContent());
    }

    if (!this.done()) {
      this.cursor++;
      this.columnEnd++;
      this.peek = this.string[this.cursor];
      if (this.peek != c)
        return false;
      this.peek = " ";
      return true
    }
  }

  isch(c) {
    if (this.peek != c)
      return false;
    this.peek = " ";
    return true
  }

  skipWhitespace() {
    var result = 0;
    for (; !this.done(); this.readch()) {
      if (this.isWhitespace()) {
        result = 1;
        continue;
      } else if (this.peek == "\n") {
        result = 1;
        this.line++;
        // It will consider "\n" as the first element in the line because of
        // the trailing this.readch() function, so we need to set the column
        // counter to -1, set the character after "\n" as the first character.
        this.columnEnd = this.column = -1;
        this.isFirstInLine = 1
      } else
        return result;
    }
    return result
  }

  /**
   * Skip the current line.
   */
  skipLine() {
    while (!this.peek != "\n")
      this.readch();
  }

  /**
   * Scan the next token.
   * @returns {PreprocessToken}
   */
  scan() {
    this.afterWhitespace = this.skipWhitespace();
    if (this.done())
      return void 0;

    // Start reading, record current cursor.
    this.begin = this.cursor;
    this.column = this.columnEnd;

    // Read tokens.
    switch (this.peek) {
      case '&':
        if (this.readch('&'))
          return this.buildToken(PreprocessTokenContent.Reserved.LOGIC_AND);
        return this.buildToken('&', 0);
      case '|':
        if (this.readch('|'))
          return this.buildToken(PreprocessTokenContent.Reserved.LOGIC_OR);
        return this.buildToken('|', 0);
      case '=':
        if (this.readch('='))
          return this.buildToken(PreprocessTokenContent.Reserved.EQ);
        if (this.isch('>'))
          return this.buildToken("=>", 0);
        return this.buildToken('=', 0);
      case '!':
        if (this.readch('='))
          return this.buildToken(PreprocessTokenContent.Reserved.NE);
        return this.buildToken('!', 0);
      case '<':
        if (this.readch('='))
          return this.buildToken(PreprocessTokenContent.Reserved.LE);
        return this.buildToken(PreprocessTokenContent.Reserved.LT);
      case '>':
        if (this.readch('='))
          return this.buildToken(PreprocessTokenContent.Reserved.BE);
        return this.buildToken(PreprocessTokenContent.Reserved.BT);
      case '-':
        if (this.readch('>'))
          return this.buildToken("->", 0);
        else if (this.isch('-'))
          return this.buildToken("--", 0);
        else if (this.isch('='))
          return this.buildToken("-=", 0);
        return this.buildToken('-', 0);
      case '+':
        if (this.readch('+'))
          return this.buildToken("++", 0);
        else if (this.isch('='))
          return this.buildToken("+=", 0);
        return this.buildToken('+', 0);
      case '*':
        if (this.readch('='))
          return this.buildToken("*=", 0);
        return this.buildToken('*', 0);
      case '/':
        if (this.readch('='))
          return this.buildToken("/=", 0);
        return this.buildToken('/', 0);
      case '%':
        if (this.readch('='))
          return this.buildToken("%=", 0);
        return this.buildToken('%', 0);
    }
    // Read identifier.
    if (this.isUnquotedStringStart()) {
      var b = this.readStringUnquoted();
      return this.buildToken(b, 1);
    }
    // Read number.
    if (/\d/.test(this.peek))
      return this.buildToken(this.readNumber(), 0);
    // Read connector `##` in macro or preprocessor statement.
    if (this.peek == "#") {
      if (this.readch("#"))
        return this.buildToken(PreprocessTokenContent.Reserved.CONN);
      return this.readHash()
    }
    // Read vanilla Minecraft command literal.
    if (this.peek == "`" && !this.readingVaniCmd)
      return this.buildToken(this.readVaniCmd(), 0);
    if (this.peek == "}" && this.readingVaniCmd)
      return this.buildToken(this.readVaniCmd(), 0);
    // Read string literal.
    if (this.peek == '"')
      return this.buildToken("\"" + this.readStringUntil('"') + "\"", 3);
    // Read selector literal.
    if (this.peek == '@')
      return this.buildToken("@" + this.readStringUnquoted(), 0);
    if (this.done())
      return void 0;
    // Unknown token.
    var t = this.buildToken(this.peek, 0);
    this.peek = " ";
    return t
  }

  /**
   * Implements JS iterator.
   * @returns
   */
  next() {
    var d = this.done();
    return {
      value: this.scan(),
      done: d
    }
  }

  /**
   * Implements numeric literal reader.
   * @returns {string}
   */
  readNumber() {
    var o = "";
    do {
      o += this.peek;
      this.readch()
    } while (/\d/.test(this.peek))
    if (this.peek != ".")
      return o;
    o += ".";
    for (; !this.done();) {
      this.readch();
      if (!/\d/.test(this.peek))
        break;
      o += this.peek;
    }
    return o
  }

  /**
   * Implements quoted string reader.
   * @returns {string}
   */
  readStringUntil(terminator) {
    var result = ""
      , escaped = false;
    while (!this.done()) {
      this.readch();
      if (escaped) {
        if (this.peek == "n")
          result += "\n";
        else
          result += peek;
        escaped = false;
      } else if (this.peek == "\\")
        escaped = true;
      else if (this.peek == terminator)
        return this.readch(), result;
      else
        result += this.peek;
    }
  }

  /**
   * Implements identifier reader.
   * @returns {string}
   */
  readStringUnquoted() {
    var result = "";
    if (!this.isUnquotedStringStart())
      return "";
    result += this.peek;
    while (!this.done()) {
      this.readch();
      if (!this.isUnquotedString())
        break;
      result += this.peek;
    }
    return result
  }

  /**
   * Implements Minecraft command reader.
   * @returns {string}
   */
  readVaniCmd() {
    var result = ""
      , escaped = !1;
    result += this.readingVaniCmd ? "}" : "`";
    this.readingVaniCmd = true;
    while (!this.done()) {
      this.readch();
      if (escaped) {
        if (this.peek == "n")
          result += "\n";
        else
          result += this.peek;
        escaped = !1;
      } else if (this.peek == "\\")
        escaped = !0;
      else if (this.peek == "$") {
        this.readch();
        if (this.peek == "{") {
          this.readch();
          return result + "${";
        }
        result += "$" + this.peek;
      } else if (this.peek == "`") {
        this.readch();
        this.readingVaniCmd = false;
        return result + "`";
      } else
        result += this.peek;
    }
  }

  /**
   * Implements preprocess marker reader.
   * @returns {string}
   */
  readHash() {
    var id = this.readStringUnquoted();
    switch (id) {
      case "define":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_DEFINE);
      case "undef":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_UNDEF);
      case "include":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_INCLUDE);
      case "if":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_IF);
      case "ifdef":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_IFDEF);
      case "endif":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_ENDIF);
      case "else":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_ELSE);
      case "elif":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_ELIF);
      case "ifndef":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_IFNDEF);
      case "dup":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_DUP);
      case "enddup":
        return this.buildToken(PreprocessTokenContent.Reserved.HASH_ENDDUP);
      default:
        return this.buildToken("#" + id)
    }
  }
}

module.exports = {
  PreprocessTokenContent,
  PreprocessToken,
  PreprocessLexer
};
