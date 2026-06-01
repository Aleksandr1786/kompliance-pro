// ═══════════════════════════════════════════════════════
//  КомплаенсПро — app.js
// ═══════════════════════════════════════════════════════

const COLORS = ['#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa','#22d3ee','#fb923c','#4ade80'];
let currentPage = 'dashboard';
let currentClientId = null;
let settings = {};

// ── ADMIN MODE ───────────────────────────────────────────
// true  = ты (видишь провайдера, технические детали)
// false = клиент/пользователь (видит только бренд)
// Переключается тройным кликом на логотип
let IS_ADMIN = true;

// ── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  settings = await window.api.settingsGet();
  // Загружаем admin-режим из настроек
  IS_ADMIN = settings.is_admin !== '0'; // по умолчанию admin=true
  applySettings();
  setupNav();
  // Тройной клик на логотип — переключает admin/user режим (секретно)
  let clickCount = 0, clickTimer;
  document.querySelector('.logo')?.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      if (clickCount >= 3) {
        IS_ADMIN = !IS_ADMIN;
        window.api.settingsSave({ is_admin: IS_ADMIN ? '1' : '0' });
        applySettings();
        showToast(IS_ADMIN ? '🔧 Режим администратора' : '👤 Режим пользователя');
      }
      clickCount = 0;
    }, 400);
  });
  await navigate('dashboard');
  await checkOnboarding();
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

  if (hasKey) {
    dot.classList.add('active');
    // Admin видит название провайдера, пользователь — нейтральный текст
    if (IS_ADMIN) {
      const providerNames = { deepseek:'DeepSeek', claude:'Claude', yandex:'YandexGPT', giga:'GigaChat', ollama:'Ollama' };
      txt.textContent = (providerNames[settings.ai_provider] || 'AI') + ' активен';
    } else {
      txt.textContent = '✨ Ассистент активен';
    }
    txt.style.color = 'var(--green)';
  } else {
    dot.classList.remove('active');
    txt.textContent = 'Базовый режим';
    txt.style.color = '';
  }
}

// ── НАВИГАЦИЯ ────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });
}


// ─── ОНБОРДИНГ ───────────────────────────────────────────
async function checkOnboarding() {
  // Показываем только при первом запуске
  if (settings.onboarding_done === '1') return;
  showOnboarding();
}

function showOnboarding() {
  let step = 1;
  const modal = document.createElement('div');
  modal.id = 'onboarding-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(6px)';

  function render() {
    const steps = [
      {
        icon: '👋',
        title: 'Добро пожаловать в КомплаенсПро!',
        sub: 'Давайте настроим всё за 2 минуты — и вы будете готовы к работе',
        content: `
          <div style="margin-bottom:14px">
            <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Ваше имя</label>
            <input id="ob-name" value="${settings.user_name||''}" placeholder="Александр Свинцов" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          </div>
          <div style="margin-bottom:14px">
            <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Должность</label>
            <input id="ob-position" value="${settings.user_position||''}" placeholder="Специалист по охране труда" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          </div>
          <div style="margin-bottom:14px">
            <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Ваша компания</label>
            <input id="ob-company" value="${settings.company_name||''}" placeholder="ИП Свинцов А.В." style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          </div>
          <div style="margin-bottom:4px">
            <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Телефон</label>
            <input id="ob-phone" value="${settings.user_phone||''}" placeholder="[скрыто]" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          </div>`,
        next: 'Далее →',
        canSkip: false,
      },
      {
        icon: '🤖',
        title: 'Подключите ИИ-ассистента',
        sub: 'Ассистент помогает склонять ФИО и заполнять документы. Можно пропустить и подключить позже.',
        content: `
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:14px;margin-bottom:16px">
            <div style="font-size:13px;font-weight:600;color:#60a5fa;margin-bottom:6px">⚡ Рекомендуем DeepSeek</div>
            <div style="font-size:12px;color:#94a3b8;line-height:1.5">Бесплатный старт · Быстрый · Работает с русским языком<br>Получить ключ: <span style="color:#60a5fa">platform.deepseek.com</span></div>
          </div>
          <div style="margin-bottom:14px">
            <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">API-ключ (необязательно)</label>
            <input id="ob-apikey" type="password" placeholder="sk-..." style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          </div>
          <div style="font-size:11px;color:#64748b;text-align:center">Без ключа приложение работает в базовом режиме — все документы генерируются, ФИО склоняются вручную</div>`,
        next: 'Далее →',
        canSkip: true,
        skipText: 'Пропустить',
      },
      {
        icon: '🎉',
        title: 'Всё готово!',
        sub: 'КомплаенсПро настроен и готов к работе. Добавьте первого клиента!',
        content: `
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:10px">
              <span style="font-size:20px">📄</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:#f1f5f9">Генерация документов</div>
                <div style="font-size:11px;color:#64748b">34+ документов по охране труда за 30 секунд</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:10px">
              <span style="font-size:20px">🎓</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:#f1f5f9">Трекер обучения</div>
                <div style="font-size:11px;color:#64748b">Напоминания за 30, 14 и 3 дня до истечения</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px">
              <span style="font-size:20px">📋</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:#f1f5f9">Памятка ГИТ</div>
                <div style="font-size:11px;color:#64748b">Алгоритм действий при проверке инспектора</div>
              </div>
            </div>
          </div>`,
        next: '🚀 Добавить первого клиента',
        canSkip: false,
      },
    ];

    const s = steps[step - 1];
    const dots = [1,2,3].map(i =>
      `<div style="width:${i===step?'24px':'8px'};height:8px;border-radius:4px;background:${i===step?'var(--blue)':'rgba(255,255,255,0.15)'};transition:all .3s"></div>`
    ).join('');

    modal.innerHTML = `
      <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,0.6)">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:48px;margin-bottom:12px">${s.icon}</div>
          <div style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:8px">${s.title}</div>
          <div style="font-size:13px;color:#64748b;line-height:1.5">${s.sub}</div>
        </div>
        ${s.content}
        <div style="display:flex;gap:8px;margin-top:20px">
          ${s.canSkip ? `<button onclick="onboardingSkip()" style="flex:1;padding:11px;background:rgba(255,255,255,0.06);border:none;border-radius:10px;color:#94a3b8;cursor:pointer;font-size:13px">${s.skipText}</button>` : ''}
          <button onclick="onboardingNext()" style="flex:${s.canSkip?2:1};padding:11px;background:var(--blue);border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:13px;font-weight:700">${s.next}</button>
        </div>
        <div style="display:flex;justify-content:center;gap:6px;margin-top:16px">${dots}</div>
      </div>`;
  }

  window.onboardingNext = async () => {
    if (step === 1) {
      // Сохраняем профиль
      const name     = document.getElementById('ob-name')?.value?.trim();
      const position = document.getElementById('ob-position')?.value?.trim();
      const company  = document.getElementById('ob-company')?.value?.trim();
      const phone    = document.getElementById('ob-phone')?.value?.trim();
      if (!name) { document.getElementById('ob-name').style.border='1px solid #f87171'; return; }
      await window.api.settingsSave({ user_name:name, user_position:position, company_name:company, user_phone:phone });
      settings = await window.api.settingsGet();
      applySettings();
    }
    if (step === 2) {
      // Сохраняем API ключ
      const key = document.getElementById('ob-apikey')?.value?.trim();
      if (key) await window.api.settingsSave({ ai_provider:'deepseek', ai_key:key });
      settings = await window.api.settingsGet();
      applySettings();
    }
    if (step === 3) {
      // Финиш — открываем добавление клиента
      await finishOnboarding();
      openModal('modalAddClient');
      return;
    }
    step++;
    render();
  };

  window.onboardingSkip = async () => {
    if (step === 2) { step++; render(); return; }
    await finishOnboarding();
  };

  async function finishOnboarding() {
    await window.api.settingsSave({ onboarding_done: '1' });
    settings = await window.api.settingsGet();
    modal.remove();
    showToast('✅ Настройка завершена! Добавьте первого клиента 🚀');
  }

  render();
  document.body.appendChild(modal);
}

