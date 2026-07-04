const AuthPage = {
  render(query) {
    const app = document.getElementById('app');
    const initialTab = query.get('tab') === 'register' ? 'register' : 'login';
    const initialRole = query.get('role') === 'participant' ? 'participant' : 'organizer';
    const redirect = query.get('redirect');
    const joinCode = query.get('code');

    app.innerHTML = `
<a class="back-link" id="backLink">← Главная</a>
      <div class="auth-wrap">
        <div class="left-panel">
          <div class="logo">Quiz<span class="dot">App</span></div>
          <div class="left-content">
            <h2>Проводи квизы и побеждай</h2>
            <p>Присоединяйся к тысячам организаторам и участникам</p>
            <div class="mini-stats">
              <div class="mini-stat"><div class="num">12k</div><div class="lbl">Квизов</div></div>
              <div class="mini-stat"><div class="num">84k</div><div class="lbl">Участников</div></div>
            </div>
          </div>
        </div>

        <div class="right-panel">
          <div class="auth-card">
            <div class="tabs">
              <div class="tab ${initialTab==='login'?'active':''}" data-tab="login">Войти</div>
              <div class="tab ${initialTab==='register'?'active':''}" data-tab="register">Регистрация</div>
            </div>

            <div class="form-section ${initialTab==='login'?'active':''}" id="loginForm">
              <h3>С возвращением 👋</h3>
              <p class="form-sub">Введите данные вашего аккаунта</p>
              <div class="field"><label>Email</label><input class="input" type="email" id="loginEmail" placeholder="you@example.com"></div>
              <div class="field"><label>Пароль</label><input class="input" type="password" id="loginPassword" placeholder="••••••••"></div>
              <button class="btn btn-primary btn-full" id="loginSubmit">Войти</button>
              <div class="switch-link">Нет аккаунта? <a data-tab="register">Зарегистрироваться</a></div>
            </div>

            <div class="form-section ${initialTab==='register'?'active':''}" id="registerForm">
              <h3>Создать аккаунт</h3>
              <p class="form-sub">Выберите роль и заполните данные</p>
              <div class="role-pick">
                <div class="role-btn ${initialRole==='organizer'?'selected':''}" data-role="organizer">
                  <div class="role-icon">🎓</div><div class="role-name">Организатор</div><div class="role-desc">Создаю квизы</div>
                </div>
                <div class="role-btn ${initialRole==='participant'?'selected':''}" data-role="participant">
                  <div class="role-icon">🎮</div><div class="role-name">Участник</div><div class="role-desc">Прохожу квизы</div>
                </div>
              </div>
              <div class="field"><label>Имя</label><input class="input" type="text" id="regName" placeholder="Ваше имя"></div>
              <div class="field"><label>Email</label><input class="input" type="email" id="regEmail" placeholder="you@example.com"></div>
              <div class="field"><label>Пароль</label><input class="input" type="password" id="regPassword" placeholder="Минимум 6 символов"></div>
              <button class="btn btn-primary btn-full" id="registerSubmit">Создать аккаунт</button>
              <div class="switch-link">Уже есть аккаунт? <a data-tab="login">Войти</a></div>
            </div>
          </div>
        </div>
      </div>
    `;

    let selectedRole = initialRole;

    document.getElementById('backLink').addEventListener('click', () => Router.navigate('/'));

    document.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.getElementById('loginForm').classList.toggle('active', tab === 'login');
        document.getElementById('registerForm').classList.toggle('active', tab === 'register');
      });
    });

    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedRole = btn.dataset.role;
      });
    });

    const afterAuth = async () => {
      await AuthStore.load();
      if (redirect === 'join' && joinCode) {
        try {
          const data = await API.joinRoom(joinCode);
          Router.navigate(`/lobby/${data.session_id}`);
          return;
        } catch(e) { toast(e.message, 'error'); }
      }
      Router.navigate(AuthStore.user.role === 'organizer' ? '/dashboard' : '/');
    };

    document.getElementById('loginSubmit').addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!email || !password) return toast('Заполните все поля', 'error');
      try {
        await API.login({ email, password });
        toast('Добро пожаловать!');
        afterAuth();
      } catch(e) { toast(e.message, 'error'); }
    });

    document.getElementById('registerSubmit').addEventListener('click', async () => {
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      if (!name || !email || !password) return toast('Заполните все поля', 'error');
      if (password.length < 6) return toast('Пароль слишком короткий', 'error');
      try {
        await API.register({ name, email, password, role: selectedRole });
        toast('Аккаунт создан!');
        afterAuth();
      } catch(e) { toast(e.message, 'error'); }
    });
  }
};
