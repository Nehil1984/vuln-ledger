// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import type { LicenseRecord, ServerState } from './models.js'

const dataDir = path.resolve(process.cwd(), 'data')
const filePath = path.join(dataDir, 'vulnledger.lowdb.json')

const nowIso = () => new Date().toISOString()

const defaultLicense: LicenseRecord = {
  status: 'trial',
  plan: 'Community Trial',
  key: 'VL-TRIAL-LOCAL',
  seats: 1,
  customer: 'Unlicensed Instance',
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  issuedAt: nowIso(),
  notes: 'Lokale Instanz ohne produktive Lizenzaktivierung.',
}

const emptyData: ServerState = {
  config: { dbBackend: 'lowdb' },
  license: defaultLicense,
  users: [],
  groups: [],
  customers: [],
  assessments: [],
  findings: [],
  reports: [],
  evidence: [],
  retests: [],
}

let db: Low<ServerState> | null = null

async function ensureAdminUser(data: ServerState) {
  if (data.users.length > 0) return
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'change-me-now'
  const passwordHash = await bcrypt.hash(password, 10)
  data.users.push({
    id: 'u-admin',
    username,
    passwordHash,
    role: 'admin',
    tenantIds: [],
    createdAt: nowIso(),
  })
}

export async function getDataDb() {
  if (db) return db
  fs.mkdirSync(dataDir, { recursive: true })
  const adapter = new JSONFile<ServerState>(filePath)
  db = new Low<ServerState>(adapter, emptyData)
  await db.read()
  db.data ||= structuredClone(emptyData)
  db.data.license ||= structuredClone(defaultLicense)
  db.data.users ||= []
  db.data.groups ||= []
  db.data.customers ||= []
  db.data.assessments ||= []
  db.data.findings ||= []
  db.data.reports ||= []
  db.data.evidence ||= []
  db.data.retests ||= []
  await ensureAdminUser(db.data)
  await db.write()
  return db
}
