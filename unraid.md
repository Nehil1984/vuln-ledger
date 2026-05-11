<!-- Copyright 2026 Daniel Schuh | Licensed under Apache License 2.0 -->

# VulnLedger auf Unraid – ausführliche Docker-Anleitung

Diese Anleitung beschreibt den **kompletten Aufbau und die empfohlene Konfiguration** von VulnLedger auf Unraid. Ziel ist eine saubere, persistente und nachvollziehbare Docker-Einbindung inklusive Web-UI, Datenhaltung, Backups, Login, Ports, Host-Mounts und typischer Fehlerquellen.

---

## 1. Zielbild

VulnLedger läuft in Unraid als Docker-Container.

Dabei gilt grundsätzlich:

- **Container-Image:** liefert die Anwendung
- **Unraid Docker-Konfiguration:** definiert Ports, Umgebungsvariablen und Mounts
- **Host-Pfad in Unraid:** speichert alle persistenten Daten dauerhaft außerhalb des Containers
- **Web-UI:** wird über den von dir gemappten Host-Port im Browser geöffnet

Wichtig: Der Container selbst ist **nicht** der Ort für dauerhafte Daten. Dauerhafte Daten müssen in Unraid immer über einen Host-Pfad auf einen Container-Pfad gemappt werden.

---

## 2. Verwendetes Image

Standardmäßig wird das offizielle GHCR-Image verwendet:

```text
ghcr.io/nehil1984/vuln-ledger:latest
```

Wenn du lieber eine feste Version verwenden willst, kannst du später auch einen versionsbezogenen Tag nutzen, sobald du diesen gezielt ausrollst.

---

## 3. Interner Aufbau der App im Container

### Wichtige interne Pfade

#### Anwendung / App-Code
Der eigentliche App-Code liegt im Container unter `/app`.

#### Persistente Daten
Der wichtigste Pfad für Unraid ist:

```text
/app/data
```

Dort speichert VulnLedger unter anderem:

- DB-Backend-Konfiguration
- lowdb-Daten
- SQLite-Daten
- Evidence-Dateien
- Backup-Dateien
- weitere laufzeitbezogene Daten

### Typische Dateien / Verzeichnisse unter `/app/data`

Je nach Nutzung können dort z. B. entstehen:

```text
/app/data/db-config.json
/app/data/vulnledger.lowdb.json
/app/data/vulnledger.sqlite
/app/data/evidence/
/app/data/backups/
```

Diese Daten **müssen** in Unraid auf einen Host-Pfad gemappt werden, damit sie Container-Neustarts und Image-Updates überleben.

---

## 4. Empfohlener Host-Pfad in Unraid

Empfohlenes persistentes Verzeichnis auf dem Unraid-Host:

```text
/mnt/user/appdata/vuln-ledger
```

Das ist der zentrale Speicherort für die komplette laufende Instanz.

### Empfohlenes Mapping

- **Host Path:** `/mnt/user/appdata/vuln-ledger`
- **Container Path:** `/app/data`

Dieses Mapping ist der wichtigste Teil der Unraid-Konfiguration.

---

## 5. Ports – wie die App erreichbar ist

VulnLedger hört **im Container auf Port 3000**.

Das bedeutet:

- **Container-Port:** `3000`
- **Host-Port:** frei wählbar in Unraid

### Empfohlene Port-Konfiguration

- **Host-Port:** `3000`
- **Container-Port:** `3000`
- **Protocol:** `TCP`

### Beispiel
Wenn du in Unraid so mappst:

- Host `3000` → Container `3000`

ist die App erreichbar unter:

```text
http://<UNRAID-IP>:3000
```

### Falls Port 3000 belegt ist
Dann kannst du z. B. folgendes verwenden:

- Host `3010` → Container `3000`

Dann lautet der Browser-Aufruf:

```text
http://<UNRAID-IP>:3010
```

### Merksatz
Die App läuft **intern immer auf 3000**. Im Browser verwendest du den **Host-Port**, den du in Unraid gesetzt hast.

---

## 6. WebUI in Unraid

In der Unraid-Containerdefinition sollte die WebUI so gesetzt werden:

```text
http://[IP]:[PORT:3000]
```

Wenn du als Host-Port `3010` verwendest, öffnet Unraid entsprechend:

```text
http://<UNRAID-IP>:3010
```

---

## 7. Container in Unraid anlegen

Du hast zwei Wege.

### Variante A – per Template/XML

1. Öffne in Unraid den Bereich **Docker**
2. Wähle **Add Container**
3. Importiere oder verwende das vorbereitete `unraid-template.xml`
4. Prüfe danach trotzdem die finalen Werte für Ports, Pfade und Variablen

