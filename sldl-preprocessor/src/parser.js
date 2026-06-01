const pl = require("path")
const {
  PreprocessLexer,
  PreprocessToken,
  PreprocessTokenContent
} = require("./lexer.js");
const {
  PreprocessContext,
  PreprocessError,
  SimplePreprocessErrorBuilder,
  BuiltinPreprocessError
} = require("./errors.js");
const { FileInterface } = require("./file/file.js");
const { FileSlice } = require("./file/slice.js");

/**
 * Discard comments and replace them with an equal number of blank lines.
 * @param {FileSlice} file - Input file.
 * @returns {FileSlice}
 */
function discardComment(file) {
  var input = file.getContent()
    , cursor = 0
    , state = 0
    , line = ""
    , string = ""
    , result = FileSlice.copy(file);

  // Normalize line feed to LF.
  input = input.replace(/\r\n/g, "\n");
  // Replace single line comments.
  input = input.replace(/\/\/.*\r?\n/g, "\n");

  // Replace block comments to empty lines.
  while (cursor < input.length) {
    if (!state && input[cursor] == "/" && input[cursor + 1] == "*") {
      state = 1;
      line = "";
      cursor++;
    } else if (state == 1) {
      if (input[cursor] == "\n")
        line += "\n";
      else if (input[cursor] == "*" && input[cursor + 1] == "/") {
        state = 0;
        string += line;
        cursor++;
      }
    } else if (!state)
      string += input[cursor];
    cursor++;
  }

  result.content = string.split("\n");

  return result
}

/**
 * Process `#include` statement, combine the included files to a single
 * `FileSlice` object.
 * @param {FileSlice} input - Input content processed by `discardComment()`.
 * @param {string[]} paths - Include paths.
 * @param {FileInterface} fileInterface - File accessor.
 * @param {number} nesting - Nesting count.
 * @returns
 */
function processInclude(input, paths, fileInterface, nesting) {
  function move() {
    look = lexer.scan()
  }

  function lookForFile(f) {
    // Find given file through FileInterface.
    for (var p of paths) {
      p = pl.join(p, f);
      if (!fileInterface.existSync(p))
        continue;
      return p
    }
    return void 0
  }

  function seek(f) {
    for (; ; f = f.next)
      if (!f.next)
        return f
  }

  /**
   * Calculate the total line count of a FileSlice chain.
   * @param {FileSlice} s
   * @returns {number}
   */
  function chainSize(s) {
    var total = 0;
    for (; s; s = s.next)
      total += s.size;
    return total
  }

  /**
   * Find the cumulative line offset (0-based) of `target` within the
   * result chain starting at `head`.
   * @param {FileSlice} head
   * @param {FileSlice} target
   * @returns {number}
   */
  function cumStartOf(head, target) {
    var cum = 0;
    for (var s = head; s && s !== target; s = s.next)
      cum += s.size;
    return cum
  }

  var lexer = new PreprocessLexer(input)
    // The processed FileSlice chain.
    , result = FileSlice.copy(input)
    // The FileSlice contains the remain part of input file.
    , remain = result
    , errors = []
    , look, last, filePath, foundFile, file
    , combineResult, e
    // Track how much original line numbers have shifted due to previous
    // insertions.  When an included file of N lines replaces a 1-line
    // `#include`, all subsequent original lines are offset by +N.
    , lineShift = 0;

  nesting = nesting || 0;
  paths.unshift("./");
  for (move(); look; move()) {
    // Preprocess statement must be the first token of a line.
    if (look.content != PreprocessTokenContent.Reserved.HASH_INCLUDE || !look.first)
      continue;

    // Restore the `#include` token, and scan next token.
    last = look;
    move();

    // File name and `#include` must in the same line.
    if (look.content.type != PreprocessTokenContent.Type.STRING) {
      // Encountered unexpected token, skip current line.
      errors.push(BuiltinPreprocessError.UNEXPECTED.create(new PreprocessContext(look, lexer), look));
      lexer.skipLine();
      continue
    } else if (look.line != last.line) {
      errors.push(BuiltinPreprocessError.UNEXPECTED_LF.create(new PreprocessContext(look, lexer)));
      continue
    }

    // Remove the quotes.
    filePath = look.content.content.slice(1, look.content.content.length - 1);
    // Find the included file in the paths.
    foundFile = lookForFile(filePath);

    if (nesting > 15) {
      // If nesting overflowed, instantly stop processing.
      errors.push(BuiltinPreprocessError.NESTING_OVF.create(new PreprocessContext(last, lexer)));
      break
    }
    if (!foundFile) {
      // If file not found, skip this `#include`.
      errors.push(BuiltinPreprocessError.NOT_FOUND.create(new PreprocessContext(look, lexer), filePath));
      continue
    }

    // The lexer reads from the original (un-expanded) input so its line
    // numbers are relative to the original file.  Because previous
    // insertions have shifted the result chain, we must adjust by
    // `lineShift` to get the correct position in the result.
    var adjustedLine = look.line + lineShift;

    // Navigate to the slice containing the adjusted line and clear it.
    var remainCum = cumStartOf(result, remain);
    remain.clear(adjustedLine - remainCum);

    file = discardComment(FileSlice.fromFile(filePath, fileInterface.readFileSync(foundFile)));
    combineResult = processInclude(file, paths, fileInterface, nesting + 1);

    // Calculate the size BEFORE inserting, since insert() links the
    // chain into the result and would corrupt chainSize().
    var insertedSize = chainSize(combineResult.value);

    // Insert the included file after the cleared line.
    remainCum = cumStartOf(result, remain);
    remain.insert(adjustedLine + 1 - remainCum, combineResult.value);

    // Subsequent original lines are shifted by the size of the inserted
    // chain (the insert places it BEFORE the line at `adjustedLine + 1`,
    // pushing that line and all later ones forward).
    lineShift += insertedSize;

    errors = errors.concat(combineResult.errors);
    e = combineResult.errors.at(-1);
    if (e && e.type == BuiltinPreprocessError.NESTING_OVF)
      // If the nesting overflow is firstly thrown in the file just processed,
      // it will be the last error in the array. We need to instantly stop
      // processing when the overflow is encountered.
      break;
    // After the insert operation, the remain part will be pushed to the last
    // FileSlice in the chain. So we need to seek to the remain part.
    remain = seek(remain);
  }

  return {
    value: result,
    errors: errors
  }
}

