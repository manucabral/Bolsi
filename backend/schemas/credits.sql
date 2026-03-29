CREATE TABLE IF NOT EXISTS credits (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL,
    description        TEXT NOT NULL,
    total_amount       REAL NOT NULL,
    installments       INTEGER NOT NULL,
    installment_amount REAL NOT NULL,
    paid_installments  INTEGER NOT NULL DEFAULT 0,
    start_date         TEXT NOT NULL,
    category_id        INTEGER,
    created_at         TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
