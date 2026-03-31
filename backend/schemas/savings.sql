CREATE TABLE IF NOT EXISTS savings_goals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    name        TEXT NOT NULL,
    target      REAL NOT NULL CHECK(target > 0),
    current     REAL NOT NULL DEFAULT 0 CHECK(current >= 0),
    affects_balance INTEGER NOT NULL DEFAULT 1 CHECK(affects_balance IN (0, 1)),
    deadline    TEXT,
    color       TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS savings_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id     INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    amount      REAL NOT NULL CHECK(amount > 0),
    note        TEXT,
    date        TEXT DEFAULT (datetime('now')),
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_entries_goal_id ON savings_entries(goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_entries_user_id ON savings_entries(user_id);
