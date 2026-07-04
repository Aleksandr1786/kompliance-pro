// ============================================================
// КОМПЛАЕНСПРО — reporting.js
// Отчётность: федеральная и краевая, панель, производственный календарь
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================

// Перенос даты на рабочий день, если выпадает на выходные
function shiftToWorkday(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // суббота → понедельник
  else if (day === 0) d.setDate(d.getDate() + 1); // воскресенье → понедельник
  return d;
}

// Федеральная отчётность (все регионы)
function getFederalReports(year) {
  return [
    { name:'ЕФС-1 Раздел 2 (взносы на травматизм)', period:'I квартал', due:`${year}-04-25`, org:'СФР', freq:'Ежеквартально', note:'Нарастающим итогом. Нулевой отчёт обязателен.' },
    { name:'ЕФС-1 Раздел 2 (взносы на травматизм)', period:'Полугодие', due:`${year}-07-25`, org:'СФР', freq:'Ежеквартально', note:'Нарастающим итогом.' },
    { name:'ЕФС-1 Раздел 2 (взносы на травматизм)', period:'9 месяцев', due:`${year}-10-27`, org:'СФР', freq:'Ежеквартально', note:'Нарастающим итогом.' },
    { name:'ЕФС-1 Раздел 2 (взносы на травматизм)', period:'Год', due:`${year+1}-01-26`, org:'СФР', freq:'Ежеквартально', note:'Итоговый за год.' },
    { name:'Форма № 1-Т (условия труда)', period:'За год', due:`${year+1}-01-21`, org:'Росстат', freq:'Ежегодно', note:'Приказ Росстата №348 от 22.07.2025. Только для не-МСП (более 100 чел.).' },
    { name:'Форма № 7-травматизм', period:'За год', due:`${year+1}-03-01`, org:'Росстат', freq:'Ежегодно', note:'Сведения о травматизме. Не для микропредприятий.' },
  ];
}

