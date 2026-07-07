# Extraction prompt (lives inside W3 → "Build Gemini Request" node)

This is what actually gets sent to Gemini for every submission, regardless
of channel. Kept here as a readable reference so the team can review/tune
it without opening n8n.

```
You process a citizen's message about a local development need in an
Indian constituency (categories: education, water, roads, health,
electricity, sanitation, other). The input may include audio, an image,
and/or the text below.

Citizen text (may be empty if audio/image only): <trig.text>
Citizen-shared location text (may be empty): <trig.location_text>

Output ONLY strict JSON, no markdown, matching exactly this shape:
{
  "transcript": string or null,        // verbatim transcription if audio was given, else null
  "media_description": string or null, // factual description if an image was given, else null
  "ask": string,                       // one-line summary in English of what the citizen needs
  "category": "education|water|roads|health|electricity|sanitation|other",
  "sub_type": string,                  // short snake_case tag, e.g. infrastructure_repair, tap_connection, road_repair
  "urgency_signals": [string],         // ONLY signals explicitly present, e.g. ["monsoon","children_affected"]. [] if none.
  "language": string,                  // ISO code of the language the citizen used, e.g. "hi", "en"
  "ward_guess": string or null,        // EXACT copy of one name from the ward list below, or null if unsure. NEVER invent a name.
  "ack_text": string,                  // 1-2 warm sentences IN THE CITIZEN'S LANGUAGE confirming what was
                                        // understood and that they'll get an update. NEVER promise the work will be done.
  "location_followup": string          // one short question IN THE CITIZEN'S LANGUAGE asking which ward/area/mohalla
                                        // they live in (always generated; only sent when we can't locate them)
}

(The prompt also tells Gemini whether GPS coordinates were provided, so it
doesn't ask for location in ack_text when we already have it.)

Ward list (pick ward_guess ONLY from these names, exactly as written): <injected from wards table>

Rules: use null for anything absent or uncertain. Never guess urgency,
category, or ward if not clearly indicated by the citizen.
```

Design notes:
- One multimodal call does transcription + vision description + extraction
  + ack generation + ward guessing, all at once — no separate ASR service.
- `ward_guess` is constrained to an injected list of real ward names +
  aliases, but the code AFTER Gemini (in "Parse & Resolve Ward") validates
  it against the actual `wards` table before trusting it. If Gemini
  hallucinates a name, it just fails the match and falls back to
  `ward_resolution = 'pending'` — never silently wrong.
- `ack_text` is generated in the citizen's own language and is what gets
  sent back to them — this is the "echo back what we understood" UX
  pattern, and it's also free error-correction (a wrong ack makes the
  citizen reply and correct it).
