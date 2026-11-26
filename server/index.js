import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import QRCode from 'qrcode';
import { Readable } from 'stream';
import { del, get, head, issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned } from '@vercel/blob/client';
import { fileURLToPath } from 'url';
import {
  getDb,
  saveDb,
  saveDbAsync,
  hashPassword,
  verifyPassword,
  createToken,
  getTokenClaims,
  createMediaToken,
  getMediaTokenClaims,
  initUserStarterData,
  loadCloudDb
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const trustedOrigins = new Set([
  'capacitor://localhost',
  'https://localhost'
]);
if (process.env.NODE_ENV !== 'production') {
  for (const origin of ['http://localhost', 'http://localhost:5173', 'http://127.0.0.1:5173']) {
    trustedOrigins.add(origin);
  }
}
for (const configuredOrigin of (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)) {
  let parsedOrigin;
  try {
    parsedOrigin = new URL(configuredOrigin);
  } catch {
    throw new Error(`CORS_ORIGINS must contain exact origins: ${configuredOrigin}`);
  }
  const normalizedOrigin = parsedOrigin.origin === 'null'
    ? `${parsedOrigin.protocol}//${parsedOrigin.host}`
    : parsedOrigin.origin;
  if (!['http:', 'https:', 'capacitor:'].includes(parsedOrigin.protocol) ||
    normalizedOrigin !== configuredOrigin || !['', '/'].includes(parsedOrigin.pathname) ||
    parsedOrigin.search || parsedOrigin.hash ||
    (process.env.NODE_ENV === 'production' && parsedOrigin.protocol === 'http:')) {
    throw new Error(`CORS_ORIGINS must contain exact origins: ${configuredOrigin}`);
  }
  trustedOrigins.add(configuredOrigin);
}

app.use(cors({
  origin: (origin, callback) => callback(null, Boolean(origin && trustedOrigins.has(origin))),
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use('/api', async (req, res, next) => {
  try {
    await loadCloudDb();
  } catch (err) {
    console.error('Database middleware error:', err);
  }
  next();
});

const UPLOADS_DIR = process.env.VERCEL === '1'
  ? path.join('/tmp', 'study-verse-storage')
  : path.join(__dirname, 'storage');
const PDF_DIR = path.join(UPLOADS_DIR, 'pdfs');
const VIDEO_DIR = path.join(UPLOADS_DIR, 'videos');
const IMAGE_DIR = path.join(UPLOADS_DIR, 'images');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
const OTHER_DIR = path.join(UPLOADS_DIR, 'others');
const BLOB_STORE_ID = process.env.BLOB_WEBHOOK_PUBLIC_KEY_STORE_ID;
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_WEBHOOK_PUBLIC_KEY_READ_WRITE_TOKEN;
const BLOB_WEBHOOK_PUBLIC_KEY = process.env.BLOB_WEBHOOK_PUBLIC_KEY_WEBHOOK_PUBLIC_KEY;
const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024;
const BLOB_OPTIONS = {
  token: BLOB_READ_WRITE_TOKEN,
  storeId: BLOB_STORE_ID
};

[UPLOADS_DIR, PDF_DIR, VIDEO_DIR, IMAGE_DIR, AUDIO_DIR, OTHER_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    if (mime.includes('pdf')) cb(null, PDF_DIR);
    else if (mime.startsWith('video/')) cb(null, VIDEO_DIR);
    else if (mime.startsWith('image/')) cb(null, IMAGE_DIR);
    else if (mime.startsWith('audio/')) cb(null, AUDIO_DIR);
    else cb(null, OTHER_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });

function getLocalIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    const lower = name.toLowerCase();
    if (lower.includes('vmware') || lower.includes('virtual') || lower.includes('vbox') || lower.includes('vethernet')) {
      continue;
    }
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        if (lower.includes('wi-fi') || lower.includes('wireless') || net.address.startsWith('192.168.')) {
          return net.address;
        }
        candidates.push(net.address);
      }
    }
  }
  return candidates[0] || 'localhost';
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'تسجيل الدخول مطلوب' });
  }
  const token = header.slice(7).trim();
  const claims = getTokenClaims(token);
  if (!claims || isTokenRevoked(claims.jti)) {
    return res.status(401).json({ error: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' });
  }
  req.userId = claims.userId;
  req.tokenId = claims.jti;
  req.tokenExpiration = claims.exp;
  next();
}

function isTokenRevoked(tokenId) {
  const db = getDb();
  const revokedTokens = Array.isArray(db.revokedTokens) ? db.revokedTokens : [];
  const activeTokens = revokedTokens.filter((token) => token.exp > Date.now());
  if (activeTokens.length !== revokedTokens.length) {
    db.revokedTokens = activeTokens;
    saveDb(db);
  }
  return activeTokens.some((token) => token.jti === tokenId);
}

function getRequestUserId(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const claims = getTokenClaims(header.slice(7).trim());
  return claims && !isTokenRevoked(claims.jti) ? claims.userId : null;
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    return cookie.slice(separator + 1).trim();
  }
  return '';
}

