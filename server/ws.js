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
      }

      if (user.role === 'participant') {
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
