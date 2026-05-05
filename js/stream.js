(() => {
  function normalizeChunk(parsed) {
    const delta = parsed?.choices?.[0]?.delta || parsed?.delta || {};
    const content = delta.content || '';
    const thinking_content = delta.reasoning_content || delta.thinking_content || delta.reasoning || '';
    return { raw: parsed, delta: { content, thinking_content } };
  }
  async function consumeSSE(response, onChunk, onDone, onError) {
    try { if (!response.ok) throw new Error(`网络错误：${response.status}`); if (!response.body) throw new Error('当前环境不支持流式读取');
      const reader = response.body.getReader(); const decoder = new TextDecoder('utf-8'); let buffer = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const frames = buffer.split('\n\n'); buffer = frames.pop() || '';
        frames.forEach(frame => { const lines = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()); if (!lines.length) return; const raw = lines.join('\n'); if (raw === '[DONE]') return;
          let parsed = raw; try { parsed = JSON.parse(raw); } catch (_) {}
          if (typeof onChunk === 'function') onChunk(normalizeChunk(parsed));
        }); }
      if (typeof onDone === 'function') onDone();
    } catch (e) { window.app.logger?.logError('stream', 'SSE解析错误', { error: e.message }); if (typeof onError === 'function') onError(e); }
  }
  window.app = window.app || {}; window.app.stream = { consumeSSE };
})();
