# Persoenliche Regeln

## Fortschritt protokollieren (progress.db)

Beim Arbeiten in jedem Repo gilt: **Fortschritt, Entscheidungen, Todos und Blocker
werden dauerhaft in `~/.progress/progress.db` protokolliert.** Nutze dafuer den
Skill `progress` (Kommandos: `progress init`, `progress context <name>`,
`progress log --type ... --summary ...`, `progress read`, `progress status`,
`progress serve`).

- Bei jedem Meilenstein oder Task-Abschluss automatisch loggen, nicht erst auf Aufforderung warten.
- Zu Beginn einer neuen Aufgabe im Repo: `progress init` und ggf. `progress context "<Thema>"`.
- Bevor begonnene Arbeit fortgesetzt wird (z.B. nach Kontextverlust): erst den Stand per `progress status` / `progress read` rekonstruieren.
