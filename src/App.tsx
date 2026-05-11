import { useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'

type UserRole = 'admin' | 'user'
type AssessmentStatus = 'Geplant' | 'Aktiv' | 'Review' | 'Abgeschlossen'
type FindingStatus = 'Offen' | 'Bestätigt' | 'In Bearbeitung' | 'Behoben'
type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
type ReportStatus = 'Draft' | 'Internes Review' | 'Freigegeben' | 'Exportiert'
type EvidenceType = 'Screenshot' | 'Request' | 'Response' | 'Terminal' | 'Datei' | 'Notiz'
type RetestResult = 'Offen' | 'Teilweise behoben' | 'Behoben' | 'Nicht reproduzierbar'
type DbBackend = 'lowdb' | 'sqlite'

type SessionUser = { id: string; username: string; role: UserRole }
type LicenseInfo = { status: 'active' | 'inactive' | 'trial'; plan: string; key: string; seats: number; customer: string; validUntil: string; issuedAt: string; notes: string }
type Customer = { id: string; name: string; sector: string; contactName: string; contactEmail: string; contactPhone: string; notes: string; createdAt?: string }
type Assessment = { id: string; title: string; customerId: string; type: string; mode: string; status: AssessmentStatus; scope: string; leadTester: string; rulesOfEngagement: string; createdAt?: string }
type Finding = { id: string; assessmentId: string; title: string; target: string; severity: Severity; status: FindingStatus; cvssScore: string; cwe: string; recommendation: string; createdAt?: string }
type Report = { id: string; assessmentId: string; title: string; status: ReportStatus; summary: string; createdAt?: string }
type Evidence = { id: string; findingId: string; assessmentId: string; type: EvidenceType; title: string; content: string; fileName?: string; filePath?: string; contentType?: string; createdAt?: string }
type Retest = { id: string; findingId: string; assessmentId: string; result: RetestResult; tester: string; notes: string; createdAt?: string }
type AdminUser = { id: string; username: string; role: UserRole; createdAt: string }
type BackupConfig = { backupDir: string; retention: { hourly: number; daily: number; weekly: number; monthly: number; yearly: number }; encrypt: boolean; passwordHint: string; enabled: boolean; updatedAt: string; nextRunAt: string | null; lastRunAt: string | null; lastSuccessAt: string | null; lastErrorAt: string | null; lastErrorMessage: string; schedulerActive: boolean; schedulerRuntimePasswordConfigured: boolean }
type BackupRecord = { fileName: string; createdAt: string; size: number; encrypted: boolean; slot: string; label: string; backend: DbBackend | null; backendMismatch: boolean }

const navItems = [
  { to: '/dashboard', label: 'Dashboard', hint: 'Überblick' },
  { to: '/kunden', label: 'Kunden', hint: 'Mandanten & Kontakte' },
  { to: '/assessments', label: 'Assessments', hint: 'Scopes & Projekte' },
  { to: '/findings', label: 'Findings', hint: 'Schwachstellen, Evidence, Retests' },
  { to: '/reports', label: 'Reports', hint: 'Berichte & Review' },
  { to: '/admin', label: 'Admin', hint: 'User, DB, Lizenz, Backup' },
]

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const data = await response.json() as { message?: string }
      if (data?.message) message = data.message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'message' in error) return (error as { message?: string }).message || fallback
  return fallback
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [license, setLicense] = useState<LicenseInfo | null>(null)
  const [dbBackend, setDbBackend] = useState<DbBackend>('lowdb')
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

  const loadDomainData = async () => {
    const [customerRows, assessmentRows, findingRows, reportRows, evidenceRows, retestRows] = await Promise.all([
      api<Customer[]>('/api/customers'),
      api<Assessment[]>('/api/assessments'),
      api<Finding[]>('/api/findings'),
      api<Report[]>('/api/reports'),
      api<Evidence[]>('/api/evidence'),
      api<Retest[]>('/api/retests'),
    ])
    setCustomers(customerRows)
    setAssessments(assessmentRows)
    setFindings(findingRows)
    setReports(reportRows)
    setEvidence(evidenceRows)
    setRetests(retestRows)
  }

  const loadAdminData = async () => {
    const [users, db, backupCfg, backupRows, licenseInfo] = await Promise.all([
      api<AdminUser[]>('/api/admin/users'),
      api<{ dbBackend: DbBackend }>('/api/admin/db-config'),
      api<BackupConfig>('/api/admin/backups/config'),
      api<BackupRecord[]>('/api/admin/backups'),
      api<LicenseInfo>('/api/admin/license'),
    ])
    setAdminUsers(users)
    setDbBackend(db.dbBackend)
    setBackupConfig(backupCfg)
    setBackups(backupRows)
    setLicense(licenseInfo)
  }

  const loadSession = async () => {
    try {
      const session = await api<{ user: SessionUser; backend: DbBackend; license: LicenseInfo }>('/api/auth/me')
      setUser(session.user)
      setDbBackend(session.backend)
      setLicense(session.license)
      await Promise.all([loadDomainData(), session.user.role === 'admin' ? loadAdminData() : Promise.resolve()])
      setError('')
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useState(() => { void loadSession(); return null })

  const stats = useMemo(() => {
    const activeAssessmentCount = assessments.filter((item) => item.status === 'Aktiv').length
    const criticalFindingCount = findings.filter((item) => item.severity === 'Critical').length
    const highFindingCount = findings.filter((item) => item.severity === 'High').length
    const openRetests = retests.filter((item) => item.result === 'Offen' || item.result === 'Teilweise behoben').length
    return [
      { label: 'Aktive Assessments', value: String(activeAssessmentCount), tone: 'neutral' },
      { label: 'Kritische Findings', value: String(criticalFindingCount), tone: 'critical' },
      { label: 'High Findings', value: String(highFindingCount), tone: 'high' },
      { label: 'Offene Retests', value: String(openRetests), tone: 'medium' },
    ]
  }, [assessments, findings, retests])

  async function handleLogin(username: string, password: string) {
    setError('')
    setLoading(true)
    try {
      const session = await api<{ user: SessionUser; backend: DbBackend; license: LicenseInfo }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      setUser(session.user)
      setDbBackend(session.backend)
      setLicense(session.license)
      await Promise.all([loadDomainData(), session.user.role === 'admin' ? loadAdminData() : Promise.resolve()])
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

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><img src="/vulnledger-logo.png" alt="VulnLedger" className="brand__logo" /><div><strong>VulnLedger</strong><span>Pentest Documentation</span></div></div>
        <nav className="nav">{navItems.filter((item) => item.to !== '/admin' || user.role === 'admin').map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`}><span>{item.label}</span><small>{item.hint}</small></NavLink>)}</nav>
        <div className="sidebar__card"><div className="sidebar__card-title">Session</div><ul><li>{user.username}</li><li>Rolle: {user.role}</li><li>DB: {dbBackend}</li><li>Lizenz: {license?.status ?? '—'}</li></ul><button className="secondary-button top-gap" onClick={() => void handleLogout()}>Logout</button></div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage customers={customers} assessments={assessments} findings={findings} reports={reports} evidence={evidence} retests={retests} stats={stats} license={license} />} />
          <Route path="/kunden" element={<CustomersPage customers={customers} assessments={assessments} onAddCustomer={async (customer) => { const created = await api<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(customer) }); setCustomers((current) => [created, ...current]) }} />} />
          <Route path="/assessments" element={<AssessmentsPage customers={customers} assessments={assessments} onAddAssessment={async (assessment) => { const created = await api<Assessment>('/api/assessments', { method: 'POST', body: JSON.stringify(assessment) }); setAssessments((current) => [created, ...current]) }} onStatusChange={async (assessmentId, status) => { const updated = await api<Assessment>(`/api/assessments/${assessmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setAssessments((current) => current.map((item) => item.id === assessmentId ? updated : item)) }} />} />
          <Route path="/findings" element={<FindingsPage assessments={assessments} findings={findings} evidence={evidence} retests={retests} onAddFinding={async (finding) => { const created = await api<Finding>('/api/findings', { method: 'POST', body: JSON.stringify(finding) }); setFindings((current) => [created, ...current]) }} onStatusChange={async (findingId, status) => { const updated = await api<Finding>(`/api/findings/${findingId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setFindings((current) => current.map((item) => item.id === findingId ? updated : item)) }} onAddEvidence={async (entry) => { if (entry.createdAt) { setEvidence((current) => [entry, ...current]); return } const created = await api<Evidence>('/api/evidence', { method: 'POST', body: JSON.stringify(entry) }); setEvidence((current) => [created, ...current]) }} onAddRetest={async (entry) => { const created = await api<Retest>('/api/retests', { method: 'POST', body: JSON.stringify(entry) }); setRetests((current) => [created, ...current]) }} />} />
          <Route path="/reports" element={<ReportsPage reports={reports} assessments={assessments} findings={findings} onAddReport={async (report) => { const created = await api<Report>('/api/reports', { method: 'POST', body: JSON.stringify(report) }); setReports((current) => [created, ...current]) }} onStatusChange={async (reportId, status) => { const updated = await api<Report>(`/api/reports/${reportId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setReports((current) => current.map((item) => item.id === reportId ? updated : item)) }} />} />
          {user.role === 'admin' ? <Route path="/admin" element={<AdminPage users={adminUsers} dbBackend={dbBackend} backupConfig={backupConfig} backups={backups} license={license} onRefresh={loadAdminData} onUserCreated={(row) => setAdminUsers((current) => [row, ...current])} onDbBackendChanged={setDbBackend} onBackupConfigChanged={setBackupConfig} onBackupsChanged={setBackups} onLicenseChanged={setLicense} />} /> : null}
        </Routes>
      </main>
    </div>
  )
}

function LoginPage({ error, onLogin }: { error: string; onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123!')
  const [submitting, setSubmitting] = useState(false)
  return <div className="auth-shell"><form className="auth-card" onSubmit={async (event) => { event.preventDefault(); setSubmitting(true); try { await onLogin(username, password) } finally { setSubmitting(false) } }}><img src="/vulnledger-logo.png" alt="VulnLedger" className="auth-logo" /><h1>VulnLedger Login</h1><p>Session-basierter Zugriff mit Rollenmodell und lokaler Lizenzprüfung.</p><label><span>Benutzername</span><input value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label><span>Passwort</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error ? <div className="error-box">{error}</div> : null}<button type="submit" disabled={submitting}>{submitting ? 'Anmeldung läuft…' : 'Anmelden'}</button></form></div>
}

function PageHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return <header className="topbar"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{meta ? <p className="topbar__meta">{meta}</p> : null}</div></header>
}

function DashboardPage({ customers, assessments, findings, reports, evidence, retests, stats, license }: { customers: Customer[]; assessments: Assessment[]; findings: Finding[]; reports: Report[]; evidence: Evidence[]; retests: Retest[]; stats: Array<{ label: string; value: string; tone?: string }>; license: LicenseInfo | null }) {
  return <><PageHeader eyebrow="Dashboard" title="Operativer Überblick für laufende Assessments" meta={license ? `${license.plan} · gültig bis ${new Date(license.validUntil).toLocaleDateString('de-DE')}` : undefined} /><section className="stats-grid">{stats.map((stat) => <article key={stat.label} className={`stat stat--${stat.tone ?? 'neutral'}`}><span>{stat.label}</span><strong>{stat.value}</strong></article>)}</section><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Priorisierte Findings</h2><span>Top-Risiken</span></div><FindingsTable rows={findings.slice(0, 5)} /></article><article className="panel"><div className="panel__header"><h2>Workflow-Stand</h2><span>Live</span></div><div className="list"><div className="list__item"><strong>{reports.length} Reports</strong><small>Berichtspfad jetzt serverseitig angebunden</small></div><div className="list__item"><strong>{evidence.length} Evidence-Einträge</strong><small>Nachweise pro Finding persistent</small></div><div className="list__item"><strong>{retests.length} Retests</strong><small>Behebungsstände werden serverseitig mitgeführt</small></div></div></article></section><section className="panel-grid"><article className="panel"><div className="panel__header"><h2>Kunden im Fokus</h2><span>{customers.length} Kunden</span></div><div className="list">{customers.map((customer) => <div className="list__item" key={customer.id}><strong>{customer.name}</strong><span>{customer.sector}</span><small>{customer.contactEmail}</small></div>)}</div></article><article className="panel"><div className="panel__header"><h2>Assessment-Pipeline</h2><span>{assessments.length} Projekte</span></div><div className="list">{assessments.map((assessment) => <div className="list__item" key={assessment.id}><strong>{assessment.title}</strong><span>{assessment.type} · {assessment.mode}</span><small>{assessment.status}</small></div>)}</div></article></section></>
}

function CustomersPage({ customers, assessments, onAddCustomer }: { customers: Customer[]; assessments: Assessment[]; onAddCustomer: (customer: Customer) => Promise<void> }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? '')
  const [form, setForm] = useState({ name: '', sector: '', contactName: '', contactEmail: '', contactPhone: '', notes: '' })
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0]
  const linkedAssessments = assessments.filter((assessment) => assessment.customerId === selectedCustomer?.id)
  return <><PageHeader eyebrow="Kunden" title="Mandanten verwalten und Projektkontext pflegen" /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Kundenliste</h2><span>{customers.length} Einträge</span></div><div className="select-list">{customers.map((customer) => <button key={customer.id} className={`select-list__item ${selectedCustomer?.id === customer.id ? 'is-selected' : ''}`} onClick={() => setSelectedCustomerId(customer.id)}><strong>{customer.name}</strong><span>{customer.sector}</span><small>{customer.contactEmail}</small></button>)}</div></article><article className="panel"><div className="panel__header"><h2>Kundendetail</h2><span>{selectedCustomer?.name ?? '—'}</span></div>{selectedCustomer ? <div className="detail-stack"><div className="detail-card"><strong>Ansprechpartner</strong><span>{selectedCustomer.contactName}</span><small>{selectedCustomer.contactEmail} · {selectedCustomer.contactPhone}</small></div><div className="detail-card"><strong>Notizen</strong><small>{selectedCustomer.notes}</small></div><div className="detail-card"><strong>Verknüpfte Assessments</strong>{linkedAssessments.length ? linkedAssessments.map((assessment) => <small key={assessment.id}>{assessment.title} · {assessment.status}</small>) : <small>Aktuell keine verknüpften Assessments.</small>}</div></div> : null}</article></section><section className="panel-grid"><article className="panel"><div className="panel__header"><h2>Neuen Kunden anlegen</h2><span>API-Workflow</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); const nextCustomer: Customer = { id: `c${Date.now()}`, ...form }; await onAddCustomer(nextCustomer); setSelectedCustomerId(nextCustomer.id); setForm({ name: '', sector: '', contactName: '', contactEmail: '', contactPhone: '', notes: '' }) }}><label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label><span>Branche</span><input value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} required /></label><label><span>Ansprechpartner</span><input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} required /></label><label><span>E-Mail</span><input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} required /></label><label><span>Telefon</span><input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} /></label><label className="form-grid__full"><span>Notizen</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} /></label><div className="form-grid__full form-actions"><button type="submit">Kunden speichern</button></div></form></article></section></>
}

