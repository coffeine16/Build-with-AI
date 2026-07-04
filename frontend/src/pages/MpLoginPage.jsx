import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Field } from "../components/ui";

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
        <p className="kicker">MP Login</p>
        <h1>Constituency action cockpit</h1>
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
              value={form.passcode}
              onChange={(event) => setForm((prev) => ({ ...prev, passcode: event.target.value }))}
            />
          </Field>

          <Button variant="secondary" type="submit">Enter MP Dashboard</Button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </Card>
    </main>
  );
}
