import os

from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    vietstock_base_url: str = "https://finance.vietstock.vn"
    from_date: str = "2015-01-01"
    group: int = 13
    exchange: int = -1
    max_pages: int = 20
    timeout: int = 30
    user_agent: str = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "Chrome/131.0.0.0 Safari/537.36"
    )


def load_settings() -> Settings:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    return Settings(
        supabase_url=url,
        supabase_service_role_key=key,
        vietstock_base_url=os.getenv("VIETSTOCK_BASE_URL", "https://finance.vietstock.vn").rstrip("/"),
        from_date=os.getenv("VIETSTOCK_FROM_DATE", "2015-01-01"),
        group=int(os.getenv("VIETSTOCK_GROUP", "13")),
        exchange=int(os.getenv("VIETSTOCK_EXCHANGE", "-1")),
        max_pages=int(os.getenv("VIETSTOCK_MAX_PAGES", "20")),
        timeout=int(os.getenv("VIETSTOCK_TIMEOUT", "30")),
        user_agent=os.getenv("VIETSTOCK_USER_AGENT") or Settings.user_agent,
    )
