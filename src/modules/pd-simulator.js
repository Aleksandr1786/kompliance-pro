// ============================================================
// КОМПЛАЕНСПРО — pd-simulator.js
// Симулятор проверки РКН, генерация отчёта ПДн
// Выделен из app.js, версия 08.06.2026
// ============================================================

// Симулятор проверки РКН (вызывается из Центра готовности)
async function rcSwitchMode(mode, clientId) {
  // Подсветка активной кнопки
  document.querySelectorAll('[id^="rc-tab-"]').forEach(btn => {
    btn.style.borderColor = 'rgba(255,255,255,0.08)';
    btn.style.background = 'rgba(255,255,255,0.03)';
    btn.style.color = '#475569';
  });
  const activeBtn = document.getElementById('rc-tab-' + mode);
  if (activeBtn) {
    activeBtn.style.borderColor = mode === 'ot' ? 'rgba(248,113,113,0.5)' : mode === 'pd' ? 'rgba(96,165,250,0.5)' : 'rgba(167,139,250,0.5)';
    activeBtn.style.background = mode === 'ot' ? 'rgba(248,113,113,0.12)' : mode === 'pd' ? 'rgba(96,165,250,0.12)' : 'rgba(167,139,250,0.12)';
    activeBtn.style.color = mode === 'ot' ? '#f87171' : mode === 'pd' ? '#60a5fa' : '#a78bfa';
  }

  const content = document.getElementById('rc-mode-content');
  if (!content) return;

  if (mode === 'ot') {
    // Перезагружаем страницу Центра готовности
    if (_readinessClientId) openReadinessCenter(_readinessClientId);
  } else if (mode === 'pd') {
    await renderPdSimulator(clientId);
  } else if (mode === 'vu') {
    content.innerHTML = `<div style="text-align:center;padding:60px 0;color:#475569">
      <div style="font-size:40px;margin-bottom:12px">⭐</div>
      <div style="font-size:15px;font-weight:600;color:#94a3b8">Симулятор военкомата</div>
      <div style="font-size:13px;margin-top:6px">в разработке</div>
    </div>`;
  }
}

