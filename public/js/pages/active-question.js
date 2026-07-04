const HostQuestionPage = {
  ws: null,
  sessionId: null,
  currentQuestion: null,
  totalQuestions: 0,

  async render(params) {
    if (!AuthStore.isLoggedIn() || !AuthStore.isOrganizer()) return Router.navigate('/auth');
    this.sessionId = params.id;

    const app = document.getElementById('app');
    app.innerHTML = `
<div class="hq-topbar">
        <div class="logo" style="border:none;padding:0;">Quiz<span class="dot">App</span></div>
        <div class="hq-progress">
          <div class="text-xs text-muted text-center mb-8" id="qLabel">Вопрос — / —</div>
          <div class="progress-bar"><div class="progress-fill" id="progFill" style="width:0%"></div></div>
        </div>
        <button class="btn btn-ghost btn-sm" id="endQBtn">Завершить вопрос ⏭</button>
      </div>
      <div class="hq-main">
        <div class="timer-wrap mb-24">
          <svg class="timer-svg" width="100" height="100" viewBox="0 0 100 100">
            <circle class="timer-bg" cx="50" cy="50" r="45"/>
            <circle class="timer-ring" id="timerRing" cx="50" cy="50" r="45"/>
          </svg>
          <div class="timer-num" id="timerNum">--</div>
        </div>
        <div class="hq-qtext" id="qText">Ожидание вопроса…</div>
        <div id="qImageWrap"></div>
        <div class="answers-grid" id="answersGrid"></div>
        <div class="flex items-center gap-24 mt-32">
          <div class="badge badge-lime" style="padding:8px 18px;">Ответили: <span id="answeredNum" class="font-bold">0</span>&nbsp;/ <span id="totalParts">0</span></div>
        </div>
        <button class="btn btn-primary btn-lg mt-24" id="nextBtn" style="display:none;">Следующий вопрос →</button>
      </div>
    `;

    document.getElementById('endQBtn').addEventListener('click', () => {
      if (this.ws) this.ws.send(JSON.stringify({ type: 'end_question_early' }));
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
      document.getElementById('nextBtn').style.display = 'none';
      if (this.ws) this.ws.send(JSON.stringify({ type: 'next_question' }));
    });

    this.connectWS();
    return () => this.cleanup();
  },

  connectWS() {
    if (window.__activeWS && window.__activeSessionId === this.sessionId) {
      this.ws = window.__activeWS;
      window.__activeWS = null;
      this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
      return;
    }
    const token = AuthStore.getWsToken();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws?token=${token}&session=${this.sessionId}`);
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
  },

  handleMessage(msg) {
    if (msg.type === 'question') {
      this.currentQuestion = msg.question;
      this.totalQuestions = msg.totalQuestions;
      this.renderQuestion(msg);
    }
    if (msg.type === 'answer_progress') {
      document.getElementById('answeredNum').textContent = msg.answered;
      document.getElementById('totalParts').textContent = msg.total;
    }
    if (msg.type === 'question_end') {
      this.revealAnswer(msg);
    }
    if (msg.type === 'quiz_finished') {
      sessionStorage.setItem('qf_final_leaderboard_' + this.sessionId, JSON.stringify(msg.leaderboard));
      Router.navigate(`/final/${this.sessionId}`);
    }
    if (msg.type === 'quiz_cancelled') {
      toast(msg.reason || 'Сессия завершена', 'error');
      Router.navigate('/dashboard');
    }
  },

  renderQuestion(msg) {
    const q = msg.question;
    document.getElementById('qLabel').textContent = `Вопрос ${msg.questionIndex+1} / ${msg.totalQuestions}`;
    document.getElementById('progFill').style.width = ((msg.questionIndex+1)/msg.totalQuestions*100) + '%';
    document.getElementById('qText').textContent = q.text;
    document.getElementById('qImageWrap').innerHTML = q.image_url
      ? `<img src="${escapeHtml(q.image_url)}" style="max-width:320px;max-height:240px;border-radius:12px;margin-bottom:24px;object-fit:cover;">`
      : '';
    document.getElementById('answeredNum').textContent = '0';
    document.getElementById('nextBtn').style.display = 'none';

    const letters = ['А','Б','В','Г','Д','Е'];
    const colorClasses = ['l-a','l-b','l-c','l-d','l-a','l-b'];
    document.getElementById('answersGrid').innerHTML = q.answers.map((a, i) => `
      <div class="answer-btn" style="cursor:default;">
        <span class="answer-letter ${colorClasses[i%4]}">${letters[i]}</span>
        <span class="answer-text">${escapeHtml(a.text)}</span>
      </div>
    `).join('');

    this.startTimer(msg.timeLimit, msg.questionStartTime);
  },

  startTimer(timeLimit, startTime) {
    if (this._timerInterval) clearInterval(this._timerInterval);
    const ring = document.getElementById('timerRing');
    const numEl = document.getElementById('timerNum');
    const circumference = 2 * Math.PI * 45;

    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      const ratio = remaining / timeLimit;
      ring.style.strokeDashoffset = circumference * (1 - ratio);
      ring.style.stroke = ratio > .5 ? '#A3E635' : ratio > .25 ? '#F59E0B' : '#EF4444';
      numEl.textContent = Math.ceil(remaining);
      numEl.style.color = ratio <= .25 ? '#EF4444' : 'var(--white)';
      if (remaining <= 0) clearInterval(this._timerInterval);
    };
    tick();
    this._timerInterval = setInterval(tick, 200);
  },

  revealAnswer(msg) {
    if (this._timerInterval) clearInterval(this._timerInterval);
    const buttons = document.querySelectorAll('#answersGrid .answer-btn');
    const q = this.currentQuestion;
    buttons.forEach((btn, i) => {
      const a = q.answers[i];
      if (msg.correctAnswerIds.includes(a.id)) btn.classList.add('correct');
    });
    document.getElementById('nextBtn').style.display = 'inline-flex';
    document.getElementById('nextBtn').textContent = (this.totalQuestions && (this.currentQIdx+1 >= this.totalQuestions)) ? 'Показать результаты →' : 'Следующий вопрос →';
  },

  cleanup() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
};

const PlayQuestionPage = {
  ws: null,
  sessionId: null,
  currentQuestionId: null,
  selectedIds: new Set(),
  answered: false,

  async render(params) {
    if (!AuthStore.isLoggedIn() || !AuthStore.isParticipant()) return Router.navigate('/auth');
    this.sessionId = params.id;
    this.selectedIds = new Set();
    this.answered = false;

    const app = document.getElementById('app');
    app.innerHTML = `
<div class="pq-topbar">
        <div class="logo" style="border:none;padding:0;">Quiz<span class="dot">App</span></div>
        <div class="pq-progress">
          <div class="text-xs text-muted text-center mb-8" id="qLabel">—</div>
          <div class="progress-bar"><div class="progress-fill" id="progFill" style="width:0%"></div></div>
        </div>
        <div class="badge badge-purple" id="myScoreBadge">0 очк.</div>
      </div>
      <div class="pq-main" id="pqMain">
        <div class="waiting-msg">
          <div class="spinner" style="margin:0 auto 16px;"></div>
          <div class="text-muted">Ожидаем вопрос…</div>
        </div>
      </div>
    `;

    if (window.__activeWS && window.__activeSessionId === this.sessionId) {
      this.ws = window.__activeWS;
      window.__activeWS = null;
      this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
      this.ws.onerror = () => toast('Ошибка подключения', 'error');
    } else {
      this.connectWS();
    }
    return () => this.cleanup();
  },

  connectWS() {
    const token = AuthStore.getWsToken();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws?token=${token}&session=${this.sessionId}`);
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
    this.ws.onerror = () => toast('Ошибка подключения', 'error');
  },

  handleMessage(msg) {
    if (msg.type === 'question') {
      this.answered = false;
      this.selectedIds = new Set();
      this.currentQuestionId = msg.question.id;
      this.renderQuestion(msg);
    }
    if (msg.type === 'answer_received') {
      this.showAnswerFeedback(msg);
    }
    if (msg.type === 'question_end') {
      this.revealCorrect(msg);
    }
    if (msg.type === 'quiz_finished') {
      sessionStorage.setItem('qf_final_leaderboard_' + this.sessionId, JSON.stringify(msg.leaderboard));
      Router.navigate(`/final/${this.sessionId}`);
    }
    if (msg.type === 'quiz_cancelled') {
      toast(msg.reason || 'Организатор завершил квиз', 'error');
      Router.navigate('/');
    }
  },

  renderQuestion(msg) {
    const q = msg.question;
    document.getElementById('qLabel').textContent = `Вопрос ${msg.questionIndex+1} / ${msg.totalQuestions}`;
    document.getElementById('progFill').style.width = ((msg.questionIndex+1)/msg.totalQuestions*100) + '%';

    const letters = ['А','Б','В','Г','Д','Е'];
    const colorClasses = ['l-a','l-b','l-c','l-d','l-a','l-b'];
    const isMultiple = q.type === 'multiple';

    document.getElementById('pqMain').innerHTML = `
      <div class="timer-wrap mb-24">
        <svg class="timer-svg" width="90" height="90" viewBox="0 0 100 100">
          <circle class="timer-bg" cx="50" cy="50" r="45"/>
          <circle class="timer-ring" id="timerRing" cx="50" cy="50" r="45"/>
        </svg>
        <div class="timer-num" id="timerNum" style="font-size:22px;">--</div>
      </div>
      <div class="pq-qtext">${escapeHtml(q.text)}</div>
      ${q.image_url ? `<img src="${escapeHtml(q.image_url)}" style="max-width:320px;border-radius:12px;margin-bottom:24px;">` : ''}
      <div class="text-sm text-muted mb-24">${isMultiple ? 'Выберите все подходящие ответы' : 'Выберите один правильный ответ'}</div>
      <div class="answers-grid" id="answersGrid">
        ${q.answers.map((a,i) => `
          <button class="answer-btn" data-aid="${a.id}">
            <span class="answer-letter ${colorClasses[i%4]}">${letters[i]}</span>
            <span class="answer-text">${escapeHtml(a.text)}</span>
          </button>
        `).join('')}
      </div>
      ${isMultiple ? `<button class="btn btn-lime btn-lg mt-24" id="submitMultiBtn">Подтвердить ответ</button>` : ''}
    `;

    document.querySelectorAll('#answersGrid .answer-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleAnswerClick(btn, isMultiple));
    });
    if (isMultiple) {
      document.getElementById('submitMultiBtn').addEventListener('click', () => this.submitAnswer());
    }

    this.startTimer(msg.timeLimit, msg.questionStartTime);
  },

  handleAnswerClick(btn, isMultiple) {
    if (this.answered) return;
    const aid = parseInt(btn.dataset.aid);

    if (isMultiple) {
      btn.classList.toggle('selected');
      if (this.selectedIds.has(aid)) this.selectedIds.delete(aid);
      else this.selectedIds.add(aid);
    } else {
      this.selectedIds = new Set([aid]);
      document.querySelectorAll('#answersGrid .answer-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      this.submitAnswer();
    }
  },

  submitAnswer() {
    if (this.answered || !this.selectedIds.size) return;
    this.answered = true;
    document.querySelectorAll('#answersGrid .answer-btn').forEach(b => b.disabled = true);
    const submitBtn = document.getElementById('submitMultiBtn');
    if (submitBtn) submitBtn.disabled = true;

    this.ws.send(JSON.stringify({
      type: 'submit_answer',
      questionId: this.currentQuestionId,
      answerIds: Array.from(this.selectedIds)
    }));
  },

  showAnswerFeedback(msg) {
    const badge = document.getElementById('myScoreBadge');
    if (msg.score > 0) {
      this._myScore = (this._myScore || 0) + msg.score;
      badge.textContent = `${this._myScore} очк. (+${msg.score})`;
      badge.className = 'badge badge-lime';
    } else {
      badge.textContent = `${this._myScore || 0} очк.`;
    }
  },

  revealCorrect(msg) {
    if (this._timerInterval) clearInterval(this._timerInterval);
    document.querySelectorAll('#answersGrid .answer-btn').forEach(btn => {
      btn.disabled = true;
      const aid = parseInt(btn.dataset.aid);
      if (msg.correctAnswerIds.includes(aid)) {
        btn.classList.add('correct');
      } else if (btn.classList.contains('selected')) {
        btn.classList.add('wrong');
      }
    });
    if (!this.answered) {
      document.getElementById('pqMain').insertAdjacentHTML('beforeend',
        `<div class="badge badge-red mt-24" style="padding:10px 20px;">Время вышло — вы не ответили</div>`);
    }
  },

  startTimer(timeLimit, startTime) {
    if (this._timerInterval) clearInterval(this._timerInterval);
    const ring = document.getElementById('timerRing');
    const numEl = document.getElementById('timerNum');
    const circumference = 2 * Math.PI * 45;

    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      const ratio = remaining / timeLimit;
      if (ring) ring.style.strokeDashoffset = circumference * (1 - ratio);
      if (ring) ring.style.stroke = ratio > .5 ? '#A3E635' : ratio > .25 ? '#F59E0B' : '#EF4444';
      if (numEl) numEl.textContent = Math.ceil(remaining);
      if (remaining <= 0) clearInterval(this._timerInterval);
    };
    tick();
    this._timerInterval = setInterval(tick, 200);
  },

  cleanup() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
};