// Региональная отчётность Краснодарского края (Постановление № 1591)
function getKrasnodarReports(year) {
  return [
    { name:'Сведения о производственном травматизме', period:'I квартал', due:`${year}-04-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Затраты на охрану труда', period:'I квартал', due:`${year}-04-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true, note:'Нарастающим итогом, в тыс. руб.' },
    { name:'Сведения о производственном травматизме', period:'II квартал', due:`${year}-07-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Затраты на охрану труда', period:'II квартал', due:`${year}-07-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Состояние условий труда и организации работ по ОТ', period:'Полугодие', due:`${year}-07-05`, org:'ЦЗН (kubzan.ru)', freq:'Полугодие', region:true, note:'Включая сведения о СОУТ.' },
    { name:'Сведения о производственном травматизме', period:'III квартал', due:`${year}-10-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Затраты на охрану труда', period:'III квартал', due:`${year}-10-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Сведения о производственном травматизме', period:'IV квартал', due:`${year+1}-01-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Затраты на охрану труда', period:'IV квартал', due:`${year+1}-01-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Состояние условий труда и организации работ по ОТ', period:'За год', due:`${year+1}-01-05`, org:'ЦЗН (kubzan.ru)', freq:'Полугодие', region:true, note:'Годовые сведения, включая СОУТ.' },
  ];
}

// Карта региональных модулей
const REGIONAL_MODULES = {
  'Краснодарский край': { name:'Краснодарский край', portal:'kubzan.ru', law:'Постановление губернатора № 1591 от 21.12.2012', getReports: getKrasnodarReports },
};

// ── ОТЧЁТНОСТЬ: вспомогательные функции ─────────────────

// Построить список отчётов для конкретного клиента
function buildClientReports(client, year) {
  const hasKrasnodar = client.region && client.region.includes('Краснодар');
  const staff = parseInt(client.staff || 0);
  const isMicro = staff <= 15;
  const isMSP = staff <= 100; // МСП — до 100 человек

  let reports = getFederalReports(year)
    .filter(r => {
      // Форма 1-Т — только для не-МСП (более 100 чел.)
      if (r.name.includes('1-Т')) return !isMSP;
      // Форма 7-травматизм — не для микропредприятий
      if (r.name.includes('7-травматизм')) return !isMicro;
      return true;
    })
    .map(r => ({ ...r, scope:'federal' }));

  if (hasKrasnodar) reports = reports.concat(getKrasnodarReports(year).map(r => ({ ...r, scope:'krasnodar' })));
  reports.forEach(r => {
    r.dueDate = shiftToWorkday(r.due);
    r.id = `${r.scope}_${r.due}_${r.name.slice(0,20).replace(/\s/g,'_')}`;
  });
  reports.sort((a,b) => a.dueDate - b.dueDate);
  return reports;
}

// Ключ в submitted: clientId + '_' + reportId
function submittedKey(clientId, reportId) {
  return `${clientId}__${reportId}`;
}

// Цвет/лейбл по scope
const scopeColor = sc => sc === 'federal' ? '#60a5fa' : '#fbbf24';
const scopeName  = sc => sc === 'federal' ? 'Федеральная' : 'Краснодарский край';

// Карточка одного отчёта внутри боковой панели / вкладки клиента
function reportRowInPanel(r, clientId, submitted) {
  const now = new Date();
  const key = submittedKey(clientId, r.id);
  const done = !!submitted[key];
  const days = Math.ceil((r.dueDate - now) / 86400000);
  const overdue = days < 0;
  const soon = days >= 0 && days <= 14;
  const col = done ? '#34d399' : overdue ? '#f87171' : soon ? '#fbbf24' : '#94a3b8';
  const shifted = r.dueDate.getDate() !== new Date(r.due).getDate();
  const daysLabel = done ? 'сдан' : overdue ? `просрочен ${Math.abs(days)} дн.` : days === 0 ? 'сегодня!' : `через ${days} дн.`;

  return `<div style="
    display:flex;align-items:center;gap:12px;
    padding:12px 14px;
    background:${done ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)'};
    border:1px solid ${done ? 'rgba(52,211,153,0.15)' : 'var(--border)'};
    border-radius:10px;margin-bottom:6px;transition:all .2s">
    <label style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;cursor:pointer;flex-shrink:0">
      <input type="checkbox" ${done?'checked':''} onchange="toggleReport(${clientId},'${r.id}',this.checked)"
        style="width:16px;height:16px;accent-color:#34d399;cursor:pointer">
    </label>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600;color:${done?'#475569':'var(--text)'};${done?'text-decoration:line-through':''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">
        ${r.period} · ${r.org} · <span style="color:${scopeColor(r.scope)}">${scopeName(r.scope)}</span>
        ${r.note ? ` · <span style="color:#475569">${r.note}</span>` : ''}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;min-width:72px">
      <div style="font-size:11px;font-weight:700;color:${done?'#334155':'var(--text)'}">${r.dueDate.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
      <div style="font-size:10px;font-weight:600;color:${col}">${daysLabel}</div>
      ${shifted&&!done?`<div style="font-size:9px;color:#334155">перенос</div>`:''}
    </div>
  </div>`;
}

// ── ОСНОВНАЯ СТРАНИЦА ОТЧЁТНОСТИ ─────────────────────────

async function renderReporting() {
  const clients = await getClients();
  const s = await window.api.settingsGet();
  const now = new Date();
  const year = now.getFullYear();

  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';

  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  // Для каждого клиента строим список отчётов с флагом done
  const clientReports = clients.map(client => {
    const reports = buildClientReports(client, year);
    reports.forEach(r => { r.done = !!submitted[submittedKey(client.id, r.id)]; });
    const overdue = reports.filter(r => !r.done && r.dueDate < now);
    const pending  = reports.filter(r => !r.done && r.dueDate >= now);
    const done     = reports.filter(r => r.done);
    return { client, reports, overdue, pending, done };
  });

  // Собираем все уникальные дедлайны из несданных (просроченных + предстоящих)
  const deadlineMap = new Map(); // dateString → { dueDate, entries: [{client, report}] }
  clientReports.forEach(({ client, reports }) => {
    reports.filter(r => !r.done).forEach(r => {
      const key = r.dueDate.toDateString();
      if (!deadlineMap.has(key)) deadlineMap.set(key, { dueDate: r.dueDate, entries: [] });
      deadlineMap.get(key).entries.push({ client, report: r });
    });
  });

  // Сортируем дедлайны
  const deadlines = [...deadlineMap.values()].sort((a,b) => a.dueDate - b.dueDate);
  const overdueDeadlines = deadlines.filter(d => d.dueDate < now);
  const futureDeadlines  = deadlines.filter(d => d.dueDate >= now);
  const nextDeadline     = futureDeadlines[0] || null;
  const upcomingDeadlines = futureDeadlines.slice(1);

  // Подсчёт сводной статистики
  const totalClients   = clients.length;
  const totalOverdue   = overdueDeadlines.reduce((s,d) => s + d.entries.length, 0);
  const totalThisWeek  = nextDeadline
    ? Math.ceil((nextDeadline.dueDate - now) / 86400000) <= 7 ? nextDeadline.entries.length : 0
    : 0;
  const totalDone      = clientReports.reduce((s,cr) => s + cr.done.length, 0);

  // Сохраняем для toggleReport
  window._reportingData = { submitted };

  // ── Рендер строки дедлайна (список клиентов внутри) ──
  const renderDeadlineGroup = (deadline, isNext = false, isOverdue = false) => {
    const days = Math.ceil((deadline.dueDate - now) / 86400000);
    const dateStr = deadline.dueDate.toLocaleDateString('ru-RU', { day:'numeric', month:'long', weekday:'short' });

    const headerColor = isOverdue ? '#f87171' : isNext ? '#60a5fa' : '#94a3b8';
    const headerBg    = isOverdue ? 'rgba(248,113,113,0.08)' : isNext ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.02)';
    const headerBorder= isOverdue ? 'rgba(248,113,113,0.25)' : isNext ? 'rgba(96,165,250,0.2)' : 'var(--border)';
    const label       = isOverdue ? `просрочено ${Math.abs(days)} дн.` : days === 0 ? 'сегодня!' : days === 1 ? 'завтра' : `через ${days} дн.`;

    // Группируем entries по клиенту
    const byClient = new Map();
    deadline.entries.forEach(({ client, report }) => {
      if (!byClient.has(client.id)) byClient.set(client.id, { client, reports: [] });
      byClient.get(client.id).reports.push(report);
    });

    const clientRows = [...byClient.values()].map(({ client, reports }) => {
      const initials = getInitials(client.name);
      const reportNames = reports.map(r => r.name).join(', ');
      const hasKrasnodar = reports.some(r => r.scope === 'krasnodar');

      return `<div onclick="openReportingPanel(${client.id})" style="
        display:flex;align-items:center;gap:12px;
        padding:11px 14px;
        background:rgba(255,255,255,0.015);
        border:1px solid rgba(255,255,255,0.06);
        border-radius:10px;margin-bottom:6px;
        cursor:pointer;transition:all .15s"
        onmouseover="this.style.background='rgba(255,255,255,0.04)';this.style.borderColor='rgba(255,255,255,0.12)'"
        onmouseout="this.style.background='rgba(255,255,255,0.015)';this.style.borderColor='rgba(255,255,255,0.06)'">
        <div style="width:30px;height:30px;border-radius:8px;background:${client.color||'#60a5fa'}22;border:1px solid ${client.color||'#60a5fa'}44;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${client.color||'#60a5fa'};flex-shrink:0">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${client.name}</div>
          <div style="font-size:10px;color:var(--muted2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${reports.length} отч.: ${reportNames}
            ${hasKrasnodar ? '<span style="color:#fbbf24;margin-left:4px">· kubzan.ru</span>' : ''}
          </div>
        </div>
        <div style="flex-shrink:0;display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.2);padding:2px 8px;background:rgba(255,255,255,0.04);border-radius:8px">${reports.length}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${headerBg};border:1px solid ${headerBorder};border-radius:10px;margin-bottom:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:${headerColor};flex-shrink:0"></div>
        <div style="flex:1">
          <span style="font-size:12px;font-weight:700;color:${headerColor}">${dateStr.toUpperCase()}</span>
          <span style="font-size:11px;color:var(--muted2);margin-left:8px">${label}</span>
        </div>
        <span style="font-size:10px;color:var(--muted2);background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px">${deadline.entries.length} ${deadline.entries.length===1?'отчёт':deadline.entries.length<=4?'отчёта':'отчётов'} · ${byClient.size} ${byClient.size===1?'клиент':byClient.size<=4?'клиента':'клиентов'}</span>
      </div>
      <div style="padding-left:8px">${clientRows}</div>
    </div>`;
  };

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="max-width:800px">

      <!-- Сводная статистика -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
        ${[
          { val: totalClients,   label: 'Клиентов', color: '#60a5fa' },
          { val: totalOverdue,   label: 'Просрочено', color: totalOverdue > 0 ? '#f87171' : '#34d399' },
          { val: totalThisWeek,  label: 'На этой неделе', color: totalThisWeek > 0 ? '#fbbf24' : '#94a3b8' },
          { val: totalDone,      label: 'Сдано всего', color: '#34d399' },
        ].map(s => `
          <div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:${s.color}">${s.val}</div>
            <div style="font-size:10px;color:var(--muted2);margin-top:2px;font-weight:500">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Просроченные -->
      ${overdueDeadlines.length ? `
      <div style="margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:#f87171;letter-spacing:.8px;margin-bottom:10px;padding:0 2px">⚠ ПРОСРОЧЕННЫЕ</div>
        ${overdueDeadlines.map(d => renderDeadlineGroup(d, false, true)).join('')}
      </div>` : ''}

      <!-- Ближайший дедлайн -->
      ${nextDeadline ? `
      <div style="margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:#60a5fa;letter-spacing:.8px;margin-bottom:10px;padding:0 2px">БЛИЖАЙШИЙ СРОК</div>
        ${renderDeadlineGroup(nextDeadline, true, false)}
      </div>` : ''}

      <!-- Предстоящие -->
      ${upcomingDeadlines.length ? `
      <details style="margin-bottom:12px" ${overdueDeadlines.length === 0 && !nextDeadline ? 'open' : ''}>
        <summary style="
          display:flex;align-items:center;gap:10px;
          padding:11px 16px;
          background:rgba(255,255,255,0.02);border:1px solid var(--border);
          border-radius:10px;cursor:pointer;list-style:none;
          font-size:12px;font-weight:600;color:var(--muted2);transition:background .15s"
          onmouseover="this.style.background='rgba(255,255,255,0.04)'"
          onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Предстоящие сроки
          <span style="background:rgba(255,255,255,0.07);color:var(--muted2);font-size:10px;padding:2px 8px;border-radius:8px;margin-left:auto">${upcomingDeadlines.length} дат</span>
        </summary>
        <div style="margin-top:10px">${upcomingDeadlines.map(d => renderDeadlineGroup(d)).join('')}</div>
      </details>` : ''}

      <!-- Все сдано -->
      ${deadlines.length === 0 ? `
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:14px;padding:24px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">✅</div>
        <div style="font-size:14px;font-weight:700;color:#34d399">Все отчёты сданы!</div>
        <div style="font-size:12px;color:var(--muted2);margin-top:4px">Ближайших несданных отчётов нет</div>
      </div>` : ''}

      <!-- Правовое основание -->
      <div style="font-size:10px;color:#334155;margin-top:16px;padding:10px 14px;background:rgba(255,255,255,0.01);border-radius:8px;line-height:1.7">
        ЕФС-1 — Приказ СФР № 1462 от 17.11.2025 · Форма 1-Т — Приказ Росстата №348 от 22.07.2025
        ${clients.some(c => c.region && c.region.includes('Краснодар')) ? ' · Краснодарский край — Постановление губернатора № 1591 от 21.12.2012 (ред. 12.12.2023)' : ''}
        · Сроки с переносом на рабочий день
      </div>
    </div>

    <!-- Боковая панель отчётов клиента -->
    <div id="reporting-panel-overlay" onclick="closeReportingPanel()" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:900;backdrop-filter:blur(2px)"></div>
    <div id="reporting-panel" style="
      display:none;position:fixed;top:0;right:0;bottom:0;width:420px;max-width:95vw;
      background:var(--s2);border-left:1px solid rgba(255,255,255,0.08);
      z-index:901;overflow-y:auto;padding:0;
      transform:translateX(100%);transition:transform .25s cubic-bezier(.4,0,.2,1)">
      <div id="reporting-panel-content"></div>
    </div>`;
}

// Открыть боковую панель отчётов клиента
async function openReportingPanel(clientId) {
  const s = await window.api.settingsGet();
  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  const clients = await getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const year = new Date().getFullYear();
  const reports = buildClientReports(client, year);
  reports.forEach(r => { r.done = !!submitted[submittedKey(clientId, r.id)]; });

  const now = new Date();
  const overdue = reports.filter(r => !r.done && r.dueDate < now);
  const pending  = reports.filter(r => !r.done && r.dueDate >= now);
  const done     = reports.filter(r => r.done);

  const initials = getInitials(client.name);
  const hasKrasnodar = client.region && client.region.includes('Краснодар');

  const panelContent = document.getElementById('reporting-panel-content');
  panelContent.innerHTML = `
    <!-- Шапка -->
    <div style="position:sticky;top:0;background:var(--s2);border-bottom:1px solid rgba(255,255,255,0.07);padding:16px 20px;display:flex;align-items:center;gap:12px;z-index:10">
      <div style="width:36px;height:36px;border-radius:10px;background:${client.color||'#60a5fa'}22;border:1px solid ${client.color||'#60a5fa'}44;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${client.color||'#60a5fa'};flex-shrink:0">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${client.name}</div>
        <div style="font-size:10px;color:var(--muted2)">${client.region||''} ${client.inn?'· ИНН '+client.inn:''}</div>
      </div>
      <button onclick="closeReportingPanel()" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted2)'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <!-- Мини-статистика -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05)">
      ${[
        { val: overdue.length, label: 'Просрочено', color: overdue.length ? '#f87171' : '#475569' },
        { val: pending.length, label: 'Предстоит',  color: pending.length ? '#fbbf24' : '#475569' },
        { val: done.length,    label: 'Сдано',       color: '#34d399' },
      ].map(s => `<div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.02);border-radius:8px">
        <div style="font-size:18px;font-weight:700;color:${s.color}">${s.val}</div>
        <div style="font-size:10px;color:var(--muted2)">${s.label}</div>
      </div>`).join('')}
    </div>
    <!-- Отчёты -->
    <div style="padding:16px 20px">
      ${overdue.length ? `
      <div style="font-size:10px;font-weight:700;color:#f87171;letter-spacing:.8px;margin-bottom:8px">ПРОСРОЧЕННЫЕ</div>
      ${overdue.map(r => reportRowInPanel(r, clientId, submitted)).join('')}
      <div style="margin-bottom:14px"></div>` : ''}

      ${pending.length ? `
      <div style="font-size:10px;font-weight:700;color:#60a5fa;letter-spacing:.8px;margin-bottom:8px">ПРЕДСТОЯЩИЕ</div>
      ${pending.map(r => reportRowInPanel(r, clientId, submitted)).join('')}
      <div style="margin-bottom:14px"></div>` : ''}

      ${done.length ? `
      <details>
        <summary style="font-size:10px;font-weight:700;color:#334155;letter-spacing:.8px;margin-bottom:8px;cursor:pointer;list-style:none">▸ СДАННЫЕ (${done.length})</summary>
        <div style="margin-top:8px">${done.map(r => reportRowInPanel(r, clientId, submitted)).join('')}</div>
      </details>` : ''}

      ${overdue.length === 0 && pending.length === 0 ? `
      <div style="text-align:center;padding:24px;color:var(--muted2)">
        <div style="font-size:20px;margin-bottom:8px">✅</div>
        <div style="font-size:13px;font-weight:600;color:#34d399">Все отчёты сданы</div>
      </div>` : ''}

      ${hasKrasnodar ? `
      <div style="margin-top:8px;padding:10px 12px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px;font-size:10px;color:#94a3b8;line-height:1.5">
        📎 Региональные отчёты подаются через <b style="color:#fbbf24">kubzan.ru</b> — вход через Госуслуги (ЭЦП или SMS)
      </div>` : ''}
    </div>`;

  // Показываем панель
  const overlay = document.getElementById('reporting-panel-overlay');
  const panel   = document.getElementById('reporting-panel');
  overlay.style.display = 'block';
  panel.style.display   = 'block';
  requestAnimationFrame(() => { panel.style.transform = 'translateX(0)'; });

  window._reportingPanel = { clientId, submitted };
}

function closeReportingPanel() {
  const panel   = document.getElementById('reporting-panel');
  const overlay = document.getElementById('reporting-panel-overlay');
  if (!panel) return;
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => {
    panel.style.display   = 'none';
    overlay.style.display = 'none';
  }, 250);
}

async function toggleReport(clientId, reportId, isDone) {
  const s = await window.api.settingsGet();
  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  const key = submittedKey(clientId, reportId);
  if (isDone) {
    submitted[key] = new Date().toISOString();
    showToast('✅ Отчёт отмечен как сданный');
  } else {
    delete submitted[key];
  }

  await window.api.settingsSave({ reports_submitted: JSON.stringify(submitted) });
  window._reportingData = { submitted };

  // Если открыта боковая панель — перерендерим её, не закрывая
  if (window._reportingPanel && window._reportingPanel.clientId === clientId) {
    await openReportingPanel(clientId);
  }

  // Перерисовываем основную страницу в фоне (без скролла)
  if (currentPage === 'reporting') await renderReporting();
}

// ── ВКЛАДКА «Отчётность» в карточке клиента ─────────────
async function renderClientReporting(clientId) {
  const s = await window.api.settingsGet();
  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  const clients = await getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const now = new Date();
  const year = now.getFullYear();
  const reports = buildClientReports(client, year);
  reports.forEach(r => { r.done = !!submitted[submittedKey(clientId, r.id)]; });

  const overdue = reports.filter(r => !r.done && r.dueDate < now);
  const pending  = reports.filter(r => !r.done && r.dueDate >= now);
  const done     = reports.filter(r => r.done);

  const hasKrasnodar = client.region && client.region.includes('Краснодар');

  const panel = document.getElementById('tab-reporting');
  if (!panel) return;
  panel.innerHTML = `
    <div style="max-width:700px">

      <!-- Кнопки быстрого доступа -->
      <div style="display:flex;gap:10px;margin-bottom:18px">
        <button onclick="renderEfs1Page(${clientId})" style="
          flex:1;display:flex;align-items:center;gap:10px;padding:12px 16px;
          background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.25);
          border-radius:10px;cursor:pointer;transition:all .2s;text-align:left"
          onmouseover="this.style.background='rgba(37,99,235,0.15)'"
          onmouseout="this.style.background='rgba(37,99,235,0.08)'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <div>
            <div style="font-size:12px;font-weight:700;color:#93c5fd">ЕФС-1 (СФР)</div>
            <div style="font-size:10px;color:#475569">Справка бухгалтеру · Личный кабинет СФР</div>
          </div>
        </button>
        ${hasKrasnodar ? `
        <button onclick="renderCznPage(${clientId})" style="
          flex:1;display:flex;align-items:center;gap:10px;padding:12px 16px;
          background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);
          border-radius:10px;cursor:pointer;transition:all .2s;text-align:left"
          onmouseover="this.style.background='rgba(251,191,36,0.15)'"
          onmouseout="this.style.background='rgba(251,191,36,0.07)'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <div>
            <div style="font-size:12px;font-weight:700;color:#fbbf24">Отчёт ЦЗН</div>
            <div style="font-size:10px;color:#475569">Краснодарский край · Генератор + kubzan.ru</div>
          </div>
        </button>` : ''}
      </div>

      <!-- Статистика -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
        ${[
          { val: overdue.length, label: 'Просрочено', color: overdue.length ? '#f87171' : '#34d399' },
          { val: pending.length, label: 'Предстоит',  color: pending.length ? '#fbbf24' : '#94a3b8' },
          { val: done.length,    label: 'Сдано',       color: '#34d399' },
        ].map(s => `<div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${s.color}">${s.val}</div>
          <div style="font-size:10px;color:var(--muted2);margin-top:2px">${s.label}</div>
        </div>`).join('')}
      </div>

      ${overdue.length ? `
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head" style="border-bottom:1px solid rgba(248,113,113,0.15)">
          <div style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0"></div>
          <div class="panel-title" style="color:#f87171">Просроченные</div>
          <div class="panel-count">${overdue.length}</div>
        </div>
        <div style="padding-top:10px">${overdue.map(r => reportRowInPanel(r, clientId, submitted)).join('')}</div>
      </div>` : ''}

      ${pending.length ? `
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">
          <div style="width:6px;height:6px;border-radius:50%;background:#60a5fa;flex-shrink:0"></div>
          <div class="panel-title">Предстоящие отчёты</div>
          <div class="panel-count">${pending.length}</div>
        </div>
        <div style="padding-top:10px">${pending.map(r => reportRowInPanel(r, clientId, submitted)).join('')}</div>
      </div>` : ''}

      ${done.length ? `
      <details style="margin-bottom:12px">
        <summary style="
          display:flex;align-items:center;gap:10px;
          padding:11px 16px;background:rgba(255,255,255,0.02);
          border:1px solid var(--border);border-radius:10px;
          cursor:pointer;list-style:none;font-size:12px;font-weight:600;color:#475569;transition:background .15s"
          onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          Сданные отчёты
          <span style="background:rgba(52,211,153,0.1);color:#34d399;font-size:10px;padding:2px 8px;border-radius:8px;margin-left:auto">${done.length}</span>
        </summary>
        <div style="margin-top:8px">${done.map(r => reportRowInPanel(r, clientId, submitted)).join('')}</div>
      </details>` : ''}

      ${overdue.length === 0 && pending.length === 0 ? `
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:12px;padding:20px;text-align:center">
        <div style="font-size:20px;margin-bottom:6px">✅</div>
        <div style="font-size:13px;font-weight:700;color:#34d399">Все отчёты сданы</div>
      </div>` : ''}

      ${hasKrasnodar ? `
      <div style="margin-top:10px;padding:10px 14px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px;font-size:11px;color:#94a3b8;line-height:1.5">
        📎 Региональные отчёты — <b style="color:#fbbf24">kubzan.ru</b> · вход через Госуслуги (ЭЦП или SMS-пароль)
      </div>` : ''}

      <div style="font-size:10px;color:#334155;margin-top:12px;line-height:1.7">
        ЕФС-1 — Приказ СФР № 1462 от 17.11.2025 · Форма 1-Т — Приказ Росстата №348 от 22.07.2025 · Сроки с переносом на рабочий день
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════
//  ПРОИЗВОДСТВЕННЫЙ КАЛЕНДАРЬ
// ═══════════════════════════════════════════════════════

// Праздники и особые дни 2025-2026 (Россия)
const HOLIDAYS = {
  // 2025
  '2025-01-01':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-01-02':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-01-03':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-01-06':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-01-07':{ type:'holiday', name:'Рождество Христово' },
  '2025-01-08':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-02-24':{ type:'holiday', name:'День защитника Отечества (перенос)' },
  '2025-03-10':{ type:'holiday', name:'Международный женский день (перенос)' },
  '2025-05-01':{ type:'holiday', name:'Праздник Весны и Труда' },
  '2025-05-02':{ type:'holiday', name:'Выходной (перенос)' },
  '2025-05-08':{ type:'holiday', name:'Выходной (перенос)' },
  '2025-05-09':{ type:'holiday', name:'День Победы' },
  '2025-06-12':{ type:'holiday', name:'День России' },
  '2025-06-13':{ type:'holiday', name:'Выходной (перенос)' },
  '2025-11-04':{ type:'holiday', name:'День народного единства' },
  '2025-12-31':{ type:'holiday', name:'Новогодние каникулы' },
  // 2026
  '2026-01-01':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-02':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-05':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-06':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-07':{ type:'holiday', name:'Рождество Христово' },
  '2026-01-08':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-09':{ type:'holiday', name:'Новогодние каникулы (перенос 3 янв)' },
  '2026-02-23':{ type:'holiday', name:'День защитника Отечества' },
  '2026-03-09':{ type:'holiday', name:'Международный женский день (перенос)' },
  '2026-05-01':{ type:'holiday', name:'Праздник Весны и Труда' },
  '2026-05-04':{ type:'holiday', name:'Выходной (перенос)' },
  '2026-05-09':{ type:'holiday', name:'День Победы' },
  '2026-05-11':{ type:'holiday', name:'Выходной (перенос)' },
  '2026-06-12':{ type:'holiday', name:'День России' },
  '2026-06-15':{ type:'holiday', name:'Выходной (перенос)' },
  '2026-11-04':{ type:'holiday', name:'День народного единства' },
  '2026-12-31':{ type:'holiday', name:'Новогодние каникулы' },
  // Сокращённые дни 2026
  '2026-04-30':{ type:'short', name:'Предпраздничный день (−1 час)' },
  '2026-05-08':{ type:'short', name:'Предпраздничный день (−1 час)' },
  '2026-06-11':{ type:'short', name:'Предпраздничный день (−1 час)' },
  '2026-11-03':{ type:'short', name:'Предпраздничный день (−1 час)' },
};

let _calMonth = null; // текущий отображаемый месяц

function renderProductionCalendar(events = [], tasks = []) {
  const now = new Date();
  if (!_calMonth) _calMonth = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = _calMonth;

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  // Строим карту событий по датам
  const evMap = {};
  events.forEach(e => {
    const d = e.due_date?.slice(0,10);
    if (d) { if (!evMap[d]) evMap[d] = []; evMap[d].push({ label: e.title, color:'#60a5fa', client: e.client_name }); }
  });
  tasks.filter(t => !t.done && t.due_date).forEach(t => {
    const d = t.due_date?.slice(0,10);
    if (d) { if (!evMap[d]) evMap[d] = []; evMap[d].push({ label: t.title, color:'#fbbf24', client: t.client_name }); }
  });

  // Считаем рабочие дни месяца
  const daysInMonth = new Date(y, m+1, 0).getDate();
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = HOLIDAYS[key]?.type === 'holiday';
    if (!isWeekend && !isHoliday) workDays++;
  }

  // Первый день месяца (0=вс, нужно пн=0)
  const firstDay = new Date(y, m, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Строим ячейки
  let cells = '';
  // Пустые ячейки до начала
  for (let i = 0; i < startOffset; i++) cells += `<div></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const holiday = HOLIDAYS[key];
    const isHoliday = holiday?.type === 'holiday';
    const isShort = holiday?.type === 'short';
    const isToday = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
    const hasEvents = !!evMap[key];
    const evColors = hasEvents ? [...new Set(evMap[key].map(e => e.color))] : [];

    const bg = isToday ? 'var(--blue)' : isHoliday ? 'rgba(248,113,113,0.15)' : isWeekend ? 'rgba(255,255,255,0.04)' : 'transparent';
    const textCol = isToday ? '#fff' : isHoliday ? '#f87171' : isWeekend ? '#64748b' : isShort ? '#fbbf24' : 'var(--text)';
    const border = isToday ? '1px solid var(--blue)' : isShort ? '1px solid rgba(251,191,36,0.3)' : '1px solid transparent';
    const title = holiday?.name || (hasEvents ? evMap[key].map(e=>e.label+(e.client?' ('+e.client+')':'')).join(', ') : '');

    cells += `<div onclick="showCalendarDay('${key}')" style="
      height:30px;display:flex;flex-direction:column;align-items:center;justify-content:center;
      border-radius:6px;cursor:${hasEvents||holiday?'pointer':'default'};
      background:${bg};border:${border};
      transition:background .15s;position:relative;
      font-size:11px;font-weight:${isToday?'700':'500'};color:${textCol}
    " ${title?`title="${title}"`:''}
    onmouseover="if(!${isToday}) this.style.background='rgba(255,255,255,0.06)'"
    onmouseout="if(!${isToday}) this.style.background='${bg}'">
      ${d}
      ${hasEvents ? `<div style="display:flex;gap:2px;position:absolute;bottom:2px;justify-content:center">
        ${evColors.slice(0,3).map(c=>`<div style="width:3px;height:3px;border-radius:50%;background:${c}"></div>`).join('')}
      </div>` : ''}
      ${isShort ? `<div style="position:absolute;top:2px;right:2px;width:4px;height:4px;border-radius:50%;background:#fbbf24;opacity:.8"></div>` : ''}
    </div>`;
  }

  return `
    <div class="panel" id="prod-calendar">
      <div class="panel-head" style="margin-bottom:8px">
        <span>📅</span>
        <div class="panel-title">Производственный календарь</div>
        <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
          <button onclick="calNav(-1)" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:16px;line-height:1" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted2)'">‹</button>
          <span style="font-size:13px;font-weight:600;color:var(--text);min-width:130px;text-align:center">${monthNames[m]} ${y}</span>
          <button onclick="calNav(1)" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:16px;line-height:1" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted2)'">›</button>
        </div>
      </div>

      <!-- Дни недели -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:2px">
        ${dayNames.map((d,i) => `<div style="text-align:center;font-size:9px;font-weight:700;color:${i>=5?'#64748b':'var(--muted2)'};padding:2px 0">${d}</div>`).join('')}
      </div>

      <!-- Ячейки дней -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">
        ${cells}
      </div>

      <!-- Легенда + статистика -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05)">
        <div style="display:flex;gap:10px">
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b">
            <div style="width:7px;height:7px;border-radius:2px;background:rgba(248,113,113,0.3)"></div>Праздник
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b">
            <div style="width:7px;height:7px;border-radius:50%;background:#fbbf24"></div>Сокращённый
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b">
            <div style="width:7px;height:7px;border-radius:50%;background:#60a5fa"></div>Событие
          </div>
        </div>
        <div style="font-size:10px;color:#475569">${workDays} раб. дн.</div>
      </div>

      <!-- Попап событий дня -->
      <div id="cal-day-popup" style="display:none;margin-top:10px;padding:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;font-size:12px"></div>
    </div>`;
}

async function calNav(dir) {
  if (!_calMonth) { const n = new Date(); _calMonth = { y:n.getFullYear(), m:n.getMonth() }; }
  _calMonth.m += dir;
  if (_calMonth.m > 11) { _calMonth.m = 0; _calMonth.y++; }
  if (_calMonth.m < 0)  { _calMonth.m = 11; _calMonth.y--; }
  // Перерендерим только дашборд
  await renderDashboard();
}

function showCalendarDay(dateKey) {
  const popup = document.getElementById('cal-day-popup');
  if (!popup) return;

  const holiday = HOLIDAYS[dateKey];
  const items = [];

  if (holiday) {
    const col = holiday.type === 'holiday' ? '#f87171' : '#fbbf24';
    items.push(`<div style="color:${col};font-weight:600">${holiday.type === 'short' ? '⏰' : '🎉'} ${holiday.name}</div>`);
  }

  // Ищем события этого дня в глобальном state
  if (window._dashEvents) {
    window._dashEvents.filter(e => e.due_date?.slice(0,10) === dateKey).forEach(e => {
      items.push(`<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><div style="width:6px;height:6px;border-radius:50%;background:#60a5fa;flex-shrink:0"></div><div>${e.title}${e.client_name?' <span style="color:#475569">· '+e.client_name+'</span>':''}</div></div>`);
    });
    window._dashTasks?.filter(t => !t.done && t.due_date?.slice(0,10) === dateKey).forEach(t => {
      items.push(`<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div><div>${t.title}${t.client_name?' <span style="color:#475569">· '+t.client_name+'</span>':''}</div></div>`);
    });
  }

  if (!items.length) { popup.style.display = 'none'; return; }

  const d = new Date(dateKey);
  popup.innerHTML = `<div style="font-weight:700;color:var(--muted2);font-size:10px;letter-spacing:.5px;margin-bottom:8px">${d.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</div>${items.join('')}`;
  popup.style.display = 'block';
}

// ─── СТРАНИЦА ЕФС-1 ───────────────────────────────────────
async function renderEfs1Page(clientId) {
  const panel = document.getElementById('tab-reporting');
  if (!panel) return;

  const client = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId) || [];
  if (!client) return;

  const totalEmps = parseInt(client.staff || emps.length || 0);
  const hazardEmps = emps.filter(e => e.is_hazard || client.hazard_works).length || 0;
  const medEmps = parseInt(client.soat_med_req || 0);
  const invalidEmps = emps.filter(e => e.is_invalid).length || 0;

  panel.innerHTML = `
    <div style="max-width:700px">
      <!-- Шапка с кнопкой назад -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button onclick="renderClientReporting(${clientId})" style="
          display:flex;align-items:center;gap:6px;padding:7px 14px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;color:#64748b;font-size:12px;cursor:pointer">
          ← Назад
        </button>
        <div>
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">ЕФС-1 — Раздел 2</div>
          <div style="font-size:11px;color:#475569">Взносы на травматизм · ${safe(client.name)}</div>
        </div>
      </div>

      <!-- Кнопка перехода на сайт СФР -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);
        border-radius:12px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <div>
            <div style="font-size:13px;font-weight:700;color:#93c5fd">Подать ЕФС-1 онлайн</div>
            <div style="font-size:11px;color:#475569">Личный кабинет страхователя СФР · Вход через Госуслуги</div>
          </div>
        </div>
        <button onclick="window.api.openExternal('https://lk.sfr.gov.ru')" style="
          padding:9px 18px;background:linear-gradient(135deg,#2563eb,#3b82f6);
          border:none;border-radius:9px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;
          white-space:nowrap">
          Открыть lk.sfr.gov.ru
        </button>
      </div>

      <!-- Справка для бухгалтера -->
      <div style="background:rgba(15,21,32,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Справка для бухгалтера — подраздел 2.3 ЕФС-1</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Данные по СОУТ, медосмотрам и инвалидам из карточки клиента</div>
          </div>
          <button onclick="generateEFS1Memo(${clientId})" style="
            display:flex;align-items:center;gap:7px;padding:9px 16px;
            background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;
            border-radius:9px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Сформировать в Word
          </button>
        </div>

        <!-- Предпросмотр данных -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${[
            ['Всего рабочих мест', String(client.soat_total || totalEmps || '—')],
            ['Проведена СОУТ (р/мест)', String(client.soat_done || '—')],
            ['Класс 1 (оптимальные)', String(client.soat_c1 || 0)],
            ['Класс 2 (допустимые)', String(client.soat_c2 || 0)],
            ['Класс 3.1', String(client.soat_c31 || 0)],
            ['Класс 3.2', String(client.soat_c32 || 0)],
            ['Класс 3.3', String(client.soat_c33 || 0)],
            ['Класс 3.4', String(client.soat_c34 || 0)],
            ['Класс 4 (опасные)', String(client.soat_c4 || 0)],
            ['Подлежат медосмотрам', String(medEmps || '—')],
            ['Работают во вредных условиях', String(hazardEmps || '—')],
            ['Инвалиды', String(invalidEmps || '—')],
          ].map(([label, val]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 12px;background:rgba(255,255,255,0.02);border-radius:8px;
              border:1px solid rgba(255,255,255,0.05)">
              <span style="font-size:11px;color:#64748b">${label}</span>
              <span style="font-size:13px;font-weight:700;color:#e2e8f0">${val}</span>
            </div>`).join('')}
        </div>

        ${(!client.soat_total && !client.soat_done) ? `
          <div style="margin-top:12px;padding:10px 14px;background:rgba(251,191,36,0.07);
            border:1px solid rgba(251,191,36,0.2);border-radius:8px;font-size:11px;color:#94a3b8">
            Данные СОУТ не заполнены. Добавьте данные в карточке клиента (раздел «СОУТ — детализация для ЕФС-1») для формирования справки.
          </div>` : ''}
      </div>

      <!-- Сроки сдачи -->
      <div style="padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px">
        <div style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Сроки сдачи ЕФС-1 Раздел 2 в 2026 году</div>
        ${[
          ['I квартал', 'до 25 апреля'],
          ['Полугодие', 'до 25 июля'],
          ['9 месяцев', 'до 27 октября'],
          ['Год', 'до 26 января 2027'],
        ].map(([period, deadline]) => `
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="font-size:12px;color:#64748b">${period}</span>
            <span style="font-size:12px;font-weight:600;color:#e2e8f0">${deadline}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── СТРАНИЦА ОТЧЁТ ЦЗН ──────────────────────────────────
async function renderCznPage(clientId) {
  const panel = document.getElementById('tab-reporting');
  if (!panel) return;

  const client = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId) || [];
  if (!client) return;

  panel.innerHTML = `
    <div style="max-width:700px">
      <!-- Шапка с кнопкой назад -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button onclick="renderClientReporting(${clientId})" style="
          display:flex;align-items:center;gap:6px;padding:7px 14px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;color:#64748b;font-size:12px;cursor:pointer">
          ← Назад
        </button>
        <div>
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">Отчёт в ЦЗН — Краснодарский край</div>
          <div style="font-size:11px;color:#475569">Постановление №1591 от 21.12.2012 · ${safe(client.name)}</div>
        </div>
      </div>

      <!-- Кнопка перехода на kubzan.ru -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);
        border-radius:12px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <div>
            <div style="font-size:13px;font-weight:700;color:#fbbf24">Подать отчёт онлайн</div>
            <div style="font-size:11px;color:#475569">Интерактивный портал органов труда и занятости Краснодарского края</div>
          </div>
        </div>
        <button onclick="window.api.openExternal('https://kubzan.ru')" style="
          padding:9px 18px;background:linear-gradient(135deg,#d97706,#fbbf24);
          border:none;border-radius:9px;color:#1c1917;font-size:12px;font-weight:700;cursor:pointer;
          white-space:nowrap">
          Открыть kubzan.ru
        </button>
      </div>

      <!-- Генератор отчёта -->
      <div style="background:rgba(15,21,32,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin-bottom:20px">
        <div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:4px">Сформировать отчёт для заполнения</div>
        <div style="font-size:11px;color:#475569;margin-bottom:16px">
          КомплаенсПро заполнит все доступные поля из карточки клиента. Переменные данные (несчастные случаи, расходы) введите вручную.
        </div>

        <!-- Шаг 1: квартал + год -->
        <div style="font-size:11px;color:#475569;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Шаг 1 · Квартал</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr) 100px;gap:8px;margin-bottom:20px">
          ${[1,2,3,4].map(q => `
            <button onclick="cznSelectQuarter(${clientId}, ${q})" id="czn-q-btn-${q}" style="
              padding:9px 6px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;
              background:${CZN_STATE.quarter === q ? 'linear-gradient(135deg,#d97706,#fbbf24)' : 'rgba(255,255,255,0.05)'};
              border:1px solid ${CZN_STATE.quarter === q ? 'transparent' : 'rgba(255,255,255,0.1)'};
              color:${CZN_STATE.quarter === q ? '#1c1917' : '#94a3b8'}">
              ${['I','II','III','IV'][q-1]} кв.
            </button>`).join('')}
          <input type="number" id="czn-year" value="${CZN_STATE.year}" min="2020" max="2030"
            oninput="CZN_STATE.year = this.value"
            style="padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
        </div>

        <!-- Шаги 2-4 генерируются динамически в зависимости от выбранного квартала -->
        <div id="czn-steps"></div>
      </div>

      <!-- Сроки сдачи -->
      <div style="padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px">
        <div style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Сроки сдачи в ЦЗН в 2026 году</div>
        ${[
          ['I квартал (3 мес.)', 'до 5 апреля'],
          ['II квартал (6 мес.)', 'до 5 июля'],
          ['III квартал (9 мес.)', 'до 5 октября'],
          ['IV квартал (год)', 'до 5 января 2027'],
        ].map(([period, deadline]) => `
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="font-size:12px;color:#64748b">${period}</span>
            <span style="font-size:12px;font-weight:600;color:#e2e8f0">${deadline}</span>
          </div>`).join('')}
        <div style="margin-top:8px;font-size:10.5px;color:#334155">Подача через Личный кабинет на kubzan.ru или лично в ЦЗН по месту регистрации</div>
      </div>
    </div>`;

  cznRenderSteps(clientId, client, emps);
}

// ─── Состояние формы ЦЗН (квартал/отчёт/год) — сбрасывается при каждом
// открытии страницы через renderCznPage, живёт, пока страница открыта ──
const CZN_STATE = { quarter: 1, year: new Date().getFullYear(), report: '1' };

const CZN_QUARTER_MONTHS = { 1: '3', 2: '6', 3: '9', 4: '12' };
const CZN_QUARTER_LABEL  = { 1: 'I квартал', 2: 'II квартал', 3: 'III квартал', 4: 'IV квартал' };

function cznSelectQuarter(clientId, quarter) {
  CZN_STATE.quarter = quarter;
  // Для I/III квартала доступен только Отчёт 1 — если до этого был выбран
  // Отчёт 2 (переключились с II/IV), сбрасываем на единственно возможный.
  if ((quarter === 1 || quarter === 3) && CZN_STATE.report === '2') CZN_STATE.report = '1';
  renderCznPage(clientId);
}

function cznSelectReport(clientId, report) {
  CZN_STATE.report = report;
  window.api.clientGet(clientId).then(client =>
    window.api.employeesList(clientId).then(emps => cznRenderSteps(clientId, client, emps || []))
  );
}

// ─── Шаги 2-4: выбор отчёта + форма полей + кнопка генерации ─────────────
function cznRenderSteps(clientId, client, emps) {
  const container = document.getElementById('czn-steps');
  if (!container) return;

  const quarter = CZN_STATE.quarter;
  const showBothReports = quarter === 2 || quarter === 4; // II и IV — Отчёт 1 + Отчёт 2
  const report = CZN_STATE.report;

  const reportOptions = [
    { value: '1', label: 'О состоянии производственного травматизма и охраны труда' },
    { value: '2', label: 'Сведения о проведении СОУТ и состоянии условий труда' },
  ];

  container.innerHTML = `
    <!-- Шаг 2: выбор отчёта -->
    <div style="font-size:11px;color:#475569;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Шаг 2 · Отчёт</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      ${(showBothReports ? reportOptions : reportOptions.filter(o => o.value === '1')).map(o => `
        <div onclick="${showBothReports ? `cznSelectReport(${clientId}, '${o.value}')` : ''}" style="
          display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;cursor:${showBothReports ? 'pointer' : 'default'};
          background:${report === o.value ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)'};
          border:1px solid ${report === o.value ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}">
          <div style="width:16px;height:16px;border-radius:50%;flex-shrink:0;border:2px solid ${report === o.value ? '#fbbf24' : '#475569'};display:flex;align-items:center;justify-content:center">
            ${report === o.value ? '<div style="width:8px;height:8px;border-radius:50%;background:#fbbf24"></div>' : ''}
          </div>
          <div style="font-size:12.5px;color:${report === o.value ? '#f1f5f9' : '#94a3b8'}">${o.label}</div>
        </div>`).join('')}
      ${!showBothReports ? '<div style="font-size:10.5px;color:#334155;padding-left:2px">В I и III квартале сдаётся только этот отчёт</div>' : ''}
    </div>

    <!-- Шаг 3: форма -->
    <div style="font-size:11px;color:#475569;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Шаг 3 · Данные отчёта</div>
    ${report === '1' ? cznReport1FormHtml(client, emps) : cznReport2FormHtml(client, emps)}

    <!-- Шаг 4: кнопка генерации -->
    <button onclick="generateCznReport(${clientId})" style="
      width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
      padding:11px;background:linear-gradient(135deg,#d97706,#fbbf24);
      border:none;border-radius:10px;color:#1c1917;font-size:13px;font-weight:700;cursor:pointer">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Сформировать отчёт в Word
    </button>`;
}

// ─── Форма Отчёта 1 (травматизм и ОТ) — всегда доступен ──────────────────
// ─── Компактный хелпер для одного поля формы ЦЗН — чтобы не повторять
// разметку input+label на каждое из полусотни полей официальной формы ──
function cznField(id, label, value, opts) {
  opts = opts || {};
  const type = opts.type || 'number';
  const hint = opts.hint ? `<div style="font-size:9.5px;color:#334155;margin-top:2px">${opts.hint}</div>` : '';
  if (type === 'select') {
    const options = (opts.options || [['', '—'], ['да', 'Да'], ['нет', 'Нет']]);
    return `
      <div>
        <div style="font-size:10.5px;color:#475569;margin-bottom:3px;font-weight:600">${label}</div>
        <select id="${id}" style="width:100%;padding:7px 9px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#f1f5f9;font-size:11.5px;outline:none;cursor:pointer;box-sizing:border-box">
          ${options.map(([v, l]) => `<option value="${v}" ${String(value) === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>${hint}
      </div>`;
  }
  return `
    <div>
      <div style="font-size:10.5px;color:#475569;margin-bottom:3px;font-weight:600">${label}</div>
      <input type="${type}" id="${id}" value="${value ?? (type === 'number' ? 0 : '')}" ${type === 'number' ? 'min="0"' : ''}
        style="width:100%;padding:7px 9px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#f1f5f9;font-size:11.5px;outline:none;box-sizing:border-box">${hint}
    </div>`;
}

function cznSubheading(text) {
  return `<div style="font-size:10.5px;font-weight:700;color:#fbbf24;margin:16px 0 8px;padding-bottom:5px;border-bottom:1px solid rgba(251,191,36,0.15)">${text}</div>`;
}

function cznGrid(html, cols) {
  return `<div style="display:grid;grid-template-columns:repeat(${cols || 3},1fr);gap:8px;margin-bottom:10px">${html}</div>`;
}

function cznReport1FormHtml(client, emps) {
  const women = emps.filter(e => e.gender === 'Ж' || e.gender === 'female').length;
  const minors = emps.filter(e => {
    if (!e.birth_date) return false;
    const age = (new Date() - new Date(e.birth_date)) / (365.25 * 24 * 3600 * 1000);
    return age < 18;
  }).length;

  return `
    ${cznSubheading('Сведения об организации (шапка формы)')}
    ${cznGrid([
      cznField('czn-ogrn', 'ОГРН', client.ogrn || '', { type: 'text' }),
      cznField('czn-email', 'Email для контактов', client.email || '', { type: 'text' }),
    ].join(''), 2)}
    <div style="font-size:9.5px;color:#334155;margin-bottom:14px">Наименование, ОКВЭД, ИНН, адрес, руководитель и специалист по ОТ подставляются из карточки клиента автоматически.</div>

    <div style="padding:10px 14px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.15);border-radius:8px;margin-bottom:12px">
      <div style="font-size:11px;color:#60a5fa;font-weight:600;margin-bottom:3px">Данные запросите у бухгалтера</div>
      <div style="font-size:10.5px;color:#475569">Среднесписочная численность и расходы на ОТ рассчитываются бухгалтерией за отчётный период нарастающим итогом.</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div>
        <div style="font-size:11px;color:#475569;margin-bottom:4px;font-weight:600">Среднесписочная численность (чел.) *</div>
        <input type="number" id="czn-ssc" value="${parseInt(client.staff || emps.length || 0)}" min="1"
          oninput="_cznUpdateCostPerPerson()"
          style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(96,165,250,0.3);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
        <div style="font-size:10px;color:#334155;margin-top:3px">от бухгалтера · подставлен текущий штат</div>
      </div>
      <div>
        <div style="font-size:11px;color:#475569;margin-bottom:4px;font-weight:600">В том числе женщин (чел.)</div>
        <input type="number" id="czn-women" value="${women}" min="0"
          style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
        <div style="font-size:10px;color:#334155;margin-top:3px">подставлено из карточки сотрудников</div>
      </div>
      <div>
        <div style="font-size:11px;color:#475569;margin-bottom:4px;font-weight:600">В том числе несовершеннолетних (чел.)</div>
        <input type="number" id="czn-minors" value="${minors}" min="0"
          style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
        <div style="font-size:10px;color:#334155;margin-top:3px">по дате рождения из карточки</div>
      </div>
      <div>
        <div style="font-size:11px;color:#475569;margin-bottom:4px;font-weight:600">Расходы на ОТ (тыс. руб.) *</div>
        <input type="number" id="czn-costs" value="0" min="0" step="0.01"
          oninput="_cznUpdateCostPerPerson()"
          style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(96,165,250,0.3);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
        <div style="font-size:10px;color:#334155;margin-top:3px">пример: 540 000 руб. → вводите 540.00</div>
      </div>
      <div>
        <div style="font-size:11px;color:#475569;margin-bottom:4px;font-weight:600">Расходы на спорт (тыс. руб.)</div>
        <input type="number" id="czn-sport" value="0" min="0" step="0.01"
          style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <div style="font-size:11px;color:#475569;margin-bottom:4px;font-weight:600">На 1 работника (руб.) — авто</div>
        <div id="czn-cost-per-person" style="padding:8px 12px;background:rgba(52,211,153,0.05);border:1px solid rgba(52,211,153,0.2);border-radius:8px;color:#34d399;font-size:14px;font-weight:700;text-align:center">0</div>
        <div style="font-size:10px;color:#334155;margin-top:3px">расходы × 1000 ÷ среднесписочная</div>
      </div>
      <div>
        <div style="font-size:11px;color:#475569;margin-bottom:4px;font-weight:600">Несчастных случаев, всего (чел.)</div>
        <input type="number" id="czn-accidents" value="0" min="0"
          style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <div style="font-size:11px;color:#475569;margin-bottom:4px;font-weight:600">Дней нетрудоспособности</div>
        <input type="number" id="czn-days" value="0" min="0"
          style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
      </div>
    </div>

    ${cznSubheading('П.3–5 · Разбивка несчастных случаев по тяжести')}
    ${cznGrid([
      cznField('czn-inj-light', 'Лёгкие, всего', 0),
      cznField('czn-inj-light-w', 'из них женщин', 0),
      cznField('czn-inj-light-m', 'несовершеннолетних', 0),
      cznField('czn-inj-severe', 'Тяжёлые, всего', 0),
      cznField('czn-inj-severe-w', 'из них женщин', 0),
      cznField('czn-inj-severe-m', 'несовершеннолетних', 0),
      cznField('czn-inj-fatal', 'Смертельные, всего', 0),
      cznField('czn-inj-fatal-w', 'из них женщин', 0),
      cznField('czn-inj-fatal-m', 'несовершеннолетних', 0),
    ].join(''), 3)}
    ${cznGrid(cznField('czn-inj-group', 'П.6 · Кол-во групповых несчастных случаев', 0), 1)}

    ${cznSubheading('П.9 · Передовые формы и методы работы по ОТ')}
    ${cznGrid([
      cznField('czn-p9-count', 'Внедрено, всего', 0),
    ].join(''), 1)}
    <div style="margin-bottom:10px">
      <div style="font-size:10.5px;color:#475569;margin-bottom:3px;font-weight:600">Наименование мероприятий (место, дата внедрения, эффективность)</div>
      <textarea id="czn-p9-text" rows="2" placeholder="Необязательно"
        style="width:100%;padding:8px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#f1f5f9;font-size:11.5px;outline:none;box-sizing:border-box;resize:vertical"></textarea>
    </div>

    ${cznSubheading('П.10 · Финансирование предупредительных мер СФР')}
    ${cznGrid([
      cznField('czn-p10-decision', 'Получено решение СФР', 'нет', { type: 'select' }),
      cznField('czn-p10-amount', 'Объём средств СФР, тыс. руб.', 0),
    ].join(''), 2)}
    <div style="margin-bottom:16px">
      <div style="font-size:10.5px;color:#475569;margin-bottom:3px;font-weight:600">В том числе на мероприятия (перечислить, тыс. руб. по каждому)</div>
      <textarea id="czn-p10-text" rows="2" placeholder="Необязательно"
        style="width:100%;padding:8px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#f1f5f9;font-size:11.5px;outline:none;box-sizing:border-box;resize:vertical"></textarea>
    </div>`;
}

// ─── Форма Отчёта 2 (СОУТ и условия труда) — только II/IV квартал ────────
function cznReport2FormHtml(client, emps) {
  const medcheckDefault = emps.filter(e => e.medcheck_required).length;
  const totalEmps = emps.length || parseInt(client.staff || 0);

  // ── Матрица 1.1: строки × классы условий труда (11 столбцов данных) ──
  const matrixCols = [
    ['total', 'Всего мест'], ['done', 'Проведена оценка'],
    ['c1', 'Кл.1'], ['c2', 'Кл.2'], ['c31', '3.1'], ['c32', '3.2'], ['c33', '3.3'], ['c34', '3.4'], ['c4', 'Кл.4'],
    ['declared', 'Деклариров.'], ['improved', 'Улучшены'],
  ];
  const matrixRows = [
    ['workplaces', 'Рабочие места (ед.)'],
    ['workers', 'Работники (чел.)'],
    ['women', 'из них женщин'],
    ['minors', 'из них до 18 лет'],
    ['disabled', 'из них инвалидов'],
  ];
  const matrixHeaderCells = matrixCols.map(([, label]) => `<th style="padding:4px 3px;font-size:9px;color:#94a3b8;font-weight:600;border:1px solid rgba(255,255,255,0.08)">${label}</th>`).join('');
  const matrixBodyRows = matrixRows.map(([rowId, rowLabel]) => `
    <tr>
      <td style="padding:4px 6px;font-size:9.5px;color:#e2e8f0;border:1px solid rgba(255,255,255,0.08);white-space:nowrap">${rowLabel}</td>
      ${matrixCols.map(([colId]) => `
        <td style="border:1px solid rgba(255,255,255,0.08);padding:1px">
          <input type="number" id="czn-mx-${rowId}-${colId}"
            value="${rowId === 'workplaces' && colId === 'total' ? (client.soat_total || totalEmps || 0) : rowId === 'workplaces' && colId === 'done' ? (client.soat_done || 0) : rowId === 'workplaces' && client[`soat_${colId}`] !== undefined ? (client[`soat_${colId}`] || 0) : 0}"
            min="0" style="width:100%;padding:4px 2px;background:#0d1117;border:none;color:#f1f5f9;font-size:10px;outline:none;text-align:center;box-sizing:border-box">
        </td>`).join('')}
    </tr>`).join('');

  return `
    ${cznSubheading('Сведения об организации (шапка формы)')}
    ${cznGrid([
      cznField('czn-ogrn', 'ОГРН', client.ogrn || '', { type: 'text' }),
      cznField('czn-email', 'Email для контактов', client.email || '', { type: 'text' }),
    ].join(''), 2)}
    <div style="font-size:9.5px;color:#334155;margin-bottom:14px">Наименование, ОКВЭД, ИНН, адрес, руководитель и специалист по ОТ подставляются из карточки клиента автоматически.</div>

    ${cznSubheading('1.1 · Сведения о проведении СОУТ (за отчётный период)')}
    <div style="padding:8px 12px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.15);border-radius:8px;margin-bottom:10px">
      <div style="font-size:10.5px;color:#34d399;font-weight:600">Строка «Рабочие места» подставлена из карточки клиента, остальное — проверьте и заполните вручную.</div>
    </div>
    <div style="overflow-x:auto;margin-bottom:16px">
      <table style="border-collapse:collapse;width:100%;min-width:640px">
        <thead><tr><th style="padding:4px 6px;border:1px solid rgba(255,255,255,0.08)"></th>${matrixHeaderCells}</tr></thead>
        <tbody>${matrixBodyRows}</tbody>
      </table>
    </div>

    ${cznSubheading('1.2 · Сведения о действующей СОУТ')}
    ${cznGrid([
      cznField('czn-12-date', 'Дата утверждения отчёта о СОУТ', '', { type: 'date' }),
      cznField('czn-12-workplaces', 'Рабочих мест с действующей СОУТ', 0),
      cznField('czn-12-declared', 'Декларировано рабочих мест', 0),
    ].join(''), 3)}

    ${cznSubheading('2. Условия труда — вредные/опасные факторы')}
    ${cznGrid([
      cznField('czn-hazard-workers', 'Во вредных условиях, всего', 0),
      cznField('czn-hazard-women', 'из них женщин', 0),
      cznField('czn-medcheck-done', 'Прошли медосмотр, всего', medcheckDefault),
      cznField('czn-medcheck-women', 'из них женщин', 0),
      cznField('czn-medcheck-pct', 'Охват медосмотром, %', 0),
      cznField('czn-medcheck-women-pct', 'из них женщин, %', 0),
      cznField('czn-prof-disease', 'Выявлено с проф. заболеваниями', 0),
      cznField('czn-prof-disease-women', 'из них женщин', 0),
      cznField('czn-prof-disease-medcheck', 'в т.ч. выявлено на медосмотре', 0),
    ].join(''), 3)}
    <div style="font-size:9.5px;color:#334155;margin-bottom:6px">Гарантии и компенсации работникам во вредных условиях:</div>
    ${cznGrid([
      cznField('czn-comp-total', 'Получают гарантии, всего', 0),
      cznField('czn-comp-hours', 'Сокращённое раб. время', 0),
      cznField('czn-comp-vacation', 'Доп. отпуск', 0),
      cznField('czn-comp-pay', 'Повышенная оплата труда', 0),
      cznField('czn-comp-milk', 'Молоко / равноц. продукты', 0),
      cznField('czn-comp-food', 'Лечебно-профилакт. питание', 0),
    ].join(''), 3)}

    ${cznSubheading('2.1 · Специалист по ОТ и обучение работников')}
    <div style="font-size:9.5px;color:#334155;margin-bottom:6px">Освобождённый специалист по ОТ (по штатному расписанию):</div>
    ${cznGrid([
      cznField('czn-21-osv-count', 'Число человек', 0),
      cznField('czn-21-osv-edu', 'Высшее «Техносферная безопасность»', 'нет', { type: 'select' }),
      cznField('czn-21-osv-retrain', 'Прошли переподготовку по ОТ', 'нет', { type: 'select' }),
      cznField('czn-21-osv-date', 'Обучение по ОТ (месяц, год)', '', { type: 'text' }),
    ].join(''), 4)}
    <div style="font-size:9.5px;color:#334155;margin:8px 0 6px">Специалист с возложением обязанностей по ОТ:</div>
    ${cznGrid([
      cznField('czn-21-vozl-count', 'Число человек', client.ot_name ? 0 : 1),
      cznField('czn-21-vozl-date', 'Обучение по ОТ (месяц, год)', '', { type: 'text' }),
    ].join(''), 2)}
    <div style="font-size:9.5px;color:#334155;margin:8px 0 6px">Договор на оказание услуг по ОТ и СУОТ:</div>
    ${cznGrid([
      cznField('czn-21-contract', 'Организация, № и дата договора', client.contract_date ? `Договор от ${new Date(client.contract_date).toLocaleDateString('ru-RU')}` : '', { type: 'text' }),
      cznField('czn-21-suot', 'Положение о СУОТ (№ и дата приказа)', '', { type: 'text' }),
      cznField('czn-21-zero', 'Есть программа «нулевого травматизма»', 'нет', { type: 'select' }),
    ].join(''), 3)}
    <div style="font-size:9.5px;color:#334155;margin:8px 0 6px">Обучение по ОТ в аккредитованной организации (за 3 года):</div>
    ${cznGrid([
      cznField('czn-21-train-head', 'Руководитель (мес., год)', '', { type: 'text' }),
      cznField('czn-21-train-deputy', 'Зам. руководителя по ОТ (мес., год)', '', { type: 'text' }),
      cznField('czn-21-train-hazard', 'Во вредных условиях, чел.', 0),
      cznField('czn-21-train-workers', 'Рабочих профессий, чел.', 0),
      cznField('czn-21-train-heads-subj', 'Подлежит: руков. подразделений', 0),
      cznField('czn-21-train-heads-done', 'из них обучено', 0),
      cznField('czn-21-train-committee-subj', 'Членов комиссий по ОТ, всего', 0),
      cznField('czn-21-train-committee-done', 'из них обучено (чел., мес., год)', '', { type: 'text' }),
      cznField('czn-21-train-exam-subj', 'Членов комиссий по проверке знаний', 0),
      cznField('czn-21-train-exam-done', 'из них обучено (чел., мес., год)', '', { type: 'text' }),
      cznField('czn-21-train-auth-subj', 'Уполномоченных по ОТ, всего', 0),
      cznField('czn-21-train-auth-done', 'из них обучено (чел., мес., год)', '', { type: 'text' }),
    ].join(''), 3)}
    <div style="font-size:9.5px;color:#334155;margin:8px 0 6px">Обучение по ОТ в самой организации:</div>
    ${cznGrid([
      cznField('czn-21-self-total', 'Всего обучено, чел.', 0),
      cznField('czn-21-self-hazard', 'из них во вредных условиях', 0),
      cznField('czn-21-self-women', 'в т.ч. женщин', 0),
      cznField('czn-21-self-workers', 'из них рабочих профессий', 0),
    ].join(''), 4)}
    <div style="font-size:9.5px;color:#334155;margin:8px 0 6px">Оценка профессиональных рисков и микроповреждения:</div>
    ${cznGrid([
      cznField('czn-21-risk', 'Оценка профрисков проведена', 'нет', { type: 'select' }),
      cznField('czn-21-risk-self', 'Своими силами (мес., год)', '', { type: 'text' }),
      cznField('czn-21-risk-expert', 'Экспертной организацией (мес., год)', '', { type: 'text' }),
      cznField('czn-21-micro-lna', 'ЛНА по учёту микротравм (№, дата)', '', { type: 'text' }),
      cznField('czn-21-micro-total', 'Зарегистрировано микротравм, всего', 0),
      cznField('czn-21-micro-women', 'из них женщин', 0),
      cznField('czn-21-micro-minors', 'из них несовершеннолетних', 0),
    ].join(''), 3)}

    ${cznSubheading('2.3 · Обеспеченность средствами индивидуальной защиты')}
    ${cznGrid([
      cznField('czn-siz-required', 'Подлежат обеспечению СИЗ', client.hazard_works ? totalEmps : 0),
      cznField('czn-siz-done', 'Обеспечены в полном объёме', client.hazard_works ? totalEmps : 0),
      cznField('czn-siz-pct', 'В т.ч. в %, авто', 0),
      cznField('czn-siz-spent', 'Израсходовано на СИЗ, тыс. руб.', 0),
      cznField('czn-siz-per-person', 'из них на 1 работника, руб.', 0),
      cznField('czn-siz-accidents', 'Несчастных случаев из-за необеспеченности СИЗ', 0),
      cznField('czn-siz-accidents-fatal', 'из них со смертельным исходом', 0),
      cznField('czn-siz-accidents-severe', 'из них тяжёлых', 0),
      cznField('czn-siz-accidents-group', 'из них групповых', 0),
      cznField('czn-siz-prof-disease', 'Впервые выявлено проф. заболеваний из-за неприменения СИЗ', 0),
    ].join(''), 3)}

    ${cznSubheading('2.4 · Санитарно-бытовые помещения и устройства')}
    <div style="overflow-x:auto;margin-bottom:16px">
      <table style="border-collapse:collapse;width:100%;min-width:520px">
        <thead><tr>
          <th style="padding:4px 6px;font-size:9.5px;color:#94a3b8;border:1px solid rgba(255,255,255,0.08);text-align:left">Помещение</th>
          <th style="padding:4px 6px;font-size:9.5px;color:#94a3b8;border:1px solid rgba(255,255,255,0.08)">Необходимо по норме</th>
          <th style="padding:4px 6px;font-size:9.5px;color:#94a3b8;border:1px solid rgba(255,255,255,0.08)">Фактически</th>
        </tr></thead>
        <tbody>
          ${[
            ['garderobe', 'Гардеробные (шкафы/крючки)'],
            ['sinks', 'Умывальники'],
            ['toilets', 'Уборные'],
            ['water', 'Питьевое водоснабжение'],
            ['showers', 'Душевые сетки'],
            ['heating', 'Помещения для обогрева/охлаждения'],
          ].map(([id, label]) => `
            <tr>
              <td style="padding:4px 6px;font-size:10px;color:#e2e8f0;border:1px solid rgba(255,255,255,0.08)">${label}</td>
              <td style="border:1px solid rgba(255,255,255,0.08);padding:1px"><input type="number" id="czn-24-${id}-req" value="0" min="0" style="width:100%;padding:5px;background:#0d1117;border:none;color:#f1f5f9;font-size:10.5px;outline:none;text-align:center;box-sizing:border-box"></td>
              <td style="border:1px solid rgba(255,255,255,0.08);padding:1px"><input type="number" id="czn-24-${id}-fact" value="0" min="0" style="width:100%;padding:5px;background:#0d1117;border:none;color:#f1f5f9;font-size:10.5px;outline:none;text-align:center;box-sizing:border-box"></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${cznSubheading('2.5 · Общественный контроль охраны труда')}
    ${cznGrid([
      cznField('czn-25-committee', 'Есть комитет (комиссия) по ОТ', 'нет', { type: 'select' }),
      cznField('czn-25-authorized', 'Уполномоченных (доверенных) лиц по ОТ', 0),
      cznField('czn-25-ot-days', 'Проведено Дней охраны труда', 0),
      cznField('czn-25-cabinet', 'Есть кабинет по ОТ', 'нет', { type: 'select' }),
      cznField('czn-25-corners', 'Уголков по ОТ, шт.', 0),
    ].join(''), 3)}

    ${cznSubheading('2.6 · Развитие физической культуры и спорта')}
    ${cznGrid([
      cznField('czn-26-plan', 'Есть план мероприятий по улучшению условий и ОТ', 'нет', { type: 'select' }),
      cznField('czn-26-sport-plan', 'В т.ч. план физкультурно-спортивных мер', 'нет', { type: 'select' }),
      cznField('czn-26-compensation', 'Компенсация занятий спортом, чел.', 0),
      cznField('czn-26-gto', 'Мероприятия по ГТО, кол-во', 0),
      cznField('czn-26-events', 'Физкультурно-оздоровит. мероприятия, кол-во', 0),
      cznField('czn-26-equipment', 'Приобретение/обновление инвентаря, кол-во', 0),
      cznField('czn-26-facilities', 'Новые/реконструир. площадки, кол-во', 0),
      cznField('czn-26-clubs', 'Физкультурно-спортивные клубы, кол-во', 0),
    ].join(''), 3)}

    ${cznSubheading('2.7 · Медицинские подразделения организации')}
    ${cznGrid([
      cznField('czn-27-total', 'Всего медицинских подразделений', 0),
      cznField('czn-27-new', 'Открыто в текущем году', 0),
      cznField('czn-27-zdrav', 'Здравпунктов, кол-во', 0),
      cznField('czn-27-vrach', 'из них врачебных здравпунктов', 0),
      cznField('czn-27-other', 'Иные формы, кол-во', 0),
    ].join(''), 3)}`;
}


// ─── Автопересчёт стоимости на 1 работника ───────────────
function _cznUpdateCostPerPerson() {
  const ssc = parseFloat(document.getElementById('czn-ssc')?.value) || 0;
  const costs = parseFloat(document.getElementById('czn-costs')?.value) || 0;
  const perPerson = ssc > 0 ? Math.round(costs * 1000 / ssc) : 0;
  const el = document.getElementById('czn-cost-per-person');
  if (el) el.textContent = perPerson.toLocaleString('ru-RU') + ' руб.';
}

// ─── Генератор отчёта ЦЗН ────────────────────────────────
// Специалист по ОТ — если поле не заполнено явно, подставляем формулировку
// про возложение обязанностей на руководителя (п.3 задачи).
function cznOtSpecialistText(client) {
  if (client.ot_name) return `${client.ot_name}, ${client.ot_position || '—'}`;
  return `Обязанности специалиста по охране труда возложены на руководителя — ${client.manager_position || 'руководителя'} ${client.manager_name || client.director_name || '—'}`;
}

// Безопасное имя файла — убираем символы, недопустимые в путях Windows.
function cznSafeFilename(str) {
  return String(str || '').replace(/[\\/:*?"<>|«»]/g, '').trim().slice(0, 40);
}

// Читает значение поля формы по id, с запасным значением, если поля нет
// на странице (например, оно относится к другому отчёту) или оно пустое.
function cznVal(id, fallback) {
  const el = document.getElementById(id);
  if (!el) return fallback ?? '0';
  return el.value?.toString().trim() || (fallback ?? '0');
}

// ─── Общая шапка формы (табл. 0 официального бланка) — общая для обоих
// отчётов, т.к. оба генерируются как самостоятельные docx-файлы ─────────
function cznHeaderRows(client) {
  const ogrn = cznVal('czn-ogrn', client.ogrn || '—');
  const email = cznVal('czn-email', client.email || '—');
  return [
    { cells: [{ text: 'Сведения об организации', bold: true, colspan: 2, shading: 'EFF6FF', size: 22 }] },
    { cells: [{ text: 'Наименование организации (ИП)', width: 6000, size: 20 }, { text: safe(client.name) || '—', width: 3072, size: 20 }] },
    { cells: [{ text: 'ОКВЭД', size: 20 }, { text: safe(client.okved) || '—', size: 20 }] },
    { cells: [{ text: 'ИНН', size: 20 }, { text: safe(client.inn) || '—', size: 20 }] },
    { cells: [{ text: 'ОГРН', size: 20 }, { text: ogrn, size: 20 }] },
    { cells: [{ text: 'Юридический адрес', size: 20 }, { text: safe(client.address) || '—', size: 20 }] },
    { cells: [{ text: 'Фактический адрес', size: 20 }, { text: safe(client.address_actual) || safe(client.address) || '—', size: 20 }] },
    { cells: [{ text: 'Руководитель (должность, ФИО)', size: 20 }, { text: `${safe(client.manager_position) || '—'}, ${safe(client.manager_name) || '—'}`, size: 20 }] },
    { cells: [{ text: 'Специалист по ОТ (должность, ФИО)', size: 20 }, { text: cznOtSpecialistText(client), size: 20 }] },
    { cells: [{ text: 'Контактный телефон', size: 20 }, { text: safe(client.phone) || '—', size: 20 }] },
    { cells: [{ text: 'Email', size: 20 }, { text: email, size: 20 }] },
  ];
}

async function generateCznReport(clientId) {
  const client = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId) || [];
  if (!client) return;

  const quarter = CZN_STATE.quarter;
  const year = document.getElementById('czn-year')?.value || CZN_STATE.year;
  const periodText = CZN_QUARTER_MONTHS[quarter];
  const quarterLabel = CZN_QUARTER_LABEL[quarter];
  const report = CZN_STATE.report;

  const btn = document.querySelector('button[onclick="generateCznReport(' + clientId + ')"]');
  if (btn) { btn.textContent = 'Формирую…'; btn.disabled = true; }

  try {
    if (report === '1') {
      await cznGenerateReport1(clientId, client, emps, periodText, quarterLabel, year);
    } else {
      await cznGenerateReport2(clientId, client, emps, periodText, quarterLabel, year);
    }
    showToast('Отчёт ЦЗН сформирован ✓');
  } catch (e) {
    showToast('Ошибка: ' + (e.message || e), 'var(--red)');
  } finally {
    if (btn) { btn.textContent = 'Сформировать отчёт в Word'; btn.disabled = false; }
  }
}

// ─── Отчёт 1: о состоянии производственного травматизма и охраны труда ───
async function cznGenerateReport1(clientId, client, emps, periodText, quarterLabel, year) {
  const ssc = cznVal('czn-ssc', String(client.staff || emps.length || 0));
  const women = cznVal('czn-women');
  const minors = cznVal('czn-minors');
  const accidents = cznVal('czn-accidents');
  const days = cznVal('czn-days');
  const costs = cznVal('czn-costs');
  const sport = cznVal('czn-sport');
  const costPerPerson = parseInt(ssc) > 0 ? Math.round(parseFloat(costs) * 1000 / parseInt(ssc)) : 0;

  const injLight = cznVal('czn-inj-light'), injLightW = cznVal('czn-inj-light-w'), injLightM = cznVal('czn-inj-light-m');
  const injSevere = cznVal('czn-inj-severe'), injSevereW = cznVal('czn-inj-severe-w'), injSevereM = cznVal('czn-inj-severe-m');
  const injFatal = cznVal('czn-inj-fatal'), injFatalW = cznVal('czn-inj-fatal-w'), injFatalM = cznVal('czn-inj-fatal-m');
  const injGroup = cznVal('czn-inj-group');
  const p9Count = cznVal('czn-p9-count');
  const p9Text = document.getElementById('czn-p9-text')?.value.trim() || '';
  const p10Decision = cznVal('czn-p10-decision', 'нет');
  const p10Amount = cznVal('czn-p10-amount');
  const p10Text = document.getElementById('czn-p10-text')?.value.trim() || '';

  const sections = [
    { heading: null, rows: cznHeaderRows(client) },
    {
      heading: '1. О состоянии производственного травматизма и охраны труда',
      note: `${quarterLabel} — за ${periodText} месяцев ${year} г. (до 5-го числа следующего месяца)`,
      rows: [
        { cells: [{ text: 'Показатель', bold: true, width: 6000, shading: 'F1F5F9', size: 20 }, { text: 'Значение', bold: true, width: 3072, shading: 'F1F5F9', center: true, size: 20 }] },
        { cells: [{ text: '1. Среднесписочная численность работников, всего человек', width: 6000, size: 20 }, { text: ssc, width: 3072, center: true, size: 20 }] },
        { cells: [{ text: '   в том числе женщин', size: 20 }, { text: women, center: true, size: 20 }] },
        { cells: [{ text: '   несовершеннолетних', size: 20 }, { text: minors, center: true, size: 20 }] },
        { cells: [{ text: '2. Численность пострадавших при несчастных случаях, всего человек', size: 20 }, { text: accidents, center: true, size: 20 }] },
        { cells: [{ text: '3. Из них с лёгкой степенью тяжести, всего человек', size: 20 }, { text: injLight, center: true, size: 20 }] },
        { cells: [{ text: '   в том числе женщин', size: 20 }, { text: injLightW, center: true, size: 20 }] },
        { cells: [{ text: '   несовершеннолетних', size: 20 }, { text: injLightM, center: true, size: 20 }] },
        { cells: [{ text: '4. Из них с тяжёлой степенью тяжести, всего человек', size: 20 }, { text: injSevere, center: true, size: 20 }] },
        { cells: [{ text: '   в том числе женщин', size: 20 }, { text: injSevereW, center: true, size: 20 }] },
        { cells: [{ text: '   несовершеннолетних', size: 20 }, { text: injSevereM, center: true, size: 20 }] },
        { cells: [{ text: '5. Из них со смертельным исходом, всего человек', size: 20 }, { text: injFatal, center: true, size: 20 }] },
        { cells: [{ text: '   в том числе женщин', size: 20 }, { text: injFatalW, center: true, size: 20 }] },
        { cells: [{ text: '   несовершеннолетних', size: 20 }, { text: injFatalM, center: true, size: 20 }] },
        { cells: [{ text: '6. Количество групповых несчастных случаев', size: 20 }, { text: injGroup, center: true, size: 20 }] },
        { cells: [{ text: '7. Количество дней утраты трудоспособности (человеко-дней)', size: 20 }, { text: days, center: true, size: 20 }] },
        { cells: [{ text: '8. Израсходовано средств на охрану труда за отчётный период, всего тыс. руб.', size: 20 }, { text: costs, center: true, size: 20 }] },
        { cells: [{ text: '   из них на физкультуру и спорт, тыс. руб.', size: 20 }, { text: sport, center: true, size: 20 }] },
        { cells: [{ text: '   в том числе на 1 работающего (без затрат на спорт), руб.', size: 20 }, { text: String(costPerPerson), center: true, size: 20 }] },
        { cells: [{ text: '9. Внедрено передовых форм и методов работы по ОТ, всего', size: 20 }, { text: p9Count, center: true, size: 20 }] },
        { cells: [{ text: '9.1 Наименование мероприятий, место и дата внедрения, эффективность', size: 20 }, { text: p9Text || '—', size: 20 }] },
        { cells: [{ text: '10. Получено решение СФР о финансировании предупредительных мер', size: 20 }, { text: p10Decision === 'да' ? 'Да' : 'Нет', center: true, size: 20 }] },
        { cells: [{ text: '10.1 Объём средств СФР на предупредительные меры, тыс. руб.', size: 20 }, { text: p10Amount, center: true, size: 20 }] },
        { cells: [{ text: '   в том числе на мероприятия', size: 20 }, { text: p10Text || '—', size: 20 }] },
      ],
    },
  ];

  await window.api.docxGenerate({
    sections,
    title: `Отчёт о состоянии производственного травматизма и охраны труда за ${quarterLabel.toLowerCase()} ${year} г.`,
    subtitle: `${client.name} · ИНН: ${client.inn || '—'} · Краснодарский край · Постановление №1591 от 21.12.2012`,
    filename: `Отчёт_ЦЗН_травматизм_${periodText === '3' ? '1' : periodText === '6' ? '2' : periodText === '9' ? '3' : '4'}кв_${year}_${cznSafeFilename(client.name)}`,
  });
}

// ─── Отчёт 2: сведения о проведении СОУТ и состоянии условий труда ───────
async function cznGenerateReport2(clientId, client, emps, periodText, quarterLabel, year) {
  const matrixCols = ['total','done','c1','c2','c31','c32','c33','c34','c4','declared','improved'];
  const matrixColLabels = { total:'Всего мест', done:'Проведена оценка', c1:'Класс 1', c2:'Класс 2', c31:'Класс 3.1', c32:'Класс 3.2', c33:'Класс 3.3', c34:'Класс 3.4', c4:'Класс 4', declared:'Декларировано', improved:'Улучшены условия' };
  const matrixRows = ['workplaces','workers','women','minors','disabled'];
  const matrixRowLabels = { workplaces:'Рабочие места (ед.)', workers:'Работники (чел.)', women:'из них женщин', minors:'из них до 18 лет', disabled:'из них инвалидов' };

  const matrixDocRows = [
    { cells: [{ text: '', width: 2400, shading: 'F1F5F9', size: 16 }, ...matrixCols.map(c => ({ text: matrixColLabels[c], bold: true, shading: 'F1F5F9', center: true, size: 14 }))] },
    ...matrixRows.map(r => ({
      cells: [{ text: matrixRowLabels[r], width: 2400, size: 16 }, ...matrixCols.map(c => ({ text: cznVal(`czn-mx-${r}-${c}`), center: true, size: 16 }))],
    })),
  ];

  const dateStr = document.getElementById('czn-12-date')?.value || '';

  const trainSubsectionRows = [
    { cells: [{ text: 'Освобождённый специалист по ОТ, всего человек', size: 20 }, { text: cznVal('czn-21-osv-count'), center: true, size: 20 }] },
    { cells: [{ text: '   имеют высшее «Техносферная безопасность»', size: 20 }, { text: cznVal('czn-21-osv-edu','нет') === 'да' ? 'Да' : 'Нет', center: true, size: 20 }] },
    { cells: [{ text: '   прошли переподготовку по ОТ', size: 20 }, { text: cznVal('czn-21-osv-retrain','нет') === 'да' ? 'Да' : 'Нет', center: true, size: 20 }] },
    { cells: [{ text: '   прошли обучение по ОТ (мес., год)', size: 20 }, { text: document.getElementById('czn-21-osv-date')?.value.trim() || '—', center: true, size: 20 }] },
    { cells: [{ text: 'Специалист с возложением обязанностей по ОТ, чел.', size: 20 }, { text: cznVal('czn-21-vozl-count'), center: true, size: 20 }] },
    { cells: [{ text: '   прошли обучение по ОТ (мес., год)', size: 20 }, { text: document.getElementById('czn-21-vozl-date')?.value.trim() || '—', center: true, size: 20 }] },
    { cells: [{ text: 'Договор на оказание услуг по ОТ (организация, № и дата)', size: 20 }, { text: document.getElementById('czn-21-contract')?.value.trim() || '—', size: 20 }] },
    { cells: [{ text: 'Положение о СУОТ (№ и дата приказа)', size: 20 }, { text: document.getElementById('czn-21-suot')?.value.trim() || '—', size: 20 }] },
    { cells: [{ text: '   в т.ч. программа «нулевого травматизма»', size: 20 }, { text: cznVal('czn-21-zero','нет') === 'да' ? 'Да' : 'Нет', center: true, size: 20 }] },
    { cells: [{ text: 'Обучение руководителя (мес., год)', size: 20 }, { text: document.getElementById('czn-21-train-head')?.value.trim() || '—', center: true, size: 20 }] },
    { cells: [{ text: 'Обучение зам. руководителя по ОТ (мес., год)', size: 20 }, { text: document.getElementById('czn-21-train-deputy')?.value.trim() || '—', center: true, size: 20 }] },
    { cells: [{ text: 'Обучено работающих во вредных условиях, чел.', size: 20 }, { text: cznVal('czn-21-train-hazard'), center: true, size: 20 }] },
    { cells: [{ text: 'Обучено работников рабочих профессий, чел.', size: 20 }, { text: cznVal('czn-21-train-workers'), center: true, size: 20 }] },
    { cells: [{ text: 'Подлежит обучению руководителей подразделений, чел.', size: 20 }, { text: cznVal('czn-21-train-heads-subj'), center: true, size: 20 }] },
    { cells: [{ text: '   из них обучено', size: 20 }, { text: cznVal('czn-21-train-heads-done'), center: true, size: 20 }] },
    { cells: [{ text: 'Членов комиссий по ОТ, всего чел.', size: 20 }, { text: cznVal('czn-21-train-committee-subj'), center: true, size: 20 }] },
    { cells: [{ text: '   из них обучено (чел., мес., год)', size: 20 }, { text: document.getElementById('czn-21-train-committee-done')?.value.trim() || '—', size: 20 }] },
    { cells: [{ text: 'Членов комиссий по проверке знаний, всего чел.', size: 20 }, { text: cznVal('czn-21-train-exam-subj'), center: true, size: 20 }] },
    { cells: [{ text: '   из них обучено (чел., мес., год)', size: 20 }, { text: document.getElementById('czn-21-train-exam-done')?.value.trim() || '—', size: 20 }] },
    { cells: [{ text: 'Уполномоченных по ОТ, всего чел.', size: 20 }, { text: cznVal('czn-21-train-auth-subj'), center: true, size: 20 }] },
    { cells: [{ text: '   из них обучено (чел., мес., год)', size: 20 }, { text: document.getElementById('czn-21-train-auth-done')?.value.trim() || '—', size: 20 }] },
    { cells: [{ text: 'Обучено по ОТ в самой организации, всего чел.', size: 20 }, { text: cznVal('czn-21-self-total'), center: true, size: 20 }] },
    { cells: [{ text: '   из них во вредных условиях', size: 20 }, { text: cznVal('czn-21-self-hazard'), center: true, size: 20 }] },
    { cells: [{ text: '   в т.ч. женщин', size: 20 }, { text: cznVal('czn-21-self-women'), center: true, size: 20 }] },
    { cells: [{ text: '   из них рабочих профессий', size: 20 }, { text: cznVal('czn-21-self-workers'), center: true, size: 20 }] },
    { cells: [{ text: 'Оценка профессиональных рисков проведена', size: 20 }, { text: cznVal('czn-21-risk','нет') === 'да' ? 'Да' : 'Нет', center: true, size: 20 }] },
    { cells: [{ text: '   своими силами (мес., год)', size: 20 }, { text: document.getElementById('czn-21-risk-self')?.value.trim() || '—', center: true, size: 20 }] },
    { cells: [{ text: '   экспертной организацией (мес., год)', size: 20 }, { text: document.getElementById('czn-21-risk-expert')?.value.trim() || '—', center: true, size: 20 }] },
    { cells: [{ text: 'ЛНА по учёту микротравм (№ и дата приказа)', size: 20 }, { text: document.getElementById('czn-21-micro-lna')?.value.trim() || '—', size: 20 }] },
    { cells: [{ text: 'Зарегистрировано микротравм, всего чел.', size: 20 }, { text: cznVal('czn-21-micro-total'), center: true, size: 20 }] },
    { cells: [{ text: '   из них женщин', size: 20 }, { text: cznVal('czn-21-micro-women'), center: true, size: 20 }] },
    { cells: [{ text: '   несовершеннолетних', size: 20 }, { text: cznVal('czn-21-micro-minors'), center: true, size: 20 }] },
  ];

  const sanitaryLabels = { garderobe:'Гардеробные (шкафы/крючки)', sinks:'Умывальники', toilets:'Уборные', water:'Питьевое водоснабжение', showers:'Душевые сетки', heating:'Помещения для обогрева/охлаждения' };
  const sanitaryRows = [
    { cells: [{ text: 'Помещение', bold: true, width: 4500, shading: 'F1F5F9', size: 18 }, { text: 'Необходимо', bold: true, shading: 'F1F5F9', center: true, size: 18 }, { text: 'Фактически', bold: true, shading: 'F1F5F9', center: true, size: 18 }] },
    ...Object.keys(sanitaryLabels).map(id => ({
      cells: [
        { text: sanitaryLabels[id], width: 4500, size: 18 },
        { text: cznVal(`czn-24-${id}-req`), center: true, size: 18 },
        { text: cznVal(`czn-24-${id}-fact`), center: true, size: 18 },
      ],
    })),
  ];

  const sections = [
    { heading: null, rows: cznHeaderRows(client) },
    {
      heading: '1.1 Сведения о проведении СОУТ (за отчётный период)',
      note: `${quarterLabel} — за ${periodText} месяцев ${year} г.`,
      rows: matrixDocRows,
    },
    {
      heading: '1.2 Сведения о действующей СОУТ',
      rows: [
        { cells: [{ text: 'Дата утверждения отчёта о СОУТ', width: 6000, size: 20 }, { text: dateStr ? new Date(dateStr).toLocaleDateString('ru-RU') : '—', width: 3072, center: true, size: 20 }] },
        { cells: [{ text: 'Рабочих мест с действующей СОУТ', size: 20 }, { text: cznVal('czn-12-workplaces'), center: true, size: 20 }] },
        { cells: [{ text: 'Декларировано рабочих мест', size: 20 }, { text: cznVal('czn-12-declared'), center: true, size: 20 }] },
      ],
    },
    {
      heading: '2. О состоянии условий труда и организации работ по охране труда',
      rows: [
        { cells: [{ text: 'Во вредных условиях, всего человек', width: 6000, size: 20 }, { text: cznVal('czn-hazard-workers'), width: 3072, center: true, size: 20 }] },
        { cells: [{ text: '   в том числе женщин', size: 20 }, { text: cznVal('czn-hazard-women'), center: true, size: 20 }] },
        { cells: [{ text: 'Прошли периодический медосмотр, всего человек', size: 20 }, { text: cznVal('czn-medcheck-done'), center: true, size: 20 }] },
        { cells: [{ text: '   в т.ч. женщин', size: 20 }, { text: cznVal('czn-medcheck-women'), center: true, size: 20 }] },
        { cells: [{ text: 'Охват медосмотром, %', size: 20 }, { text: cznVal('czn-medcheck-pct'), center: true, size: 20 }] },
        { cells: [{ text: '   в т.ч. женщин, %', size: 20 }, { text: cznVal('czn-medcheck-women-pct'), center: true, size: 20 }] },
        { cells: [{ text: 'Выявлено лиц с проф. заболеваниями, всего человек', size: 20 }, { text: cznVal('czn-prof-disease'), center: true, size: 20 }] },
        { cells: [{ text: '   из них женщин', size: 20 }, { text: cznVal('czn-prof-disease-women'), center: true, size: 20 }] },
        { cells: [{ text: '   в т.ч. выявлено на медосмотре', size: 20 }, { text: cznVal('czn-prof-disease-medcheck'), center: true, size: 20 }] },
        { cells: [{ text: 'Получают гарантии и компенсации, всего человек', size: 20 }, { text: cznVal('czn-comp-total'), center: true, size: 20 }] },
        { cells: [{ text: '   сокращённая продолжительность рабочего времени', size: 20 }, { text: cznVal('czn-comp-hours'), center: true, size: 20 }] },
        { cells: [{ text: '   дополнительный отпуск', size: 20 }, { text: cznVal('czn-comp-vacation'), center: true, size: 20 }] },
        { cells: [{ text: '   повышенная оплата труда', size: 20 }, { text: cznVal('czn-comp-pay'), center: true, size: 20 }] },
        { cells: [{ text: '   молоко или другие равноценные продукты', size: 20 }, { text: cznVal('czn-comp-milk'), center: true, size: 20 }] },
        { cells: [{ text: '   лечебно-профилактическое питание', size: 20 }, { text: cznVal('czn-comp-food'), center: true, size: 20 }] },
      ],
    },
    {
      heading: '2.1 Сведения о службе (специалистах) по ОТ и обучении работников',
      rows: trainSubsectionRows,
    },
    {
      heading: '2.3 Сведения об обеспеченности работников СИЗ',
      rows: [
        { cells: [{ text: 'Подлежат обеспечению СИЗ, всего человек', width: 6000, size: 20 }, { text: cznVal('czn-siz-required'), width: 3072, center: true, size: 20 }] },
        { cells: [{ text: 'Обеспечены СИЗ в полном объёме, всего человек', size: 20 }, { text: cznVal('czn-siz-done'), center: true, size: 20 }] },
        { cells: [{ text: '   в т.ч. в %', size: 20 }, { text: cznVal('czn-siz-pct'), center: true, size: 20 }] },
        { cells: [{ text: 'Израсходовано средств на СИЗ, тыс. руб.', size: 20 }, { text: cznVal('czn-siz-spent'), center: true, size: 20 }] },
        { cells: [{ text: '   в т.ч. на 1 работника, руб.', size: 20 }, { text: cznVal('czn-siz-per-person'), center: true, size: 20 }] },
        { cells: [{ text: 'Несчастных случаев из-за необеспеченности СИЗ, всего', size: 20 }, { text: cznVal('czn-siz-accidents'), center: true, size: 20 }] },
        { cells: [{ text: '   из них со смертельным исходом', size: 20 }, { text: cznVal('czn-siz-accidents-fatal'), center: true, size: 20 }] },
        { cells: [{ text: '   из них тяжёлых', size: 20 }, { text: cznVal('czn-siz-accidents-severe'), center: true, size: 20 }] },
        { cells: [{ text: '   из них групповых', size: 20 }, { text: cznVal('czn-siz-accidents-group'), center: true, size: 20 }] },
        { cells: [{ text: 'Впервые выявлено проф. заболеваний из-за неприменения СИЗ', size: 20 }, { text: cznVal('czn-siz-prof-disease'), center: true, size: 20 }] },
      ],
    },
    {
      heading: '2.4 Сведения об обеспеченности санитарно-бытовыми помещениями',
      rows: sanitaryRows,
    },
    {
      heading: '2.5 Сведения об общественном контроле охраны труда',
      rows: [
        { cells: [{ text: 'Наличие комитета (комиссии) по ОТ', width: 6000, size: 20 }, { text: cznVal('czn-25-committee','нет') === 'да' ? 'Да' : 'Нет', width: 3072, center: true, size: 20 }] },
        { cells: [{ text: 'Число уполномоченных (доверенных) лиц по ОТ', size: 20 }, { text: cznVal('czn-25-authorized'), center: true, size: 20 }] },
        { cells: [{ text: 'Проведено Дней охраны труда', size: 20 }, { text: cznVal('czn-25-ot-days'), center: true, size: 20 }] },
        { cells: [{ text: 'Наличие кабинета по ОТ', size: 20 }, { text: cznVal('czn-25-cabinet','нет') === 'да' ? 'Да' : 'Нет', center: true, size: 20 }] },
        { cells: [{ text: 'Количество уголков по ОТ, шт.', size: 20 }, { text: cznVal('czn-25-corners'), center: true, size: 20 }] },
      ],
    },
    {
      heading: '2.6 Сведения о реализации мероприятий по физической культуре и спорту',
      rows: [
        { cells: [{ text: 'Наличие плана мероприятий по улучшению условий и ОТ', width: 6000, size: 20 }, { text: cznVal('czn-26-plan','нет') === 'да' ? 'Да' : 'Нет', width: 3072, center: true, size: 20 }] },
        { cells: [{ text: '   в т.ч. план физкультурно-спортивных мероприятий', size: 20 }, { text: cznVal('czn-26-sport-plan','нет') === 'да' ? 'Да' : 'Нет', center: true, size: 20 }] },
        { cells: [{ text: 'Компенсация занятий спортом, чел.', size: 20 }, { text: cznVal('czn-26-compensation'), center: true, size: 20 }] },
        { cells: [{ text: 'Мероприятия по ГТО, кол-во', size: 20 }, { text: cznVal('czn-26-gto'), center: true, size: 20 }] },
        { cells: [{ text: 'Физкультурно-оздоровительные мероприятия, кол-во', size: 20 }, { text: cznVal('czn-26-events'), center: true, size: 20 }] },
        { cells: [{ text: 'Приобретение/обновление спортинвентаря, кол-во', size: 20 }, { text: cznVal('czn-26-equipment'), center: true, size: 20 }] },
        { cells: [{ text: 'Новые/реконструированные спортплощадки, кол-во', size: 20 }, { text: cznVal('czn-26-facilities'), center: true, size: 20 }] },
        { cells: [{ text: 'Физкультурно-спортивные клубы, кол-во', size: 20 }, { text: cznVal('czn-26-clubs'), center: true, size: 20 }] },
      ],
    },
    {
      heading: '2.7 Сведения о медицинских подразделениях организации',
      rows: [
        { cells: [{ text: 'Всего медицинских подразделений', width: 6000, size: 20 }, { text: cznVal('czn-27-total'), width: 3072, center: true, size: 20 }] },
        { cells: [{ text: '   открыто в текущем году', size: 20 }, { text: cznVal('czn-27-new'), center: true, size: 20 }] },
        { cells: [{ text: '   в т.ч. здравпунктов', size: 20 }, { text: cznVal('czn-27-zdrav'), center: true, size: 20 }] },
        { cells: [{ text: '      из них врачебных', size: 20 }, { text: cznVal('czn-27-vrach'), center: true, size: 20 }] },
        { cells: [{ text: '   иные формы', size: 20 }, { text: cznVal('czn-27-other'), center: true, size: 20 }] },
      ],
    },
  ];

  await window.api.docxGenerate({
    sections,
    title: `Сведения о проведении СОУТ и состоянии условий труда за ${quarterLabel.toLowerCase()} ${year} г.`,
    subtitle: `${client.name} · ИНН: ${client.inn || '—'} · Краснодарский край · Постановление №1591 от 21.12.2012`,
    filename: `Отчёт_ЦЗН_СОУТ_${periodText === '6' ? '2' : '4'}кв_${year}_${cznSafeFilename(client.name)}`,
  });
}


function safe(v) { return String(v || ''); }
