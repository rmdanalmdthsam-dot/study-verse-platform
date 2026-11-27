import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { domainToASCII, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VERCEL === '1'
  ? path.join('/tmp', 'study-verse-data')
  : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY || SECRET_KEY.trim().length < 32 || SECRET_KEY !== SECRET_KEY.trim()) {
  throw new Error('JWT_SECRET must be configured as a strong, unpadded value of at least 32 characters');
}
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
  if (typeof password !== 'string' || typeof hash !== 'string' || typeof salt !== 'string') return false;
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const expected = Buffer.from(hash, 'hex');
  const actual = Buffer.from(testHash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

export function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const value = email.trim();
  const hasWhitespaceOrControl = Array.from(value).some((character) => {
    const code = character.codePointAt(0);
    return /\s/.test(character) || code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
  if (!value || value.length > 254 || hasWhitespaceOrControl) return null;

  const separator = value.lastIndexOf('@');
  if (separator <= 0 || separator !== value.indexOf('@')) return null;

  const local = value.slice(0, separator);
  const domain = domainToASCII(value.slice(separator + 1)).toLowerCase();
  if (!domain || local.length > 64 || local.startsWith('.') || local.endsWith('.') ||
    local.includes('..') || !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) {
    return null;
  }

  const labels = domain.split('.');
  if (labels.length < 2 || !/[a-z]/.test(labels.at(-1)) || labels.some((label) =>
    label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    return null;
  }

  const normalized = `${local.toLowerCase()}@${domain}`;
  return normalized.length <= 254 ? normalized : null;
}

export function createToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({ userId, jti: crypto.randomUUID(), exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function createMediaToken(userId, fileId, sessionId) {
  const payload = Buffer.from(JSON.stringify({
    purpose: 'file-content',
    userId,
    fileId,
    sessionId,
    exp: Date.now() + 15 * 60 * 1000
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`media:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

function isValidSignature(payload, signature, prefix = '') {
  const expected = crypto.createHmac('sha256', SECRET_KEY).update(`${prefix}${payload}`).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function getTokenClaims(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !isValidSignature(parts[0], parts[1])) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (typeof data.userId !== 'string' || !data.userId || typeof data.jti !== 'string' || !data.jti ||
      typeof data.exp !== 'number' || !Number.isFinite(data.exp) || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifyToken(token) {
  return getTokenClaims(token)?.userId || null;
}

export function getMediaTokenClaims(token, fileId) {
  if (!token || typeof token !== 'string' || typeof fileId !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !isValidSignature(parts[0], parts[1], 'media:')) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (data.purpose !== 'file-content' || data.fileId !== fileId ||
      typeof data.userId !== 'string' || !data.userId ||
      typeof data.sessionId !== 'string' || !data.sessionId ||
      typeof data.exp !== 'number' || !Number.isFinite(data.exp) || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifyMediaToken(token, fileId) {
  return getMediaTokenClaims(token, fileId)?.userId || null;
}

const defaultStructure = {
  users: [],
  oauthHandoffs: [],
  subjects: [],
  files: [],
  notes: [],
  flashcards: [],
  pomodoroSessions: [],
  revokedTokens: []
};

export async function loadCloudDb() {
  if (!sql || cloudLoaded) return cloudDb || getLocalDb();
  try {
    await sql`CREATE TABLE IF NOT EXISTS study_app_state (id INTEGER PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const rows = await sql`SELECT data FROM study_app_state WHERE id = 1`;
    if (rows.length) {
      cloudDb = rows[0].data;
      if (!Array.isArray(cloudDb.revokedTokens)) cloudDb.revokedTokens = [];
      if (!Array.isArray(cloudDb.oauthHandoffs)) cloudDb.oauthHandoffs = [];
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
      oauthHandoffs: Array.isArray(parsed.oauthHandoffs) ? parsed.oauthHandoffs : [],
      subjects: parsed.subjects || [],
      files: parsed.files || [],
      notes: parsed.notes || [],
      flashcards: parsed.flashcards || [],
      pomodoroSessions: parsed.pomodoroSessions || [],
      revokedTokens: Array.isArray(parsed.revokedTokens) ? parsed.revokedTokens : []
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
      oauthHandoffs: Array.isArray(parsed.oauthHandoffs) ? parsed.oauthHandoffs : [],
      subjects: parsed.subjects || [],
      files: parsed.files || [],
      notes: parsed.notes || [],
      flashcards: parsed.flashcards || [],
      pomodoroSessions: parsed.pomodoroSessions || [],
      revokedTokens: Array.isArray(parsed.revokedTokens) ? parsed.revokedTokens : []
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

export async function saveDbAsync(data) {
  if (sql) {
    await sql`
      INSERT INTO study_app_state (id, data, updated_at)
      VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
  } else {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }
  cloudDb = data;
  return true;
}

export async function consumeOAuthHandoff(tokenHash) {
  const now = Date.now();
  if (sql) {
    const rows = await sql`
      WITH locked AS MATERIALIZED (
        SELECT data
        FROM study_app_state
        WHERE id = 1
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(data->'oauthHandoffs', '[]'::jsonb)) AS handoff(value)
            WHERE handoff.value->>'tokenHash' = ${tokenHash}
              AND CASE
                WHEN handoff.value->>'expiresAt' ~ '^[0-9]+$'
                  THEN (handoff.value->>'expiresAt')::bigint > ${now}
                ELSE false
              END
          )
        FOR UPDATE
      ),
      consumed AS (
        SELECT handoff.value->>'userId' AS user_id
        FROM locked
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(locked.data->'oauthHandoffs', '[]'::jsonb)) AS handoff(value)
        WHERE handoff.value->>'tokenHash' = ${tokenHash}
          AND CASE
            WHEN handoff.value->>'expiresAt' ~ '^[0-9]+$'
              THEN (handoff.value->>'expiresAt')::bigint > ${now}
            ELSE false
          END
      ),
      updated AS (
        UPDATE study_app_state
        SET data = jsonb_set(
          study_app_state.data,
          '{oauthHandoffs}',
          COALESCE((
            SELECT jsonb_agg(handoff.value)
            FROM jsonb_array_elements(COALESCE(study_app_state.data->'oauthHandoffs', '[]'::jsonb)) AS handoff(value)
            WHERE handoff.value->>'tokenHash' <> ${tokenHash}
              AND CASE
                WHEN handoff.value->>'expiresAt' ~ '^[0-9]+$'
                  THEN (handoff.value->>'expiresAt')::bigint > ${now}
                ELSE false
              END
          ), '[]'::jsonb),
          true
        ),
        updated_at = NOW()
        WHERE id = 1 AND EXISTS (SELECT 1 FROM consumed)
        RETURNING data
      )
      SELECT consumed.user_id, updated.data
      FROM consumed
      CROSS JOIN updated
    `;
    if (!rows.length) return null;
    cloudDb = rows[0].data;
    return rows[0].user_id || null;
  }

  const db = structuredClone(getDb());
  const handoff = db.oauthHandoffs.find((entry) =>
    entry.tokenHash === tokenHash && Number.isFinite(entry.expiresAt) && entry.expiresAt > now);
  db.oauthHandoffs = db.oauthHandoffs.filter((entry) =>
    entry.tokenHash !== tokenHash && Number.isFinite(entry.expiresAt) && entry.expiresAt > now);
  await saveDbAsync(db);
  return handoff?.userId || null;
}

export function initUserStarterData(db, userId, userName = 'طالب', persist = true) {
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
  if (persist) saveDb(db);
}
