"""Deterministic source-time windows. Counts are not calibrated velocity."""

import hashlib
import math
import statistics
from datetime import UTC, datetime


class Windows:
    def __init__(self, settings, watermark=None):
        self.settings = settings
        self.watermark = watermark
        self.samples = {}
        self.skipped = 0

    def add(self, samples):
        additions = {}
        for timestamp, value in samples:
            if not math.isfinite(timestamp) or not math.isfinite(value):
                raise ValueError("Non-finite waveform sample")
            if self.watermark is not None and timestamp < self.watermark:
                self.skipped += 1
                continue
            additions[round(timestamp, 6)] = value
        if len(self.samples.keys() | additions.keys()) > 200000:
            raise ValueError("Waveform window buffer exceeds 200000 samples")
        self.samples.update(additions)

    def ready(self, cutoff):
        width = self.settings.SAMPLING_INTERVAL_SEC
        groups = {}
        for timestamp, value in sorted(self.samples.items()):
            end = (math.floor(timestamp / width) + 1) * width
            if end <= cutoff:
                groups.setdefault(end, []).append((timestamp, value))
        for end, samples in sorted(groups.items()):
            median = statistics.median(value for _, value in samples)
            values = [value - median for _, value in samples]
            ts = datetime.fromtimestamp(end, UTC).isoformat()
            sid = self.settings.SENSOR_ID
            readings = [
                {
                    "sensor_id": sid,
                    "metric": metric,
                    "value": round(float(value), 2),
                    "unit": "counts",
                    "timestamp": ts,
                }
                for metric, value in (
                    ("pgv", max(abs(v) for v in values)),
                    ("rms", math.sqrt(sum(v * v for v in values) / len(values))),
                )
            ]
            if self.settings.STORE_RAW_WAVEFORM:
                readings.extend(
                    {
                        "sensor_id": sid,
                        "metric": "waveform",
                        "value": round(float(value), 2),
                        "unit": "counts",
                        "timestamp": datetime.fromtimestamp(timestamp, UTC).isoformat(),
                    }
                    for timestamp, value in samples[
                        :: self.settings.RAW_DECIMATION_FACTOR
                    ]
                )
            identity = f"{sid}:{width}:{end}"
            yield {
                "batch_id": hashlib.sha256(identity.encode()).hexdigest(),
                "window_end": end,
                "sample_count": len(samples),
                "readings": readings,
            }

    def acknowledge(self, batch):
        self.watermark = batch["window_end"]
        self.samples = {t: v for t, v in self.samples.items() if t >= self.watermark}
