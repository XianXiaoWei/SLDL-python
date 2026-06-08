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

export const kObjectExceptions: {
  readonly MemvarOutOfBound: SimpleExceptionBuilder;
  readonly ReadObjectFailed: SimpleExceptionBuilder;
  readonly InvalidClassName: DynamicExceptionBuilder;
  readonly MultipleObjectName: DynamicExceptionBuilder;
  readonly MemberMismatch: DynamicExceptionBuilder;
  readonly InvalidClassIndex: DynamicExceptionBuilder;
  readonly InvalidObjectIndex: DynamicExceptionBuilder;
};

// =========================================================================
// src/type/metaType.js  (base class, declared early — others extend it)
// =========================================================================

export const kMetaValueType: {
  readonly None: 0;
  readonly Number: 1;
  readonly String: 2;
  readonly Struct: 3;
  readonly Class: 4;
  readonly Pointer: 5;
};

export class MetaType {
  protected name: string;

  constructor(name: string);
  getName(): string;
  getSize(): number;
  getAlign(): number;
  valueType(): number;
  read(L: LoIndices, B: Buffer, off: number): any;
  write(L: LoIndices, B: Buffer, val: any, off: number): number;
}

/**
 * Base class for metatype forwarding (e.g. member types).
 * Not exported from the package — used internally by MetaTypeClassMember
 * and MetaTypeStructMember.
 */
declare class MetaTypeForward extends MetaType {
  protected def: MetaType;

  constructor(def: MetaType, name: string);
  getSize(): number;
  getAlign(): number;
  valueType(): number;
  read(L: LoIndices, B: Buffer, off: number): any;
  write(L: LoIndices, B: Buffer, val: any, off: number): number;
}

// =========================================================================
// src/value/levelValue.js  (base value class)
// =========================================================================

export class LevelValue {
  protected def: MetaType;
  protected value: any;

  constructor(def: MetaType);
  getDef(): MetaType;
  getSize(): number;
  getAlign(): number;
  getValue(): any;
  setValue(value: any): void;
  valueType(): number;
}

// =========================================================================
// src/value/levelValueNumber.js
// =========================================================================

export class LevelValueBool extends LevelValue {
  constructor(def: MetaTypeBool);
}

export class LevelValueNumber extends LevelValue {
  constructor(def: MetaTypeNumber);
}

// =========================================================================
// src/value/levelValueString.js
// =========================================================================

export class LevelValueString extends LevelValue {
  constructor(def: MetaTypeString);
  getSize(): number;
  getValue(): string;
}

// =========================================================================
// src/value/levelValuePointer.js
// =========================================================================

export class LevelValuePointer extends LevelValue {
  protected index: number;

  constructor();
  backpatch(L: LoIndices): void;
  setIndex(index: number): void;
}

// =========================================================================
// src/value/levelValueStruct.js
// =========================================================================

export class LevelValueStruct extends LevelValue {
  protected value: Map<string, LevelValue | LevelValue[]>;

  constructor(def: MetaTypeStruct);
  getValue(name: string): LevelValue | LevelValue[] | undefined;
  setValue(name: string, value: LevelValue | LevelValue[]): void;
}

// =========================================================================
// src/value/levelValueClass.js
// =========================================================================

export class LevelValueClass extends LevelValue {
  protected name: string;
  protected value: Map<string, LevelValue | LevelValue[]>;
  protected size: number;

  constructor(def: MetaTypeClass, name: string);
  getSize(): number;
  finalize(): void;
  getValue(name: string): LevelValue | LevelValue[] | undefined;
  setValue(name: string, value: LevelValue | LevelValue[]): void;
}

// =========================================================================
// src/type/metaTypeNumber.js
// =========================================================================

export class MetaTypeBool extends MetaType {
  constructor(name: string);
  getSize(): number;
  getAlign(): number;
  valueType(): number;
  read(L: LoIndices, B: Buffer, off: number): LevelValueBool;
  write(L: LoIndices, B: Buffer, val: LevelValueBool, off: number): number;
}

export class MetaTypeNumber extends MetaType {
  protected size: number;
  protected reader: (this: Buffer, offset: number) => number | bigint;
  protected writer: (this: Buffer, value: number | bigint, offset: number) => number | void;

  constructor(
    name: string,
    size: number,
    reader: (this: Buffer, offset: number) => number | bigint,
    writer: (this: Buffer, value: number | bigint, offset: number) => number | void
  );
  getSize(): number;
  getAlign(): number;
  valueType(): number;
  read(L: LoIndices, B: Buffer, off: number): LevelValueNumber;
  write(L: LoIndices, B: Buffer, val: LevelValueNumber, off: number): number;
}

// =========================================================================
// src/type/metaTypePointer.js
// =========================================================================

export class MetaTypePointer extends MetaType {
  constructor(name: string);
  getSize(): number;
  getAlign(): number;
  valueType(): number;
  read(L: LoIndices, B: Buffer, off: number): LevelValuePointer;
  write(L: LoIndices, B: Buffer, val: LevelValuePointer, off: number): number;
}

// =========================================================================
// src/type/metaTypeString.js
// =========================================================================

