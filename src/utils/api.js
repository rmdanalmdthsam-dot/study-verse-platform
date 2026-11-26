import { uploadPresigned } from '@vercel/blob/client';

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

export function getFileContentUrl(file) {
  if (file.storage !== 'blob') return file.url;
  const token = encodeURIComponent(getAuthToken() || '');
  return `/api/files/${encodeURIComponent(file.id)}/content?token=${token}`;
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
  const file = formData.get('file');
  if (!file) throw new Error('لم يتم اختيار ملف');

  if (!import.meta.env.PROD) {
    return uploadFileToLocalServer(formData, onProgress);
  }

  const modeResponse = await fetch(`${BASE_URL}/api/files/storage-mode`);
  if (!modeResponse.ok) throw new Error('تعذر التحقق من إعداد تخزين الملفات');
  const { blobUploadsEnabled } = await modeResponse.json();
  if (!blobUploadsEnabled) return uploadFileToLocalServer(formData, onProgress);

  const user = getCurrentUser();
  const token = getAuthToken();
  if (!user?.id || !token) throw new Error('تسجيل الدخول مطلوب');
  if (file.size > 1024 * 1024 * 1024) throw new Error('حجم الملف يتجاوز الحد المسموح (1 جيجابايت)');

  const id = `file_${crypto.randomUUID()}`;
  const safeName = file.name.replace(/[\\/]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180) || 'file';
  const pathname = `users/${user.id}/${crypto.randomUUID()}-${safeName}`;
  const tags = String(formData.get('tags') || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
  const metadata = {
    id,
    originalName: file.name,
    title: String(formData.get('title') || file.name),
    subjectId: String(formData.get('subjectId') || ''),
    tags,
    size: file.size,
    contentType: file.type || 'application/octet-stream'
  };

  try {
    const blob = await uploadPresigned(pathname, file, {
      access: 'private',
      handleUploadUrl: `${BASE_URL}/api/files/upload-presigned`,
      headers: { Authorization: `Bearer ${token}` },
      contentType: metadata.contentType,
      clientPayload: JSON.stringify(metadata),
      multipart: file.size > 5 * 1024 * 1024,
      onUploadProgress: (event) => {
        if (onProgress) onProgress(Math.round(event.percentage));
      }
    });
    const response = await fetch(`${BASE_URL}/api/files/finalize-upload`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ pathname: blob.pathname, metadata })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'تعذر حفظ بيانات الملف');
    return result;
  } catch (error) {
    throw new Error(error.message || 'تعذر رفع الملف');
  }
}

function uploadFileToLocalServer(formData, onProgress) {
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
