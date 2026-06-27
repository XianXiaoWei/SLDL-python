"""
Binary I/O helpers for reading/writing TGCL binary data.

Provides little-endian read/write functions compatible with Node.js Buffer API.
"""

import struct


# --- Readers: (buffer, offset) -> value ---

def read_i8(B, off):
    return struct.unpack_from('<b', B, off)[0]

def read_u8(B, off):
    return struct.unpack_from('<B', B, off)[0]

def read_i16(B, off):
    return struct.unpack_from('<h', B, off)[0]

def read_u16(B, off):
    return struct.unpack_from('<H', B, off)[0]

def read_i32(B, off):
    return struct.unpack_from('<i', B, off)[0]

def read_u32(B, off):
    return struct.unpack_from('<I', B, off)[0]

def read_i64(B, off):
    return struct.unpack_from('<q', B, off)[0]

def read_u64(B, off):
    return struct.unpack_from('<Q', B, off)[0]

def read_f32(B, off):
    return struct.unpack_from('<f', B, off)[0]

def read_f64(B, off):
    return struct.unpack_from('<d', B, off)[0]


# --- Writers: (buffer, value, offset) -> None ---

def write_i8(B, val, off):
    struct.pack_into('<b', B, off, val)

def write_u8(B, val, off):
    struct.pack_into('<B', B, off, val)

def write_i16(B, val, off):
    struct.pack_into('<h', B, off, val)

def write_u16(B, val, off):
    struct.pack_into('<H', B, off, val)

def write_i32(B, val, off):
    struct.pack_into('<i', B, off, val)

def write_u32(B, val, off):
    struct.pack_into('<I', B, off, val & 0xFFFFFFFF)

def write_i64(B, val, off):
    struct.pack_into('<q', B, off, val)

def write_u64(B, val, off):
    struct.pack_into('<Q', B, off, val & 0xFFFFFFFFFFFFFFFF)

def write_f32(B, val, off):
    struct.pack_into('<f', B, off, val)

def write_f64(B, val, off):
    struct.pack_into('<d', B, off, val)


# --- String helpers ---

def read_cstring(B, offset):
    """Read a null-terminated string from buffer at offset. Returns (string, end_offset)."""
    if offset >= len(B):
        return "", offset
    end = offset
    while end < len(B) and B[end] != 0:
        end += 1
    return B[offset:end].decode("utf-8", errors="replace"), end


def read_cstring_bytes(B, offset):
    """Read a null-terminated string's raw bytes (excluding terminator). Returns (bytes, end_offset)."""
    if offset >= len(B):
        return b"", offset
    end = offset
    while end < len(B) and B[end] != 0:
        end += 1
    return bytes(B[offset:end]), end


def alloc(size):
    """Allocate a zero-filled bytearray."""
    return bytearray(size)


def is_buffer(x):
    """Check if x is a bytes-like object."""
    return isinstance(x, (bytes, bytearray, memoryview))
