const BASE_URL = '';

export function getAuthToken() {
  return localStorage.getItem('study_token');
}

export function setAuthToken(token) {
  if (token) localStorage.setItem('study_token', token);
  else localStorage.removeItem('study_token');
}

export function getCurrentUser() {
  const user = localStorage.getItem('study_user');
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) localStorage.setItem('study_user', JSON.stringify(user));
  else localStorage.removeItem('study_user');
}

function authHeaders(extra = {}) {
  const token = getAuthToken();
  const headers = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function register(name, email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل التسجيل');
  setAuthToken(data.token);
  setCurrentUser(data.user);
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');
  setAuthToken(data.token);
  setCurrentUser(data.user);
  return data;
}

export function logout() {
  setAuthToken(null);
  setCurrentUser(null);
  window.location.reload();
}

export async function fetchSyncInfo() {
  try {
    const res = await fetch(`${BASE_URL}/api/sync/info`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchSubjects() {
  const res = await fetch(`${BASE_URL}/api/subjects`, { headers: authHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function createSubject(data) {
  const res = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function fetchFiles(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/api/files?${query}`, { headers: authHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function uploadFile(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/api/files/upload`);
    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

export async function updateFile(id, data) {
  const res = await fetch(`${BASE_URL}/api/files/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function deleteFile(id) {
  const res = await fetch(`${BASE_URL}/api/files/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return await res.json();
}

export async function fetchNotes(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/api/notes?${query}`, { headers: authHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function createNote(data) {
  const res = await fetch(`${BASE_URL}/api/notes`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function updateNote(id, data) {
  const res = await fetch(`${BASE_URL}/api/notes/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function deleteNote(id) {
  const res = await fetch(`${BASE_URL}/api/notes/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return await res.json();
}

export async function fetchFlashcards() {
  const res = await fetch(`${BASE_URL}/api/flashcards`, { headers: authHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function createFlashcard(data) {
  const res = await fetch(`${BASE_URL}/api/flashcards`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function reviewFlashcard(id) {
  const res = await fetch(`${BASE_URL}/api/flashcards/${id}/review`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({})
  });
  return await res.json();
}

export async function deleteFlashcard(id) {
  const res = await fetch(`${BASE_URL}/api/flashcards/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return await res.json();
}

export async function fetchPomodoroStats() {
  const res = await fetch(`${BASE_URL}/api/pomodoro/stats`, { headers: authHeaders() });
  if (!res.ok) return { totalSessions: 0, totalHours: '0.0' };
  return await res.json();
}

export async function logPomodoroSession(data) {
  const res = await fetch(`${BASE_URL}/api/pomodoro/session`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
  return await res.json();
}
