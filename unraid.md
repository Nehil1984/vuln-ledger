<!-- Copyright 2026 Daniel Schuh | Licensed under Apache License 2.0 -->

# VulnLedger auf Unraid als Docker einbinden

Diese Anleitung zeigt dir Schritt für Schritt, wie du VulnLedger auf Unraid als Docker-Container einbindest – inklusive Web-UI-Zugriff und Logo/Icon.

---

## 1. Voraussetzungen

Du brauchst:

- einen laufenden Unraid-Server
- Docker in Unraid aktiviert
- Internetzugriff für Image-Pull oder ein lokal gebautes Image
- optional ein GitHub-Account / GHCR-Zugriff

---

## 2. Container-Image festlegen

Standard-Repository laut Template:

- `ghcr.io/nehil1984/vuln-ledger:latest`

Wenn du lokal selbst baust, kannst du alternativ dein eigenes Tag verwenden.

---

## 3. AppData-Verzeichnis planen

Lege für persistente Daten in Unraid ein Verzeichnis an, z. B.:

- `/mnt/user/appdata/vuln-ledger`

Darin liegen später u. a.:

- Datenbankdateien
- lowdb-Datei
- SQLite-Datei
- Backups
- Evidence-Dateien

---

## 4. Container in Unraid anlegen

### Variante A – über XML-Template

1. Öffne **Docker** in Unraid
2. Wähle **Add Container** oder importiere dein XML-Template
3. Nutze `unraid-template.xml` als Vorlage

### Variante B – manuell anlegen

Trage folgende Basiswerte ein:

- **Name:** `VulnLedger`
- **Repository:** `ghcr.io/nehil1984/vuln-ledger:latest`
- **Network Type:** `bridge`
- **Console shell:** `sh`

---

## 5. Port-Mapping setzen

Wichtig: VulnLedger läuft **im Container auf Port 3000**.

### Empfohlenes Mapping

- **Host-Port:** `3000`
- **Container-Port:** `3000`
- **Protocol:** `TCP`

Wenn Port `3000` auf Unraid schon belegt ist, kannst du z. B. nehmen:

- Host-Port `3010`
- Container-Port `3000`

Dann ist die UI erreichbar unter:

- `http://<UNRAID-IP>:3010`

---

## 6. Pfad-Mapping für persistente Daten

Lege ein Path-Mapping an:

- **Host Path:** `/mnt/user/appdata/vuln-ledger`
- **Container Path:** `/app/data`

So bleiben Daten und Uploads nach Neustarts erhalten.

---

## 7. Umgebungsvariablen setzen

Pflicht/empfohlen:

### `SESSION_SECRET`
Ein eigener geheimer Wert für Sessions.

Beispiel:

- `SESSION_SECRET=mein-langer-zufallswert`

### `VULNLEDGER_BACKUP_PASSWORD` (optional)
Nur nötig, wenn du verschlüsselte Backups willst.

Beispiel:

- `VULNLEDGER_BACKUP_PASSWORD=mein-backup-passwort`

### Optional: Standard-Admin beim ersten Start

- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=sehr-sicheres-passwort`

Wenn du das nicht setzt, sind die Defaults:

- Benutzername: `admin`
- Passwort: `admin123!`

---

## 8. Web-UI konfigurieren

In Unraid sollte die Web-UI so gesetzt sein:

- `http://[IP]:[PORT:3000]`

Wenn du als Host-Port z. B. `3010` nutzt, öffnet Unraid später:

- `http://<UNRAID-IP>:3010`

---

## 9. Logo / Icon hinterlegen

Im XML-Template ist bereits ein Icon vorgesehen.

Empfohlene Icon-URL:

- `https://raw.githubusercontent.com/Nehil1984/vuln-ledger/master/public/unraid-icon.png`

Falls du lokal lieber ein eigenes Icon nutzen willst:

1. Lege das Icon in ein erreichbares Verzeichnis oder Repo
2. Trage die URL im Template oder in den Container-Metadaten ein

---

## 10. Container starten

Nach dem Speichern:

1. Container starten
2. Unraid öffnet oder verlinkt die Web-UI
3. Im Browser anmelden

Standard-Login beim Erststart:

- Benutzername: `admin`
- Passwort: `admin123!`

Danach sofort ändern bzw. neuen Admin anlegen.

---

## 11. Erster Zugriff auf die UI

Nach erfolgreichem Start:

- Öffne `http://<UNRAID-IP>:3000`
  oder den von dir gemappten Host-Port

Du solltest sehen:

- Login-Seite von VulnLedger
- danach Dashboard
- Admin-Bereich für DB-Backend, Lizenz und Backups

---

## 12. Datenbank-Backend wählen

Nach dem Login im Admin-Bereich:

- zwischen `lowdb` und `sqlite` umschalten
- vorhandene Daten werden migriert

### Empfehlung

- Für Tests: `lowdb`
- Für produktiveren Betrieb: `sqlite`

---

## 13. Backups aktivieren

Im Admin-Bereich kannst du:

- Backup-Scheduler aktivieren
- Retention setzen
- Verschlüsselung aktivieren
- Backups manuell starten

Wenn Verschlüsselung aktiv sein soll, setze unbedingt:

- `VULNLEDGER_BACKUP_PASSWORD`

---

## 14. Evidence-Datei-Uploads

Evidence-Dateien werden im Datenpfad gespeichert, also unter deinem AppData-Mount.

Beispiel Host-Pfad:

- `/mnt/user/appdata/vuln-ledger/evidence`

Damit bleiben Uploads persistent erhalten.

---

## 15. Typische Fehlerquellen

### UI nicht erreichbar
Prüfe:

- richtiger Host-Port?
- Container-Port wirklich `3000`?
- Unraid-Firewall / Reverse Proxy dazwischen?

### Login klappt nicht
Prüfe:

- richtige Zugangsdaten
- ob `ADMIN_PASSWORD` gesetzt wurde
- Container-Logs

### Daten nach Neustart weg
Prüfe:

- ob `/app/data` korrekt auf `/mnt/user/appdata/vuln-ledger` gemappt ist

---

## 16. Empfehlung für den Produktivbetrieb

- eigenes starkes `SESSION_SECRET`
- eigenes Admin-Passwort setzen
- `sqlite` verwenden
- Backups aktivieren
- App hinter Reverse Proxy mit HTTPS veröffentlichen

---

## 17. Kurzkonfiguration (Beispiel)

### Repository
- `ghcr.io/nehil1984/vuln-ledger:latest`

### Ports
- Host: `3000`
- Container: `3000`

### Pfade
- Host: `/mnt/user/appdata/vuln-ledger`
- Container: `/app/data`

### Variablen
- `SESSION_SECRET=mein-zufallswert`
- `VULNLEDGER_BACKUP_PASSWORD=mein-backup-passwort`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=ein-sicheres-passwort`

### WebUI
- `http://[IP]:[PORT:3000]`

---

Wenn du willst, kann ich dir als Nächstes auch noch das **`unraid-template.xml` direkt auf den nun korrekten Container-Port 3000 und die bessere WebUI/Path-Defaults anpassen**.