/**
 * Process `#dup` statement.
 * @param {FileSlice} input
 * @param {number} nesting
 */
function processDuplicate(input, nesting) {

}

/**
 * Evaluate a conditional expression for `#if` directives.
 * Consumes tokens from the current line and evaluates to a number.
 * Returns 0 for false, non-zero for true.
 *
 * Grammar:
 *   expression  → logical_or
 *   logical_or  → logical_and ("||" logical_and)*
 *   logical_and → equality ("&&" equality)*
 *   equality    → relational (("==" | "!=") relational)*
 *   relational  → unary (("<" | ">" | "<=" | ">=") unary)*
 *   unary       → "!" unary | primary
 *   primary     → "(" expression ")" | NUMBER | "defined" "(" NAME ")" | "defined" NAME | NAME
 *
 * @param {PreprocessLexer} lexer - Lexer positioned after `#if`.
 * @param {Map<string, any>} macros - Defined macros.
 * @returns {number}
 */
function evaluateConditionalExpression(lexer, macros) {
  var token;

  /**
   * Advance to the next token, stop at end of line.
   * @returns {PreprocessToken}
   */
  function nextToken() {
    token = lexer.scan();
    return token
  }

  /**
   * Get the raw string value of the current token.
   */
  function tokenRaw() {
    return token.getRaw()
  }

  /**
   * Expand a macro name to its value if defined.
   * Returns the expanded string, or "0" if not defined.
   */
  function expandMacro(name) {
    if (macros.has(name)) {
      var m = macros.get(name);
      if (m && m.replacement)
        return m.replacement.map(function (t) { return t.getRaw() }).join("");
      return "0"
    }
    return "0"
  }

  function expression() {
    return logicalOr()
  }

  function logicalOr() {
    var left = logicalAnd();
    while (token && tokenRaw() == "||") {
      nextToken();
      var right = logicalAnd();
      left = (left || right) ? 1 : 0;
    }
    return left
  }

  function logicalAnd() {
    var left = equality();
    while (token && tokenRaw() == "&&") {
      nextToken();
      var right = equality();
      left = (left && right) ? 1 : 0;
    }
    return left
  }

  function equality() {
    var left = relational();
    while (token && (tokenRaw() == "==" || tokenRaw() == "!=")) {
      var op = tokenRaw();
      nextToken();
      var right = relational();
      if (op == "==")
        left = (left == right) ? 1 : 0;
      else
        left = (left != right) ? 1 : 0;
    }
    return left
  }

  function relational() {
    var left = unary();
    while (token && (tokenRaw() == "<" || tokenRaw() == ">" || tokenRaw() == "<=" || tokenRaw() == ">=")) {
      var op = tokenRaw();
      nextToken();
      var right = unary();
      if (op == "<")
        left = (left < right) ? 1 : 0;
      else if (op == ">")
        left = (left > right) ? 1 : 0;
      else if (op == "<=")
        left = (left <= right) ? 1 : 0;
      else if (op == ">=")
        left = (left >= right) ? 1 : 0;
    }
    return left
  }

  function unary() {
    if (token && tokenRaw() == "!") {
      nextToken();
      var v = unary();
      return v ? 0 : 1;
    }
    return primary()
  }

  function primary() {
    var val;
    if (!token)
      return 0;

    // Parenthesized expression.
    if (tokenRaw() == "(") {
      nextToken();
      val = expression();
      if (token && tokenRaw() == ")")
        nextToken();
      return val
    }

    // `defined(NAME)` or `defined NAME`
    if (token.content.type == PreprocessTokenContent.Type.WORD && tokenRaw() == "defined") {
      nextToken();
      var hasParen = false;
      if (token && tokenRaw() == "(") {
        hasParen = true;
        nextToken();
      }
      var macroName = "";
      if (token && token.content.type == PreprocessTokenContent.Type.WORD)
        macroName = tokenRaw();
      nextToken();
      if (hasParen && token && tokenRaw() == ")")
        nextToken();
      return macros.has(macroName) ? 1 : 0
    }

    // Number literal.
    if (/^\d/.test(tokenRaw())) {
      val = parseFloat(tokenRaw());
      nextToken();
      return val
    }

    // Macro name: expand it.
    if (token.content.type == PreprocessTokenContent.Type.WORD) {
      var name = tokenRaw();
      nextToken();
      val = expandMacro(name);
      return parseFloat(val) || 0
    }

    // Unknown token, consume and return 0.
    nextToken();
    return 0
  }

  // Prime the first token.
  nextToken();
  var result = expression();
  return result ? result : 0
}

