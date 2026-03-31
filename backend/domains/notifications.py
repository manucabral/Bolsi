"""Notifications preferences and startup alerts domain API methods."""

import sqlite3
from calendar import monthrange
from datetime import date
from typing import Optional

from ..constants import config
from ..helpers.api_response import JsonDict
from ..logger import logger
from .base import DomainApi

try:
    from plyer import notification as plyer_notification  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - environment dependent
    plyer_notification = None


ALLOWED_DAYS_BEFORE = {1, 3, 7}


class NotificationsApi(DomainApi):
    """Handles notifications settings and startup checks."""

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
            logger.error("Error validating user for notifications: %s", exc)
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

    def _add_months(self, source_date: date, months: int) -> date:
        month_index = source_date.month - 1 + months
        year = source_date.year + month_index // 12
        month = month_index % 12 + 1
        day = min(source_date.day, monthrange(year, month)[1])
        return date(year, month, day)

    def _ensure_preferences_row(self, user_id: int) -> sqlite3.Row:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT
                user_id,
                bills_enabled,
                bills_days_before,
                credits_enabled,
                credits_days_before,
                summary_on_open_enabled,
                updated_at
            FROM notification_settings
            WHERE user_id = ?
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if row is not None:
            return row

        cur.execute(
            "INSERT INTO notification_settings (user_id) VALUES (?)",
            (user_id,),
        )
        self.conn.commit()

        cur.execute(
            """
            SELECT
                user_id,
                bills_enabled,
                bills_days_before,
                credits_enabled,
                credits_days_before,
                summary_on_open_enabled,
                updated_at
            FROM notification_settings
            WHERE user_id = ?
            """,
            (user_id,),
        )
        created_row = cur.fetchone()
        if created_row is None:
            raise sqlite3.Error("No se pudieron inicializar las preferencias")
        return created_row

    def _serialize_preferences(self, row: sqlite3.Row) -> JsonDict:
        return {
            "user_id": int(row["user_id"]),
            "bills_enabled": bool(row["bills_enabled"]),
            "bills_days_before": int(row["bills_days_before"]),
            "credits_enabled": bool(row["credits_enabled"]),
            "credits_days_before": int(row["credits_days_before"]),
            "summary_on_open_enabled": bool(row["summary_on_open_enabled"]),
            "updated_at": row["updated_at"],
        }

    def _format_ars_amount(self, amount: float) -> str:
        rounded = int(round(amount))
        return f"${rounded:,}".replace(",", ".")

    def _relative_due_text(self, days_until_due: int) -> str:
        if days_until_due <= 0:
            return "hoy"
        if days_until_due == 1:
            return "manana"
        return f"en {days_until_due} dias"

    def _refresh_overdue_statuses(self, user_id: int) -> None:
        today_iso = date.today().isoformat()
        cur = self.conn.cursor()
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

    def _fetch_active_credits(self, user_id: int) -> list[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT
                id,
                description,
                installments,
                paid_installments,
                installment_amount,
                start_date
            FROM credits
            WHERE user_id = ?
              AND paid_installments < installments
            ORDER BY id ASC
            """,
            (user_id,),
        )
        return list(cur.fetchall())

    def _collect_due_soon_bills(self, user_id: int, days_before: int) -> list[JsonDict]:
        today = date.today()
        until = self._add_months(today, 0)
        until = until + (date.resolution * days_before)

        cur = self.conn.cursor()
        cur.execute(
            """
                        SELECT id, name, (amount - COALESCE(paid_amount, 0)) AS amount, due_date
            FROM bills
            WHERE user_id = ?
              AND status = 'pending'
                            AND COALESCE(paid_amount, 0) < amount
              AND date(due_date) >= date(?)
              AND date(due_date) <= date(?)
            ORDER BY date(due_date) ASC, id ASC
            """,
            (user_id, today.isoformat(), until.isoformat()),
        )

        alerts: list[JsonDict] = []
        for row in cur.fetchall():
            due_value = self._parse_iso_date(str(row["due_date"]))
            if due_value is None:
                continue

            alerts.append(
                {
                    "id": int(row["id"]),
                    "name": str(row["name"]),
                    "amount": float(row["amount"]),
                    "due_date": str(row["due_date"]),
                    "days_until_due": (due_value - today).days,
                }
            )

        return alerts

    def _collect_due_soon_credit_installments(
        self,
        active_credits: list[sqlite3.Row],
        days_before: int,
    ) -> list[JsonDict]:
        today = date.today()
        alerts: list[JsonDict] = []

        for row in active_credits:
            start_date_raw = str(row["start_date"])
            start_date_value = self._parse_iso_date(start_date_raw)
            if start_date_value is None:
                continue

            paid_installments = int(row["paid_installments"])
            due_date_value = self._add_months(start_date_value, paid_installments)
            days_until_due = (due_date_value - today).days
            if days_until_due < 0 or days_until_due > days_before:
                continue

            total_installments = int(row["installments"])
            alerts.append(
                {
                    "id": int(row["id"]),
                    "description": str(row["description"]),
                    "installment_amount": float(row["installment_amount"]),
                    "due_date": due_date_value.isoformat(),
                    "days_until_due": days_until_due,
                    "installment_number": paid_installments + 1,
                    "total_installments": total_installments,
                }
            )

        alerts.sort(key=lambda item: (str(item["due_date"]), int(item["id"])))
        return alerts

    def _calculate_monthly_credit_due_amount(self, active_credits: list[sqlite3.Row]) -> float:
        today = date.today()
        total = 0.0

        for row in active_credits:
            start_date_raw = str(row["start_date"])
            start_date_value = self._parse_iso_date(start_date_raw)
            if start_date_value is None:
                continue

            paid_installments = int(row["paid_installments"])
            next_due = self._add_months(start_date_value, paid_installments)
            if next_due.year == today.year and next_due.month == today.month:
                total += float(row["installment_amount"])

        return total

    def _calculate_current_balance(self, user_id: int) -> float:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'income' THEN amount
                            ELSE -amount
                        END
                    ),
                    0
                ) AS balance
            FROM transactions
            WHERE user_id = ?
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if row is None:
            return 0.0
        return float(row["balance"])

    def _send_desktop_notification(self, title: str, message: str, timeout: int = 10) -> bool:
        backend = plyer_notification
        if backend is None:
            logger.info("Desktop notifications unavailable (plyer not installed)")
            return False

        notify = getattr(backend, "notify", None)
        if not callable(notify):
            logger.info("Desktop notifications unavailable (notify function missing)")
            return False

        try:
            notify(
                title=title,
                message=message,
                app_name=config.app_name,
                timeout=timeout,
            )
            return True
        except Exception as exc:  # pragma: no cover - environment dependent
            logger.error("Error sending desktop notification: %s", exc)
            return False

    def get_preferences(self, user_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        try:
            row = self._ensure_preferences_row(user_id)
            return self._success(
                "Preferencias de notificaciones obtenidas correctamente",
                data={"notifications": self._serialize_preferences(row)},
            )
        except sqlite3.Error as exc:
            logger.error("Error getting notifications settings: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al obtener preferencias de notificaciones")

    def update_preferences(
        self,
        user_id: int,
        bills_enabled: bool,
        bills_days_before: int,
        credits_enabled: bool,
        credits_days_before: int,
        summary_on_open_enabled: bool,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if bills_days_before not in ALLOWED_DAYS_BEFORE:
            return self._error("bills_days_before debe ser 1, 3 o 7")

        if credits_days_before not in ALLOWED_DAYS_BEFORE:
            return self._error("credits_days_before debe ser 1, 3 o 7")

        try:
            cur = self.conn.cursor()
            self._ensure_preferences_row(user_id)
            cur.execute(
                """
                UPDATE notification_settings
                SET bills_enabled = ?,
                    bills_days_before = ?,
                    credits_enabled = ?,
                    credits_days_before = ?,
                    summary_on_open_enabled = ?,
                    updated_at = datetime('now')
                WHERE user_id = ?
                """,
                (
                    1 if bills_enabled else 0,
                    bills_days_before,
                    1 if credits_enabled else 0,
                    credits_days_before,
                    1 if summary_on_open_enabled else 0,
                    user_id,
                ),
            )
            self.conn.commit()

            row = self._ensure_preferences_row(user_id)
            return self._success(
                "Preferencias de notificaciones actualizadas",
                data={"notifications": self._serialize_preferences(row)},
            )
        except sqlite3.Error as exc:
            logger.error("Error updating notifications settings: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al guardar preferencias de notificaciones")

    def run_startup_alerts(self, user_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        try:
            self._refresh_overdue_statuses(user_id)
            self.conn.commit()

            preferences_row = self._ensure_preferences_row(user_id)
            preferences = self._serialize_preferences(preferences_row)

            active_credits = self._fetch_active_credits(user_id)
            bill_alerts = (
                self._collect_due_soon_bills(user_id, int(preferences["bills_days_before"]))
                if bool(preferences["bills_enabled"])
                else []
            )
            credit_alerts = (
                self._collect_due_soon_credit_installments(
                    active_credits,
                    int(preferences["credits_days_before"]),
                )
                if bool(preferences["credits_enabled"])
                else []
            )

            today = date.today()
            year_text = str(today.year)
            month_text = f"{today.month:02d}"

            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT
                    COUNT(*) AS pending_bills_count,
                                        COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) AS pending_bills_amount
                FROM bills
                WHERE user_id = ?
                  AND status != 'paid'
                                    AND COALESCE(paid_amount, 0) < amount
                  AND strftime('%Y', due_date) = ?
                  AND strftime('%m', due_date) = ?
                """,
                (user_id, year_text, month_text),
            )
            bills_row = cur.fetchone()

            pending_bills_count = int(bills_row["pending_bills_count"]) if bills_row else 0
            pending_bills_amount = float(bills_row["pending_bills_amount"]) if bills_row else 0.0

            summary = {
                "month": today.month,
                "year": today.year,
                "pending_bills_count": pending_bills_count,
                "pending_bills_amount": pending_bills_amount,
                "monthly_credit_due_amount": self._calculate_monthly_credit_due_amount(active_credits),
                "current_balance": self._calculate_current_balance(user_id),
            }

            sent_count = 0

            for bill in bill_alerts[:3]:
                title = "Bolsi - Factura por vencer"
                message = (
                    f"{bill['name']} vence {self._relative_due_text(int(bill['days_until_due']))} "
                    f"| {self._format_ars_amount(float(bill['amount']))}"
                )
                if self._send_desktop_notification(title, message):
                    sent_count += 1

            for credit in credit_alerts[:3]:
                title = "Bolsi - Cuota por vencer"
                message = (
                    f"{credit['description']} cuota {credit['installment_number']}/{credit['total_installments']} "
                    f"vence {self._relative_due_text(int(credit['days_until_due']))} "
                    f"| {self._format_ars_amount(float(credit['installment_amount']))}"
                )
                if self._send_desktop_notification(title, message):
                    sent_count += 1

            return self._success(
                "Chequeo de inicio ejecutado",
                data={
                    "startup": {
                        "preferences": preferences,
                        "notifications": {
                            "bills": bill_alerts,
                            "credits": credit_alerts,
                            "sent_count": sent_count,
                            "provider_available": plyer_notification is not None,
                        },
                        "summary": summary,
                        "should_show_summary": bool(preferences["summary_on_open_enabled"]),
                    }
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error running startup alerts: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al ejecutar notificaciones de inicio")
