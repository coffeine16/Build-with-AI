-- Seed evidence + ward attributes for the 5 demo wards (4,5,6,7,11).
-- Paste into the Supabase SQL Editor and run. Idempotent-ish: ward
-- attributes are overwritten; evidence rows are cleared for these wards
-- first so re-running doesn't duplicate.
--
-- IMPORTANT: these numbers are hand-curated illustrative priors, NOT
-- surveyed data — enough to make the DPS scoring produce an honest,
-- differentiated demo. Centroids are approximate Jaipur points, not real
-- ward polygons (same caveat as the map's illustrative boundaries).
-- gap_score is normalized 0-1, higher = worse gap.

-- 1. Fill the NULL ward attributes (population/equity/centroid) the pipeline
--    needs for debiasing, the equity weight, and the map.
UPDATE wards SET population=32000, literacy_rate=0.74, female_literacy_rate=0.66, sc_st_pct=0.28, amenity_index=0.68, centroid_lat=26.9124, centroid_lng=75.7873 WHERE name='Ward 4';
UPDATE wards SET population=26000, literacy_rate=0.81, female_literacy_rate=0.75, sc_st_pct=0.16, amenity_index=0.42, centroid_lat=26.9200, centroid_lng=75.8000 WHERE name='Ward 5';
UPDATE wards SET population=38000, literacy_rate=0.63, female_literacy_rate=0.52, sc_st_pct=0.41, amenity_index=0.83, centroid_lat=26.9050, centroid_lng=75.8100 WHERE name='Ward 6';
UPDATE wards SET population=22000, literacy_rate=0.78, female_literacy_rate=0.71, sc_st_pct=0.22, amenity_index=0.55, centroid_lat=26.8980, centroid_lng=75.7750 WHERE name='Ward 7';
UPDATE wards SET population=29000, literacy_rate=0.69, female_literacy_rate=0.60, sc_st_pct=0.33, amenity_index=0.61, centroid_lat=26.9300, centroid_lng=75.7950 WHERE name='Ward 11';

-- 2. Clear existing evidence for these wards, then insert fresh rows.
DELETE FROM evidence WHERE ward_id IN (SELECT id FROM wards WHERE name IN ('Ward 4','Ward 5','Ward 6','Ward 7','Ward 11'));

INSERT INTO evidence (ward_id, category, metric, value, gap_score, source, year)
SELECT w.id, e.category, e.metric, e.value, e.gap_score, e.source, e.year
FROM (VALUES
  -- Ward 4: strong education gap (matches the many school-roof reports)
  ('Ward 4','education','enrollment_per_classroom_pct', 140, 0.78, 'UDISE+', 2024),
  ('Ward 4','water','tap_coverage_pct',                  78, 0.35, 'Census', 2011),
  -- Ward 5: roads gap
  ('Ward 5','roads','unpaved_habitation_pct',            34, 0.62, 'PMGSY',  2023),
  ('Ward 5','education','enrollment_per_classroom_pct',  108, 0.30, 'UDISE+', 2024),
  -- Ward 6: HIGH gaps but (currently) zero citizen submissions -> silent needs
  ('Ward 6','water','tap_coverage_pct',                  41, 0.80, 'JJM',    2023),
  ('Ward 6','health','population_per_subcentre',       9200, 0.72, 'NHM',    2023),
  ('Ward 6','sanitation','hh_without_toilet_pct',        29, 0.66, 'Census', 2011),
  -- Ward 7: water gap (matches the water reports there)
  ('Ward 7','water','tap_coverage_pct',                  52, 0.70, 'JJM',    2023),
  ('Ward 7','education','enrollment_per_classroom_pct',  112, 0.40, 'UDISE+', 2024),
  -- Ward 11: education + electricity gaps
  ('Ward 11','education','enrollment_per_classroom_pct', 128, 0.66, 'UDISE+', 2024),
  ('Ward 11','electricity','avg_daily_supply_hours',       16, 0.45, 'Census', 2011)
) AS e(ward_name, category, metric, value, gap_score, source, year)
JOIN wards w ON w.name = e.ward_name;

-- verify
SELECT w.name, e.category, e.metric, e.value, e.gap_score, e.source
FROM evidence e JOIN wards w ON w.id = e.ward_id
ORDER BY w.name, e.category;