function AssessmentsPage({ customers, assessments, onAddAssessment, onStatusChange }: { customers: Customer[]; assessments: Assessment[]; onAddAssessment: (assessment: Assessment) => Promise<void>; onStatusChange: (assessmentId: string, status: AssessmentStatus) => Promise<void> }) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(assessments[0]?.id ?? '')
  const [form, setForm] = useState({ title: '', customerId: customers[0]?.id ?? '', type: 'Web', mode: 'Greybox', status: 'Geplant' as AssessmentStatus, scope: '', leadTester: 'Daniel Schuh', rulesOfEngagement: '' })
  const selectedAssessment = assessments.find((assessment) => assessment.id === selectedAssessmentId) ?? assessments[0]
  const selectedCustomer = customers.find((customer) => customer.id === selectedAssessment?.customerId)
  return <><PageHeader eyebrow="Assessments" title="Assessments planen, scopen und steuern" /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Assessment-Liste</h2><span>{assessments.length} Projekte</span></div><div className="select-list">{assessments.map((assessment) => <button key={assessment.id} className={`select-list__item ${selectedAssessment?.id === assessment.id ? 'is-selected' : ''}`} onClick={() => setSelectedAssessmentId(assessment.id)}><strong>{assessment.title}</strong><span>{customers.find((customer) => customer.id === assessment.customerId)?.name}</span><small>{assessment.type} · {assessment.mode} · {assessment.status}</small></button>)}</div></article><article className="panel"><div className="panel__header"><h2>Assessment-Detail</h2><span>{selectedAssessment?.title ?? '—'}</span></div>{selectedAssessment ? <div className="detail-stack"><div className="detail-card"><strong>Kunde</strong><small>{selectedCustomer?.name}</small></div><div className="detail-card"><strong>Scope</strong><small>{selectedAssessment.scope}</small></div><div className="detail-card"><strong>Rules of Engagement</strong><small>{selectedAssessment.rulesOfEngagement}</small></div><label><span>Status aktualisieren</span><select value={selectedAssessment.status} onChange={(event) => void onStatusChange(selectedAssessment.id, event.target.value as AssessmentStatus)}><option>Geplant</option><option>Aktiv</option><option>Review</option><option>Abgeschlossen</option></select></label></div> : null}</article></section><section className="panel-grid"><article className="panel"><div className="panel__header"><h2>Neues Assessment anlegen</h2><span>API-Workflow</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); const nextAssessment: Assessment = { id: `a${Date.now()}`, ...form }; await onAddAssessment(nextAssessment); setSelectedAssessmentId(nextAssessment.id); setForm({ title: '', customerId: customers[0]?.id ?? '', type: 'Web', mode: 'Greybox', status: 'Geplant', scope: '', leadTester: 'Daniel Schuh', rulesOfEngagement: '' }) }}><label><span>Titel</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label><span>Kunde</span><select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label><span>Testart</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Web</option><option>API</option><option>Infrastruktur</option><option>Mobile</option></select></label><label><span>Ansatz</span><select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option>Blackbox</option><option>Greybox</option><option>Whitebox</option></select></label><label><span>Lead Tester</span><input value={form.leadTester} onChange={(event) => setForm({ ...form, leadTester: event.target.value })} /></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AssessmentStatus })}><option>Geplant</option><option>Aktiv</option><option>Review</option><option>Abgeschlossen</option></select></label><label className="form-grid__full"><span>Scope</span><textarea value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} rows={3} required /></label><label className="form-grid__full"><span>Rules of Engagement</span><textarea value={form.rulesOfEngagement} onChange={(event) => setForm({ ...form, rulesOfEngagement: event.target.value })} rows={4} required /></label><div className="form-grid__full form-actions"><button type="submit">Assessment speichern</button></div></form></article></section></>
}

