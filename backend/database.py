"""Database connection and management module."""

import sqlite3
from pathlib import Path
from typing import Optional

from .logger import logger
from .constants import config


def _recreate_legacy_sessions_table(conn: sqlite3.Connection, schemas_dir: Path) -> None:
    """Recreate sessions table if legacy token column naming is detected."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'")
    if cursor.fetchone() is None:
        return

    cursor.execute("PRAGMA table_info(sessions)")
    columns = {row[1] for row in cursor.fetchall()}
    has_access_token = "access_token" in columns
    has_legacy_refresh_token = "refresh_token" in columns

    if has_access_token:
        return

    if has_legacy_refresh_token:
        logger.warning(
            "Legacy sessions schema detected. Recreating sessions table with access_token."
        )
        cursor.execute("DROP TABLE IF EXISTS sessions")
        sessions_schema = schemas_dir / "sessions.sql"
        with open(sessions_schema, "r", encoding="utf-8") as f:
            cursor.executescript(f.read())


def _ensure_categories_color_column(conn: sqlite3.Connection) -> None:
    """Ensure categories table contains the color column for older databases."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'categories'")
    if cursor.fetchone() is None:
        return

    cursor.execute("PRAGMA table_info(categories)")
    columns = {row[1] for row in cursor.fetchall()}
    if "color" in columns:
        return

    logger.warning("Categories schema without color detected. Adding color column.")
    cursor.execute(
        "ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#9CA3AF'"
    )


def _ensure_credits_paid_installments_column(conn: sqlite3.Connection) -> None:
    """Ensure credits table contains paid_installments for manual progress tracking."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'credits'")
    if cursor.fetchone() is None:
        return

    cursor.execute("PRAGMA table_info(credits)")
    columns = {row[1] for row in cursor.fetchall()}
    if "paid_installments" not in columns:
        logger.warning(
            "Credits schema without paid_installments detected. Adding paid_installments column."
        )
        cursor.execute(
            "ALTER TABLE credits ADD COLUMN paid_installments INTEGER NOT NULL DEFAULT 0"
        )

    cursor.execute(
        """
        UPDATE credits
        SET paid_installments = CASE
            WHEN paid_installments IS NULL THEN 0
            WHEN paid_installments < 0 THEN 0
            WHEN paid_installments > installments THEN installments
            ELSE paid_installments
        END
        """
    )


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
    schemas_dir = Path(__file__).parent / "schemas"

    close_after = False
    if conn is None:
        logger.debug("No database connection provided, creating a new one")
        conn = connect()
        close_after = False

    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = OFF;")

        _recreate_legacy_sessions_table(conn, schemas_dir)

        for schema_file in schema_files:
            schema_path = schemas_dir / schema_file
            if not schema_path.exists():
                logger.warning("Schema file not found: %s", schema_path)
                continue
            with open(schema_path, "r", encoding="utf-8") as f:
                sql_script = f.read()
                cursor.executescript(sql_script)
            logger.info("Loaded schema: %s", schema_file)

        _ensure_categories_color_column(conn)
        _ensure_credits_paid_installments_column(conn)

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
