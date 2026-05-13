// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import bcrypt from 'bcryptjs'
import { readDbBackend, writeDbBackend } from './db-config.js'
import { getDataDb } from './data-lowdb.js'
import { readLicense, writeLicense } from './license.js'
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
import {
  createAssessmentSqlite,
  createCustomerSqlite,
  createEvidenceSqlite,
  createFindingSqlite,
  createGroupSqlite,
  createReportSqlite,
  createRetestSqlite,
  createUserSqlite,
  deleteAssessmentSqlite,
  deleteFindingSqlite,
  deleteReportSqlite,
  findUserByUsernameSqlite,
  listAssessmentsSqlite,
  listCustomersSqlite,
  listEvidenceSqlite,
  listFindingsSqlite,
  listGroupsSqlite,
  listReportsSqlite,
  listRetestsSqlite,
  listUsersSqlite,
  updateAssessmentSqlite,
  updateAssessmentStatusSqlite,
  updateCustomerSqlite,
  updateFindingSqlite,
  updateFindingStatusSqlite,
  updateGroupSqlite,
  updateReportSqlite,
  updateReportStatusSqlite,
} from './storage-sqlite.js'

export type GroupInput = {
  id: string
  name: string
  description: string
  tenantIds: string[]
}

export type EvidenceWithFile = EvidenceRecord & { fileName?: string; filePath?: string; contentType?: string }

export function getDbBackend(): DbBackend { return readDbBackend() }
export function setDbBackend(dbBackend: DbBackend) { writeDbBackend(dbBackend) }
export function getLicense(): LicenseRecord { return readLicense() }
export function updateLicense(next: Partial<LicenseRecord>) { return writeLicense(next) }

const isSqlite = () => readDbBackend() === 'sqlite'

export async function listUsers(): Promise<UserRecord[]> {
  if (isSqlite()) return listUsersSqlite()
  return (await getDataDb()).data.users
}
export async function listGroups(): Promise<GroupRecord[]> {
  if (isSqlite()) return listGroupsSqlite()
  return (await getDataDb()).data.groups
}
export async function listCustomers(): Promise<CustomerRecord[]> {
  if (isSqlite()) return listCustomersSqlite()
  return (await getDataDb()).data.customers
}
export async function listAssessments(): Promise<AssessmentRecord[]> {
  if (isSqlite()) return listAssessmentsSqlite()
  return (await getDataDb()).data.assessments
}
export async function listFindings(): Promise<FindingRecord[]> {
  if (isSqlite()) return listFindingsSqlite()
  return (await getDataDb()).data.findings
}
export async function listReports(): Promise<ReportRecord[]> {
  if (isSqlite()) return listReportsSqlite()
  return (await getDataDb()).data.reports
}
export async function listEvidence(): Promise<EvidenceWithFile[]> {
  if (isSqlite()) return listEvidenceSqlite()
  return (await getDataDb()).data.evidence
}
export async function listRetests(): Promise<RetestRecord[]> {
  if (isSqlite()) return listRetestsSqlite()
  return (await getDataDb()).data.retests
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  if (isSqlite()) return findUserByUsernameSqlite(username)
  return (await getDataDb()).data.users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null
}

export async function verifyUser(username: string, password: string): Promise<UserRecord | null> {
  const user = await findUserByUsername(username)
  if (!user) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? user : null
}

export async function createUser(input: { username: string; password: string; role: UserRole; tenantIds: string[] }) {
  if (isSqlite()) return createUserSqlite(input.username, input.password, input.role, input.tenantIds)
  const db = await getDataDb()
  const passwordHash = await bcrypt.hash(input.password, 10)
  const user: UserRecord = { id: `u-${Date.now()}`, username: input.username, passwordHash, role: input.role, tenantIds: input.tenantIds, createdAt: new Date().toISOString() }
  db.data.users.push(user)
  await db.write()
  return user
}

export async function createGroup(input: GroupInput) {
  if (isSqlite()) return createGroupSqlite(input)
  const db = await getDataDb()
  const row: GroupRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.groups.unshift(row)
  await db.write()
  return row
}

export async function updateGroup(input: GroupRecord) {
  if (isSqlite()) return updateGroupSqlite(input)
  const db = await getDataDb()
  const row = db.data.groups.find((group) => group.id === input.id)
  if (!row) return null
  Object.assign(row, input)
  await db.write()
  return row
}

export async function createCustomer(input: Omit<CustomerRecord, 'createdAt'>) {
  if (isSqlite()) return createCustomerSqlite(input)
  const db = await getDataDb()
  const row: CustomerRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.customers.unshift(row)
  await db.write()
  return row
}

