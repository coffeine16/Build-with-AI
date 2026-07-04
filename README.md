# Build-with-AI — Awaaz (People's Priorities)

**An AI platform where any citizen can raise a local need in their own
language — by voice, text, or photo, over WhatsApp/Telegram/web — and
their MP gets a ranked, evidence-backed, budget-ready list of
development works to act on.**

Pipeline: extract -> cluster into themes -> correct for voice bias ->
join public evidence (UDISE+, Census, JJM, PMGSY) -> DPS score ->
match to a funding scheme -> MP dashboard. LLMs parse and explain;
deterministic code decides and ranks.

## Architecture (final)

- **Frontend** — one React app on Vercel. `/citizen` (submit + track) and
  `/mp` (dashboard). The Vercel URL is the live prototype link.
- **Intake** — n8n (self-hosted on EC2): WhatsApp + Telegram adapters and
  a web-submit webhook, all feeding ONE shared processing workflow.
- **Store** — Supabase: Postgres (+PostGIS), media storage, and the
  auto-generated REST API the frontend reads from. No custom API server.
- **Pipeline** — Python batch container on the same EC2 box, recomputes
  themes/DPS/recommendations every few minutes. No laptop needs to stay on.

## Repo layout

```
bot/         n8n workflows: W1 telegram, W1b whatsapp, W2 web submit, W3 brain, W4 notify
pipeline/    Clustering, debiasing, DPS scoring, funding matcher
frontend/    React app: /citizen + /mp (+ mock_recommendations.json to build against)
db/          schema.sql — the shared contract, read this first
data/        Scheme configs (funding routes) + raw dataset downloads
scripts/     load_wards.py, generate_synthetic_submissions.py
deploy/      docker-compose (n8n + pipeline + caddy), Caddyfile, pipeline Dockerfile
infra/       Terraform: EC2 t3.small + Elastic IP in ap-south-1
```

## Start here (together, ~2h, before splitting into tracks)

1. Create the Supabase project, run `db/schema.sql`, enable the PostGIS
   extension, create a public `media` storage bucket.
2. Load Jaipur wards: `python scripts/load_wards.py data/raw/wards.geojson`
   (see `data/README.md` for the download source).
3. Confirm wards render on a blank Leaflet map. Then split into tracks —
   each folder README has a build order that does NOT block on the others.
4. In parallel, one person: start the Meta developer app + WhatsApp test
   number (day-one task — only step with external approval uncertainty)
   and run `infra/` Terraform (see `deploy/README.md` for the full runbook).

## Tracks

| Track | Folder | Starts with |
|---|---|---|
| Intake (bot) | `bot/` | W3 + W2 text-only, tested with curl |
| Pipeline | `pipeline/` | `generate_synthetic_submissions.py`, don't wait for real data |
| Data + funding | `data/` | Scheme configs + evidence ingestion — zero dependencies |
| Dashboard | `frontend/` | Build against the mock JSON, swap to Supabase last |

## Environment

Copy `.env.example` to `.env`: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`,
`WHATSAPP_TOKEN`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
