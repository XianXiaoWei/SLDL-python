var { kMetaTypes, getClumpGeneric, clumpGenericCache } = require("sldl-objects");
var { MetaType, MetaTypeForward, kMetaValueType, MetaTypeClass,
  MetaTypeClassMember, MetaTypeClassMemberArray, MetaTypeStruct,
  MetaTypeRaw, MetaTypePointer } = require("sldl-objects");
var { kItaniumException } = require("./exception.js");

/**
 * Parses a JSON declaration group into MetaType instances.
 */
class DeclarationGroup {
  /**
   * @param {Object} declGroup - parsed JSON object with A$/E$/S$/C$ keys.
   */
  constructor(declGroup) {
    /** @type {Map<string, MetaType>} */
    this.types = new Map();
    /** @type {Map<string, MetaTypeClass>} */
    this.classes = new Map();
    /** @type {Map<string, any>} enum constant name -> value */
    this.enumConstants = new Map();
    /** @type {Map<string, {name: string, value: any}>} enum constant name -> info */
    this.enumInfo = new Map();

    // Register built-in types.
    for (var key of Object.keys(kMetaTypes)) {
      var builtin = kMetaTypes[key];
      this.types.set(key, builtin);
      // Also register by runtime name (e.g., "cstring" -> CString).
      var rtName = builtin.getName();
      if (rtName !== key)
        this.types.set(rtName, builtin);
    }
    for (var [key, val] of this.types)
      if (val instanceof MetaTypeClass)
        this.classes.set(key, val);

    /** @type {Object} The raw declaration group object. */
    this.raw = declGroup;
  }

