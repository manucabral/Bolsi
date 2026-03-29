"""Main API facade for pywebview JS bindings."""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from .helpers.api_response import ApiResponse, JsonDict
from .domains import (
    CategoriesApi,
    CreditsApi,
    ExportsApi,
    NotesApi,
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
        self.categories = CategoriesApi(conn)
        self.credits = CreditsApi(conn)
        self.exports = ExportsApi(conn)
        self.notes = NotesApi(conn)
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

    def login(self, username: str, password: str) -> JsonDict:
        return self.users.login(username, password)

    def logout(self, access_token: Optional[str] = None) -> JsonDict:
        return self.users.logout(access_token)

    def get_current_user(self, access_token: Optional[str] = None) -> JsonDict:
        return self.users.get_current_user(access_token)

    # ── Users domain ──────────────────────────────────────────────────────

    def user_register(
        self,
        username: str,
        email: str,
        password: str,
    ) -> JsonDict:
        return self.users.register(username, email, password)

    def user_login(self, username: str, password: str) -> JsonDict:
        return self.users.login(username, password)

    def user_logout(self, access_token: Optional[str] = None) -> JsonDict:
        return self.users.logout(access_token)

    def user_me(self, access_token: Optional[str] = None) -> JsonDict:
        return self.users.get_current_user(access_token)

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

    # ── Notes domain ──────────────────────────────────────────────────────

    def notes_list(self, user_id: int) -> JsonDict:
        return self.notes.list_notes(user_id)

    def notes_create(self, user_id: int, title: str, content: str) -> JsonDict:
        return self.notes.create_note(user_id, title, content)

    def notes_update(self, user_id: int, note_id: int, title: str, content: str) -> JsonDict:
        return self.notes.update_note(user_id, note_id, title, content)

    def notes_delete(self, user_id: int, note_id: int) -> JsonDict:
        return self.notes.delete_note(user_id, note_id)

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
        export_format: str = "csv",
    ) -> JsonDict:
        return self.exports.generate_export(user_id, section, export_format)

    def exports_csv(self, user_id: int, section: str = "summary") -> JsonDict:
        return self.exports.generate_export(user_id, section, "csv")

    def exports_pdf(self, user_id: int, section: str = "summary") -> JsonDict:
        return self.exports.generate_export(user_id, section, "pdf")

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
            categories_count,
        )
