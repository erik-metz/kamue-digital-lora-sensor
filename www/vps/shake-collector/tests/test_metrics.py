import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from buffer import Spool
from config import Settings, station_settings_list
from normalize import Windows


def config(**kwargs):
    with patch.dict("os.environ", {}, clear=True):
        base = replace(Settings.from_env(), **kwargs)
    return station_settings_list(base)[0]


class WindowTests(unittest.TestCase):
    def test_source_time_metrics_deduplication_and_late_samples(self):
        windows = Windows(config(STORE_RAW_WAVEFORM=True, RAW_DECIMATION_FACTOR=1))
        windows.add([(1000, -3), (1001, 0), (1002, 3), (1002, 3)])
        self.assertEqual(list(windows.ready(1004)), [])
        batch = next(iter(windows.ready(1005)))
        readings = batch["readings"]
        self.assertEqual(
            [r["metric"] for r in readings],
            ["pgv", "rms", "waveform", "waveform", "waveform"],
        )
        self.assertEqual([r["value"] for r in readings[:2]], [3, 2.45])
        self.assertEqual(readings[0]["timestamp"], "1970-01-01T00:16:45+00:00")
        windows.acknowledge(batch)
        windows.add([(1002, 3), (1005, 1)])
        self.assertEqual(windows.skipped, 1)
        self.assertEqual(len(list(windows.ready(1010))), 1)

    def test_windows_and_stations_are_independent(self):
        configs = station_settings_list(config().base)
        batches = []
        for station in configs[:2]:
            windows = Windows(station)
            windows.add([(1000, -1), (1001, 1), (1005, 2)])
            result = list(windows.ready(1010))
            self.assertEqual(len(result), 2)
            batches.append(result[0])
        self.assertNotEqual(batches[0]["batch_id"], batches[1]["batch_id"])

    def test_durable_queue_retains_exact_batch_and_cursor(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "spool.json"
            spool = Spool(path, 1)
            windows = Windows(config())
            windows.add([(1000, 1)])
            batch = next(iter(windows.ready(1005)))
            spool.append(batch)
            with self.assertRaises(BufferError):
                spool.append(batch)
            restarted = Spool(path, 1)
            self.assertEqual(restarted.state["pending"], [batch])
            self.assertEqual(restarted.state["watermark"], 1005)
            with (
                patch.object(Path, "replace", side_effect=OSError("disk")),
                self.assertRaises(OSError),
            ):
                restarted.acknowledge()
            self.assertEqual(restarted.state["pending"], [batch])
            restarted.acknowledge()
            self.assertEqual(Spool(path, 1).state, {"watermark": 1005, "pending": []})
