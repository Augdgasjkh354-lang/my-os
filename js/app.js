(() => {
  async function init() {
    try {
      await window.app.db.openDb();
      window.app.router.initRouter();
    } catch (error) {
      window.app.ui.toast(`初始化失败：${error.message}`, 'error');
    }
  }

  window.app = window.app || {};
  window.app.init = init;
  window.addEventListener('DOMContentLoaded', init);
})();
