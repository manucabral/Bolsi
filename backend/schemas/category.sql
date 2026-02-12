-- Categories table schema

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    icon TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO categories (name, color, icon) VALUES
    ('Comida', '#FF6B6B', '🍔'),
    ('Transporte', '#4ECDC4', '🚗'),
    ('Entretenimiento', '#95E1D3', '🎮'),
    ('Servicios', '#F38181', '💡'),
    ('Salud', '#AA96DA', '💊'),
    ('Compras', '#FCBAD3', '🛍️'),
    ('Educación', '#A8E6CF', '📚'),
    ('Otros', '#FFD93D', '📌');
