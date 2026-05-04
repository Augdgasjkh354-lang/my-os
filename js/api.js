(() => {
  async function proxyFetch(provider, path, options = {}) {
    try {
      const workerUrl = await window.app.db.getSetting('workerUrl');
      const accessToken = await window.app.db.getSetting('accessToken');
      if (!workerUrl) throw new Error('请先在设置中填写 Worker URL');
      if (!accessToken) throw new Error('请先在设置中填写 Access Token');

      const cleanWorkerUrl = String(workerUrl).replace(/\/$/, '');
      const cleanPath = String(path).replace(/^\//, '');
      const url = `${cleanWorkerUrl}/${provider}/${cleanPath}`;

      const headers = new Headers(options.headers || {});
      headers.set('X-Access-Token', accessToken);

      return fetch(url, { ...options, headers });
    } catch (error) {
      throw error;
    }
  }

  window.app = window.app || {};
  window.app.api = { proxyFetch };
})();
