"""Savings goals and entries domain API methods."""

import sqlite3
from datetime import date
from typing import Optional

from ..helpers.api_response import JsonDict
from ..logger import logger
from .base import DomainApi


class SavingsApi(DomainApi):
    """Handles savings goals and savings contributions."""

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
            logger.error("Error validating user for savings: %s", exc)
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

    def _serialize_goal(self, row: sqlite3.Row) -> JsonDict:
        target = float(row["target"])
        current = float(row["current"])
        if current < 0:
            current = 0.0

        progress = 0.0
        if target > 0:
            progress = min(max(current / target, 0.0), 1.0)

        return {
            "id": int(row["id"]),
            "user_id": int(row["user_id"]),
            "name": row["name"],
            "target": target,
            "current": current,
            "remaining": max(target - current, 0.0),
            "progress": progress,
            "affects_balance": bool(row["affects_balance"]),
            "deadline": row["deadline"],
            "color": row["color"],
            "created_at": row["created_at"],
        }

    def _fetch_goal(self, user_id: int, goal_id: int) -> JsonDict | None:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT
                id,
                user_id,
                name,
                target,
                current,
                affects_balance,
                deadline,
                color,
                created_at
            FROM savings_goals
            WHERE id = ? AND user_id = ?
            """,
            (goal_id, user_id),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return self._serialize_goal(row)

    def list_goals(self, user_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT
                    id,
                    user_id,
                    name,
                    target,
                    current,
                    affects_balance,
                    deadline,
                    color,
                    created_at
                FROM savings_goals
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                (user_id,),
            )
            goals = [self._serialize_goal(row) for row in cur.fetchall()]
            return self._success("Metas obtenidas correctamente", data={"goals": goals})
        except sqlite3.Error as exc:
            logger.error("Error listing savings goals: %s", exc)
            return self._error("Error interno al obtener metas")

    def create_goal(
        self,
        user_id: int,
        name: str,
        target: float,
        deadline: Optional[str] = None,
        color: Optional[str] = None,
        affects_balance: bool = True,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        normalized_name = name.strip()
        if not normalized_name:
            return self._error("El nombre de la meta es obligatorio")

        if target <= 0:
            return self._error("El objetivo debe ser mayor a 0")

        normalized_deadline: Optional[str] = None
        if deadline is not None and deadline.strip():
            parsed_deadline = self._parse_iso_date(deadline)
            if parsed_deadline is None:
                return self._error("La fecha límite debe tener formato YYYY-MM-DD")
            normalized_deadline = parsed_deadline.isoformat()

        normalized_color: Optional[str] = None
        if color is not None and color.strip():
            normalized_color = color.strip()

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                INSERT INTO savings_goals (
                    user_id,
                    name,
                    target,
                    deadline,
                    color,
                    affects_balance
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    normalized_name,
                    target,
                    normalized_deadline,
                    normalized_color,
                    1 if affects_balance else 0,
                ),
            )

            if cur.lastrowid is None:
                self.conn.rollback()
                return self._error("No se pudo crear la meta")

            goal_id = int(cur.lastrowid)
            goal = self._fetch_goal(user_id, goal_id)
            self.conn.commit()
            return self._success("Meta creada correctamente", data={"goal": goal})
        except sqlite3.Error as exc:
            logger.error("Error creating savings goal: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al crear meta")

    def add_entry(
        self,
        user_id: int,
        goal_id: int,
        amount: float,
        note: str = "",
        entry_date: Optional[str] = None,
    ) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if goal_id <= 0:
            return self._error("El goal_id debe ser mayor a 0")

        if amount <= 0:
            return self._error("El monto debe ser mayor a 0")

        normalized_date = date.today().isoformat()
        if entry_date is not None and entry_date.strip():
            parsed_entry_date = self._parse_iso_date(entry_date)
            if parsed_entry_date is None:
                return self._error("La fecha debe tener formato YYYY-MM-DD")
            normalized_date = parsed_entry_date.isoformat()

        normalized_note = note.strip()

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                SELECT id, name, affects_balance
                FROM savings_goals
                WHERE id = ? AND user_id = ?
                """,
                (goal_id, user_id),
            )
            goal_row = cur.fetchone()
            if goal_row is None:
                return self._error("Meta no encontrada para este usuario")

            goal_name = str(goal_row["name"])
            goal_affects_balance = bool(goal_row["affects_balance"])

            cur.execute(
                """
                INSERT INTO savings_entries (goal_id, user_id, amount, note, date)
                VALUES (?, ?, ?, ?, ?)
                """,
                (goal_id, user_id, amount, normalized_note, normalized_date),
            )

            if cur.lastrowid is None:
                self.conn.rollback()
                return self._error("No se pudo registrar el ahorro")

            entry_id = int(cur.lastrowid)

            cur.execute(
                """
                UPDATE savings_goals
                SET current = COALESCE(current, 0) + ?
                WHERE id = ? AND user_id = ?
                """,
                (amount, goal_id, user_id),
            )

            generated_transaction_id = None
            if goal_affects_balance:
                description = f"Ahorro meta: {goal_name}".strip()
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
                    VALUES (?, ?, 'expense', NULL, ?, ?, NULL)
                    """,
                    (user_id, amount, description, normalized_date),
                )
                generated_transaction_id = (
                    int(cur.lastrowid) if cur.lastrowid is not None else None
                )

            cur.execute(
                """
                SELECT id, goal_id, user_id, amount, note, date, created_at
                FROM savings_entries
                WHERE id = ?
                """,
                (entry_id,),
            )
            entry_row = cur.fetchone()
            entry = None
            if entry_row is not None:
                entry = {
                    "id": int(entry_row["id"]),
                    "goal_id": int(entry_row["goal_id"]),
                    "user_id": int(entry_row["user_id"]),
                    "amount": float(entry_row["amount"]),
                    "note": entry_row["note"] or "",
                    "date": entry_row["date"],
                    "created_at": entry_row["created_at"],
                }

            goal = self._fetch_goal(user_id, goal_id)

            self.conn.commit()
            return self._success(
                "Ahorro agregado correctamente",
                data={
                    "goal": goal,
                    "entry": entry,
                    "generated_transaction_id": generated_transaction_id,
                },
            )
        except sqlite3.Error as exc:
            logger.error("Error adding savings entry: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al registrar ahorro")

    def update_goal_target(self, user_id: int, goal_id: int, target: float) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if goal_id <= 0:
            return self._error("El goal_id debe ser mayor a 0")

        if target <= 0:
            return self._error("El objetivo debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                UPDATE savings_goals
                SET target = ?
                WHERE id = ? AND user_id = ?
                """,
                (target, goal_id, user_id),
            )

            if cur.rowcount == 0:
                self.conn.rollback()
                return self._error("Meta no encontrada para este usuario")

            goal = self._fetch_goal(user_id, goal_id)
            self.conn.commit()
            return self._success("Meta actualizada correctamente", data={"goal": goal})
        except sqlite3.Error as exc:
            logger.error("Error updating savings goal target: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al actualizar meta")

    def delete_goal(self, user_id: int, goal_id: int) -> JsonDict:
        user_error = self._validate_user(user_id)
        if user_error:
            return user_error

        if goal_id <= 0:
            return self._error("El goal_id debe ser mayor a 0")

        try:
            cur = self.conn.cursor()
            cur.execute(
                """
                DELETE FROM savings_goals
                WHERE id = ? AND user_id = ?
                """,
                (goal_id, user_id),
            )

            if cur.rowcount == 0:
                self.conn.rollback()
                return self._error("Meta no encontrada para este usuario")

            self.conn.commit()
            return self._success(
                "Meta eliminada correctamente",
                data={"goal_id": goal_id},
            )
        except sqlite3.Error as exc:
            logger.error("Error deleting savings goal: %s", exc)
            self.conn.rollback()
            return self._error("Error interno al eliminar meta")
