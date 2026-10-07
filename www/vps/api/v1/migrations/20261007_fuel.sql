-- Current regional snapshot only; integer prices in thousandths of EUR/litre.
CREATE TABLE IF NOT EXISTS fuel_snapshot (
    id integer PRIMARY KEY CHECK (id=1),
    fetched_at timestamptz NOT NULL,
    data jsonb NOT NULL
);
