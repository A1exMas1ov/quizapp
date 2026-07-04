const FinalResultsPage = {
  async render(params) {
    if (!AuthStore.isLoggedIn()) return Router.navigate('/auth');
    const sessionId = params.id;
    const app = document.getElementById('app');

    app.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

    try {
      const data = await API.getSessionResults(sessionId);
      this.draw(data, sessionId);
    } catch(e) {
      toast(e.message, 'error');
      Router.navigate('/');
    }
  },

  draw(data, sessionId) {
    const app = document.getElementById('app');
    const participants = data.participants;
    const myId = data.my_user_id;
    const myIdx = participants.findIndex(p => p.id === myId);

    const medalColor = i => i===0?'#F59E0B':i===1?'#94A3B8':i===2?'#B45309':null;
    const top3 = participants.slice(0,3);

    app.innerHTML = `
      <nav class="topbar" style="position:relative;z-index:10;">
        <div class="logo" onclick="Router.navigate('/')">Quiz<span class="dot">App</span></div>
        <div class="flex gap-12">
          ${AuthStore.isOrganizer() ? `<button class="btn btn-ghost btn-sm" id="toDashBtn">Мои квизы</button>` : `<button class="btn btn-ghost btn-sm" id="toDashBtn">Мой кабинет</button>`}
        </div>
      </nav>

      <div class="text-center mt-32" style="position:relative;z-index:1;">
        <div class="badge badge-lime mb-16" style="padding:7px 18px;">🎉 Квиз завершён</div>
        <h1 class="font-h" style="font-size:clamp(28px,4vw,44px);font-weight:700;margin-bottom:8px;">${escapeHtml(data.quiz_title || 'Квиз')}</h1>
        <p class="text-muted">${data.total_questions} вопросов · ${participants.length} участников</p>
      </div>

      <div class="fr-podium" style="position:relative;z-index:1;">
        ${top3[1] ? this.podiumItem(top3[1], 1) : ''}
        ${top3[0] ? this.podiumItem(top3[0], 0) : ''}
        ${top3[2] ? this.podiumItem(top3[2], 2) : ''}
      </div>

      <div class="fr-content" style="position:relative;z-index:1;">
        <div style="padding-right:32px;">
          <div class="section-title mb-16">Полный рейтинг</div>
          <div class="flex-col gap-8">
            ${participants.map((p,i) => `
              <div class="lb-row ${p.id===myId?'me':''}">
                <div class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i+1}</div>
                <div class="lb-avatar" style="background:${this.colorFor(i)}33;color:${this.colorFor(i)}">${AuthStore.initials(p.name)}</div>
                <div style="flex:1;">
                  <div class="lb-name">${escapeHtml(p.name)} ${p.id===myId?'<span class="text-purple text-xs">(вы)</span>':''}</div>
                  <div class="text-xs text-muted">${p.correct_count}/${data.total_questions} верно</div>
                </div>
                <div class="lb-pts">${p.total_score}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('toDashBtn').addEventListener('click', () => {
      Router.navigate(AuthStore.isOrganizer() ? '/dashboard' : '/my-quizzes');
    });
  },

  podiumItem(p, rank) {
    const heights = [100, 70, 50];
    const sizes = [72, 56, 56];
    const labels = ['1','2','3'];
    const colors = ['#F59E0B','#94A3B8','#B45309'];
    return `
      <div class="fr-pitem">
        <div class="fr-avatar" style="width:${sizes[rank]}px;height:${sizes[rank]}px;font-size:${rank===0?22:16}px;border-color:${colors[rank]};background:${colors[rank]}22;color:${colors[rank]}">${AuthStore.initials(p.name)}</div>
        <div class="text-sm font-bold" style="margin-bottom:4px;">${escapeHtml(p.name)}</div>
        <div class="font-h mb-8" style="color:${colors[rank]};font-size:15px;font-weight:700;">${p.total_score}</div>
        <div class="fr-block" style="height:${heights[rank]}px;background:linear-gradient(180deg, ${colors[rank]}33 0%, ${colors[rank]}11 100%);border:1px solid ${colors[rank]}44;">${labels[rank]}</div>
      </div>
    `;
  },

  colorFor(i) {
    const colors = ['#F59E0B','#94A3B8','#B45309','#22C55E','#06B6D4','#EC4899','#A3E635','#EF4444'];
    return colors[i % colors.length];
  },

  avgPercent(participants, totalQ) {
    if (!participants.length || !totalQ) return 0;
    const avg = participants.reduce((s,p) => s + (p.correct_count/totalQ), 0) / participants.length;
    return Math.round(avg * 100);
  },
};
