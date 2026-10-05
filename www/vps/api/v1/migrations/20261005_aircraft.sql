-- Observed aircraft reuse the common movement history and measurement writer.
ALTER TABLE movement_positions DROP CONSTRAINT IF EXISTS movement_positions_kind_check;
ALTER TABLE movement_positions ADD CONSTRAINT movement_positions_kind_check
    CHECK(kind IN ('bus','train','waste','ship','aircraft'));
INSERT INTO collection_sources(id,source_url,adapter,enabled,interval_seconds,description)
VALUES ('adsblol-ried','https://www.adsb.lol/','adsb-json',true,15,
    'Received aircraft over the buffered Ried; adsb.lol ODbL 1.0; incomplete coverage, no OGN adapter yet')
ON CONFLICT(id) DO NOTHING;
