(() => {
  let filter = 'all';
  const statusText = { todo: '待办', doing: '进行中', done: '已完成' };
  async function renderTasksPage(container) {
    const tasks = await window.app.db.getAllTasks();
    const sorted = tasks.sort((a,b)=>( {todo:0,doing:1,done:2}[a.status]-{todo:0,doing:1,done:2}[b.status]) || (b.priority-a.priority) || (new Date(b.created_at)-new Date(a.created_at)));
    const shown = filter==='all'?sorted:sorted.filter(t=>t.status===filter);
    container.innerHTML = `<section class='section'><h1>任务</h1><div class='input-wrap'><input id='quick-task' placeholder='输入后回车快速添加'/><span class='helper'>回车快速添加</span></div><div class='task-filters'>${['all','todo','doing','done'].map(k=>`<button class='nav-tab ${filter===k?'active':''}' data-f='${k}'>${k==='all'?'全部':statusText[k]}</button>`).join('')}</div><div>${shown.map(t=>`<div class='section'><div><button data-cycle='${t.id}'>${t.status==='done'?'✅':'◯'}</button> ${t.status==='done'?`<s>${t.title}</s>`:t.title} <span class='helper'>★${t.priority}</span></div></div>`).join('')}</div></section>`;
    container.querySelector('#quick-task').addEventListener('keydown', async e=>{ if(e.key==='Enter'&&e.target.value.trim()){ await window.app.db.addTask({title:e.target.value.trim()}); renderTasksPage(container);} });
    container.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{filter=b.dataset.f;renderTasksPage(container);});
    container.querySelectorAll('[data-cycle]').forEach(b=>b.onclick=async()=>{ const id=Number(b.dataset.cycle); const task=tasks.find(t=>t.id===id); const next=task.status==='todo'?'doing':task.status==='doing'?'done':'todo'; await window.app.db.updateTask(id,{status:next}); renderTasksPage(container);});
  }
  window.app=window.app||{}; window.app.tasks={renderTasksPage};
})();
