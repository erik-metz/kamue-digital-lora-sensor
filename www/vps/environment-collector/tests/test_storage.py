"""Database contract for source timestamps and unknown alarm thresholds."""
import hashlib
import json
import sys
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tests'))
from config import Settings
from db_support import DatabaseCase
from normalize import normalize
from storage import persist_environment_data


class EnvironmentStorageTests(DatabaseCase):
    async def test_actual_source_times_coordinates_and_unknown_thresholds(self):
        now=datetime.now(UTC)
        measured=now-timedelta(minutes=10)
        digest=hashlib.sha256(b'environment-test').hexdigest()
        await self.conn.execute("INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,'application/json')",(digest,b'environment-test'))
        payload={'pegel_sha256':digest,'weather_sha256':digest,
            'pegel':{'longname':'WORMS','number':'23900200','latitude':49.63,'longitude':8.37,'water':{'longname':'RHEIN'},
                'timeseries':[{'shortname':'W','currentMeasurement':{'timestamp':measured.isoformat(),'value':-22}}]},
            'weather':{'latitude':49.625,'longitude':8.4375,'timezone':'UTC','current':{'time':measured.isoformat(),'temperature_2m':18.5,'relative_humidity_2m':65,'precipitation':0}}}
        for name in ('pegel', 'weather'):
            row = await (await self.conn.execute("""INSERT INTO collection_attempts(source_id,http_status,payload_sha256,status)
                VALUES (%s,200,%s,'received') RETURNING id""", ('environment-' + name, digest))).fetchone()
            payload[name + '_attempt_id'] = row[0]
        gauges,weather=normalize(payload,Settings(db={}))
        await persist_environment_data(self.conn,gauges,weather,now,payload=payload,source_url='https://example.org/gauge')
        self.assertEqual(await self.scalar("SELECT item_count FROM collection_attempts WHERE source_id='environment-pegel'"), 1)
        self.assertEqual(await self.scalar("SELECT item_count FROM collection_attempts WHERE source_id='environment-weather'"), 3)
        self.assertEqual(await self.scalar("SELECT status FROM collection_attempts WHERE source_id='environment-weather'"), 'success')
        self.assertIsNone(await self.scalar("SELECT alarm_level_1_m FROM flood_gauges WHERE id='pegel-rhein-worms'"))
        self.assertEqual(await self.scalar("SELECT source_updated_at FROM collected_datasets WHERE dataset='environment/flood/gauges'"),measured)
        self.assertEqual(await self.scalar("SELECT COUNT(*) FROM sensor_data WHERE sensor_id='weather-dwd-ried' AND timestamp=%s",(measured,)),3)
        self.assertEqual(await self.scalar("SELECT latitude FROM sensor_metadata WHERE id='weather-dwd-ried'"),49.625)

    async def test_dual_weather_corrections_are_atomic_with_legacy_shadow(self):
        sys.path.append(str(Path(__file__).resolve().parents[2] / 'api' / 'v1'))
        from measurement_migration import install

        await install(self.conn, shadow=True)
        now = datetime.now(UTC)
        payload = {'weather': {'latitude':49.625,'longitude':8.4375,'timezone':'UTC',
            'current':{'time':now.isoformat(),'temperature_2m':18.5,'relative_humidity_2m':65,'precipitation':0},
            'current_units':{'temperature_2m':'°C','relative_humidity_2m':'%','precipitation':'mm'}}}
        with patch.dict('os.environ', {'MEASUREMENT_WEATHER_WRITE_MODE':'dual'}):
            for humidity in (65,66):
                payload['weather']['current']['relative_humidity_2m'] = humidity
                body = json.dumps(payload['weather']).encode()
                digest = hashlib.sha256(body).hexdigest()
                await self.conn.execute("INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,'application/json')",(digest,body))
                receipt = await (await self.conn.execute("""INSERT INTO collection_attempts(source_id,http_status,payload_sha256,status)
                    VALUES ('environment-weather',200,%s,'received') RETURNING id""",(digest,))).fetchone()
                payload.update(weather_sha256=digest,weather_attempt_id=receipt[0])
                if humidity == 65:
                    first_payload = deepcopy(payload)
                _, weather = normalize(payload,Settings(db={}))
                await persist_environment_data(self.conn,[],weather,now,payload=payload)
            _, older_weather = normalize(first_payload,Settings(db={}))
            await persist_environment_data(self.conn,[],older_weather,now,payload=first_payload)
            self.assertEqual(await self.scalar("""SELECT r.value FROM readings r
                JOIN measurement_definitions d ON d.id=r.measurement_id
                WHERE d.source_id='environment-weather' AND d.metric='relative_humidity'"""),66)
            self.assertEqual(await self.scalar("""SELECT value FROM core_sensor_data
                WHERE sensor_id='weather-dwd-ried' AND metric='relative_humidity'"""),66)
            self.assertEqual(await self.scalar("""SELECT value FROM sensor_latest
                WHERE sensor_id='weather-dwd-ried' AND metric='relative_humidity'"""),66)
            payload['weather_attempt_id'] = -1
            with self.assertRaises(ValueError):
                await persist_environment_data(self.conn,[],weather,now,payload=payload)

    async def test_empty_optional_download_is_partial_and_only_current_receipt_changes(self):
        ids = []
        for source in ('environment-radolan','environment-radolan','environment-mosmix'):
            row = await (await self.conn.execute("""INSERT INTO collection_attempts(source_id,http_status,status)
                VALUES (%s,200,'received') RETURNING id""", (source,))).fetchone()
            ids.append(row[0])
        await persist_environment_data(self.conn, [], [], datetime.now(UTC),
            payload={'radolan_attempt_id':ids[1], 'mosmix_attempt_id':ids[2]})
        self.assertEqual(await self.scalar('SELECT status FROM collection_attempts WHERE id=%s',(ids[0],)), 'received')
        for attempt in ids[1:]:
            row = await (await self.conn.execute("""SELECT status,item_count,error_stage,processed_at
                FROM collection_attempts WHERE id=%s""",(attempt,))).fetchone()
            self.assertEqual(row[:3], ('partial',0,'processing'))
            self.assertIsNotNone(row[3])
