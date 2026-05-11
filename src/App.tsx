import './App.css'

type NavKey = 'dashboard' | 'kunden' | 'assessments' | 'findings' | 'reports' | 'settings'

type NavItem = {
  key: NavKey
  label: string
  hint: string
}

type Stat = {
  label: string
  value: string
  tone?: 'critical' | 'high' | 'medium' | 'neutral'
}

type TableFinding = {
  id: string
  title: string
  target: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  status: string
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', hint: 'Überblick' },
  { key: 'kunden', label: 'Kunden', hint: 'Mandanten & Kontakte' },
  { key: 'assessments', label: 'Assessments', hint: 'Scopes & Projekte' },
  { key: 'findings', label: 'Findings', hint: 'Schwachstellen' },
  { key: 'reports', label: 'Reports', hint: 'Berichte & Export' },
  { key: 'settings', label: 'Einstellungen', hint: 'Vorlagen & Modelle' },
]

const dashboardStats: Stat[] = [
  { label: 'Aktive Assessments', value: '03', tone: 'neutral' },
  { label: 'Kritische Findings', value: '07', tone: 'critical' },
  { label: 'High Findings', value: '12', tone: 'high' },
  { label: 'Offene Retests', value: '05', tone: 'medium' },
]

const findings: TableFinding[] = [
  { id: 'VL-2026-0001', title: 'Authenticated RCE via file import', target: 'portal.example.tld', severity: 'Critical', status: 'Bestätigt' },
  { id: 'VL-2026-0002', title: 'Stored XSS in admin comment field', target: 'admin.example.tld', severity: 'High', status: 'Offen' },
  { id: 'VL-2026-0003', title: 'Weak password policy on VPN portal', target: 'vpn.example.tld', severity: 'Medium', status: 'In Bearbeitung' },
]

const customers = [
  { name: 'Musterwerk GmbH', sector: 'Industrie', contact: 'it@musterwerk.de' },
  { name: 'Blue Harbor AG', sector: 'SaaS', contact: 'security@blueharbor.io' },
  { name: 'Nordstern Health', sector: 'Gesundheit', contact: 'ciso@nordstern-health.de' },
]

const assessments = [
  { title: 'External Web Pentest Q2', type: 'Web', mode: 'Greybox', status: 'Aktiv' },
  { title: 'API Security Review', type: 'API', mode: 'Whitebox', status: 'Review' },
  { title: 'Internal Network Assessment', type: 'Infrastruktur', mode: 'Blackbox', status: 'Geplant' },
]

function App() {
  const active: NavKey = 'dashboard'

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
            <button key={item.key} className={`nav__item ${active === item.key ? 'is-active' : ''}`}>
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
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
        <header className="topbar">
          <div>
            <span className="eyebrow">Dashboard</span>
            <h1>Operativer Überblick für laufende Assessments</h1>
          </div>
          <div className="topbar__actions">
            <button className="secondary">Neuer Kunde</button>
            <button>Neues Assessment</button>
          </div>
        </header>

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
                  {findings.map((finding) => (
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
              <li>echte Navigation mit Routing aufbauen</li>
              <li>Formulare für Kunden und Assessments anlegen</li>
              <li>Finding-Detailansicht mit CVSS/CWE vorbereiten</li>
              <li>Report-Struktur und Exportpfad umsetzen</li>
            </ol>
          </article>
        </section>
      </main>
    </div>
  )
}

export default App
