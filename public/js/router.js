const Router = {
  routes: {},
  currentCleanup: null,

  on(path, handler) {
    this.routes[path] = handler;
    return this;
  },

  navigate(path) {
    location.hash = path;
  },

  async resolve() {
    if (typeof this.currentCleanup === 'function') {
      try { this.currentCleanup(); } catch(e) {}
      this.currentCleanup = null;
    }

    const hash = location.hash.slice(1) || '/';
    const [pathPart, queryPart] = hash.split('?');
    const params = new URLSearchParams(queryPart || '');

    let handler = this.routes[pathPart];
    let routeParams = {};

    if (!handler) {
      for (const route in this.routes) {
        const routeSegs = route.split('/');
        const pathSegs = pathPart.split('/');
        if (routeSegs.length !== pathSegs.length) continue;
        let match = true;
        const p = {};
        for (let i = 0; i < routeSegs.length; i++) {
          if (routeSegs[i].startsWith(':')) {
            p[routeSegs[i].slice(1)] = pathSegs[i];
          } else if (routeSegs[i] !== pathSegs[i]) {
            match = false; break;
          }
        }
        if (match) { handler = this.routes[route]; routeParams = p; break; }
      }
    }

    if (!handler) handler = this.routes['/'];
    const cleanup = await handler({ params: routeParams, query: params });
    if (typeof cleanup === 'function') this.currentCleanup = cleanup;
  },

  start() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }
};
