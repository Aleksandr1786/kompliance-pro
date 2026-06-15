// ============================================================
// КОМПЛАЕНСПРО — readiness.js
// Центр готовности: индекс риска, машина времени, паспорт, инспекция, ЕФС-1, протоколы, переключение режимов
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================

// ═══════════════════════════════════════════════════════
//  ЦЕНТР ГОТОВНОСТИ
// ═══════════════════════════════════════════════════════
let _readinessClientId = null;

async function openReadinessCenter(clientId) {
  _readinessClientId = clientId;
  const c = await window.api.clientGet(clientId);
  if (!c) return;
  const docs = await window.api.documentsList(clientId);
  const emps = await window.api.employeesList(clientId);
  const events = await window.api.eventsList(clientId);
  const now = new Date();

  // ── РАСЧЁТ РИСКОВ ПО РЕАЛЬНЫМ СТАТЬЯМ КоАП РФ ──────────
  // ст. 5.27.1 КоАП — нарушения требований ОТ
  const risks = [];

  // Обучение по охране труда (ч.3 ст.5.27.1 — до 130 000 ₽)
  let trainingOverdue = 0, trainingSoon = 0;
  emps.forEach(e => {
    const tr = e.training || {};
    ['prog_a','first_aid','fire','repeat'].forEach(key => {
      const t = tr[key];
      if (!t?.required) return;
      if (!t?.date) { trainingOverdue++; return; }
      const next = new Date(t.date);
      if (key === 'repeat') next.setMonth(next.getMonth()+6);
      else next.setFullYear(next.getFullYear()+3);
      const days = Math.ceil((next-now)/86400000);
      if (days < 0) trainingOverdue++;
      else if (days <= 30) trainingSoon++;
    });
  });

  if (trainingOverdue > 0) {
    risks.push({
      level: 'high',
      title: 'Не пройдено обучение по охране труда',
      detail: `${trainingOverdue} нарушений у сотрудников`,
      law: 'ч.3 ст.5.27.1 КоАП РФ',
      fineMin: 110000, fineMax: 130000,
      fix: 'Провести обучение и проверку знаний',
    });
  }

  // Медосмотры (ч.3 ст.5.27.1 — до 130 000 ₽)
  if (c.medcheck_required) {
    const noMed = emps.filter(e => {
      const m = e.training?.medcheck;
      return !m?.date;
    }).length;
    if (noMed > 0) {
      risks.push({
        level: 'high',
        title: 'Отсутствуют медосмотры',
        detail: `${noMed} сотр. без медосмотра`,
        law: 'ч.3 ст.5.27.1 КоАП РФ',
        fineMin: 110000, fineMax: 130000,
        fix: 'Направить сотрудников на медосмотр',
      });
    }
  }

  // СОУТ (ч.2 ст.5.27.1 — до 80 000 ₽)
  if (!c.soat_class || c.soat_class === '0') {
    risks.push({
      level: 'high',
      title: 'Не проведена СОУТ',
      detail: 'Спецоценка условий труда отсутствует',
      law: 'ч.2 ст.5.27.1 КоАП РФ',
      fineMin: 60000, fineMax: 80000,
      fix: 'Заказать спецоценку условий труда',
    });
  }

  // Документы ОТ (ч.1 ст.5.27.1 — до 80 000 ₽)
  const okDocs = docs.filter(d => d.status === 'ok').length;
  const totalDocs = docs.length;
  if (totalDocs === 0) {
    risks.push({
      level: 'high',
      title: 'Отсутствует документация по ОТ',
      detail: 'Локальные акты не разработаны',
      law: 'ч.1 ст.5.27.1 КоАП РФ',
      fineMin: 50000, fineMax: 80000,
      fix: 'Сформировать документы в разделе ОТ',
    });
  } else if (okDocs < totalDocs) {
    const outdated = totalDocs - okDocs;
    risks.push({
      level: 'medium',
      title: 'Часть документов не актуальна',
      detail: `${outdated} из ${totalDocs} требуют обновления`,
      law: 'ч.1 ст.5.27.1 КоАП РФ',
      fineMin: 50000, fineMax: 80000,
      fix: 'Обновить документы (повторная генерация)',
    });
  }

  // СИЗ (ч.4 ст.5.27.1 — до 150 000 ₽)
  if (parseInt(c.soat_class) >= 31 || c.hazard_works) {
    const noSiz = emps.filter(e => {
      const s = e.training?.siz;
      return s?.required && !s?.date;
    }).length;
    if (noSiz > 0) {
      risks.push({
        level: 'high',
        title: 'Не обеспечены СИЗ / нет обучения по СИЗ',
        detail: `${noSiz} сотр. без подтверждения`,
        law: 'ч.4 ст.5.27.1 КоАП РФ',
        fineMin: 130000, fineMax: 150000,
        fix: 'Выдать СИЗ и провести обучение',
      });
    }
  }

  // Просроченные события
  const overdueEvents = events.filter(e => new Date(e.due_date) < now);
  if (overdueEvents.length > 0) {
    risks.push({
      level: 'medium',
      title: 'Просроченные мероприятия',
      detail: `${overdueEvents.length} событий требуют действий`,
      law: 'ч.1 ст.5.27.1 КоАП РФ',
      fineMin: 30000, fineMax: 50000,
      fix: 'Закрыть просроченные события',
    });
  }

  // Подсчёт суммарного риска
  const totalFineMin = risks.reduce((s,r) => s + r.fineMin, 0);
  const totalFineMax = risks.reduce((s,r) => s + r.fineMax, 0);
  const highRisks = risks.filter(r => r.level === 'high').length;

  // ── Расчёт готовности (для паспорта) ──
  const scoreBreakdown = [];
  // Документы 35
  let docsScoreP = totalDocs > 0 ? Math.round(okDocs / totalDocs * 35) : 0;
  scoreBreakdown.push({ label:'Документация', score:docsScoreP, max:35 });
  // Обучение 25
  let trScoreP = 25;
  if (emps.length === 0) trScoreP = 0;
  else {
    let bad = 0;
    emps.forEach(e => {
      const tr = e.training || {};
      ['prog_a','first_aid','fire','repeat'].forEach(key => {
        const t = tr[key];
        if (!t?.required) return;
        if (!t?.date) { bad++; return; }
        const nx = new Date(t.date);
        if (key === 'repeat') nx.setMonth(nx.getMonth()+6); else nx.setFullYear(nx.getFullYear()+3);
        const dd = Math.ceil((nx-now)/86400000);
        if (dd < 0) bad += 2; else if (dd <= 14) bad += 1;
      });
    });
    trScoreP = Math.max(0, Math.round((1 - bad/(emps.length*4)) * 25));
  }
  scoreBreakdown.push({ label:'Обучение персонала', score:trScoreP, max:25 });
  // Данные 25
  const reqF = ['inn','okved','manager_name','manager_position','address','city','phone','staff','region','form'];
  const fF = reqF.filter(k => c[k] && String(c[k]).trim() !== '' && String(c[k]) !== '0').length;
  const dataScoreP = Math.round(fF / reqF.length * 25);
  scoreBreakdown.push({ label:'Кадровые данные', score:dataScoreP, max:25 });
  // Сотрудники 15
  let empScoreP = 0;
  if (emps.length > 0) empScoreP = Math.round(emps.filter(e => e.position && e.position.trim()).length / emps.length * 15);
  scoreBreakdown.push({ label:'Сотрудники', score:empScoreP, max:15 });

  const realScore = Math.min(100, docsScoreP + trScoreP + dataScoreP + empScoreP);
  const scoreColor = realScore >= 80 ? 'var(--green)' : realScore >= 40 ? 'var(--amber)' : 'var(--red)';

  // Вероятность штрафа (эвристика)
  const score = realScore;
  let probability = Math.min(95, Math.max(5, 100 - score + highRisks * 8));
  if (risks.length === 0) probability = 5;

  // Уровень риска
  let riskLabel, riskColor;
  if (probability >= 70)      { riskLabel = 'ВЫСОКИЙ';  riskColor = '#f87171'; }
  else if (probability >= 40) { riskLabel = 'СРЕДНИЙ';  riskColor = '#fbbf24'; }
  else                        { riskLabel = 'НИЗКИЙ';   riskColor = '#34d399'; }

  const fmtMoney = n => n.toLocaleString('ru-RU') + ' ₽';

  // Навигация
  currentPage = 'readiness';
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('topbarTitle').textContent = 'Центр готовности — ' + c.name;
  const btn = document.getElementById('topbarAction');
  btn.textContent = '← К клиенту';
  btn.style.display = 'flex';
  btn.className = 'btn btn-ghost';
  btn.onclick = () => { btn.className = 'btn btn-primary'; navigate('client', clientId); };
  const editBtn = document.getElementById('topbarEdit');
  if (editBtn) editBtn.style.display = 'none';

  const hasPD = (c.modules||'').includes('PD');
  const hasVU = (c.modules||'').includes('VU');

  document.getElementById('content').innerHTML = `
    <style>
      @keyframes rc-in { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      .rc-card { animation:rc-in .4s cubic-bezier(.22,.68,0,1.1) both }
      .rc-card:nth-child(2){animation-delay:.05s}
      .rc-card:nth-child(3){animation-delay:.1s}
      @keyframes rc-pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
      @keyframes typewriter { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
      .type-line { animation:typewriter .3s ease both }
    </style>

    <!-- ПЕРЕКЛЮЧАТЕЛЬ МОДУЛЕЙ -->
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">

      <button id="rc-tab-ot" onclick="rcSwitchMode('ot',${clientId})" style="
        display:flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:12px;
        border:2px solid rgba(248,113,113,0.5);
        background:rgba(248,113,113,0.12);
        color:#f87171;font-size:13px;font-weight:700;cursor:pointer;
        transition:all .2s;flex:1;min-width:160px">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(248,113,113,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div style="text-align:left">
          <div>Охрана труда</div>
          <div style="font-size:10px;font-weight:500;opacity:.7;margin-top:1px">Симулятор ГИТ</div>
        </div>
      </button>

      ${hasPD ? `
      <button id="rc-tab-pd" onclick="rcSwitchMode('pd',${clientId})" style="
        display:flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:12px;
        border:2px solid rgba(255,255,255,0.08);
        background:rgba(255,255,255,0.03);
        color:#475569;font-size:13px;font-weight:700;cursor:pointer;
        transition:all .2s;flex:1;min-width:160px"
        onmouseover="this.style.borderColor='rgba(96,165,250,0.4)';this.style.color='#60a5fa'"
        onmouseout="if(!this.classList.contains('rc-active')){this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='#475569'}">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(96,165,250,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div style="text-align:left">
          <div>Персональные данные</div>
          <div style="font-size:10px;font-weight:500;opacity:.7;margin-top:1px">Симулятор РКН</div>
        </div>
      </button>` : ''}

      ${hasVU ? `
      <button id="rc-tab-vu" onclick="rcSwitchMode('vu',${clientId})" style="
        display:flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:12px;
        border:2px solid rgba(255,255,255,0.08);
        background:rgba(255,255,255,0.03);
        color:#475569;font-size:13px;font-weight:700;cursor:pointer;
        transition:all .2s;flex:1;min-width:160px"
        onmouseover="this.style.borderColor='rgba(167,139,250,0.4)';this.style.color='#a78bfa'"
        onmouseout="if(!this.classList.contains('rc-active')){this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='#475569'}">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(167,139,250,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div style="text-align:left">
          <div>Воинский учёт</div>
          <div style="font-size:10px;font-weight:500;opacity:.7;margin-top:1px">Симулятор военкомата</div>
        </div>
      </button>` : ''}

    </div>

    <div id="rc-mode-content">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- ВИДЖЕТ: СИМУЛЯТОР ПРОВЕРКИ -->
      <div class="rc-card panel" style="grid-column:1/-1">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Что будет, если завтра проверка?</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Симуляция проверки государственного инспектора труда</div>
          </div>
          <button onclick="runInspection(${clientId})" id="runInspectionBtn" style="
            padding:11px 22px;background:linear-gradient(90deg,#ef4444,#dc2626);
            border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;
            cursor:pointer;white-space:nowrap;transition:opacity .15s
          " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ▶ Запустить проверку
          </button>
        </div>
        <div id="inspectionResult"></div>
      </div>

    </div>

    <!-- ВТОРАЯ СТРОКА: Спидометр + Машина времени -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- ВИДЖЕТ: ИНДЕКС РИСКА — СПИДОМЕТР -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Индекс риска ГИТ</div>
            <div style="font-size:11px;color:#94a3b8">Вероятность штрафа при проверке</div>
          </div>
        </div>

        <!-- SVG Спидометр -->
        <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0">
          <svg width="220" height="130" viewBox="0 0 220 130">
            <!-- Фоновая дуга -->
            <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="18" stroke-linecap="round"/>
            <!-- Зелёная зона -->
            <path d="M 20 110 A 90 90 0 0 1 75 27" fill="none" stroke="#34d399" stroke-width="18" stroke-linecap="round" opacity=".35"/>
            <!-- Жёлтая зона -->
            <path d="M 75 27 A 90 90 0 0 1 145 27" fill="none" stroke="#fbbf24" stroke-width="18" stroke-linecap="round" opacity=".35"/>
            <!-- Красная зона -->
            <path d="M 145 27 A 90 90 0 0 1 200 110" fill="none" stroke="#f87171" stroke-width="18" stroke-linecap="round" opacity=".35"/>

            <!-- Активная дуга (прогресс) -->
            ${(() => {
              const pct = probability / 100;
              // Угол от -180° до 0° (дуга 180°)
              const angle = -180 + pct * 180;
              const rad = (angle * Math.PI) / 180;
              const cx = 110, cy = 110, r = 90;
              const x = cx + r * Math.cos(rad);
              const y = cy + r * Math.sin(rad);
              const largeArc = pct > 0.5 ? 1 : 0;
              const activeColor = probability >= 70 ? '#f87171' : probability >= 40 ? '#fbbf24' : '#34d399';
              return `<path d="M 20 110 A 90 90 0 ${largeArc} 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${activeColor}" stroke-width="18" stroke-linecap="round"/>`;
            })()}

            <!-- Стрелка -->
            ${(() => {
              const pct = probability / 100;
              const angle = -180 + pct * 180;
              const rad = (angle * Math.PI) / 180;
              const cx = 110, cy = 110;
              const nx = cx + 72 * Math.cos(rad);
              const ny = cy + 72 * Math.sin(rad);
              const activeColor = probability >= 70 ? '#f87171' : probability >= 40 ? '#fbbf24' : '#34d399';
              return `
                <line x1="110" y1="110" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${activeColor}" stroke-width="3" stroke-linecap="round"/>
                <circle cx="110" cy="110" r="6" fill="${activeColor}"/>
              `;
            })()}

            <!-- Метки -->
            <text x="14" y="126" fill="#475569" font-size="10" text-anchor="middle">0%</text>
            <text x="110" y="18" fill="#475569" font-size="10" text-anchor="middle">50%</text>
            <text x="206" y="126" fill="#475569" font-size="10" text-anchor="middle">100%</text>

            <!-- Центральное значение -->
            <text x="110" y="95" fill="${riskColor}" font-size="26" font-weight="800" text-anchor="middle">${probability}%</text>
            <text x="110" y="113" fill="#94a3b8" font-size="11" text-anchor="middle">${riskLabel}</text>
          </svg>
        </div>

        <div style="display:flex;justify-content:center;gap:16px;margin-top:4px">
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#34d399"></div>Низкий</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#fbbf24"></div>Средний</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#f87171"></div>Высокий</div>
        </div>
      </div>

      <!-- ВИДЖЕТ: МАШИНА ВРЕМЕНИ -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Машина времени</div>
            <div style="font-size:11px;color:#94a3b8">Прогноз нарушений на будущее</div>
          </div>
        </div>

        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:12px;color:#94a3b8">Смотреть вперёд:</span>
            <span id="tm-label" style="font-size:13px;font-weight:700;color:#a78bfa">3 месяца</span>
          </div>
          <input type="range" id="tm-slider" min="1" max="12" value="3" oninput="updateTimeMachine(${clientId}, this.value)"
            style="width:100%;accent-color:#a78bfa;cursor:pointer">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#334155;margin-top:4px">
            <span>1 мес</span><span>6 мес</span><span>12 мес</span>
          </div>
        </div>

        <div id="tm-result" style="min-height:80px">
          ${buildTimeMachineResult(emps, events, 3)}
        </div>
      </div>

    </div>

    <!-- ТРЕТЬЯ СТРОКА: Паспорт безопасности -->
    <div class="rc-card panel" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700;color:#f1f5f9">Паспорт безопасности</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px">Красивый отчёт о состоянии охраны труда для вашего клиента</div>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="previewPassport(${clientId})" style="padding:10px 18px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:10px;color:#34d399;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s" onmouseover="this.style.background='rgba(52,211,153,0.2)'" onmouseout="this.style.background='rgba(52,211,153,0.1)'">
            👁 Предпросмотр
          </button>
          <button onclick="downloadPassport(${clientId})" style="padding:10px 18px;background:linear-gradient(90deg,#059669,#34d399);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            📥 Скачать PDF
          </button>
        </div>
      </div>

      <!-- Превью паспорта -->
      <div id="passport-preview" style="display:none;margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
            <div>
              <div style="font-size:18px;font-weight:800;color:#f1f5f9">${c.name}</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px">ПАСПОРТ БЕЗОПАСНОСТИ · ${new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:32px;font-weight:800;color:${scoreColor}">${realScore}%</div>
              <div style="font-size:11px;color:#64748b">общая готовность</div>
            </div>
          </div>
          ${scoreBreakdown.map(s => {
            const pct = Math.round(s.score/s.max*100);
            const col = pct===100?'#34d399':pct>=50?'#fbbf24':'#f87171';
            const icon = pct===100?'✅':pct>=50?'⚠️':'❌';
            return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div style="font-size:16px">${icon}</div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                  <span style="font-size:13px;font-weight:600;color:#e2e8f0">${s.label}</span>
                  <span style="font-size:13px;font-weight:700;color:${col}">${pct}%</span>
                </div>
                <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
                  <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${col}99,${col});border-radius:3px;transition:width .6s ease"></div>
                </div>
              </div>
            </div>`;
          }).join('')}
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#334155">
            Подготовлено: ${settings?.user_name||'Специалист по ОТ'} · ${settings?.company_name||''}
          </div>
        </div>
      </div>
    </div>

    <!-- Скрытые данные для симулятора -->
    <script id="rc-data" type="application/json">${JSON.stringify({
      risks, totalFineMin, totalFineMax, probability, riskLabel, riskColor, score,
      clientName: c.name, highRisks
    })}</script>
    </div><!-- /rc-mode-content -->
  `;

  // Сохраняем данные для симулятора
  window._rcData = { risks, totalFineMin, totalFineMax, probability, riskLabel, riskColor, score, clientName: c.name, highRisks, fmtMoney };
  window._rcClient = c;
}

function buildTimeMachineResult(emps, events, months) {
  const future = new Date();
  future.setMonth(future.getMonth() + months);
  const now = new Date();
  const items = [];

  emps.forEach(e => {
    const tr = e.training || {};
    const TYPES = [
      { key:'prog_a',    label:'Программа А', years:3 },
      { key:'first_aid', label:'Первая помощь', years:3 },
      { key:'fire',      label:'Пожарный минимум', years:3 },
      { key:'repeat',    label:'Повторный инструктаж', months:6 },
    ];
    TYPES.forEach(tt => {
      const t = tr[tt.key];
      if (!t?.required || !t?.date) return;
      const next = new Date(t.date);
      if (tt.months) next.setMonth(next.getMonth() + tt.months);
      else next.setFullYear(next.getFullYear() + tt.years);
      if (next > now && next <= future) {
        const days = Math.ceil((next - now) / 86400000);
        items.push({ text:`${e.full_name} — ${tt.label}`, days, date: next });
      }
    });
  });

  events.forEach(ev => {
    const d = new Date(ev.due_date);
    if (d > now && d <= future) {
      const days = Math.ceil((d - now) / 86400000);
      items.push({ text: ev.title, days, date: d });
    }
  });

  items.sort((a,b) => a.days - b.days);

  if (!items.length) return `<div style="text-align:center;padding:16px 0;color:#334155;font-size:12px">
    <div style="font-size:24px;margin-bottom:6px">✨</div>
    В ближайшие ${months} мес. нарушений не ожидается
  </div>`;

  return items.slice(0,4).map(item => {
    const col = item.days <= 14 ? '#f87171' : item.days <= 30 ? '#fbbf24' : '#94a3b8';
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="width:36px;text-align:center;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:${col}">${item.days}</div>
        <div style="font-size:9px;color:#334155">дн.</div>
      </div>
      <div style="flex:1;font-size:11.5px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.text}</div>
      <div style="font-size:10px;color:#475569;flex-shrink:0">${item.date.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
    </div>`;
  }).join('') + (items.length > 4 ? `<div style="font-size:11px;color:#475569;text-align:center;padding:8px 0">+ещё ${items.length-4} событий</div>` : '');
}

