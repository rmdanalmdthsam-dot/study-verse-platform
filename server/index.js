import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import {
  getDb,
  saveDb,
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  initUserStarterData
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const UPLOADS_DIR = process.env.VERCEL === '1'
  ? path.join('/tmp', 'study-verse-storage')
  : path.join(__dirname, 'storage');
const PDF_DIR = path.join(UPLOADS_DIR, 'pdfs');
const VIDEO_DIR = path.join(UPLOADS_DIR, 'videos');
const IMAGE_DIR = path.join(UPLOADS_DIR, 'images');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
const OTHER_DIR = path.join(UPLOADS_DIR, 'others');

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

app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(UPLOADS_DIR, {
  acceptRanges: true,
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

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
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  if ((!header || !header.startsWith('Bearer ')) && !queryToken) {
    return res.status(401).json({ error: 'تسجيل الدخول مطلوب' });
  }
  const token = header && header.startsWith('Bearer ') ? header.slice(7).trim() : queryToken;
  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' });
  }
  req.userId = userId;
  next();
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

// Sync & Device Pairing
app.get('/api/sync/info', async (req, res) => {
  const localIp = getLocalIp();
  const reqHost = req.headers.host || '';
  const port = reqHost.includes(':') ? reqHost.split(':')[1] : PORT;
  const phoneUrl = `http://${localIp}:${port}`;
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

app.get('/api/files/:id/content', auth, (req, res) => {
  const db = getDb();
  const file = db.files.find((item) => item.id === req.params.id && item.userId === req.userId);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });

  const relativeUrl = (file.url || '').replace(/^\/uploads\//, '');
  if (!relativeUrl) return res.status(404).json({ error: 'مسار الملف غير متاح' });

  const filePath = path.join(UPLOADS_DIR, ...relativeUrl.split('/'));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'الملف غير موجود على القرص' });

  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (file.type === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName || file.title || 'document.pdf')}`);
  } else {
    res.setHeader('Content-Type', 'application/octet-stream');
  }

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start < 0 || end >= stat.size || start > end) {
        res.setHeader('Content-Range', `bytes */${stat.size}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', end - start + 1);
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }
  }

  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(filePath).pipe(res);
});

app.put('/api/files/:id', auth, (req, res) => {
  const db = getDb();
  const file = db.files.find((f) => f.id === req.params.id && f.userId === req.userId);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
  Object.assign(file, req.body);
  saveDb(db);
  res.json(file);
});

app.delete('/api/files/:id', auth, (req, res) => {
  const db = getDb();
  const file = db.files.find((f) => f.id === req.params.id && f.userId === req.userId);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });

  db.files = db.files.filter((f) => f.id !== req.params.id);
  saveDb(db);
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
