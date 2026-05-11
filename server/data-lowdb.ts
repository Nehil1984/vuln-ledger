// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import type { AssessmentRecord, CustomerRecord, EvidenceRecord, FindingRecord, LicenseRecord, ReportRecord, RetestRecord, ServerState, UserRecord } from './models.js'

const dataDir = path.resolve(process.cwd(), 'data')
const filePath = path.join(dataDir, 'vulnledger.lowdb.json')

const defaultLicense: LicenseRecord = {
  status: 'trial',
  plan: 'Community Trial',
  key: 'VL-TRIAL-LOCAL',
  seats: 1,
  customer: 'Unlicensed Instance',
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  issuedAt: new Date().toISOString(),
  notes: 'Lokale Testlizenz für VulnLedger.',
}

const defaultCustomers: CustomerRecord[] = [
  { id: 'c1', name: 'Musterwerk GmbH', sector: 'Industrie', contactName: 'Laura Stein', contactEmail: 'it@musterwerk.de', contactPhone: '+49 211 555100', notes: 'Produktionsnahe Webplattform mit erhöhtem Verfügbarkeitsbedarf.', createdAt: new Date().toISOString() },
  { id: 'c2', name: 'Blue Harbor AG', sector: 'SaaS', contactName: 'Jonas Weber', contactEmail: 'security@blueharbor.io', contactPhone: '+49 30 884422', notes: 'API-first Produkt, Fokus auf AuthN/AuthZ und Mandantentrennung.', createdAt: new Date().toISOString() },
]

const defaultAssessments: AssessmentRecord[] = [
  { id: 'a1', title: 'External Web Pentest Q2', customerId: 'c1', type: 'Web', mode: 'Greybox', status: 'Aktiv', scope: 'portal.example.tld, admin.example.tld', leadTester: 'Daniel Schuh', rulesOfEngagement: 'Keine Lasttests, produktionsnahe Ausnutzung nur nach Rücksprache.', createdAt: new Date().toISOString() },
  { id: 'a2', title: 'API Security Review', customerId: 'c2', type: 'API', mode: 'Whitebox', status: 'Review', scope: 'api.blueharbor.io/v1 + Auth-Service', leadTester: 'Daniel Schuh', rulesOfEngagement: 'Nur bereitgestellte Testzugänge verwenden.', createdAt: new Date().toISOString() },
]

const defaultFindings: FindingRecord[] = [
  { id: 'VL-2026-0001', assessmentId: 'a1', title: 'Authenticated RCE via file import', target: 'portal.example.tld', severity: 'Critical', status: 'Bestätigt', cvssScore: '9.8', cwe: 'CWE-94', recommendation: 'Serverseitige Validierung härten und Importpfad isolieren.', createdAt: new Date().toISOString() },
  { id: 'VL-2026-0002', assessmentId: 'a1', title: 'Stored XSS in admin comment field', target: 'admin.example.tld', severity: 'High', status: 'Offen', cvssScore: '8.1', cwe: 'CWE-79', recommendation: 'Kontextbezogenes Encoding und serverseitige Filterung ergänzen.', createdAt: new Date().toISOString() },
  { id: 'VL-2026-0003', assessmentId: 'a2', title: 'Weak password policy on VPN portal', target: 'vpn.example.tld', severity: 'Medium', status: 'In Bearbeitung', cvssScore: '5.9', cwe: 'CWE-521', recommendation: 'MFA erzwingen und Passwortvorgaben verschärfen.', createdAt: new Date().toISOString() },
]

const defaultReports: ReportRecord[] = [
  { id: 'r1', assessmentId: 'a1', title: 'External Web Pentest Q2 Report', status: 'Draft', summary: 'Fokus auf Angriffsoberfläche, Authentisierung, Dateiupload und Rollenmodelle.', createdAt: new Date().toISOString() },
  { id: 'r2', assessmentId: 'a2', title: 'API Security Review Report', status: 'Internes Review', summary: 'API-Design, Token Handling, Autorisierung und Rate Limits bewertet.', createdAt: new Date().toISOString() },
]

const defaultEvidence: EvidenceRecord[] = [
  { id: 'e1', findingId: 'VL-2026-0001', assessmentId: 'a1', type: 'Screenshot', title: 'Upload dialog before payload execution', content: 'Screenshot dokumentiert den Importdialog und den anschließenden Erfolgspfad.', createdAt: new Date().toISOString() },
  { id: 'e2', findingId: 'VL-2026-0002', assessmentId: 'a1', type: 'Request', title: 'Stored XSS payload request', content: 'POST /comments mit Payload <script>alert(1)</script> gegen Admin-Kommentar-Feld.', createdAt: new Date().toISOString() },
]

const defaultRetests: RetestRecord[] = [
  { id: 'rt1', findingId: 'VL-2026-0003', assessmentId: 'a2', result: 'Teilweise behoben', tester: 'Daniel Schuh', notes: 'MFA wurde ergänzt, Passwort-Policy jedoch noch nicht vollständig verschärft.', createdAt: new Date().toISOString() },
]

const defaultUsers: UserRecord[] = []

const defaultData: ServerState = {
  config: { dbBackend: 'lowdb' },
  license: defaultLicense,
  users: defaultUsers,
  customers: defaultCustomers,
  assessments: defaultAssessments,
  findings: defaultFindings,
  reports: defaultReports,
  evidence: defaultEvidence,
  retests: defaultRetests,
}

let db: Low<ServerState> | null = null

async function ensureDefaultAdmin(data: ServerState) {
  if (data.users.length > 0) return
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123!'
  const passwordHash = await bcrypt.hash(password, 10)
  data.users.push({ id: 'u-admin', username, passwordHash, role: 'admin', createdAt: new Date().toISOString() })
}

export async function getDataDb() {
  if (db) return db
  fs.mkdirSync(dataDir, { recursive: true })
  const adapter = new JSONFile<ServerState>(filePath)
  db = new Low<ServerState>(adapter, defaultData)
  await db.read()
  db.data ||= structuredClone(defaultData)
  db.data.license ||= structuredClone(defaultLicense)
  db.data.users ||= structuredClone(defaultUsers)
  await ensureDefaultAdmin(db.data)
  db.data.customers ||= structuredClone(defaultCustomers)
  db.data.assessments ||= structuredClone(defaultAssessments)
  db.data.findings ||= structuredClone(defaultFindings)
  db.data.reports ||= structuredClone(defaultReports)
  db.data.evidence ||= structuredClone(defaultEvidence)
  db.data.retests ||= structuredClone(defaultRetests)
  await db.write()
  return db
}
