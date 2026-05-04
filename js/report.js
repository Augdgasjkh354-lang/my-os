(() => {
  function getTodayDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  async function fetchSources(settings) {
    const location = settings.location || {};
    const tasks = {
      weather: window.app.api.proxyFetch('openweather', `data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${encodeURIComponent(settings.openWeatherKey || '')}&units=metric&lang=zh_cn`),
      exchange: window.app.api.proxyFetch('exchangerate', `v6/${encodeURIComponent(settings.exchangeRateKey || '')}/latest/USD`),
      gold: window.app.api.proxyFetch('goldapi', 'api/XAU/USD', { headers: { 'X-Goldapi-Token': settings.goldApiKey || '' } }),
      news: window.app.api.proxyFetch('newsapi', `v2/top-headlines?country=${encodeURIComponent(settings.newsCountry || 'cn')}&category=${encodeURIComponent(settings.newsCategory || 'general')}&apiKey=${encodeURIComponent(settings.newsApiKey || '')}&pageSize=10`)
    };

    const entries = Object.entries(tasks);
    const settled = await Promise.allSettled(entries.map(([, p]) => p));
    const data = { weather: null, exchange: null, gold: null, news: null };
    const errors = {};

    await Promise.all(settled.map(async (result, idx) => {
      const sourceName = entries[idx][0];
      if (result.status === 'fulfilled') {
        const resp = result.value;
        if (!resp.ok) {
          errors[sourceName] = `请求失败：${resp.status}`;
          return;
        }
        try {
          data[sourceName] = await resp.json();
        } catch (error) {
          errors[sourceName] = `解析失败：${error.message}`;
        }
      } else {
        errors[sourceName] = result.reason.message || '请求异常';
      }
    }));

    return { data, errors };
  }

  async function streamSummary(data, model) {
    const payload = {
      model,
      stream: true,
      messages: [
        {
          role: 'system',
          content: `你是用户的晨报分析师。基于下面提供的数据生成今日晨报。\n\n要求：\n- 全部使用简体中文\n- 输出markdown格式\n- 结构：## 摘要 / ## 新闻速递 / ## 经济动态 / ## 天气 / ## 今日值得关注\n- 简洁专业，避免空话和套话\n- 部分数据可能标记为”获取失败”，请跳过该部分或简短说明，不要编造\n\n数据：\n${JSON.stringify(data)}`
        }
      ]
    };
    return window.app.api.chatCompletions(model, payload);
  }

  function renderCards(container, data, errors) {
    const weather = data.weather;
    const exchange = data.exchange;
    const gold = data.gold;
    const news = data.news;
    container.innerHTML = `
      <div class="report-grid">
        <section class="section"><h2>天气</h2>${weather ? `<div class="temp">${Math.round(weather.main?.temp ?? 0)}°C</div><div>${weather.name || '-'}</div><div class="helper">湿度 ${weather.main?.humidity ?? '-'}%</div><div class="helper">${weather.weather?.[0]?.description || '-'}</div>` : `<div class="error-text">${errors.weather || '获取失败'}</div>`}</section>
        <section class="section"><h2>汇率</h2>${exchange?.conversion_rates ? `<div>USD/CNY: ${exchange.conversion_rates.CNY ?? '-'}</div><div>USD/JPY: ${exchange.conversion_rates.JPY ?? '-'}</div><div>USD/EUR: ${exchange.conversion_rates.EUR ?? '-'}</div>` : `<div class="error-text">${errors.exchange || '获取失败'}</div>`}</section>
        <section class="section"><h2>金价</h2>${gold ? `<div>XAU/USD: ${gold.price ?? '-'}</div><div class="helper">当日涨跌: ${gold.ch ?? '-'}</div>` : `<div class="error-text">${errors.gold || '获取失败'}</div>`}</section>
        <section class="section"><h2>新闻</h2>${news?.articles?.length ? `<ul class="news-list">${news.articles.slice(0, 5).map(item => `<li><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a></li>`).join('')}</ul>` : `<div class="error-text">${errors.news || '获取失败'}</div>`}</section>
      </div>
    `;
  }

  async function generateAndSave(date, settings, root) {
    const cards = root.querySelector('#report-cards');
    const summaryEl = root.querySelector('#report-summary-content');
    summaryEl.innerHTML = '<p class="helper">正在采集数据…</p>';
    const { data, errors } = await fetchSources(settings);
    renderCards(cards, data, errors);
    summaryEl.innerHTML = '<p class="helper">AI分析中…</p>';
    let summaryText = '';
    const model = settings.reportModel || 'deepseek-v4-flash';
    const response = await streamSummary(data, model);

    await new Promise((resolve, reject) => {
      window.app.stream.consumeSSE(
        response,
        chunk => {
          const delta = chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.text || '';
          if (!delta) return;
          summaryText += delta;
          summaryEl.innerHTML = window.marked.parse(summaryText);
        },
        resolve,
        reject
      );
    });

    const report = { date, generated_at: new Date().toISOString(), data, errors, ai_summary: summaryText, model_used: model };
    await window.app.db.putReport(report);
    return report;
  }

  async function renderHistory(root) {
    const history = await window.app.db.getRecentReports(7);
    const list = root.querySelector('#report-history-list');
    list.innerHTML = history.map(item => `<button type="button" class="list-item report-history-item" data-date="${item.date}">${item.date}</button>`).join('');
    list.querySelectorAll('.report-history-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const report = await window.app.db.getReport(btn.getAttribute('data-date'));
          if (!report) return;
          renderReportData(root, report);
        } catch (error) {
          window.app.ui.toast(`读取历史失败：${error.message}`, 'error');
        }
      });
    });
  }

  function renderReportData(root, report) {
    root.querySelector('#report-date').textContent = report.date;
    root.querySelector('#report-model').textContent = `模型：${report.model_used || '-'}`;
    renderCards(root.querySelector('#report-cards'), report.data || {}, report.errors || {});
    root.querySelector('#report-summary-content').innerHTML = window.marked.parse(report.ai_summary || '');
  }

  async function renderReportPage(container) {
    container.innerHTML = `
      <section class="section">
        <div class="report-header"><h1 id="report-date"></h1><div><button id="btn-regenerate" class="primary" type="button">重新生成</button><div id="report-model" class="helper"></div></div></div>
      </section>
      <div id="report-cards"></div>
      <section class="section"><h2>今日综合</h2><div id="report-summary-content" class="markdown"></div></section>
      <details class="section"><summary>历史晨报</summary><div id="report-history-list" class="list"></div></details>
    `;

    const settings = await window.app.db.getAllSettings();
    const today = getTodayDate();
    let report = await window.app.db.getReport(today);
    if (!report) {
      report = await generateAndSave(today, settings, container);
    }
    renderReportData(container, report);
    await renderHistory(container);

    container.querySelector('#btn-regenerate').addEventListener('click', async () => {
      try {
        await window.app.db.deleteReport(today);
        const latestSettings = await window.app.db.getAllSettings();
        const newReport = await generateAndSave(today, latestSettings, container);
        renderReportData(container, newReport);
        await renderHistory(container);
        window.app.ui.toast('已重新生成', 'success');
      } catch (error) {
        window.app.ui.toast(`重新生成失败：${error.message}`, 'error');
      }
    });
  }

  window.app = window.app || {};
  window.app.report = { renderReportPage };
})();
