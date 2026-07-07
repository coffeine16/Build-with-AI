import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { wards } from "../data/recommendations";
import { Button, Card, Field } from "../components/ui";

export default function CitizenLoginPage({ onLogin }) {
  const navigate = useNavigate();
  const availableWards = useMemo(() => wards, []);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    ward_name: availableWards[0] || "",
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin({
      ...form,
      role: "citizen",
      loginAt: new Date().toISOString(),
    });
    navigate("/citizen/dashboard");
  };

  return (
    <main className="screen screen-login">
      <Card className="auth-card citizen-auth-card">
        <p className="kicker">Client Access</p>
        <h1>Raise local issues with context</h1>
        <p className="subtitle">
          Enter your ward details to open the client workspace and submit a
          report into the shared civic queue.
        </p>

        <form className="stack" onSubmit={handleSubmit}>
          <Field label="Full Name">
            <input
              required
              placeholder="e.g. Riya Sharma"
              value={form.fullName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, fullName: event.target.value }))
              }
            />
          </Field>

          <Field label="Phone Number">
            <input
              required
              pattern="[0-9]{10}"
              placeholder="e.g. 9876543210"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </Field>

          <Field label="Your Ward Area">
            <select
              value={form.ward_name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, ward_name: event.target.value }))
              }
            >
              {availableWards.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          </Field>

          <Button type="submit" variant="default" size="lg" className="w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
            </svg>
            Continue to Dashboard
          </Button>
        </form>
      </Card>
    </main>
  );
}
