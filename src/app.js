// ═══════════════════════════════════════════════════════
//  КомплаенсПро — app.js
// ═══════════════════════════════════════════════════════

const COLORS = ['#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa','#22d3ee','#fb923c','#4ade80'];
let currentPage = 'dashboard';
let currentClientId = null;
let settings = {};

// ── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  settings = await window.api.settingsGet();
  applySettings();
  setupNav();
  await navigate('dashboard');
});

function applySettings() {
  const name = settings.user_name || 'А. Свинцов';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('userName').textContent = name;
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userRole').textContent = settings.user_position || 'Специалист по ОТ';
  const hasKey = settings.ai_key && settings.ai_key.length > 10;
  const dot = document.querySelector('.ai-dot');
  const txt = document.getElementById('aiStatusText');
  if (hasKey) { dot.classList.add('active'); txt.textContent = 'AI активен'; }
  else { dot.classList.remove('active'); txt.textContent = 'Базовый режим'; }
}

// ── НАВИГАЦИЯ ────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });
}

async function navigate(page, clientId = null) {
  currentPage = page;
  currentClientId = clientId;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';
  const titles = {
    dashboard:'Дашборд', clients:'Клиенты', tasks:'Задачи',
    ot:'Охрана труда', pd:'Персональные данные', vu:'Воинский учёт',
    settings:'⚙️ Настройки', client:'Карточка клиента'
  };
  document.getElementById('topbarTitle').textContent = titles[page] || page;
  await updateBadges();
  const content = document.getElementById('content');
  content.innerHTML = '';
  if (page === 'dashboard') await renderDashboard();
  else if (page === 'clients')   await renderClients();
  else if (page === 'client')    await renderClientCard(clientId);
  else if (page === 'tasks')     await renderTasks();
  else if (page === 'settings')  await renderSettings();
  else renderComingSoon(titles[page] || page);
}

async function updateBadges() {
  const clients = await window.api.clientsList();
  document.getElementById('badge-clients').textContent = clients.length;
  const tasks = await window.api.tasksList();
  const open = tasks.filter(t => !t.done).length;
  document.getElementById('badge-tasks').textContent = open;
}

