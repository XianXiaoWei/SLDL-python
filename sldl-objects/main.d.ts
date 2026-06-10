/**
 * TGCL binary level format - type declarations.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

import { Buffer, SimpleExceptionBuilder, DynamicExceptionBuilder } from "sldl-utils";

// =========================================================================
// src/exceptions.js
// =========================================================================

/** Exception builders used by the objects layer. */
export const kObjectExceptions: {
  /** Throw when a memvar access goes out of bounds. */
  readonly MemvarOutOfBound: SimpleExceptionBuilder;
  /** Throw when reading an object from the buffer fails. */
  readonly ReadObjectFailed: SimpleExceptionBuilder;
  /** Throw when an unrecognized class name is encountered. */
  readonly InvalidClassName: DynamicExceptionBuilder;
  /** Throw when a duplicate object name is detected. */
  readonly MultipleObjectName: DynamicExceptionBuilder;
  /** Throw when a raw memvar does not match its MetaType member. */
  readonly MemberMismatch: DynamicExceptionBuilder;
  /** Throw when a class index is out of bounds or not registered. */
  readonly InvalidClassIndex: DynamicExceptionBuilder;
  /** Throw when an object index is invalid or not registered. */
  readonly InvalidObjectIndex: DynamicExceptionBuilder;
};

// =========================================================================
// src/type/metaType.js  (base class, declared early - others extend it)
// =========================================================================

/** Enum of meta value type categories. */
export const kMetaValueType: {
  /** Sentinel / unset type. */
  readonly None: 0;
  /** Numeric (integer or float) or boolean. */
  readonly Number: 1;
  /** String type (cstring, TgcString). */
  readonly String: 2;
  /** Struct compound type. */
  readonly Struct: 3;
  /** Class compound type with named instances. */
  readonly Class: 4;
  /** Pointer / reference type. */
  readonly Pointer: 5;
};

/**
 * General type definition.
 * Base class for all meta type descriptors.
 */
export class MetaType {
  /** The type name (e.g. "int32_t", "MyStruct"). */
  protected name: string;

  /**
   * @param name The name of the type.
   */
  constructor(name: string);

  /**
   * Get the name of the type.
   * @returns The type name string.
   */
  getName(): string;

  /**
   * Get the binary size of the type in bytes.
   * @returns Size in bytes; 0 for types with variable or unknown size.
   */
  getSize(): number;

  /**
   * Get the memory alignment of the type in bytes.
   * @returns Alignment in bytes.
   */
  getAlign(): number;

  /**
   * Get the value type category.
   * @returns One of the {@link kMetaValueType} enum values.
   */
  valueType(): number;

  /**
   * Read a value from the binary buffer.
   * @param L Object file context for resolving references.
   * @param B Original binary data buffer.
   * @param off Byte offset to read from.
   * @returns The deserialized value, or undefined if out of bounds.
   */
  read(L: LoIndices, B: Buffer, off: number): any;

  /**
   * Write a value into the binary buffer.
   * @param L Object file context for resolving references.
   * @param B Target binary data buffer.
   * @param val Value to serialize.
   * @param off Byte offset to write at.
   * @returns Number of bytes written, or 0 on failure.
   */
  write(L: LoIndices, B: Buffer, val: any, off: number): number;
}

/**
 * Base class for metatype forwarding (e.g. member types).
 * All accessors delegate to the wrapped {@link def} instance.
 * Not exported from the package - used internally by MetaTypeClassMember
 * and MetaTypeStructMember.
 */
declare class MetaTypeForward extends MetaType {
  /** The underlying type that is forwarded to. */
  protected def: MetaType;

  /**
   * @param def The underlying MetaType to forward to.
   * @param name The display name for this forward.
   */
  constructor(def: MetaType, name: string);

  /**
   * Get the binary size, forwarded to the underlying definition.
   * @returns Size in bytes from the wrapped type.
   */
  getSize(): number;

  /**
   * Get the memory alignment, forwarded to the underlying definition.
   * @returns Alignment in bytes from the wrapped type.
   */
  getAlign(): number;

  /**
   * Get the value type category, forwarded to the underlying definition.
   * @returns One of the {@link kMetaValueType} enum values.
   */
  valueType(): number;

