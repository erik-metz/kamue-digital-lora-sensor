"""Exercise publication read SQL against the disposable integration database."""
import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tests"))

from db_support import DatabaseCase
from endpoints.collected import collection_status
from psycopg.rows import dict_row
from starlette.requests import Request


class CollectedDatabaseTests(DatabaseCase):
    async def test_status_includes_registered_and_unregistered_sources(self):
        await self.conn.execute("""INSERT INTO collection_sources
            (id,source_url,adapter,enabled,interval_seconds)
            VALUES ('configured','https://example.org/data','json',FALSE,3600)""")
        await self.conn.execute("""INSERT INTO collection_attempts(source_id,status)
            VALUES ('legacy-worker','success')""")
        self.conn.row_factory = dict_row
        connection = self.conn

        class Pool:
            @asynccontextmanager
            async def connection(self):
                yield connection

        request = Request({'type': 'http', 'method': 'GET', 'path': '/',
                           'headers': [], 'query_string': b''})
        response = await collection_status(request, Pool())
        rows = {row['source_id']: row for row in json.loads(response.body)['sources']}
        self.assertFalse(rows['configured']['enabled'])
        self.assertEqual(rows['configured']['status'], 'pending')
        self.assertIsNone(rows['legacy-worker']['enabled'])
        self.assertIsNotNone(rows['legacy-worker']['last_success_at'])
