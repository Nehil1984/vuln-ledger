import bcrypt from 'bcryptjs'
import { readDbBackend, writeDbBackend } from './db-config.js'
import { getDataDb } from './data-lowdb.js'
import type {
  AssessmentRecord,
  CustomerRecord,
  DbBackend,
  EvidenceRecord,
  FindingRecord,
  LicenseRecord,
  ReportRecord,
  RetestRecord,
  UserRecord,
  UserRole,
} from './models.js'
import { readLicense, writeLicense } from './license.js'
import { createUserSqlite, findUserByUsernameSqlite, listUsersSqlite } from './storage-sqlite.js'

function ensureSqliteUnsupported() {
  throw new Error('SQLite ist aktuell für User-Basis vorbereitet, Fachmodule folgen im nächsten Schritt.')
}

export async function listUsers(): Promise<UserRecord[]> {
  return readDbBackend() === 'sqlite' ? listUsersSqlite() : (await getDataDb()).data.users
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  if (readDbBackend() === 'sqlite') return findUserByUsernameSqlite(username)
  return (await getDataDb()).data.users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null
}

export async function verifyUser(username: string, password: string): Promise<UserRecord | null> {
  const user = await findUserByUsername(username)
  if (!user) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? user : null
}

export async function createUser(username: string, password: string, role: UserRole) {
  if (readDbBackend() === 'sqlite') return createUserSqlite(username, password, role)
  const db = await getDataDb()
  const passwordHash = await bcrypt.hash(password, 10)
  const user: UserRecord = { id: `u-${Date.now()}`, username, passwordHash, role, createdAt: new Date().toISOString() }
  db.data.users.push(user)
  await db.write()
  return user
}

export function getDbBackend(): DbBackend {
  return readDbBackend()
}

export function setDbBackend(dbBackend: DbBackend) {
  writeDbBackend(dbBackend)
}

export function getLicense(): LicenseRecord {
  return readLicense()
}

export function updateLicense(next: Partial<LicenseRecord>) {
  return writeLicense(next)
}

export async function listCustomers(): Promise<CustomerRecord[]> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  return (await getDataDb()).data.customers
}

export async function createCustomer(input: Omit<CustomerRecord, 'createdAt'>): Promise<CustomerRecord> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row: CustomerRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.customers.unshift(row)
  await db.write()
  return row
}

export async function listAssessments(): Promise<AssessmentRecord[]> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  return (await getDataDb()).data.assessments
}

export async function createAssessment(input: Omit<AssessmentRecord, 'createdAt'>): Promise<AssessmentRecord> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row: AssessmentRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.assessments.unshift(row)
  await db.write()
  return row
}

export async function updateAssessmentStatus(id: string, status: AssessmentRecord['status']) {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row = db.data.assessments.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function listFindings(): Promise<FindingRecord[]> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  return (await getDataDb()).data.findings
}

export async function createFinding(input: Omit<FindingRecord, 'createdAt'>): Promise<FindingRecord> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row: FindingRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.findings.unshift(row)
  await db.write()
  return row
}

export async function updateFindingStatus(id: string, status: FindingRecord['status']) {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row = db.data.findings.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function listReports(): Promise<ReportRecord[]> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  return (await getDataDb()).data.reports
}

export async function createReport(input: Omit<ReportRecord, 'createdAt'>): Promise<ReportRecord> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row: ReportRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.reports.unshift(row)
  await db.write()
  return row
}

export async function updateReportStatus(id: string, status: ReportRecord['status']) {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row = db.data.reports.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function listEvidence(): Promise<EvidenceRecord[]> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  return (await getDataDb()).data.evidence
}

export async function createEvidence(input: Omit<EvidenceRecord, 'createdAt'>): Promise<EvidenceRecord> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row: EvidenceRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.evidence.unshift(row)
  await db.write()
  return row
}

export async function listRetests(): Promise<RetestRecord[]> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  return (await getDataDb()).data.retests
}

export async function createRetest(input: Omit<RetestRecord, 'createdAt'>): Promise<RetestRecord> {
  if (readDbBackend() === 'sqlite') ensureSqliteUnsupported()
  const db = await getDataDb()
  const row: RetestRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.retests.unshift(row)
  await db.write()
  return row
}
