import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'

type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
type FindingStatus = 'Offen' | 'Bestätigt' | 'In Bearbeitung' | 'Behoben'
type AssessmentStatus = 'Geplant' | 'Aktiv' | 'Review' | 'Abgeschlossen'
type ReportStatus = 'Draft' | 'Internes Review' | 'Freigegeben' | 'Exportiert'

type Customer = {
  id: string
  name: string
  sector: string
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
}

type Assessment = {
  id: string
  title: string
  customerId: string
  type: string
  mode: string
  status: AssessmentStatus
  scope: string
  leadTester: string
  rulesOfEngagement: string
}

type Finding = {
  id: string
  assessmentId: string
  title: string
  target: string
  severity: Severity
  status: FindingStatus
  cvssScore: string
  cwe: string
  recommendation: string
}

type Report = {
  id: string
  assessmentId: string
  title: string
  status: ReportStatus
  summary: string
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', hint: 'Überblick' },
  { to: '/kunden', label: 'Kunden', hint: 'Mandanten & Kontakte' },
  { to: '/assessments', label: 'Assessments', hint: 'Scopes & Projekte' },
  { to: '/findings', label: 'Findings', hint: 'Schwachstellen' },
  { to: '/reports', label: 'Reports', hint: 'Berichte & Export' },
  { to: '/settings', label: 'Einstellungen', hint: 'Vorlagen & Modelle' },
]

const initialCustomers: Customer[] = [
  {
    id: 'c1',
    name: 'Musterwerk GmbH',
    sector: 'Industrie',
    contactName: 'Laura Stein',
    contactEmail: 'it@musterwerk.de',
    contactPhone: '+49 211 555100',
    notes: 'Produktionsnahe Webplattform mit erhöhtem Verfügbarkeitsbedarf.',
  },
  {
    id: 'c2',
    name: 'Blue Harbor AG',
    sector: 'SaaS',
    contactName: 'Jonas Weber',
    contactEmail: 'security@blueharbor.io',
    contactPhone: '+49 30 884422',
    notes: 'API-first Produkt, Fokus auf AuthN/AuthZ und Mandantentrennung.',
  },
  {
    id: 'c3',
    name: 'Nordstern Health',
    sector: 'Gesundheit',
    contactName: 'Mira Koch',
    contactEmail: 'ciso@nordstern-health.de',
    contactPhone: '+49 40 901177',
    notes: 'Sensibler Gesundheitskontext, Reporting besonders managementtauglich halten.',
  },
]

const initialAssessments: Assessment[] = [
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
  },
  {
    id: 'a3',
    title: 'Internal Network Assessment',
    customerId: 'c1',
    type: 'Infrastruktur',
    mode: 'Blackbox',
    status: 'Geplant',
    scope: '10.20.0.0/24, VPN, AD-nahe Systeme',
    leadTester: 'Daniel Schuh',
    rulesOfEngagement: 'Keine produktionskritischen Server rebooten oder bruteforcen.',
  },
]

const initialFindings: Finding[] = [
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
  },
  {
    id: 'VL-2026-0003',
    assessmentId: 'a2',
    title: 'Weak password policy on VPN portal',
    target: 'vpn.example.tld',
    severity: 'Medium',
    status: 'In Bearbeitung',
    cvssScore: '5.9',
    cwe: 'CWE-521',
    recommendation: 'MFA erzwingen und Passwortvorgaben verschärfen.',
  },
]

const initialReports: Report[] = [
  {
    id: 'r1',
    assessmentId: 'a1',
    title: 'External Web Pentest Q2 Report',
    status: 'Draft',
    summary: 'Fokus auf Angriffsoberfläche, Authentisierung, Dateiupload und Rollenmodelle.',
  },
  {
    id: 'r2',
    assessmentId: 'a2',
    title: 'API Security Review Report',
    status: 'Internes Review',
    summary: 'API-Design, Token Handling, Autorisierung und Rate Limits bewertet.',
  },
]

