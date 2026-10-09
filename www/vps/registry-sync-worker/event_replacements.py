"""Reviewed 2026 occurrences replaced by the specific Stadtmarketing source."""

from datetime import datetime

from municipal_events import BERLIN

REPLACED_SOURCE = "lampertheim-events"
REPLACED_URLS = (
    "https://www.lampertheim.de/de/veranstaltungen/termine/extern/weihnachtsmarkt_1768206666.php",
    "https://www.lampertheim.de/de/veranstaltungen/termine/extern/weihnachtsmarkt-lampertheim_1768206725.php",
    "https://www.lampertheim.de/de/veranstaltungen/termine/extern/schlosshofzauber_1786955182.php",
)


def superseded_occurrence(event):
    return (
        event.get("source") == REPLACED_SOURCE
        and event.get("event_url") in REPLACED_URLS
        and datetime.fromisoformat(event["start_time"]).astimezone(BERLIN).year == 2026
    )