/**
 * Represents a defined macro.
 */
class PreprocessMacro {
  /**
   * @param {string} name - Macro name.
   * @param {string[]} [params] - Parameter names (null for object-like macros).
   * @param {PreprocessToken[]} [replacement] - Replacement token list.
   */
  constructor(name, params, replacement) {
    this.name = name;
    this.params = params || null;
    this.replacement = replacement || [];
  }

  /**
   * Whether this is a function-like macro.
   * @returns {boolean}
   */
  isFunctionLike() {
    return this.params != null
  }

  /**
   * Get the replacement text by joining token raw strings.
   * @returns {string}
   */
  getReplacementText() {
    return this.replacement.map(function (t) { return t.getRaw() }).join("")
  }
}

class PreprocessParser {
  static discardComment = discardComment;
  static processInclude = processInclude;
  static processDuplicate = processDuplicate;

  /**
   * @param {FileSlice} fileSlice
   * @param {Map<string, any>} macros
   * @param {string[]} includePaths
   * @param {FileInterface} fileInterface
   */
  constructor(fileSlice, macros, includePaths, fileInterface) {
    var combined = processInclude(discardComment(fileSlice), includePaths, fileInterface);

    // Use the include-expanded chain as the input for parsing.
    // The chain's parentLine values are contiguous so absolute line numbers
    // are correct and source file information is preserved.
    this.input = combined.value;
    this.result = FileSlice.copy(this.input);
    this.lexer = new PreprocessLexer(this.input);
    this.look = null;
    this.includes = [];
    this.errors = combined.errors || [];
    this.warnings = [];
    this.macros = macros || new Map();
    this.done = false;
    /** @type {{skipping: boolean, hadTrueBranch: boolean}[]} */
    this.conditionalStack = [];
    /** @type {Set<string>} — macros currently being expanded, to prevent recursion. */
    this.expandingMacros = new Set();

    this.move();
  }

