# Intake v3 — upgrade notes

## What v3 adds (citizen-facing)

1. **"You are not alone"** — every issue is embedded (Gemini text-embedding-004)
   and matched against neighbors' submissions via pgvector. The ack says
   "23 aur logon ne bhi yahi samasya uthayi hai 🤝".
2. **Ticket IDs + status intent** — every issue gets `AWZ-<id>`; messaging
   "status" (or an AWZ number) returns live status of your submissions.
3. **"mera ward" intent** — conversational mini-dashboard: top issue
   categories in the citizen's ward, in chat.
4. **Multi-issue splitting** — one voice note with 3 problems = 3 separate
   tickets, each categorized, embedded, counted, and listed in the ack.
5. **Voice replies** — if the citizen sent voice, the ack is also synthesized
   via Google Cloud TTS (Hindi/English) and sent back as a voice note.
6. **Emergency triage** — `critical` severity triggers an instant admin
   Telegram alert; the citizen's ack includes the 112 helpline pointer.
7. **Entitlement tips** — category-matched scheme awareness lines
   (JJM, RTE, Ayushman Bharat...) appended to acks.
8. **Armor** — webhook dedupe by channel_message_id (Meta retries cause
   duplicates by design) + per-citizen hourly rate limiting, both
   deterministic and BEFORE any Gemini spend.

## Setup steps (on top of the v2 IMPORT.md steps)

1. Run `db/patches/002_intake_v3.sql` in Supabase SQL Editor (pgvector,
   new columns, indexes).
2. Import `03-process-submission.json` (replace the old 03: deactivate/
   delete old, import this, then re-select it in every "Run W3" node of
   01, 01b, 02).
3. New placeholders in 03 v3:
   - `YOUR_GEMINI_API_KEY` — now in TWO nodes: "Call Gemini" AND "Embed Issue"
   - `YOUR_SUPABASE_PROJECT_REF` / `YOUR_SUPABASE_SERVICE_ROLE_KEY` — now in
     FOUR nodes: Upload Media, Media Ref, Upload Voice, Final With Voice
   - `ADMIN_CHAT_ID` — in "Alert Admin": your team Telegram group/DM chat id
     (message your bot from that chat, read chat.id from the execution, or
     use @userinfobot)
   - `YOUR_GCP_TTS_API_KEY` — in "Call TTS": from the teammate's GCP project,
     enable the "Cloud Text-to-Speech API" (console -> APIs & Services ->
     Enable), then create an API key (APIs & Services -> Credentials).
     NOTE: this is a GCP console API key, NOT the AI Studio Gemini key.
4. TTS + Alert Admin nodes are set to `onError: continue` — if TTS or the
   admin alert fails, the citizen still gets their text ack. Degradation
   over breakage, always.

## New test cases (add to the v2 sequence)

- Send a voice note with TWO problems ("paani nahi aa raha aur road bhi
  tooti hai") -> expect 2 rows, ack lists AWZ-x and AWZ-y, and a VOICE
  reply arrives.
- Send the same text twice quickly via Telegram -> second one silently
  ignored? No — Telegram gives each message a new message_id, so both
  process (correct). Dedupe fires on Meta/WhatsApp redeliveries of the
  SAME message id.
- Send "status" -> get your list with statuses.
- Send "mere ward mein kya chal raha hai" -> ward category counts.
- Send "hello" -> friendly nudge, NO row inserted.
- Send something like "yahan bijli ka taar gira hua hai, chingari nikal
  rahi hai" -> severity critical: admin Telegram gets the alert, ack
  mentions 112.
- Send 9 messages inside an hour -> 9th gets the polite throttle.

## Cost note

Two Gemini calls per new-issue submission now (generation + embedding per
issue). Embeddings are ~free-tier friendly; still, the rate limiter caps
worst-case spend per citizen.
