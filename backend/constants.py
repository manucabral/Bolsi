"""
Constants and configuration for the application.
"""

import os
from pathlib import Path
from dataclasses import dataclass


@dataclass
class Config:
    """Application configuration."""

    # Base data directory
    data_dir: Path

    # Database path
    db_path: Path

    # Logs directory
    logs_dir: Path

    # Frontend distribution directory
    frontend_dist_dir: Path

    # Default logger name
    logs_default_name: str = "bolsi"

    # Dev server URL for frontend during development
    dev_server_url: str = "http://127.0.0.1:5173"


def _get_data_dir() -> Path:
    """Get the application data directory."""
    home = Path(os.path.expanduser("~"))
    data_dir = home / ".bolsi_app"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _get_logs_dir() -> Path:
    """Get the logs directory."""
    logs_dir = _get_data_dir() / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir

def _get_frontend_dist_dir() -> Path:
    """Get the frontend distribution directory."""
    return Path(__file__).parent.parent / "frontend" / "dist"

def _get_db_path() -> Path:
    """Get the database path."""
    return _get_data_dir() / "local.db"


config = Config(
    data_dir=_get_data_dir(),
    db_path=_get_db_path(),
    logs_dir=_get_logs_dir(),
    frontend_dist_dir=_get_frontend_dist_dir(),
    logs_default_name="bolsi",
    dev_server_url="http://127.0.0.1:5173",
)