  /**
   * Parse the declaration group. Throws on errors.
   * @returns {this}
   */
  parse() {
    if (!this.raw || typeof this.raw !== "object")
      return this;

    // Phase 1: Categorize entries and check for duplicate names.
    var aliases = {}
      , enums = {}
      , structs = {}
      , classes = {}
      , allNames = new Set();

    for (var key of Object.keys(this.raw)) {
      var val = this.raw[key];

      if (key.startsWith("A$")) {
        var name = key.slice(2);
        this.checkDuplicate(allNames, name);
        aliases[name] = val;
      } else if (key.startsWith("E$")) {
        var name = key.slice(2);
        this.checkDuplicate(allNames, name);
        enums[name] = val;
      } else if (key.startsWith("S$")) {
        var name = key.slice(2);
        this.checkDuplicate(allNames, name);
        structs[name] = val;
      } else if (key.startsWith("C$")) {
        var name = key.slice(2);
        this.checkDuplicate(allNames, name);
        classes[name] = val;
      }
    }

    // Phase 2: Resolve aliases.
    for (var name of Object.keys(aliases)) {
      var targetName = aliases[name];
      if (typeof targetName !== "string")
        throw kItaniumException.InvalidAliasTarget.from(name, String(targetName));
      // Will be resolved in the resolve phase.
      // Store for later resolution.
      this.aliasMap = this.aliasMap || {};
      this.aliasMap[name] = targetName;
    }

    // Phase 3: Build enums.
    for (var name of Object.keys(enums)) {
      var enumDef = enums[name];
      if (!enumDef || typeof enumDef !== "object")
        throw kItaniumException.InvalidEnumBaseType.from(name, String(enumDef));

      var baseTypeName = enumDef.$as;
      if (typeof baseTypeName !== "string")
        throw kItaniumException.InvalidEnumBaseType.from(name, String(baseTypeName));

      // Underlying type must be a signed integer.
      var signedInts = ["int8_t", "int16_t", "int32_t", "int64_t"];
      if (signedInts.indexOf(baseTypeName) === -1)
        throw kItaniumException.InvalidEnumBaseType.from(name, baseTypeName);

      for (var constKey of Object.keys(enumDef)) {
        if (constKey.startsWith("$"))
          continue;
        var constVal = enumDef[constKey];
        if (this.enumInfo.has(constKey))
          throw kItaniumException.DuplicateEnumConstant.from(constKey);

        // Parse value - allow number or numeric string.
        var parsed;
        if (typeof constVal === "number")
          parsed = constVal;
        else if (typeof constVal === "string")
          parsed = parseInt(constVal, 10) || 0;
        else
          parsed = 0;

        this.enumInfo.set(constKey, { name: constKey, value: parsed, enumName: name });
        this.enumConstants.set(constKey, parsed);
      }
    }

    // Phase 4–5: Forward-declare structs and classes.
    for (var name of Object.keys(structs))
      this.declareStruct(name);
    for (var name of Object.keys(classes))
      this.declareClass(name, classes[name]);

    // Phase 6: Populate struct members.
    for (var name of Object.keys(structs)) {
      var structDef = this.types.get(name);
      if (!(structDef instanceof MetaTypeStruct))
        continue;

      var structRaw = structs[name];
      var align = structRaw.$align;
      if (align !== void 0) {
        if (typeof align !== "number" || align <= 0 || (align & (align - 1)))
          throw kItaniumException.InvalidValueFormat.from(align, "$align for struct " + name);
      }

      for (var memberKey of Object.keys(structRaw)) {
        if (memberKey.startsWith("$"))
          continue;

        var memberTypeExpr = structRaw[memberKey];
        if (typeof memberTypeExpr !== "string")
          throw kItaniumException.InvalidMemberSyntax.from(String(memberTypeExpr));

        var result = this.parseStructMemberType(memberTypeExpr, name, memberKey);
        structDef.addMember(result.type, memberKey, result.count);
      }

      structDef.finalize(align);
    }

    // Phase 7: Resolve class inheritance and populate members.
    for (var name of Object.keys(classes)) {
      var classDef = this.classes.get(name);
      if (!classDef)
        continue;

      var classRaw = classes[name];

      // Resolve $parent.
      var parentName = classRaw.$parent;
      if (parentName === null || parentName === void 0) {
        // Use Object as default parent - already set.
      } else if (typeof parentName === "string") {
        var parentDef = this.resolveType(parentName);
        if (!parentDef || !(parentDef instanceof MetaTypeClass))
          throw kItaniumException.UnresolvedTypeName.from(parentName);
        classDef.parent = parentDef;
      }

      // Circular inheritance check.
      this.checkCircular(classDef, name);

      // Populate members.
      for (var memberKey of Object.keys(classRaw)) {
        if (memberKey.startsWith("$"))
          continue;

        var memberTypeExpr = classRaw[memberKey];
        if (typeof memberTypeExpr !== "string")
          throw kItaniumException.InvalidMemberSyntax.from(String(memberTypeExpr));

        var memberResult = this.parseClassMemberType(memberTypeExpr, name, memberKey);
        classDef.addMember(memberResult.type, memberKey, memberResult.count);
      }
    }

    // Phase 8: Resolve aliases (deferred).
    if (this.aliasMap) {
      for (var name of Object.keys(this.aliasMap)) {
        var targetName = this.aliasMap[name];
        var target = this.resolveType(targetName);
        if (!target)
          throw kItaniumException.UnresolvedTypeName.from(targetName);

        var vt = target.valueType();
        if (vt !== kMetaValueType.Number && vt !== kMetaValueType.Struct)
          throw kItaniumException.InvalidAliasTarget.from(name, targetName);

        this.types.set(name, new MetaTypeForward(target, name));
      }
    }

    // Phase 9: Resolve Clump<T> generics.
    for (var [key, clumpClass] of clumpGenericCache) {
      if (clumpClass.members.size > 0)
        continue; // Already resolved.

      // Extract T from "Clump<T>".
      var typeParam = key.slice(6, -1); // remove "Clump<" and ">"
      var resolvedT = this.resolveType(typeParam);
      if (!resolvedT || !(resolvedT instanceof MetaTypeClass))
        throw kItaniumException.UnresolvedTypeName.from(typeParam);

      clumpClass.addMember(new MetaTypePointer("pointer"), "data", 0);
      this.classes.set(key, clumpClass);
    }

    return this;
  }

  /**
   * Resolve a type by name, trying aliases, built-ins, declared types.
   * @param {string} name
   * @returns {MetaType|undefined}
   */
  resolveType(name) {
    // Direct match.
    if (this.types.has(name))
      return this.types.get(name);

    // Enum name -> its underlying integer type.
    if (this.enumInfo.size > 0) {
      for (var [ek, ev] of this.enumInfo) {
        if (ev.enumName === name) {
          // Return the underlying type.
          var rawEnum = this.raw["E$" + name];
          if (rawEnum && rawEnum.$as)
            return this.types.get(rawEnum.$as);
        }
      }
    }

    // Alias.
    if (this.aliasMap && this.aliasMap[name])
      return this.resolveType(this.aliasMap[name]);

    return void 0;
  }

  declareStruct(name) {
    if (this.types.has(name))
      return;
    var s = new MetaTypeStruct(name);
    this.types.set(name, s);
  }

  declareClass(name, raw) {
    if (this.classes.has(name))
      return;

    // Parent will be resolved later - use Object as placeholder.
    var c = new MetaTypeClass(name, kMetaTypes.Object);
    this.types.set(name, c);
    this.classes.set(name, c);
  }

