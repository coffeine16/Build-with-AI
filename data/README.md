# Data + funding track

Zero dependencies on other tracks — start immediately.

## Build order

1. Download Jaipur ward boundaries (GeoJSON) from the DataMeet
   Municipal_Spatial_Data repo or OpenCity's Jaipur wards dataset. Save
   to `data/raw/`. Run `python scripts/load_wards.py data/raw/wards.geojson`.
2. Scheme configs — already stubbed in `data/schemes/*.json`
   (mplads, jjm, samagra_shiksha, pmgsy). Insert into the `schemes` table.
   Add one Rajasthan state scheme if time allows (check
   jansoochna.rajasthan.gov.in). Adding a new scheme = adding a JSON file
   and one INSERT — this is the "30 second live demo" moment, so make sure
   it stays that easy.
3. Evidence data for your chosen demo wards only (don't try to cover all
   150 wards):
   - UDISE+ (udiseplus.gov.in) — district/block aggregate report card for
     Jaipur, or scrape individual school report cards for schools in your
     demo wards. Compute enrollment-per-classroom-capacity as the gap
     metric.
   - Census 2011 ward-wise Primary Census Abstract (Rajasthan District
     Census Handbook, Jaipur) — population, literacy, female literacy.
     Feeds BOTH the evidence layer and the debiasing model.
   - JJM (ejalshakti.gov.in) — tap connection coverage %, mainly for
     peri-urban/rural wards.
   - MPLADS completed-works data (data.gov.in) — use this for realistic
     `est_cost_inr` priors per work type in the budget optimizer.
   Normalize everything into `evidence` rows: one row per (ward,
   category, metric).
4. Ward aliases — hand-fill `wards.aliases` with colloquial names for
   your demo wards (e.g. "bus stand wala area") so location matching
   works without GPS.

## Gotchas
- Ward names differ across portals (municipal vs Census wards). Pick your
  demo wards FIRST, then manually reconcile just those — don't try to
  build a general crosswalk.
- Cache every downloaded file locally in `data/raw/`. Never hit
  government portals at runtime.
