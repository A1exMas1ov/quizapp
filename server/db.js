const { createClient } = require('@libsql/client');
const path = require('path');

const db = createClient({
    url: `file:${path.join(__dirname, '../quizflow.db')}`
});

async function initDB() {
    await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('organizer','participant')),
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organizer_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            category TEXT DEFAULT 'Общая эрудиция',
            time_per_question INTEGER DEFAULT 30,
            shuffle_questions INTEGER DEFAULT 0,
            score_by_speed INTEGER DEFAULT 1,
            show_leaderboard INTEGER DEFAULT 1,
            status TEXT DEFAULT 'draft' CHECK(status IN ('draft','active','finished')),
            room_code TEXT UNIQUE,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(organizer_id) REFERENCES users(id)
        );
    `);
    console.log('[DB] Schema ready');
}