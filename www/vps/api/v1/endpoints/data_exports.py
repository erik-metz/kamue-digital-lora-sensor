"""Bounded public downloads of related core tables; never truncate a full export."""

import csv
import io
import json
import zipfile
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from dependencies import get_db_pool
from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import QueryCanceled, UndefinedTable
from starlette.responses import Response

router = APIRouter(tags=["Downloads Public"])
MAX_READINGS = 50_000
SAMPLE_SIZE = 300

# A hidden/deleted legacy sensor must stay hidden even during the core migration.
PUBLIC = """NOT e.is_hidden AND e.metadata->>'legacy_deleted' IS DISTINCT FROM 'true'
    AND (e.id NOT LIKE 'sensor:%%' OR EXISTS (
        SELECT 1 FROM sensor_metadata s WHERE s.id=substr(e.id,8) AND NOT s.is_hidden))"""
MOBILITY = """(e.entity_type IN ('movement','corridor','road_segment','truck_parking',
    'service_trip','bus','train','waste','parking','parking_spot','parking_group','bike','bike_station','charging_station')
    OR d.metric IN ('traffic_flow','traffic_count','vehicle_count','parking_occupied',
        'parking_free','parking_capacity','parking_occupancy_pct') OR d.metric LIKE 'traffic_%%'
    OR d.source_id IN ('autobahn_api','tomtom_flow','rast_monitor'))"""
TEMPERATURE = """(d.metric ILIKE '%%temperature%%' OR d.metric IN ('temp','air_temp','soil_temp'))"""

ENTITY_COLUMNS = ('id', 'name', 'entity_type', 'metadata')
DEFINITION_COLUMNS = ('id', 'entity_id', 'metric', 'unit', 'source_id', 'basis',
                      'dimensions', 'semantics', 'minimum', 'maximum')
READING_COLUMNS = ('measurement_id', 'observed_at', 'value', 'quality', 'collected_at',
                   'period_start', 'period_end', 'provenance', 'revision')
CLOSURE_COLUMNS = ('id', 'municipality', 'district', 'street_name', 'location_from',
                   'location_to', 'closure_type', 'status', 'start_time', 'end_time',
                   'is_active', 'reason', 'description', 'detour', 'coordinates', 'source', 'source_url')
INCIDENT_COLUMNS = ('id', 'road_name', 'direction', 'location_from', 'location_to',
                    'start_time', 'end_time', 'last_seen_at', 'is_active', 'delay_seconds',
                    'delay_kind', 'length_meters', 'severity', 'cause_type', 'description',
                    'coordinates', 'source', 'source_category')


def csv_value(value):
    if value is None:
        return ''
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    if isinstance(value, str) and (value.lstrip().startswith(('=', '+', '-', '@'))
                                  or value.startswith(('\t', '\r', '\n'))):
        return "'" + value
    # Decimal is deliberately not converted to float: retain database precision.
    return str(value).lower() if isinstance(value, bool) else str(value)


def csv_bytes(rows, columns):
    output = io.StringIO(newline='')
    writer = csv.writer(output)
    writer.writerow(columns)
    writer.writerows([csv_value(row.get(column)) for column in columns] for row in rows)
    return ('\ufeff' + output.getvalue()).encode('utf-8')


def package(tables, *, sample, topic, start, end, generated_at):
    manifest = {
        'generated_at': generated_at.isoformat(), 'sample': sample, 'topic': topic,
        'start_inclusive': start.isoformat() if start else None,
        'end_exclusive': end.isoformat() if end else None,
        'tables': {name: len(rows) for name, (rows, _) in tables.items()},
        'format': 'UTF-8 BOM CSV; comma delimiter; UTC; JSON in structured columns',
    }
    readme = """Open Ried Sens – Datenpaket

entities.csv: Messpunkte/Objekte. id ist der Schlüssel.
measurement_definitions.csv: Messgrößen. entity_id verweist auf entities.id.
readings.csv: Messwerte. measurement_id verweist auf measurement_definitions.id.
Nur zu den exportierten Messwerten gehörende Messgrößen und Objekte sind enthalten.
metadata und dimensions sind JSON; leere Zellen sind fehlende Werte, keine Nullen.
value behält die Dezimalgenauigkeit; Zeitstempel sind UTC. basis unterscheidet
Beobachtungen, Meldungen, Modelle und Fahrplanprognosen; quality die Datenqualität.
Eine Stichprobe enthält höchstens einen zuletzt gespeicherten Wert je Messgröße.
Sie zeigt die Datenstruktur und ist weder eine Zeitreihe noch eine repräsentative Statistik.

Falls vorhanden: street_closures.csv und traffic_incidents.csv enthalten gespeicherte
Meldungen mit einem den Exportzeitraum überlappenden Gültigkeitszeitraum.
Diese Dateien sind ergänzende Veröffentlichungen, keine künstlichen Messwerte.
Die Meldungen zeigen den zuletzt gespeicherten Stand, keine historische Versionsfolge.
Mobilität enthält skalare Verkehrs-, Park-, Lade- und Bewegungsdaten sowie Meldungen;
GTFS-Fahrplandateien und Satellitenbilder sind nicht Bestandteil dieses Pakets.

manifest.json nennt Umfang, Auswahl und Erstellungszeit. Themen-Exporte sind vollständig
für die Auswahl im kanonischen Drei-Tabellen-Bestand zum Exportzeitpunkt. Noch nicht
migrierte Daten sind nicht enthalten. Größere Auswahlen werden mit einem Fehler abgelehnt,
niemals still abgeschnitten. Temperaturen können Luft-, Boden- und Modellwerte umfassen;
beachte metric, dimensions und basis für die Interpretation.

Quellen und Nutzungsbedingungen: siehe /quellen auf der Projektwebsite
Beachte die Lizenzen und Namensnennung der jeweiligen Originalquelle (source_id).
Text mit Formelzeichen wird für Tabellenprogramme mit einem Apostroph geschützt.
"""
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, (rows, columns) in tables.items():
            archive.writestr(f'{name}.csv', csv_bytes(rows, columns))
        archive.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
        archive.writestr('README.txt', readme)
    return output.getvalue()


