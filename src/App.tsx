// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import { useEffect, useMemo, useState } from 'react'
import licenseText from '../LICENSE?raw'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'

type UserRole = 'admin' | 'verwalter' | 'techniker' | 'user'
type AssessmentStatus = 'Geplant' | 'Aktiv' | 'Review' | 'Abgeschlossen'
type FindingStatus = 'Offen' | 'Bestätigt' | 'In Bearbeitung' | 'Behoben'
type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
type ReportStatus = 'Draft' | 'Internes Review' | 'Freigegeben' | 'Exportiert'
type ReportScope = 'tenant' | 'group'
type EvidenceType = 'Screenshot' | 'Request' | 'Response' | 'Terminal' | 'Datei' | 'Notiz'
type RetestResult = 'Offen' | 'Teilweise behoben' | 'Behoben' | 'Nicht reproduzierbar'
type DbBackend = 'lowdb' | 'sqlite'

type SessionUser = { id: string; username: string; role: UserRole; tenantIds: string[] }
type LicenseInfo = { status: 'active' | 'inactive' | 'trial'; plan: string; key: string; seats: number; customer: string; validUntil: string; issuedAt: string; notes: string }
type Group = { id: string; name: string; description: string; tenantIds: string[]; createdAt?: string }
type Customer = { id: string; groupId?: string; name: string; sector: string; contactName: string; contactEmail: string; contactPhone: string; notes: string; createdAt?: string }
type Assessment = { id: string; title: string; customerId: string; type: string; mode: string; status: AssessmentStatus; scope: string; leadTester: string; rulesOfEngagement: string; createdAt?: string }
type Finding = { id: string; customerId: string; assessmentId: string; title: string; target: string; severity: Severity; status: FindingStatus; cvssScore: string; cwe: string; recommendation: string; createdAt?: string }
type Report = { id: string; scopeType: ReportScope; customerId?: string; groupId?: string; assessmentId?: string; title: string; status: ReportStatus; summary: string; createdAt?: string }
type Evidence = { id: string; customerId: string; findingId: string; assessmentId: string; type: EvidenceType; title: string; content: string; fileName?: string; filePath?: string; contentType?: string; createdAt?: string }
type Retest = { id: string; customerId: string; findingId: string; assessmentId: string; result: RetestResult; tester: string; notes: string; createdAt?: string }
type AdminUser = { id: string; username: string; role: UserRole; tenantIds: string[]; createdAt: string }
type BackupConfig = { backupDir: string; retention: { hourly: number; daily: number; weekly: number; monthly: number; yearly: number }; encrypt: boolean; passwordHint: string; enabled: boolean; updatedAt?: string; nextRunAt: string | null; lastRunAt: string | null; lastSuccessAt: string | null; lastErrorAt: string | null; lastErrorMessage: string; schedulerActive: boolean; schedulerRuntimePasswordConfigured: boolean }
type BackupRecord = { fileName: string; createdAt: string; size: number; encrypted: boolean; slot: string; label: string; backend: DbBackend | null; backendMismatch: boolean }
type ReportExportPayload = { report: Report; scopeLabel: string; generatedAt: string; customer?: Customer | null; group?: Group | null; assessment?: Assessment | null; findings: Finding[]; evidence: Evidence[]; retests: Retest[]; tenantNameById: Record<string, string>; groupNameById: Record<string, string> }

const APP_VERSION = '0.4.0'
const REPORT_EXPORT_KEY = 'vulnledger_report_export'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', hint: 'Überblick' },
  { to: '/mandanten', label: 'Mandanten', hint: 'Mandanten & Konzernstruktur' },
  { to: '/assessments', label: 'Assessments', hint: 'Scopes & Projekte' },
  { to: '/findings', label: 'Findings', hint: 'Schwachstellen, Evidence, Retests' },
  { to: '/reports', label: 'Reports', hint: 'Mandanten- & Konzernreports' },
  { to: '/admin', label: 'Admin', hint: 'User, DB, Backup, Lizenz' },
]

async function parseApiJson<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return null as T
  }

  const text = await response.text()
  if (!text.trim()) {
    return null as T
  }

  return JSON.parse(text) as T
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const data = await parseApiJson<{ message?: string }>(response)
      if (data?.message) message = data.message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return parseApiJson<T>(response)
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'message' in error) return (error as { message?: string }).message || fallback
  return fallback
}

function canManageTenants(role: UserRole) { return role === 'admin' || role === 'verwalter' }
function canWrite(role: UserRole) { return role === 'admin' || role === 'verwalter' || role === 'techniker' }
function canSeeAdmin(role: UserRole) { return role === 'admin' }

function openReportExport(payload: ReportExportPayload) {
  sessionStorage.setItem(REPORT_EXPORT_KEY, JSON.stringify(payload))
  window.open('/report-print.html', '_blank', 'noopener,noreferrer')
}

