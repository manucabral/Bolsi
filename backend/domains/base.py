"""Shared helpers for domain APIs."""

import sqlite3
from typing import Optional

from ..helpers.api_response import ApiResponse, JsonDict


class DomainApi:
    """Base class with shared helpers for API domains."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def _success(self, message: str, data: Optional[JsonDict] = None) -> JsonDict:
        return ApiResponse.success(message=message, data=data).to_dict()

    def _error(self, message: str) -> JsonDict:
        return ApiResponse.failure(message=message).to_dict()

    def _not_implemented(self, domain: str, action: str) -> JsonDict:
        return self._error(f"{domain}.{action} aún no está implementado")
