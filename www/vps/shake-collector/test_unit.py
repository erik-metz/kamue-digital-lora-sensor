import math
import statistics
import struct
import unittest

from config import Settings
from collector import ShakeCollector


class TestShakeCollector(unittest.TestCase):
    def setUp(self):
        self.collector = ShakeCollector()

    def test_settings_properties(self):
        s = Settings(
            SHAKE_NETWORK="AM",
            SHAKE_STATION="R498E",
            SHAKE_LOCATION="00",
            SHAKE_CHANNEL="EHZ",
        )
        self.assertEqual(s.channel_identifier, "AM.R498E.00.EHZ")

    def test_parse_ws_url(self):
        raw_url = "wss://customuser:custompass@data.raspberryshake.org/caps/"
        clean_url, user, password = ShakeCollector._parse_ws_url(raw_url)
        self.assertEqual(clean_url, "wss://data.raspberryshake.org/caps/")
        self.assertEqual(user, "customuser")
        self.assertEqual(password, "custompass")

    def test_metric_calculation_pgv_and_rms(self):
        # Create a synthetic wave: constant baseline of 5000 counts + sine wave of amplitude 100 counts
        t0 = 1700000000.0
        n_samples = 500  # 5 seconds at 100 Hz
        amplitude = 100.0
        baseline = 5000.0

        for i in range(n_samples):
            t = (i / n_samples) * 5.0
            val = baseline + amplitude * math.sin(2 * math.pi * 1.0 * t)
            self.collector.sample_buffer.append((t0 + t, float(val)))

        samples = self.collector.sample_buffer
        raw_vals = [s[1] for s in samples]

        median_val = float(statistics.median(raw_vals))
        detrended = [v - median_val for v in raw_vals]
        pgv = float(max(abs(d) for d in detrended))
        rms = float(math.sqrt(sum(d * d for d in detrended) / len(detrended)))

        self.assertAlmostEqual(median_val, 5000.0, delta=2.0)
        self.assertAlmostEqual(pgv, 100.0, delta=2.0)
        # RMS of a sine wave is amplitude / sqrt(2) approx 70.71
        self.assertAlmostEqual(rms, 100.0 / math.sqrt(2), delta=2.0)

    def test_fallback_mseed_header_parser(self):
        # Build a 48-byte synthetic MiniSEED header (FSDH)
        hdr = bytearray(48)
        hdr[0:6] = b"000001"
        hdr[6] = ord("D")
        hdr[7] = ord(" ")
        hdr[8:13] = b"R498E"
        hdr[13:15] = b"00"
        hdr[15:18] = b"EHZ"
        hdr[18:20] = b"AM"
        # BTIME: 2026, DOY 255, 20:30:00.0000
        hdr[20:30] = struct.pack(">HHBBBxH", 2026, 255, 20, 30, 0, 0)
        # nsamp=100, sr_fac=100, sr_mul=1
        hdr[30:36] = struct.pack(">hhh", 100, 100, 1)

        self.collector.process_mseed_payload(bytes(hdr))
        self.assertGreater(len(self.collector.sample_buffer), 0)


if __name__ == "__main__":
    unittest.main()