def export_range(start, end, sample):
    if sample:
        return None, None
    if start is None or end is None or start > end or (end - start).days >= 31:
        raise HTTPException(400, 'Bitte einen gültigen Zeitraum von höchstens 31 Tagen wählen.')
    return (datetime.combine(start, datetime.min.time(), UTC),
            datetime.combine(end + timedelta(days=1), datetime.min.time(), UTC))


@router.get('/downloads', summary='Download related public CSV tables as ZIP')
async def download_data(
    topic: Literal['all', 'temperature', 'mobility', 'roadworks'] = 'all',
    sample: bool = False, start: date | None = None, end: date | None = None,
    pool=Depends(get_db_pool),
):
    start_time, end_time = export_range(start, end, sample)
    tables = {}
    try:
        async with pool.connection() as conn:
            async with conn.transaction():
                await conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
                await conn.execute("SET LOCAL statement_timeout = '25s'")
                generated_at = (await (await conn.execute('SELECT transaction_timestamp() AS time')).fetchone())['time']
                # Latest per definition gives the sample diverse metrics and usable references.
                if sample:
                    cursor = await conn.execute(f"""SELECT r.* FROM measurement_definitions d
                        JOIN entities e ON e.id=d.entity_id
                        JOIN latest_readings l ON l.measurement_id=d.id
                        JOIN readings r ON r.measurement_id=l.measurement_id AND r.observed_at=l.observed_at
                        WHERE {PUBLIC} ORDER BY md5(d.id::text) LIMIT %s""", (SAMPLE_SIZE,))
                    readings = await cursor.fetchall()
                elif topic == 'roadworks':
                    readings = []
                else:
                    topic_sql = TEMPERATURE if topic == 'temperature' else MOBILITY if topic == 'mobility' else 'TRUE'
                    cursor = await conn.execute(f"""SELECT r.* FROM readings r
                        JOIN measurement_definitions d ON d.id=r.measurement_id
                        JOIN entities e ON e.id=d.entity_id
                        WHERE {PUBLIC} AND {topic_sql} AND r.observed_at >= %s AND r.observed_at < %s
                        ORDER BY r.observed_at,r.measurement_id LIMIT %s""",
                        (start_time, end_time, MAX_READINGS + 1))
                    readings = await cursor.fetchall()
                if len(readings) > MAX_READINGS:
                    raise HTTPException(422, 'Die Auswahl enthält mehr als 50.000 Messwerte. Bitte Zeitraum oder Thema eingrenzen. Es wurde keine unvollständige Datei erstellt.')
                ids = sorted({r['measurement_id'] for r in readings})
                definitions = await (await conn.execute(
                    'SELECT * FROM measurement_definitions WHERE id=ANY(%s::bigint[]) ORDER BY id', (ids,))).fetchall()
                entity_ids = sorted({d['entity_id'] for d in definitions})
                entities = await (await conn.execute(
                    'SELECT id,name,entity_type,metadata FROM entities WHERE id=ANY(%s::text[]) ORDER BY id', (entity_ids,))).fetchall()
                tables.update(entities=(entities, ENTITY_COLUMNS),
                              measurement_definitions=(definitions, DEFINITION_COLUMNS),
                              readings=(readings, READING_COLUMNS))
                if not sample and topic in {'all', 'mobility', 'roadworks'}:
                    for table, columns in (('street_closures', CLOSURE_COLUMNS), ('traffic_incidents', INCIDENT_COLUMNS)):
                        condition = "AND cause_type IN ('roadwork','roadworks','closure')" if topic == 'roadworks' and table == 'traffic_incidents' else ''
                        rows = await (await conn.execute(f"""SELECT {','.join(columns)} FROM {table}
                            WHERE start_time < %s AND (end_time IS NULL OR end_time >= %s)
                            {condition} ORDER BY start_time,id LIMIT %s""",
                            (end_time, start_time, MAX_READINGS + 1))).fetchall()
                        if len(rows) > MAX_READINGS:
                            raise HTTPException(422, 'Zu viele Meldungen. Bitte den Zeitraum verkürzen; der Export wurde nicht abgeschnitten.')
                        tables[table] = (rows, columns)
                if not any(rows for rows, _ in tables.values()):
                    raise HTTPException(404, 'Für diese Auswahl sind keine öffentlichen Daten im Exportbestand vorhanden.')
    except UndefinedTable:
        raise HTTPException(503, 'Der Drei-Tabellen-Export ist auf dem Backend noch nicht eingerichtet.') from None
    except QueryCanceled:
        raise HTTPException(503, 'Die Auswahl dauert zu lange. Bitte den Zeitraum eingrenzen.') from None
    data = package(tables, sample=sample, topic=topic, start=start_time, end=end_time, generated_at=generated_at)
    filename = f'open-ried-sens-{ "sample" if sample else topic + "-" + start.isoformat() + "-" + end.isoformat() }.zip'
    return Response(data, media_type='application/zip', headers={
        'Content-Disposition': f'attachment; filename="{filename}"', 'Cache-Control': 'no-store',
    })