  checkCircular(classDef, name) {
    var visited = new Set();
    for (var p = classDef.parent; p; p = p.parent) {
      if (p.getName() === name)
        throw kItaniumException.CircularInheritance.from(name);
      if (visited.has(p.getName()))
        break; // Already checked.
      visited.add(p.getName());
    }
  }

  checkDuplicate(allNames, name) {
    if (allNames.has(name))
      throw kItaniumException.DuplicateTypeName.from(name);
    allNames.add(name);
  }

  /**
   * Parse a struct member type expression.
   * Only allows: type_name or type_name[N].
   * @returns {{ type: MetaType, count: number|undefined }}
   */
  parseStructMemberType(expr, structName, memberName) {
    // Check for array suffix: type[N].
    var arrayMatch = expr.match(/^(.+?)\[(\d+)\]$/);
    if (arrayMatch) {
      var typeName = arrayMatch[1].trim();
      var count = parseInt(arrayMatch[2], 10) || 1;
      var baseType = this.resolveType(typeName);
      if (!baseType)
        throw kItaniumException.UnresolvedTypeName.from(typeName);
      if (baseType.valueType() !== kMetaValueType.Number
        && baseType.valueType() !== kMetaValueType.Struct)
        throw kItaniumException.InvalidMemberSyntax.from(expr);
      return { type: baseType, count: count };
    }

    // Plain type name.
    var baseType = this.resolveType(expr.trim());
    if (!baseType)
      throw kItaniumException.UnresolvedTypeName.from(expr);
    if (baseType.valueType() !== kMetaValueType.Number
      && baseType.valueType() !== kMetaValueType.Struct)
      throw kItaniumException.InvalidMemberSyntax.from(expr);
    return { type: baseType, count: void 0 };
  }

  /**
   * Parse a class member type expression.
   * Grammar: <type-name> ["*"] [ "[" [<length>] "]" ]  or  R$<size>
   * @returns {{ type: MetaType, count: number|undefined }}
   */
  parseClassMemberType(expr, className, memberName) {
    expr = expr.trim();

    // R$<size> - raw binary.
    var rawMatch = expr.match(/^R\$(\d+)$/);
    if (rawMatch) {
      var size = parseInt(rawMatch[1], 10);
      return { type: new MetaTypeRaw(className + "::" + memberName, size), count: void 0 };
    }

    // Parse pointer, array, etc.
    var hasPointer = expr.indexOf("*") !== -1;
    var bracketMatch = expr.match(/\[(\d*)\]$/);
    var hasBracket = bracketMatch !== null;
    var count = void 0;
    if (hasBracket) {
      count = bracketMatch[1] ? parseInt(bracketMatch[1], 10) || 0 : 0;
    }

    // Extract type name.
    var typeName = expr
      .replace(/\*/, "")
      .replace(/\[\d*\]$/, "")
      .trim();

    // Strip C$/S$/E$/A$ prefix from type references.
    if (typeName.startsWith("C$") || typeName.startsWith("S$")
      || typeName.startsWith("E$") || typeName.startsWith("A$"))
      typeName = typeName.slice(2);

    // Handle Clump<T>.
    var resolvedType;
    if (typeName.startsWith("Clump<") && typeName.endsWith(">")) {
      resolvedType = this.types.get(typeName);
      if (!resolvedType) {
        // Create generic Clump<T>.
        var innerType = typeName.slice(6, -1);
        resolvedType = getClumpGeneric(innerType);
        this.types.set(typeName, resolvedType);
        this.classes.set(typeName, resolvedType);
      }
    } else {
      resolvedType = this.resolveType(typeName);
    }

    if (!resolvedType)
      throw kItaniumException.UnresolvedTypeName.from(typeName);

    if (hasPointer) {
      // Reference types.
      if (!(resolvedType instanceof MetaTypeClass))
        throw kItaniumException.InvalidMemberSyntax.from(expr);

      if (hasBracket) {
        // Ref array.
        return { type: new MetaTypeClassMemberArray(kMetaTypes.Pointer, className + "::" + memberName, count), count: void 0 };
      } else {
        // Single ref.
        return { type: new MetaTypeClassMember(kMetaTypes.Pointer, className + "::" + memberName), count: void 0 };
      }
    }

    if (hasBracket) {
      // Inline object array (no *).
      if (resolvedType instanceof MetaTypeClass) {
        return {
          type: new MetaTypeClassMemberArray(resolvedType, className + "::" + memberName, count),
          count: void 0
        };
      }
      throw kItaniumException.InvalidMemberSyntax.from(expr);
    }

    // Inline struct, number, or string.
    return { type: new MetaTypeClassMember(resolvedType, className + "::" + memberName), count: void 0 };
  }
}

module.exports = {
  DeclarationGroup
};
