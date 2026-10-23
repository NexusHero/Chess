#!/usr/bin/env python3
"""Progress-Tracker.

Persistiert den Arbeitsfortschritt dauerhaft in einer SQLite-Datenbank
(Standard: ~/.progress/progress.db, ueberschreibbar ueber PROGRESS_DB).

Datenmodell (Hierarchie):
    Repo (Bereich) -> Kontext -> Session -> Eintraege

Ein Eintrag hat: Typ (todo | entscheidung | fortschritt | blocker),
Status (offen | erledigt | blockiert), Summary und optionalen Volltext.

Kein externer Abhaengigkeiten: nur Python-Standardbibliothek.
"""

import argparse
import json
import os
import sqlite3
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_PORT = 8017

ENTRY_TYPES = ("todo", "entscheidung", "fortschritt", "blocker")
STATUSES = ("offen", "erledigt", "blockiert")

ASSET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")


# --------------------------------------------------------------------------- #
# Datenbank-Grundfunktionen
# --------------------------------------------------------------------------- #

def get_db_path():
    return os.environ.get("PROGRESS_DB") or os.path.expanduser("~/.progress/progress.db")


def connect():
    db = get_db_path()
    os.makedirs(os.path.dirname(db), exist_ok=True)
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS repos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    path       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS contexts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id     INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'offen',
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(repo_id, name)
);

CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id    INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    context_id INTEGER NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    ended_at   TEXT,
    summary    TEXT
);

CREATE TABLE IF NOT EXISTS entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id    INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    context_id INTEGER NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    type       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'offen',
    summary    TEXT NOT NULL,
    text       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_entries_repo     ON entries(repo_id);
CREATE INDEX IF NOT EXISTS idx_entries_context  ON entries(context_id);
CREATE INDEX IF NOT EXISTS idx_entries_type     ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_status   ON entries(status);
CREATE INDEX IF NOT EXISTS idx_sessions_context ON sessions(context_id);

CREATE TABLE IF NOT EXISTS state (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""


def init_db(conn):
    conn.executescript(SCHEMA)
    conn.commit()


def detect_repo():
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True,
        )
        if out.returncode == 0 and out.stdout.strip():
            return os.path.realpath(out.stdout.strip())
    except Exception:
        pass
    return os.path.realpath(os.getcwd())


def ensure_repo(conn, path=None):
    path = path or detect_repo()
    name = os.path.basename(path.rstrip("/")) or path
    row = conn.execute("SELECT id FROM repos WHERE path = ?", (path,)).fetchone()
    if row:
        return row["id"], name, path
    cur = conn.execute("INSERT INTO repos (name, path) VALUES (?, ?)", (name, path))
    conn.commit()
    return cur.lastrowid, name, path


