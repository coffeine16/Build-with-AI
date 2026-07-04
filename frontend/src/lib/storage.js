const STORAGE_KEYS = {
  citizenSession: "awaaz.citizen.session",
  citizenSubmissions: "awaaz.citizen.submissions",
  mpSession: "awaaz.mp.session",
  mpIssueActions: "awaaz.mp.issue-actions",
};

function readJson(key, fallbackValue) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallbackValue;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCitizenSession() {
  return readJson(STORAGE_KEYS.citizenSession, null);
}

export function setCitizenSession(session) {
  writeJson(STORAGE_KEYS.citizenSession, session);
}

export function clearCitizenSession() {
  localStorage.removeItem(STORAGE_KEYS.citizenSession);
}

export function getCitizenSubmissions() {
  return readJson(STORAGE_KEYS.citizenSubmissions, []);
}

export function setCitizenSubmissions(items) {
  writeJson(STORAGE_KEYS.citizenSubmissions, items);
}

export function getMpSession() {
  return readJson(STORAGE_KEYS.mpSession, null);
}

export function setMpSession(session) {
  writeJson(STORAGE_KEYS.mpSession, session);
}

export function clearMpSession() {
  localStorage.removeItem(STORAGE_KEYS.mpSession);
}

export function getMpIssueActions() {
  return readJson(STORAGE_KEYS.mpIssueActions, {});
}

export function setMpIssueActions(actions) {
  writeJson(STORAGE_KEYS.mpIssueActions, actions);
}
