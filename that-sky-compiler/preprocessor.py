"""
sldl-preprocessor - That Sky Preprocessor (TSPP) for SLDL v1.0.0.

Ported from the JavaScript sldl-preprocessor package.
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later

Supported directives:
  #include  - file inclusion
  #define   - object-like and function-like macros
  #undef    - remove a macro definition
  #if       - conditional compilation (expression evaluation)
  #ifdef    - conditional on macro defined
  #ifndef   - conditional on macro not defined
  #else     - alternate branch for #if/#ifdef/#ifndef
  #elif     - chained conditional
  #endif    - close conditional block
"""

import re
import os

from .utils import FileSlice, FileInterface


# --- Token types ---

class TokenType:
    TOKEN = 0
    WORD = 1
    HASH = 2
    STRING = 3


class TokenContent:
    def __init__(self, type_, content):
        self.type = type_
        self.content = content

    def __str__(self):
        return self.content

    def __eq__(self, other):
        if isinstance(other, TokenContent):
            return self.content == other.content and self.type == other.type
        return False

    def __hash__(self):
        return hash((self.type, self.content))


# Reserved token contents.
class Reserved:
    LT = TokenContent(TokenType.TOKEN, "<")
    LE = TokenContent(TokenType.TOKEN, "<=")
    EQ = TokenContent(TokenType.TOKEN, "==")
    BT = TokenContent(TokenType.TOKEN, ">")
    BE = TokenContent(TokenType.TOKEN, ">=")
    NE = TokenContent(TokenType.TOKEN, "!=")
    CONN = TokenContent(TokenType.TOKEN, "##")
    LOGIC_AND = TokenContent(TokenType.TOKEN, "&&")
    LOGIC_OR = TokenContent(TokenType.TOKEN, "||")
    LOGIC_NOT = TokenContent(TokenType.TOKEN, "!")
    HASH_DEFINE = TokenContent(TokenType.HASH, "#define")
    HASH_UNDEF = TokenContent(TokenType.HASH, "#undef")
    HASH_INCLUDE = TokenContent(TokenType.HASH, "#include")
    HASH_IF = TokenContent(TokenType.HASH, "#if")
    HASH_IFDEF = TokenContent(TokenType.HASH, "#ifdef")
    HASH_ENDIF = TokenContent(TokenType.HASH, "#endif")
    HASH_ELSE = TokenContent(TokenType.HASH, "#else")
    HASH_ELIF = TokenContent(TokenType.HASH, "#elif")
    HASH_IFNDEF = TokenContent(TokenType.HASH, "#ifndef")
    HASH_DUP = TokenContent(TokenType.HASH, "#dup")
    HASH_ENDDUP = TokenContent(TokenType.HASH, "#enddup")


class Token:
    """A preprocessor token with position information."""

    @staticmethod
    def is_same_line(a, b):
        return a.line == b.line and a.file_slice == b.file_slice

    def __init__(self, content, begin, end, file_slice, line, column, first, spaced):
        self.content = content
        self.begin = begin
        self.end = end
        self.file_name = file_slice.file
        self.file_slice = file_slice
        self.line = line
        self.column = column
        self.first = bool(first)
        self.spaced = bool(spaced)

    def get_raw(self):
        return self.content.content

    def get_type(self):
        return self.content.type


# Unicode property regex helpers.
_ID_START_RE = re.compile(r'[\w]', re.UNICODE)
_ID_CONTINUE_RE = re.compile(r'[\w]', re.UNICODE)
_WHITESPACE_RE = re.compile(r'[\t\v\f ]')
_DIGIT_RE = re.compile(r'\d')