  /**
   * Read a value, forwarded to the underlying definition.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Byte offset to read from.
   * @returns The deserialized value.
   */
  read(L: LoIndices, B: Buffer, off: number): any;

  /**
   * Write a value, forwarded to the underlying definition.
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val Value to serialize.
   * @param off Byte offset to write at.
   * @returns Number of bytes written.
   */
  write(L: LoIndices, B: Buffer, val: any, off: number): number;
}

// =========================================================================
// src/value/levelValue.js  (base value class)
// =========================================================================

/**
 * Base class for runtime level values.
 * Wraps a {@link MetaType} definition and a stored value.
 */
export class LevelValue {
  /** The meta type definition this value conforms to. */
  protected def: MetaType;
  /** The stored value (type varies by subclass). */
  protected value: any;

  /**
   * @param def The MetaType definition for this value.
   */
  constructor(def: MetaType);

  /**
   * Get the MetaType definition of this value.
   * @returns The type definition.
   */
  getDef(): MetaType;

  /**
   * Get the binary size of this value in bytes.
   * @returns Size from the underlying MetaType definition.
   */
  getSize(): number;

  /**
   * Get the memory alignment of this value in bytes.
   * @returns Alignment from the underlying MetaType definition.
   */
  getAlign(): number;

  /**
   * Get the stored value.
   * @returns The raw value (type depends on subclass).
   */
  getValue(): any;

  /**
   * Set the stored value.
   * @param value The new value to store.
   */
  setValue(value: any): void;

  /**
   * Get the value type category.
   * @returns One of the {@link kMetaValueType} enum values.
   */
  valueType(): number;
}

// =========================================================================
// src/value/levelValueNumber.js
// =========================================================================

/** Boolean value backed by a {@link MetaTypeBool}. */
export class LevelValueBool extends LevelValue {
  /**
   * @param def Must be a {@link MetaTypeBool} instance.
   */
  constructor(def: MetaTypeBool);
}

/** Numeric value backed by a {@link MetaTypeNumber}. */
export class LevelValueNumber extends LevelValue {
  /**
   * @param def Must be a {@link MetaTypeNumber} instance.
   */
  constructor(def: MetaTypeNumber);
}

// =========================================================================
// src/value/levelValueString.js
// =========================================================================

/** String value backed by a {@link MetaTypeString}. */
export class LevelValueString extends LevelValue {
  /**
   * @param def Must be a {@link MetaTypeString} instance.
   */
  constructor(def: MetaTypeString);

  /**
   * Get the binary size of the string including the null terminator.
   * @returns Length of the value string plus one (null terminator), or 1 if the value is not a string.
   */
  getSize(): number;

  /**
   * Get the string value.
   * @returns The stored string, or "" if the value is not a string.
   */
  getValue(): string;
}

// =========================================================================
// src/value/levelValuePointer.js
// =========================================================================

/**
 * Pointer / reference value.
 * Stores an index that can be resolved to an object via backpatching.
 */
export class LevelValuePointer extends LevelValue {
  /** The raw object index. Set to 0xFFFFFFFF for null references. */
  protected index: number;

  constructor();

  /**
   * Resolve the stored index to an actual object reference.
   * Looks up {@link LoIndices.objects}[index] and calls {@link LevelValue.setValue}.
   * An index of 0xFFFFFFFF sets the value to null (null reference).
   * @param L Object file context containing the object list.
   */
  backpatch(L: LoIndices): void;

  /**
   * Set the raw object index.
   * @param index The object index to store.
   */
  setIndex(index: number): void;
}

// =========================================================================
// src/value/levelValueStruct.js
// =========================================================================

/** Struct value backed by a {@link MetaTypeStruct}. */
export class LevelValueStruct extends LevelValue {
  /** Member values keyed by member name. */
  protected value: Map<string, LevelValue | LevelValue[]>;

  /**
   * @param def Must be a {@link MetaTypeStruct} instance.
   */
  constructor(def: MetaTypeStruct);

  /**
   * Get a member value by name.
   * @param name Member name.
   * @returns The member value, an array of values (for multi-count members), or undefined.
   */
  getValue(name: string): LevelValue | LevelValue[] | undefined;

  /**
   * Set a member value by name.
   * @param name Member name.
   * @param value The member value or array of values.
   */
  setValue(name: string, value: LevelValue | LevelValue[]): void;
}

