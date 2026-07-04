-- ============================================================
-- Build-with-AI — Database Schema
-- Apply once to a fresh Postgres / Supabase project.
-- This is the shared contract: every track (bot, pipeline, api,
-- frontend) reads/writes these tables. Don't change column names
-- without telling the whole team.
-- ============================================================

-- ---------- Wards (the geographic skeleton) ----------
CREATE TABLE wards (
  id                    SERIAL PRIMARY KEY,
  ward_no               TEXT,
  name                  TEXT NOT NULL,
  aliases               TEXT[] DEFAULT '{}',      -- colloquial names citizens actually say
  geom                  JSONB,                     -- GeoJSON polygon
  centroid_lat          DOUBLE PRECISION,
  centroid_lng          DOUBLE PRECISION,
  population            INT,
  literacy_rate         REAL,
  female_literacy_rate  REAL,
  internet_pct          REAL,
  sc_st_pct             REAL,
  amenity_index         REAL,                      -- composite deprivation score, 0-1 (higher = more deprived)
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ---------- Citizens ----------
CREATE TABLE citizens (
  id                SERIAL PRIMARY KEY,
  channel           TEXT NOT NULL,                 -- 'telegram' | 'web' | 'whatsapp' | 'ivr'
  channel_user_id   TEXT NOT NULL,                 -- tg chat_id, web session id, phone number
  name              TEXT,
  ward_id           INT REFERENCES wards(id),
  language          TEXT DEFAULT 'hi',
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (channel, channel_user_id)
);

-- ---------- Submissions (every citizen message, any channel) ----------
CREATE TABLE submissions (
  id                  SERIAL PRIMARY KEY,
  citizen_id          INT REFERENCES citizens(id),
  channel             TEXT NOT NULL,               -- 'telegram' | 'web' | 'whatsapp' | 'ivr' | 'synthetic'
  media_type          TEXT NOT NULL,               -- 'text' | 'voice' | 'photo'
  raw_text            TEXT,                        -- original message text, if any
  transcript          TEXT,                        -- ASR transcript, if voice
  media_ref           TEXT,                        -- storage path/URL for audio or photo

  -- extracted fields (filled by the LLM extraction step — never by hand)
  ask                 TEXT,
  category            TEXT,                        -- education | water | roads | health | electricity | other
  sub_type            TEXT,
  urgency_signals     TEXT[],
  language            TEXT,

  -- location
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  location_text       TEXT,
  ward_id             INT REFERENCES wards(id),
  ward_resolution     TEXT,                        -- 'gps' | 'alias_match' | 'manual_review'

  -- trust / moderation
  is_verified_photo   BOOLEAN DEFAULT false,
  flagged_suspicious  BOOLEAN DEFAULT false,

  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_submissions_ward ON submissions(ward_id);
CREATE INDEX idx_submissions_category ON submissions(category);

-- ---------- Evidence (public datasets, long format — easy to extend) ----------
CREATE TABLE evidence (
  id          SERIAL PRIMARY KEY,
  ward_id     INT REFERENCES wards(id),
  category    TEXT NOT NULL,                       -- education | water | roads | health
  metric      TEXT NOT NULL,                        -- e.g. 'enrollment_per_classroom', 'tap_coverage_pct'
  value       REAL,
  gap_score   REAL,                                 -- normalized 0-1, higher = worse gap
  source      TEXT,                                 -- 'UDISE+' | 'JJM' | 'PMGSY' | 'Census'
  year        INT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_evidence_ward_cat ON evidence(ward_id, category);

-- ---------- Themes (clustered demand — the pipeline's main output) ----------
CREATE TABLE themes (
  id             SERIAL PRIMARY KEY,
  ward_id        INT REFERENCES wards(id),
  category       TEXT NOT NULL,
  label          TEXT NOT NULL,                     -- human-readable, LLM-generated
  n_submissions  INT DEFAULT 0,
  n_voice        INT DEFAULT 0,
  demand_w       REAL,                               -- debiased demand, 0-1
  evidence_gap   REAL,                               -- 0-1
  equity_w       REAL,                               -- 0-1
  recurrence     REAL,                               -- 0-1
  dps            REAL,                               -- 0-100 composite score
  dps_class      TEXT,                               -- Low | Medium | High | Critical
  components     JSONB,                              -- stored weighted point breakdown
  explanation    JSONB,                              -- array of human-readable strings
  silent_need    BOOLEAN DEFAULT false,
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_themes_dps ON themes(dps DESC);

-- audit trail: which raw submissions rolled up into this theme
CREATE TABLE theme_submissions (
  theme_id       INT REFERENCES themes(id),
  submission_id  INT REFERENCES submissions(id),
  PRIMARY KEY (theme_id, submission_id)
);

-- ---------- Schemes (funding routes, as config — not code) ----------
CREATE TABLE schemes (
  id       TEXT PRIMARY KEY,                        -- 'mplads', 'jjm', 'samagra_shiksha', ...
  version  INT DEFAULT 1,
  config   JSONB NOT NULL,
  active   BOOLEAN DEFAULT true
);

-- ---------- Recommendations (theme -> an actual fundable work) ----------
CREATE TABLE recommendations (
  id            SERIAL PRIMARY KEY,
  theme_id      INT REFERENCES themes(id),
  title         TEXT NOT NULL,
  est_cost_inr  BIGINT,
  scheme_id     TEXT REFERENCES schemes(id),
  mp_action     TEXT,                                -- concrete next step, e.g. "Recommend to DC under MPLADS"
  rank          INT,
  status        TEXT DEFAULT 'proposed',              -- proposed | taken_up | in_progress | completed | rejected
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reco_rank ON recommendations(rank);

-- ---------- Events (append-only audit log — powers both debugging and the citizen timeline) ----------
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  ref_type    TEXT NOT NULL,                         -- 'submission' | 'theme' | 'recommendation'
  ref_id      INT NOT NULL,
  kind        TEXT NOT NULL,                         -- 'created' | 'status_change' | 'notified' | ...
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_events_ref ON events(ref_type, ref_id);

-- Atomic status-transition helper for recommendations (never bare-UPDATE a recommendation).
CREATE OR REPLACE FUNCTION transition_recommendation(
  p_reco INT, p_status TEXT, p_payload JSONB
) RETURNS VOID AS $$
BEGIN
  UPDATE recommendations SET status = p_status, updated_at = now() WHERE id = p_reco;
  INSERT INTO events(ref_type, ref_id, kind, payload)
    VALUES ('recommendation', p_reco, 'status_change',
            jsonb_build_object('to', p_status) || coalesce(p_payload, '{}'));
END;
$$ LANGUAGE plpgsql;
