import { uploadPresigned } from '@vercel/blob/client';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function apiUrl(path) {
  return `${BASE_URL}${path}`;
}

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
  if (file.storage !== 'blob' && !file.url?.startsWith('/uploads/')) {
    return file.url?.startsWith('/') && !file.url.startsWith('//') ? apiUrl(file.url) : file.url;
  }
  const token = encodeURIComponent(getAuthToken() || '');
  return apiUrl(`/api/files/${encodeURIComponent(file.id)}/content?token=${token}`);
}

export async function downloadBackup(onProgress) {
  let fileHandle = null;
  if (typeof window.showSaveFilePicker === 'function') {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: `studyverse-backup-${new Date().toISOString().slice(0, 10)}.zip`,
      types: [{ description: 'ZIP backup', accept: { 'application/zip': ['.zip'] } }]
    });
  }

  const response = await fetch(`${BASE_URL}/api/backup/manifest`, { headers: authHeaders() });
  const manifest = await response.json();
  if (!response.ok) throw new Error(manifest.error || 'تعذر تجهيز بيانات النسخة الاحتياطية');

  const files = Array.isArray(manifest.files) ? manifest.files : [];
  const totalBytes = files.reduce((total, file) => total + (Number(file.size) || 0), 0);
  if (!fileHandle && totalBytes > 100 * 1024 * 1024) {
    throw new Error('النسخة كبيرة للتنزيل على هذا المتصفح. افتح المنصة باستخدام Chrome أو Edge على الكمبيوتر.');
  }

  const { BlobWriter, ZipWriter } = await import('@zip.js/zip.js');
  const blobWriter = fileHandle ? null : new BlobWriter('application/zip');
  const output = fileHandle ? await fileHandle.createWritable() : blobWriter;
  const zipWriter = new ZipWriter(output, { level: 0 });
  let downloadedBytes = 0;
  const backupFiles = [];

  const safePathPart = (value) => String(value || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 180) || 'file';

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      let contentUrl;
      if (file.storage === 'blob' || file.url?.startsWith('/uploads/')) {
        contentUrl = getFileContentUrl(file);
      } else if (file.url?.startsWith('/') && !file.url.startsWith('//')) {
        contentUrl = file.url;
      } else {
        throw new Error(`مسار الملف "${file.title}" غير صالح للنسخ الاحتياطي`);
      }

      const fileResponse = await fetch(contentUrl);
      if (!fileResponse.ok || !fileResponse.body) {
        throw new Error(`تعذر تنزيل الملف "${file.title}"؛ لم تكتمل النسخة الاحتياطية`);
      }

      const archivePath = `files/${safePathPart(file.id)}/${safePathPart(file.originalName || file.title)}`;
      const trackedBody = fileResponse.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          downloadedBytes += chunk.byteLength;
          if (onProgress && totalBytes) {
            onProgress(Math.min(99, Math.floor((downloadedBytes / totalBytes) * 100)));
          }
          controller.enqueue(chunk);
        }
      }));

      await zipWriter.add(archivePath, trackedBody, { level: 0 });
      backupFiles.push({ ...file, archivePath });
      if (onProgress && !totalBytes) onProgress(Math.floor(((index + 1) / Math.max(files.length, 1)) * 99));
    }

    const backupManifest = { ...manifest, files: backupFiles };
    await zipWriter.add('backup.json', new Blob([JSON.stringify(backupManifest, null, 2)]).stream(), { level: 0 });
    await zipWriter.close();

    if (blobWriter) {
      const archive = await blobWriter.getData();
      const downloadUrl = URL.createObjectURL(archive);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `studyverse-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
    if (onProgress) onProgress(100);
  } catch (error) {
    if (fileHandle && output && typeof output.abort === 'function') {
      await output.abort(error).catch(() => {});
    }
    throw error;
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
      handleUploadUrl: apiUrl('/api/files/upload-presigned'),
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
