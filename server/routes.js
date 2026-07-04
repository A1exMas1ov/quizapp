const express = require('express');
const router = express.Router();
const { db } = require('./db');
const { signToken, hashPassword, checkPassword, requireAuth, requireRole } = require('./auth');

router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !['organizer','participant'].includes(role))
      return res.status(400).json({ error: 'Неверные данные' });

    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email=?', args: [email] });
    if (existing.rows.length) return res.status(409).json({ error: 'Email уже занят' });

    const hash = hashPassword(password);
    const result = await db.execute({
      sql: 'INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)',
      args: [name, email, hash, role]
    });
    const id = Number(result.lastInsertRowid);
    const token = signToken({ id, name, email, role });
    res.cookie('token', token, { httpOnly: true, maxAge: 7*24*3600*1000 });
    res.json({ token, user: { id, name, email, role } });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await db.execute({ sql: 'SELECT * FROM users WHERE email=?', args: [email] });
    if (!r.rows.length) return res.status(401).json({ error: 'Неверный email или пароль' });
    const user = r.rows[0];
    if (!checkPassword(password, user.password)) return res.status(401).json({ error: 'Неверный email или пароль' });
    const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    res.cookie('token', token, { httpOnly: true, maxAge: 7*24*3600*1000 });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch(e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/auth/me', requireAuth, async (req, res) => {
  const r = await db.execute({ sql: 'SELECT id,name,email,role FROM users WHERE id=?', args: [req.user.id] });
  if (!r.rows.length) return res.status(404).json({ error: 'Не найден' });
  res.json({ user: r.rows[0] });
});

router.get('/quizzes', requireAuth, requireRole('organizer'), async (req, res) => {
  const r = await db.execute({
    sql: `SELECT q.*, 
      (SELECT COUNT(*) FROM questions WHERE quiz_id=q.id) as question_count,
      (SELECT COUNT(*) FROM sessions WHERE quiz_id=q.id) as session_count
      FROM quizzes q WHERE organizer_id=? ORDER BY created_at DESC`,
    args: [req.user.id]
  });
  res.json({ quizzes: r.rows });
});

