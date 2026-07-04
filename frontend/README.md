# Dashboard track (React on Vercel)

ONE app, ONE URL — this Vercel deployment IS the prototype link.
Routes: `/` (role select: "I'm a citizen" / "I'm the MP"),
`/citizen`, `/mp` (behind a single hardcoded passcode — no real auth,
it's a known time sink).

Reads come straight from **Supabase auto-generated REST** (supabase-js +
anon key). There is no custom API server. The MP "take up" write is a
Supabase RPC calling `transition_recommendation()`.

## Build order (don't wait on the pipeline)
1. Map (Leaflet + OpenStreetMap tiles) centered on Jaipur, ward polygons
   from `wards.geom`.
2. Render `mock_recommendations.json` (this folder) as circles sized by
   `dps`, colored by `dps_class`. Build the whole MP view against the mock.
3. Ranked list grouped by ward; raw-vs-debiased toggle (mock will grow a
   `raw_rank` field); detail panel with DPS component bars + explanation
   bullets + `mp_action` + channel badges (telegram / web / ivr).
4. Silent-need wards -> distinct ring style via `silent_need`.
5. `/citizen`: mic button (MediaRecorder) + text box + photo upload ->
   POST to the n8n W2 webhook (`VITE_SUBMIT_WEBHOOK_URL`); optional
   browser geolocation; show the returned ack_text; below it, "my ward"
   status list read from Supabase.
6. LAST: swap mock fetch -> supabase-js queries. Field names must match
   the mock exactly — coordinate with the pipeline track before renaming
   anything.

## Env (Vercel)
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUBMIT_WEBHOOK_URL
