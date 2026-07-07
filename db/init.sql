-- Выполняется автоматически при первом старте контейнера postgres
-- (docker-entrypoint-initdb.d подхватывает *.sql на пустом volume).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  address     TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  -- geography(Point) хранит lat/lng в метрах "из коробки" — ST_DWithin ниже
  -- сразу считает расстояние в метрах без ручной гаверсинус-математики.
  location    GEOGRAPHY(Point, 4326) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIST-индекс — тот самый, который делает /parties/near быстрым на больших объёмах
CREATE INDEX IF NOT EXISTS parties_location_idx ON parties USING GIST (location);
CREATE INDEX IF NOT EXISTS parties_starts_at_idx ON parties (starts_at);