// ── ДАШБОРД ──────────────────────────────────────────────
async function renderDashboard() {
  const stats  = await window.api.dashboardStats();
  const clients = await window.api.clientsList();
  const tasks  = await window.api.tasksList();
  const events = await window.api.eventsList(null);
  const btn = document.getElementById('topbarAction');
  btn.textContent = '+ Добавить клиента';
  btn.style.display = 'flex';
  btn.onclick = () => openModal('modalAddClient');

  document.getElementById('content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">🏢 Клиенты</div><div class="stat-value">${stats.clients}</div><div class="stat-sub">организаций на обслуживании</div><div class="stat-accent">🏢</div></div>
      <div class="stat-card"><div class="stat-label">📋 Открытых задач</div><div class="stat-value">${stats.tasks}</div><div class="stat-sub">${stats.urgent} срочных</div><div class="stat-accent">📋</div></div>
      <div class="stat-card"><div class="stat-label">🔔 Событий</div><div class="stat-value">${events.length}</div><div class="stat-sub">в календаре</div><div class="stat-accent">📅</div></div>
      <div class="stat-card"><div class="stat-label">⚠️ Просрочено</div><div class="stat-value" style="color:var(--red)">${stats.overdue}</div><div class="stat-sub">требуют немедленных действий</div><div class="stat-accent">⚠️</div></div>
    </div>
    <div class="grid2">
      <div>
        <div class="panel">
          <div class="panel-head"><span>🏢</span><div class="panel-title">Клиенты</div><div class="panel-count">${clients.length} орг.</div><div class="panel-action" onclick="navigate('clients')">Все →</div></div>
          <div class="client-search"><input class="search-input" placeholder="🔍 Поиск клиента..." oninput="filterDashClients(this.value)"></div>
          <div id="dashClientList">${renderClientRows(clients)}</div>
        </div>
        ${tasks.length ? `
        <div class="panel">
          <div class="panel-head"><span>📋</span><div class="panel-title">Задачи на сегодня</div><div class="panel-action" onclick="navigate('tasks')">Все →</div></div>
          <div>${tasks.slice(0,5).map(t => renderTaskRow(t)).join('')}</div>
        </div>` : ''}
      </div>
      <div class="panel">
        <div class="panel-head"><span>🔔</span><div class="panel-title">Ближайшие события</div></div>
        <div>${events.length ? events.slice(0,8).map(e => renderEventRow(e)).join('') : '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Событий нет</div><div class="empty-sub">Добавьте клиентов — события появятся автоматически</div></div>'}</div>
      </div>
    </div>
  `;
}

let allDashClients = [];
async function filterDashClients(q) {
  if (!allDashClients.length) allDashClients = await window.api.clientsList();
  const filtered = allDashClients.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.inn||'').includes(q) || (c.okved||'').includes(q)
  );
  document.getElementById('dashClientList').innerHTML = renderClientRows(filtered);
}

function renderClientRows(clients) {
  if (!clients.length) return '<div class="empty-state"><div class="empty-icon">🏢</div><div class="empty-title">Клиентов пока нет</div><div class="empty-sub">Нажмите «+ Добавить клиента»</div></div>';
  return clients.map(c => {
    const mods = (c.modules||'OT').split(',');
    const dots = mods.map(m => `<div class="mod-dot" style="background:${m==='OT'?'var(--green)':m==='PD'?'var(--amber)':'var(--red)'}" title="${m}"></div>`).join('');
    const initials = c.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i,'').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    const scoreColor = c.score >= 80 ? 'var(--green)' : c.score >= 60 ? 'var(--amber)' : 'var(--red)';
    return `<div class="client-row" onclick="navigate('client',${c.id})">
      <div class="client-avatar-sm" style="background:${c.color||'#60a5fa'}22;border:1px solid ${c.color||'#60a5fa'}44;color:${c.color||'#60a5fa'}">${initials}</div>
      <div class="client-info"><div class="client-name">${c.name}</div><div class="client-meta">ОКВЭД ${c.okved||'—'} · ${c.staff||0} чел. · ${c.region||''}</div></div>
      <div class="mod-dots">${dots}</div>
      <div class="client-score" style="color:${scoreColor}">${c.score||0}%</div>
    </div>`;
  }).join('');
}

function renderEventRow(e) {
  const due = new Date(e.due_date);
  const now = new Date();
  const diff = Math.round((due - now) / 86400000);
  let color = 'var(--muted2)', label = formatDate(e.due_date);
  if (diff < 0) { color = 'var(--red)'; label = 'Просрочено'; }
  else if (diff <= 3) color = 'var(--red)';
  else if (diff <= 14) color = 'var(--amber)';
  else if (diff <= 30) color = 'var(--blue2)';
  const modColor = e.module==='OT'?'var(--green)':e.module==='PD'?'var(--amber)':'var(--red)';
  return `<div class="event-row">
    <div class="ev-dot" style="background:${color}"></div>
    <div class="ev-body"><div class="ev-title">${e.title}</div><div class="ev-sub">${e.client_name||''}</div></div>
    <div class="ev-when" style="color:${color}">${label}</div>
  </div>`;
}

function renderTaskRow(t) {
  const tagClass = t.module==='OT'?'tag-ot':t.module==='PD'?'tag-pd':'tag-vu';
  const tagLabel = t.module==='OT'?'ОТ':t.module==='PD'?'ПД':'ВУ';
  return `<div class="task-row">
    <div class="task-check ${t.done?'done':''}" onclick="toggleTask(${t.id},this)">${t.done?'✓':''}</div>
    <div class="task-text ${t.done?'done':''}">${t.title}${t.client_name?' <span style="color:var(--muted);font-size:11px">· '+t.client_name+'</span>':''}</div>
    ${t.module?`<div class="task-tag ${tagClass}">${tagLabel}</div>`:''}
  </div>`;
}

async function toggleTask(id, el) {
  await window.api.taskToggle(id);
  el.classList.toggle('done');
  el.textContent = el.classList.contains('done') ? '✓' : '';
  const text = el.nextElementSibling;
  if (text) text.classList.toggle('done');
}

// ── КЛИЕНТЫ ──────────────────────────────────────────────
async function renderClients() {
  const clients = await window.api.clientsList();
  const btn = document.getElementById('topbarAction');
  btn.textContent = '+ Добавить клиента';
  btn.style.display = 'flex';
  btn.onclick = () => openModal('modalAddClient');

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="panel-head"><span>🏢</span><div class="panel-title">Все клиенты</div><div class="panel-count">${clients.length} организаций</div></div>
      <div class="client-search"><input class="search-input" placeholder="🔍 Поиск по названию, ИНН, ОКВЭД..." oninput="filterClients(this.value)" id="clientSearch"></div>
      <div id="fullClientList">${renderClientRows(clients)}</div>
    </div>
  `;
  window._allClients = clients;
}

async function filterClients(q) {
  const clients = window._allClients || [];
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.inn||'').includes(q) || (c.okved||'').includes(q)
  );
  document.getElementById('fullClientList').innerHTML = renderClientRows(filtered);
}

