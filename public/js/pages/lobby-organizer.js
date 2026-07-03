const LobbyOrganizerPage = {
  ws: null,
  sessionId: null,
  participants: new Map(),

  async render(params) {
    if (!AuthStore.isLoggedIn() || !AuthStore.isOrganizer()) return Router.navigate('/auth');
    this.sessionId = params.id;
    this.participants = new Map();

    const app = document.getElementById('app');
    app.innerHTML = `
<div class="lo-topbar">
        <div class="logo" style="border:none;padding:0;">Quiz<span class="dot">App</span></div>
        <div class="badge badge-purple" id="quizNameBadge">Загрузка…</div>
        <div class="badge badge-lime" id="statusPill"><span class="pulse-dot"></span> Подключение…</div>
      </div>

      <div class="lo-main">
        <div class="lo-left">
          <div class="text-center mb-24">
            <div class="text-xs text-muted mb-16" style="letter-spacing:.12em;text-transform:uppercase;">Код комнаты</div>
            <div class="room-code-box" id="roomCodeDisplay">----</div>
            <div class="text-sm text-muted mt-16">Участники заходят на сайт и вводят этот код</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;width:100%;max-width:560px;margin-top:24px;">
            <div class="card text-center"><div class="font-h text-purple" style="font-size:28px;font-weight:700;" id="pCountStat">0</div><div class="text-xs text-muted mt-8">Участников</div></div>
            <div class="card text-center"><div class="font-h text-purple" style="font-size:28px;font-weight:700;" id="qCountStat">-</div><div class="text-xs text-muted mt-8">Вопросов</div></div>
            <div class="card text-center"><div class="font-h text-purple" style="font-size:28px;font-weight:700;" id="timeStat">-</div><div class="text-xs text-muted mt-8">На вопрос</div></div>
          </div>

          <div class="text-center mt-32">
            <button class="btn btn-lime btn-lg" id="startBtn" style="box-shadow:0 0 32px rgba(163,230,53,.25);" disabled>▶ Начать квиз</button>
          </div>
        </div>

        <div class="lo-right">
          <div class="flex justify-between items-center mb-16">
            <h3 class="font-h" style="font-size:16px;font-weight:600;">Участники</h3>
            <span class="badge badge-purple" id="countBadge">0</span>
          </div>
          <div id="participantsList" style="flex:1; overflow-y:auto;">
            <div class="text-muted text-sm text-center" style="padding:32px 0;">Ожидаем подключений…</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('startBtn').addEventListener('click', () => this.startQuiz());
    this.loadSessionInfo();
    this.connectWS();
    return () => this.cleanup();
  },

  async loadSessionInfo() {
    const code = sessionStorage.getItem('qf_room_code_' + this.sessionId);
    const quizId = sessionStorage.getItem('qf_quiz_id_' + this.sessionId);
    if (code) document.getElementById('roomCodeDisplay').textContent = code;
    document.getElementById('quizNameBadge').textContent = sessionStorage.getItem('qf_quiz_title_' + this.sessionId) || 'Квиз';

    if (quizId) {
      try {
        const { quiz, questions } = await API.getQuiz(quizId);
        document.getElementById('qCountStat').textContent = questions.length;
        document.getElementById('timeStat').textContent = quiz.time_per_question + 'с';
        document.getElementById('quizNameBadge').textContent = quiz.title;
        if (!code && quiz.room_code) {
          document.getElementById('roomCodeDisplay').textContent = quiz.room_code;
        }
      } catch(e) {}
    }
  },

  connectWS() {
    const token = this.getToken();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws?token=${token}&session=${this.sessionId}`);

    this.ws.onopen = () => {
      document.getElementById('statusPill').innerHTML = '<span class="pulse-dot"></span> Ожидание участников';
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };

    this.ws.onerror = () => toast('Ошибка подключения к серверу', 'error');
    this.ws.onclose = () => {
      const pill = document.getElementById('statusPill');
      if (pill) pill.innerHTML = '<span class="pulse-dot" style="background:var(--red)"></span> Соединение разорвано';
    };
  },

  getToken() {
    return AuthStore.getWsToken();
  },

  handleMessage(msg) {
    if (msg.type === 'organizer_joined') {
      document.getElementById('pCountStat').textContent = msg.participantCount;
      document.getElementById('countBadge').textContent = msg.participantCount;
      document.getElementById('startBtn').disabled = msg.participantCount === 0;
    }

    if (msg.type === 'participant_joined') {
      this.participants.set(msg.user.id, msg.user);
      this.renderParticipants();
      document.getElementById('pCountStat').textContent = msg.participantCount;
      document.getElementById('countBadge').textContent = msg.participantCount;
      document.getElementById('startBtn').disabled = msg.participantCount === 0;
    }

    if (msg.type === 'participant_left') {
      this.participants.delete(msg.userId);
      this.renderParticipants();
      document.getElementById('pCountStat').textContent = msg.participantCount;
      document.getElementById('countBadge').textContent = msg.participantCount;
    }

    if (msg.type === 'quiz_started') {
      window.__activeWS = this.ws;
      window.__activeSessionId = this.sessionId;
      this.ws = null;
      Router.navigate(`/host-question/${this.sessionId}`);
    }

    if (msg.type === 'quiz_cancelled') {
      toast(msg.reason || 'Сессия завершена', 'error');
      Router.navigate('/dashboard');
    }
  },

  renderParticipants() {
    const el = document.getElementById('participantsList');
    if (!this.participants.size) {
      el.innerHTML = `<div class="text-muted text-sm text-center" style="padding:32px 0;">Ожидаем подключений…</div>`;
      return;
    }
    const colors = ['#7C3AED','#06B6D4','#F59E0B','#22C55E','#EF4444','#EC4899','#A3E635'];
    let i = 0;
    el.innerHTML = Array.from(this.participants.values()).map(p => {
      const color = colors[i++ % colors.length];
      const initials = AuthStore.initials(p.name);
      return `
        <div class="participant-row">
          <div class="lb-avatar" style="background:${color}33;color:${color}">${initials}</div>
          <div class="lb-name">${escapeHtml(p.name)}</div>
        </div>
      `;
    }).join('');
  },

  startQuiz() {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'start_quiz' }));
    }
  },

  cleanup() {
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
};
