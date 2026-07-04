"""
Load ward boundaries (GeoJSON) into the `wards` table.

Get the source file first:
  Jaipur Municipal Corporation wards -> https://data.opencity.in/dataset/jaipur-municipal-corporation-wards-map
  or the DataMeet Municipal_Spatial_Data repo -> https://github.com/datameet/Municipal_Spatial_Data

Expected input: a GeoJSON FeatureCollection where each feature has a ward
name/number in its properties. Adjust NAME_FIELD / NO_FIELD below to match
whatever the actual downloaded file calls them (check with:
  python -c "import json; print(json.load(open('wards.geojson'))['features'][0]['properties'])"
).

Usage:
  export DATABASE_URL=postgresql://user:pass@host:5432/dbname
  python load_wards.py path/to/jaipur_wards.geojson
"""
import json
import os
import sys

import psycopg2
from shapely.geometry import shape

NAME_FIELD = "ward_name"   # <-- change to match your source file's property keys
NO_FIELD = "ward_no"       # <-- change to match your source file's property keys


def main():
    if len(sys.argv) < 2:
        print("Usage: python load_wards.py path/to/wards.geojson")
        sys.exit(1)

    geojson_path = sys.argv[1]
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Set DATABASE_URL first (Supabase connection string).")
        sys.exit(1)

    data = json.load(open(geojson_path, encoding="utf-8"))
    features = data["features"]
    print(f"Loaded {len(features)} ward features from {geojson_path}")

    con = psycopg2.connect(db_url)
    cur = con.cursor()

    inserted = 0
    for f in features:
        props = f.get("properties", {})
        name = props.get(NAME_FIELD) or props.get("name") or f"Ward {props.get(NO_FIELD, '?')}"
        ward_no = str(props.get(NO_FIELD, ""))
        geom = f["geometry"]

        try:
            centroid = shape(geom).centroid
            clat, clng = centroid.y, centroid.x
        except Exception as e:
            print(f"  [skip centroid for {name}: {e}]")
            clat, clng = None, None

        cur.execute(
            """
            INSERT INTO wards (ward_no, name, geom, centroid_lat, centroid_lng)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (ward_no, name, json.dumps(geom), clat, clng),
        )
        inserted += 1

    con.commit()
    cur.close()
    con.close()
    print(f"Inserted {inserted} wards. Next: add aliases (colloquial names) by hand for demo wards.")


if __name__ == "__main__":
    main()
