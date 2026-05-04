(() => {
  const DB_NAME = 'my-os';
  const DB_VERSION = 1;
  const STORES = [
    { name: 'settings', options: { keyPath: 'key' } },
    { name: 'memories', options: { keyPath: 'id', autoIncrement: true } },
    { name: 'tasks', options: { keyPath: 'id', autoIncrement: true } },
    { name: 'reports', options: { keyPath: 'date' } },
    { name: 'conversations', options: { keyPath: 'id', autoIncrement: true } }
  ];

  function openDb() { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME, DB_VERSION); req.onupgradeneeded = () => { const db = req.result; STORES.forEach(({ name, options }) => { if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options); }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || new Error('数据库打开失败')); }); }
  async function withStore(storeName, mode, runner) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, mode); const store = tx.objectStore(storeName); runner(store, resolve, reject); tx.onerror = () => reject(tx.error || new Error('事务失败')); tx.oncomplete = () => db.close(); }); }
  async function getSetting(key) { return withStore('settings', 'readonly', (store, resolve, reject) => { const req = store.get(key); req.onsuccess = () => resolve(req.result ? req.result.value : undefined); req.onerror = () => reject(req.error || new Error('读取设置失败')); }); }
  async function setSetting(key, value) { return withStore('settings', 'readwrite', (store, resolve, reject) => { const req = store.put({ key, value }); req.onsuccess = () => resolve(true); req.onerror = () => reject(req.error || new Error('写入设置失败')); }); }
  async function getAllSettings() { return withStore('settings', 'readonly', (store, resolve, reject) => { const req = store.getAll(); req.onsuccess = () => { const data = {}; req.result.forEach(item => { data[item.key] = item.value; }); resolve(data); }; req.onerror = () => reject(req.error || new Error('读取全部设置失败')); }); }

  async function addMemory(memory) { return withStore('memories', 'readwrite', (store, resolve, reject) => { const req = store.add(memory); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || new Error('新增记忆失败')); }); }
  async function updateMemory(id, partial) { return withStore('memories', 'readwrite', (store, resolve, reject) => { const getReq = store.get(id); getReq.onsuccess = () => { const data = { ...getReq.result, ...partial }; const putReq = store.put(data); putReq.onsuccess = () => resolve(true); putReq.onerror = () => reject(putReq.error || new Error('更新记忆失败')); }; getReq.onerror = () => reject(getReq.error || new Error('读取记忆失败')); }); }
  async function deleteMemory(id) { return withStore('memories', 'readwrite', (store, resolve, reject) => { const req = store.delete(id); req.onsuccess = () => resolve(true); req.onerror = () => reject(req.error || new Error('删除记忆失败')); }); }
  async function getAllMemories() { return withStore('memories', 'readonly', (store, resolve, reject) => { const req = store.getAll(); req.onsuccess = () => resolve(req.result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))); req.onerror = () => reject(req.error || new Error('读取记忆失败')); }); }
  async function searchMemories(query) { const all = await getAllMemories(); return all.filter(item => item.content.includes(query)); }
  async function getAllTags() { const all = await getAllMemories(); return [...new Set(all.flatMap(item => item.tags || []))]; }

  async function putReport(report) { return withStore('reports', 'readwrite', (store, resolve, reject) => { const req = store.put(report); req.onsuccess = () => resolve(true); req.onerror = () => reject(req.error || new Error('保存晨报失败')); }); }
  async function getReport(date) { return withStore('reports', 'readonly', (store, resolve, reject) => { const req = store.get(date); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error || new Error('读取晨报失败')); }); }
  async function deleteReport(date) { return withStore('reports', 'readwrite', (store, resolve, reject) => { const req = store.delete(date); req.onsuccess = () => resolve(true); req.onerror = () => reject(req.error || new Error('删除晨报失败')); }); }
  async function getRecentReports(limit = 7) { return withStore('reports', 'readonly', (store, resolve, reject) => { const req = store.getAll(); req.onsuccess = () => { const items = req.result.sort((a, b) => (a.date < b.date ? 1 : -1)); resolve(items.slice(0, limit)); }; req.onerror = () => reject(req.error || new Error('读取历史晨报失败')); }); }

  async function exportAll() { const db = await openDb(); const result = {}; await Promise.all(STORES.map(({ name }) => new Promise((resolve, reject) => { const tx = db.transaction(name, 'readonly'); const req = tx.objectStore(name).getAll(); req.onsuccess = () => { result[name] = req.result; resolve(); }; req.onerror = () => reject(req.error || new Error(`导出 ${name} 失败`)); }))); db.close(); return result; }
  async function importAll(json) { const db = await openDb(); for (const { name } of STORES) { await new Promise((resolve, reject) => { const tx = db.transaction(name, 'readwrite'); const store = tx.objectStore(name); store.clear(); const list = Array.isArray(json[name]) ? json[name] : []; list.forEach(item => store.put(item)); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error || new Error(`导入 ${name} 失败`)); }); } db.close(); return true; }

  window.app = window.app || {};
  window.app.db = { openDb, getSetting, setSetting, getAllSettings, exportAll, importAll, addMemory, updateMemory, deleteMemory, searchMemories, getAllMemories, getAllTags, putReport, getReport, deleteReport, getRecentReports };
})();
