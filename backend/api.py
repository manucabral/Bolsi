"""Main API facade for pywebview JS bindings."""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from .helpers.api_response import ApiResponse, JsonDict
from .domains import (
    BillsApi,
    CategoriesApi,
    CreditsApi,
    ExportsApi,
    NotesApi,
    NotificationsApi,
    SavingsApi,
    TransactionsApi,
    UsersApi,
)
from .constants import config
from .logger import logger


class BolsiApi:
    """Facade that delegates each method to a domain API module."""

    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        if conn is None:
            raise ValueError("Database connection is required")

        self.conn = conn
        self.users = UsersApi(conn)
        self.bills = BillsApi(conn)
        self.categories = CategoriesApi(conn)
        self.credits = CreditsApi(conn)
        self.exports = ExportsApi(conn)
        self.notes = NotesApi(conn)
        self.notifications = NotificationsApi(conn)
        self.savings = SavingsApi(conn)
        self.transactions = TransactionsApi(conn)

        logger.debug("Initialized API facade with domain modules")

    # ── Backward-compatible aliases (current frontend) ───────────────────

    def register_user(
        self,
        username: str,
        email: str,
        password: str,
        device_info: Optional[str] = None,
    ) -> JsonDict:
        return self.users.register(username, email, password, device_info=device_info)

    # ── Users domain ──────────────────────────────────────────────────────

    def user_login(self, username: str, password: str) -> JsonDict:
        return self.users.login(username, password)

    def user_logout(self, access_token: Optional[str] = None) -> JsonDict:
        return self.users.logout(access_token)

    def user_current_session(self, device_info: Optional[str] = None) -> JsonDict:
        return self.users.current_session(device_info=device_info)

    # ── App metadata ─────────────────────────────────────────────────────

    def app_version(self) -> JsonDict:
        return ApiResponse.success(
            "Version obtenida correctamente",
            data={"version": config.app_version},
        ).to_dict()

    # ── Settings domain ──────────────────────────────────────────────────

    def _resolve_backup_path(self, backup_file_name: str) -> Optional[Path]:
        normalized = backup_file_name.strip()
        if not normalized:
            return None

        base_dir = config.backups_dir.resolve()
        target_path = (base_dir / normalized).resolve()
        if target_path.parent != base_dir:
            return None
        if target_path.suffix.lower() != ".db":
            return None

        return target_path

    def settings_backup_database(self) -> JsonDict:
        try:
            backup_dir = config.backups_dir
            backup_dir.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_file_name = f"bolsi-backup-{timestamp}.db"
            backup_path = backup_dir / backup_file_name

            self.conn.commit()
            destination_conn = sqlite3.connect(str(backup_path), check_same_thread=False)
            try:
                self.conn.backup(destination_conn)
                destination_conn.commit()
            finally:
                destination_conn.close()

            return ApiResponse.success(
                "Backup creado correctamente",
                data={
                    "backup": {
                        "file_name": backup_file_name,
                        "file_path": str(backup_path),
                        "size_bytes": backup_path.stat().st_size,
                        "updated_at": datetime.fromtimestamp(
                            backup_path.stat().st_mtime
                        ).isoformat(timespec="seconds"),
                    }
                },
            ).to_dict()
        except sqlite3.Error as exc:
            logger.error("Error creating database backup: %s", exc)
            return ApiResponse.failure("Error interno al crear backup").to_dict()
        except OSError as exc:
            logger.error("Error writing database backup: %s", exc)
            return ApiResponse.failure("No se pudo guardar el backup").to_dict()

    def settings_list_backups(self) -> JsonDict:
        try:
            backup_dir = config.backups_dir
            backup_dir.mkdir(parents=True, exist_ok=True)

            backups: list[JsonDict] = []
            for path in sorted(
                backup_dir.glob("*.db"),
                key=lambda item: item.stat().st_mtime,
                reverse=True,
            ):
                stat = path.stat()
                backups.append(
                    {
                        "file_name": path.name,
                        "file_path": str(path),
                        "size_bytes": stat.st_size,
                        "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(
                            timespec="seconds"
                        ),
                    }
                )

            return ApiResponse.success(
                "Backups obtenidos correctamente",
                data={"backups": backups},
            ).to_dict()
        except OSError as exc:
            logger.error("Error listing backups: %s", exc)
            return ApiResponse.failure("No se pudieron obtener los backups").to_dict()

    def settings_restore_database(self, backup_file_name: str) -> JsonDict:
        backup_path = self._resolve_backup_path(backup_file_name)
        if backup_path is None:
            return ApiResponse.failure("Backup inválido").to_dict()

        if not backup_path.exists():
            return ApiResponse.failure("El backup seleccionado no existe").to_dict()

        source_conn: Optional[sqlite3.Connection] = None
        try:
            self.conn.commit()
            self.conn.execute("PRAGMA foreign_keys = OFF;")

            source_conn = sqlite3.connect(str(backup_path), check_same_thread=False)
            source_conn.backup(self.conn)
            self.conn.commit()
            self.conn.execute("PRAGMA foreign_keys = ON;")

            return ApiResponse.success(
                "Base restaurada correctamente",
                data={"restored_backup": backup_path.name},
            ).to_dict()
        except sqlite3.Error as exc:
            logger.error("Error restoring database from backup '%s': %s", backup_path, exc)
            self.conn.rollback()
            try:
                self.conn.execute("PRAGMA foreign_keys = ON;")
            except sqlite3.Error:
                pass
            return ApiResponse.failure("Error interno al restaurar backup").to_dict()
        finally:
            if source_conn is not None:
                source_conn.close()

    def settings_get_notifications(self, user_id: int) -> JsonDict:
        return self.notifications.get_preferences(user_id)

    def settings_update_notifications(
        self,
        user_id: int,
        bills_enabled: bool,
        bills_days_before: int,
        credits_enabled: bool,
        credits_days_before: int,
        summary_on_open_enabled: bool,
    ) -> JsonDict:
        return self.notifications.update_preferences(
            user_id,
            bills_enabled,
            bills_days_before,
            credits_enabled,
            credits_days_before,
            summary_on_open_enabled,
        )

    def settings_run_startup_alerts(self, user_id: int) -> JsonDict:
        return self.notifications.run_startup_alerts(user_id)

    # ── Categories domain ─────────────────────────────────────────────────

    def categories_list(self, user_id: int) -> JsonDict:
        return self.categories.list_categories(user_id)

    def categories_create(
        self,
        user_id: int,
        name: str,
        category_type: str,
        color: Optional[str] = None,
    ) -> JsonDict:
        return self.categories.create_category(user_id, name, category_type, color)

    def categories_update(
        self,
        user_id: int,
        category_id: int,
        name: str,
        category_type: str,
        color: Optional[str] = None,
    ) -> JsonDict:
        return self.categories.update_category(user_id, category_id, name, category_type, color)

    def categories_delete(self, user_id: int, category_id: int) -> JsonDict:
        return self.categories.delete_category(user_id, category_id)

    # ── Credits domain ────────────────────────────────────────────────────

    def credits_list(self, user_id: int) -> JsonDict:
        return self.credits.list_credits(user_id)

    def credits_create(
        self,
        user_id: int,
        description: str,
        total_amount: float,
        installments: int,
        installment_amount: float,
        start_date: str,
        category_id: Optional[int] = None,
        paid_installments: Optional[int] = None,
    ) -> JsonDict:
        return self.credits.create_credit(
            user_id,
            description,
            total_amount,
            installments,
            installment_amount,
            start_date,
            category_id,
            paid_installments,
        )

    def credits_update(
        self,
        user_id: int,
        credit_id: int,
        description: str,
        total_amount: float,
        installments: int,
        installment_amount: float,
        start_date: str,
        category_id: Optional[int] = None,
        paid_installments: Optional[int] = None,
    ) -> JsonDict:
        return self.credits.update_credit(
            user_id,
            credit_id,
            description,
            total_amount,
            installments,
            installment_amount,
            start_date,
            category_id,
            paid_installments,
        )

    def credits_delete(self, user_id: int, credit_id: int) -> JsonDict:
        return self.credits.delete_credit(user_id, credit_id)

    # ── Bills domain ──────────────────────────────────────────────────────

    def bills_list(self, user_id: int) -> JsonDict:
        return self.bills.list_bills(user_id)

    def bills_list_month(
        self,
        user_id: int,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> JsonDict:
        return self.bills.list_month_bills(user_id, year, month)

    def bills_create(
        self,
        user_id: int,
        name: str,
        amount: float,
        due_date: str,
        category_id: Optional[int] = None,
        notes: str = "",
    ) -> JsonDict:
        return self.bills.create_bill(
            user_id,
            name,
            amount,
            due_date,
            category_id,
            notes,
        )

    def bills_update(
        self,
        user_id: int,
        bill_id: int,
        name: str,
        amount: float,
        due_date: str,
        category_id: Optional[int] = None,
        notes: str = "",
    ) -> JsonDict:
        return self.bills.update_bill(
            user_id,
            bill_id,
            name,
            amount,
            due_date,
            category_id,
            notes,
        )

    def bills_mark_paid(
        self,
        user_id: int,
        bill_id: int,
        paid_date: Optional[str] = None,
        paid_amount: Optional[float] = None,
    ) -> JsonDict:
        return self.bills.mark_bill_paid(user_id, bill_id, paid_date, paid_amount)

    def bills_mark_unpaid(self, user_id: int, bill_id: int) -> JsonDict:
        return self.bills.mark_bill_unpaid(user_id, bill_id)

    def bills_delete(self, user_id: int, bill_id: int) -> JsonDict:
        return self.bills.delete_bill(user_id, bill_id)

    # ── Notes domain ──────────────────────────────────────────────────────

    def notes_list(self, user_id: int) -> JsonDict:
        return self.notes.list_notes(user_id)

    def notes_create(self, user_id: int, title: str, content: str) -> JsonDict:
        return self.notes.create_note(user_id, title, content)

    def notes_update(self, user_id: int, note_id: int, title: str, content: str) -> JsonDict:
        return self.notes.update_note(user_id, note_id, title, content)

    def notes_delete(self, user_id: int, note_id: int) -> JsonDict:
        return self.notes.delete_note(user_id, note_id)

    # ── Savings goals domain ──────────────────────────────────────────────

    def savings_list_goals(self, user_id: int) -> JsonDict:
        return self.savings.list_goals(user_id)

    def savings_create_goal(
        self,
        user_id: int,
        name: str,
        target: float,
        deadline: Optional[str] = None,
        color: Optional[str] = None,
        affects_balance: bool = True,
    ) -> JsonDict:
        return self.savings.create_goal(
            user_id,
            name,
            target,
            deadline,
            color,
            affects_balance,
        )

    def savings_add_entry(
        self,
        user_id: int,
        goal_id: int,
        amount: float,
        note: str = "",
        entry_date: Optional[str] = None,
    ) -> JsonDict:
        return self.savings.add_entry(user_id, goal_id, amount, note, entry_date)

    def savings_update_goal_target(
        self,
        user_id: int,
        goal_id: int,
        target: float,
    ) -> JsonDict:
        return self.savings.update_goal_target(user_id, goal_id, target)

    def savings_delete_goal(self, user_id: int, goal_id: int) -> JsonDict:
        return self.savings.delete_goal(user_id, goal_id)

    # ── Transactions domain ───────────────────────────────────────────────

    def transactions_list(self, user_id: int) -> JsonDict:
        return self.transactions.list_transactions(user_id)

    def transactions_create(
        self,
        user_id: int,
        amount: float,
        transaction_type: str,
        category_id: Optional[int],
        description: str,
        date: str,
        credit_id: Optional[int] = None,
    ) -> JsonDict:
        return self.transactions.create_transaction(
            user_id,
            amount,
            transaction_type,
            category_id,
            description,
            date,
            credit_id,
        )

    def transactions_update(
        self,
        user_id: int,
        transaction_id: int,
        amount: float,
        transaction_type: str,
        category_id: Optional[int],
        description: str,
        date: str,
        credit_id: Optional[int] = None,
    ) -> JsonDict:
        return self.transactions.update_transaction(
            user_id,
            transaction_id,
            amount,
            transaction_type,
            category_id,
            description,
            date,
            credit_id,
        )

    def transactions_delete(self, user_id: int, transaction_id: int) -> JsonDict:
        return self.transactions.delete_transaction(user_id, transaction_id)

    # ── Exports domain ────────────────────────────────────────────────────

    def exports_generate(
        self,
        user_id: int,
        section: str = "summary",
        export_format: str = "xlsx",
        year: Optional[int] = None,
        month: Optional[int] = None,
        from_date: Optional[str] = None,
    ) -> JsonDict:
        return self.exports.generate_export(
            user_id,
            section,
            export_format,
            year,
            month,
            from_date,
        )

    def exports_excel(
        self,
        user_id: int,
        section: str = "summary",
        year: Optional[int] = None,
        month: Optional[int] = None,
        from_date: Optional[str] = None,
    ) -> JsonDict:
        return self.exports.generate_export(
            user_id,
            section,
            "xlsx",
            year,
            month,
            from_date,
        )

    def exports_pdf(
        self,
        user_id: int,
        section: str = "summary",
        year: Optional[int] = None,
        month: Optional[int] = None,
        from_date: Optional[str] = None,
    ) -> JsonDict:
        return self.exports.generate_export(
            user_id,
            section,
            "pdf",
            year,
            month,
            from_date,
        )

    def exports_open_folder(self, user_id: int) -> JsonDict:
        return self.exports.open_export_folder(user_id)

    def exports_dashboard_chart_png(
        self,
        user_id: int,
        image_data_url: str,
    ) -> JsonDict:
        return self.exports.export_dashboard_chart_png(user_id, image_data_url)

    def exports_dashboard_visual_pdf(
        self,
        user_id: int,
        image_data_url: str,
        period_label: str,
        generated_at: str,
        month_income: float,
        month_expense: float,
        month_balance: float,
        active_credits: int,
        pending_installments: int,
        monthly_due_amount: float,
        bills_count: int,
        overdue_bills_count: int,
        due_soon_bills_count: int,
        month_bills_amount: float,
        categories_count: int,
    ) -> JsonDict:
        return self.exports.export_dashboard_visual_pdf(
            user_id,
            image_data_url,
            period_label,
            generated_at,
            month_income,
            month_expense,
            month_balance,
            active_credits,
            pending_installments,
            monthly_due_amount,
            bills_count,
            overdue_bills_count,
            due_soon_bills_count,
            month_bills_amount,
            categories_count,
        )