function getContentMetadata(file, fallbackMimeType = '') {
  const filename = file.originalName || file.title || 'file';
  const extension = path.extname(filename).toLowerCase();
  const safeFilename = encodeURIComponent(filename).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  const extensionTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac'
  };
  const declaredType = String(file.mimeType || fallbackMimeType || '').toLowerCase().split(';')[0].trim();
  const mimeType = declaredType || extensionTypes[extension] || '';
  const activeExtensions = new Set(['.html', '.htm', '.xhtml', '.svg', '.xml', '.js', '.mjs', '.cjs', '.css']);
  const activeMimeTypes = new Set([
    'text/html',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/javascript',
    'text/javascript'
  ]);
  if (activeExtensions.has(extension) || activeMimeTypes.has(mimeType)) {
    return { contentType: 'application/octet-stream', disposition: 'attachment', filename: safeFilename };
  }
  if (file.type === 'pdf') {
    return { contentType: 'application/pdf', disposition: 'inline', filename: safeFilename };
  }
  const isSafeMedia = (file.type === 'image' && mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') ||
    (file.type === 'video' && mimeType.startsWith('video/')) ||
    (file.type === 'audio' && mimeType.startsWith('audio/'));
  if (isSafeMedia) {
    return { contentType: mimeType, disposition: 'inline', filename: safeFilename };
  }
  return { contentType: 'application/octet-stream', disposition: 'attachment', filename: safeFilename };
}

function classifyFile(originalName, mimeType = '') {
  const mime = mimeType.toLowerCase();
  const ext = path.extname(originalName).toLowerCase();
  if (mime.includes('pdf') || ext === '.pdf') return 'pdf';
  if (mime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) return 'video';
  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return 'image';
  if (mime.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) return 'audio';
  return 'other';
}

function parseUploadMetadata(clientPayload, userId, pathname) {
  let metadata;
  try {
    metadata = JSON.parse(clientPayload || '');
  } catch {
    throw new Error('بيانات الملف غير صالحة');
  }

  if (!metadata || typeof metadata !== 'object'
    || typeof metadata.id !== 'string'
    || !/^file_[0-9a-f-]{36}$/i.test(metadata.id)
    || typeof metadata.originalName !== 'string'
    || !metadata.originalName.trim()
    || metadata.originalName.length > 255
    || typeof metadata.title !== 'string'
    || metadata.title.length > 200
    || !Number.isSafeInteger(metadata.size)
    || metadata.size < 0
    || metadata.size > MAX_UPLOAD_SIZE
    || typeof metadata.contentType !== 'string'
    || !/^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(metadata.contentType)) {
    throw new Error('بيانات الملف غير صالحة');
  }

  const expectedPrefix = `users/${userId}/`;
  if (!pathname.startsWith(expectedPrefix) || pathname.includes('..') || pathname.split('/').length !== 3) {
    throw new Error('مسار الملف غير صالح');
  }

  return {
    id: metadata.id,
    userId,
    pathname,
    originalName: metadata.originalName.trim(),
    title: metadata.title.trim() || metadata.originalName.trim(),
    subjectId: typeof metadata.subjectId === 'string' ? metadata.subjectId.slice(0, 128) : '',
    tags: Array.isArray(metadata.tags)
      ? metadata.tags.filter((tag) => typeof tag === 'string').slice(0, 20).map((tag) => tag.slice(0, 50))
      : [],
    size: metadata.size,
    contentType: metadata.contentType
  };
}

