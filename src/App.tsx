import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'

type Stat = {
  label: string
  value: string
  tone?: 'critical' | 'high' | 'medium' | 'neutral'
}

type Finding = {
  id: string
  title: string
  target: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  status: string
}

type Customer = {
  name: string
  sector: string
  contact: string
  activeAssessments: number
}

type Assessment = {
  title: string
  customer: string
  type: string
  mode: string
  status: string
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', hint: 'Überblick' },
  { to: '/kunden', label: 'Kunden', hint: 'Mandanten & Kontakte' },
  { to: '/assessments', label: 'Assessments', hint: 'Scopes & Projekte' },
  { to: '/findings', label: 'Findings', hint: 'Schwachstellen' },
  { to: '/reports', label: 'Reports', hint: 'Berichte & Export' },
  { to: '/settings', label: 'Einstellungen', hint: 'Vorlagen & Modelle' },
]

const dashboardStats: Stat[] = [
  { label: 'Aktive Assessments', value: '03', tone: 'neutral' },
  { label: 'Kritische Findings', value: '07', tone: 'critical' },
  { label: 'High Findings', value: '12', tone: 'high' },
  { label: 'Offene Retests', value: '05', tone: 'medium' },
]

const findings: Finding[] = [
  { id: 'VL-2026-0001', title: 'Authenticated RCE via file import', target: 'portal.example.tld', severity: 'Critical', status: 'Bestätigt' },
  { id: 'VL-2026-0002', title: 'Stored XSS in admin comment field', target: 'admin.example.tld', severity: 'High', status: 'Offen' },
  { id: 'VL-2026-0003', title: 'Weak password policy on VPN portal', target: 'vpn.example.tld', severity: 'Medium', status: 'In Bearbeitung' },
  { id: 'VL-2026-0004', title: 'Directory listing on backup endpoint', target: 'files.example.tld', severity: 'Low', status: 'Bestätigt' },
]

const customers: Customer[] = [
  { name: 'Musterwerk GmbH', sector: 'Industrie', contact: 'it@musterwerk.de', activeAssessments: 2 },
  { name: 'Blue Harbor AG', sector: 'SaaS', contact: 'security@blueharbor.io', activeAssessments: 1 },
  { name: 'Nordstern Health', sector: 'Gesundheit', contact: 'ciso@nordstern-health.de', activeAssessments: 0 },
]

const assessments: Assessment[] = [
  { title: 'External Web Pentest Q2', customer: 'Musterwerk GmbH', type: 'Web', mode: 'Greybox', status: 'Aktiv' },
  { title: 'API Security Review', customer: 'Blue Harbor AG', type: 'API', mode: 'Whitebox', status: 'Review' },
  { title: 'Internal Network Assessment', customer: 'Musterwerk GmbH', type: 'Infrastruktur', mode: 'Blackbox', status: 'Geplant' },
]