### Variante B – manuell

Wenn du den Container manuell anlegst, verwende diese Grundwerte:

- **Name:** `VulnLedger`
- **Repository:** `ghcr.io/nehil1984/vuln-ledger:latest`
- **Network Type:** `bridge`
- **Console shell:** `sh`
- **Privileged:** `false`

---

## 8. Umgebungsvariablen

Folgende Variablen sind relevant.

### 8.1 `SESSION_SECRET`
Pflicht für eine saubere Session-Sicherheit.

Beispiel:

```text
SESSION_SECRET=mein-langer-zufallswert
```

Empfehlung:
- lang
- zufällig
- nicht trivial
- nicht mehrfach für andere Apps wiederverwenden

---

### 8.2 `VULNLEDGER_BACKUP_PASSWORD`
Optional, aber empfohlen, wenn du verschlüsselte Backups nutzen willst.

Beispiel:

```text
VULNLEDGER_BACKUP_PASSWORD=mein-backup-passwort
```

Wenn du Backup-Verschlüsselung in der App aktivierst, sollte diese Variable gesetzt sein.

---

### 8.3 `ADMIN_USERNAME`
Optional für den initialen Standard-Admin.

Beispiel:

```text
ADMIN_USERNAME=admin
```

---

### 8.4 `ADMIN_PASSWORD`
Optional für das initiale Standard-Admin-Passwort.

Beispiel:

```text
ADMIN_PASSWORD=ein-sehr-sicheres-passwort
```

Wenn du diese Variablen **nicht** setzt, gelten die Defaults beim ersten Start:

- **Benutzername:** `admin`
- **Passwort:** `admin123!`

Wichtig: Diese Defaults solltest du produktiv **nicht** dauerhaft so lassen.

---

### 8.5 `DB_BACKEND` (optional)
Wenn gesetzt, kann das Backend zur Laufzeit vorgegeben werden:

- `lowdb`
- `sqlite`

Beispiel:

```text
DB_BACKEND=sqlite
```

Wenn du es nicht setzt, entscheidet VulnLedger anhand der gespeicherten Konfiguration bzw. des Standardverhaltens.

---

## 9. Datenbank-Backends

VulnLedger unterstützt aktuell:

- **lowdb**
- **sqlite**

### lowdb
Vorteile:
- simpel
- schnell für Tests und kleine Instanzen
- leicht lesbar

Nachteile:
- nicht die beste Wahl für dauerhaft professionellen Betrieb

### SQLite
Vorteile:
- robuster für produktivere Nutzung
- saubere Datei-basierte Datenbank
- besser für wachsende Datenbestände

Empfehlung:

- **Test / schnelle lokale Nutzung:** `lowdb`
- **produktiverer Betrieb:** `sqlite`

---

## 10. Login / erster Start

### Standard-Login ohne ENV-Override
Wenn keine eigenen Admin-Variablen gesetzt wurden:

```text
Benutzername: admin
Passwort: admin123!
```

### Wenn ENV gesetzt wurde
Dann gelten die Werte aus:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

### Empfehlung nach Erstlogin
Nach dem ersten erfolgreichen Login solltest du:

1. das Passwort ändern bzw. einen neuen Admin anlegen
2. prüfen, welches DB-Backend aktiv ist
3. einen Backup-Plan konfigurieren

---

## 11. Backup-Struktur

Backups werden im Datenpfad unter `/app/data` abgelegt.

Dadurch landen sie bei richtigem Mapping auf dem Host automatisch unter deinem Unraid-AppData-Pfad.

Beispiel:

```text
/mnt/user/appdata/vuln-ledger/backups
```

### In der App konfigurierbar
Im Admin-/System-Bereich kannst du:

- Scheduler aktivieren
- Retention festlegen
- Verschlüsselung aktivieren
- manuelle Backups anstoßen

Wenn du verschlüsselte Backups willst, setze zusätzlich:

```text
VULNLEDGER_BACKUP_PASSWORD
```

---

## 12. Evidence-Dateien / Uploads

Evidence-Uploads werden ebenfalls im Datenbereich gespeichert.

Beispiel intern:

```text
/app/data/evidence
```

Beispiel auf dem Unraid-Host bei empfohlenem Mapping:

```text
/mnt/user/appdata/vuln-ledger/evidence
```

Das ist wichtig, damit hochgeladene Dateien nach Container-Neustarts erhalten bleiben.

---

## 13. Konkrete Beispielkonfiguration für Unraid

### Repository

```text
ghcr.io/nehil1984/vuln-ledger:latest
```

### Ports

- **Host-Port:** `3000`
- **Container-Port:** `3000`
- **Protokoll:** `TCP`

### Pfad-Mapping