async function saveBlobFile(metadata, blob) {
  if (!blob || blob.pathname !== metadata.pathname || blob.size !== metadata.size) {
    throw new Error('بيانات الملف المرفوع لا تطابق الطلب');
  }

  const db = structuredClone(getDb());
  const existing = db.files.find((file) => file.pathname === metadata.pathname);
  if (existing) {
    if (existing.userId !== metadata.userId || existing.id !== metadata.id) {
      throw new Error('تعارض في بيانات الملف');
    }
    return existing;
  }

  const ownsSubject = db.subjects.some(
    (subject) => subject.id === metadata.subjectId && subject.userId === metadata.userId
  );
  const newFile = {
    id: metadata.id,
    userId: metadata.userId,
    title: metadata.title,
    filename: path.basename(metadata.pathname),
    originalName: metadata.originalName,
    type: classifyFile(metadata.originalName, blob.contentType || metadata.contentType),
    mimeType: blob.contentType || metadata.contentType,
    storage: 'blob',
    pathname: metadata.pathname,
    subjectId: ownsSubject ? metadata.subjectId : '',
    size: blob.size,
    url: `/api/files/${encodeURIComponent(metadata.id)}/content`,
    tags: metadata.tags,
    timestampNotes: [],
    createdAt: new Date().toISOString()
  };

  db.files.unshift(newFile);
  await saveDbAsync(db);
  return newFile;
}

// Auth API
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
  }
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  if (db.users.some((u) => u.email === normalizedEmail)) {
    return res.status(400).json({ error: 'هذا البريد مسجل بالفعل' });
  }

  const { hash, salt } = hashPassword(password);
  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newUser = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDb(db);
  initUserStarterData(db, userId, newUser.name);

  const token = createToken(userId);
  res.status(201).json({
    token,
    user: { id: newUser.id, name: newUser.name, email: newUser.email }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبة' });
  }
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email === normalizedEmail);
  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  }

  const token = createToken(user.id);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

app.get('/api/auth/me', auth, (req, res) => {
  const db = getDb();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/auth/logout', auth, async (req, res) => {
  const db = structuredClone(getDb());
  db.revokedTokens = (db.revokedTokens || []).filter((token) => token.exp > Date.now());
  if (!db.revokedTokens.some((token) => token.jti === req.tokenId)) {
    db.revokedTokens.push({ jti: req.tokenId, exp: req.tokenExpiration });
  }
  await saveDbAsync(db);
  res.json({ success: true });
});

// Sync & Device Pairing
app.get('/api/sync/info', async (req, res) => {
  const localIp = getLocalIp();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0].trim().toLowerCase();
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const isHttps = req.secure || forwardedProto === 'https' || process.env.VERCEL === '1';
  const phoneUrl = isHttps && host ? `https://${host}` : null;
  if (!phoneUrl) {
    return res.json({
      localIp,
      phoneUrl: null,
      qrCodeDataUrl: null,
      error: 'يجب فتح المنصة عبر HTTPS لإنشاء رمز ربط آمن'
    });
  }
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(phoneUrl, { margin: 2, scale: 7 });
    res.json({ localIp, phoneUrl, qrCodeDataUrl });
  } catch {
    res.json({ localIp, phoneUrl, qrCodeDataUrl: null });
  }
});

