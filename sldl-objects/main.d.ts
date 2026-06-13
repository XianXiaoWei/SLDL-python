// Type declarations for sldl-objects.

/// <reference types="node" />

// --- Exceptions --------------------------------------------------------------

/** General-purpose exception builder interface. */
interface ExceptionBuilder {
  message?: string;
  builder?: (...args: any[]) => string;
  /** Create an exception instance with the given arguments. */
  from(...args: any[]): Error;
}

/** All exception builders for sldl-objects. */
export const kObjectExceptions: Record<string, ExceptionBuilder>;

// --- Memvar Types ------------------------------------------------------------

/** File-level member variable type enum. */
export const kMemvarTypes: {
  /** Opaque inline bytes, size from MemberDef. */
  Raw: 0;
  /** Nul-terminated UTF-8 string. */
  String: 1;
  /** Object reference stored as uint32 object index. */
  Ref: 2;
  /** Count-prefixed array of elements. */
  Array: 3;
};

// --- Built-in Types ----------------------------------------------------------

/** All built-in type definitions indexed by key name. */
export const kMetaTypes: Record<string, MetaType>;

/**
 * Get or create the Clump<T> generic type variant.
 * Returns a MetaTypeClump instance that forwards to base Clump.
 */
export function getClumpGeneric(typeName: string): MetaTypeClass;

/** Cache of previously created Clump<T> generic variants. */
export const clumpGenericCache: Map<string, MetaTypeClass>;

// --- MetaType Hierarchy ------------------------------------------------------

/** Value type classification enum. */
export const kMetaValueType: {
  None: 0;
  Number: 1;
  String: 2;
  Struct: 3;
  Class: 4;
  Pointer: 5;
  Raw: 6;
};

/** Abstract base class for all type definitions. */
export class MetaType {
  /** Human-readable type name, e.g. "int32_t", "cstring". */
  name: string;
  constructor(name: string);
  getName(): string;
  /** Size in bytes when serialized. */
  getSize(): number;
  /** Alignment requirement in bytes. */
  getAlign(): number;
  /** Return one of the kMetaValueType enum values. */
  valueType(): number;
  /** Read a value from binary buffer at offset. */
  read(L: LoIndices, B: Buffer, off: number): LevelValue;
  /** Write a value to binary buffer at offset, returning bytes written. */
  write(L: LoIndices, B: Buffer, val: LevelValue, off: number): number;
}

/**
 * Base class for type delegates that forward to an underlying def.
 * Forwards getSize, getAlign, valueType, valueFlag, read, write.
 */
export class MetaTypeForward extends MetaType {
  /** The underlying type being forwarded to. */
  def: MetaType;
  constructor(def: MetaType, name: string);
}

/** Class member wrapping a scalar type (not an array). */
export class MetaTypeClassMember extends MetaTypeForward {}

/**
 * Class member wrapping an array type.
 * valueFlag() returns kMetaValueFlag.Array.
 */
export class MetaTypeClassMemberArray extends MetaTypeClassMember {
  /** Maximum element count; 0 = dynamic (unlimited). */
  maxCount: number;
  constructor(def: MetaType, name: string, count?: number);
}

/**
 * Class type definition with inheritance.
 * Members can be MetaTypeClassMember or MetaTypeClassMemberArray.
 */
export class MetaTypeClass extends MetaType {
  /** Parent class in inheritance chain; null for Object. */
  parent: MetaTypeClass | null;
  /** This class's own members (not including inherited ones). */
  members: Map<string, MetaTypeClassMember>;

  constructor(name: string, parent?: MetaTypeClass | null);
  /** Check if `def` appears anywhere in the inheritance chain. */
  isCompatible(def: MetaType): boolean;
  /**
   * Add a member. If `def` is already a MetaTypeClassMember or
   * MetaTypeClassMemberArray (pre-wrapped by declGroup parser), it is
   * stored directly. Otherwise, count=0 creates an array member and
   * undefined count creates a scalar member.
   */
  addMember(def: MetaType, name: string, count?: number): boolean;
  /** Look up a member by name, searching the inheritance chain. */
  getMember(name: string): MetaTypeClassMember | undefined;
  /**
   * Get all members across the inheritance chain.
   * Optionally filter by `usedMembers` set for pruning.
   */
  allMembers(usedMembers?: Set<string>): Array<[string, MetaTypeClassMember]>;
  /** Read object member data from binary buffer. */
  read(L: LoIndices, B: Buffer, off: number, raw?: LoClass): LevelValueClass | null | undefined;
  /** Write object member data to binary buffer. Returns bytes written. */
  write(L: LoIndices, B: Buffer, val: LevelValueClass, off: number, usedMembers?: Set<string>): number;
  /** Create a default LevelValue for a given member type. */
  static memberTypeDefault(member: MetaTypeClassMember): LevelValue | LevelValue[];
}

