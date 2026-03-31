CREATE TABLE IF NOT EXISTS bills (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    name        TEXT NOT NULL,
    amount      REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0 CHECK(paid_amount >= 0 AND paid_amount <= amount),
    due_date    TEXT NOT NULL,
    category_id INTEGER,
    status      TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'paid', 'overdue')),
    notes       TEXT,
    paid_at     TEXT,
    payment_transaction_id INTEGER,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (payment_transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS bill_payments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id       INTEGER NOT NULL,
    user_id       INTEGER NOT NULL,
    amount        REAL NOT NULL CHECK(amount > 0),
    payment_date  TEXT NOT NULL,
    transaction_id INTEGER,
    created_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_bills_user_due_date ON bills(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_bills_user_status ON bills(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_id ON bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON bill_payments(user_id);