function AppShell(props: Parameters<typeof AppContent>[0]) {
  const navigate = useNavigate()
  return <AppContent {...props} onOpenLicense={() => navigate('/admin#license')} />
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [license] = useState<LicenseInfo | null>(null)
  const [dbBackend, setDbBackend] = useState<DbBackend>('lowdb')
  const [groups, setGroups] = useState<Group[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [retests, setRetests] = useState<Retest[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [backupConfig, setBackupConfig] = useState<BackupConfig | null>(null)
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('vulnledger-theme') === 'light' ? 'light' : 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('vulnledger-theme', theme)
  }, [theme])

  async function loadDomainData() {
    const [groupRows, customerRows, assessmentRows, findingRows, reportRows, evidenceRows, retestRows] = await Promise.all([
      api<Group[]>('/api/groups'),
      api<Customer[]>('/api/customers'),
      api<Assessment[]>('/api/assessments'),
      api<Finding[]>('/api/findings'),
      api<Report[]>('/api/reports'),
      api<Evidence[]>('/api/evidence'),
      api<Retest[]>('/api/retests'),
    ])
    setGroups(Array.isArray(groupRows) ? groupRows.map((group) => ({ ...group, tenantIds: Array.isArray(group?.tenantIds) ? group.tenantIds : [] })) : [])
    setCustomers(Array.isArray(customerRows) ? customerRows : [])
    setAssessments(Array.isArray(assessmentRows) ? assessmentRows : [])
    setFindings(Array.isArray(findingRows) ? findingRows : [])
    setReports(Array.isArray(reportRows) ? reportRows : [])
    setEvidence(Array.isArray(evidenceRows) ? evidenceRows : [])
    setRetests(Array.isArray(retestRows) ? retestRows : [])
  }

  async function loadAdminData() {
    const [users, db, backupCfg, backupRows] = await Promise.all([
      api<AdminUser[]>('/api/admin/users'),
      api<{ dbBackend: DbBackend }>('/api/admin/db-config'),
      api<BackupConfig>('/api/admin/backups/config'),
      api<BackupRecord[]>('/api/admin/backups'),
    ])
    setAdminUsers(Array.isArray(users) ? users.map((entry) => ({ ...entry, tenantIds: Array.isArray(entry?.tenantIds) ? entry.tenantIds : [] })) : [])
    setDbBackend(db.dbBackend)
    setBackupConfig(backupCfg)
    setBackups(Array.isArray(backupRows) ? backupRows : [])
  }

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      try {
        const session = await api<{ user: SessionUser; backend: DbBackend }>('/api/auth/me')
        if (cancelled) return
        setUser({ ...session.user, tenantIds: Array.isArray(session.user?.tenantIds) ? session.user.tenantIds : [] })
        setDbBackend(session.backend)
        await Promise.all([loadDomainData(), canSeeAdmin(session.user.role) ? loadAdminData() : Promise.resolve()])
        if (cancelled) return
        setError('')
      } catch {
        if (cancelled) return
        setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSession()
    return () => { cancelled = true }
  }, [])

  const tenantNameById = useMemo(() => Object.fromEntries(customers.map((customer) => [customer.id, customer.name])), [customers])
  const groupNameById = useMemo(() => Object.fromEntries(groups.map((group) => [group.id, group.name])), [groups])

  const stats = useMemo(() => {
    const activeAssessmentCount = assessments.filter((item) => item.status === 'Aktiv').length
    const criticalFindingCount = findings.filter((item) => item.severity === 'Critical').length
    const groupReportCount = reports.filter((item) => item.scopeType === 'group').length
    const openRetests = retests.filter((item) => item.result === 'Offen' || item.result === 'Teilweise behoben').length
    return [
      { label: 'Aktive Assessments', value: String(activeAssessmentCount), tone: 'neutral' },
      { label: 'Kritische Findings', value: String(criticalFindingCount), tone: 'critical' },
      { label: 'Konzernreports', value: String(groupReportCount), tone: 'high' },
      { label: 'Offene Retests', value: String(openRetests), tone: 'medium' },
    ]
  }, [assessments, findings, reports, retests])

  async function handleLogin(username: string, password: string) {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const session = await api<{ user: SessionUser; backend: DbBackend }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      setUser({ ...session.user, tenantIds: Array.isArray(session.user?.tenantIds) ? session.user.tenantIds : [] })
      setDbBackend(session.backend)
      await Promise.all([loadDomainData(), canSeeAdmin(session.user.role) ? loadAdminData() : Promise.resolve()])
    } catch (loginError: unknown) {
      setError(getErrorMessage(loginError, 'Login fehlgeschlagen'))
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await api<{ ok: true }>('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) })
    setUser(null)
    setAdminUsers([])
    setBackupConfig(null)
    setBackups([])
  }

  if (loading) return <div className="auth-shell"><div className="auth-card"><h1>VulnLedger lädt…</h1></div></div>
  if (!user) return <LoginPage error={error} onLogin={handleLogin} />

  return <Routes><Route path="*" element={<AppShell user={user} license={license} dbBackend={dbBackend} groups={groups} customers={customers} assessments={assessments} findings={findings} reports={reports} evidence={evidence} retests={retests} adminUsers={adminUsers} backupConfig={backupConfig} backups={backups} notice={notice} theme={theme} stats={stats} tenantNameById={tenantNameById} groupNameById={groupNameById} setTheme={setTheme} handleLogout={handleLogout} setGroups={setGroups} setCustomers={setCustomers} setAssessments={setAssessments} setFindings={setFindings} setReports={setReports} setEvidence={setEvidence} setRetests={setRetests} setAdminUsers={setAdminUsers} setBackupConfig={setBackupConfig} setBackups={setBackups} setNotice={setNotice} loadAdminData={loadAdminData} onOpenLicense={() => {}} />} /></Routes>
}