// =========================================================================
// src/value/levelValueClass.js
// =========================================================================

/** Class instance value backed by a {@link MetaTypeClass}. */
export class LevelValueClass extends LevelValue {
  /** The instance name (object name in the level). */
  protected name: string;
  /** Member values keyed by member name. */
  protected value: Map<string, LevelValue | LevelValue[]>;
  /** Total binary size computed during {@link finalize}. */
  protected size: number;

  /**
   * @param def Must be a {@link MetaTypeClass} instance.
   * @param name The object instance name.
   */
  constructor(def: MetaTypeClass, name: string);

  /**
   * Get the binary size of this object.
   * Only valid after {@link finalize} has been called.
   * @returns Total size in bytes (header + name + members).
   */
  getSize(): number;

  /**
   * Get the object instance name.
   * @returns The instance name string.
   */
  getName(): string;

  /**
   * Compute the total binary size from all member values.
   * Must be called after all members are set, before writing to buffer.
   * Size includes: 4 bytes (class index) + name (with null terminator) + all member sizes.
   */
  finalize(): void;

  /**
   * Get a member value by name.
   * @param name Member name.
   * @returns The member value, an array of values, or undefined.
   */
  getValue(name: string): LevelValue | LevelValue[] | undefined;

  /**
   * Set a member value by name.
   * @param name Member name.
   * @param value The member value or array of values.
   */
  setValue(name: string, value: LevelValue | LevelValue[]): void;
}

// =========================================================================
// src/type/metaTypeNumber.js
// =========================================================================

/** Boolean type definition (1 byte). */
export class MetaTypeBool extends MetaType {
  /**
   * @param name Type name, typically "bool".
   */
  constructor(name: string);

  /**
   * Get the binary size.
   * @returns 1 byte.
   */
  getSize(): number;

  /**
   * Get the value type category.
   * @returns {@link kMetaValueType.Number}.
   */
  valueType(): number;

  /**
   * Read a boolean value from the buffer.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Byte offset to read from.
   * @returns A {@link LevelValueBool} holding the read value.
   */
  read(L: LoIndices, B: Buffer, off: number): LevelValueBool;

  /**
   * Write a boolean value into the buffer.
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val The value to write (must have def === this).
   * @param off Byte offset to write at.
   * @returns Number of bytes written (1), or 0 if the definition does not match.
   */
  write(L: LoIndices, B: Buffer, val: LevelValueBool, off: number): number;
}

/** Fixed-size numeric type definition (int, uint, float, double). */
export class MetaTypeNumber extends MetaType {
  /** Binary size in bytes. */
  protected size: number;
  /** Buffer read method (e.g. readInt32LE). */
  protected reader: (this: Buffer, offset: number) => number | bigint;
  /** Buffer write method (e.g. writeInt32LE). */
  protected writer: (this: Buffer, value: number | bigint, offset: number) => number | void;

  /**
   * @param name Type name (e.g. "int32_t", "float").
   * @param size Binary size in bytes.
   * @param reader Bound Buffer read method.
   * @param writer Bound Buffer write method.
   */
  constructor(
    name: string,
    size: number,
    reader: (this: Buffer, offset: number) => number | bigint,
    writer: (this: Buffer, value: number | bigint, offset: number) => number | void
  );

  /**
   * Get the binary size.
   * @returns The configured size in bytes.
   */
  getSize(): number;

  /**
   * Get the memory alignment.
   * @returns The configured size (natural alignment).
   */
  getAlign(): number;

  /**
   * Get the value type category.
   * @returns {@link kMetaValueType.Number}.
   */
  valueType(): number;

  /**
   * Read a numeric value from the buffer.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Byte offset to read from.
   * @returns A {@link LevelValueNumber} holding the read value.
   */
  read(L: LoIndices, B: Buffer, off: number): LevelValueNumber;

  /**
   * Write a numeric value into the buffer.
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val The value to write (must have def === this).
   * @param off Byte offset to write at.
   * @returns Number of bytes written, or 0 if the definition does not match.
   */
  write(L: LoIndices, B: Buffer, val: LevelValueNumber, off: number): number;
}

// =========================================================================
// src/type/metaTypePointer.js
// =========================================================================

