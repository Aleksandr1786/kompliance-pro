// ============================================================
// КОМПЛАЕНСПРО — dashboard.js
// Дашборд: режим А (Аутсорсер) и режим Б (Штатный специалист)
// Обновлён: 09.06.2026
// ============================================================

// Экранирование HTML для текста, который может содержать данные не под
// полным нашим контролем (заголовки автозадач от НПА-мониторинга, AI-
// сводки npa_summary, имена клиентов) перед вставкой в innerHTML — иначе
// случайный "<" или "&quot;" в тексте сломал бы вёрстку или, в худшем
// случае, выполнился бы как HTML/атрибут внутри окна приложения.
// Определяем один раз глобально (см. также npa-audit.js — та же функция).
if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  };
}

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

  // Режим В — ПАСФ (третий тип лицензии, введён 08.07.2026): отдельный
  // полноэкранный дашборд аварийно-спасательного формирования. Переключается
  // в настройках («Режим дашборда» → ПАСФ, setDashboardMode в auth.js)
  // или ключом лицензии типа PASF. ПАСФ всегда штатный (term() → «Компания»).
  if (typeof LICENSE !== 'undefined' && LICENSE.type === 'PASF') {
    const allEmps = await window.api.employeesListAll();
    return renderDashboardPasf(clients, allEmps);
  }

  if (isOutsourcer && clients.length >= 1) {
    // Все документы и сотрудники всех клиентов одним запросом каждый,
    // плюс settings (для vu_data_* — чек-листы готовности ВУ). Нужны
    // для расчёта готовности по модулям ТЕМИ ЖЕ формулами, что и Центр
    // готовности (calcOtReadiness/calcPdReadiness/calcVuReadiness из
    // readiness-calc.js) — иначе дашборд и карточка клиента показывают
    // разные числа для одного и того же клиента.
    const allDocs = await window.api.documentsListAll();
    const allEmps = await window.api.employeesListAll();
    const settings = await window.api.settingsGet();
    // Активные аддоны — нужны, чтобы приглушать сегменты ПДн/ВУ в кольце
    // готовности, если аддон не оплачен (данные при этом не прячем —
    // решение 11.07.2026, см. readiness.js checkTariffAccess).
    let activeAddonTypes = [];
    try {
      const addons = await window.api.addonStatus();
      activeAddonTypes = addons.filter(a => a.active).map(a => a.type);
    } catch(_) {}
    renderDashboardOutsourcer(clients, events, alerts, tasks, allDocs, allEmps, settings, activeAddonTypes);
  } else {
    await renderDashboardSpecialist(clients, events, alerts, tasks);
  }
}

