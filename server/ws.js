const { db } = require('./db');
const { verifyToken } = require('./auth');

// rooms[sessionId] = { organizer: ws, participants: Map<userId, ws>, quiz, questions, currentIdx, timer, questionStartTime }
const rooms = new Map();

function broadcast(room, data, excludeWs = null) {
  const msg = JSON.stringify(data);
  if (room.organizer && room.organizer !== excludeWs) safeSend(room.organizer, msg);
  for (const ws of room.participants.values()) {
    if (ws !== excludeWs) safeSend(ws, msg);
  }
}

function safeSend(ws, msg) {
  try { if (ws.readyState === 1) ws.send(msg); } catch(e) {}
}

function getRoom(sessionId) {
  if (!rooms.has(sessionId)) {
    rooms.set(sessionId, { organizer: null, participants: new Map(), quiz: null, questions: [], currentIdx: -1, timer: null, questionStartTime: null });
  }
  return rooms.get(sessionId);
}

async function loadQuizData(sessionId) {
  const sr = await db.execute({ sql: 'SELECT * FROM sessions WHERE id=?', args: [sessionId] });
  if (!sr.rows.length) return null;
  const session = sr.rows[0];
  const qr = await db.execute({ sql: 'SELECT * FROM quizzes WHERE id=?', args: [session.quiz_id] });
  if (!qr.rows.length) return null;
  const quiz = qr.rows[0];
  const questions = await db.execute({ sql: 'SELECT * FROM questions WHERE quiz_id=? ORDER BY order_num', args: [quiz.id] });
  const qs = questions.rows;
  for (const q of qs) {
    const ans = await db.execute({ sql: 'SELECT * FROM answers WHERE question_id=?', args: [q.id] });
    q.answers = ans.rows;
  }
  return { session, quiz, questions: qs };
}

async function sendQuestion(room, sessionId) {
  const q = room.questions[room.currentIdx];
  if (!q) return;
  room.questionStartTime = Date.now();
  room.answeredUsers = new Set();

  const timeLimit = q.time_limit || room.quiz.time_per_question || 30;

  const participantQ = {
    ...q,
    answers: q.answers.map(a => ({ id: a.id, text: a.text }))
  };
  const organizerQ = { ...q };

  const payload = {
    type: 'question',
    question: participantQ,
    questionIndex: room.currentIdx,
    totalQuestions: room.questions.length,
    timeLimit,
    questionStartTime: room.questionStartTime
  };

  for (const ws of room.participants.values()) {
    safeSend(ws, JSON.stringify(payload));
  }
  if (room.organizer) {
    safeSend(room.organizer, JSON.stringify({ ...payload, question: organizerQ }));
  }

  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => endQuestion(room, sessionId), timeLimit * 1000 + 500);
}

async function endQuestion(room, sessionId) {
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
  const q = room.questions[room.currentIdx];
  if (!q) return;

  const dist = await db.execute({
    sql: `SELECT pa.answer_ids, COUNT(*) as cnt FROM participant_answers pa
          WHERE pa.session_id=? AND pa.question_id=? GROUP BY pa.answer_ids`,
    args: [sessionId, q.id]
  });

  const correctIds = q.answers.filter(a => a.is_correct).map(a => a.id);

  broadcast(room, {
    type: 'question_end',
    questionId: q.id,
    correctAnswerIds: correctIds,
    distribution: dist.rows,
    leaderboard: await getLeaderboard(sessionId)
  });
}

async function getLeaderboard(sessionId) {
  const r = await db.execute({
    sql: `SELECT u.id, u.name, sp.total_score
          FROM session_participants sp JOIN users u ON u.id=sp.user_id
          WHERE sp.session_id=? ORDER BY sp.total_score DESC LIMIT 10`,
    args: [sessionId]
  });
  return r.rows;
}