// Subjects (Isolated per user)
app.get('/api/subjects', auth, (req, res) => {
  const db = getDb();
  const userSubjects = db.subjects.filter((s) => s.userId === req.userId);
  const enriched = userSubjects.map((sub) => {
    const userFiles = db.files.filter((f) => f.userId === req.userId && f.subjectId === sub.id);
    return {
      ...sub,
      pdfCount: userFiles.filter((f) => f.type === 'pdf').length,
      videoCount: userFiles.filter((f) => f.type === 'video').length,
      imageCount: userFiles.filter((f) => f.type === 'image').length
    };
  });
  res.json(enriched);
});

app.post('/api/subjects', auth, (req, res) => {
  const { title, code } = req.body;
  if (!title) return res.status(400).json({ error: 'العنوان مطلوب' });
  const db = getDb();
  const newSub = {
    id: `sub_${Date.now()}`,
    userId: req.userId,
    title: title.trim(),
    code: code ? code.trim() : 'SUB',
    color: 'indigo',
    createdAt: new Date().toISOString()
  };
  db.subjects.push(newSub);
  saveDb(db);
  res.status(201).json(newSub);
});

// Files (Isolated per user)
app.get('/api/files', auth, (req, res) => {
  const { type, subjectId, search } = req.query;
  const db = getDb();
  let list = db.files.filter((f) => f.userId === req.userId);
  if (type) list = list.filter((f) => f.type === type);
  if (subjectId) list = list.filter((f) => f.subjectId === subjectId);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((f) => f.title.toLowerCase().includes(q));
  }
  res.json(list);
});

app.get('/api/files/storage-mode', (req, res) => {
  res.json({
    blobUploadsEnabled: Boolean(BLOB_STORE_ID && BLOB_READ_WRITE_TOKEN && BLOB_WEBHOOK_PUBLIC_KEY)
  });
});

app.get('/api/backup/manifest', auth, (req, res) => {
  const db = getDb();
  const user = db.users.find((item) => item.id === req.userId);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.setHeader('Cache-Control', 'private, no-store');

  const files = db.files
    .filter((file) => file.userId === req.userId)
    .map((file) => ({
      id: file.id,
      title: file.title,
      originalName: file.originalName,
      type: file.type,
      subjectId: file.subjectId,
      size: file.size,
      tags: file.tags || [],
      timestampNotes: file.timestampNotes || [],
      favorite: file.favorite || false,
      currentPage: file.currentPage,
      totalPages: file.totalPages,
      createdAt: file.createdAt,
      storage: file.storage || 'local',
      url: file.url
    }));

  res.json({
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    user: { id: user.id, name: user.name, email: user.email },
    subjects: db.subjects.filter((item) => item.userId === req.userId),
    files,
    notes: db.notes.filter((item) => item.userId === req.userId),
    flashcards: db.flashcards.filter((item) => item.userId === req.userId),
    pomodoroSessions: db.pomodoroSessions.filter((item) => item.userId === req.userId)
  });
});

app.post('/api/files/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف' });
  const { title, subjectId, tags } = req.body;
  const mime = (req.file.mimetype || '').toLowerCase();
  const ext = path.extname(req.file.originalname).toLowerCase();

  let type = 'other';
  let folder = 'others';
  if (mime.includes('pdf') || ext === '.pdf') { type = 'pdf'; folder = 'pdfs'; }
  else if (mime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) { type = 'video'; folder = 'videos'; }
  else if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) { type = 'image'; folder = 'images'; }
  else if (mime.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) { type = 'audio'; folder = 'audio'; }

  const db = getDb();
  const newFile = {
    id: `file_${Date.now()}`,
    userId: req.userId,
    title: title || req.file.originalname,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    type,
    subjectId: subjectId || '',
    size: req.file.size,
    url: `/uploads/${folder}/${req.file.filename}`,
    tags: tags ? tags.split(',').map((t) => t.trim()) : [],
    timestampNotes: [],
    createdAt: new Date().toISOString()
  };

  db.files.unshift(newFile);
  saveDb(db);
  res.status(201).json(newFile);
});