type AppContentProps = {
  user: SessionUser
  license: LicenseInfo | null
  dbBackend: DbBackend
  groups: Group[]
  customers: Customer[]
  assessments: Assessment[]
  findings: Finding[]
  reports: Report[]
  evidence: Evidence[]
  retests: Retest[]
  adminUsers: AdminUser[]
  backupConfig: BackupConfig | null
  backups: BackupRecord[]
  notice: string
  theme: 'dark' | 'light'
  stats: Array<{ label: string; value: string; tone?: string }>
  tenantNameById: Record<string, string>
  groupNameById: Record<string, string>
  setTheme: React.Dispatch<React.SetStateAction<'dark' | 'light'>>
  handleLogout: () => Promise<void>
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
  setAssessments: React.Dispatch<React.SetStateAction<Assessment[]>>
  setFindings: React.Dispatch<React.SetStateAction<Finding[]>>
  setReports: React.Dispatch<React.SetStateAction<Report[]>>
  setEvidence: React.Dispatch<React.SetStateAction<Evidence[]>>
  setRetests: React.Dispatch<React.SetStateAction<Retest[]>>
  setAdminUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>
  setBackupConfig: React.Dispatch<React.SetStateAction<BackupConfig | null>>
  setBackups: React.Dispatch<React.SetStateAction<BackupRecord[]>>
  setNotice: React.Dispatch<React.SetStateAction<string>>
  loadAdminData: () => Promise<void>
  onOpenLicense: () => void
}

function AppContent({ user, license, dbBackend, groups, customers, assessments, findings, reports, evidence, retests, adminUsers, backupConfig, backups, notice, theme, stats, tenantNameById, groupNameById, setTheme, handleLogout, setGroups, setCustomers, setAssessments, setFindings, setReports, setEvidence, setRetests, setAdminUsers, setBackupConfig, setBackups, setNotice, loadAdminData, onOpenLicense }: AppContentProps) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__sticky">
          <div className="brand"><img src="/vulnledger-logo.png" alt="VulnLedger" className="brand__logo" /><div><strong>VulnLedger</strong><span>Version {APP_VERSION}</span></div></div>
          <nav className="nav">{navItems.filter((item) => item.to !== '/admin' || canSeeAdmin(user.role)).map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`}><span>{item.label}</span><small>{item.hint}</small></NavLink>)}</nav>
          <div className="sidebar__meta">
            <span>{user.username}</span>
            <span>{user.role} · {dbBackend}</span>
            <span>{Array.isArray(user.tenantIds) ? user.tenantIds.length : 0} Mandanten</span>
            <button className="secondary-button sidebar__logout" onClick={() => void handleLogout()}>Logout</button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="app-toolbar app-toolbar--sticky">
          <div className="app-toolbar__meta"><span>VulnLedger</span><small>Pentest-Management, Reports und Nachweise</small></div>
          <div className="toolbar-actions">
            <button className="secondary-button theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀ Hell' : '☾ Dunkel'}</button>
          </div>
        </header>
        <main className="main">
          {notice ? <div className="success-box">{notice}</div> : null}
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage customers={customers} groups={groups} findings={findings} reports={reports} stats={stats} license={license} />} />
            <Route path="/mandanten" element={<TenantsPage user={user} groups={groups} customers={customers} assessments={assessments} onAddGroup={async (group) => { const created = await api<Group>('/api/groups', { method: 'POST', body: JSON.stringify(group) }); setGroups((current) => [created, ...current]) }} onAddCustomer={async (customer) => { const created = await api<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(customer) }); setCustomers((current) => [created, ...current]) }} />} />
            <Route path="/assessments" element={<AssessmentsPage user={user} customers={customers} assessments={assessments} onAddAssessment={async (assessment) => { const created = await api<Assessment>('/api/assessments', { method: 'POST', body: JSON.stringify(assessment) }); setAssessments((current) => [created, ...current]) }} onStatusChange={async (assessmentId, status) => { const updated = await api<Assessment>(`/api/assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setAssessments((current) => current.map((item) => item.id === assessmentId ? updated : item)) }} />} />
            <Route path="/findings" element={<FindingsPage user={user} customers={customers} assessments={assessments} findings={findings} evidence={evidence} onAddFinding={async (finding) => { const created = await api<Finding>('/api/findings', { method: 'POST', body: JSON.stringify(finding) }); setFindings((current) => [created, ...current]) }} onStatusChange={async (findingId, status) => { const updated = await api<Finding>(`/api/findings/${findingId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setFindings((current) => current.map((item) => item.id === findingId ? updated : item)) }} onAddEvidence={async (entry) => { const created = await api<Evidence>('/api/evidence', { method: 'POST', body: JSON.stringify(entry) }); setEvidence((current) => [created, ...current]) }} onAddRetest={async (entry) => { const created = await api<Retest>('/api/retests', { method: 'POST', body: JSON.stringify(entry) }); setRetests((current) => [created, ...current]) }} />} />
            <Route path="/reports" element={<ReportsPage user={user} reports={reports} groups={groups} customers={customers} assessments={assessments} findings={findings} evidence={evidence} retests={retests} tenantNameById={tenantNameById} groupNameById={groupNameById} onAddReport={async (report) => { const created = await api<Report>('/api/reports', { method: 'POST', body: JSON.stringify(report) }); setReports((current) => [created, ...current]) }} onStatusChange={async (reportId, status) => { const updated = await api<Report>(`/api/reports/${reportId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setReports((current) => current.map((item) => item.id === reportId ? updated : item)) }} />} />
            {canSeeAdmin(user.role) ? <Route path="/admin" element={<AdminPage customers={customers} users={adminUsers} dbBackend={dbBackend} backupConfig={backupConfig} backups={backups} onRefresh={loadAdminData} onUserCreated={(row) => setAdminUsers((current) => [row, ...current])} onDbBackendChanged={(backend) => { setNotice(`Datenbank-Backend aktiv: ${backend}`) }} onBackupConfigChanged={setBackupConfig} onBackupsChanged={setBackups} />} /> : null}
          </Routes>
        </main>
        <footer className="app-footer app-footer--sticky">
          <div className="app-footer__meta"><span>VulnLedger</span><span>Version {APP_VERSION}</span><span>Apache-2.0</span><span>Copyright 2026 Daniel Schuh</span></div>
          <button type="button" className="footer-link-button" onClick={onOpenLicense}>Lizenz und Copyright</button>
        </footer>
      </div>
    </div>
  )
}

