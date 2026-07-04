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
          <p className="kicker">Hackathon Prototype</p>
          <h1>Civic issue intelligence for faster constituency response.</h1>
          <p className="subtitle">
            Awaaz converts citizen reports into ranked, evidence-backed action
            queues for elected representatives and ward teams.
          </p>
          <div className="hero-actions">
            <Link to="/mp/login" className="link-reset">
              <Button variant="default" size="lg">
                Open MP Workspace
              </Button>
            </Link>
            <Link to="/citizen/login" className="link-reset">
              <Button variant="outline" size="lg">
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
            <span>Citizen reports</span>
            <span>Intake webhook</span>
            <span>DPS scoring</span>
            <span>MP action queue</span>
          </div>
        </div>

        <div className="hero-stats home-stats" aria-label="Platform highlights">
          <div className="hero-stat">
            <span>Channels</span>
            <strong>Web + bot</strong>
          </div>
          <div className="hero-stat">
            <span>Prioritization</span>
            <strong>DPS ranked</strong>
          </div>
          <div className="hero-stat">
            <span>Workflow</span>
            <strong>Status tracked</strong>
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
            <div className="role-icon">C</div>
          </div>
          <p>
            Submit a local issue, see the ward pulse, and follow the themes
            being picked up for action.
          </p>
          <div className="role-tags">
            <span>Issue intake</span>
            <span>Ward status</span>
            <span>Updates</span>
          </div>
          <Link to="/citizen/login" className="link-reset">
            <Button variant="default" size="lg">
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
            <div className="role-icon">MP</div>
          </div>
          <p>
            Filter high-impact recommendations, capture decisions, and move
            public issues through execution stages.
          </p>
          <div className="role-tags">
            <span>DPS ranking</span>
            <span>Action center</span>
            <span>Evidence</span>
          </div>
          <Link to="/mp/login" className="link-reset">
            <Button variant="secondary" size="lg">
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
            Status can flow back to citizens by ward
          </span>
        </div>
      </section>
    </main>
  );
}
