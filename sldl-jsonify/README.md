# sldl-jsonify

JSON and Itanium frontend for `sldl-objects` - Sky:CotL level editor.

## Installation

```sh
npm i sldl-jsonify
```

## Quick Start

### JSON Declaration Group

```js
var { JsonLevelObjects } = require("sldl-jsonify");
var fs = require("fs");

// Define types as JSON.
var declGroup = {
  "C$MyType": {
    "$parent": "Object",
    "enabled": "bool",
    "speed": "float",
    "label": "cstring",
    "target": "C$MyType *",
    "children": "C$MyType *[]"
  }
};

var jlo = new JsonLevelObjects(declGroup);

// Read binary -> JSON.
var { objects } = jlo.read(fs.readFileSync("Objects.level.bin"));
console.log(objects["O$SomeObject"].enabled);

// Write JSON -> binary.
fs.writeFileSync("output.bin", jlo.write(objects));
```

### Itanium Type Declarations

```js
var { JsonLevelObjects, ItaniumResolver } = require("sldl-jsonify");

// Parse Itanium mangled type strings.
var resolver = new ItaniumResolver("C5ClumpT4dataA_P6ObjectEE");
var types = resolver.resolve();

// Or get declaration group JSON from itanium.
var declGroup = resolver.resolveToDeclGroup();
// -> { "C$Clump": { "data": "Object *[]" } }

var jlo = new JsonLevelObjects(itaniumString, true);
```

## Declaration Group Format

Declaration groups use prefixed keys to define types:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `C$` | Class | `"C$Actor": { "$parent": "Object", "hp": "int32_t" }` |
| `S$` | Struct | `"S$Vec3": { "x": "float", "y": "float", "z": "float" }` |
| `E$` | Enum | `"E$Color": { "$as": "int32_t", "Red": 1, "Blue": 2 }` |
| `A$` | Alias | `"A$Health": "int32_t"` |

### Class Members

```
<TypeName>                    inline type (number, struct, string)
<TypeName> *                  object pointer
<TypeName> *[]                dynamic pointer array
<TypeName> *[N]               fixed-size pointer array
<TypeName> []                 inline object array
<TypeName> [N]                fixed-size inline object array
R$<N>                         raw binary of N bytes
```

### JSON Value Format

**Numbers**: plain JS numbers, `"B$<hex>"` for binary values, `"K$<enum>"` for enum constants.

**Raw bytes**: `"B$<hex>"` only. Hex is big-endian, right-aligned to target size.

**References**: `"P$<objectName>"` or `null`.

### Object Format

```json
{
  "O$ObjectName": {
    "$type": "ClassName",
    "memberA": value,
    "memberB": "P$OtherObject"
  }
}
```

## Itanium Format

Itanium ABI name-mangled type strings. See the table below for the encoding:

| Char | Meaning |
|------|---------|
| `C` | Class declaration start |
| `U` | Struct declaration start |
| `D` | Type alias |
| `T` | Member list start |
| `E` | End of declaration / member list |
| `F` | Class parent name follows |
| `L` | Struct alignment follows |
| `A` | Array type prefix (optional count follows) |
| `P` | Pointer type |
| `b` | bool |
| `c` | int8_t |
| `h` | uint8_t |
| `s` | int16_t |
| `t` | uint16_t |
| `i` | int32_t |
| `j` | uint32_t |
| `x` | int64_t |
| `y` | uint64_t |
| `f` | float |
| `d` | double |
| `g` | TgcString |

Example: `C5ActorT2hpbF5EnemyE` - class `Actor` with members `hp` (int32) and parent `Enemy`.

## API Reference

### JsonLevelObjects

```js
new JsonLevelObjects(declGroup)          // from JSON declaration group
new JsonLevelObjects(itaniumStr, true)   // from itanium string
jlo.read(buffer)                         // -> { objects, declGroup }
jlo.write(objects)                       // -> Buffer
```

### DeclarationGroup

```js
var dg = new DeclarationGroup(declGroupObj)
dg.parse()                               // -> this
dg.types                                 // Map<string, MetaType>
dg.classes                               // Map<string, MetaTypeClass>
dg.enumConstants                         // Map<string, value>
dg.resolveType(name)                     // -> MetaType | undefined
```

### ItaniumResolver

```js
ItaniumResolver.resolve(itaniumString)   // static: -> MetaType[]
var r = new ItaniumResolver(str)
r.resolve()                              // parse
r.resolveToDeclGroup()                   // -> JSON decl group object
r.names                                  // Map<string, MetaType>
```

### JSON Value Helpers

```js
var jsonValue = require("sldl-jsonify").jsonValue
jsonValue.parse(jsonValue, member, dg)   // JSON -> LevelValue
jsonValue.serialize(levelValue)          // LevelValue -> JSON
```

## License

LGPL-3.0-or-later - Copyright (c) 2026 That Sky Project
