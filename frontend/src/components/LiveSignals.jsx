import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseReady } from "../lib/supabase";
import { Badge, Button, Card } from "./ui";

const REFRESH_MS = 15000;

function timeAgo(iso) {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

const CHANNEL_TONE = { telegram: "blue", whatsapp: "green", web: "violet", ivr: "orange" };

// Live feed of raw citizen submissions straight from Supabase (auto-generated
// REST, anon key). This is real intake — unlike the scored queue, which is
// still the illustrative model in mock_recommendations.json.
export function LiveSignals() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(supabaseReady ? "loading" : "unconfigured");
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    if (!supabaseReady) return;
    const { data, error } = await supabase
      .from("submissions")
      .select("id, ask, category, sub_type, channel, media_type, created_at, ward_id, wards(name)")
      .order("id", { ascending: false })
      .limit(15);
    if (error) {
      setStatus("error");
      return;
    }
    setRows(data || []);
    setStatus("ready");
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (!supabaseReady) return undefined;
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <Card className="panel-card">
      <div className="panel-heading">
        <div>
          <h2>Live Incoming Signals</h2>
          <p className="subtitle">
            Real citizen submissions from Supabase, refreshing every {REFRESH_MS / 1000}s.
          </p>
        </div>
        {status === "ready" && (
          <Badge tone="green">
            ● Live{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString()}` : ""}
          </Badge>
        )}
        {status === "unconfigured" && <Badge tone="slate">Not connected</Badge>}
        {status === "error" && <Badge tone="orange">Connection error</Badge>}
      </div>

      {status === "unconfigured" && (
        <p className="empty-state">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to see
          live submissions here.
        </p>
      )}
      {status === "error" && (
        <p className="error-text">
          Could not read submissions from Supabase. Check the URL / anon key and that the
          table is readable.
        </p>
      )}
      {status === "loading" && <p className="empty-state">Loading live signals…</p>}
      {status === "ready" && rows.length === 0 && (
        <p className="empty-state">No submissions yet — send one via Telegram or /citizen.</p>
      )}

      {status === "ready" && rows.length > 0 && (
        <div className="stack compact scroll-list">
          {rows.map((row) => (
            <article key={row.id} className="tile">
              <div className="tile-head">
                <strong>{row.ask || "(no summary)"}</strong>
                <span className="muted">{timeAgo(row.created_at)}</span>
              </div>
              <div className="tile-inline">
                {row.category && <Badge tone="blue">{row.category}</Badge>}
                {row.sub_type && <Badge tone="slate">{row.sub_type}</Badge>}
                <Badge tone={CHANNEL_TONE[row.channel] || "slate"}>{row.channel}</Badge>
                {row.media_type && row.media_type !== "text" && (
                  <Badge tone="orange">{row.media_type}</Badge>
                )}
                <span className="muted">{row.wards?.name || (row.ward_id ? `Ward #${row.ward_id}` : "ward pending")}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {supabaseReady && (
        <div style={{ marginTop: "0.75rem" }}>
          <Button variant="ghost" size="sm" onClick={load}>Refresh now</Button>
        </div>
      )}
    </Card>
  );
}