/** 1-byte boolean type. */
export class MetaTypeBool extends MetaType {
  constructor(name: string);
}

/** Fixed-width integer or IEEE 754 floating-point type. */
export class MetaTypeNumber extends MetaType {
  size: number;
  constructor(name: string, size: number, reader: Function, writer: Function);
}

/**
 * Pointer type that stores a uint32 object index.
 * `points` field tracks which class type this pointer targets.
 */
export class MetaTypePointer extends MetaType {
  constructor(name: string);
}

/** Nul-terminated string type (cstring or TgcString). */
export class MetaTypeString extends MetaType {
  constructor(name: string);
}

/** Opaque raw binary type of fixed byte size. */
export class MetaTypeRaw extends MetaType {
  size: number;
  constructor(name: string, size: number);
}

/** Struct member with offset tracking for alignment. */
export class MetaTypeStructMember extends MetaTypeForward {
  /** Byte offset within the struct. */
  offset: number;
  /** Element count (1 = scalar, >1 = fixed array). */
  count: number;
  constructor(def: MetaType, name: string, count?: number);
}

/**
 * C-style struct type with member alignment.
 * Only accepts Number and Struct member types.
 */
export class MetaTypeStruct extends MetaType {
  members: Map<string, MetaTypeStructMember>;
  constructor(name: string);
  addMember(def: MetaType, name: string, count?: number): boolean;
  /** Mark the struct complete and optionally force overall alignment. */
  finalize(align?: number): boolean;
}

// --- LevelValue Hierarchy ----------------------------------------------------

/** Abstract base class for all runtime value instances. */
export class LevelValue {
  /** The MetaType that produced this value. */
  def: MetaType;
  /** The raw value data. */
  value: any;
  constructor(def: MetaType);
  getDef(): MetaType;
  getSize(): number;
  getAlign(): number;
  getValue(): any;
  setValue(value: any): void;
  valueType(): number;
}

/**
 * An object instance — a collection of named member values.
 * Created from a MetaTypeClass definition.
 */
export class LevelValueClass extends LevelValue {
  /** Object name (from the binary file or user-assigned). */
  name: string;
  /** Total serialized size in bytes (sum of all member sizes). */
  size: number;
  constructor(def: MetaTypeClass, name: string);
  getName(): string;
  /** Get a member value by name. */
  getValue(name: string): LevelValue | LevelValue[] | undefined;
  /** Set a member value by name. */
  setValue(name: string, value: LevelValue | LevelValue[]): void;
  /** Recalculate serialized size from member values. */
  finalize(): void;
  /** Convert to a plain JSON object. */
  toJSON(declGroup: any): Record<string, any>;
}

/** Boolean value (1 byte). */
export class LevelValueBool extends LevelValue {}

/** Numeric value (integer or float, 1-8 bytes). */
export class LevelValueNumber extends LevelValue {}

/**
 * Pointer value storing an object index or target name.
 * After backpatch, getValue() returns the target LevelValueClass or null.
 */
export class LevelValuePointer extends LevelValue {
  /** Object index in the LoIndices.objects array; 0xFFFFFFFF = null. */
  index: number;
  /** Target object name for P$ resolution before index is assigned. */
  targetName: string | null;
  /** Resolve index to the actual object reference. */
  backpatch(L: LoIndices): void;
  setIndex(index: number): void;
}

/** String value (nul-terminated UTF-8). */
export class LevelValueString extends LevelValue {}

/** Struct value holding named sub-values. */
export class LevelValueStruct extends LevelValue {
  getValue(name: string): LevelValue | LevelValue[] | undefined;
  setValue(name: string, value: LevelValue | LevelValue[]): void;
}

