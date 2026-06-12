# sldl-objects

Object-oriented TGCL `.level.bin` binary reader/writer for Sky: Children of the Light.

## Installation

```sh
npm i sldl-objects
```

## Quick Start

```js
var { LevelObjects, MetaTypeClass, kMetaTypes, LevelValueClass,
  LevelValueBool, LevelValueNumber, LevelValueString, LevelValuePointer } = require("sldl-objects");
var fs = require("fs");

// 1. Define your types.
var def = new MetaTypeClass("MyType");
def.addMember(kMetaTypes.Bool, "enabled");
def.addMember(kMetaTypes.Float, "speed");
def.addMember(kMetaTypes.CString, "label");

// 2. Create the reader/writer.
var lo = new LevelObjects([def]);

// 3. Read a binary file.
var objects = lo.readBinary(fs.readFileSync("level.bin"));
for (var [name, obj] of objects) {
  console.log(name, obj.getValue("enabled").getValue());
}

// 4. Create a new object and write back.
var obj = new LevelValueClass(def, "MyObject");
var bv = new LevelValueBool(kMetaTypes.Bool);
bv.setValue(true);
obj.setValue("enabled", bv);
obj.finalize();
lo.set(obj);

var buffer = lo.writeBinary();
fs.writeFileSync("output.bin", buffer);
```

## API Reference

### LevelObjects

Main entry point for binary I/O.

```js
var lo = new LevelObjects(definitions)
```

- `definitions` - array of `MetaType` instances (classes, structs, aliases).

```js
lo.readBinary(buffer)  // Buffer -> Map<string, LevelValueClass>
lo.writeBinary()       // -> Buffer
lo.get(name)           // -> LevelValueClass | undefined
lo.set(object)         // stores a LevelValueClass for writing
```

### MetaType Hierarchy

| Class | Description | valueType |
|-------|-------------|-----------|
| `MetaType` | Abstract base | `None` |
| `MetaTypeBool` | Boolean (1 byte) | `Number` |
| `MetaTypeNumber` | Integer or float (1-8 bytes) | `Number` |
| `MetaTypeString` | Nul-terminated string | `String` |
| `MetaTypePointer` | Object reference (uint32) | `Pointer` |
| `MetaTypeRaw` | Opaque binary (N bytes) | `Raw` |
| `MetaTypeStruct` | C-like struct | `Struct` |
| `MetaTypeClass` | Class with inheritance | `Class` |

Built-in types are in `kMetaTypes`:
`bool`, `int8_t`-`uint64_t`, `float`, `double`, `cstring`, `TgcString`, `pointer`, `Object`, `Clump`

### MetaTypeClass

```js
var cls = new MetaTypeClass(name, parent)
cls.addMember(type, name)        // scalar member
cls.addMember(type, name, 0)     // dynamic array member
cls.addMember(type, name, N)     // fixed-size array member
cls.getMember(name)              // lookup member
cls.allMembers()                 // all members (including inherited)
```

### LevelValue Hierarchy

| Class | Wraps |
|-------|-------|
| `LevelValue` | Abstract base |
| `LevelValueBool` | boolean |
| `LevelValueNumber` | number / BigInt |
| `LevelValueString` | string |
| `LevelValuePointer` | object reference (index or name-based) |
| `LevelValueRaw` | Buffer |
| `LevelValueStruct` | struct (Map of members) |
| `LevelValueClass` | object (Map of members + name) |

### Internal Classes

- `LoHeader` - 44-byte file header parser.
- `LoStringPool` - string interning for the binary format.
- `LoMemvar` - member variable descriptor (type, name, size, aux).
- `LoClass` - raw class descriptor from binary.
- `LoIndices` - runtime index tables for classes, objects, and pointers.

## Binary Format (TGCL)

```
Header (44 bytes): magic "TGCL", version, counts, offsets
Type Table:        numClasses x 12 bytes (name, firstMember, memberCount)
Member Table:      numMemVars x 16 bytes (type, nameOffset, size, aux)
String Pool:       nul-terminated strings
Object Data:       per-object [typeIndex:uint32, name:\0-str, member data...]
```

Member types: `0=raw`, `1=string`, `2=ref`, `3=array`.

## License

LGPL-3.0-or-later - Copyright (c) 2026 That Sky Project
