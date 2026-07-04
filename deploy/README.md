# Deployment — getting the live URL

Final live system: **EC2 (n8n + pipeline + caddy) + Supabase (DB/storage/REST) + Vercel (frontend)**.
There is NO custom API server — the frontend reads via Supabase's auto-generated REST.

## Runbook (in order)

### 0. Supabase first (unblocks everyone, do before EC2)
1. Create a Supabase project (free tier).
2. SQL Editor → run `db/schema.sql`.
3. Storage → create a public bucket `media` (for citizen voice notes / photos).
4. Share `DATABASE_URL` + anon key with the team.

### 1. Provision EC2
```bash
cd infra
terraform init
terraform apply        # outputs public IP + writes awaaz-key.pem (gitignored)
```

### 2. DNS
Create a free DuckDNS subdomain (e.g. `awaaz.duckdns.org`) pointing at the Elastic IP.

### 3. Bring up the stack
```bash
scp -r deploy ubuntu@<ip>:~/awaaz         # or git clone on the box
ssh -i infra/awaaz-key.pem ubuntu@<ip>
cd ~/awaaz/deploy
cp docker-compose.example.yml docker-compose.yml   # fill Supabase creds + subdomain
cp Caddyfile.example Caddyfile                      # fill subdomain
docker compose up -d
docker compose logs caddy | grep certificate        # wait ~30s for Let's Encrypt
```

### 4. n8n
Open `https://<subdomain>` → create owner account → import the bot workflows
(from `/bot`) → set credentials (Telegram token, Supabase Postgres, Gemini key).

### 5. Webhooks (do ONCE, against the stable URL)
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<W1 production URL>
```
WhatsApp: Meta developer console → your app → WhatsApp → Configuration →
set callback URL to the WhatsApp workflow's production URL + verify token.

### 6. Frontend
Connect the repo to Vercel, root = `/frontend`. Env vars:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUBMIT_WEBHOOK_URL`
(= the W2 web-submit production URL on n8n).
The Vercel URL **is the prototype link** — `/citizen` and `/mp` routes.

### 7. Pipeline
Runs automatically as the `pipeline` container (restart: unless-stopped —
no laptop or terminal needs to stay open). Before the demo, set
`PIPELINE_INTERVAL=120` and `docker compose up -d pipeline` so judge
submissions appear on the map within ~2 minutes.

## Sanity checks
- `https://<subdomain>` → n8n login page with a green padlock
- `docker compose logs -f pipeline` → ticks every N seconds
- Message the Telegram bot → row appears in Supabase `submissions`
- Vercel URL loads the role-select screen
