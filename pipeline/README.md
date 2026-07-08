# Pipeline track

The core IP: turns raw submissions into ranked, explainable, funded
recommendations. Runs as a batch script, rerun every ~10 min.

## Build order

1. Run `python scripts/generate_synthetic_submissions.py --n 150` against
   the shared DB so you have data to work with immediately — don't wait
   on the intake track.
2. **Cluster**: embed `submissions.ask` (Gemini embeddings or
   sentence-transformers), cluster within (category, ward) using
   agglomerative clustering, LLM-label each cluster -> write `themes`
   + `theme_submissions`.
3. **Debias**: compute per-ward submission propensity (submissions per
   capita from `wards.population`), inverse-weight (clip 1x-5x), sum into
   `demand_w`.
4. **Evidence join**: pull the matching `evidence.gap_score` for each
   theme's (ward, category).
5. **Score**: `DPS = 100 * (0.30*demand_w + 0.35*evidence_gap +
   0.20*equity_w + 0.15*recurrence)`. Store the four weighted components
   AND a generated explanation array — this must be computed once here,
   never at serve time.
6. **Silent needs**: flag (ward, category) pairs with high evidence_gap
   but near-zero submissions. (Stretch: replace the heuristic with a
   LightGBM model predicting expected demand from ward features, and flag
   wards where actual << predicted.)
7. **Funding match**: deterministic rules engine over `schemes.config`
   (see `/data/schemes/*.json`) -> write `recommendations`.
8. Write results to the themes/recommendations tables in Supabase — the
   frontend reads them via Supabase REST. Field names must match
   /frontend/mock_recommendations.json EXACTLY (the dashboard was built against it).

## Depends on
`submissions` (real or synthetic) + `evidence` rows must exist.

## Basic hotspot model (implemented)

`hotspot_model.py` is a very basic, working version of the step 6
stretch goal — plain scikit-learn `LinearRegression` (not LightGBM;
there isn't enough demo data yet for anything heavier) predicting
expected submissions per ward from evidence features, then scoring
wards where actual submissions fall short as hotspots. It runs
offline against the static `frontend/mock_recommendations.json` and
writes `frontend/src/data/wardHotspots.json` +
`frontend/src/data/wardBoundaries.json` for the map — no database, no
server, just:

```
python pipeline/hotspot_model.py
```

Re-run it after editing `mock_recommendations.json` to refresh the
map. Swapping in a real model/real submission volume later means
replacing this script's internals, not the frontend contract.
