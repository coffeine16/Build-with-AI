import { useMemo, useState } from "react";
import { categories, recommendations, statusLabels, statusOrder, wards } from "../data/recommendations";
import { setMpIssueActions } from "../lib/storage";
import { Badge, Button, Card, Field } from "../components/ui";

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

export default function MpDashboardPage({ session, issueActions, setIssueActions, onLogout }) {
  const [wardFilter, setWardFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeIssueId, setActiveIssueId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");

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
      return wardOk && categoryOk && statusOk;
    });
  }, [enriched, wardFilter, categoryFilter, statusFilter]);

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

  return (
    <main className="screen">
      <header className="topbar mp-topbar">
        <div>
          <p className="kicker">MP Dashboard</p>
          <h1>{session.fullName} | {session.constituency}</h1>
          <p className="subtitle">Prioritize high-impact issues and move them to execution.</p>
        </div>
        <div className="topbar-stats">
          <div className="topbar-stat">
            <span>Priority issues</span>
            <strong>{dashboardSignals.highPriority}</strong>
          </div>
          <div className="topbar-stat">
            <span>Citizen signals</span>
            <strong>{dashboardSignals.submissions}</strong>
          </div>
          <div className="topbar-stat">
            <span>Silent needs</span>
            <strong>{dashboardSignals.silentNeeds}</strong>
          </div>
        </div>
        <div className="row-actions">
          <Button variant="ghost" onClick={onLogout}>Log out</Button>
        </div>
      </header>

      <section className="status-strip">
        {statusOrder.map((statusKey) => (
          <Card key={statusKey} className={`status-chip status-chip-${statusKey}`}>
            <span>{statusLabels[statusKey]}</span>
            <strong>{statusCounts[statusKey]}</strong>
          </Card>
        ))}
      </section>

      <section className="grid two mp-workbench">
        <Card className="panel-card">
          <div className="panel-heading">
            <div>
              <h2>Issue Queue</h2>
              <p className="subtitle">Sorted by decision priority score.</p>
            </div>
            <Badge tone="blue">{filtered.length} visible</Badge>
          </div>
          <div className="filters-row">
            <Field label="Ward">
              <select value={wardFilter} onChange={(event) => setWardFilter(event.target.value)}>
                <option value="all">All wards</option>
                {wards.map((ward) => (
                  <option key={ward} value={ward}>{ward}</option>
                ))}
              </select>
            </Field>

            <Field label="Category">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {statusOrder.map((statusKey) => (
                  <option key={statusKey} value={statusKey}>{statusLabels[statusKey]}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="stack compact scroll-list">
            {filtered.map((issue) => (
              <article
                key={issue.id}
                className={`issue-row ${activeIssue?.id === issue.id ? "active" : ""}`}
                onClick={() => {
                  setActiveIssueId(issue.id);
                  setNoteDraft(issue.notes || "");
                }}
              >
                <div className="tile-head">
                  <strong>{issue.title}</strong>
                  <Badge tone={getStatusTone(issue.status)}>{statusLabels[issue.status]}</Badge>
                </div>
                <p>{issue.ward_name} | DPS {issue.dps}</p>
                <div className="tile-inline">
                  <Badge tone={issue.silent_need ? "violet" : "blue"}>
                    {issue.silent_need ? "Silent Need" : "Citizen Demand"}
                  </Badge>
                  <Badge tone={issue.dps_class.toLowerCase() === "high" ? "orange" : "slate"}>
                    DPS {issue.dps}
                  </Badge>
                  <span>{issue.n_submissions} submissions</span>
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
              <p className="subtitle">Move the selected signal into a real-world response.</p>
            </div>
            {activeIssue && <Badge tone={getStatusTone(activeIssue.status)}>{statusLabels[activeIssue.status]}</Badge>}
          </div>
          {!activeIssue && <p className="empty-state">Select an issue from the queue.</p>}
          {activeIssue && (
            <div className="stack">
              <div className="tile">
                <div className="tile-head">
                  <strong>{activeIssue.title}</strong>
                  <Badge tone={getStatusTone(activeIssue.status)}>{statusLabels[activeIssue.status]}</Badge>
                </div>
                <p>{activeIssue.mp_action}</p>
                <p className="muted">Scheme: {activeIssue.scheme_id} | Cost: INR {activeIssue.est_cost_inr.toLocaleString()}</p>
                <div className="signal-row">
                  <span className="signal-pill">{activeIssue.ward_name}</span>
                  <span className="signal-pill">{activeIssue.category}</span>
                  <span className="signal-pill">{activeIssue.n_submissions} submissions</span>
                </div>
              </div>

              <div className="button-grid">
                <Button variant="outline" onClick={() => transitionIssue(activeIssue, "taken_up")}>Take Up</Button>
                <Button variant="secondary" onClick={() => transitionIssue(activeIssue, "in_progress")}>Mark In Progress</Button>
                <Button variant="default" onClick={() => transitionIssue(activeIssue, "resolved")}>Mark Resolved</Button>
                <Button variant="ghost" onClick={() => transitionIssue(activeIssue, "parked")}>Park</Button>
              </div>

              <Field label="MP Action Notes">
                <textarea
                  value={noteDraft}
                  placeholder="Capture meeting decisions, officer assignment, file references"
                  onChange={(event) => setNoteDraft(event.target.value)}
                />
              </Field>
              <Button variant="secondary" onClick={saveIssueNote}>Save Note</Button>

              <div className="timeline">
                <div className="timeline-step">
                  <strong>1. Intake</strong>
                  <span className="muted">Citizen and bot signals normalized</span>
                </div>
                <div className="timeline-step">
                  <strong>2. Score</strong>
                  <span className="muted">DPS ranks urgency and reach</span>
                </div>
                <div className="timeline-step">
                  <strong>3. Decide</strong>
                  <span className="muted">MP action and notes captured</span>
                </div>
                <div className="timeline-step">
                  <strong>4. Update</strong>
                  <span className="muted">Status can flow back to citizens</span>
                </div>
              </div>

              <div className="stack compact">
                <h3>DPS Components</h3>
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
                <h3>Evidence Explanation</h3>
                {activeIssue.explanation.map((line) => (
                  <p key={line} className="bullet-line">- {line}</p>
                ))}
              </div>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}
