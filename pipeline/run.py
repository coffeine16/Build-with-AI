"""
Awaaz scoring pipeline — the real one, run on demand.

Reads live submissions + evidence + ward attributes from Supabase, clusters
demand into (ward, category) themes, computes the Decision Priority Score
(DPS) deterministically, matches each theme to a funding scheme, and writes
`themes` + `theme_submissions` + `recommendations` back to Supabase.

    DPS = 100 * (0.30*demand + 0.35*evidence_gap + 0.20*equity + 0.15*recurrence)

The formula is plain arithmetic here — never left to an LLM — so the same
inputs always produce the same score. It is intentionally simple (group by
ward+category rather than embedding-based clustering); swap in something
heavier once there's real submission volume.

Usage:
    pip install -r requirements.txt
    export DATABASE_URL="postgresql://postgres.<ref>:<pw>@<pooler-host>:5432/postgres"
    python run.py

Re-running does a full rebuild of themes/recommendations (the pipeline owns
those tables). This replaces any hand-seeded rows.
"""
import json
import os
import statistics
from collections import defaultdict

# psycopg2 is imported lazily inside main() so the pure scoring
# (build_themes) can be imported/dry-run without the DB driver installed.

# ---- scoring knobs -------------------------------------------------------
WEIGHTS = {"demand": 0.30, "evidence_gap": 0.35, "equity": 0.20, "recurrence": 0.15}
DEMAND_SAT = 8       # distinct citizens for a full demand score
RECURRENCE_SAT = 10  # total reports for a full recurrence score
SILENT_GAP_MIN = 0.60   # evidence gap at/above this ...
SILENT_DEMAND_MAX = 1   # ... with this few distinct citizens = a silent need
COST_PRIOR_INR = {
    "education": 850000, "water": 1200000, "roads": 2500000, "health": 1500000,
    "electricity": 900000, "sanitation": 700000, "other": 500000,
}
WORK_TITLE = {
    "education": "School infrastructure works", "water": "Water supply improvement",
    "roads": "Road / connectivity works", "health": "Health facility upgrade",
    "electricity": "Power supply improvement", "sanitation": "Sanitation works",
    "other": "Community works",
}
# Which scheme wins when several are eligible. Higher = tried first. Dedicated
# single-category schemes beat AMRUT (water+sanitation); AMRUT (urban) beats
# JJM (rural) for Jaipur's urban wards; MPLADS is the last-resort catch-all.
SCHEME_PRIORITY = {
    "samagra_shiksha": 10, "pmgsy": 10, "nhm": 10, "saubhagya": 10,
    "swachh_bharat": 10, "amrut": 8, "jjm": 5, "mplads": 1,
}


def dps_class(dps):
    if dps >= 80:
        return "Critical"
    if dps >= 60:
        return "High"
    if dps >= 40:
        return "Medium"
    return "Low"


def scheme_matches(config, category, sub_type, est_cost, asset_type):
    """Evaluate a scheme's eligibility.all rules. sub_type conditions pass
    when the theme has no representative sub_type (category is the primary
    signal — we don't want a missing tag to drop an otherwise-eligible work)."""
    rules = (config.get("eligibility") or {}).get("all") or []
    ctx = {"category": category, "sub_type": sub_type,
           "est_cost_inr": est_cost, "asset_type": asset_type}
    for rule in rules:
        field, op, val = rule.get("field"), rule.get("op"), rule.get("value")
        actual = ctx.get(field)
        if field == "sub_type" and actual is None:
            continue  # lenient: undetermined sub_type doesn't disqualify
        if op == "eq" and actual != val:
            return False
        if op == "in" and actual not in val:
            return False
        if op == "lte" and not (actual is not None and actual <= val):
            return False
        if op == "gte" and not (actual is not None and actual >= val):
            return False
    return True


def pick_scheme(schemes, category, sub_type, est_cost):
    """First matching active scheme; category-specific schemes are tried
    before the MPLADS catch-all."""
    for sid, config in schemes:
        if scheme_matches(config, category, sub_type, est_cost, "durable_community_asset"):
            return sid, config
    return None, None


