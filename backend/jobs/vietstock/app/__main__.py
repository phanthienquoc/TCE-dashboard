import logging

from .config import load_settings
from .repository import SupabaseRepository
from .scraper import VietstockScraper


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("tce.vietstock.cron")


def main() -> int:
    settings = load_settings()
    logger.info("Starting TCE Vietstock cron job")
    logger.info("Settings: %s", settings)

    records = VietstockScraper(settings).run()
    written = SupabaseRepository(settings).upsert_events(records)

    logger.info("Completed Vietstock sync: scraped=%s upserted=%s", len(records), written)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
