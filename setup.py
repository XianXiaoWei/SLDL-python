#!/usr/bin/env python3
"""Standalone setup.py for pip install . compatibility."""

from setuptools import setup, find_packages

setup(
    name="that-sky-compiler",
    version="1.0.0",
    description="A Python compiler for Sky Level Description Language (SLDL)",
    py_modules=["that_sky_compiler"],
    packages=find_packages(),
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "that-sky-compiler=that_sky_compiler.cli:main",
        ],
    },
)
