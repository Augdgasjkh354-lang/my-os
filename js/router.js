(() => {
  const ROUTES = {
    report: '#/report',
    memory: '#/memory',
    chat: '#/chat',
    tasks: '#/tasks',
    settings: '#/settings'
  };

  function getCurrentRoute() {
    const hash = window.location.hash || '';
    if (hash === '' || hash === '#/' || hash === '#') return ROUTES.report;
    if (Object.values(ROUTES).includes(hash)) return hash;
    return ROUTES.report;
  }

  function navigate(hash) {
    if (window.location.hash === hash) {
      renderByHash(hash);
      return;
    }
    window.location.hash = hash;
  }

  async function renderByHash(hash) {
    const main = document.getElementById('app-main');
    if (!main) return;
    const route = hash || getCurrentRoute();
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-route') === route);
    });

    try {
      if (route === ROUTES.report) {
        await window.app.report.renderReportPage(main);
      } else if (route === ROUTES.chat) {
        await window.app.chat.renderChatPage(main);
      } else if (route === ROUTES.tasks) {
        await window.app.tasks.renderTasksPage(main);
      } else if (route === ROUTES.memory) {
        await window.app.memory.renderMemoryPage(main);
      } else {
        await window.app.settings.renderSettingsPage(main);
      }
    } catch (error) {
      window.app.ui.toast(`页面渲染失败：${error.message}`, 'error');
    }
  }

  function mountLayout() {
    const root = document.getElementById('app');
    root.innerHTML = `
      <header class="top-nav">
        <div class="logo">my-os</div>
        <nav class="nav-tabs">
          <button class="nav-tab" data-route="#/report" type="button">晨报</button>
          <button class="nav-tab" data-route="#/chat" type="button">对话</button>
          <button class="nav-tab" data-route="#/tasks" type="button">任务</button>
          <button class="nav-tab" data-route="#/memory" type="button">记忆</button>
          <button class="nav-tab" data-route="#/settings" type="button">设置</button>
        </nav>
      </header>
      <main id="app-main" class="app-main"></main>
    `;

    root.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.getAttribute('data-route')));
    });
  }

  function initRouter() {
    mountLayout();
    window.addEventListener('hashchange', () => renderByHash(getCurrentRoute()));
    const route = getCurrentRoute();
    if (window.location.hash !== route) {
      window.location.replace(route);
      return;
    }
    renderByHash(route);
  }

  window.app = window.app || {};
  window.app.router = { initRouter, navigate, getCurrentRoute, ROUTES };
})();
