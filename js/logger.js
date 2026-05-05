(() => {
  const MAX_LOGS = 100;
  window.__myosLogs = Array.isArray(window.__myosLogs) ? window.__myosLogs : [];

  function log(level, category, message, detail = null) {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      detail
    };
    window.__myosLogs.unshift(entry);
    if (window.__myosLogs.length > MAX_LOGS) window.__myosLogs.pop();
    return entry;
  }

  function logError(category, message, detail) { return log('error', category, message, detail); }
  function logWarn(category, message, detail) { return log('warn', category, message, detail); }
  function logInfo(category, message, detail) { return log('info', category, message, detail); }
  function getLogs(level = null) {
    if (!level) return [...window.__myosLogs];
    return window.__myosLogs.filter(e => e.level === level);
  }
  function getRecentErrors(n = 20) {
    return window.__myosLogs.filter(e => e.level === 'error').slice(0, n);
  }
  function clearLogs() { window.__myosLogs = []; }
  function formatLogsForAI() {
    const logs = window.__myosLogs.slice(0, 30);
    if (logs.length === 0) return '暂无记录到的错误或日志。';
    return logs.map(e =>
      `[${e.timestamp.slice(11, 19)}] [${e.level.toUpperCase()}] [${e.category}] ${e.message}` +
      (e.detail ? `\n  详情: ${typeof e.detail === 'object' ? JSON.stringify(e.detail) : e.detail}` : '')
    ).join('\n');
  }

  window.app = window.app || {};
  window.app.logger = { logError, logWarn, logInfo, getLogs, getRecentErrors, clearLogs, formatLogsForAI };
})();
