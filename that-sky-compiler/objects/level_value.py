"""
sldl-objects value system - all LevelValue classes.

Ported from the JavaScript sldl-objects/src/value/*.js files.
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later

All LevelValue subclasses are combined here to avoid circular import issues.
"""

from .meta_type import kMetaValueType


class LevelValue:
    """Base class for all level values."""

    def __init__(self, defn):
        self.defn = defn
        self.value = None

    @staticmethod
    def size_of(entry):
        """Byte size of a stored member entry (single value or array)."""
        if not isinstance(entry, list):
            return entry.get_size()
        size = 4  # array count prefix
        for item in entry:
            size += item.get_size()
        return size

    def get_def(self):
        return self.defn

    def get_size(self):
        return self.defn.get_size()

    def get_align(self):
        return self.defn.get_align()

    def get_value(self):
        return self.value

    def set_value(self, value):
        self.value = value

    def value_type(self):
        return self.defn.value_type()


class LevelValueBool(LevelValue):
    """Boolean value (stored as 1 byte)."""
    pass


class LevelValueNumber(LevelValue):
    """Numeric value (int or float of various sizes)."""
    pass


class LevelValuePointer(LevelValue):
    """Pointer value - a uint32 index into the objects array."""

    def __init__(self, defn=None):
        if defn is None:
            from .types import kMetaTypes
            defn = kMetaTypes["Pointer"]
        super().__init__(defn)
        self.index = 0
        self.target_name = None  # Target object name for P$ resolution.

    def backpatch(self, L):
        """Resolve the pointer index to the actual object after all objects are read."""
        if self.index == 0xFFFFFFFF:
            self.set_value(None)
            return

        if self.index < 0 or self.index >= len(L.objects):
            raise kObjectExceptions["InvalidObjectIndex"].build(self.index)

        obj = L.objects[self.index]
        self.set_value(obj)

    def set_index(self, index):
        self.index = index


# Late import to avoid circular dependency
from .exceptions import kObjectExceptions


class LevelValueString(LevelValue):
    """String value - null-terminated on disk.

    Raw bytes are preserved on read so that the consumed and written byte
    count matches the file exactly, even when bytes are not valid UTF-8.
    """

    def __init__(self, defn):
        super().__init__(defn)
        self.raw = None  # Raw on-disk bytes (excluding null terminator).

    def get_size(self):
        if self.raw is not None:
            return len(self.raw) + 1
        s = self.value if isinstance(self.value, str) else ""
        return len(s.encode("utf-8")) + 1

    def get_value(self):
        if isinstance(self.value, str):
            return self.value
        return ""

    def set_value(self, value):
        self.value = value
        self.raw = None

    def set_raw(self, bytes_data):
        """Set from raw on-disk bytes (excluding terminator)."""
        self.raw = bytes_data
        self.value = bytes_data.decode("utf-8", errors="replace")

    def get_bytes(self):
        """Bytes to serialize, excluding the terminator."""
        if self.raw is not None:
            return self.raw
        s = self.value if isinstance(self.value, str) else ""
        return s.encode("utf-8")


class LevelValueStruct(LevelValue):
    """Struct value - a collection of named member values."""

    def __init__(self, defn):
        super().__init__(defn)
        self.value = {}  # ordered dict: name -> LevelValue

    def get_value(self, name=None):
        if name is None:
            return self.value
        return self.value.get(name)

    def set_value(self, name, value):
        self.value[name] = value


class LevelValueClass(LevelValue):
    """Class instance value - a collection of named member values with a name."""

    def __init__(self, defn, name):
        super().__init__(defn)
        self.name = name
        self.value = {}  # ordered dict: name -> LevelValue
        self.size = 0

    def get_size(self):
        return self.size

    def get_name(self):
        return self.name

    def finalize(self):
        size = 0
        for m in self.value.values():
            size += LevelValue.size_of(m)
        self.size = size

    def get_value(self, name=None):
        if name is None:
            return self.value
        return self.value.get(name)

    def set_value(self, name, value):
        self.value[name] = value

    def to_json(self, decl_group=None):
        """Convert to a plain JSON-serializable dict."""
        result = {}
        for key, val in self.value.items():
            result[key] = LevelValueClass.value_to_json(val, decl_group)
        return result

    @staticmethod
    def value_to_json(val, decl_group=None):
        """Convert a LevelValue or list to a plain JSON value."""
        if isinstance(val, list):
            return [LevelValueClass.value_to_json(v, decl_group) for v in val]

        vt = val.value_type()

        if vt == kMetaValueType.Pointer:
            target = val.get_value()
            if target is None:
                return None
            if target is not None and hasattr(target, "get_name"):
                return "P$" + target.get_name()
            return "P$" + str(target)

        if vt == kMetaValueType.Raw:
            buf = val.get_value()
            return buf.hex()

        if vt == kMetaValueType.Struct:
            struct_result = {}
            for mk, mv in val.value.items():
                struct_result[mk] = LevelValueClass.value_to_json(mv, decl_group)
            return struct_result

        if vt == kMetaValueType.Class:
            return val.to_json(decl_group)

        # Number, String
        return val.get_value()


class LevelValueRaw(LevelValue):
    """Raw bytes value."""

    def get_size(self):
        return self.defn.get_size()

    def get_value(self):
        return self.value if self.value is not None else b""

    def set_value(self, value):
        from .binaryio import is_buffer
        if is_buffer(value):
            self.value = bytes(value)
        elif isinstance(value, str):
            self.value = bytes.fromhex(value)
        else:
            self.value = bytearray(self.defn.get_size())
