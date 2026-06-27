# That Sky Compiler (Python)

A Python port of [that-sky-compiler](https://github.com/that-sky-project/that-sky-compiler) — a compiler for **Sky Level Description Language (SLDL)** that reads and writes TGCL `.level.bin` binary files used by *Sky: Children of the Light*.

**Pure Python. Zero external dependencies. Runs on Termux.**

## Features

- **Binary read/write**: Read `.level.bin` files to JSON, write JSON back to binary
- **Byte-exact compatibility**: Produces identical binary output to the original JavaScript implementation
- **Type system**: Full MetaType/LevelValue type system with structs, classes, pointers, enums
- **JSON frontend**: DeclarationGroup + JsonLevelObjects for easy JSON-based workflows
- **Preprocessor**: TSPP (That Sky Preprocessor) with `#include`, `#define`, `#if`/`#ifdef`/`#ifndef`, macro expansion
- **CLI**: Command-line tool for batch conversion
- **Auto-type creation**: Can read binary files without declarations (auto-creates types from binary metadata)

## Installation

> **Note:** This package is NOT on PyPI. `pip install that-sky-compiler` will fail.
> Install from the local source directory instead (see below).

### Termux (Android) - One-click install

```bash
# 1. Install Python
pkg install python

# 2. Clone or copy the project, then run the install script
cd that-sky-compiler-py
chmod +x install_termux.sh
./install_termux.sh
```

### Termux - Manual install

```bash
pkg install python
cd that-sky-compiler-py
pip install . --break-system-packages
```

### From source (any Linux/macOS)

```bash
git clone https://github.com/that-sky-project/that-sky-compiler.git
cd that-sky-compiler-py
pip install .
```

### Without installation (run directly)

If you don't want to install, you can run it directly:

```bash
# Option A: standalone script
python3 tsc.py read input.level.bin decl.json -o output.json

# Option B: as a module
python3 -m that_sky_compiler.cli read input.level.bin decl.json -o output.json
```

## Quick Start

### CLI Usage

```bash
# Read a .level.bin file and output JSON
that-sky-compiler read input.level.bin decl.json -o output.json

# Write JSON to a .level.bin file
that-sky-compiler write input.json decl.json -o output.level.bin

# Auto-detect format and convert
that-sky-compiler convert input.level.bin -o output.json

# Read without declarations (auto-create types)
that-sky-compiler read input.level.bin -o output.json

# Show version
that-sky-compiler version
```

### Python API

```python
from that_sky_compiler.jsonify import JsonLevelObjects, DeclarationGroup

# Load declarations
decl = DeclarationGroup({
    "S$Vector4": {
        "$align": 16,
        "x": "float", "y": "float", "z": "float", "w": "float"
    },
    "C$Marker": {
        "enabled": "bool",
        "pos": "Vector4"
    }
}).parse()

# Write JSON objects to binary
jlo = JsonLevelObjects(decl)
binary = jlo.write({
    "O$marker1": {
        "$type": "Marker",
        "enabled": True,
        "pos": {"x": 0, "y": 10, "z": 0, "w": 0}
    }
})

# Read binary back to JSON
jlo2 = JsonLevelObjects(decl)
objects = jlo2.read(binary)
print(objects)
```

## Declaration Group Format

JSON declarations use prefixed keys:

| Prefix | Meaning  | Example |
|--------|----------|---------|
| `A$`   | Type alias | `"A$Vec3": "Vector4"` |
| `E$`   | Enum | `"E$Color": {"$as": "int32_t", "Red": 0, "Green": 1}` |
| `S$`   | Struct | `"S$Vector4": {"x": "float", ...}` |
| `C$`   | Class | `"C$Marker": {"enabled": "bool", ...}` |
| `O$`   | Object instance | `"O$spawn": {"$type": "Marker", ...}` |

### Member type syntax

```
float              # Number type
Vector4            # Struct member
Marker*            # Pointer to class
Marker*[]          # Array of pointers
Marker[]           # Array of class instances
Clump<Object>*     # Pointer to Clump<Object>
R$16               # Raw 16-byte blob
```

### Value syntax in JSON

```
42                 # Integer
3.14               # Float
true / false       # Boolean
"hello"            # String
"P$objectName"     # Pointer reference
"B$deadbeef"       # Raw hex bytes
"K$EnumConstant"   # Enum constant reference
null               # Null pointer
```

## Architecture

```
that_sky_compiler/
├── __init__.py          # Package init
├── cli.py               # Command-line interface
├── headers.py           # Standard declaration library loader
├── utils.py             # Exceptions, FileSlice, FileInterface
├── objects/             # Core binary reader/writer
│   ├── __init__.py
│   ├── binaryio.py      # Little-endian binary I/O helpers
│   ├── exceptions.py    # Object-level exceptions
│   ├── meta_type.py     # MetaType type system (Bool, Number, Pointer, String, Struct, Class, Clump)
│   ├── level_value.py   # LevelValue value system (Bool, Number, Pointer, String, Struct, Class, Raw)
│   ├── types.py         # Built-in type registry
│   └── level_objects.py # TGCL binary format reader/writer (LoHeader, LoClass, LoMemvar, LevelObjects)
├── jsonify/             # JSON frontend
│   ├── __init__.py      # JsonLevelObjects high-level API
│   ├── exceptions.py    # JSON-level exceptions
│   ├── decl_group.py    # DeclarationGroup parser
│   └── json_value.py    # JSON <-> LevelValue conversion
├── preprocessor.py      # TSPP preprocessor (#include, #define, #if, macros)
└── frontend.py          # SLDL compiler lexer/frontend
```

## TGCL Binary Format

The `.level.bin` files use the **TGCL** (That Game Class Layout) format:

```
Offset  Size  Field
0x00    4     Magic "TGCL"
0x04    4     Version
0x08    4     Number of classes
0x0C    4     Number of memvars
0x10    4     Number of objects
0x14    4     Number of references
0x18    4     Classes section offset
0x1C    4     Memvars section offset
0x20    4     Strings section offset
0x24    4     Objects section offset
0x28    4     File size
```

## Termux Notes

This implementation is designed to run on **Termux** (Android terminal emulator):

- **No C extensions**: Pure Python, no compilation needed
- **No external dependencies**: Only uses Python standard library
- **Python 3.8+**: Compatible with Termux's default Python package
- **Low memory**: Efficient binary handling with bytearray

Install on Termux:
```bash
pkg install python
pip install that-sky-compiler
```

## License

LGPL-3.0-or-later — same as the original project.

## Credits

- Original JavaScript implementation: [that-sky-project/that-sky-compiler](https://github.com/that-sky-project/that-sky-compiler)
- Python port maintained for Termux compatibility
