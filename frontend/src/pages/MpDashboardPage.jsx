import { useMemo, useState } from "react";
import { categories, recommendations, statusLabels, statusOrder, wards } from "../data/recommendations";
import { setMpIssueActions } from "../lib/storage";
import { Badge, Button, Card, CountUp, Field, StandoutRibbon } from "../components/ui";
import { WardHotspotMap } from "../components/WardHotspotMap";
import { LiveSignals } from "../components/LiveSignals";

function getDerivedStatus(issueId, issueActions) {
  return issueActions[issueId]?.status || "new";
}

function getStatusTone(status) {
  if (status === "resolved") return "green";
  if (status === "in_progress") return "blue";
  if (status === "taken_up") return "violet";
  if (status === "parked") return "slate";
  return "orange";
}

const STATUS_ICON_PATHS = {
  new: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12" y2="16.51" />
    </>
  ),
  taken_up: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </>
  ),
  in_progress: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  resolved: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  parked: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="10" y1="15" x2="10" y2="9" />
      <line x1="14" y1="15" x2="14" y2="9" />
    </>
  )
};

function StatusIcon({ status }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="status-chip-icon" aria-hidden="true">
      {STATUS_ICON_PATHS[status]}
    </svg>
  );
}

export default function MpDashboardPage({ session, issueActions, setIssueActions, onLogout }) {
  const [wardFilter, setWardFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIssueId, setActiveIssueId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [notifyState, setNotifyState] = useState(null);
  const notifyUrl = import.meta.env.VITE_NOTIFY_WEBHOOK_URL;

  const enriched = useMemo(() => {
    return recommendations
      .map((issue) => ({
        ...issue,
        status: getDerivedStatus(issue.id, issueActions),
        notes: issueActions[issue.id]?.notes || "",
        updatedAt: issueActions[issue.id]?.updatedAt || null
      }))
      .sort((a, b) => b.dps - a.dps);
  }, [issueActions]);

  const filtered = useMemo(() => {
    return enriched.filter((issue) => {
      const wardOk = wardFilter === "all" || issue.ward_name === wardFilter;
      const categoryOk = categoryFilter === "all" || issue.category === categoryFilter;
      const statusOk = statusFilter === "all" || issue.status === statusFilter;
      const searchOk = searchQuery.trim() === "" || 
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.mp_action.toLowerCase().includes(searchQuery.toLowerCase());
      return wardOk && categoryOk && statusOk && searchOk;
    });
  }, [enriched, wardFilter, categoryFilter, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    return statusOrder.reduce((acc, key) => {
      acc[key] = enriched.filter((item) => item.status === key).length;
      return acc;
    }, {});
  }, [enriched]);

  const dashboardSignals = useMemo(() => {
    const highPriority = enriched.filter((item) => Number(item.dps) >= 75).length;
    const silentNeeds = enriched.filter((item) => item.silent_need).length;
    const submissions = enriched.reduce((sum, item) => sum + Number(item.n_submissions || 0), 0);
    return { highPriority, silentNeeds, submissions };
  }, [enriched]);

  const activeIssue = filtered.find((item) => item.id === activeIssueId) || filtered[0] || null;

  // Ping W4 so the citizen(s) behind this recommendation get messaged back
  // on their own channel. W4 looks the recipients up by recommendation_id;
  // if none are linked (e.g. a mock-only item), it silently no-ops.
  const notifyCitizens = async (issue) => {
    if (!notifyUrl) {
      setNotifyState({ tone: "err", text: "Notify webhook not configured (VITE_NOTIFY_WEBHOOK_URL)." });
      return;
    }
    setNotifyState({ tone: "pending", text: "Notifying the citizen…" });
    try {
      const res = await fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation_id: issue.id })
      });
      if (!res.ok) throw new Error("notify failed");
      setNotifyState({ tone: "ok", text: `Citizen notification dispatched for "${issue.title}".` });
    } catch {
      setNotifyState({ tone: "err", text: "Could not reach the notify service. Status saved; citizen not messaged." });
    }
  };

  const transitionIssue = (issue, newStatus) => {
    const next = {
      ...issueActions,
      [issue.id]: {
        ...(issueActions[issue.id] || {}),
        status: newStatus,
        updatedAt: new Date().toISOString()
      }
    };
    setIssueActions(next);
    setMpIssueActions(next);

    // "Take Up" is the moment the citizen loop closes — message them back.
    if (newStatus === "taken_up") {
      notifyCitizens(issue);
    }
  };

  const saveIssueNote = () => {
    if (!activeIssue) return;

    const next = {
      ...issueActions,
      [activeIssue.id]: {
        ...(issueActions[activeIssue.id] || {}),
        status: issueActions[activeIssue.id]?.status || "new",
        notes: noteDraft,
        updatedAt: new Date().toISOString()
      }
    };

    setIssueActions(next);
    setMpIssueActions(next);
  };

  const getTimelineStepStyle = (stepNumber, currentStatus) => {
    let isComplete = false;
    let isActive = false;

    if (stepNumber === 1) {
      isComplete = true; 
    } else if (stepNumber === 2) {
      if (currentStatus !== "new") isComplete = true;
      else isActive = true;
    } else if (stepNumber === 3) {
      if (currentStatus === "resolved") isComplete = true;
      else if (["taken_up", "in_progress", "parked"].includes(currentStatus)) isActive = true;
    } else if (stepNumber === 4) {
      if (currentStatus === "resolved") isActive = true;
    }

    if (isComplete) {
      return {
        "--step-bg": "var(--brand-dark)",
        "--step-border": "var(--brand-dark)",
        "--step-fg": "#ffffff"
      };
    }
    if (isActive) {
      return {
        "--step-border": "var(--brand)",
        "--step-fg": "var(--brand-dark)",
        "--step-ring": "0 0 0 3px rgba(15, 107, 63, 0.15)"
      };
    }
    return { opacity: 0.55 };
  };

  const formatCost = (val) => {
    if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(1)} Cr`;
    if (val >= 100000) return `₹ ${(val / 100000).toFixed(1)} Lakh`;
    return `₹ ${val.toLocaleString()}`;
  };

  return (
    <main className="screen">
      <header className="topbar mp-topbar">
        <div>
          <p className="kicker">MP Executive Workspace</p>
          <h1>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '10px'}}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            {session.fullName} | {session.constituency} Constituency
          </h1>
          <p className="subtitle">Prioritize high-impact public issues and track their execution pipeline.</p>
        </div>
        <div className="topbar-stats">
          <div className="topbar-stat">
            <span>Priority Issues</span>
            <strong><CountUp value={dashboardSignals.highPriority} /></strong>
          </div>
          <div className="topbar-stat">
            <span>Total Signals</span>
            <strong><CountUp value={dashboardSignals.submissions} /></strong>
          </div>
          <div className="topbar-stat">
            <span>Silent Needs</span>
            <strong><CountUp value={dashboardSignals.silentNeeds} /></strong>
          </div>
          <Button variant="ghost" onClick={onLogout} size="sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Log out
          </Button>
        </div>
      </header>

      <section className="status-strip">
        {statusOrder.map((statusKey) => (
          <Card key={statusKey} className={`status-chip status-chip-${statusKey}`}>
            <span>
              <StatusIcon status={statusKey} />
              {statusLabels[statusKey]}
            </span>
            <strong><CountUp value={statusCounts[statusKey]} /></strong>
          </Card>
        ))}
      </section>

      <Card className="panel-card ward-map-panel">
        <div className="panel-heading">
          <div>
            <h2>Ward Hotspot Map</h2>
            <p className="subtitle">Evidence vs. citizen submissions, ward by ward.</p>
          </div>
          <Badge tone="orange">Basic model</Badge>
        </div>
        <WardHotspotMap />
      </Card>

      <LiveSignals />

      <section className="grid two mp-workbench">
        <Card className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>Issue Queue</h2>
              <p className="subtitle">Scored by Decision Priority Score (DPS).</p>
            </div>
            <Badge tone="blue">{filtered.length} active</Badge>
          </div>

          <div className="stack compact" style={{ marginBottom: "1.25rem" }}>
            <Field label="Search Title or Action">
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ marginBottom: "0.5rem" }}
              />
            </Field>

            <div className="filters-row">
              <Field label="Ward">
                <select value={wardFilter} onChange={(event) => setWardFilter(event.target.value)}>
                  <option value="all">All Wards</option>
                  {wards.map((ward) => (
                    <option key={ward} value={ward}>{ward}</option>
                  ))}
                </select>
              </Field>

              <Field label="Category">
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="all">All Themes</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </Field>

              <Field label="Status">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All Statuses</option>
                  {statusOrder.map((statusKey) => (
                    <option key={statusKey} value={statusKey}>{statusLabels[statusKey]}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="stack compact scroll-list">
            {filtered.map((issue) => (
              <article
                key={issue.id}
                className={`issue-row ${activeIssue?.id === issue.id ? "active" : ""}`}
                onClick={() => {
                  setActiveIssueId(issue.id);
                  setNoteDraft(issue.notes || "");
                  setNotifyState(null);
                }}
              >
                <StandoutRibbon dpsClass={issue.dps_class} silentNeed={issue.silent_need} />
                <div className="tile-head">
                  <strong>{issue.title}</strong>
                  <Badge tone={getStatusTone(issue.status)}>{statusLabels[issue.status]}</Badge>
                </div>
                <p style={{fontSize: "0.8rem", color: "var(--muted)"}}>{issue.ward_name} | theme: {issue.category}</p>
                <div className="tile-inline">
                  <Badge tone={issue.silent_need ? "violet" : "blue"}>
                    {issue.silent_need ? "Silent Need" : "Citizen Demand"}
                  </Badge>
                  <Badge tone={issue.dps_class.toLowerCase() === "high" ? "orange" : "slate"}>
                    DPS {issue.dps}
                  </Badge>
                  <span>{issue.n_submissions} submissions ({issue.n_voice} voice)</span>
                </div>
              </article>
            ))}
            {filtered.length === 0 && <p className="empty-state">No issues match your filters.</p>}
          </div>
        </Card>

        <Card className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>Action Center</h2>
              <p className="subtitle">Execute transitions and allocate resources.</p>
            </div>
            {activeIssue && <Badge tone={getStatusTone(activeIssue.status)}>{statusLabels[activeIssue.status]}</Badge>}
          </div>
          {!activeIssue && <p className="empty-state">Select an issue from the queue to process.</p>}
          {activeIssue && (
            <div className="stack">
              <div className="issue-summary">
                <StandoutRibbon dpsClass={activeIssue.dps_class} silentNeed={activeIssue.silent_need} />
                <div className="tile-head">
                  <h3>{activeIssue.title}</h3>
                </div>
                <p>{activeIssue.mp_action}</p>
                <div className="tile-inline">
                  <Badge tone="slate">Scheme: {activeIssue.scheme_id.toUpperCase()}</Badge>
                  <Badge tone="green">Cost: {formatCost(activeIssue.est_cost_inr)}</Badge>
                </div>
                <div className="signal-row">
                  <span className="signal-pill">{activeIssue.ward_name}</span>
                  <span className="signal-pill">{activeIssue.category}</span>
                  <span className="signal-pill">{activeIssue.n_submissions} citizens</span>
                </div>
              </div>

              <div>
                <span className="section-label">Pipeline Stage Decision</span>
                <div className="button-grid">
                  <Button variant="outline" onClick={() => transitionIssue(activeIssue, "taken_up")} className={activeIssue.status === "taken_up" ? "border-brand" : ""}>
                    Take Up
                  </Button>
                  <Button variant="outline" onClick={() => transitionIssue(activeIssue, "in_progress")} className={activeIssue.status === "in_progress" ? "border-brand" : ""}>
                    In Progress
                  </Button>
                  <Button variant="default" onClick={() => transitionIssue(activeIssue, "resolved")}>
                    Resolve
                  </Button>
                  <Button variant="ghost" onClick={() => transitionIssue(activeIssue, "parked")}>
                    Park
                  </Button>
                </div>
                {notifyState && (
                  <p className={notifyState.tone === "err" ? "error-text" : "ack"} style={{ marginTop: "0.75rem" }}>
                    {notifyState.text}
                  </p>
                )}
              </div>

              <Field label="Administrative Actions & Notes">
                <textarea
                  value={noteDraft}
                  placeholder="Capture meeting minutes, department reference files, officer assignments..."
                  onChange={(event) => setNoteDraft(event.target.value)}
                />
              </Field>
              <Button variant="secondary" onClick={saveIssueNote}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Executive Notes
              </Button>

              <div>
                <span className="section-label">Constituency Stepper Status</span>
                <div className="timeline">
                  <div className="timeline-step" style={getTimelineStepStyle(1, activeIssue.status)}>
                    <strong>Intake</strong>
                    <span className="muted">Citizen signals validated</span>
                  </div>
                  <div className="timeline-step" style={getTimelineStepStyle(2, activeIssue.status)}>
                    <strong>Score</strong>
                    <span className="muted">DPS priority assigned</span>
                  </div>
                  <div className="timeline-step" style={getTimelineStepStyle(3, activeIssue.status)}>
                    <strong>Decide</strong>
                    <span className="muted">Taken up & notes saved</span>
                  </div>
                  <div className="timeline-step" style={getTimelineStepStyle(4, activeIssue.status)}>
                    <strong>Update</strong>
                    <span className="muted">Resolution published</span>
                  </div>
                </div>
              </div>

              <div className="stack compact">
                <h3>DPS Breakdown Components</h3>
                {Object.entries(activeIssue.components).map(([key, value]) => (
                  <div key={key} className="dps-row">
                    <span className="category">{key.replace("_", " ")}</span>
                    <div className="meter-track">
                      <div className="meter-fill" style={{ width: `${Math.min(100, Number(value) * 2.5)}%` }} />
                    </div>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              <div className="stack compact">
                <h3>Evidence Clustered Explanation</h3>
                {activeIssue.explanation.map((line) => (
                  <p key={line} className="bullet-line">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '6px'}}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}
