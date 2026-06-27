"""
sldl-utils - Utility classes: exception system and file slicing.

Ported from the JavaScript sldl-utils package.
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later
"""


class SldlException(Exception):
    """Base exception for all SLDL errors."""

    def __init__(self, msg, exc_type=None):
        super().__init__(msg)
        self.type = exc_type


class SimpleExceptionBuilder:
    """Builds exceptions with a fixed message."""

    def __init__(self, msg):
        self.message = msg

    def build(self, *args):
        return SldlException(self.message, self)


class DynamicExceptionBuilder:
    """Builds exceptions with a dynamically generated message."""

    def __init__(self, builder):
        self.builder = builder

    def build(self, *args):
        return SldlException(self.builder(*args), self)


class FileSlice:
    """A linked-list of file content slices, used by the preprocessor."""

    Null = None  # set after class definition

    @staticmethod
    def copy(a, b=None):
        result = b or FileSlice()
        result.file = a.file
        result.content = a.content
        result.parent_line = a.parent_line
        result.size = a.size
        result.next = a.next
        return result

    @staticmethod
    def from_file(file, content, start=0, line=None, nxt=None):
        result = FileSlice()
        result.complete_file = content
        result.file = file
        lines = content.split("\n")
        if line is None:
            result.content = lines
        else:
            result.content = lines[start:start + line]
        result.size = len(result.content) if line is None else line
        result.parent_line = start
        result.next = nxt
        return result

    def __init__(self):
        self.file = ""
        self.content = []
        self.parent_line = 0
        self.size = 0
        self.next = None
        self.complete_file = ""

    def get_content(self):
        return "\n".join(self.content)

    def get_line(self, line):
        if 0 <= line < len(self.content):
            return self.content[line]
        return None

    def insert(self, start, inserted):
        old_lines = self.content[:start]
        new_lines = self.content[start:]

        if not new_lines:
            inserted.next = self.next
            self.next = inserted
            return self
        elif not old_lines:
            result = FileSlice.copy(self)
            FileSlice.copy(inserted, self)
            s = self
        else:
            result = FileSlice.copy(self)
            result.content = new_lines
            result.parent_line = self.parent_line + start
            result.size = len(new_lines)
            self.next = inserted
            self.content = old_lines
            self.size = len(old_lines)
            s = inserted

        while True:
            if s.next is None:
                s.next = result
                break
            s = s.next
        return self

    def clear(self, line, count=1):
        for i in range(line, line + count):
            if i < len(self.content) and isinstance(self.content[i], str):
                self.content[i] = ""
        return self

    def slice(self, start, line):
        result = FileSlice.copy(self)
        result.content = self.content[start:line]
        result.next = None
        result.size = len(result.content)
        return result

    def replace_word(self, line, begin, length, string):
        r = self.content[line][:begin]
        s = self.content[line][begin + length:]
        string = string.replace("\n", "")
        self.content[line] = r + string + s

    def flatten(self):
        result = FileSlice()
        content = []
        slice_ = self
        result.file = self.file
        result.parent_line = 0
        while slice_ is not None:
            content = content + slice_.content
            slice_ = slice_.next
        result.content = content
        result.size = len(content)
        result.next = None
        return result

    def __str__(self):
        s = f'# "{self.file}": {self.parent_line}\n{self.get_content()}'
        if self.next:
            s += "\n" + str(self.next)
        return s


FileSlice.Null = FileSlice()


class FileInterface:
    """File system abstraction. Override for different environments."""

    def exist_sync(self, path):
        import os
        return os.path.exists(path)

    def read_file_sync(self, path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
