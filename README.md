<!-- Copyright 2026 Daniel Schuh | Licensed under Apache License 2.0 -->

# VulnLedger

VulnLedger ist eine selbst hostbare Plattform zur strukturierten Dokumentation von Penetration Tests, Red-Team-Assessments und technischen Sicherheitsprüfungen.

## Features

- Kunden- und Assessment-Verwaltung
- Findings mit Severity, CVSS, CWE und Empfehlungen
- Reports mit Review-Status
- Evidence-Workflow inkl. Datei-Uploads
- Retests zur Nachverfolgung von Behebungen
- Rollenmodell (`admin`, `user`)
- Session-basierter Login
- Lizenzverwaltung
- Backup-Logik mit Rotation
- umschaltbare Datenhaltung über `lowdb` oder `sqlite`

## Tech Stack

- React + TypeScript + Vite
- Express + TypeScript
- `lowdb` als einfacher Standardpfad
- `better-sqlite3` als vollwertige alternative Datenbank
- Docker-ready
- Unraid-ready

## Standard-Zugang beim Erststart

- Benutzername: `admin`
- Passwort: `admin123!`

> Empfehlung: Nach dem ersten Start sofort ändern.

## Entwicklung lokal

```bash
npm install
npm run dev
npm run server
```

## Build

```bash
npm run build:full
npm run lint
```

## Docker

### Lokal bauen

```bash
docker build -t vuln-ledger .
```

### Container starten

```bash
docker run -d \
  --name vuln-ledger \
  -p 3000:3000 \
  -e SESSION_SECRET='replace-me' \
  -e VULNLEDGER_BACKUP_PASSWORD='optional-backup-password' \
  -v $(pwd)/data:/app/data \
  vuln-ledger
```

Danach ist die UI erreichbar unter:

- `http://<server-ip>:3000`

## Datenhaltung

VulnLedger unterstützt zwei Backends:

- `lowdb`
- `sqlite`

Die Umschaltung erfolgt im Admin-Bereich. Der aktuelle Stand wird beim Wechsel migriert.

## Backups

- Backup-Konfiguration im Admin-Bereich
- manuelle Backup-Ausführung
- Retention für hourly/daily/weekly/monthly/yearly
- optionale Verschlüsselung über Laufzeit-Passwort

## Evidence-Uploads

Evidence kann als Text oder Datei gespeichert werden.

- Textbasierte Evidence direkt im Finding-Workflow
- Datei-Uploads mit Serverablage
- Download/Öffnen über die App

## Unraid

Eine ausführliche Schritt-für-Schritt-Anleitung findest du in:

- `unraid.md`

## Projektlinks

- GitHub Repo: `https://github.com/Nehil1984/vuln-ledger`
- Unraid Template: `unraid-template.xml`

## Roadmap

Empfohlene nächste Schritte:

1. DB-Migrationshärtung weiter ausbauen
2. Evidence-Vorschau für Bilder verbessern
3. Report-Export/Rendering auf professionelles Format anheben
4. Benutzer-/Rechtemodell weiter verfeinern
