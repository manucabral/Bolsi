"""User domain API methods."""

import hashlib
import secrets
import sqlite3
from typing import Optional

from ..logger import logger
from ..sessions import (
    create_session,
    delete_session,
    get_current_session,
    resolve_device_info,
    validate_session,
)
from ..helpers.api_response import JsonDict
from .base import DomainApi


def _hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash a password with a salt. Returns (hash, salt)."""
    if salt is None:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return pw_hash, salt


class UsersApi(DomainApi):
    """Handles user registration, login, and session state."""

    def __init__(self, conn: sqlite3.Connection):
        super().__init__(conn)
        self._current_access_token: Optional[str] = None

    def _user_exists(self, username: str) -> Optional[str]:
        """Return reason string if username already exists."""
        cur = self.conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cur.fetchone():
            return "El nombre de usuario ya está en uso"

        return None

    def register(
        self,
        username: str,
        email: str,
        password: str,
        device_info: Optional[str] = None,
    ) -> JsonDict:
        username = username.strip()
        _ = email

        if not username or not password:
            return self._error("Usuario y contraseña son obligatorios")

        if len(username) < 3:
            return self._error("El nombre de usuario debe tener al menos 3 caracteres")

        if len(password) < 6:
            return self._error("La contraseña debe tener al menos 6 caracteres")

        reason = self._user_exists(username)
        if reason:
            return self._error(reason)

        pw_hash, salt = _hash_password(password)
        password_hash = f"{salt}${pw_hash}"

        try:
            cur = self.conn.cursor()
            cur.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash),
            )
            self.conn.commit()
            user_id = cur.lastrowid
            logger.info("User registered: %s (id=%s)", username, user_id)

            session_device_info = resolve_device_info(device_info)
            token = create_session(
                self.conn,
                int(user_id),  # type: ignore[arg-type]
                device_info=session_device_info,
            )
            self._current_access_token = token

            return self._success(
                "Usuario registrado correctamente",
                data={
                    "user": {"id": user_id, "username": username},
                    "access_token": token,
                    "device_info": session_device_info,
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error registering user: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al registrar el usuario")

    def login(self, username: str, password: str) -> JsonDict:
        username = username.strip()

        if not username or not password:
            return self._error("Todos los campos son obligatorios")

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id, username, password_hash FROM users WHERE username = ?",
                (username,),
            )
            row = cur.fetchone()

            if row is None:
                return self._error("Usuario o contraseña incorrectos")

            stored_hash = row["password_hash"]
            salt, expected_hash = stored_hash.split("$", 1)
            computed_hash, _ = _hash_password(password, salt)

            if computed_hash != expected_hash:
                return self._error("Usuario o contraseña incorrectos")

            session_device_info = resolve_device_info()
            token = create_session(self.conn, int(row["id"]), device_info=session_device_info)
            self._current_access_token = token

            logger.info("User logged in: %s", username)
            return self._success(
                "Inicio de sesión correcto",
                data={
                    "user": {
                        "id": row["id"],
                        "username": row["username"],
                    },
                    "access_token": token,
                    "device_info": session_device_info,
                },
            )
        except sqlite3.Error as exc:
            logger.error("Login error: %s", exc)
            return self._error("Error interno al iniciar sesión")

    def logout(self, access_token: Optional[str] = None) -> JsonDict:
        tok = access_token or self._current_access_token
        if tok is None:
            return self._error("No hay sesión activa")

        deleted = delete_session(self.conn, tok)
        if deleted:
            self._current_access_token = None
            logger.info("User logged out")
            return self._success("Sesión cerrada correctamente")

        return self._error("Error al cerrar sesión")

    def get_current_user(self, access_token: Optional[str] = None) -> JsonDict:
        tok = access_token or self._current_access_token
        if tok is None:
            return self._error("No hay sesión activa")

        session = validate_session(self.conn, tok)
        if session is None:
            self._current_access_token = None
            return self._error("Sesión expirada o inválida")

        return self._success(
            "Sesión válida",
            data={
                "user": {
                    "id": session["user_id"],
                    "username": session["username"],
                },
                "access_token": tok,
                "device_info": session.get("device_info"),
            },
        )

    def current_session(self, device_info: Optional[str] = None) -> JsonDict:
        """Return current active session from database for the current device."""
        session = get_current_session(self.conn, device_info=device_info)
        if session is None:
            return self._error("No hay sesión activa en este dispositivo")
        return self._success(
            "Sesión actual encontrada",
            data={
                "session": {
                    "id": session["id"],
                    "user_id": session["user_id"],
                    "username": session["username"],
                    "access_token": session["access_token"],
                    "created_at": session["created_at"],
                    "last_used_at": session["last_used_at"],
                    "expires_at": session["expires_at"],
                    "device_info": session.get("device_info"),
                }
            },
        )
