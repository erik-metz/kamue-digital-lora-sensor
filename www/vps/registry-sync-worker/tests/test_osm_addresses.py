
import pytest
from osm_addresses import extract_addresses


def test_regional_nodes_and_way_centers_without_external_queries(tmp_path):
    path = tmp_path / 'fixture.osm'
    path.write_text('''<osm version="0.6">
    <node id="1" lat="49.6" lon="8.4"><tag k="addr:city" v="Biblis"/><tag k="addr:street" v="One"/><tag k="addr:housenumber" v="2"/></node>
    <node id="2" lat="49.62" lon="8.42"/>
    <node id="3" lat="52" lon="10"><tag k="addr:city" v="Biblis"/><tag k="addr:street" v="Outside"/><tag k="addr:housenumber" v="1"/></node>
    <way id="5"><nd ref="1"/><nd ref="2"/><tag k="addr:city" v="Biblis"/><tag k="addr:street" v="Two"/><tag k="addr:housenumber" v="4"/></way>
    <way id="6"><nd ref="999"/><tag k="addr:city" v="Biblis"/><tag k="addr:street" v="Missing"/><tag k="addr:housenumber" v="4"/></way>
    </osm>''')
    source = {'municipalities': ['Biblis'], 'bbox': [49.55, 8.3, 49.8, 8.65]}
    data = extract_addresses(path, source)
    assert [x['id'] for x in data['elements']] == [1, 5]
    assert data['elements'][1]['center']['lat'] == pytest.approx(49.61)
    assert data['elements'][1]['center']['lon'] == pytest.approx(8.41)
    with pytest.raises(ValueError, match='no matching'):
        extract_addresses(path, {**source, 'municipalities': ['Other']})
