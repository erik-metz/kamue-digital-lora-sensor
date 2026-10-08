"""Reject substituted addresses and ambiguous district street assignments."""
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import parse_qs

import httpx
import pytest
from zakb import AddressMismatch, AmbiguousStreet, calendar_for_address, verify_address

ADDRESS = {'municipality': 'Biblis', 'street': 'Domstiftstraße', 'house_number': '1'}


def test_confirmation_requires_exact_address():
    verify_address('<span id="Lageadresse">Domstiftstraße    1, 68647 Biblis-Nordheim </span>', ADDRESS, 'Biblis-Nordheim')
    for value in ['Altrheinstraße 1, 68647 Biblis-Nordheim', 'Domstiftstraße 2, 68647 Biblis-Nordheim', 'Domstiftstraße 1, 68647 Biblis', '']:
        with pytest.raises(AddressMismatch):
            verify_address(f'<span id="Lageadresse">{value}</span>', ADDRESS, 'Biblis-Nordheim')


@pytest.mark.asyncio
@pytest.mark.parametrize('ambiguous,substituted', [(False, False), (True, False), (False, True)])
async def test_district_lookup_and_download_gate(ambiguous, substituted):
    conn = MagicMock()
    cursor = MagicMock(); cursor.fetchone = AsyncMock(return_value=None)
    async def execute(query, params=None):
        cursor.fetchone.return_value = None if query.lstrip().startswith('SELECT') else (1,)
        return cursor
    conn.execute = AsyncMock(side_effect=execute); conn.commit = AsyncMock()
    downloads = []
    def provider(request):
        fields = parse_qs(request.content.decode())
        action = fields.get('submitAction', [''])[0]
        city = fields.get('aos[Ort]', ['Biblis'])[0]
        if action == 'filedownload_ICAL':
            downloads.append(True)
            return httpx.Response(200, content=b'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n')
        if action == 'nextPage':
            street = 'Altrheinstraße' if substituted else 'Domstiftstraße'
            return httpx.Response(200, text=f'<span id="Lageadresse">{street} 1, 68647 {city}</span><form id="athos-os-form"><input name="pageName" value="Terminliste">filedownload_ICAL</form>')
        street = 'Domstiftstraße' if city == 'Biblis-Nordheim' or ambiguous else 'Andere Straße'
        return httpx.Response(200, text=f'<form id="athos-os-form"><select name="aos[Ort]"><option value="Biblis" {"selected" if city == "Biblis" else ""}></option><option value="Biblis-Nordheim" {"selected" if city == "Biblis-Nordheim" else ""}></option></select><select name="aos[Strasse]"><option value="{street}"></option></select><input name="pageName" value="Lageadresse"></form>')
    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
        call = calendar_for_address(conn, client, {'id': 'test', 'url': 'https://example.org/calendar', 'interval_seconds': 86400, 'request_spacing_seconds': 0}, ADDRESS, datetime.now(UTC))
        if ambiguous or substituted:
            with pytest.raises(AmbiguousStreet if ambiguous else AddressMismatch):
                await call
            assert not downloads
        else:
            await call
            assert downloads == [True]