function setupWebSocket(wss) {
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const sessionId = parseInt(url.searchParams.get('session'));

    if (!token || !sessionId) { ws.close(4001, 'Missing token or session'); return; }
    const user = verifyToken(token);
    if (!user) { ws.close(4001, 'Invalid token'); return; }

    const room = getRoom(sessionId);
    ws.userId = user.id;
    ws.userName = user.name;
    ws.role = user.role;
    ws.sessionId = sessionId;

    if (user.role === 'organizer') {
      room.organizer = ws;
      const data = await loadQuizData(sessionId);
      if (data) {
        room.quiz = data.quiz;
        room.questions = data.questions;
        room.currentIdx = data.session.current_question_idx;
      }
      safeSend(ws, JSON.stringify({ type: 'organizer_joined', participantCount: room.participants.size }));

      if (room.currentIdx >= 0 && room.questions[room.currentIdx] && room.questionStartTime) {
        const q = room.questions[room.currentIdx];
        const timeLimit = q.time_limit || room.quiz?.time_per_question || 30;
        const elapsed = (Date.now() - room.questionStartTime) / 1000;
        if (elapsed < timeLimit) {
          safeSend(ws, JSON.stringify({
            type: 'question',
            question: q,
            questionIndex: room.currentIdx,
            totalQuestions: room.questions.length,
            timeLimit,
            questionStartTime: room.questionStartTime
          }));
        }
      }
    } else {
      const membership = await db.execute({
        sql: 'SELECT id FROM session_participants WHERE session_id=? AND user_id=?',
        args: [sessionId, user.id]
      });
      if (!membership.rows.length) {
        safeSend(ws, JSON.stringify({ type: 'error', message: 'Сначала войдите по коду комнаты' }));
        ws.close(4003, 'Not joined via room code');
        return;
      }

      room.participants.set(user.id, ws);
      if (room.organizer) {
        safeSend(room.organizer, JSON.stringify({
          type: 'participant_joined',
          user: { id: user.id, name: user.name },
          participantCount: room.participants.size
        }));
      }
      safeSend(ws, JSON.stringify({
        type: 'joined',
        quiz: room.quiz ? { title: room.quiz.title, time_per_question: room.quiz.time_per_question } : null,
        participantCount: room.participants.size
      }));

      if (room.currentIdx >= 0 && room.questions[room.currentIdx] && room.questionStartTime) {
        const q = room.questions[room.currentIdx];
        const timeLimit = q.time_limit || room.quiz?.time_per_question || 30;
        const elapsed = (Date.now() - room.questionStartTime) / 1000;
        if (elapsed < timeLimit && !room.answeredUsers?.has(user.id)) {
          const participantQ = { ...q, answers: q.answers.map(a => ({ id: a.id, text: a.text })) };
          safeSend(ws, JSON.stringify({
            type: 'question',
            question: participantQ,
            questionIndex: room.currentIdx,
            totalQuestions: room.questions.length,
            timeLimit,
            questionStartTime: room.questionStartTime
          }));
        }
      }
    }

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (user.role === 'organizer') {
        if (msg.type === 'start_quiz') {
          if (room.currentIdx >= 0) return;
          if (!room.quiz) {
            const data = await loadQuizData(sessionId);
            if (data) { room.quiz = data.quiz; room.questions = data.questions; }
          }
          room.currentIdx = 0;
          await db.execute({ sql: 'UPDATE sessions SET current_question_idx=0 WHERE id=?', args: [sessionId] });
          broadcast(room, { type: 'quiz_started', totalQuestions: room.questions.length, quiz: { title: room.quiz?.title } });
          await sendQuestion(room, sessionId);
        }

        if (msg.type === 'next_question') {
          if (room.timer) { clearTimeout(room.timer); room.timer = null; }
          room.currentIdx++;
          if (room.currentIdx >= room.questions.length) {
            await db.execute({ sql: "UPDATE sessions SET finished_at=datetime('now'),current_question_idx=? WHERE id=?", args: [room.currentIdx, sessionId] });
            await db.execute({ sql: "UPDATE quizzes SET status='finished' WHERE id=?", args: [room.quiz.id] });
            const lb = await getLeaderboard(sessionId);
            broadcast(room, { type: 'quiz_finished', leaderboard: lb, session_id: sessionId });
          } else {
            await db.execute({ sql: 'UPDATE sessions SET current_question_idx=? WHERE id=?', args: [room.currentIdx, sessionId] });
            await sendQuestion(room, sessionId);
          }
        }

        if (msg.type === 'end_question_early') {
          await endQuestion(room, sessionId);
        }
      }

      if (user.role === 'participant') {
        if (msg.type === 'submit_answer') {
          const { questionId, answerIds } = msg;
          if (!questionId || !answerIds) return;

          const q = room.questions[room.currentIdx];
          if (!q || q.id !== questionId) return;
          if (room.answeredUsers?.has(user.id)) return;

          if (!room.answeredUsers) room.answeredUsers = new Set();
          room.answeredUsers.add(user.id);

          const correctIds = q.answers.filter(a => a.is_correct).map(a => a.id);
          const submitted = Array.isArray(answerIds) ? answerIds.map(Number) : [Number(answerIds)];
          const isCorrect = correctIds.length === submitted.length &&
            submitted.every(id => correctIds.includes(id));

          let score = 0;
          if (isCorrect) {
            const elapsed = Date.now() - (room.questionStartTime || Date.now());
            const timeLimit = (q.time_limit || room.quiz?.time_per_question || 30) * 1000;
            const speedRatio = Math.max(0, 1 - elapsed / timeLimit);
            score = room.quiz?.score_by_speed ? Math.round(800 + 200 * speedRatio) : 1000;
          }

          await db.execute({
            sql: 'INSERT INTO participant_answers(session_id,user_id,question_id,answer_ids,is_correct,score,answered_at_ms) VALUES(?,?,?,?,?,?,?)',
            args: [sessionId, user.id, questionId, JSON.stringify(submitted), isCorrect?1:0, score, Date.now()]
          });
          if (score > 0) {
            await db.execute({
              sql: 'UPDATE session_participants SET total_score=total_score+? WHERE session_id=? AND user_id=?',
              args: [score, sessionId, user.id]
            });
          }

          safeSend(ws, JSON.stringify({ type: 'answer_received', isCorrect, score, correctAnswerIds: correctIds }));

          if (room.organizer) {
            safeSend(room.organizer, JSON.stringify({
              type: 'answer_progress',
              answered: room.answeredUsers.size,
              total: room.participants.size
            }));
          }

          if (room.answeredUsers.size >= room.participants.size && room.timer) {
            clearTimeout(room.timer);
            setTimeout(() => endQuestion(room, sessionId), 800);
          }
        }
      }
    });

    ws.on('close', () => {
      if (user.role === 'organizer') {
        room.organizer = null;
      } else {
        room.participants.delete(user.id);
        if (room.organizer) {
          safeSend(room.organizer, JSON.stringify({
            type: 'participant_left',
            userId: user.id,
            participantCount: room.participants.size
          }));
        }
      }
    });
  });
}

function forceCloseRoom(sessionId, reason = 'Организатор завершил квиз') {
  const room = rooms.get(sessionId);
  if (!room) return;
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
  broadcast(room, { type: 'quiz_cancelled', reason });
  rooms.delete(sessionId);
}

module.exports = { setupWebSocket, forceCloseRoom };
