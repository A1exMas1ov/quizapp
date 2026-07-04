const OrgHistoryPage = {
  async render() {
    if (!AuthStore.isLoggedIn() || !AuthStore.isOrganizer()) return Router.navigate('/auth');
    const app = document.getElementById('app');
    app.innerHTML = `
      ${renderSidebar('history', AuthStore.user)}
      <main class="main-with-sidebar">
        <h1 class="font-h mb-24" style="font-size:26px;font-weight:700;">История сессий</h1>
        <div id="histList" class="loading"><div class="spinner"></div></div>
      </main>
    `;
    bindSidebar();
    try {
      const { history } = await API.getMyQuizHistory();
      this.draw(history);
    } catch(e) { toast(e.message, 'error'); }
  },

  draw(history) {
    const el = document.getElementById('histList');
    if (!history.length) {
      el.innerHTML = `<div class="card text-center text-muted" style="padding:48px;">Вы ещё не запускали ни одного квиза.</div>`;
      return;
    }
    el.innerHTML = `<div class="flex-col gap-10">
      ${history.map(h => {
        let badge;
        if (!h.finished_at) {
          badge = `<span class="badge badge-lime"><span class="pulse-dot"></span> Активен сейчас</span>`;
        } else if (h.participant_count === 0 || h.answered_count === 0) {
          badge = `<span class="badge badge-muted">Отменён / без ответов</span>`;
        } else {
          badge = `<span class="badge badge-purple">Завершён</span>`;
        }
        return `
        <div class="card" style="display:flex;align-items:center;gap:16px;cursor:pointer;" data-session="${h.session_id}">
          <div style="width:4px;height:52px;border-radius:3px;background:var(--purple);flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${escapeHtml(h.title)}</div>
            <div class="text-xs text-muted">📅 ${new Date(h.started_at).toLocaleString('ru-RU')}</div>
          </div>
          ${badge}
          <div class="text-sm text-muted">👥 ${h.participant_count} участников</div>
        </div>`;
      }).join('')}
    </div>`;
    el.querySelectorAll('[data-session]').forEach(card => {
      card.addEventListener('click', () => {
        const h = history.find(x => String(x.session_id) === card.dataset.session);
        if (h && !h.finished_at) {
          Router.navigate(`/host-question/${card.dataset.session}`);
        } else {
          Router.navigate(`/final/${card.dataset.session}`);
        }
      });
    });
  }
};
