"""Bills (invoices/due payments) domain API methods."""

import sqlite3
from datetime import date
from typing import Optional

from ..helpers.api_response import JsonDict
from ..logger import logger
from .base import DomainApi


ALLOWED_BILL_STATUSES = {"pending", "paid", "overdue"}


class BillsApi(DomainApi):
    """Handles bills/invoices and due-date tracking."""

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
            logger.error("Error validating user for bills: %s", exc)
            return self._error("Error interno al validar usuario")

    def _parse_iso_date(self, value: str) -> Optional[date]:
        normalized = value.strip()
        if not normalized:
            return None

        candidates = [normalized]
        if "T" in normalized:
            candidates.append(normalized.split("T", 1)[0])
        if " " in normalized:
            candidates.append(normalized.split(" ", 1)[0])

        for candidate in candidates:
            try:
                return date.fromisoformat(candidate)
            except ValueError:
                continue

        return None

    def _validate_category(self, user_id: int, category_id: Optional[int]) -> JsonDict | None:
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
                return self._error("La categoría de la factura debe ser de tipo 'expense'")
            return None
        except sqlite3.Error as exc:
            logger.error("Error validating category for bills: %s", exc)
            return self._error("Error interno al validar categoría")

    def _refresh_overdue_statuses(self, user_id: int) -> None:
        """Keep pending/overdue statuses consistent with due_date."""
        cur = self.conn.cursor()
        today_iso = date.today().isoformat()

        cur.execute(
            """
            UPDATE bills
            SET status = 'overdue'
            WHERE user_id = ?
              AND status = 'pending'
                            AND COALESCE(paid_amount, 0) < amount
              AND date(due_date) < date(?)
            """,
            (user_id, today_iso),
        )

        cur.execute(
            """
            UPDATE bills
            SET status = 'pending'
            WHERE user_id = ?
              AND status = 'overdue'
              AND date(due_date) >= date(?)
              AND paid_at IS NULL
                            AND COALESCE(paid_amount, 0) < amount
            """,
            (user_id, today_iso),
        )

    def _serialize_bill(self, row: sqlite3.Row) -> JsonDict:
        due_date_raw = str(row["due_date"])
        today = date.today()
        due_date_value = self._parse_iso_date(due_date_raw)
        days_until_due: Optional[int] = None
        if due_date_value is not None:
            days_until_due = (due_date_value - today).days

        status = str(row["status"])
        total_amount = float(row["amount"])
        paid_amount = float(row["paid_amount"] or 0)
        if paid_amount < 0:
            paid_amount = 0
        if paid_amount > total_amount:
            paid_amount = total_amount
        remaining_amount = max(total_amount - paid_amount, 0.0)
        payment_progress = 1.0 if total_amount <= 0 else paid_amount / total_amount
        is_due_soon = (
            status == "pending"
            and days_until_due is not None
            and 0 <= days_until_due <= 3
        )

        return {
            "id": int(row["id"]),
            "user_id": int(row["user_id"]),
            "name": row["name"],
            "amount": total_amount,
            "paid_amount": paid_amount,
            "remaining_amount": remaining_amount,
            "payment_progress": payment_progress,
            "due_date": due_date_raw,
            "category_id": row["category_id"],
            "category_name": row["category_name"],
            "category_color": row["category_color"],
            "status": status,
            "notes": row["notes"] or "",
            "paid_at": row["paid_at"],
            "created_at": row["created_at"],
            "days_until_due": days_until_due,
            "is_due_soon": is_due_soon,
        }

    def _fetch_bill(self, user_id: int, bill_id: int) -> JsonDict | None:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT
                b.id,
                b.user_id,
                b.name,
                b.amount,
                b.paid_amount,
                b.due_date,
                b.category_id,
                b.status,
                b.notes,
                b.paid_at,
                b.created_at,
                c.name AS category_name,
                c.color AS category_color
            FROM bills b
            LEFT JOIN categories c ON c.id = b.category_id
            WHERE b.id = ? AND b.user_id = ?
            """,
            (bill_id, user_id),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return self._serialize_bill(row)

    def list_bills(self, user_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        try:
            cur = self.conn.cursor()
            self._refresh_overdue_statuses(user_id)
            self.conn.commit()

            cur.execute(
                """
                SELECT
                    b.id,
                    b.user_id,
                    b.name,
                    b.amount,
                    b.paid_amount,
                    b.due_date,
                    b.category_id,
                    b.status,
                    b.notes,
                    b.paid_at,
                    b.created_at,
                    c.name AS category_name,
                    c.color AS category_color
                FROM bills b
                LEFT JOIN categories c ON c.id = b.category_id
                WHERE b.user_id = ?
                ORDER BY date(b.due_date) ASC, b.id ASC
                """,
                (user_id,),
            )
            bills = [self._serialize_bill(row) for row in cur.fetchall()]

            return self._success(
                "Facturas obtenidas correctamente",
                data={"bills": bills},
            )
        except sqlite3.Error as exc:
            logger.error("Error listing bills: %s", exc)
            return self._error("Error interno al obtener facturas")

    def list_month_bills(
        self,
        user_id: int,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        today = date.today()
        selected_year = today.year if year is None else year
        selected_month = today.month if month is None else month

        if selected_year < 1900 or selected_year > 9999:
            return self._error("El year es inválido")

        if selected_month < 1 or selected_month > 12:
            return self._error("El month debe estar entre 1 y 12")

        try:
            cur = self.conn.cursor()
            self._refresh_overdue_statuses(user_id)
            self.conn.commit()

            month_str = f"{selected_month:02d}"
            year_str = str(selected_year)
            cur.execute(
                """
                SELECT
                    b.id,
                    b.user_id,
                    b.name,
                    b.amount,
                    b.paid_amount,
                    b.due_date,
                    b.category_id,
                    b.status,
                    b.notes,
                    b.paid_at,
                    b.created_at,
                    c.name AS category_name,
                    c.color AS category_color
                FROM bills b
                LEFT JOIN categories c ON c.id = b.category_id
                WHERE b.user_id = ?
                                    AND (
                                            b.status IN ('pending', 'overdue')
                                            OR (
                                                    b.status = 'paid'
                                                  AND strftime('%Y', COALESCE(b.paid_at, b.created_at, b.due_date)) = ?
                                                  AND strftime('%m', COALESCE(b.paid_at, b.created_at, b.due_date)) = ?
                                            )
                                    )
                ORDER BY date(b.due_date) ASC, b.id ASC
                """,
                (user_id, year_str, month_str),
            )
            bills = [self._serialize_bill(row) for row in cur.fetchall()]

            return self._success(
                "Facturas obtenidas correctamente",
                data={
                    "year": selected_year,
                    "month": selected_month,
                    "bills": bills,
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error listing monthly bills: %s", exc)
            return self._error("Error interno al obtener facturas del mes")

    def create_bill(
        self,
        user_id: int,
        name: str,
        amount: float,
        due_date: str,
        category_id: int | None,
        notes: str,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        normalized_name = name.strip()
        if not normalized_name:
            return self._error("El nombre de la factura es obligatorio")

        if amount <= 0:
            return self._error("El monto debe ser mayor a 0")

        if self._parse_iso_date(due_date) is None:
            return self._error("La due_date debe tener formato YYYY-MM-DD")

        due_date_value = self._parse_iso_date(due_date)
        initial_status = "overdue" if (due_date_value is not None and due_date_value < date.today()) else "pending"

        category_error = self._validate_category(user_id, category_id)
        if category_error:
            return category_error

        normalized_notes = notes.strip()

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                INSERT INTO bills (
                    user_id,
                    name,
                    amount,
                    due_date,
                    category_id,
                    status,
                    notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    normalized_name,
                    amount,
                    due_date,
                    category_id,
                    initial_status,
                    normalized_notes,
                ),
            )

            if cur.lastrowid is None:
                self.conn.rollback()
                return self._error("No se pudo crear la factura")

            bill_id = int(cur.lastrowid)
            bill = self._fetch_bill(user_id, bill_id)
            self.conn.commit()
            return self._success(
                "Factura creada correctamente",
                data={"bill": bill},
            )
        except sqlite3.Error as exc:
            logger.error("Error creating bill: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al crear factura")

    def update_bill(
        self,
        user_id: int,
        bill_id: int,
        name: str,
        amount: float,
        due_date: str,
        category_id: int | None,
        notes: str,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if bill_id <= 0:
            return self._error("El bill_id debe ser mayor a 0")

        normalized_name = name.strip()
        if not normalized_name:
            return self._error("El nombre de la factura es obligatorio")

        if amount <= 0:
            return self._error("El monto debe ser mayor a 0")

        if self._parse_iso_date(due_date) is None:
            return self._error("La due_date debe tener formato YYYY-MM-DD")

        category_error = self._validate_category(user_id, category_id)
        if category_error:
            return category_error

        normalized_notes = notes.strip()

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT id, status, paid_amount, paid_at, payment_transaction_id
                FROM bills
                WHERE id = ? AND user_id = ?
                """,
                (bill_id, user_id),
            )
            existing = cur.fetchone()
            if existing is None:
                return self._error("Factura no encontrada para este usuario")

            current_paid_amount = float(existing["paid_amount"] or 0)
            if amount + 1e-9 < current_paid_amount:
                return self._error(
                    "El nuevo monto no puede ser menor al total ya pagado en esta factura"
                )

            current_status = str(existing["status"])
            if current_status not in ALLOWED_BILL_STATUSES:
                current_status = "pending"

            is_fully_paid = current_paid_amount >= (amount - 1e-9)
            next_status = current_status
            next_paid_at = existing["paid_at"]
            next_payment_transaction_id = existing["payment_transaction_id"]

            if is_fully_paid:
                next_status = "paid"
                if next_paid_at is None:
                    next_paid_at = date.today().isoformat()
            else:
                due = self._parse_iso_date(due_date)
                if due is not None and due < date.today():
                    next_status = "overdue"
                else:
                    next_status = "pending"
                next_paid_at = None
                next_payment_transaction_id = None

            cur.execute(
                """
                UPDATE bills
                SET name = ?,
                    amount = ?,
                    due_date = ?,
                    category_id = ?,
                    notes = ?,
                    status = ?,
                    paid_at = ?,
                    payment_transaction_id = ?
                WHERE id = ? AND user_id = ?
                """,
                (
                    normalized_name,
                    amount,
                    due_date,
                    category_id,
                    normalized_notes,
                    next_status,
                    next_paid_at,
                    next_payment_transaction_id,
                    bill_id,
                    user_id,
                ),
            )

            bill = self._fetch_bill(user_id, bill_id)
            self.conn.commit()
            return self._success(
                "Factura actualizada correctamente",
                data={"bill": bill},
            )
        except sqlite3.Error as exc:
            logger.error("Error updating bill: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al actualizar factura")

    def mark_bill_paid(
        self,
        user_id: int,
        bill_id: int,
        paid_date: Optional[str] = None,
        paid_amount: Optional[float] = None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if bill_id <= 0:
            return self._error("El bill_id debe ser mayor a 0")

        paid_on = date.today().isoformat() if paid_date is None else paid_date.strip()
        if self._parse_iso_date(paid_on) is None:
            return self._error("La paid_date debe tener formato YYYY-MM-DD")

        if paid_amount is not None and paid_amount <= 0:
            return self._error("El paid_amount debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT id, name, amount, paid_amount, due_date, category_id, status
                FROM bills
                WHERE id = ? AND user_id = ?
                """,
                (bill_id, user_id),
            )
            bill_row = cur.fetchone()
            if bill_row is None:
                return self._error("Factura no encontrada para este usuario")

            bill_total = float(bill_row["amount"])
            current_paid = float(bill_row["paid_amount"] or 0)
            remaining = max(bill_total - current_paid, 0.0)

            if remaining <= 1e-9:
                return self._error("La factura ya está marcada como pagada")

            applied_amount = remaining if paid_amount is None else float(paid_amount)
            if applied_amount > remaining + 1e-9:
                return self._error("El pago no puede superar el saldo pendiente")

            tx_description = f"Pago factura: {bill_row['name']}"
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
                VALUES (?, ?, 'expense', ?, ?, ?, NULL)
                """,
                (
                    user_id,
                    applied_amount,
                    bill_row["category_id"],
                    tx_description,
                    paid_on,
                ),
            )
            if cur.lastrowid is None:
                self.conn.rollback()
                return self._error("No se pudo registrar la transacción asociada al pago")
            transaction_id = int(cur.lastrowid)

            cur.execute(
                """
                INSERT INTO bill_payments (
                    bill_id,
                    user_id,
                    amount,
                    payment_date,
                    transaction_id
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    bill_id,
                    user_id,
                    applied_amount,
                    paid_on,
                    transaction_id,
                ),
            )

            updated_paid_amount = min(current_paid + applied_amount, bill_total)
            is_fully_paid = updated_paid_amount >= (bill_total - 1e-9)
            if is_fully_paid:
                next_status = "paid"
                next_paid_at: Optional[str] = paid_on
                next_payment_transaction_id: Optional[int] = transaction_id
            else:
                due_date_value = self._parse_iso_date(str(bill_row["due_date"]))
                next_status = (
                    "overdue"
                    if due_date_value is not None and due_date_value < date.today()
                    else "pending"
                )
                next_paid_at = None
                next_payment_transaction_id = None

            cur.execute(
                """
                UPDATE bills
                SET paid_amount = ?,
                    status = ?,
                    paid_at = ?,
                    payment_transaction_id = ?
                WHERE id = ? AND user_id = ?
                """,
                (
                    updated_paid_amount,
                    next_status,
                    next_paid_at,
                    next_payment_transaction_id,
                    bill_id,
                    user_id,
                ),
            )

            bill = self._fetch_bill(user_id, bill_id)
            self.conn.commit()
            return self._success(
                "Factura pagada completamente" if is_fully_paid else "Pago parcial registrado",
                data={
                    "bill": bill,
                    "generated_transaction_id": transaction_id,
                    "applied_amount": applied_amount,
                    "remaining_amount": max(remaining - applied_amount, 0.0),
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error marking bill as paid: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al marcar factura como pagada")

    def mark_bill_unpaid(self, user_id: int, bill_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if bill_id <= 0:
            return self._error("El bill_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT id, name, amount, paid_amount, category_id, due_date, status, payment_transaction_id
                FROM bills
                WHERE id = ? AND user_id = ?
                """,
                (bill_id, user_id),
            )
            bill_row = cur.fetchone()
            if bill_row is None:
                return self._error("Factura no encontrada para este usuario")

            current_paid = float(bill_row["paid_amount"] or 0)
            if current_paid <= 1e-9:
                return self._error("La factura no tiene pagos registrados")

            due_date_value = self._parse_iso_date(str(bill_row["due_date"]))
            next_status = "pending"
            if due_date_value is not None and due_date_value < date.today():
                next_status = "overdue"

            cur.execute(
                """
                SELECT transaction_id
                FROM bill_payments
                WHERE bill_id = ? AND user_id = ?
                ORDER BY id DESC
                """,
                (bill_id, user_id),
            )
            payment_rows = cur.fetchall()
            transaction_ids = [
                int(row["transaction_id"])
                for row in payment_rows
                if row["transaction_id"] is not None
            ]

            cur.execute(
                """
                UPDATE bills
                SET status = ?,
                    paid_at = NULL,
                    payment_transaction_id = NULL,
                    paid_amount = 0
                WHERE id = ? AND user_id = ?
                """,
                (next_status, bill_id, user_id),
            )

            cur.execute(
                "DELETE FROM bill_payments WHERE bill_id = ? AND user_id = ?",
                (bill_id, user_id),
            )

            for transaction_id in transaction_ids:
                cur.execute(
                    "DELETE FROM transactions WHERE id = ? AND user_id = ?",
                    (transaction_id, user_id),
                )

            if not transaction_ids and bill_row["payment_transaction_id"] is not None:
                cur.execute(
                    "DELETE FROM transactions WHERE id = ? AND user_id = ?",
                    (int(bill_row["payment_transaction_id"]), user_id),
                )

            bill = self._fetch_bill(user_id, bill_id)
            self.conn.commit()
            return self._success(
                "Factura marcada como no pagada",
                data={"bill": bill},
            )
        except sqlite3.Error as exc:
            logger.error("Error marking bill as unpaid: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al marcar factura como no pagada")

    def delete_bill(self, user_id: int, bill_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if bill_id <= 0:
            return self._error("El bill_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                "SELECT id, payment_transaction_id FROM bills WHERE id = ? AND user_id = ?",
                (bill_id, user_id),
            )
            bill_row = cur.fetchone()
            if bill_row is None:
                return self._error("Factura no encontrada para este usuario")

            cur.execute(
                """
                SELECT transaction_id
                FROM bill_payments
                WHERE bill_id = ? AND user_id = ?
                """,
                (bill_id, user_id),
            )
            transaction_ids = [
                int(row["transaction_id"])
                for row in cur.fetchall()
                if row["transaction_id"] is not None
            ]

            legacy_tx_id = bill_row["payment_transaction_id"]
            if legacy_tx_id is not None:
                transaction_ids.append(int(legacy_tx_id))

            cur.execute(
                "DELETE FROM bills WHERE id = ? AND user_id = ?",
                (bill_id, user_id),
            )

            for transaction_id in set(transaction_ids):
                cur.execute(
                    "DELETE FROM transactions WHERE id = ? AND user_id = ?",
                    (transaction_id, user_id),
                )

            self.conn.commit()
            return self._success("Factura eliminada correctamente")
        except sqlite3.Error as exc:
            logger.error("Error deleting bill: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al eliminar factura")
