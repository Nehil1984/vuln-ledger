export type UserRole = 'admin' | 'user'
export type DbBackend = 'lowdb' | 'sqlite'

export type UserRecord = {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  createdAt: string
}

export type LicenseRecord = {
  status: 'active' | 'inactive' | 'trial'
  plan: string
  key: string
  seats: number
  customer: string
  validUntil: string
  issuedAt: string
  notes: string
}

export type CustomerRecord = {
  id: string
  name: string
  sector: string
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
  createdAt: string
}

export type AssessmentStatus = 'Geplant' | 'Aktiv' | 'Review' | 'Abgeschlossen'
export type AssessmentRecord = {
  id: string
  title: string
  customerId: string
  type: string
  mode: string
  status: AssessmentStatus
  scope: string
  leadTester: string
  rulesOfEngagement: string
  createdAt: string
}

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type FindingStatus = 'Offen' | 'Bestätigt' | 'In Bearbeitung' | 'Behoben'
export type FindingRecord = {
  id: string
  assessmentId: string
  title: string
  target: string
  severity: Severity
  status: FindingStatus
  cvssScore: string
  cwe: string
  recommendation: string
  createdAt: string
}

export type BackupRetentionConfig = {
  hourly: number
  daily: number
  weekly: number
  monthly: number
  yearly: number
}

export type BackupConfig = {
  enabled: boolean
  backupDir: string
  retention: BackupRetentionConfig
  encrypt: boolean
  passwordHint?: string
  updatedAt: string
  lastRunAt?: string
  lastSuccessAt?: string
  lastErrorAt?: string
  lastErrorMessage?: string
}

export type BackupRecord = {
  fileName: string
  filePath: string
  createdAt: string
  size: number
  encrypted: boolean
  slot: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  label: string
  backend: DbBackend | null
  backendMismatch: boolean
}

export type BackupPreflightResult = {
  ok: boolean
  fileName: string
  encrypted: boolean
  currentBackend: DbBackend
  backupBackend: DbBackend | null
  backendMismatch: boolean
  migrationRequired: boolean
  sizeBytes: number
  warnings: string[]
}

export type AppConfig = {
  dbBackend: DbBackend
}

export type ServerState = {
  config: AppConfig
  license: LicenseRecord
  users: UserRecord[]
  customers: CustomerRecord[]
  assessments: AssessmentRecord[]
  findings: FindingRecord[]
}
