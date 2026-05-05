(() => {
  const DB_NAME = 'my-os';
  const DB_VERSION = 2;
  const STORES = [
    { name: 'settings', options: { keyPath: 'key' } },
    { name: 'memories', options: { keyPath: 'id', autoIncrement: true } },
    { name: 'tasks', options: { keyPath: 'id', autoIncrement: true } },
    { name: 'reports', options: { keyPath: 'date' } },
    { name: 'conversations', options: { keyPath: 'id', autoIncrement: true } },
    { name: 'messages', options: { keyPath: 'id', autoIncrement: true } },
    { name: 'agents', options: { keyPath: 'id', autoIncrement: true } }
  ];
  function ensureIndexes(storeName, store) { if (storeName === 'messages' && !store.indexNames.contains('by_conversation')) store.createIndex('by_conversation', 'conversation_id', { unique: false }); }
  function openDb() { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME, DB_VERSION); req.onupgradeneeded = () => { const db = req.result; STORES.forEach(({ name, options }) => { const store = db.objectStoreNames.contains(name) ? req.transaction.objectStore(name) : db.createObjectStore(name, options); ensureIndexes(name, store); }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || new Error('数据库打开失败')); }); }
  async function withStore(storeName, mode, runner) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, mode); runner(tx.objectStore(storeName), resolve, reject, tx); tx.onerror = () => reject(tx.error || new Error('事务失败')); tx.oncomplete = () => db.close(); }); }
  const now = () => new Date().toISOString();
  async function withLog(operation, runner) {
    try {
      return await runner();
    } catch (err) {
      window.app.logger?.logError('db', `数据库操作失败: ${operation}`, { error: err.message });
      throw err;
    }
  }

  const crud = (store) => ({ add: obj => withStore(store, 'readwrite', (s, r, j) => { const q = s.add(obj); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); }), put: obj => withStore(store, 'readwrite', (s, r, j) => { const q = s.put(obj); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); }), get: key => withStore(store, 'readonly', (s, r, j) => { const q = s.get(key); q.onsuccess = () => r(q.result || null); q.onerror = () => j(q.error); }), del: key => withStore(store, 'readwrite', (s, r, j) => { const q = s.delete(key); q.onsuccess = () => r(true); q.onerror = () => j(q.error); }), all: () => withStore(store, 'readonly', (s, r, j) => { const q = s.getAll(); q.onsuccess = () => r(q.result || []); q.onerror = () => j(q.error); }) });

  async function getSetting(key) { return withLog('getSetting', async () => { const row = await crud('settings').get(key); return row ? row.value : undefined; }); }
  async function setSetting(key, value) { return withLog('setSetting', async () => { await crud('settings').put({ key, value }); return true; }); }
  async function getAllSettings() { return withLog('getAllSettings', async () => { const rows = await crud('settings').all(); const out = {}; rows.forEach(v => out[v.key] = v.value); return out; }); }
  async function addMemory(memory) { return crud('memories').add(memory); }
  async function updateMemory(id, partial) { const data = await crud('memories').get(id); return crud('memories').put({ ...data, ...partial }); }
  async function deleteMemory(id) { return crud('memories').del(id); }
  async function getAllMemories() { const all = await crud('memories').all(); return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); }
  async function searchMemories(query) { const all = await getAllMemories(); return all.filter(i => i.content.includes(query)); }
  async function getAllTags() { const all = await getAllMemories(); return [...new Set(all.flatMap(i => i.tags || []))]; }
  async function putReport(report) { return withLog('putReport', () => crud('reports').put(report)); }
  async function getReport(date) { return withLog('getReport', () => crud('reports').get(date)); }
  async function deleteReport(date) { return withLog('deleteReport', () => crud('reports').del(date)); }
  async function getRecentReports(limit = 7) { return withLog('getRecentReports', async () => { const all = await crud('reports').all(); return all.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit); }); }

  const addTask = (task) => crud('tasks').add({ description: '', status: 'todo', priority: 3, due_date: null, tags: [], created_at: now(), updated_at: now(), completed_at: null, ...task });
  async function updateTask(id, partial) { const task = await crud('tasks').get(id); const status = partial.status || task.status; return crud('tasks').put({ ...task, ...partial, updated_at: now(), completed_at: status === 'done' ? (task.completed_at || now()) : null }); }
  const deleteTask = (id) => crud('tasks').del(id);
  const getAllTasks = () => crud('tasks').all();

  const addAgent = (agent) => crud('agents').add({ created_at: now(), updated_at: now(), ...agent });
  async function updateAgent(id, partial) { const agent = await crud('agents').get(id); return crud('agents').put({ ...agent, ...partial, updated_at: now() }); }
  async function deleteAgent(id) { const agent = await crud('agents').get(id); if (agent?.is_seed) throw new Error('种子Agent不可删除'); return crud('agents').del(id); }
  const getAllAgents = () => crud('agents').all();
  const getAgent = (id) => crud('agents').get(id);

  const addConversation = (c) => crud('conversations').add({ title: '新对话', message_count: 0, created_at: now(), updated_at: now(), ...c });
  async function updateConversation(id, partial) { const c = await crud('conversations').get(id); return crud('conversations').put({ ...c, ...partial, updated_at: now() }); }
  const deleteConversation = async (id) => { await withStore('messages', 'readwrite', (s, r, j) => { const q = s.index('by_conversation').openCursor(IDBKeyRange.only(id)); q.onsuccess = (e) => { const cur = e.target.result; if (!cur) { r(true); return; } cur.delete(); cur.continue(); }; q.onerror = () => j(q.error); }); return crud('conversations').del(id); };
  const getAllConversations = () => crud('conversations').all();
  const getConversation = (id) => crud('conversations').get(id);

  const addMessage = (m) => crud('messages').add({ thinking_content: null, timestamp: now(), ...m });
  const getMessagesByConversation = (conversationId) => withStore('messages', 'readonly', (s, r, j) => { const q = s.index('by_conversation').getAll(IDBKeyRange.only(conversationId)); q.onsuccess = () => r((q.result || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))); q.onerror = () => j(q.error); });

  async function exportAll() { return withLog('exportAll', async () => { const db = await openDb(); const result = {}; await Promise.all(STORES.map(({ name }) => new Promise((resolve, reject) => { const tx = db.transaction(name, 'readonly'); const req = tx.objectStore(name).getAll(); req.onsuccess = () => { result[name] = req.result; resolve(); }; req.onerror = () => reject(req.error || new Error(`导出 ${name} 失败`)); }))); db.close(); return result; }); }
  async function importAll(json) { return withLog('importAll', async () => { const db = await openDb(); for (const { name } of STORES) { await new Promise((resolve, reject) => { const tx = db.transaction(name, 'readwrite'); const store = tx.objectStore(name); store.clear(); (Array.isArray(json[name]) ? json[name] : []).forEach(item => store.put(item)); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error || new Error(`导入 ${name} 失败`)); }); } db.close(); return true; }); }

  window.app = window.app || {};
  window.app.db = { openDb, getSetting, setSetting, getAllSettings, exportAll, importAll, addMemory, updateMemory, deleteMemory, searchMemories, getAllMemories, getAllTags, putReport, getReport, deleteReport, getRecentReports, addTask, updateTask, deleteTask, getAllTasks, addAgent, updateAgent, deleteAgent, getAllAgents, getAgent, addConversation, updateConversation, deleteConversation, getAllConversations, getConversation, addMessage, getMessagesByConversation };
})();
