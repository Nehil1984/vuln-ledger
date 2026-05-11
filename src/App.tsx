import './App.css'

type Metric = {
  label: string
  value: string
  tone?: 'critical' | 'high' | 'medium' | 'neutral'
}

type ModuleCard = {
  title: string
  text: string
}

const metrics: Metric[] = [
  { label: 'Aktive Assessments', value: '03', tone: 'neutral' },
  { label: 'Kritische Findings', value: '07', tone: 'critical' },
  { label: 'High Findings', value: '12', tone: 'high' },
  { label: 'Retests offen', value: '05', tone: 'medium' },
]

const modules: ModuleCard[] = [
  {
    title: 'Assessment Scope',
    text: 'Mandanten, Ziele, Zeitfenster, Testart, Rules of Engagement und Notfallkontakte sauber dokumentieren.',
  },
  {
    title: 'Findings Ledger',
    text: 'Schwachstellen mit Severity, CVSS, CWE, Reproduktionsschritten, Evidence und Empfehlungen verwalten.',
  },
  {
    title: 'Evidence Vault',
    text: 'Screenshots, Requests, Responses, Konsolenlogs und Artefakte strukturiert je Finding ablegen.',
  },
  {
    title: 'Report Builder',
    text: 'Executive Summary, technische Details und Maßnahmenplan für Kundenberichte vorbereiten.',
  },
]

function App() {
  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <span className="eyebrow">VulnLedger · Penetration Testing Documentation</span>
          <h1>Dokumentiere Pentests strukturiert, nachvollziehbar und berichtsfähig.</h1>
          <p>
            VulnLedger ist als Arbeitsoberfläche für Scopes, Findings, Evidenzen,
            Risikobewertungen und Retests gedacht — vom ersten Kickoff bis zum finalen Report.
          </p>
          <div className="hero__actions">
            <button>Neues Assessment</button>
            <button className="secondary">MVP-Struktur ansehen</button>
          </div>
        </div>
        <div className="hero__panel">
          <div className="panel-card">
            <div className="panel-card__title">MVP-Fokus</div>
            <ul>
              <li>Projekt- & Scope-Verwaltung</li>
              <li>Findings mit CVSS/CWE</li>
              <li>Evidence-Verknüpfung</li>
              <li>Retest-Status</li>
              <li>Berichtsvorbereitung</li>
            </ul>
          </div>
        </div>
      </header>

      <main>
        <section className="metrics-grid">
          {metrics.map((metric) => (
            <article key={metric.label} className={`metric metric--${metric.tone ?? 'neutral'}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <div className="content-block">
            <h2>Geplante Kernmodule</h2>
            <div className="module-grid">
              {modules.map((module) => (
                <article key={module.title} className="module-card">
                  <h3>{module.title}</h3>
                  <p>{module.text}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="content-block checklist">
            <h2>Nächste Bauschritte</h2>
            <ol>
              <li>Datenmodell für Assessments, Findings und Evidence definieren</li>
              <li>Navigation und Seitenlayout für MVP aufbauen</li>
              <li>Berichtsstruktur und Exportpfade vorbereiten</li>
              <li>Docker/GHCR/Unraid-Auslieferung fertig verdrahten</li>
            </ol>
          </aside>
        </section>
      </main>
    </div>
  )
}

export default App