app.post('/api/files/upload-presigned', async (req, res) => {
  if (!BLOB_STORE_ID || !BLOB_READ_WRITE_TOKEN || !BLOB_WEBHOOK_PUBLIC_KEY) {
    return res.status(503).json({ error: 'التخزين السحابي غير مهيأ حالياً' });
  }

  try {
    const result = await handleUploadPresigned({
      body: req.body,
      request: req,
      webhookPublicKey: BLOB_WEBHOOK_PUBLIC_KEY,
      getSignedToken: async (pathname, clientPayload) => {
        const userId = getRequestUserId(req);
        if (!userId) throw new Error('Not authorized');

        const metadata = parseUploadMetadata(clientPayload, userId, pathname);
        const token = await issueSignedToken({
          ...BLOB_OPTIONS,
          pathname,
          operations: ['put'],
          maximumSizeInBytes: MAX_UPLOAD_SIZE,
          validUntil: Date.now() + 15 * 60 * 1000
        });

        return {
          token,
          urlOptions: {
            addRandomSuffix: false,
            allowOverwrite: false,
            tokenPayload: JSON.stringify(metadata)
          }
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const metadata = JSON.parse(tokenPayload || '');
        await saveBlobFile(metadata, blob);
      }
    });
    res.json(result);
  } catch (err) {
    console.error('Blob upload handling failed:', err);
    const status = err.message === 'Not authorized' ? 401 : 400;
    res.status(status).json({
      error: err.message === 'Not authorized' ? 'تسجيل الدخول مطلوب' : 'تعذر رفع الملف إلى التخزين السحابي'
    });
  }
});

app.post('/api/files/finalize-upload', auth, async (req, res) => {
  if (!BLOB_STORE_ID || !BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'التخزين السحابي غير مهيأ حالياً' });
  }

  try {
    const metadata = parseUploadMetadata(
      JSON.stringify(req.body.metadata || {}),
      req.userId,
      req.body.pathname || ''
    );
    const blob = await head(metadata.pathname, { ...BLOB_OPTIONS, access: 'private' });
    if (!blob) return res.status(404).json({ error: 'الملف المرفوع غير موجود' });

    const savedFile = await saveBlobFile(metadata, blob);
    res.status(201).json(savedFile);
  } catch (err) {
    console.error('Blob upload finalization failed:', err);
    res.status(400).json({ error: 'تعذر حفظ بيانات الملف' });
  }
});

app.post('/api/files/:id/access', auth, (req, res) => {
  const file = getDb().files.find((item) => item.id === req.params.id && item.userId === req.userId);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });

  const token = createMediaToken(req.userId, file.id, req.tokenId);
  const cookiePath = `/api/files/${encodeURIComponent(file.id)}/content`;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0].trim().toLowerCase();
  const secure = process.env.VERCEL === '1' || req.secure || forwardedProto === 'https';
  const sameSite = secure ? 'None; Secure' : 'Strict';
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Set-Cookie', `media_access=${token}; Max-Age=900; Path=${cookiePath}; HttpOnly; SameSite=${sameSite}`);
  res.json({ url: cookiePath });
});