def build_themes(wards, submissions, evidence_rows, schemes):
    """Pure scoring: takes loaded data, returns ranked theme dicts. No DB —
    so it can be dry-run against REST data without write access."""
    # order schemes by matching priority here so callers don't have to
    schemes = sorted(schemes, key=lambda s: -SCHEME_PRIORITY.get(s[0], 5))

    pops = [w["population"] for w in wards.values() if w["population"]]
    median_pop = statistics.median(pops) if pops else None

    # evidence per (ward, category): keep the worst-gap row for the headline
    evidence_by_key = defaultdict(list)
    for e in evidence_rows:
        evidence_by_key[(e["ward_id"], e["category"])].append(e)

    # ---- cluster: (ward, category) themes from submissions ... ----
    subs_by_key = defaultdict(list)
    for s in submissions:
        subs_by_key[(s["ward_id"], s["category"])].append(s)

    # ... plus evidence-only keys (documented gap, no submissions = silent need)
    theme_keys = set(subs_by_key) | set(evidence_by_key)

    themes = []
    for key in theme_keys:
        ward_id, category = key
        ward = wards.get(ward_id)
        if not ward:
            continue
        subs = subs_by_key.get(key, [])
        distinct_citizens = len({s["citizen_id"] for s in subs if s["citizen_id"]})
        n_submissions = len(subs)
        n_voice = sum(1 for s in subs if s["media_type"] == "voice")

        # debias: up-weight demand from smaller (typically under-served) wards
        pop = ward["population"]
        weight = 1.0
        if pop and median_pop:
            weight = min(5.0, max(1.0, median_pop / pop))
        demand_w = min(1.0, (distinct_citizens * weight) / DEMAND_SAT)

        ev = evidence_by_key.get(key, [])
        headline_ev = max(ev, key=lambda e: e["gap_score"]) if ev else None
        evidence_gap = headline_ev["gap_score"] if headline_ev else 0.0

        equity_w = ward["amenity_index"] if ward["amenity_index"] is not None else 0.5
        recurrence = min(1.0, n_submissions / RECURRENCE_SAT)

        pts = {
            "demand": round(100 * WEIGHTS["demand"] * demand_w, 1),
            "evidence_gap": round(100 * WEIGHTS["evidence_gap"] * evidence_gap, 1),
            "equity": round(100 * WEIGHTS["equity"] * equity_w, 1),
            "recurrence": round(100 * WEIGHTS["recurrence"] * recurrence, 1),
        }
        dps = round(sum(pts.values()), 1)
        silent = evidence_gap >= SILENT_GAP_MIN and distinct_citizens <= SILENT_DEMAND_MAX

        explanation = []
        if silent:
            explanation.append(
                "Silent need: strong documented gap but almost no citizen reports — "
                "flagged so it isn't buried under louder wards")
        if headline_ev:
            explanation.append(
                f"Evidence gap +{pts['evidence_gap']} pts "
                f"({headline_ev['metric'].replace('_', ' ')} {headline_ev['value']}, "
                f"{headline_ev['source']} {headline_ev['year']})")
        explanation.append(
            f"Citizen demand +{pts['demand']} pts "
            f"({distinct_citizens} citizen{'s' if distinct_citizens != 1 else ''}, "
            f"{n_voice} via voice, debiased x{weight:.1f})")
        explanation.append(
            f"Equity +{pts['equity']} pts (amenity index {equity_w:.2f}, higher = more deprived)")
        explanation.append(
            f"Recurrence +{pts['recurrence']} pts ({n_submissions} report{'s' if n_submissions != 1 else ''} logged)")

        sub_types = [s["sub_type"] for s in subs if s["sub_type"]]
        rep_sub_type = statistics.mode(sub_types) if sub_types else None
        est_cost = COST_PRIOR_INR.get(category, 500000)
        scheme_id, scheme_cfg = pick_scheme(schemes, category, rep_sub_type, est_cost)
        mp_action = (scheme_cfg or {}).get("mp_action") if scheme_cfg else \
            "Review with the ward committee to route to the appropriate department."
        title = f"{WORK_TITLE.get(category, 'Works')} — {ward['name']}"

        themes.append({
            "ward_id": ward_id, "category": category, "label": title,
            "n_submissions": n_submissions, "n_voice": n_voice,
            "demand_w": round(demand_w, 3), "evidence_gap": round(evidence_gap, 3),
            "equity_w": round(equity_w, 3), "recurrence": round(recurrence, 3),
            "dps": dps, "dps_class": dps_class(dps), "components": pts,
            "explanation": explanation, "silent_need": silent,
            "submission_ids": [s["id"] for s in subs],
            "title": title, "est_cost_inr": est_cost, "scheme_id": scheme_id,
            "mp_action": mp_action,
        })

    themes.sort(key=lambda t: t["dps"], reverse=True)
    return themes


