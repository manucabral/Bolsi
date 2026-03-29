"""Categories domain API methods."""

import re
import sqlite3
from typing import Optional

from ..logger import logger
from ..helpers.api_response import JsonDict
from .base import DomainApi


ALLOWED_CATEGORY_TYPES = {"income", "expense"}
DEFAULT_CATEGORY_COLOR = "#9CA3AF"
HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class CategoriesApi(DomainApi):
    """Handles category-related operations."""

    def _normalize_type(self, category_type: str) -> str:
        return category_type.strip().lower()

    def _validate_type(self, category_type: str) -> Optional[JsonDict]:
        normalized_type = self._normalize_type(category_type)
        if normalized_type not in ALLOWED_CATEGORY_TYPES:
            return self._error("El tipo de categoría debe ser 'income' o 'expense'")
        return None

    def _validate_user(self, user_id: int) -> Optional[JsonDict]:
        if user_id <= 0:
            return self._error("El user_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if cur.fetchone() is None:
                return self._error("Usuario no encontrado")
            return None
        except sqlite3.Error as exc:
            logger.error("Error validating user for categories: %s", exc)
            return self._error("Error interno al validar usuario")

    def _normalize_color(self, color: Optional[str]) -> str:
        if color is None:
            return DEFAULT_CATEGORY_COLOR
        stripped = color.strip()
        return stripped or DEFAULT_CATEGORY_COLOR

    def _validate_color(self, color: str) -> Optional[JsonDict]:
        if not HEX_COLOR_PATTERN.match(color):
            return self._error("El color debe tener formato hexadecimal #RRGGBB")
        return None

    def list_categories(self, user_id: int) -> JsonDict:
        """Return all categories for a user."""
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT id, user_id, name, color, type
                FROM categories
                WHERE user_id = ?
                ORDER BY type ASC, name ASC
                """,
                (user_id,),
            )
            categories = [dict(row) for row in cur.fetchall()]
            return self._success(
                "Categorías obtenidas correctamente",
                data={"categories": categories},
            )
        except sqlite3.Error as exc:
            logger.error("Error listing categories: %s", exc)
            return self._error("Error interno al obtener categorías")

    def create_category(
        self,
        user_id: int,
        name: str,
        category_type: str,
        color: Optional[str] = None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        name = name.strip()
        if not name:
            return self._error("El nombre de categoría es obligatorio")

        type_error = self._validate_type(category_type)
        if type_error:
            return type_error
        normalized_type = self._normalize_type(category_type)
        normalized_color = self._normalize_color(color)
        color_error = self._validate_color(normalized_color)
        if color_error:
            return color_error

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT id
                FROM categories
                WHERE user_id = ?
                  AND lower(name) = lower(?)
                  AND type = ?
                """,
                (user_id, name, normalized_type),
            )
            if cur.fetchone() is not None:
                return self._error("La categoría ya existe para este usuario")

            cur.execute(
                "INSERT INTO categories (user_id, name, color, type) VALUES (?, ?, ?, ?)",
                (user_id, name, normalized_color, normalized_type),
            )
            self.conn.commit()
            category_id = cur.lastrowid

            return self._success(
                "Categoría creada correctamente",
                data={
                    "category": {
                        "id": category_id,
                        "user_id": user_id,
                        "name": name,
                        "color": normalized_color,
                        "type": normalized_type,
                    }
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error creating category: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al crear categoría")

    def update_category(
        self,
        user_id: int,
        category_id: int,
        name: str,
        category_type: str,
        color: Optional[str] = None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if category_id <= 0:
            return self._error("El category_id debe ser mayor a 0")

        name = name.strip()
        if not name:
            return self._error("El nombre de categoría es obligatorio")

        type_error = self._validate_type(category_type)
        if type_error:
            return type_error
        normalized_type = self._normalize_type(category_type)

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id, color FROM categories WHERE id = ? AND user_id = ?",
                (category_id, user_id),
            )
            row = cur.fetchone()
            if row is None:
                return self._error("Categoría no encontrada para este usuario")

            existing_color = row["color"] if row["color"] else DEFAULT_CATEGORY_COLOR
            normalized_color = self._normalize_color(color) if color is not None else existing_color
            color_error = self._validate_color(normalized_color)
            if color_error:
                return color_error

            cur.execute(
                """
                SELECT id
                FROM categories
                WHERE user_id = ?
                  AND lower(name) = lower(?)
                  AND type = ?
                  AND id <> ?
                """,
                (user_id, name, normalized_type, category_id),
            )
            if cur.fetchone() is not None:
                return self._error("Ya existe otra categoría con ese nombre y tipo")

            cur.execute(
                """
                UPDATE categories
                SET name = ?, color = ?, type = ?
                WHERE id = ? AND user_id = ?
                """,
                (name, normalized_color, normalized_type, category_id, user_id),
            )
            self.conn.commit()

            return self._success(
                "Categoría actualizada correctamente",
                data={
                    "category": {
                        "id": category_id,
                        "user_id": user_id,
                        "name": name,
                        "color": normalized_color,
                        "type": normalized_type,
                    }
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error updating category: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al actualizar categoría")

    def delete_category(self, user_id: int, category_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if category_id <= 0:
            return self._error("El category_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id FROM categories WHERE id = ? AND user_id = ?",
                (category_id, user_id),
            )
            if cur.fetchone() is None:
                return self._error("Categoría no encontrada para este usuario")

            cur.execute(
                "DELETE FROM categories WHERE id = ? AND user_id = ?",
                (category_id, user_id),
            )
            self.conn.commit()
            return self._success("Categoría eliminada correctamente")
        except sqlite3.IntegrityError:
            self.conn.rollback()
            return self._error("No se puede eliminar la categoría porque está en uso")
        except sqlite3.Error as exc:
            logger.error("Error deleting category: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al eliminar categoría")
