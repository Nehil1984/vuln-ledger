# VulnLedger – Fachliche Architektur (MVP)

## 1. Produktziel

VulnLedger dient der strukturierten Dokumentation von Penetration Tests, Red-Team-Assessments und technischen Sicherheitsprüfungen.

Der MVP soll nicht primär Scanner ersetzen, sondern den Arbeitsprozess für Prüfer und Berichtserstellung abbilden.

---

## 2. Kernobjekte / Datenmodell

### 2.1 Kunde

Beschreibt den Auftraggeber.

**Felder:**
- `id`
- `name`
- `branche`
- `ansprechpartnerName`
- `ansprechpartnerEmail`
- `ansprechpartnerTelefon`
- `notizen`
- `createdAt`
- `updatedAt`

### 2.2 Assessment

Beschreibt einen konkreten Pentest oder ein Security-Assessment.

**Felder:**
- `id`
- `kundeId`
- `titel`
- `beschreibung`
- `testTyp` (Web, API, Infrastruktur, Mobile, Internal, External, Red Team, Config Review)
- `ansatz` (Blackbox, Greybox, Whitebox)
- `status` (Draft, Geplant, Aktiv, Review, Final, Abgeschlossen)
- `startDatum`
- `endDatum`
- `reportDatum`
- `leadTester`
- `teamMitglieder[]`
- `kritikalitaetGeschaeftlich`
- `rulesOfEngagement`
- `kommunikationskanal`
- `notfallkontakt`
- `createdAt`
- `updatedAt`

### 2.3 ScopeTarget

Definiert die konkreten Ziele innerhalb eines Assessments.

**Felder:**
- `id`
- `assessmentId`
- `typ` (Domain, URL, IP, CIDR, Hostname, Mobile App, API, WLAN, Sonstiges)
- `wert`
- `beschreibung`
- `inScope` (boolean)
- `kritisch` (boolean)
- `testFenster`
- `hinweise`

### 2.4 Finding

Zentrales Objekt für Schwachstellen.

**Felder:**
- `id`
- `assessmentId`
- `referenz` (z. B. VL-2026-0001)
- `titel`
- `kategorie`
- `status` (Offen, Bestätigt, In Bearbeitung, Behoben, Risiko Akzeptiert, Nicht Reproduzierbar)
- `severity` (Info, Low, Medium, High, Critical)
- `cvssVector`
- `cvssScore`
- `cweId`
- `owaspKategorie`
- `betroffenesTargetId`
- `beschreibung`
- `technischerBefund`
- `reproduktionsschritte`
- `auswirkung`
- `empfehlung`
- `workaround`
- `voraussetzungen`
- `entdecktAm`
- `retestStatus` (Nicht geprüft, Offen, Teilweise behoben, Behoben)
- `retetstNotiz`
- `createdAt`
- `updatedAt`

### 2.5 Evidence

Artefakte und Nachweise zu Findings oder Scope-Targets.

**Felder:**
- `id`
- `assessmentId`
- `findingId`
- `typ` (Screenshot, Request, Response, Terminal, Datei, Notiz)
- `titel`
- `beschreibung`
- `dateiPfad`
- `mimeType`
- `textInhalt`
- `hash`
- `sensitivitaet` (Normal, Intern, Vertraulich)
- `createdAt`

### 2.6 Retest

Retest-Durchläufe zu Findings.

**Felder:**
- `id`
- `assessmentId`
- `findingId`
- `datum`
- `tester`
- `ergebnis` (Offen, Teilweise behoben, Behoben, Nicht reproduzierbar)
- `notiz`
- `evidenceIds[]`

### 2.7 Report

Repräsentiert den fachlichen Berichtszustand.

**Felder:**
- `id`
- `assessmentId`
- `titel`
- `version`
- `status` (Draft, Internes Review, Freigegeben, Exportiert)
- `executiveSummary`
- `methodik`
- `managementSummary`
- `abschlussbemerkung`
- `createdAt`
- `updatedAt`

---

## 3. Seitenstruktur (MVP)

### 3.1 Dashboard
- Offene Assessments
- Kritische Findings
- Retests offen
- Kürzlich geänderte Projekte

### 3.2 Kunden
- Kundenliste
- Kundendetail
- Ansprechpartner / Notizen

### 3.3 Assessments
- Assessment-Liste
- Assessment-Detail
- Scope
- Rules of Engagement
- Team / Zeitraum / Status

### 3.4 Findings
- Liste mit Filtern
- Detailansicht
- CVSS / CWE / Status / Evidence-Verknüpfung

### 3.5 Evidence
- Artefaktliste je Assessment oder Finding
- Vorschau / Textnachweise / Upload-Metadaten

### 3.6 Reports
- Berichtsdraft
- Executive Summary
- exportfähige Struktur

### 3.7 Einstellungen
- Severity-Modell
- Standardtexte
- Finding-Templates

---

## 4. Empfohlener MVP-Workflow

1. Kunde anlegen
2. Assessment anlegen
3. Scope und Rules of Engagement erfassen
4. Findings dokumentieren
5. Evidence anhängen
6. Retest-Status pflegen
7. Bericht vorbereiten

---

## 5. Spätere Ausbaustufen

### Phase 2
- Benutzer / Rollen / Mandantenfähigkeit
- Dateiuploads mit echter Ablage
- Berichtsexport als PDF/HTML
- Vorlagen für Standardfindings

### Phase 3
- CVSS-Rechner
- CWE/CAPEC/OWASP-Mapping
- Dashboard-Heatmaps
- API-Import aus Tools (z. B. Burp / Nmap / ZAP)
- Freigabe- und Review-Workflow

---

## 6. Technische Empfehlung für die nächste Umsetzung

### Frontend zuerst
- Navigation
- Seitenlayout
- Mock-Daten
- Form-Flows

### Danach Backend
- API
- Persistenz
- Uploads
- Authentifizierung

Das reduziert Reibung und erlaubt frühe fachliche Validierung.