class Lexer:
    """Preprocessor lexer that tokenizes source code."""

    @staticmethod
    def get_line_of(lexer, line):
        return lexer.original.split("\n")[line]

    def __init__(self, input_data):
        if not isinstance(input_data, FileSlice):
            input_data = FileSlice.from_file("", input_data, 0)

        self.original = input_data
        self.current_file = input_data
        self.string = list(self.current_file.get_content())
        self.line = 0
        self.column = 0
        self.column_end = 0
        self.cursor = -1
        self.reading_vani_cmd = 0
        self.peek = " "
        self.begin = 0
        self.is_first_in_line = True
        self.after_whitespace = False
        self.look = None

    def build_token(self, content, type_=None):
        if not isinstance(content, TokenContent):
            content = TokenContent(type_ if type_ is not None else TokenType.TOKEN, content)
        r = Token(
            content,
            self.begin,
            self.begin + len(content.content),
            self.current_file,
            self.line + self.current_file.parent_line,
            self.column,
            self.is_first_in_line,
            self.after_whitespace,
        )
        self.is_first_in_line = False
        self.look = r
        return r

    def done(self):
        return self.cursor >= len(self.string) and not self.current_file.next

    def is_unquoted_string_start(self):
        return bool(_ID_START_RE.match(self.peek)) or self.peek == '_'

    def is_unquoted_string(self):
        return bool(_ID_CONTINUE_RE.match(self.peek))

    def is_whitespace(self):
        return bool(_WHITESPACE_RE.match(self.peek)) or ord(self.peek) == 0xFEFF if self.peek else False

    def readch(self, c=None):
        if self.cursor >= len(self.string) and self.current_file.next:
            self.current_file = self.current_file.next
            self.cursor = -1
            self.line = self.column = self.column_end = 0
            self.peek = " "
            self.is_first_in_line = True
            self.string = list(self.current_file.get_content())

        if not self.done():
            self.cursor += 1
            self.column_end += 1
            if self.cursor < len(self.string):
                self.peek = self.string[self.cursor]
            else:
                self.peek = " "
            if c is not None:
                if self.peek != c:
                    return False
                self.peek = " "
                return True
            return True
        return False

    def isch(self, c):
        if self.peek != c:
            return False
        self.peek = " "
        return True

    def skip_whitespace(self):
        result = False
        while not self.done():
            if self.is_whitespace():
                result = True
                if not self.readch():
                    break
            elif self.peek == '\n':
                result = True
                self.line += 1
                self.column_end = self.column = -1
                self.is_first_in_line = True
                if not self.readch():
                    break
            else:
                return result
        return result

    def skip_line(self):
        while self.peek != '\n' and not self.done():
            self.readch()

    def scan(self):
        self.after_whitespace = self.skip_whitespace()
        if self.done():
            return None

        self.begin = self.cursor
        self.column = self.column_end

        p = self.peek

        if p == '&':
            if self.readch('&'):
                return self.build_token(Reserved.LOGIC_AND)
            self.readch()
            return self.build_token('&', TokenType.TOKEN)
        if p == '|':
            if self.readch('|'):
                return self.build_token(Reserved.LOGIC_OR)
            self.readch()
            return self.build_token('|', TokenType.TOKEN)
        if p == '=':
            if self.readch('='):
                return self.build_token(Reserved.EQ)
            if self.isch('>'):
                return self.build_token("=>", TokenType.TOKEN)
            return self.build_token('=', TokenType.TOKEN)
        if p == '!':
            if self.readch('='):
                return self.build_token(Reserved.NE)
            return self.build_token('!', TokenType.TOKEN)
        if p == '<':
            if self.readch('='):
                return self.build_token(Reserved.LE)
            return self.build_token(Reserved.LT)
        if p == '>':
            if self.readch('='):
                return self.build_token(Reserved.BE)
            return self.build_token(Reserved.BT)
        if p == '-':
            if self.readch('>'):
                return self.build_token("->", TokenType.TOKEN)
            if self.isch('-'):
                return self.build_token("--", TokenType.TOKEN)
            if self.isch('='):
                return self.build_token("-=", TokenType.TOKEN)
            return self.build_token('-', TokenType.TOKEN)
        if p == '+':
            if self.readch('+'):
                return self.build_token("++", TokenType.TOKEN)
            if self.isch('='):
                return self.build_token("+=", TokenType.TOKEN)
            return self.build_token('+', TokenType.TOKEN)
        if p == '*':
            if self.readch('='):
                return self.build_token("*=", TokenType.TOKEN)
            return self.build_token('*', TokenType.TOKEN)
        if p == '/':
            if self.readch('='):
                return self.build_token("/=", TokenType.TOKEN)
            return self.build_token('/', TokenType.TOKEN)
        if p == '%':
            if self.readch('='):
                return self.build_token("%=", TokenType.TOKEN)
            return self.build_token('%', TokenType.TOKEN)

        if self.is_unquoted_string_start():
            b = self.read_string_unquoted()
            return self.build_token(b, TokenType.WORD)

        if _DIGIT_RE.match(p):
            return self.build_token(self.read_number(), TokenType.TOKEN)

        if p == '#':
            if self.readch('#'):
                return self.build_token(Reserved.CONN)
            return self.read_hash()

        if p == '"':
            return self.build_token('"' + self.read_string_until('"') + '"', TokenType.STRING)

        if p == '@':
            return self.build_token("@" + self.read_string_unquoted(), TokenType.TOKEN)

        if self.done():
            return None

        t = self.build_token(self.peek, TokenType.TOKEN)
        self.peek = " "
        return t

    def read_number(self):
        o = ""
        while not self.done() and _DIGIT_RE.match(self.peek):
            o += self.peek
            self.readch()
        if self.peek != '.':
            return o
        o += '.'
        while not self.done():
            self.readch()
            if not _DIGIT_RE.match(self.peek):
                break
            o += self.peek
        return o

    def read_string_until(self, terminator):
        result = ""
        escaped = False
        while not self.done():
            self.readch()
            if escaped:
                if self.peek == 'n':
                    result += '\n'
                else:
                    result += self.peek
                escaped = False
            elif self.peek == '\\':
                escaped = True
            elif self.peek == terminator:
                self.readch()
                return result
            else:
                result += self.peek
        return result

    def read_string_unquoted(self):
        result = ""
        if not self.is_unquoted_string_start():
            return ""
        result += self.peek
        while not self.done():
            self.readch()
            if not self.is_unquoted_string():
                break
            result += self.peek
        return result

    def read_hash(self):
        id_ = self.read_string_unquoted()
        hash_map = {
            'define': Reserved.HASH_DEFINE,
            'undef': Reserved.HASH_UNDEF,
            'include': Reserved.HASH_INCLUDE,
            'if': Reserved.HASH_IF,
            'ifdef': Reserved.HASH_IFDEF,
            'endif': Reserved.HASH_ENDIF,
            'else': Reserved.HASH_ELSE,
            'elif': Reserved.HASH_ELIF,
            'ifndef': Reserved.HASH_IFNDEF,
            'dup': Reserved.HASH_DUP,
            'enddup': Reserved.HASH_ENDDUP,
        }
        if id_ in hash_map:
            return self.build_token(hash_map[id_])
        return self.build_token("#" + id_)


