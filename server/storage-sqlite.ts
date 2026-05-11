import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import type {
  AssessmentRecord,
  CustomerRecord,
  EvidenceRecord,
  EvidenceType,
  FindingRecord,
  FindingStatus,
  ReportRecord,
  ReportStatus,
  RetestRecord,
  RetestResult,
  Severity,
  UserRecord,
  UserRole,
} from './types.js'

const dataDir = path.resolve(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'vulnledger.sqlite')

let db: Database.Database | null = null

function getDb() {
  if (db) return db
  fs.mkdirSync(dataDir, { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      scope TEXT NOT NULL,
      lead_tester TEXT NOT NULL,
      rules_of_engagement TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      title TEXT NOT NULL,
      target TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      cvss_score TEXT NOT NULL,
      cwe TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      finding_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      file_name TEXT,
      file_path TEXT,
      content_type TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS retests (
      id TEXT PRIMARY KEY,
      finding_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      result TEXT NOT NULL,
      tester TEXT NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  ensureDefaultAdmin(db)
  ensureSeedData(db)
  return db
}

function ensureDefaultAdmin(database: Database.Database) {
  const existing = database.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined
  if (existing) return
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123!'
  const passwordHash = bcrypt.hashSync(password, 10)
  database.prepare('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run('u-admin', username, passwordHash, 'admin', new Date().toISOString())
}

function ensureSeedData(database: Database.Database) {
  const customerCount = database.prepare('SELECT COUNT(*) AS count FROM customers').get() as { count: number }
  if (customerCount.count > 0) return
  const now = new Date().toISOString()
  database.prepare('INSERT INTO customers (id, name, sector, contact_name, contact_email, contact_phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('c1', 'Musterwerk GmbH', 'Industrie', 'Laura Stein', 'it@musterwerk.de', '+49 211 555100', 'Produktionsnahe Webplattform mit erhöhtem Verfügbarkeitsbedarf.', now)
  database.prepare('INSERT INTO customers (id, name, sector, contact_name, contact_email, contact_phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('c2', 'Blue Harbor AG', 'SaaS', 'Jonas Weber', 'security@blueharbor.io', '+49 30 884422', 'API-first Produkt, Fokus auf AuthN/AuthZ und Mandantentrennung.', now)
  database.prepare('INSERT INTO assessments (id, title, customer_id, type, mode, status, scope, lead_tester, rules_of_engagement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('a1', 'External Web Pentest Q2', 'c1', 'Web', 'Greybox', 'Aktiv', 'portal.example.tld, admin.example.tld', 'Daniel Schuh', 'Keine Lasttests, produktionsnahe Ausnutzung nur nach Rücksprache.', now)
  database.prepare('INSERT INTO assessments (id, title, customer_id, type, mode, status, scope, lead_tester, rules_of_engagement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('a2', 'API Security Review', 'c2', 'API', 'Whitebox', 'Review', 'api.blueharbor.io/v1 + Auth-Service', 'Daniel Schuh', 'Nur bereitgestellte Testzugänge verwenden.', now)
  database.prepare('INSERT INTO findings (id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('VL-2026-0001', 'a1', 'Authenticated RCE via file import', 'portal.example.tld', 'Critical', 'Bestätigt', '9.8', 'CWE-94', 'Serverseitige Validierung härten und Importpfad isolieren.', now)
  database.prepare('INSERT INTO findings (id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('VL-2026-0002', 'a1', 'Stored XSS in admin comment field', 'admin.example.tld', 'High', 'Offen', '8.1', 'CWE-79', 'Kontextbezogenes Encoding und serverseitige Filterung ergänzen.', now)
  database.prepare('INSERT INTO findings (id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('VL-2026-0003', 'a2', 'Weak password policy on VPN portal', 'vpn.example.tld', 'Medium', 'In Bearbeitung', '5.9', 'CWE-521', 'MFA erzwingen und Passwortvorgaben verschärfen.', now)
  database.prepare('INSERT INTO reports (id, assessment_id, title, status, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('r1', 'a1', 'External Web Pentest Q2 Report', 'Draft', 'Fokus auf Angriffsoberfläche, Authentisierung, Dateiupload und Rollenmodelle.', now)
  database.prepare('INSERT INTO reports (id, assessment_id, title, status, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('r2', 'a2', 'API Security Review Report', 'Internes Review', 'API-Design, Token Handling, Autorisierung und Rate Limits bewertet.', now)
  database.prepare('INSERT INTO evidence (id, finding_id, assessment_id, type, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('e1', 'VL-2026-0001', 'a1', 'Screenshot', 'Upload dialog before payload execution', 'Screenshot dokumentiert den Importdialog und den anschließenden Erfolgspfad.', now)
  database.prepare('INSERT INTO evidence (id, finding_id, assessment_id, type, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('e2', 'VL-2026-0002', 'a1', 'Request', 'Stored XSS payload request', 'POST /comments mit Payload <script>alert(1)</script> gegen Admin-Kommentar-Feld.', now)
  database.prepare('INSERT INTO retests (id, finding_id, assessment_id, result, tester, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('rt1', 'VL-2026-0003', 'a2', 'Teilweise behoben', 'Daniel Schuh', 'MFA wurde ergänzt, Passwort-Policy jedoch noch nicht vollständig verschärft.', now)
}

export type SqliteEvidenceRow = EvidenceRecord & { fileName?: string; filePath?: string; contentType?: string }

export async function listUsersSqlite(): Promise<UserRecord[]> {
  const rows = getDb().prepare('SELECT id, username, password_hash, role, created_at FROM users ORDER BY created_at ASC').all() as Array<{ id: string; username: string; password_hash: string; role: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as UserRole, createdAt: row.created_at }))
}
export async function findUserByUsernameSqlite(username: string): Promise<UserRecord | null> {
  const row = getDb().prepare('SELECT id, username, password_hash, role, created_at FROM users WHERE lower(username)=lower(?)').get(username) as { id: string; username: string; password_hash: string; role: string; created_at: string } | undefined
  return row ? { id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as UserRole, createdAt: row.created_at } : null
}
export async function createUserSqlite(username: string, password: string, role: UserRole): Promise<UserRecord> {
  const user: UserRecord = { id: `u-${Date.now()}`, username, passwordHash: await bcrypt.hash(password, 10), role, createdAt: new Date().toISOString() }
  getDb().prepare('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(user.id, user.username, user.passwordHash, user.role, user.createdAt)
  return user
}

export async function listCustomersSqlite(): Promise<CustomerRecord[]> {
  const rows = getDb().prepare('SELECT id, name, sector, contact_name, contact_email, contact_phone, notes, created_at FROM customers ORDER BY created_at DESC').all() as Array<{ id: string; name: string; sector: string; contact_name: string; contact_email: string; contact_phone: string; notes: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, name: row.name, sector: row.sector, contactName: row.contact_name, contactEmail: row.contact_email, contactPhone: row.contact_phone, notes: row.notes, createdAt: row.created_at }))
}
export async function createCustomerSqlite(input: Omit<CustomerRecord, 'createdAt'>): Promise<CustomerRecord> {
  const row: CustomerRecord = { ...input, createdAt: new Date().toISOString() }
  getDb().prepare('INSERT INTO customers (id, name, sector, contact_name, contact_email, contact_phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.name, row.sector, row.contactName, row.contactEmail, row.contactPhone, row.notes, row.createdAt)
  return row
}

export async function listAssessmentsSqlite(): Promise<AssessmentRecord[]> {
  const rows = getDb().prepare('SELECT id, title, customer_id, type, mode, status, scope, lead_tester, rules_of_engagement, created_at FROM assessments ORDER BY created_at DESC').all() as Array<{ id: string; title: string; customer_id: string; type: string; mode: string; status: string; scope: string; lead_tester: string; rules_of_engagement: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, title: row.title, customerId: row.customer_id, type: row.type, mode: row.mode, status: row.status as AssessmentRecord['status'], scope: row.scope, leadTester: row.lead_tester, rulesOfEngagement: row.rules_of_engagement, createdAt: row.created_at }))
}
export async function createAssessmentSqlite(input: Omit<AssessmentRecord, 'createdAt'>): Promise<AssessmentRecord> {
  const row: AssessmentRecord = { ...input, createdAt: new Date().toISOString() }
  getDb().prepare('INSERT INTO assessments (id, title, customer_id, type, mode, status, scope, lead_tester, rules_of_engagement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.title, row.customerId, row.type, row.mode, row.status, row.scope, row.leadTester, row.rulesOfEngagement, row.createdAt)
  return row
}
export async function updateAssessmentStatusSqlite(id: string, status: AssessmentRecord['status']) {
  const database = getDb()
  database.prepare('UPDATE assessments SET status = ? WHERE id = ?').run(status, id)
  const row = database.prepare('SELECT id, title, customer_id, type, mode, status, scope, lead_tester, rules_of_engagement, created_at FROM assessments WHERE id = ?').get(id) as { id: string; title: string; customer_id: string; type: string; mode: string; status: string; scope: string; lead_tester: string; rules_of_engagement: string; created_at: string } | undefined
  return row ? { id: row.id, title: row.title, customerId: row.customer_id, type: row.type, mode: row.mode, status: row.status as AssessmentRecord['status'], scope: row.scope, leadTester: row.lead_tester, rulesOfEngagement: row.rules_of_engagement, createdAt: row.created_at } : null
}

export async function listFindingsSqlite(): Promise<FindingRecord[]> {
  const rows = getDb().prepare('SELECT id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at FROM findings ORDER BY created_at DESC').all() as Array<{ id: string; assessment_id: string; title: string; target: string; severity: string; status: string; cvss_score: string; cwe: string; recommendation: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, assessmentId: row.assessment_id, title: row.title, target: row.target, severity: row.severity as Severity, status: row.status as FindingStatus, cvssScore: row.cvss_score, cwe: row.cwe, recommendation: row.recommendation, createdAt: row.created_at }))
}
export async function createFindingSqlite(input: Omit<FindingRecord, 'createdAt'>): Promise<FindingRecord> {
  const row: FindingRecord = { ...input, createdAt: new Date().toISOString() }
  getDb().prepare('INSERT INTO findings (id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.assessmentId, row.title, row.target, row.severity, row.status, row.cvssScore, row.cwe, row.recommendation, row.createdAt)
  return row
}
export async function updateFindingStatusSqlite(id: string, status: FindingRecord['status']) {
  const database = getDb()
  database.prepare('UPDATE findings SET status = ? WHERE id = ?').run(status, id)
  const row = database.prepare('SELECT id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at FROM findings WHERE id = ?').get(id) as { id: string; assessment_id: string; title: string; target: string; severity: string; status: string; cvss_score: string; cwe: string; recommendation: string; created_at: string } | undefined
  return row ? { id: row.id, assessmentId: row.assessment_id, title: row.title, target: row.target, severity: row.severity as Severity, status: row.status as FindingStatus, cvssScore: row.cvss_score, cwe: row.cwe, recommendation: row.recommendation, createdAt: row.created_at } : null
}

export async function listReportsSqlite(): Promise<ReportRecord[]> {
  const rows = getDb().prepare('SELECT id, assessment_id, title, status, summary, created_at FROM reports ORDER BY created_at DESC').all() as Array<{ id: string; assessment_id: string; title: string; status: string; summary: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, assessmentId: row.assessment_id, title: row.title, status: row.status as ReportStatus, summary: row.summary, createdAt: row.created_at }))
}
export async function createReportSqlite(input: Omit<ReportRecord, 'createdAt'>): Promise<ReportRecord> {
  const row: ReportRecord = { ...input, createdAt: new Date().toISOString() }
  getDb().prepare('INSERT INTO reports (id, assessment_id, title, status, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(row.id, row.assessmentId, row.title, row.status, row.summary, row.createdAt)
  return row
}
export async function updateReportStatusSqlite(id: string, status: ReportRecord['status']) {
  const database = getDb()
  database.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id)
  const row = database.prepare('SELECT id, assessment_id, title, status, summary, created_at FROM reports WHERE id = ?').get(id) as { id: string; assessment_id: string; title: string; status: string; summary: string; created_at: string } | undefined
  return row ? { id: row.id, assessmentId: row.assessment_id, title: row.title, status: row.status as ReportStatus, summary: row.summary, createdAt: row.created_at } : null
}

export async function listEvidenceSqlite(): Promise<SqliteEvidenceRow[]> {
  const rows = getDb().prepare('SELECT id, finding_id, assessment_id, type, title, content, file_name, file_path, content_type, created_at FROM evidence ORDER BY created_at DESC').all() as Array<{ id: string; finding_id: string; assessment_id: string; type: string; title: string; content: string; file_name?: string; file_path?: string; content_type?: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, findingId: row.finding_id, assessmentId: row.assessment_id, type: row.type as EvidenceType, title: row.title, content: row.content, fileName: row.file_name, filePath: row.file_path, contentType: row.content_type, createdAt: row.created_at }))
}
export async function createEvidenceSqlite(input: Omit<SqliteEvidenceRow, 'createdAt'>): Promise<SqliteEvidenceRow> {
  const row: SqliteEvidenceRow = { ...input, createdAt: new Date().toISOString() }
  getDb().prepare('INSERT INTO evidence (id, finding_id, assessment_id, type, title, content, file_name, file_path, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.findingId, row.assessmentId, row.type, row.title, row.content, row.fileName || null, row.filePath || null, row.contentType || null, row.createdAt)
  return row
}

export async function listRetestsSqlite(): Promise<RetestRecord[]> {
  const rows = getDb().prepare('SELECT id, finding_id, assessment_id, result, tester, notes, created_at FROM retests ORDER BY created_at DESC').all() as Array<{ id: string; finding_id: string; assessment_id: string; result: string; tester: string; notes: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, findingId: row.finding_id, assessmentId: row.assessment_id, result: row.result as RetestResult, tester: row.tester, notes: row.notes, createdAt: row.created_at }))
}
export async function createRetestSqlite(input: Omit<RetestRecord, 'createdAt'>): Promise<RetestRecord> {
  const row: RetestRecord = { ...input, createdAt: new Date().toISOString() }
  getDb().prepare('INSERT INTO retests (id, finding_id, assessment_id, result, tester, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(row.id, row.findingId, row.assessmentId, row.result, row.tester, row.notes, row.createdAt)
  return row
}
