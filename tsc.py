#!/usr/bin/env python3
"""
Standalone CLI runner for That Sky Compiler.

This script allows running the compiler without pip install.
Just place it somewhere in your PATH (e.g. ~/bin/ or ~/.local/bin/).

Usage:
  # Make executable and symlink/copy to PATH
  chmod +x tsc.py
  cp tsc.py ~/.local/bin/that-sky-compiler

  # Or run directly
  python3 tsc.py read input.level.bin decl.json -o output.json
"""

import os
import sys

# Try to import from installed package first, then fall back to local.
try:
    from that_sky_compiler.cli import main
except ImportError:
    # Add the directory containing this script's parent to path.
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, _script_dir)
    try:
        from that_sky_compiler.cli import main
    except ImportError as e:
        print(f"Error: Cannot find that_sky_compiler package.", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        print(f"  Make sure the 'that_sky_compiler' directory is in:", file=sys.stderr)
        print(f"    {_script_dir}", file=sys.stderr)
        print(f"  Or run: pip install . from the project directory", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