function LoginPage({ error, onLogin }: { error: string; onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123!')
  const [submitting, setSubmitting] = useState(false)
  return <div className="auth-shell"><form className="auth-card" onSubmit={async (event) => { event.preventDefault(); setSubmitting(true); try { await onLogin(username, password) } finally { setSubmitting(false) } }}><img src="/vulnledger-logo.png" alt="VulnLedger" className="auth-logo" /><h1>VulnLedger Login</h1><p>Für Pentest-Teams: Scope, Findings, Evidence, Retests, Mandanten und Konzernreports an einem Ort.</p><label><span>Benutzername</span><input value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label><span>Passwort</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error ? <div className="error-box">{error}</div> : null}<button type="submit" disabled={submitting}>{submitting ? 'Anmeldung läuft…' : 'Anmelden'}</button></form></div>
}

function PageHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return <header className="topbar"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{meta ? <p className="topbar__meta">{meta}</p> : null}</div></header>
}

function DashboardPage({ customers, groups, findings, reports, stats, license }: { customers: Customer[]; groups: Group[]; findings: Finding[]; reports: Report[]; stats: Array<{ label: string; value: string; tone?: string }>; license: LicenseInfo | null }) {
  return <><PageHeader eyebrow="Dashboard" title="Operativer Überblick über Mandanten und Konzernlage" meta={license ? `${license.plan} · gültig bis ${new Date(license.validUntil).toLocaleDateString('de-DE')}` : undefined} /><section className="stats-grid">{stats.map((stat) => <article key={stat.label} className={`stat stat--${stat.tone ?? 'neutral'}`}><span>{stat.label}</span><strong>{stat.value}</strong></article>)}</section><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Konzernstruktur</h2><span>{groups.length} Konzerne</span></div><div className="list">{groups.map((group) => <div className="list__item" key={group.id}><strong>{group.name}</strong><span>{Array.isArray(group.tenantIds) ? group.tenantIds.length : 0} Mandanten</span><small>{group.description}</small></div>)}</div></article><article className="panel"><div className="panel__header"><h2>Mandanten im Zugriff</h2><span>{customers.length} Mandanten</span></div><div className="list">{customers.map((customer) => <div className="list__item" key={customer.id}><strong>{customer.name}</strong><span>{customer.sector}</span><small>{customer.contactEmail}</small></div>)}</div></article></section><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Priorisierte Findings</h2><span>Top-Risiken</span></div><FindingsTable rows={findings.slice(0, 5)} /></article><article className="panel"><div className="panel__header"><h2>Report-Lage</h2><span>{reports.length} Reports</span></div><div className="list">{reports.map((report) => <div className="list__item" key={report.id}><strong>{report.title}</strong><span>{report.scopeType === 'group' ? 'Konzernreport' : 'Mandantenreport'}</span><small>{report.status}</small></div>)}</div></article></section></>
}

function TenantsPage({ user, groups, customers, assessments, onAddGroup, onAddCustomer }: { user: SessionUser; groups: Group[]; customers: Customer[]; assessments: Assessment[]; onAddGroup: (group: Group) => Promise<void>; onAddCustomer: (customer: Customer) => Promise<void> }) {
  const [groupForm, setGroupForm] = useState({ name: '', description: '', tenantIds: [] as string[] })
  const [customerForm, setCustomerForm] = useState({ groupId: groups[0]?.id ?? '', name: '', sector: '', contactName: '', contactEmail: '', contactPhone: '', notes: '' })
  const canManage = canManageTenants(user.role)
  return <><PageHeader eyebrow="Mandanten" title="Mandanten und Konzernstruktur verwalten" /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Konzernübersicht</h2><span>{groups.length} Einträge</span></div><div className="list">{groups.map((group) => <div className="list__item" key={group.id}><strong>{group.name}</strong><span>{Array.isArray(group.tenantIds) ? group.tenantIds.length : 0} Mandanten</span><small>{group.description}</small></div>)}</div></article><article className="panel"><div className="panel__header"><h2>Mandantenübersicht</h2><span>{customers.length} Mandanten</span></div><div className="list">{customers.map((customer) => <div className="list__item" key={customer.id}><strong>{customer.name}</strong><span>{groups.find((group) => group.id === customer.groupId)?.name ?? 'Kein Konzern'}</span><small>{assessments.filter((assessment) => assessment.customerId === customer.id).length} Assessments</small></div>)}</div></article></section>{canManage ? <section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Neuen Konzern anlegen</h2><span>für Admin / Verwalter</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); await onAddGroup({ id: `g${Date.now()}`, name: groupForm.name, description: groupForm.description, tenantIds: groupForm.tenantIds }); setGroupForm({ name: '', description: '', tenantIds: [] }) }}><label><span>Name</span><input value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} required /></label><label className="form-grid__full"><span>Beschreibung</span><textarea value={groupForm.description} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} rows={3} /></label><label className="form-grid__full"><span>Zugeordnete Mandanten</span><select multiple value={groupForm.tenantIds} onChange={(event) => setGroupForm({ ...groupForm, tenantIds: Array.from(event.target.selectedOptions).map((option) => option.value) })}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><div className="form-grid__full form-actions"><button type="submit">Konzern speichern</button></div></form></article><article className="panel"><div className="panel__header"><h2>Neuen Mandanten anlegen</h2><span>für Admin / Verwalter</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); const nextId = `c${Date.now()}`; await onAddCustomer({ id: nextId, groupId: customerForm.groupId || undefined, name: customerForm.name, sector: customerForm.sector, contactName: customerForm.contactName, contactEmail: customerForm.contactEmail, contactPhone: customerForm.contactPhone, notes: customerForm.notes }); setCustomerForm({ groupId: groups[0]?.id ?? '', name: '', sector: '', contactName: '', contactEmail: '', contactPhone: '', notes: '' }) }}><label><span>Konzern</span><select value={customerForm.groupId} onChange={(event) => setCustomerForm({ ...customerForm, groupId: event.target.value })}><option value="">Kein Konzern</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label><span>Name</span><input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} required /></label><label><span>Branche</span><input value={customerForm.sector} onChange={(event) => setCustomerForm({ ...customerForm, sector: event.target.value })} required /></label><label><span>Ansprechpartner</span><input value={customerForm.contactName} onChange={(event) => setCustomerForm({ ...customerForm, contactName: event.target.value })} required /></label><label><span>E-Mail</span><input type="email" value={customerForm.contactEmail} onChange={(event) => setCustomerForm({ ...customerForm, contactEmail: event.target.value })} required /></label><label><span>Telefon</span><input value={customerForm.contactPhone} onChange={(event) => setCustomerForm({ ...customerForm, contactPhone: event.target.value })} /></label><label className="form-grid__full"><span>Notizen</span><textarea value={customerForm.notes} onChange={(event) => setCustomerForm({ ...customerForm, notes: event.target.value })} rows={3} /></label><div className="form-grid__full form-actions"><button type="submit">Mandanten speichern</button></div></form></article></section> : <section className="panel-grid"><article className="panel"><small>Deine Rolle ist lesend. Mandanten- und Konzernpflege ist nur für Admin oder Verwalter möglich.</small></article></section>}</>
}

