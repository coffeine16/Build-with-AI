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
      <Card className="auth-card">
        <p className="kicker">Client Login</p>
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
              placeholder="10 digit mobile"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </Field>

          <Field label="Ward">
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

          <Button type="submit">Continue to Citizen Dashboard</Button>
        </form>
      </Card>
    </main>
  );
}
