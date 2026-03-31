"""Credits domain API methods."""

import sqlite3
from calendar import monthrange
from datetime import date
from typing import Optional

from ..logger import logger
from ..helpers.api_response import JsonDict
from .base import DomainApi


class CreditsApi(DomainApi):
    """Handles credits-related operations."""

    def _normalize_description(self, description: str) -> str:
        trimmed = description.strip()
        if not trimmed:
            return ""
        return f"{trimmed[0].upper()}{trimmed[1:]}"

    def _normalize_paid_installments(
        self,
        paid_installments: int,
        installments: int,
    ) -> int:
        return min(max(paid_installments, 0), installments)

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
            logger.error("Error validating user for credits: %s", exc)
            return self._error("Error interno al validar usuario")

    def _parse_iso_date(self, value: str) -> Optional[date]:
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    def _add_months(self, source_date: date, months: int) -> date:
        month_index = source_date.month - 1 + months
        year = source_date.year + month_index // 12
        month = month_index % 12 + 1
        day = min(source_date.day, monthrange(year, month)[1])
        return date(year, month, day)

    def _validate_category(self, user_id: int, category_id: Optional[int]) -> Optional[JsonDict]:
        if category_id is None:
            return None

        if category_id <= 0:
            return self._error("El category_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id, type FROM categories WHERE id = ? AND user_id = ?",
                (category_id, user_id),
            )
            row = cur.fetchone()
            if row is None:
                return self._error("Categoría no encontrada para este usuario")
            if row["type"] != "expense":
                return self._error("La categoría del crédito debe ser de tipo 'expense'")
            return None
        except sqlite3.Error as exc:
            logger.error("Error validating category for credits: %s", exc)
            return self._error("Error interno al validar categoría")

    def _build_installment_rows(
        self,
        user_id: int,
        credit_id: int,
        description: str,
        installments: int,
        installment_amount: float,
        start_date: str,
        category_id: Optional[int],
    ) -> list[tuple[int, float, Optional[int], str, str, int]]:
        first_due_date = self._parse_iso_date(start_date)
        if first_due_date is None:
            return []

        rows: list[tuple[int, float, Optional[int], str, str, int]] = []
        for idx in range(installments):
            due_date = self._add_months(first_due_date, idx).isoformat()
            installment_label = f"{description} - cuota {idx + 1}/{installments}"
            rows.append(
                (
                    user_id,
                    installment_amount,
                    category_id,
                    installment_label,
                    due_date,
                    credit_id,
                )
            )
        return rows

    def list_credits(self, user_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT
                    c.id,
                    c.user_id,
                    c.description,
                    c.total_amount,
                    c.installments,
                    c.installment_amount,
                    c.paid_installments,
                    c.start_date,
                    c.category_id,
                    c.created_at,
                    cat.name AS category_name,
                    cat.color AS category_color
                FROM credits c
                LEFT JOIN categories cat ON cat.id = c.category_id
                WHERE c.user_id = ?
                ORDER BY c.created_at DESC, c.id DESC
                """,
                (user_id,),
            )

            credits: list[JsonDict] = []
            for row in cur.fetchall():
                credit_id = int(row["id"])
                installments = int(row["installments"])
                paid_installments = self._normalize_paid_installments(
                    int(row["paid_installments"]),
                    installments,
                )
                credits.append(
                    {
                        "id": credit_id,
                        "user_id": int(row["user_id"]),
                        "description": row["description"],
                        "total_amount": float(row["total_amount"]),
                        "installments": installments,
                        "installment_amount": float(row["installment_amount"]),
                        "start_date": row["start_date"],
                        "category_id": row["category_id"],
                        "category_name": row["category_name"],
                        "category_color": row["category_color"],
                        "created_at": row["created_at"],
                        "paid_installments": paid_installments,
                    }
                )

            return self._success(
                "Créditos obtenidos correctamente",
                data={"credits": credits},
            )
        except sqlite3.Error as exc:
            logger.error("Error listing credits: %s", exc)
            return self._error("Error interno al obtener créditos")

    def create_credit(
        self,
        user_id: int,
        description: str,
        total_amount: float,
        installments: int,
        installment_amount: float,
        start_date: str,
        category_id: int | None,
        paid_installments: int | None = None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        description = self._normalize_description(description)
        if not description:
            return self._error("La descripción del crédito es obligatoria")

        if total_amount <= 0:
            return self._error("El total_amount debe ser mayor a 0")

        if installments <= 0:
            return self._error("La cantidad de cuotas debe ser mayor a 0")

        if installment_amount <= 0:
            return self._error("El installment_amount debe ser mayor a 0")

        if self._parse_iso_date(start_date) is None:
            return self._error("La start_date debe tener formato YYYY-MM-DD")

        if paid_installments is not None and paid_installments < 0:
            return self._error("Las cuotas pagadas no pueden ser negativas")

        category_error = self._validate_category(user_id, category_id)
        if category_error:
            return category_error

        normalized_paid_installments = self._normalize_paid_installments(
            paid_installments if paid_installments is not None else 0,
            installments,
        )

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                INSERT INTO credits (
                    user_id,
                    description,
                    total_amount,
                    installments,
                    installment_amount,
                    paid_installments,
                    start_date,
                    category_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    description,
                    total_amount,
                    installments,
                    installment_amount,
                    normalized_paid_installments,
                    start_date,
                    category_id,
                ),
            )
            if cur.lastrowid is None:
                self.conn.rollback()
                return self._error("No se pudo crear el crédito")
            credit_id = int(cur.lastrowid)

            installment_rows = self._build_installment_rows(
                user_id,
                credit_id,
                description,
                installments,
                installment_amount,
                start_date,
                category_id,
            )
            cur.executemany(
                """
                INSERT INTO transactions (
                    user_id,
                    amount,
                    type,
                    category_id,
                    description,
                    date,
                    credit_id
                )
                VALUES (?, ?, 'expense', ?, ?, ?, ?)
                """,
                installment_rows,
            )

            self.conn.commit()
            return self._success(
                "Crédito creado correctamente",
                data={
                    "credit": {
                        "id": credit_id,
                        "user_id": user_id,
                        "description": description,
                        "total_amount": float(total_amount),
                        "installments": int(installments),
                        "installment_amount": float(installment_amount),
                        "start_date": start_date,
                        "category_id": category_id,
                        "paid_installments": normalized_paid_installments,
                    },
                    "generated_installments": len(installment_rows),
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error creating credit: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al crear crédito")

    def update_credit(
        self,
        user_id: int,
        credit_id: int,
        description: str,
        total_amount: float,
        installments: int,
        installment_amount: float,
        start_date: str,
        category_id: int | None,
        paid_installments: int | None = None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if credit_id <= 0:
            return self._error("El credit_id debe ser mayor a 0")

        description = self._normalize_description(description)
        if not description:
            return self._error("La descripción del crédito es obligatoria")

        if total_amount <= 0:
            return self._error("El total_amount debe ser mayor a 0")

        if installments <= 0:
            return self._error("La cantidad de cuotas debe ser mayor a 0")

        if installment_amount <= 0:
            return self._error("El installment_amount debe ser mayor a 0")

        if self._parse_iso_date(start_date) is None:
            return self._error("La start_date debe tener formato YYYY-MM-DD")

        if paid_installments is not None and paid_installments < 0:
            return self._error("Las cuotas pagadas no pueden ser negativas")

        category_error = self._validate_category(user_id, category_id)
        if category_error:
            return category_error

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id, paid_installments FROM credits WHERE id = ? AND user_id = ?",
                (credit_id, user_id),
            )
            row = cur.fetchone()
            if row is None:
                return self._error("Crédito no encontrado para este usuario")

            existing_paid_installments = int(row["paid_installments"])
            normalized_paid_installments = self._normalize_paid_installments(
                paid_installments
                if paid_installments is not None
                else existing_paid_installments,
                installments,
            )

            cur.execute(
                """
                UPDATE credits
                SET description = ?,
                    total_amount = ?,
                    installments = ?,
                    installment_amount = ?,
                    paid_installments = ?,
                    start_date = ?,
                    category_id = ?
                WHERE id = ? AND user_id = ?
                """,
                (
                    description,
                    total_amount,
                    installments,
                    installment_amount,
                    normalized_paid_installments,
                    start_date,
                    category_id,
                    credit_id,
                    user_id,
                ),
            )

            cur.execute(
                "DELETE FROM transactions WHERE user_id = ? AND credit_id = ?",
                (user_id, credit_id),
            )

            installment_rows = self._build_installment_rows(
                user_id,
                credit_id,
                description,
                installments,
                installment_amount,
                start_date,
                category_id,
            )
            cur.executemany(
                """
                INSERT INTO transactions (
                    user_id,
                    amount,
                    type,
                    category_id,
                    description,
                    date,
                    credit_id
                )
                VALUES (?, ?, 'expense', ?, ?, ?, ?)
                """,
                installment_rows,
            )

            self.conn.commit()
            return self._success(
                "Crédito actualizado correctamente",
                data={
                    "credit": {
                        "id": credit_id,
                        "user_id": user_id,
                        "description": description,
                        "total_amount": float(total_amount),
                        "installments": int(installments),
                        "installment_amount": float(installment_amount),
                        "start_date": start_date,
                        "category_id": category_id,
                        "paid_installments": normalized_paid_installments,
                    },
                    "generated_installments": len(installment_rows),
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error updating credit: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al actualizar crédito")

    def delete_credit(self, user_id: int, credit_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if credit_id <= 0:
            return self._error("El credit_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id FROM credits WHERE id = ? AND user_id = ?",
                (credit_id, user_id),
            )
            if cur.fetchone() is None:
                return self._error("Crédito no encontrado para este usuario")

            cur.execute(
                "DELETE FROM transactions WHERE user_id = ? AND credit_id = ?",
                (user_id, credit_id),
            )
            cur.execute(
                "DELETE FROM credits WHERE id = ? AND user_id = ?",
                (credit_id, user_id),
            )
            self.conn.commit()
            return self._success("Crédito eliminado correctamente")
        except sqlite3.Error as exc:
            logger.error("Error deleting credit: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al eliminar crédito")
