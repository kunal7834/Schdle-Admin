const API_URL = process.env.REACT_APP_API_URL || '';

const handle = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
};

// ---------------- Events ----------------
export const fetchEvents = () =>
  fetch(`${API_URL}/api/events`).then(handle);

export const createEvents = (events) =>
  fetch(`${API_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  }).then(handle);

export const deleteEvent = (id) =>
  fetch(`${API_URL}/api/events/${id}`, { method: 'DELETE' }).then(handle);

// ---------------- Rosters ----------------
export const fetchRosters = () =>
  fetch(`${API_URL}/api/rosters`).then(handle);

export const saveRoster = (section, students) =>
  fetch(`${API_URL}/api/rosters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, students }),
  }).then(handle);

// ---------------- Master Schedule ----------------
export const uploadMaster = (events, meta) =>
  fetch(`${API_URL}/api/master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events, meta }),
  }).then(handle);

export const clearMaster = () =>
  fetch(`${API_URL}/api/master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [], meta: null }),
  }).then(handle);

export const fetchMasterMeta = () =>
  fetch(`${API_URL}/api/master-meta`).then(handle);