/** Pointer / reference type definition (4 bytes, stores an object index). */
export class MetaTypePointer extends MetaType {
  /**
   * @param name Type name, typically "pointer".
   */
  constructor(name: string);

  /**
   * Get the binary size.
   * @returns 4 bytes.
   */
  getSize(): number;

  /**
   * Get the memory alignment.
   * @returns 4 bytes.
   */
  getAlign(): number;

  /**
   * Get the value type category.
   * @returns {@link kMetaValueType.Pointer}.
   */
  valueType(): number;

  /**
   * Read a pointer value from the buffer as a raw object index.
   * The index must later be backpatched to an actual reference via
   * {@link LevelValuePointer.backpatch}.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Byte offset to read from.
   * @returns A {@link LevelValuePointer} with the raw index set.
   */
  read(L: LoIndices, B: Buffer, off: number): LevelValuePointer;

  /**
   * Write a pointer value into the buffer.
   * Writes the raw index stored in the pointer value (UInt32LE).
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val The pointer value to write.
   * @param off Byte offset to write at.
   * @returns 4 (bytes written).
   */
  write(L: LoIndices, B: Buffer, val: LevelValuePointer, off: number): number;
}

// =========================================================================
// src/type/metaTypeString.js
// =========================================================================

/** Null-terminated string type definition. */
export class MetaTypeString extends MetaType {
  /**
   * @param name Type name (e.g. "cstring", "TgcString").
   */
  constructor(name: string);

  /**
   * Get the value type category.
   * @returns {@link kMetaValueType.String}.
   */
  valueType(): number;

  /**
   * Read a null-terminated string from the buffer.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Byte offset to read from.
   * @returns A {@link LevelValueString} holding the read string.
   */
  read(L: LoIndices, B: Buffer, off: number): LevelValueString;

  /**
   * Write a null-terminated string into the buffer.
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val The string value to write (must have def === this).
   * @param off Byte offset to write at.
   * @returns Number of bytes written, or 0 if the definition does not match.
   */
  write(L: LoIndices, B: Buffer, val: LevelValueString, off: number): number;
}

// =========================================================================
// src/type/metaTypeStruct.js
// =========================================================================

/**
 * A member of a struct type.
 * Extends {@link MetaTypeForward} to delegate element access to its
 * underlying definition, adding an offset and optional array repeat count.
 */
export class MetaTypeStructMember extends MetaTypeForward {
  /** Byte offset of this member within its parent struct. */
  protected offset: number;
  /**
   * Repeat count for fixed-size inline arrays.
   * Defaults to 1 (scalar member). >1 produces an array of values.
   */
  protected count: number;

  /**
   * @param def The member's MetaType.
   * @param name Member name (qualified with struct prefix).
   * @param count Optional repeat count for inline arrays (default 1).
   */
  constructor(def: MetaType, name: string, count?: number);

  /**
   * Get the total binary size of this member.
   * @returns Element size × repeat count.
   */
  getSize(): number;

  /**
   * Read this member's value(s) from the buffer.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Base offset of the parent struct.
   * @returns A single value if count is 1, or an array of values.
   */
  read(L: LoIndices, B: Buffer, off: number): LevelValue | LevelValue[];

  /**
   * Write this member's value(s) into the buffer.
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val The value or array of values to write.
   * @param off Base offset of the parent struct.
   * @returns Number of bytes written, or 0 on failure.
   */
  write(
    L: LoIndices,
    B: Buffer,
    val: LevelValue | LevelValue[],
    off: number
  ): number;
}

/**
 * Struct type definition.
 * A compound type with fixed-layout members suitable for embedding in
 * arrays or as raw blobs.
 */
export class MetaTypeStruct extends MetaType {
  /** Members keyed by name. */
  protected members: Map<string, MetaTypeStructMember>;
  /** Total binary size of the struct (aligned). */
  protected size: number;
  /** Overall alignment of the struct (max of member alignments). */
  protected align: number;
  /** Write cursor - next available offset for member placement. */
  protected cursor: number;

  /**
   * @param name The struct type name.
   */
  constructor(name: string);

  /**
   * Add a member to this struct.
   * Only members with value type {@link kMetaValueType.Number} or
   * {@link kMetaValueType.Struct} are accepted. The member is placed at
   * the next properly aligned offset and the struct's size and alignment
   * are updated accordingly.
   * @param def Type definition of the member.
   * @param name Name of the member.
   * @param count Optional repeat count for inline arrays (default 1).
   * @returns True if the member was added, false if the type is invalid
   *          or the name is a duplicate.
   */
  addMember(def: MetaType, name: string, count?: number): boolean;

