const HomePage = {
  render() {
    const app = document.getElementById('app');
    const user = AuthStore.user;

    let navActions;
    if (user) {
      const dashLink = user.role === 'organizer' ? '#/dashboard' : '#/my-quizzes';
      navActions = `
        <a class="btn btn-ghost btn-sm" href="${dashLink}">${user.role === 'organizer' ? 'Мои квизы' : 'Мой кабинет'}</a>
        <div class="user-row" id="userMenuBtn" style="cursor:pointer; position:relative;">
          <div class="avatar">${AuthStore.initials(user.name)}</div>
          <div class="user-info">
            <div class="uname">${escapeHtml(user.name)}</div>
            <div class="urole">${user.role === 'organizer' ? 'Организатор' : 'Участник'}</div>
          </div>
        </div>
      `;
    } else {
      navActions = `
        <button class="btn btn-ghost btn-sm" id="navLoginBtn">Войти</button>
        <button class="btn btn-primary btn-sm" id="navRegisterBtn">Зарегистрироваться</button>
      `;
    }

    let heroTitle, heroSub, heroCard;
    if (user && user.role === 'organizer') {
      heroTitle = `С возвращением, <em>${escapeHtml(user.name.split(' ')[0])}</em> 👋`;
      heroSub = 'Запускай новый квиз или продолжай работу над черновиками';
      heroCard = `
        <div class="room-card">
          <div class="room-card-label">Быстрые действия</div>
          <div class="flex-col gap-12">
            <button class="btn btn-lime btn-full btn-lg" id="quickCreateBtn">+ Создать новый квиз</button>
            <button class="btn btn-ghost btn-full" id="quickDashBtn">Перейти в кабинет →</button>
          </div>
        </div>
      `;
    } else if (user && user.role === 'participant') {
      heroTitle = `С возвращением, <em>${escapeHtml(user.name.split(' ')[0])}</em> 👋`;
      heroSub = 'Введи код комнаты, чтобы присоединиться к квизу';
      heroCard = `
        <div class="room-card">
          <div class="room-card-label">Присоединиться к квизу</div>
          <div class="room-input-wrap">
            <input class="room-input" id="roomCode" type="text" placeholder="XXXX" maxlength="6">
            <button class="btn-join" id="joinBtn">Войти →</button>
          </div>
          <div class="divider">или</div>
          <button class="btn btn-ghost btn-full" id="quickDashBtn">Мой кабинет и история →</button>
        </div>
      `;
    } else {
      heroTitle = `Проводи квизы,<br>которые <em>запоминают</em>`;
      heroSub = 'Создавай вопросы, запускай игры по коду комнаты и следи за результатами вживую';
      heroCard = `
        <div class="room-card">
          <div class="room-card-label">Присоединиться к квизу</div>
          <div class="room-input-wrap">
            <input class="room-input" id="roomCode" type="text" placeholder="XXXX" maxlength="6">
            <button class="btn-join" id="joinBtn">Войти →</button>
          </div>
          <div class="divider">или</div>
          <div class="auth-links">
            <button class="btn btn-ghost" id="loginLinkBtn">Войти в аккаунт</button>
            <button class="btn btn-primary" id="registerLinkBtn">Создать квиз</button>
          </div>
        </div>
      `;
    }

    app.innerHTML = `
      <style>
        .home-nav { display: flex; align-items: center; justify-content: space-between; padding: 20px 60px; border-bottom: 1px solid var(--border); position: sticky; top:0; background: rgba(15,22,41,.92); backdrop-filter: blur(12px); z-index: 100; }
        .home-nav .nav-links { display:flex; gap:32px; }
        .home-nav .nav-links a { color:var(--muted); text-decoration:none; font-size:14px; font-weight:500; }
        .home-nav .nav-links a:hover { color:var(--white); }
        .nav-actions { display:flex; gap:12px; align-items:center; }
        .hero { display:flex; flex-direction:column; align-items:center; text-align:center; padding:100px 60px 80px; position:relative; overflow:hidden; }
        .hero::before { content:''; position:absolute; top:-120px; left:50%; transform:translateX(-50%); width:700px; height:700px; background:radial-gradient(circle, rgba(124,58,237,.18) 0%, transparent 70%); pointer-events:none; }
        .hero-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(163,230,53,.08); border:1px solid rgba(163,230,53,.25); color:var(--lime); padding:5px 14px; border-radius:999px; font-size:12px; font-weight:600; letter-spacing:.04em; margin-bottom:28px; }
        .hero h1 { font-size:clamp(40px,6vw,72px); font-weight:700; line-height:1.08; letter-spacing:-.02em; max-width:800px; margin-bottom:22px; }
        .hero h1 em { color:var(--purple-l); font-style:normal; }
        .hero-sub { font-size:18px; color:var(--muted); max-width:520px; line-height:1.6; margin-bottom:52px; }
        .room-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:36px 40px; width:100%; max-width:480px; position:relative; z-index:1; }
        .room-card-label { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:16px; }
        .room-input-wrap { display:flex; gap:10px; margin-bottom:20px; }
        .room-input { flex:1; background:var(--bg); border:1px solid var(--border); border-radius:10px; color:var(--white); font-family:var(--font-h); font-size:22px; font-weight:600; letter-spacing:.15em; text-align:center; padding:14px 16px; outline:none; transition:border-color .2s; }
        .room-input::placeholder { color:var(--border); letter-spacing:.1em; }
        .room-input:focus { border-color:var(--purple); }
        .btn-join { background:var(--lime); border:none; color:#0F1629; padding:14px 24px; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; white-space:nowrap; transition:background .2s; }
        .btn-join:hover { background:#bef264; }
        .divider { display:flex; align-items:center; gap:12px; color:var(--muted); font-size:13px; margin-bottom:20px; }
        .divider::before,.divider::after { content:''; flex:1; height:1px; background:var(--border); }
        .auth-links { display:flex; gap:10px; }
        .auth-links button { flex:1; }
        .stats { display:flex; justify-content:center; gap:64px; padding:60px; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
        .stat-item { text-align:center; }
        .stat-num { font-size:40px; font-weight:700; }
        .stat-num span { color:var(--purple-l); }
        .stat-desc { color:var(--muted); font-size:14px; margin-top:4px; }
        .features { padding:80px 60px; max-width:1200px; margin:0 auto; }
        .features-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .feat-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:28px; transition:border-color .2s; }
        .feat-card:hover { border-color:var(--purple); }
        .feat-icon { width:44px; height:44px; background:rgba(124,58,237,.15); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:18px; }
        .feat-card h3 { font-size:17px; font-weight:600; margin-bottom:8px; }
        .feat-card p { color:var(--muted); font-size:14px; line-height:1.6; }
        footer { border-top:1px solid var(--border); padding:32px 60px; display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:13px; }
        @media (max-width:768px) {
          .home-nav, .hero, .features, footer { padding-left:20px; padding-right:20px; }
          .home-nav .nav-links { display:none; }
          .features-grid { grid-template-columns:1fr; }
          .stats { flex-wrap:wrap; gap:32px; }
        }
      </style>

      <nav class="home-nav">
        <div class="logo" onclick="Router.navigate('/')">Quiz<span class="dot">App</span></div>
        <div class="nav-links">
          <a href="#features">Возможности</a>
          <a href="#">Категории</a>
          <a href="#">О проекте</a>
        </div>
        <div class="nav-actions">${navActions}</div>
      </nav>

      <section class="hero">
        <div class="hero-badge"><span class="pulse-dot"></span> Квизы в реальном времени</div>
        <h1>${heroTitle}</h1>
        <p class="hero-sub">${heroSub}</p>
        ${heroCard}
      </section>

      <footer>
        <div class="logo" style="font-size:16px">Quiz<span class="dot">App</span></div>
        <span>© 2025 QuizApp</span>
      </footer>
    `;

    this.bindEvents(user);
  },

  bindEvents(user) {
    document.getElementById('navLoginBtn')?.addEventListener('click', () => Router.navigate('/auth'));
    document.getElementById('navRegisterBtn')?.addEventListener('click', () => Router.navigate('/auth?tab=register'));
    document.getElementById('loginLinkBtn')?.addEventListener('click', () => Router.navigate('/auth'));
    document.getElementById('registerLinkBtn')?.addEventListener('click', () => Router.navigate('/auth?tab=register'));
    document.getElementById('quickCreateBtn')?.addEventListener('click', () => Router.navigate('/quiz/new'));
    document.getElementById('quickDashBtn')?.addEventListener('click', () => {
      Router.navigate(user.role === 'organizer' ? '/dashboard' : '/my-quizzes');
    });

    const userMenuBtn = document.getElementById('userMenuBtn');
    if (userMenuBtn) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleUserMenu(userMenuBtn);
      });
    }

    const roomInput = document.getElementById('roomCode');
    const joinBtn = document.getElementById('joinBtn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => this.handleJoin());
      roomInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.handleJoin(); });
    }
  },

  toggleUserMenu(anchor) {
    let menu = document.getElementById('userDropdown');
    if (menu) { menu.remove(); return; }
    menu = document.createElement('div');
    menu.id = 'userDropdown';
    menu.style.cssText = `position:absolute; top:48px; right:0; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:6px; min-width:180px; box-shadow:0 12px 32px rgba(0,0,0,.4); z-index:200;`;
    menu.innerHTML = `
      <div class="nav-item" id="ddDash" style="border-radius:7px;">📊 Мой кабинет</div>
      <div class="nav-item" id="ddLogout" style="border-radius:7px; color:var(--red);">🚪 Выйти</div>
    `;
    anchor.style.position = 'relative';
    anchor.appendChild(menu);
    document.getElementById('ddDash').onclick = () => Router.navigate(AuthStore.user.role === 'organizer' ? '/dashboard' : '/my-quizzes');
    document.getElementById('ddLogout').onclick = () => AuthStore.logout();
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 0);
  },

  async handleJoin() {
    const input = document.getElementById('roomCode');
    const code = input.value.trim();
    if (code.length < 4) {
      input.classList.add('input-error');
      setTimeout(() => input.classList.remove('input-error'), 1500);
      return;
    }
    if (!AuthStore.isLoggedIn()) {
      Router.navigate(`/auth?tab=register&role=participant&redirect=join&code=${code}`);
      return;
    }
    if (AuthStore.user.role !== 'participant') {
      toast('Войдите как участник, чтобы присоединиться к квизу', 'error');
      return;
    }
    try {
      const data = await API.joinRoom(code);
      Router.navigate(`/lobby/${data.session_id}`);
    } catch (e) {
      toast(e.message, 'error');
    }
  }
};