app.get('/api/files/:id/content', async (req, res) => {
  const bearerUserId = getRequestUserId(req);
  const mediaClaims = getMediaTokenClaims(getCookie(req, 'media_access'), req.params.id);
  const mediaUserId = mediaClaims && !isTokenRevoked(mediaClaims.sessionId) ? mediaClaims.userId : null;
  const userId = bearerUserId || mediaUserId;
  if (!userId) return res.status(401).json({ error: 'تسجيل الدخول مطلوب' });

  const db = getDb();
  const file = db.files.find((item) => item.id === req.params.id && item.userId === userId);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Accept-Ranges', 'bytes');

  if (file.storage === 'blob' && file.pathname) {
    try {
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]) || file.size <= 0) {
          res.setHeader('Content-Range', `bytes */${file.size || 0}`);
          return res.status(416).end();
        }
        const suffixLength = Number(match[2]);
        const start = match[1]
          ? Number(match[1])
          : Math.max(file.size - suffixLength, 0);
        const end = match[1] && match[2]
          ? Number(match[2])
          : file.size - 1;
        if (start >= file.size || end >= file.size || start > end) {
          res.setHeader('Content-Range', `bytes */${file.size}`);
          return res.status(416).end();
        }
      }

      const blob = await get(file.pathname, {
        ...BLOB_OPTIONS,
        access: 'private',
        headers: range ? { Range: range } : undefined
      });
      if (!blob) return res.status(404).json({ error: 'الملف غير موجود في التخزين السحابي' });

      const contentRange = blob.headers.get('content-range');
      const contentLength = blob.headers.get('content-length');
      const metadata = getContentMetadata(file, blob.blob.contentType);
      res.status(contentRange ? 206 : 200);
      res.setHeader('Content-Type', metadata.contentType);
      const disposition = req.query.download === '1' ? 'attachment' : metadata.disposition;
      res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${metadata.filename}`);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      return Readable.fromWeb(blob.stream).pipe(res);
    } catch (err) {
      console.error('Blob content read failed:', err);
      return res.status(502).json({ error: 'تعذر فتح الملف من التخزين السحابي' });
    }
  }

  const relativeUrl = (file.url || '').replace(/^\/uploads\//, '');
  if (!relativeUrl) return res.status(404).json({ error: 'مسار الملف غير متاح' });

  const filePath = path.join(UPLOADS_DIR, ...relativeUrl.split('/'));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'الملف غير موجود على القرص' });

  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  const metadata = getContentMetadata(file, file.mimeType);
  res.setHeader('Content-Type', metadata.contentType);
  const disposition = req.query.download === '1' ? 'attachment' : metadata.disposition;
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${metadata.filename}`);

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]) || stat.size <= 0) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }
    const suffixLength = Number(match[2]);
    const start = match[1] ? Number(match[1]) : Math.max(stat.size - suffixLength, 0);
    const end = match[1] && match[2] ? Number(match[2]) : stat.size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size || end >= stat.size || start > end) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(filePath).pipe(res);
});

app.put('/api/files/:id', auth, async (req, res) => {
  const db = structuredClone(getDb());
  const file = db.files.find((f) => f.id === req.params.id && f.userId === req.userId);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
  if (typeof req.body.favorite === 'boolean') file.favorite = req.body.favorite;
  for (const field of ['currentPage', 'totalPages']) {
    if (Number.isFinite(req.body[field])) file[field] = req.body[field];
  }
  if (Array.isArray(req.body.timestampNotes)) file.timestampNotes = req.body.timestampNotes;
  if (typeof req.body.title === 'string') file.title = req.body.title.slice(0, 200);
  if (Array.isArray(req.body.tags)) {
    file.tags = req.body.tags.filter((tag) => typeof tag === 'string').slice(0, 20).map((tag) => tag.slice(0, 50));
  }
  if (typeof req.body.subjectId === 'string') {
    const ownsSubject = db.subjects.some((subject) => subject.id === req.body.subjectId && subject.userId === req.userId);
    if (ownsSubject || !req.body.subjectId) file.subjectId = req.body.subjectId;
  }
  try {
    await saveDbAsync(db);
  } catch (err) {
    console.error('File metadata save failed:', err);
    return res.status(500).json({ error: 'تعذر حفظ بيانات الملف' });
  }
  res.json(file);
});

