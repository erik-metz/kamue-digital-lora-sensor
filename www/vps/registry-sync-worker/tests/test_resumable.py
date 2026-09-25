"""Acquisition resume behavior against disposable PostgreSQL schemas."""
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tests"))
from db_support import DatabaseCase
from map_tiles import import_wms
from zakb import calendar_for_address, import_zakb

ICAL = b'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test\r\nDTSTART;VALUE=DATE:20260925\r\nSUMMARY:Bioabfall\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
FORM = '<form id="athos-os-form"><input name="pageName" value="Lageadresse">filedownload_ICAL</form>'
ADDRESS = {'municipality':'Biblis','street':'Teststraße','house_number':'1','latitude':49.6,'longitude':8.4}
SOURCE = {'id':'zakb-test','url':'https://example.org/calendar','interval_seconds':86400,
          'request_spacing_seconds':0,'municipalities':['Biblis','Bürstadt'],
          'address_url':'https://example.org/addresses','bbox':[49.55,8.3,49.8,8.65]}


def response(request):
    if request.url.path == '/addresses':
        return httpx.Response(200,json={'elements':[{'lat':49.6,'lon':8.4,'tags':{
            'addr:city':'Biblis','addr:street':'Teststraße','addr:housenumber':'1'}}]})
    return httpx.Response(200,content=ICAL if b'filedownload_ICAL' in request.content else FORM.encode())


class ResumeTests(DatabaseCase):
    async def test_address_checkpoint_survives_restart_but_expires(self):
        requests = []
        def provider(request):
            requests.append(request)
            return response(request)
        async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
            now = datetime.now(UTC)
            events, digest, fetched, reused = await calendar_for_address(self.conn,client,SOURCE,ADDRESS,now)
            self.assertFalse(reused)
            self.assertEqual(len(requests),4)
            again = await calendar_for_address(self.conn,client,SOURCE,ADDRESS,datetime.now(UTC))
            self.assertTrue(again[3])
            self.assertEqual(again[:3],(events,digest,fetched))
            self.assertEqual(len(requests),4)
            await self.conn.execute("UPDATE collection_checkpoints SET fetched_at=%s",(now-timedelta(days=2),))
            self.assertFalse((await calendar_for_address(self.conn,client,SOURCE,ADDRESS,datetime.now(UTC)))[3])
            self.assertEqual(len(requests),8)

    async def test_failed_run_preserves_calendar_and_reports_missing_municipalities(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
            self.assertEqual(await import_zakb(self.conn,client,SOURCE),'partial')
        calendar = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/calendar'")
        coverage = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/coverage'")
        self.assertFalse(coverage['complete_address_coverage'])
        self.assertEqual(coverage['municipalities']['Bürstadt']['sampled_streets'],0)
        await self.conn.execute('DELETE FROM collection_checkpoints')
        def unavailable(request):
            return response(request) if request.url.path == '/addresses' else httpx.Response(503)
        async with httpx.AsyncClient(transport=httpx.MockTransport(unavailable)) as client:
            self.assertEqual(await import_zakb(self.conn,client,SOURCE),'failed')
        self.assertEqual(await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/calendar'"),calendar)
        self.assertEqual(await self.scalar("SELECT COUNT(*) FROM collection_checkpoints WHERE item_key NOT LIKE 'address-inventory:%'"),0)

    async def test_tile_retry_only_acquires_missing_or_expired_tiles(self):
        source = {'id':'tiles','layer':'test','url':'https://example.org/wms','wms_layer':'web',
                  'interval_seconds':3600,'bbox':[49.60,8.40,49.61,8.41],
                  'min_zoom':8,'max_zoom':8,'request_interval_seconds':0}
        requests = []
        def provider(request):
            requests.append(request)
            return httpx.Response(200,content=b'\x89PNG\r\n\x1a\nfixture')
        async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
            await import_wms(self.conn,client,source)
            self.assertEqual(len(requests),1)
            await import_wms(self.conn,client,source)
            self.assertEqual(len(requests),1)
            await self.conn.execute("UPDATE collected_map_tiles SET fetched_at=NOW()-INTERVAL '2 hours'")
            await import_wms(self.conn,client,source)
            self.assertEqual(len(requests),2)

    async def test_run_budget_reports_unprocessed_streets_without_erasing_calendar(self):
        def inventory_provider(request):
            if request.url.path == '/addresses':
                return httpx.Response(200,json={'elements':[
                    {'lat':49.6,'lon':8.4,'tags':{'addr:city':'Biblis','addr:street':street,'addr:housenumber':'1'}}
                    for street in ['First','Second']
                ]})
            return response(request)
        async with httpx.AsyncClient(transport=httpx.MockTransport(inventory_provider)) as client:
            await import_zakb(self.conn,client,SOURCE)
            before=await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/calendar'")
            await self.conn.execute("DELETE FROM collection_checkpoints WHERE item_key NOT LIKE 'address-inventory:%'")
            result=await import_zakb(self.conn,client,{**SOURCE,'run_budget_seconds':0.1,'request_spacing_seconds':10})
        self.assertEqual(result,'failed')
        coverage=await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/coverage'")
        self.assertGreater(coverage['remaining_streets'],0)
        self.assertEqual(coverage['status'],'partial')
        self.assertEqual(await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/calendar'"),before)

    async def test_recently_rejected_addresses_do_not_starve_the_next_run(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
            await import_zakb(self.conn,client,SOURCE)
        await self.conn.execute("DELETE FROM collection_checkpoints WHERE item_key NOT LIKE 'address-inventory:%'")
        calls=[]
        def failing(request):
            calls.append(request)
            return httpx.Response(503)
        async with httpx.AsyncClient(transport=httpx.MockTransport(failing)) as client:
            await import_zakb(self.conn,client,SOURCE)
            before=len(calls)
            await import_zakb(self.conn,client,SOURCE)
            self.assertEqual(len(calls),before)
        coverage=await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/coverage'")
        self.assertEqual(coverage['municipalities']['Biblis']['deferred_calendars'],1)
        self.assertEqual(coverage['remaining_streets'],1)

    async def test_exhausted_network_budget_still_includes_all_fresh_calendars(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
            await import_zakb(self.conn,client,SOURCE)
        before=await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/calendar'")
        calls=[]
        def offline(request):
            calls.append(request)
            return httpx.Response(503)
        async with httpx.AsyncClient(transport=httpx.MockTransport(offline)) as client:
            await import_zakb(self.conn,client,{**SOURCE,'run_budget_seconds':0})
        self.assertEqual(calls,[])
        self.assertEqual(await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/calendar'"),before)
        coverage=await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/coverage'")
        self.assertEqual(coverage['municipalities']['Biblis']['reused_calendars'],1)
