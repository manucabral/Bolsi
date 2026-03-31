"""
Build script for Bolsi using Nuitka.
Compatible with pythonnet on Python 3.12+
"""

import sqlite3
import sys
import subprocess
from pathlib import Path
from backend.logger import logger


SCHEMA_FILES = [
    "user.sql",
    "category.sql",
    "credits.sql",
    "transactions.sql",
    "bills.sql",
    "notes.sql",
    "sessions.sql",
    "notification_settings.sql",
]


def build_database_template() -> Path:
    """Create backend/local.template.db from SQL schema files."""
    project_root = Path(__file__).parent
    schemas_dir = project_root / "backend" / "schemas"
    template_path = project_root / "backend" / "local.template.db"

    if not schemas_dir.exists():
        raise FileNotFoundError(f"Schemas directory not found: {schemas_dir}")

    if template_path.exists():
        template_path.unlink()

    conn = sqlite3.connect(str(template_path))
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = OFF;")
        for schema_file in SCHEMA_FILES:
            schema_path = schemas_dir / schema_file
            if not schema_path.exists():
                raise FileNotFoundError(f"Schema file not found: {schema_path}")
            with open(schema_path, "r", encoding="utf-8") as f:
                cursor.executescript(f.read())
        cursor.execute("PRAGMA foreign_keys = ON;")
        conn.commit()
    finally:
        conn.close()

    logger.info("Database template generated: %s", template_path)
    return template_path


def build():
    """Build the application with Nuitka."""

    build_database_template()

    nuitka_args = [
        sys.executable,
        "-m",
        "nuitka",
        "--standalone",
        "--windows-console-mode=disable",
        "--output-dir=dist_build",
        "--output-filename=Bolsi",
        # metadata
        "--windows-icon-from-ico=assets/logo.ico",
        "--windows-product-name=Bolsi",
        "--windows-file-description=Gestor de finanzas personales",
        "--windows-company-name=Manuel Cabral",
        "--windows-file-version=0.0.0.1",
        "--windows-product-version=0.0.0.1",
        # data directories
        "--include-data-dir=dist=dist",
        "--include-data-file=backend/local.template.db=backend/local.template.db",
        # do not package local/runtime folders and source SQL schemas
        "--noinclude-data-files=backend/schemas/**",
        "--noinclude-data-files=logs/**",
        "--noinclude-data-files=exports/**",
        "--noinclude-data-files=backups/**",
        # modules
        "--include-module=webview",
        "--include-module=pythonnet",
        "--include-module=plyer",
        "--include-module=plyer.facades.notification",
        "--include-module=plyer.platforms.win.notification",
        "--include-module=plyer.platforms.win.libs.balloontip",
        # exclude testing frameworks
        "--nofollow-import-to=unittest",
        "--nofollow-import-to=unittest.mock",
        "--nofollow-import-to=doctest",
        "--nofollow-import-to=pytest",
        "--nofollow-import-to=test",
        # exclude webview platforms
        "--nofollow-import-to=webview.platforms.cocoa",
        "--nofollow-import-to=webview.platforms.gtk",
        "--nofollow-import-to=webview.platforms.qt",
        "--nofollow-import-to=webview.platforms.android",
        "--nofollow-import-to=webview.platforms.linux",
        # exclude GUI frameworks
        "--nofollow-import-to=tkinter",
        "--nofollow-import-to=_tkinter",
        "--nofollow-import-to=PyQt5",
        "--nofollow-import-to=PyQt6",
        "--nofollow-import-to=PySide2",
        "--nofollow-import-to=PySide6",
        "--nofollow-import-to=gi",
        # exclude build/documentation tools
        "--nofollow-import-to=pydoc",
        "--nofollow-import-to=distutils",
        "--nofollow-import-to=setuptools",
        # optimization flags
        "--remove-output",
        "--python-flag=no_docstrings",
        "--python-flag=no_asserts",
        "--msvc=latest",
        "main.py",
    ]

    logger.info("Building with Nuitka...")
    logger.info(" ".join(nuitka_args))

    try:
        subprocess.run(nuitka_args, check=True)
        logger.info("Build completed successfully!")
        logger.info("Output: dist_build/main.dist/")
    except subprocess.CalledProcessError as e:
        logger.error(f"Build failed with error code {e.returncode}")
        sys.exit(1)


if __name__ == "__main__":
    build()