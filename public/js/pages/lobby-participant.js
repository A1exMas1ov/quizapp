const LobbyParticipantPage = {
  ws: null,
  sessionId: null,

  async render(params) {
    if (!AuthStore.isLoggedIn() || !AuthStore.isParticipant()) return Router.navigate('/auth');
    this.sessionId = params.id;

    const app = document.getElementById('app');
    const user = AuthStore.user;

    app.innerHTML = `
<div class="lp-glow"></div>
      <div class="logo" style="position:fixed; top:24px; left:40px;" onclick="Router.navigate('/')">QuizApp</div>

      <div class="lp-wrap">
        <div class="lp-card">
          <div class="lp-avatar">${AuthStore.initials(user.name)}</div>
          <div class="font-h" style="font-size:22px;font-weight:700;margin-bottom:4px;">${escapeHtml(user.name)}</div>
          <div class="text-sm text-muted mb-24">Участник</div>

          <div class="quiz-info-box" id="quizInfoBox">
            <div class="text-sm text-muted">Загрузка информации о квизе…</div>
          </div>

          <div class="badge badge-lime mb-24" style="padding:8px 18px;font-size:13px;">
            <span id="pCount">0</span> участников уже в лобби
          </div>

          <div class="mb-24">
            <div class="text-sm text-muted mb-16">Ожидаем старта от организатора…</div>
          </div>

          <div class="text-sm text-muted" id="codeDisplay"></div>
        </div>
      </div>
    `;

    this.connectWS();
    return () => this.cleanup();
  },

  connectWS() {
    const token = AuthStore.getWsToken();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws?token=${token}&session=${this.sessionId}`);

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };
    this.ws.onerror = () => toast('Ошибка подключения', 'error');
  },

  handleMessage(msg) {
    if (msg.type === 'joined') {
      document.getElementById('pCount').textContent = msg.participantCount;
      if (msg.quiz) {
        document.getElementById('quizInfoBox').innerHTML = `
          <div class="qib-row"><span>🎓</span><div><div style="font-weight:600;">${escapeHtml(msg.quiz.title)}</div></div></div>
          <div class="qib-row"><span>⏱</span><div class="text-sm">${msg.quiz.time_per_question} секунд на вопрос</div></div>
        `;
      }
    }
    if (msg.type === 'participant_joined') {
      document.getElementById('pCount').textContent = msg.participantCount;
    }
    if (msg.type === 'quiz_started') {
      window.__activeWS = this.ws;
      window.__activeSessionId = this.sessionId;
      this.ws = null;
      Router.navigate(`/play/${this.sessionId}`);
    }
    if (msg.type === 'quiz_cancelled') {
      toast(msg.reason || 'Организатор завершил квиз', 'error');
      Router.navigate('/');
    }
  },

  cleanup() {
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
};