function FindingsPage({ assessments, findings, evidence, retests, onAddFinding, onStatusChange, onAddEvidence, onAddRetest }: { assessments: Assessment[]; findings: Finding[]; evidence: Evidence[]; retests: Retest[]; onAddFinding: (finding: Finding) => Promise<void>; onStatusChange: (findingId: string, status: FindingStatus) => Promise<void>; onAddEvidence: (entry: Evidence) => Promise<void>; onAddRetest: (entry: Retest) => Promise<void> }) {
  const [selectedFindingId, setSelectedFindingId] = useState(findings[0]?.id ?? '')
  const [form, setForm] = useState({ assessmentId: assessments[0]?.id ?? '', title: '', target: '', severity: 'Medium' as Severity, status: 'Offen' as FindingStatus, cvssScore: '', cwe: '', recommendation: '' })
  const [evidenceForm, setEvidenceForm] = useState({ type: 'Screenshot' as EvidenceType, title: '', content: '' })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [retestForm, setRetestForm] = useState({ result: 'Offen' as RetestResult, tester: 'Daniel Schuh', notes: '' })
  const selectedFinding = findings.find((finding) => finding.id === selectedFindingId) ?? findings[0]
  const linkedAssessment = assessments.find((assessment) => assessment.id === selectedFinding?.assessmentId)
  const findingEvidence = evidence.filter((entry) => entry.findingId === selectedFinding?.id)
  const findingRetests = retests.filter((entry) => entry.findingId === selectedFinding?.id)
  return <><PageHeader eyebrow="Findings" title="Schwachstellen dokumentieren und nachverfolgen" /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Findings Ledger</h2><span>{findings.length} Einträge</span></div><div className="select-list">{findings.map((finding) => <button key={finding.id} className={`select-list__item ${selectedFinding?.id === finding.id ? 'is-selected' : ''}`} onClick={() => setSelectedFindingId(finding.id)}><strong>{finding.id} · {finding.title}</strong><span>{finding.target}</span><small>{finding.severity} · {finding.status}</small></button>)}</div></article><article className="panel"><div className="panel__header"><h2>Finding-Detail</h2><span>{selectedFinding?.id ?? '—'}</span></div>{selectedFinding ? <div className="detail-stack"><div className="detail-card"><strong>Assessment</strong><small>{linkedAssessment?.title}</small></div><div className="detail-card"><strong>CVSS / CWE</strong><small>{selectedFinding.cvssScore} · {selectedFinding.cwe}</small></div><div className="detail-card"><strong>Empfehlung</strong><small>{selectedFinding.recommendation}</small></div><label><span>Status aktualisieren</span><select value={selectedFinding.status} onChange={(event) => void onStatusChange(selectedFinding.id, event.target.value as FindingStatus)}><option>Offen</option><option>Bestätigt</option><option>In Bearbeitung</option><option>Behoben</option></select></label></div> : null}</article></section><section className="panel-grid"><article className="panel"><div className="panel__header"><h2>Neues Finding anlegen</h2><span>API-Workflow</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); const nextFinding: Finding = { id: `VL-${new Date().getFullYear()}-${String(findings.length + 1).padStart(4, '0')}`, ...form }; await onAddFinding(nextFinding); setSelectedFindingId(nextFinding.id); setForm({ assessmentId: assessments[0]?.id ?? '', title: '', target: '', severity: 'Medium', status: 'Offen', cvssScore: '', cwe: '', recommendation: '' }) }}><label><span>Assessment</span><select value={form.assessmentId} onChange={(event) => setForm({ ...form, assessmentId: event.target.value })}>{assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}</select></label><label><span>Titel</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label><span>Target</span><input value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} required /></label><label><span>Severity</span><select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as Severity })}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label><label><span>CVSS</span><input value={form.cvssScore} onChange={(event) => setForm({ ...form, cvssScore: event.target.value })} placeholder="z. B. 8.1" /></label><label><span>CWE</span><input value={form.cwe} onChange={(event) => setForm({ ...form, cwe: event.target.value })} placeholder="z. B. CWE-79" /></label><label className="form-grid__full"><span>Empfehlung</span><textarea value={form.recommendation} onChange={(event) => setForm({ ...form, recommendation: event.target.value })} rows={4} required /></label><div className="form-grid__full form-actions"><button type="submit">Finding speichern</button></div></form></article></section><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Evidence-Workflow</h2><span>{findingEvidence.length} Einträge</span></div><div className="list">{findingEvidence.length ? findingEvidence.map((entry) => <div className="list__item" key={entry.id}><strong>{entry.title}</strong><span>{entry.type}</span><small>{entry.content}</small>{entry.fileName && entry.filePath ? <a href={`/api/evidence/files/${entry.filePath.split('/').pop()}`} target="_blank" rel="noreferrer">{entry.fileName}</a> : null}</div>) : <div className="list__item"><small>Für dieses Finding existiert noch keine Evidence.</small></div>}</div><form className="form-grid top-gap" onSubmit={async (event) => { event.preventDefault(); if (!selectedFinding) return; await onAddEvidence({ id: `e${Date.now()}`, assessmentId: selectedFinding.assessmentId, findingId: selectedFinding.id, ...evidenceForm }); setEvidenceForm({ type: 'Screenshot', title: '', content: '' }) }}><label><span>Typ</span><select value={evidenceForm.type} onChange={(event) => setEvidenceForm({ ...evidenceForm, type: event.target.value as EvidenceType })}><option>Screenshot</option><option>Request</option><option>Response</option><option>Terminal</option><option>Datei</option><option>Notiz</option></select></label><label><span>Titel</span><input value={evidenceForm.title} onChange={(event) => setEvidenceForm({ ...evidenceForm, title: event.target.value })} required /></label><label className="form-grid__full"><span>Inhalt / Nachweis</span><textarea value={evidenceForm.content} onChange={(event) => setEvidenceForm({ ...evidenceForm, content: event.target.value })} rows={4} required /></label><label className="form-grid__full"><span>Datei-Upload (optional)</span><input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} /></label><div className="form-grid__full form-actions"><button type="submit">Evidence speichern</button><button type="button" className="secondary-button" onClick={async () => { if (!selectedFinding || !uploadFile) return; const url = `/api/evidence/upload?findingId=${encodeURIComponent(selectedFinding.id)}&assessmentId=${encodeURIComponent(selectedFinding.assessmentId)}&title=${encodeURIComponent(uploadFile.name)}&type=${encodeURIComponent('Datei')}&fileName=${encodeURIComponent(uploadFile.name)}`; const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': uploadFile.type || 'application/octet-stream' }, body: await uploadFile.arrayBuffer() }); if (!response.ok) throw new Error('Upload fehlgeschlagen'); const created = await response.json(); await onAddEvidence(created); setUploadFile(null) }}>Datei hochladen</button></div></form></article><article className="panel"><div className="panel__header"><h2>Retest-Workflow</h2><span>{findingRetests.length} Einträge</span></div><div className="list">{findingRetests.length ? findingRetests.map((entry) => <div className="list__item" key={entry.id}><strong>{entry.result}</strong><span>{entry.tester}</span><small>{entry.notes}</small></div>) : <div className="list__item"><small>Für dieses Finding gibt es noch keinen Retest.</small></div>}</div><form className="form-grid top-gap" onSubmit={async (event) => { event.preventDefault(); if (!selectedFinding) return; await onAddRetest({ id: `rt${Date.now()}`, assessmentId: selectedFinding.assessmentId, findingId: selectedFinding.id, ...retestForm }); setRetestForm({ result: 'Offen', tester: 'Daniel Schuh', notes: '' }) }}><label><span>Ergebnis</span><select value={retestForm.result} onChange={(event) => setRetestForm({ ...retestForm, result: event.target.value as RetestResult })}><option>Offen</option><option>Teilweise behoben</option><option>Behoben</option><option>Nicht reproduzierbar</option></select></label><label><span>Tester</span><input value={retestForm.tester} onChange={(event) => setRetestForm({ ...retestForm, tester: event.target.value })} /></label><label className="form-grid__full"><span>Retest-Notiz</span><textarea value={retestForm.notes} onChange={(event) => setRetestForm({ ...retestForm, notes: event.target.value })} rows={4} required /></label><div className="form-grid__full form-actions"><button type="submit">Retest speichern</button></div></form></article></section></>
}

function ReportsPage({ reports, assessments, findings, onAddReport, onStatusChange }: { reports: Report[]; assessments: Assessment[]; findings: Finding[]; onAddReport: (report: Report) => Promise<void>; onStatusChange: (reportId: string, status: ReportStatus) => Promise<void> }) {
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.id ?? '')
  const [form, setForm] = useState({ assessmentId: assessments[0]?.id ?? '', title: '', status: 'Draft' as ReportStatus, summary: '' })
  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0]
  const linkedAssessment = assessments.find((assessment) => assessment.id === selectedReport?.assessmentId)
  const reportFindings = findings.filter((finding) => finding.assessmentId === selectedReport?.assessmentId)
  return <><PageHeader eyebrow="Reports" title="Berichte vorbereiten und Freigabestatus steuern" /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Report-Liste</h2><span>{reports.length} Reports</span></div><div className="select-list">{reports.map((report) => <button key={report.id} className={`select-list__item ${selectedReport?.id === report.id ? 'is-selected' : ''}`} onClick={() => setSelectedReportId(report.id)}><strong>{report.title}</strong><span>{report.status}</span><small>{report.summary}</small></button>)}</div></article><article className="panel"><div className="panel__header"><h2>Report-Detail</h2><span>{selectedReport?.title ?? '—'}</span></div>{selectedReport ? <div className="detail-stack"><div className="detail-card"><strong>Assessment</strong><small>{linkedAssessment?.title}</small></div><div className="detail-card"><strong>Summary</strong><small>{selectedReport.summary}</small></div><div className="detail-card"><strong>Findings im Report-Kontext</strong>{reportFindings.length ? reportFindings.map((finding) => <small key={finding.id}>{finding.id} · {finding.title} · {finding.severity}</small>) : <small>Aktuell keine Findings verknüpft.</small>}</div><label><span>Status aktualisieren</span><select value={selectedReport.status} onChange={(event) => void onStatusChange(selectedReport.id, event.target.value as ReportStatus)}><option>Draft</option><option>Internes Review</option><option>Freigegeben</option><option>Exportiert</option></select></label></div> : null}</article></section><section className="panel-grid"><article className="panel"><div className="panel__header"><h2>Neuen Report anlegen</h2><span>API-Workflow</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); const nextReport: Report = { id: `r${Date.now()}`, ...form }; await onAddReport(nextReport); setSelectedReportId(nextReport.id); setForm({ assessmentId: assessments[0]?.id ?? '', title: '', status: 'Draft', summary: '' }) }}><label><span>Assessment</span><select value={form.assessmentId} onChange={(event) => setForm({ ...form, assessmentId: event.target.value })}>{assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}</select></label><label><span>Titel</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ReportStatus })}><option>Draft</option><option>Internes Review</option><option>Freigegeben</option><option>Exportiert</option></select></label><label className="form-grid__full"><span>Executive Summary / Kurzbeschreibung</span><textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={4} required /></label><div className="form-grid__full form-actions"><button type="submit">Report speichern</button></div></form></article></section></>
}

