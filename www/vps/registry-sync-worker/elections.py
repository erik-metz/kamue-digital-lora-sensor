"""Official Bundestag precinct results, with no inferred municipality totals."""

import asyncio
import csv
import io
import zipfile
from datetime import datetime
from email.utils import parsedate_to_datetime

from publications import acquire, publish


def parse_precincts(body, municipalities):
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        names = [n for n in archive.namelist() if n.endswith("_wbz_ergebnisse.csv")]
        if len(names) != 1 or archive.getinfo(names[0]).file_size > 100_000_000:
            raise ValueError("Unexpected official election archive")
        lines = archive.read(names[0]).decode("utf-8-sig").splitlines()
        start = next(i for i, s in enumerate(lines) if s.startswith("Wahlkreis;Land;"))
        result = []
        for row in csv.DictReader(lines[start:], delimiter=";"):
            ags = row["Land"] + row["Regierungsbezirk"] + row["Kreis"] + row["Gemeinde"]
            if ags not in municipalities:
                continue
            values = []
            for key, value in row.items():
                if key and (
                    "stimmen" in key.lower()
                    or key.startswith(("Wahlberechtigte", "Wählende"))
                ):
                    if value not in ("", "–", "—") and not value.isdigit():
                        raise ValueError("Unexpected election count")
                    values.append(
                        {
                            "label": key,
                            "value": int(value) if value.isdigit() else None,
                            "source_marker": value if not value.isdigit() else None,
                            "cell": key,
                        }
                    )
            result.append(
                {
                    "municipality_id": municipalities[ags] + ":" + row["Wahlbezirk"],
                    "ags": ags,
                    "name": row["Gemeindename"]
                    + " · Wahlbezirk "
                    + row["Wahlbezirk"]
                    + " · Bezirksart "
                    + row["Bezirksart"],
                    "precinct_type": row["Bezirksart"],
                    "postal_group": row["Kennziffer Briefwahlzugehörigkeit"],
                    "values": values,
                }
            )
        if {r["ags"] for r in result} != set(municipalities):
            raise ValueError("Incomplete regional precinct coverage")
        return result


async def import_elections(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    records = await asyncio.to_thread(
        parse_precincts, response.content, source["municipalities"]
    )
    published = (
        parsedate_to_datetime(response.headers["last-modified"])
        if response.headers.get("last-modified")
        else datetime.fromisoformat(source["published_at"])
    )
    data = {
        "edition": "Bundestagswahl 2025",
        "publisher": "Die Bundeswahlleiterin und die Landeswahlleitungen",
        "publication_month": published.strftime("%Y-%m"),
        "source_url": source["url"],
        "basis": "published_statistics",
        "notice": "Ergebnisse je Wahlbezirk einschließlich der vom Herausgeber zugeordneten Briefwahlbezirke. Keine berechneten Gemeindeergebnisse. Bezirksart und Briefwahlzugehörigkeit bleiben erhalten.",
        "tables": [
            {
                "id": "btw2025",
                "title": "Bundestagswahl vom 23. Februar 2025 – Wahlbezirksergebnisse",
                "records": records,
            }
        ],
    }
    async with conn.transaction():
        await publish(conn, source, "statistics/elections", data, digest, published)
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