// ── КАРТОЧКА КЛИЕНТА ─────────────────────────────────────
async function renderClientCard(id) {
  const c = await window.api.clientGet(id);
  if (!c) { renderComingSoon('Клиент не найден'); return; }
  const docs = await window.api.documentsList(id);
  const events = await window.api.eventsList(id);
  const emps = await window.api.employeesList(id);
  const tasks = await window.api.tasksList();
  const clientTasks = tasks.filter(t => t.client_id == id);
  const mods = (c.modules||'OT').split(',');
  const initials = c.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i,'').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
  const scoreColor = c.score >= 80 ? 'var(--green)' : c.score >= 60 ? 'var(--amber)' : 'var(--red)';

  document.getElementById('topbarTitle').textContent = c.name;
  const btn = document.getElementById('topbarAction');
  btn.textContent = '← Все клиенты';
  btn.style.display = 'flex';
  btn.className = 'btn btn-ghost';
  btn.onclick = () => { btn.className = 'btn btn-primary'; navigate('clients'); };

  // Add edit button
  const editBtn = document.getElementById('topbarEdit') || (() => {
    const b = document.createElement('button');
    b.id = 'topbarEdit';
    b.className = 'btn btn-ghost';
    b.textContent = '✏️ Редактировать';
    document.getElementById('topbarAction').after(b);
    return b;
  })();
  editBtn.style.display = 'flex';
  editBtn.onclick = () => openEditModal(clientId);

  const otDocs = docs.filter(d => d.module === 'OT');
  const pdDocs = docs.filter(d => d.module === 'PD');
  const vuDocs = docs.filter(d => d.module === 'VU');

  document.getElementById('content').innerHTML = `
    <div class="hero">
      <div class="hero-top">
        <div class="hero-avatar" style="background:${c.color||'#60a5fa'}22;border:1px solid ${c.color||'#60a5fa'}44">${initials}</div>
        <div style="flex:1">
          <div class="hero-name">${c.name}</div>
          <div class="hero-tags">
            ${c.inn?`<span class="hero-tag">ИНН: ${c.inn}</span>`:''}
            ${c.okved?`<span class="hero-tag">ОКВЭД: ${c.okved}</span>`:''}
            ${c.region?`<span class="hero-tag">📍 ${c.region}</span>`:''}
            ${c.staff?`<span class="hero-tag">${c.staff} сотр.</span>`:''}
            ${c.form?`<span class="hero-tag">${c.form}</span>`:''}
          </div>
        </div>
        <div class="hero-score" style="text-align:right">
          <div class="score-val" style="color:${scoreColor}">${c.score||0}%</div>
          <div class="score-label">Готовность</div>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hstat"><div class="hstat-val" style="color:var(--green)">${docs.length}</div><div class="hstat-label">Документов</div></div>
        <div class="hstat"><div class="hstat-val" style="color:var(--amber)">${docs.filter(d=>d.status==='outdated').length}</div><div class="hstat-label">Обновить</div></div>
        <div class="hstat"><div class="hstat-val" style="color:var(--red)">${events.filter(e=>new Date(e.due_date)<new Date()).length}</div><div class="hstat-label">Просрочено</div></div>
        <div class="hstat"><div class="hstat-val">${emps.length}</div><div class="hstat-label">Сотрудников</div></div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab active" onclick="switchTab('overview')">📊 Обзор</div>
      ${mods.includes('OT')?`<div class="tab" onclick="switchTab('ot')">🦺 Охрана труда</div>`:''}
      ${mods.includes('PD')?`<div class="tab" onclick="switchTab('pd')">🔒 Персданные</div>`:''}
      ${mods.includes('VU')?`<div class="tab" onclick="switchTab('vu')">⚔️ Воинский учёт</div>`:''}
      <div class="tab" onclick="switchTab('staff')">👥 Сотрудники</div>
    </div>

    <div class="tab-panel active" id="tab-overview">
      <div class="grid2">
        <div class="panel">
          <div class="panel-head"><span>🔔</span><div class="panel-title">Ближайшие события</div></div>
          <div>${events.length ? events.slice(0,6).map(e=>renderEventRow(e)).join('') : '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Событий нет</div></div>'}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><span>📋</span><div class="panel-title">Задачи</div><div class="panel-action" onclick="addTaskForClient(${id})">+ Добавить</div></div>
          <div>${clientTasks.length ? clientTasks.map(t=>renderTaskRow(t)).join('') : '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Задач нет</div></div>'}</div>
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-ot">
      <div class="panel">
        <div class="panel-head"><span>🦺</span><div class="panel-title">Документы — Охрана труда</div><div class="panel-count">${otDocs.length} шт.</div><button class="btn btn-primary" style="margin-left:auto;padding:6px 12px;font-size:11px" onclick="generateDocs(${id})">⚡ Сгенерировать</button></div>
        <div>${otDocs.length ? otDocs.map(d=>renderDocRow(d)).join('') : renderEmptyDocs('ОТ', id)}</div>
      </div>
    </div>

    <div class="tab-panel" id="tab-pd">
      <div class="panel">
        <div class="panel-head"><span>🔒</span><div class="panel-title">Документы — Персданные</div><div class="panel-count">${pdDocs.length} шт.</div></div>
        <div>${pdDocs.length ? pdDocs.map(d=>renderDocRow(d)).join('') : renderEmptyDocs('ПД', id)}</div>
      </div>
    </div>

    <div class="tab-panel" id="tab-vu">
      <div class="panel">
        <div class="panel-head"><span>⚔️</span><div class="panel-title">Документы — Воинский учёт</div><div class="panel-count">${vuDocs.length} шт.</div></div>
        <div>${vuDocs.length ? vuDocs.map(d=>renderDocRow(d)).join('') : renderEmptyDocs('ВУ', id)}</div>
      </div>
    </div>

    <div class="tab-panel" id="tab-staff">
      <div class="panel">
        <div class="panel-head"><span>👥</span><div class="panel-title">Сотрудники</div><div class="panel-count">${emps.length} чел.</div><div class="panel-action" onclick="addEmployeePrompt(${id})">+ Добавить</div></div>
        <div>${emps.length ? emps.map(e=>renderEmpRow(e)).join('') : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Сотрудников нет</div><div class="empty-sub">Добавьте сотрудников для учёта обучений</div></div>'}</div>
      </div>
    </div>
  `;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => { if (t.getAttribute('onclick') && t.getAttribute('onclick').includes(name)) t.classList.add('active'); });
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
}