function App() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments)
  const [findings, setFindings] = useState<Finding[]>(initialFindings)
  const [reports, setReports] = useState<Report[]>(initialReports)

  const activeAssessmentCount = assessments.filter((item) => item.status === 'Aktiv').length
  const criticalFindingCount = findings.filter((item) => item.severity === 'Critical').length
  const highFindingCount = findings.filter((item) => item.severity === 'High').length
  const openRetests = findings.filter((item) => item.status !== 'Behoben').length

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/vulnledger-logo.png" alt="VulnLedger" className="brand__logo" />
          <div>
            <strong>VulnLedger</strong>
            <span>Pentest Documentation</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__card">
          <div className="sidebar__card-title">Live-Stand</div>
          <ul>
            <li>{customers.length} Kunden</li>
            <li>{assessments.length} Assessments</li>
            <li>{findings.length} Findings</li>
            <li>{reports.length} Reports</li>
          </ul>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                customers={customers}
                assessments={assessments}
                findings={findings}
                reports={reports}
                stats={[
                  { label: 'Aktive Assessments', value: String(activeAssessmentCount), tone: 'neutral' },
                  { label: 'Kritische Findings', value: String(criticalFindingCount), tone: 'critical' },
                  { label: 'High Findings', value: String(highFindingCount), tone: 'high' },
                  { label: 'Offene Retests', value: String(openRetests), tone: 'medium' },
                ]}
              />
            }
          />
          <Route
            path="/kunden"
            element={
              <CustomersPage
                customers={customers}
                assessments={assessments}
                onAddCustomer={(customer) => setCustomers((current) => [customer, ...current])}
              />
            }
          />
          <Route
            path="/assessments"
            element={
              <AssessmentsPage
                customers={customers}
                assessments={assessments}
                onAddAssessment={(assessment) => setAssessments((current) => [assessment, ...current])}
                onStatusChange={(assessmentId, status) => {
                  setAssessments((current) => current.map((item) => (item.id === assessmentId ? { ...item, status } : item)))
                }}
              />
            }
          />
          <Route
            path="/findings"
            element={
              <FindingsPage
                assessments={assessments}
                findings={findings}
                onAddFinding={(finding) => setFindings((current) => [finding, ...current])}
                onStatusChange={(findingId, status) => {
                  setFindings((current) => current.map((item) => (item.id === findingId ? { ...item, status } : item)))
                }}
              />
            }
          />
          <Route
            path="/reports"
            element={
              <ReportsPage
                reports={reports}
                assessments={assessments}
                onAddReport={(report) => setReports((current) => [report, ...current])}
                onStatusChange={(reportId, status) => {
                  setReports((current) => current.map((item) => (item.id === reportId ? { ...item, status } : item)))
                }}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function PageHeader({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {actions ? <div className="topbar__actions">{actions}</div> : null}
    </header>
  )
}

function DashboardPage({
  customers,
  assessments,
  findings,
  reports,
  stats,
}: {
  customers: Customer[]
  assessments: Assessment[]
  findings: Finding[]
  reports: Report[]
  stats: Array<{ label: string; value: string; tone?: 'critical' | 'high' | 'medium' | 'neutral' }>
}) {
  return (
    <>
      <PageHeader eyebrow="Dashboard" title="Operativer Überblick für laufende Assessments" />

      <section className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className={`stat stat--${stat.tone ?? 'neutral'}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid panel-grid--wide">
        <article className="panel">
          <div className="panel__header">
            <h2>Priorisierte Findings</h2>
            <span>Top-Risiken</span>
          </div>
          <FindingsTable rows={findings.slice(0, 3)} />
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Berichtsstatus</h2>
            <span>{reports.length} Reports</span>
          </div>
          <div className="list">
            {reports.map((report) => (
              <div className="list__item" key={report.id}>
                <strong>{report.title}</strong>
                <span>{report.status}</span>
                <small>{report.summary}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Kunden im Fokus</h2>
            <span>{customers.length} Kunden</span>
          </div>
          <div className="list">
            {customers.map((customer) => {
              const linkedAssessments = assessments.filter((assessment) => assessment.customerId === customer.id).length
              return (
                <div className="list__item" key={customer.id}>
                  <strong>{customer.name}</strong>
                  <span>{customer.sector}</span>
                  <small>{customer.contactEmail} · {linkedAssessments} Assessments</small>
                </div>
              )
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Assessment-Pipeline</h2>
            <span>Live</span>
          </div>
          <div className="list">
            {assessments.map((assessment) => (
              <div className="list__item" key={assessment.id}>
                <strong>{assessment.title}</strong>
                <span>{assessment.type} · {assessment.mode}</span>
                <small>{assessment.status}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  )
}

function CustomersPage({
  customers,
  assessments,
  onAddCustomer,
}: {
  customers: Customer[]
  assessments: Assessment[]
  onAddCustomer: (customer: Customer) => void
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? '')
  const [form, setForm] = useState({
    name: '',
    sector: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  })

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0]
  const linkedAssessments = assessments.filter((assessment) => assessment.customerId === selectedCustomer?.id)

  return (
    <>
      <PageHeader eyebrow="Kunden" title="Mandanten verwalten und Projektkontext pflegen" />

      <section className="panel-grid panel-grid--wide">
        <article className="panel">
          <div className="panel__header">
            <h2>Kundenliste</h2>
            <span>{customers.length} Einträge</span>
          </div>
          <div className="select-list">
            {customers.map((customer) => (
              <button
                key={customer.id}
                className={`select-list__item ${selectedCustomer?.id === customer.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <strong>{customer.name}</strong>
                <span>{customer.sector}</span>
                <small>{customer.contactEmail}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Kundendetail</h2>
            <span>{selectedCustomer?.name ?? '—'}</span>
          </div>
          {selectedCustomer ? (
            <div className="detail-stack">
              <div className="detail-card">
                <strong>Ansprechpartner</strong>
                <span>{selectedCustomer.contactName}</span>
                <small>{selectedCustomer.contactEmail} · {selectedCustomer.contactPhone}</small>
              </div>
              <div className="detail-card">
                <strong>Notizen</strong>
                <small>{selectedCustomer.notes}</small>
              </div>
              <div className="detail-card">
                <strong>Verknüpfte Assessments</strong>
                {linkedAssessments.length ? (
                  linkedAssessments.map((assessment) => (
                    <small key={assessment.id}>{assessment.title} · {assessment.status}</small>
                  ))
                ) : (
                  <small>Aktuell keine verknüpften Assessments.</small>
                )}
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Neuen Kunden anlegen</h2>
            <span>Workflow</span>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              const nextCustomer: Customer = {
                id: `c${Date.now()}`,
                ...form,
              }
              onAddCustomer(nextCustomer)
              setSelectedCustomerId(nextCustomer.id)
              setForm({ name: '', sector: '', contactName: '', contactEmail: '', contactPhone: '', notes: '' })
            }}
          >
            <label>
              <span>Name</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label>
              <span>Branche</span>
              <input value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} required />
            </label>
            <label>
              <span>Ansprechpartner</span>
              <input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} required />
            </label>
            <label>
              <span>E-Mail</span>
              <input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} required />
            </label>
            <label>
              <span>Telefon</span>
              <input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} />
            </label>
            <label className="form-grid__full">
              <span>Notizen</span>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} />
            </label>
            <div className="form-grid__full form-actions">
              <button type="submit">Kunden speichern</button>
            </div>
          </form>
        </article>
      </section>
    </>
  )
}

