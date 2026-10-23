---
name: progress
description: Protokolliert den Arbeitsfortschritt dauerhaft in ~/.progress/progress.db und liest ihn wieder aus, wenn der Kontext fehlt. Nutze diesen Skill IMMER, wenn du in einem Repo arbeitest und Fortschritt, Entscheidungen, Todos oder Blocker festhalten willst, oder wenn du den bisherigen Stand rekonstruieren musst (z.B. nach einem Kontextverlust). Struktur: Repo (Bereich) -> Kontext -> Session -> Eintraege (Typ + Status + Summary + Text). Startet eine Web-UI zum Durchstoebern unter http://localhost:8017. Ausloeser: "logge das", "protokolliere", "Fortschritt speichern", "Meilenstein", "was war der Stand?", "Kontext verloren", "progress.db".
---

# Progress-Tracker

Persistiert den Arbeitsfortschritt jedes Repos in einer zentralen SQLite-Datenbank
(`~/.progress/progress.db`, ueberschreibbar ueber `PROGRESS_DB`). Zweck: Wenn der
Kontext verloren geht, kann der bisherige Stand jederzeit wiederhergestellt werden,
indem die Eintraege aus der DB gelesen werden.

## Wann dieser Skill greift

- Der User arbeitet an einer Aufgabe und ein Schritt ist abgeschlossen -> logge ihn.
- Eine Entscheidung faellt oder ein Blocker taucht auf -> logge ihn.
- Der Kontext ist verloren oder der User fragt nach dem Stand -> lies die DB aus.
- Der User will den Fortschritt sehen -> starte die Web-UI.

Der Skill ist fuer eine feste Einbettung in den Workflow gedacht: **nicht auf einen
expliziten Befehl warten**. Bei jedem Meilenstein/Task-Abschluss automatisch loggen.

## Datenmodell

```
Repo (Bereich)  --1:n-->  Kontext  --1:n-->  Session  --1:n-->  Eintrag
```

- **Repo** = ein Git-Repository, identifiziert ueber seinen absoluten Pfad.
- **Kontext** = ein Thema/Feature innerhalb des Repos (z.B. "MCP fuer GitHub").
  Der aktuell aktive Kontext pro Repo wird gemerkt.
- **Session** = eine Arbeits-Session innerhalb eines Kontexts. Pro Kontext ist
  hoechstens eine Session offen.
- **Eintrag** = der eigentliche Log. Felder:
  - `type`: `todo` | `entscheidung` | `fortschritt` | `blocker`
  - `status`: `offen` | `erledigt` | `blockiert`
  - `summary`: kurze Zeile
  - `text`: optionaler Volltext

## Kommandozeilen-Tool

Alle Operationen laufen ueber den Wrapper `progress` (auf dem PATH via
`~/.local/bin/progress`, darunter Python-Standardbibliothek). Fallback, falls der
Wrapper fehlt: `python3 ~/.claude/skills/progress/scripts/progress.py`.

```bash
progress <subkommando> ...
```

| Kommando | Zweck |
| --- | --- |
| `progress init` | DB anlegen (idempotent), aktuelles Repo registrieren, Stand anzeigen |
| `progress context "Name" [--description ...] [--status ...]` | Kontext anlegen **oder** auswaehlen und aktiv setzen |
| `progress contexts` | Kontexte des aktuellen Repos auflisten |
| `progress session start\|end [--summary ...]` | Session verwalten |
| `progress session status` | Status der offenen Session |
| `progress log --type T --summary "..." [--text "..."] [--status S] [--context NAME]` | Eintrag schreiben |
| `progress read [--context NAME] [--type T] [--status S] [--search Q] [--limit N] [--all] [--json]` | Eintraege lesen |
| `progress status` | aktuellen Stand (Repo/Kontext/Session + letzte Eintraege) |
| `progress summary` | JSON-Uebersicht aller Repos/Kontexte |
| `progress serve [--port 8017]` | Web-UI starten (read-only, Suche + Filter) |

## Workflow

### 1. Zu Beginn jeder Arbeit im Repo

```bash
progress init
```

Registriert das Repo (anhand des Git-Roots) und zeigt den aktuellen Kontext samt
offener Session. Das ist idempotent und kostet nichts, wenn schon alles da ist.

### 2. Beim Start eines neuen Themas

```bash
progress context "Name des Themas" --description "Was ist das Ziel?"
```

Das legt den Kontext an (falls neu) und macht ihn aktiv. Eine Session wird beim
ersten Log automatisch gestartet; explizit starten ist optional:
`progress session start --summary "..."`.

### 3. Bei jedem Meilenstein / Task-Abschluss

```bash
progress log --type fortschritt --summary "Feature X implementiert" --text "Details..."
```

Typ-Wahl (mit sinnvollem Default-Status, der per `--status` ueberschreibbar ist):

- `fortschritt` -> Status `erledigt` (etwas ist fertig geworden)
- `entscheidung` -> Status `erledigt` (eine Entscheidung ist gefallen)
- `todo` -> Status `offen` (offene Arbeit notieren)
- `blocker` -> Status `blockiert` (etwas blockiert die Arbeit)

Beispiel fuer mehrzeiligen Text ueber stdin:
`echo "..." | progress log --type entscheidung --summary "..." --text -`

### 4. Wenn Kontext fehlt oder der Stand unklar ist

```bash
progress status          # aktueller Kontext + letzte 10 Eintraege
progress read            # alle Eintraege des aktuellen Repos (neueste zuerst)
progress read --context "Thema" --search "Stichwort"
progress summary         # JSON-Uebersicht aller Repos/Kontexte
```

Lies die DB **bevor** du eine bereits begonnene Arbeit neu anfaengst. So wird
verhindert, dass verlorener Kontext zu doppelter oder falscher Arbeit fuehrt.

### 5. Web-UI zum Durchstoebern

```bash
progress serve --port 8017
```

Oeffne http://localhost:8017 im Browser. Read-only Ansicht mit Filtern nach
Repo, Kontext, Typ, Status und Volltextsuche. Im Hintergrund laufen lassen
(`nohup ... &`) oder im Vordergrund; beenden mit `Ctrl-C`.

## Regeln

- `type` und `status` verwenden exakt die Werte aus der Liste oben (klein,
  ohne Umlaute), damit Filter und Web-UI sauber funktionieren.
- Summary kurz und aussagekraeftig halten; Details in `text`.
- Der Skill schreibt **nur** an die DB; er veraendert keine Dateien im Repo.
- Beim Lesen immer den aktuellen Repo-Kontext beachten: ohne `--repo`/`--all`
  gilt das Repo, in dem das Skript laeuft.
