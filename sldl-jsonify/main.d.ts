// Type declarations for sldl-jsonify.

/// <reference types="node" />

import type { MetaType, MetaTypeClass, LevelValue } from "sldl-objects";

// --- Exceptions --------------------------------------------------------------

export const kItaniumException: {
  Unexpected: ExceptionBuilder;
  Duplicated: ExceptionBuilder;
  InvalidAlign: ExceptionBuilder;
  InvalidPointer: ExceptionBuilder;
  UnrecognizedType: ExceptionBuilder;
  DuplicateTypeName: ExceptionBuilder;
  DuplicateEnumConstant: ExceptionBuilder;
  InvalidAliasTarget: ExceptionBuilder;
  UnresolvedTypeName: ExceptionBuilder;
  CircularInheritance: ExceptionBuilder;
  InvalidMemberSyntax: ExceptionBuilder;
  InvalidEnumBaseType: ExceptionBuilder;
  UnresolvedEnumConstant: ExceptionBuilder;
  UnresolvedObjectReference: ExceptionBuilder;
  InvalidValueFormat: ExceptionBuilder;
};

interface ExceptionBuilder {
  message?: string;
  builder?: (...args: any[]) => string;
  from(...args: any[]): Error;
}

// --- Itanium -----------------------------------------------------------------

export const kItaniumTypes: Record<string, MetaType>;

export class ItaniumResolver {
  /** Parsed type definitions indexed by name. */
  names: Map<string, MetaType>;

  /**
   * Parse an itanium string and return all class/struct MetaType definitions.
   * Returns undefined if there are unresolved forward references.
   */
  static resolve(s: string): MetaType[] | undefined;

  constructor(s: string);

  /** Parse the itanium string. */
  resolve(): void;

  /**
   * Parse and produce a JSON-compatible declaration group object
   * with C$/S$/A$ keys. Returns undefined if unresolved references remain.
   */
  resolveToDeclGroup(): Record<string, any> | undefined;
}

// --- Declaration Group -------------------------------------------------------

export class DeclarationGroup {
  /** All registered types (including built-ins). */
  types: Map<string, MetaType>;
  /** Class-type definitions indexed by name. */
  classes: Map<string, MetaTypeClass>;
  /** Enum constant name -> numeric value. */
  enumConstants: Map<string, number | bigint>;
  /** Enum constant name -> metadata. */
  enumInfo: Map<string, { name: string; value: number | bigint; enumName: string }>;

  /**
   * @param declGroup - plain object with A$/E$/S$/C$ keys.
   */
  constructor(declGroup: Record<string, any>);

  /** Parse and resolve all declarations. Throws on errors. */
  parse(): this;

  /**
   * Resolve a type by name, trying direct lookup, enum names,
   * and aliases.
   */
  resolveType(name: string): MetaType | undefined;
}

// --- JSON Value Helpers ------------------------------------------------------

export namespace jsonValue {
  /** Convert a JSON value to a LevelValue. */
  function parse(
    jsonValue: any,
    member: any,           // MetaTypeClassMember from sldl-objects
    declGroup: DeclarationGroup | null
  ): LevelValue | LevelValue[];

  /** Convert a LevelValue to a plain JSON value. */
  function serialize(
    val: LevelValue | LevelValue[],
    declGroup: DeclarationGroup | null
  ): any;

  /** Serialize a LevelValueClass to a plain JSON object (includes $type). */
  function serializeClass(
    lvc: any,              // LevelValueClass from sldl-objects
    declGroup: DeclarationGroup | null
  ): Record<string, any>;

  /** Parse a raw (B$-prefixed) JSON value into a LevelValueRaw. */
  function parseRaw(jsonValue: any, def: MetaType): LevelValue;

  /** Parse a JSON number value with B$/K$ prefix support. */
  function parseNumber(
    jsonValue: any,
    def: MetaType,
    declGroup: DeclarationGroup | null
  ): LevelValue;

  /** Parse a JSON object into a LevelValueClass for inline class members. */
  function parseClass(
    jsonValue: any,
    classDef: MetaTypeClass,
    declGroup: DeclarationGroup | null
  ): LevelValue;

  /** Right-align a buffer, padding/truncating on the left. */
  function rightAlign(buf: Buffer, targetSize: number): Buffer;
}

// --- JsonLevelObjects --------------------------------------------------------

export class JsonLevelObjects {
  /**
   * @param declGroup - JSON declaration group, or itanium string if
   *   isItanium is true.
   * @param isItanium - treat declGroup as an itanium mangled string.
   */
  constructor(declGroup: Record<string, any> | string, isItanium?: boolean);

  /**
   * Read a TGCL binary buffer and return JSON objects with their
   * declaration group.
   */
  read(buffer: Buffer): {
    objects: Record<string, any>;
    declGroup: Record<string, any>;
  };

  /**
   * Write JSON objects (with "O$name" keys) to a TGCL binary buffer.
   */
  write(objects: Record<string, any>): Buffer;
}