def get_state(conn, key):
    row = conn.execute("SELECT value FROM state WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def set_state(conn, key, value):
    conn.execute(
        "INSERT INTO state (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()


def current_context_id(conn, repo_id):
    v = get_state(conn, f"current_context:{repo_id}")
    return int(v) if v is not None else None


def current_session_id(conn, context_id):
    row = conn.execute(
        "SELECT id FROM sessions WHERE context_id = ? AND ended_at IS NULL "
        "ORDER BY id DESC LIMIT 1",
        (context_id,),
    ).fetchone()
    return row["id"] if row else None


# --------------------------------------------------------------------------- #
# Helfer fuer Kontext/Session
# --------------------------------------------------------------------------- #

def get_or_create_context(conn, repo_id, name, description=None, status="offen"):
    row = conn.execute(
        "SELECT id FROM contexts WHERE repo_id = ? AND name = ?", (repo_id, name)
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        "INSERT INTO contexts (repo_id, name, description, status) VALUES (?, ?, ?, ?)",
        (repo_id, name, description, status),
    )
    conn.commit()
    return cur.lastrowid


def select_context(conn, repo_id, context_id):
    set_state(conn, f"current_context:{repo_id}", str(context_id))


def ensure_open_session(conn, repo_id, context_id):
    sid = current_session_id(conn, context_id)
    if sid is None:
        cur = conn.execute(
            "INSERT INTO sessions (repo_id, context_id) VALUES (?, ?)",
            (repo_id, context_id),
        )
        conn.commit()
        sid = cur.lastrowid
    return sid


def default_status_for_type(entry_type):
    if entry_type in ("fortschritt", "entscheidung"):
        return "erledigt"
    if entry_type == "blocker":
        return "blockiert"
    return "offen"


# --------------------------------------------------------------------------- #
# Subkommandos
# --------------------------------------------------------------------------- #

def cmd_init(args):
    conn = connect()
    init_db(conn)
    repo_id, name, path = ensure_repo(conn)
    print(f"repo:   {name} ({path})")
    cid = current_context_id(conn, repo_id)
    if cid:
        row = conn.execute("SELECT name, status FROM contexts WHERE id = ?", (cid,)).fetchone()
        if row:
            print(f"kontext: {row['name']} [{row['status']}]")
            sid = current_session_id(conn, cid)
            if sid:
                srow = conn.execute(
                    "SELECT started_at FROM sessions WHERE id = ?", (sid,)
                ).fetchone()
                print(f"session: offen seit {srow['started_at']}")
            else:
                print("session: keine offen")
    else:
        print("kontext: (keiner ausgewaehlt)  -> `progress context <name>`")
    conn.close()


def cmd_context(args):
    conn = connect()
    init_db(conn)
    repo_id, rname, _ = ensure_repo(conn)
    cid = get_or_create_context(
        conn, repo_id, args.name, description=args.description, status=args.status
    )
    select_context(conn, repo_id, cid)
    row = conn.execute("SELECT id, name, status FROM contexts WHERE id = ?", (cid,)).fetchone()
    print(f"kontext aktiv: #{row['id']} {row['name']} [{row['status']}] (repo: {rname})")
    conn.close()


def cmd_contexts(args):
    conn = connect()
    init_db(conn)
    repo_id, rname, _ = ensure_repo(conn)
    cur = conn.execute(
        "SELECT id, name, status, description, updated_at FROM contexts "
        "WHERE repo_id = ? ORDER BY id",
        (repo_id,),
    )
    rows = cur.fetchall()
    print(f"kontexte in {rname}:")
    for r in rows:
        desc = f"  -- {r['description']}" if r["description"] else ""
        print(f"  #{r['id']} {r['name']} [{r['status']}]{desc}")
    if not rows:
        print("  (keine)")
    conn.close()


def cmd_session(args):
    conn = connect()
    init_db(conn)
    repo_id, rname, _ = ensure_repo(conn)
    cid = current_context_id(conn, repo_id)
    if cid is None:
        print("fehler: kein aktiver Kontext. Zuerst `progress context <name>`.")
        sys.exit(1)
    crow = conn.execute("SELECT name FROM contexts WHERE id = ?", (cid,)).fetchone()

    if args.action == "start":
        sid = current_session_id(conn, cid)
        if sid is None:
            cur = conn.execute(
                "INSERT INTO sessions (repo_id, context_id, summary) VALUES (?, ?, ?)",
                (repo_id, cid, args.summary),
            )
            conn.commit()
            sid = cur.lastrowid
            srow = conn.execute(
                "SELECT started_at FROM sessions WHERE id = ?", (sid,)
            ).fetchone()
            print(f"session gestartet in kontext '{crow['name']}' um {srow['started_at']}")
        else:
            srow = conn.execute(
                "SELECT started_at FROM sessions WHERE id = ?", (sid,)
            ).fetchone()
            print(f"session laeuft bereits (seit {srow['started_at']})")

    elif args.action == "end":
        sid = current_session_id(conn, cid)
        if sid is None:
            print("keine offene session zum beenden.")
        else:
            conn.execute(
                "UPDATE sessions SET ended_at = datetime('now','localtime'), "
                "summary = COALESCE(?, summary) WHERE id = ?",
                (args.summary, sid),
            )
            conn.commit()
            print(f"session beendet in kontext '{crow['name']}'.")

    elif args.action == "status":
        sid = current_session_id(conn, cid)
        if sid:
            srow = conn.execute(
                "SELECT started_at, summary FROM sessions WHERE id = ?", (sid,)
            ).fetchone()
            print(f"session offen in kontext '{crow['name']}' seit {srow['started_at']}")
            if srow["summary"]:
                print(f"  summary: {srow['summary']}")
        else:
            print(f"keine offene session in kontext '{crow['name']}'.")

    conn.close()


def cmd_log(args):
    conn = connect()
    init_db(conn)
    repo_id, rname, _ = ensure_repo(conn)

    # Kontext bestimmen
    if args.context:
        cid = get_or_create_context(conn, repo_id, args.context)
        select_context(conn, repo_id, cid)
    else:
        cid = current_context_id(conn, repo_id)
        if cid is None:
            print("fehler: kein aktiver Kontext. `progress context <name>` oder --context NAME.")
            sys.exit(1)
    crow = conn.execute("SELECT name FROM contexts WHERE id = ?", (cid,)).fetchone()

    # Status bestimmen
    status = args.status or default_status_for_type(args.type)

    # Volltext bestimmen
    text = args.text
    if text == "-":
        text = sys.stdin.read().strip() or None

    sid = ensure_open_session(conn, repo_id, cid)
    cur = conn.execute(
        "INSERT INTO entries (repo_id, context_id, session_id, type, status, summary, text) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (repo_id, cid, sid, args.type, status, args.summary, text),
    )
    conn.commit()
    eid = cur.lastrowid
    print(
        f"eintrag #{eid} [{args.type}/{status}] in kontext '{crow['name']}' "
        f"(repo: {rname}): {args.summary}"
    )
    conn.close()


def cmd_read(args):
    conn = connect()
    init_db(conn)

    repo_id = None
    context_id = None

    if args.all:
        pass
    elif args.repo:
        path = os.path.realpath(args.repo) if os.path.exists(args.repo) else args.repo
        row = conn.execute(
            "SELECT id FROM repos WHERE path = ? OR name = ?", (path, args.repo)
        ).fetchone()
        if row:
            repo_id = row["id"]
        else:
            print(f"fehler: repo '{args.repo}' nicht gefunden.")
            sys.exit(1)
    else:
        repo_id, rname, _ = ensure_repo(conn)

    if args.context:
        if repo_id is None:
            print("fehler: --context erfordert ein Repo (nicht mit --all kombinieren).")
            sys.exit(1)
        row = conn.execute(
            "SELECT id FROM contexts WHERE repo_id = ? AND name = ?",
            (repo_id, args.context),
        ).fetchone()
        if row:
            context_id = row["id"]
        else:
            print(f"fehler: kontext '{args.context}' nicht gefunden.")
            sys.exit(1)

    sql = (
        "SELECT e.*, c.name AS context_name, r.name AS repo_name, r.path AS repo_path "
        "FROM entries e "
        "JOIN contexts c ON e.context_id = c.id "
        "JOIN repos r ON e.repo_id = r.id WHERE 1=1"
    )
    params = []
    if repo_id is not None:
        sql += " AND e.repo_id = ?"
        params.append(repo_id)
    if context_id is not None:
        sql += " AND e.context_id = ?"
        params.append(context_id)
    if args.type:
        sql += " AND e.type = ?"
        params.append(args.type)
    if args.status:
        sql += " AND e.status = ?"
        params.append(args.status)
    if args.search:
        like = f"%{args.search}%"
        sql += " AND (e.summary LIKE ? OR e.text LIKE ?)"
        params.extend([like, like])
    sql += " ORDER BY e.id DESC"
    if args.limit:
        sql += " LIMIT ?"
        params.append(int(args.limit))

    rows = conn.execute(sql, params).fetchall()

    if args.json:
        print(json.dumps([dict(r) for r in rows], ensure_ascii=False, indent=2))
    else:
        for r in rows:
            print(f"#{r['id']} [{r['type']}/{r['status']}] {r['context_name']} "
                  f"({r['repo_name']}) {r['created_at']}")
            print(f"    {r['summary']}")
            if r["text"]:
                for line in r["text"].splitlines():
                    print(f"    | {line}")
            print()
        if not rows:
            print("(keine eintraege)")

    conn.close()


def cmd_status(args):
    conn = connect()
    init_db(conn)
    repo_id, rname, _ = ensure_repo(conn)
    print(f"repo:    {rname}")
    cid = current_context_id(conn, repo_id)
    if cid:
        crow = conn.execute("SELECT name, status FROM contexts WHERE id = ?", (cid,)).fetchone()
        print(f"kontext: {crow['name']} [{crow['status']}]")
        sid = current_session_id(conn, cid)
        if sid:
            srow = conn.execute("SELECT started_at FROM sessions WHERE id = ?", (sid,)).fetchone()
            print(f"session: offen seit {srow['started_at']}")
        else:
            print("session: keine offen")
        rows = conn.execute(
            "SELECT * FROM entries WHERE context_id = ? ORDER BY id DESC LIMIT 10",
            (cid,),
        ).fetchall()
        if rows:
            print("\nletzte eintraege:")
            for r in reversed(rows):
                print(f"  #{r['id']} [{r['type']}/{r['status']}] {r['summary']}")
    else:
        print("kontext: (keiner ausgewaehlt)")
    conn.close()


def cmd_summary(args):
    conn = connect()
    init_db(conn)
    data = {"repos": [], "contexts": [], "entries": 0}
    for r in conn.execute("SELECT id, name, path, created_at FROM repos ORDER BY id"):
        data["repos"].append(dict(r))
    for c in conn.execute(
        "SELECT c.id, c.name, c.status, c.description, c.updated_at, r.name AS repo_name "
        "FROM contexts c JOIN repos r ON c.repo_id = r.id ORDER BY c.id"
    ):
        data["contexts"].append(dict(c))
    data["entries"] = conn.execute("SELECT COUNT(*) AS n FROM entries").fetchone()["n"]
    print(json.dumps(data, ensure_ascii=False, indent=2))
    conn.close()


def cmd_serve(args):
    handler = make_handler()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"progress-web-ui: http://127.0.0.1:{args.port}  (Ctrl-C zum Beenden)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbeendet.")
        server.shutdown()


# --------------------------------------------------------------------------- #
# Web-UI
# --------------------------------------------------------------------------- #

def make_handler():
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, body, ctype):
            if isinstance(body, str):
                body = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj):
            self._send(200, json.dumps(obj, ensure_ascii=False), "application/json; charset=utf-8")

        def _error(self, code, msg):
            self._send(code, json.dumps({"error": msg}, ensure_ascii=False),
                       "application/json; charset=utf-8")

        def do_GET(self):
            path = self.path.split("?")[0]
            try:
                if path == "/":
                    index = os.path.join(ASSET_DIR, "index.html")
                    with open(index, "r", encoding="utf-8") as f:
                        self._send(200, f.read(), "text/html; charset=utf-8")
                elif path == "/api/repos":
                    self._api_repos()
                elif path == "/api/contexts":
                    self._api_contexts()
                elif path == "/api/entries":
                    self._api_entries()
                elif path == "/api/sessions":
                    self._api_sessions()
                else:
                    self._error(404, "not found")
            except Exception as e:  # noqa: BLE001
                self._error(500, str(e))

        def _q(self, name):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            v = q.get(name, [None])[0]
            return v

        def _api_repos(self):
            conn = connect()
            rows = conn.execute(
                "SELECT r.id, r.name, r.path, r.created_at, "
                "(SELECT COUNT(*) FROM entries e WHERE e.repo_id = r.id) AS entry_count "
                "FROM repos r ORDER BY r.id"
            ).fetchall()
            conn.close()
            self._json([dict(r) for r in rows])

        def _api_contexts(self):
            repo_id = self._q("repo_id")
            conn = connect()
            sql = ("SELECT c.id, c.repo_id, c.name, c.description, c.status, "
                   "c.created_at, c.updated_at, r.name AS repo_name "
                   "FROM contexts c JOIN repos r ON c.repo_id = r.id WHERE 1=1")
            params = []
            if repo_id:
                sql += " AND c.repo_id = ?"
                params.append(int(repo_id))
            sql += " ORDER BY c.id"
            rows = conn.execute(sql, params).fetchall()
            conn.close()
            self._json([dict(r) for r in rows])

        def _api_entries(self):
            repo_id = self._q("repo_id")
            context_id = self._q("context_id")
            etype = self._q("type")
            status = self._q("status")
            q = self._q("q")
            limit = self._q("limit")
            sql = ("SELECT e.*, c.name AS context_name, r.name AS repo_name "
                   "FROM entries e JOIN contexts c ON e.context_id = c.id "
                   "JOIN repos r ON e.repo_id = r.id WHERE 1=1")
            params = []
            if repo_id:
                sql += " AND e.repo_id = ?"
                params.append(int(repo_id))
            if context_id:
                sql += " AND e.context_id = ?"
                params.append(int(context_id))
            if etype:
                sql += " AND e.type = ?"
                params.append(etype)
            if status:
                sql += " AND e.status = ?"
                params.append(status)
            if q:
                like = f"%{q}%"
                sql += " AND (e.summary LIKE ? OR e.text LIKE ?)"
                params.extend([like, like])
            sql += " ORDER BY e.id DESC"
            if limit:
                sql += " LIMIT ?"
                params.append(int(limit))
            conn = connect()
            rows = conn.execute(sql, params).fetchall()
            conn.close()
            self._json([dict(r) for r in rows])

        def _api_sessions(self):
            context_id = self._q("context_id")
            conn = connect()
            sql = ("SELECT s.*, c.name AS context_name, r.name AS repo_name "
                   "FROM sessions s JOIN contexts c ON s.context_id = c.id "
                   "JOIN repos r ON s.repo_id = r.id WHERE 1=1")
            params = []
            if context_id:
                sql += " AND s.context_id = ?"
                params.append(int(context_id))
            sql += " ORDER BY s.id DESC"
            rows = conn.execute(sql, params).fetchall()
            conn.close()
            self._json([dict(r) for r in rows])

        def log_message(self, fmt, *args):
            pass

    return Handler


