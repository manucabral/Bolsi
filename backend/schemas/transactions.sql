CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    amount      REAL NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category_id INTEGER,
    description TEXT,
    date        TEXT NOT NULL,
    credit_id   INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (credit_id) REFERENCES credits(id)
);
