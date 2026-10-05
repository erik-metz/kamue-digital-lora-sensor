"""Download contracts, including real SQL and referential integrity."""
import csv
import io
import json
import sys
import unittest
import zipfile
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from psycopg.rows import dict_row
from endpoints.data_exports import csv_bytes, download_data, export_range
from measurement_migration import install

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'tests'))
from db_support import DatabaseCase


class ExportFormatTests(unittest.TestCase):
    def test_precision_formulas_and_json_roundtrip(self):
        payload = csv_bytes([{'value': Decimal('-1.234567890123456789'),
                              'label': '=SUM(A1)', 'metadata': {'name': 'Bürstadt, Ried'},
                              'missing': None}], ('value', 'label', 'metadata', 'missing'))
        row = next(csv.DictReader(io.StringIO(payload.decode('utf-8-sig'))))
        self.assertEqual(row['value'], '-1.234567890123456789')
        self.assertEqual(row['label'], "'=SUM(A1)")
        self.assertEqual(json.loads(row['metadata']), {'name': 'Bürstadt, Ried'})
        self.assertEqual(row['missing'], '')

    def test_inclusive_dates_and_invalid_ranges(self):
        start, end = export_range(date(2030, 1, 1), date(2030, 1, 31), False)
        self.assertEqual((end - start).days, 31)
        self.assertEqual(end, datetime(2030, 2, 1, tzinfo=UTC))
        for start, end in [(None, None), (date(2030, 1, 2), date(2030, 1, 1)),
                           (date(2030, 1, 1), date(2030, 2, 1))]:
            with self.assertRaises(HTTPException):
                export_range(start, end, False)


class ExportDatabaseTests(DatabaseCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await install(self.conn)
        self.conn.row_factory = dict_row
        connection = self.conn

        class Pool:
            @asynccontextmanager
            async def connection(self):
                yield connection
        self.pool = Pool()

    async def reading(self, entity, metric='temperature', value='12.1234567890123456789',
                      hidden=False, kind='environmental_sensor', basis='observed'):
        await self.conn.execute('INSERT INTO entities(id,name,entity_type,is_hidden) VALUES (%s,%s,%s,%s)',
                                (entity, entity, kind, hidden))
        await self.conn.execute("""SELECT write_measurement(%s,%s,'°C','export-test',%s,
            '{}'::jsonb,'2030-01-15T12:00:00Z',%s::numeric,'2030-01-15T12:01:00Z','{}'::jsonb)""",
                                (entity, metric, basis, value))

    def unzip(self, response):
        with zipfile.ZipFile(io.BytesIO(response.body)) as archive:
            tables = {name: list(csv.DictReader(io.StringIO(archive.read(name).decode('utf-8-sig'))))
                      for name in archive.namelist() if name.endswith('.csv')}
            manifest = json.loads(archive.read('manifest.json'))
        return tables, manifest

    async def test_sample_references_and_visibility(self):
        await self.reading('public')
        await self.reading('private', hidden=True)
        await self.conn.execute("INSERT INTO sensor_metadata(id,friendly_name,is_hidden) VALUES ('hidden','Hidden',true)")
        await self.reading('sensor:hidden')
        response = await download_data(sample=True, pool=self.pool)
        tables, manifest = self.unzip(response)
        self.assertEqual(set(tables), {'entities.csv', 'measurement_definitions.csv', 'readings.csv'})
        self.assertEqual([r['id'] for r in tables['entities.csv']], ['public'])
        definition = tables['measurement_definitions.csv'][0]
        self.assertEqual(definition['entity_id'], 'public')
        self.assertEqual(tables['readings.csv'][0]['measurement_id'], definition['id'])
        self.assertEqual(tables['readings.csv'][0]['value'], '12.1234567890123456789')
        self.assertTrue(manifest['sample'])

    async def test_temperature_exports_all_stations_and_keeps_basis(self):
        await self.reading('a')
        await self.reading('b', metric='soil_temperature', basis='model')
        await self.reading('c', metric='humidity')
        tables, manifest = self.unzip(await download_data(topic='temperature', sample=False,
            start=date(2030,1,1), end=date(2030,1,31), pool=self.pool))
        self.assertEqual({r['id'] for r in tables['entities.csv']}, {'a', 'b'})
        self.assertEqual({r['basis'] for r in tables['measurement_definitions.csv']}, {'model', 'observed'})
        self.assertEqual(manifest['end_exclusive'], '2030-02-01T00:00:00+00:00')

    async def test_mobility_includes_service_trips_and_traffic_metrics(self):
        await self.reading('trip', metric='latitude', kind='service_trip', basis='schedule_prediction')
        await self.reading('traffic', metric='traffic_total_hourly', kind='sensor')
        # Canonical legacy sensors require a currently public sensor entry.
        await self.reading('weather')
        tables, _ = self.unzip(await download_data(topic='mobility', sample=False,
            start=date(2030,1,1), end=date(2030,1,31), pool=self.pool))
        self.assertEqual({r['id'] for r in tables['entities.csv']}, {'trip', 'traffic'})
        self.assertIn('schedule_prediction', {r['basis'] for r in tables['measurement_definitions.csv']})

    async def test_full_export_is_rejected_instead_of_truncated(self):
        await self.reading('a')
        await self.reading('b')
        with patch('endpoints.data_exports.MAX_READINGS', 1):
            with self.assertRaises(HTTPException) as error:
                await download_data(topic='all', sample=False, start=date(2030,1,1), end=date(2030,1,31), pool=self.pool)
        self.assertEqual(error.exception.status_code, 422)

    async def test_roadworks_overlap_and_singular_provider_category(self):
        for identifier, cause in [('work','roadwork'), ('closed','closure'), ('jam','congestion')]:
            await self.conn.execute("""INSERT INTO traffic_incidents
                (id,road_name,direction,location_from,location_to,start_time,end_time,last_seen_at,cause_type)
                VALUES (%s,'A67','north','a','b','2029-12-20','2030-01-20','2030-01-15',%s)""", (identifier, cause))
        tables, _ = self.unzip(await download_data(topic='roadworks', sample=False,
            start=date(2030,1,1), end=date(2030,1,31), pool=self.pool))
        self.assertEqual({r['id'] for r in tables['traffic_incidents.csv']}, {'work','closed'})
        self.assertEqual(tables['readings.csv'], [])

    async def test_empty_export_reports_missing_data(self):
        with self.assertRaises(HTTPException) as error:
            await download_data(topic='temperature', sample=False, start=date(2030,1,1), end=date(2030,1,31), pool=self.pool)
        self.assertEqual(error.exception.status_code, 404)
