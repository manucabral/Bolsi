"""Database connection and management module."""

import sqlite3
from pathlib import Path
from typing import Optional

from .logger import logger
from .constants import config


def connect(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Connect to the SQLite database."""
    path = db_path or str(config.db_path)
    try:
        connection = sqlite3.connect(path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        logger.debug("Connected to database at: %s", path)
        return connection
    except sqlite3.Error as exc:
        logger.error("Error connecting to db: %s", exc)
        raise


def init_database(conn: Optional[sqlite3.Connection] = None) -> sqlite3.Connection:
    """Initialize the database by loading all schema files. Returns the connection."""

    schema_files = ["user.sql", "category.sql", "expense.sql"]
    schemas_dir = Path(__file__).parent / "schemas"

    close_after = False
    if conn is None:
        logger.debug("No database connection provided, creating a new one")
        conn = connect()
        close_after = False

    try:
        cursor = conn.cursor()
        for schema_file in schema_files:
            schema_path = schemas_dir / schema_file
            if not schema_path.exists():
                logger.warning("Schema file not found: %s", schema_path)
                continue
            with open(schema_path, "r", encoding="utf-8") as f:
                sql_script = f.read()
                cursor.executescript(sql_script)
            logger.info("Loaded schema: %s", schema_file)
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