export async function updateCustomer(input: CustomerRecord) {
  if (isSqlite()) return updateCustomerSqlite(input)
  const db = await getDataDb()
  const row = db.data.customers.find((customer) => customer.id === input.id)
  if (!row) return null
  Object.assign(row, input)
  await db.write()
  return row
}

export async function createAssessment(input: Omit<AssessmentRecord, 'createdAt'>) {
  if (isSqlite()) return createAssessmentSqlite(input)
  const db = await getDataDb()
  const row: AssessmentRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.assessments.unshift(row)
  await db.write()
  return row
}

export async function updateAssessment(input: AssessmentRecord) {
  if (isSqlite()) return updateAssessmentSqlite(input)
  const db = await getDataDb()
  const row = db.data.assessments.find((item) => item.id === input.id)
  if (!row) return null
  Object.assign(row, input)
  await db.write()
  return row
}

export async function updateAssessmentStatus(id: string, status: AssessmentRecord['status']) {
  if (isSqlite()) return updateAssessmentStatusSqlite(id, status)
  const db = await getDataDb()
  const row = db.data.assessments.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function deleteAssessment(id: string) {
  if (isSqlite()) return deleteAssessmentSqlite(id)
  const db = await getDataDb()
  const index = db.data.assessments.findIndex((item) => item.id === id)
  if (index === -1) return false
  db.data.assessments.splice(index, 1)
  db.data.findings = db.data.findings.filter((item) => item.assessmentId !== id)
  db.data.evidence = db.data.evidence.filter((item) => item.assessmentId !== id)
  db.data.retests = db.data.retests.filter((item) => item.assessmentId !== id)
  db.data.reports = db.data.reports.filter((item) => item.assessmentId !== id)
  await db.write()
  return true
}

export async function createFinding(input: Omit<FindingRecord, 'createdAt'>) {
  if (isSqlite()) return createFindingSqlite(input)
  const db = await getDataDb()
  const row: FindingRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.findings.unshift(row)
  await db.write()
  return row
}

export async function updateFinding(input: FindingRecord) {
  if (isSqlite()) return updateFindingSqlite(input)
  const db = await getDataDb()
  const row = db.data.findings.find((item) => item.id === input.id)
  if (!row) return null
  Object.assign(row, input)
  await db.write()
  return row
}

export async function updateFindingStatus(id: string, status: FindingRecord['status']) {
  if (isSqlite()) return updateFindingStatusSqlite(id, status)
  const db = await getDataDb()
  const row = db.data.findings.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function deleteFinding(id: string) {
  if (isSqlite()) return deleteFindingSqlite(id)
  const db = await getDataDb()
  const index = db.data.findings.findIndex((item) => item.id === id)
  if (index === -1) return false
  db.data.findings.splice(index, 1)
  db.data.evidence = db.data.evidence.filter((item) => item.findingId !== id)
  db.data.retests = db.data.retests.filter((item) => item.findingId !== id)
  await db.write()
  return true
}

export async function createReport(input: Omit<ReportRecord, 'createdAt'>) {
  if (isSqlite()) return createReportSqlite(input)
  const db = await getDataDb()
  const row: ReportRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.reports.unshift(row)
  await db.write()
  return row
}

export async function updateReport(input: ReportRecord) {
  if (isSqlite()) return updateReportSqlite(input)
  const db = await getDataDb()
  const row = db.data.reports.find((item) => item.id === input.id)
  if (!row) return null
  Object.assign(row, input)
  await db.write()
  return row
}

export async function updateReportStatus(id: string, status: ReportRecord['status']) {
  if (isSqlite()) return updateReportStatusSqlite(id, status)
  const db = await getDataDb()
  const row = db.data.reports.find((item) => item.id === id)
  if (!row) return null
  row.status = status
  await db.write()
  return row
}

export async function deleteReport(id: string) {
  if (isSqlite()) return deleteReportSqlite(id)
  const db = await getDataDb()
  const index = db.data.reports.findIndex((item) => item.id === id)
  if (index === -1) return false
  db.data.reports.splice(index, 1)
  await db.write()
  return true
}

export async function createEvidence(input: Omit<EvidenceWithFile, 'createdAt'>) {
  if (isSqlite()) return createEvidenceSqlite(input)
  const db = await getDataDb()
  const row: EvidenceWithFile = { ...input, createdAt: new Date().toISOString() }
  db.data.evidence.unshift(row)
  await db.write()
  return row
}

export async function createRetest(input: Omit<RetestRecord, 'createdAt'>) {
  if (isSqlite()) return createRetestSqlite(input)
  const db = await getDataDb()
  const row: RetestRecord = { ...input, createdAt: new Date().toISOString() }
  db.data.retests.unshift(row)
  await db.write()
  return row
}

export async function migrateDbBackend(target: DbBackend) {
  writeDbBackend(target)
  return { ok: true, dbBackend: target, migrated: true }
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
