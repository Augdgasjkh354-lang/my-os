(() => {
  const SENSITIVE_KEYS = new Set(['accessToken', 'openWeatherKey', 'goldApiKey', 'newsApiKey', 'exchangeRateKey', 'deepSeekKey', 'glmKey', 'miniMaxKey']);

  function toggleInputType(input) { input.type = input.type === 'password' ? 'text' : 'password'; }
  async function saveField(key, value) { try { await window.app.db.setSetting(key, value); window.app.ui.toast('保存成功', 'success'); } catch (error) { window.app.ui.toast(`保存失败：${error.message}`, 'error'); } }

  async function renderSettingsPage(container) {
    container.innerHTML = '<h1>设置</h1>';
    const sections = [
      { title: '代理配置', fields: [['Worker URL', 'workerUrl', '<填写你的Worker URL>'], ['Access Token', 'accessToken', '<填写你的Access Token>']] },
      { title: '数据源API', fields: [['OpenWeatherMap Key', 'openWeatherKey', '<填写你的OpenWeatherMap Key>'], ['GoldAPI Key', 'goldApiKey', '<填写你的GoldAPI Key>'], ['NewsAPI Key', 'newsApiKey', '<填写你的NewsAPI Key>'], ['ExchangeRate Key', 'exchangeRateKey', '<填写你的ExchangeRate Key>']] },
      { title: 'AI模型', fields: [['DeepSeek Key', 'deepSeekKey', '<填写你的DeepSeek Key>'], ['GLM Key', 'glmKey', '<填写你的GLM Key>'], ['MiniMax Key', 'miniMaxKey', '<填写你的MiniMax Key>']] }
    ];

    const createField = (label, key, placeholder) => {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const isSensitive = SENSITIVE_KEYS.has(key);
      wrap.innerHTML = `<label>${label}</label><div class="input-wrap"><input id="field-${key}" type="${isSensitive ? 'password' : 'text'}" placeholder="${placeholder}" />${isSensitive ? '<button type="button" data-eye="1">👁</button>' : ''}<button type="button" data-save="1">保存</button></div>`;
      const input = wrap.querySelector('input');
      input.addEventListener('blur', () => saveField(key, input.value.trim()));
      wrap.querySelector('[data-save="1"]').addEventListener('click', () => saveField(key, input.value.trim()));
      const eye = wrap.querySelector('[data-eye="1"]');
      if (eye) eye.addEventListener('click', () => toggleInputType(input));
      return wrap;
    };

    sections.forEach(sec => { const card = document.createElement('section'); card.className = 'section'; card.innerHTML = `<h2>${sec.title}</h2>`; sec.fields.forEach(f => card.appendChild(createField(f[0], f[1], f[2]))); container.appendChild(card); });

    const reportSec = document.createElement('section');
    reportSec.className = 'section';
    reportSec.innerHTML = `<h2>晨报设置</h2>
      <div class="field"><label>晨报使用模型</label><select id="field-reportModel"><option value="deepseek-v4-flash">deepseek-v4-flash</option><option value="deepseek-v4-pro">deepseek-v4-pro</option><option value="glm-5.1">glm-5.1</option><option value="minimax-m2.7">minimax-m2.7</option></select></div>
      <div class="field"><label>新闻分类</label><select id="field-newsCategory"><option value="general">general</option><option value="business">business</option><option value="technology">technology</option><option value="science">science</option><option value="health">health</option><option value="sports">sports</option><option value="entertainment">entertainment</option></select></div>
      <div class="field"><label>新闻国家</label><select id="field-newsCountry"><option value="cn">cn</option><option value="us">us</option><option value="gb">gb</option><option value="jp">jp</option></select></div>`;
    container.appendChild(reportSec);

    const settings = await window.app.db.getAllSettings();
    Object.entries(settings).forEach(([key, val]) => { const input = container.querySelector(`#field-${key}`); if (input) input.value = String(val ?? ''); });
    if (!settings.reportModel) settings.reportModel = 'deepseek-v4-flash';
    if (!settings.newsCategory) settings.newsCategory = 'general';
    if (!settings.newsCountry) settings.newsCountry = 'cn';
    container.querySelector('#field-reportModel').value = settings.reportModel;
    container.querySelector('#field-newsCategory').value = settings.newsCategory;
    container.querySelector('#field-newsCountry').value = settings.newsCountry;
    container.querySelector('#field-reportModel').addEventListener('change', e => saveField('reportModel', e.target.value));
    container.querySelector('#field-newsCategory').addEventListener('change', e => saveField('newsCategory', e.target.value));
    container.querySelector('#field-newsCountry').addEventListener('change', e => saveField('newsCountry', e.target.value));
  }

  window.app = window.app || {};
  window.app.settings = { renderSettingsPage };
})();
