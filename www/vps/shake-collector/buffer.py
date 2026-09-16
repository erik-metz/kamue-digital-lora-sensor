"""Bounded durable per-station FIFO; cursor and pending batches commit together."""

import json
import os
from pathlib import Path


class Spool:
    def __init__(self, path, capacity):
        self.path = Path(path)
        self.capacity = capacity
        self.state = {"watermark": None, "pending": []}
        if self.path.exists():
            self.state = json.loads(self.path.read_text())
            if (
                not isinstance(self.state.get("pending"), list)
                or "watermark" not in self.state
            ):
                raise ValueError("Invalid Shake spool; manual recovery required")

    def save(self, state):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        with temporary.open("w") as file:
            json.dump(state, file, allow_nan=False)
            file.flush()
            os.fsync(file.fileno())
        temporary.replace(self.path)
        self.state = state
        directory = os.open(self.path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)

    def append(self, batch):
        if len(self.state["pending"]) >= self.capacity:
            raise BufferError("Shake spool full")
        self.save(
            {
                "watermark": batch["window_end"],
                "pending": [*self.state["pending"], batch],
            }
        )

    def acknowledge(self):
        self.save({**self.state, "pending": self.state["pending"][1:]})
