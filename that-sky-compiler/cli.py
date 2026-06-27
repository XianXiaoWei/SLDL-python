#!/usr/bin/env python3
"""
That Sky Compiler CLI - command-line interface for reading/writing .level.bin files.

Usage:
  # Read a .level.bin file and output JSON
  that-sky-compiler read <input.level.bin> [decl.json] [-o output.json]

  # Write JSON to a .level.bin file
  that-sky-compiler write <input.json> [decl.json] [-o output.level.bin]

  # Convert between formats
  that-sky-compiler convert <input> [-o output] [--from bin|json] [--to bin|json]

  # Show version info
  that-sky-compiler version

Runs on Termux: pkg install python && pip install that-sky-compiler
"""

import sys
import os
import json
import argparse

from . import __version__
from .jsonify import JsonLevelObjects, DeclarationGroup
from . import headers


def cmd_read(args):
    """Read a .level.bin file and output JSON."""
    with open(args.input, "rb") as f:
        buffer = f.read()

    decl = _load_decl(args.decl)
    jlo = JsonLevelObjects(decl)
    objects = jlo.read(buffer)

    output = {
        "$version": __version__,
        "$engine": headers.kEngineVersion,
        "objects": objects,
    }

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"Wrote JSON to {args.output}")
    else:
        print(json.dumps(output, indent=2, ensure_ascii=False))


def cmd_write(args):
    """Write JSON to a .level.bin file."""
    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    objects = data.get("objects", data)

    decl = _load_decl(args.decl)
    jlo = JsonLevelObjects(decl)
    binary = jlo.write(objects)

    output = args.output or (args.input.rsplit(".", 1)[0] + ".level.bin")
    with open(output, "wb") as f:
        f.write(binary)
    print(f"Wrote binary to {output} ({len(binary)} bytes)")


def cmd_convert(args):
    """Convert between binary and JSON formats."""
    if args.from_format is None:
        ext = os.path.splitext(args.input)[1].lower()
        if ext in (".bin", ".level", ".levelbin"):
            args.from_format = "bin"
        else:
            args.from_format = "json"

    if args.to_format is None:
        if args.from_format == "bin":
            args.to_format = "json"
        else:
            args.to_format = "bin"

    decl = _load_decl(args.decl)

    if args.from_format == "bin" and args.to_format == "json":
        with open(args.input, "rb") as f:
            buffer = f.read()
        jlo = JsonLevelObjects(decl)
        objects = jlo.read(buffer)
        output = {
            "$version": __version__,
            "$engine": headers.kEngineVersion,
            "objects": objects,
        }
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2, ensure_ascii=False)
            print(f"Wrote JSON to {args.output}")
        else:
            print(json.dumps(output, indent=2, ensure_ascii=False))

    elif args.from_format == "json" and args.to_format == "bin":
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
        objects = data.get("objects", data)
        jlo = JsonLevelObjects(decl)
        binary = jlo.write(objects)
        output = args.output or (args.input.rsplit(".", 1)[0] + ".level.bin")
        with open(output, "wb") as f:
            f.write(binary)
        print(f"Wrote binary to {output} ({len(binary)} bytes)")
    else:
        print("Error: source and target format must differ", file=sys.stderr)
        sys.exit(1)


def cmd_version(args):
    """Show version information."""
    print(f"That Sky Compiler v{__version__}")
    print(f"Engine version: {headers.kEngineVersion}")
    print(f"Python {sys.version}")


def _load_decl(decl_path):
    """Load a declaration group from a file path, or use the standard library."""
    if decl_path:
        return headers.load_decl_file(decl_path)

    std_decl = headers.find_std_decl()
    if std_decl is not None:
        print("Using standard declarations from libstdsky.json", file=sys.stderr)
        return std_decl

    # No declarations available - use empty (will auto-create types on read).
    print("Warning: No declaration group specified. Types will be auto-created from binary data.", file=sys.stderr)
    return {}


def main(argv=None):
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="that-sky-compiler",
        description="That Sky Compiler - read/write TGCL .level.bin files",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # read
    p_read = subparsers.add_parser("read", help="Read a .level.bin file and output JSON")
    p_read.add_argument("input", help="Input .level.bin file path")
    p_read.add_argument("decl", nargs="?", help="Declaration group JSON file (optional)")
    p_read.add_argument("-o", "--output", help="Output JSON file path (default: stdout)")
    p_read.set_defaults(func=cmd_read)

    # write
    p_write = subparsers.add_parser("write", help="Write JSON to a .level.bin file")
    p_write.add_argument("input", help="Input JSON file path")
    p_write.add_argument("decl", nargs="?", help="Declaration group JSON file (optional)")
    p_write.add_argument("-o", "--output", help="Output .level.bin file path")
    p_write.set_defaults(func=cmd_write)

    # convert
    p_conv = subparsers.add_parser("convert", help="Convert between binary and JSON formats")
    p_conv.add_argument("input", help="Input file path")
    p_conv.add_argument("decl", nargs="?", help="Declaration group JSON file (optional)")
    p_conv.add_argument("-o", "--output", help="Output file path")
    p_conv.add_argument("--from", dest="from_format", choices=["bin", "json"], help="Source format")
    p_conv.add_argument("--to", dest="to_format", choices=["bin", "json"], help="Target format")
    p_conv.set_defaults(func=cmd_convert)

    # version
    p_version = subparsers.add_parser("version", help="Show version information")
    p_version.set_defaults(func=cmd_version)

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
