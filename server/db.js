const { createClient } = require('@libsql/client');
const path = require('path');

const db = createClient({
    url: `file:${path.join(__dirname, '../quizapp.db')}`
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
            category TEXT DEFAULT 'Математика',
            time_per_question INTEGER DEFAULT 30,
            shuffle_questions INTEGER DEFAULT 0,
            score_by_speed INTEGER DEFAULT 1,
            show_leaderboard INTEGER DEFAULT 1,
            status TEXT DEFAULT 'draft' CHECK(status IN ('draft','active','finished')),
            room_code TEXT UNIQUE,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(organizer_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL,
            order_num INTEGER DEFAULT 0,
            text TEXT NOT NULL,
            type TEXT DEFAULT 'single' CHECK(type IN ('single','multiple')),
            image_url TEXT,
            time_limit INTEGER,
            FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            is_correct INTEGER DEFAULT 0,
            FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL,
            started_at TEXT DEFAULT (datetime('now')),
            finished_at TEXT,
            current_question_idx INTEGER DEFAULT -1,
            FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
        );

        CREATE TABLE IF NOT EXISTS session_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            joined_at TEXT DEFAULT (datetime('now')),
            total_score INTEGER DEFAULT 0,
            FOREIGN KEY(session_id) REFERENCES sessions(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS participant_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            answer_ids TEXT NOT NULL,
            is_correct INTEGER DEFAULT 0,
            score INTEGER DEFAULT 0,
            answered_at_ms INTEGER,
            FOREIGN KEY(session_id) REFERENCES sessions(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(question_id) REFERENCES questions(id)
        );
    `);
    console.log('[DB] Schema ready');
}
