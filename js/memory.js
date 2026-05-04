(() => {
  let allMemories = [];

  function formatRelativeTime(iso) {
    const delta = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(delta / 3600000);
    if (hours < 1) return '1小时内';
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  }

  function renderList(container, query = '') {
    const list = container.querySelector('#memory-list');
    const filtered = query ? allMemories.filter(item => item.content.toLowerCase().includes(query.toLowerCase())) : allMemories;
    list.innerHTML = filtered.map(item => `
      <article class="section memory-card" data-id="${item.id}">
        <div class="memory-actions"><button class="icon-btn" data-edit="${item.id}">✏️</button><button class="icon-btn" data-del="${item.id}">🗑️</button></div>
        <div class="memory-content" id="content-${item.id}">${item.content}</div>
        <div class="memory-meta">${(item.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}<span>重要度：${'★'.repeat(item.importance || 1)}</span><span>${formatRelativeTime(item.created_at)}</span></div>
      </article>
    `).join('') || '<div class="helper">暂无记忆</div>';

    list.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-del'));
      const ok = await window.app.ui.showModal({ title: '确认删除', content: '确定删除这条记忆吗？', confirmText: '删除' });
      if (!ok) return;
      await window.app.db.deleteMemory(id);
      allMemories = await window.app.db.getAllMemories();
      renderList(container, container.querySelector('#memory-search').value.trim());
    }));
    list.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-edit'));
      const target = allMemories.find(item => item.id === id);
      if (!target) return;
      await openEditor(container, target);
    }));
  }

  async function openEditor(container, target) {
    const tags = await window.app.db.getAllTags();
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-mask"><div class="modal"><h2>${target ? '编辑记忆' : '新建记忆'}</h2>
      <label>内容</label><textarea id="memory-content" rows="5">${target?.content || ''}</textarea>
      <label>标签（逗号分隔）</label><input id="memory-tags" type="text" value="${(target?.tags || []).join(',')}" />
      <div class="helper">${tags.map(tag => `<button type="button" class="tag-suggest" data-tag="${tag}">${tag}</button>`).join('')}</div>
      <label>重要度</label><div id="importance-stars">${[1,2,3,4,5].map(n => `<button type="button" class="star-btn" data-star="${n}">${n <= (target?.importance || 3) ? '★' : '☆'}</button>`).join('')}</div>
      <div class="modal-actions"><button id="mem-cancel">取消</button><button id="mem-save" class="primary">保存</button></div></div></div>
    `;
    let importance = target?.importance || 3;
    root.querySelectorAll('.tag-suggest').forEach(btn => btn.addEventListener('click', () => {
      const input = root.querySelector('#memory-tags');
      const val = input.value.trim();
      input.value = val ? `${val},${btn.getAttribute('data-tag')}` : btn.getAttribute('data-tag');
    }));
    root.querySelectorAll('.star-btn').forEach(btn => btn.addEventListener('click', () => {
      importance = Number(btn.getAttribute('data-star'));
      root.querySelectorAll('.star-btn').forEach(item => {
        const level = Number(item.getAttribute('data-star'));
        item.textContent = level <= importance ? '★' : '☆';
      });
    }));
    root.querySelector('#mem-cancel').addEventListener('click', () => { root.innerHTML = ''; });
    root.querySelector('#mem-save').addEventListener('click', async () => {
      const content = root.querySelector('#memory-content').value.trim();
      if (content.length < 5) return window.app.ui.toast('内容至少5个字', 'error');
      const tagsText = root.querySelector('#memory-tags').value.trim();
      const parsedTags = tagsText ? tagsText.split(',').map(t => t.trim()).filter(Boolean) : [];
      const now = new Date().toISOString();
      if (target) {
        await window.app.db.updateMemory(target.id, { content, tags: parsedTags, importance, updated_at: now });
      } else {
        await window.app.db.addMemory({ content, tags: parsedTags, source_type: 'manual', source_ref: null, importance, created_at: now, updated_at: now });
      }
      root.innerHTML = '';
      allMemories = await window.app.db.getAllMemories();
      renderList(container, container.querySelector('#memory-search').value.trim());
      window.app.ui.toast('保存成功', 'success');
    });
  }

  async function renderMemoryPage(container) {
    container.innerHTML = `<section class="section"><div class="memory-top"><input id="memory-search" placeholder="搜索记忆内容" /><button id="btn-new-memory" class="primary" type="button">新建记忆</button></div></section><div id="memory-list"></div>`;
    allMemories = await window.app.db.getAllMemories();
    renderList(container);
    container.querySelector('#memory-search').addEventListener('input', event => renderList(container, event.target.value.trim()));
    container.querySelector('#btn-new-memory').addEventListener('click', () => openEditor(container, null));
  }

  window.app = window.app || {};
  window.app.memory = { renderMemoryPage };
})();