async function renderPdSimulator(clientId) {
  const c = await window.api.clientGet(clientId);
  const docs = await window.api.documentsList(clientId);
  const emps = await window.api.employeesList(clientId);
  const pdDocs = docs.filter(d => d.module === 'PD');
  const now = new Date();

  // Расчёт рисков РКН
  const risks = [];

  // 1. Уведомление РКН
  if (!c.pd_notified_rkn) {
    risks.push({
      level: 'high',
      title: 'РКН не уведомлена об обработке ПД',
      detail: 'Отсутствует уведомление в реестр операторов ПД',
      law: 'ч.1 ст.13.11 КоАП РФ',
      fine: 'до 18 млн ₽ оборотного штрафа',
      fineMin: 500000, fineMax: 18000000,
      fix: 'Подать уведомление на pd.rkn.gov.ru',
    });
  }

  // 2. Ответственный за ПДн
  if (!c.pd_responsible_name) {
    risks.push({
      level: 'high',
      title: 'Не назначен ответственный за обработку ПД',
      detail: 'Отсутствует приказ о назначении',
      law: 'ч.1 ст.13.11 КоАП РФ',
      fine: 'до 100 000 ₽',
      fineMin: 50000, fineMax: 100000,
      fix: 'Назначить ответственного приказом',
    });
  }

  // 3. Документы ПДн
  if (pdDocs.length === 0) {
    risks.push({
      level: 'high',
      title: 'Отсутствуют документы по защите ПД',
      detail: 'Политика ПД, согласия, приказы не разработаны',
      law: 'ч.1 ст.13.11 КоАП РФ',
      fine: 'до 100 000 ₽',
      fineMin: 50000, fineMax: 100000,
      fix: 'Сгенерировать пакет документов ПДн',
    });
  }

  // 4. ИСПДн
  if (!(c.pd_ispdn_list || []).length) {
    risks.push({
      level: 'medium',
      title: 'Не указаны информационные системы ПД',
      detail: 'Перечень ИСПДн отсутствует',
      law: 'ч.1 ст.13.11 КоАП РФ',
      fine: 'до 50 000 ₽',
      fineMin: 30000, fineMax: 50000,
      fix: 'Добавить перечень ИСПДн в карточке клиента',
    });
  }

  const totalFine = risks.reduce((s, r) => s + r.fineMin, 0);
  const errorCount = risks.filter(r => r.level === 'high').length;
  const warnCount = risks.filter(r => r.level === 'medium').length;
  const probability = Math.min(95, errorCount * 30 + warnCount * 10 + 5);

  let riskLabel, riskColor;
  if (probability >= 70) { riskLabel = 'ВЫСОКИЙ'; riskColor = '#f87171'; }
  else if (probability >= 40) { riskLabel = 'СРЕДНИЙ'; riskColor = '#fbbf24'; }
  else { riskLabel = 'НИЗКИЙ'; riskColor = '#34d399'; }

  const fmtMoney = n => n >= 1000000 ? (n / 1000000).toFixed(1) + ' млн ₽' : n.toLocaleString('ru-RU') + ' ₽';

  const content = document.getElementById('rc-mode-content');
  if (!content) return;

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- Виджет: Симулятор РКН -->
      <div class="panel" style="grid-column:1/-1">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Что будет, если завтра проверка РКН?</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Симуляция проверки Роскомнадзора по 152-ФЗ</div>
          </div>
          <button onclick="runRknInspection(${clientId})" id="runRknInspectionBtn" style="
            padding:11px 22px;background:linear-gradient(90deg,#2563eb,#7c3aed);
            border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;
            cursor:pointer;white-space:nowrap;transition:opacity .15s"
            onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ▶ Запустить проверку РКН
          </button>
        </div>
        <div id="rknInspectionResult"></div>
      </div>

    </div>

    <!-- Результаты симуляции -->
    <div id="rkn-protocol-area"></div>
  `;

  // Сохраняем данные
  window._rcPdData = { c, docs: pdDocs, emps, risks, score: Math.max(0, 100 - errorCount * 25 - warnCount * 10), probability, riskLabel, riskColor, clientName: c.name, totalFine, fmtMoney };
}

async function runRknInspection(clientId) {
  const btn = document.getElementById('runRknInspectionBtn');
  const result = document.getElementById('rknInspectionResult');
  const d = window._rcPdData;
  if (!d) return;

  btn.textContent = '⏳ Инспектор проверяет...';
  btn.disabled = true;
  btn.style.opacity = '.7';

  const steps = [
    { icon:'🔍', text:'Проверяю наличие уведомления РКН...', duration:1500,
      status: d.c.pd_notified_rkn ? 'ok' : 'error',
      result: d.c.pd_notified_rkn ? '✅ Уведомление РКН подано' : `❌ Уведомление РКН не подано` },
    { icon:'👤', text:'Проверяю ответственного за ПДн...', duration:1800,
      status: d.c.pd_responsible_name ? 'ok' : 'error',
      result: d.c.pd_responsible_name ? `✅ Ответственный: ${d.c.pd_responsible_name}` : '❌ Ответственный за ПДн не назначен' },
    { icon:'📄', text:'Проверяю документацию ПДн...', duration:2000,
      status: d.docs.length > 0 ? 'ok' : 'error',
      result: d.docs.length > 0 ? `✅ Документов ПДн: ${d.docs.length} шт.` : '❌ Документы ПДн не разработаны' },
    { icon:'💻', text:'Проверяю перечень ИСПДн...', duration:1800,
      status: (d.c.pd_ispdn_list||[]).length>0 ? 'ok' : 'warn',
      result: (d.c.pd_ispdn_list||[]).length>0
        ? `✅ ИСПДн: ${(d.c.pd_ispdn_list||[]).map(i=>i.name||i).join(', ')}`
        : `⚠️ Информационные системы ПД не указаны` },
    { icon:'✍️', text:'Проверяю согласия сотрудников...', duration:3000,
      status: d.emps.length===0 ? 'warn' : 'ok',
      result: d.emps.length===0
        ? `⚠️ Сотрудники не добавлены в систему`
        : `✅ Сотрудников: ${d.emps.length} чел.` },
    { icon:'📝', text:'Составляю протокол проверки...', duration:3000, status:null },
  ];

  const statusColors = { ok:'#34d399', error:'#f87171', warn:'#fbbf24' };
  const statusLabels = { ok:'✓ OK', error:'✗ Нарушение', warn:'⚠ Замечание' };

  // Анимация проверки
  result.innerHTML = `
    <div style="padding:16px 0">
      <div id="rkn-step-box" style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <span id="rkn-step-icon" style="font-size:20px;transition:opacity .4s">🔍</span>
        <span id="rkn-step-text" style="font-size:13px;color:#94a3b8;transition:opacity .4s">Начинаю проверку...</span>
        <span id="rkn-step-status" style="font-size:12px;font-weight:600;margin-left:auto;transition:opacity .4s"></span>
      </div>
      <div id="rkn-step-label" style="font-size:10px;color:#334155;margin-bottom:4px"></div>
      <div id="rkn-progress-bar" style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden">
        <div id="rkn-progress-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa);border-radius:2px;transition:width .3s"></div>
      </div>
      <div id="rkn-log" style="margin-top:12px;display:flex;flex-direction:column;gap:4px"></div>
    </div>`;

  const iconEl = document.getElementById('rkn-step-icon');
  const textEl = document.getElementById('rkn-step-text');
  const statusEl = document.getElementById('rkn-step-status');
  const labelEl = document.getElementById('rkn-step-label');
  const barEl = document.getElementById('rkn-progress-fill');
  const logEl = document.getElementById('rkn-log');

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fadeOut = el => { el.style.opacity='0'; return sleep(400); };
  const fadeIn  = el => { el.style.opacity='0'; void el.offsetWidth; setTimeout(()=>el.style.opacity='1',50); };

  for (let i=0; i<steps.length; i++) {
    const step = steps[i];

    await fadeOut(iconEl);
    await fadeOut(textEl);
    iconEl.textContent = step.icon;
    textEl.textContent = step.text;
    statusEl.textContent = '';
    labelEl.textContent = `Шаг ${i+1} из ${steps.length}`;
    fadeIn(iconEl);
    fadeIn(textEl);

    barEl.style.transition = 'none';
    barEl.style.width = '0%';
    void barEl.offsetWidth;
    barEl.style.transition = `width ${step.duration - 200}ms linear`;
    await sleep(50);
    barEl.style.width = '95%';

    await sleep(step.duration - 400);

    barEl.style.transition = 'width .3s ease';
    barEl.style.width = '100%';
    if (step.status) {
      barEl.style.background = `linear-gradient(90deg,${statusColors[step.status]}99,${statusColors[step.status]})`;
      statusEl.style.color = statusColors[step.status];
      statusEl.textContent = statusLabels[step.status];
    }
    await sleep(400);

    if (step.result) {
      const logLine = document.createElement('div');
      logLine.style.cssText = `padding:7px 12px;border-radius:8px;font-size:12px;color:${step.status?statusColors[step.status]:'#94a3b8'};background:rgba(255,255,255,0.02);border-left:3px solid ${step.status?statusColors[step.status]:'rgba(255,255,255,0.1)'};opacity:0;transition:opacity .3s`;
      logLine.textContent = step.result;
      logEl.appendChild(logLine);
      void logLine.offsetWidth;
      logLine.style.opacity = '1';
    }

    barEl.style.background = 'linear-gradient(90deg,#60a5fa,#a78bfa)';
    await sleep(200);
  }

  await fadeOut(iconEl);
  await fadeOut(textEl);
  document.getElementById('rkn-step-box').style.display = 'none';

  await sleep(300);
  const errorCount = d.risks.filter(r=>r.level==='high').length;
  const warnCount  = d.risks.filter(r=>r.level==='medium').length;

  const protocol = document.createElement('div');
  protocol.style.cssText = 'margin-top:16px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;opacity:0;transition:opacity .5s';
  protocol.innerHTML = `
    <div style="padding:14px 16px;background:${errorCount>0?'rgba(248,113,113,0.1)':'rgba(52,211,153,0.1)'};border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:14px;font-weight:700;color:#f1f5f9">📋 ПРОТОКОЛ ПРОВЕРКИ РКН</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">${d.c.name} · ${new Date().toLocaleDateString('ru-RU')} · Автоматическая проверка</div>
    </div>
    <div style="padding:14px 16px">
      ${d.risks.length === 0
        ? `<div style="color:#34d399;font-size:13px;padding:10px 0">✅ Нарушений не выявлено. Организация соответствует требованиям 152-ФЗ.</div>`
        : d.risks.map((r,i) => `
          <div style="padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.02);border-left:3px solid ${r.level==='high'?'#f87171':'#fbbf24'};border-radius:6px">
            <div style="font-size:12px;font-weight:600;color:#f1f5f9">${i+1}. ${r.title}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px">${r.law} · Санкция: ${r.fine}</div>
            <div style="font-size:11px;color:#60a5fa;margin-top:2px">→ ${r.fix}</div>
          </div>`).join('')}
      <div style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.02);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12px;color:#94a3b8">Нарушений: <strong style="color:#f87171">${errorCount}</strong> критичных · <strong style="color:#fbbf24">${warnCount}</strong> средних</div>
        ${d.risks.length>0?`<div style="font-size:12px;font-weight:600;color:#fbbf24">Срок устранения: 30 дней</div>`:''}
      </div>
    </div>
  `;
  result.appendChild(protocol);
  void protocol.offsetWidth;
  protocol.style.opacity = '1';

  if (btn) { btn.disabled=false; btn.style.opacity='1'; btn.textContent='↺ Повторить'; }
}

// Генерация Word-отчёта о состоянии ПДн
async function generatePdReport(clientId) {
  const btn = document.getElementById('pdReportBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Формирую...'; }
  try {
    const d = window._rcPdData;
    if (!d) { showToast('Сначала откройте раздел ПДн', 'var(--amber)'); return; }
    const { c, docs, emps, risks, score, probability, riskLabel } = d;
    const today = new Date().toLocaleDateString('ru-RU');

    const data = {
      title: `Отчёт о состоянии обработки персональных данных`,
      subtitle: `${c.name} · ${today}`,
      rows: [
        { cells: [{ text: 'ОБЩАЯ ИНФОРМАЦИЯ', bold: true, colspan: 2 }] },
        { cells: [{ text: 'Организация' }, { text: c.name }] },
        { cells: [{ text: 'ИНН' }, { text: c.inn || '—' }] },
        { cells: [{ text: 'Ответственный за ПДн' }, { text: c.pd_responsible_name || 'Не назначен' }] },
        { cells: [{ text: 'РКН уведомлена' }, { text: c.pd_notified_rkn ? `Да (${c.pd_notification_date||'дата не указана'})` : 'Нет' }] },
        { cells: [{ text: 'ИСПДн' }, { text: (c.pd_ispdn_list||[]).map(i=>i.name||i).join(', ') || 'Не указаны' }] },
        { cells: [{ text: '' }, { text: '' }] },
        { cells: [{ text: 'ОЦЕНКА ГОТОВНОСТИ', bold: true, colspan: 2 }] },
        { cells: [{ text: 'Общий score' }, { text: `${score}% (${score>=80?'Высокий':score>=40?'Средний':'Низкий'} уровень)` }] },
        { cells: [{ text: 'Документы ПДн' }, { text: `${docs.length} документов` }] },
        { cells: [{ text: 'Сотрудников' }, { text: `${emps.length} чел.` }] },
        { cells: [{ text: 'Индекс риска РКН' }, { text: `${probability}% — ${riskLabel}` }] },
        { cells: [{ text: '' }, { text: '' }] },
        { cells: [{ text: 'ВЫЯВЛЕННЫЕ НАРУШЕНИЯ', bold: true, colspan: 2 }] },
        ...( risks.length === 0
          ? [{ cells: [{ text: 'Нарушений не выявлено', colspan: 2 }] }]
          : risks.map((r,i) => ({ cells: [{ text: `${i+1}. ${r.title}` }, { text: `${r.law} · ${r.fine}` }] }))
        ),
        { cells: [{ text: '' }, { text: '' }] },
        { cells: [{ text: 'РЕКОМЕНДАЦИИ', bold: true, colspan: 2 }] },
        ...( risks.length === 0
          ? [{ cells: [{ text: 'Продолжать поддерживать текущий уровень соответствия', colspan: 2 }] }]
          : risks.map((r,i) => ({ cells: [{ text: `${i+1}.` }, { text: r.fix }] }))
        ),
        { cells: [{ text: '' }, { text: '' }] },
        { cells: [{ text: `Отчёт подготовлен: ${today}`, colspan: 2 }] },
      ],
      filename: `Отчёт_ПДн_${c.name.replace(/[^а-яёa-z0-9]/gi,'_').slice(0,30)}_${today.replace(/\./g,'-')}`
    };

    const result = await window.api.docxGenerate(data);
    if (result?.ok) {
      showToast('✅ Отчёт сохранён в Word', 'var(--green)');
      if (result.path) window.api.docsOpenFile(result.path);
    } else {
      showToast('Ошибка при создании отчёта', 'var(--red)');
    }
  } catch(e) {
    showToast('Ошибка: ' + e.message, 'var(--red)');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = ic('save',14) + ' Сохранить Word'; }
  }
}