  /**
   * Scan the next token.
   * @returns {PreprocessToken}
   */
  move() {
    this.look = this.lexer.scan();
    return this.look
  }

  /**
   * Check if the current token matches the given token.
   * @param {PreprocessToken} [t] - Token to be matched.
   * @returns {boolean}
   */
  match(t) {
    if (this.look.content == t) {
      this.move();
      return true
    } else {
      this.errors.push(BuiltinPreprocessError.UNEXPECTED.create(new PreprocessContext(this.look, this.lexer), this.look));
      return false
    }
  }

  /**
   * Clear a line in the result chain. The `fileSlice` identifies which
   * slice the line belongs to, and `absoluteLine` is the line number as
   * reported by the token (original-file-relative).
   * @param {number} absoluteLine
   * @param {FileSlice} fileSlice
   */
  clearResultLine(absoluteLine, fileSlice) {
    fileSlice.clear(absoluteLine - fileSlice.parentLine);
  }

  /**
   * Replace a word in the result chain.
   * @param {number} absoluteLine
   * @param {FileSlice} fileSlice
   * @param {number} col
   * @param {number} len
   * @param {string} text
   */
  replaceResultWord(absoluteLine, fileSlice, col, len, text) {
    fileSlice.replaceWord(absoluteLine - fileSlice.parentLine, col, len, text);
  }

  /**
   * Check whether current tokens should be skipped due to conditional
   * compilation. A token is skipped if ANY frame in the conditional stack
   * has `skipping == true`.
   * @returns {boolean}
   */
  isSkipping() {
    for (var i = 0; i < this.conditionalStack.length; i++)
      if (this.conditionalStack[i].skipping)
        return true;
    return false
  }

  /**
   * Clear the line of the current token in the result FileSlice.
   */
  clearCurrentLine() {
    this.look.fileSlice.clear(this.look.line - this.look.fileSlice.parentLine);
  }

  /**
   * Parse the content of a `#define` directive.
   * Handles both object-like and function-like macros.
   *
   * After the macro name, if the next token is `(` on the same line with no
   * preceding whitespace, it is a function-like macro.
   *
   * @param {string} name - Macro name.
   * @param {PreprocessToken} nameToken - The token of the macro name.
   * @returns {PreprocessMacro}
   */
  parseDefineContent(name, nameToken) {
    var params = null
      , replacement = [];

    // Check for function-like macro: `(` immediately after name (no space).
    if (
      this.look
      && PreprocessToken.isSameLine(nameToken, this.look)
      && this.look.content.content == "("
      && !this.look.spaced
    ) {
      // Function-like macro: parse parameter list.
      params = [];
      this.move(); // consume `(`

      while (this.look && PreprocessToken.isSameLine(nameToken, this.look)) {
        if (this.look.content.content == ")") {
          this.move(); // consume `)`
          break
        }
        if (this.look.content.content == ",") {
          this.move(); // consume `,`
          continue
        }
        if (this.look.content.type == PreprocessTokenContent.Type.WORD) {
          params.push(this.look.getRaw());
          this.move();
        } else {
          // Unexpected token in parameter list.
          this.errors.push(BuiltinPreprocessError.UNEXPECTED.create(
            new PreprocessContext(this.look, this.lexer), this.look
          ));
          this.move();
        }
      }
    }

    // Collect replacement tokens until end of line.
    while (this.look && PreprocessToken.isSameLine(nameToken, this.look)) {
      replacement.push(this.look);
      this.move();
    }

    return new PreprocessMacro(name, params, replacement)
  }

