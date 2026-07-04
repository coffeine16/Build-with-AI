"""
Generate synthetic citizen submissions so the pipeline track (clustering,
debiasing, DPS scoring) can start work WITHOUT waiting on the bot/intake
track to be live.

Deliberately skewed: a few "loud" wards get many submissions, most wards
get few or none. This is what makes the raw-vs-debiased toggle dramatic
in the demo -- if submissions were evenly spread, debiasing would have
nothing to correct.

Usage:
  export DATABASE_URL=postgresql://user:pass@host:5432/dbname
  python generate_synthetic_submissions.py --n 150

Requires wards to already be loaded (run load_wards.py first).
"""
import argparse
import json
import os
import random

import psycopg2

CATEGORIES = ["education", "water", "roads", "health", "electricity"]

# (category, sub_type, ask template, urgency signals)
TEMPLATES = [
    ("education", "infrastructure_repair", "school ki chhat tapakti hai, baarish mein bachche bheeg jaate hain", ["monsoon", "children affected"]),
    ("education", "infrastructure_repair", "government school mein classroom kam hain, bachche fatah mein baithte hain", ["overcrowding"]),
    ("education", "toilet", "school mein ladkiyon ke liye alag toilet nahi hai", ["girls_safety"]),
    ("water", "tap_connection", "hamare mohalle mein paani ka connection nahi aaya abhi tak", ["no_water"]),
    ("water", "water_quality", "paani ganda aata hai, bachche bimar ho rahe hain", ["health_risk"]),
    ("roads", "road_repair", "road mein bade gaddhe hain, accident ho sakta hai", ["safety"]),
    ("roads", "habitation_connectivity", "baarish mein gaon tak sadak hi nahi bachti, kichad ho jaata hai", ["monsoon", "isolation"]),
    ("health", "infrastructure_repair", "primary health centre mein doctor kabhi nahi aate", ["understaffed"]),
    ("electricity", "infrastructure_repair", "bijli 6-7 ghante gayab rehti hai roz", ["frequent_outage"]),
]

ENGLISH_VARIANTS = [
    "The school roof leaks badly, kids get soaked during monsoon.",
    "No proper drainage on our street, water logs every rain.",
    "Streetlights have been off for 3 months in our lane.",
    "The primary health centre has no doctor most days.",
]


def weighted_ward_choice(ward_ids, n_loud=3):
    """Skew submissions toward a few 'loud' wards, mimicking real voice bias."""
    loud = ward_ids[:n_loud] if len(ward_ids) > n_loud else ward_ids
    quiet = ward_ids[n_loud:] if len(ward_ids) > n_loud else []
    # 70% of submissions land in the loud wards, 30% spread over everyone else
    if quiet and random.random() < 0.3:
        return random.choice(quiet)
    return random.choice(loud) if loud else random.choice(ward_ids)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=150, help="number of synthetic submissions")
    ap.add_argument("--loud-wards", type=int, default=3, help="how many wards to over-represent")
    args = ap.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Set DATABASE_URL first.")
        return

    con = psycopg2.connect(db_url)
    cur = con.cursor()

    cur.execute("SELECT id FROM wards ORDER BY id")
    ward_ids = [r[0] for r in cur.fetchall()]
    if not ward_ids:
        print("No wards found -- run load_wards.py first.")
        return

    # a synthetic citizen bucket, one per submission for simplicity
    inserted = 0
    for i in range(args.n):
        ward_id = weighted_ward_choice(ward_ids, args.loud_wards)
        category, sub_type, ask_hi, urgency = random.choice(TEMPLATES)
        is_voice = random.random() < 0.3
        language = random.choice(["hi", "hi", "en"])  # mostly Hindi
        text = random.choice(ENGLISH_VARIANTS) if language == "en" else ask_hi

        cur.execute(
            """
            INSERT INTO citizens (channel, channel_user_id, ward_id, language)
            VALUES ('synthetic', %s, %s, %s)
            RETURNING id
            """,
            (f"synthetic-{i}", ward_id, language),
        )
        citizen_id = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO submissions
              (citizen_id, channel, media_type, raw_text, transcript, ask, category,
               sub_type, urgency_signals, language, ward_id, ward_resolution)
            VALUES (%s, 'synthetic', %s, %s, %s, %s, %s, %s, %s, %s, %s, 'manual_review')
            """,
            (
                citizen_id,
                "voice" if is_voice else "text",
                None if is_voice else text,
                text if is_voice else None,
                text,
                category,
                sub_type,
                urgency,
                language,
                ward_id,
            ),
        )
        inserted += 1

    con.commit()
    cur.close()
    con.close()
    print(f"Inserted {inserted} synthetic submissions across {len(ward_ids)} wards "
          f"(skewed toward {args.loud_wards} 'loud' wards). Pipeline track can start now.")


if __name__ == "__main__":
    main()
