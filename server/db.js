import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VERCEL === '1'
  ? path.join('/tmp', 'study-verse-data')
  : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const SECRET_KEY = process.env.JWT_SECRET || 'study_app_token_secret_key_2026';
const cloudUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
let sql = null;
let cloudLoaded = false;
let cloudDb = null;
if (cloudUrl) {
  try {
    const { neon } = await import('@neondatabase/serverless');
    sql = neon(cloudUrl);
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return testHash === hash;
}

export function createToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Date.now()) return null;
    return data.userId;
  } catch {
    return null;
  }
}

const defaultStructure = {
  users: [],
  subjects: [],
  files: [],
  notes: [],
  flashcards: [],
  pomodoroSessions: []
};

export async function loadCloudDb() {
  if (!sql || cloudLoaded) return cloudDb || getLocalDb();
  try {
    await sql`CREATE TABLE IF NOT EXISTS study_app_state (id INTEGER PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const rows = await sql`SELECT data FROM study_app_state WHERE id = 1`;
    if (rows.length) {
      cloudDb = rows[0].data;
    } else {
      cloudDb = structuredClone(defaultStructure);
      await sql`INSERT INTO study_app_state (id, data) VALUES (1, ${JSON.stringify(cloudDb)}::jsonb)`;
    }
  } catch (err) {
    console.error('Failed to load cloud database:', err);
    cloudDb = getLocalDb();
  }
  cloudLoaded = true;
  return cloudDb;
}

function getLocalDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultStructure, null, 2), 'utf-8');
    return structuredClone(defaultStructure);
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || [],
      subjects: parsed.subjects || [],
      files: parsed.files || [],
      notes: parsed.notes || [],
      flashcards: parsed.flashcards || [],
      pomodoroSessions: parsed.pomodoroSessions || []
    };
  } catch {
    return structuredClone(defaultStructure);
  }
}

export function getDb() {
  if (cloudDb) return cloudDb;
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultStructure, null, 2), 'utf-8');
    return defaultStructure;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || [],
      subjects: parsed.subjects || [],
      files: parsed.files || [],
      notes: parsed.notes || [],
      flashcards: parsed.flashcards || [],
      pomodoroSessions: parsed.pomodoroSessions || []
    };
  } catch {
    return defaultStructure;
  }
}

export function saveDb(data) {
  cloudDb = data;
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving db:', err);
  }
  if (sql) {
    void sql`
      INSERT INTO study_app_state (id, data, updated_at)
      VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `.catch((err) => console.error('Failed to save cloud database:', err));
  }
  return true;
}

export function initUserStarterData(db, userId, userName = 'طالب') {
  const s1 = `sub-${userId}-1`;
  const s2 = `sub-${userId}-2`;

  const newSubjects = [
    {
      id: s1,
      userId,
      title: 'المادة الأولى (نموذج)',
      code: 'SUB-101',
      icon: 'book-open',
      color: 'indigo',
      description: 'مجلد تجريبي للمادة الأولى',
      createdAt: new Date().toISOString()
    },
    {
      id: s2,
      userId,
      title: 'المادة الثانية (نموذج)',
      code: 'SUB-102',
      icon: 'calculator',
      color: 'emerald',
      description: 'مجلد تجريبي للمادة الثانية',
      createdAt: new Date().toISOString()
    }
  ];

  const newFiles = [
    {
      id: `file-${userId}-1`,
      userId,
      title: 'ملف تجريبي تعريفي',
      filename: 'sample-calculus-cheatsheet.pdf',
      originalName: 'guide.pdf',
      type: 'pdf',
      subjectId: s1,
      size: 150000,
      url: '/sample-calculus-cheatsheet.pdf',
      currentPage: 1,
      totalPages: 1,
      favorite: true,
      tags: ['مقدمة'],
      createdAt: new Date().toISOString()
    }
  ];

  const newNotes = [
    {
      id: `note-${userId}-1`,
      userId,
      subjectId: s1,
      title: `مرحباً بك يا ${userName}`,
      content: 'هذه مساحتك الدراسية الخاصة. كل ما ترفعه هنا يظل سرياً ومحفوظاً لحسابك فقط.',
      tags: ['بداية'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const newFlashcards = [
    {
      id: `card-${userId}-1`,
      userId,
      subjectId: s1,
      question: 'كيف أستخدم بطاقات الاستذكار؟',
      answer: 'اقرأ السؤال، ثم اقلب البطاقة لمعرفة الإجابة، وحدد درجة الصعوبة لتحديد موعد المراجعة القادمة.',
      difficulty: 'easy',
      reviewCount: 1,
      nextReview: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString()
    }
  ];

  db.subjects.push(...newSubjects);
  db.files.push(...newFiles);
  db.notes.push(...newNotes);
  db.flashcards.push(...newFlashcards);
  saveDb(db);
}
