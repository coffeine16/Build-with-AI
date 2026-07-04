import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import CitizenDashboardPage from "../pages/CitizenDashboardPage";
import CitizenLoginPage from "../pages/CitizenLoginPage";
import MpDashboardPage from "../pages/MpDashboardPage";
import MpLoginPage from "../pages/MpLoginPage";
import RoleSelectPage from "../pages/RoleSelectPage";
import {
  clearCitizenSession,
  clearMpSession,
  getCitizenSession,
  getCitizenSubmissions,
  getMpIssueActions,
  getMpSession,
  setCitizenSession,
  setMpSession
} from "../lib/storage";

export default function AppRoutes() {
  const [citizenSession, setCitizenSessionState] = useState(() => getCitizenSession());
  const [mpSession, setMpSessionState] = useState(() => getMpSession());
  const [submissions, setSubmissions] = useState(() => getCitizenSubmissions());
  const [issueActions, setIssueActions] = useState(() => getMpIssueActions());

  const citizenHandlers = useMemo(
    () => ({
      onLogin: (session) => {
        setCitizenSessionState(session);
        setCitizenSession(session);
      },
      onLogout: () => {
        setCitizenSessionState(null);
        clearCitizenSession();
      }
    }),
    []
  );

  const mpHandlers = useMemo(
    () => ({
      onLogin: (session) => {
        setMpSessionState(session);
        setMpSession(session);
      },
      onLogout: () => {
        setMpSessionState(null);
        clearMpSession();
      }
    }),
    []
  );

  return (
    <Routes>
      <Route path="/" element={<RoleSelectPage />} />

      <Route
        path="/citizen/login"
        element={
          citizenSession ? (
            <Navigate to="/citizen/dashboard" replace />
          ) : (
            <CitizenLoginPage onLogin={citizenHandlers.onLogin} />
          )
        }
      />
      <Route
        path="/citizen/dashboard"
        element={
          citizenSession ? (
            <CitizenDashboardPage
              session={citizenSession}
              submissions={submissions}
              setSubmissions={setSubmissions}
              onLogout={citizenHandlers.onLogout}
            />
          ) : (
            <Navigate to="/citizen/login" replace />
          )
        }
      />

      <Route
        path="/mp/login"
        element={mpSession ? <Navigate to="/mp/dashboard" replace /> : <MpLoginPage onLogin={mpHandlers.onLogin} />}
      />
      <Route
        path="/mp/dashboard"
        element={
          mpSession ? (
            <MpDashboardPage
              session={mpSession}
              issueActions={issueActions}
              setIssueActions={setIssueActions}
              onLogout={mpHandlers.onLogout}
            />
          ) : (
            <Navigate to="/mp/login" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
