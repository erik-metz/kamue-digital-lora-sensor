
import pytest
from osm_addresses import extract_addresses


def test_regional_nodes_and_way_centers_without_external_queries(tmp_path):
    path = tmp_path / 'fixture.osm'
    path.write_text('''<osm version="0.6">
    <node id="1" lat="49.6" lon="8.4"><tag k="addr:city" v="Biblis"/><tag k="addr:street" v="One"/><tag k="addr:housenumber" v="2"/></node>
    <node id="10" lat="49.64" lon="8.45"><tag k="railway" v="level_crossing"/><tag k="name" v="Test crossing"/></node>
    <node id="11" lat="52" lon="10"><tag k="railway" v="level_crossing"/></node>
    <node id="2" lat="49.62" lon="8.42"/>
    <node id="3" lat="52" lon="10"><tag k="addr:city" v="Biblis"/><tag k="addr:street" v="Outside"/><tag k="addr:housenumber" v="1"/></node>
    <node id="13" lat="49.61" lon="8.41"><tag k="amenity" v="school"/><tag k="name" v="Testschule"/></node>
    <node id="12" lat="49.61" lon="8.41"><tag k="power" v="generator"/></node>
    <way id="20"><nd ref="1"/><nd ref="2"/><nd ref="12"/><nd ref="1"/><tag k="landuse" v="farmland"/></way>
    <way id="5"><nd ref="1"/><nd ref="2"/><tag k="addr:city" v="Biblis"/><tag k="addr:street" v="Two"/><tag k="addr:housenumber" v="4"/></way>
    <way id="6"><nd ref="999"/><tag k="addr:city" v="Biblis"/><tag k="addr:street" v="Missing"/><tag k="addr:housenumber" v="4"/></way>
    </osm>''')
    source = {'municipalities': ['Biblis'], 'bbox': [49.55, 8.3, 49.8, 8.65]}
    data = extract_addresses(path, source)
    assert data['map_layers']['places']['features'][0]['properties']['name'] == 'Testschule'
    assert data['map_layers']['crops']['features'][0]['geometry']['type'] == 'Polygon'
    assert len(data['map_layers']['energy']['features']) == 1
    assert len(data['crossings']['features']) == 1
    crossing = data['crossings']['features'][0]
    assert crossing['geometry']['coordinates'] == [8.45, 49.64]
    assert crossing['properties']['status'] == 'unknown'
    assert [x['id'] for x in data['elements']] == [1, 5]
    assert data['elements'][1]['center']['lat'] == pytest.approx(49.61)
    assert data['elements'][1]['center']['lon'] == pytest.approx(8.41)
    with pytest.raises(ValueError, match='no matching'):
        extract_addresses(path, {**source, 'municipalities': ['Other']})