  /**
   * Mark the struct as complete and force-set the total alignment.
   * The alignment must be a power of two.
   * @param align Alignment value (must be >0 and a power of two).
   * @returns True on success, false if the alignment value is invalid.
   */
  finalize(align?: number): boolean;

  /**
   * Read a struct value from the buffer.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Byte offset to read from.
   * @returns A {@link LevelValueStruct}, or undefined if the read would
   *          exceed the buffer.
   */
  read(L: LoIndices, B: Buffer, off: number): LevelValueStruct | undefined;

  /**
   * Write a struct value into the buffer.
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val The value to write (must have def === this).
   * @param off Byte offset to write at.
   * @returns Number of bytes written, or 0 if the definition does not match
   *          or a member is missing.
   */
  write(L: LoIndices, B: Buffer, val: LevelValueStruct, off: number): number;
}

// =========================================================================
// src/type/metaTypeClass.js
// =========================================================================

/**
 * A member of a class type.
 * Extends {@link MetaTypeForward} without adding new behavior;
 * the constructor simply passes through to the parent.
 */
export class MetaTypeClassMember extends MetaTypeForward {
  /**
   * @param def The member's MetaType.
   * @param name Member name (qualified with class prefix).
   */
  constructor(def: MetaType, name: string);
}

/**
 * An array member of a class type.
 * Supports dynamic arrays (maxCount = 0) or bounded static arrays.
 * Array length is stored as a UInt32LE prefix before element data.
 */
export class MetaTypeClassMemberArray extends MetaTypeClassMember {
  /** Maximum element count (0 = dynamic/unbounded). */
  protected maxCount: number;

  /**
   * @param def The element MetaType.
   * @param name Member name (qualified with class prefix).
   * @param count Maximum element count; 0 or omitted for unbounded.
   */
  constructor(def: MetaType, name: string, count?: number);

  /**
   * Read an array from the buffer.
   * Reads a UInt32LE count prefix, then reads that many elements.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Byte offset to read from.
   * @returns An array of values, or undefined if the count exceeds maxCount
   *          (when maxCount is set).
   */
  read(L: LoIndices, B: Buffer, off: number): LevelValue[] | undefined;

  /**
   * Write an array into the buffer.
   * Writes a UInt32LE count prefix, then writes that many elements.
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val Array of values to write.
   * @param off Byte offset to write at.
   * @returns Number of bytes written, or 0 if the array length exceeds
   *          maxCount (when maxCount is set).
   */
  write(L: LoIndices, B: Buffer, val: LevelValue[], off: number): number;
}

/**
 * Class type definition.
 * Unlike structs, class instances have a name and support inheritance.
 * The root of the class hierarchy is {@link kMetaTypes.Object}.
 */
export class MetaTypeClass extends MetaType {
  /** Parent class in the inheritance chain. */
  protected parent: MetaTypeClass;
  /** Members keyed by name. */
  protected members: Map<string, MetaTypeClassMember>;

  /**
   * @param name The class type name.
   * @param parent Optional parent class; defaults to
   *               {@link kMetaTypes.Object} if omitted, or null for the
   *               root Object class itself.
   */
  constructor(name: string, parent?: MetaTypeClass | null);

  /**
   * Check whether the given type is in this class's inheritance chain.
   * Walks the {@link parent} chain upward.
   * @param def The type to check.
   * @returns True if def equals this or any ancestor class.
   */
  isCompatible(def: MetaType): boolean;

  /**
   * Get the value type category.
   * @returns {@link kMetaValueType.Class}.
   */
  valueType(): number;

  /**
   * Add a member to the class.
   * @param def Type definition of the member.
   * @param name Name of the member.
   * @param count Passing 0 creates a dynamic array
   *              ({@link MetaTypeClassMemberArray}), a positive integer
   *              creates a bounded static array, and passing undefined or
   *              omitting it creates a regular member
   *              ({@link MetaTypeClassMember}).
   * @returns True if the member was added, false if the name is a duplicate.
   */
  addMember(def: MetaType, name: string, count?: number): boolean;

