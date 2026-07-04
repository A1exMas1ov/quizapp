function renderSidebar(activeKey, user) {
  const items = user.role === 'organizer' ? [
    { key: 'dashboard', icon: '🏠', label: 'Обзор', path: '/dashboard' },
    { key: 'history', icon: '🗂️', label: 'История сессий', path: '/org-history' }
  ] : [
    { key: 'dashboard', icon: '🏠', label: 'Мой кабинет', path: '/my-quizzes' }
  ];

  return `
    <aside class="sidebar">
      <div class="logo" id="sbLogo">Quiz<span class="dot">App</span></div>
      <div class="nav-group">
        <div class="nav-label">Главное</div>
        ${items.map(it => `<div class="nav-item ${activeKey===it.key?'active':''}" data-nav="${it.path}"><span class="icon">${it.icon}</span> ${it.label}</div>`).join('')}
      </div>
      <div class="sidebar-bottom">
        <div class="user-row" id="sbUserRow">
          <div class="avatar">${AuthStore.initials(user.name)}</div>
          <div class="user-info">
            <div class="uname">${escapeHtml(user.name)}</div>
            <div class="urole">${user.role === 'organizer' ? 'Организатор' : 'Участник'}</div>
          </div>
        </div>
      </div>
    </aside>
  `;
}

function bindSidebar() {
  document.getElementById('sbLogo')?.addEventListener('click', () => Router.navigate('/'));
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => Router.navigate(el.dataset.nav));
  });
  document.getElementById('sbUserRow')?.addEventListener('click', () => {
    if (confirm('Выйти из аккаунта?')) AuthStore.logout();
  });
}

const DashboardOrganizerPage = {
  async render() {
    if (!AuthStore.isLoggedIn()) return Router.navigate('/auth');
    if (!AuthStore.isOrganizer()) return Router.navigate('/');

    const app = document.getElementById('app');
    app.innerHTML = `
      ${renderSidebar('dashboard', AuthStore.user)}
      <main class="main-with-sidebar">
        <div class="flex justify-between items-center mb-24">
          <h1 class="font-h" style="font-size:26px;font-weight:700;">Мой кабинет</h1>
          <button class="btn btn-primary" id="newQuizBtn">+ Создать квиз</button>
        </div>
        <div id="statsRow" class="loading"><div class="spinner"></div></div>
        <div class="section-title mb-16" style="margin-top:32px;">Мои квизы</div>
        <div id="quizList" class="loading"><div class="spinner"></div></div>
      </main>
    `;
    bindSidebar();
    document.getElementById('newQuizBtn').addEventListener('click', () => Router.navigate('/quiz/new'));

    try {
      const { quizzes } = await API.getQuizzes();
      this.renderStats(quizzes);
      this.renderQuizList(quizzes);
    } catch(e) {
      toast(e.message, 'error');
    }
  },

  renderStats(quizzes) {
    const total = quizzes.length;
    const active = quizzes.filter(q => q.status === 'active').length;
    const totalQuestions = quizzes.reduce((s,q) => s + (q.question_count||0), 0);
    const sessions = quizzes.reduce((s,q) => s + (q.session_count||0), 0);

    document.getElementById('statsRow').outerHTML = `
      <div class="stats-row" id="statsRow" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        <div class="card"><div class="text-sm text-muted mb-8">Всего квизов</div><div class="font-h" style="font-size:30px;font-weight:700;">${total}</div></div>
        <div class="card"><div class="text-sm text-muted mb-8">Вопросов создано</div><div class="font-h" style="font-size:30px;font-weight:700;">${totalQuestions}</div></div>
        <div class="card"><div class="text-sm text-muted mb-8">Сессий проведено</div><div class="font-h" style="font-size:30px;font-weight:700;">${sessions}</div></div>
      </div>
    `;
  },

  renderQuizList(quizzes) {
    const el = document.getElementById('quizList');
    if (!quizzes.length) {
      el.innerHTML = `<div class="card text-center text-muted" style="padding:48px;">Пока нет ни одного квиза. <a href="#/quiz/new" style="color:var(--purple-l)">Создать первый →</a></div>`;
      return;
    }

    const statusMap = {
      draft: { label: 'Черновик', cls: 'badge-muted' },
      active: { label: '● Активен', cls: 'badge-lime' },
      finished: { label: 'Завершён', cls: 'badge-purple' }
    };

    el.innerHTML = `<div class="flex-col gap-12">
      ${quizzes.map(q => {
        const st = statusMap[q.status] || statusMap.draft;
        return `
        <div class="card" style="display:flex; align-items:center; gap:16px; cursor:pointer;" data-quiz="${q.id}">
          <div style="width:4px;height:52px;border-radius:3px;background:var(--purple);flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${escapeHtml(q.title)}</div>
            <div class="text-xs text-muted" style="display:flex;gap:16px;">
              <span>📝 ${q.question_count} вопросов</span>
              <span>⏱ ${q.time_per_question} сек/вопрос</span>
            </div>
          </div>
          <span class="badge ${st.cls}">${st.label}</span>
          <div class="flex gap-8">
            <button class="btn btn-ghost btn-sm" data-edit="${q.id}">Редакт.</button>
            ${q.status === 'active'
              ? `<button class="btn btn-danger btn-sm" data-close="${q.id}">✕ Закрыть</button>
                 <button class="btn btn-lime btn-sm" data-launch="${q.id}">▶ Открыть</button>`
              : q.status === 'draft'
                ? `<button class="btn btn-danger btn-sm" data-delete="${q.id}" title="Удалить черновик">🗑</button>
                   <button class="btn btn-lime btn-sm" data-launch="${q.id}">▶ Запустить</button>`
                : `<button class="btn btn-lime btn-sm" data-launch="${q.id}">▶ Запустить снова</button>`
            }
          </div>
        </div>`;
      }).join('')}
    </div>`;

    el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      Router.navigate(`/quiz/${b.dataset.edit}/edit`);
    }));
    el.querySelectorAll('[data-launch]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const quizId = b.dataset.launch;
        const data = await API.launchQuiz(quizId);
        const quiz = quizzes.find(q => String(q.id) === String(quizId));
        sessionStorage.setItem('qf_room_code_' + data.session_id, data.room_code);
        sessionStorage.setItem('qf_quiz_id_' + data.session_id, quizId);
        sessionStorage.setItem('qf_quiz_title_' + data.session_id, quiz?.title || 'Квиз');
        if (data.resumed && data.current_question_idx >= 0) {
          Router.navigate(`/host-question/${data.session_id}`);
        } else {
          Router.navigate(`/host/${data.session_id}`);
        }
      } catch(err) { toast(err.message, 'error'); }
    }));
    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Закрыть этот квиз? Все участники будут отключены, сессия будет помечена завершённой без результатов.')) return;
      try {
        await API.closeQuiz(b.dataset.close);
        toast('Квиз закрыт');
        this.render();
      } catch(err) { toast(err.message, 'error'); }
    }));
    el.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = quizzes.find(q => String(q.id) === b.dataset.delete)?.title || 'квиз';
      if (!confirm(`Удалить «${name}»? Это действие нельзя отменить.`)) return;
      try {
        await API.deleteQuiz(b.dataset.delete);
        toast('Квиз удалён');
        this.render();
      } catch(err) { toast(err.message, 'error'); }
    }));
    el.querySelectorAll('[data-quiz]').forEach(card => card.addEventListener('click', () => {
      Router.navigate(`/quiz/${card.dataset.quiz}/edit`);
    }));
  }
};
