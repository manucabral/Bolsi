"""API module for handling application logic."""

import sqlite3
from typing import Optional, Dict, Any
from .logger import logger


class BolsiApi:
    """Main API class for interacting with the database and business logic."""

    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        if conn is None:
            raise ValueError("Database connection is required")
        self.conn = conn
        logger.debug("Initialized with DB connection")

    def register_user(self, username: str, email: str, password: str):
        pass

    def login(self, username: str, password: str):
        pass

    def logout(self):
        pass

    def get_current_user(self):
        pass