  /**
   * Read a class instance (object) from the buffer.
   * Reads the class index and name, then dispatches to the correct class
   * definition for member reading. Pointer members are collected into
   * {@link LoIndices.pointers}.
   * @param L Object file context.
   * @param B Binary data buffer.
   * @param off Byte offset to read from.
   * @returns A {@link LevelValueClass}, null, or undefined on failure.
   */
  read(L: LoIndices, B: Buffer, off: number): LevelValueClass | null | undefined;

  /**
   * Write a class instance into the buffer.
   * Writes the class index and name, then writes each member in the order
   * stored in the LoClass raw memvar table.
   * @param L Object file context.
   * @param B Target binary data buffer.
   * @param val The object to write.
   * @param off Byte offset to write at.
   * @returns Number of bytes written, or 0 on failure.
   */
  write(L: LoIndices, B: Buffer, val: LevelValueClass, off: number): number;
}

// =========================================================================
// src/levelObjects.js
// =========================================================================

/** Enum of raw memvar storage types. */
export const kMemvarTypes: {
  /** Raw bytes (number, bool, or embedded struct). */
  readonly Raw: 0;
  /** Null-terminated string. */
  readonly String: 1;
  /** Pointer / reference to an object. */
  readonly Ref: 2;
  /** Dynamic array. */
  readonly Array: 3;
};

/**
 * TGCL binary file header (44 bytes).
 *
 * Layout:
 * ```
 * 0x00  magic       (4 B, "TGCL")
 * 0x04  version     (4 B, LE)
 * 0x08  numClasses  (4 B, LE)
 * 0x0C  numMemVars  (4 B, LE)
 * 0x10  numObjects  (4 B, LE)
 * 0x14  numRefs     (4 B, LE)
 * 0x18  classesOffset   (4 B, LE)
 * 0x1C  memvarsOffset   (4 B, LE)
 * 0x20  stringsOffset   (4 B, LE)
 * 0x24  objectsOffset   (4 B, LE)
 * 0x28  fileSize        (4 B, LE)
 * ```
 */
export class LoHeader {
  /** Magic bytes, always "TGCL". */
  magic: string;
  /** Format version number. */
  version: number;
  /** Number of class descriptors. */
  numClasses: number;
  /** Total number of member variable descriptors. */
  numMemVars: number;
  /** Number of object instances. */
  numObjects: number;
  /** Number of reference (pointer) values. */
  numRefs: number;
  /** File offset of the classes section. */
  classesOffset: number;
  /** File offset of the memvars section. */
  memvarsOffset: number;
  /** File offset of the string pool section. */
  stringsOffset: number;
  /** File offset of the objects section. */
  objectsOffset: number;
  /** Total file size in bytes. */
  fileSize: number;

  constructor();

  /**
   * Reset all fields to defaults.
   */
  initialize(): void;

  /**
   * Read header fields from a buffer.
   * @param B Buffer positioned at the start of the header.
   * @returns This header instance (for chaining).
   */
  read(B: Buffer): this;

  /**
   * Serialize the header to a new 44-byte buffer.
   * @returns A buffer containing the serialized header.
   */
  write(): Buffer;
}

/**
 * String pool - deduplicated null-terminated string storage.
 * Strings are interned during writing and referenced by byte offset.
 */
export class LoStringPool {
  /** Current write cursor within the pool buffer. */
  cursor: number;
  /** Growable buffer holding the concatenated strings. */
  buffer: Buffer;
  /** Map of string → byte offset for deduplication. */
  strings: Map<string, number>;

  /**
   * Read a null-terminated string from a buffer at a given offset.
   * @param B Binary data buffer.
   * @param offset Byte offset of the string.
   * @returns The decoded string.
   */
  static read(B: Buffer, offset: number): string;

  constructor();

  /**
   * Reset the string pool for a fresh serialization pass.
   */
  initialize(): void;

  /**
   * Add a string to the pool and return its offset.
   * If the string is already in the pool, returns the existing offset.
   * @param s The string to intern.
   * @returns Byte offset of the string in the pool, or -1 if s is not a string.
   */
  set(s: string): number;

  /**
   * Serialize the string pool to a buffer.
   * @returns A buffer containing all interned strings (without trailing data).
   */
  write(): Buffer;
}

