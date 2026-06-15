// ============================================================
// КОМПЛАЕНСПРО — dashboard.js
// Дашборд: режим А (Аутсорсер) и режим Б (Штатный специалист)
// Обновлён: 09.06.2026
// ============================================================

async function renderDashboard() {
  const clients = await getClients();
  const tasks   = await window.api.tasksList();
  const events  = await window.api.eventsList(null);
  const alerts  = await window.api.trainingAlerts();

  const btn = document.getElementById('topbarAction');
  btn.textContent = '+ ' + term('addClient');
  btn.style.display = 'flex';
  btn.onclick = () => openModal('modalAddClient');
  const editBtn = document.getElementById('topbarEdit');
  if (editBtn) editBtn.style.display = 'none';

  window._dashEvents = events;
  window._dashTasks = tasks;

  // Режим А — Аутсорсер: используем глобальный LICENSE.type из auth.js
  const isOutsourcer = typeof LICENSE !== 'undefined' && LICENSE.type === 'OUTSOURCE';

  if (isOutsourcer && clients.length >= 1) {
    renderDashboardOutsourcer(clients, events, alerts, tasks);
  } else {
    await renderDashboardSpecialist(clients, events, alerts, tasks);
  }
}

// ─────────────────────────────────────────────────────────────
// РЕЖИМ А — АУТСОРСЕР
// ─────────────────────────────────────────────────────────────
function renderDashboardOutsourcer(clients, events, alerts, tasks) {
  const now = new Date();

  // Считаем просрочки и «на неделе» по каждому клиенту
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay() || 7));

  const clientStats = clients.map(c => {
    const cid = String(c.id);
    // Просрочено: обучение (days_left < 0)
    const overdueTraining = alerts.filter(a => String(a.client_id) === cid && a.overdue).length;
    // Просрочено: события
    const overdueEvents = events.filter(e => String(e.client_id) === cid && new Date(e.due_date) < now).length;
    const overdue = overdueTraining + overdueEvents;

    // На этой неделе: обучение (days_left >= 0 и <= 7)
    const weekTraining = alerts.filter(a =>
      String(a.client_id) === cid && !a.overdue && a.days_left >= 0 && a.days_left <= 7
    ).length;
    // На этой неделе: события
    const weekEvents = events.filter(e => {
      const d = new Date(e.due_date);
      return String(e.client_id) === cid && d >= now && d <= endOfWeek;
    }).length;
    const thisWeek = weekTraining + weekEvents;

    return { ...c, overdue, thisWeek };
  });

  // Сортировка: сначала с просрочками (по убыванию), затем с недельными, затем зелёные
  clientStats.sort((a, b) => {
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    if (b.thisWeek !== a.thisWeek) return b.thisWeek - a.thisWeek;
    return (b.score || 0) - (a.score || 0);
  });

  // Итоговые счётчики по всем клиентам
  const totalOverdue  = clientStats.reduce((s, c) => s + c.overdue, 0);
  const totalWeek     = clientStats.reduce((s, c) => s + c.thisWeek, 0);
  const totalOk       = clientStats.filter(c => c.overdue === 0 && c.thisWeek === 0).length;

  // Форматирование даты
  const today = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('content').innerHTML = `
    <style>
      .outsourcer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 12px;
      }
      .outsourcer-date {
        font-size: 12px;
        color: var(--muted);
      }
      .outsourcer-counters {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .oc-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        border: 1px solid;
      }
      .oc-badge-red   { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.25); color: #f87171; }
      .oc-badge-amber { background: rgba(251,191,36,0.1);  border-color: rgba(251,191,36,0.25);  color: #fbbf24; }
      .oc-badge-green { background: rgba(52,211,153,0.1);  border-color: rgba(52,211,153,0.25);  color: #34d399; }
      .outsourcer-table {
        width: 100%;
        border-collapse: collapse;
      }
      .outsourcer-table th {
        font-size: 11px;
        font-weight: 600;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0 12px 10px;
        text-align: left;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .outsourcer-table th.col-num { text-align: center; }
      .outsourcer-table td {
        padding: 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .outsourcer-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        cursor: pointer;
        border-radius: 8px;
        transition: background .15s;
      }
      .outsourcer-row:hover { background: rgba(255,255,255,0.03); }
      .or-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .or-status-red   { background: #f87171; box-shadow: 0 0 6px rgba(248,113,113,0.5); }
      .or-status-amber { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,0.4); }
      .or-status-green { background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,0.4); }
      .or-name {
        flex: 1;
        min-width: 0;
        font-size: 13px;
        font-weight: 600;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .or-meta {
        font-size: 11px;
        color: var(--muted);
        margin-top: 1px;
      }
      .or-num {
        width: 60px;
        text-align: center;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .or-score {
        width: 52px;
        text-align: right;
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
      }
    </style>

    <div class="outsourcer-header">
      <div class="outsourcer-date">${today}</div>
      <div class="outsourcer-counters">
        <div class="oc-badge oc-badge-red">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${totalOverdue} просрочено
        </div>
        <div class="oc-badge oc-badge-amber">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${totalWeek} на неделе
        </div>
        <div class="oc-badge oc-badge-green">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${totalOk} в порядке
        </div>
      </div>
    </div>

    <div class="panel" style="padding: 0; overflow: hidden;">
      <table class="outsourcer-table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding: 10px 12px 10px 44px; text-align:left;">Клиент</th>
            <th class="col-num" style="color: #f87171; width:100px;">Просрочено</th>
            <th class="col-num" style="color: #fbbf24; width:100px;">На неделе</th>
            <th class="col-num" style="color: #94a3b8; width:100px; padding-right:16px;">Готовность</th>
          </tr>
        </thead>
        <tbody id="outsourcerClientList">
          ${renderOutsourcerRows(clientStats)}
        </tbody>
      </table>
    </div>

    ${tasks.filter(t => !t.done).length ? `
    <div class="panel" style="margin-top: 14px;">
      <div class="panel-head">
        <span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
        <div class="panel-title">Задачи</div>
        <div class="panel-count">${tasks.filter(t => !t.done).length} открытых</div>
        <div class="panel-action" onclick="navigate('tasks')">Все →</div>
      </div>
      <div>${tasks.filter(t => !t.done).slice(0,4).map(t => renderTaskRow(t)).join('')}</div>
    </div>` : ''}
  `;
}

