"""Database connection and management module."""

import sqlite3
import sys
from pathlib import Path
from typing import Optional

from .logger import logger
from .constants import config


def _resolve_schemas_dir() -> Path:
    """Resolve schemas directory across source and packaged runtime modes."""
    candidates: list[Path] = []

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass) / "backend" / "schemas")

    candidates.append(Path(sys.executable).resolve().parent / "backend" / "schemas")
    candidates.append(Path(__file__).resolve().parent / "schemas")
    candidates.append(Path(__file__).resolve().parent.parent / "backend" / "schemas")

    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate

    logger.warning("Schemas directory not found. Using fallback path: %s", candidates[0])
    return candidates[0]


def connect(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Connect to the SQLite database."""
    path = Path(db_path) if db_path is not None else config.db_path
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(path), check_same_thread=False)
        connection.row_factory = sqlite3.Row
        logger.debug("Connected to database at: %s", path)
        return connection
    except sqlite3.Error as exc:
        logger.error("Error connecting to db: %s", exc)
        raise


def init_database(conn: Optional[sqlite3.Connection] = None) -> sqlite3.Connection:
    """Initialize the database by loading all schema files. Returns the connection."""

    schema_files = [
        "user.sql",
        "category.sql",
        "credits.sql",
        "transactions.sql",
        "notes.sql",
        "sessions.sql",
    ]       
    schemas_dir = _resolve_schemas_dir()
    logger.info("Using schemas from: %s", schemas_dir)
    close_after = False
    if conn is None:
        logger.debug("No database connection provided, creating a new one")
        conn = connect()
        close_after = False

    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = OFF;")

        for schema_file in schema_files:
            schema_path = schemas_dir / schema_file
            if not schema_path.exists():
                logger.warning("Schema file not found: %s", schema_path)
                continue
            with open(schema_path, "r", encoding="utf-8") as f:
                sql_script = f.read()
                cursor.executescript(sql_script)
            logger.info("Loaded schema: %s", schema_file)

        cursor.execute("PRAGMA foreign_keys = ON;")
        conn.commit()
        logger.info("Database initialization complete")
        return conn
    except sqlite3.Error as exc:
        logger.error("Error initializing database: %s", exc)
        conn.rollback()
        if close_after:
            conn.close()
        raise
    except Exception as exc:
        logger.error("Unexpected error during database initialization: %s", exc)
        conn.rollback()
        if close_after:
            conn.close()
        raise
