(() => {
  let state = { conv: null, agent: null, thinking: false, aborter: null };
  const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  async function ensureConversation() { if (state.conv) return; const all = await window.app.db.getAllConversations(); state.conv = all.sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at))[0] || null; }
  async function renderChatPage(container) { await ensureConversation(); const agents = await window.app.db.getAllAgents(); state.agent = state.conv ? await window.app.db.getAgent(state.conv.agent_id) : agents[0]; state.thinking = state.agent?.thinking_default ?? false;
    container.innerHTML = `<section class='chat-page'><div class='chat-head'><div><span class='agent-dot' style='background:${state.agent?.color||'#4a9eff'}'>${state.agent?.icon||'🤖'}</span>${state.agent?.name||'欢迎'}</div><button id='chat-new'>新对话</button></div><div id='chat-msgs' class='chat-msgs'></div><div class='chat-input'><textarea id='chat-input' rows='2' placeholder='输入消息，Enter发送，Shift+Enter换行'></textarea><div class='chat-actions'><button id='toggle-thinking'>💭 ${state.thinking ? '深度思考' : '普通对话'}</button><button id='diagnose-btn' class='diagnose-btn' title='一键诊断'>🔍</button><button id='send-btn' class='primary'>发送</button></div></div></section>`;
    container.querySelector('#chat-new').onclick = async()=>{ const cId=await window.app.db.addConversation({agent_id:state.agent.id,title:'新对话'}); state.conv=await window.app.db.getConversation(cId); renderChatPage(container); };
    container.querySelector('#toggle-thinking').onclick=()=>{state.thinking=!state.thinking; renderChatPage(container);} ;
    container.querySelector('#diagnose-btn').onclick=()=>sendDiagnostic(container);
    container.querySelector('#send-btn').onclick=()=>send(container);
    container.querySelector('#chat-input').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(container);} });
    if (state.conv) renderMessages(container.querySelector('#chat-msgs')); else container.querySelector('#chat-msgs').innerHTML='<div class="helper">点击“新对话”开始。</div>';
  }
  async function renderMessages(box){ const list=await window.app.db.getMessagesByConversation(state.conv.id); box.innerHTML=list.map(m=>`<div class='msg ${m.role==='user'?'u':'a'} ${m.is_system_diagnostic?'system-diagnostic':''}'>${m.thinking_content?`<details><summary>💭 思考过程</summary><div class='thinking'>${esc(m.thinking_content)}</div></details>`:''}<div>${marked.parse(m.content||'')}</div></div>`).join(''); box.scrollTop=box.scrollHeight; }
  async function send(container, presetText = '', isSystemDiagnostic = false){ const input=container.querySelector('#chat-input'); const text=(presetText || input.value.trim()).trim(); if(!text||!state.agent) return; if(!state.conv){const cId=await window.app.db.addConversation({agent_id:state.agent.id,title:'新对话'}); state.conv=await window.app.db.getConversation(cId);} input.value=''; await window.app.db.addMessage({conversation_id:state.conv.id,role:'user',content:text,is_system_diagnostic:isSystemDiagnostic}); await window.app.db.updateConversation(state.conv.id,{message_count:(state.conv.message_count||0)+1});
    const msgs=await window.app.db.getMessagesByConversation(state.conv.id); const req=[{role:'system',content:state.agent.system_prompt},...msgs.map(m=>({role:m.role,content:m.content}))]; let content='', thinking='';
    await renderMessages(container.querySelector('#chat-msgs'));
    const res=await window.app.api.callAI(state.agent,req,{thinking:state.thinking});
    await new Promise(resolve=>window.app.stream.consumeSSE(res,(chunk)=>{content+=chunk.delta.content||''; thinking+=chunk.delta.thinking_content||''; const box=container.querySelector('#chat-msgs'); let draft=box.querySelector('.draft'); if(!draft){draft=document.createElement('div'); draft.className='msg a draft'; box.appendChild(draft);} draft.innerHTML=`${thinking?`<details><summary>💭 思考过程</summary><div class='thinking'>${esc(thinking)}</div></details>`:''}<div>${marked.parse(content+'▍')}</div>`; box.scrollTop=box.scrollHeight;},async()=>{await window.app.db.addMessage({conversation_id:state.conv.id,role:'assistant',content,thinking_content:thinking,model_used:state.agent.model,thinking_enabled:state.thinking}); const mc=(state.conv.message_count||1)+1; await window.app.db.updateConversation(state.conv.id,{message_count:mc}); state.conv=await window.app.db.getConversation(state.conv.id); if(mc===2){genTitle(text);} renderChatPage(container); resolve();},()=>resolve()));
  }

  async function sendDiagnostic(container) {
    const logger = window.app.logger;
    if (!logger) return;
    const hasLogs = logger.getLogs().length > 0;
    if (!hasLogs) {
      window.app.ui.toast('暂无错误日志。建议先触发一次晨报生成或API调用，再点击诊断。', 'error');
      return;
    }
    const text = `【系统诊断请求】\n\n以下是 my-os 应用最近的运行日志，请帮我分析是否有问题，找出错误原因并给出解决建议：\n\n---\n${logger.formatLogsForAI()}\n---\n\n请用简体中文回答，结构如下：\n1. 发现的问题（如果有）\n2. 可能的原因\n3. 建议的解决步骤\n如果日志显示一切正常，也请告知。`;
    if (!state.conv) {
      const cId = await window.app.db.addConversation({ agent_id: state.agent.id, title: '系统诊断' });
      state.conv = await window.app.db.getConversation(cId);
    }
    await send(container, text, true);
  }

  async function genTitle(firstText){ try{ const agents=await window.app.db.getAllAgents(); const fast=agents.find(a=>a.name==='速查')||agents[0]; const prompt=`用10字内简体中文概括以下用户问题作为对话标题，仅输出标题，无需引号或标点：${firstText}`; const res=await window.app.api.callAI(fast,[{role:'system',content:fast.system_prompt},{role:'user',content:prompt}],{thinking:false}); let t=''; await new Promise(r=>window.app.stream.consumeSSE(res,c=>{t+=c.delta.content||'';},r,r)); await window.app.db.updateConversation(state.conv.id,{title:t.trim().slice(0,10)||'新对话'});}catch(_){}}
  window.app=window.app||{}; window.app.chat={renderChatPage};
})();