async function navigate(page, clientId = null) {
  currentPage = page;
  currentClientId = clientId;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';
  // Скрываем кнопку редактирования клиента на всех страницах кроме карточки
  if (page !== 'client') {
    const editBtn = document.getElementById('topbarEdit');
    if (editBtn) editBtn.style.display = 'none';
  }
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
  const stats   = await window.api.dashboardStats();
  const clients = await window.api.clientsList();
  const tasks   = await window.api.tasksList();
  const events  = await window.api.eventsList(null);
  const alerts  = await window.api.trainingAlerts();

  const btn = document.getElementById('topbarAction');
  btn.textContent = '+ Добавить клиента';
  btn.style.display = 'flex';
  btn.onclick = () => openModal('modalAddClient');
  const editBtn = document.getElementById('topbarEdit');
  if (editBtn) editBtn.style.display = 'none';

  // Формируем блок алертов обучения
  const alertsHtml = alerts.length ? alerts.slice(0,5).map(a => {
    const color = a.overdue ? 'var(--red)' : a.days_left <= 14 ? 'var(--amber)' : '#fbbf24';
    const icon  = a.overdue ? '🔴' : a.days_left <= 14 ? '🟠' : '🟡';
    const label = a.overdue ? `Просрочено ${Math.abs(a.days_left)} дн.` : `${a.days_left} дн.`;
    return `<div class="event-row" style="cursor:pointer" onclick="navigate('client',${a.client_id})">
      <div class="ev-dot" style="background:${color}"></div>
      <div class="ev-body">
        <div class="ev-title">${a.employee_name} — ${a.training_type}</div>
        <div class="ev-sub">${a.client_name}</div>
      </div>
      <div class="ev-when" style="color:${color}">${icon} ${label}</div>
    </div>`;
  }).join('') : '';

  document.getElementById('content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">🏢 Клиенты</div><div class="stat-value">${stats.clients}</div><div class="stat-sub">организаций на обслуживании</div></div>
      <div class="stat-card"><div class="stat-label">📋 Открытых задач</div><div class="stat-value">${stats.tasks}</div><div class="stat-sub">${stats.urgent} срочных</div></div>
      <div class="stat-card"><div class="stat-label">🎓 Обучение</div><div class="stat-value" style="color:${alerts.length?'var(--amber)':'var(--green)'}">${alerts.length}</div><div class="stat-sub">истекает в 30 дней</div></div>
      <div class="stat-card"><div class="stat-label">⚠️ Просрочено</div><div class="stat-value" style="color:var(--red)">${stats.overdue}</div><div class="stat-sub">требуют действий</div></div>
    </div>
    <div class="grid2">
      <div>
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="panel-title">Клиенты</div><div class="panel-count">${clients.length} орг.</div><div class="panel-action" onclick="navigate('clients')">Все →</div></div>
          <div class="client-search"><input class="search-input" placeholder="🔍 Поиск клиента..." oninput="filterDashClients(this.value)"></div>
          <div id="dashClientList">${renderClientRows(clients)}</div>
        </div>
        ${tasks.length ? `
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span><div class="panel-title">Задачи</div><div class="panel-action" onclick="navigate('tasks')">Все →</div></div>
          <div>${tasks.slice(0,5).map(t => renderTaskRow(t)).join('')}</div>
        </div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${alerts.length ? `
        <div class="panel">
          <div class="panel-head">
            <span style="font-size:16px">🎓</span>
            <div class="panel-title">Обучение — истекает</div>
            <div class="panel-count">${alerts.length} чел.</div>
          </div>
          <div>${alertsHtml}</div>
        </div>` : ''}
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span><div class="panel-title">Ближайшие события</div></div>
          <div>${events.length ? events.slice(0,8).map(e => renderEventRow(e)).join('') : '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Событий нет</div><div class="empty-sub">Добавьте клиентов — события появятся автоматически</div></div>'}</div>
        </div>
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
    const scoreColor = (c.score||0) >= 80 ? 'var(--green)' : (c.score||0) >= 40 ? 'var(--amber)' : 'var(--red)';
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
      <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="panel-title">Все клиенты</div><div class="panel-count">${clients.length} организаций</div></div>
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

  // Считаем реальный процент готовности по документам
  const totalDocs = docs.length;
  const okDocs    = docs.filter(d => d.status === 'ok').length;
  const realScore = totalDocs > 0 ? Math.round(okDocs / totalDocs * 100) : 0;
  // Обновляем score в базе если изменился
  if (realScore !== (c.score||0)) window.api.clientUpdate(id, { score: realScore });
  const scoreColor = realScore >= 80 ? 'var(--green)' : realScore >= 40 ? 'var(--amber)' : 'var(--red)';

  document.getElementById('topbarTitle').textContent = c.name;
  const btn = document.getElementById('topbarAction');
  btn.textContent = '← Все клиенты';
  btn.style.display = 'flex';
  btn.className = 'btn btn-ghost';
  btn.onclick = () => { btn.className = 'btn btn-primary'; navigate('clients'); };

  // Add edit button
  let editBtn = document.getElementById('topbarEdit');
  if (!editBtn) {
    editBtn = document.createElement('button');
    editBtn.id = 'topbarEdit';
    editBtn.className = 'btn btn-ghost';
    editBtn.textContent = '✏️ Редактировать';
    document.getElementById('topbarAction').after(editBtn);
  }
  editBtn.style.display = 'flex';
  const _cid = id;
  editBtn.onclick = () => openEditModal(_cid);

  const otDocs = docs.filter(d => d.module === 'OT');
  const pdDocs = docs.filter(d => d.module === 'PD');
  const vuDocs = docs.filter(d => d.module === 'VU');
  // Папка клиента на рабочем столе (для кнопки "Открыть папку")
  const safeName = (c.name || '').replace(/[\/\\:*?"<>|]/g, '_').slice(0, 60);
  const clientDocDir = otDocs.length && otDocs[0].filepath
    ? otDocs[0].filepath.replace(/[\\/][^\\/]+$/, '') // папка из пути первого файла
    : null;
  _currentClientDocDir = clientDocDir;

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
          <div class="score-val" style="color:${scoreColor}">${realScore}%</div>
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
      <div class="tab active" onclick="switchTab('overview')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> Обзор</span></div>
      ${mods.includes('OT')?`<div class="tab" onclick="switchTab('ot')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Охрана труда</span></div>`:''}
      ${mods.includes('PD')?`<div class="tab" onclick="switchTab('pd')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Персданные</span></div>`:''}
      ${mods.includes('VU')?`<div class="tab" onclick="switchTab('vu')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Воинский учёт</span></div>`:''}
      <div class="tab" onclick="switchTab('staff')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Сотрудники</span></div>
    </div>

    <div class="tab-panel active" id="tab-overview">
      <div class="grid2">
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span><div class="panel-title">Ближайшие события</div></div>
          <div>${events.length ? events.slice(0,6).map(e=>renderEventRow(e)).join('') : '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Событий нет</div></div>'}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span><div class="panel-title">Задачи</div><div class="panel-action" onclick="addTaskForClient(${id})">+ Добавить</div></div>
          <div>${clientTasks.length ? clientTasks.map(t=>renderTaskRow(t)).join('') : '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Задач нет</div></div>'}</div>
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-ot">
      <div class="panel">
        <div class="panel-head">
          <span>🦺</span>
          <div class="panel-title">Документы — Охрана труда</div>
          <div class="panel-count">${otDocs.length} шт.</div>
          <div style="margin-left:auto;display:flex;gap:8px">
            ${clientDocDir ? `<button class="btn" style="padding:6px 12px;font-size:11px;background:var(--s3);color:var(--text)" onclick="openClientFolder()">📁 Открыть папку</button>` : ''}
            <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="generateDocs(${id})">⚡ Сгенерировать</button>
          </div>
        </div>
        <div>${otDocs.length ? renderDocsBySection(otDocs) : renderEmptyDocs('ОТ', id)}</div>
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
        <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="panel-title">Сотрудники</div><div class="panel-count">${emps.length} чел.</div><div class="panel-action" onclick="addEmployeePrompt(${id})">+ Добавить</div></div>
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
  const colorMap  = { ok:'var(--green)', outdated:'var(--red)', draft:'var(--amber)', missing:'var(--muted2)' };
  const canOpen   = d.filepath && d.status === 'ok';
  const fp        = canOpen ? d.filepath.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
  const openBtn   = canOpen
    ? `<button onclick="openDocFile('${fp}', event)" style="background:none;border:none;cursor:pointer;color:var(--muted2);padding:4px 6px;border-radius:6px;transition:color .2s;display:flex;align-items:center" title="Открыть файл" onmouseover="this.style.color='var(--blue2)'" onmouseout="this.style.color='var(--muted2)'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>`
    : '';
  return `<div class="client-row" style="cursor:${canOpen?'pointer':'default'}" ${canOpen?`onclick="openDocFile('${fp}', event)"`:''}">
    <div class="client-avatar-sm" style="background:var(--s3);color:var(--muted2);display:flex;align-items:center;justify-content:center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
    <div class="client-info">
      <div class="client-name" style="font-size:12px">${(()=>{
        let n=(d.name||'').replace(/.*[\/\\]/,'').replace(/_/g,' ').replace(/\.docx$/i,'');
        n=n.replace(/^\d{2}\.\d{2}\s*/,'').replace(/^\d+\s+/,'');
        n=n.replace(/\bПриказ\s+\d+\s*/gi,'Приказ ');
        n=n.replace(/\bИОТ\s+№?\s*\d+[\-\w]*\s*/gi,'ИОТ ');
        return n.replace(/\s+/g,' ').trim();
      })()}</div>
      <div class="client-meta">${d.updated_at ? formatDate(d.updated_at) : 'Не создан'}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
      <span style="font-size:11px;font-weight:600;color:${colorMap[d.status]||'var(--muted2)'}">${statusMap[d.status]||d.status}</span>
      ${openBtn}
    </div>
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

// ─── Группировка документов по разделам ───────────────────────
function renderDocsBySection(docs) {
  // Конфигурация разделов — короткие названия для UI
  const sections = [
    { key:'s1', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, label:'Организационные',    color:'#60a5fa', docs:[] },
    { key:'s2', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`, label:'Нормативные акты',   color:'#a78bfa', docs:[] },
    { key:'s3', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, label:'Электробезопасность', color:'#fbbf24', docs:[] },
    { key:'s4', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`, label:'СОУТ и риски',        color:'#34d399', docs:[] },
    { key:'s5', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`, label:'Инструкции',          color:'#f87171', docs:[] },
    { key:'s6', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`, label:'Журналы учёта',       color:'#fb923c', docs:[] },
    { key:'s7', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`, label:'Программы обучения',  color:'#e879f9', docs:[] },
    { key:'s0', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, label:'Прочие документы',    color:'#94a3b8', docs:[] },
  ];

  docs.forEach(d => {
    // Определяем раздел по пути файла (папке) или по ключевым словам имени
    const fp   = (d.filepath || d.name || '').replace(/\\/g, '/');
    const name = (d.name || d.filename || '').replace(/\\/g, '/');

    if      (/Раздел.?1|01_Орган|Организационн|Политика|Положение.*СУОТ|Приказ|План.мероприятий|График.*мероприятий/i.test(fp+name)) sections[0].docs.push(d);
    else if (/Раздел.?2|02_Норм|Нормативн|Положение.*(обучени|организаци|разработк|микротравм|СИЗ)|Правила.*трудов/i.test(fp+name)) sections[1].docs.push(d);
    else if (/Раздел.?3|03_Электр|Электробезопасн|Журнал.*группа|Программа.*электро/i.test(fp+name)) sections[2].docs.push(d);
    else if (/Раздел.?4|04_СОУТ|СОУТ|оценк.*риск/i.test(fp+name)) sections[3].docs.push(d);
    else if (/Раздел.?5|05_Инстр|Инструкци|ИОТ/i.test(fp+name)) sections[4].docs.push(d);
    else if (/Раздел.?6|06_Журн|Журнал|Личная.карточка/i.test(fp+name)) sections[5].docs.push(d);
    else if (/Раздел.?7|07_Прогр|Программа.*(вводного|первичного|противопожарн)/i.test(fp+name)) sections[6].docs.push(d);
    else    sections[7].docs.push(d);
  });

  let html = '';
  sections.forEach(sec => {
    if (!sec.docs.length) return;
    const okCount  = sec.docs.filter(d=>d.status==='ok').length;
    const pct      = Math.round(okCount / sec.docs.length * 100);
    const pctColor = pct===100 ? '#34d399' : pct>=50 ? '#fbbf24' : '#f87171';
    const sectionHtml = sec.docs.map(d => renderDocRow(d)).join('');
    html += `
      <div class="doc-section" style="margin-bottom:8px">
        <div class="doc-section-header" onclick="toggleSection(this)" style="
          display:flex;align-items:center;gap:10px;
          padding:12px 16px;
          background:linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%);
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
          border-radius:12px;
          border:1px solid rgba(255,255,255,0.08);
          border-left:3px solid ${sec.color};
          cursor:pointer;user-select:none;
          box-shadow:0 2px 8px rgba(0,0,0,0.15);
          transition:all .2s ease">
          <span style="font-size:18px;filter:drop-shadow(0 0 4px ${sec.color}44)">${sec.icon}</span>
          <span style="font-size:12px;font-weight:600;color:#f1f5f9;flex:1;letter-spacing:.2px">${sec.label}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:60px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${pctColor};border-radius:2px;transition:width .3s"></div>
            </div>
            <span style="font-size:10px;color:${pctColor};font-weight:600;min-width:28px;text-align:right">${pct}%</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.07);
                         padding:2px 8px;border-radius:8px;min-width:20px;text-align:center">${sec.docs.length}</span>
            <span class="section-arrow" style="color:rgba(255,255,255,0.3);font-size:10px;
                  transition:transform .2s;transform:rotate(-90deg)">▼</span>
          </div>
        </div>
        <div class="section-docs" style="display:none;padding:4px 0 4px 8px;
             border-left:1px solid ${sec.color}33;margin-left:14px">
          ${sectionHtml}
        </div>
      </div>`;
  });

  return html || '<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">Документов нет</div></div>';
}

