import { Link } from "react-router-dom";
import { Badge, Card, Button } from "../components/ui";

export default function RoleSelectPage() {
  return (
    <main className="screen role-screen">
      <nav className="home-nav" aria-label="Awaaz navigation">
        <div>
          <strong>Awaaz</strong>
          <span>Civic Intelligence Platform</span>
        </div>
      </nav>

      <section className="home-hero">
        <div className="hero-copy">
          <p className="kicker">Core System Hub</p>
          <h1>Civic issue intelligence for faster constituency response.</h1>
          <p className="subtitle">
            Awaaz converts citizen reports into ranked, evidence-backed action
            queues for elected representatives and ward teams.
          </p>
          <div className="hero-actions">
            <Link to="/mp/login" className="link-reset">
              <Button variant="default" size="lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                Open MP Workspace
              </Button>
            </Link>
            <Link to="/citizen/login" className="link-reset">
              <Button variant="outline" size="lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Open Client View
              </Button>
            </Link>
          </div>
        </div>

        <div className="home-system-panel" aria-label="Platform flow">
          <div className="system-panel-head">
            <span>Live System Flow</span>
            <Badge tone="green">Prototype Ready</Badge>
          </div>
          <div className="system-flow">
            <span>Citizen reports intake</span>
            <span>Clustering webhook</span>
            <span>DPS priority scoring</span>
            <span>MP action workspace</span>
          </div>
        </div>

        <div className="hero-stats home-stats" aria-label="Platform highlights">
          <div className="hero-stat">
            <span>Channels</span>
            <strong>Web + Chatbot</strong>
          </div>
          <div className="hero-stat">
            <span>Prioritization</span>
            <strong>DPS Ranked</strong>
          </div>
          <div className="hero-stat">
            <span>Workflow</span>
            <strong>Status Tracked</strong>
          </div>
        </div>
      </section>

      <section className="grid two role-grid">
        <Card className="role-card citizen-glow">
          <div className="role-card-top">
            <div>
              <p className="kicker">Client View</p>
              <h2>Report and track ward issues</h2>
            </div>
            <div className="role-card-mark">
              <span className="role-index">01</span>
              <div className="role-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
            </div>
          </div>
          <p>
            Submit a local issue with category details, voice notes, or photos.
            See the ward pulse and follow the themes being taken up for action.
          </p>
          <div className="role-tags">
            <span>Issue intake</span>
            <span>Ward status</span>
            <span>Updates</span>
          </div>
          <Link to="/citizen/login" className="link-reset">
            <Button variant="outline" size="lg" className="w-full">
              Continue as Client
            </Button>
          </Link>
        </Card>

        <Card className="role-card mp-glow">
          <div className="role-card-top">
            <div>
              <p className="kicker">MP View</p>
              <h2>Prioritize and move work forward</h2>
            </div>
            <div className="role-card-mark">
              <span className="role-index">02</span>
              <div className="role-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                  <line x1="15" y1="3" x2="15" y2="21"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                </svg>
              </div>
            </div>
          </div>
          <p>
            Filter high-impact recommendations, capture executive decisions, 
            allocate schemes, and transition public issues through tracked stages.
          </p>
          <div className="role-tags">
            <span>DPS ranking</span>
            <span>Action center</span>
            <span>Evidence</span>
          </div>
          <Link to="/mp/login" className="link-reset">
            <Button variant="secondary" size="lg" className="w-full">
              Continue as MP
            </Button>
          </Link>
        </Card>
      </section>

      <section className="timeline">
        <div className="timeline-step">
          <strong>Citizen signal</strong>
          <span className="muted">
            Reports arrive from web, text, or bot channels
          </span>
        </div>
        <div className="timeline-step">
          <strong>Backend scoring</strong>
          <span className="muted">
            Submissions are clustered, de-biased, and ranked
          </span>
        </div>
        <div className="timeline-step">
          <strong>MP action</strong>
          <span className="muted">
            Priority items move through a tracked workflow
          </span>
        </div>
        <div className="timeline-step">
          <strong>Public update</strong>
          <span className="muted">
            Status flows back transparently to ward citizens
          </span>
        </div>
      </section>
    </main>
  );
}
