(() => {
  const SENSITIVE_KEYS = new Set([
    'accessToken', 'openWeatherKey', 'goldApiKey', 'newsApiKey', 'exchangeRateKey', 'deepSeekKey', 'glmKey', 'miniMaxKey'
  ]);

  function toggleInputType(input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  async function saveField(key, value) {
    try {
      await window.app.db.setSetting(key, value);
      window.app.ui.toast('保存成功', 'success');
    } catch (error) {
      window.app.ui.toast(`保存失败：${error.message}`, 'error');
    }
  }

  async function searchCity(keyword) {
    const owmKey = await window.app.db.getSetting('openWeatherKey');
    if (!owmKey) throw new Error('请先填写 OpenWeatherMap Key');
    const path = `geo/1.0/direct?q=${encodeURIComponent(keyword)}&limit=5&appid=${encodeURIComponent(owmKey)}`;
    const resp = await window.app.api.proxyFetch('openweather', path, { method: 'GET' });
    if (!resp.ok) throw new Error(`城市搜索失败：${resp.status}`);
    return resp.json();
  }

  function renderLocationResult(items) {
    const list = document.getElementById('city-results');
    list.innerHTML = '';
    items.forEach(item => {
      const zhName = item.local_names && item.local_names.zh ? item.local_names.zh : item.name;
      const state = item.state ? `, ${item.state}` : '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-item';
      btn.textContent = `${zhName}${state}, ${item.country}`;
      btn.addEventListener('click', async () => {
        const payload = { name: zhName, lat: item.lat, lon: item.lon, country: item.country };
        await saveField('location', payload);
        document.getElementById('saved-location').textContent = `已保存：${payload.name} (${payload.lat}, ${payload.lon}) ${payload.country}`;
        list.innerHTML = '';
      });
      list.appendChild(btn);
    });
  }

  function createField(label, key, placeholder) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const isSensitive = SENSITIVE_KEYS.has(key);
    wrap.innerHTML = `
      <label>${label}</label>
      <div class="input-wrap">
        <input id="field-${key}" type="${isSensitive ? 'password' : 'text'}" placeholder="${placeholder}" />
        ${isSensitive ? '<button type="button" data-eye="1">👁</button>' : '<button type="button" data-save="1">保存</button>'}
        ${isSensitive ? '<button type="button" data-save="1">保存</button>' : ''}
      </div>`;
    const input = wrap.querySelector('input');
    input.addEventListener('blur', () => saveField(key, input.value.trim()));
    wrap.querySelector('[data-save="1"]').addEventListener('click', () => saveField(key, input.value.trim()));
    const eye = wrap.querySelector('[data-eye="1"]');
    if (eye) eye.addEventListener('click', () => toggleInputType(input));
    return wrap;
  }

  async function renderSettingsPage() {
    const app = document.getElementById('app');
    app.innerHTML = '<h1>my-os 设置</h1>';

    const sections = [
      { title: '代理配置', fields: [['Worker URL', 'workerUrl', '<填写你的Worker URL>'], ['Access Token', 'accessToken', '<填写你的Access Token>']] },
      { title: '数据源API', fields: [['OpenWeatherMap Key', 'openWeatherKey', '<填写你的OpenWeatherMap Key>'], ['GoldAPI Key', 'goldApiKey', '<填写你的GoldAPI Key>'], ['NewsAPI Key', 'newsApiKey', '<填写你的NewsAPI Key>'], ['ExchangeRate Key', 'exchangeRateKey', '<填写你的ExchangeRate Key>']] },
      { title: 'AI模型', fields: [['DeepSeek Key', 'deepSeekKey', '<填写你的DeepSeek Key>'], ['GLM Key', 'glmKey', '<填写你的GLM Key>'], ['MiniMax Key', 'miniMaxKey', '<填写你的MiniMax Key>']] }
    ];

    sections.forEach(sec => {
      const card = document.createElement('section');
      card.className = 'section';
      card.innerHTML = `<h2>${sec.title}</h2>`;
      sec.fields.forEach(f => card.appendChild(createField(f[0], f[1], f[2])));
      app.appendChild(card);
    });

    const locationSec = document.createElement('section');
    locationSec.className = 'section';
    locationSec.innerHTML = `
      <h2>位置</h2>
      <div class="field">
        <label>城市搜索</label>
        <div class="input-wrap">
          <input id="city-input" type="text" placeholder="输入城市名称，例如：北京" />
          <button id="city-search-btn" type="button" class="primary">搜索</button>
        </div>
        <div id="saved-location" class="helper">未保存位置</div>
        <div id="city-results" class="list"></div>
      </div>`;
    app.appendChild(locationSec);

    const backupSec = document.createElement('section');
    backupSec.className = 'section';
    backupSec.innerHTML = `
      <h2>数据备份</h2>
      <div class="input-wrap">
        <button id="btn-export" class="primary" type="button">导出全部数据</button>
        <button id="btn-import" type="button">从备份恢复</button>
        <input id="backup-file" type="file" accept="application/json" class="hidden" />
      </div>
      <div class="helper">恢复会覆盖本地已存在数据，请谨慎操作。</div>`;
    app.appendChild(backupSec);

    const settings = await window.app.db.getAllSettings();
    Object.entries(settings).forEach(([key, val]) => {
      const input = document.getElementById(`field-${key}`);
      if (input) input.value = String(val ?? '');
    });
    if (settings.location) {
      document.getElementById('saved-location').textContent = `已保存：${settings.location.name} (${settings.location.lat}, ${settings.location.lon}) ${settings.location.country}`;
    }

    document.getElementById('city-search-btn').addEventListener('click', async () => {
      const keyword = document.getElementById('city-input').value.trim();
      if (!keyword) return window.app.ui.toast('请输入城市名', 'error');
      window.app.ui.showLoading();
      try {
        const items = await searchCity(keyword);
        renderLocationResult(items);
        if (!items.length) window.app.ui.toast('未找到匹配城市', 'error');
      } catch (error) {
        window.app.ui.toast(error.message, 'error');
      } finally {
        window.app.ui.hideLoading();
      }
    });

    document.getElementById('btn-export').addEventListener('click', async () => {
      try {
        const data = await window.app.db.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = URL.createObjectURL(blob);
        a.download = `my-os-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        window.app.ui.toast('导出成功', 'success');
      } catch (error) {
        window.app.ui.toast(`导出失败：${error.message}`, 'error');
      }
    });

    const fileInput = document.getElementById('backup-file');
    document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const ok = await window.app.ui.showModal({ title: '确认恢复', content: '恢复会覆盖当前全部本地数据，是否继续？', confirmText: '继续恢复' });
      if (!ok) return;
      try {
        const text = await file.text();
        await window.app.db.importAll(JSON.parse(text));
        window.app.ui.toast('恢复成功，请刷新页面', 'success');
      } catch (error) {
        window.app.ui.toast(`恢复失败：${error.message}`, 'error');
      } finally {
        fileInput.value = '';
      }
    });
  }

  window.app = window.app || {};
  window.app.settings = { renderSettingsPage };
})();