function AssessmentsPage({ user, customers, assessments, onAddAssessment, onStatusChange }: { user: SessionUser; customers: Customer[]; assessments: Assessment[]; onAddAssessment: (assessment: Assessment) => Promise<void>; onStatusChange: (assessmentId: string, status: AssessmentStatus) => Promise<void> }) {
  const [form, setForm] = useState({ title: '', customerId: customers[0]?.id ?? '', type: 'Web', mode: 'Greybox', status: 'Geplant' as AssessmentStatus, scope: '', leadTester: 'Daniel Schuh', rulesOfEngagement: '' })
  const writable = canWrite(user.role)
  return <><PageHeader eyebrow="Assessments" title="Assessments pro Mandant planen und steuern" /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Assessment-Liste</h2><span>{assessments.length} Projekte</span></div><div className="list">{assessments.map((assessment) => <div className="list__item" key={assessment.id}><strong>{assessment.title}</strong><span>{customers.find((customer) => customer.id === assessment.customerId)?.name}</span><small>{assessment.type} · {assessment.mode} · {assessment.status}</small>{writable ? <select value={assessment.status} onChange={(event) => void onStatusChange(assessment.id, event.target.value as AssessmentStatus)}><option>Geplant</option><option>Aktiv</option><option>Review</option><option>Abgeschlossen</option></select> : null}</div>)}</div></article>{writable ? <article className="panel"><div className="panel__header"><h2>Neues Assessment</h2><span>für beschreibbare Mandanten</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); await onAddAssessment({ id: `a${Date.now()}`, ...form }); setForm({ title: '', customerId: customers[0]?.id ?? '', type: 'Web', mode: 'Greybox', status: 'Geplant', scope: '', leadTester: 'Daniel Schuh', rulesOfEngagement: '' }) }}><label><span>Mandant</span><select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label><span>Titel</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label><span>Testart</span><input value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} required /></label><label><span>Ansatz</span><input value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })} required /></label><label><span>Lead Tester</span><input value={form.leadTester} onChange={(event) => setForm({ ...form, leadTester: event.target.value })} /></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AssessmentStatus })}><option>Geplant</option><option>Aktiv</option><option>Review</option><option>Abgeschlossen</option></select></label><label className="form-grid__full"><span>Scope</span><textarea value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} rows={3} required /></label><label className="form-grid__full"><span>Rules of Engagement</span><textarea value={form.rulesOfEngagement} onChange={(event) => setForm({ ...form, rulesOfEngagement: event.target.value })} rows={4} required /></label><div className="form-grid__full form-actions"><button type="submit">Assessment speichern</button></div></form></article> : null}</section></>
}

