-- Load ALL funding schemes into Supabase in one shot.
-- Paste into the Supabase SQL Editor and run. Idempotent: re-running
-- upserts (updates config/version) instead of erroring on duplicates.
--
-- These configs are the source of truth mirrored from data/schemes/*.json.
-- If you edit a .json, update the matching block here (or vice versa).
-- Existing: samagra_shiksha, mplads, jjm, pmgsy.
-- Added:    amrut, swachh_bharat, nhm, saubhagya.

INSERT INTO schemes (id, version, config, active) VALUES
(
  'samagra_shiksha', 1,
  '{
    "name": { "en": "Samagra Shiksha Abhiyan", "hi": "समग्र शिक्षा अभियान" },
    "eligibility": { "all": [
      { "field": "category", "op": "eq", "value": "education" },
      { "field": "sub_type", "op": "in", "value": ["infrastructure_repair", "new_classroom", "toilet", "drinking_water", "electricity"] }
    ]},
    "mp_action": "Recommend to the District Education Officer for inclusion in the Samagra Shiksha annual work plan (AWP&B).",
    "notes": "Government/government-aided schools only. Cite UDISE+ enrollment/infrastructure gap in the justification."
  }'::jsonb, true
),
(
  'mplads', 1,
  '{
    "name": { "en": "Member of Parliament Local Area Development Scheme", "hi": "सांसद स्थानीय क्षेत्र विकास योजना" },
    "annual_ceiling_inr": 50000000,
    "eligibility": { "all": [
      { "field": "category", "op": "in", "value": ["education", "water", "roads", "health", "electricity", "sanitation"] },
      { "field": "est_cost_inr", "op": "lte", "value": 5000000 },
      { "field": "asset_type", "op": "eq", "value": "durable_community_asset" }
    ]},
    "mp_action": "Recommend the work to the District Collector under MPLADS guidelines, citing the evidence and citizen demand summary.",
    "notes": "Durable community assets only; cannot fund recurring/maintenance costs or private property."
  }'::jsonb, true
),
(
  'jjm', 1,
  '{
    "name": { "en": "Jal Jeevan Mission", "hi": "जल जीवन मिशन" },
    "eligibility": { "all": [
      { "field": "category", "op": "eq", "value": "water" },
      { "field": "sub_type", "op": "in", "value": ["tap_connection", "piped_water_extension", "water_quality"] }
    ]},
    "mp_action": "Forward to the district Public Health Engineering Department (PHED) for inclusion in the JJM village action plan.",
    "notes": "Primarily rural/peri-urban habitations; check village coverage status before recommending."
  }'::jsonb, true
),
(
  'pmgsy', 1,
  '{
    "name": { "en": "Pradhan Mantri Gram Sadak Yojana", "hi": "प्रधानमंत्री ग्राम सड़क योजना" },
    "eligibility": { "all": [
      { "field": "category", "op": "eq", "value": "roads" },
      { "field": "sub_type", "op": "in", "value": ["habitation_connectivity", "road_repair", "all_weather_road"] }
    ]},
    "mp_action": "Forward to the PMGSY district implementation unit for habitation connectivity survey.",
    "notes": "Targets unconnected/under-connected rural habitations per the PMGSY core network."
  }'::jsonb, true
),
(
  'amrut', 1,
  '{
    "name": { "en": "AMRUT 2.0 (Atal Mission for Rejuvenation and Urban Transformation)", "hi": "अटल नवीकरण एवं शहरी परिवर्तन मिशन (अमृत 2.0)" },
    "eligibility": { "all": [
      { "field": "category", "op": "in", "value": ["water", "sanitation"] },
      { "field": "sub_type", "op": "in", "value": ["piped_water_extension", "tap_connection", "water_quality", "sewerage", "drainage", "stormwater", "water_supply"] }
    ]},
    "mp_action": "Forward to the Urban Local Body (Jaipur Nagar Nigam) / State AMRUT mission for inclusion in the city water supply & sewerage action plan.",
    "notes": "Urban wards only — the urban counterpart to JJM. Best fit for Jaipur''s municipal wards. Cite tap/sewerage coverage gap in the justification."
  }'::jsonb, true
),
(
  'swachh_bharat', 1,
  '{
    "name": { "en": "Swachh Bharat Mission (Urban) 2.0", "hi": "स्वच्छ भारत मिशन (शहरी) 2.0" },
    "eligibility": { "all": [
      { "field": "category", "op": "eq", "value": "sanitation" },
      { "field": "sub_type", "op": "in", "value": ["toilet", "public_toilet", "community_toilet", "open_defecation", "solid_waste", "garbage", "drainage", "sewage"] }
    ]},
    "mp_action": "Forward to the Jaipur Nagar Nigam Swachh Bharat cell for inclusion in the city sanitation / solid-waste management plan.",
    "notes": "Covers toilets (individual/community/public), solid-waste management, and drainage. Not for piped water supply — route those to AMRUT/JJM."
  }'::jsonb, true
),
(
  'nhm', 1,
  '{
    "name": { "en": "National Health Mission — Ayushman Bharat Health & Wellness Centre", "hi": "राष्ट्रीय स्वास्थ्य मिशन — आयुष्मान भारत स्वास्थ्य एवं कल्याण केंद्र" },
    "eligibility": { "all": [
      { "field": "category", "op": "eq", "value": "health" },
      { "field": "sub_type", "op": "in", "value": ["infrastructure_repair", "sub_centre", "phc", "chc", "health_centre", "equipment", "staff", "drinking_water", "electricity"] }
    ]},
    "mp_action": "Forward to the Chief Medical & Health Officer (CMHO) / District Health Society for inclusion in the NHM Programme Implementation Plan (PIP).",
    "notes": "Public health sub-centres, PHCs/CHCs and health-and-wellness-centre upgrades. Cite population-per-facility or facility-condition gap in the justification."
  }'::jsonb, true
),
(
  'saubhagya', 1,
  '{
    "name": { "en": "Saubhagya / DDUGJY (Pradhan Mantri Sahaj Bijli Har Ghar Yojana)", "hi": "सौभाग्य / दीन दयाल उपाध्याय ग्राम ज्योति योजना (प्रधानमंत्री सहज बिजली हर घर योजना)" },
    "eligibility": { "all": [
      { "field": "category", "op": "eq", "value": "electricity" },
      { "field": "sub_type", "op": "in", "value": ["connection", "household_connection", "transformer", "pole", "wiring", "line_extension", "voltage", "power_supply"] }
    ]},
    "mp_action": "Forward to the local DISCOM (Jaipur Vidyut Vitran Nigam — JVVNL) for last-mile connection / distribution-infrastructure work.",
    "notes": "Household electrification and distribution infrastructure (transformers, poles, lines). Street-lighting is a municipal (ULB) subject, not this scheme."
  }'::jsonb, true
)
ON CONFLICT (id) DO UPDATE
  SET version = EXCLUDED.version,
      config  = EXCLUDED.config,
      active  = EXCLUDED.active;

-- verify
SELECT id, config->'name'->>'en' AS name, active FROM schemes ORDER BY id;
