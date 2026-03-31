"""Transactions domain API methods."""

import sqlite3
from datetime import date

from ..logger import logger
from ..helpers.api_response import JsonDict
from .base import DomainApi


ALLOWED_TRANSACTION_TYPES = {"income", "expense"}


class TransactionsApi(DomainApi):
    """Handles transactions-related operations."""

    def _normalize_description(self, description: str) -> str:
        normalized = description.strip()
        if not normalized:
            return normalized
        return normalized[0].upper() + normalized[1:]

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
            logger.error("Error validating user for transactions: %s", exc)
            return self._error("Error interno al validar usuario")

    def _normalize_type(self, transaction_type: str) -> str:
        normalized = transaction_type.strip().lower()
        if normalized == "ingreso":
            return "income"
        if normalized == "gasto":
            return "expense"
        return normalized

    def _validate_type(self, transaction_type: str) -> JsonDict | None:
        normalized_type = self._normalize_type(transaction_type)
        if normalized_type not in ALLOWED_TRANSACTION_TYPES:
            return self._error("El tipo de transacción debe ser 'income' o 'expense'")
        return None

    def _validate_date(self, value: str) -> JsonDict | None:
        try:
            date.fromisoformat(value)
            return None
        except ValueError:
            return self._error("La fecha debe tener formato YYYY-MM-DD")

    def _validate_category(
        self,
        user_id: int,
        category_id: int | None,
        normalized_type: str,
    ) -> JsonDict | None:
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

            category_type = row["type"]
            if category_type is None:
                return self._error("Categoría inválida")

            category_type_normalized = str(category_type).strip().lower()
            if category_type_normalized == "gasto":
                category_type_normalized = "expense"
            elif category_type_normalized == "ingreso":
                category_type_normalized = "income"

            if category_type_normalized != normalized_type:
                return self._error(
                    "La categoría debe coincidir con el tipo de transacción"
                )

            return None
        except sqlite3.Error as exc:
            logger.error("Error validating category for transactions: %s", exc)
            return self._error("Error interno al validar categoría")

    def _validate_credit(self, user_id: int, credit_id: int | None) -> JsonDict | None:
        if credit_id is None:
            return None

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
            return None
        except sqlite3.Error as exc:
            logger.error("Error validating credit for transactions: %s", exc)
            return self._error("Error interno al validar crédito")

    def list_transactions(self, user_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT
                    t.id,
                    t.user_id,
                    t.amount,
                    t.type,
                    t.category_id,
                    t.description,
                    t.date,
                    t.credit_id,
                    c.name AS category_name,
                    c.color AS category_color
                FROM transactions t
                LEFT JOIN categories c ON c.id = t.category_id
                WHERE t.user_id = ?
                ORDER BY t.date DESC, t.id DESC
                """,
                (user_id,),
            )
            transactions = []
            for row in cur.fetchall():
                transactions.append(
                    {
                        "id": int(row["id"]),
                        "user_id": int(row["user_id"]),
                        "amount": float(row["amount"]),
                        "type": row["type"],
                        "category_id": row["category_id"],
                        "category_name": row["category_name"],
                        "category_color": row["category_color"],
                        "description": row["description"],
                        "date": row["date"],
                        "credit_id": row["credit_id"],
                    }
                )

            return self._success(
                "Transacciones obtenidas correctamente",
                data={"transactions": transactions},
            )
        except sqlite3.Error as exc:
            logger.error("Error listing transactions: %s", exc)
            return self._error("Error interno al obtener transacciones")

    def create_transaction(
        self,
        user_id: int,
        amount: float,
        transaction_type: str,
        category_id: int | None,
        description: str,
        date: str,
        credit_id: int | None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if amount <= 0:
            return self._error("El monto debe ser mayor a 0")

        type_error = self._validate_type(transaction_type)
        if type_error:
            return type_error
        normalized_type = self._normalize_type(transaction_type)

        date_error = self._validate_date(date)
        if date_error:
            return date_error

        category_error = self._validate_category(user_id, category_id, normalized_type)
        if category_error:
            return category_error

        credit_error = self._validate_credit(user_id, credit_id)
        if credit_error:
            return credit_error

        normalized_description = self._normalize_description(description)

        try:
            cur = self.conn.cursor()
            cur.execute(
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
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    amount,
                    normalized_type,
                    category_id,
                    normalized_description,
                    date,
                    credit_id,
                ),
            )

            if cur.lastrowid is None:
                self.conn.rollback()
                return self._error("No se pudo crear la transacción")

            transaction_id = int(cur.lastrowid)

            cur.execute(
                """
                SELECT c.name AS category_name, c.color AS category_color
                FROM categories c
                WHERE c.id = ?
                """,
                (category_id,),
            )
            category_row = cur.fetchone()

            self.conn.commit()
            return self._success(
                "Transacción creada correctamente",
                data={
                    "transaction": {
                        "id": transaction_id,
                        "user_id": user_id,
                        "amount": float(amount),
                        "type": normalized_type,
                        "category_id": category_id,
                        "category_name": category_row["category_name"] if category_row else None,
                        "category_color": category_row["category_color"] if category_row else None,
                        "description": normalized_description,
                        "date": date,
                        "credit_id": credit_id,
                    }
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error creating transaction: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al crear transacción")

    def update_transaction(
        self,
        user_id: int,
        transaction_id: int,
        amount: float,
        transaction_type: str,
        category_id: int | None,
        description: str,
        date: str,
        credit_id: int | None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if transaction_id <= 0:
            return self._error("El transaction_id debe ser mayor a 0")

        if amount <= 0:
            return self._error("El monto debe ser mayor a 0")

        type_error = self._validate_type(transaction_type)
        if type_error:
            return type_error
        normalized_type = self._normalize_type(transaction_type)

        date_error = self._validate_date(date)
        if date_error:
            return date_error

        category_error = self._validate_category(user_id, category_id, normalized_type)
        if category_error:
            return category_error

        credit_error = self._validate_credit(user_id, credit_id)
        if credit_error:
            return credit_error

        normalized_description = self._normalize_description(description)

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id FROM transactions WHERE id = ? AND user_id = ?",
                (transaction_id, user_id),
            )
            if cur.fetchone() is None:
                return self._error("Transacción no encontrada para este usuario")

            cur.execute(
                """
                UPDATE transactions
                SET amount = ?,
                    type = ?,
                    category_id = ?,
                    description = ?,
                    date = ?,
                    credit_id = ?
                WHERE id = ? AND user_id = ?
                """,
                (
                    amount,
                    normalized_type,
                    category_id,
                    normalized_description,
                    date,
                    credit_id,
                    transaction_id,
                    user_id,
                ),
            )

            cur.execute(
                """
                SELECT c.name AS category_name, c.color AS category_color
                FROM categories c
                WHERE c.id = ?
                """,
                (category_id,),
            )
            category_row = cur.fetchone()

            self.conn.commit()
            return self._success(
                "Transacción actualizada correctamente",
                data={
                    "transaction": {
                        "id": transaction_id,
                        "user_id": user_id,
                        "amount": float(amount),
                        "type": normalized_type,
                        "category_id": category_id,
                        "category_name": category_row["category_name"] if category_row else None,
                        "category_color": category_row["category_color"] if category_row else None,
                        "description": normalized_description,
                        "date": date,
                        "credit_id": credit_id,
                    }
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error updating transaction: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al actualizar transacción")

    def delete_transaction(self, user_id: int, transaction_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if transaction_id <= 0:
            return self._error("El transaction_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id FROM transactions WHERE id = ? AND user_id = ?",
                (transaction_id, user_id),
            )
            if cur.fetchone() is None:
                return self._error("Transacción no encontrada para este usuario")

            cur.execute(
                "DELETE FROM transactions WHERE id = ? AND user_id = ?",
                (transaction_id, user_id),
            )
            self.conn.commit()
            return self._success("Transacción eliminada correctamente")
        except sqlite3.Error as exc:
            logger.error("Error deleting transaction: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al eliminar transacción")