function AssessmentsPage({
  customers,
  assessments,
  onAddAssessment,
  onStatusChange,
}: {
  customers: Customer[]
  assessments: Assessment[]
  onAddAssessment: (assessment: Assessment) => void
  onStatusChange: (assessmentId: string, status: AssessmentStatus) => void
}) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(assessments[0]?.id ?? '')
  const [form, setForm] = useState({
    title: '',
    customerId: customers[0]?.id ?? '',
    type: 'Web',
    mode: 'Greybox',
    status: 'Geplant' as AssessmentStatus,
    scope: '',
    leadTester: 'Daniel Schuh',
    rulesOfEngagement: '',
  })

  const selectedAssessment = assessments.find((assessment) => assessment.id === selectedAssessmentId) ?? assessments[0]
  const selectedCustomer = customers.find((customer) => customer.id === selectedAssessment?.customerId)

  return (
    <>
      <PageHeader eyebrow="Assessments" title="Assessments planen, scopen und steuern" />

      <section className="panel-grid panel-grid--wide">
        <article className="panel">
          <div className="panel__header">
            <h2>Assessment-Liste</h2>
            <span>{assessments.length} Projekte</span>
          </div>
          <div className="select-list">
            {assessments.map((assessment) => (
              <button
                key={assessment.id}
                className={`select-list__item ${selectedAssessment?.id === assessment.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedAssessmentId(assessment.id)}
              >
                <strong>{assessment.title}</strong>
                <span>{customers.find((customer) => customer.id === assessment.customerId)?.name}</span>
                <small>{assessment.type} · {assessment.mode} · {assessment.status}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Assessment-Detail</h2>
            <span>{selectedAssessment?.title ?? '—'}</span>
          </div>
          {selectedAssessment ? (
            <div className="detail-stack">
              <div className="detail-card">
                <strong>Kunde</strong>
                <small>{selectedCustomer?.name}</small>
              </div>
              <div className="detail-card">
                <strong>Scope</strong>
                <small>{selectedAssessment.scope}</small>
              </div>
              <div className="detail-card">
                <strong>Rules of Engagement</strong>
                <small>{selectedAssessment.rulesOfEngagement}</small>
              </div>
              <label>
                <span>Status aktualisieren</span>
                <select value={selectedAssessment.status} onChange={(event) => onStatusChange(selectedAssessment.id, event.target.value as AssessmentStatus)}>
                  <option>Geplant</option>
                  <option>Aktiv</option>
                  <option>Review</option>
                  <option>Abgeschlossen</option>
                </select>
              </label>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Neues Assessment anlegen</h2>
            <span>Workflow</span>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              const nextAssessment: Assessment = {
                id: `a${Date.now()}`,
                ...form,
              }
              onAddAssessment(nextAssessment)
              setSelectedAssessmentId(nextAssessment.id)
              setForm({
                title: '',
                customerId: customers[0]?.id ?? '',
                type: 'Web',
                mode: 'Greybox',
                status: 'Geplant',
                scope: '',
                leadTester: 'Daniel Schuh',
                rulesOfEngagement: '',
              })
            }}
          >
            <label>
              <span>Titel</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label>
              <span>Kunde</span>
              <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Testart</span>
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option>Web</option>
                <option>API</option>
                <option>Infrastruktur</option>
                <option>Mobile</option>
              </select>
            </label>
            <label>
              <span>Ansatz</span>
              <select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}>
                <option>Blackbox</option>
                <option>Greybox</option>
                <option>Whitebox</option>
              </select>
            </label>
            <label>
              <span>Lead Tester</span>
              <input value={form.leadTester} onChange={(event) => setForm({ ...form, leadTester: event.target.value })} />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AssessmentStatus })}>
                <option>Geplant</option>
                <option>Aktiv</option>
                <option>Review</option>
                <option>Abgeschlossen</option>
              </select>
            </label>
            <label className="form-grid__full">
              <span>Scope</span>
              <textarea value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} rows={3} required />
            </label>
            <label className="form-grid__full">
              <span>Rules of Engagement</span>
              <textarea value={form.rulesOfEngagement} onChange={(event) => setForm({ ...form, rulesOfEngagement: event.target.value })} rows={4} required />
            </label>
            <div className="form-grid__full form-actions">
              <button type="submit">Assessment speichern</button>
            </div>
          </form>
        </article>
      </section>
    </>
  )
}

function FindingsPage({
  assessments,
  findings,
  onAddFinding,
  onStatusChange,
}: {
  assessments: Assessment[]
  findings: Finding[]
  onAddFinding: (finding: Finding) => void
  onStatusChange: (findingId: string, status: FindingStatus) => void
}) {
  const [selectedFindingId, setSelectedFindingId] = useState(findings[0]?.id ?? '')
  const [form, setForm] = useState({
    assessmentId: assessments[0]?.id ?? '',
    title: '',
    target: '',
    severity: 'Medium' as Severity,
    status: 'Offen' as FindingStatus,
    cvssScore: '',
    cwe: '',
    recommendation: '',
  })

  const selectedFinding = findings.find((finding) => finding.id === selectedFindingId) ?? findings[0]
  const linkedAssessment = assessments.find((assessment) => assessment.id === selectedFinding?.assessmentId)

  return (
    <>
      <PageHeader eyebrow="Findings" title="Schwachstellen dokumentieren und nachverfolgen" />

      <section className="panel-grid panel-grid--wide">
        <article className="panel">
          <div className="panel__header">
            <h2>Findings Ledger</h2>
            <span>{findings.length} Einträge</span>
          </div>
          <div className="select-list">
            {findings.map((finding) => (
              <button
                key={finding.id}
                className={`select-list__item ${selectedFinding?.id === finding.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedFindingId(finding.id)}
              >
                <strong>{finding.id} · {finding.title}</strong>
                <span>{finding.target}</span>
                <small>{finding.severity} · {finding.status}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Finding-Detail</h2>
            <span>{selectedFinding?.id ?? '—'}</span>
          </div>
          {selectedFinding ? (
            <div className="detail-stack">
              <div className="detail-card">
                <strong>Assessment</strong>
                <small>{linkedAssessment?.title}</small>
              </div>
              <div className="detail-card">
                <strong>CVSS / CWE</strong>
                <small>{selectedFinding.cvssScore} · {selectedFinding.cwe}</small>
              </div>
              <div className="detail-card">
                <strong>Empfehlung</strong>
                <small>{selectedFinding.recommendation}</small>
              </div>
              <label>
                <span>Status aktualisieren</span>
                <select value={selectedFinding.status} onChange={(event) => onStatusChange(selectedFinding.id, event.target.value as FindingStatus)}>
                  <option>Offen</option>
                  <option>Bestätigt</option>
                  <option>In Bearbeitung</option>
                  <option>Behoben</option>
                </select>
              </label>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Neues Finding anlegen</h2>
            <span>Workflow</span>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              const nextFinding: Finding = {
                id: `VL-${new Date().getFullYear()}-${String(findings.length + 1).padStart(4, '0')}`,
                ...form,
              }
              onAddFinding(nextFinding)
              setSelectedFindingId(nextFinding.id)
              setForm({
                assessmentId: assessments[0]?.id ?? '',
                title: '',
                target: '',
                severity: 'Medium',
                status: 'Offen',
                cvssScore: '',
                cwe: '',
                recommendation: '',
              })
            }}
          >
            <label>
              <span>Assessment</span>
              <select value={form.assessmentId} onChange={(event) => setForm({ ...form, assessmentId: event.target.value })}>
                {assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>{assessment.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Titel</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label>
              <span>Target</span>
              <input value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} required />
            </label>
            <label>
              <span>Severity</span>
              <select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as Severity })}>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
            <label>
              <span>CVSS</span>
              <input value={form.cvssScore} onChange={(event) => setForm({ ...form, cvssScore: event.target.value })} placeholder="z. B. 8.1" />
            </label>
            <label>
              <span>CWE</span>
              <input value={form.cwe} onChange={(event) => setForm({ ...form, cwe: event.target.value })} placeholder="z. B. CWE-79" />
            </label>
            <label className="form-grid__full">
              <span>Empfehlung</span>
              <textarea value={form.recommendation} onChange={(event) => setForm({ ...form, recommendation: event.target.value })} rows={4} required />
            </label>
            <div className="form-grid__full form-actions">
              <button type="submit">Finding speichern</button>
            </div>
          </form>
        </article>
      </section>
    </>
  )
}

function ReportsPage({
  reports,
  assessments,
  onAddReport,
  onStatusChange,
}: {
  reports: Report[]
  assessments: Assessment[]
  onAddReport: (report: Report) => void
  onStatusChange: (reportId: string, status: ReportStatus) => void
}) {
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.id ?? '')
  const [form, setForm] = useState({
    assessmentId: assessments[0]?.id ?? '',
    title: '',
    status: 'Draft' as ReportStatus,
    summary: '',
  })

  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0]
  const linkedAssessment = assessments.find((assessment) => assessment.id === selectedReport?.assessmentId)

  return (
    <>
      <PageHeader eyebrow="Reports" title="Berichte vorbereiten und Freigabestatus steuern" />

      <section className="panel-grid panel-grid--wide">
        <article className="panel">
          <div className="panel__header">
            <h2>Report-Liste</h2>
            <span>{reports.length} Reports</span>
          </div>
          <div className="select-list">
            {reports.map((report) => (
              <button
                key={report.id}
                className={`select-list__item ${selectedReport?.id === report.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedReportId(report.id)}
              >
                <strong>{report.title}</strong>
                <span>{report.status}</span>
                <small>{report.summary}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Report-Detail</h2>
            <span>{selectedReport?.title ?? '—'}</span>
          </div>
          {selectedReport ? (
            <div className="detail-stack">
              <div className="detail-card">
                <strong>Assessment</strong>
                <small>{linkedAssessment?.title}</small>
              </div>
              <div className="detail-card">
                <strong>Summary</strong>
                <small>{selectedReport.summary}</small>
              </div>
              <label>
                <span>Status aktualisieren</span>
                <select value={selectedReport.status} onChange={(event) => onStatusChange(selectedReport.id, event.target.value as ReportStatus)}>
                  <option>Draft</option>
                  <option>Internes Review</option>
                  <option>Freigegeben</option>
                  <option>Exportiert</option>
                </select>
              </label>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Neuen Report anlegen</h2>
            <span>Workflow</span>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              const nextReport: Report = {
                id: `r${Date.now()}`,
                ...form,
              }
              onAddReport(nextReport)
              setSelectedReportId(nextReport.id)
              setForm({
                assessmentId: assessments[0]?.id ?? '',
                title: '',
                status: 'Draft',
                summary: '',
              })
            }}
          >
            <label>
              <span>Assessment</span>
              <select value={form.assessmentId} onChange={(event) => setForm({ ...form, assessmentId: event.target.value })}>
                {assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>{assessment.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Titel</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ReportStatus })}>
                <option>Draft</option>
                <option>Internes Review</option>
                <option>Freigegeben</option>
                <option>Exportiert</option>
              </select>
            </label>
            <label className="form-grid__full">
              <span>Executive Summary / Kurzbeschreibung</span>
              <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={4} required />
            </label>
            <div className="form-grid__full form-actions">
              <button type="submit">Report speichern</button>
            </div>
          </form>
        </article>
      </section>
    </>
  )
}

function SettingsPage() {
  const [defaults, setDefaults] = useState({
    reportTemplate: 'Standard Executive + Technical Report',
    defaultSeverityModel: 'CVSS v3.1',
    defaultLead: 'Daniel Schuh',
    defaultFindingPrefix: 'VL',
  })

  return (
    <>
      <PageHeader eyebrow="Einstellungen" title="Arbeitsstandards und Default-Werte pflegen" />

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Projektstandards</h2>
            <span>Workflow</span>
          </div>
          <form className="form-grid">
            <label>
              <span>Report-Template</span>
              <input value={defaults.reportTemplate} onChange={(event) => setDefaults({ ...defaults, reportTemplate: event.target.value })} />
            </label>
            <label>
              <span>Severity-Modell</span>
              <input value={defaults.defaultSeverityModel} onChange={(event) => setDefaults({ ...defaults, defaultSeverityModel: event.target.value })} />
            </label>
            <label>
              <span>Default Lead Tester</span>
              <input value={defaults.defaultLead} onChange={(event) => setDefaults({ ...defaults, defaultLead: event.target.value })} />
            </label>
            <label>
              <span>Finding-Präfix</span>
              <input value={defaults.defaultFindingPrefix} onChange={(event) => setDefaults({ ...defaults, defaultFindingPrefix: event.target.value })} />
            </label>
          </form>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Aktuelle Default-Werte</h2>
            <span>Live</span>
          </div>
          <div className="detail-stack">
            <div className="detail-card"><strong>Template</strong><small>{defaults.reportTemplate}</small></div>
            <div className="detail-card"><strong>Severity</strong><small>{defaults.defaultSeverityModel}</small></div>
            <div className="detail-card"><strong>Lead</strong><small>{defaults.defaultLead}</small></div>
            <div className="detail-card"><strong>Präfix</strong><small>{defaults.defaultFindingPrefix}</small></div>
          </div>
        </article>
      </section>
    </>
  )
}

function FindingsTable({ rows }: { rows: Finding[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Titel</th>
            <th>Target</th>
            <th>Severity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((finding) => (
            <tr key={finding.id}>
              <td>{finding.id}</td>
              <td>{finding.title}</td>
              <td>{finding.target}</td>
              <td><span className={`badge badge--${finding.severity.toLowerCase()}`}>{finding.severity}</span></td>
              <td>{finding.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