app.delete('/api/files/:id', auth, async (req, res) => {
  const db = structuredClone(getDb());
  const file = db.files.find((f) => f.id === req.params.id && f.userId === req.userId);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });

  if (file.storage === 'blob' && file.pathname) {
    try {
      await del(file.pathname, BLOB_OPTIONS);
    } catch (err) {
      console.error('Blob deletion failed:', err);
      return res.status(502).json({ error: 'تعذر حذف الملف من التخزين السحابي' });
    }
  }

  db.files = db.files.filter((f) => f.id !== req.params.id);
  try {
    await saveDbAsync(db);
  } catch (err) {
    console.error('File record deletion failed:', err);
    return res.status(500).json({ error: 'تعذر حذف سجل الملف' });
  }
  res.json({ success: true });
});

// Notes (Isolated per user)
app.get('/api/notes', auth, (req, res) => {
  const db = getDb();
  const list = db.notes.filter((n) => n.userId === req.userId);
  res.json(list);
});

app.post('/api/notes', auth, (req, res) => {
  const { title, content, subjectId, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'العنوان مطلوب' });
  const db = getDb();
  const newNote = {
    id: `note_${Date.now()}`,
    userId: req.userId,
    title: title.trim(),
    content: content || '',
    subjectId: subjectId || '',
    tags: tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.notes.unshift(newNote);
  saveDb(db);
  res.status(201).json(newNote);
});

app.put('/api/notes/:id', auth, (req, res) => {
  const db = getDb();
  const note = db.notes.find((n) => n.id === req.params.id && n.userId === req.userId);
  if (!note) return res.status(404).json({ error: 'الملاحظة غير موجودة' });
  Object.assign(note, req.body, { updatedAt: new Date().toISOString() });
  saveDb(db);
  res.json(note);
});

app.delete('/api/notes/:id', auth, (req, res) => {
  const db = getDb();
  db.notes = db.notes.filter((n) => n.id !== req.params.id && n.userId === req.userId);
  saveDb(db);
  res.json({ success: true });
});

// Flashcards (Isolated per user)
app.get('/api/flashcards', auth, (req, res) => {
  const db = getDb();
  const list = db.flashcards.filter((c) => c.userId === req.userId);
  res.json(list);
});

app.post('/api/flashcards', auth, (req, res) => {
  const { question, answer, subjectId } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'السؤال والإجابة مطلوبان' });
  const db = getDb();
  const newCard = {
    id: `card_${Date.now()}`,
    userId: req.userId,
    subjectId: subjectId || '',
    question: question.trim(),
    answer: answer.trim(),
    reviewCount: 0,
    nextReview: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  db.flashcards.push(newCard);
  saveDb(db);
  res.status(201).json(newCard);
});

app.put('/api/flashcards/:id/review', auth, (req, res) => {
  const db = getDb();
  const card = db.flashcards.find((c) => c.id === req.params.id && c.userId === req.userId);
  if (!card) return res.status(404).json({ error: 'البطاقة غير موجودة' });
  card.reviewCount = (card.reviewCount || 0) + 1;
  saveDb(db);
  res.json(card);
});

app.delete('/api/flashcards/:id', auth, (req, res) => {
  const db = getDb();
  db.flashcards = db.flashcards.filter((c) => c.id !== req.params.id && c.userId === req.userId);
  saveDb(db);
  res.json({ success: true });
});

// Pomodoro (Isolated per user)
app.get('/api/pomodoro/stats', auth, (req, res) => {
  const db = getDb();
  const sessions = db.pomodoroSessions.filter((p) => p.userId === req.userId);
  const totalMin = sessions.reduce((acc, s) => acc + (s.durationMinutes || 25), 0);
  res.json({ totalSessions: sessions.length, totalHours: (totalMin / 60).toFixed(1) });
});

app.post('/api/pomodoro/session', auth, (req, res) => {
  const db = getDb();
  const s = {
    id: `pomo_${Date.now()}`,
    userId: req.userId,
    durationMinutes: req.body.durationMinutes || 25,
    date: new Date().toISOString()
  };
  db.pomodoroSessions.push(s);
  saveDb(db);
  res.status(201).json(s);
});

// Static Client Serving
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

export { app };
export default app;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Study platform server running on port ${PORT}`);
  });
}