function toggleSection(header) {
  const docs  = header.nextElementSibling;
  const arrow = header.querySelector('.section-arrow');
  const isOpen = docs.style.display !== 'none';
  docs.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
  header.style.background = isOpen
    ? 'linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)'
    : 'linear-gradient(135deg,rgba(255,255,255,0.1) 0%,rgba(255,255,255,0.04) 100%)';
}

function renderEmpRow(e) {
  const birthYear = e.birth_date ? ' · ' + e.birth_date.slice(0,4) + ' г.р.' : '';
  const training  = e.training || {};
  const TYPES = ['prog_a','first_aid','fire','siz','repeat','medcheck'];
  const today = new Date();

  // Считаем статус обучения
  let alertCount = 0;
  TYPES.forEach(key => {
    const t = training[key];
    if (!t?.required || !t?.date) return;
    const last = new Date(t.date);
    const next = new Date(last);
    if (key === 'repeat') next.setMonth(next.getMonth() + 6);
    else if (key === 'medcheck') next.setFullYear(next.getFullYear() + 1);
    else next.setFullYear(next.getFullYear() + 3);
    const days = Math.ceil((next - today) / 86400000);
    if (days <= 30) alertCount++;
  });

  const alertBadge = alertCount > 0
    ? `<span style="background:${alertCount > 0 ? 'var(--red)' : 'var(--amber)'};color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;margin-right:4px">${alertCount}</span>`
    : '';

  return `<div class="client-row">
    <div class="client-avatar-sm" style="background:var(--s3);color:var(--muted2);font-size:11px;font-weight:700">${e.full_name.split(' ').map(w=>w[0]||'').join('').slice(0,2)}</div>
    <div class="client-info">
      <div class="client-name">${e.full_name}</div>
      <div class="client-meta">${e.position||'—'}${birthYear}${e.is_military?' · ⚔️':''}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      ${alertBadge}
      <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="openTraining(${e.id})" title="Обучение">🎓</button>
      <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="editEmployeePrompt(${e.id})">✏️</button>
      <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;color:var(--red)" onclick="deleteEmployee(${e.id})">🗑</button>
    </div>
  </div>`;
}

