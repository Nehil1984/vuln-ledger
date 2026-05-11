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
- Express-Backend für Auth und Admin-Funktionen
- lowdb als Standard-Datenhaltung
- SQLite als auswählbares alternatives Backend
- Dockerfile für Container-Build
- GitHub Actions Workflow für GHCR
- Unraid Template inkl. Icon

## Entwicklung

```bash
npm install
npm run dev
```

Backend lokal starten:

```bash
npm run server
```

## Aktueller Auth-/DB-Stand

- Login ist serverseitig und im Frontend angebunden
- Session-Check, Logout und Rollenanzeige sind integriert
- Rollenmodell: `admin` und `user`
- Standard-DB-Backend: `lowdb`
- Optional umschaltbar auf `sqlite`
- Lizenzverwaltung ist eingebaut
- Backup-Logik ist analog zum PrivaShield-Muster integriert
- Standard-Admin beim Erststart:
  - Benutzername: `admin`
  - Passwort: `admin123!`

Empfehlung: Zugangsdaten, Session-Secret und optionales Backup-Kennwort im Deployment sofort überschreiben.

## Build

```bash
npm run build
npm run build:server
# oder komplett
npm run build:full
```

## Docker

```bash
docker build -t vuln-ledger .
docker run -p 3000:3000 \
  -e SESSION_SECRET='replace-me' \
  -e VULNLEDGER_BACKUP_PASSWORD='optional-backup-password' \
  vuln-ledger
```

## Unraid

Die Datei `unraid-template.xml` ist als Startpunkt für die Einbindung in Unraid vorbereitet.

## Architektur-Dokumente

- `docs/architecture.md` – fachliches Datenmodell und MVP-Struktur
- `docs/page-map.md` – geplanter Seitenbaum
- `docs/roadmap.md` – empfohlene Umsetzungsreihenfolge

## Roadmap – empfohlene nächste Schritte

1. Datenmodell für Assessments, Findings und Evidenzen definieren
2. Navigation und Layout für echte Modulseiten aufbauen
3. Berichtsausgabe und Exportstruktur planen
4. Auth, Mehrbenutzerfähigkeit und Rollenmodell ergänzen
