"""Database contract for source timestamps and unknown alarm thresholds."""
import hashlib
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

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
