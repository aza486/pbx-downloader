# Versionsverlauf

## 1.0.1 – Generische Veröffentlichung

- Instanznamen aus Quelltext, Manifest und Tests entfernt; ausschließlich Beispieldomains in Beispielen und Tests.
- Instanzen zentral über eine lokale, von Git ignorierte `config.local.json` konfigurierbar.
- Keine fest vorgegebenen Hostberechtigungen; Zugriff auf die konfigurierte Instanz und benötigte Bildserver erst nach Benutzeraktion.
- Verständlicher Hinweis bei Start auf einer ungeeigneten Seite statt „Invalid URL“.
- Installations-, Update- und Veröffentlichungshinweise für ein eigenständiges Repository.

## 1.0.0

- Downloadordner pro Projekt zuverlässig zugewiesen.
- Abbruch und Schließen des Downloader-Tabs beenden zugehörige Vorgänge.
- Hintergrundverwaltung berücksichtigt Tab-Schließung während eines Downloadstarts.

## 0.3.0

- Lokale JXL-/WebP-Konvertierung nach PNG mit mitgeliefertem WebAssembly-Decoder.
- Vorhandene JPG- und PNG-Dateien werden unverändert gespeichert.
- Formatprüfung anhand der Dateisignatur und Größen-/Zeitlimits.

## 0.2.0

- Dunkles Design mit Violett-/Mint-Akzenten und eigenem App-Symbol.
- Formatvorgabe per Accept-Header und Dateiendungen nach MIME-Typ. Die Vorgabe allein genügte bei JXL-Antworten nicht.

## 0.1.0

- Erster Edge-Prototyp mit manuellem Login im normalen Browser.
- Projekt-UUID aus der Editor-URL, paginierte Bilderliste, Einzeltest und vollständiger Download.

Die Versionshistorie dokumentiert die Entwicklung. Ein Git-Commit-Verlauf existierte im ursprünglichen Arbeitsordner nicht und wird hier nicht nachträglich erfunden.