  /**
   * Parse parameter tokens for the old-style `parseDefine()`.
   * @returns {PreprocessToken[]}
   */
  parseDefineParams() {
    var result = [];
    if (this.look && this.look.content.type == PreprocessTokenContent.Type.TOKEN && this.look.content.content == "(") {
      // Function-like macro: skip to end of line for now.
      // The new parseDefineContent handles this properly.
    } else {
      while (this.look && !this.look.first) {
        result.push(this.look);
        this.move();
      }
    }
    return result
  }

  /**
   * Process `#define` or `#undef` directive.
   * @param {boolean} undef - Whether this is `#undef`.
   * @returns {boolean}
   */
  parseDefine(undef) {
    var last = this.look;

    this.move();
    if (!this.look || !PreprocessToken.isSameLine(last, this.look)) {
      this.errors.push(BuiltinPreprocessError.NO_MACRO_NAME.create(
        new PreprocessContext(last, this.lexer)
      ));
      return false
    }

    if (this.look.content.type != PreprocessTokenContent.Type.WORD) {
      this.errors.push(BuiltinPreprocessError.INVALID_MACRO_NAME.create(
        new PreprocessContext(this.look, this.lexer)
      ));
      return false
    }

    var name = this.look.getRaw()
      , nameToken = this.look;

    // Clear the directive line from output.
    this.clearResultLine(last.line, last.fileSlice);

    if (undef) {
      this.macros.delete(name);
      // Skip the rest of the line.
      while (this.look && PreprocessToken.isSameLine(last, this.look))
        this.move();
      return true
    }

    // Advance past the macro name.
    this.move();

    // Parse the macro definition.
    var macro = this.parseDefineContent(name, nameToken);
    this.macros.set(name, macro);

    return true
  }

  /**
   * Handle `#if` directive: evaluate condition and push conditional state.
   */
  parseIf() {
    var directiveLine = this.look.line
      , directiveSlice = this.look.fileSlice
      , condition = evaluateConditionalExpression(this.lexer, this.macros)
      , skipping = !condition;

    this.conditionalStack.push({
      skipping: skipping,
      hadTrueBranch: !skipping
    });

    // Clear the directive line.
    this.clearResultLine(directiveLine, directiveSlice);

    // `evaluateConditionalExpression` consumed tokens through the lexer;
    // sync our lookahead with the lexer's current token.
    this.look = this.lexer.look;
  }

  /**
   * Handle `#ifdef` directive.
   */
  parseIfdef() {
    var directiveLine = this.look.line
      , directiveSlice = this.look.fileSlice;

    this.move(); // consume `#ifdef`
    var macroName = "";
    if (this.look && PreprocessToken.isSameLine({ line: directiveLine, fileSlice: this.look.fileSlice }, this.look)) {
      if (this.look.content.type == PreprocessTokenContent.Type.WORD)
        macroName = this.look.getRaw();
      this.move(); // consume the name
    }

    var condition = this.macros.has(macroName);
    this.conditionalStack.push({
      skipping: !condition,
      hadTrueBranch: condition
    });

    // Clear the directive line and consume remaining tokens on this line.
    this.clearResultLine(directiveLine, directiveSlice);
    while (this.look && this.look.line == directiveLine)
      this.move();
  }

  /**
   * Handle `#ifndef` directive.
   */
  parseIfndef() {
    var directiveLine = this.look.line
      , directiveSlice = this.look.fileSlice;

    this.move(); // consume `#ifndef`
    var macroName = "";
    if (this.look && PreprocessToken.isSameLine({ line: directiveLine, fileSlice: this.look.fileSlice }, this.look)) {
      if (this.look.content.type == PreprocessTokenContent.Type.WORD)
        macroName = this.look.getRaw();
      this.move(); // consume the name
    }

    var condition = !this.macros.has(macroName);
    this.conditionalStack.push({
      skipping: !condition,
      hadTrueBranch: condition
    });

    // Clear the directive line and consume remaining tokens.
    this.clearResultLine(directiveLine, directiveSlice);
    while (this.look && this.look.line == directiveLine)
      this.move();
  }