class Macro:
    """Represents a defined macro."""

    def __init__(self, name, params=None, replacement=None):
        self.name = name
        self.params = params
        self.replacement = replacement or []

    def is_function_like(self):
        return self.params is not None

    def get_replacement_text(self):
        return "".join(t.get_raw() for t in self.replacement)


def discard_comment(file_slice):
    """Discard comments and replace them with blank lines."""
    input_text = file_slice.get_content()
    result = FileSlice.copy(file_slice)

    input_text = input_text.replace('\r\n', '\n')
    input_text = re.sub(r'//.*\n', '\n', input_text)

    state = 0
    line = ""
    string = ""
    cursor = 0
    while cursor < len(input_text):
        if not state and input_text[cursor] == '/' and cursor + 1 < len(input_text) and input_text[cursor + 1] == '*':
            state = 1
            line = ""
            cursor += 1
        elif state == 1:
            if input_text[cursor] == '\n':
                line += '\n'
            elif input_text[cursor] == '*' and cursor + 1 < len(input_text) and input_text[cursor + 1] == '/':
                state = 0
                string += line
                cursor += 1
        elif not state:
            string += input_text[cursor]
        cursor += 1

    result.content = string.split('\n')
    return result


def process_include(input_slice, paths, file_interface, nesting=0):
    """Process #include directives, combining included files into a single FileSlice chain."""
    paths = list(paths) + ['./']
    lexer = Lexer(input_slice)
    result = FileSlice.copy(input_slice)
    remain = result
    errors = []

    def seek(f):
        while f.next:
            f = f.next
        return f

    def chain_size(s):
        total = 0
        while s:
            total += s.size
            s = s.next
        return total

    def cum_start_of(head, target):
        cum = 0
        s = head
        while s and s is not target:
            cum += s.size
            s = s.next
        return cum

    def look_for_file(f):
        for p in paths:
            full = os.path.join(p, f)
            if file_interface.exist_sync(full):
                return full
        return None

    line_shift = 0
    look = lexer.scan()

    while look:
        if look.content != Reserved.HASH_INCLUDE or not look.first:
            look = lexer.scan()
            continue

        last = look
        look = lexer.scan()

        if look is None or look.get_type() != TokenType.STRING:
            errors.append(f"unexpected token after #include at line {last.line}")
            lexer.skip_line()
            look = lexer.scan()
            continue

        if look.line != last.line:
            errors.append(f"unexpected line feed after #include at line {look.line}")
            look = lexer.scan()
            continue

        file_path = look.content.content[1:-1]
        found_file = look_for_file(file_path)

        if nesting > 15:
            errors.append(f"nesting overflow at line {last.line}")
            break

        if not found_file:
            errors.append(f"file not found: {file_path} at line {look.line}")
            look = lexer.scan()
            continue

        adjusted_line = look.line + line_shift
        remain_cum = cum_start_of(result, remain)
        remain.clear(adjusted_line - remain_cum)

        file_content = file_interface.read_file_sync(found_file)
        file = discard_comment(FileSlice.from_file(file_path, file_content, 0))
        combine = process_include(file, paths, file_interface, nesting + 1)
        inserted_size = chain_size(combine["value"])

        remain_cum = cum_start_of(result, remain)
        remain.insert(adjusted_line + 1 - remain_cum, combine["value"])
        line_shift += inserted_size

        errors.extend(combine["errors"])
        remain = seek(remain)
        look = lexer.scan()

    return {"value": result, "errors": errors}


