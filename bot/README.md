# Intake track (n8n on EC2)

Every channel (Telegram, WhatsApp, the web /citizen page) posts into one
shared processing workflow. Channels are thin adapters; the brain is W3.

## Workflows

| WF | Trigger | Job |
|---|---|---|
| W3 Process Submission | Execute-Workflow | THE BRAIN: one multimodal Gemini call (transcribe + describe + extract + ack text), ward resolution (PostGIS point-in-polygon → validated alias match → 'pending'), media upload to Supabase Storage, insert into submissions. Returns {ack_text, submission_id}. |
| W2 Web Submit | Webhook | Receives {media_type, text?, audio_base64?, photo_base64?, lat?, lng?} from the /citizen page → calls W3 → returns ack JSON. |
| W1 Telegram | Telegram trigger | Normalize (text/voice/photo/location) → pending-ward check → calls W3 → sends ack reply. |
| W1b WhatsApp | WhatsApp Cloud API trigger | Same as W1 for the Meta test number (5 whitelisted numbers). |
| W4 Notify | Webhook | Called on MP "take up": joins theme_submissions → distinct citizens → sends Telegram/WhatsApp notifications. |

## Build order
1. W3 + W2, text-only. Milestone: curl a JSON body → row in `submissions`
   with extracted fields → response contains ack_text. This unblocks the
   pipeline track with REAL rows.
2. W1 Telegram text path.
3. Voice path (Telegram getFile → base64 → same Gemini call, audio part
   inline — NO separate ASR service). Then photo path.
4. Pending-ward follow-up loop (one question max; check for a 'pending'
   submission from this citizen in the last 30 min before treating a
   message as new).
5. WhatsApp adapter (start the Meta developer app + test number setup on
   DAY ONE — it's the only step with external uncertainty).
6. W4 Notify.

## Haq scars to pre-empt
- Wrap every Gemini JSON parse in try/catch with one "output valid JSON
  only" retry.
- "Attempt to Convert Types" ON for every Execute-Workflow node.
- Set WEBHOOK_URL correctly in compose BEFORE registering any webhook.

## Depends on
`wards` table loaded (scripts/load_wards.py) + PostGIS extension enabled
in Supabase (Dashboard → Database → Extensions → postgis).
