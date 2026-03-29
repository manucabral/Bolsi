"""Notes domain API methods."""

import sqlite3

from ..logger import logger
from ..helpers.api_response import JsonDict
from .base import DomainApi


class NotesApi(DomainApi):
    """Handles notes-related operations."""

    def _validate_user(self, user_id: int) -> JsonDict | None:
        if user_id <= 0:
            return self._error("El user_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if cur.fetchone() is None:
                return self._error("Usuario no encontrado")
            return None
        except sqlite3.Error as exc:
            logger.error("Error validating user for notes: %s", exc)
            return self._error("Error interno al validar usuario")

    def _validate_title(self, title: str) -> JsonDict | None:
        if not title.strip():
            return self._error("El título de la nota es obligatorio")
        return None

    def _fetch_note(self, note_id: int, user_id: int) -> JsonDict | None:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT id, user_id, title, content, created_at, updated_at
            FROM notes
            WHERE id = ? AND user_id = ?
            """,
            (note_id, user_id),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return {
            "id": int(row["id"]),
            "user_id": int(row["user_id"]),
            "title": row["title"],
            "content": row["content"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def list_notes(self, user_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT id, user_id, title, content, created_at, updated_at
                FROM notes
                WHERE user_id = ?
                ORDER BY datetime(updated_at) DESC, id DESC
                """,
                (user_id,),
            )
            notes = [
                {
                    "id": int(row["id"]),
                    "user_id": int(row["user_id"]),
                    "title": row["title"],
                    "content": row["content"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
                for row in cur.fetchall()
            ]
            return self._success("Notas obtenidas correctamente", data={"notes": notes})
        except sqlite3.Error as exc:
            logger.error("Error listing notes: %s", exc)
            return self._error("Error interno al obtener notas")

    def create_note(self, user_id: int, title: str, content: str) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        title_error = self._validate_title(title)
        if title_error:
            return title_error

        normalized_title = title.strip()
        normalized_content = content.strip()

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                INSERT INTO notes (user_id, title, content)
                VALUES (?, ?, ?)
                """,
                (user_id, normalized_title, normalized_content),
            )

            if cur.lastrowid is None:
                self.conn.rollback()
                return self._error("No se pudo crear la nota")

            note_id = int(cur.lastrowid)
            note = self._fetch_note(note_id, user_id)
            self.conn.commit()

            return self._success("Nota creada correctamente", data={"note": note})
        except sqlite3.Error as exc:
            logger.error("Error creating note: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al crear nota")

    def update_note(self, user_id: int, note_id: int, title: str, content: str) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if note_id <= 0:
            return self._error("El note_id debe ser mayor a 0")

        title_error = self._validate_title(title)
        if title_error:
            return title_error

        normalized_title = title.strip()
        normalized_content = content.strip()

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id FROM notes WHERE id = ? AND user_id = ?",
                (note_id, user_id),
            )
            if cur.fetchone() is None:
                return self._error("Nota no encontrada para este usuario")

            cur.execute(
                """
                UPDATE notes
                SET title = ?,
                    content = ?,
                    updated_at = datetime('now')
                WHERE id = ? AND user_id = ?
                """,
                (normalized_title, normalized_content, note_id, user_id),
            )

            note = self._fetch_note(note_id, user_id)
            self.conn.commit()
            return self._success("Nota actualizada correctamente", data={"note": note})
        except sqlite3.Error as exc:
            logger.error("Error updating note: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al actualizar nota")

    def delete_note(self, user_id: int, note_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if note_id <= 0:
            return self._error("El note_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id FROM notes WHERE id = ? AND user_id = ?",
                (note_id, user_id),
            )
            if cur.fetchone() is None:
                return self._error("Nota no encontrada para este usuario")

            cur.execute(
                "DELETE FROM notes WHERE id = ? AND user_id = ?",
                (note_id, user_id),
            )
            self.conn.commit()
            return self._success("Nota eliminada correctamente")
        except sqlite3.Error as exc:
            logger.error("Error deleting note: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al eliminar nota")