/** Raw bytes value (opaque Buffer). */
export class LevelValueRaw extends LevelValue {}

// --- Binary I/O --------------------------------------------------------------

/** 44-byte TGCL file header. */
export class LoHeader {
  /** File magic, always "TGCL". */
  magic: string;
  version: number;
  numClasses: number;
  numMemVars: number;
  numObjects: number;
  numRefs: number;
  classesOffset: number;
  memvarsOffset: number;
  stringsOffset: number;
  objectsOffset: number;
  fileSize: number;
  /** Parse header from 44-byte buffer. */
  read(B: Buffer): this;
  /** Serialize header to 44-byte buffer. */
  write(): Buffer;
}

/** String interning pool for the binary format. */
export class LoStringPool {
  /** Read a nul-terminated string at the given offset. */
  static read(B: Buffer, offset: number): string;
  /** Intern a string and return its byte offset in the pool. */
  set(s: string): number;
  /** Serialize the pool to a Buffer. */
  write(): Buffer;
}

/** Raw member variable descriptor from the binary file. */
export class LoMemvar {
  /** kMemvarTypes value. */
  type: number;
  /** Member name. */
  name: string;
  /** Data size (for Raw), 0 for String/Ref. */
  size: number;
  /** Auxiliary value: element type index for Array, 0xFFFFFFFF for ref arrays. */
  aux: number;
  constructor(type: number, name: string, size: number, aux: number);
}

/** Raw class descriptor from the binary file. */
export class LoClass {
  name: string;
  /** Map of member name to LoMemvar, in binary file order. */
  raw: Map<string, LoMemvar>;
  /** Associated MetaTypeClass definition. */
  def: MetaTypeClass | undefined;
  addMemvar(m: LoMemvar): void;
  setDef(def: MetaTypeClass): void;
}

/**
 * Runtime index tables linking binary data to MetaType definitions.
 * Manages class registrations, object indices, and pointer collection.
 */
export class LoIndices {
  classes: LoClass[];
  memvars: LoMemvar[];
  objects: LevelValueClass[];
  pointers: LevelValuePointer[];
  metaTypes: Map<string, MetaType>;
  metaClasses: Map<string, MetaTypeClass>;
  /** Class name to array index mapping. */
  classIndices: Map<string, number>;
  /** Object name to array index mapping. */
  objectIndices: Map<string, number>;
  /** Register MetaType definitions for lookup. */
  define(definitions: MetaType[]): void;
  /** Clear indices for a new operation. */
  clear(): void;
  getClassFromName(name: string): MetaType | undefined;
  /** Get array index of a class; -1 if not found. */
  getClassIdx(name: string): number;
  getObjectIdx(name: string): number;
  /** Add a memvar from raw binary data. */
  addMemvarFromBlob(type: number, name: string, size: number, aux: number): LoMemvar;
  /** Add a class from raw binary data. */
  addClassFromBlob(name: string, firstMemvar: number, numMemvars: number): LoClass;
  addObject(obj: LevelValueClass): LevelValueClass;
  /** Add a class from a MetaTypeClass definition, creating LoMemvar entries. */
  addClassFromDef(def: MetaTypeClass, usedMembers?: Set<string>): LoClass;
}

/**
 * Main entry point for binary I/O.
 *
 * Usage:
 *   var lo = new LevelObjects([definitions]);
 *   var objects = lo.readBinary(buffer);
 *   var buffer = lo.writeBinary();
 */
export class LevelObjects {
  /** Runtime index tables. */
  indices: LoIndices;
  /** Stored object instances by name. */
  objects: Map<string, LevelValueClass>;
  /** Per-class set of member names used by stored objects, for pruning. */
  usedMembers: Map<string, Set<string>>;

  constructor(definitions: MetaType[]);

  get(name: string): LevelValueClass | undefined;
  /** Store an object, tracking member usage for pruning. */
  set(obj: LevelValueClass): void;
  /** Read a .level.bin Buffer, returning a Map of stored objects. */
  readBinary(buffer: Buffer): Map<string, LevelValueClass>;
  /** Serialize stored objects to a .level.bin Buffer. */
  writeBinary(usedMembers?: Map<string, Set<string>>): Buffer;
}