- **Host:** `/mnt/user/appdata/vuln-ledger`
- **Container:** `/app/data`

### Umgebungsvariablen

```text
SESSION_SECRET=mein-zufallswert
VULNLEDGER_BACKUP_PASSWORD=mein-backup-passwort
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ein-sicheres-passwort
DB_BACKEND=sqlite
```

### WebUI

```text
http://[IP]:[PORT:3000]
```

---

## 14. Ablauf für die Erstinbetriebnahme

### Schritt 1 – Image eintragen
Verwende:

```text
ghcr.io/nehil1984/vuln-ledger:latest
```

### Schritt 2 – Port konfigurieren
Setze:

- Host `3000`
- Container `3000`

### Schritt 3 – persistenten Mount setzen
Setze:

- Host `/mnt/user/appdata/vuln-ledger`
- Container `/app/data`

### Schritt 4 – ENV setzen
Mindestens:

- `SESSION_SECRET`

empfohlen zusätzlich:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `VULNLEDGER_BACKUP_PASSWORD`
- `DB_BACKEND=sqlite`

### Schritt 5 – Container starten
Danach die UI öffnen.

### Schritt 6 – Login
Mit deinen gesetzten Admin-Daten oder den Defaults anmelden.

### Schritt 7 – System prüfen
Im Admin-/System-Bereich prüfen:

- Version
- aktives Backend
- Backup-Konfiguration
- Lizenztext

---

## 15. Updates in Unraid

Wenn du eine neue Version ausrollen willst:

1. Container stoppen
2. neues Image ziehen
3. Container neu starten

Da die Daten unter `/app/data` auf einen Host-Pfad gemappt sind, bleiben sie erhalten.

Wichtig: Nicht den Datenpfad löschen, wenn du deine Instanz behalten willst.

---

## 16. Häufige Fehler und Ursachen

### 16.1 WebUI zeigt nichts / Datei nicht gefunden
Mögliche Ursache:
- altes Image ohne aktuellen Fix

Lösung:
- Image neu ziehen
- Container neu starten

---

### 16.2 Login funktioniert nicht
Prüfen:
- wurde `ADMIN_PASSWORD` gesetzt?
- verwendest du wirklich die aktuellen Zugangsdaten?
- läuft lowdb oder sqlite?
- ist schon ein bestehender persistenter Datenbestand vorhanden?

Wenn bereits Daten im Host-Pfad liegen, gelten die darin gespeicherten Benutzer – nicht zwingend die dokumentierten Defaults eines frischen Starts.

---

### 16.3 Daten nach Neustart weg
Fast immer ein Mount-Problem.

Prüfe:

- wurde `/app/data` wirklich gemappt?
- zeigt der Host-Pfad auf ein persistentes Verzeichnis?
- wurde der Container vielleicht ohne Path-Mapping erstellt?

---

### 16.4 Evidence-Uploads verschwinden
Auch das deutet fast immer auf fehlendes oder falsches Mapping von `/app/data` hin.

---

### 16.5 Backup funktioniert nicht wie erwartet
Prüfe:

- Schreibrechte im Host-Pfad
- gesetztes `VULNLEDGER_BACKUP_PASSWORD`, falls Verschlüsselung aktiv ist
- Backend-Status im Admin-Bereich

---

## 17. Empfehlung für produktiveren Betrieb

Für einen professionelleren Einsatz empfehle ich:

- starkes eigenes `SESSION_SECRET`
- eigenes starkes `ADMIN_PASSWORD`
- `sqlite` als Backend
- Backup-Scheduler aktivieren
- Reverse Proxy mit HTTPS davor setzen
- regelmäßige Image-Updates
- persistentes AppData-Verzeichnis sauber dokumentieren

---

## 18. Kurzfassung – die wichtigsten Werte

### Wichtigster Container-Pfad

```text
/app/data
```

### Empfohlener Host-Pfad

```text
/mnt/user/appdata/vuln-ledger
```

### Standard-Port im Container

```text
3000
```

### Browser-Zugriff bei Standard-Mapping

```text
http://<UNRAID-IP>:3000
```

### Standard-Login bei frischem Start ohne Overrides

```text
admin / admin123!
```

---

## 19. Fazit

Wenn du für Unraid nur die drei wichtigsten Dinge sauber setzt, läuft VulnLedger stabil:

1. **Repository korrekt**
2. **Port 3000 korrekt mappen**
3. **`/app/data` persistent auf den Host mounten**

Der wichtigste technische Punkt ist und bleibt:

```text
Host-Pfad  ->  /app/data
```

Ohne diesen Mount verlierst du Daten, Uploads, DB-Dateien und Backups beim Containerwechsel oder Neustart.