def evaluate_conditional_expression(lexer, macros):
    """Evaluate a conditional expression for #if directives."""
    token = [None]

    def next_token():
        token[0] = lexer.scan()
        return token[0]

    def token_raw():
        return token[0].get_raw() if token[0] else ""

    def expand_macro(name):
        if name in macros:
            m = macros[name]
            if m and m.replacement:
                return "".join(t.get_raw() for t in m.replacement)
            return "0"
        return "0"

    def expression():
        return logical_or()

    def logical_or():
        left = logical_and()
        while token[0] and token_raw() == "||":
            next_token()
            right = logical_and()
            left = 1 if (left or right) else 0
        return left

    def logical_and():
        left = equality()
        while token[0] and token_raw() == "&&":
            next_token()
            right = equality()
            left = 1 if (left and right) else 0
        return left

    def equality():
        left = relational()
        while token[0] and token_raw() in ("==", "!="):
            op = token_raw()
            next_token()
            right = relational()
            if op == "==":
                left = 1 if left == right else 0
            else:
                left = 1 if left != right else 0
        return left

    def relational():
        left = unary()
        while token[0] and token_raw() in ("<", ">", "<=", ">="):
            op = token_raw()
            next_token()
            right = unary()
            if op == "<":
                left = 1 if left < right else 0
            elif op == ">":
                left = 1 if left > right else 0
            elif op == "<=":
                left = 1 if left <= right else 0
            elif op == ">=":
                left = 1 if left >= right else 0
        return left

    def unary():
        if token[0] and token_raw() == "!":
            next_token()
            v = unary()
            return 0 if v else 1
        return primary()

    def primary():
        if not token[0]:
            return 0

        if token_raw() == "(":
            next_token()
            val = expression()
            if token[0] and token_raw() == ")":
                next_token()
            return val

        if token[0].get_type() == TokenType.WORD and token_raw() == "defined":
            next_token()
            has_paren = False
            if token[0] and token_raw() == "(":
                has_paren = True
                next_token()
            macro_name = ""
            if token[0] and token[0].get_type() == TokenType.WORD:
                macro_name = token_raw()
            next_token()
            if has_paren and token[0] and token_raw() == ")":
                next_token()
            return 1 if macro_name in macros else 0

        if token[0] and _DIGIT_RE.match(token_raw() or " "):
            val = float(token_raw())
            next_token()
            return val

        if token[0] and token[0].get_type() == TokenType.WORD:
            name = token_raw()
            next_token()
            val = expand_macro(name)
            return float(val) or 0

        next_token()
        return 0

    next_token()
    result = expression()
    return result if result else 0


