CREATE TABLE IF NOT EXISTS categories (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name    TEXT NOT NULL,
    color   TEXT NOT NULL DEFAULT '#9CA3AF',
    type    TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