function FindingsPage({ user, customers, assessments, findings, evidence, onAddFinding, onStatusChange, onAddEvidence, onAddRetest }: { user: SessionUser; customers: Customer[]; assessments: Assessment[]; findings: Finding[]; evidence: Evidence[]; onAddFinding: (finding: Finding) => Promise<void>; onStatusChange: (findingId: string, status: FindingStatus) => Promise<void>; onAddEvidence: (entry: Evidence) => Promise<void>; onAddRetest: (entry: Retest) => Promise<void> }) {
  const [selectedFindingId, setSelectedFindingId] = useState(findings[0]?.id ?? '')
  const [form, setForm] = useState({ customerId: customers[0]?.id ?? '', assessmentId: assessments[0]?.id ?? '', title: '', target: '', severity: 'Medium' as Severity, status: 'Offen' as FindingStatus, cvssScore: '', cwe: '', recommendation: '' })
  const [evidenceForm, setEvidenceForm] = useState({ type: 'Screenshot' as EvidenceType, title: '', content: '' })
  const [retestForm, setRetestForm] = useState({ result: 'Offen' as RetestResult, tester: 'Daniel Schuh', notes: '' })
  const selectedFinding = findings.find((finding) => finding.id === selectedFindingId) ?? findings[0]
  const writable = canWrite(user.role)
  return <><PageHeader eyebrow="Findings" title="Schwachstellen mandantenbezogen dokumentieren" /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Findings Ledger</h2><span>{findings.length} Einträge</span></div><div className="select-list">{findings.map((finding) => <button key={finding.id} className={`select-list__item ${selectedFinding?.id === finding.id ? 'is-selected' : ''}`} onClick={() => setSelectedFindingId(finding.id)}><strong>{finding.id} · {finding.title}</strong><span>{customers.find((customer) => customer.id === finding.customerId)?.name}</span><small>{finding.severity} · {finding.status}</small></button>)}</div></article><article className="panel"><div className="panel__header"><h2>Finding-Detail</h2><span>{selectedFinding?.id ?? '—'}</span></div>{selectedFinding ? <div className="detail-stack"><div className="detail-card"><strong>Mandant</strong><small>{customers.find((customer) => customer.id === selectedFinding.customerId)?.name}</small></div><div className="detail-card"><strong>CVSS / CWE</strong><small>{selectedFinding.cvssScore} · {selectedFinding.cwe}</small></div><div className="detail-card"><strong>Empfehlung</strong><small>{selectedFinding.recommendation}</small></div>{writable ? <label><span>Status aktualisieren</span><select value={selectedFinding.status} onChange={(event) => void onStatusChange(selectedFinding.id, event.target.value as FindingStatus)}><option>Offen</option><option>Bestätigt</option><option>In Bearbeitung</option><option>Behoben</option></select></label> : null}</div> : null}</article></section>{writable ? <section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Neues Finding</h2><span>für beschreibbare Mandanten</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); await onAddFinding({ id: `VL-${new Date().getFullYear()}-${String(findings.length + 1).padStart(4, '0')}`, ...form }); setForm({ customerId: customers[0]?.id ?? '', assessmentId: assessments[0]?.id ?? '', title: '', target: '', severity: 'Medium', status: 'Offen', cvssScore: '', cwe: '', recommendation: '' }) }}><label><span>Mandant</span><select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label><span>Assessment</span><select value={form.assessmentId} onChange={(event) => setForm({ ...form, assessmentId: event.target.value })}>{assessments.filter((assessment) => assessment.customerId === form.customerId).map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}</select></label><label><span>Titel</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label><span>Target</span><input value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} required /></label><label><span>Severity</span><select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as Severity })}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label><label><span>CVSS</span><input value={form.cvssScore} onChange={(event) => setForm({ ...form, cvssScore: event.target.value })} /></label><label><span>CWE</span><input value={form.cwe} onChange={(event) => setForm({ ...form, cwe: event.target.value })} /></label><label className="form-grid__full"><span>Empfehlung</span><textarea value={form.recommendation} onChange={(event) => setForm({ ...form, recommendation: event.target.value })} rows={4} required /></label><div className="form-grid__full form-actions"><button type="submit">Finding speichern</button></div></form></article><article className="panel"><div className="panel__header"><h2>Evidence & Retests</h2><span>{selectedFinding ? selectedFinding.id : 'kein Finding'}</span></div>{selectedFinding ? <><div className="list">{evidence.filter((entry) => entry.findingId === selectedFinding.id).map((entry) => <div className="list__item" key={entry.id}><strong>{entry.title}</strong><span>{entry.type}</span><small>{entry.content}</small></div>)}</div><form className="form-grid top-gap" onSubmit={async (event) => { event.preventDefault(); await onAddEvidence({ id: `e${Date.now()}`, customerId: selectedFinding.customerId, assessmentId: selectedFinding.assessmentId, findingId: selectedFinding.id, ...evidenceForm }); setEvidenceForm({ type: 'Screenshot', title: '', content: '' }) }}><label><span>Evidence-Typ</span><select value={evidenceForm.type} onChange={(event) => setEvidenceForm({ ...evidenceForm, type: event.target.value as EvidenceType })}><option>Screenshot</option><option>Request</option><option>Response</option><option>Terminal</option><option>Datei</option><option>Notiz</option></select></label><label><span>Titel</span><input value={evidenceForm.title} onChange={(event) => setEvidenceForm({ ...evidenceForm, title: event.target.value })} required /></label><label className="form-grid__full"><span>Inhalt</span><textarea value={evidenceForm.content} onChange={(event) => setEvidenceForm({ ...evidenceForm, content: event.target.value })} rows={3} required /></label><div className="form-grid__full form-actions"><button type="submit">Evidence speichern</button></div></form><form className="form-grid top-gap" onSubmit={async (event) => { event.preventDefault(); await onAddRetest({ id: `rt${Date.now()}`, customerId: selectedFinding.customerId, assessmentId: selectedFinding.assessmentId, findingId: selectedFinding.id, ...retestForm }); setRetestForm({ result: 'Offen', tester: 'Daniel Schuh', notes: '' }) }}><label><span>Retest-Ergebnis</span><select value={retestForm.result} onChange={(event) => setRetestForm({ ...retestForm, result: event.target.value as RetestResult })}><option>Offen</option><option>Teilweise behoben</option><option>Behoben</option><option>Nicht reproduzierbar</option></select></label><label><span>Tester</span><input value={retestForm.tester} onChange={(event) => setRetestForm({ ...retestForm, tester: event.target.value })} /></label><label className="form-grid__full"><span>Notizen</span><textarea value={retestForm.notes} onChange={(event) => setRetestForm({ ...retestForm, notes: event.target.value })} rows={3} required /></label><div className="form-grid__full form-actions"><button type="submit">Retest speichern</button></div></form></> : <small>Bitte zuerst ein Finding auswählen.</small>}</article></section> : null}</>
}

