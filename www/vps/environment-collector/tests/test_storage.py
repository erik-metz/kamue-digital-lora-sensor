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
        gauges,weather=normalize(payload,Settings(db={}))
        await persist_environment_data(self.conn,gauges,weather,now,payload=payload,source_url='https://example.org/gauge')
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