class PreprocessParser:
    """Preprocessor parser that handles directives and macro expansion."""

    def __init__(self, file_slice, macros=None, include_paths=None, file_interface=None):
        if macros is None:
            macros = {}
        if include_paths is None:
            include_paths = []
        if file_interface is None:
            file_interface = FileInterface()

        combined = process_include(discard_comment(file_slice), include_paths, file_interface)
        self.input = combined["value"]
        self.result = FileSlice.copy(self.input)
        self.lexer = Lexer(self.input)
        self.look = None
        self.errors = combined["errors"]
        self.warnings = []
        self.macros = macros
        self.conditional_stack = []
        self.expanding_macros = set()

        self.move()

    def move(self):
        self.look = self.lexer.scan()
        return self.look

    def is_skipping(self):
        for frame in self.conditional_stack:
            if frame["skipping"]:
                return True
        return False

    def clear_result_line(self, absolute_line, file_slice):
        file_slice.clear(absolute_line - file_slice.parent_line)

    def clear_current_line(self):
        self.look.file_slice.clear(self.look.line - self.look.file_slice.parent_line)

    def replace_result_word(self, absolute_line, file_slice, col, length, text):
        file_slice.replace_word(absolute_line - file_slice.parent_line, col, length, text)

    def parse_define(self, undef=False):
        last = self.look
        self.move()

        if not self.look or not Token.is_same_line(last, self.look):
            self.errors.append(f"no macro name at line {last.line}")
            return False

        if self.look.get_type() != TokenType.WORD:
            self.errors.append(f"invalid macro name at line {self.look.line}")
            return False

        name = self.look.get_raw()
        name_token = self.look
        self.clear_result_line(last.line, last.file_slice)

        if undef:
            if name in self.macros:
                del self.macros[name]
            while self.look and Token.is_same_line(last, self.look):
                self.move()
            return True

        self.move()
        macro = self.parse_define_content(name, name_token)
        self.macros[name] = macro
        return True

    def parse_define_content(self, name, name_token):
        params = None
        replacement = []

        if (self.look and Token.is_same_line(name_token, self.look)
                and self.look.content.content == "(" and not self.look.spaced):
            params = []
            self.move()
            while self.look and Token.is_same_line(name_token, self.look):
                if self.look.content.content == ")":
                    self.move()
                    break
                if self.look.content.content == ",":
                    self.move()
                    continue
                if self.look.get_type() == TokenType.WORD:
                    params.append(self.look.get_raw())
                    self.move()
                else:
                    self.errors.append(f"unexpected token in macro params at line {self.look.line}")
                    self.move()

        while self.look and Token.is_same_line(name_token, self.look):
            replacement.append(self.look)
            self.move()

        return Macro(name, params, replacement)

    def parse_if(self):
        directive_line = self.look.line
        directive_slice = self.look.file_slice
        condition = evaluate_conditional_expression(self.lexer, self.macros)
        skipping = not condition
        self.conditional_stack.append({"skipping": skipping, "hadTrueBranch": not skipping})
        self.clear_result_line(directive_line, directive_slice)
        self.look = self.lexer.look

    def parse_ifdef(self):
        directive_line = self.look.line
        directive_slice = self.look.file_slice
        self.move()
        macro_name = ""
        if self.look and Token.is_same_line(type('X', (), {'line': directive_line, 'file_slice': self.look.file_slice})(), self.look):
            if self.look.get_type() == TokenType.WORD:
                macro_name = self.look.get_raw()
            self.move()
        condition = macro_name in self.macros
        self.conditional_stack.append({"skipping": not condition, "hadTrueBranch": condition})
        self.clear_result_line(directive_line, directive_slice)
        while self.look and self.look.line == directive_line:
            self.move()

    def parse_ifndef(self):
        directive_line = self.look.line
        directive_slice = self.look.file_slice
        self.move()
        macro_name = ""
        if self.look and Token.is_same_line(type('X', (), {'line': directive_line, 'file_slice': self.look.file_slice})(), self.look):
            if self.look.get_type() == TokenType.WORD:
                macro_name = self.look.get_raw()
            self.move()
        condition = macro_name not in self.macros
        self.conditional_stack.append({"skipping": not condition, "hadTrueBranch": condition})
        self.clear_result_line(directive_line, directive_slice)
        while self.look and self.look.line == directive_line:
            self.move()

    def parse_elif(self):
        directive_line = self.look.line
        directive_slice = self.look.file_slice
        if not self.conditional_stack:
            self.errors.append(f"unexpected #elif without #if at line {directive_line}")
            self.move()
            return
        top = self.conditional_stack[-1]
        if top["hadTrueBranch"]:
            top["skipping"] = True
            self.clear_result_line(directive_line, directive_slice)
            while self.look and self.look.line == directive_line:
                self.move()
        else:
            condition = evaluate_conditional_expression(self.lexer, self.macros)
            top["skipping"] = not condition
            top["hadTrueBranch"] = bool(condition)
            self.clear_result_line(directive_line, directive_slice)
            self.look = self.lexer.look

    def parse_else(self):
        directive_line = self.look.line
        directive_slice = self.look.file_slice
        if not self.conditional_stack:
            self.errors.append(f"unexpected #else without #if at line {directive_line}")
            self.move()
            return
        top = self.conditional_stack[-1]
        if top["hadTrueBranch"]:
            top["skipping"] = True
        else:
            top["skipping"] = False
            top["hadTrueBranch"] = True
        self.clear_result_line(directive_line, directive_slice)
        self.move()
        while self.look and self.look.line == directive_line:
            self.move()

    def parse_endif(self):
        directive_line = self.look.line
        directive_slice = self.look.file_slice
        if not self.conditional_stack:
            self.errors.append(f"unexpected #endif without #if at line {directive_line}")
            self.move()
            return
        self.conditional_stack.pop()
        self.clear_result_line(directive_line, directive_slice)
        self.move()
        while self.look and self.look.line == directive_line:
            self.move()

    def macro_expansion(self):
        macro_name = self.look.get_raw()
        macro = self.macros.get(macro_name)

        if not macro or macro_name in self.expanding_macros:
            return

        self.expanding_macros.add(macro_name)

        if not isinstance(macro, Macro):
            raw = str(macro)
            self.replace_result_word(self.look.line, self.look.file_slice, self.look.column, len(macro_name), raw)
            self.expanding_macros.discard(macro_name)
            return

        if not macro.is_function_like():
            text = macro.get_replacement_text()
            self.replace_result_word(self.look.line, self.look.file_slice, self.look.column, len(macro_name), text)
        else:
            saved_look = self.look
            self.move()

            if (self.look and Token.is_same_line(saved_look, self.look)
                    and self.look.content.content == "(" and not self.look.spaced):
                args = []
                current_arg = []
                self.move()
                paren_depth = 1

                while self.look and paren_depth > 0:
                    if self.look.content.content == "(":
                        paren_depth += 1
                        current_arg.append(self.look)
                    elif self.look.content.content == ")":
                        paren_depth -= 1
                        if paren_depth == 0:
                            args.append(current_arg)
                            break
                        current_arg.append(self.look)
                    elif self.look.content.content == "," and paren_depth == 1:
                        args.append(current_arg)
                        current_arg = []
                    else:
                        current_arg.append(self.look)
                    self.move()

                result_text = ""
                for t in macro.replacement:
                    raw = t.get_raw()
                    if raw in macro.params:
                        param_idx = macro.params.index(raw)
                        if param_idx < len(args):
                            result_text += "".join(at.get_raw() for at in args[param_idx])
                    else:
                        result_text += raw

                end_col = (self.look.column + 1 if self.look else saved_look.column + len(macro_name))
                self.replace_result_word(saved_look.line, saved_look.file_slice, saved_look.column, end_col - saved_look.column, result_text)
            else:
                self.expanding_macros.discard(macro_name)
                return

        self.expanding_macros.discard(macro_name)

    def parse(self):
        while self.look:
            handled_directive = False

            if self.look.first:
                content = self.look.content

                if content == Reserved.HASH_DEFINE:
                    handled_directive = True
                    if not self.is_skipping():
                        self.parse_define(False)
                    else:
                        line_d = self.look.line
                        slice_d = self.look.file_slice
                        self.clear_result_line(line_d, slice_d)
                        while self.look and self.look.line == line_d:
                            self.move()
                elif content == Reserved.HASH_UNDEF:
                    handled_directive = True
                    if not self.is_skipping():
                        self.parse_define(True)
                    else:
                        line_u = self.look.line
                        slice_u = self.look.file_slice
                        self.clear_result_line(line_u, slice_u)
                        while self.look and self.look.line == line_u:
                            self.move()
                elif content == Reserved.HASH_IF:
                    handled_directive = True
                    self.parse_if()
                elif content == Reserved.HASH_IFDEF:
                    handled_directive = True
                    self.parse_ifdef()
                elif content == Reserved.HASH_IFNDEF:
                    handled_directive = True
                    self.parse_ifndef()
                elif content == Reserved.HASH_ELIF:
                    handled_directive = True
                    self.parse_elif()
                elif content == Reserved.HASH_ELSE:
                    handled_directive = True
                    self.parse_else()
                elif content == Reserved.HASH_ENDIF:
                    handled_directive = True
                    self.parse_endif()
                elif content == Reserved.HASH_INCLUDE:
                    handled_directive = True
                    line_i = self.look.line
                    slice_i = self.look.file_slice
                    self.clear_result_line(line_i, slice_i)
                    while self.look and self.look.line == line_i:
                        self.move()

            if not self.look:
                break

            if handled_directive:
                continue

            if self.is_skipping():
                self.clear_current_line()
                self.move()
                continue

            if self.look.get_type() == TokenType.WORD:
                self.macro_expansion()

            self.move()


def preprocess(file_slice, options=None):
    """Preprocess a source file, expanding all directives and macros.

    Args:
        file_slice: Input FileSlice or string to preprocess.
        options: Dict with optional keys:
            - include_paths: list of paths to search for #include files.
            - macros: dict of predefined macros.
            - file_interface: FileInterface instance.

    Returns:
        dict with keys: result, errors, warnings, macros.
    """
    opts = options or {}
    include_paths = opts.get("include_paths", [])
    macros = opts.get("macros", {})
    file_interface = opts.get("file_interface", FileInterface())

    if not isinstance(file_slice, FileSlice):
        file_slice = FileSlice.from_file("", file_slice, 0)

    parser = PreprocessParser(file_slice, macros, include_paths, file_interface)
    parser.parse()

    return {
        "result": parser.result,
        "errors": parser.errors,
        "warnings": parser.warnings,
        "macros": parser.macros,
    }