export class MetaTypeString extends MetaType {
  constructor(name: string);
  valueType(): number;
  read(L: LoIndices, B: Buffer, off: number): LevelValueString;
  write(L: LoIndices, B: Buffer, val: LevelValueString, off: number): number;
}

// =========================================================================
// src/type/metaTypeStruct.js
// =========================================================================

export class MetaTypeStructMember extends MetaTypeForward {
  protected offset: number;
  protected count: number;

  constructor(def: MetaType, name: string, count?: number);
  getSize(): number;
  read(L: LoIndices, B: Buffer, off: number): LevelValue | LevelValue[];
  write(
    L: LoIndices,
    B: Buffer,
    val: LevelValue | LevelValue[],
    off: number
  ): number;
}

export class MetaTypeStruct extends MetaType {
  protected members: Map<string, MetaTypeStructMember>;
  protected size: number;
  protected align: number;
  protected cursor: number;

  constructor(name: string);
  getSize(): number;
  getAlign(): number;
  valueType(): number;
  addMember(def: MetaType, name: string, count?: number): boolean;
  finalize(align?: number): void;
  read(L: LoIndices, B: Buffer, off: number): LevelValueStruct | undefined;
  write(L: LoIndices, B: Buffer, val: LevelValueStruct, off: number): number;
}

// =========================================================================
// src/type/metaTypeClass.js
// =========================================================================

export class MetaTypeClassMember extends MetaTypeForward {
  constructor(def: MetaType, name: string);
}

export class MetaTypeClassMemberArray extends MetaTypeClassMember {
  protected maxCount: number;

  constructor(def: MetaType, name: string, count?: number);
  read(L: LoIndices, B: Buffer, off: number): LevelValue[] | undefined;
  write(L: LoIndices, B: Buffer, val: LevelValue[], off: number): number;
}

export class MetaTypeClass extends MetaType {
  protected parent: MetaTypeClass;
  protected members: Map<string, MetaTypeClassMember>;

  constructor(name: string, parent?: MetaTypeClass | null);
  isCompatible(def: MetaType): boolean;
  valueType(): number;
  addMember(def: MetaType, name: string, count?: number): boolean;
  read(L: LoIndices, B: Buffer, off: number): LevelValueClass | null | undefined;
  write(L: LoIndices, B: Buffer, val: LevelValueStruct, off: number): number;
}

// =========================================================================
// src/levelObjects.js
// =========================================================================

export const kMemvarTypes: {
  readonly Raw: 0;
  readonly String: 1;
  readonly Ref: 2;
  readonly Array: 3;
};

export class LoHeader {
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

  constructor();
  initialize(): void;
  read(B: Buffer): this;
  write(): Buffer;
}

export class LoStringPool {
  cursor: number;
  buffer: Buffer;
  strings: Map<string, number>;

  static read(B: Buffer, offset: number): string;

  constructor();
  initialize(): void;
  set(s: string): number;
  write(): Buffer;
}

export class LoMemvar {
  type: number;
  name: number;
  size: number;
  aux: number;

  constructor(type: number, name: number, size: number, aux: number);
}

export class LoClass {
  name: string;
  raw: Map<string, LoMemvar>;
  def: MetaTypeClass | undefined;

  constructor(name: string);
  addMemvar(memvar: LoMemvar): void;
  setDef(def: MetaTypeClass): void;
}

export class LoIndices {
  classes: LoClass[];
  memvars: LoMemvar[];
  objects: LevelValueClass[];
  pointers: LevelValuePointer[];

  constructor();
  clear(): void;
  define(definitions: MetaType[]): void;
  finalize(): void;
  getClassFromName(name: string): MetaType | undefined;
  getClassIdx(name: string): number;
  getObjectIdx(name: string): number;
  addMemvarFromBlob(type: number, name: number, size: number, aux: number): LoMemvar;
  addClassFromBlob(name: string, firstMemvar: number, numMemvars: number): LoClass;
  addObject(obj: LevelValueClass): LevelValueClass;
  addClassFromDef(def: MetaTypeClass): LoClass;
}

export class LevelObjects {
  definitions: Map<string, MetaType>;
  header: LoHeader;
  strings: LoStringPool;
  objects: Map<string, LevelValueClass>;

  constructor(definitions: MetaType[]);
  get(name: string): LevelValueClass | undefined;
  set(object: LevelValueClass): void;
  define(definitions: MetaType[]): void;
  finalize(): void;
  read(B: Buffer): boolean;
  write(): Buffer;
  readDataString(B: Buffer, offset: number): string;
}

// =========================================================================
// src/types.js  (must come after all MetaType subclasses)
// =========================================================================

export const kMetaTypes: {
  readonly Bool: MetaTypeBool;
  readonly Int8: MetaTypeNumber;
  readonly Uint8: MetaTypeNumber;
  readonly Int16: MetaTypeNumber;
  readonly Uint16: MetaTypeNumber;
  readonly Int32: MetaTypeNumber;
  readonly Uint32: MetaTypeNumber;
  readonly Int64: MetaTypeNumber;
  readonly Uint64: MetaTypeNumber;
  readonly Float: MetaTypeNumber;
  readonly Double: MetaTypeNumber;
  readonly Pointer: MetaTypePointer;
  readonly Object: MetaTypeClass;
};