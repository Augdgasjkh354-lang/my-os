(() => {
  async function proxyFetch(provider, path, options = {}) {
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
  }

  function resolveModelProvider(model) {
    if (model.startsWith('deepseek')) return { provider: 'deepseek', keyName: 'deepSeekKey', path: 'v1/chat/completions' };
    if (model.startsWith('glm')) return { provider: 'glm', keyName: 'glmKey', path: 'api/paas/v4/chat/completions' };
    return { provider: 'minimax', keyName: 'miniMaxKey', path: 'v1/text/chatcompletion_v2' };
  }

  async function chatCompletions(model, body) {
    const { provider, keyName, path } = resolveModelProvider(model);
    const key = await window.app.db.getSetting(keyName);
    if (!key) throw new Error(`请先在设置中填写 ${keyName}`);
    return proxyFetch(provider, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body)
    });
  }

  window.app = window.app || {};
  window.app.api = { proxyFetch, chatCompletions };
})();
