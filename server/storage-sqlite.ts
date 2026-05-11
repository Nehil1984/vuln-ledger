// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import type { AssessmentRecord, CustomerRecord, EvidenceRecord, FindingRecord, GroupRecord, ReportRecord, RetestRecord, UserRecord, UserRole } from './types.js'

export type SqliteEvidenceRow = EvidenceRecord & { fileName?: string; filePath?: string; contentType?: string }

const dataDir = path.resolve(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'vulnledger.sqlite')

let db: Database.Database | null = null

function now() { return new Date().toISOString() }

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
      tenant_ids TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups_vl (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      tenant_ids TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      group_id TEXT,
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
      customer_id TEXT NOT NULL,
      title TEXT NOT NULL,
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
      customer_id TEXT NOT NULL,
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
      scope_type TEXT NOT NULL,
      customer_id TEXT,
      group_id TEXT,
      assessment_id TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
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
      customer_id TEXT NOT NULL,
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

function parseList(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : [] } catch { return [] } }
function stringifyList(value: string[]) { return JSON.stringify(value) }

function ensureDefaultAdmin(database: Database.Database) {
  const existing = database.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined
  if (existing) return
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123!'
  const passwordHash = bcrypt.hashSync(password, 10)
  database.prepare('INSERT INTO users (id, username, password_hash, role, tenant_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('u-admin', username, passwordHash, 'admin', stringifyList(['c1', 'c2']), now())
  database.prepare('INSERT INTO users (id, username, password_hash, role, tenant_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('u-manager', 'verwalter', bcrypt.hashSync('verwalter123!', 10), 'verwalter', stringifyList(['c1', 'c2']), now())
  database.prepare('INSERT INTO users (id, username, password_hash, role, tenant_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('u-tech', 'techniker', bcrypt.hashSync('techniker123!', 10), 'techniker', stringifyList(['c1']), now())
  database.prepare('INSERT INTO users (id, username, password_hash, role, tenant_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('u-user', 'user', bcrypt.hashSync('user12345!', 10), 'user', stringifyList(['c2']), now())
}

function ensureSeedData(database: Database.Database) {
  const groupCount = database.prepare('SELECT COUNT(*) AS count FROM groups_vl').get() as { count: number }
  if (groupCount.count > 0) return
  const ts = now()
  database.prepare('INSERT INTO groups_vl (id, name, description, tenant_ids, created_at) VALUES (?, ?, ?, ?, ?)').run('g1', 'Muster Holding', 'Beispielhafter Konzernverbund mit mehreren Mandanten.', stringifyList(['c1', 'c2']), ts)
  database.prepare('INSERT INTO customers (id, group_id, name, sector, contact_name, contact_email, contact_phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('c1', 'g1', 'Musterwerk GmbH', 'Industrie', 'Laura Stein', 'it@musterwerk.de', '+49 211 555100', 'Produktionsnahe Webplattform mit erhöhtem Verfügbarkeitsbedarf.', ts)
  database.prepare('INSERT INTO customers (id, group_id, name, sector, contact_name, contact_email, contact_phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('c2', 'g1', 'Blue Harbor AG', 'SaaS', 'Jonas Weber', 'security@blueharbor.io', '+49 30 884422', 'API-first Produkt, Fokus auf AuthN/AuthZ und Mandantentrennung.', ts)
  database.prepare('INSERT INTO assessments (id, customer_id, title, type, mode, status, scope, lead_tester, rules_of_engagement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('a1', 'c1', 'External Web Pentest Q2', 'Web', 'Greybox', 'Aktiv', 'portal.example.tld, admin.example.tld', 'Daniel Schuh', 'Keine Lasttests, produktionsnahe Ausnutzung nur nach Rücksprache.', ts)
  database.prepare('INSERT INTO assessments (id, customer_id, title, type, mode, status, scope, lead_tester, rules_of_engagement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('a2', 'c2', 'API Security Review', 'API', 'Whitebox', 'Review', 'api.blueharbor.io/v1 + Auth-Service', 'Daniel Schuh', 'Nur bereitgestellte Testzugänge verwenden.', ts)
  database.prepare('INSERT INTO findings (id, customer_id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('VL-2026-0001', 'c1', 'a1', 'Authenticated RCE via file import', 'portal.example.tld', 'Critical', 'Bestätigt', '9.8', 'CWE-94', 'Serverseitige Validierung härten und Importpfad isolieren.', ts)
  database.prepare('INSERT INTO findings (id, customer_id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('VL-2026-0002', 'c1', 'a1', 'Stored XSS in admin comment field', 'admin.example.tld', 'High', 'Offen', '8.1', 'CWE-79', 'Kontextbezogenes Encoding und serverseitige Filterung ergänzen.', ts)
  database.prepare('INSERT INTO findings (id, customer_id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('VL-2026-0003', 'c2', 'a2', 'Weak password policy on VPN portal', 'vpn.example.tld', 'Medium', 'In Bearbeitung', '5.9', 'CWE-521', 'MFA erzwingen und Passwortvorgaben verschärfen.', ts)
  database.prepare('INSERT INTO reports (id, scope_type, customer_id, group_id, assessment_id, title, status, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('r1', 'tenant', 'c1', null, 'a1', 'External Web Pentest Q2 Report', 'Draft', 'Fokus auf Angriffsoberfläche, Authentisierung, Dateiupload und Rollenmodelle.', ts)
  database.prepare('INSERT INTO reports (id, scope_type, customer_id, group_id, assessment_id, title, status, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('r2', 'group', null, 'g1', null, 'Konzernreport Muster Holding', 'Internes Review', 'Konsolidierter Überblick über Findings und Maßnahmen über mehrere Mandanten.', ts)
  database.prepare('INSERT INTO evidence (id, customer_id, finding_id, assessment_id, type, title, content, file_name, file_path, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('e1', 'c1', 'VL-2026-0001', 'a1', 'Screenshot', 'Upload dialog before payload execution', 'Screenshot dokumentiert den Importdialog und den anschließenden Erfolgspfad.', null, null, null, ts)
  database.prepare('INSERT INTO retests (id, customer_id, finding_id, assessment_id, result, tester, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('rt1', 'c2', 'VL-2026-0003', 'a2', 'Teilweise behoben', 'Daniel Schuh', 'MFA wurde ergänzt, Passwort-Policy jedoch noch nicht vollständig verschärft.', ts)
}

export async function listUsersSqlite(): Promise<UserRecord[]> {
  const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at ASC').all() as Array<{ id: string; username: string; password_hash: string; role: string; tenant_ids: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as UserRole, tenantIds: parseList(row.tenant_ids), createdAt: row.created_at }))
}
export async function findUserByUsernameSqlite(username: string): Promise<UserRecord | null> {
  const row = getDb().prepare('SELECT * FROM users WHERE lower(username)=lower(?)').get(username) as { id: string; username: string; password_hash: string; role: string; tenant_ids: string; created_at: string } | undefined
  return row ? { id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as UserRole, tenantIds: parseList(row.tenant_ids), createdAt: row.created_at } : null
}
export async function createUserSqlite(username: string, password: string, role: UserRole, tenantIds: string[]): Promise<UserRecord> {
  const user: UserRecord = { id: `u-${Date.now()}`, username, passwordHash: await bcrypt.hash(password, 10), role, tenantIds, createdAt: now() }
  getDb().prepare('INSERT INTO users (id, username, password_hash, role, tenant_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(user.id, user.username, user.passwordHash, user.role, stringifyList(user.tenantIds), user.createdAt)
  return user
}

export async function listGroupsSqlite(): Promise<GroupRecord[]> {
  const rows = getDb().prepare('SELECT * FROM groups_vl ORDER BY created_at DESC').all() as Array<{ id: string; name: string; description: string; tenant_ids: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, name: row.name, description: row.description, tenantIds: parseList(row.tenant_ids), createdAt: row.created_at }))
}
export async function createGroupSqlite(input: Omit<GroupRecord, 'createdAt'>): Promise<GroupRecord> {
  const row: GroupRecord = { ...input, createdAt: now() }
  getDb().prepare('INSERT INTO groups_vl (id, name, description, tenant_ids, created_at) VALUES (?, ?, ?, ?, ?)').run(row.id, row.name, row.description, stringifyList(row.tenantIds), row.createdAt)
  return row
}
export async function updateGroupSqlite(input: GroupRecord): Promise<GroupRecord | null> {
  const dbx = getDb()
  dbx.prepare('UPDATE groups_vl SET name = ?, description = ?, tenant_ids = ? WHERE id = ?').run(input.name, input.description, stringifyList(input.tenantIds), input.id)
  const row = dbx.prepare('SELECT * FROM groups_vl WHERE id = ?').get(input.id) as { id: string; name: string; description: string; tenant_ids: string; created_at: string } | undefined
  return row ? { id: row.id, name: row.name, description: row.description, tenantIds: parseList(row.tenant_ids), createdAt: row.created_at } : null
}

export async function listCustomersSqlite(): Promise<CustomerRecord[]> {
  const rows = getDb().prepare('SELECT * FROM customers ORDER BY created_at DESC').all() as Array<{ id: string; group_id?: string; name: string; sector: string; contact_name: string; contact_email: string; contact_phone: string; notes: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, groupId: row.group_id || undefined, name: row.name, sector: row.sector, contactName: row.contact_name, contactEmail: row.contact_email, contactPhone: row.contact_phone, notes: row.notes, createdAt: row.created_at }))
}
export async function createCustomerSqlite(input: Omit<CustomerRecord, 'createdAt'>): Promise<CustomerRecord> {
  const row: CustomerRecord = { ...input, createdAt: now() }
  getDb().prepare('INSERT INTO customers (id, group_id, name, sector, contact_name, contact_email, contact_phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.groupId || null, row.name, row.sector, row.contactName, row.contactEmail, row.contactPhone, row.notes, row.createdAt)
  return row
}
export async function updateCustomerSqlite(input: CustomerRecord): Promise<CustomerRecord | null> {
  const dbx = getDb()
  dbx.prepare('UPDATE customers SET group_id = ?, name = ?, sector = ?, contact_name = ?, contact_email = ?, contact_phone = ?, notes = ? WHERE id = ?').run(input.groupId || null, input.name, input.sector, input.contactName, input.contactEmail, input.contactPhone, input.notes, input.id)
  const row = dbx.prepare('SELECT * FROM customers WHERE id = ?').get(input.id) as { id: string; group_id?: string; name: string; sector: string; contact_name: string; contact_email: string; contact_phone: string; notes: string; created_at: string } | undefined
  return row ? { id: row.id, groupId: row.group_id || undefined, name: row.name, sector: row.sector, contactName: row.contact_name, contactEmail: row.contact_email, contactPhone: row.contact_phone, notes: row.notes, createdAt: row.created_at } : null
}

export async function listAssessmentsSqlite(): Promise<AssessmentRecord[]> {
  const rows = getDb().prepare('SELECT * FROM assessments ORDER BY created_at DESC').all() as Array<{ id: string; customer_id: string; title: string; type: string; mode: string; status: string; scope: string; lead_tester: string; rules_of_engagement: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, customerId: row.customer_id, title: row.title, type: row.type, mode: row.mode, status: row.status as AssessmentRecord['status'], scope: row.scope, leadTester: row.lead_tester, rulesOfEngagement: row.rules_of_engagement, createdAt: row.created_at }))
}
export async function createAssessmentSqlite(input: Omit<AssessmentRecord, 'createdAt'>): Promise<AssessmentRecord> {
  const row: AssessmentRecord = { ...input, createdAt: now() }
  getDb().prepare('INSERT INTO assessments (id, customer_id, title, type, mode, status, scope, lead_tester, rules_of_engagement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.customerId, row.title, row.type, row.mode, row.status, row.scope, row.leadTester, row.rulesOfEngagement, row.createdAt)
  return row
}
export async function updateAssessmentStatusSqlite(id: string, status: AssessmentRecord['status']) {
  const dbx = getDb()
  dbx.prepare('UPDATE assessments SET status = ? WHERE id = ?').run(status, id)
  const row = dbx.prepare('SELECT * FROM assessments WHERE id = ?').get(id) as { id: string; customer_id: string; title: string; type: string; mode: string; status: string; scope: string; lead_tester: string; rules_of_engagement: string; created_at: string } | undefined
  return row ? { id: row.id, customerId: row.customer_id, title: row.title, type: row.type, mode: row.mode, status: row.status as AssessmentRecord['status'], scope: row.scope, leadTester: row.lead_tester, rulesOfEngagement: row.rules_of_engagement, createdAt: row.created_at } : null
}

export async function listFindingsSqlite(): Promise<FindingRecord[]> {
  const rows = getDb().prepare('SELECT * FROM findings ORDER BY created_at DESC').all() as Array<{ id: string; customer_id: string; assessment_id: string; title: string; target: string; severity: string; status: string; cvss_score: string; cwe: string; recommendation: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, customerId: row.customer_id, assessmentId: row.assessment_id, title: row.title, target: row.target, severity: row.severity as FindingRecord['severity'], status: row.status as FindingRecord['status'], cvssScore: row.cvss_score, cwe: row.cwe, recommendation: row.recommendation, createdAt: row.created_at }))
}
export async function createFindingSqlite(input: Omit<FindingRecord, 'createdAt'>): Promise<FindingRecord> {
  const row: FindingRecord = { ...input, createdAt: now() }
  getDb().prepare('INSERT INTO findings (id, customer_id, assessment_id, title, target, severity, status, cvss_score, cwe, recommendation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.customerId, row.assessmentId, row.title, row.target, row.severity, row.status, row.cvssScore, row.cwe, row.recommendation, row.createdAt)
  return row
}
export async function updateFindingStatusSqlite(id: string, status: FindingRecord['status']) {
  const dbx = getDb()
  dbx.prepare('UPDATE findings SET status = ? WHERE id = ?').run(status, id)
  const row = dbx.prepare('SELECT * FROM findings WHERE id = ?').get(id) as { id: string; customer_id: string; assessment_id: string; title: string; target: string; severity: string; status: string; cvss_score: string; cwe: string; recommendation: string; created_at: string } | undefined
  return row ? { id: row.id, customerId: row.customer_id, assessmentId: row.assessment_id, title: row.title, target: row.target, severity: row.severity as FindingRecord['severity'], status: row.status as FindingRecord['status'], cvssScore: row.cvss_score, cwe: row.cwe, recommendation: row.recommendation, createdAt: row.created_at } : null
}

export async function listReportsSqlite(): Promise<ReportRecord[]> {
  const rows = getDb().prepare('SELECT * FROM reports ORDER BY created_at DESC').all() as Array<{ id: string; scope_type: string; customer_id?: string; group_id?: string; assessment_id?: string; title: string; status: string; summary: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, scopeType: row.scope_type as ReportRecord['scopeType'], customerId: row.customer_id || undefined, groupId: row.group_id || undefined, assessmentId: row.assessment_id || undefined, title: row.title, status: row.status as ReportRecord['status'], summary: row.summary, createdAt: row.created_at }))
}
export async function createReportSqlite(input: Omit<ReportRecord, 'createdAt'>): Promise<ReportRecord> {
  const row: ReportRecord = { ...input, createdAt: now() }
  getDb().prepare('INSERT INTO reports (id, scope_type, customer_id, group_id, assessment_id, title, status, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.scopeType, row.customerId || null, row.groupId || null, row.assessmentId || null, row.title, row.status, row.summary, row.createdAt)
  return row
}
export async function updateReportStatusSqlite(id: string, status: ReportRecord['status']) {
  const dbx = getDb()
  dbx.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id)
  const row = dbx.prepare('SELECT * FROM reports WHERE id = ?').get(id) as { id: string; scope_type: string; customer_id?: string; group_id?: string; assessment_id?: string; title: string; status: string; summary: string; created_at: string } | undefined
  return row ? { id: row.id, scopeType: row.scope_type as ReportRecord['scopeType'], customerId: row.customer_id || undefined, groupId: row.group_id || undefined, assessmentId: row.assessment_id || undefined, title: row.title, status: row.status as ReportRecord['status'], summary: row.summary, createdAt: row.created_at } : null
}

export async function listEvidenceSqlite(): Promise<SqliteEvidenceRow[]> {
  const rows = getDb().prepare('SELECT * FROM evidence ORDER BY created_at DESC').all() as Array<{ id: string; customer_id: string; finding_id: string; assessment_id: string; type: string; title: string; content: string; file_name?: string; file_path?: string; content_type?: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, customerId: row.customer_id, findingId: row.finding_id, assessmentId: row.assessment_id, type: row.type as EvidenceRecord['type'], title: row.title, content: row.content, fileName: row.file_name || undefined, filePath: row.file_path || undefined, contentType: row.content_type || undefined, createdAt: row.created_at }))
}
export async function createEvidenceSqlite(input: Omit<SqliteEvidenceRow, 'createdAt'>): Promise<SqliteEvidenceRow> {
  const row: SqliteEvidenceRow = { ...input, createdAt: now() }
  getDb().prepare('INSERT INTO evidence (id, customer_id, finding_id, assessment_id, type, title, content, file_name, file_path, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.customerId, row.findingId, row.assessmentId, row.type, row.title, row.content, row.fileName || null, row.filePath || null, row.contentType || null, row.createdAt)
  return row
}

export async function listRetestsSqlite(): Promise<RetestRecord[]> {
  const rows = getDb().prepare('SELECT * FROM retests ORDER BY created_at DESC').all() as Array<{ id: string; customer_id: string; finding_id: string; assessment_id: string; result: string; tester: string; notes: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, customerId: row.customer_id, findingId: row.finding_id, assessmentId: row.assessment_id, result: row.result as RetestRecord['result'], tester: row.tester, notes: row.notes, createdAt: row.created_at }))
}
export async function createRetestSqlite(input: Omit<RetestRecord, 'createdAt'>): Promise<RetestRecord> {
  const row: RetestRecord = { ...input, createdAt: now() }
  getDb().prepare('INSERT INTO retests (id, customer_id, finding_id, assessment_id, result, tester, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.customerId, row.findingId, row.assessmentId, row.result, row.tester, row.notes, row.createdAt)
  return row
}
