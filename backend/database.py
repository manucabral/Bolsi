"""Database connection and management module."""

import sqlite3
import shutil
import sys
from pathlib import Path
from typing import Optional

from .logger import logger
from .constants import config


SCHEMA_FILES = [
    "user.sql",
    "category.sql",
    "credits.sql",
    "transactions.sql",
    "savings.sql",
    "bills.sql",
    "notes.sql",
    "sessions.sql",
    "notification_settings.sql",
]
REQUIRED_TABLES = [
    "users",
    "categories",
    "credits",
    "transactions",
    "savings_goals",
    "savings_entries",
    "bills",
    "bill_payments",
    "notes",
    "sessions",
    "notification_settings",
]


def _resolve_db_template_path() -> Optional[Path]:
    """Resolve SQLite template path across source and packaged runtime modes."""
    candidates: list[Path] = []

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass) / "backend" / "local.template.db")

    candidates.append(Path(sys.executable).resolve().parent / "backend" / "local.template.db")
    candidates.append(Path(__file__).resolve().parent / "local.template.db")

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate

    return None


def _resolve_schemas_dir() -> Optional[Path]:
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

    return None


def _copy_template_if_missing(db_path: Path) -> None:
    """Create the database file from template if it does not exist yet."""
    if db_path.exists():
        return

    template_path = _resolve_db_template_path()
    if template_path is None:
        logger.warning("Database template not found. A blank database file will be created.")
        return

    shutil.copy2(template_path, db_path)
    logger.info("Database created from template: %s", template_path)


def _get_missing_required_tables(conn: sqlite3.Connection) -> list[str]:
    """Return missing required table names."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    existing = {str(row[0]) for row in cursor.fetchall()}
    return [table for table in REQUIRED_TABLES if table not in existing]


def _initialize_from_schemas(conn: sqlite3.Connection) -> None:
    """Initialize missing database objects from schema SQL files."""
    schemas_dir = _resolve_schemas_dir()
    if schemas_dir is None:
        raise RuntimeError("No se encontraron schemas para inicializar la base de datos")

    cursor = conn.cursor()
    for schema_file in SCHEMA_FILES:
        schema_path = schemas_dir / schema_file
        if not schema_path.exists():
            logger.warning("Schema file not found: %s", schema_path)
            continue
        with open(schema_path, "r", encoding="utf-8") as f:
            cursor.executescript(f.read())
        logger.info("Loaded schema: %s", schema_file)


def _ensure_bills_payment_transaction_column(conn: sqlite3.Connection) -> None:
    """Ensure bills table has payment_transaction_id column for paid/unpaid toggle."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bills'")
    if cursor.fetchone() is None:
        return

    cursor.execute("PRAGMA table_info(bills)")
    columns = {str(row[1]) for row in cursor.fetchall()}
    if "payment_transaction_id" in columns:
        return

    logger.info("Applying schema update for bills.payment_transaction_id")
    cursor.execute("ALTER TABLE bills ADD COLUMN payment_transaction_id INTEGER")


def _ensure_bills_paid_amount_column(conn: sqlite3.Connection) -> None:
    """Ensure bills table has paid_amount column for partial payments support."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bills'")
    if cursor.fetchone() is None:
        return

    cursor.execute("PRAGMA table_info(bills)")
    columns = {str(row[1]) for row in cursor.fetchall()}
    if "paid_amount" not in columns:
        logger.info("Applying schema update for bills.paid_amount")
        cursor.execute("ALTER TABLE bills ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0")

    # Backfill old paid rows to keep historical state consistent after migration.
    cursor.execute(
        """
        UPDATE bills
        SET paid_amount = amount
        WHERE status = 'paid' AND COALESCE(paid_amount, 0) <= 0
        """
    )

    # Clamp any inconsistent data to valid range.
    cursor.execute(
        """
        UPDATE bills
        SET paid_amount =
            CASE
                WHEN COALESCE(paid_amount, 0) < 0 THEN 0
                WHEN COALESCE(paid_amount, 0) > amount THEN amount
                ELSE COALESCE(paid_amount, 0)
            END
        """
    )


def _ensure_bill_payments_table(conn: sqlite3.Connection) -> None:
    """Ensure bill_payments table exists for tracking one or many bill payments."""
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS bill_payments (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id       INTEGER NOT NULL,
            user_id       INTEGER NOT NULL,
            amount        REAL NOT NULL CHECK(amount > 0),
            payment_date  TEXT NOT NULL,
            transaction_id INTEGER,
            created_at    TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (transaction_id) REFERENCES transactions(id)
        )
        """
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_id ON bill_payments(bill_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON bill_payments(user_id)"
    )


def _ensure_savings_affects_balance_column(conn: sqlite3.Connection) -> None:
    """Ensure savings_goals table has affects_balance flag for balance impact behavior."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'savings_goals'"
    )
    if cursor.fetchone() is None:
        return

    cursor.execute("PRAGMA table_info(savings_goals)")
    columns = {str(row[1]) for row in cursor.fetchall()}
    if "affects_balance" in columns:
        return

    logger.info("Applying schema update for savings_goals.affects_balance")
    cursor.execute(
        "ALTER TABLE savings_goals ADD COLUMN affects_balance INTEGER NOT NULL DEFAULT 1"
    )


def connect(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Connect to the SQLite database."""
    path = Path(db_path) if db_path is not None else config.db_path
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        _copy_template_if_missing(path)
        connection = sqlite3.connect(str(path), check_same_thread=False)
        connection.row_factory = sqlite3.Row
        logger.debug("Connected to database at: %s", path)
        return connection
    except sqlite3.Error as exc:
        logger.error("Error connecting to db: %s", exc)
        raise


def init_database(conn: Optional[sqlite3.Connection] = None) -> sqlite3.Connection:
    """Initialize database and ensure required tables exist."""

    close_after = conn is None
    if conn is None:
        logger.debug("No database connection provided, creating a new one")
        conn = connect()

    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")

        missing_tables = _get_missing_required_tables(conn)
        if missing_tables:
            missing_tables_text = ", ".join(missing_tables)
            if missing_tables == ["bills"]:
                logger.info(
                    "Applying schema update for new table (%s).",
                    missing_tables_text,
                )
            else:
                logger.warning(
                    "Missing tables detected (%s). Running schema fallback for startup recovery.",
                    missing_tables_text,
                )
            _initialize_from_schemas(conn)
            cursor.execute("PRAGMA foreign_keys = ON;")

            remaining_missing_tables = _get_missing_required_tables(conn)
            if remaining_missing_tables:
                raise RuntimeError(
                    "Database initialization failed. Still missing tables after schema fallback: "
                    f"{', '.join(remaining_missing_tables)}"
                )

        _ensure_bills_payment_transaction_column(conn)
        _ensure_bills_paid_amount_column(conn)
        _ensure_bill_payments_table(conn)
        _ensure_savings_affects_balance_column(conn)

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