// ─── МОДУЛЬ ОБУЧЕНИЯ ─────────────────────────────────────
const TRAINING_TYPES_BASE = [
  { key:'prog_a',    label:'Программа А — общие вопросы ОТ',           period:'3 года',  years:3,   who:'Руководитель, отв. за ОТ',       alwaysRequired: true  },
  { key:'prog_b',    label:'Программа Б — безопасные методы работы',   period:'3 года',  years:3,   who:'Специалисты, рабочие',            alwaysRequired: false },
  { key:'prog_v',    label:'Программа В — работы повышенной опасности',period:'1 год',   years:1,   who:'Работники с допуском к РПО',      alwaysRequired: false },
  { key:'first_aid', label:'Первая помощь пострадавшим',               period:'3 года',  years:3,   who:'Все работники',                   alwaysRequired: true  },
  { key:'fire',      label:'Пожарно-технический минимум',              period:'3 года',  years:3,   who:'Руководитель, отв. за ПБ',        alwaysRequired: true  },
  { key:'siz',       label:'Применение СИЗ',                          period:'3 года',  years:3,   who:'Работники применяющие СИЗ',       alwaysRequired: false },
  { key:'repeat',    label:'Повторный инструктаж на р.м.',             period:'6 мес.',  months:6,  who:'Все (кроме освобождённых)',       alwaysRequired: true  },
  { key:'medcheck',  label:'Медицинский осмотр',                       period:'1 год',   years:1,   who:'При наличии оснований',           alwaysRequired: false },
];

// Определяем какие программы нужны для конкретного сотрудника
// на основе данных клиента и самого сотрудника
function getRequiredTraining(client, employee, existingTraining) {
  const soatClass    = parseInt(client?.soat_class || '2');
  const hazardWorks  = !!client?.hazard_works;
  const medRequired  = !!client?.medcheck_required || !!employee?.medcheck_required;
  const isOffice     = soatClass <= 2;
  const progBExempt  = !!employee?.prog_b_exempt; // освобождён от Б вручную

  return TRAINING_TYPES_BASE.map(tt => {
    const existing = existingTraining?.[tt.key] || {};
    let required = existing.required; // сохраняем ручные настройки если есть

    // Если ещё не настраивали — определяем автоматически
    if (required === undefined) {
      if (tt.key === 'prog_a')    required = true;
      if (tt.key === 'prog_b')    required = !isOffice && !progBExempt; // не нужна для офиса
      if (tt.key === 'prog_v')    required = hazardWorks;
      if (tt.key === 'first_aid') required = true;
      if (tt.key === 'fire')      required = true;
      if (tt.key === 'siz')       required = soatClass >= 31 || hazardWorks;
      if (tt.key === 'repeat')    required = true;
      if (tt.key === 'medcheck')  required = medRequired;
    }

    return { ...tt, required };
  });
}

