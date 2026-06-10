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
    { name:'Форма № 1-Т (условия труда)', period:'За год', due:`${year+1}-01-21`, org:'Росстат', freq:'Ежегодно', note:'Новая форма с 01.03.2026 (Приказ Росстата № 338).' },
    { name:'Форма № 7-травматизм', period:'За год', due:`${year+1}-01-26`, org:'Росстат', freq:'Ежегодно', note:'Сведения о травматизме и профзаболеваниях.' },
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
  let reports = getFederalReports(year).map(r => ({ ...r, scope:'federal' }));
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
        ЕФС-1 — Приказ СФР № 1462 от 17.11.2025 · Форма 1-Т — Приказ Росстата № 338 от 01.03.2026
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
        ЕФС-1 — Приказ СФР № 1462 от 17.11.2025 · Форма 1-Т — Приказ Росстата № 338 от 01.03.2026 · Сроки с переносом на рабочий день
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
