import fs from 'node:fs'
import path from 'node:path'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import type { AssessmentRecord, CustomerRecord, FindingRecord, LicenseRecord, ServerState } from './models.js'

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
  {
    id: 'c1',
    name: 'Musterwerk GmbH',
    sector: 'Industrie',
    contactName: 'Laura Stein',
    contactEmail: 'it@musterwerk.de',
    contactPhone: '+49 211 555100',
    notes: 'Produktionsnahe Webplattform mit erhöhtem Verfügbarkeitsbedarf.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'c2',
    name: 'Blue Harbor AG',
    sector: 'SaaS',
    contactName: 'Jonas Weber',
    contactEmail: 'security@blueharbor.io',
    contactPhone: '+49 30 884422',
    notes: 'API-first Produkt, Fokus auf AuthN/AuthZ und Mandantentrennung.',
    createdAt: new Date().toISOString(),
  },
]

const defaultAssessments: AssessmentRecord[] = [
  {
    id: 'a1',
    title: 'External Web Pentest Q2',
    customerId: 'c1',
    type: 'Web',
    mode: 'Greybox',
    status: 'Aktiv',
    scope: 'portal.example.tld, admin.example.tld',
    leadTester: 'Daniel Schuh',
    rulesOfEngagement: 'Keine Lasttests, produktionsnahe Ausnutzung nur nach Rücksprache.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a2',
    title: 'API Security Review',
    customerId: 'c2',
    type: 'API',
    mode: 'Whitebox',
    status: 'Review',
    scope: 'api.blueharbor.io/v1 + Auth-Service',
    leadTester: 'Daniel Schuh',
    rulesOfEngagement: 'Nur bereitgestellte Testzugänge verwenden.',
    createdAt: new Date().toISOString(),
  },
]

const defaultFindings: FindingRecord[] = [
  {
    id: 'VL-2026-0001',
    assessmentId: 'a1',
    title: 'Authenticated RCE via file import',
    target: 'portal.example.tld',
    severity: 'Critical',
    status: 'Bestätigt',
    cvssScore: '9.8',
    cwe: 'CWE-94',
    recommendation: 'Serverseitige Validierung härten und Importpfad isolieren.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'VL-2026-0002',
    assessmentId: 'a1',
    title: 'Stored XSS in admin comment field',
    target: 'admin.example.tld',
    severity: 'High',
    status: 'Offen',
    cvssScore: '8.1',
    cwe: 'CWE-79',
    recommendation: 'Kontextbezogenes Encoding und serverseitige Filterung ergänzen.',
    createdAt: new Date().toISOString(),
  },
]

const defaultData: ServerState = {
  config: { dbBackend: 'lowdb' },
  license: defaultLicense,
  users: [],
  customers: defaultCustomers,
  assessments: defaultAssessments,
  findings: defaultFindings,
}

let db: Low<ServerState> | null = null

export async function getDataDb() {
  if (db) return db
  fs.mkdirSync(dataDir, { recursive: true })
  const adapter = new JSONFile<ServerState>(filePath)
  db = new Low<ServerState>(adapter, defaultData)
  await db.read()
  db.data ||= structuredClone(defaultData)
  db.data.license ||= structuredClone(defaultLicense)
  db.data.customers ||= structuredClone(defaultCustomers)
  db.data.assessments ||= structuredClone(defaultAssessments)
  db.data.findings ||= structuredClone(defaultFindings)
  await db.write()
  return db
}