function ReportsPage({ user, reports, groups, customers, assessments, findings, evidence, retests, tenantNameById, groupNameById, onAddReport, onStatusChange }: { user: SessionUser; reports: Report[]; groups: Group[]; customers: Customer[]; assessments: Assessment[]; findings: Finding[]; evidence: Evidence[]; retests: Retest[]; tenantNameById: Record<string, string>; groupNameById: Record<string, string>; onAddReport: (report: Report) => Promise<void>; onStatusChange: (reportId: string, status: ReportStatus) => Promise<void> }) {
  const [form, setForm] = useState({ scopeType: 'tenant' as ReportScope, customerId: customers[0]?.id ?? '', groupId: groups[0]?.id ?? '', assessmentId: assessments[0]?.id ?? '', title: '', status: 'Draft' as ReportStatus, summary: '' })
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.id ?? '')
  const reportWritable = true
  const selectedGroup = groups.find((group) => group.id === form.groupId)
  const selectedGroupTenantIds = Array.isArray(selectedGroup?.tenantIds) ? selectedGroup.tenantIds : []
  const contextualFindings = (form.scopeType === 'group'
    ? findings.filter((finding) => selectedGroupTenantIds.includes(finding.customerId))
    : findings.filter((finding) => finding.customerId === form.customerId)
  ).slice(0, 8)
  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null

  const openSelectedReport = () => {
    if (!selectedReport) return
    const scopedFindings = selectedReport.scopeType === 'group'
      ? findings.filter((finding) => selectedGroupTenantIds.includes(finding.customerId) || groups.find((group) => group.id === selectedReport.groupId)?.tenantIds.includes(finding.customerId))
      : findings.filter((finding) => finding.customerId === selectedReport.customerId)
    const scopedAssessment = assessments.find((assessment) => assessment.id === selectedReport.assessmentId) ?? null
    openReportExport({
      report: selectedReport,
      scopeLabel: selectedReport.scopeType === 'group' ? (groupNameById[selectedReport.groupId || ''] || 'Konzern') : (tenantNameById[selectedReport.customerId || ''] || 'Mandant'),
      generatedAt: new Date().toISOString(),
      customer: customers.find((customer) => customer.id === selectedReport.customerId) ?? null,
      group: groups.find((group) => group.id === selectedReport.groupId) ?? null,
      assessment: scopedAssessment,
      findings: scopedFindings,
      evidence: evidence.filter((entry) => scopedFindings.some((finding) => finding.id === entry.findingId)),
      retests: retests.filter((entry) => scopedFindings.some((finding) => finding.id === entry.findingId)),
      tenantNameById,
      groupNameById,
    })
  }

  return <><PageHeader eyebrow="Reports" title="Mandanten- und Konzernreports erstellen" /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Report-Liste</h2><span>{reports.length} Reports</span></div><div className="list">{reports.map((report) => <button type="button" className={`select-list__item ${selectedReport?.id === report.id ? 'is-selected' : ''}`} key={report.id} onClick={() => setSelectedReportId(report.id)}><strong>{report.title}</strong><span>{report.scopeType === 'group' ? (groupNameById[report.groupId || ''] || 'Konzern') : (tenantNameById[report.customerId || ''] || 'Mandant')}</span><small>{report.status}</small>{user.role !== 'user' ? <select value={report.status} onChange={(event) => void onStatusChange(report.id, event.target.value as ReportStatus)} onClick={(event) => event.stopPropagation()}><option>Draft</option><option>Internes Review</option><option>Freigegeben</option><option>Exportiert</option></select> : null}</button>)}</div><div className="form-actions top-gap"><button type="button" onClick={openSelectedReport} disabled={!selectedReport}>Report in neuem Fenster öffnen</button></div></article><article className="panel"><div className="panel__header"><h2>Report-Kontext</h2><span>{form.scopeType === 'group' ? 'Konzernweit' : 'Mandantenbezogen'}</span></div><div className="list">{contextualFindings.map((finding) => <div className="list__item" key={finding.id}><strong>{finding.id}</strong><span>{finding.title}</span><small>{finding.severity} · {tenantNameById[finding.customerId]}</small></div>)}</div></article></section>{reportWritable ? <section className="panel-grid"><article className="panel"><div className="panel__header"><h2>Neuen Report anlegen</h2><span>auch für Konzernstruktur</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); await onAddReport({ id: `r${Date.now()}`, scopeType: form.scopeType, customerId: form.scopeType === 'tenant' ? form.customerId : undefined, groupId: form.scopeType === 'group' ? form.groupId : undefined, assessmentId: form.scopeType === 'tenant' ? form.assessmentId : undefined, title: form.title, status: form.status, summary: form.summary }); setForm({ scopeType: 'tenant', customerId: customers[0]?.id ?? '', groupId: groups[0]?.id ?? '', assessmentId: assessments[0]?.id ?? '', title: '', status: 'Draft', summary: '' }) }}><label><span>Report-Typ</span><select value={form.scopeType} onChange={(event) => setForm({ ...form, scopeType: event.target.value as ReportScope })}><option value="tenant">Mandantenreport</option><option value="group">Konzernreport</option></select></label>{form.scopeType === 'tenant' ? <><label><span>Mandant</span><select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label><span>Assessment</span><select value={form.assessmentId} onChange={(event) => setForm({ ...form, assessmentId: event.target.value })}>{assessments.filter((assessment) => assessment.customerId === form.customerId).map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}</select></label></> : <label><span>Konzern</span><select value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}<label><span>Titel</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ReportStatus })}><option>Draft</option><option>Internes Review</option><option>Freigegeben</option><option>Exportiert</option></select></label><label className="form-grid__full"><span>Executive Summary</span><textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={4} required /></label><div className="form-grid__full form-actions"><button type="submit">Report speichern</button></div></form></article></section> : null}</>
}

