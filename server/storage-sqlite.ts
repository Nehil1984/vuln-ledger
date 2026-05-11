// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { AssessmentRecord, CustomerRecord, EvidenceRecord, FindingRecord, GroupRecord, ReportRecord, RetestRecord, UserRecord, UserRole } from './types.js'

export type SqliteEvidenceRow = EvidenceRecord & { fileName?: string; filePath?: string; contentType?: string }

export async function listUsersSqlite(): Promise<UserRecord[]> { return [] }
export async function findUserByUsernameSqlite(_username: string): Promise<UserRecord | null> { return null }
export async function createUserSqlite(_username: string, _password: string, _role: UserRole): Promise<UserRecord> { throw new Error('SQLite path is being migrated and is temporarily unavailable in this branch state.') }
export async function listGroupsSqlite(): Promise<GroupRecord[]> { return [] }
export async function createGroupSqlite(_input: Omit<GroupRecord, 'createdAt'>): Promise<GroupRecord> { throw new Error('SQLite path is being migrated and is temporarily unavailable in this branch state.') }
export async function updateGroupSqlite(_input: GroupRecord): Promise<GroupRecord | null> { return null }
export async function listCustomersSqlite(): Promise<CustomerRecord[]> { return [] }
export async function createCustomerSqlite(_input: Omit<CustomerRecord, 'createdAt'>): Promise<CustomerRecord> { throw new Error('SQLite path is being migrated and is temporarily unavailable in this branch state.') }
export async function updateCustomerSqlite(_input: CustomerRecord): Promise<CustomerRecord | null> { return null }
export async function listAssessmentsSqlite(): Promise<AssessmentRecord[]> { return [] }
export async function createAssessmentSqlite(_input: Omit<AssessmentRecord, 'createdAt'>): Promise<AssessmentRecord> { throw new Error('SQLite path is being migrated and is temporarily unavailable in this branch state.') }
export async function updateAssessmentStatusSqlite(_id: string, _status: AssessmentRecord['status']) { return null }
export async function listFindingsSqlite(): Promise<FindingRecord[]> { return [] }
export async function createFindingSqlite(_input: Omit<FindingRecord, 'createdAt'>): Promise<FindingRecord> { throw new Error('SQLite path is being migrated and is temporarily unavailable in this branch state.') }
export async function updateFindingStatusSqlite(_id: string, _status: FindingRecord['status']) { return null }
export async function listReportsSqlite(): Promise<ReportRecord[]> { return [] }
export async function createReportSqlite(_input: Omit<ReportRecord, 'createdAt'>): Promise<ReportRecord> { throw new Error('SQLite path is being migrated and is temporarily unavailable in this branch state.') }
export async function updateReportStatusSqlite(_id: string, _status: ReportRecord['status']) { return null }
export async function listEvidenceSqlite(): Promise<SqliteEvidenceRow[]> { return [] }
export async function createEvidenceSqlite(_input: Omit<SqliteEvidenceRow, 'createdAt'>): Promise<SqliteEvidenceRow> { throw new Error('SQLite path is being migrated and is temporarily unavailable in this branch state.') }
export async function listRetestsSqlite(): Promise<RetestRecord[]> { return [] }
export async function createRetestSqlite(_input: Omit<RetestRecord, 'createdAt'>): Promise<RetestRecord> { throw new Error('SQLite path is being migrated and is temporarily unavailable in this branch state.') }