router.post('/quizzes', requireAuth, requireRole('organizer'), async (req, res) => {
  try {
    const { title, category, time_per_question, shuffle_questions, score_by_speed, show_leaderboard } = req.body;
    if (!title) return res.status(400).json({ error: 'Нужно название' });
    const r = await db.execute({
      sql: `INSERT INTO quizzes(organizer_id,title,category,time_per_question,shuffle_questions,score_by_speed,show_leaderboard)
            VALUES(?,?,?,?,?,?,?)`,
      args: [req.user.id, title, category||'Общая эрудиция', time_per_question||30,
             shuffle_questions?1:0, score_by_speed!==false?1:0, show_leaderboard!==false?1:0]
    });
    const id = Number(r.lastInsertRowid);
    const quiz = await db.execute({ sql: 'SELECT * FROM quizzes WHERE id=?', args: [id] });
    res.json({ quiz: quiz.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/quizzes/:id', requireAuth, async (req, res) => {
  try {
    const qr = await db.execute({ sql: 'SELECT * FROM quizzes WHERE id=?', args: [req.params.id] });
    if (!qr.rows.length) return res.status(404).json({ error: 'Не найден' });
    const quiz = qr.rows[0];
    if (req.user.role === 'organizer' && quiz.organizer_id !== req.user.id)
      return res.status(403).json({ error: 'Нет доступа' });

    const questions = await db.execute({
      sql: 'SELECT * FROM questions WHERE quiz_id=? ORDER BY order_num',
      args: [quiz.id]
    });
    const questionRows = questions.rows;
    for (const q of questionRows) {
      const ans = await db.execute({ sql: 'SELECT * FROM answers WHERE question_id=?', args: [q.id] });
      q.answers = ans.rows;
    }
    res.json({ quiz, questions: questionRows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/quizzes/:id', requireAuth, requireRole('organizer'), async (req, res) => {
  try {
    const { title, category, time_per_question, shuffle_questions, score_by_speed, show_leaderboard } = req.body;
    await db.execute({
      sql: `UPDATE quizzes SET title=?,category=?,time_per_question=?,shuffle_questions=?,score_by_speed=?,show_leaderboard=?
            WHERE id=? AND organizer_id=?`,
      args: [title, category, time_per_question, shuffle_questions?1:0, score_by_speed?1:0, show_leaderboard?1:0,
             req.params.id, req.user.id]
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/quizzes/:id', requireAuth, requireRole('organizer'), async (req, res) => {
  try {
    const result = await db.execute({ sql: 'DELETE FROM quizzes WHERE id=? AND organizer_id=?', args: [req.params.id, req.user.id] });
    if (result.rowsAffected === 0) return res.status(403).json({ error: 'Нет доступа или квиз не найден' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/quizzes/:id/questions', requireAuth, requireRole('organizer'), async (req, res) => {
  try {
    const { text, type, image_url, time_limit, answers, order_num } = req.body;
    const quiz = await db.execute({ sql: 'SELECT id FROM quizzes WHERE id=? AND organizer_id=?', args: [req.params.id, req.user.id] });
    if (!quiz.rows.length) return res.status(403).json({ error: 'Нет доступа' });

    const qr = await db.execute({
      sql: 'INSERT INTO questions(quiz_id,text,type,image_url,time_limit,order_num) VALUES(?,?,?,?,?,?)',
      args: [req.params.id, text, type||'single', image_url||null, time_limit||null, order_num||0]
    });
    const qid = Number(qr.lastInsertRowid);

    if (answers && answers.length) {
      for (const a of answers) {
        await db.execute({
          sql: 'INSERT INTO answers(question_id,text,is_correct) VALUES(?,?,?)',
          args: [qid, a.text, a.is_correct?1:0]
        });
      }
    }
    const newQ = await db.execute({ sql: 'SELECT * FROM questions WHERE id=?', args: [qid] });
    const newA = await db.execute({ sql: 'SELECT * FROM answers WHERE question_id=?', args: [qid] });
    const q = newQ.rows[0];
    q.answers = newA.rows;
    res.json({ question: q });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/questions/:id', requireAuth, requireRole('organizer'), async (req, res) => {
  try {
    const { text, type, image_url, time_limit, answers } = req.body;
    await db.execute({
      sql: 'UPDATE questions SET text=?,type=?,image_url=?,time_limit=? WHERE id=?',
      args: [text, type, image_url||null, time_limit||null, req.params.id]
    });
    if (answers) {
      await db.execute({ sql: 'DELETE FROM answers WHERE question_id=?', args: [req.params.id] });
      for (const a of answers) {
        await db.execute({
          sql: 'INSERT INTO answers(question_id,text,is_correct) VALUES(?,?,?)',
          args: [req.params.id, a.text, a.is_correct?1:0]
        });
      }
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/questions/:id', requireAuth, requireRole('organizer'), async (req, res) => {
  await db.execute({ sql: 'DELETE FROM questions WHERE id=?', args: [req.params.id] });
  res.json({ ok: true });
});

router.post('/quizzes/:id/launch', requireAuth, requireRole('organizer'), async (req, res) => {
  try {
    const quizId = req.params.id;
    const qr = await db.execute({ sql: 'SELECT * FROM quizzes WHERE id=? AND organizer_id=?', args: [quizId, req.user.id] });
    if (!qr.rows.length) return res.status(403).json({ error: 'Нет доступа' });
    const quiz = qr.rows[0];

    if (quiz.status === 'active' && quiz.room_code) {
      const existingSession = await db.execute({
        sql: "SELECT id, current_question_idx FROM sessions WHERE quiz_id=? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1",
        args: [quizId]
      });
      if (existingSession.rows.length) {
        const s = existingSession.rows[0];
        return res.json({
          session_id: s.id,
          room_code: quiz.room_code,
          resumed: true,
          current_question_idx: s.current_question_idx
        });
      }
    }

    let code;
    for (let i = 0; i < 20; i++) {
      code = Math.random().toString(36).slice(2,6).toUpperCase();
      const exists = await db.execute({ sql: 'SELECT id FROM quizzes WHERE room_code=?', args: [code] });
      if (!exists.rows.length) break;
    }

    await db.execute({ sql: 'UPDATE quizzes SET room_code=?,status=? WHERE id=?', args: [code, 'active', quizId] });
    const sr = await db.execute({
      sql: 'INSERT INTO sessions(quiz_id,current_question_idx) VALUES(?,?)',
      args: [quizId, -1]
    });
    const sessionId = Number(sr.lastInsertRowid);
    res.json({ session_id: sessionId, room_code: code });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/quizzes/:id/close', requireAuth, requireRole('organizer'), async (req, res) => {
  try {
    const quizId = req.params.id;
    const qr = await db.execute({ sql: 'SELECT * FROM quizzes WHERE id=? AND organizer_id=?', args: [quizId, req.user.id] });
    if (!qr.rows.length) return res.status(403).json({ error: 'Нет доступа' });

    const activeSessions = await db.execute({
      sql: "SELECT id FROM sessions WHERE quiz_id=? AND finished_at IS NULL",
      args: [quizId]
    });
    await db.execute({
      sql: "UPDATE sessions SET finished_at=datetime('now') WHERE quiz_id=? AND finished_at IS NULL",
      args: [quizId]
    });
    await db.execute({ sql: "UPDATE quizzes SET status='draft', room_code=NULL WHERE id=?", args: [quizId] });

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/join', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const qr = await db.execute({ sql: "SELECT * FROM quizzes WHERE room_code=? AND status='active'", args: [code.toUpperCase()] });
    if (!qr.rows.length) return res.status(404).json({ error: 'Квиз не найден или уже завершён' });
    const quiz = qr.rows[0];

    const sr = await db.execute({
      sql: "SELECT * FROM sessions WHERE quiz_id=? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1",
      args: [quiz.id]
    });
    if (!sr.rows.length) return res.status(404).json({ error: 'Сессия не найдена' });
    const session = sr.rows[0];

    const exists = await db.execute({
      sql: 'SELECT id FROM session_participants WHERE session_id=? AND user_id=?',
      args: [session.id, req.user.id]
    });
    if (!exists.rows.length) {
      await db.execute({
        sql: 'INSERT INTO session_participants(session_id,user_id) VALUES(?,?)',
        args: [session.id, req.user.id]
      });
    }

    res.json({ quiz: { id: quiz.id, title: quiz.title, time_per_question: quiz.time_per_question }, session_id: session.id, room_code: code.toUpperCase() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/sessions/:id/results', requireAuth, async (req, res) => {
  try {
    const participants = await db.execute({
      sql: `SELECT u.id, u.name, sp.total_score,
            (SELECT COUNT(*) FROM participant_answers pa WHERE pa.session_id=sp.session_id AND pa.user_id=sp.user_id AND pa.is_correct=1) as correct_count,
            (SELECT COUNT(*) FROM participant_answers pa WHERE pa.session_id=sp.session_id AND pa.user_id=sp.user_id) as answered_count
            FROM session_participants sp JOIN users u ON u.id=sp.user_id
            WHERE sp.session_id=? ORDER BY sp.total_score DESC`,
      args: [req.params.id]
    });
    const session = await db.execute({ sql: 'SELECT * FROM sessions WHERE id=?', args: [req.params.id] });
    const quiz = session.rows.length ? await db.execute({ sql: 'SELECT title FROM quizzes WHERE id=?', args: [session.rows[0].quiz_id] }) : null;
    const totalQ = session.rows.length ? await db.execute({ sql: 'SELECT COUNT(*) as c FROM questions WHERE quiz_id=?', args: [session.rows[0].quiz_id] }) : null;

    res.json({
      participants: participants.rows,
      quiz_title: quiz?.rows[0]?.title,
      total_questions: totalQ?.rows[0]?.c || 0,
      my_user_id: req.user.id
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/my/history', requireAuth, async (req, res) => {
  try {
    const r = await db.execute({
      sql: `SELECT q.title, q.category, s.started_at, sp.total_score, sp.session_id,
            (SELECT COUNT(*) FROM questions WHERE quiz_id=q.id) as total_q,
            (SELECT COUNT(*) FROM participant_answers pa WHERE pa.session_id=sp.session_id AND pa.user_id=sp.user_id AND pa.is_correct=1) as correct_q,
            (SELECT COUNT(*) FROM session_participants sp2 WHERE sp2.session_id=sp.session_id AND sp2.total_score > sp.total_score) + 1 as place
            FROM session_participants sp
            JOIN sessions s ON s.id=sp.session_id
            JOIN quizzes q ON q.id=s.quiz_id
            WHERE sp.user_id=? ORDER BY s.started_at DESC`,
      args: [req.user.id]
    });
    res.json({ history: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/my/quiz-history', requireAuth, requireRole('organizer'), async (req, res) => {
  try {
    const r = await db.execute({
      sql: `SELECT s.id as session_id, q.title, s.started_at, s.finished_at,
            (SELECT COUNT(*) FROM session_participants WHERE session_id=s.id) as participant_count,
            (SELECT COUNT(*) FROM participant_answers WHERE session_id=s.id) as answered_count
            FROM sessions s JOIN quizzes q ON q.id=s.quiz_id
            WHERE q.organizer_id=? ORDER BY s.started_at DESC`,
      args: [req.user.id]
    });
    res.json({ history: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