  /**
   * Handle `#elif` directive.
   */
  parseElif() {
    var directiveLine = this.look.line
      , directiveSlice = this.look.fileSlice;

    if (!this.conditionalStack.length) {
      this.errors.push(new SimplePreprocessErrorBuilder(
        PreprocessError, "unexpected #elif without #if."
      ).create(new PreprocessContext(this.look, this.lexer)));
      this.move();
      return
    }

    var top = this.conditionalStack[this.conditionalStack.length - 1];

    if (top.hadTrueBranch) {
      // A previous branch was true, skip this one.
      top.skipping = true;
      this.clearResultLine(directiveLine, directiveSlice);
      while (this.look && this.look.line == directiveLine)
        this.move();
    } else {
      // Evaluate the condition.
      var condition = evaluateConditionalExpression(this.lexer, this.macros);
      top.skipping = !condition;
      top.hadTrueBranch = condition;
      this.clearResultLine(directiveLine, directiveSlice);
      // Sync lookahead with the lexer after expression evaluation.
      this.look = this.lexer.look;
    }
  }

  /**
   * Handle `#else` directive.
   */
  parseElse() {
    var directiveLine = this.look.line
      , directiveSlice = this.look.fileSlice;

    if (!this.conditionalStack.length) {
      this.errors.push(new SimplePreprocessErrorBuilder(
        PreprocessError, "unexpected #else without #if."
      ).create(new PreprocessContext(this.look, this.lexer)));
      this.move();
      return
    }

    var top = this.conditionalStack[this.conditionalStack.length - 1];

    if (top.hadTrueBranch) {
      top.skipping = true;
    } else {
      top.skipping = false;
      top.hadTrueBranch = true;
    }

    // Clear the directive line and consume remaining tokens.
    this.clearResultLine(directiveLine, directiveSlice);
    this.move();
    while (this.look && this.look.line == directiveLine)
      this.move();
  }

  /**
   * Handle `#endif` directive.
   */
  parseEndif() {
    var directiveLine = this.look.line
      , directiveSlice = this.look.fileSlice;

    if (!this.conditionalStack.length) {
      this.errors.push(new SimplePreprocessErrorBuilder(
        PreprocessError, "unexpected #endif without #if."
      ).create(new PreprocessContext(this.look, this.lexer)));
      this.move();
      return
    }

    this.conditionalStack.pop();

    // Clear the directive line and consume remaining tokens.
    this.clearResultLine(directiveLine, directiveSlice);
    this.move();
    while (this.look && this.look.line == directiveLine)
      this.move();
  }

  /**
   * Expand a macro reference at the current token position.
   */
  macroExpansion() {
    var macroName = this.look.getRaw()
      , macro = this.macros.get(macroName);

    if (!macro || this.expandingMacros.has(macroName))
      return;

    // Mark this macro as being expanded to prevent infinite recursion.
    this.expandingMacros.add(macroName);

    if (!(macro instanceof PreprocessMacro)) {
      // Legacy macro format: array of tokens.
      var raw = "";
      if (Array.isArray(macro))
        raw = macro.map(function (t) { return t.getRaw() }).join("");
      else
        raw = String(macro);
      this.replaceResultWord(
        this.look.line,
        this.look.fileSlice,
        this.look.column,
        this.look.getRaw().length,
        raw
      );
      this.expandingMacros.delete(macroName);
      return
    }

    if (!macro.isFunctionLike()) {
      // Object-like macro: simple replacement.
      var text = macro.getReplacementText();
      this.replaceResultWord(
        this.look.line,
        this.look.fileSlice,
        this.look.column,
        this.look.getRaw().length,
        text
      );
    } else {
      // Function-like macro: look for `(` after the macro name.
      // We need to peek at the next token.
      var savedLook = this.look;
      this.move(); // advance past macro name

      if (
        this.look
        && PreprocessToken.isSameLine(savedLook, this.look)
        && this.look.content.content == "("
        && !this.look.spaced
      ) {
        // Parse arguments.
        var args = []
          , currentArg = [];
        this.move(); // consume `(`

        var parenDepth = 1;
        while (this.look && parenDepth > 0) {
          if (this.look.content.content == "(") {
            parenDepth++;
            currentArg.push(this.look);
          } else if (this.look.content.content == ")") {
            parenDepth--;
            if (parenDepth == 0) {
              args.push(currentArg);
              break;
            }
            currentArg.push(this.look);
          } else if (this.look.content.content == "," && parenDepth == 1) {
            args.push(currentArg);
            currentArg = [];
          } else {
            currentArg.push(this.look);
          }
          this.move();
        }

        // Build replacement text by substituting parameters.
        var resultText = "";
        for (var i = 0; i < macro.replacement.length; i++) {
          var t = macro.replacement[i]
            , raw = t.getRaw()
            , paramIdx = macro.params.indexOf(raw);
          if (paramIdx >= 0 && paramIdx < args.length) {
            resultText += args[paramIdx].map(function (at) { return at.getRaw() }).join("");
          } else {
            resultText += raw;
          }
        }

        // Replace the entire macro invocation (name + args) in the output.
        this.replaceResultWord(
          savedLook.line,
          savedLook.fileSlice,
          savedLook.column,
          // Approximate the length: from macro name start to the closing `)`.
          (this.look ? this.look.column + 1 : savedLook.column + macroName.length)
          - savedLook.column,
          resultText
        );
      } else {
        // Not a function-like invocation; restore lookahead and do nothing.
        this.expandingMacros.delete(macroName);
        return
      }
    }

    this.expandingMacros.delete(macroName);
  }

