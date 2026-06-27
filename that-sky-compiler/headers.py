"""
sldl-headers - Standard declaration library loader (libstdsky).

Ported from the JavaScript sldl-headers package.
Copyright (c) 2026 That Sky Project - LGPL-3.0-or-later

The original sldl-headers package contains a large built artifact with all
MetaType/MetaClass declarations for Sky: Children of the Light. Since that
data is generated and not included in the source repository, this module
provides a loader that can:

1. Load declarations from an external JSON file.
2. Return an empty declaration group when no standard library is available.

To use the full standard declarations, export them from the original
JavaScript package and save as a JSON file, then load with load_decl_file().
"""

import json
import os

# The game engine version this library targets.
kEngineVersion = [0, 33, 7, 394009]

# Default empty declarations - users can provide their own.
kLibStdSkyDecl = {}


def load_decl_file(path):
    """Load a declaration group from a JSON file.

    Args:
        path: Path to a JSON file containing the declaration group
              (with A$/E$/S$/C$ prefixed keys).

    Returns:
        dict containing the declaration group.
    """
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_decl_string(json_str):
    """Load a declaration group from a JSON string.

    Args:
        json_str: JSON string containing the declaration group.

    Returns:
        dict containing the declaration group.
    """
    return json.loads(json_str)


def find_std_decl():
    """Try to find the standard declaration library in common locations.

    Searches for 'libstdsky.json' or 'sldl-headers.json' in:
    - The package directory
    - The current working directory
    - ~/.that-sky-compiler/

    Returns:
        dict or None if not found.
    """
    candidates = [
        os.path.join(os.path.dirname(__file__), "libstdsky.json"),
        os.path.join(os.getcwd(), "libstdsky.json"),
        os.path.join(os.getcwd(), "sldl-headers.json"),
        os.path.expanduser("~/.that-sky-compiler/libstdsky.json"),
    ]

    for path in candidates:
        if os.path.exists(path):
            return load_decl_file(path)

    return None


def get_std_decl():
    """Get the standard declaration library.

    Tries to load from file; returns empty dict if not found.

    Returns:
        dict containing the declaration group.
    """
    decl = find_std_decl()
    return decl if decl is not None else kLibStdSkyDecl
