from __future__ import annotations

import logging
from typing import Any

import requests

from .config import Settings

logger = logging.getLogger(__name__)


class SupabaseRepository:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.url = f"{settings.supabase_url.rstrip('/')}/rest/v1/tce_corporate_events"
        self.headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }

    def upsert_events(self, records: list[dict[str, Any]]) -> int:
        if not records:
            return 0

        response = requests.post(
            self.url,
            headers=self.headers,
            json=records,
            timeout=self.settings.timeout,
            params={"on_conflict": "event_key"},
        )
        if response.status_code >= 300:
            raise RuntimeError(
                f"Supabase upsert failed ({response.status_code}): {response.text[:1000]}"
            )

        logger.info("Upserted %s Vietstock records", len(records))
        return len(records)
