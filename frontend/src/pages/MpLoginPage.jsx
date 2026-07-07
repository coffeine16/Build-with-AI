import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Field, Seal } from "../components/ui";

export default function MpLoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    constituency: "Jaipur",
    passcode: ""
  });

  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (form.passcode !== "MP1234") {
      setError("Invalid passcode. Use MP1234 for prototype access.");
      return;
    }

    onLogin({
      fullName: form.fullName,
      constituency: form.constituency,
      role: "mp",
      loginAt: new Date().toISOString()
    });
    navigate("/mp/dashboard");
  };

  return (
    <main className="screen screen-login">
      <Card className="auth-card mp-auth-card">
        <Seal size={40} className="auth-card-seal auth-card-seal-mp" />
        <p className="kicker">MP Cockpit Login</p>
        <h1>Constituency action workspace</h1>
        <p className="subtitle">Review priority signals and move issues from demand to execution.</p>

        <form className="stack" onSubmit={handleSubmit}>
          <Field label="MP Name">
            <input
              required
              placeholder="e.g. Rahul Singh"
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            />
          </Field>

          <Field label="Constituency">
            <input
              required
              value={form.constituency}
              onChange={(event) => setForm((prev) => ({ ...prev, constituency: event.target.value }))}
            />
          </Field>

          <Field label="Prototype Passcode">
            <input
              required
              type="password"
              placeholder="Use passcode MP1234"
              value={form.passcode}
              onChange={(event) => setForm((prev) => ({ ...prev, passcode: event.target.value }))}
            />
          </Field>

          <Button variant="secondary" type="submit" size="lg" className="w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Enter Dashboard Workspace
          </Button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </Card>
    </main>
  );
}
