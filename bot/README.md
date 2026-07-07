# Intake track (n8n Cloud)

Every channel is a THIN adapter; all logic lives in one shared brain (03).
Import order + full wiring guide: `workflows/IMPORT.md`.

| WF | Trigger | Job |
|---|---|---|
| 03 Process Submission | Execute-Workflow | THE BRAIN. Checks for a pending-location follow-up first (works for every channel). Otherwise: one multimodal Gemini call (transcribe + describe + extract + ack + localized follow-up question), ward resolution (GPS point-in-polygon -> validated alias match -> pending), media upload to Supabase Storage, insert submission, log event. Returns {submission_id, ack_text, followup_text, ward_resolution, category, ask, mode}. Gemini call auto-retries once; hardened JSON fallback ensures no citizen message is ever dropped. |
| 02 Web Submit | Webhook (CORS on) | /citizen page posts here -> calls 03 -> returns the full response JSON for the confirmation card. |
| 01 Telegram | Telegram trigger | Normalize text/voice/photo/location -> 03 -> reply (ack + follow-up if location pending). |
| 01b WhatsApp | WhatsApp Cloud API trigger | Same as 01; filters out delivery/read receipts; two-step Graph media download; replies via Graph API. Test number = 5 whitelisted recipients. |
| 04 Notify | Webhook | The closed loop: MP takes up a work -> joins theme_submissions -> every contributing citizen gets a message in their language on their channel. Called by the dashboard after the take-up RPC (also accepts Supabase DB-webhook payloads). |

Design rules that must survive any edits:
- The LLM extracts and phrases; deterministic code resolves wards, decides,
  and writes. Gemini's ward_guess is VALIDATED against the wards table.
- One follow-up question maximum, generated in the citizen's language.
- Every ack echoes back what was understood (trust + free error correction).
- All channels write identical rows — nothing downstream knows the channel
  except as a display badge.
