(() => {
  function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function showLoading() { document.getElementById('loading-overlay').classList.remove('hidden'); }
  function hideLoading() { document.getElementById('loading-overlay').classList.add('hidden'); }

  function showModal(opts = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    return new Promise(resolve => {
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML = `
        <div class="modal">
          <h2>${opts.title || '提示'}</h2>
          <div>${opts.content || ''}</div>
          <div class="modal-actions">
            <button id="modal-cancel">${opts.cancelText || '取消'}</button>
            <button class="primary" id="modal-confirm">${opts.confirmText || '确认'}</button>
          </div>
        </div>`;
      root.appendChild(mask);
      mask.querySelector('#modal-cancel').addEventListener('click', () => {
        root.innerHTML = '';
        resolve(false);
      });
      mask.querySelector('#modal-confirm').addEventListener('click', () => {
        root.innerHTML = '';
        resolve(true);
      });
    });
  }

  window.app = window.app || {};
  window.app.ui = { toast, showModal, showLoading, hideLoading };
})();
