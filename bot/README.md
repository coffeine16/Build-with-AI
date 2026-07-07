# Awaaz — n8n Intake Workflows (clean, no secrets)

Five workflows make up the citizen intake layer. Every channel (Telegram,
WhatsApp, the web /citizen page) feeds ONE shared brain (workflow 03). All
API keys/tokens below are placeholders — fill them in n8n after import.

```
Telegram  → 01  ─┐
WhatsApp  → 01b ─┼──→ 03 Process Submission (the brain) ──→ Supabase
Web page  → 02  ─┘
MP "take up" ───────→ 04 Notify Citizens ──→ Telegram/WhatsApp reply
```

## What the brain (03) does per message
dedupe guard → hourly rate-limit → pending-ward check → ONE Gemini call
(intent + multi-issue split + severity + ack + follow-up) → route by intent:
- **new_issue** → per issue: embed (pgvector) → count similar neighbours
  ("N others raised this too") → insert ticket AWZ-<id> → emergency alert if
  critical → entitlement tip → optional voice-note reply (TTS)
- **status_check** → returns the citizen's tickets + live status
- **my_ward** → top issue categories in their ward, in chat
- **help / chitchat** → friendly guidance, no DB row

---

## IMPORT ORDER (must be 03 first)
1. `03-process-submission.json`
2. `02-web-submit.json`
3. `01-telegram-inbound.json`
4. `01b-whatsapp-inbound.json`
5. `04-notify-citizens.json`

n8n: **Workflows → ⋯ → Import from File** for each.

---

## STEP 1 — Database (Supabase)
Run once in Supabase SQL Editor, in order:
1. `db/schema.sql`
2. `db/patches/002_intake_v3.sql`  (adds pgvector, embedding, severity, dedupe cols)

Then create a **public** Storage bucket named exactly `media`
(Storage → New bucket → name `media` → Public ON).

Seed a few wards for testing (real Jaipur GeoJSON comes later):
```sql
ALTER TABLE wards ADD CONSTRAINT wards_name_unique UNIQUE (name);  -- prevents dup wards
INSERT INTO wards (ward_no, name, aliases) VALUES
  ('4','Ward 4', ARRAY['ward 4','ward4','ward chaar','4']),
  ('5','Ward 5', ARRAY['ward 5','ward5','ward paanch','5']),
  ('6','Ward 6', ARRAY['ward 6','ward6','ward chhah','6'])
ON CONFLICT (name) DO NOTHING;
```

## STEP 2 — Credentials (create once in n8n, reuse)
- **Supabase Postgres** (Postgres credential): host = Supabase *session pooler*
  host (`aws-x-...pooler.supabase.com`), port 5432, db `postgres`,
  user `postgres.<project-ref>`, your DB password, **SSL: Disable**.
- **Telegram** (Telegram credential): BotFather token.
- **WhatsApp OAuth** (WhatsApp OAuth API credential): Meta App ID + App Secret
  (only needed if you enable WhatsApp — optional).

After import, open each workflow and assign these creds to any node showing a
red credential warning. The placeholder ids in the files are:
`REPLACE_POSTGRES_CRED`, `REPLACE_TELEGRAM_CRED`, `REPLACE_WHATSAPP_TRIGGER_CRED`.

## STEP 3 — Link adapters to the brain
In **01, 01b, 02** open the **"Run W3"** node → Workflow dropdown → select
**"03 - Process Submission"** → turn ON **"Attempt to convert types"**.
(This replaces the `REPLACE_WITH_W3_WORKFLOW_ID` placeholder — the dropdown
writes the real local id.)

## STEP 4 — Fill the placeholder keys