function AdminPage({ users, dbBackend, backupConfig, backups, license, onRefresh, onUserCreated, onDbBackendChanged, onBackupConfigChanged, onBackupsChanged, onLicenseChanged }: { users: AdminUser[]; dbBackend: DbBackend; backupConfig: BackupConfig | null; backups: BackupRecord[]; license: LicenseInfo | null; onRefresh: () => Promise<void>; onUserCreated: (row: AdminUser) => void; onDbBackendChanged: (backend: DbBackend) => void; onBackupConfigChanged: (cfg: BackupConfig | null) => void; onBackupsChanged: (rows: BackupRecord[]) => void; onLicenseChanged: (row: LicenseInfo | null) => void }) {
  const initialLicense = license ?? { status: 'trial', plan: 'Community Trial', key: 'VL-TRIAL-LOCAL', seats: 1, customer: 'Unlicensed Instance', validUntil: new Date().toISOString(), issuedAt: new Date().toISOString(), notes: '' }
  const initialBackup = backupConfig ?? { enabled: false, encrypt: false, passwordHint: '', retention: { hourly: 24, daily: 7, weekly: 4, monthly: 12, yearly: 2 }, backupDir: '', updatedAt: '', nextRunAt: null, lastRunAt: null, lastSuccessAt: null, lastErrorAt: null, lastErrorMessage: '', schedulerActive: false, schedulerRuntimePasswordConfigured: false }
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'user' as UserRole })
  const [licenseForm, setLicenseForm] = useState<LicenseInfo>(initialLicense)
  const [backupForm, setBackupForm] = useState({ enabled: initialBackup.enabled, encrypt: initialBackup.encrypt, passwordHint: initialBackup.passwordHint, hourly: initialBackup.retention.hourly, daily: initialBackup.retention.daily, weekly: initialBackup.retention.weekly, monthly: initialBackup.retention.monthly, yearly: initialBackup.retention.yearly })
  return <><PageHeader eyebrow="Admin" title="Benutzer, Lizenz, Datenbank und Backup verwalten" meta={`Aktives Backend: ${dbBackend}`} /><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Benutzer</h2><span>{users.length} Accounts</span></div><div className="list">{users.map((entry) => <div className="list__item" key={entry.id}><strong>{entry.username}</strong><span>{entry.role}</span><small>{new Date(entry.createdAt).toLocaleString('de-DE')}</small></div>)}</div><form className="form-grid top-gap" onSubmit={async (event) => { event.preventDefault(); const created = await api<AdminUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(userForm) }); onUserCreated(created); setUserForm({ username: '', password: '', role: 'user' }) }}><label><span>Benutzername</span><input value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} required /></label><label><span>Passwort</span><input type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} required /></label><label><span>Rolle</span><select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as UserRole })}><option value="user">user</option><option value="admin">admin</option></select></label><div className="form-grid__full form-actions"><button type="submit">Benutzer anlegen</button></div></form></article><article className="panel"><div className="panel__header"><h2>Datenbank-Backend</h2><span>{dbBackend}</span></div><div className="detail-stack"><div className="detail-card"><strong>Aktueller Modus</strong><small>{dbBackend}</small></div><div className="detail-card"><strong>Hinweis</strong><small>lowdb ist aktuell der fachlich vollständige Standard. SQLite ist für die User-Basis vorbereitet.</small></div></div><div className="form-actions top-gap"><button onClick={async () => { const next = dbBackend === 'lowdb' ? 'sqlite' : 'lowdb'; const result = await api<{ dbBackend: DbBackend }>('/api/admin/db-config', { method: 'POST', body: JSON.stringify({ dbBackend: next }) }); onDbBackendChanged(result.dbBackend); await onRefresh() }}>Auf {dbBackend === 'lowdb' ? 'sqlite' : 'lowdb'} umstellen</button></div></article></section><section className="panel-grid panel-grid--wide"><article className="panel"><div className="panel__header"><h2>Lizenzierung</h2><span>{licenseForm.status}</span></div><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); const saved = await api<LicenseInfo>('/api/admin/license', { method: 'POST', body: JSON.stringify(licenseForm) }); onLicenseChanged(saved); setLicenseForm(saved) }}><label><span>Status</span><select value={licenseForm.status} onChange={(event) => setLicenseForm({ ...licenseForm, status: event.target.value as LicenseInfo['status'] })}><option value="trial">trial</option><option value="active">active</option><option value="inactive">inactive</option></select></label><label><span>Plan</span><input value={licenseForm.plan} onChange={(event) => setLicenseForm({ ...licenseForm, plan: event.target.value })} required /></label><label><span>Lizenzschlüssel</span><input value={licenseForm.key} onChange={(event) => setLicenseForm({ ...licenseForm, key: event.target.value })} required /></label><label><span>Seats</span><input type="number" value={licenseForm.seats} onChange={(event) => setLicenseForm({ ...licenseForm, seats: Number(event.target.value) })} min={1} required /></label><label><span>Kunde</span><input value={licenseForm.customer} onChange={(event) => setLicenseForm({ ...licenseForm, customer: event.target.value })} required /></label><label><span>Gültig bis</span><input value={licenseForm.validUntil} onChange={(event) => setLicenseForm({ ...licenseForm, validUntil: event.target.value })} required /></label><label className="form-grid__full"><span>Notizen</span><textarea value={licenseForm.notes} onChange={(event) => setLicenseForm({ ...licenseForm, notes: event.target.value })} rows={4} /></label><div className="form-grid__full form-actions"><button type="submit">Lizenz speichern</button></div></form></article><article className="panel"><div className="panel__header"><h2>Backup-Konfiguration</h2><span>{backupConfig?.schedulerActive ? 'Scheduler aktiv' : 'Scheduler inaktiv'}</span></div>{backupConfig ? <><div className="detail-stack"><div className="detail-card"><strong>Verzeichnis</strong><small>{backupConfig.backupDir}</small></div><div className="detail-card"><strong>Nächster Lauf</strong><small>{backupConfig.nextRunAt ? new Date(backupConfig.nextRunAt).toLocaleString('de-DE') : '—'}</small></div><div className="detail-card"><strong>Letzter Erfolg</strong><small>{backupConfig.lastSuccessAt ? new Date(backupConfig.lastSuccessAt).toLocaleString('de-DE') : '—'}</small></div></div><form className="form-grid top-gap" onSubmit={async (event) => { event.preventDefault(); const saved = await api<BackupConfig>('/api/admin/backups/config', { method: 'POST', body: JSON.stringify({ enabled: backupForm.enabled, encrypt: backupForm.encrypt, passwordHint: backupForm.passwordHint, retention: { hourly: backupForm.hourly, daily: backupForm.daily, weekly: backupForm.weekly, monthly: backupForm.monthly, yearly: backupForm.yearly } }) }); onBackupConfigChanged(saved); setBackupForm({ enabled: saved.enabled, encrypt: saved.encrypt, passwordHint: saved.passwordHint, hourly: saved.retention.hourly, daily: saved.retention.daily, weekly: saved.retention.weekly, monthly: saved.retention.monthly, yearly: saved.retention.yearly }) }}><label><span>Scheduler</span><select value={String(backupForm.enabled)} onChange={(event) => setBackupForm({ ...backupForm, enabled: event.target.value === 'true' })}><option value="false">deaktiviert</option><option value="true">aktiv</option></select></label><label><span>Verschlüsselung</span><select value={String(backupForm.encrypt)} onChange={(event) => setBackupForm({ ...backupForm, encrypt: event.target.value === 'true' })}><option value="false">nein</option><option value="true">ja</option></select></label><label><span>Password-Hint</span><input value={backupForm.passwordHint} onChange={(event) => setBackupForm({ ...backupForm, passwordHint: event.target.value })} /></label><label><span>Hourly</span><input type="number" min={1} value={backupForm.hourly} onChange={(event) => setBackupForm({ ...backupForm, hourly: Number(event.target.value) })} /></label><label><span>Daily</span><input type="number" min={1} value={backupForm.daily} onChange={(event) => setBackupForm({ ...backupForm, daily: Number(event.target.value) })} /></label><label><span>Weekly</span><input type="number" min={1} value={backupForm.weekly} onChange={(event) => setBackupForm({ ...backupForm, weekly: Number(event.target.value) })} /></label><label><span>Monthly</span><input type="number" min={1} value={backupForm.monthly} onChange={(event) => setBackupForm({ ...backupForm, monthly: Number(event.target.value) })} /></label><label><span>Yearly</span><input type="number" min={1} value={backupForm.yearly} onChange={(event) => setBackupForm({ ...backupForm, yearly: Number(event.target.value) })} /></label><div className="form-grid__full form-actions"><button type="submit">Backup-Konfiguration speichern</button><button type="button" className="secondary-button" onClick={async () => { await api('/api/admin/backups/run', { method: 'POST', body: JSON.stringify({}) }); const rows = await api<BackupRecord[]>('/api/admin/backups'); onBackupsChanged(rows); await onRefresh() }}>Backup jetzt ausführen</button></div></form></> : <small>Keine Backup-Konfiguration geladen.</small>}</article></section><section className="panel-grid"><article className="panel"><div className="panel__header"><h2>Vorhandene Backups</h2><span>{backups.length} Dateien</span></div><div className="table-wrap"><table><thead><tr><th>Datei</th><th>Slot</th><th>Backend</th><th>Verschlüsselt</th><th>Erstellt</th></tr></thead><tbody>{backups.map((backup) => <tr key={backup.fileName}><td>{backup.fileName}</td><td>{backup.slot}</td><td>{backup.backend ?? '—'}</td><td>{backup.encrypted ? 'ja' : 'nein'}</td><td>{new Date(backup.createdAt).toLocaleString('de-DE')}</td></tr>)}</tbody></table></div></article></section></>
}

function FindingsTable({ rows }: { rows: Finding[] }) {
  return <div className="table-wrap"><table><thead><tr><th>ID</th><th>Titel</th><th>Target</th><th>Severity</th><th>Status</th></tr></thead><tbody>{rows.map((finding) => <tr key={finding.id}><td>{finding.id}</td><td>{finding.title}</td><td>{finding.target}</td><td><span className={`badge badge--${finding.severity.toLowerCase()}`}>{finding.severity}</span></td><td>{finding.status}</td></tr>)}</tbody></table></div>
}

export default App
