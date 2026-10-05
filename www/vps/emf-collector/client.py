"""Client for BNetzA EMF database scraping and decryption."""

import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from bs4 import BeautifulSoup
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import httpx

from config import Settings

LOG = logging.getLogger("emf-collector.client")

CRYPTO_PW_RE = re.compile(r'var c=CryptoJS\.enc\.Utf8\.parse\("(.*?)"\);')


def decrypt_bnetza_payload(data_base64: str, password: str) -> list[dict[str, Any]]:
    """Decrypt AES-128-CBC payload from BNetzA Standortservice."""
    backend = default_backend()
    iv = bytes.fromhex("a5a8d2e9c1721ae0e84ad660c472b1f3")
    salt = b"cryptography123example"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA1(),
        length=16,
        salt=salt,
        iterations=1000,
        backend=backend,
    )
    key = kdf.derive(password.encode("utf-8"))
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=backend)
    decryptor = cipher.decryptor()
    raw = decryptor.update(base64.b64decode(data_base64)) + decryptor.finalize()
    pad_len = raw[-1]
    unpadded = raw[:-pad_len]
    return json.loads(unpadded.decode("utf-8"))


def parse_float_german(val_str: str | None) -> float | None:
    if not val_str:
        return None
    cleaned = val_str.strip().replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


@dataclass
class AntennaDetail:
    type_name: str
    height_m: float | None
    direction_deg: float | None
    safety_distance_h_m: float | None
    safety_distance_v_m: float | None


@dataclass
class EmfSiteDetails:
    fid: int
    stob_nr: str | None
    stob_date: str | None
    method_stob: str
    providers: list[str]
    antennas: list[AntennaDetail]


class BNetzAEmfClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.settings = settings
        self.client = client
        self.password: str | None = None

    async def init_session(self) -> None:
        """Extract dynamic decryption password from BNetzA frontend script."""
        js_url = f"{self.settings.base_url}/emf-karte/js.asmx/jscontent?set=gsb2021"
        resp = await self.client.get(
            js_url,
            headers={"Referer": f"{self.settings.base_url}/DE/Vportal/TK/Funktechnik/EMF/start.html"},
        )
        resp.raise_for_status()

        match = CRYPTO_PW_RE.search(resp.text)
        if not match:
            raise RuntimeError("Could not find CryptoJS key in BNetzA jscontent script")
        self.password = match.group(1)
        LOG.debug("Session initialized with dynamic key")

    async def get_sites_in_bbox(
        self, min_lat: float, max_lat: float, min_lon: float, max_lon: float
    ) -> list[dict[str, Any]]:
        """Fetch sites within a single bounding box."""
        if not self.password:
            await self.init_session()

        url = f"{self.settings.base_url}/emf-karte/Standortservice.asmx/GetStandorteFreigabe"
        payload = {
            "Box": {
                "nord": max_lat,
                "ost": max_lon,
                "sued": min_lat,
                "west": min_lon,
            }
        }
        resp = await self.client.post(
            url,
            headers={
                "Referer": f"{self.settings.base_url}/DE/Vportal/TK/Funktechnik/EMF/start.html",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        res_data = resp.json().get("d", {})

        if isinstance(res_data, dict) and res_data.get("SecMode"):
            return decrypt_bnetza_payload(res_data["Result"], self.password)  # type: ignore
        if isinstance(res_data, list):
            return res_data
        return []

    async def get_all_sites_tiled(
        self,
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
        tile_size: float = 0.08,
    ) -> list[dict[str, Any]]:
        """Fetch sites across a larger bounding box by partitioning it into small tiles (BNetzA limit ~0.1 deg)."""
        seen_fids = set()
        all_sites = []

        cur_lat = min_lat
        while cur_lat < max_lat:
            next_lat = min(cur_lat + tile_size, max_lat)
            cur_lon = min_lon
            while cur_lon < max_lon:
                next_lon = min(cur_lon + tile_size, max_lon)
                LOG.debug(
                    "Querying BNetzA tile [%.4f, %.4f] to [%.4f, %.4f]",
                    cur_lat,
                    cur_lon,
                    next_lat,
                    next_lon,
                )
                try:
                    await asyncio.sleep(0.15)
                    sites = await self.get_sites_in_bbox(cur_lat, next_lat, cur_lon, next_lon)
                    for s in sites:
                        fid = s.get("fID")
                        if fid and fid not in seen_fids:
                            seen_fids.add(fid)
                            all_sites.append(s)
                except Exception as exc:
                    LOG.warning("Failed to query tile [%.4f, %.4f]: %s", cur_lat, cur_lon, exc)

                cur_lon = next_lon
            cur_lat = next_lat

        return all_sites

    async def get_site_details(self, fid: int) -> EmfSiteDetails:
        """Fetch and parse detailed HTML page for a site."""
        url = f"{self.settings.base_url}/emf-karte/hf.aspx"
        resp = await self.client.get(
            url,
            params={"fid": fid},
            headers={"Referer": f"{self.settings.base_url}/DE/Vportal/TK/Funktechnik/EMF/start.html"},
        )
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # STOB-Nummer
        stob_nr = None
        bnr_span = soup.find("span", id="LabelStobnummer")
        if bnr_span:
            stob_nr = bnr_span.get_text(strip=True)

        # Datum
        stob_date = None
        date_span = soup.find("span", id="LabelStobDatum")
        if date_span:
            stob_date = date_span.get_text(strip=True)

        # Method
        if soup.find("div", id="standortWattwaechter"):
            method = "feldtheoretisch"
        elif soup.find("div", id="standortGrenzmessung"):
            method = "messtechnisch"
        else:
            method = "rechnerisch"

        # Providers
        providers: list[str] = []
        prov_div = soup.find("div", id="div_mobilfunkanbieter")
        if prov_div:
            for img in prov_div.find_all("img"):
                alt = img.get("alt")
                if alt and alt not in providers:
                    providers.append(alt)

        # Antennas
        antennas: list[AntennaDetail] = []
        ant_div = soup.find("div", id="div_sendeantennen")
        if ant_div:
            table = ant_div.find("table")
            if table:
                rows = table.find_all("tr")
                for row in rows:
                    cols = row.find_all("td")
                    if len(cols) == 5 and "tabHead" not in cols[0].get("class", []):
                        atype = cols[0].get_text(strip=True)
                        h_txt = cols[1].get_text(strip=True)
                        dir_txt = cols[2].get_text(strip=True)
                        sa_h_txt = cols[3].get_text(strip=True)
                        sa_v_txt = cols[4].get_text(strip=True)

                        direction = None if dir_txt == "ND" else parse_float_german(dir_txt)
                        sa_h = None if "nicht angegeben" in sa_h_txt else parse_float_german(sa_h_txt)
                        sa_v = None if "nicht angegeben" in sa_v_txt else parse_float_german(sa_v_txt)

                        antennas.append(
                            AntennaDetail(
                                type_name=atype,
                                height_m=parse_float_german(h_txt),
                                direction_deg=direction,
                                safety_distance_h_m=sa_h,
                                safety_distance_v_m=sa_v,
                            )
                        )

        return EmfSiteDetails(
            fid=fid,
            stob_nr=stob_nr,
            stob_date=stob_date,
            method_stob=method,
            providers=providers,
            antennas=antennas,
        )
