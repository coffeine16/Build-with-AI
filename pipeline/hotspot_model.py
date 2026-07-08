"""
Basic hotspot model — the "very basic" version of the stretch goal
described in pipeline/README.md step 6: predict expected demand from
ward-level evidence features, then flag wards where actual citizen
submissions fall far short of what the evidence says they should be
(the silent-need signal, generalized into a per-ward score instead of
a hand-set boolean).

This is deliberately a plain scikit-learn LinearRegression, not the
LightGBM mentioned in that stretch goal -- with only a handful of demo
wards there isn't enough data for a heavier model to mean anything, and
a linear fit is honest about that. Swap it for something fancier once
there's real submission volume to train on.

Runs OFFLINE, once, against the static mock_recommendations.json --
NOT a live server. Output is two static JSON files the frontend reads
directly (same pattern as mock_recommendations.json itself), so running
the app never requires Python, a database, or any deployment beyond
`npm run build`.

Usage:
  python pipeline/hotspot_model.py
"""
import json
import os

import numpy as np
from sklearn.linear_model import LinearRegression

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_PATH = os.path.join(REPO_ROOT, "frontend", "mock_recommendations.json")
OUT_DIR = os.path.join(REPO_ROOT, "frontend", "src", "data")
HOTSPOTS_OUT = os.path.join(OUT_DIR, "wardHotspots.json")
BOUNDARIES_OUT = os.path.join(OUT_DIR, "wardBoundaries.json")

# Half-width of the illustrative ward "boundary" square, in degrees.
# ~0.006 deg is roughly a 650m block at Jaipur's latitude -- plausible
# ward scale, but this is NOT a surveyed boundary. See data/README.md;
# swap in the real DataMeet/OpenCity Jaipur ward GeoJSON when available.
BOX_HALF_WIDTH_DEG = 0.006


def load_recommendations():
    with open(SOURCE_PATH, encoding="utf-8") as f:
        return json.load(f)


def aggregate_by_ward(recommendations):
    wards = {}
    for item in recommendations:
        name = item["ward_name"]
        w = wards.setdefault(
            name,
            {
                "ward_name": name,
                "lat": item["lat"],
                "lng": item["lng"],
                "n_submissions": 0,
                "dps_values": [],
                "evidence_gap_values": [],
                "equity_values": [],
                "silent_need": False,
                "top_category": {},
            },
        )
        w["n_submissions"] += item["n_submissions"]
        w["dps_values"].append(item["dps"])
        w["evidence_gap_values"].append(item["components"]["evidence_gap"])
        w["equity_values"].append(item["components"]["equity"])
        w["silent_need"] = w["silent_need"] or item["silent_need"]
        w["top_category"][item["category"]] = w["top_category"].get(item["category"], 0) + item["n_submissions"]
        # use the centroid of whichever item has the highest dps as the ward's map anchor
        if item["dps"] == max(w["dps_values"]):
            w["lat"], w["lng"] = item["lat"], item["lng"]

    for w in wards.values():
        w["avg_dps"] = round(sum(w["dps_values"]) / len(w["dps_values"]), 1)
        w["avg_evidence_gap"] = sum(w["evidence_gap_values"]) / len(w["evidence_gap_values"])
        w["avg_equity"] = sum(w["equity_values"]) / len(w["equity_values"])
        w["top_category"] = max(w["top_category"], key=w["top_category"].get)
        del w["dps_values"], w["evidence_gap_values"], w["equity_values"]

    return list(wards.values())


def fit_hotspot_scores(wards):
    """Predict expected submissions from evidence features; a ward whose
    actual submissions fall well short of the prediction is a silent
    hotspot -- lots of documented need, few citizens loud enough to be
    heard through the normal intake channel."""
    x = np.array([[w["avg_evidence_gap"], w["avg_equity"]] for w in wards])
    y = np.array([w["n_submissions"] for w in wards])

    model = LinearRegression()
    model.fit(x, y)
    predicted = model.predict(x)

    residual = predicted - y  # positive = evidence says "more demand than we're hearing"
    spread = residual.max() - residual.min()

    for w, pred, res in zip(wards, predicted, residual):
        w["predicted_submissions"] = round(float(pred), 1)
        normalized = (res - residual.min()) / spread if spread > 0 else 0.0
        w["hotspot_score"] = round(float(normalized) * 100, 1)
        # a ward counts as a hotspot if the model's residual score is high
        # OR the pipeline's own rule-based silent_need flag already caught it
        w["is_hotspot"] = bool(w["hotspot_score"] >= 60 or w["silent_need"])

    return wards


def make_ward_boundary(ward):
    lat, lng = ward["lat"], ward["lng"]
    d = BOX_HALF_WIDTH_DEG
    ring = [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
    ]
    return {
        "type": "Feature",
        "properties": {"ward_name": ward["ward_name"]},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def main():
    recommendations = load_recommendations()
    wards = aggregate_by_ward(recommendations)
    wards = fit_hotspot_scores(wards)
    wards.sort(key=lambda w: w["hotspot_score"], reverse=True)

    os.makedirs(OUT_DIR, exist_ok=True)

    with open(HOTSPOTS_OUT, "w", encoding="utf-8") as f:
        json.dump(wards, f, indent=2)

    boundaries = {
        "type": "FeatureCollection",
        "features": [make_ward_boundary(w) for w in wards],
    }
    with open(BOUNDARIES_OUT, "w", encoding="utf-8") as f:
        json.dump(boundaries, f, indent=2)

    print(f"Scored {len(wards)} wards -> {HOTSPOTS_OUT}")
    print(f"Wrote illustrative ward boundaries -> {BOUNDARIES_OUT}")
    for w in wards:
        flag = "HOTSPOT" if w["is_hotspot"] else ""
        print(f"  {w['ward_name']:<10} score={w['hotspot_score']:>5.1f}  "
              f"actual={w['n_submissions']:>3}  predicted={w['predicted_submissions']:>5.1f}  {flag}")


if __name__ == "__main__":
    main()