function renderOutsourcerRows(clientStats) {
  if (!clientStats.length) {
    return `<tr><td colspan="4" style="padding: 24px; text-align: center; color: var(--muted); font-size: 13px;">
      ${term('clientsGenPl')} пока нет — нажмите «+ ${term('addClient')}»
    </td></tr>`;
  }

  return clientStats.map(c => {
    const statusClass = c.overdue > 0 ? 'or-status-red' : c.thisWeek > 0 ? 'or-status-amber' : 'or-status-green';
    const scoreColor  = (c.score||0) >= 80 ? '#34d399' : (c.score||0) >= 40 ? '#fbbf24' : '#f87171';
    const initials    = getInitials(c.name);

    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;transition:background .15s;"
      onclick="navigate('client',${c.id})"
      onmouseover="this.style.background='rgba(255,255,255,0.03)'"
      onmouseout="this.style.background='transparent'">
      <td style="padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="or-status ${statusClass}"></div>
          <div style="width:28px;height:28px;border-radius:8px;background:${c.color||'#60a5fa'}22;border:1px solid ${c.color||'#60a5fa'}44;color:${c.color||'#60a5fa'};font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
          <div>
            <div class="or-name">${c.name}</div>
            <div class="or-meta">${c.staff||0} чел. · ${c.region||'—'}</div>
          </div>
        </div>
      </td>
      <td style="text-align:center;font-size:13px;font-weight:700;width:100px;color:${c.overdue > 0 ? '#f87171' : 'var(--muted)'}">
        ${c.overdue > 0 ? c.overdue : '—'}
      </td>
      <td style="text-align:center;font-size:13px;font-weight:700;width:100px;color:${c.thisWeek > 0 ? '#fbbf24' : 'var(--muted)'}">
        ${c.thisWeek > 0 ? c.thisWeek : '—'}
      </td>
      <td style="text-align:right;font-size:12px;font-weight:700;width:100px;padding-right:16px;color:${scoreColor}">
        ${c.score||0}%
      </td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// РЕЖИМ Б — ШТАТНЫЙ СПЕЦИАЛИСТ
// ─────────────────────────────────────────────────────────────
async function renderDashboardSpecialist(clients, events, alerts, tasks) {
  const stats = await window.api.dashboardStats();
  const now   = new Date();

  const overdueTraining = alerts.filter(a => a.overdue).length;
  const overdueEvents   = events.filter(e => new Date(e.due_date) < now).length;
  const totalOverdue    = overdueTraining + overdueEvents;

  // Блок «Что делать сегодня» — до 5 приоритетных действий
  const todoItems = [];

  // 1. Просроченное обучение
  const overdueAlerts = alerts.filter(a => a.overdue);
  if (overdueAlerts.length) {
    const byClient = {};
    overdueAlerts.forEach(a => {
      if (!byClient[a.client_name]) byClient[a.client_name] = { count: 0, id: a.client_id };
      byClient[a.client_name].count++;
    });
    Object.entries(byClient).slice(0,2).forEach(([name, info]) => {
      todoItems.push({
        priority: 0,
        svg: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
        color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)',
        text: `Провести обучение — ${name}`,
        sub: `${info.count} сотр. с просроченным обучением`,
        action: info.id ? `navigate('client',${info.id});setTimeout(()=>typeof switchTab!=='undefined'&&switchTab('staff'),400)` : null,
      });
    });
  }

  // 2. Просроченные события
  events.filter(e => new Date(e.due_date) < now).slice(0,2).forEach(e => {
    if (todoItems.length >= 5) return;
    const d = Math.abs(Math.ceil((new Date(e.due_date) - now) / 86400000));
    todoItems.push({
      priority: 0,
      svg: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
      color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)',
      text: e.title,
      sub: `Просрочено ${d} дн.${e.client_name ? ' · ' + e.client_name : ''}`,
      action: e.client_id ? `navigate('client',${e.client_id})` : null,
    });
  });

  // 3. Отчёты с дедлайном ≤ 3 дня
  try {
    const sett = await window.api.settingsGet();
    let submitted = {};
    try { submitted = JSON.parse(sett.reports_submitted || '{}'); } catch(_) {}
    const regions = [...new Set(clients.map(c => c.region).filter(Boolean))];
    const hasKrasnodar = regions.some(r => r && r.includes('Краснодар'));
    let repList = getFederalReports(now.getFullYear()).map(r => ({ ...r, scope:'federal' }));
    if (hasKrasnodar) repList = repList.concat(getKrasnodarReports(now.getFullYear()).map(r => ({ ...r, scope:'krasnodar' })));
    repList.forEach(r => { r.dueDate = shiftToWorkday(r.due); r.id = `${r.scope}_${r.due}_${r.name.slice(0,20).replace(/\s/g,'_')}`; });
    repList.sort((a,b) => a.dueDate - b.dueDate);
    const urgentRep = repList.find(r => {
      if (r.dueDate < now) return false;
      const d = Math.ceil((r.dueDate - now) / 86400000);
      return d <= 3 && clients.some(c => !submitted[`${c.id}__${r.id}`]);
    });
    if (urgentRep && todoItems.length < 5) {
      const d = Math.ceil((urgentRep.dueDate - now) / 86400000);
      todoItems.push({
        priority: 1,
        svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)',
        text: `Сдать отчёт: ${urgentRep.name}`,
        sub: `${urgentRep.period} · через ${d} дн. · до ${urgentRep.dueDate.toLocaleDateString('ru-RU')}`,
        action: `navigate('reporting')`,
      });
    }
  } catch(_) {}

  // 4. Мероприятия на сегодня и завтра
  events.filter(e => {
    const d = Math.ceil((new Date(e.due_date) - now) / 86400000);
    return d >= 0 && d <= 1;
  }).slice(0,2).forEach(e => {
    if (todoItems.length >= 5) return;
    const d = Math.ceil((new Date(e.due_date) - now) / 86400000);
    todoItems.push({
      priority: 2,
      svg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)',
      text: e.title,
      sub: `${e.client_name ? e.client_name + ' · ' : ''}${d === 0 ? 'сегодня' : 'завтра'}`,
      action: e.client_id ? `navigate('client',${e.client_id})` : null,
    });
  });

  // 5. Мероприятия до конца недели
  events.filter(e => {
    const d = Math.ceil((new Date(e.due_date) - now) / 86400000);
    return d >= 2 && d <= 7;
  }).slice(0,2).forEach(e => {
    if (todoItems.length >= 5) return;
    const d = Math.ceil((new Date(e.due_date) - now) / 86400000);
    todoItems.push({
      priority: 3,
      svg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',
      text: e.title,
      sub: `${e.client_name ? e.client_name + ' · ' : ''}через ${d} дн.`,
      action: e.client_id ? `navigate('client',${e.client_id})` : null,
    });
  });

  // 6. Обучение, истекающее скоро (≤14 дней)
  const soonAlerts = alerts.filter(a => !a.overdue && a.days_left <= 14);
  if (soonAlerts.length && todoItems.length < 5) {
    const byClient = {};
    soonAlerts.forEach(a => {
      if (!byClient[a.client_id]) byClient[a.client_id] = { name: a.client_name, count: 0, days: a.days_left };
      byClient[a.client_id].count++;
      if (a.days_left < byClient[a.client_id].days) byClient[a.client_id].days = a.days_left;
    });
    Object.entries(byClient).slice(0,1).forEach(([id, info]) => {
      todoItems.push({
        priority: 3,
        svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',
        text: `Запланировать обучение — ${info.name}`,
        sub: `${info.count} сотр., срок через ${info.days} дн.`,
        action: `navigate('client',${id});setTimeout(()=>typeof switchTab!=='undefined'&&switchTab('staff'),400)`,
      });
    });
  }

  const todoHtml = todoItems.length
    ? todoItems.map(item => `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;
        border-bottom:1px solid rgba(255,255,255,0.05);
        cursor:${item.action ? 'pointer' : 'default'};border-radius:6px;transition:background .15s"
        ${item.action ? `onclick="${item.action}"` : ''}
        onmouseover="this.style.background='rgba(255,255,255,0.02)'"
        onmouseout="this.style.background='transparent'">
        <div style="width:30px;height:30px;border-radius:8px;background:${item.bg};border:1px solid ${item.border};
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${item.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.svg}</svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12.5px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.text}</div>
          <div style="font-size:11px;color:#475569;margin-top:2px">${item.sub}</div>
        </div>
        ${item.action ? `<div style="color:#334155;font-size:12px;align-self:center;flex-shrink:0">→</div>` : ''}
      </div>`)
      .join('')
    : `<div style="padding:16px 0;text-align:center;">
        <div style="margin-bottom:8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>
        <div style="font-size:13px;font-weight:600;color:#34d399;">Всё сделано</div>
        <div style="font-size:11px;color:#475569;margin-top:4px;">На ближайшую неделю задач нет</div>
      </div>`;

  // Рекомендации ассистента
  const recs = [];
  const noDocs = clients.filter(c => (c.score||0) === 0);
  if (noDocs.length) {
    recs.push({
      svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
      color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)',
      text: `Сформировать документы — ${noDocs[0].name}`,
      sub: 'Документы ещё не созданы', action: `navigate('client',${noDocs[0].id})`,
    });
  }
  const lowScore = clients.filter(c => (c.score||0) > 0 && (c.score||0) < 40);
  if (lowScore.length && recs.length < 3) {
    recs.push({
      svg: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)',
      text: `Заполнить данные — ${lowScore[0].name}`,
      sub: `Готовность ${lowScore[0].score||0}% — требует внимания`, action: `navigate('client',${lowScore[0].id})`,
    });
  }
  const noStaff = clients.filter(c => !c.staff || c.staff === 0);
  if (noStaff.length && recs.length < 3) {
    recs.push({
      svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
      color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)',
      text: `Добавить сотрудников — ${noStaff[0].name}`,
      sub: 'Сотрудники не внесены', action: `navigate('client',${noStaff[0].id})`,
    });
  }

  const recsHtml = recs.length
    ? recs.map(r => `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;
        border-bottom:1px solid rgba(255,255,255,0.05);
        cursor:${r.action ? 'pointer' : 'default'};border-radius:6px;transition:background .15s"
        ${r.action ? `onclick="${r.action}"` : ''}
        onmouseover="this.style.background='rgba(255,255,255,0.02)'"
        onmouseout="this.style.background='transparent'">
        <div style="width:30px;height:30px;border-radius:8px;background:${r.bg};border:1px solid ${r.border};
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${r.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${r.svg}</svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12.5px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.text}</div>
          <div style="font-size:11px;color:#475569;margin-top:2px">${r.sub}</div>
        </div>
        ${r.action ? `<div style="color:#334155;font-size:12px;align-self:center;flex-shrink:0">→</div>` : ''}
      </div>`)
    .join('')
    : `<div style="padding:12px 0;text-align:center;color:#334155;font-size:12px">Нет рекомендаций — всё в порядке</div>`;

  document.getElementById('content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">${ic('building', 14)} Клиенты</div><div class="stat-value">${stats.clients}</div><div class="stat-sub">на сопровождении</div></div>
      <div class="stat-card"><div class="stat-label">${ic('clipboard-list', 14)} Открытых задач</div><div class="stat-value">${stats.tasks}</div><div class="stat-sub">${stats.urgent > 0 ? stats.urgent + ' срочных' : 'нет срочных'}</div></div>
      <div class="stat-card"><div class="stat-label">${ic('graduation-cap', 14)} Обучение</div><div class="stat-value" style="color:${alerts.length ? 'var(--amber)' : 'var(--green)'}">${alerts.length}</div><div class="stat-sub">истекает в течение 30 дн.</div></div>
      <div class="stat-card"><div class="stat-label">${ic('alert-triangle', 14)} Просрочено</div><div class="stat-value" style="color:${totalOverdue ? 'var(--red)' : 'var(--green)'}">${totalOverdue}</div><div class="stat-sub">требуют действий</div></div>
    </div>
    <div class="grid2">
      <div>
        <div class="panel">
          <div class="panel-head">
            <span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;background:rgba(248,113,113,0.15);border-radius:50%;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <div class="panel-title">Что делать сегодня</div>
            <div class="panel-count">${todoItems.length} ${todoItems.length === 1 ? 'задача' : todoItems.length >= 2 && todoItems.length <= 4 ? 'задачи' : 'задач'}</div>
          </div>
          <div style="padding:4px 0">${todoHtml}</div>
        </div>
        ${tasks.length ? `
        <div class="panel">
          <div class="panel-head">
            <span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
            <div class="panel-title">Задачи</div>
            <div class="panel-action" onclick="navigate('tasks')">Все →</div>
          </div>
          <div>${tasks.slice(0,5).map(t => renderTaskRow(t)).join('')}</div>
        </div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="panel">
          <div class="panel-head">
            <span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;background:rgba(251,191,36,0.2);border-radius:50%">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24" stroke="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="#1a1f2e" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>
            </span>
            <div class="panel-title">КомплаенсПро рекомендует</div>
            <div class="panel-count">${recs.length} ${recs.length === 1 ? 'задача' : recs.length >= 2 && recs.length <= 4 ? 'задачи' : 'задач'}</div>
          </div>
          <div style="padding:4px 0">${recsHtml}</div>
        </div>
        ${renderProductionCalendar(events, tasks)}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────
var allDashClients = window._allDashClients || [];
async function filterDashClients(q) {
  if (!allDashClients.length) allDashClients = await getClients();
  const filtered = allDashClients.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.inn||'').includes(q) || (c.okved||'').includes(q)
  );
  document.getElementById('dashClientList').innerHTML = renderClientRows(filtered);
}

function renderClientRows(clients) {
  if (!clients.length) return emptyState("building", term('clientsGenPl') + " пока нет", "Нажмите «+ " + term('addClient') + "»");
  return clients.map(c => {
    const mods = (c.modules||'OT').split(',');
    const dots = mods.map(m => `<div class="mod-dot" style="background:${m==='OT'?'var(--green)':m==='PD'?'var(--amber)':'var(--red)'}" title="${m}"></div>`).join('');
    const initials = getInitials(c.name);
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
  const due  = new Date(e.due_date);
  const now  = new Date();
  const diff = Math.round((due - now) / 86400000);
  let color  = 'var(--muted2)', label = formatDate(e.due_date);
  if (diff < 0)       { color = 'var(--red)';   label = 'Просрочено'; }
  else if (diff <= 3)   color = 'var(--red)';
  else if (diff <= 14)  color = 'var(--amber)';
  else if (diff <= 30)  color = 'var(--blue2)';
  return `<div class="event-row">
    <div class="ev-dot" style="background:${color}"></div>
    <div class="ev-body"><div class="ev-title">${e.title}</div><div class="ev-sub">${e.client_name||''}</div></div>
    <div class="ev-when" style="color:${color}">${label}</div>
  </div>`;
}

function renderTaskRow(t) {
  const tagClass = t.module==='OT'?'tag-ot':t.module==='PD'?'tag-pd':'tag-vu';
  const tagLabel = t.module==='OT'?'ОТ':t.module==='PD'?'ПД':'ВУ';
  const isDone   = !!t.done;
  const checkInner = isDone
    ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);box-shadow:0 0 8px rgba(0,200,83,0.5);flex-shrink:0"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.15);flex-shrink:0;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(0,200,83,0.5)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)'"></span>`;
  return `<div class="task-row" id="task-row-${t.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;transition:background .15s" onmouseover="this.querySelector('.task-del-btn').style.opacity='1'" onmouseout="this.querySelector('.task-del-btn').style.opacity='0'">
    <div class="task-check ${isDone?'done':''}" onclick="toggleTask(${t.id},this)" id="task-check-${t.id}" style="flex-shrink:0;cursor:pointer">${checkInner}</div>
    <div class="task-text ${isDone?'done':''}" style="flex:1;min-width:0;font-size:13px;${isDone?'text-decoration:line-through;color:#475569':'color:var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}${t.client_name?' <span style="color:var(--muted);font-size:11px">· '+t.client_name+'</span>':''}</div>
    ${t.module?`<div class="task-tag ${tagClass}" style="flex-shrink:0">${tagLabel}</div>`:''}
    <button class="task-del-btn" onclick="deleteTask(${t.id})" title="Удалить задачу"
      style="flex-shrink:0;opacity:0;background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:#475569;transition:all .15s;display:flex;align-items:center"
      onmouseover="this.style.color='#f87171';this.style.background='rgba(248,113,113,0.1)'"
      onmouseout="this.style.color='#475569';this.style.background='none'">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
  </div>`;
}

async function deleteTask(id) {
  const row = document.getElementById('task-row-' + id);
  if (row) {
    row.style.transition = 'all .25s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(20px)';
    row.style.maxHeight = row.offsetHeight + 'px';
    await new Promise(r => setTimeout(r, 250));
    row.style.maxHeight = '0';
    row.style.padding = '0';
    row.style.margin = '0';
    row.style.overflow = 'hidden';
    await new Promise(r => setTimeout(r, 200));
    row.remove();
  }
  await window.api.taskDelete(id);
  showToast('Задача удалена');
}

async function toggleTask(id, checkEl) {
  if (!document.getElementById('task-check-styles')) {
    const s = document.createElement('style');
    s.id = 'task-check-styles';
    s.textContent = `
      @keyframes tc-pop { 0%{transform:scale(0) rotate(-45deg);opacity:0} 55%{transform:scale(1.3) rotate(8deg)} 75%{transform:scale(0.88) rotate(-3deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
      @keyframes tc-glow { 0%{box-shadow:0 0 0 0 rgba(0,200,83,0.8)} 50%{box-shadow:0 0 0 7px rgba(0,200,83,0.25)} 100%{box-shadow:0 0 0 13px rgba(0,200,83,0)} }
      @keyframes tc-stroke { to{stroke-dashoffset:0} }
      @keyframes tc-row-flash { 0%{background:rgba(0,200,83,0.1)} 100%{background:transparent} }
    `;
    document.head.appendChild(s);
  }
  await window.api.taskToggle(id);
  const row    = document.getElementById('task-row-' + id);
  const isDone = checkEl.classList.contains('done');
  const textEl = checkEl.nextElementSibling;
  if (!isDone) {
    checkEl.classList.add('done');
    if (textEl) textEl.classList.add('done');
    if (row) { row.style.animation = ''; void row.offsetWidth; row.style.animation = 'tc-row-flash .7s ease forwards'; }
    checkEl.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);animation:tc-pop .45s cubic-bezier(.22,.68,0,1.4) both,tc-glow 1.4s ease .1s both;flex-shrink:0"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14" style="animation:tc-stroke .3s ease .12s forwards"/></svg></span>`;
  } else {
    checkEl.classList.remove('done');
    if (textEl) textEl.classList.remove('done');
    if (row) row.style.animation = '';
    checkEl.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.15);flex-shrink:0;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(0,200,83,0.5)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)'"></span>`;
  }
}
