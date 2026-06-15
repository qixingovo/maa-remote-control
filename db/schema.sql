PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    maa_user_id     TEXT    NOT NULL UNIQUE,
    role            TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    device_uuid     TEXT    NOT NULL UNIQUE,
    user_uuid       TEXT    NOT NULL,
    account_id      INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    name            TEXT    DEFAULT '',
    emulator_type   TEXT    DEFAULT '',
    last_seen_at    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    device_uuid     TEXT    NOT NULL UNIQUE,
    user_uuid       TEXT    NOT NULL,
    name            TEXT    DEFAULT '',
    emulator_type   TEXT    DEFAULT '',
    last_seen_at    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_uuid);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at);

CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_uuid       TEXT    NOT NULL UNIQUE,
    device_uuid     TEXT    NOT NULL REFERENCES devices(device_uuid) ON DELETE CASCADE,
    type            TEXT    NOT NULL,
    params          TEXT    DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','dispatched','running','completed','failed','cancelled')),
    priority        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    dispatched_at   TEXT,
    completed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_device_status ON tasks(device_uuid, status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS task_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_uuid       TEXT    NOT NULL,
    status          TEXT    NOT NULL CHECK(status IN ('SUCCESS','FAILED')),
    payload_type    TEXT    NOT NULL DEFAULT 'empty'
                        CHECK(payload_type IN ('screenshot','text','empty')),
    payload_path    TEXT,
    payload_text    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_results_task ON task_results(task_uuid);
