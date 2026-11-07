# Pfadi-App · Lagerplaner

Ein Dashboard für die Lagerplanung: **Programm aus eCamp v3**, **Termine, TN- und Leiterlisten und Ablage aus Google Drive** – an einem Ort, mit Google-Login nur für `@pfadis.ch`.

Drive bleibt die Quelle: Die App liest die bestehenden xlsx/csv/Google-Sheets und zeigt sie schöner an. Es gibt keine eigene Datenbank.

| Bereich | Quelle | Was die App macht |
|---|---|---|
| **Alle Lager** | `camps.json` + in der App angelegte | Alle Lager mit Daten und Countdown, «aktuelles Lager» pro Person wählen, neues Lager aus der Vorlage anlegen |
| **Übersicht** | alles | Countdown, nächste Fristen, Zahlen, Ressort-Kacheln |
| **Termine** | `Lagerdaten.xlsx` | Timeline mit rot (überfällig) / orange (≤ 14 Tage), Filter nach «Wer», Abhaken schreibt `x` in die Spalte «Erledigt» |
| **Teilnehmende & Leitende** | Liste oder Ordner im Drive | Karten/Tabelle, Suche, Filter nach Stufe, Hinweise (Allergien, Medis) hervorgehoben, Alter am Lagerbeginn, CSV-Export |
| **Programm** | eCamp (nur lesen) | Blöcke pro Tag, nach Kategorie (Wölfli/Pfadi/Pio …) filterbar, Lagerteam |
| **Budget & Abrechnung** | Budget-xlsx im Drive (Vorlage PBS / Region Seldwyla) | Budget vs. Abrechnung pro Bereich, blaue (Budget) und grüne (Abrechnung) Felder direkt bearbeiten, Buchungen im Finanzjournal erfassen, ändern und löschen |
| **Ablage** | Lagerordner im Drive | Ordnerstruktur `NN_Thema (Verantwortlich)` als Ressorts mit Verantwortlichen |

## Datenschutz

Die App greift **mit dem Google-Konto der angemeldeten Person** auf den Drive zu. Wer eine TN-Liste im Drive nicht öffnen darf, sieht sie auch in der App nicht. Es werden keine Personendaten gespeichert; der CSV-Export passiert nur im Browser.

## Einrichtung

### 1. Google OAuth-Client

1. [Google Cloud Console](https://console.cloud.google.com/) mit einem `@pfadis.ch`-Konto öffnen, Projekt anlegen.
2. **APIs & Dienste → Bibliothek**: *Google Drive API* aktivieren.
3. **OAuth-Zustimmungsbildschirm**: Nutzertyp **Intern** (dann dürfen nur Konten eurer Organisation rein, und der Drive-Scope braucht keine Google-Prüfung).
4. **Anmeldedaten → OAuth-Client-ID → Webanwendung**
   - Autorisierte Weiterleitungs-URI: `https://<eure-domain>/api/auth/callback/google` (lokal: `http://localhost:3000/api/auth/callback/google`)
5. Client-ID und Secret in `.env` eintragen.

### 2. eCamp (optional)

Einen technischen eCamp-Account erstellen (z. B. `lagerplaner@pfadis.ch`) und ihn in jedem Lager als **Gast** einladen. Zugangsdaten in `.env` setzen. Die Lager-ID steht in der eCamp-URL: `app.ecamp3.ch/camps/<ID>/…`.

### 3. Lager konfigurieren

```bash
cp .env.example .env                       # ausfüllen, AUTH_SECRET: openssl rand -base64 32
cp config/camps.example.json config/camps.json
```

In `config/camps.json` pro Lager die Drive-IDs eintragen (die ID ist der letzte Teil der Drive-URL):

- `rootFolderId` – der Lagerordner, z. B. `02_Sola 27`
- `termineFileId` – `Lagerdaten.xlsx`
- `tnFileId` / `leiterFileId` – eine Datei **oder** ein Ordner (dann wird die neueste Tabelle darin genommen, praktisch für `121_TN Liste`)
- `budgetFileId` – die Budget-/Abrechnungs-xlsx **oder** ihr Ordner (dann die neueste Tabelle mit «Budget» oder «Abrechnung» im Namen)
- `ecampCampId` – optional
- `writeBack` – `true` erlaubt das Abhaken von Terminen direkt in der xlsx (Drive behält alte Versionen im Versionsverlauf)

Weitere Lager (z. B. HeLa 27) einfach als weiteres Objekt in `camps` ergänzen – keine Neuinstallation nötig.

#### Neues Lager in der App anlegen

Unter **Alle Lager → Neues Lager anlegen** kopiert die App die Ordnerstruktur der Vorlage (`templateFolderId` in `camps.json`, im Formular änderbar) samt Dateien in einen Drive-Ordner deiner Wahl – mit deinem Google-Konto, du brauchst also Leserechte auf die Vorlage und Schreibrechte am Zielort. Lagerdaten, TN- und Leiterliste werden in der Kopie am Namen erkannt.

In der App angelegte Lager speichert sie in `/app/data/camps.json` (Docker-Volume `app_data`), weil `config/camps.json` nur lesend eingebunden ist. Ändern: `docker compose exec app vi /app/data/camps.json` – oder den Eintrag nach `config/camps.json` übernehmen; bei gleichem `slug` gewinnt `config/camps.json`.

`/` öffnet das Lager, das du unter «Alle Lager» als aktuell gewählt hast (gespeichert als Cookie in deinem Browser), sonst das laufende oder nächste.

Das Budget schreibt die App **zellgenau** in die xlsx: Nur die geänderten Zellen werden ersetzt, alles andere (Dropdown im Finanzjournal, Formatierung, Logos) bleibt unverändert, und Excel rechnet beim Öffnen neu. Die Summen in der App berechnet sie selbst aus den Formeln der Datei. Google Sheets werden fürs Budget nicht unterstützt.

Die TN-/Leiterlisten dürfen beliebige Spalten haben (MiData-Export, Anmeldeformular …). Spalten wie *Vorname, Nachname, Pfadiname/Übername, Stufe, Geburtsdatum, Telefon, E-Mail* werden automatisch erkannt; Spalten mit *Allergie, Medikamente, Unverträglichkeit, Bemerkung …* werden als Hinweise hervorgehoben.

### 4. Starten

```bash
docker compose up -d --build
# → http://localhost:3000
```

Mit automatischem HTTPS (Caddy, Domain muss auf den Server zeigen):

```bash
echo "DOMAIN=lager.pfadis.ch" >> .env      # und AUTH_URL=https://lager.pfadis.ch
docker compose --profile https up -d --build
```

Entwicklung ohne Docker: `npm install && npm run dev`.

## Aufbau

```
auth.ts                 Google-Login (Domain-Check, Token-Refresh)
proxy.ts                schützt alle Seiten
lib/config.ts           liest config/camps.json
lib/drive.ts            Drive-Zugriff als angemeldete Person
lib/tables.ts           xlsx/csv → Termine & Personen
lib/ecamp.ts            eCamp v3 HAL-API (nur lesen)
lib/budget.ts           Budget-xlsx → Budget, Abrechnung, Finanzjournal
lib/formula.ts          kleiner Excel-Formelrechner (SUM, SUMIF, MROUND …)
lib/xlsxpatch.ts        einzelne Zellen in eine xlsx schreiben, ohne den Rest anzufassen
app/[camp]/…            Seiten: Übersicht, Termine, Personen, Programm, Ablage
```
