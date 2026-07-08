# Deployment — bringing up the stack and getting the live URL

Live system: **GCP Compute Engine VM (n8n + Caddy) + Supabase
(DB / storage / REST) + Vercel (frontend)**. The ML pipeline runs offline
and its output is committed to the repo — it does **not** run on this VM.
There is NO custom API server; the frontend reads via Supabase's
auto-generated REST.

Live URL: **https://awaaz.duckdns.org**

The VM itself is provisioned first — see [`infra/README.md`](../infra/README.md)
(the `gcloud` runbook: project, static IP, firewall, VM, Docker). This doc
picks up once you can SSH into `awaaz-n8n`.

## Runbook (in order)

### 0. Supabase first (unblocks everyone, do before the VM)
1. Create a Supabase project (free tier).
2. SQL Editor → run `db/schema.sql` (then `db/patches/002_intake_v3.sql`).
3. Storage → create a public bucket `media` (for citizen voice notes / photos).
4. Share the session-pooler host + DB password + anon key with the team.

### 1. Provision the VM
Follow [`infra/README.md`](../infra/README.md) → you end with a running
`awaaz-n8n` VM, a reserved static IP, and Docker installed.

### 2. DNS
Point a free DuckDNS subdomain (`awaaz.duckdns.org`) at the static IP —
covered in `infra/README.md` step 5. Do this **before** step 3 or Caddy's
first certificate request fails.

### 3. Bring up the stack (on the VM, via browser SSH)
```bash
mkdir -p ~/awaaz && cd ~/awaaz
# copy deploy/docker-compose.example.yml and deploy/Caddyfile.example here
# (git clone the repo on the box, or paste the files with nano)
cp docker-compose.example.yml docker-compose.yml
cp Caddyfile.example Caddyfile
# set your subdomain in both files:
sed -i 's/YOUR_SUBDOMAIN/awaaz/g' docker-compose.yml Caddyfile

docker compose up -d
docker compose logs -f caddy        # wait ~30-60s for "certificate obtained", then Ctrl+C
```

### 4. n8n
Open `https://<subdomain>` → create the owner account → import the bot
workflows (from `/bot`, **03 first**, then 02, 01, 01b, 04) → recreate the
credentials (they do NOT carry over from n8n Cloud):
- **Postgres** — Supabase **session pooler** (host `aws-x-...pooler.supabase.com`,
  port 5432, db `postgres`, user `postgres.<project-ref>`, password,
  **SSL: Disable**). Assign to every Postgres node in 03 and 04.
- **Telegram** — BotFather token (used in 01 and 04).
- **WhatsApp OAuth** — Meta App ID + App Secret (01b's trigger; optional).

In 01, 01b, 02: open the **"Run W3"** node → re-select
"03 - Process Submission" from the dropdown (workflow IDs are new on this
instance) → confirm "Attempt to convert types" is ON. The API keys inside
HTTP nodes (Gemini, Supabase service key, WhatsApp token) travel inside the
JSONs — spot-check they're present, don't retype. **Activate** 01, 01b, 02,
04 (03 is a sub-workflow, no activation needed).

### 5. Re-point webhooks (do ONCE, against the stable URL)
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<W1 production URL>
```
- **Telegram**: re-registers automatically when 01 is toggled on. Verify:
  `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` → url shows the
  duckdns domain.
- **WhatsApp**: Meta developer console → app → WhatsApp → Configuration →
  Edit callback URL = 01b's new Production URL, verify token `awaaz2026`,
  subscribe to `messages`.

### 6. Frontend
Connect the repo to Vercel, root = `/frontend`. Env vars:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
`VITE_SUBMIT_WEBHOOK_URL=https://<subdomain>.duckdns.org/webhook/submit`
(the W2 web-submit URL). Redeploy. The Vercel URL **is the prototype
link** — `/citizen` and `/mp` routes.

### 7. Pipeline
Runs **offline**, not on this VM — `python pipeline/hotspot_model.py`
regenerates the map data (`frontend/src/data/wardHotspots.json` +
`wardBoundaries.json`), which is committed to the repo. Re-run it after
editing `frontend/mock_recommendations.json`.

## Sanity checks
- `https://<subdomain>` → n8n login page with a green padlock
- `cd ~/awaaz && docker compose logs -f n8n` → running, no crash loop
- Message the Telegram bot → row appears in Supabase `submissions`
- Vercel URL loads the role-select screen

## Ongoing
- The VM survives reboots (`restart: unless-stopped`) — nothing to babysit.
- Update n8n later: `docker compose pull && docker compose up -d`.
- **Teardown after the hackathon**: delete the VM and release the static
  IP — see `infra/README.md`.
