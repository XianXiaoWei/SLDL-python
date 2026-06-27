#!/bin/bash
#
# That Sky Compiler - Termux Installation Script
#
# Usage:
#   chmod +x install_termux.sh
#   ./install_termux.sh
#
# This script installs the compiler on Termux (Android) or any Linux system.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  That Sky Compiler - Installation"
echo "============================================"
echo ""

# Check Python.
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed."
    echo "  On Termux:  pkg install python"
    echo "  On Linux:   sudo apt install python3 python3-pip"
    exit 1
fi

PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "[OK] Python $PY_VERSION found"

# Check pip.
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo "[ERROR] pip is not installed."
    echo "  On Termux:  pkg install python  (pip is included)"
    echo "  On Linux:   sudo apt install python3-pip"
    exit 1
fi

PIP_CMD="pip"
if ! command -v pip &> /dev/null; then
    PIP_CMD="pip3"
fi
echo "[OK] $PIP_CMD found"

# Install the package.
echo ""
echo "Installing that-sky-compiler from $SCRIPT_DIR ..."
cd "$SCRIPT_DIR"
$PIP_CMD install . --break-system-packages 2>/dev/null || $PIP_CMD install .

# Verify installation.
echo ""
if command -v that-sky-compiler &> /dev/null; then
    echo "[OK] Installation successful!"
    echo ""
    that-sky-compiler version
    echo ""
    echo "============================================"
    echo "  Installation Complete!"
    echo "============================================"
    echo ""
    echo "Usage:"
    echo "  that-sky-compiler read  input.level.bin [decl.json] [-o output.json]"
    echo "  that-sky-compiler write input.json [decl.json] [-o output.level.bin]"
    echo "  that-sky-compiler convert input [-o output] [--from bin|json] [--to bin|json]"
    echo "  that-sky-compiler version"
    echo ""
else
    echo "[WARN] 'that-sky-compiler' command not found in PATH."
    echo "  You can still use it directly:"
    echo "  python3 $SCRIPT_DIR/tsc.py <command>"
    echo ""
    echo "  Or add to PATH manually:"
    echo "  export PATH=\"$SCRIPT_DIR:\$PATH\""
fi
