// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import bcrypt from 'bcryptjs'
import { readDbBackend, writeDbBackend } from './db-config.js'
import { getDataDb } from './data-lowdb.js'
import type {
  AssessmentRecord,
  CustomerRecord,
  DbBackend,
  EvidenceRecord,
  FindingRecord,
  GroupRecord,
  LicenseRecord,
  ReportRecord,
  RetestRecord,
  UserRecord,
  UserRole,
} from './models.js'

export type GroupInput = {
  id: string
  name: string
  description: string
  tenantIds: string[]
}
import { readLicense, writeLicense } from './license.js'

export type EvidenceWithFile = EvidenceRecord & { fileName?: string; filePath?: string; contentType?: string }

export function getDbBackend(): DbBackend { return readDbBackend() }
export function setDbBackend(dbBackend: DbBackend) { writeDbBackend(dbBackend) }
export function getLicense(): LicenseRecord { return readLicense() }
export function updateLicense(next: Partial<LicenseRecord>) { return writeLicense(next) }

export async function listUsers(): Promise<UserRecord[]> { return (await getDataDb()).data.users }
export async function listGroups(): Promise<GroupRecord[]> { return (await getDataDb()).data.groups }
export async function listCustomers(): Promise<CustomerRecord[]> { return (await getDataDb()).data.customers }
export async function listAssessments(): Promise<AssessmentRecord[]> { return (await getDataDb()).data.assessments }
export async function listFindings(): Promise<FindingRecord[]> { return (await getDataDb()).data.findings }
export async function listReports(): Promise<ReportRecord[]> { return (await getDataDb()).data.reports }
export async function listEvidence(): Promise<EvidenceWithFile[]> { return (await getDataDb()).data.evidence }
export async function listRetests(): Promise<RetestRecord[]> { return (await getDataDb()).data.retests }

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  return (await getDataDb()).data.users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null
}

export async function verifyUser(username: string, password: string): Promise<UserRecord | null> {
  const user = await findUserByUsername(username)
  if (!user) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? user : null
}

export async function createUser(input: { username: string; password: string; role: UserRole; tenantIds: string[] }) {
  const db = await getDataDb()
  const passwordHash = await bcrypt.hash(input.password, 10)
  const user: UserRecord = { id: `u-${Date.now()}`, username: input.username, passwordHash, role: input.role, tenantIds: input.tenantIds, createdAt: new Date().toISOString() }
  db.data.users.push(user)
  await db.write()
  return user
}

export async function createGroup(input: GroupInput) {
  const db = await getDataDb()
  const row: GroupRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.groups.unshift(row)
  await db.write()
  return row
}

export async function updateGroup(input: GroupRecord) {
  const db = await getDataDb()
  const row = db.data.groups.find((group) => group.id === input.id)
  if (!row) return null
  Object.assign(row, input)
  await db.write()
  return row
}

export async function createCustomer(input: Omit<CustomerRecord, 'createdAt'>) {
  const db = await getDataDb()
  const row: CustomerRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.customers.unshift(row)
  await db.write()
  return row
}

export async function updateCustomer(input: CustomerRecord) {
  const db = await getDataDb()
  const row = db.data.customers.find((customer) => customer.id === input.id)
  if (!row) return null
  Object.assign(row, input)
  await db.write()
  return row
}

export async function createAssessment(input: Omit<AssessmentRecord, 'createdAt'>) {
  const db = await getDataDb()
  const row: AssessmentRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.assessments.unshift(row)
  await db.write()
  return row
}

export async function updateAssessmentStatus(id: string, status: AssessmentRecord['status']) {
  const db = await getDataDb()
  const row = db.data.assessments.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function createFinding(input: Omit<FindingRecord, 'createdAt'>) {
  const db = await getDataDb()
  const row: FindingRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.findings.unshift(row)
  await db.write()
  return row
}

export async function updateFindingStatus(id: string, status: FindingRecord['status']) {
  const db = await getDataDb()
  const row = db.data.findings.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function createReport(input: Omit<ReportRecord, 'createdAt'>) {
  const db = await getDataDb()
  const row: ReportRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.reports.unshift(row)
  await db.write()
  return row
}

export async function updateReportStatus(id: string, status: ReportRecord['status']) {
  const db = await getDataDb()
  const row = db.data.reports.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function createEvidence(input: Omit<EvidenceWithFile, 'createdAt'>) {
  const db = await getDataDb()
  const row: EvidenceWithFile = { ...input, createdAt: new Date().toISOString() }
  db.data.evidence.unshift(row)
  await db.write()
  return row
}

export async function createRetest(input: Omit<RetestRecord, 'createdAt'>) {
  const db = await getDataDb()
  const row: RetestRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.retests.unshift(row)
  await db.write()
  return row
}

export async function migrateDbBackend(target: DbBackend) {
  writeDbBackend(target)
  return { ok: true, backend: target, migrated: true }
}

export function canReadTenant(user: UserRecord, tenantId: string) {
  return user.role === 'admin' || user.tenantIds.includes(tenantId)
}

export function canWriteTenant(user: UserRecord, tenantId: string) {
  if (user.role === 'admin') return true
  if (!user.tenantIds.includes(tenantId)) return false
  return user.role === 'verwalter' || user.role === 'techniker'
}

export function canManageTenant(user: UserRecord, tenantId: string) {
  if (user.role === 'admin') return true
  if (!user.tenantIds.includes(tenantId)) return false
  return user.role === 'verwalter'
}

export function canGenerateReports(user: UserRecord, tenantId: string) {
  if (user.role === 'admin') return true
  if (!user.tenantIds.includes(tenantId)) return false
  return user.role === 'verwalter' || user.role === 'techniker' || user.role === 'user'
}