function App() {
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
          <div className="sidebar__card-title">MVP-Fokus</div>
          <ul>
            <li>Assessment-Struktur</li>
            <li>Findings mit CVSS/CWE</li>
            <li>Evidence & Retest</li>
            <li>Berichtsvorbereitung</li>
          </ul>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/kunden" element={<CustomersPage />} />
          <Route path="/assessments" element={<AssessmentsPage />} />
          <Route path="/findings" element={<FindingsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
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

function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Operativer Überblick für laufende Assessments"
        actions={
          <>
            <button className="secondary">Neuer Kunde</button>
            <button>Neues Assessment</button>
          </>
        }
      />

      <section className="stats-grid">
        {dashboardStats.map((stat) => (
          <article key={stat.label} className={`stat stat--${stat.tone ?? 'neutral'}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid panel-grid--wide">
        <article className="panel">
          <div className="panel__header">
            <h2>Kritische / priorisierte Findings</h2>
            <span>Live-Mockdaten</span>
          </div>
          <FindingsTable rows={findings.slice(0, 3)} />
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Kunden</h2>
            <span>Aktive Mandanten</span>
          </div>
          <div className="list">
            {customers.map((customer) => (
              <div className="list__item" key={customer.name}>
                <strong>{customer.name}</strong>
                <span>{customer.sector}</span>
                <small>{customer.contact}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Assessments</h2>
            <span>Pipeline</span>
          </div>
          <div className="list">
            {assessments.map((assessment) => (
              <div className="list__item" key={assessment.title}>
                <strong>{assessment.title}</strong>
                <span>{assessment.type} · {assessment.mode}</span>
                <small>{assessment.status}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Nächste Umsetzungsschritte</h2>
            <span>Roadmap</span>
          </div>
          <ol className="todo">
            <li>Formulare für Kunden und Assessments anlegen</li>
            <li>Finding-Detailansicht mit CVSS/CWE vorbereiten</li>
            <li>Report-Struktur und Exportpfad umsetzen</li>
            <li>Backend und Persistenz anschließen</li>
          </ol>
        </article>
      </section>
    </>
  )
}

function CustomersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Kunden"
        title="Mandanten, Ansprechpartner und aktive Assessments"
        actions={<button>Neuen Kunden anlegen</button>}
      />

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Kundenliste</h2>
            <span>{customers.length} Einträge</span>
          </div>
          <div className="list">
            {customers.map((customer) => (
              <div className="list__item" key={customer.name}>
                <strong>{customer.name}</strong>
                <span>{customer.sector}</span>
                <small>{customer.contact} · {customer.activeAssessments} aktive Assessments</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Geplante Felder</h2>
            <span>MVP</span>
          </div>
          <ol className="todo">
            <li>Name / Branche</li>
            <li>Ansprechpartner / Mail / Telefon</li>
            <li>Notizen / Besonderheiten</li>
            <li>Verknüpfte Assessments</li>
          </ol>
        </article>
      </section>
    </>
  )
}

function AssessmentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Assessments"
        title="Scopes, Testarten und Projektstatus im Blick"
        actions={<button>Neues Assessment</button>}
      />

      <section className="panel-grid panel-grid--wide">
        <article className="panel">
          <div className="panel__header">
            <h2>Assessment-Pipeline</h2>
            <span>{assessments.length} Projekte</span>
          </div>
          <div className="list">
            {assessments.map((assessment) => (
              <div className="list__item" key={assessment.title}>
                <strong>{assessment.title}</strong>
                <span>{assessment.customer}</span>
                <small>{assessment.type} · {assessment.mode} · {assessment.status}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>MVP-Assessment-Bausteine</h2>
            <span>Struktur</span>
          </div>
          <ol className="todo">
            <li>Scope Targets</li>
            <li>Rules of Engagement</li>
            <li>Zeitfenster und Notfallkontakt</li>
            <li>Team / Lead Tester / Status</li>
          </ol>
        </article>
      </section>
    </>
  )
}

function FindingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Findings"
        title="Schwachstellen mit Severity, Status und Zielsystemen"
        actions={<button>Neues Finding</button>}
      />

      <section className="panel-grid panel-grid--wide">
        <article className="panel">
          <div className="panel__header">
            <h2>Findings Ledger</h2>
            <span>{findings.length} Einträge</span>
          </div>
          <FindingsTable rows={findings} />
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Geplante Detailfelder</h2>
            <span>Next</span>
          </div>
          <ol className="todo">
            <li>CVSS Vector + Score</li>
            <li>CWE / OWASP Mapping</li>
            <li>Reproduktionsschritte</li>
            <li>Evidence-Verknüpfung</li>
            <li>Retest-Status</li>
          </ol>
        </article>
      </section>
    </>
  )
}

function ReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Berichte, Executive Summaries und Exportzustände"
        actions={<button>Neuen Report vorbereiten</button>}
      />

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Geplanter Berichtspfad</h2>
            <span>Export</span>
          </div>
          <ol className="todo">
            <li>Executive Summary</li>
            <li>Methodik und Scope</li>
            <li>technische Findings</li>
            <li>Empfehlungen / Maßnahmenplan</li>
            <li>Retest-Ergebnisse</li>
          </ol>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Statusmodell</h2>
            <span>MVP</span>
          </div>
          <div className="list">
            {['Draft', 'Internes Review', 'Freigegeben', 'Exportiert'].map((status) => (
              <div className="list__item" key={status}>
                <strong>{status}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  )
}

function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Einstellungen"
        title="Vorlagen, Bewertungsmodelle und Standards"
      />

      <section className="panel-grid">
        <article className="panel">
          <div className="panel__header">
            <h2>Geplante Einstellungen</h2>
            <span>Konfiguration</span>
          </div>
          <ol className="todo">
            <li>Severity-Modell</li>
            <li>Standard-Finding-Texte</li>
            <li>Berichtsvorlagen</li>
            <li>CVSS / CWE Defaults</li>
          </ol>
        </article>

        <article className="panel">
          <div className="panel__header">
            <h2>Nächste technische Schritte</h2>
            <span>Build-out</span>
          </div>
          <ol className="todo">
            <li>Routing beibehalten und Seiten modularisieren</li>
            <li>Mock-Daten in eigene Datei verschieben</li>
            <li>Formulare und Detailseiten ergänzen</li>
            <li>später Backend anbinden</li>
          </ol>
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
