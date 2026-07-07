# Importing the workflows (v2 — complete MVP set)

**Hosting:** your n8n Cloud workspace (`https://<yourname>.app.n8n.cloud`).

## The five workflows and who calls whom

```
Telegram citizen ──> 01  ─┐
WhatsApp citizen ──> 01b ─┼──> 03 Process Submission ──> Supabase
/citizen web page ─> 02  ─┘         (the shared brain)
MP clicks "take up" ─────────> 04 Notify Citizens ──> Telegram/WhatsApp sends
```

The pending-ward follow-up loop lives INSIDE 03 now — if a citizen's
location can't be resolved, 03 returns a `followup_text` in their
language, the adapter appends it to the ack, and the citizen's NEXT
message (on any channel) is automatically treated as the location
answer. No per-channel duplication.

## Import order (matters)

1. `03-process-submission.json`  ← must exist first; 01/01b/02 reference it
2. `02-web-submit.json`
3. `01-telegram-inbound.json`
4. `01b-whatsapp-inbound.json`
5. `04-notify-citizens.json`

n8n: **Workflows → ⋯ → Import from File** for each.

## Credentials (create once)

- **Postgres** — Supabase pooler: host (`aws-0-...` or `aws-1-...` — check
  Supabase → Connect), port 5432, db `postgres`, user
  `postgres.<project-ref>`, your DB password, **SSL: Disable** (pooler
  handles TLS). Assign to every Postgres node in 03, 04.
- **Telegram** — BotFather token. Assign in 01 (trigger + sends) and 04.
- **WhatsApp Trigger** — in Meta developer console → your app → App
  settings → Basic: copy **App ID** and **App Secret** into n8n's
  WhatsApp Trigger credential. Assign in 01b's trigger node.

## Placeholders to fill (search each workflow for these)

| Placeholder | Where | Get it from |
|---|---|---|
| `YOUR_GEMINI_API_KEY` | 03 → Call Gemini (URL) | aistudio.google.com/apikey |
| `YOUR_SUPABASE_PROJECT_REF` | 03 → Upload Media + Build Media Ref | Supabase project URL |
| `YOUR_SUPABASE_SERVICE_ROLE_KEY` | 03 → Upload Media (2 headers) | Supabase → Settings → API |
| `WHATSAPP_TOKEN` | 01b (3 nodes), 04 (1 node) | Meta console → WhatsApp → API Setup → temporary access token |
| `WHATSAPP_PHONE_NUMBER_ID` | 01b + 04 send URLs | Same API Setup page |
| W3 reference | 01, 01b, 02 → "Run W3" node | Open the dropdown, pick "03 - Process Submission" + turn ON "Attempt to convert types" |

## Wire the channels

**Telegram:** publish 01, copy the Telegram Trigger's **Production URL**, then:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<production-url>
```
Verify with `/getWebhookInfo`.

**WhatsApp (Meta console):** publish 01b, open its trigger node — n8n
shows a **Callback URL** and **Verify Token**. In Meta console →
WhatsApp → Configuration: paste both, click Verify and Save, then
**subscribe to the `messages` webhook field**. In API Setup, add your
teammates' numbers as test recipients (OTP each). Test-number limit:
5 whitelisted recipients — judges use web/Telegram instead.

**Web (/citizen page):** POST to `https://<yourname>.app.n8n.cloud/webhook/submit`
CORS is already enabled (`allowedOrigins: *`). Frontend snippet:
```js
const res = await fetch(SUBMIT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    citizen_key: localStorageId,     // any stable per-browser id
    media_type: 'voice',             // 'text' | 'voice' | 'photo'
    audio_base64,                    // from MediaRecorder, base64 (no data: prefix)
    mime_type: 'audio/webm',
    lat, lng,                        // from navigator.geolocation, optional
  }),
});
const { ack_text, followup_text, category, ward_resolution, submission_id } = await res.json();
// show ack_text (+ followup_text if present) in the confirmation card
```

**MP "take up" (closing the loop):** after the dashboard calls the
Supabase RPC, it ALSO calls W4 directly:
```js
await supabase.rpc('transition_recommendation', { p_reco: id, p_status: 'taken_up', p_payload: {} });
await fetch('https://<yourname>.app.n8n.cloud/webhook/notify', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ recommendation_id: id }),
});
```
(Direct call preferred over a Supabase Database Webhook — saves n8n
executions; W4 also understands the DB-webhook payload if you wire that
later instead.)

## Test sequence (in this order)

1. **Curl 02 — text with a ward mentioned:**
   ```bash
   curl -X POST https://<yourname>.app.n8n.cloud/webhook/submit \
     -H "Content-Type: application/json" \
     -d '{"citizen_key":"test-1","media_type":"text","text":"school ki chhat tapakti hai, ward 4 mein"}'
   ```
   Expect `{ack_text, followup_text:"", ward_resolution:"alias_match", ...}`
   + rows in `citizens`, `submissions`, `events`.
2. **Curl 02 — pending flow:** send text with NO location
   (`"citizen_key":"test-2","text":"bijli nahi aa rahi"`) → expect
   `ward_resolution:"pending"` + a `followup_text`. Then curl AGAIN with
   the same citizen_key and `"text":"Ward 4"` → expect
   `mode:"ward_update"` and the original row's ward updated.
3. **Telegram:** text → voice note (Hindi) → photo → location share.
4. **WhatsApp:** same set from a whitelisted number.
5. **W4:** needs a recommendation with contributing submissions. Seed one:
   ```sql
   INSERT INTO themes (ward_id, category, label) VALUES (1,'education','Test theme') RETURNING id;      -- say 1
   INSERT INTO theme_submissions VALUES (1, <a real submission id from step 3>);
   INSERT INTO recommendations (theme_id, title, status) VALUES (1,'Repair school roof — test','proposed') RETURNING id;  -- say 1
   ```
   Then `curl -X POST .../webhook/notify -d '{"recommendation_id":1}'`
   → your own Telegram/WhatsApp should buzz.

## Known limitations (fine for MVP, say them out loud if asked)

- WhatsApp free-form replies work only within 24h of the citizen's last
  message (Cloud API rule). Fine for demo; production would use approved
  message templates for notifications.
- The Meta "temporary access token" expires every ~24h — refresh it in
  API Setup before the demo, or create a permanent System User token.
- n8n version drift: if a Code node errors on `getBinaryDataBuffer` /
  `prepareBinaryData`, check the method name for your n8n version.
- `urgency_signals` is `text[]`; if the pg driver complains about array
  binding, cast to `$10::text[]` in 03's Insert Submission query.
