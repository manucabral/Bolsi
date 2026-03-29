"""Reusable API response helpers."""

from dataclasses import dataclass
from typing import Any, Dict, Optional

JsonDict = Dict[str, Any]


@dataclass(slots=True)
class ApiResponse:
    """Standard response payload for backend API methods."""

    ok: bool
    message: str
    data: Optional[JsonDict] = None
    error: Optional[str] = None

    @classmethod
    def success(cls, message: str, data: Optional[JsonDict] = None) -> "ApiResponse":
        return cls(ok=True, message=message, data=data)

    @classmethod
    def failure(cls, message: str) -> "ApiResponse":
        return cls(ok=False, message=message, error=message)

    def to_dict(self) -> JsonDict:
        """Serialize into a JSON-friendly dict.

        Keeps top-level data keys for compatibility with existing frontend logic.
        """
        payload: JsonDict = {
            "ok": self.ok,
            "message": self.message,
        }

        if self.ok:
            serialized_data = self.data or {}
            payload["data"] = serialized_data
            payload.update(serialized_data)
        else:
            payload["error"] = self.error or self.message

        return payload
