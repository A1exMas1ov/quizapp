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
      heroTitle = `Проводи квизы и побеждай`;
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
<nav class="home-nav">
        <div class="logo" onclick="Router.navigate('/')">Quiz<span class="dot">App</span></div>
        <div class="nav-actions">${navActions}</div>
      </nav>

      <section class="hero">
        <h1>${heroTitle}</h1>
        <p class="hero-sub">${heroSub}</p>
        ${heroCard}
      </section>

      <footer class="home-footer">
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