def load_data(cur):
    cur.execute("SELECT id, name, population, amenity_index, centroid_lat, centroid_lng FROM wards")
    wards = {r["id"]: r for r in cur.fetchall()}
    cur.execute("""SELECT id, citizen_id, ward_id, category, sub_type, media_type
                   FROM submissions WHERE ward_id IS NOT NULL AND category IS NOT NULL""")
    submissions = cur.fetchall()
    cur.execute("SELECT ward_id, category, metric, value, gap_score, source, year FROM evidence")
    evidence_rows = cur.fetchall()
    cur.execute("SELECT id, config FROM schemes WHERE active = true")
    schemes = [(r["id"], r["config"]) for r in cur.fetchall()]  # build_themes orders them
    return wards, submissions, evidence_rows, schemes


def write_themes(cur, themes):
    # full rebuild — the pipeline owns these tables
    cur.execute("DELETE FROM theme_submissions")
    cur.execute("DELETE FROM recommendations")
    cur.execute("DELETE FROM themes")

    for rank, t in enumerate(themes, start=1):
        cur.execute(
            """INSERT INTO themes (ward_id, category, label, n_submissions, n_voice,
                   demand_w, evidence_gap, equity_w, recurrence, dps, dps_class,
                   components, explanation, silent_need)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (t["ward_id"], t["category"], t["label"], t["n_submissions"], t["n_voice"],
             t["demand_w"], t["evidence_gap"], t["equity_w"], t["recurrence"], t["dps"],
             t["dps_class"], json.dumps(t["components"]), json.dumps(t["explanation"]),
             t["silent_need"]))
        theme_id = cur.fetchone()["id"]

        for sid in t["submission_ids"]:
            cur.execute(
                "INSERT INTO theme_submissions (theme_id, submission_id) VALUES (%s,%s) "
                "ON CONFLICT DO NOTHING", (theme_id, sid))

        cur.execute(
            """INSERT INTO recommendations (theme_id, title, est_cost_inr, scheme_id,
                   mp_action, rank, status)
               VALUES (%s,%s,%s,%s,%s,%s,'proposed')""",
            (theme_id, t["title"], t["est_cost_inr"], t["scheme_id"], t["mp_action"], rank))


def print_summary(themes):
    print(f"Rebuilt {len(themes)} themes + recommendations.\n")
    print(f"{'ward/category':<26}{'DPS':>6}  {'class':<9}{'scheme':<16}flags")
    for t in themes:
        flag = "SILENT NEED" if t["silent_need"] else ""
        print(f"{t['label'][:26]:<26}{t['dps']:>6}  {t['dps_class']:<9}"
              f"{str(t['scheme_id']):<16}{flag}")


def main():
    import psycopg2
    import psycopg2.extras

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("Set DATABASE_URL (Supabase session-pooler connection string).")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        themes = build_themes(*load_data(cur))
        write_themes(cur, themes)
        conn.commit()
        print_summary(themes)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
