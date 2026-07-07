-- Выполняется автоматически при первом старте контейнера postgres

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  address     TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  location    GEOGRAPHY(Point, 4326) NOT NULL,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parties_location_idx ON parties USING GIST (location);
CREATE INDEX IF NOT EXISTS parties_starts_at_idx ON parties (starts_at);

-- Таблица участников вечеринок
CREATE TABLE IF NOT EXISTS party_members (
  party_id   UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

CREATE INDEX IF NOT EXISTS party_members_user_idx ON party_members (user_id);
