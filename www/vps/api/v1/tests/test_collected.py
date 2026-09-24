import json
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from endpoints.collected import dataset_publication, movements
from fastapi import HTTPException
from starlette.requests import Request


def request(path='/'):
    return Request({'type':'http','method':'GET','path':path,'headers':[],'query_string':b''})


def pool_for(row=None,rows=None):
    pool=MagicMock(); conn=MagicMock(); cursor=MagicMock()
    pool.connection.return_value.__aenter__.return_value=conn
    conn.execute=AsyncMock(return_value=cursor)
    cursor.fetchone=AsyncMock(return_value=row); cursor.fetchall=AsyncMock(return_value=rows or [])
    return pool,conn


class CollectedEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_and_expired_publications_are_unavailable(self):
        now=datetime.now(UTC)
        for row in [None,{'expires_at':now-timedelta(seconds=1),'source_updated_at':now-timedelta(days=1)}]:
            pool,_=pool_for(row)
            with self.assertRaises(HTTPException) as context:
                await dataset_publication('example',request(),pool)
            self.assertEqual(context.exception.status_code,503)

    async def test_empty_publication_is_authoritative_and_has_provenance(self):
        now=datetime.now(UTC)
        pool,_=pool_for({'data':[],'expires_at':now+timedelta(hours=1),'source_updated_at':now,'fetched_at':now,'source_id':'test'})
        response=await dataset_publication('example',request(),pool)
        self.assertEqual(json.loads(response.body),[])
        self.assertEqual(response.headers['x-data-source'],'test')
        self.assertIn('x-data-expires-at',response.headers)
        self.assertIn('s-maxage=',response.headers['cache-control'])

    async def test_position_read_prefers_observations_and_excludes_expired(self):
        pool,conn=pool_for(rows=[])
        response=await movements(request(),pool)
        self.assertEqual(json.loads(response.body),{'positions':[]})
        sql=conn.execute.call_args.args[0]
        self.assertIn('valid_until > NOW()',sql)
        self.assertIn("basis='observed'",sql)