async function updateTimeMachine(clientId, months) {
  months = parseInt(months);
  const labels = ['','1 мес','2 мес','3 мес','4 мес','5 мес','6 мес','7 мес','8 мес','9 мес','10 мес','11 мес','12 мес'];
  const label = document.getElementById('tm-label');
  if (label) label.textContent = labels[months] || months + ' мес';
  const emps = await window.api.employeesList(clientId);
  const events = await window.api.eventsList(clientId);
  const result = document.getElementById('tm-result');
  if (result) result.innerHTML = buildTimeMachineResult(emps, events, months);
}

function previewPassport(clientId) {
  const preview = document.getElementById('passport-preview');
  if (!preview) return;
  const isOpen = preview.style.display !== 'none';
  preview.style.display = isOpen ? 'none' : 'block';
}

async function downloadPassport(clientId) {
  showToast('📄 Готовлю паспорт безопасности...');
  const c = await window.api.clientGet(clientId);
  const docs = await window.api.documentsList(clientId);
  const emps = await window.api.employeesList(clientId);
  const s = await window.api.settingsGet();
  const now = new Date();

  const okDocs = docs.filter(d => d.status === 'ok').length;
  const totalDocs = docs.length;
  const sb = [];
  sb.push({ label:'Документация', score: totalDocs>0?Math.round(okDocs/totalDocs*35):0, max:35 });
  let tr = 25;
  if (emps.length === 0) tr = 0; else {
    let bad = 0;
    emps.forEach(e => { const t=e.training||{}; ['prog_a','first_aid','fire','repeat'].forEach(k=>{const x=t[k];if(!x?.required)return;if(!x?.date){bad++;return;}const nx=new Date(x.date);if(k==='repeat')nx.setMonth(nx.getMonth()+6);else nx.setFullYear(nx.getFullYear()+3);const dd=Math.ceil((nx-now)/86400000);if(dd<0)bad+=2;else if(dd<=14)bad+=1;});});
    tr = Math.max(0, Math.round((1-bad/(emps.length*4))*25));
  }
  sb.push({ label:'Обучение персонала', score:tr, max:25 });
  const reqF=['inn','okved','manager_name','manager_position','address','city','phone','staff','region','form'];
  const fF=reqF.filter(k=>c[k]&&String(c[k]).trim()!==''&&String(c[k])!=='0').length;
  sb.push({ label:'Кадровые данные', score:Math.round(fF/reqF.length*25), max:25 });
  let es=0; if(emps.length>0) es=Math.round(emps.filter(e=>e.position&&e.position.trim()).length/emps.length*15);
  sb.push({ label:'Сотрудники', score:es, max:15 });
  const total = Math.min(100, sb.reduce((a,b)=>a+b.score,0));
  const tColor = total>=80?'#059669':total>=40?'#d97706':'#dc2626';

  const rows = sb.map(x => {
    const pct = Math.round(x.score/x.max*100);
    const col = pct===100?'#059669':pct>=50?'#d97706':'#dc2626';
    return `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#1f2937;font-weight:600">${x.label}</td>
      <td style="padding:14px 0;border-bottom:1px solid #e5e7eb;width:50%">
        <div style="background:#f3f4f6;border-radius:6px;height:10px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${col};border-radius:6px"></div>
        </div>
      </td>
      <td style="padding:14px 0 14px 16px;border-bottom:1px solid #e5e7eb;font-size:15px;font-weight:700;color:${col};text-align:right">${pct}%</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
    body{padding:50px 56px;color:#1f2937;background:#fff}
  </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${tColor};padding-bottom:24px;margin-bottom:32px">
      <div>
        <div style="font-size:13px;letter-spacing:2px;color:#9ca3af;font-weight:700;margin-bottom:8px">ПАСПОРТ БЕЗОПАСНОСТИ</div>
        <div style="font-size:24px;font-weight:800;color:#111827">${c.name}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:6px">
          ${c.inn?'ИНН: '+c.inn+' · ':''}${c.okved?'ОКВЭД: '+c.okved+' · ':''}${c.region||''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:48px;font-weight:800;color:${tColor};line-height:1">${total}%</div>
        <div style="font-size:12px;color:#9ca3af">общая готовность</div>
      </div>
    </div>

    <div style="font-size:15px;font-weight:700;color:#374151;margin-bottom:8px">Состояние охраны труда</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px">${rows}</table>

    <div style="background:#f9fafb;border-radius:12px;padding:24px;margin-bottom:32px">
      <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:14px">Сводка</div>
      <div style="display:flex;gap:32px">
        <div><div style="font-size:28px;font-weight:800;color:#111827">${totalDocs}</div><div style="font-size:12px;color:#6b7280">документов</div></div>
        <div><div style="font-size:28px;font-weight:800;color:#111827">${emps.length}</div><div style="font-size:12px;color:#6b7280">сотрудников</div></div>
        <div><div style="font-size:28px;font-weight:800;color:${tColor}">${total>=80?'Готов':total>=40?'Частично':'Требует работы'}</div><div style="font-size:12px;color:#6b7280">к проверке ГИТ</div></div>
      </div>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:13px;color:#6b7280">Подготовил:</div>
        <div style="font-size:15px;font-weight:700;color:#111827;margin-top:4px">${s.user_name||'Специалист по ОТ'}</div>
        <div style="font-size:12px;color:#6b7280">${s.user_position||''}${s.company_name?' · '+s.company_name:''}</div>
        ${s.user_phone?`<div style="font-size:12px;color:#6b7280">${s.user_phone}</div>`:''}
      </div>
      <div style="text-align:right;font-size:12px;color:#9ca3af">
        ${now.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}<br>
        КомплаенсПро
      </div>
    </div>
  </body></html>`;

  const fname = 'Паспорт_безопасности_' + (c.name||'').replace(/[^а-яёa-z0-9]/gi,'_').slice(0,40);
  const result = await window.api.pdfGenerate({ html, filename: fname });
  if (result.ok) showToast('✅ Паспорт сохранён');
  else if (!result.canceled) showToast('Ошибка: ' + (result.error||'не удалось создать PDF'), 'var(--red)');
}

function runInspection(clientId) {
  const btn = document.getElementById('runInspectionBtn');
  const result = document.getElementById('inspectionResult');
  const d = window._rcData;
  if (!d) return;

  const fmtMoney = n => n.toLocaleString('ru-RU') + ' ₽';

  // Анимация "проверки"
  btn.textContent = '⏳ Инспектор проверяет...';
  btn.disabled = true;
  btn.style.opacity = '.7';

  const steps = [
    'Проверка документации по охране труда...',
    'Проверка обучения и инструктажей...',
    'Проверка медосмотров...',
    'Проверка СОУТ и оценки рисков...',
    'Формирование заключения...',
  ];

  let stepIdx = 0;
  result.innerHTML = `<div style="padding:16px 0;display:flex;align-items:center;gap:12px;color:#94a3b8;font-size:13px">
    <div style="width:16px;height:16px;border:2px solid rgba(96,165,250,0.3);border-top-color:#60a5fa;border-radius:50%;animation:spin 0.8s linear infinite"></div>
    <span id="inspStep">${steps[0]}</span>
  </div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

  const stepTimer = setInterval(() => {
    stepIdx++;
    const stepEl = document.getElementById('inspStep');
    if (stepEl && steps[stepIdx]) stepEl.textContent = steps[stepIdx];
    if (stepIdx >= steps.length - 1) clearInterval(stepTimer);
  }, 500);

  // Результат через 2.7 сек
  setTimeout(() => {
    btn.textContent = '🔄 Повторить проверку';
    btn.disabled = false;
    btn.style.opacity = '1';

    const risksHtml = d.risks.length ? d.risks.map(r => {
      const col = r.level === 'high' ? '#f87171' : '#fbbf24';
      const icon = r.level === 'high' ? '🔴' : '🟡';
      return `<div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:rgba(${r.level==='high'?'248,113,113':'251,191,36'},0.06);border:1px solid rgba(${r.level==='high'?'248,113,113':'251,191,36'},0.18);border-radius:12px;margin-bottom:8px">
        <div style="font-size:16px;flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#f1f5f9">${r.title}</div>
          <div style="font-size:11.5px;color:#94a3b8;margin-top:3px">${r.detail} · <span style="color:#64748b">${r.law}</span></div>
          <div style="font-size:11.5px;color:#34d399;margin-top:5px">✓ ${r.fix}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:13px;font-weight:700;color:${col}">${fmtMoney(r.fineMax)}</div>
          <div style="font-size:10px;color:#475569">до</div>
        </div>
      </div>`;
    }).join('') : `<div style="text-align:center;padding:24px">
      <div style="font-size:40px;margin-bottom:10px">✅</div>
      <div style="font-size:16px;font-weight:700;color:#34d399">Нарушений не найдено!</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:4px">Вы полностью готовы к проверке ГИТ</div>
    </div>`;

    result.innerHTML = `
      <div style="animation:rc-in .4s ease both">
        <!-- ВЕРДИКТ -->
        <div style="display:flex;gap:16px;margin-bottom:18px">
          <div style="flex:1;background:rgba(${d.riskColor==='#f87171'?'248,113,113':d.riskColor==='#fbbf24'?'251,191,36':'52,211,153'},0.1);border:1px solid ${d.riskColor}44;border-radius:14px;padding:18px;text-align:center">
            <div style="font-size:11px;color:#94a3b8;letter-spacing:.5px;margin-bottom:6px">УРОВЕНЬ РИСКА</div>
            <div style="font-size:22px;font-weight:800;color:${d.riskColor}">${d.riskLabel}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">вероятность штрафа ~${d.probability}%</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;text-align:center">
            <div style="font-size:11px;color:#94a3b8;letter-spacing:.5px;margin-bottom:6px">ВОЗМОЖНЫЙ ШТРАФ</div>
            <div style="font-size:22px;font-weight:800;color:${d.riskColor}">${d.totalFineMax > 0 ? 'до ' + fmtMoney(d.totalFineMax) : '0 ₽'}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">${d.risks.length} нарушени${d.risks.length===1?'е':d.risks.length>=2&&d.risks.length<=4?'я':'й'}</div>
          </div>
        </div>

        <!-- ЧТО НАЙДЁТ ИНСПЕКТОР -->
        ${d.risks.length ? `<div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:10px">ЧТО НАЙДЁТ ИНСПЕКТОР</div>` : ''}
        ${risksHtml}

        ${d.risks.length ? `<div style="font-size:11px;color:#475569;margin-top:12px;padding:12px;background:rgba(255,255,255,0.02);border-radius:10px;line-height:1.5">
          ⚖️ Суммы указаны для юридических лиц по ст. 5.27.1 КоАП РФ. При повторном нарушении штрафы увеличиваются, возможна дисквалификация до 3 лет или приостановка деятельности до 90 суток.
        </div>` : ''}
      </div>`;
  }, 2700);
}

async function generateEFS1Memo(clientId) {
  const c = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId);
  const s = await window.api.settingsGet();
  const now = new Date();

  // Считаем инвалидов из сотрудников
  const disabledCount = emps.filter(e => e.is_disabled).length;

  // Медосмотры: подлежат и прошли
  const medReq = c.soat_med_req || emps.filter(e => e.training?.medcheck?.required).length;
  const medDone = emps.filter(e => {
    const m = e.training?.medcheck;
    return m?.required && m?.date;
  }).length;

  const period = `I квартал ${now.getFullYear()}`;
  const reportDate = now.toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });

  const H = (text) => ({ text, bold:true, shading:'E8E8E8', size:18, center:true });
  const V = (text, bold=false) => ({ text: String(text ?? '—'), bold, size:20 });
  const N = (val) => ({ text: String(val || '0'), center:true, size:20 });

  const rows = [
    // Заголовок таблицы
    { cells:[{ text:'СВЕДЕНИЯ ДЛЯ ПОДРАЗДЕЛА 2.3 ФОРМЫ ЕФС-1', bold:true, colspan:3, center:true, shading:'D0D8F0', size:20 }] },
    { cells:[{ text:`Организация: ${c.name}`, colspan:3, bold:true, size:20 }] },
    { cells:[{ text:`Отчётный период: ${period}`, colspan:2, size:18 }, { text:`Дата: ${reportDate}`, size:18 }] },
    { cells:[H('Показатель'), H('На 01.01. отч. года'), H('Примечание')] },

    // СОУТ
    { cells:[{ text:'СПЕЦИАЛЬНАЯ ОЦЕНКА УСЛОВИЙ ТРУДА (СОУТ)', bold:true, colspan:3, shading:'F0F4FF', size:18 }] },
    { cells:[V('Всего рабочих мест, подлежащих СОУТ'), N(c.soat_total), V(c.soat_total ? '' : '⚠️ Не заполнено')] },
    { cells:[V('Проведена СОУТ (рабочих мест)'), N(c.soat_done), V('')] },
    { cells:[V('в т.ч. Класс 1 — Оптимальные'), N(c.soat_c1), V('')] },
    { cells:[V('в т.ч. Класс 2 — Допустимые'), N(c.soat_c2), V('')] },
    { cells:[V('в т.ч. Класс 3.1 — Вредные (1 ст.)'), N(c.soat_c31), V('')] },
    { cells:[V('в т.ч. Класс 3.2 — Вредные (2 ст.)'), N(c.soat_c32), V('')] },
    { cells:[V('в т.ч. Класс 3.3 — Вредные (3 ст.)'), N(c.soat_c33), V('')] },
    { cells:[V('в т.ч. Класс 3.4 — Вредные (4 ст.)'), N(c.soat_c34), V('')] },
    { cells:[V('в т.ч. Класс 4 — Опасные'), N(c.soat_c4), V('')] },

    // Медосмотры
    { cells:[{ text:'МЕДИЦИНСКИЕ ОСМОТРЫ', bold:true, colspan:3, shading:'F0F4FF', size:18 }] },
    { cells:[V('Подлежат обязательным медосмотрам'), N(medReq), V('По условиям труда')] },
    { cells:[V('Прошли медосмотр в отчётном периоде'), N(medDone), V('')] },

    // Инвалиды
    { cells:[{ text:'ЧИСЛЕННОСТЬ РАБОТАЮЩИХ ИНВАЛИДОВ (новое с 2026)', bold:true, colspan:3, shading:'F0F4FF', size:18 }] },
    { cells:[V('Работающие инвалиды (начисляются взносы на травматизм)'), N(disabledCount), V(disabledCount === 0 ? 'По данным приложения' : '')] },

    // Подпись
    { cells:[{ text:'', colspan:3 }] },
    { cells:[{ text:`Специалист по ОТ: ${s.user_name || '_______________'}`, colspan:2, size:18 }, { text:'Подпись: _______________', size:18 }] },
    { cells:[{ text:`Должность: ${s.user_position || 'Специалист по охране труда'}`, colspan:3, size:18 }] },
    { cells:[{ text:`Контакт: ${s.user_phone || ''} ${s.user_email || ''}`.trim() || '—', colspan:3, size:18 }] },
  ];

  const result = await window.api.docxGenerate({
    title: 'СПРАВКА ДЛЯ БУХГАЛТЕРА',
    subtitle: `Сведения по охране труда для заполнения ЕФС-1 · ${c.name}`,
    rows,
    filename: `ЕФС-1_Справка_ОТ_${(c.name||'').replace(/[^а-яёa-z0-9]/gi,'_').slice(0,30)}`,
  });

  if (result.ok) showToast('✅ Справка сохранена в Word');
  else if (!result.canceled) showToast('Ошибка: ' + (result.error || 'не удалось создать документ'), 'var(--red)');
}

// ═══════════════════════════════════════════════════════
//  ПРОТОКОЛ ПРОВЕРКИ ЗНАНИЙ
// ═══════════════════════════════════════════════════════

// Точка контроля тарифа — пока всегда разрешено.
// Когда внедрим лицензии, здесь будет проверка тарифа.
function checkTariffAccess(feature) {
  // feature: 'protocol', 'passport', 'simulator' и т.д.
  // TODO: интеграция с системой лицензий
  return true;
}

// Определение категории предприятия по числу сотрудников (ФЗ-209)
function getEnterpriseCategory(staffCount) {
  if (staffCount <= 15) return {
    key: 'micro',
    name: 'Микропредприятие',
    trainingForm: 'instruction',
    formLabel: 'обучение в форме инструктажа',
    info: 'Обучение проводится в форме инструктажа. Проверку знаний может проводить назначенное руководителем лицо без формирования комиссии (п. 2464). Руководитель обязан пройти обучение.',
    color: '#34d399',
    needsCommission: false,
    canChoose: false,
  };
  if (staffCount <= 100) return {
    key: 'small',
    name: 'Малое предприятие',
    trainingForm: 'commission',
    formLabel: 'обучение комиссией или во внешнем центре',
    info: 'Часть работников обязательно обучается во внешнем аккредитованном учебном центре (Приложение № 4 к ПП № 2464). Остальных можно обучать внутри организации при соблюдении условий.',
    color: '#fbbf24',
    needsCommission: true,
    canChoose: true,
  };
  return {
    key: 'large',
    name: 'Среднее/крупное предприятие',
    trainingForm: 'commission',
    formLabel: 'обучение комиссией внутри организации',
    info: 'Обучение проводится внутри организации комиссией. Требуется регистрация ИП/ЮЛ в реестре Минтруда, не менее 2 обучающих лиц, материально-техническая база (учебные места из расчёта 1 на 100 работников).',
    color: '#60a5fa',
    needsCommission: true,
    canChoose: false,
  };
}

async function openProtocolModal(clientId) {
  if (!checkTariffAccess('protocol')) {
    showToast('📋 Протоколы доступны на тарифе «Профи» и выше', 'var(--amber)');
    return;
  }

  const c = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId);

  if (!emps.length) {
    showToast('Сначала добавьте сотрудников', 'var(--amber)');
    return;
  }

  const staffCount = emps.length;
  const cat = getEnterpriseCategory(staffCount);

  // ── ПРОВЕРКА УЛУЧШЕНИЙ ──────────────────────────
  const improvements = [];
  if (cat.needsCommission && !c.ot_name) improvements.push('Не указан ответственный за ОТ (председатель комиссии)');
  const noProgA = emps.filter(e => {
    const t = e.training?.prog_a;
    return t?.required && !t?.date;
  });
  if (noProgA.length) improvements.push(`${noProgA.length} сотр. без даты обучения по Программе А`);
  if (!c.manager_name) improvements.push('Не указан руководитель организации');

  const empRows = emps.map(e => {
    const progA = e.training?.prog_a;
    const trained = progA?.date;
    return `<label style="display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all .15s" 
      onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" class="protocol-emp" value="${e.id}" ${trained?'checked':''} style="width:17px;height:17px;accent-color:var(--blue);cursor:pointer">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${e.full_name}</div>
        <div style="font-size:11px;color:var(--muted2)">${e.position||'—'}${trained?` · обучен ${formatDate(progA.date)}`:' · нет даты обучения'}</div>
      </div>
      ${trained?'<span style="font-size:10px;color:var(--green);font-weight:700">✓ готов</span>':'<span style="font-size:10px;color:var(--amber);font-weight:700">! без даты</span>'}
    </label>`;
  }).join('');

  // Переключатель формы (только для малого бизнеса)
  const choiceBlock = cat.canChoose ? `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.5px;margin-bottom:8px">ФОРМА ОБУЧЕНИЯ</div>
      <div style="display:flex;gap:8px">
        <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="protocol-form" value="commission" checked style="accent-color:var(--blue)"> Комиссией внутри
        </label>
        <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="protocol-form" value="external" style="accent-color:var(--blue)"> Внешний центр
        </label>
      </div>
    </div>` : '';

  let modal = document.getElementById('modalProtocol');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'modalProtocol';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div class="modal" style="max-width:560px;width:90%;max-height:88vh;overflow-y:auto;background:var(--s2);border:1px solid var(--border);border-radius:18px;padding:26px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <span style="font-size:22px">📋</span>
        <div style="font-size:18px;font-weight:700;color:var(--text)">Протокол проверки знаний</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">${c.name}</div>

      <!-- ИНФО О КАТЕГОРИИ -->
      <div style="background:${cat.color}14;border:1px solid ${cat.color}40;border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${cat.color}"></span>
          <span style="font-size:13px;font-weight:700;color:${cat.color}">${cat.name} · ${staffCount} чел.</span>
        </div>
        <div style="font-size:11.5px;color:#d4d4d8;line-height:1.55">${cat.info}</div>
      </div>

      ${improvements.length ? `
      <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:8px">${ic("lightbulb",14)} Ассистент советует дозаполнить:</div>
        ${improvements.map(i=>`<div style="font-size:12px;color:#d4d4d8;padding:3px 0">• ${i}</div>`).join('')}
        <div style="font-size:11px;color:var(--muted2);margin-top:8px">Можно сформировать и сейчас, но с этими данными протокол будет полным.</div>
      </div>` : ''}

      ${choiceBlock}

      <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.5px;margin-bottom:10px">ВЫБЕРИТЕ СОТРУДНИКОВ</div>
      ${empRows}

      <div style="margin-top:16px">
        <div class="form-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">Дата ${cat.needsCommission?'заседания комиссии':'проведения инструктажа'}</div>
        <input class="form-input" id="protocol-date" type="date" value="${new Date().toISOString().slice(0,10)}">
      </div>

      <div style="display:flex;gap:10px;margin-top:22px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('modalProtocol').remove()">Отмена</button>
        <button class="btn btn-primary" style="flex:2" onclick="generateProtocol(${clientId}, '${cat.key}')">📥 Сформировать PDF</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function generateProtocol(clientId, catKey) {
  const checked = [...document.querySelectorAll('.protocol-emp:checked')].map(cb => parseInt(cb.value));
  if (!checked.length) {
    showToast('Выберите хотя бы одного сотрудника', 'var(--amber)');
    return;
  }
  const protocolDate = document.getElementById('protocol-date').value;
  const formChoice = document.querySelector('input[name="protocol-form"]:checked')?.value || 'commission';
  document.getElementById('modalProtocol').remove();
  showToast('📋 Формирую протокол...');

  const c = await window.api.clientGet(clientId);
  const allEmps = await window.api.employeesList(clientId);
  const emps = allEmps.filter(e => checked.includes(e.id));
  const s = await window.api.settingsGet();
  const cat = getEnterpriseCategory(allEmps.length);

  const dateStr = new Date(protocolDate).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
  const yr = new Date(protocolDate).getFullYear();

  // Внешний центр для малого бизнеса
  if (cat.canChoose && formChoice === 'external') {
    const html = buildExternalNotice(c, emps, dateStr, s);
    const fname = `Направление_на_обучение_${(c.name||'').replace(/[^а-яёa-z0-9]/gi,'_').slice(0,30)}`;
    const result = await window.api.pdfGenerate({ html, filename: fname });
    if (result.ok) showToast('✅ Документ сохранён');
    else if (!result.canceled) showToast('Ошибка: ' + (result.error||'PDF'), 'var(--red)');
    return;
  }

  const isMicro = catKey === 'micro';
  const protocolNum = `${(c.order_prefix||1)}-${isMicro?'ИН':'ПЗ'}/${yr}`;
  const chairman = c.ot_name || c.manager_name || 'Председатель комиссии';
  const chairmanPos = c.ot_position || 'Специалист по охране труда';

  const empTableRows = emps.map((e, i) => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;font-size:12px">${i+1}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${e.full_name}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${e.position||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;text-align:center">${isMicro?'Инструктаж':'Программа А'}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;text-align:center;color:#059669;font-weight:600">${isMicro?'проведён':'сдал'}</td>
    </tr>`).join('');

  const docTitle = isMicro
    ? 'ПРОТОКОЛ проведения инструктажа и проверки знаний требований охраны труда'
    : 'ПРОТОКОЛ заседания комиссии по проверке знаний требований охраны труда';

  const intro = isMicro
    ? `Проверку знаний требований охраны труда провёл <b>${chairman}</b> (${chairmanPos}), назначенный приказом работодателя. В соответствии с п. 100 Правил, утв. Постановлением Правительства РФ № 2464 от 24.12.2021, на микропредприятии обучение проведено в форме инструктажа.`
    : `Комиссия в составе председателя <b>${chairman}</b> (${chairmanPos}) провела проверку знаний требований охраны труда у работников организации в объёме программы обучения по охране труда (Программа А) в соответствии с Постановлением Правительства РФ № 2464 от 24.12.2021.`;

  const conclusion = isMicro
    ? `Указанные работники прошли инструктаж по охране труда, проверку знаний и допущены к самостоятельной работе.`
    : `Проверяемые показали удовлетворительные знания требований охраны труда и признаны прошедшими проверку знаний.`;

  const signBlock = isMicro
    ? `<div style="margin-bottom:24px"><b>Инструктаж и проверку провёл:</b><br><br>_______________________ / ${chairman} /</div>`
    : `<div style="margin-bottom:24px"><b>Председатель комиссии:</b><br><br>_______________________ / ${chairman} /</div>
       <div style="margin-bottom:14px;font-size:13px;color:#555">Члены комиссии:</div>
       <div style="margin-bottom:14px">_______________________ / _________________ /</div>
       <div style="margin-bottom:14px">_______________________ / _________________ /</div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Times New Roman',serif}
  body{padding:50px 56px;color:#000;font-size:14px;line-height:1.5}</style></head><body>
    <div style="text-align:center;margin-bottom:8px;font-weight:700;font-size:15px">${c.name}</div>
    <div style="text-align:center;margin-bottom:24px;font-size:12px;color:#444">${c.address||''}${c.inn?' · ИНН '+c.inn:''}</div>
    <div style="text-align:center;font-weight:700;font-size:15px;margin-bottom:4px">ПРОТОКОЛ № ${protocolNum}</div>
    <div style="text-align:center;font-size:13px;margin-bottom:24px">${docTitle.replace('ПРОТОКОЛ ','')}</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px">
      <span>${c.city||'г. ___________'}</span><span>${dateStr}</span>
    </div>
    <p style="margin-bottom:14px;text-align:justify">${intro}</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;width:40px">№</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">Ф.И.О.</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">Должность</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${isMicro?'Вид':'Программа'}</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;width:90px">Результат</th>
      </tr></thead>
      <tbody>${empTableRows}</tbody>
    </table>
    <p style="margin:18px 0;text-align:justify">${conclusion}</p>
    <div style="margin-top:40px">${signBlock}
      <div style="font-size:11px;color:#666;margin-top:30px">Протокол сформирован в системе КомплаенсПро · ${new Date().toLocaleDateString('ru-RU')}</div>
    </div>
  </body></html>`;

  const fname = `Протокол_${protocolNum.replace(/\//g,'-')}_${(c.name||'').replace(/[^а-яёa-z0-9]/gi,'_').slice(0,30)}`;
  const result = await window.api.pdfGenerate({ html, filename: fname });
  if (result.ok) showToast('✅ Протокол сохранён');
  else if (!result.canceled) showToast('Ошибка: ' + (result.error||'не удалось создать PDF'), 'var(--red)');
}

function buildExternalNotice(c, emps, dateStr, s) {
  const rows = emps.map((e,i)=>`<tr>
    <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;font-size:12px">${i+1}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${e.full_name}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${e.position||'—'}</td>
  </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Times New Roman',serif}
  body{padding:50px 56px;color:#000;font-size:14px;line-height:1.5}</style></head><body>
    <div style="text-align:center;margin-bottom:8px;font-weight:700;font-size:15px">${c.name}</div>
    <div style="text-align:center;margin-bottom:24px;font-size:12px;color:#444">${c.address||''}${c.inn?' · ИНН '+c.inn:''}</div>
    <div style="text-align:center;font-weight:700;font-size:15px;margin-bottom:20px">СПИСОК работников для направления на обучение по охране труда</div>
    <div style="text-align:right;margin-bottom:16px;font-size:13px">${dateStr}</div>
    <p style="margin-bottom:14px;text-align:justify">Направить на обучение по охране труда (Программа А) во внешний аккредитованный учебный центр следующих работников в соответствии с Приложением № 4 к ПП № 2464:</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;width:40px">№</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">Ф.И.О.</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">Должность</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>
    <div style="margin-top:40px"><b>Руководитель:</b><br><br>_______________________ / ${c.manager_name||'_________________'} /</div>
    <div style="font-size:11px;color:#666;margin-top:30px">Сформировано в системе КомплаенсПро · ${new Date().toLocaleDateString('ru-RU')}</div>
  </body></html>`;
}

// ЦЕНТР ГОТОВНОСТИ — РЕЖИМ ПДн
// ═══════════════════════════════════════════════════════════

// Переключение режима ОТ / ПДн
async function rcSwitchMode(mode, clientId) {
  const btnOt = document.getElementById('rc-tab-ot');
  const btnPd = document.getElementById('rc-tab-pd');
  const btnVu = document.getElementById('rc-tab-vu');

  // Сбрасываем все вкладки в неактивное состояние
  [
    { btn: btnOt, color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.5)' },
    { btn: btnPd, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.5)'  },
    { btn: btnVu, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.5)' },
  ].forEach(({ btn, color, bg, border }) => {
    if (!btn) return;
    btn.classList.remove('rc-active');
    btn.style.background   = 'rgba(255,255,255,0.03)';
    btn.style.borderColor  = 'rgba(255,255,255,0.08)';
    btn.style.color        = '#475569';
  });

  // Активируем нужную вкладку
  const configs = {
    ot: { btn: btnOt, color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.5)' },
    pd: { btn: btnPd, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.5)'  },
    vu: { btn: btnVu, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.5)' },
  };
  const active = configs[mode];
  if (active?.btn) {
    active.btn.classList.add('rc-active');
    active.btn.style.background  = active.bg;
    active.btn.style.borderColor = active.border;
    active.btn.style.color       = active.color;
  }

  if (mode === 'ot') {
    await openReadinessCenter(clientId);
  } else if (mode === 'pd') {
    await renderPdReadiness(clientId);
  } else if (mode === 'vu') {
    await renderVuReadiness(clientId);
  }
}
