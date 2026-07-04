const AuthStore = {
  user: null,
  loaded: false,

  async load() {
    try {
      const { user } = await API.me();
      this.user = user;
    } catch {
      this.user = null;
    }
    this.loaded = true;
    return this.user;
  },

  isLoggedIn() { return !!this.user; },
  isOrganizer() { return this.user?.role === 'organizer'; },
  isParticipant() { return this.user?.role === 'participant'; },

  getWsToken() { return localStorage.getItem('qf_token') || ''; },
  setWsToken(token) { if (token) localStorage.setItem('qf_token', token); },
  clearWsToken() { localStorage.removeItem('qf_token'); },

  async logout() {
    try { await API.logout(); } catch(e) {}
    this.user = null;
    this.clearWsToken();
    Router.navigate('/');
    location.reload();
  },

  initials(name) {
    if (!name) return '?';
    return name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase();
  }
};
