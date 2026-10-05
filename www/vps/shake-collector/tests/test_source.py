import importlib.util
import io
import struct
import unittest
from unittest.mock import AsyncMock, Mock, patch

from source import stream_samples
from test_metrics import config


@unittest.skipUnless(
    importlib.util.find_spec("obspy"), "Requires production ObsPy decoder"
)
class DecoderTests(unittest.IsolatedAsyncioTestCase):
    async def test_decodes_only_requested_station_and_rejects_truncated_frame(self):
        import numpy as np
        from obspy import Stream, Trace, UTCDateTime

        station = config()
        trace = Trace(
            data=np.array([-3, 0, 3], dtype=np.int32),
            header={
                "network": "AM",
                "station": "R498E",
                "location": "00",
                "channel": "EHZ",
                "sampling_rate": 1,
                "starttime": UTCDateTime(1000),
            },
        )
        other = trace.copy()
        other.stats.station = "R82E7"
        data = io.BytesIO()
        Stream([trace, other]).write(data, format="MSEED")
        payload = data.getvalue()
        socket = AsyncMock()
        socket.__aenter__.return_value = socket
        socket.recv.side_effect = [
            "welcome",
            struct.pack("<hi", 1, len(payload)) + payload,
            b"truncated",
        ]
        with patch("source.websockets.connect", return_value=socket) as connect:
            stream = stream_samples(station, 1000)
            self.assertEqual(await anext(stream), [(1000, -3), (1001, 0), (1002, 3)])
            with self.assertRaises(ValueError):
                await anext(stream)
            await stream.aclose()
            self.assertIsNone(connect.call_args.kwargs["ping_timeout"])
            self.assertEqual(connect.call_args.kwargs["ping_interval"], 20)

    async def test_no_waveforms_reconnect_even_if_text_messages_arrive(self):
        socket = AsyncMock()
        socket.__aenter__.return_value = socket
        socket.recv.side_effect = ["welcome", "notice"]
        loop = Mock()
        loop.time.side_effect = [0, 0, 91]
        with (
            patch("source.websockets.connect", return_value=socket),
            patch("source.asyncio.get_running_loop", return_value=loop),
        ):
            stream = stream_samples(config(), 1000)
            with self.assertRaisesRegex(TimeoutError, "No waveform"):
                await anext(stream)
            await stream.aclose()