// ─────────────────────────────────────────────────────────────
// РЕЖИМ А — АУТСОРСЕР
// ─────────────────────────────────────────────────────────────
function renderDashboardOutsourcer(clients, events, alerts, tasks, allDocs, allEmps, settings, activeAddonTypes = []) {
  const now = new Date();

  // Считаем просрочки и «на неделе» по каждому клиенту
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay() || 7));

  // Готовность по модулям для кольца — те же формулы, что в Центре
  // готовности (readiness-calc.js), а не отдельная метрика дашборда.
  // Иначе кольцо на дашборде и проценты в карточке клиента расходятся
  // (например, кольцо ОТ показывало 100% по статусу документов, пока
  // «Индекс риска ГИТ» в Центре готовности честно учитывал просроченное
  // обучение сотрудников и не подключённые данные клиента).
  const MODULE_META = {
    OT:   { label: 'ОТ',   color: '#60a5fa' },
    PD:   { label: 'ПДн',  color: '#a78bfa' },
    VU:   { label: 'ВУ',   color: '#fb923c' },
    CHOP: { label: 'ЧОП',  color: '#34d399' },
  };
  function moduleReadiness(c, emps, moduleCode) {
    if (moduleCode === 'OT') {
      const docsOt = allDocs.filter(d => String(d.client_id) === String(c.id) && d.module === 'OT');
      if (!docsOt.length && !emps.length) return null; // пакет не формировался и сотрудников нет — нет данных вовсе
      return calcOtReadiness(c, docsOt, emps);
    }
    if (moduleCode === 'PD') {
      const docsPd = allDocs.filter(d => String(d.client_id) === String(c.id) && d.module === 'PD');
      if (!docsPd.length) return null;
      return calcPdReadiness(c, docsPd);
    }
    if (moduleCode === 'VU') {
      const vuData = parseVuData(settings, c.id);
      // Если по ВУ вообще ничего не настроено и пакет не формировался — нет данных
      const docsVu = allDocs.filter(d => String(d.client_id) === String(c.id) && d.module === 'VU');
      if (!docsVu.length && !Object.keys(vuData).length) return null;
      return calcVuReadiness(c, emps, vuData);
    }
    if (moduleCode === 'CHOP') {
      const docsChop = allDocs.filter(d => String(d.client_id) === String(c.id) && d.module === 'CHOP');
      if (!docsChop.length) return null;
      return calcChopReadiness(docsChop);
    }
    return null;
  }

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

    // Ближайшее будущее событие клиента — конкретная дата вместо
    // абстрактного «1 на неделе» (events:list уже отдаёт client_name,
    // но здесь он не нужен — событие явно привязано к этому клиенту).
    const futureEvents = events
      .filter(e => String(e.client_id) === cid && new Date(e.due_date) >= now)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const nextEvent = futureEvents[0] || null;

    // Готовность по подключённым модулям (только те, что есть в c.modules)
    const empsOfClient = allEmps.filter(e => String(e.client_id) === cid);
    const mods = (c.modules || 'OT').split(',').map(m => m.trim()).filter(Boolean);
    const segments = mods
      .filter(m => MODULE_META[m])
      .map(m => {
        const val = moduleReadiness(c, empsOfClient, m);
        // ОТ не аддон — всегда активен. ПДн/ВУ/ЧОП приглушаем, если
        // аддон не оплачен, но само число не прячем (см. readiness.js).
        const addonRequired = (m === 'PD' || m === 'VU' || m === 'CHOP');
        const muted = addonRequired && !activeAddonTypes.includes(m);
        return { code: m, label: MODULE_META[m].label, color: MODULE_META[m].color, value: val, muted };
      })
      .filter(s => s.value !== null); // модуль подключён, но данных по нему нет вовсе — не учитываем в кольце

    return { ...c, overdue, thisWeek, nextEvent, segments };
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
      .oc-cards { display: flex; flex-direction: column; gap: 12px; }
      .oc-card {
        display: flex;
        align-items: center;
        gap: 20px;
        background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01));
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 16px;
        padding: 16px 20px;
        cursor: pointer;
        transition: border-color .2s, transform .2s;
      }
      .oc-card:hover { border-color: rgba(96,165,250,0.35); transform: translateY(-1px); }
      .oc-ring-wrap { position: relative; width: 76px; height: 76px; flex-shrink: 0; }
      .oc-ring-center {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
      }
      .oc-ring-pct { font-size: 18px; font-weight: 800; color: #f1f5f9; line-height: 1; }
      .oc-ring-label { font-size: 8px; color: #64748b; margin-top: 2px; letter-spacing: .3px; }
      .oc-card-body { flex: 1; min-width: 0; }
      .oc-card-name { font-size: 15px; font-weight: 700; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .oc-card-meta { font-size: 11px; color: #64748b; margin: 2px 0 8px; }
      .oc-card-segs { display: flex; gap: 12px; flex-wrap: wrap; }
      .oc-seg { display: flex; align-items: center; gap: 5px; font-size: 11px; }
      .oc-seg-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .oc-seg-label { color: #94a3b8; }
      .oc-seg-val { color: #cbd5e1; font-weight: 700; }
      .oc-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
      .oc-mini-badges { display: flex; gap: 6px; }
      .oc-mini-badge {
        display: flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 7px;
        font-size: 11px; font-weight: 700; border: 1px solid; position: relative;
      }
      .oc-next-event { font-size: 11px; color: #64748b; white-space: nowrap; }
      @keyframes ocPulseDot {
        0% { box-shadow: 0 0 0 0 rgba(248,113,113,0.55); }
        70% { box-shadow: 0 0 0 5px rgba(248,113,113,0); }
        100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); }
      }
      .oc-pulse-dot {
        position: absolute; top: -3px; right: -3px; width: 6px; height: 6px;
        border-radius: 50%; background: #f87171; animation: ocPulseDot 1.8s infinite;
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

    <div class="oc-cards">
      ${renderOutsourcerRows(clientStats)}
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

// SVG-кольцо готовности, разбитое на сегменты по модулям (ОТ/ПДн/ВУ).
// Если у клиента подключён только один модуль — кольцо просто рисует одну
// дугу его цветом. Если сегментов нет вовсе (пакет никогда не формировался) —
// рисуем пустое серое кольцо с прочерком, чтобы не врать нулём.
function renderReadinessRing(segments, size = 76, stroke = 8) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;

  if (!segments.length) {
    return `<div class="oc-ring-wrap">
      <svg width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}"/></svg>
      <div class="oc-ring-center"><div class="oc-ring-pct" style="color:#475569">—</div><div class="oc-ring-label">нет данных</div></div>
    </div>`;
  }

  const overall = Math.round(segments.reduce((s, x) => s + x.value, 0) / segments.length);
  const overallColor = overall >= 80 ? '#34d399' : overall >= 40 ? '#fbbf24' : '#f87171';
  let offset = 0;
  const arcs = segments.map(seg => {
    const segLen = (c / segments.length) - (segments.length > 1 ? 3 : 0);
    const dash = `${(seg.value / 100) * segLen} ${c}`;
    const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${stroke}"
      stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" stroke-linecap="round" ${seg.muted?'opacity="0.35"':''}><title>${seg.label}${seg.muted?' — аддон не активен':''}</title></circle>`;
    offset += c / segments.length;
    return arc;
  }).join('');

  return `<div class="oc-ring-wrap">
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}"/>
      ${arcs}
    </svg>
    <div class="oc-ring-center"><div class="oc-ring-pct" style="color:${overallColor}">${overall}%</div><div class="oc-ring-label">готовность</div></div>
  </div>`;
}

function renderOutsourcerRows(clientStats) {
  if (!clientStats.length) {
    return `<div class="panel" style="padding:24px;text-align:center;color:var(--muted);font-size:13px">
      ${term('clientsGenPl')} пока нет — нажмите «+ ${term('addClient')}»
    </div>`;
  }

  return clientStats.map(c => {
    const initials = getInitials(c.name);

    const segsHtml = c.segments.length ? c.segments.map(s => `
      <div class="oc-seg" ${s.muted?'style="opacity:.5" title="Аддон не активен"':''}>
        <span class="oc-seg-dot" style="background:${s.color}"></span>
        <span class="oc-seg-label">${s.label}${s.muted?' 🔒':''}</span>
        <span class="oc-seg-val">${s.value}%</span>
      </div>`).join('') : `<div class="oc-seg"><span class="oc-seg-label">Пакеты ещё не формировались</span></div>`;

    const overdueBadge = c.overdue > 0
      ? `<div class="oc-mini-badge" style="background:rgba(248,113,113,0.1);border-color:rgba(248,113,113,0.25);color:#f87171">
           <span class="oc-pulse-dot"></span>${c.overdue} просрочено
         </div>`
      : `<div class="oc-mini-badge" style="background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.06);color:#475569">— просрочено</div>`;

    const weekBadge = c.thisWeek > 0
      ? `<div class="oc-mini-badge" style="background:rgba(251,191,36,0.1);border-color:rgba(251,191,36,0.25);color:#fbbf24">${c.thisWeek} на неделе</div>`
      : `<div class="oc-mini-badge" style="background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.06);color:#475569">— на неделе</div>`;

    let nextEventHtml = '';
    if (c.nextEvent) {
      const diff = Math.round((new Date(c.nextEvent.due_date) - new Date()) / 86400000);
      const evColor = diff <= 3 ? '#f87171' : diff <= 14 ? '#fbbf24' : '#64748b';
      nextEventHtml = `<div class="oc-next-event" style="color:${evColor}">${c.nextEvent.title} · через ${diff} дн.</div>`;
    }

    return `<div class="oc-card" onclick="navigate('client',${c.id})">
      ${renderReadinessRing(c.segments)}
      <div class="oc-card-body">
        <div class="oc-card-name">${c.name}</div>
        <div class="oc-card-meta">${c.staff||0} чел. · ${c.region||'—'}</div>
        <div class="oc-card-segs">${segsHtml}</div>
      </div>
      <div class="oc-card-right">
        <div class="oc-mini-badges">${overdueBadge}${weekBadge}</div>
        ${nextEventHtml}
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// РЕЖИМ Б — ШТАТНЫЙ СПЕЦИАЛИСТ
// ─────────────────────────────────────────────────────────────
async function renderDashboardSpecialist(clients, events, alerts, tasks) {
  const stats = await window.api.dashboardStats();
  const now   = new Date();
  // Нужно для подписи под карточкой "Клиенты"/"Компания" — в режиме
  // штатного специалиста фраза "на сопровождении" не подходит (это же
  // его собственная организация, а не клиент на аутсорсе).
  const isOutsourcerMode = typeof LICENSE !== 'undefined' && LICENSE.type === 'OUTSOURCE';

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

  // ЧОП — проверяем только если аддон реально активен и есть хотя бы
  // один клиент с модулем CHOP, чтобы не тратить лишний IPC-запрос
  // (employeesListAll) для подавляющего большинства НЕ-ЧОП специалистов.
  try {
    const chopClients = clients.filter(c => (c.modules || '').includes('CHOP'));
    if (chopClients.length && recs.length < 3) {
      const addons = await window.api.addonStatus();
      const chopActive = addons.some(a => a.type === 'CHOP' && a.active);
      if (chopActive) {
        const allEmps = await window.api.employeesListAll();

        // 1. Сотрудники без заполненных данных ЧОП (разряд/тип поста)
        for (const cl of chopClients) {
          if (recs.length >= 3) break;
          const emps = allEmps.filter(e => e.client_id === cl.id);
          const missing = emps.filter(e => !e.chop || !e.chop.post_type);
          if (missing.length) {
            recs.push({
              svg: '<path d="M12 2 4 6v6c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V6z"/>',
              color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)',
              text: `Заполнить данные ЧОП — ${cl.name}`,
              sub: `${missing.length} сотр. без разряда/поста`,
              action: `navigate('client',${cl.id})`,
            });
          }
        }

        // 2. Допущенные к оружию, у которых нет действующего мед. допуска
        // (медосмотр 29н, справка охранника 1252н, психосвидетельствование
        // 392н) или он истекает в течение 30 дней — это прямой риск по
        // ст. 11.1 Закона № 2487-1.
        const CHOP_RELEVANT_CLEARANCES = ['periodic_29n', 'guard_cert_1252n', 'psychiatric_392n'];
        for (const cl of chopClients) {
          if (recs.length >= 3) break;
          const emps = allEmps.filter(e => e.client_id === cl.id && e.chop && e.chop.weapon_access);
          const atRisk = emps.filter(e => {
            const clearances = (e.medical_clearances || []).filter(mc => CHOP_RELEVANT_CLEARANCES.includes(mc.type));
            if (!clearances.length) return true; // допуска нет вообще
            return clearances.some(mc => {
              const days = Math.ceil((new Date(mc.valid_until) - now) / 86400000);
              return days <= 30; // просрочен или истекает
            });
          });
          if (atRisk.length) {
            recs.push({
              svg: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
              color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)',
              text: `Проверить допуски к оружию — ${cl.name}`,
              sub: `${atRisk.length} сотр. с истекающим/отсутствующим мед. допуском`,
              action: `navigate('client',${cl.id})`,
            });
          }
        }
      }
    }
  } catch (_) {}

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
      <div class="stat-card"><div class="stat-label">${ic('building', 14)} ${term('clients')}</div><div class="stat-value">${stats.clients}</div><div class="stat-sub">${isOutsourcerMode ? 'на сопровождении' : ''}</div></div>
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

function renderTaskRow(t, opts = {}) {
  const tagClass = t.module==='OT'?'tag-ot':t.module==='PD'?'tag-pd':'tag-vu';
  const tagLabel = t.module==='OT'?'ОТ':t.module==='PD'?'ПД':'ВУ';
  const isDone   = !!t.done;
  // Задача "раскрывается" по клику только если есть что показать сверх заголовка —
  // AI-объяснение находки по НПА и/или список конкретных документов для обновления.
  // Обычные ручные задачи без этих полей остаются простой строкой без курсора-указателя.
  const hasDetails = !!(t.npa_summary || (Array.isArray(t.npa_related_docs) && t.npa_related_docs.length));
  const checkInner = isDone
    ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);box-shadow:0 0 8px rgba(0,200,83,0.5);flex-shrink:0"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.15);flex-shrink:0;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(0,200,83,0.5)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)'"></span>`;
  const chevron = hasDetails
    ? `<svg id="task-chevron-${t.id}" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .2s"><polyline points="9 18 15 12 9 6"/></svg>`
    : `<span style="width:11px;flex-shrink:0"></span>`;
  const rowStyle = `display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;transition:background .15s${hasDetails?';cursor:pointer':''}`;
  const rowClick = hasDetails ? ` onclick="toggleTaskDetails(${t.id})"` : '';
  // Имя клиента вынесено из обрезаемого блока заголовка в отдельную колонку
  // фиксированной ширины — раньше при длинных заголовках (например, с перечнем
  // документов по найденному НПА) имя клиента полностью пропадало под ellipsis.
  // Внутри карточки клиента (opts.inClientCard) колонка не нужна — имя уже видно в шапке.
  const clientCol = (t.client_name && !opts.inClientCard)
    ? `<div style="flex-shrink:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:11px" title="${window.escapeHtml(t.client_name)}">${window.escapeHtml(t.client_name)}</div>`
    : '';
  return `<div class="task-item" id="task-item-${t.id}">
    <div class="task-row" id="task-row-${t.id}" style="${rowStyle}"${rowClick} onmouseover="this.querySelector('.task-del-btn').style.opacity='1'" onmouseout="this.querySelector('.task-del-btn').style.opacity='0'">
      <div class="task-check ${isDone?'done':''}" onclick="event.stopPropagation();toggleTask(${t.id},this)" id="task-check-${t.id}" style="flex-shrink:0;cursor:pointer">${checkInner}</div>
      ${chevron}
      <div class="task-text ${isDone?'done':''}" id="task-text-${t.id}" style="flex:1;min-width:0;font-size:13px;${isDone?'text-decoration:line-through;color:#475569':'color:var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${window.escapeHtml(t.title)}</div>
      ${clientCol}
      ${t.module?`<div class="task-tag ${tagClass}" style="flex-shrink:0">${tagLabel}</div>`:''}
      <button class="task-del-btn" onclick="event.stopPropagation();deleteTask(${t.id})" title="Удалить задачу"
        style="flex-shrink:0;opacity:0;background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:#475569;transition:all .15s;display:flex;align-items:center"
        onmouseover="this.style.color='#f87171';this.style.background='rgba(248,113,113,0.1)'"
        onmouseout="this.style.color='#475569';this.style.background='none'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>
    ${hasDetails ? `<div class="task-details" id="task-details-${t.id}" style="display:none">${renderTaskDetailsContent(t, opts)}</div>` : ''}
  </div>`;
}

// Содержимое разворачиваемой панели задачи: полный (без обрезки) заголовок,
// срок, AI-объяснение находки по НПА (если есть) и список конкретных
// документов для перегенерации (если есть) + быстрый переход в карточку клиента.
// opts.inClientCard=true — рендерим внутри самой карточки клиента: кнопка
// перехода туда же не нужна, инструкция короче (без "откройте карточку").
function renderTaskDetailsContent(t, opts = {}) {
  const due = t.due_date ? formatDate(t.due_date) : '';
  const MODULE_TAB_LABELS = { OT: 'Охрана труда', PD: 'ПДн', VU: 'Воинский учёт' };
  const moduleTabLabel = MODULE_TAB_LABELS[t.module] || '';
  const moduleHint = moduleTabLabel
    ? (opts.inClientCard
        ? `<div style="margin-top:6px;color:var(--muted);font-size:11.5px">Перейдите во вкладку «${moduleTabLabel}» выше и сформируйте документы заново. Старые версии будут заменены актуальными.</div>`
        : `<div style="margin-top:6px;color:var(--muted);font-size:11.5px">Откройте карточку клиента → вкладка «${moduleTabLabel}» → сформируйте документы заново. Старые версии будут заменены актуальными.</div>`)
    : '';
  const docsList = (Array.isArray(t.npa_related_docs) && t.npa_related_docs.length)
    ? `<div style="margin-top:10px">
        <div style="font-size:10.5px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">Нужно сформировать заново</div>
        <ul style="margin:0;padding-left:18px;color:var(--text);font-size:12.5px;line-height:1.7">${t.npa_related_docs.map(d=>`<li>${window.escapeHtml(d)}</li>`).join('')}</ul>
        ${moduleHint}
      </div>`
    : '';
  const summary = t.npa_summary
    ? `<div style="margin-top:10px">
        <div style="font-size:10.5px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">Почему это важно</div>
        <div style="color:var(--text);font-size:12.5px;line-height:1.5">${window.escapeHtml(t.npa_summary)}</div>
      </div>`
    : '';
  const clientLink = (t.client_id && !opts.inClientCard)
    ? `<button onclick="event.stopPropagation();navigate('client',${t.client_id})"
        style="margin-top:12px;padding:7px 14px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:8px;color:#60a5fa;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s"
        onmouseover="this.style.background='rgba(59,130,246,0.2)'" onmouseout="this.style.background='rgba(59,130,246,0.12)'">
        Открыть карточку клиента →
      </button>`
    : '';
  return `<div style="padding:2px 16px 16px 43px;font-size:12.5px;color:var(--text)">
    <div style="color:var(--text);line-height:1.5;font-size:13px">${window.escapeHtml(t.title)}</div>
    ${due?`<div style="margin-top:5px;color:var(--muted);font-size:11.5px">Срок: ${due}</div>`:''}
    ${summary}
    ${docsList}
    ${clientLink}
  </div>`;
}

function toggleTaskDetails(id) {
  const details = document.getElementById('task-details-' + id);
  const chevron = document.getElementById('task-chevron-' + id);
  if (!details) return;
  const isOpen = details.style.display !== 'none';
  details.style.display = isOpen ? 'none' : 'block';
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

async function deleteTask(id) {
  const row = document.getElementById('task-item-' + id);
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
  const textEl = document.getElementById('task-text-' + id);
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

// ═══════════════════════════════════════════════════════
//  Дашборд ПАСФ (аддон PASF) — только штатный специалист.
//  Отдельный от renderDashboardOutsourcer/Specialist экран (не виджет,
//  как у ЧОП) — аттестация формирования блокирует работу всей организации,
//  ей нужно самое заметное место, а не строчка внутри общих рекомендаций.
// ═══════════════════════════════════════════════════════
// Погода для ознакомления диспетчера/начальника ПАСФ — НЕ официальный
// источник штормовых предупреждений (это Росгидромет/УГМС), а быстрый
// ориентир прямо на дашборде. Порог 15 м/с — из инструкций по работе на
// высоте (782н) и постановке бонов, где превышение = прекращение работ.
const PASF_WIND_THRESHOLD_MS = 15;

async function fetchPasfWeather(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_gusts_10m,temperature_2m,weather_code&wind_speed_unit=ms`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.current || null;
  } catch (e) {
    return null; // нет сети/API недоступен — виджет просто не покажется, не критично
  }
}

async function togglePasfTheme() {
  try {
    let s = {};
    try { s = await window.api.settingsGet() || {}; } catch (e) {}
    const next = (s.pasf_theme === 'light') ? 'dark' : 'light';
    await window.api.settingsSave({ pasf_theme: next });

    // Перерисовка напрямую, без зависимости от getClients() из app.js —
    // берём клиентов через IPC сами, отфильтровав архивных, как getClients.
    const all = await window.api.clientsList();
    const clients = (all || []).filter(c => !c.archived);
    const allEmps = await window.api.employeesListAll();
    await renderDashboardPasf(clients, allEmps);
  } catch (e) {
    console.error('[PASF] Ошибка переключения темы:', e);
    if (typeof showToast === 'function') showToast('Не удалось переключить тему: ' + e.message, 'var(--red)');
  }
}

async function renderDashboardPasf(clients, allEmps) {
  const pasfClients = clients.filter(c => (c.modules || '').includes('PASF'));
  const now = new Date();
  const DAY = 86400000;

  // Тема дашборда ПАСФ — отдельная от общей темы приложения (своя визуальная
  // система pf-*). По умолчанию тёмная, переключается кнопкой в шапке,
  // хранится в settings.pasf_theme между запусками.
  let pasfTheme = 'dark';
  try { const s = await window.api.settingsGet(); pasfTheme = s?.pasf_theme || 'dark'; } catch (e) {}
  const isLight = pasfTheme === 'light';

  // Справочники (24 вида работ, 5 классов) живут в main.js — тянем через IPC.
  // Фолбэк на пустые массивы: дашборд не упадёт, просто покажет ключи вместо меток.
  let PASF_REF = { workTypes: [], classes: [] };
  try { PASF_REF = await window.api.pasfReference() || PASF_REF; } catch (e) { /* аддон не активирован — не критично */ }

  function daysLeft(dateStr) {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr) - now) / DAY);
  }

  // ── Аттестация формирования — по каждому клиенту с модулем PASF ──
  const orgCards = pasfClients.map(c => {
    const att = c.pasf; // {cert_number, attestation_date, expiry_date, attesting_body, work_types[]}
    let status = 'none', dl = null;
    if (att && att.expiry_date) {
      dl = daysLeft(att.expiry_date);
      status = dl < 0 ? 'expired' : dl <= 90 ? 'expiring' : 'ok';
    }
    return { client: c, att, status, daysLeft: dl };
  });

  const expiredOrgs  = orgCards.filter(o => o.status === 'expired').length;
  const expiringOrgs = orgCards.filter(o => o.status === 'expiring').length;
  const noneOrgs     = orgCards.filter(o => o.status === 'none').length;

  // ── Спасатели по всем клиентам с PASF ──
  const clientIds = new Set(pasfClients.map(c => String(c.id)));
  const rescuers = allEmps.filter(e => clientIds.has(String(e.client_id)) && e.pasf);

  const classExpiring = rescuers.filter(e => {
    const dl = daysLeft(e.pasf.next_attestation_due);
    return dl !== null && dl <= 90;
  });
  const noDactyloscopy = rescuers.filter(e => !e.pasf.dactyloscopy_registered);

  // ── Покрытие допусков по видам работ (сколько спасателей допущено хотя бы к одному) ──
  const totalWorkTypes = PASF_REF.workTypes.length || 24;
  const permitCoverage = {};
  rescuers.forEach(e => {
    (e.pasf.work_permits || []).forEach(p => {
      if (p.attested) permitCoverage[p.work_type] = (permitCoverage[p.work_type] || 0) + 1;
    });
  });
  const coveredWorkTypes = Object.keys(permitCoverage).length;

  function orgStatusBadge(o) {
    if (o.status === 'expired')  return `<span class="pf-status pf-status-red">Просрочена</span>`;
    if (o.status === 'expiring') return `<span class="pf-status pf-status-amber">Истекает ${o.daysLeft} дн.</span>`;
    if (o.status === 'ok')       return `<span class="pf-status pf-status-ok">До ${formatDate(o.att.expiry_date)}</span>`;
    return `<span class="pf-status pf-status-red">Не внесена</span>`;
  }

  // Токены темы — тёмная/светлая, обе с усиленным контрастом текста и
  // общей "промышленной" логикой (острые углы, моно-данные, боны вместо
  // абстрактной ленты). Переключение — кнопка в шапке, settings.pasf_theme.
  const T = isLight ? {
    bg:'#E4E7EB', panel:'#FFFFFF', border:'#8A939C', text:'#0A0D10', muted:'#454E59',
    orange:'#E14A0F', red:'#C6362E', amber:'#B87A0A', green:'#1E8563',
    waterLo:'#E8ECEF', waterHi:'#C4CCD4', boomTop:'#FF6A2B', boomBot:'#B8390F',
  } : {
    bg:'#14181D', panel:'#242C36', border:'#5C6773', text:'#F5F7F8', muted:'#A7B0BA',
    orange:'#FF5A1F', red:'#F0564C', amber:'#F7BE5C', green:'#3FC49A',
    waterLo:'#1B2128', waterHi:'#14181D', boomTop:'#FF7A3D', boomBot:'#C24413',
  };
  const boomStrip = (expiredOrgs + noneOrgs) > 0 ? `
      <div class="pf-hazard-strip" style="background:linear-gradient(180deg, transparent 0%, transparent 55%, ${T.waterHi} 55%, ${T.waterLo} 100%)">
        <div class="pf-boom-segs">
          ${Array.from({length:6}).map((_,i) => `<div class="pf-boom-seg" style="background:linear-gradient(180deg, ${T.boomTop} 0%, ${T.orange} 55%, ${T.boomBot} 100%)"></div>${i<5?`<div class="pf-boom-link" style="background:${T.text}"></div>`:''}`).join('')}
        </div>
      </div>` : '';

  document.getElementById('content').innerHTML = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      /* ── ПАСФ — отдельный визуальный язык, тёмная/светлая тема (08.07.2026) ──
         Брутальный/промышленный: острые углы, без теней, сигнальный
         оранжевый, моноширинные данные, боновое заграждение вместо
         абстрактной "барьерной ленты" на критичном статусе. Изолировано
         префиксом pf- от .oc-*/.panel-* остальных дашбордов.
         ВАЖНО: цвета подставлены как литеральные значения (${T.panel} и т.п.),
         БЕЗ var(--pf-*) — на этом окружении CSS custom properties, заданные
         через #content{...} внутри innerHTML самого #content, надёжно не
         резолвились (проверено эмпирически: псевдоэлементы с var() рисовались,
         фон/рамка через var() на самом .pf-panel — нет). Литералы работают
         гарантированно независимо от причины. */
      #content{ background:${T.bg} !important; }
      #content .pf-eyebrow{ font-family:'IBM Plex Mono',monospace !important; font-size:11px; color:${T.muted} !important;
        letter-spacing:.12em; text-transform:uppercase; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
      #content .pf-theme-btn{ font-family:'IBM Plex Mono',monospace !important; font-size:10.5px; color:${T.muted} !important;
        background:transparent; border:2px solid ${T.border} !important; border-radius:2px; padding:4px 10px;
        cursor:pointer; text-transform:uppercase; letter-spacing:.05em; }
      #content .pf-theme-btn:hover{ color:${T.orange} !important; border-color:${T.orange} !important; }
      #content .pf-h1{ font-family:'Oswald',sans-serif !important; font-weight:700; font-size:24px;
        text-transform:uppercase; letter-spacing:.01em; color:${T.text} !important; margin-bottom:20px;
        padding-left:14px; border-left:4px solid ${T.orange} !important; }
      #content .pf-stats{ display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
      #content .pf-stat{ flex:1; min-width:200px; background:${T.panel} !important; border:2px solid ${T.border} !important;
        border-top:4px solid ${T.border} !important; border-radius:2px !important; padding:14px 16px; box-shadow:none !important; }
      #content .pf-stat.danger{ border-top-color:${T.red} !important; }
      #content .pf-stat.amber{ border-top-color:${T.amber} !important; }
      #content .pf-stat-num{ font-family:'Oswald',sans-serif !important; font-size:27px; font-weight:700; color:${T.text} !important; font-variant-numeric:tabular-nums; }
      #content .pf-stat-label{ font-family:'IBM Plex Mono',monospace !important; font-size:10px; color:${T.muted} !important;
        text-transform:uppercase; letter-spacing:.05em; margin-top:4px; }
      #content .pf-stat.danger .pf-stat-num{ color:${T.red} !important; }
      #content .pf-stat.amber .pf-stat-num{ color:${T.amber} !important; }
      #content .pf-panel{ position:relative; background:${T.panel} !important; border:2px solid ${T.border} !important; border-radius:2px !important;
        margin-bottom:16px; overflow:visible; box-shadow:none !important; }
      #content .pf-panel:before, #content .pf-panel:after{ content:""; position:absolute; width:12px; height:12px;
        border-color:${T.muted}; border-style:solid; opacity:.5; pointer-events:none; }
      #content .pf-panel:before{ top:-1px; left:-1px; border-width:2px 0 0 2px; }
      #content .pf-panel:after{ bottom:-1px; right:-1px; border-width:0 2px 2px 0; }
      #content .pf-hazard-strip{ height:18px; position:relative; overflow:hidden; }
      #content .pf-boom-segs{ position:absolute; top:2px; left:0; right:0; height:10px; display:flex; align-items:stretch; padding:0 4px; }
      #content .pf-boom-seg{ flex:1; margin:0 1px; border-radius:1px; }
      #content .pf-boom-link{ width:3px; flex-shrink:0; margin-top:-2px; height:14px; border-radius:1px; opacity:.85; }
      #content .pf-panel-head{ display:flex; align-items:center; justify-content:space-between;
        padding:13px 16px; border-bottom:2px solid ${T.border} !important; }
      #content .pf-panel-title{ font-family:'Oswald',sans-serif !important; font-weight:600; font-size:13px;
        text-transform:uppercase; letter-spacing:.04em; color:${T.text} !important; }
      #content .pf-panel-count{ font-family:'IBM Plex Mono',monospace !important; font-size:11px; color:${T.muted} !important;
        border:2px solid ${T.border} !important; padding:2px 8px; border-radius:2px !important; }
      #content .pf-panel-body{ padding:4px 16px; }
      #content .pf-row{ display:flex; align-items:center; justify-content:space-between; gap:12px;
        padding:12px 0 12px 12px; border-bottom:2px solid ${T.border} !important; border-left:3px solid transparent;
        margin-left:-12px; cursor:pointer; }
      #content .pf-row:last-child{ border-bottom:none !important; }
      #content .pf-row.r-red{ border-left-color:${T.red} !important; }
      #content .pf-row.r-amber{ border-left-color:${T.amber} !important; }
      #content .pf-row:hover .pf-row-name{ color:${T.orange} !important; }
      #content .pf-row-name{ font-size:14px; font-weight:600; color:${T.text} !important; transition:color .15s; }
      #content .pf-row-meta{ font-family:'IBM Plex Mono',monospace !important; font-size:11px; color:${T.muted} !important; margin-top:3px; }
      #content .pf-status{ font-family:'IBM Plex Mono',monospace !important; font-size:10.5px; font-weight:700;
        letter-spacing:.05em; text-transform:uppercase; padding:4px 9px; border-radius:2px !important;
        white-space:nowrap; flex-shrink:0; }
      #content .pf-status:before{ content:"["; margin-right:3px; opacity:.6; }
      #content .pf-status:after{ content:"]"; margin-left:3px; opacity:.6; }
      #content .pf-status-ok{ color:${T.green} !important; background:rgba(47,168,138,.15) !important; border:1px solid ${T.green} !important; }
      #content .pf-status-amber{ color:${T.amber} !important; background:rgba(242,169,59,.15) !important; border:1px solid ${T.amber} !important; }
      #content .pf-status-red{ color:${T.red} !important; background:rgba(232,67,58,.15) !important; border:1px solid ${T.red} !important; }
      #content .pf-empty{ padding:32px 16px; text-align:center; color:${T.muted} !important; font-size:12.5px; }
      #content .pf-footnote{ padding:0 16px 14px; font-size:10.5px; color:${T.muted} !important; opacity:.85; }
    </style>

    <div class="pf-eyebrow">
      <span>Дашборд · ПАСФ · ${now.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</span>
      <button class="pf-theme-btn" onclick="togglePasfTheme()">${isLight ? '● Тёмная тема' : '○ Светлая тема'}</button>
    </div>
    <div class="pf-h1">Аттестация и готовность формирования</div>

    <div class="pf-stats">
      <div class="pf-stat danger" style="background:${T.panel};border-color:${T.border}">
        <div class="pf-stat-num">${expiredOrgs + noneOrgs}</div>
        <div class="pf-stat-label">Без действующей аттестации</div>
      </div>
      <div class="pf-stat amber" style="background:${T.panel};border-color:${T.border}">
        <div class="pf-stat-num">${expiringOrgs}</div>
        <div class="pf-stat-label">Истекает в ближайшие 90 дней</div>
      </div>
      <div class="pf-stat amber" style="background:${T.panel};border-color:${T.border}">
        <div class="pf-stat-num">${classExpiring.length}</div>
        <div class="pf-stat-label">Спасателей — переаттестация класса</div>
      </div>
      <div class="pf-stat danger" style="background:${T.panel};border-color:${T.border}">
        <div class="pf-stat-num">${noDactyloscopy.length}</div>
        <div class="pf-stat-label">Без дактилоскопии (ст.24.1 151-ФЗ)</div>
      </div>
    </div>

    <div class="pf-panel" id="pasf-weather-panel" style="background:${T.panel};border-color:${T.border};${pasfClients.some(c => c.pasf?.location?.lat) ? '' : 'display:none'}">
      <div class="pf-panel-head"><div class="pf-panel-title">Погода на базе · ветер и порывы</div><div class="pf-panel-count">Open-Meteo</div></div>
      <div class="pf-panel-body" id="pasf-weather-body" style="display:flex;flex-wrap:wrap;gap:12px;padding-top:12px;padding-bottom:12px">
        <div style="color:${T.muted};font-size:12px">Загрузка...</div>
      </div>
      <div class="pf-footnote">Ознакомительная информация, не заменяет официальные штормовые предупреждения Росгидромета/УГМС. Порог остановки работ на открытых площадках — ${PASF_WIND_THRESHOLD_MS} м/с (782н).</div>
    </div>

    <div class="pf-panel" style="background:${T.panel};border-color:${T.border}">
      ${boomStrip}
      <div class="pf-panel-head"><div class="pf-panel-title">Аттестация формирований</div><div class="pf-panel-count">${pasfClients.length}</div></div>
      <div class="pf-panel-body">
        ${pasfClients.length ? orgCards.map(o => `
          <div class="pf-row ${o.status === 'expired' || o.status === 'none' ? 'r-red' : o.status === 'expiring' ? 'r-amber' : ''}" onclick="navigate('client',${o.client.id})">
            <div>
              <div class="pf-row-name">${o.client.name}</div>
              <div class="pf-row-meta">${o.att && o.att.cert_number ? 'СВИДЕТЕЛЬСТВО № ' + o.att.cert_number : 'ДАННЫЕ НЕ ВНЕСЕНЫ'}${o.att && o.att.max_spill_volume ? ' · ДО ' + ({'100':'100 Т','100-500':'500 Т','500-1000':'1000 Т','1000-5000':'5000 Т','5000+':'5000+ Т'}[o.att.max_spill_volume] || o.att.max_spill_volume) : ''}</div>
            </div>
            ${orgStatusBadge(o)}
          </div>
        `).join('') : '<div class="pf-empty">Нет клиентов с модулем ПАСФ<br>Подключите аддон PASF в карточке клиента</div>'}
      </div>
    </div>

    <div class="pf-panel" style="background:${T.panel};border-color:${T.border}">
      <div class="pf-panel-head"><div class="pf-panel-title">Классы спасателей — приближается переаттестация</div><div class="pf-panel-count">${classExpiring.length}</div></div>
      <div class="pf-panel-body">
        ${classExpiring.length ? classExpiring.map(e => {
          const dl = daysLeft(e.pasf.next_attestation_due);
          const cls = PASF_REF.classes.find(c => c.key === e.pasf.current_class);
          return `<div class="pf-row ${dl < 0 ? 'r-red' : 'r-amber'}" onclick="navigate('client',${e.client_id})">
            <div>
              <div class="pf-row-name">${e.name}</div>
              <div class="pf-row-meta">${(cls ? cls.label : e.pasf.current_class || '—').toUpperCase()}</div>
            </div>
            ${dl < 0
              ? `<span class="pf-status pf-status-red">Просрочено ${-dl} дн.</span>`
              : `<span class="pf-status pf-status-amber">Через ${dl} дн.</span>`}
          </div>`;
        }).join('') : '<div class="pf-empty">Все классы актуальны<br>Ближайших переаттестаций в течение 90 дней нет</div>'}
      </div>
    </div>

    <div class="pf-panel" style="background:${T.panel};border-color:${T.border}">
      <div class="pf-panel-head"><div class="pf-panel-title">Покрытие допусков к видам работ</div><div class="pf-panel-count">${coveredWorkTypes}/${totalWorkTypes}</div></div>
      <div class="pf-panel-body" style="color:${T.muted};font-size:12.5px;line-height:1.6;padding-top:14px;padding-bottom:16px">
        ${rescuers.length
          ? `Из ${totalWorkTypes} видов работ хотя бы один аттестованный спасатель есть на ${coveredWorkTypes}.
             ${coveredWorkTypes < totalWorkTypes ? `<span style="color:${T.amber}">Не покрыто: ${totalWorkTypes - coveredWorkTypes} вид(ов) — если формирование заявляет эти работы, нужна аттестация конкретных спасателей.</span>` : 'Все заявленные виды работ покрыты хотя бы одним допущенным спасателем.'}`
          : 'Нет данных по допускам спасателей — заполните work_permits в карточках сотрудников.'}
      </div>
    </div>
  `;

  // Фон #content ставим через JS setProperty(...,'important'), а НЕ через
  // <style>-блок: инлайновый !important физически не может проиграть ни
  // одному правилу в стилевых листах приложения, независимо от специфичности
  // их селекторов — а именно это и было причиной, что фон страницы не
  // перекрашивался, хотя классовые правила (.pf-panel и т.д.) применялись
  // нормально (у них не было конкурентов в глобальных стилях).
  document.getElementById('content').style.setProperty('background', T.bg, 'important');

  // Погода — асинхронно, после отрисовки (не блокирует остальной дашборд,
  // если сеть недоступна). Каждая организация с заданными координатами базы
  // получает свою карточку — важно для роста в крупные структуры типа
  // Морспасслужбы с несколькими базами/районами, а не одна точка на всех.
  const withLocation = pasfClients.filter(c => c.pasf?.location?.lat && c.pasf?.location?.lon);
  if (withLocation.length) {
    const results = await Promise.all(withLocation.map(async c => ({
      client: c,
      weather: await fetchPasfWeather(c.pasf.location.lat, c.pasf.location.lon),
    })));
    const body = document.getElementById('pasf-weather-body');
    if (body) {
      const cards = results.filter(r => r.weather).map(r => {
        const w = r.weather;
        const wind = w.wind_speed_10m;
        const alert = wind >= PASF_WIND_THRESHOLD_MS;
        return `
          <div style="flex:1;min-width:200px;padding:14px;background:${T.panel};border:1px solid ${alert ? T.red : T.border};border-radius:2px">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;color:${T.text};text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">${(r.client.pasf.location.label || r.client.name).toUpperCase()}</div>
            <div style="display:flex;align-items:baseline;gap:6px">
              <div style="font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;color:${alert ? T.red : T.text}">${wind}</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${T.muted}">м/с ветер</div>
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${T.muted};margin-top:4px">порывы до ${w.wind_gusts_10m} м/с · ${w.temperature_2m}°C</div>
            ${alert ? `<div style="margin-top:8px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:600;color:${T.red};text-transform:uppercase">⚠ превышен порог остановки работ (${PASF_WIND_THRESHOLD_MS} м/с)</div>` : ''}
          </div>`;
      }).join('');
      body.innerHTML = cards || `<div style="color:${T.muted};font-size:12px">Нет данных — проверьте соединение с интернетом</div>`;
    }
  }
}