/**
 * Raw member variable descriptor (16 bytes in the binary format).
 * Describes the storage type, name, size, and auxiliary data for a
 * class member variable.
 */
export class LoMemvar {
  /** Storage type, one of {@link kMemvarTypes}. */
  type: number;
  /** String pool offset of the member name. */
  name: number;
  /** Byte size of the member value. */
  size: number;
  /** Auxiliary value (e.g. max element count for arrays). */
  aux: number;

  /**
   * @param type Storage type.
   * @param name String pool offset of the name.
   * @param size Byte size.
   * @param aux Auxiliary value.
   */
  constructor(type: number, name: number, size: number, aux: number);
}

/**
 * Raw class descriptor.
 * Holds the class name, its raw memvar table, and a link to the
 * resolved {@link MetaTypeClass} definition.
 */
export class LoClass {
  /** Class name. */
  name: string;
  /** Raw memvars keyed by member name. */
  raw: Map<string, LoMemvar>;
  /** Resolved MetaTypeClass definition (set via {@link setDef}). */
  def: MetaTypeClass | undefined;

  /**
   * @param name Class name.
   */
  constructor(name: string);

  /**
   * Add a raw memvar to this class.
   * @param memvar The LoMemvar descriptor to add.
   */
  addMemvar(memvar: LoMemvar): void;

  /**
   * Set and verify the MetaTypeClass definition against the raw memvars.
   * Validates that every raw memvar has a matching member in the definition
   * with a compatible type. Throws {@link kObjectExceptions.MemberMismatch}
   * on mismatch.
   * @param def The MetaTypeClass definition to associate.
   */
  setDef(def: MetaTypeClass): void;
}

/**
 * Object file index context.
 * Aggregates classes, memvars, objects, and pointers during read/write
 * operations and maintains name-to-index lookup maps.
 */
export class LoIndices {
  /** Parsed class descriptors. */
  classes: LoClass[];
  /** All member variable descriptors across all classes. */
  memvars: LoMemvar[];
  /** Deserialized object instances. */
  objects: LevelValueClass[];
  /** Collected pointer values for backpatching. */
  pointers: LevelValuePointer[];

  constructor();

  /**
   * Clear all lists and lookup maps for a new operation.
   */
  clear(): void;

  /**
   * Register MetaType definitions for name-based lookup.
   * @param definitions Array of MetaType instances to register.
   */
  define(definitions: MetaType[]): void;

  /**
   * Rebuild internal lookup maps after all entries have been added.
   */
  finalize(): void;

  /**
   * Look up a MetaType by name from the registered definitions.
   * @param name Type name.
   * @returns The MetaType, or undefined if not found.
   */
  getClassFromName(name: string): MetaType | undefined;

  /**
   * Get the index of a registered class by name.
   * Throws {@link kObjectExceptions.InvalidClassName} if not found.
   * @param name Class name.
   * @returns The zero-based class index.
   */
  getClassIdx(name: string): number;

  /**
   * Get the index of a registered object by name.
   * Throws {@link kObjectExceptions.InvalidObjectIndex} if not found.
   * @param name Object instance name.
   * @returns The zero-based object index.
   */
  getObjectIdx(name: string): number;

  /**
   * Create and register a memvar from raw blob data.
   * @param type Storage type ({@link kMemvarTypes}).
   * @param name String pool offset of the name.
   * @param size Byte size.
   * @param aux Auxiliary value.
   * @returns The created LoMemvar.
   */
  addMemvarFromBlob(type: number, name: number, size: number, aux: number): LoMemvar;

  /**
   * Create and register a class from raw blob data.
   * Associates memvars in the range [firstMemvar, firstMemvar + numMemvars).
   * Throws {@link kObjectExceptions.MemvarOutOfBound} if indices are invalid.
   * Throws {@link kObjectExceptions.MultipleClassName} on duplicate name.
   * @param name Class name.
   * @param firstMemvar Index of the first memvar for this class.
   * @param numMemvars Number of memvars belonging to this class.
   * @returns The created LoClass.
   */
  addClassFromBlob(name: string, firstMemvar: number, numMemvars: number): LoClass;

  /**
   * Register an object instance and assign it an index.
   * Throws {@link kObjectExceptions.MultipleObjectName} on duplicate name.
   * @param obj The object to register.
   * @returns The registered object (same instance).
   */
  addObject(obj: LevelValueClass): LevelValueClass;

