from __future__ import annotations

from .config import load_settings


def check_configuration() -> None:
    settings = load_settings()
    if not settings.vietstock_base_url.startswith("https://"):
        raise RuntimeError("VIETSTOCK_BASE_URL must use HTTPS")