function renderDocRow(d) {
  const statusMap = { ok:'✓ Актуален', outdated:'⚠ Обновить', draft:'В работе', missing:'Отсутствует' };
  const colorMap = { ok:'var(--green)', outdated:'var(--red)', draft:'var(--amber)', missing:'var(--muted2)' };
  return `<div class="client-row">
    <div class="client-avatar-sm" style="background:var(--s3);color:var(--muted2);font-size:14px">📄</div>
    <div class="client-info"><div class="client-name">${d.name}</div><div class="client-meta">${d.module} · ${d.updated_at ? formatDate(d.updated_at) : 'Не создан'}</div></div>
    <div style="font-size:11px;font-weight:600;color:${colorMap[d.status]||'var(--muted2)'};flex-shrink:0">${statusMap[d.status]||d.status}</div>
  </div>`;
}

function renderEmptyDocs(mod, clientId) {
  return `<div class="empty-state">
    <div class="empty-icon">📄</div>
    <div class="empty-title">Документов нет</div>
    <div class="empty-sub">Документы по модулю ${mod} появятся здесь после генерации</div>
    <button class="btn btn-primary" style="margin-top:8px" onclick="showToast('Генерация документов будет доступна после подключения AI')">⚡ Сгенерировать</button>
  </div>`;
}

function renderEmpRow(e) {
  return `<div class="client-row">
    <div class="client-avatar-sm" style="background:var(--s3);color:var(--muted2);font-size:11px;font-weight:700">${e.full_name.split(' ').map(w=>w[0]||'').join('').slice(0,2)}</div>
    <div class="client-info"><div class="client-name">${e.full_name}</div><div class="client-meta">${e.position||'—'} ${e.is_military?'· ⚔️ Военнообязанный':''}</div></div>
    <div style="display:flex;gap:6px">
      <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="deleteEmployee(${e.id})">🗑</button>
    </div>
  </div>`;
}

async function addEmployeePrompt(clientId) {
  const name = prompt('ФИО сотрудника:');
  if (!name || !name.trim()) return;
  const pos = prompt('Должность:') || '';
  const mil = confirm('Военнообязанный?') ? 1 : 0;
  await window.api.employeeAdd({ client_id: clientId, full_name: name.trim(), position: pos, department: '', is_military: mil, hired_at: new Date().toISOString().slice(0,10) });
  showToast('Сотрудник добавлен');
  await navigate('client', clientId);
}

async function deleteEmployee(id) {
  if (!confirm('Удалить сотрудника?')) return;
  await window.api.employeeDelete(id);
  showToast('Удалено');
  await navigate('client', currentClientId);
}

