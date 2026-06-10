// ============================================================
// КОМПЛАЕНСПРО — tasks.js
// Задачи: список, добавление глобально и для клиента
// Декомпозиция app.js — батч 2, 10.06.2026
// ============================================================

async function addTaskForClient(clientId) {
  showAddTaskModal(clientId);
}

// ── ЗАДАЧИ ───────────────────────────────────────────────
async function renderTasks() {
  const tasks = await window.api.tasksList();
  const btn = document.getElementById('topbarAction');
  btn.textContent = '+ Добавить задачу';
  btn.style.display = 'flex';
  btn.onclick = addGlobalTask;

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="panel-head">${ic("clipboard-list", 18)}<div class="panel-title">Все задачи</div><div class="panel-count">${tasks.filter(t=>!t.done).length} открытых</div></div>
      <div id="taskList">${tasks.length ? tasks.map(t=>renderTaskRow(t)).join('') : emptyState("check-circle","Задач нет")}</div>
    </div>
  `;
}

async function addGlobalTask() {
  showAddTaskModal(null);
}

function showAddTaskModal(clientId) {
  const existing = document.getElementById('modal-add-task');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-add-task';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;width:420px;box-shadow:0 24px 60px rgba(0,0,0,0.7);animation:ob-card-in .3s cubic-bezier(.22,.68,0,1.1) both">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:15px;font-weight:700;color:#f1f5f9;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Новая задача
        </div>
        <button onclick="document.getElementById('modal-add-task').remove()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:6px" onmouseover="this.style.color='#f1f5f9'" onmouseout="this.style.color='#475569'">✕</button>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:7px">Название задачи *</label>
        <input id="add-task-title" placeholder="Например: Обновить инструктаж по ОТ"
          style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .2s"
          onfocus="this.style.borderColor='rgba(59,130,246,0.6)'"
          onblur="this.style.borderColor='rgba(255,255,255,0.1)'"
          onkeydown="if(event.key==='Enter')submitAddTask(${clientId})">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div>
          <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:7px">Модуль</label>
          <select id="add-task-module"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;cursor:pointer">
            <option value="">Без модуля</option>
            <option value="OT">Охрана труда</option>
            <option value="PD">Персональные данные</option>
            <option value="VU">Воинский учёт</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:7px">Срок</label>
          <input id="add-task-due" type="date"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;cursor:pointer">
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('modal-add-task').remove()"
          style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer;transition:all .2s"
          onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          Отмена
        </button>
        <button onclick="submitAddTask(${clientId})"
          style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(59,130,246,0.3);transition:all .2s"
          onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(59,130,246,0.4)'"
          onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(59,130,246,0.3)'">
          ✓ Добавить задачу
        </button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('add-task-title')?.focus(), 80);
}

async function submitAddTask(clientId) {
  const title = document.getElementById('add-task-title')?.value?.trim();
  const module = document.getElementById('add-task-module')?.value || null;
  const due = document.getElementById('add-task-due')?.value || '';

  if (!title) {
    const inp = document.getElementById('add-task-title');
    if (inp) { inp.style.borderColor='#f87171'; setTimeout(()=>inp.style.borderColor='rgba(255,255,255,0.1)',2000); }
    return;
  }

  await window.api.taskAdd({ client_id: clientId||null, title, module: module||null, priority:'normal', due_date: due });
  document.getElementById('modal-add-task')?.remove();
  showToast('✅ Задача добавлена');

  if (clientId) {
    await navigate('client', clientId);
  } else {
    await navigate('tasks');
  }
}
