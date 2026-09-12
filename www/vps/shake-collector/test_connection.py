"""Quick connectivity and parsing test for Raspberry Shake CAPS stream."""

import asyncio
from datetime import datetime, timezone, timedelta
import io
import json
import logging
import struct
import sys

from config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("test-connection")

try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False
    websockets = None

try:
    from obspy import read as obspy_read
    HAS_OBSPY = True
except ImportError:
    HAS_OBSPY = False


def test_live_stream_socket():
    import socket
    import ssl
    import base64

    host = "data.raspberryshake.org"
    ctx = ssl.create_default_context()
    s = socket.create_connection((host, 443), timeout=5)
    ss = ctx.wrap_socket(s, server_hostname=host)

    auth = base64.b64encode(b"swarm:ujHsN9qbYiTAx69H").decode("ascii")
    req = (
        "GET /caps/?days=1 HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "Sec-WebSocket-Protocol: caps\r\n"
        f"Authorization: Basic {auth}\r\n"
        "\r\n"
    )
    ss.sendall(req.encode("utf-8"))
    res = ss.recv(1024).decode("utf-8", errors="ignore")
    assert "101 Switching Protocols" in res, f"Handshake failed: {res}"

    def make_frame(text):
        data = text.encode("utf-8")
        header = bytearray([0x81])
        mask = [0x12, 0x34, 0x56, 0x78]
        if len(data) < 126:
            header.append(0x80 | len(data))
        elif len(data) <= 65535:
            header.append(0x80 | 126)
            header.extend(struct.pack(">H", len(data)))
        header.extend(mask)
        masked = bytearray(b ^ mask[i % 4] for i, b in enumerate(data))
        return header + masked

    def recv_frame():
        hdr = ss.recv(2)
        if not hdr:
            return None, None
        opcode = hdr[0] & 0x0F
        l = hdr[1] & 0x7F
        if l == 126:
            l = struct.unpack(">H", ss.recv(2))[0]
        elif l == 127:
            l = struct.unpack(">Q", ss.recv(8))[0]
        data = bytearray()
        while len(data) < l:
            chunk = ss.recv(min(l - len(data), 65536))
            if not chunk:
                break
            data.extend(chunk)
        return opcode, bytes(data)

    ss.sendall(make_frame("hello"))
    op, data = recv_frame()
    logger.info("Welcome received: %s", data.decode("utf-8", errors="ignore").strip().replace("\n", " | "))

    ss.sendall(make_frame("auth swarm ujHsN9qbYiTAx69H"))
    t_start = datetime.now(timezone.utc) - timedelta(seconds=10)
    time_str = f"{t_start.year},{t_start.month:02d},{t_start.day:02d},{t_start.hour:02d},{t_start.minute:02d},{t_start.second:02d}"
    req_cmd = f"begin request\ntime {time_str}:\nstream add {settings.channel_identifier}\nend"
    logger.info("Requesting channel %s from %s...", settings.channel_identifier, time_str)
    ss.sendall(make_frame(req_cmd))

    records_received = 0
    samples_received = 0
    for _ in range(5):
        op, data = recv_frame()
        if op is None:
            break
        if op == 1:
            logger.info("Control message: %s", data.decode("utf-8", errors="ignore").strip())
        elif op == 2:
            offset = 0
            while offset + 6 <= len(data):
                req_id, dlen = struct.unpack_from("<hi", data, offset)
                offset += 6
                if offset + dlen > len(data):
                    break
                payload = data[offset : offset + dlen]
                offset += dlen
                records_received += 1
                sta = payload[8:13].decode("ascii", errors="ignore").strip()
                cha = payload[15:18].decode("ascii", errors="ignore").strip()
                nsamp = struct.unpack(">h", payload[30:32])[0]
                samples_received += nsamp
                logger.info(
                    "Parsed MiniSEED Record #%d: sta=%s, cha=%s, nsamp=%d (payload_len=%d)",
                    records_received,
                    sta,
                    cha,
                    nsamp,
                    len(payload),
                )
    ss.close()
    logger.info("Test finished! Records: %d, Samples: %d", records_received, samples_received)
    assert records_received > 0, "No records received!"
    print("TEST PASSED: Successfully connected and verified stream.")


async def test_live_stream():
    if not HAS_WEBSOCKETS:
        logger.info("websockets library not found on host; using standard library socket implementation.")
        test_live_stream_socket()
        return

    clean_url = "wss://data.raspberryshake.org/caps/?days=1"
    logger.info("Connecting to %s...", clean_url)

    async with websockets.connect(
        clean_url,
        subprotocols=["caps"],
        ping_interval=20,
        ping_timeout=20,
    ) as ws:
        # 1. Hello
        await ws.send("hello")
        welcome = await ws.recv()
        logger.info("Welcome received: %s", str(welcome).strip().replace("\n", " | "))

        # 2. Auth
        await ws.send("auth swarm ujHsN9qbYiTAx69H")

        # 3. Stream request
        t_start = datetime.now(timezone.utc) - timedelta(seconds=10)
        time_str = f"{t_start.year},{t_start.month:02d},{t_start.day:02d},{t_start.hour:02d},{t_start.minute:02d},{t_start.second:02d}"
        req_cmd = f"begin request\ntime {time_str}:\nstream add {settings.channel_identifier}\nend"
        logger.info("Requesting channel %s from %s...", settings.channel_identifier, time_str)
        await ws.send(req_cmd)

        records_received = 0
        samples_received = 0

        # Read for up to 5 packets or 10 seconds
        start_t = asyncio.get_event_loop().time()
        while records_received < 3 and (asyncio.get_event_loop().time() - start_t) < 10:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            except asyncio.TimeoutError:
                break

            if isinstance(msg, str):
                logger.info("Control message: %s", msg.strip())
            elif isinstance(msg, bytes):
                offset = 0
                msg_len = len(msg)
                while offset + 6 <= msg_len:
                    req_id, dlen = struct.unpack_from("<hi", msg, offset)
                    offset += 6
                    if offset + dlen > msg_len:
                        break
                    payload = msg[offset : offset + dlen]
                    offset += dlen

                    records_received += 1
                    if HAS_OBSPY:
                        st = obspy_read(io.BytesIO(payload), format="MSEED")
                        for tr in st:
                            samples_received += len(tr.data)
                            logger.info(
                                "Decoded MiniSEED Record #%d: station=%s, channel=%s, samples=%d, rate=%.1fHz, start=%s",
                                records_received,
                                tr.stats.station,
                                tr.stats.channel,
                                len(tr.data),
                                tr.stats.sampling_rate,
                                tr.stats.starttime,
                            )
                    else:
                        sta = payload[8:13].decode("ascii", errors="ignore").strip()
                        cha = payload[15:18].decode("ascii", errors="ignore").strip()
                        nsamp = struct.unpack(">h", payload[30:32])[0]
                        samples_received += nsamp
                        logger.info(
                            "Parsed MiniSEED Header Record #%d: sta=%s, cha=%s, nsamp=%d (total len=%d)",
                            records_received,
                            sta,
                            cha,
                            nsamp,
                            len(payload),
                        )

        logger.info("Test finished! Records: %d, Samples: %d", records_received, samples_received)
        assert records_received > 0, "No records received from stream!"
        print("TEST PASSED: Successfully connected and verified stream.")


if __name__ == "__main__":
    asyncio.run(test_live_stream())