# --------------------------------------------------------------------------- #
# Argument-Parsing
# --------------------------------------------------------------------------- #

def build_parser():
    p = argparse.ArgumentParser(prog="progress", description="Progress-Tracker")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="DB initialisieren und aktuelles Repo registrieren")

    c = sub.add_parser("context", help="Kontext anlegen/auswaehlen")
    c.add_argument("name")
    c.add_argument("--description")
    c.add_argument("--status", choices=STATUSES, default="offen")

    sub.add_parser("contexts", help="Kontexte des aktuellen Repos auflisten")

    s = sub.add_parser("session", help="Session starten/beenden")
    s.add_argument("action", choices=["start", "end", "status"])
    s.add_argument("--summary")

    l = sub.add_parser("log", help="Eintrag schreiben")
    l.add_argument("--type", choices=ENTRY_TYPES, required=True)
    l.add_argument("--summary", required=True)
    l.add_argument("--text", help="Volltext (oder '-' fuer stdin)")
    l.add_argument("--status", choices=STATUSES)
    l.add_argument("--context", help="Kontext-Name (legt ggf. an und waehlt aus)")

    r = sub.add_parser("read", help="Eintraege auslesen")
    r.add_argument("--repo")
    r.add_argument("--context")
    r.add_argument("--type", choices=ENTRY_TYPES)
    r.add_argument("--status", choices=STATUSES)
    r.add_argument("--search")
    r.add_argument("--limit", type=int)
    r.add_argument("--all", action="store_true", help="alle Repos")
    r.add_argument("--json", action="store_true")

    sub.add_parser("status", help="aktuellen Stand anzeigen")
    sub.add_parser("summary", help="JSON-Uebersicht ueber alle Repos/Kontexte")

    sv = sub.add_parser("serve", help="Web-UI starten")
    sv.add_argument("--port", type=int, default=DEFAULT_PORT)

    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    {
        "init": cmd_init,
        "context": cmd_context,
        "contexts": cmd_contexts,
        "session": cmd_session,
        "log": cmd_log,
        "read": cmd_read,
        "status": cmd_status,
        "summary": cmd_summary,
        "serve": cmd_serve,
    }[args.command](args)


if __name__ == "__main__":
    main()
