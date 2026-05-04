(() => {
  async function proxyFetch(provider, path, options = {}) {
    const workerUrl = await window.app.db.getSetting('workerUrl'); const accessToken = await window.app.db.getSetting('accessToken');
    if (!workerUrl) throw new Error('请先在设置中填写 Worker URL'); if (!accessToken) throw new Error('请先在设置中填写 Access Token');
    const url = `${String(workerUrl).replace(/\/$/, '')}/${provider}/${String(path).replace(/^\//, '')}`;
    const headers = new Headers(options.headers || {}); headers.set('X-Access-Token', accessToken);
    return fetch(url, { ...options, headers });
  }
  async function callAI(agent, messages, opts = {}) {
    const thinking = opts.thinking ?? agent.thinking_default;
    const map = { deepseek: { key: 'deepSeekKey', path: 'v1/chat/completions' }, glm: { key: 'glmKey', path: 'api/paas/v4/chat/completions' }, qwen: { key: 'qwenKey', path: 'compatible-mode/v1/chat/completions' } };
    const cfg = map[agent.provider]; if (!cfg) throw new Error('不支持的Provider');
    const key = await window.app.db.getSetting(cfg.key); if (!key) throw new Error(`请先填写 ${cfg.key}`);
    let model = agent.model; const body = { model, messages, stream: true, temperature: 0.7 };
    if (agent.provider === 'deepseek') body.model = thinking ? 'deepseek-v4-pro' : 'deepseek-v4-flash';
    if (agent.provider === 'glm') body.thinking = { type: thinking ? 'enabled' : 'disabled' };
    if (agent.provider === 'qwen') {
      body.model = thinking ? 'qwen3-max' : 'qwen3.5-flash';
      body.enable_thinking = !!thinking;
    }
    return proxyFetch(agent.provider, cfg.path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  }
  window.app = window.app || {}; window.app.api = { proxyFetch, callAI };
})();