  /**
   * Preprocess the whole file.
   */
  parse() {
    while (this.look) {
      // Track whether we handled a directive on this iteration.
      // When a directive handler consumes tokens, it advances `this.look`
      // internally — we must skip the `this.move()` at the bottom.
      var handledDirective = false;

      // Handle preprocessor directives at line start.
      // Directives are always processed regardless of skip state.
      if (this.look.first) {
        if (this.look.content == PreprocessTokenContent.Reserved.HASH_DEFINE) {
          handledDirective = true;
          if (!this.isSkipping())
            this.parseDefine(false);
          else {
            // Skip the directive line.
            var lineD = this.look.line
              , sliceD = this.look.fileSlice;
            this.clearResultLine(lineD, sliceD);
            while (this.look && this.look.line == lineD)
              this.move();
          }
        } else if (this.look.content == PreprocessTokenContent.Reserved.HASH_UNDEF) {
          handledDirective = true;
          if (!this.isSkipping())
            this.parseDefine(true);
          else {
            var lineU = this.look.line
              , sliceU = this.look.fileSlice;
            this.clearResultLine(lineU, sliceU);
            while (this.look && this.look.line == lineU)
              this.move();
          }
        } else if (this.look.content == PreprocessTokenContent.Reserved.HASH_IF) {
          handledDirective = true;
          this.parseIf();
        } else if (this.look.content == PreprocessTokenContent.Reserved.HASH_IFDEF) {
          handledDirective = true;
          this.parseIfdef();
        } else if (this.look.content == PreprocessTokenContent.Reserved.HASH_IFNDEF) {
          handledDirective = true;
          this.parseIfndef();
        } else if (this.look.content == PreprocessTokenContent.Reserved.HASH_ELIF) {
          handledDirective = true;
          this.parseElif();
        } else if (this.look.content == PreprocessTokenContent.Reserved.HASH_ELSE) {
          handledDirective = true;
          this.parseElse();
        } else if (this.look.content == PreprocessTokenContent.Reserved.HASH_ENDIF) {
          handledDirective = true;
          this.parseEndif();
        } else if (this.look.content == PreprocessTokenContent.Reserved.HASH_INCLUDE) {
          handledDirective = true;
          // #include was already handled in processInclude() during construction.
          // Clear this line (it's just the include directive now).
          var lineI = this.look.line
            , sliceI = this.look.fileSlice;
          this.clearResultLine(lineI, sliceI);
          while (this.look && this.look.line == lineI)
            this.move();
        }
      }

      if (!this.look)
        break;

      // If we handled a directive that already advanced the lookahead,
      // jump back to the top so we process the new token correctly.
      if (handledDirective)
        continue;

      // If we're in a skipped conditional block, clear the line.
      if (this.isSkipping()) {
        this.clearCurrentLine();
        this.move();
        continue
      }

      // Macro expansion for word tokens.
      if (this.look.content.type == PreprocessTokenContent.Type.WORD)
        this.macroExpansion();

      this.move();
    }
  }
}

module.exports = {
  PreprocessMacro,
  PreprocessParser
};