function AdminPage({ customers, users, dbBackend, backupConfig, backups, onRefresh, onUserCreated, onDbBackendChanged, onBackupConfigChanged, onBackupsChanged }: { customers: Customer[]; users: AdminUser[]; dbBackend: DbBackend; backupConfig: BackupConfig | null; backups: BackupRecord[]; onRefresh: () => Promise<void>; onUserCreated: (row: AdminUser) => void; onDbBackendChanged: (backend: DbBackend) => void; onBackupConfigChanged: (cfg: BackupConfig | null) => void; onBackupsChanged: (rows: BackupRecord[]) => void }) {
  const initialBackup = backupConfig ?? { enabled: false, encrypt: false, passwordHint: '', retention: { hourly: 24, daily: 7, weekly: 4, monthly: 12, yearly: 2 }, backupDir: '', nextRunAt: null, lastRunAt: null, lastSuccessAt: null, lastErrorAt: null, lastErrorMessage: '', schedulerActive: false, schedulerRuntimePasswordConfigured: false }
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'user' as UserRole, tenantIds: [] as string[] })
  const [backupForm] = useState({ enabled: initialBackup.enabled, encrypt: initialBackup.encrypt, passwordHint: initialBackup.passwordHint, hourly: initialBackup.retention.hourly, daily: initialBackup.retention.daily, weekly: initialBackup.retention.weekly, monthly: initialBackup.retention.monthly, yearly: initialBackup.retention.yearly })
  return <><PageHeader eyebrow="Administration" title="System" meta={`Version ${APP_VERSION}`} /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Benutzer & Mandantenzuordnung</h2><span>{users.length} Accounts</span></div><div className="list">{users.map((entry) => <div className="list__item" key={entry.id}><strong>{entry.username}</strong><span>{entry.role}</span><small>{entry.tenantIds.map((tenantId) => customers.find((customer) => customer.id === tenantId)?.name || tenantId).join(', ') || 'Keine Mandanten'}</small></div>)}</div><form className="form-grid top-gap" onSubmit={async (event) => { event.preventDefault(); const created = await api<AdminUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(userForm) }); onUserCreated(created); setUserForm({ username: '', password: '', role: 'user', tenantIds: [] }) }}><label><span>Benutzername</span><input value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} required /></label><label><span>Passwort</span><input type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} required /></label><label><span>Rolle</span><select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as UserRole })}><option value="admin">admin</option><option value="verwalter">verwalter</option><option value="techniker">techniker</option><option value="user">user</option></select></label><label className="form-grid__full"><span>Mandanten</span><select multiple value={userForm.tenantIds} onChange={(event) => setUserForm({ ...userForm, tenantIds: Array.from(event.target.selectedOptions).map((option) => option.value) })}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><div className="form-grid__full form-actions"><button type="submit">Benutzer anlegen</button></div></form></article><article className="panel panel--license" id="license"><div className="panel__header"><h2>Datenbank, Backup & Lizenz</h2><span>{dbBackend}</span></div><div className="detail-stack"><div className="detail-card"><strong>Aktives Backend</strong><small>{dbBackend}</small></div><div className="detail-card"><strong>Backup-Ziel</strong><small>{backupConfig?.backupDir || '—'}</small></div><div className="detail-card"><strong>Scheduler</strong><small>{backupConfig?.schedulerActive ? 'aktiv' : 'inaktiv'}</small></div></div><div className="form-actions top-gap"><button onClick={async () => { const next = dbBackend === 'lowdb' ? 'sqlite' : 'lowdb'; const result = await api<{ dbBackend: DbBackend }>('/api/admin/db-config', { method: 'POST', body: JSON.stringify({ dbBackend: next }) }); onDbBackendChanged(result.dbBackend); await onRefresh() }}>Auf {dbBackend === 'lowdb' ? 'sqlite' : 'lowdb'} umstellen</button><button className="secondary-button" onClick={async () => { const saved = await api<BackupConfig>('/api/admin/backups/config', { method: 'POST', body: JSON.stringify({ enabled: backupForm.enabled, encrypt: backupForm.encrypt, passwordHint: backupForm.passwordHint, retention: { hourly: backupForm.hourly, daily: backupForm.daily, weekly: backupForm.weekly, monthly: backupForm.monthly, yearly: backupForm.yearly } }) }); onBackupConfigChanged(saved) }}>Backup-Konfiguration speichern</button><button className="secondary-button" onClick={async () => { await api('/api/admin/backups/run', { method: 'POST', body: JSON.stringify({}) }); onBackupsChanged(await api<BackupRecord[]>('/api/admin/backups')); await onRefresh() }}>Backup jetzt ausführen</button></div><pre className="license-text top-gap">{licenseText}</pre></article></section><section className="panel-grid"><article className="panel"><div className="panel__header"><h2>Backups</h2><span>{backups.length} Dateien</span></div><div className="table-wrap"><table><thead><tr><th>Datei</th><th>Slot</th><th>Backend</th><th>Verschlüsselt</th></tr></thead><tbody>{backups.map((backup) => <tr key={backup.fileName}><td>{backup.fileName}</td><td>{backup.slot}</td><td>{backup.backend ?? '—'}</td><td>{backup.encrypted ? 'ja' : 'nein'}</td></tr>)}</tbody></table></div></article></section></>
}

function FindingsTable({ rows }: { rows: Finding[] }) {
  return <div className="table-wrap"><table><thead><tr><th>ID</th><th>Titel</th><th>Target</th><th>Severity</th><th>Status</th></tr></thead><tbody>{rows.map((finding) => <tr key={finding.id}><td>{finding.id}</td><td>{finding.title}</td><td>{finding.target}</td><td><span className={`badge badge--${finding.severity.toLowerCase()}`}>{finding.severity}</span></td><td>{finding.status}</td></tr>)}</tbody></table></div>
}

export default App
