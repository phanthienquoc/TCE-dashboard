from __future__ import annotations

import hashlib
import logging
import re
import time
from dataclasses import asdict
from datetime import datetime
from typing import Any

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from .config import Settings

logger = logging.getLogger(__name__)

DATE_FORMATS = ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d")
DIVIDEND_RE = re.compile(r"([\d,.]+)\s*đồng\s*/?\s*CP", re.IGNORECASE)


class VietstockScraper:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": settings.user_agent})

    def _driver(self) -> webdriver.Chrome:
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-notifications")
        options.add_argument("--blink-settings=imagesEnabled=false")
        options.add_argument("--window-size=1280,720")
        options.add_argument(f"--user-agent={self.settings.user_agent}")
        return webdriver.Chrome(options=options)

    @staticmethod
    def _parse_date(value: str | None) -> str | None:
        if not value:
            return None
        value = value.strip()
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                pass
        return None

    @staticmethod
    def _parse_dividend(content: str) -> float | None:
        match = DIVIDEND_RE.search(content or "")
        if not match:
            return None
        raw = match.group(1).replace(",", "").replace(".", "")
        try:
            return float(raw)
        except ValueError:
            return None

    @staticmethod
    def _clean_header(value: str) -> str:
        return value.replace("▼", "").replace("▲", "").strip()

    def parse(self, html: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(html, "html.parser")
        table = soup.find("table", id="event-content")
        if not table:
            return []

        rows = table.find_all("tr")
        if len(rows) < 2:
            return []

        headers = [self._clean_header(c.get_text(" ", strip=True)) for c in rows[0].find_all(["th", "td"])]
        records: list[dict[str, Any]] = []

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < len(headers):
                continue

            raw = {
                headers[i]: cells[i].get_text(" ", strip=True)
                for i in range(len(headers))
            }
            ticker = (raw.get("Mã CK") or raw.get("Mã CK ") or "").upper().strip()
            ex_date = self._parse_date(raw.get("Ngày GDKHQ"))
            content = raw.get("Nội dung sự kiện", "")
            dividend = self._parse_dividend(content)

            if not ticker or not ex_date:
                continue

            event_key_source = "|".join(
                [ticker, ex_date, content.strip(), raw.get("Ngày thực hiện", "").strip()]
            )
            event_key = hashlib.sha256(event_key_source.encode("utf-8")).hexdigest()

            records.append(
                {
                    "event_key": event_key,
                    "ticker": ticker,
                    "event_type": "dividend" if dividend is not None else "corporate_event",
                    "ex_date": ex_date,
                    "execution_date": self._parse_date(raw.get("Ngày thực hiện")),
                    "content": content,
                    "dividend_value": dividend,
                    "source": "vietstock",
                    "source_url": f"{self.settings.vietstock_base_url}/lich-su-kien.htm",
                    "raw_data": raw,
                }
            )

        return records

    def fetch_page(self, driver: webdriver.Chrome, page: int) -> list[dict[str, Any]]:
        url = (
            f"{self.settings.vietstock_base_url}/lich-su-kien.htm"
            f"?page={page}&from={self.settings.from_date}&to={datetime.now().date().isoformat()}"
            f"&tab=1&exchange={self.settings.exchange}&group={self.settings.group}"
        )
        logger.info("Fetching Vietstock page %s", page)
        driver.get(url)

        try:
            WebDriverWait(driver, self.settings.timeout).until(
                EC.presence_of_element_located((By.ID, "event-content"))
            )
            WebDriverWait(driver, self.settings.timeout).until(
                lambda d: len(d.find_elements(By.CSS_SELECTOR, "#event-content tr")) > 1
                or "không có dữ liệu" in d.find_element(By.ID, "event-content").text.lower()
            )
        except TimeoutException:
            logger.warning("Timed out waiting for page %s; parsing current DOM", page)

        records = self.parse(driver.page_source)
        logger.info("Page %s produced %s normalized records", page, len(records))
        return records

    def run(self) -> list[dict[str, Any]]:
        all_records: list[dict[str, Any]] = []
        driver = self._driver()
        try:
            for page in range(1, self.settings.max_pages + 1):
                records = self.fetch_page(driver, page)
                if not records:
                    logger.info("Stopping at page %s: no records", page)
                    break
                all_records.extend(records)
                time.sleep(1)
        finally:
            driver.quit()

        deduped = {record["event_key"]: record for record in all_records}
        return list(deduped.values())
