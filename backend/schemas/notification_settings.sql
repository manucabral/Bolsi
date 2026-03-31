CREATE TABLE IF NOT EXISTS notification_settings (
    user_id                  INTEGER PRIMARY KEY,
    bills_enabled            INTEGER NOT NULL DEFAULT 1 CHECK (bills_enabled IN (0, 1)),
    bills_days_before        INTEGER NOT NULL DEFAULT 3 CHECK (bills_days_before IN (1, 3, 7)),
    credits_enabled          INTEGER NOT NULL DEFAULT 1 CHECK (credits_enabled IN (0, 1)),
    credits_days_before      INTEGER NOT NULL DEFAULT 3 CHECK (credits_days_before IN (1, 3, 7)),
    summary_on_open_enabled  INTEGER NOT NULL DEFAULT 1 CHECK (summary_on_open_enabled IN (0, 1)),
    updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
