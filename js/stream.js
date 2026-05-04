(() => {
  async function consumeSSE(response, onChunk, onDone, onError) {
    try {
      if (!response.ok) throw new Error(`网络错误：${response.status}`);
      if (!response.body) throw new Error('当前环境不支持流式读取');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        frames.forEach(frame => {
          const dataLines = frame
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim());
          if (!dataLines.length) return;
          const raw = dataLines.join('\n');
          if (raw === '[DONE]') {
            if (typeof onDone === 'function') onDone();
            return;
          }
          let parsed = raw;
          try { parsed = JSON.parse(raw); } catch (_) {}
          if (typeof onChunk === 'function') onChunk(parsed);
        });
      }
      if (typeof onDone === 'function') onDone();
    } catch (error) {
      if (typeof onError === 'function') onError(error);
    }
  }

  window.app = window.app || {};
  window.app.stream = { consumeSSE };
})();
