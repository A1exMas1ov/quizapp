const DashboardParticipantPage = {
  async render() {
    if (!AuthStore.isLoggedIn() || !AuthStore.isParticipant()) return Router.navigate('/');

    const app = document.getElementById('app');
    app.innerHTML = `
      ${renderSidebar('dashboard', AuthStore.user)}
      <main class="main-with-sidebar">
        <div class="flex justify-between items-center mb-24">
          <h1 class="font-h" style="font-size:26px;font-weight:700;">Мой кабинет</h1>
          <button class="btn btn-lime" id="joinBtn2">+ Присоединиться к квизу</button>
        </div>
        <div id="statsRow" class="loading"><div class="spinner"></div></div>
        <div class="section-title mb-16" style="margin-top:32px;">История участия</div>
        <div id="historyList" class="loading"><div class="spinner"></div></div>
      </main>
    `;
    bindSidebar();
    document.getElementById('joinBtn2').addEventListener('click', () => Router.navigate('/'));

    try {
      const { history } = await API.getMyHistory();
      this.renderStats(history);
      this.renderHistory(history);
    } catch(e) { toast(e.message, 'error'); }
  },

  renderStats(history) {
    const total = history.length;
    const wins = history.filter(h => h.place === 1).length;
    const totalScore = history.reduce((s,h) => s + (h.total_score||0), 0);
    const avgAcc = total ? Math.round(history.reduce((s,h) => s + (h.correct_q / Math.max(h.total_q,1)), 0) / total * 100) : 0;

    document.getElementById('statsRow').outerHTML = `
      <div id="statsRow" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        <div class="card"><div class="text-sm text-muted mb-8">Квизов пройдено</div><div class="font-h" style="font-size:30px;font-weight:700;">${total}</div></div>
        <div class="card"><div class="text-sm text-muted mb-8">Средняя точность</div><div class="font-h" style="font-size:30px;font-weight:700;">${avgAcc}%</div></div>
        <div class="card"><div class="text-sm text-muted mb-8">Всего очков</div><div class="font-h" style="font-size:30px;font-weight:700;">${totalScore}</div></div>
      </div>
    `;
  },

  renderHistory(history) {
    const el = document.getElementById('historyList');
    if (!history.length) {
      el.innerHTML = `<div class="card text-center text-muted" style="padding:48px;">Вы ещё не участвовали ни в одном квизе. <a href="#/" style="color:var(--purple-l)">Найти квиз →</a></div>`;
      return;
    }
    const medal = (place) => place===1?'🥇':place===2?'🥈':place===3?'🥉':null;
    el.innerHTML = `<div class="flex-col gap-10">
      ${history.map(h => `
        <div class="card" style="display:flex;align-items:center;gap:16px;cursor:pointer;" data-session="${h.session_id}">
          <div style="width:4px;height:52px;border-radius:3px;background:var(--purple);flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${escapeHtml(h.title)}</div>
            <div class="text-xs text-muted" style="display:flex;gap:16px;">
              <span>📅 ${new Date(h.started_at).toLocaleDateString('ru-RU')}</span>
              <span>✅ ${h.correct_q}/${h.total_q} верно</span>
            </div>
          </div>
          ${medal(h.place) ? `<span class="badge badge-purple">${medal(h.place)} ${h.place}-е место</span>` : `<span class="badge badge-muted">${h.place}-е место</span>`}
          <div style="text-align:right;">
            <div class="font-h text-lime" style="font-size:20px;font-weight:700;">${h.total_score}</div>
            <div class="text-xs text-muted">очков</div>
          </div>
        </div>
      `).join('')}
    </div>`;

    el.querySelectorAll('[data-session]').forEach(card => {
      card.addEventListener('click', () => Router.navigate(`/final/${card.dataset.session}`));
    });
  }
};
