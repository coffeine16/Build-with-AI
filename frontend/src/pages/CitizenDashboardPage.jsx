import { useMemo, useRef, useState } from "react";
import { recommendations } from "../data/recommendations";
import { setCitizenSubmissions } from "../lib/storage";
import { Badge, Button, Card, CountUp, Field, StandoutRibbon } from "../components/ui";

export default function CitizenDashboardPage({ session, submissions, setSubmissions, onLogout }) {
  const [ackText, setAckText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newIssue, setNewIssue] = useState({
    message: "",
    channel: "text",
    shareLocation: true
  });
  const [audio, setAudio] = useState(null); // { blob, url, mime }
  const [photo, setPhoto] = useState(null); // { base64, url, mime, name }
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const wardRecommendations = useMemo(
    () =>
      recommendations
        .filter((item) => item.ward_name === session.ward_name)
        .sort((a, b) => b.dps - a.dps),
    [session.ward_name]
  );

  const topThemes = useMemo(() => {
    const byCategory = recommendations.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = { category: item.category, count: 0, totalDps: 0 };
      }
      acc[item.category].count += 1;
      acc[item.category].totalDps += item.dps;
      return acc;
    }, {});

    return Object.values(byCategory)
      .map((item) => ({
        ...item,
        avgDps: (item.totalDps / item.count).toFixed(1)
      }))
      .sort((a, b) => Number(b.avgDps) - Number(a.avgDps));
  }, []);

  const wardAvgDps = useMemo(() => {
    if (wardRecommendations.length === 0) return "0.0";
    const total = wardRecommendations.reduce((sum, item) => sum + Number(item.dps), 0);
    return (total / wardRecommendations.length).toFixed(1);
  }, [wardRecommendations]);

  const webhookUrl = import.meta.env.VITE_SUBMIT_WEBHOOK_URL;

  // Stable per-citizen key so repeat web submissions are recognized as the
  // same person (W2 otherwise mints a throwaway web-<timestamp> each call,
  // breaking status lookups and per-citizen dedupe/rate-limit).
  const citizenKey = `web-${session.phone || session.fullName || "anon"}`;

  // Resolve browser GPS only when the citizen opted in. Never blocks the
  // submit: falls back to null coords on denial, error, or timeout.
  const resolveCoords = () =>
    new Promise((resolve) => {
      if (!newIssue.shareLocation || !("geolocation" in navigator)) {
        resolve({ lat: null, lng: null });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });

  // Read a Blob/File as base64 with the "data:...;base64," prefix stripped,
  // which is the shape W2 expects for audio_base64 / photo_base64.
  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  // Prefer ogg/opus so web voice notes match the Telegram path Gemini already
  // handles; fall back to whatever the browser supports.
  const pickAudioMime = () => {
    const prefs = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
    return prefs.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const fullType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: fullType });
        // Gemini wants a bare mime (audio/ogg, audio/webm) — strip ";codecs=opus".
        const bareMime = fullType.split(";")[0];
        setAudio({ blob, url: URL.createObjectURL(blob), mime: bareMime });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setAckText("Microphone access was blocked — can't record a voice note.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handlePhoto = async (file) => {
    if (!file) {
      setPhoto(null);
      return;
    }
    const base64 = await blobToBase64(file);
    setPhoto({ base64, url: URL.createObjectURL(file), mime: file.type, name: file.name });
  };

  const resetComposer = () => {
    setNewIssue({ message: "", channel: "text", shareLocation: true });
    setAudio(null);
    setPhoto(null);
  };

  const submitIssue = async (event) => {
    event.preventDefault();

    // Per-channel validation (the textarea is only required in text mode).
    const { channel, message } = newIssue;
    if (channel === "text" && message.trim().length < 10) {
      setAckText("Please describe the issue (at least 10 characters).");
      return;
    }
    if (channel === "voice" && !audio) {
      setAckText("Record a voice note first, then submit.");
      return;
    }
    if (channel === "photo" && !photo) {
      setAckText("Choose a photo first, then submit.");
      return;
    }

    setIsSubmitting(true);

    try {
      let acknowledgement = "Issue submitted. Your ward team has been notified.";

      // Build the media payload W2 understands (audio_base64 / photo_base64 /
      // mime_type). W3's Gemini call transcribes audio and describes photos,
      // same as the Telegram path.
      let mediaType = "text";
      let audioBase64 = null;
      let photoBase64 = null;
      let mimeType = null;
      if (channel === "voice" && audio) {
        mediaType = "voice";
        audioBase64 = await blobToBase64(audio.blob);
        mimeType = audio.mime;
      } else if (channel === "photo" && photo) {
        mediaType = "photo";
        photoBase64 = photo.base64;
        mimeType = photo.mime;
      }

      if (webhookUrl) {
        const { lat, lng } = await resolveCoords();
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Field names MUST match the n8n W2 "Normalize Web Body" contract
          // (bot/workflows/02-web-submit.json): citizen_key, media_type, text,
          // audio_base64, photo_base64, mime_type, location_text, lat, lng.
          body: JSON.stringify({
            citizen_key: citizenKey,
            media_type: mediaType,
            text: message,
            audio_base64: audioBase64,
            photo_base64: photoBase64,
            mime_type: mimeType,
            location_text: session.ward_name, // pass the login ward as location context
            lat,
            lng
          })
        });

        if (!response.ok) {
          throw new Error("Webhook request failed");
        }

        const payload = await response.json();
        acknowledgement = payload.ack_text || acknowledgement;
      }

      const item = {
        id: Date.now(),
        ward_name: session.ward_name,
        text: message || `(${channel} submission)`,
        channel,
        createdAt: new Date().toISOString()
      };

      const updated = [item, ...submissions].slice(0, 10);
      setSubmissions(updated);
      setCitizenSubmissions(updated);
      setAckText(acknowledgement);
      resetComposer();
    } catch {
      setAckText("Could not reach submit service. Saved locally for now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getChannelIcon = (channel) => {
    if (channel === "voice") {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '4px'}}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
        </svg>
      );
    }
    if (channel === "photo") {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '4px'}}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '4px'}}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    );
  };

  return (
    <main className="screen">
      <header className="topbar vibrant-topbar">
        <div>
          <p className="kicker">Client Workspace</p>
          <h1>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '10px'}}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Hi {session.fullName}, your ward pulse is live
          </h1>
          <p className="subtitle">Constituency Ward Scope: {session.ward_name}</p>
        </div>
        <div className="topbar-stats">
          <div className="topbar-stat">
            <span>Open Signals</span>
            <strong><CountUp value={wardRecommendations.length} /></strong>
          </div>
          <div className="topbar-stat">
            <span>Avg Ward DPS</span>
            <strong><CountUp value={wardAvgDps} decimals={1} /></strong>
          </div>
          <Button variant="ghost" onClick={onLogout} size="sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Log out
          </Button>
        </div>
      </header>

      <section className="grid two">
        <Card className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>Submit a New Issue</h2>
              <p className="subtitle">Your report enters the common intake queue.</p>
            </div>
            <Badge tone="blue">Live Intake</Badge>
          </div>
          <form className="stack" onSubmit={submitIssue}>
            <Field label="Submission Channel">
              <select
                value={newIssue.channel}
                onChange={(event) => setNewIssue((prev) => ({ ...prev, channel: event.target.value }))}
              >
                <option value="text">Text Message</option>
                <option value="voice">Voice Recording</option>
                <option value="photo">Photo / Attachment</option>
              </select>
            </Field>

            <Field label={newIssue.channel === "text" ? "What is happening in your area?" : "Add a note (optional)"}>
              <textarea
                required={newIssue.channel === "text"}
                minLength={newIssue.channel === "text" ? 10 : undefined}
                placeholder="Describe the issue in detail, including specific landmarks or locations..."
                value={newIssue.message}
                onChange={(event) => setNewIssue((prev) => ({ ...prev, message: event.target.value }))}
              />
            </Field>

            {newIssue.channel === "voice" && (
              <Field label="Voice Note">
                <div className="stack compact">
                  {!isRecording && !audio && (
                    <Button type="button" variant="outline" onClick={startRecording}>
                      ● Start recording
                    </Button>
                  )}
                  {isRecording && (
                    <Button type="button" variant="outline" className="border-brand" onClick={stopRecording}>
                      ■ Stop recording
                    </Button>
                  )}
                  {audio && !isRecording && (
                    <div className="stack compact">
                      <audio controls src={audio.url} style={{ width: "100%" }} />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setAudio(null)}>
                        Re-record
                      </Button>
                    </div>
                  )}
                </div>
              </Field>
            )}

            {newIssue.channel === "photo" && (
              <Field label="Photo">
                <div className="stack compact">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => handlePhoto(event.target.files?.[0] || null)}
                  />
                  {photo && (
                    <div className="stack compact">
                      <img src={photo.url} alt="Selected preview" style={{ maxWidth: "100%", borderRadius: "8px" }} />
                      <span className="muted">{photo.name}</span>
                    </div>
                  )}
                </div>
              </Field>
            )}

            <label className="ui-check">
              <input
                type="checkbox"
                checked={newIssue.shareLocation}
                onChange={(event) => setNewIssue((prev) => ({ ...prev, shareLocation: event.target.checked }))}
              />
              <span>Share my browser GPS coordinates with this report</span>
            </label>

            <Button type="submit" disabled={isSubmitting} variant="default" size="lg" className="w-full">
              {isSubmitting ? (
                "Submitting Signal..."
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Submit Civic Signal
                </>
              )}
            </Button>
          </form>
          {ackText && (
            <p className={ackText.toLowerCase().includes("could not") ? "error-text" : "ack"}>
              {ackText}
            </p>
          )}
        </Card>

        <Card className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>My Ward Status</h2>
              <p className="subtitle">Ranked recommendations for your ward.</p>
            </div>
            <Badge tone="green">Actionable</Badge>
          </div>
          <div className="stack compact scroll-list">
            {wardRecommendations.length === 0 && (
              <p className="empty-state">No active civic updates yet for {session.ward_name}.</p>
            )}
            {wardRecommendations.map((item) => (
              <article key={item.id} className="tile">
                <StandoutRibbon dpsClass={item.dps_class} silentNeed={item.silent_need} />
                <div className="tile-head">
                  <strong>{item.title}</strong>
                  <Badge tone={item.dps_class.toLowerCase() === "high" ? "orange" : "slate"}>
                    DPS {item.dps}
                  </Badge>
                </div>
                <p>{item.mp_action}</p>
                <div className="tile-inline">
                  <Badge tone="blue">{item.category}</Badge>
                  {item.silent_need && <Badge tone="violet">Silent Need</Badge>}
                  <span className="muted">{item.n_submissions} signals received</span>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid two">
        <Card className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>Top Themes Across City</h2>
              <p className="subtitle">What the platform is hearing most strongly.</p>
            </div>
            <Badge tone="slate">City Pulse</Badge>
          </div>
          <div className="stack compact">
            {topThemes.map((theme) => (
              <article key={theme.category} className="metric-row">
                <span className="category">{theme.category}</span>
                <span>{theme.count} active clusters</span>
                <strong>Avg Priority: {theme.avgDps}</strong>
              </article>
            ))}
          </div>
        </Card>

        <Card className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>Recent Submissions</h2>
              <p className="subtitle">Local reports saved during this session.</p>
            </div>
            <Badge tone="slate">{submissions.length} saved</Badge>
          </div>
          <div className="stack compact scroll-list">
            {submissions.length === 0 && (
              <p className="empty-state">No submissions recorded during this session.</p>
            )}
            {submissions.map((item) => (
              <article key={item.id} className="tile">
                <p>{item.text}</p>
                <div className="tile-inline">
                  <span className="muted">
                    {getChannelIcon(item.channel)}
                    {item.channel.toUpperCase()} | {new Date(item.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}
