// Type declarations for sldl-objects.

/// <reference types="node" />

// --- Exceptions --------------------------------------------------------------

interface ExceptionBuilder {
  message?: string;
  builder?: (...args: any[]) => string;
  from(...args: any[]): Error;
}

export const kObjectExceptions: Record<string, ExceptionBuilder>;

// --- Memvar Types ------------------------------------------------------------

export const kMemvarTypes: {
  Raw: 0;
  String: 1;
  Ref: 2;
  Array: 3;
};

// --- Built-in Types ----------------------------------------------------------

export const kMetaTypes: Record<string, MetaType>;

export function getClumpGeneric(typeName: string): MetaTypeClass;

export const clumpGenericCache: Map<string, MetaTypeClass>;

// --- MetaType Hierarchy ------------------------------------------------------

export const kMetaValueType: {
  None: 0;
  Number: 1;
  String: 2;
  Struct: 3;
  Class: 4;
  Pointer: 5;
  Raw: 6;
};

export class MetaType {
  name: string;
  constructor(name: string);
  getName(): string;
  getSize(): number;
  getAlign(): number;
  valueType(): number;
  read(L: LoIndices, B: Buffer, off: number): LevelValue;
  write(L: LoIndices, B: Buffer, val: LevelValue, off: number): number;
}

export class MetaTypeForward extends MetaType {
  def: MetaType;
  constructor(def: MetaType, name: string);
}

export class MetaTypeClassMember extends MetaTypeForward {}
export class MetaTypeClassMemberArray extends MetaTypeClassMember {
  maxCount: number;
  constructor(def: MetaType, name: string, count?: number);
}

export class MetaTypeClass extends MetaType {
  parent: MetaTypeClass | null;
  members: Map<string, MetaTypeClassMember>;

  constructor(name: string, parent?: MetaTypeClass | null);
  isCompatible(def: MetaType): boolean;
  addMember(def: MetaType, name: string, count?: number): boolean;
  getMember(name: string): MetaTypeClassMember | undefined;
  allMembers(usedMembers?: Set<string>): Array<[string, MetaTypeClassMember]>;
  read(L: LoIndices, B: Buffer, off: number, raw?: LoClass): LevelValueClass | null | undefined;
  write(L: LoIndices, B: Buffer, val: LevelValueClass, off: number, usedMembers?: Set<string>): number;
  static memberTypeDefault(member: MetaTypeClassMember): LevelValue | LevelValue[];
}

export class MetaTypeBool extends MetaType {
  constructor(name: string);
}
export class MetaTypeNumber extends MetaType {
  size: number;
  constructor(name: string, size: number, reader: Function, writer: Function);
}
export class MetaTypePointer extends MetaType {
  constructor(name: string);
}
export class MetaTypeString extends MetaType {
  constructor(name: string);
}
export class MetaTypeRaw extends MetaType {
  size: number;
  constructor(name: string, size: number);
}
export class MetaTypeStructMember extends MetaTypeForward {
  offset: number;
  count: number;
  constructor(def: MetaType, name: string, count?: number);
}
export class MetaTypeStruct extends MetaType {
  members: Map<string, MetaTypeStructMember>;
  constructor(name: string);
  addMember(def: MetaType, name: string, count?: number): boolean;
  finalize(align?: number): boolean;
}

// --- LevelValue Hierarchy ----------------------------------------------------

export class LevelValue {
  def: MetaType;
  value: any;
  constructor(def: MetaType);
  getDef(): MetaType;
  getSize(): number;
  getAlign(): number;
  getValue(): any;
  setValue(value: any): void;
  valueType(): number;
}

export class LevelValueClass extends LevelValue {
  name: string;
  size: number;
  constructor(def: MetaTypeClass, name: string);
  getName(): string;
  getValue(name: string): LevelValue | LevelValue[] | undefined;
  setValue(name: string, value: LevelValue | LevelValue[]): void;
  finalize(): void;
  toJSON(declGroup: any): Record<string, any>;
}

export class LevelValueBool extends LevelValue {}
export class LevelValueNumber extends LevelValue {}

export class LevelValuePointer extends LevelValue {
  index: number;
  targetName: string | null;
  backpatch(L: LoIndices): void;
  setIndex(index: number): void;
}

export class LevelValueString extends LevelValue {}

export class LevelValueStruct extends LevelValue {
  getValue(name: string): LevelValue | LevelValue[] | undefined;
  setValue(name: string, value: LevelValue | LevelValue[]): void;
}

export class LevelValueRaw extends LevelValue {}

// --- Binary I/O --------------------------------------------------------------

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
  read(B: Buffer): this;
  write(): Buffer;
}

export class LoStringPool {
  static read(B: Buffer, offset: number): string;
  set(s: string): number;
  write(): Buffer;
}

export class LoMemvar {
  type: number;
  name: string;
  size: number;
  aux: number;
  constructor(type: number, name: string, size: number, aux: number);
}

export class LoClass {
  name: string;
  raw: Map<string, LoMemvar>;
  def: MetaTypeClass | undefined;
  addMemvar(m: LoMemvar): void;
  setDef(def: MetaTypeClass): void;
}

export class LoIndices {
  classes: LoClass[];
  memvars: LoMemvar[];
  objects: LevelValueClass[];
  pointers: LevelValuePointer[];
  metaTypes: Map<string, MetaType>;
  metaClasses: Map<string, MetaTypeClass>;
  classIndices: Map<string, number>;
  objectIndices: Map<string, number>;
  define(definitions: MetaType[]): void;
  clear(): void;
  getClassFromName(name: string): MetaType | undefined;
  getClassIdx(name: string): number;
  getObjectIdx(name: string): number;
  addMemvarFromBlob(type: number, name: string, size: number, aux: number): LoMemvar;
  addClassFromBlob(name: string, firstMemvar: number, numMemvars: number): LoClass;
  addObject(obj: LevelValueClass): LevelValueClass;
  addClassFromDef(def: MetaTypeClass, usedMembers?: Set<string>): LoClass;
}

export class LevelObjects {
  indices: LoIndices;
  objects: Map<string, LevelValueClass>;
  usedMembers: Map<string, Set<string>>;

  constructor(definitions: MetaType[]);

  get(name: string): LevelValueClass | undefined;
  set(obj: LevelValueClass): void;
  readBinary(buffer: Buffer): Map<string, LevelValueClass>;
  writeBinary(usedMembers?: Map<string, Set<string>>): Buffer;
}