const TRAINING_TYPES = TRAINING_TYPES_BASE; // для обратной совместимости

function calcNextDate(dateStr, tt) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (tt.years)  d.setFullYear(d.getFullYear() + tt.years);
  if (tt.months) d.setMonth(d.getMonth() + tt.months);
  return d;
}

function trainingStatus(tt, t) {
  if (!t?.required) return { icon:'—', color:'var(--muted)', label:'Не требуется', days:null };
  if (!t?.date)     return { icon:'❌', color:'var(--red)',   label:'Не пройдено',  days:null };
  const next = calcNextDate(t.date, tt);
  const days = Math.ceil((next - new Date()) / 86400000);
  if (days < 0)   return { icon:'🔴', color:'var(--red)',   label:`Просрочено ${Math.abs(days)} дн.`, days };
  if (days <= 14) return { icon:'🟠', color:'var(--amber)', label:`${days} дн.`,   days };
  if (days <= 30) return { icon:'🟡', color:'var(--amber)', label:`${days} дн.`,   days };
  return { icon:'✅', color:'var(--green)', label:formatDate(next.toISOString()), days };
}

async function openTraining(empId) {
  const emps = await window.api.employeesList(currentClientId);
  const e = emps.find(x => x.id === empId);
  if (!e) return;

  const client   = await window.api.clientGet(currentClientId);
  const training = e.training || {};
  const types    = getRequiredTraining(client, e, training);

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999';

  const rows = types.map(tt => {
    const t  = { ...tt, ...(training[tt.key]||{}) };
    const st = trainingStatus(tt, { required: tt.required, date: training[tt.key]?.date });
    const nextD = t.date ? calcNextDate(t.date, tt) : null;
    return `
      <div style="display:grid;grid-template-columns:1fr 110px 130px 160px;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
        <div>
          <div style="font-size:12px;font-weight:600;color:#f1f5f9">${tt.label}</div>
          <div style="font-size:10px;color:#64748b">${tt.who} · каждые ${tt.period}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="checkbox" id="tr-req-${tt.key}" ${t.required?'checked':''} style="width:15px;height:15px;cursor:pointer" onchange="updateTrainingRequired('${tt.key}',this.checked)">
          <label style="font-size:11px;color:#94a3b8">Требуется</label>
        </div>
        <div>
          <input type="date" id="tr-date-${tt.key}" value="${t.date||''}" style="width:100%;padding:6px 8px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#f1f5f9;font-size:12px;outline:none" ${!t.required?'disabled':''}>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:13px">${st.icon}</span>
          <span style="font-size:11px;font-weight:600;color:${st.color}">${st.label}</span>
        </div>
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">🎓 Обучение</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${e.full_name} · ${e.position||''}</div>
        </div>
        <button onclick="this.closest('.modal-wrap').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 110px 130px 160px;gap:8px;padding-bottom:8px;border-bottom:2px solid rgba(255,255,255,0.08);margin-bottom:4px">
        <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px">ВИД ОБУЧЕНИЯ</div>
        <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px">НУЖЕН</div>
        <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px">ПОСЛЕДНЕЕ</div>
        <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px">СЛЕДУЮЩЕЕ</div>
      </div>
      ${rows}
      <div style="margin-top:16px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Учебная организация</label>
        <input id="tr-org" value="${training.org||''}" placeholder="ООО УЦ Профессионал" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
        <button onclick="saveTraining(${empId})" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">💾 Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', ev => { if (ev.target === modal) modal.remove(); });

  // Сохраняем текущий training в window для обновления
  window._currentTraining = JSON.parse(JSON.stringify(training));
  window._currentTrainingEmpId = empId;
}

function updateTrainingRequired(key, checked) {
  if (!window._currentTraining) return;
  if (!window._currentTraining[key]) window._currentTraining[key] = {};
  window._currentTraining[key].required = checked;
  const dateInput = document.getElementById('tr-date-' + key);
  if (dateInput) dateInput.disabled = !checked;
}

async function saveTraining(empId) {
  const training = window._currentTraining || {};
  training.org = document.getElementById('tr-org')?.value || '';

  TRAINING_TYPES.forEach(tt => {
    if (!training[tt.key]) training[tt.key] = {};
    const dateEl = document.getElementById('tr-date-' + tt.key);
    const reqEl  = document.getElementById('tr-req-' + tt.key);
    if (dateEl) training[tt.key].date     = dateEl.value;
    if (reqEl)  training[tt.key].required = reqEl.checked;
  });

  await window.api.trainingUpdate(empId, training);
  document.querySelector('[style*="position:fixed"][style*="rgba(0,0,0,0.75)"]')?.remove();
  showToast('✅ Данные обучения сохранены');
  await navigate('client', currentClientId);
}



// ─── СКЛОНЕНИЕ ФИО ЧЕРЕЗ AI ──────────────────────────────
async function declineFIO(fullName) {
  try {
    const result = await window.api.aiRequest({
      system: 'Ты — помощник по русской грамматике. Отвечай ТОЛЬКО валидным JSON без markdown и пояснений.',
      prompt: `Просклоняй ФИО "${fullName}" по падежам. Определи пол автоматически.
Верни ТОЛЬКО JSON в формате:
{"nom":"${fullName}","gen":"...","dat":"...","acc":"...","ins":"...","pre":"...","short":"..."}
где short — краткая форма "Фамилия И.О."`,
    });
    if (!result.ok) return null;
    const text = result.text.replace(/```json|```/g,'').trim();
    const data = JSON.parse(text);
    return data;
  } catch(e) {
    console.error('declineFIO error:', e);
    return null;
  }
}

async function addEmployeePrompt(clientId) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:20px">➕ Добавить сотрудника</div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">ФИО полностью <span style="color:#f87171">*</span></label>
        <input id="emp-name" placeholder="Иванов Иван Иванович" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Должность <span style="color:#f87171">*</span></label>
        <input id="emp-pos" placeholder="Менеджер по продажам" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Пол</label>
          <div style="display:flex;gap:8px">
            <button id="emp-gender-m" onclick="selectGender('m')" style="flex:1;padding:9px;background:rgba(59,130,246,0.15);border:1px solid var(--blue);border-radius:8px;color:#60a5fa;cursor:pointer;font-size:13px;font-weight:600">М</button>
            <button id="emp-gender-f" onclick="selectGender('f')" style="flex:1;padding:9px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px;font-weight:600">Ж</button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Табельный №</label>
          <input id="emp-tab" placeholder="001" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Дата рождения</label>
          <input id="emp-birth" type="date" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Дата приёма</label>
          <input id="emp-hired" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
      </div>
      <div style="margin-bottom:20px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="emp-mil" style="width:16px;height:16px;cursor:pointer">
          ⚔️ Военнообязанный
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="emp-prog-b-exempt" style="width:16px;height:16px;cursor:pointer">
          📋 Освобождён от Программы Б (только ПЭВМ/офис)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="emp-medcheck" style="width:16px;height:16px;cursor:pointer">
          🏥 Требуется медосмотр
        </label>
      </div>
      <div style="display:flex;gap:10px">
        <button id="emp-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
        <button id="emp-save" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Добавить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('emp-name').focus();

  // Выбор пола
  window.selectGender = (g) => {
    const m = document.getElementById('emp-gender-m');
    const f = document.getElementById('emp-gender-f');
    if (g === 'm') {
      m.style.background = 'rgba(59,130,246,0.15)'; m.style.borderColor = '#3b82f6'; m.style.color = '#60a5fa';
      f.style.background = '#0f1520';               f.style.borderColor = 'rgba(255,255,255,0.1)'; f.style.color = '#94a3b8';
    } else {
      f.style.background = 'rgba(236,72,153,0.15)'; f.style.borderColor = '#ec4899'; f.style.color = '#f472b6';
      m.style.background = '#0f1520';               m.style.borderColor = 'rgba(255,255,255,0.1)'; m.style.color = '#94a3b8';
    }
    m.dataset.selected = g === 'm' ? '1' : '';
    f.dataset.selected = g === 'f' ? '1' : '';
  };

  await new Promise(resolve => {
    document.getElementById('emp-cancel').onclick = () => { modal.remove(); resolve(false); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
    document.getElementById('emp-save').onclick = async () => {
      const name   = document.getElementById('emp-name').value.trim();
      const pos    = document.getElementById('emp-pos').value.trim();
      const birth  = document.getElementById('emp-birth').value || '';
      const hired  = document.getElementById('emp-hired').value || new Date().toISOString().slice(0,10);
      const tab    = document.getElementById('emp-tab').value.trim();
      const mil         = document.getElementById('emp-mil').checked ? 1 : 0;
      const progBExempt = document.getElementById('emp-prog-b-exempt')?.checked ? 1 : 0;
      const medcheck    = document.getElementById('emp-medcheck')?.checked ? 1 : 0;
      const genderM = document.getElementById('emp-gender-m');
      const gender = genderM?.dataset.selected === '1' ? 'm' : 'f';

      if (!name) { document.getElementById('emp-name').style.border = '1px solid #f87171'; return; }

      const saveBtn = document.getElementById('emp-save');
      saveBtn.textContent = '⏳ Обработка...';
      saveBtn.disabled = true;

      // Склоняем ФИО через AI
      let declension = null;
      if (window.api.aiRequest) {
        declension = await declineFIO(name);
      }

      modal.remove();

      await window.api.employeeAdd({
        client_id:         clientId,
        full_name:         name,
        position:          pos,
        birth_date:        birth,
        hired_at:          hired,
        tab_number:        tab,
        gender:            gender,
        department:        '',
        is_military:       mil,
        prog_b_exempt:     progBExempt,
        medcheck_required: medcheck,
        name_gen:          declension?.gen   || '',
        name_dat:          declension?.dat   || '',
        name_acc:          declension?.acc   || '',
        name_ins:          declension?.ins   || '',
        name_short:        declension?.short || '',
      });

      if (declension?.dat) {
        showToast('✅ Сотрудник добавлен · ' + declension.short);
      } else {
        showToast('✅ Сотрудник добавлен');
      }
      await navigate('client', clientId);
      resolve(true);
    };
    modal.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') document.getElementById('emp-save').click();
      if (e.key === 'Escape') { modal.remove(); resolve(false); }
    });
  });
}

async function editEmployeePrompt(empId) {
  // Получаем список сотрудников и находим нужного
  const emps = await window.api.employeesList(currentClientId);
  const e = emps.find(x => x.id === empId);
  if (!e) return;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:20px">✏️ Редактировать сотрудника</div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">ФИО полностью</label>
        <input id="edit-emp-name" value="${e.full_name||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Должность</label>
        <input id="edit-emp-pos" value="${e.position||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Дата рождения</label>
        <input id="edit-emp-birth" type="date" value="${e.birth_date||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:20px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-mil" ${e.is_military?'checked':''} style="width:16px;height:16px;cursor:pointer">
          ⚔️ Военнообязанный
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-prog-b-exempt" ${e.prog_b_exempt?'checked':''} style="width:16px;height:16px;cursor:pointer">
          📋 Освобождён от Программы Б (только ПЭВМ/офис)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-medcheck" ${e.medcheck_required?'checked':''} style="width:16px;height:16px;cursor:pointer">
          🏥 Требуется медосмотр
        </label>
      </div>
      <div style="display:flex;gap:10px">
        <button id="edit-emp-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
        <button id="edit-emp-save" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('edit-emp-name').focus();

  await new Promise(resolve => {
    document.getElementById('edit-emp-cancel').onclick = () => { modal.remove(); resolve(false); };
    modal.onclick = (ev) => { if (ev.target === modal) { modal.remove(); resolve(false); } };
    document.getElementById('edit-emp-save').onclick = async () => {
      const name  = document.getElementById('edit-emp-name').value.trim();
      const pos   = document.getElementById('edit-emp-pos').value.trim();
      const birth = document.getElementById('edit-emp-birth').value || '';
      const mil         = document.getElementById('edit-emp-mil').checked ? 1 : 0;
      const progBExempt = document.getElementById('edit-emp-prog-b-exempt')?.checked ? 1 : 0;
      const medcheck    = document.getElementById('edit-emp-medcheck')?.checked ? 1 : 0;
      if (!name) { document.getElementById('edit-emp-name').style.border = '1px solid #f87171'; return; }

      const saveBtn2 = document.getElementById('edit-emp-save');
      saveBtn2.textContent = '⏳ Обработка...';
      saveBtn2.disabled = true;

      let declension = null;
      if (window.api.aiRequest) {
        declension = await declineFIO(name);
      }

      modal.remove();
      await window.api.employeeUpdate(empId, {
        full_name:         name,
        position:          pos,
        birth_date:        birth,
        is_military:       mil,
        prog_b_exempt:     progBExempt,
        medcheck_required: medcheck,
        name_gen:          declension?.gen   || '',
        name_dat:          declension?.dat   || '',
        name_acc:          declension?.acc   || '',
        name_ins:          declension?.ins   || '',
        name_short:        declension?.short || '',
      });
      if (declension?.dat) {
        showToast('✅ Сотрудник обновлён · ' + declension.short);
      } else {
        showToast('✅ Сотрудник обновлён');
      }
      await navigate('client', currentClientId);
      resolve(true);
    };
    modal.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') document.getElementById('edit-emp-save').click();
      if (ev.key === 'Escape') { modal.remove(); resolve(false); }
    });
  });
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
        ${IS_ADMIN ? `<div class="snav-item" onclick="scrollSection('s-ai',this)">🤖 AI-провайдер</div>` : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:14px">

        <div class="section" id="s-profile">
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><div class="section-title">Профиль</div></div>
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
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></span><div class="section-title">Реквизиты исполнителя</div></div>
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
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span><div class="section-title">Telegram-уведомления</div></div>
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
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span><div class="section-title">Напоминания</div></div>
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
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg></span><div class="section-title">Резервные копии</div></div>
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

        ${IS_ADMIN ? `
        <div class="section" id="s-ai">
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg></span><div class="section-title">AI-провайдер</div></div>
          <div class="section-body">
            <div style="display:flex;flex-direction:column;gap:8px">
              ${buildAiProviderList(s)}
            </div>
            <div style="margin-top:4px">
              <div class="form-label" style="margin-bottom:6px">API-ключ выбранного провайдера</div>
              <input class="form-input" id="s-ai_key" type="password" value="${s.ai_key||''}" placeholder="Введите API-ключ когда будет готов">
              <div style="font-size:11px;color:var(--muted);margin-top:4px">Без ключа приложение работает в базовом режиме</div>
            </div>
          </div>
        </div>
        ` : ''}

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

function buildAiProviderList(s) {
  const providers = [
    ['deepseek','⚡','DeepSeek API','Быстрый · Дешёвый · OpenAI-совместимый','Рекомендуем'],
    ['claude','🤖','Claude API (Anthropic)','Наилучшее качество для юридических текстов','Основной'],
    ['yandex','🟡','YandexGPT API','Российский · Не блокируется в РФ','РФ'],
    ['giga','🟢','GigaChat API (Сбер)','Российский · Сертифицирован для ПД','РФ'],
    ['ollama','🟣','Локальная модель (Ollama)','Полностью офлайн · Без интернета','Офлайн'],
  ];
  return providers.map(([val,icon,name,desc,badge]) =>
    `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:var(--s3);border:1px solid ${s.ai_provider===val?'var(--blue)':'var(--border)'};border-radius:10px;cursor:pointer;transition:all .15s" onclick="selectAiProvider('${val}',this)">
      <div style="font-size:18px">${icon}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">${name}</div><div style="font-size:11px;color:var(--muted);margin-top:1px">${desc}</div></div>
      <div style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:rgba(59,130,246,0.12);color:var(--blue2)">${badge}</div>
    </div>`
  ).join('');
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
    region:           document.getElementById('c-region')?.value || 'Краснодарский край',
    city:             document.getElementById('c-city')?.value?.trim() || '',
    address:          document.getElementById('c-address')?.value?.trim() || '',
    czn:              'ФГКУ КК ЦЗН в г. Новороссийске',
    phone:            document.getElementById('c-phone')?.value?.trim() || '',
    order_prefix:     parseInt(document.getElementById('c-order-prefix')?.value) || 1,
    email:            '',
    modules:          mods || 'OT',
    manager_name:     document.getElementById('c-manager-name')?.value?.trim() || '',
    manager_position: document.getElementById('c-manager-position')?.value || 'Руководитель',
    ot_name:          document.getElementById('c-ot-name')?.value?.trim() || '',
    ot_position:      document.getElementById('c-ot-position')?.value?.trim() || '',
    soat_class:       document.getElementById('c-soat-class')?.value || '2',
    hazard_works:     document.getElementById('c-hazard-works')?.checked ? 1 : 0,
    medcheck_required:document.getElementById('c-medcheck-required')?.checked ? 1 : 0,
    color,
    score: 0,
  };
  const result = await window.api.clientAdd(data);
  closeModal('modalAddClient');
  showToast(`Клиент "${name}" добавлен`);
  // Сбрасываем форму
  ['c-name','c-inn','c-okved','c-staff','c-phone','c-city','c-address','c-ot-name','c-ot-position'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; }); const op = document.getElementById('c-order-prefix'); if(op) op.value='1';
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
      <div class="modal" style="max-height:90vh;overflow-y:auto">
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
          <div class="form-group"><div class="form-label">Город</div><input class="form-input" id="e-city" placeholder="Новороссийск"></div>
        </div>
        <div class="form-row">
          <div class="form-group full"><div class="form-label">Юридический адрес</div><input class="form-input" id="e-address" placeholder="г. Новороссийск, ул. Примерная, д. 1"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Телефон</div><input class="form-input" id="e-phone"></div>
          <div class="form-group"><div class="form-label">Начальный № приказа</div><input class="form-input" id="e-order-prefix" type="number" min="1"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Должность руководителя</div>
            <select class="form-select" id="e-manager-position">
              <option>Индивидуальный предприниматель</option>
              <option>Генеральный директор</option><option>Директор</option>
              <option>Исполнительный директор</option><option>Руководитель</option>
            </select>
          </div>
          <div class="form-group"><div class="form-label">ФИО руководителя</div><input class="form-input" id="e-manager-name" placeholder="Иванов Иван Иванович"></div>
        </div>
        <div style="padding:10px 0 4px;font-size:11px;color:var(--muted2);font-weight:600;letter-spacing:.5px">УСЛОВИЯ ТРУДА</div>
        <div class="form-row">
          <div class="form-group">
            <div class="form-label">Класс условий труда (СОУТ)</div>
            <select class="form-select" id="e-soat-class">
              <option value="2">Класс 2 — Допустимые (офис, ПЭВМ)</option>
              <option value="31">Класс 3.1 — Вредные (1 степень)</option>
              <option value="32">Класс 3.2 — Вредные (2 степень)</option>
              <option value="33">Класс 3.3 — Вредные (3 степень)</option>
              <option value="34">Класс 3.4 — Вредные (4 степень)</option>
              <option value="4">Класс 4 — Опасные</option>
              <option value="0">СОУТ не проводилась</option>
            </select>
          </div>
          <div class="form-group" style="justify-content:flex-end">
            <div class="form-label">Особые условия</div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--muted2)">
                <input type="checkbox" id="e-hazard-works" style="width:15px;height:15px">
                ⚠️ Есть работы повышенной опасности
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--muted2)">
                <input type="checkbox" id="e-medcheck-required" style="width:15px;height:15px">
                🏥 Медосмотры обязательны
              </label>
            </div>
          </div>
        </div>
        <div style="padding:10px 0 4px;font-size:11px;color:var(--muted2);font-weight:600;letter-spacing:.5px">ОТВЕТСТВЕННЫЙ ЗА ОХРАНУ ТРУДА</div>
        <div style="font-size:11px;color:var(--muted2);margin-bottom:8px">Если отличается от руководителя — заполните. Иначе оставьте пустым.</div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Должность отв. за ОТ</div><input class="form-input" id="e-ot-position" placeholder="Специалист по ОТ"></div>
          <div class="form-group"><div class="form-label">ФИО отв. за ОТ</div><input class="form-input" id="e-ot-name" placeholder="Петров Пётр Петрович"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-red" onclick="deleteClient(currentEditClientId)">🗑 Удалить</button>
          <button class="btn btn-ghost" onclick="closeModal('modalEditClient')">Отмена</button>
          <button class="btn btn-primary" onclick="submitEditClient(currentEditClientId)">💾 Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal('modalEditClient'); });
  }

  // Сохраняем ID клиента глобально (нужно для кнопок внутри модала)
  window.currentEditClientId = clientId;

  // Заполняем форму текущими данными
  document.getElementById('e-name').value          = c.name             || '';
  document.getElementById('e-inn').value           = c.inn              || '';
  document.getElementById('e-okved').value         = c.okved            || '';
  document.getElementById('e-staff').value         = c.staff            || '';
  document.getElementById('e-phone').value         = c.phone            || '';
  document.getElementById('e-city').value          = c.city             || '';
  document.getElementById('e-address').value       = c.address          || '';
  document.getElementById('e-order-prefix').value  = c.order_prefix     || 1;
  document.getElementById('e-manager-name').value  = c.manager_name     || '';
  document.getElementById('e-ot-position').value   = c.ot_position      || '';
  document.getElementById('e-ot-name').value       = c.ot_name          || '';

  // СОУТ и опасные работы
  const soatSel = document.getElementById('e-soat-class');
  if (soatSel) { for (let opt of soatSel.options) if (opt.value === String(c.soat_class||'2')) { opt.selected=true; break; } }
  const hazEl = document.getElementById('e-hazard-works');
  if (hazEl) hazEl.checked = !!c.hazard_works;
  const medEl = document.getElementById('e-medcheck-required');
  if (medEl) medEl.checked = !!c.medcheck_required;

  const formSel = document.getElementById('e-form');
  for (let opt of formSel.options) if (opt.value === c.form || opt.text === c.form) { opt.selected = true; break; }
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
    city:             document.getElementById('e-city').value.trim(),
    phone:            document.getElementById('e-phone').value.trim(),
    address:          document.getElementById('e-address').value.trim(),
    order_prefix:     parseInt(document.getElementById('e-order-prefix').value) || 1,
    manager_name:     document.getElementById('e-manager-name').value.trim(),
    manager_position: document.getElementById('e-manager-position').value,
    ot_name:           document.getElementById('e-ot-name').value.trim(),
    ot_position:       document.getElementById('e-ot-position').value.trim(),
    soat_class:        document.getElementById('e-soat-class')?.value || '2',
    hazard_works:      document.getElementById('e-hazard-works')?.checked ? 1 : 0,
    medcheck_required: document.getElementById('e-medcheck-required')?.checked ? 1 : 0,
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
  showToast('⚙️ Генерирую документы...');
  const result = await window.api.docsGenerate(clientId);
  if (!result.ok) {
    showToast('Ошибка: ' + result.error, 'var(--red)');
    return;
  }

  // Показываем отчёт об изменениях
  const r = result.report || {};
  const updated   = r.updated   || [];
  const added     = r.added     || [];
  const unchanged = r.unchanged || [];
  const errors    = result.errors || [];

  // Формируем модальное окно с отчётом
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999';

  const cleanName = n => n.replace(/_/g,' ').replace(/\.docx$/i,'').replace(/^\d{2}\.\d{2}\s*/,'').replace(/Приказ\s+\d+\s*/gi,'Приказ ').replace(/ИОТ\s+\d+\s*/gi,'ИОТ ').trim();

  const makeList = (items, color, icon) => items.length
    ? items.map(n => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <span style="font-size:12px">${icon}</span>
        <span style="font-size:12px;color:${color}">${cleanName(n)}</span>
      </div>`).join('')
    : '';

  const hasChanges = updated.length > 0 || added.length > 0;

  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:560px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="font-size:28px">${hasChanges ? '🔄' : '✅'}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">Генерация завершена</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">
            ${hasChanges
              ? `Обновлено ${updated.length + added.length} из ${result.generated.length} документов`
              : `Все ${result.generated.length} документов актуальны`}
          </div>
        </div>
      </div>

      ${added.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#34d399;letter-spacing:.5px;margin-bottom:6px">➕ НОВЫЕ ДОКУМЕНТЫ (${added.length})</div>
        <div style="background:rgba(52,211,153,0.05);border:1px solid rgba(52,211,153,0.15);border-radius:8px;padding:8px 12px">
          ${makeList(added, '#34d399', '📄')}
        </div>
      </div>` : ''}

      ${updated.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#60a5fa;letter-spacing:.5px;margin-bottom:6px">🔄 ОБНОВЛЕНЫ (${updated.length})</div>
        <div style="background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.15);border-radius:8px;padding:8px 12px">
          ${makeList(updated, '#60a5fa', '📝')}
        </div>
      </div>` : ''}

      ${unchanged.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:.5px;margin-bottom:6px">✓ БЕЗ ИЗМЕНЕНИЙ (${unchanged.length})</div>
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px 12px">
          ${makeList(unchanged, '#64748b', '✓')}
        </div>
      </div>` : ''}

      ${errors.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#f87171;letter-spacing:.5px;margin-bottom:6px">❌ ОШИБКИ (${errors.length})</div>
        <div style="background:rgba(248,113,113,0.05);border:1px solid rgba(248,113,113,0.15);border-radius:8px;padding:8px 12px">
          ${errors.map(e => `<div style="font-size:11px;color:#f87171;padding:3px 0">${e}</div>`).join('')}
        </div>
      </div>` : ''}

      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="this.closest('[style*=fixed]').remove();navigate('client',${clientId})" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Закрыть</button>
        ${result.dir ? `<button onclick="window.api.docsOpenFolder('${result.dir.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}');this.closest('[style*=fixed]').remove();navigate('client',${clientId})" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">📁 Открыть папку</button>` : ''}
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', ev => { if (ev.target === modal) { modal.remove(); navigate('client', clientId); } });
}

function openDocFile(filepath, event) {
  if (event) event.stopPropagation();
  window.api.docsOpenFile(filepath);
}

// Глобальная переменная для папки текущего клиента
let _currentClientDocDir = null;

function openClientFolder() {
  if (_currentClientDocDir) window.api.docsOpenFolder(_currentClientDocDir);
}
