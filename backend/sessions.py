"""Authentication and session management module."""

import platform
import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from .constants import SESSION_DURATION_SECONDS
from .logger import logger


def resolve_device_info(device_info: Optional[str] = None) -> str:
    """Return client-provided device info or infer it from current host OS."""
    if device_info and device_info.strip():
        return device_info.strip()

    uname = platform.uname()
    host = uname.node or platform.node() or "unknown-host"
    system = uname.system or platform.system() or "unknown-os"
    release = uname.release or "unknown-release"
    machine = uname.machine or "unknown-arch"
    version = uname.version or "unknown-version"

    return f"{host} | {system} {release} ({version}) | {machine}"


def create_session(conn: sqlite3.Connection, user_id: int, device_info: Optional[str] = None) -> str:
    """Create a new session for a user and return raw access token."""
    access_token = secrets.token_urlsafe(32)
    resolved_device_info = resolve_device_info(device_info)
    expires_at = (datetime.utcnow() + timedelta(seconds=SESSION_DURATION_SECONDS)).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO sessions (user_id, access_token, expires_at, device_info)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, access_token, expires_at, resolved_device_info),
        )
        conn.commit()
        logger.info("Session created for user: %s (%s)", user_id, resolved_device_info)
        return access_token
    except sqlite3.Error as exc:
        logger.error("Error creating session: %s", exc)
        conn.rollback()
        raise


def validate_session(conn: sqlite3.Connection, access_token: str) -> Optional[Dict[str, Any]]:
    """Validate an access token and return session + user info if valid."""
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.id, s.user_id, u.username, s.expires_at, s.device_info
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.access_token = ?
              AND s.revoked_at IS NULL
              AND s.expires_at > datetime('now')
            """,
            (access_token,),
        )
        result = cursor.fetchone()

        if result is None:
            logger.warning("Invalid or expired session token")
            return None

        cursor.execute(
            """
            UPDATE sessions
            SET last_used_at = datetime('now')
            WHERE id = ?
            """,
            (result["id"],),
        )
        conn.commit()

        logger.debug("Session validated for user: %s", result["user_id"])
        return dict(result)
    except sqlite3.Error as exc:
        logger.error("Error validating session: %s", exc)
        return None


def get_current_session(
    conn: sqlite3.Connection,
    device_info: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Return the latest active session for the current device, if any."""
    resolved_device_info = resolve_device_info(device_info)

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                s.id,
                s.user_id,
                u.username,
                s.access_token,
                s.created_at,
                s.last_used_at,
                s.expires_at,
                s.device_info
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.device_info = ?
              AND s.revoked_at IS NULL
              AND s.expires_at > datetime('now')
            ORDER BY s.last_used_at DESC, s.id DESC
            LIMIT 1
            """,
            (resolved_device_info,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        logger.info("Current session found for device: %s", resolved_device_info)
        logger.info("Details: user_id=%s, username=%s, expires_at=%s", row["user_id"], row["username"], row["expires_at"])
        return dict(row)
    except sqlite3.Error as exc:
        logger.error("Error getting current session: %s", exc)
        return None


def delete_session(conn: sqlite3.Connection, access_token: str) -> bool:
    """Delete an existing session by access token."""
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            DELETE FROM sessions
            WHERE access_token = ?
            """,
            (access_token,),
        )
        conn.commit()

        if cursor.rowcount > 0:
            logger.info("Session deleted")
            return True

        logger.warning("Session token not found")
        return False
    except sqlite3.Error as exc:
        logger.error("Error deleting session: %s", exc)
        return False


def cleanup_expired_sessions(conn: sqlite3.Connection) -> int:
    """Remove expired/revoked sessions. Returns number of deleted rows."""
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            DELETE FROM sessions
            WHERE expires_at <= datetime('now')
               OR revoked_at IS NOT NULL
            """
        )
        deleted = cursor.rowcount
        conn.commit()
        logger.info("Cleaned up %s expired/revoked sessions", deleted)
        return deleted
    except sqlite3.Error as exc:
        logger.error("Error cleaning sessions: %s", exc)
        return 0
