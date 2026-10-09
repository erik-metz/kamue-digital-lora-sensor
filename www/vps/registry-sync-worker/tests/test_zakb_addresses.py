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
@pytest.mark.parametrize('ambiguous,substituted,spelling', [(False, False, False), (True, False, False), (False, True, False), (False, False, True)])
async def test_district_lookup_and_download_gate(ambiguous, substituted, spelling):
    address = {**ADDRESS, "street": "Domstiftstrasse"} if spelling else ADDRESS
    conn = MagicMock()
    cursor = MagicMock(); cursor.fetchone = AsyncMock(return_value=None)
    async def execute(query, params=None):
        cursor.fetchone.return_value = None if query.lstrip().startswith('SELECT') else (1,)
        return cursor
    conn.execute = AsyncMock(side_effect=execute); conn.commit = AsyncMock()
    downloads = []
    selected_city = 'Biblis'
    def provider(request):
        nonlocal selected_city
        fields = parse_qs(request.content.decode())
        action = fields.get('submitAction', [''])[0]
        city = fields.get('aos[Ort]', ['Biblis'])[0]
        if action == 'filedownload_ICAL':
            downloads.append(True)
            return httpx.Response(200, content=b'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n')
        if action == 'CITYCHANGED':
            selected_city = city
        if action == 'nextPage':
            city = selected_city
            assert fields['aos[Strasse]'] == ['Domstiftstraße']
            street = 'Altrheinstraße' if substituted else 'Domstiftstraße'
            return httpx.Response(200, text=f'<span id="Lageadresse">{street} 1, 68647 {city}</span><form id="athos-os-form"><input name="pageName" value="Terminliste">filedownload_ICAL</form>')
        street = 'Domstiftstraße' if city == 'Biblis-Nordheim' or (ambiguous and city == 'Biblis') else 'Andere Straße'
        return httpx.Response(200, text=f'<form id="athos-os-form"><select name="aos[Ort]"><option value="Biblis" {"selected" if city == "Biblis" else ""}></option><option value="Biblis-Nordheim" {"selected" if city == "Biblis-Nordheim" else ""}></option><option value="Biblis-Wattenheim" {"selected" if city == "Biblis-Wattenheim" else ""}></option></select><select name="aos[Strasse]"><option value="{street}"></option></select><input name="pageName" value="Lageadresse"></form>')
    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
        call = calendar_for_address(conn, client, {'id': 'test', 'url': 'https://example.org/calendar', 'interval_seconds': 86400, 'request_spacing_seconds': 0}, address, datetime.now(UTC))
        if ambiguous or substituted:
            with pytest.raises(AmbiguousStreet if ambiguous else AddressMismatch):
                await call
            assert not downloads
        else:
            await call
            assert downloads == [True]


@pytest.mark.asyncio
@pytest.mark.parametrize('city,street,canonical,expected_city,duplicate', [
    ('Biblis','Enggasse','Enggasse','Biblis-Nordheim',True),
    ('Biblis','Bachgasse','Bachgasse','Biblis',True),
    ('Biblis','Neuländer Pfad','Neuländerpfad','Biblis-Wattenheim',False),
    ('Biblis','Friedensstraße','Friedenstraße','Biblis',False),
    ('Bürstadt','Sofienstraße','Sophienstraße','Bürstadt',False),
    ('Bürstadt','Sofienstraße','Sofienstraße','Bürstadt',False),
    ('Bürstadt','Vinzenzstraße','Vincenzstraße','Bürstadt',False),
    ('Lampertheim','Wildbahn','Außerhalb Wildbahn','Lampertheim',False),
    ('Lampertheim','Am Küblinger Damm','Außerhalb Am Küblinger Damm','Lampertheim',False),
    ('Lampertheim','Außerhalb Ost','Außerhalb-Ost','Lampertheim',False),
    ('Lampertheim','Albert-Schweitzer-Straße','Albert-Schweitzer-Str.','Lampertheim',False),
    ('Lampertheim','Wilhelm-von-Ketteler-Straße','Wilhelm-v.-Ketteler-Straße','Lampertheim',False),
])
@pytest.mark.parametrize('substituted',[False,True])
async def test_reviewed_names_and_districts_still_require_exact_confirmation(city,street,canonical,expected_city,duplicate,substituted):
    conn = MagicMock()
    cursor = MagicMock(); cursor.fetchone = AsyncMock(return_value=None)
    async def execute(query, params=None):
        cursor.fetchone.return_value = None if query.lstrip().startswith('SELECT') else (1,)
        return cursor
    conn.execute = AsyncMock(side_effect=execute); conn.commit = AsyncMock()
    selected = city
    downloads = []
    cities = list(dict.fromkeys([city, expected_city, city+'-Nordheim'] if city=='Biblis' else [city]))
    def provider(request):
        nonlocal selected
        fields = parse_qs(request.content.decode())
        action = fields.get('submitAction',[''])[0]
        if action == 'CITYCHANGED':
            selected = fields['aos[Ort]'][0]
        if action == 'nextPage':
            assert fields['aos[Strasse]'] == [canonical]
            assert selected == expected_city
            name = 'Andere Straße' if substituted else canonical
            return httpx.Response(200,text=f'<span id="Lageadresse">{name} 1, 68647 {selected}</span><form id="athos-os-form"><input name="pageName" value="Terminliste">filedownload_ICAL</form>')
        if action == 'filedownload_ICAL':
            downloads.append(True)
            return httpx.Response(200,content=b'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n')
        options=''.join(f'<option value="{c}" {"selected" if c==selected else ""}></option>' for c in cities)
        offered=canonical if duplicate or selected==expected_city else 'Andere Straße'
        extra='<option value="Sophienstraße"></option>' if street==canonical=='Sofienstraße' else ''
        return httpx.Response(200,text=f'<form id="athos-os-form"><input name="pageName" value="Lageadresse"><select name="aos[Ort]">{options}</select><select name="aos[Strasse]"><option value="{offered}"></option>{extra}</select></form>')
    address={'municipality':city,'street':street,'house_number':'1'}
    source={'id':'test','url':'https://example.org/calendar','interval_seconds':86400,'request_spacing_seconds':0}
    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
        if substituted:
            with pytest.raises(AddressMismatch):
                await calendar_for_address(conn,client,source,address,datetime.now(UTC))
            assert downloads == []
        else:
            await calendar_for_address(conn,client,source,address,datetime.now(UTC))
            assert downloads == [True]