### Workflow 03 (the brain)
| Placeholder | Count | Nodes | Value |
|---|---|---|---|
| `YOUR_GEMINI_API_KEY` | 2 | "Call Gemini", "Embed Issue" | aistudio.google.com/apikey |
| `YOUR_SUPABASE_PROJECT_REF` | 4 | Upload Media, Media Ref, Upload Voice, Final With Voice | the sub-domain of your Supabase URL |
| `YOUR_SUPABASE_SERVICE_ROLE_KEY` | 4 | same 4 nodes (headers) | Supabase → Settings → API → service_role (secret) |
| `ADMIN_CHAT_ID` | 1 | "Alert Admin" | your team Telegram chat id (msg @userinfobot) |
| `YOUR_GCP_TTS_API_KEY` | 1 | "Call TTS" | GCP console API key with Cloud Text-to-Speech API enabled |

- If you don't have TTS yet: LEAVE `YOUR_GCP_TTS_API_KEY` as-is. The "Call TTS"
  node is set to continue-on-error, so voice replies just silently skip and the
  citizen still gets the text ack. Nothing breaks.

### Workflow 01b (WhatsApp — OPTIONAL, skip if not using WhatsApp)
| Placeholder | Nodes | Value |
|---|---|---|
| `WHATSAPP_TOKEN` | Get Media URL, Download Media, Send WhatsApp Reply | Meta access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Send WhatsApp Reply (URL) | Meta API Setup → Phone number ID |

If not using WhatsApp: import it but leave it **Inactive** — the placeholders are
inert while the workflow is off. Shows the architecture without needing Meta.

### Workflow 04 (notify — for the "MP took up your issue" loop)
| Placeholder | Nodes | Value |
|---|---|---|
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Send WhatsApp | same as 01b (skip if no WhatsApp) |
| Postgres + Telegram creds | its DB + Send Telegram nodes | assign as in Step 2 |

## STEP 5 — Activate + webhooks
- Activate **01, 02, 04** (and 01b only if using WhatsApp). 03 is a sub-workflow
  — it does NOT need activating.
- **Telegram**: activating 01 auto-registers its webhook. Verify:
  `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- **Web**: your /citizen page POSTs to `<n8n-url>/webhook/submit` (CORS is on).
- **WhatsApp** (optional): Meta → WhatsApp → Configuration → Callback URL =
  01b's Production URL, verify token any string, subscribe to `messages`.

---

## TEST SEQUENCE
```bash
# 1. Web submit (bypasses Telegram — proves the brain works)
curl -X POST <n8n-url>/webhook/submit \
  -H "Content-Type: application/json" \
  -d '{"citizen_key":"test-1","media_type":"text","text":"school ki chhat tapak rahi hai, ward 4 mein"}'
# expect JSON with ack_text + AWZ-<id>
```
Then on Telegram:
2. Text: `school ki chhat tapak rahi hai, ward 4 mein` → education ticket, Hindi ack, no "which ward?" question
3. Same topic again → ack shows "1 others in your area have raised this too 🤝"
4. `status` → your ticket list with statuses
5. `mere ward mein kya chal raha hai` → ward category counts
6. `namaste` → friendly nudge, NO new DB row
7. Voice note (Hindi) → transcript captured, education ticket
8. `ward 4 mein bijli ka nanga taar gira hai, chingari nikal rahi hai` → admin Telegram alert + 112 mention

Verify data:
```sql
SELECT id, ask, category, ward_id, ward_resolution, severity,
       (embedding IS NOT NULL) AS emb FROM submissions ORDER BY id DESC LIMIT 8;
```

---

## KEY FIXES BAKED IN (learned the hard way)
- **Robust Gemini parse**: scans all response `parts` for text (Gemini thinking
  models add a `thoughtSignature` part that breaks naive `parts[0].text`), strips
  fences, extracts the outer `{...}`. Without this, every call silently fell back.
- **Embedding model** is `gemini-embedding-001` with `outputDimensionality: 768`
  (matches the `vector(768)` column; the default 3072 would be rejected).
- **Tightened my_ward intent**: a message that names a ward AND reports a problem
  is `new_issue`, never `my_ward`.
- **Unique ward name constraint**: stops duplicate wards from re-seeding, which
  fragmented ward counts.
