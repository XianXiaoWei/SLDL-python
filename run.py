#!/usr/bin/env python3
"""
That Sky Compiler - 主程序入口

下载后直接运行:
  python3 run.py read  input.level.bin decl.json -o output.json
  python3 run.py write input.json decl.json -o output.level.bin
  python3 run.py version

Termux 安装后也可直接:
  python3 run.py
"""

import sys
import os

# 把当前目录加入路径，确保能找到 that_sky_compiler 包
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from that_sky_compiler.cli import main

if __name__ == "__main__":
    main()
