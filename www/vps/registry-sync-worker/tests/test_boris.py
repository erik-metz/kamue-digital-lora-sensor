import unittest

from boris import parse_page

SOURCE = {'id': 'boris-test', 'url': 'https://example.org/wfs', 'reference_date': '2024-01-01',
          'bbox': [49.45, 8.25, 49.90, 8.75], 'max_age_seconds': 157852800,
          'municipalities': {'06431003': 'Biblis', '06431005': 'Bürstadt',
                             '06431010': 'Groß-Rohrheim', '06431013': 'Lampertheim'}}


def page(empty=False):
    members = ''
    for ags, name in ([] if empty else SOURCE['municipalities'].items()):
        members += f'''<w:member><b:BR_BodenrichtwertZonal g:id="id-{ags}">
<b:gemeinde><b:BR_Gemeinde><b:kennzeichen><b:BR_Gemeindekennzeichen><b:land>06</b:land><b:regierungsbezirk>4</b:regierungsbezirk><b:kreis>31</b:kreis><b:gemeinde>{ags[-3:]}</b:gemeinde></b:BR_Gemeindekennzeichen></b:kennzeichen><b:name>{name}</b:name></b:BR_Gemeinde></b:gemeinde>
<b:bodenrichtwertNummer>{ags}</b:bodenrichtwertNummer><b:bodenrichtwert>4.7</b:bodenrichtwert><b:stichtag>2024-01-01</b:stichtag><b:bodenrichtwertArt>1</b:bodenrichtwertArt><b:entwicklungszustand>LF</b:entwicklungszustand><b:nutzung><b:BR_Nutzung><b:art>LW</b:art></b:BR_Nutzung></b:nutzung>
<a:position><g:Polygon srsName="urn:ogc:def:crs:EPSG::4326" srsDimension="2"><g:exterior><g:LinearRing><g:posList>49.6 8.4 49.6 8.5 49.7 8.5 49.6 8.4</g:posList></g:LinearRing></g:exterior><g:interior><g:LinearRing><g:posList>49.62 8.44 49.62 8.45 49.63 8.45 49.62 8.44</g:posList></g:LinearRing></g:interior></g:Polygon></a:position>
</b:BR_BodenrichtwertZonal></w:member>'''
    return (f'<w:FeatureCollection xmlns:w="http://www.opengis.net/wfs/2.0" xmlns:b="http://www.adv-online.de/namespaces/adv/brm/2.1" xmlns:a="http://www.adv-online.de/namespaces/adv/gid/7.1" xmlns:g="http://www.opengis.net/gml/3.2" numberReturned="{0 if empty else 4}" numberMatched="unknown">'+members+'</w:FeatureCollection>').encode()


class BorisTests(unittest.TestCase):
    def test_preserve_values_axis_order_holes_and_original_types(self):
        ids, zones = parse_page(page(), SOURCE)
        self.assertEqual(len(ids), 4)
        self.assertEqual(zones[0]['land_value_eur_sqm'], 4.7)
        self.assertEqual(zones[0]['geometry']['coordinates'][0][0], [8.4, 49.6])
        self.assertEqual(len(zones[0]['geometry']['coordinates']), 2)
        self.assertEqual(zones[0]['zone_type'], 'LW')
        self.assertEqual(parse_page(page(True), SOURCE), ([], []))

    def test_reject_inconsistent_count_crs_axis_name_date_and_price(self):
        for old, new in [(b'numberReturned="4"', b'numberReturned="5"'),
                         (b'49.6 8.4', b'8.4 49.6'), (b'2024-01-01', b'2026-01-01'),
                         (b'4.7', b'NaN'), (b'Biblis', b'Falsch'),
                         (b'EPSG::4326', b'EPSG::25832')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                parse_page(page().replace(old, new), SOURCE)
        with self.assertRaises(ValueError):
            parse_page(b'<ExceptionReport/>', SOURCE)