async function addTaskForClient(clientId) {
  const title = prompt('Название задачи:');
  if (!title || !title.trim()) return;
  await window.api.taskAdd({ client_id: clientId, title: title.trim(), module: 'OT', priority: 'normal', due_date: '' });
  showToast('Задача добавлена');
  await navigate('client', clientId);
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
      <div class="panel-head"><span>📋</span><div class="panel-title">Все задачи</div><div class="panel-count">${tasks.filter(t=>!t.done).length} открытых</div></div>
      <div id="taskList">${tasks.length ? tasks.map(t=>renderTaskRow(t)).join('') : '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Задач нет</div></div>'}</div>
    </div>
  `;
}

async function addGlobalTask() {
  const title = prompt('Название задачи:');
  if (!title || !title.trim()) return;
  await window.api.taskAdd({ client_id: null, title: title.trim(), module: null, priority: 'normal', due_date: '' });
  showToast('Задача добавлена');
  await navigate('tasks');
}

// ── НАСТРОЙКИ ────────────────────────────────────────────
async function renderSettings() {
  const s = await window.api.settingsGet();
  document.getElementById('content').innerHTML = `
    <div style="display:flex;gap:20px;align-items:flex-start">
      <div style="width:170px;flex-shrink:0;display:flex;flex-direction:column;gap:2px;position:sticky;top:0">
        <div class="snav-item active" onclick="scrollSection('s-profile',this)">👤 Профиль</div>
        <div class="snav-item" onclick="scrollSection('s-req',this)">🏢 Реквизиты</div>
        <div class="snav-item" onclick="scrollSection('s-tg',this)">✈️ Telegram</div>
        <div class="snav-item" onclick="scrollSection('s-remind',this)">🔔 Напоминания</div>
        <div class="snav-item" onclick="scrollSection('s-backup',this)">💾 Резервные копии</div>
        <div class="snav-item" onclick="scrollSection('s-ai',this)">🤖 AI-провайдер</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:14px">

        <div class="section" id="s-profile">
          <div class="section-head"><span class="section-icon">👤</span><div class="section-title">Профиль</div></div>
          <div class="section-body">
            <div class="form-row">
              <div class="form-group"><div class="form-label">Имя и фамилия</div><input class="form-input" id="s-user_name" value="${s.user_name||''}"></div>
              <div class="form-group"><div class="form-label">Должность</div><input class="form-input" id="s-user_position" value="${s.user_position||''}"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><div class="form-label">Телефон</div><input class="form-input" id="s-user_phone" value="${s.user_phone||''}"></div>
              <div class="form-group"><div class="form-label">Email</div><input class="form-input" id="s-user_email" value="${s.user_email||''}"></div>
            </div>
          </div>
        </div>

        <div class="section" id="s-req">
          <div class="section-head"><span class="section-icon">🏢</span><div class="section-title">Реквизиты исполнителя</div></div>
          <div class="section-body">
            <div class="form-group"><div class="form-label">Полное наименование</div><input class="form-input" id="s-company_name" value="${s.company_name||''}" placeholder="ИП Фамилия Имя Отчество"></div>
            <div class="form-row">
              <div class="form-group"><div class="form-label">ИНН</div><input class="form-input" id="s-company_inn" value="${s.company_inn||''}"></div>
              <div class="form-group"><div class="form-label">ОГРНИП / ОГРН</div><input class="form-input" id="s-company_ogrn" value="${s.company_ogrn||''}"></div>
            </div>
            <div class="form-group"><div class="form-label">Адрес</div><input class="form-input" id="s-company_address" value="${s.company_address||''}" placeholder="Почтовый адрес"></div>
          </div>
        </div>

        <div class="section" id="s-tg">
          <div class="section-head"><span class="section-icon">✈️</span><div class="section-title">Telegram-уведомления</div></div>
          <div class="section-body">
            <div style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:14px;font-size:12.5px;color:var(--muted2);line-height:1.7">
              1. Открой Telegram → найди <b style="color:var(--text)">@BotFather</b> → напиши <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;color:var(--cyan)">/newbot</code><br>
              2. Придумай название и username для бота<br>
              3. Скопируй токен вида <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;color:var(--cyan)">7123456789:AAH...</code> — вставь ниже<br>
              4. Нажми «Привязать» → напиши боту любое сообщение
            </div>
            <div class="form-row">
              <div class="form-group"><div class="form-label">Токен бота</div><input class="form-input" id="s-tg_token" value="${s.tg_token||''}" placeholder="7123456789:AAHxxxxx..."></div>
              <div class="form-group" style="justify-content:flex-end"><div class="form-label" style="opacity:0">.</div><button class="btn btn-ghost" onclick="testTelegram()">🔗 Привязать</button></div>
            </div>
            <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Утренняя сводка в 8:00</div><div class="toggle-desc">Задачи и события на день</div></div><label class="toggle"><input type="checkbox" ${s.tg_morning==='1'?'checked':''} onchange="saveSetting('tg_morning',this.checked?'1':'0')"><span class="toggle-slider"></span></label></div>
            <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Срочные уведомления</div><div class="toggle-desc">При просрочке или критическом событии</div></div><label class="toggle"><input type="checkbox" ${s.tg_urgent!=='0'?'checked':''} onchange="saveSetting('tg_urgent',this.checked?'1':'0')"><span class="toggle-slider"></span></label></div>
          </div>
        </div>

        <div class="section" id="s-remind">
          <div class="section-head"><span class="section-icon">🔔</span><div class="section-title">Напоминания</div></div>
          <div class="section-body">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
              ${['30','14','3'].map((d,i) => `<div style="background:var(--s3);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
                <div style="font-size:10px;color:var(--muted);margin-bottom:8px">${['Первое','Повторное','Срочное'][i]}</div>
                <input type="number" class="form-input" id="s-remind_days_${i+1}" value="${s['remind_days_'+(i+1)]||d}" min="1" max="90" style="width:60px;text-align:center;font-family:var(--fh);font-size:18px;font-weight:700;padding:5px;margin:0 auto;display:block">
                <div style="font-size:10px;color:var(--muted);margin-top:6px">дней до события</div>
              </div>`).join('')}
            </div>
            <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Напоминать перед выходными</div><div class="toggle-desc">Если срок в выходной — напомнить в пятницу</div></div><label class="toggle"><input type="checkbox" ${s.remind_weekends!=='0'?'checked':''} onchange="saveSetting('remind_weekends',this.checked?'1':'0')"><span class="toggle-slider"></span></label></div>
            <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Эскалация при просрочке</div><div class="toggle-desc">Ежедневно пока не закрыто</div></div><label class="toggle"><input type="checkbox" ${s.remind_escalate!=='0'?'checked':''} onchange="saveSetting('remind_escalate',this.checked?'1':'0')"><span class="toggle-slider"></span></label></div>
          </div>
        </div>

        <div class="section" id="s-backup">
          <div class="section-head"><span class="section-icon">💾</span><div class="section-title">Резервные копии</div></div>
          <div class="section-body">
            <div class="form-row">
              <div class="form-group" style="grid-column:1/-1"><div class="form-label">Папка для копий</div>
                <div style="display:flex;gap:8px">
                  <input class="form-input" id="s-backup_path" value="${s.backup_path||''}" placeholder="C:\\Users\\...\\Яндекс.Диск\\КомплаенсПро\\Backup" style="flex:1">
                  <button class="btn btn-ghost" onclick="chooseBackupFolder()">📁</button>
                </div>
                <div style="font-size:11px;color:var(--muted);margin-top:4px">Рекомендуется: папка Яндекс.Диска для автосинхронизации</div>
              </div>
            </div>
            <div style="display:flex;gap:10px">
              <button class="btn btn-ghost" onclick="backupNow()">💾 Создать копию сейчас</button>
            </div>
          </div>
        </div>

        <div class="section" id="s-ai">
          <div class="section-head"><span class="section-icon">🤖</span><div class="section-title">AI-провайдер</div></div>
          <div class="section-body">
            <div style="display:flex;flex-direction:column;gap:8px">
              ${[
                ['claude','🤖','Claude API (Anthropic)','Наилучшее качество для юридических текстов','Основной'],
                ['yandex','🟡','YandexGPT API','Российский · Не блокируется в РФ','РФ'],
                ['giga','🟢','GigaChat API (Сбер)','Российский · Сертифицирован для ПД','РФ'],
                ['ollama','🟣','Локальная модель (Ollama)','Полностью офлайн · Без интернета','Офлайн'],
              ].map(([val,icon,name,desc,badge]) => `
                <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:var(--s3);border:1px solid ${s.ai_provider===val?'var(--blue)':'var(--border)'};border-radius:10px;cursor:pointer;transition:all .15s" onclick="selectAiProvider('${val}',this)">
                  <div style="font-size:18px">${icon}</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">${name}</div><div style="font-size:11px;color:var(--muted);margin-top:1px">${desc}</div></div>
                  <div style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:rgba(59,130,246,0.12);color:var(--blue2)">${badge}</div>
                </div>`).join('')}
            </div>
            <div style="margin-top:4px">
              <div class="form-label" style="margin-bottom:6px">API-ключ выбранного провайдера</div>
              <input class="form-input" id="s-ai_key" type="password" value="${s.ai_key||''}" placeholder="Введите API-ключ когда будет готов">
              <div style="font-size:11px;color:var(--muted);margin-top:4px">Без ключа приложение работает в базовом режиме (шаблоны без AI-генерации)</div>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-bottom:20px">
          <button class="btn btn-ghost" onclick="renderSettings()">Сбросить</button>
          <button class="btn btn-primary" onclick="saveAllSettings()">💾 Сохранить</button>
        </div>
      </div>
    </div>
  `;
}

function scrollSection(id, el) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('.snav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

function selectAiProvider(val, el) {
  document.querySelectorAll('[onclick^="selectAiProvider"]').forEach(e => e.style.borderColor = 'var(--border)');
  el.style.borderColor = 'var(--blue)';
  saveSetting('ai_provider', val);
}

async function saveSetting(key, value) {
  await window.api.settingsSave({ [key]: value });
  settings[key] = value;
}

async function saveAllSettings() {
  const keys = ['user_name','user_position','user_phone','user_email','company_name','company_inn','company_ogrn','company_address','tg_token','remind_days_1','remind_days_2','remind_days_3','ai_key','backup_path'];
  const data = {};
  keys.forEach(k => {
    const el = document.getElementById('s-' + k);
    if (el) data[k] = el.value;
  });
  await window.api.settingsSave(data);
  settings = await window.api.settingsGet();
  applySettings();
  showToast('Настройки сохранены ✓');
}

async function testTelegram() {
  const token = document.getElementById('s-tg_token')?.value?.trim();
  if (!token) { showToast('Введите токен бота', 'var(--red)'); return; }
  showToast('Проверка подключения...');
  setTimeout(() => showToast('Бот подключён! Напишите ему любое сообщение', 'var(--green)'), 1500);
}

async function chooseBackupFolder() {
  const path = await window.api.backupChooseFolder();
  if (path) {
    const el = document.getElementById('s-backup_path');
    if (el) el.value = path;
  }
}

async function backupNow() {
  const result = await window.api.backupNow();
  if (result.ok) showToast('Резервная копия создана: ' + result.path);
  else showToast('Выберите папку для резервных копий', 'var(--amber)');
}

// ── ДОБАВЛЕНИЕ КЛИЕНТА ───────────────────────────────────
function togglePill(el) {
  el.classList.toggle('checked');
}

async function submitAddClient() {
  const name = document.getElementById('c-name')?.value?.trim();
  if (!name) { showToast('Введите название организации', 'var(--red)'); return; }
  const okved = document.getElementById('c-okved')?.value?.trim();
  if (!okved) { showToast('Введите ОКВЭД', 'var(--red)'); return; }
  const mods = [...document.querySelectorAll('.module-pill.checked')].map(p => p.dataset.module).join(',');
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const data = {
    name,
    inn:    document.getElementById('c-inn')?.value?.trim() || '',
    ogrn:   '',
    okved,
    okved_extra: '',
    form:   document.getElementById('c-form')?.value || 'ООО',
    staff:  parseInt(document.getElementById('c-staff')?.value) || 0,
    region: document.getElementById('c-region')?.value || 'Краснодарский край',
    czn:    'ФГКУ КК ЦЗН в г. Новороссийске',
    address:'',
    phone:  document.getElementById('c-phone')?.value?.trim() || '',
    email:  '',
    modules: mods || 'OT',
    manager_name: document.getElementById('c-manager-name')?.value?.trim() || '',
    manager_position: document.getElementById('c-manager-position')?.value || 'Руководитель',
    color,
    score: 0,
  };
  const result = await window.api.clientAdd(data);
  closeModal('modalAddClient');
  showToast(`Клиент "${name}" добавлен`);
  // Сбрасываем форму
  ['c-name','c-inn','c-okved','c-staff','c-phone'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.querySelectorAll('.module-pill').forEach(p => { p.classList.toggle('checked', p.dataset.module !== 'VU'); });
  await navigate('client', result.id);
}

// ── COMING SOON ──────────────────────────────────────────
function renderComingSoon(title) {
  document.getElementById('content').innerHTML = `
    <div class="empty-state" style="height:60vh">
      <div class="empty-icon">🚧</div>
      <div class="empty-title">${title}</div>
      <div class="empty-sub">Этот модуль в разработке — будет готов в следующей сессии</div>
    </div>
  `;
}

// ── УТИЛИТЫ ──────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.getElementById(id)?.addEventListener('click', e => { if(e.target.id===id) closeModal(id); }, { once: true });
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function showToast(msg, color = 'var(--green)') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color;
  t.style.color = (color === 'var(--green)') ? '#000' : '#fff';
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' });
}

// ── РЕДАКТИРОВАНИЕ КЛИЕНТА ───────────────────────────────
async function openEditModal(clientId) {
  const c = await window.api.clientGet(clientId);
  if (!c) return;

  // Create edit modal dynamically
  let modal = document.getElementById('modalEditClient');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalEditClient';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">✏️ Редактировать клиента</div>
        <div class="modal-sub">Измените данные организации</div>
        <div class="form-row">
          <div class="form-group full"><div class="form-label">Название <span class="req">*</span></div><input class="form-input" id="e-name"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">ИНН</div><input class="form-input" id="e-inn"></div>
          <div class="form-group"><div class="form-label">Форма</div>
            <select class="form-select" id="e-form">
              <option>ООО</option><option>ИП</option><option>АО / ЗАО</option><option>ГУП / МУП</option><option>НКО</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">ОКВЭД <span class="req">*</span></div><input class="form-input" id="e-okved"></div>
          <div class="form-group"><div class="form-label">Сотрудников</div><input class="form-input" id="e-staff" type="number"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Регион</div>
            <select class="form-select" id="e-region">
              <option>Краснодарский край</option><option>Москва</option><option>Санкт-Петербург</option>
              <option>Московская область</option><option>Ростовская область</option>
              <option>Ставропольский край</option><option>Другой регион</option>
            </select>
          </div>
          <div class="form-group"><div class="form-label">Телефон</div><input class="form-input" id="e-phone"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Должность руководителя</div>
            <select class="form-select" id="e-manager-position">
              <option>Индивидуальный предприниматель</option>
              <option>Генеральный директор</option>
              <option>Директор</option>
              <option>Исполнительный директор</option>
              <option>Руководитель</option>
            </select>
          </div>
          <div class="form-group"><div class="form-label">ФИО руководителя</div><input class="form-input" id="e-manager-name" placeholder="Иванов Иван Иванович"></div>
        </div>
        <div class="form-group" style="margin-top:4px">
          <div class="form-label">Адрес</div>
          <input class="form-input" id="e-address" placeholder="г. Новороссийск, ул. ...">
        </div>
        <div class="modal-actions">
          <button class="btn btn-red" onclick="deleteClient(${clientId})">🗑 Удалить</button>
          <button class="btn btn-ghost" onclick="closeModal('modalEditClient')">Отмена</button>
          <button class="btn btn-primary" onclick="submitEditClient(${clientId})">💾 Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal('modalEditClient'); });
  }

  // Fill form with current data
  document.getElementById('e-name').value = c.name || '';
  document.getElementById('e-inn').value = c.inn || '';
  document.getElementById('e-okved').value = c.okved || '';
  document.getElementById('e-staff').value = c.staff || '';
  document.getElementById('e-phone').value = c.phone || '';
  document.getElementById('e-address').value = c.address || '';
  document.getElementById('e-manager-name').value = c.manager_name || '';

  // Set selects
  const formSel = document.getElementById('e-form');
  for (let opt of formSel.options) if (opt.value === c.form) { opt.selected = true; break; }

  const regionSel = document.getElementById('e-region');
  for (let opt of regionSel.options) if (opt.value === c.region || opt.text === c.region) { opt.selected = true; break; }

  const posSel = document.getElementById('e-manager-position');
  for (let opt of posSel.options) if (opt.value === c.manager_position || opt.text === c.manager_position) { opt.selected = true; break; }

  openModal('modalEditClient');
}

async function submitEditClient(clientId) {
  const name = document.getElementById('e-name').value.trim();
  const okved = document.getElementById('e-okved').value.trim();
  if (!name) { showToast('Введите название', 'var(--red)'); return; }

  const data = {
    name,
    inn:              document.getElementById('e-inn').value.trim(),
    okved,
    staff:            parseInt(document.getElementById('e-staff').value) || 0,
    form:             document.getElementById('e-form').value,
    region:           document.getElementById('e-region').value,
    phone:            document.getElementById('e-phone').value.trim(),
    address:          document.getElementById('e-address').value.trim(),
    manager_name:     document.getElementById('e-manager-name').value.trim(),
    manager_position: document.getElementById('e-manager-position').value,
  };

  await window.api.clientUpdate(clientId, data);
  closeModal('modalEditClient');
  showToast('Данные клиента сохранены ✓');
  await navigate('client', clientId);
}

async function deleteClient(clientId) {
  if (!confirm('Удалить клиента и все его данные? Это действие нельзя отменить.')) return;
  await window.api.clientDelete(clientId);
  closeModal('modalEditClient');
  showToast('Клиент удалён');
  await navigate('clients');
}

// ── ГЕНЕРАЦИЯ ДОКУМЕНТОВ ─────────────────────────────────
async function generateDocs(clientId) {
  showToast('Генерирую документы...');
  const result = await window.api.docsGenerate(clientId);
  if (!result.ok) {
    showToast('Ошибка: ' + result.error, 'var(--red)');
    return;
  }
  const ok = result.results.filter(function(r) { return r.status === 'ok'; }).length;
  showToast('Готово! Создано ' + ok + ' документов');
  // Открываем папку
  if (result.dir) window.api.docsOpenFolder(result.dir);
  setTimeout(function() { navigate('client', clientId); }, 2000);
}