  /**
   * Create and register a class from a MetaTypeClass definition.
   * Generates LoMemvar entries for each member based on its value type.
   * Throws {@link kObjectExceptions.MultipleClassName} on duplicate name.
   * @param def The MetaTypeClass definition.
   * @returns The created LoClass.
   */
  addClassFromDef(def: MetaTypeClass): LoClass;
}

/**
 * Top-level object file reader and writer.
 * Manages the complete lifecycle: definitions, objects, serialization
 * to/from the TGCL binary format.
 */
export class LevelObjects {
  /** Registered type definitions keyed by name. */
  definitions: Map<string, MetaType>;
  /** File header. */
  header: LoHeader;
  /** String pool for interning strings during write. */
  strings: LoStringPool;
  /** Object instances keyed by instance name. */
  objects: Map<string, LevelValueClass>;

  /**
   * @param definitions Initial set of MetaType definitions to register.
   */
  constructor(definitions: MetaType[]);

  /**
   * Get an object by instance name.
   * @param name Object instance name.
   * @returns The object, or undefined if not found.
   */
  get(name: string): LevelValueClass | undefined;

  /**
   * Register an object instance.
   * @param object The object to register.
   */
  set(object: LevelValueClass): void;

  /**
   * Register additional MetaType definitions.
   * Built-in types from {@link kMetaTypes} are appended after the provided
   * definitions to prevent accidental overrides.
   * @param definitions Array of MetaType instances to register.
   */
  define(definitions: MetaType[]): void;

  /**
   * Rebuild name-based lookup maps for definitions and objects.
   * Should be called before writing to ensure consistent indices.
   */
  finalize(): void;

  /**
   * Read and deserialize objects from a TGCL binary buffer.
   * Reads the header, class table, memvar table, string pool, and all
   * object instances. Backpatches pointer references after reading.
   * @param B Buffer containing TGCL binary data.
   * @returns True on success; throws on malformed data.
   */
  read(B: Buffer): boolean;

  /**
   * Serialize all objects to a new TGCL binary buffer.
   * Calls {@link finalize} first, then writes the header, class table,
   * memvar table, string pool, and all objects. Resolves object references
   * to indices before writing.
   * @returns A buffer containing the complete TGCL binary file.
   */
  write(): Buffer;

  /**
   * Read a null-terminated string from the data section.
   * Offsets are relative to the strings section start.
   * @param B Binary data buffer.
   * @param offset Relative offset within the strings section.
   * @returns The decoded string.
   */
  readDataString(B: Buffer, offset: number): string;
}

// =========================================================================
// src/types.js  (must come after all MetaType subclasses)
// =========================================================================

/** Built-in primitive type definitions. */
export const kMetaTypes: {
  /** 1-byte boolean. */
  readonly Bool: MetaTypeBool;
  /** Signed 8-bit integer. */
  readonly Int8: MetaTypeNumber;
  /** Unsigned 8-bit integer. */
  readonly Uint8: MetaTypeNumber;
  /** Signed 16-bit integer (LE). */
  readonly Int16: MetaTypeNumber;
  /** Unsigned 16-bit integer (LE). */
  readonly Uint16: MetaTypeNumber;
  /** Signed 32-bit integer (LE). */
  readonly Int32: MetaTypeNumber;
  /** Unsigned 32-bit integer (LE). */
  readonly Uint32: MetaTypeNumber;
  /** Signed 64-bit integer (LE). */
  readonly Int64: MetaTypeNumber;
  /** Unsigned 64-bit integer (LE). */
  readonly Uint64: MetaTypeNumber;
  /** 32-bit IEEE 754 float (LE). */
  readonly Float: MetaTypeNumber;
  /** 64-bit IEEE 754 double (LE). */
  readonly Double: MetaTypeNumber;
  /** Null-terminated C string. */
  readonly CString: MetaTypeString;
  /** TgcString (null-terminated string used by the That Game Company engine). */
  readonly TgcString: MetaTypeString;
  /** 4-byte object reference pointer. */
  readonly Pointer: MetaTypePointer;
  /** Root object type - the base of all class hierarchies. */
  readonly Object: MetaTypeClass;
};