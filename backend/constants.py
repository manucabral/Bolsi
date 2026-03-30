"""
Constants and configuration for the application.
"""

import os
import sys
from pathlib import Path
from dataclasses import dataclass

SESSION_DURATION_SECONDS = 5 * 24 * 60 * 60

EXPORT_ALLOWED_FORMATS = frozenset({"csv", "pdf"})
EXPORT_ALLOWED_SECTIONS = frozenset(
    {
        "summary",
        "transactions",
        "credits",
        "categories",
        "notes",
    }
)
EXPORT_SECTION_LABELS = {
    "summary": "Resumen",
    "transactions": "Transacciones",
    "credits": "Creditos",
    "categories": "Categorias",
    "notes": "Notas",
}


@dataclass
class Config:
    """Application configuration."""

    data_dir: Path
    prod_db_path: Path
    dev_db_path: Path
    prod_logs_dir: Path
    dev_logs_dir: Path
    prod_exports_dir: Path
    dev_exports_dir: Path
    prod_backups_dir: Path
    dev_backups_dir: Path
    frontend_dist_dir: Path
    logs_default_name: str = "bolsi"
    dev_server_url: str = "http://localhost:5173"
    development_mode: bool = True
    app_name: str = "Bolsi"
    app_version: str = "0.0.1"
    window_width: int = 1000
    window_height: int = 700

    @property
    def db_path(self) -> Path:
        """Get active database path based on execution mode."""
        return self.dev_db_path if self.development_mode else self.prod_db_path

    @property
    def logs_dir(self) -> Path:
        """Get active logs directory based on execution mode."""
        return self.dev_logs_dir if self.development_mode else self.prod_logs_dir

    @property
    def exports_dir(self) -> Path:
        """Get active exports directory based on execution mode."""
        return self.dev_exports_dir if self.development_mode else self.prod_exports_dir

    @property
    def backups_dir(self) -> Path:
        """Get active backups directory based on execution mode."""
        return self.dev_backups_dir if self.development_mode else self.prod_backups_dir


def _get_data_dir() -> Path:
    """Get the application data directory."""
    home = Path(os.path.expanduser("~"))
    data_dir = home / ".bolsi_app"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _get_project_root() -> Path:
    """Get project root directory."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).parent.parent


def _get_prod_logs_dir() -> Path:
    """Get logs directory for production mode."""
    logs_dir = _get_data_dir() / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir


def _get_dev_logs_dir() -> Path:
    """Get logs directory for development mode (project-local)."""
    logs_dir = _get_project_root() / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir


def _get_frontend_dist_dir() -> Path:
    """Get the frontend distribution directory."""
    return _get_project_root() / "frontend" / "dist"


def _get_prod_exports_dir() -> Path:
    """Get exports directory for production mode."""
    exports_dir = _get_data_dir() / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    return exports_dir


def _get_dev_exports_dir() -> Path:
    """Get exports directory for development mode (project-local)."""
    exports_dir = _get_project_root() / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    return exports_dir


def _get_prod_backups_dir() -> Path:
    """Get database backups directory for production mode."""
    backups_dir = _get_data_dir() / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    return backups_dir


def _get_dev_backups_dir() -> Path:
    """Get database backups directory for development mode (project-local)."""
    backups_dir = _get_project_root() / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    return backups_dir


def _get_prod_db_path() -> Path:
    """Get the production database path."""
    return _get_data_dir() / "local.db"


def _get_dev_db_path() -> Path:
    """Get the development database path (project-local)."""
    return _get_project_root() / "local.dev.db"


def _is_development_mode() -> bool:
    """Read development mode from env var, defaulting to False."""
    raw = os.getenv("BOLSI_DEVELOPMENT_MODE")
    if raw is None:
        return False
    return raw.strip().lower() in {"1", "true", "yes", "on"}


config = Config(
    data_dir=_get_data_dir(),
    prod_db_path=_get_prod_db_path(),
    dev_db_path=_get_dev_db_path(),
    prod_logs_dir=_get_prod_logs_dir(),
    dev_logs_dir=_get_dev_logs_dir(),
    prod_exports_dir=_get_prod_exports_dir(),
    dev_exports_dir=_get_dev_exports_dir(),
    prod_backups_dir=_get_prod_backups_dir(),
    dev_backups_dir=_get_dev_backups_dir(),
    frontend_dist_dir=_get_frontend_dist_dir(),
    development_mode=_is_development_mode(),
)
