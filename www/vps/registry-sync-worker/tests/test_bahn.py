import io
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import httpx
from bahn import (
    facility_records,
    import_ris_stations,
    import_siri,
    parse_netex,
    parse_siri,
)
from defusedxml.common import EntitiesForbidden
from publications import acquire

NOW = datetime(2026, 10, 5, 18, tzinfo=UTC)


def netex(name="Biblis"):
    return f"""<PublicationDelivery xmlns="http://www.netex.org.uk/netex">
    <PublicationTimestamp>2026-10-05T01:00:00Z</PublicationTimestamp>
    <dataObjects><SiteFrame><stopPlaces><StopPlace id="dhid:station">
    <keyList><KeyValue><Key>NORMALIZED_ID_URI</Key><Value>https://station/1</Value></KeyValue>
    <KeyValue><Key>EVA</Key><Value>8000503</Value></KeyValue>
    <KeyValue><Key>EVA</Key><Value>8099999</Value></KeyValue>
    <KeyValue><Key>RIL</Key><Value>FBL</Value></KeyValue></keyList>
    <Name>{name}</Name><PrivateCode>1</PrivateCode>
    <quays><Quay id="q"><keyList><KeyValue><Key>NORMALIZED_ID_URI</Key><Value>https://quay/1</Value></KeyValue></keyList>
    <Centroid><Location><Latitude>49.68</Latitude><Longitude>8.44</Longitude></Location></Centroid>
    <QuayType>railPlatform</QuayType></Quay></quays>
    <placeEquipments><LiftEquipment id="diid:lift"><keyList><KeyValue><Key>NORMALIZED_ID_URI</Key>
    <Value>https://id.vdv.de/diid/lift</Value></KeyValue></keyList></LiftEquipment></placeEquipments>
    </StopPlace></stopPlaces></SiteFrame></dataObjects></PublicationDelivery>""".encode()


def siri(status="unknown", timestamp=NOW):
    return f"""<Siri xmlns="http://www.siri.org.uk/siri"><ServiceDelivery>
    <ResponseTimestamp>{timestamp.isoformat()}</ResponseTimestamp><FacilityMonitoringDelivery>
    <FacilityCondition><FacilityRef>diid:lift</FacilityRef><FacilityStatus><Status>{status}</Status>
    <Description>not monitored</Description></FacilityStatus></FacilityCondition>
    </FacilityMonitoringDelivery></ServiceDelivery></Siri>""".encode()


class BahnParserTests(unittest.TestCase):
    def test_inventory_preserves_ids_missing_coordinates_and_platform_location(self):
        timestamp, stations = parse_netex(
            io.BytesIO(netex()), {"station_names": ["Biblis"]}
        )
        self.assertEqual(timestamp.tzinfo, UTC)
        station = stations[0]
        self.assertEqual(station["eva_numbers"], ["8000503", "8099999"])
        self.assertEqual(station["ds100_codes"], ["FBL"])
        self.assertIsNone(station["coordinates"])
        self.assertEqual(station["components"][0]["coordinates"]["latitude"], 49.68)
        self.assertIsNone(station["components"][1]["coordinates"])

    def test_partial_station_inventory_and_wrong_format_rejected(self):
        with self.assertRaises(ValueError):
            parse_netex(
                io.BytesIO(netex()), {"station_names": ["Biblis", "Lampertheim"]}
            )
        with self.assertRaises(ValueError):
            parse_netex(io.BytesIO(b"<html/>"), {"station_names": ["Biblis"]})

    def test_facility_matching_uses_normalized_id_and_missing_is_unknown(self):
        _, stations = parse_netex(io.BytesIO(netex()), {"station_names": ["Biblis"]})
        result = facility_records(
            stations,
            {
                "https://id.vdv.de/diid/other": {
                    "status": "available",
                    "description": None,
                }
            },
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["status"], "unknown")
        self.assertEqual(result[0]["status_basis"], "not_reported")
        result = facility_records(
            stations,
            {
                "https://id.vdv.de/diid/lift": {
                    "status": "notAvailable",
                    "description": "maintenance",
                }
            },
        )
        self.assertEqual(result[0]["status"], "notAvailable")
        self.assertEqual(result[0]["status_basis"], "reported")

    def test_entities_are_rejected(self):
        data = b'<!DOCTYPE foo [<!ENTITY x "expanded">]><foo>&x;</foo>'
        with self.assertRaises(EntitiesForbidden):
            parse_netex(io.BytesIO(data), {"station_names": ["Biblis"]})

    def test_unknown_unavailable_and_stale_status(self):
        for status in ["unknown", "available", "notAvailable"]:
            timestamp, records = parse_siri(io.BytesIO(siri(status)), NOW)
            self.assertEqual(timestamp, NOW)
            self.assertEqual(records["https://id.vdv.de/diid/lift"]["status"], status)
        for timestamp in [NOW - timedelta(minutes=6), NOW + timedelta(minutes=2)]:
            with self.assertRaises(ValueError):
                parse_siri(io.BytesIO(siri(timestamp=timestamp)), NOW)
        with self.assertRaises(ValueError):
            parse_siri(io.BytesIO(siri("made-up")), NOW)


class BahnImportTests(unittest.IsolatedAsyncioTestCase):
    async def test_no_siri_publication_without_fresh_inventory(self):
        conn, client = AsyncMock(), AsyncMock()
        conn.execute.return_value.fetchone.return_value = None
        with self.assertRaises(ValueError):
            await import_siri(conn, client, {"id": "siri"})
        client.stream.assert_not_called()

    async def test_ris_partial_failure_never_publishes(self):
        conn = AsyncMock()
        source = {
            "url": "https://apis.deutschebahn.com/stop-places",
            "eva_numbers": ["8000503", "8003503"],
        }
        with (
            patch(
                "bahn.acquire",
                AsyncMock(
                    side_effect=[
                        (
                            httpx.Response(
                                200, json={"stopPlaces": [{"evaNumber": "8000503"}]}
                            ),
                            "hash",
                            1,
                        ),
                        ValueError("second station failed"),
                    ]
                ),
            ),
            patch("bahn.publish", AsyncMock()) as publish,
        ):
            with self.assertRaises(ValueError):
                await import_ris_stations(conn, AsyncMock(), source)
            publish.assert_not_called()

    async def test_missing_credentials_fail_before_http_request(self):
        client = AsyncMock()
        with patch.dict("os.environ", {}, clear=True), self.assertRaises(ValueError):
            await acquire(
                AsyncMock(),
                client,
                {
                    "url": "https://apis.deutschebahn.com",
                    "header_env": {"DB-Api-Key": "DB_API_KEY"},
                },
            )
        client.get.assert_not_called()
