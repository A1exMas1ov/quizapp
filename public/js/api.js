const API = {
  base: '/api',

  async _req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
    return data;
  },

  get(path) { return this._req('GET', path); },
  post(path, body) { return this._req('POST', path, body); },
  put(path, body) { return this._req('PUT', path, body); },
  del(path) { return this._req('DELETE', path); },

  async register(data) { const r = await this.post('/auth/register', data); if (r.token) AuthStore.setWsToken(r.token); return r; },
  async login(data) { const r = await this.post('/auth/login', data); if (r.token) AuthStore.setWsToken(r.token); return r; },
  logout() { return this.post('/auth/logout'); },
  me() { return this.get('/auth/me'); },

  getQuizzes() { return this.get('/quizzes'); },
  createQuiz(data) { return this.post('/quizzes', data); },
  getQuiz(id) { return this.get(`/quizzes/${id}`); },
  updateQuiz(id, data) { return this.put(`/quizzes/${id}`, data); },
  deleteQuiz(id) { return this.del(`/quizzes/${id}`); },
  launchQuiz(id) { return this.post(`/quizzes/${id}/launch`); },
  closeQuiz(id) { return this.post(`/quizzes/${id}/close`); },

  addQuestion(quizId, data) { return this.post(`/quizzes/${quizId}/questions`, data); },
  updateQuestion(id, data) { return this.put(`/questions/${id}`, data); },
  deleteQuestion(id) { return this.del(`/questions/${id}`); },

  joinRoom(code) { return this.post('/join', { code }); },
  getSessionResults(id) { return this.get(`/sessions/${id}/results`); },

  getMyHistory() { return this.get('/my/history'); },
  getMyQuizHistory() { return this.get('/my/quiz-history'); }
};

function toast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
