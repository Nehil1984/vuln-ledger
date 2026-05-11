# VulnLedger

VulnLedger ist eine Webanwendung zur strukturierten Dokumentation von Penetration Tests, Red-Team-Assessments und technischen Sicherheitsprüfungen.

## Zielbild

Die App soll Prüfteams dabei helfen,

- Kunden und Assessments sauber zu verwalten
- Scopes und Rules of Engagement nachvollziehbar zu dokumentieren
- Findings mit Severity, CVSS, CWE, Evidence und Empfehlungen zu erfassen
- Retests und Maßnahmenstände nachzuverfolgen
- Kundenberichte effizient vorzubereiten

## Geplanter MVP

- Kunden / Projekte / Assessments
- Scope- und Zielverwaltung
- Findings Ledger
- Evidence Vault
- CVSS- / Risiko-Bewertung
- Berichtsvorbereitung

## Tech-Startpunkt

- React + TypeScript + Vite
- Dockerfile für Container-Build
- GitHub Actions Workflow für GHCR
- Unraid Template inkl. Icon

## Entwicklung

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Docker

```bash
docker build -t vuln-ledger .
docker run -p 8080:80 vuln-ledger
```

## Unraid

Die Datei `unraid-template.xml` ist als Startpunkt für die Einbindung in Unraid vorbereitet.

## Roadmap – empfohlene nächste Schritte

1. Datenmodell für Assessments, Findings und Evidenzen definieren
2. Navigation und Layout für echte Modulseiten aufbauen
3. Berichtsausgabe und Exportstruktur planen
4. Auth, Mehrbenutzerfähigkeit und Rollenmodell ergänzen
