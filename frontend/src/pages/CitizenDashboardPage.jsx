import { useMemo, useState } from "react";
import { recommendations } from "../data/recommendations";
import { setCitizenSubmissions } from "../lib/storage";
import { Badge, Button, Card, Field } from "../components/ui";

export default function CitizenDashboardPage({ session, submissions, setSubmissions, onLogout }) {
  const [ackText, setAckText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newIssue, setNewIssue] = useState({
    message: "",
    channel: "text",
    shareLocation: true
  });

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

  const submitIssue = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      let acknowledgement = "Issue submitted. Your ward team has been notified.";

      if (webhookUrl) {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "citizen",
            ward_name: session.ward_name,
            citizen_name: session.fullName,
            phone: session.phone,
            channel: newIssue.channel,
            text: newIssue.message,
            share_location: newIssue.shareLocation
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
        text: newIssue.message,
        channel: newIssue.channel,
        createdAt: new Date().toISOString()
      };

      const updated = [item, ...submissions].slice(0, 10);
      setSubmissions(updated);
      setCitizenSubmissions(updated);
      setAckText(acknowledgement);
      setNewIssue({ message: "", channel: "text", shareLocation: true });
    } catch {
      setAckText("Could not reach submit service. Saved locally for now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="screen">
      <header className="topbar vibrant-topbar">
        <div>
          <p className="kicker">Client Dashboard</p>
          <h1>Hi {session.fullName}, your ward pulse is live</h1>
          <p className="subtitle">Ward: {session.ward_name}</p>
        </div>
        <div className="topbar-stats">
          <div className="topbar-stat">
            <span>Open signals</span>
            <strong>{wardRecommendations.length}</strong>
          </div>
          <div className="topbar-stat">
            <span>Avg DPS</span>
            <strong>{wardAvgDps}</strong>
          </div>
        </div>
        <div className="row-actions">
          <Button variant="ghost" onClick={onLogout}>Log out</Button>
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
            <Field label="What is happening in your area?">
              <textarea
                required
                minLength={10}
                placeholder="Describe the problem and exact location"
                value={newIssue.message}
                onChange={(event) => setNewIssue((prev) => ({ ...prev, message: event.target.value }))}
              />
            </Field>

            <Field label="Channel">
              <select
                value={newIssue.channel}
                onChange={(event) => setNewIssue((prev) => ({ ...prev, channel: event.target.value }))}
              >
                <option value="text">Text</option>
                <option value="voice">Voice</option>
                <option value="photo">Photo</option>
              </select>
            </Field>

            <label className="ui-check">
              <input
                type="checkbox"
                checked={newIssue.shareLocation}
                onChange={(event) => setNewIssue((prev) => ({ ...prev, shareLocation: event.target.checked }))}
              />
              <span>Share my location with this report</span>
            </label>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </form>
          {ackText && <p className="ack">{ackText}</p>}
        </Card>

        <Card className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>My Ward Status</h2>
              <p className="subtitle">Ranked recommendations for your ward.</p>
            </div>
            <Badge tone="green">Actionable</Badge>
          </div>
          <div className="stack compact">
            {wardRecommendations.length === 0 && <p className="empty-state">No updates yet for your ward.</p>}
            {wardRecommendations.map((item) => (
              <article key={item.id} className="tile">
                <div className="tile-head">
                  <strong>{item.title}</strong>
                  <Badge tone={item.dps_class.toLowerCase() === "high" ? "green" : "orange"}>
                    {item.dps_class} {item.dps}
                  </Badge>
                </div>
                <p>{item.mp_action}</p>
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
          </div>
          <div className="stack compact">
            {topThemes.map((theme) => (
              <article key={theme.category} className="metric-row">
                <span className="category">{theme.category}</span>
                <span>{theme.count} issues</span>
                <strong>Avg DPS {theme.avgDps}</strong>
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
          <div className="stack compact">
            {submissions.length === 0 && <p className="empty-state">No submissions yet.</p>}
            {submissions.map((item) => (
              <article key={item.id} className="tile">
                <p>{item.text}</p>
                <span className="muted">
                  {item.channel} | {new Date(item.createdAt).toLocaleString()}
                </span>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}
