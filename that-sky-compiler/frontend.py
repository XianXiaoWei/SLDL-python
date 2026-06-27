"""
sldl-frontend - SLDL Compiler Frontend for SLDL v1.0.0.

Ported from the JavaScript sldl-frontend package.
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later

Provides tokenization for SLDL source code. The full parser is not yet
ported as the JSON-based API (sldl-jsonify) is the primary interface.
"""

import re

from .utils import FileSlice
from .preprocessor import preprocess, TokenType


class Token:
    """A compiler token."""

    def __init__(self, type_, value, line=0, column=0, file_name=""):
        self.type = type_
        self.value = value
        self.line = line
        self.column = column
        self.file_name = file_name

    def __str__(self):
        return f"<{self.type}:{self.value} L{self.line} P{self.column}>"

    def __repr__(self):
        return self.__str__()


class TokenTypes:
    """SLDL token types."""
    EOF = "EOF"
    IDENTIFIER = "IDENTIFIER"
    NUMBER = "NUMBER"
    STRING = "STRING"
    KEYWORD = "KEYWORD"
    OPERATOR = "OPERATOR"
    PUNCTUATION = "PUNCTUATION"
    COMMENT = "COMMENT"


# SLDL keywords.
KEYWORDS = {
    "class", "struct", "enum", "typedef", "const", "static",
    "void", "bool", "int", "float", "double",
    "int8_t", "uint8_t", "int16_t", "uint16_t",
    "int32_t", "uint32_t", "int64_t", "uint64_t",
    "cstring", "TgcString", "Clump", "Object",
    "true", "false", "null", "this",
    "if", "else", "for", "while", "return",
    "sizeof", "alignof", "typeof",
}


class CompilerLexer:
    """SLDL compiler lexer."""

    def __init__(self, input_data):
        if isinstance(input_data, FileSlice):
            self.source = input_data.get_content()
            self.file_name = input_data.file
        else:
            self.source = str(input_data)
            self.file_name = ""

        self.source = self.source.replace('\r\n', '\n')
        self.chars = list(self.source)
        self.cursor = 0
        self.line = 0
        self.column = 0

    def done(self):
        return self.cursor >= len(self.chars)

    def peek(self, offset=0):
        idx = self.cursor + offset
        if idx < len(self.chars):
            return self.chars[idx]
        return '\0'

    def advance(self):
        if self.cursor < len(self.chars):
            ch = self.chars[self.cursor]
            self.cursor += 1
            if ch == '\n':
                self.line += 1
                self.column = 0
            else:
                self.column += 1
            return ch
        return '\0'

    def skip_whitespace(self):
        while not self.done():
            ch = self.peek()
            if ch in ' \t\r\n':
                self.advance()
            elif ch == '/' and self.peek(1) == '/':
                while not self.done() and self.peek() != '\n':
                    self.advance()
            elif ch == '/' and self.peek(1) == '*':
                self.advance()
                self.advance()
                while not self.done():
                    if self.peek() == '*' and self.peek(1) == '/':
                        self.advance()
                        self.advance()
                        break
                    self.advance()
            else:
                break

    def scan(self):
        """Scan the next token."""
        self.skip_whitespace()
        if self.done():
            return Token(TokenTypes.EOF, "", self.line, self.column, self.file_name)

        ch = self.peek()
        line = self.line
        col = self.column

        # Identifier or keyword.
        if ch.isalpha() or ch == '_':
            return self._read_identifier(line, col)

        # Number.
        if ch.isdigit():
            return self._read_number(line, col)

        # String literal.
        if ch == '"':
            return self._read_string(line, col)

        # Multi-character operators.
        two = ch + self.peek(1)
        if two in ('==', '!=', '<=', '>=', '&&', '||', '->', '++', '--',
                    '+=', '-=', '*=', '/=', '%=', '::', '##'):
            self.advance()
            self.advance()
            return Token(TokenTypes.OPERATOR, two, line, col, self.file_name)

        # Single-character operators and punctuation.
        if ch in '+-*/%=<>!&|^~?:.':
            self.advance()
            return Token(TokenTypes.OPERATOR, ch, line, col, self.file_name)

        if ch in '(){}[];,':
            self.advance()
            return Token(TokenTypes.PUNCTUATION, ch, line, col, self.file_name)

        # Unknown character.
        self.advance()
        return Token(TokenTypes.PUNCTUATION, ch, line, col, self.file_name)

    def _read_identifier(self, line, col):
        start = self.cursor
        while not self.done() and (self.peek().isalnum() or self.peek() == '_'):
            self.advance()
        value = self.source[start:self.cursor]
        if value in KEYWORDS:
            return Token(TokenTypes.KEYWORD, value, line, col, self.file_name)
        return Token(TokenTypes.IDENTIFIER, value, line, col, self.file_name)

    def _read_number(self, line, col):
        start = self.cursor
        while not self.done() and self.peek().isdigit():
            self.advance()
        if self.peek() == '.' and self.peek(1).isdigit():
            self.advance()
            while not self.done() and self.peek().isdigit():
                self.advance()
        # Hex prefix.
        if start == self.cursor and self.peek() == '0' and self.peek(1) in 'xX':
            self.advance()
            self.advance()
            while not self.done() and self.peek() in '0123456789abcdefABCDEF':
                self.advance()
        value = self.source[start:self.cursor]
        return Token(TokenTypes.NUMBER, value, line, col, self.file_name)

    def _read_string(self, line, col):
        self.advance()  # consume opening quote
        result = ""
        while not self.done() and self.peek() != '"':
            if self.peek() == '\\':
                self.advance()
                esc = self.advance()
                if esc == 'n':
                    result += '\n'
                elif esc == 't':
                    result += '\t'
                elif esc == 'r':
                    result += '\r'
                else:
                    result += esc
            else:
                result += self.advance()
        self.advance()  # consume closing quote
        return Token(TokenTypes.STRING, result, line, col, self.file_name)


def tokenize(input_data):
    """Tokenize preprocessed input into a list of tokens.

    Args:
        input_data: FileSlice, string, or preprocessed result.

    Returns:
        list of Token objects.
    """
    lexer = CompilerLexer(input_data)
    tokens = []
    while True:
        t = lexer.scan()
        tokens.append(t)
        if t.type == TokenTypes.EOF:
            break
    return tokens


def compile_source(source, options=None):
    """Compile SLDL source code through the full pipeline.

    Preprocesses the source, then tokenizes it.

    Args:
        source: SLDL source string or FileSlice.
        options: Preprocessor options (include_paths, macros, etc.).

    Returns:
        dict with keys: tokens, result (preprocessed), errors, macros.
    """
    opts = options or {}
    pp_result = preprocess(source, opts)
    tokens = tokenize(pp_result["result"])

    return {
        "tokens": tokens,
        "result": pp_result["result"],
        "errors": pp_result["errors"],
        "macros": pp_result["macros"],
    }
