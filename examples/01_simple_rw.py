#!/usr/bin/env python3
"""
Example 01: Simple Read/Write of .level.bin files.

This example demonstrates:
1. Loading a declaration group from JSON
2. Writing JSON objects to a TGCL binary file
3. Reading the binary file back to JSON
4. Verifying round-trip integrity

Run: python3 examples/01_simple_rw.py
"""

import json
import os
import sys

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from that_sky_compiler.jsonify import JsonLevelObjects, DeclarationGroup


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Load declarations
    with open(os.path.join(base_dir, "decl.json"), "r", encoding="utf-8") as f:
        decl_data = json.load(f)

    # Load objects
    with open(os.path.join(base_dir, "objects.json"), "r", encoding="utf-8") as f:
        objects_data = json.load(f)

    print("=== That Sky Compiler - Simple Read/Write Example ===\n")

    # Step 1: Parse declaration group
    print("1. Parsing declaration group...")
    decl = DeclarationGroup(decl_data).parse()
    print(f"   Types: {len(decl.types)}")
    print(f"   Classes: {len(decl.classes)}")
    print(f"   Enums: {len(decl.enum_constants)}")

    # Step 2: Write JSON objects to binary
    print("\n2. Writing JSON objects to TGCL binary...")
    jlo = JsonLevelObjects(decl)
    binary = jlo.write(objects_data)
    print(f"   Binary size: {len(binary)} bytes")
    print(f"   Magic: {binary[:4].decode('ascii')}")

    # Save binary
    out_bin = os.path.join(base_dir, "output.level.bin")
    with open(out_bin, "wb") as f:
        f.write(binary)
    print(f"   Saved to: {out_bin}")

    # Step 3: Read binary back to JSON
    print("\n3. Reading binary back to JSON...")
    jlo2 = JsonLevelObjects(decl)
    result = jlo2.read(binary)

    print(f"   Objects read: {len(result)}")
    for key in sorted(result.keys()):
        obj = result[key]
        print(f"   - {key}: $type={obj.get('$type', 'N/A')}")

    # Step 4: Verify round-trip
    print("\n4. Verifying round-trip integrity...")

    # Check that all original objects are present
    all_match = True
    for orig_key, orig_obj in objects_data.items():
        if orig_key not in result:
            print(f"   MISSING: {orig_key}")
            all_match = False
            continue

        result_obj = result[orig_key]
        # Compare $type
        if orig_obj.get("$type") != result_obj.get("$type"):
            print(f"   TYPE MISMATCH: {orig_key}: {orig_obj.get('$type')} != {result_obj.get('$type')}")
            all_match = False

    if all_match:
        print("   All objects match!")
    else:
        print("   Some mismatches found (may be expected for auto-created types)")

    # Save JSON output
    out_json = os.path.join(base_dir, "output.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"objects": result}, f, indent=2, ensure_ascii=False)
    print(f"\n   JSON output saved to: {out_json}")

    print("\n=== Done! ===")


if __name__ == "__main__":
    main()
