const QuizBuilderPage = {
  quiz: null,
  questions: [],
  selectedQId: null,

  async render(params) {
    if (!AuthStore.isLoggedIn() || !AuthStore.isOrganizer()) return Router.navigate('/auth');

    const app = document.getElementById('app');
    const isNew = !params.id || params.id === 'new';

    app.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

    if (isNew) {
      try {
        const { quiz } = await API.createQuiz({ title: 'Новый квиз', category: 'Общая эрудиция', time_per_question: 30 });
        Router.navigate(`/quiz/${quiz.id}/edit`);
      } catch(e) { toast(e.message, 'error'); Router.navigate('/dashboard'); }
      return;
    }

    try {
      const { quiz, questions } = await API.getQuiz(params.id);
      this.quiz = quiz;
      this.questions = questions;
      this.selectedQId = questions[0]?.id || null;
      this.draw();
    } catch(e) {
      if (e.message.includes('доступ') || e.message.includes('403') || e.message.includes('Нет')) {
        app.innerHTML = `
          <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;">
            <div style="font-size:48px;margin-bottom:24px;">🔒</div>
            <h2 class="font-h" style="font-size:28px;font-weight:700;margin-bottom:12px;">Нет доступа</h2>
            <p class="text-muted" style="margin-bottom:32px;">Этот квиз принадлежит другому организатору.</p>
            <button class="btn btn-primary" onclick="Router.navigate('/dashboard')">← В мой кабинет</button>
          </div>`;
      } else {
        toast(e.message, 'error');
        Router.navigate('/dashboard');
      }
    }
  },

  draw() {
    const app = document.getElementById('app');
    const q = this.quiz;

    app.innerHTML = `
<div class="qb-topbar">
        <a class="text-muted text-sm" style="cursor:pointer; text-decoration:none;" id="backBtn">← Назад</a>
        <div style="display:flex;align-items:center;gap:8px;position:relative;">
          <span style="font-size:14px;color:var(--muted);">✏️</span>
          <input class="qb-title-input" id="quizTitleInput" type="text" value="${escapeHtml(q.title)}" placeholder="Название квиза…" title="Кликни чтобы изменить название">
          <span class="text-xs text-muted" id="saveStatus" style="white-space:nowrap;"></span>
        </div>
        <div class="flex gap-8 items-center">
          ${q.status === 'draft' ? `<button class="btn btn-danger btn-sm" id="deleteQuizBtn" title="Удалить квиз">🗑 Удалить</button>` : ''}
          <button class="btn btn-lime btn-sm" id="launchBtn">${q.status === 'active' ? '▶ Открыть' : '▶ Запустить'}</button>
        </div>
      </div>

      <div class="qb-wrap">
        <div class="qb-panel qb-left">
          <div class="panel-section">
            <div class="panel-label">Настройки квиза</div>
            <div class="field"><label>Категория</label>
              <select class="input" id="catSelect">
                ${['Математика','История','Видеоигры','Литература','Технологии','Музыка'].map(c =>
                  `<option ${q.category===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>Время по умолчанию (сек)</label>
              <input type="range" min="10" max="120" value="${q.time_per_question}" id="defTimeRange" style="width:100%;">
              <div class="text-right text-sm text-lime" style="text-align:right;"><span id="defTimeVal">${q.time_per_question}</span> сек</div>
            </div>
          </div>
          <div class="panel-section">
            <div class="panel-label">Правила</div>
            <div class="field"><label><input type="checkbox" id="speedCheck" ${q.score_by_speed?'checked':''} style="accent-color:var(--purple);margin-right:6px;">Баллы за скорость ответа</label></div>
            <div class="field"><label><input type="checkbox" id="shuffleCheck" ${q.shuffle_questions?'checked':''} style="accent-color:var(--purple);margin-right:6px;">Случайный порядок вопросов</label></div>
            <div class="field"><label><input type="checkbox" id="lbCheck" ${q.show_leaderboard?'checked':''} style="accent-color:var(--purple);margin-right:6px;">Показывать рейтинг после вопроса</label></div>
          </div>
        </div>

        <div class="qb-panel">
          <div class="flex justify-between items-center mb-16">
            <h2 class="font-h" style="font-size:16px;font-weight:600;">Вопросы <span class="text-muted" style="font-weight:400;">(${this.questions.length})</span></h2>
          </div>
          <div id="questionsList"></div>
          <button class="btn btn-ghost btn-full" id="addQBtn" style="border-style:dashed; margin-top:8px;">+ Добавить вопрос</button>
        </div>

        <div class="qb-panel qb-right" id="editorPanel"></div>
      </div>
    `;

    document.getElementById('backBtn').addEventListener('click', () => Router.navigate('/dashboard'));
    document.getElementById('launchBtn').addEventListener('click', () => this.launchQuiz());
    document.getElementById('deleteQuizBtn')?.addEventListener('click', async () => {
      if (!confirm(`Удалить «${this.quiz.title}»? Это действие нельзя отменить.`)) return;
      try {
        await API.deleteQuiz(this.quiz.id);
        toast('Квиз удалён');
        Router.navigate('/dashboard');
      } catch(e) { toast(e.message, 'error'); }
    });

    const debouncedSave = debounce(() => this.saveQuizSettings(), 600);
    document.getElementById('quizTitleInput').addEventListener('input', debouncedSave);
    document.getElementById('catSelect').addEventListener('change', debouncedSave);
    document.getElementById('speedCheck').addEventListener('change', debouncedSave);
    document.getElementById('shuffleCheck').addEventListener('change', debouncedSave);
    document.getElementById('lbCheck').addEventListener('change', debouncedSave);
    document.getElementById('defTimeRange').addEventListener('input', (e) => {
      document.getElementById('defTimeVal').textContent = e.target.value;
      debouncedSave();
    });

    document.getElementById('addQBtn').addEventListener('click', () => this.addQuestion());

    this.drawQuestionsList();
    this.drawEditor();
  },

  drawQuestionsList() {
    const el = document.getElementById('questionsList');
    if (!this.questions.length) {
      el.innerHTML = `<div class="text-muted text-sm text-center" style="padding:24px;">Пока нет вопросов</div>`;
      return;
    }
    el.innerHTML = this.questions.map((q, i) => `
      <div class="question-card ${q.id===this.selectedQId?'selected':''}" data-qid="${q.id}">
        <button class="q-del-btn" data-delq="${q.id}">✕</button>
        <div class="text-xs text-purple font-bold mb-8">ВОПРОС ${i+1}</div>
        <div class="text-sm" style="font-weight:500;margin-bottom:10px;line-height:1.4;">${escapeHtml(q.text || 'Без текста')}</div>
        <div class="flex gap-12 text-xs text-muted">
          <span class="badge badge-muted">⏱ ${q.time_limit || this.quiz.time_per_question} сек</span>
          <span class="badge badge-muted">${q.type==='multiple'?'☑ Несколько':'☑ Один'}</span>
          <span class="badge badge-muted">${q.image_url?'🖼 Картинка':'📝 Текст'}</span>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('[data-qid]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-delq]')) return;
        this.selectedQId = parseInt(card.dataset.qid);
        this.drawQuestionsList();
        this.drawEditor();
      });
    });
    el.querySelectorAll('[data-delq]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Удалить вопрос?')) return;
        const id = parseInt(btn.dataset.delq);
        try {
          await API.deleteQuestion(id);
          this.questions = this.questions.filter(q => q.id !== id);
          if (this.selectedQId === id) this.selectedQId = this.questions[0]?.id || null;
          this.drawQuestionsList();
          this.drawEditor();
        } catch(err) { toast(err.message, 'error'); }
      });
    });
  },

  drawEditor() {
    const panel = document.getElementById('editorPanel');
    const q = this.questions.find(q => q.id === this.selectedQId);

    if (!q) {
      panel.innerHTML = `<div class="text-muted text-sm text-center" style="padding:48px 16px;">Выберите вопрос слева или создайте новый</div>`;
      return;
    }

    const hasImage = !!q.image_url;

    panel.innerHTML = `
      <h3 class="font-h" style="font-size:15px;font-weight:600;margin-bottom:20px;">Редактор вопроса</h3>

      <div class="panel-label" style="margin-bottom:8px;">Текст вопроса</div>
      <textarea class="input" id="qText" style="margin-bottom:16px;">${escapeHtml(q.text)}</textarea>

      <div class="panel-label" style="margin-bottom:8px;">Изображение (необязательно)</div>
      <div class="field" style="margin-bottom:16px;">
        <input class="input" type="text" id="qImageUrl" placeholder="URL изображения…" value="${q.image_url || ''}">
      </div>

      <div class="panel-label" style="margin-bottom:8px;">Тип ответа</div>
      <div class="q-type-tabs" id="typeTabsAnswer">
        <button class="q-type-tab ${q.type==='single'?'active':''}" data-val="single">Один</button>
        <button class="q-type-tab ${q.type==='multiple'?'active':''}" data-val="multiple">Несколько</button>
      </div>

      <div class="panel-label" style="margin-top:16px;margin-bottom:8px;">Варианты ответов <span class="text-xs" style="text-transform:none;font-weight:400;">(нажмите ✓ чтобы отметить верный)</span></div>
      <div id="answerList">
        ${q.answers.map(a => this.answerRowHtml(a)).join('')}
      </div>
      <button class="btn btn-ghost btn-full btn-sm" id="addAnsBtn" style="border-style:dashed; margin-top:4px;">+ Добавить вариант</button>

      <div style="margin-top:20px;">
        <div class="flex justify-between items-center mb-8">
          <label class="text-sm text-muted">Время на ответ</label>
          <span class="text-sm text-lime" id="qTimerVal">${q.time_limit || this.quiz.time_per_question} сек</span>
        </div>
        <input type="range" min="10" max="120" value="${q.time_limit || this.quiz.time_per_question}" id="qTimerRange" style="width:100%;">
      </div>

      <button class="btn btn-primary btn-full" id="saveQBtn" style="margin-top:24px;">Сохранить вопрос</button>
    `;

    document.getElementById('typeTabsAnswer').querySelectorAll('.q-type-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#typeTabsAnswer .q-type-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('qTimerRange').addEventListener('input', (e) => {
      document.getElementById('qTimerVal').textContent = e.target.value + ' сек';
    });

    document.getElementById('addAnsBtn').addEventListener('click', () => {
      const list = document.getElementById('answerList');
      const div = document.createElement('div');
      div.innerHTML = this.answerRowHtml({ id: 'new'+Date.now(), text: '', is_correct: 0 });
      const row = div.firstElementChild;
      list.appendChild(row);
      this.bindAnswerRow(row);
    });

    document.querySelectorAll('.answer-row').forEach(row => this.bindAnswerRow(row));

    document.getElementById('saveQBtn').addEventListener('click', () => this.saveQuestion());
  },

  answerRowHtml(a) {
    return `
      <div class="answer-row" data-aid="${a.id}">
        <div class="answer-check ${a.is_correct?'correct':''}" data-correct-toggle></div>
        <input class="input" type="text" value="${escapeHtml(a.text)}" placeholder="Вариант ответа…" style="flex:1;">
        <button class="text-muted" style="background:none;border:none;cursor:pointer;font-size:14px;" data-remove-ans>✕</button>
      </div>
    `;
  },

  bindAnswerRow(row) {
    row.querySelector('[data-correct-toggle]').addEventListener('click', function() {
      this.classList.toggle('correct');
    });
    row.querySelector('[data-remove-ans]').addEventListener('click', () => row.remove());
  },

  async addQuestion() {
    try {
      const { question } = await API.addQuestion(this.quiz.id, {
        text: 'Новый вопрос…',
        type: 'single',
        time_limit: this.quiz.time_per_question,
        order_num: this.questions.length,
        answers: [
          { text: 'Вариант 1', is_correct: true },
          { text: 'Вариант 2', is_correct: false }
        ]
      });
      this.questions.push(question);
      this.selectedQId = question.id;
      this.drawQuestionsList();
      this.drawEditor();
    } catch(e) { toast(e.message, 'error'); }
  },

  async saveQuestion() {
    const q = this.questions.find(q => q.id === this.selectedQId);
    if (!q) return;

    const text = document.getElementById('qText').value.trim();
    const image_url = document.getElementById('qImageUrl').value.trim();
    const type = document.querySelector('#typeTabsAnswer .active').dataset.val;
    const time_limit = parseInt(document.getElementById('qTimerRange').value);
    const answerRows = document.querySelectorAll('#answerList .answer-row');
    const answers = Array.from(answerRows).map(row => ({
      text: row.querySelector('input').value.trim(),
      is_correct: row.querySelector('[data-correct-toggle]').classList.contains('correct')
    })).filter(a => a.text);

    if (!text) return toast('Введите текст вопроса', 'error');
    if (answers.length < 2) return toast('Нужно минимум 2 варианта ответа', 'error');
    if (!answers.some(a => a.is_correct)) return toast('Отметьте хотя бы один правильный ответ', 'error');

    try {
      await API.updateQuestion(q.id, { text, type, image_url: image_url || null, time_limit, answers });
      const { quiz, questions } = await API.getQuiz(this.quiz.id);
      this.quiz = quiz;
      this.questions = questions;
      this.drawQuestionsList();
      this.drawEditor();
      toast('Вопрос сохранён');
    } catch(e) { toast(e.message, 'error'); }
  },

  async saveQuizSettings() {
    const status = document.getElementById('saveStatus');
    status.textContent = 'Сохранение…';
    try {
      await API.updateQuiz(this.quiz.id, {
        title: document.getElementById('quizTitleInput').value.trim() || 'Без названия',
        category: document.getElementById('catSelect').value,
        time_per_question: parseInt(document.getElementById('defTimeRange').value),
        shuffle_questions: document.getElementById('shuffleCheck').checked,
        score_by_speed: document.getElementById('speedCheck').checked,
        show_leaderboard: document.getElementById('lbCheck').checked
      });
      status.textContent = '✓ Сохранено';
      setTimeout(() => { if (status) status.textContent = ''; }, 1500);
    } catch(e) { toast(e.message, 'error'); }
  },

  async launchQuiz() {
    if (!this.questions.length) return toast('Добавьте хотя бы один вопрос', 'error');
    try {
      const data = await API.launchQuiz(this.quiz.id);
      sessionStorage.setItem('qf_room_code_' + data.session_id, data.room_code);
      sessionStorage.setItem('qf_quiz_id_' + data.session_id, this.quiz.id);
      sessionStorage.setItem('qf_quiz_title_' + data.session_id, this.quiz.title);
      if (data.resumed && data.current_question_idx >= 0) {
        Router.navigate(`/host-question/${data.session_id}`);
      } else {
        Router.navigate(`/host/${data.session_id}`);
      }
    } catch(e) { toast(e.message, 'error'); }
  }
};

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
