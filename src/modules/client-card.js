// ============================================================
// КОМПЛАЕНСПРО — client-card.js
// Карточка клиента: табы, документы, подразделения, сотрудники, обучение
// Декомпозиция app.js — батч 2, 10.06.2026
// ============================================================

// Компактное кольцо общей готовности для шапки карточки клиента — тот же
// визуальный язык, что у колец на дашборде аутсорсера (dashboard.js), но
// одноцветное (здесь один клиент, не разбивка по 3 модулям) и меньше
// размером, чтобы поместиться в строку рядом с мини-полосками компонентов.
function renderScoreRing(score, color, size = 56, stroke = 6) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return `<div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0">
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${dash} ${c}" stroke-linecap="round"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:${color}">${score}%</div>
  </div>`;
}

async function renderClientCard(id) {
  const c = await window.api.clientGet(id);
  if (!c) { renderComingSoon('Клиент не найден'); return; }
  const docs = await window.api.documentsList(id);
  const events = await window.api.eventsList(id);
  const emps = await window.api.employeesList(id);
  const divisions = await window.api.divisionsList(id);
  const tasks = await window.api.tasksList();
  const clientTasks = tasks.filter(t => t.client_id == id);
  const mods = (c.modules||'OT').split(',');
  const initials = getInitials(c.name);

  // ── КОМПЛЕКСНЫЙ ПОДСЧЁТ ГОТОВНОСТИ (100 баллов) ──────────
  let scoreTotal = 0;
  const scoreBreakdown = [];

  // 1. ДОКУМЕНТЫ — 35 баллов
  const totalDocs = docs.length;
  const okDocs    = docs.filter(d => d.status === 'ok').length;
  let docsScore = 0;
  if (totalDocs > 0) {
    docsScore = Math.round(okDocs / totalDocs * 35);
  }
  scoreTotal += docsScore;
  scoreBreakdown.push({ label:'Документы', score:docsScore, max:35, pct: totalDocs>0 ? Math.round(okDocs/totalDocs*100) : 0 });

  // 2. ОБУЧЕНИЕ СОТРУДНИКОВ — 25 баллов
  let trainingScore = 25;
  const now = new Date();
  if (emps.length === 0) {
    trainingScore = 0; // нет сотрудников — нет баллов
  } else {
    let badCount = 0;
    emps.forEach(e => {
      const tr = e.training || {};
      ['prog_a','first_aid','fire','repeat'].forEach(key => {
        const t = tr[key];
        if (!t?.required) return;
        if (!t?.date) { badCount++; return; }
        const last = new Date(t.date);
        const next = new Date(last);
        if (key === 'repeat') next.setMonth(next.getMonth() + 6);
        else next.setFullYear(next.getFullYear() + 3);
        const days = Math.ceil((next - now) / 86400000);
        if (days < 0) badCount += 2;
        else if (days <= 14) badCount += 1;
      });
    });
    const maxBad = emps.length * 4;
    trainingScore = Math.max(0, Math.round((1 - badCount / maxBad) * 25));
  }
  scoreTotal += trainingScore;
  scoreBreakdown.push({ label:'Обучение', score:trainingScore, max:25 });

  // 3. ЗАПОЛНЕННОСТЬ ДАННЫХ — 25 баллов
  const requiredFields = [
    { key:'inn',              label:'ИНН' },
    { key:'okved',            label:'ОКВЭД' },
    { key:'manager_name',     label:'ФИО руководителя' },
    { key:'manager_position', label:'Должность руководителя' },
    { key:'address',          label:'Юридический адрес' },
    { key:'city',             label:'Город' },
    { key:'phone',            label:'Телефон' },
    { key:'staff',            label:'Количество сотрудников' },
    { key:'region',           label:'Регион' },
    { key:'form',             label:'Форма организации' },
  ];
  const filledFields = requiredFields.filter(f => c[f.key] && String(c[f.key]).trim() !== '' && String(c[f.key]) !== '0').length;
  const dataScore = Math.round(filledFields / requiredFields.length * 25);
  scoreTotal += dataScore;
  scoreBreakdown.push({ label:'Данные клиента', score:dataScore, max:25, filled:filledFields, total:requiredFields.length, missing: requiredFields.filter(f => !c[f.key] || String(c[f.key]).trim()==='' || String(c[f.key])==='0').map(f=>f.label) });

  // 4. СОТРУДНИКИ — 15 баллов
  let empScore = 0;
  if (emps.length > 0) {
    const withPosition = emps.filter(e => e.position && e.position.trim()).length;
    empScore = Math.round(withPosition / emps.length * 15);
  }
  scoreTotal += empScore;
  scoreBreakdown.push({ label:'Сотрудники', score:empScore, max:15 });

  // realScore — ОБЩАЯ готовность клиента по ВСЕМ подключённым модулям,
  // а не только по ОТ. До этой правки здесь считалась смешанная метрика
  // (docsScore по ВСЕМ документам клиента сразу, без разделения по
  // модулям, плюс чисто ОТ-специфичные обучение/данные/сотрудники) —
  // из-за этого «Готовность» в шапке карточки не совпадала ни с одной
  // из формул в Центре готовности (readiness-calc.js: calcOtReadiness/
  // calcPdReadiness/calcVuReadiness), что и заметил пользователь на
  // примере ИП Свинцова (83% в шапке vs 35% на вкладке ПДн — оба числа
  // были «правильными» по своей же логике, но про разные вещи).
  // Теперь realScore = среднее по тем модулям, что реально подключены
  // у клиента (c.modules) — тот же принцип, что и в кольце на дашборде.
  async function calcOverallScore() {
    const settingsAll = await window.api.settingsGet();
    const scores = [];
    if (mods.includes('OT')) {
      const docsOt = docs.filter(d => d.module === 'OT');
      if (docsOt.length || emps.length) scores.push(calcOtReadiness(c, docsOt, emps));
    }
    if (mods.includes('PD')) {
      const docsPd = docs.filter(d => d.module === 'PD');
      if (docsPd.length) scores.push(calcPdReadiness(c, docsPd));
    }
    if (mods.includes('VU')) {
      const vuData = parseVuData(settingsAll, id);
      const docsVu = docs.filter(d => d.module === 'VU');
      if (docsVu.length || Object.keys(vuData).length) scores.push(calcVuReadiness(c, emps, vuData));
    }
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }
  const realScore = await calcOverallScore();
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
    editBtn.innerHTML = `${ic("edit",14)} Редактировать`;
    document.getElementById('topbarAction').after(editBtn);
  }
  editBtn.style.display = 'flex';
  const _cid = id;
  editBtn.onclick = () => openEditModal(_cid);

  const otDocs = docs.filter(d => d.module === 'OT');
  const pdDocs = docs.filter(d => d.module === 'PD');
  const vuDocs = docs.filter(d => d.module === 'VU');
  // Папка модуля ОТ (для кнопки "Открыть папку") — корень «Охрана труда», а не первый раздел
  const safeName = (c.name || '').replace(/[\/\\:*?"<>|]/g, '_').slice(0, 60);
  let clientDocDir = null;
  if (otDocs.length && otDocs[0].filepath) {
    const fp = otDocs[0].filepath;
    const m = fp.match(/^(.*[\\/]Охрана труда)[\\/]/);
    clientDocDir = m ? m[1] : fp.replace(/[\\/][^\\/]+$/, '');
  }
  _currentClientDocDir = clientDocDir;

  document.getElementById('content').innerHTML = `
    <div class="hero">
      <div class="hero-top">
        <div class="hero-avatar" style="background:${c.color||'#60a5fa'}22;border:1px solid ${c.color||'#60a5fa'}44">${initials}</div>
        <div style="flex:1;min-width:0">
          <div class="hero-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
          <div class="hero-tags">
            ${c.inn?`<span class="hero-tag">ИНН: ${c.inn}</span>`:''}
            ${c.okved?`<span class="hero-tag">ОКВЭД: ${c.okved}</span>`:''}
            ${c.region?`<span class="hero-tag">${ic("map-pin",12)} ${c.region}</span>`:''}
            ${c.staff?`<span class="hero-tag">${emps.length || c.staff} сотр.</span>`:''}
            ${c.form?`<span class="hero-tag">${c.form}</span>`:''}
            ${c.contract_date?`<span class="hero-tag" title="Дата договора">${ic("file-text",12)} с ${formatDate(c.contract_date)}</span>`:''}
            ${c.git_last_date?`<span class="hero-tag" title="Последняя проверка ГИТ" style="color:var(--amber)">${ic("search",12)} ГИТ: ${formatDate(c.git_last_date)}</span>`:''}
            ${c.next_visit_date?`<span class="hero-tag" title="Следующий обход" style="color:var(--blue2)">${ic("refresh",12)} Обход: ${formatDate(c.next_visit_date)}</span>`:''}
            ${c.git_next_date?`<span class="hero-tag" title="Плановая проверка ГИТ" style="color:var(--red)">${ic("alert-triangle",12)} Пл.ГИТ: ${formatDate(c.git_next_date)}</span>`:''}
            ${c.address_actual && c.address_actual.trim() !== (c.address||'').trim() ? `<span class="hero-tag" title="Фактический адрес отличается от юридического">${ic("map-pin",12)} Факт.: ${c.address_actual}</span>`:''}
          </div>
        </div>
        <div class="hero-score" style="text-align:right;cursor:pointer;position:relative;display:flex;align-items:center;gap:14px" onclick="toggleScoreBreakdown()" title="Нажмите для деталей">
          <div style="text-align:right">
            <div class="score-label" style="margin-bottom:2px">Готовность</div>
            <div style="display:flex;gap:3px;justify-content:flex-end">
              ${scoreBreakdown.map(s => {
                const pct = Math.round(s.score/s.max*100);
                const c = pct===100?'#34d399':pct>=50?'#fbbf24':'#f87171';
                return `<div title="${s.label}: ${s.score}/${s.max}" style="width:18px;height:3px;border-radius:2px;background:${c}"></div>`;
              }).join('')}
            </div>
          </div>
          ${renderScoreRing(realScore, scoreColor)}
        </div>
        <!-- Score breakdown panel -->
        <div id="score-breakdown" style="display:none;position:absolute;top:100%;right:0;margin-top:8px;z-index:100;
          background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px 18px;
          min-width:240px;box-shadow:0 16px 40px rgba(0,0,0,0.5)">
          <div style="font-size:11px;font-weight:700;color:#475569;letter-spacing:.8px;margin-bottom:10px">ДЕТАЛИЗАЦИЯ ПО ОХРАНЕ ТРУДА</div>
          ${scoreBreakdown.map(s => {
            const pct = Math.round(s.score/s.max*100);
            const col = pct===100?'#34d399':pct>=50?'#fbbf24':'#f87171';
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-size:12px;color:#e2e8f0">${s.label}</span>
                <span style="font-size:11px;font-weight:700;color:${col}">${s.score}/${s.max}</span>
              </div>
              <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div>
              </div>
              ${s.missing?.length ? `<div style="font-size:10px;color:#475569;margin-top:3px">Не заполнено: ${s.missing.slice(0,3).join(', ')}${s.missing.length>3?'...':''}</div>` : ''}
            </div>`;
          }).join('')}
          ${(mods.includes('PD') || mods.includes('VU')) ? `
            <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:6px;padding-top:10px">
              <div style="font-size:10px;color:#475569;margin-bottom:6px">ДРУГИЕ МОДУЛИ — см. вкладки ПДн/ВУ для деталей</div>
              ${mods.includes('PD') ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:3px">ПДн — отдельная готовность на вкладке «ПДн»</div>` : ''}
              ${mods.includes('VU') ? `<div style="font-size:11px;color:#94a3b8">ВУ — отдельная готовность на вкладке «Воинский учёт»</div>` : ''}
            </div>` : ''}
        </div>
      </div>
      <div class="hero-stats">
        <div class="hstat"><div class="hstat-val" style="color:var(--green)">${docs.length}</div><div class="hstat-label">Документов</div></div>
        <div class="hstat"><div class="hstat-val" style="color:var(--amber)">${docs.filter(d=>d.status==='outdated').length}</div><div class="hstat-label">Обновить</div></div>
        <div class="hstat"><div class="hstat-val" style="color:var(--red)">${events.filter(e=>new Date(e.due_date)<new Date()).length}</div><div class="hstat-label">Просрочено</div></div>
        <div class="hstat"><div class="hstat-val">${emps.length}</div><div class="hstat-label">Сотрудников</div></div>
      </div>
    </div>

    ${(() => {
      // Баннер заполненности профиля — показывает прогресс и подталкивает к 100%.
      // Чем полнее данные клиента, тем точнее документы.
      const dataBlock = scoreBreakdown.find(s => s.label === 'Данные клиента');
      const filled = dataBlock?.filled ?? 0;
      const total  = dataBlock?.total  ?? 10;
      const missing = dataBlock?.missing || [];
      const empNoPosition = emps.find(e => !e.position || !e.position.trim());
      const pct = Math.round(filled / total * 100);

      // Баннер заполненности (показываем всегда пока не 100%)
      let profileBanner = '';
      if (filled < total) {
        const barColor = pct < 40 ? '#f87171' : pct < 70 ? '#fbbf24' : '#34d399';
        const missingList = missing.slice(0, 3).join(', ') + (missing.length > 3 ? ` и ещё ${missing.length - 3}` : '');
        profileBanner = `
        <div onclick="openEditModal(${id})" style="
          cursor:pointer;
          background:rgba(15,21,32,0.6);border:1px solid rgba(255,255,255,0.08);
          border-radius:12px;padding:12px 16px;margin-bottom:14px;transition:all .2s"
          onmouseover="this.style.borderColor='rgba(255,255,255,0.18)'"
          onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${barColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style="font-size:11.5px;font-weight:600;color:#cbd5e1">Профиль заполнен на ${pct}%</span>
            </div>
            <span style="font-size:10.5px;color:#475569">${filled} / ${total} полей · нажмите для заполнения</span>
          </div>
          <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .4s ease"></div>
          </div>
          ${missing.length ? `<div style="margin-top:7px;font-size:10.5px;color:#475569">Не заполнено: <span style="color:#94a3b8">${missingList}</span></div>` : ''}
        </div>`;
      }

      // Подсказка по сотрудникам без должности
      let empBanner = '';
      if (empNoPosition) {
        empBanner = `
        <div onclick="editEmployeePrompt(${empNoPosition.id})" style="
          display:flex;align-items:center;gap:10px;cursor:pointer;
          background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);
          border-radius:10px;padding:10px 16px;margin-bottom:14px;transition:all .2s"
          onmouseover="this.style.borderColor='rgba(251,191,36,0.4)'"
          onmouseout="this.style.borderColor='rgba(251,191,36,0.2)'">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="font-size:12px;color:#e2e8f0">У сотрудника <strong>${empNoPosition.full_name}</strong> не указана должность — нажмите, чтобы заполнить</span>
        </div>`;
      }

      return profileBanner + empBanner;
    })()}

    <!-- ЦЕНТР ГОТОВНОСТИ — кнопка-баннер -->
    <div onclick="openReadinessCenter(${id})" style="
      display:flex;align-items:center;gap:16px;
      background:linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12));
      border:1px solid rgba(96,165,250,0.25);
      border-radius:16px;padding:18px 22px;margin-bottom:14px;
      cursor:pointer;transition:all .2s;position:relative;overflow:hidden
    " onmouseover="this.style.borderColor='rgba(96,165,250,0.5)';this.style.transform='translateY(-1px)'"
       onmouseout="this.style.borderColor='rgba(96,165,250,0.25)';this.style.transform='translateY(0)'">
      <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#a78bfa);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(96,165,250,0.4)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:4px">Центр готовности</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);border-radius:6px;color:#f87171">ГИТ</span>
          ${(c.modules||'').includes('PD') ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.25);border-radius:6px;color:#60a5fa">РКН</span>` : ''}
          ${(c.modules||'').includes('VU') ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);border-radius:6px;color:#a78bfa">Военкомат</span>` : ''}
          <span style="font-size:11px;color:#475569">· Индекс риска · Машина времени · Паспорт безопасности</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:800;color:${scoreColor};line-height:1">${realScore}%</div>
          <div style="font-size:10px;color:#475569">готовность</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:0;margin-bottom:2px">
      <div class="tabs" style="flex:1;margin-bottom:0;border-bottom:none">
        <div class="tab active" onclick="switchTab('overview')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> Обзор</span></div>
        ${mods.includes('OT')?`<div class="tab" onclick="switchTab('ot')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Охрана труда</span></div>`:''}
        ${mods.includes('PD')?`<div class="tab" onclick="switchTab('pd')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ПДн</span></div>`:''}
        ${mods.includes('VU')?`<div class="tab" onclick="switchTab('vu');renderClientVu(${id})"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Воинский учёт</span></div>`:''}
        ${mods.includes('OT')?`<div class="tab" onclick="switchTab('sout');renderSout()"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><circle cx="12" cy="12" r="10"/></svg> СОУТ</span></div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:2px;padding:0 4px;border-bottom:2px solid rgba(255,255,255,0.06)">
        <button onclick="switchTab('staff')" id="tool-btn-staff" title="Сотрудники" style="display:flex;align-items:center;gap:5px;padding:6px 10px;background:none;border:1px solid transparent;border-radius:8px;color:#475569;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s" onmouseover="this.style.color='#94a3b8';this.style.borderColor='rgba(255,255,255,0.1)'" onmouseout="if(!this.classList.contains('tool-active')){this.style.color='#475569';this.style.borderColor='transparent'}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Сотрудники</span>${emps.length ? `<span style="background:rgba(96,165,250,0.15);color:#60a5fa;border-radius:8px;padding:1px 5px;font-size:10px">${emps.length}</span>` : ''}
        </button>
        <button onclick="switchTab('reporting');renderClientReporting(${id})" id="tool-btn-reporting" title="Отчётность" style="display:flex;align-items:center;gap:5px;padding:6px 10px;background:none;border:1px solid transparent;border-radius:8px;color:#475569;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s" onmouseover="this.style.color='#94a3b8';this.style.borderColor='rgba(255,255,255,0.1)'" onmouseout="if(!this.classList.contains('tool-active')){this.style.color='#475569';this.style.borderColor='transparent'}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Отчётность</span>
        </button>
      </div>
    </div>

    <div class="tab-panel active" id="tab-overview">
      <div class="grid2">
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span><div class="panel-title">Ближайшие события</div></div>
          <div>${events.length ? events.slice(0,6).map(e=>renderEventRow(e)).join('') : `
            <div class="empty-state" style="cursor:pointer" onclick="openEditModal(${id})">
              <div class="empty-icon">${ic('calendar',32)}</div>
              <div class="empty-title">Событий нет</div>
              <div class="empty-sub">Укажите даты обхода/проверки в карточке клиента — здесь появится отсчёт</div>
            </div>
          `}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span><div class="panel-title">Задачи</div><div class="panel-action" onclick="addTaskForClient(${id})">+ Добавить</div></div>
          <div>${clientTasks.length ? clientTasks.map(t=>renderTaskRow(t, {inClientCard:true})).join('') : `
            <div class="empty-state" style="cursor:pointer" onclick="addTaskForClient(${id})">
              <div class="empty-icon">${ic('check-circle',32)}</div>
              <div class="empty-title">Задач нет</div>
              <div class="empty-sub">Нажмите, чтобы добавить первую</div>
            </div>
          `}</div>
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-ot">
      <div class="panel">
        <div class="panel-head">
          ${ic("hard-hat", 18)}
          <div class="panel-title">Документы — Охрана труда</div>
          <div class="panel-count">${otDocs.length} шт.</div>
          <div style="margin-left:auto;display:flex;gap:8px">
            ${clientDocDir ? `<button class="btn" style="padding:6px 12px;font-size:11px;background:var(--s3);color:var(--text)" onclick="openClientFolder()">${ic("folder",14)} Открыть папку</button>` : ''}
            <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="generateDocs(${id},'OT')">${ic("zap",14)} Сформировать пакет</button>
          </div>
        </div>
        <div>${otDocs.length ? renderDocsBySection(otDocs, 'OT') : renderEmptyDocs('OT', id)}</div>
      </div>

      <!-- ПРОТОКОЛ ПРОВЕРКИ ЗНАНИЙ -->
      <div class="panel">
        <div class="panel-head">
          ${ic("clipboard-list", 18)}
          <div class="panel-title">Протокол проверки знаний</div>
          <div style="margin-left:auto">
            <button class="btn btn-primary" style="padding:6px 14px;font-size:11px" onclick="openProtocolModal(${id})">
              ${ic("clipboard-list",14)} Сформировать протокол
            </button>
          </div>
        </div>
        <div style="padding:14px 4px;font-size:12.5px;color:var(--muted);line-height:1.6">
          Протокол заседания комиссии по проверке знаний требований охраны труда.
          Формируется по результатам обучения выбранных сотрудников — с составом комиссии,
          программой и итогами. Готовый документ можно скачать в PDF.
        </div>
      <!-- ЦЕНТР ОБУЧЕНИЯ — два режима: внешний центр и самообучение (аддон TRAINING) -->
      <div class="panel" id="training-center-panel">
        <div class="panel-head" style="margin-bottom:10px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          <div class="panel-title">Центр обучения</div>
        </div>
        <!-- Переключатель режимов -->
        <div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:4px">
          <button id="tc-tab-external-${id}" onclick="switchTrainingTab('external',${id})"
            style="flex:1;padding:7px 10px;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;background:rgba(96,165,250,0.15);color:#60a5fa">
            Внешний центр
          </button>
          <button id="tc-tab-self-${id}" onclick="switchTrainingTab('self',${id})"
            style="flex:1;padding:7px 10px;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:#475569">
            Самообучение
          </button>
        </div>
        <!-- Режим: Внешний центр -->
        <div id="tc-external-${id}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div id="certs-count-${id}" style="font-size:12px;color:var(--muted2)"></div>
            <button class="btn btn-primary" style="padding:6px 14px;font-size:11px" onclick="openCertModal(${id})">
              + Добавить запись
            </button>
          </div>
          <div id="certs-list-${id}">
            <div style="display:flex;align-items:center;justify-content:center;padding:28px;color:var(--muted2);font-size:13px">Загрузка...</div>
          </div>
        </div>
        <!-- Режим: Самообучение (аддон TRAINING) -->
        <div id="tc-self-${id}" style="display:none"></div>
      </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-pd">

      <!-- SCORE ПДн -->
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">
          ${ic("lock", 18)}
          <div class="panel-title">Готовность к 152-ФЗ</div>
          <div style="margin-left:auto;font-size:22px;font-weight:700;color:${
            (() => {
              let s = 0;
              if (c.pd_responsible_name) s += 25;
              if (c.pd_notified_rkn) s += 25;
              if (pdDocs.length > 0) s += 35;
              if ((c.pd_ispdn_list||[]).length > 0) s += 15;
              return s >= 80 ? 'var(--green)' : s >= 40 ? 'var(--amber)' : 'var(--red)';
            })()
          }">${
            (() => {
              let s = 0;
              if (c.pd_responsible_name) s += 25;
              if (c.pd_notified_rkn) s += 25;
              if (pdDocs.length > 0) s += 35;
              if ((c.pd_ispdn_list||[]).length > 0) s += 15;
              return s;
            })()
          }%</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px">
          ${[
            { label: 'Документы', val: pdDocs.length > 0, pts: 35 },
            { label: 'Уведомление РКН', val: !!c.pd_notified_rkn, pts: 25 },
            { label: 'Ответственный', val: !!c.pd_responsible_name, pts: 25 },
            { label: 'ИСПДн', val: (c.pd_ispdn_list||[]).length > 0, pts: 15 },
          ].map(b => `
            <div style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid ${b.val ? 'rgba(52,211,153,0.3)' : 'var(--border)'};border-radius:10px;text-align:center">
              <div style="margin-bottom:4px">${b.val ? ic("check-circle",18,"color:var(--green)") : ic("x-circle",18,"color:var(--muted)")}</div>
              <div style="font-size:11px;font-weight:600;color:${b.val ? 'var(--green)' : 'var(--muted)'}">${b.label}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${b.pts} балл.</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ОТВЕТСТВЕННЫЙ ЗА ПД -->
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">${ic("user", 18)}<div class="panel-title">Ответственный за обработку ПДн</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div>
            <div class="form-label">ФИО ответственного</div>
            <input class="form-input" id="pd-resp-name-${id}" value="${c.pd_responsible_name||''}" placeholder="Иванова Мария Ивановна">
          </div>
          <div>
            <div class="form-label">Должность</div>
            <input class="form-input" id="pd-resp-pos-${id}" value="${c.pd_responsible_position||''}" placeholder="Юрист / Специалист по комплаенсу">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;margin-top:12px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap">
            <input type="checkbox" id="pd-rkn-${id}" ${c.pd_notified_rkn ? 'checked' : ''} style="width:15px;height:15px;cursor:pointer">
            <span style="font-size:13px;color:var(--text);font-weight:500">РКН уведомлена</span>
          </label>
          <div>
            <div class="form-label" style="margin-bottom:4px">Дата уведомления</div>
            <input type="date" class="form-input" id="pd-rkn-date-${id}" value="${c.pd_notification_date||''}" style="max-width:180px">
          </div>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end">
          <button class="btn btn-primary" onclick="savePdData(${id})">${ic("save",14)} Сохранить</button>
        </div>
      </div>

      <!-- ИСПДн -->
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">
          ${ic("monitor", 18)}
          <div class="panel-title">Информационные системы ПД (ИСПДн)</div>
          <div class="panel-action" onclick="addIspdnItem(${id})">+ Добавить</div>
        </div>
        <div id="ispdn-list-${id}" style="margin-top:8px">
          ${(c.pd_ispdn_list||[]).length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Ещё нет ни одной ИСПДн.<br><span style="font-size:11px">Пример: 1С:Бухгалтерия, Кадровая система, CRM</span></div>`
            : (c.pd_ispdn_list||[]).map((item,idx) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.02);border-left:3px solid var(--blue);border-radius:6px;margin-bottom:6px">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text)">${item.name}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px">Добавлена: ${item.added||'—'}</div>
                </div>
                <button class="btn btn-ghost" style="padding:4px 8px;font-size:11px" onclick="removeIspdnItem(${id},${idx})">✕</button>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- ДОКУМЕНТЫ ПДн + КНОПКИ ГЕНЕРАЦИИ -->
      <div class="panel">
        <div class="panel-head">
          ${ic("file-text", 18)}
          <div class="panel-title">Документы — ПДн</div>
          <div class="panel-count">${pdDocs.length} шт.</div>
          <button class="btn btn-primary" style="margin-left:auto;font-size:12px" onclick="generateDocs(${id},'PD')">${ic("zap",14)} Сформировать пакет</button>
        </div>
        <div style="margin-top:8px">
          ${pdDocs.length
            ? renderDocsBySection(pdDocs, 'PD')
            : `<div style="padding:20px;text-align:center">
                <div style="margin-bottom:8px">${ic("clipboard-list",40)}</div>
                <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">Документы ещё не сформированы</div>
                <div style="font-size:12px;color:var(--muted)">Политика ПД, согласия сотрудников, приказ об ответственном</div>
                <div style="font-size:11px;color:var(--muted);margin-top:8px;padding:8px;background:rgba(248,113,113,0.08);border-radius:6px;border-left:3px solid var(--red)">
                  ${ic("alert-triangle",13)} Штрафы по ст.13.11 КоАП — до <strong style="color:#f87171">18 млн ₽</strong> оборотных за нарушение 152-ФЗ
                </div>
              </div>`
          }
        </div>
      </div>

    </div>

    <div class="tab-panel" id="tab-vu">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted2);font-size:13px">Загрузка...</div>
    </div>

    <div class="tab-panel" id="tab-sout">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted2);font-size:13px">Загрузка...</div>
    </div>

    <div class="tab-panel" id="tab-staff">
      <!-- Подразделения переехали внутрь вкладки «Сотрудники» — они группировка
           сотрудников, а не отдельный модуль. Блок сворачиваемый: открыт по
           умолчанию если подразделения есть, закрыт если нет. -->
      <div class="panel" style="margin-bottom:12px">
        <div onclick="toggleDivisionsBlock()" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:2px 0;user-select:none">
          <div class="panel-head" style="margin-bottom:0;flex:1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
            <div class="panel-title">Подразделения</div>
            <div class="panel-count">${divisions.length ? divisions.length + ' подр.' : 'не заданы'}</div>
            <div class="panel-action" onclick="event.stopPropagation();openDivisionModal(${id})">+ Добавить</div>
          </div>
          <svg id="divisions-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .2s;margin-left:8px;${divisions.length ? 'transform:rotate(180deg)' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div id="divisions-body" style="display:${divisions.length ? 'block' : 'none'};margin-top:10px">
          ${divisions.length ? `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${divisions.map(div => {
              const wt = DIVISION_WORK_TYPES[div.work_type] || DIVISION_WORK_TYPES.standard;
              const divEmps = emps.filter(e => e.division_id === div.id);
              const empCount = divEmps.length;
              const tags = [];
              if (wt.medcheck) tags.push(`<span style="font-size:10px;background:rgba(248,113,113,0.12);color:#f87171;padding:2px 7px;border-radius:10px">29н</span>`);
              if (wt.medcheck_714) tags.push(`<span style="font-size:10px;background:rgba(251,191,36,0.12);color:#fbbf24;padding:2px 7px;border-radius:10px">714н</span>`);
              if (wt.psycho) tags.push(`<span style="font-size:10px;background:rgba(167,139,250,0.12);color:#a78bfa;padding:2px 7px;border-radius:10px">психо</span>`);
              if (wt.siz) tags.push(`<span style="font-size:10px;background:rgba(96,165,250,0.12);color:#60a5fa;padding:2px 7px;border-radius:10px">СИЗ</span>`);
              return `<div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;overflow:hidden">
                <div onclick="${empCount ? `toggleDivisionExpand(${div.id})` : ''}" style="display:flex;align-items:center;gap:12px;padding:10px 12px;cursor:${empCount ? 'pointer' : 'default'};user-select:none">
                  <div style="font-size:18px;flex-shrink:0">${ic(wt.icon,18)}</div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;color:var(--text)">${div.name}</div>
                    <div style="font-size:11px;color:var(--muted2);margin-top:2px">${wt.label} · СОУТ класс ${div.soat_class || wt.soatDefault} · ${empCount} сотр.</div>
                    ${tags.length ? `<div style="display:flex;gap:4px;margin-top:4px">${tags.join('')}</div>` : ''}
                  </div>
                  <div style="display:flex;gap:4px;flex-shrink:0;align-items:center">
                    ${empCount ? `<svg id="div-chevron-${div.id}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .2s;margin-right:4px"><polyline points="6 9 12 15 18 9"/></svg>` : ''}
                    <button onclick="event.stopPropagation();openDivisionModal(${id}, ${div.id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px" onmouseover="this.style.color='var(--blue2)'" onmouseout="this.style.color='var(--muted2)'">${ic("edit",13)}</button>
                    <button onclick="event.stopPropagation();deleteDivision(${div.id}, ${id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted2)'">${ic("trash",13)}</button>
                  </div>
                </div>
                ${empCount ? `
                <div id="div-employees-${div.id}" style="display:none;border-top:1px solid var(--border);padding:6px 12px 10px">
                  ${divEmps.map(e => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,0.03)">
                      <div style="min-width:0">
                        <div style="font-size:12px;color:var(--text)">${e.full_name}</div>
                        <div style="font-size:10.5px;color:var(--muted2)">${e.position || '—'}${e.birth_date ? ' · ' + new Date(e.birth_date).getFullYear() + ' г.р.' : ''}</div>
                      </div>
                      <button onclick="event.stopPropagation();editEmployeePrompt(${e.id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px;flex-shrink:0" onmouseover="this.style.color='var(--blue2)'" onmouseout="this.style.color='var(--muted2)'">${ic("edit",12)}</button>
                    </div>`).join('')}
                </div>` : ''}
              </div>`;
            }).join('')}
          </div>` : `
          <div style="padding:12px 0 4px;text-align:center;color:var(--muted2)">
            <div style="font-size:13px;margin-bottom:8px">Подразделений нет</div>
            <button class="btn btn-ghost" style="font-size:12px" onclick="openDivisionModal(${id})">+ Добавить подразделение</button>
          </div>`}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <div class="panel-title">${divisions.length ? 'Без подразделения' : 'Сотрудники'}</div>
          <div class="panel-count">${(divisions.length ? emps.filter(e => !e.division_id) : emps).length} чел.</div>
          <button onclick="showImportHelpModal()" title="Как это работает" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:2px 4px;margin-right:6px;display:inline-flex;align-items:center" onmouseover="this.style.color='var(--blue2)'" onmouseout="this.style.color='var(--muted2)'"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></button>
          <div class="panel-action" onclick="downloadEmployeeTemplate()" style="margin-right:14px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:3px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Шаблон</div>
          <div class="panel-action" onclick="importEmployeesPrompt(${id})" style="margin-right:14px">${ic('upload',12)} Импорт из файла</div>
          <div class="panel-action" onclick="addEmployeePrompt(${id})">+ Добавить</div>
        </div>
        ${(() => {
          // Если у клиента есть подразделения — общий список схлопывается до
          // сотрудников без подразделения (дубли с аккордеоном выше не нужны).
          // Если подразделений нет вообще — список работает как раньше, без
          // изменений, чтобы не усложнять простых клиентов.
          const listEmps = divisions.length ? emps.filter(e => !e.division_id) : emps;
          if (!emps.length) {
            return `<div class="empty-state"><div class="empty-icon">${ic("users",32)}</div><div class="empty-title">Сотрудников нет</div><div class="empty-sub">Добавьте сотрудников для учёта обучений</div></div>`;
          }
          if (!listEmps.length) {
            // Все сотрудники уже разложены по подразделениям — нечего показывать,
            // но заголовок с кнопками добавления/импорта остаётся видимым.
            return `<div style="padding:14px 0 4px;text-align:center;color:var(--muted2);font-size:12px">Все сотрудники распределены по подразделениям выше</div>`;
          }
          return `<div>${listEmps.map(e => renderEmpRow(e, divisions)).join('')}</div>`;
        })()}
      </div>
    </div>


    <div class="tab-panel" id="tab-reporting">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted2);font-size:13px">Загрузка...</div>
    </div>
  `;
  // Загружаем реестр удостоверений Центра обучения (живые данные, не шаблон)
  await loadCerts(id);
}


function switchTab(name) {
  // Сбрасываем активное состояние у модульных вкладок (верхний ряд)
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  // Активируем нужную модульную вкладку
  document.querySelectorAll('.tab').forEach(t => {
    if (t.getAttribute('onclick') && t.getAttribute('onclick').includes(name)) t.classList.add('active');
  });
  // Сбрасываем и обновляем состояние инструментальных кнопок (нижний ряд)
  ['staff','reporting'].forEach(tool => {
    const btn = document.getElementById('tool-btn-' + tool);
    if (btn) {
      btn.classList.remove('tool-active');
      btn.style.color = '#475569';
      btn.style.borderColor = 'transparent';
      btn.style.background = 'none';
    }
  });
  if (name === 'staff' || name === 'reporting') {
    const activeBtn = document.getElementById('tool-btn-' + name);
    if (activeBtn) {
      activeBtn.classList.add('tool-active');
      activeBtn.style.color = '#60a5fa';
      activeBtn.style.borderColor = 'rgba(96,165,250,0.3)';
      activeBtn.style.background = 'rgba(96,165,250,0.08)';
    }
  }
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
}
// ── ЦЕНТР ОБУЧЕНИЯ ─────────────────────────────────────────────────
// Цветовые статусы удостоверений по дням до истечения срока

// ── ЦЕНТР ОБУЧЕНИЯ — переключатель режимов ──────────────────────────────────
function switchTrainingTab(tab, clientId) {
  const extBtn  = document.getElementById('tc-tab-external-' + clientId);
  const selfBtn = document.getElementById('tc-tab-self-' + clientId);
  const extPane = document.getElementById('tc-external-' + clientId);
  const selfPane= document.getElementById('tc-self-' + clientId);
  if (!extPane || !selfPane) return;

  if (tab === 'external') {
    extPane.style.display  = 'block';
    selfPane.style.display = 'none';
    if (extBtn)  { extBtn.style.background  = 'rgba(96,165,250,0.15)'; extBtn.style.color  = '#60a5fa'; }
    if (selfBtn) { selfBtn.style.background = 'transparent';           selfBtn.style.color = '#475569'; }
  } else {
    extPane.style.display  = 'none';
    selfPane.style.display = 'block';
    if (extBtn)  { extBtn.style.background  = 'transparent';            extBtn.style.color  = '#475569'; }
    if (selfBtn) { selfBtn.style.background = 'rgba(167,139,250,0.15)'; selfBtn.style.color = '#a78bfa'; }
    loadSelfTraining(clientId);
  }
}

// Чек-лист процесса самообучения по ПП РФ № 2464
// 5 обязательных шагов для организаций, обучающих сотрудников внутри:
//   1. ЛНА — локальные нормативные акты (программы обучения, положение)
//   2. Уведомление в ЛКОТ — подача сведений в личный кабинет Минтруда
//   3. Комиссия — назначение и обучение комиссии (3 чел., все должны быть обучены)
//   4. Протокол — оформление результатов проверки знаний
//   5. Реестр — передача сведений в реестр обученных лиц Минтруда
// Типы обучения с периодичностью и маппингом на поля training сотрудника
const TRAINING_TYPES_SELF = [
  { key: 'prog_a',    label: 'Программа А (ОТ)',     years: 3, icon: 'shield' },
  { key: 'first_aid', label: 'Первая помощь',         years: 3, icon: 'heart' },
  { key: 'fire',      label: 'Пожарный минимум',      years: 3, icon: 'zap' },
  { key: 'siz',       label: 'Применение СИЗ',        years: 3, icon: 'shield' },
  { key: 'repeat',    label: 'Повторный инструктаж',  months: 6, icon: 'refresh' },
];

// Вычисляем дней до следующего обучения по дате последнего
function daysUntilNext(dateStr, years, months) {
  if (!dateStr) return null;
  const last = new Date(dateStr);
  const next = new Date(last);
  if (years)  next.setFullYear(next.getFullYear() + years);
  if (months) next.setMonth(next.getMonth() + months);
  return Math.ceil((next - new Date()) / 86400000);
}

// Статус одной записи обучения
function trainingRowStatus(days) {
  if (days === null) return { color: '#475569', label: 'Нет данных',       bg: 'rgba(71,85,105,0.1)',    priority: 3 };
  if (days < 0)      return { color: '#f87171', label: 'Просрочено',        bg: 'rgba(248,113,113,0.12)', priority: 0 };
  if (days <= 30)    return { color: '#f87171', label: `Через ${days} д.`,  bg: 'rgba(248,113,113,0.12)', priority: 1 };
  if (days <= 90)    return { color: '#fbbf24', label: `Через ${days} д.`,  bg: 'rgba(251,191,36,0.12)',  priority: 2 };
  return               { color: '#34d399', label: 'Актуально',          bg: 'rgba(52,211,153,0.08)',  priority: 4 };
}

async function loadSelfTraining(clientId) {
  const pane = document.getElementById('tc-self-' + clientId);
  if (!pane) return;

  // Проверяем аддон
  let addonActive = false;
  try {
    const addons = await window.api.addonStatus();
    addonActive = addons.find(a => a.type === 'TRAINING')?.active || false;
  } catch(e) {}

  if (!addonActive) {
    pane.innerHTML = `
      <div style="text-align:center;padding:28px 20px">
        <div style="margin-bottom:12px">${ic("graduation-cap",32)}</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">Трекер обучения сотрудников</div>
        <div style="font-size:12.5px;color:var(--muted2);line-height:1.6;margin-bottom:16px">
          Контроль сроков переобучения, состав комиссии, статус по каждому типу программы.<br>
          Работает с организациями от 16 сотрудников.
        </div>
        <div style="display:inline-block;padding:8px 20px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:10px;font-size:12px;color:#fbbf24;font-weight:600">
          Доступно как аддон — обратитесь к вашему специалисту
        </div>
      </div>`;
    return;
  }

  // Загружаем сотрудников
  const emps = await window.api.employeesList(clientId);
  if (!emps.length) {
    pane.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted2);font-size:13px">
      Сотрудников нет — добавьте их во вкладке «Сотрудники»</div>`;
    return;
  }

  // Считаем сводку по каждому типу обучения
  const groupData = TRAINING_TYPES_SELF.map(tt => {
    const rows = emps
      .map(e => {
        const t = e.training?.[tt.key];
        if (!t?.required) return null; // не требуется для этого сотрудника
        const days = daysUntilNext(t.date, tt.years, tt.months);
        const st   = trainingRowStatus(days);
        return { emp: e, days, st, date: t.date };
      })
      .filter(Boolean)
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));

    const overdue  = rows.filter(r => r.days !== null && r.days < 0).length;
    const soon     = rows.filter(r => r.days !== null && r.days >= 0 && r.days <= 30).length;
    const warning  = rows.filter(r => r.days !== null && r.days > 30 && r.days <= 90).length;
    const ok       = rows.filter(r => r.days !== null && r.days > 90).length;
    const noData   = rows.filter(r => r.days === null).length;
    const total    = rows.length;

    return { tt, rows, overdue, soon, warning, ok, noData, total };
  }).filter(g => g.total > 0); // скрываем типы, не требуемые ни одному сотруднику

  // Итоговая сводка по всем типам
  const totalOverdue = groupData.reduce((s, g) => s + g.overdue, 0);
  const totalSoon    = groupData.reduce((s, g) => s + g.soon, 0);
  const totalOk      = groupData.reduce((s, g) => s + g.ok + g.warning, 0);

  pane.innerHTML = `
    <!-- Три карточки-статуса сверху -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="padding:10px 12px;border-radius:10px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.2);text-align:center">
        <div style="font-size:22px;font-weight:800;color:#f87171">${totalOverdue + totalSoon}</div>
        <div style="font-size:10.5px;color:#f87171;margin-top:2px">Требуют внимания</div>
      </div>
      <div style="padding:10px 12px;border-radius:10px;background:rgba(52,211,153,0.07);border:1px solid rgba(52,211,153,0.2);text-align:center">
        <div style="font-size:22px;font-weight:800;color:#34d399">${totalOk}</div>
        <div style="font-size:10.5px;color:#34d399;margin-top:2px">Актуально</div>
      </div>
      <div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--text)">${emps.length}</div>
        <div style="font-size:10.5px;color:var(--muted2);margin-top:2px">Сотрудников</div>
      </div>
    </div>

    <!-- Группы по типу обучения -->
    <div style="display:flex;flex-direction:column;gap:6px" id="training-groups-${clientId}">
      ${groupData.map(g => {
        const urgentCount = g.overdue + g.soon;
        const groupColor  = urgentCount > 0 ? '#f87171' : g.warning > 0 ? '#fbbf24' : '#34d399';
        const pctOk = g.total > 0 ? Math.round((g.ok / g.total) * 100) : 0;
        return `<div style="border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden">
          <!-- Заголовок группы — всегда виден -->
          <div onclick="toggleTrainingGroup('${clientId}','${g.tt.key}')"
            style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;background:rgba(255,255,255,0.01)">
            <span style="font-size:16px;flex-shrink:0">${ic(g.tt.icon,16)}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text)">${g.tt.label}</div>
              <!-- Прогресс-бар -->
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                <div style="flex:1;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden">
                  <div style="width:${pctOk}%;height:100%;background:#34d399;border-radius:2px;transition:width .5s"></div>
                </div>
                <div style="font-size:10.5px;color:var(--muted2);flex-shrink:0">${g.ok}/${g.total}</div>
              </div>
            </div>
            <!-- Бейджи -->
            <div style="display:flex;gap:4px;flex-shrink:0">
              ${urgentCount > 0 ? `<span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(248,113,113,0.12);color:#f87171">${urgentCount} !</span>` : ''}
              ${g.warning > 0 ? `<span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(251,191,36,0.1);color:#fbbf24">${g.warning} ~</span>` : ''}
            </div>
            <svg id="tg-chevron-${clientId}-${g.tt.key}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <!-- Список сотрудников — скрыт по умолчанию -->
          <div id="tg-body-${clientId}-${g.tt.key}" style="display:none">
            <div style="border-top:1px solid rgba(255,255,255,0.05)">
              ${g.rows.map(r => `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 14px 8px 44px;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;transition:background .15s"
                  onclick="editTrainingDate(${clientId}, ${r.emp.id}, '${g.tt.key}', '${g.tt.label}', '${r.date||''}')"
                  onmouseover="this.style.background='rgba(255,255,255,0.02)'"
                  onmouseout="this.style.background='transparent'">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.emp.full_name}</div>
                    <div style="font-size:11px;color:var(--muted2)">${r.emp.position || '—'}${r.date ? ' · ' + formatDate(r.date) : ''}</div>
                  </div>
                  <span style="font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;flex-shrink:0;background:${r.st.bg};color:${r.st.color}">${r.st.label}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- БЛОК КОМИССИИ -->
    <div id="commission-block-${clientId}" style="margin-top:14px"></div>`;

  // Загружаем состав комиссии асинхронно
  try {
    const commission = await window.api.commissionGet(clientId);
    const commBlock = document.getElementById('commission-block-' + clientId);
    if (!commBlock) return;

    const roleLabel = r => r.commission_role === 'chairman' ? 'Председатель' : 'Член комиссии';
    const roleColor = r => r.commission_role === 'chairman' ? '#a78bfa' : '#60a5fa';
    const roleBg    = r => r.commission_role === 'chairman' ? 'rgba(167,139,250,0.1)' : 'rgba(96,165,250,0.1)';

    commBlock.innerHTML = `
      <div style="border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.01)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:15px">${ic("users",15)}</span>
            <span style="font-size:13px;font-weight:600;color:var(--text)">Комиссия по проверке знаний</span>
            ${commission.length >= 3
              ? '<span style="font-size:10.5px;background:rgba(52,211,153,0.1);color:#34d399;padding:2px 8px;border-radius:6px;font-weight:600">Укомплектована</span>'
              : '<span style="font-size:10.5px;background:rgba(248,113,113,0.1);color:#f87171;padding:2px 8px;border-radius:6px;font-weight:600">Нужно ' + (3 - commission.length) + ' чел.</span>'}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:11px;color:var(--muted2)">${commission.length} / мин. 3</span>
            <button onclick="openCommissionOrderModal(${clientId})"
              style="padding:4px 12px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:7px;color:#a5b4fc;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap"
              title="Сформировать приказ о создании комиссии">${ic("file-text",14)} Приказ</button>
          </div>
        </div>
        ${commission.length ? `
        <div style="border-top:1px solid rgba(255,255,255,0.05)">
          ${commission.map(m => {
            const certOk    = m.cert && !m.cert_expired;
            const certColor = !m.cert ? '#f87171' : m.cert_expired ? '#f87171' : m.cert_days_left <= 90 ? '#fbbf24' : '#34d399';
            const certLabel = !m.cert ? 'Нет удостоверения' : m.cert_expired ? 'Просрочено' : 'до ' + formatDate(m.cert.date_to || '');
            return '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.03)">'
              + '<div style="flex:1;min-width:0">'
              + '<div style="font-size:12.5px;font-weight:600;color:var(--text)">' + m.full_name + '</div>'
              + '<div style="font-size:11px;color:var(--muted2)">' + (m.position || '—') + '</div>'
              + '</div>'
              + '<span style="font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;background:' + roleBg(m) + ';color:' + roleColor(m) + ';flex-shrink:0">' + roleLabel(m) + '</span>'
              + '<span style="font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;background:rgba(' + (certOk ? '52,211,153' : '248,113,113') + ',0.1);color:' + certColor + ';flex-shrink:0">' + certLabel + '</span>'
              + '</div>';
          }).join('')}
        </div>` : '<div style="padding:16px;text-align:center;color:var(--muted2);font-size:12.5px;border-top:1px solid rgba(255,255,255,0.05)">Назначьте членов комиссии через «Редактировать сотрудника»</div>'}
      </div>`;
  } catch(e) {}
}

// Модалка «Сформировать приказ о создании комиссии»
async function openCommissionOrderModal(clientId) {
  const existing = document.getElementById('modal-commission-order');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-commission-order';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.7);animation:ob-card-in .25s ease both">
      <div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:4px">${ic("file-text",14)} Приказ о создании комиссии</div>
      <div style="font-size:12px;color:#60a5fa;margin-bottom:20px">Укажите реквизиты приказа</div>

      <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">Номер приказа</label>
      <input id="co-num" type="text" placeholder="Например: 12-ОТ"
        style="width:100%;padding:10px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:14px">

      <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">Дата приказа</label>
      <input id="co-date" type="date" value="${new Date().toISOString().slice(0,10)}"
        style="width:100%;padding:10px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:20px;cursor:pointer">

      <div id="co-error" style="display:none;font-size:11.5px;color:#f87171;margin-bottom:12px;padding:8px 12px;background:rgba(248,113,113,0.08);border-radius:7px"></div>

      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('modal-commission-order').remove()"
          style="flex:1;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#94a3b8;font-size:13px;cursor:pointer">
          Отмена
        </button>
        <button id="co-btn-generate"
          onclick="submitCommissionOrder(${clientId})"
          style="flex:2;padding:10px;background:linear-gradient(135deg,#6366f1,#4f46e5);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
          Сформировать
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  setTimeout(() => document.getElementById('co-num')?.focus(), 50);
}

async function submitCommissionOrder(clientId) {
  const numEl  = document.getElementById('co-num');
  const dateEl = document.getElementById('co-date');
  const errEl  = document.getElementById('co-error');
  const btn    = document.getElementById('co-btn-generate');
  if (!numEl || !dateEl) return;

  const orderNum  = numEl.value.trim();
  const orderDate = dateEl.value;

  if (!orderNum) {
    errEl.textContent = 'Введите номер приказа';
    errEl.style.display = 'block';
    numEl.focus();
    return;
  }
  if (!orderDate) {
    errEl.textContent = 'Укажите дату приказа';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  // Форматируем дату для документа: ДД.ММ.ГГГГ
  const [y, m, d] = orderDate.split('-');
  const formattedDate = d + '.' + m + '.' + y;

  btn.disabled = true;
  btn.textContent = 'Формируем...';

  try {
    const result = await window.api.generateCommissionOrder(clientId, orderNum, formattedDate);
    if (result?.ok) {
      document.getElementById('modal-commission-order')?.remove();
      // Открываем папку с файлом
      if (result.file) {
        window.api.docsOpenFile(result.file).catch(() => {});
      }
      showToast('Приказ сформирован');
    } else {
      errEl.textContent = result?.error || 'Ошибка формирования';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Сформировать';
    }
  } catch (err) {
    errEl.textContent = 'Ошибка: ' + (err.message || err);
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Сформировать';
  }
}

function toggleTrainingGroup(clientId, key) {
  const body    = document.getElementById('tg-body-'    + clientId + '-' + key);
  const chevron = document.getElementById('tg-chevron-' + clientId + '-' + key);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

// Мини-модалка редактирования даты обучения прямо из трекера
async function editTrainingDate(clientId, empId, trainingKey, trainingLabel, currentDate) {
  const existing = document.getElementById('modal-training-date');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-training-date';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;width:340px;box-shadow:0 20px 60px rgba(0,0,0,0.7);animation:ob-card-in .25s ease both">
      <div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:4px">${ic("calendar",14)} Дата обучения</div>
      <div style="font-size:12px;color:#60a5fa;margin-bottom:18px">${trainingLabel}</div>
      <label style="font-size:11px;color:#475569;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px">Дата последнего обучения</label>
      <input id="td-date" type="date" value="${currentDate}"
        style="width:100%;padding:10px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:14px;outline:none;box-sizing:border-box;cursor:pointer;margin-bottom:18px">
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('modal-training-date').remove()"
          style="flex:1;padding:9px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#64748b;font-size:13px;cursor:pointer">
          Отмена
        </button>
        <button onclick="saveTrainingDate(${clientId}, ${empId}, '${trainingKey}')"
          style="flex:2;padding:9px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">
          ✓ Сохранить
        </button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('td-date')?.focus(), 80);
}

async function saveTrainingDate(clientId, empId, trainingKey) {
  const date = document.getElementById('td-date')?.value;
  if (!date) { showToast('Укажите дату', 'var(--amber)'); return; }

  // Загружаем текущий training сотрудника, обновляем только нужный ключ
  const emps = await window.api.employeesList(clientId);
  const emp  = emps.find(e => e.id === empId);
  if (!emp) return;

  const training = JSON.parse(JSON.stringify(emp.training || {}));
  if (!training[trainingKey]) training[trainingKey] = {};
  training[trainingKey].date     = date;
  training[trainingKey].required = true; // раз указали дату — точно требуется

  await window.api.trainingUpdate(empId, training);
  document.getElementById('modal-training-date')?.remove();
  showToast('Дата сохранена');
  await loadSelfTraining(clientId); // обновляем трекер
}


function certStatus(dateTo) {
  if (!dateTo) return { color: '#475569', label: 'Бессрочно', badge: 'rgba(71,85,105,0.15)' };
  const days = Math.ceil((new Date(dateTo) - new Date()) / 86400000);
  if (days < 0)   return { color: '#f87171', label: 'Просрочено',            badge: 'rgba(248,113,113,0.12)', days };
  if (days <= 30) return { color: '#f87171', label: `Истекает через ${days} д.`, badge: 'rgba(248,113,113,0.12)', days };
  if (days <= 90) return { color: '#fbbf24', label: `Через ${days} д.`,        badge: 'rgba(251,191,36,0.12)',  days };
  return            { color: '#34d399', label: 'Действует',              badge: 'rgba(52,211,153,0.1)',   days };
}

async function loadCerts(clientId) {
  const listEl  = document.getElementById('certs-list-' + clientId);
  const countEl = document.getElementById('certs-count-' + clientId);
  if (!listEl) return;
  const certs = await window.api.certsList(clientId);
  if (countEl) countEl.textContent = certs.length + ' зап.';
  if (!certs.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:28px 16px;color:var(--muted2)">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 10px;display:block;opacity:.4"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
        <div style="font-size:13px;margin-bottom:4px">Записей обучения нет</div>
        <div style="font-size:11px">Добавьте данные об обучении сотрудников во внешних центрах</div>
      </div>`;
    return;
  }
  // Сортировка: сначала просроченные и скоро истекающие
  certs.sort((a, b) => {
    const da = a.date_to ? new Date(a.date_to) : new Date('2099-01-01');
    const db_ = b.date_to ? new Date(b.date_to) : new Date('2099-01-01');
    return da - db_;
  });
  listEl.innerHTML = certs.map(cert => {
    const st = certStatus(cert.date_to);
    const empName = cert.employee_name || '—';
    const certNumHtml = cert.cert_number
      ? `<div style="font-size:10.5px;color:#475569;flex-shrink:0;max-width:90px;overflow:hidden;text-overflow:ellipsis" title="Удостоверение: ${cert.cert_number}">#${cert.cert_number}</div>`
      : '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="width:34px;height:34px;border-radius:8px;background:rgba(96,165,250,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${empName}</div>
        <div style="font-size:11px;color:var(--muted2);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cert.program}${cert.center ? ' · ' + cert.center : ''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        ${cert.date_from ? `<div style="font-size:11px;color:var(--muted2)">${formatDate(cert.date_from)}${cert.date_to ? ' – ' + formatDate(cert.date_to) : ''}</div>` : ''}
        <div style="display:inline-block;margin-top:3px;font-size:10.5px;font-weight:600;color:${st.color};background:${st.badge};padding:2px 8px;border-radius:6px">${st.label}</div>
      </div>
      ${certNumHtml}
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button onclick="openCertModal(${clientId}, ${cert.id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 7px;border-radius:6px;transition:color .15s" onmouseover="this.style.color='var(--blue2)'" onmouseout="this.style.color='var(--muted2)'" title="Редактировать">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button onclick="deleteCert(${clientId}, ${cert.id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 7px;border-radius:6px;transition:color .15s" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted2)'" title="Удалить">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

async function openCertModal(clientId, certId = null) {
  const existing = document.getElementById('modal-cert');
  if (existing) existing.remove();

  let cert = null;
  if (certId) {
    const all = await window.api.certsList(clientId);
    cert = all.find(c => c.id === certId) || null;
  }
  const employees = (await window.api.employeesList(clientId)) || [];

  const PROGRAMS = [
    'Безопасность и охрана труда (Прогр. А, 16 ч.)',
    'Безопасность и охрана труда (Прогр. А, 40 ч.)',
    'Безопасность и охрана труда (Прогр. Б)',
    'Пожарно-технический минимум',
    'Оказание первой помощи',
    'Электробезопасность (группа I)',
    'Электробезопасность (группа III+)',
    'Работы на высоте',
    'Промышленная безопасность',
  ];

  const modal = document.createElement('div');
  modal.id = 'modal-cert';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  const isManualEmp = cert && cert.employee_id == null && cert.employee_name_manual;
  const isProgramCustom = cert && cert.program && !PROGRAMS.includes(cert.program);

  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.7);animation:ob-card-in .3s cubic-bezier(.22,.68,0,1.1) both">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:15px;font-weight:700;color:#f1f5f9;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          ${certId ? 'Редактировать запись' : 'Добавить запись об обучении'}
        </div>
        <button onclick="document.getElementById('modal-cert').remove()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:18px;padding:2px 6px;border-radius:6px" onmouseover="this.style.color='#f1f5f9'" onmouseout="this.style.color='#475569'">✕</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:7px">Сотрудник *</label>
          <select id="cert-employee" style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;cursor:pointer">
            <option value="">— Выберите сотрудника —</option>
            ${employees.map(e => `<option value="${e.id}" ${cert?.employee_id === e.id ? 'selected' : ''}>${e.full_name}${e.position ? ' · ' + e.position : ''}</option>`).join('')}
            <option value="manual" ${isManualEmp ? 'selected' : ''}>Ввести вручную...</option>
          </select>
          <input id="cert-employee-manual" placeholder="ФИО сотрудника"
            value="${cert?.employee_name_manual || ''}"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;margin-top:8px;display:${isManualEmp ? 'block' : 'none'}">
        </div>

        <div>
          <label style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:7px">Программа обучения *</label>
          <select id="cert-program-select" style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;cursor:pointer" onchange="document.getElementById('cert-program-manual').style.display=this.value==='other'?'block':'none'">
            ${PROGRAMS.map(p => `<option value="${p}" ${cert?.program === p ? 'selected' : ''}>${p}</option>`).join('')}
            <option value="other" ${isProgramCustom ? 'selected' : ''}>Другая...</option>
          </select>
          <input id="cert-program-manual" placeholder="Название программы"
            value="${isProgramCustom ? cert.program : ''}"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;margin-top:8px;display:${isProgramCustom ? 'block' : 'none'}">
        </div>

        <div>
          <label style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:7px">Обучающий центр</label>
          <input id="cert-center" placeholder="Например: НУЦ «Атлас», Новороссийск"
            value="${cert?.center || ''}"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>

        <div>
          <label style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:7px">Номер удостоверения</label>
          <input id="cert-number" placeholder="Например: 23-1234/2024-ОТ"
            value="${cert?.cert_number || ''}"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:7px">Дата обучения</label>
            <input id="cert-date-from" type="date" value="${cert?.date_from || ''}"
              style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;cursor:pointer">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:7px">Действует до</label>
            <input id="cert-date-to" type="date" value="${cert?.date_to || ''}"
              style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;cursor:pointer">
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:22px">
        <button onclick="document.getElementById('modal-cert').remove()"
          style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer"
          onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Отмена</button>
        <button onclick="submitCert(${clientId}, ${certId || 'null'})"
          style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(59,130,246,0.3)"
          onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">✓ Сохранить</button>
      </div>
    </div>`;

  modal.querySelector('#cert-employee').addEventListener('change', function() {
    modal.querySelector('#cert-employee-manual').style.display = this.value === 'manual' ? 'block' : 'none';
  });
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function submitCert(clientId, certId) {
  const empSelect = document.getElementById('cert-employee');
  const empManual = document.getElementById('cert-employee-manual')?.value?.trim();
  const progSelect = document.getElementById('cert-program-select')?.value;
  const progManual = document.getElementById('cert-program-manual')?.value?.trim();

  const employeeId = (empSelect?.value && empSelect.value !== 'manual') ? parseInt(empSelect.value) : null;
  const employeeNameManual = empSelect?.value === 'manual' ? empManual : null;
  const program = progSelect === 'other' ? progManual : progSelect;

  if (!employeeId && !employeeNameManual) {
    if (empSelect) { empSelect.style.borderColor='#f87171'; setTimeout(()=>empSelect.style.borderColor='rgba(255,255,255,0.1)',2000); }
    return;
  }
  if (!program) { showToast('Укажите программу', 'var(--red)'); return; }

  const data = {
    client_id:             clientId,
    employee_id:           employeeId,
    employee_name_manual:  employeeNameManual || null,
    program,
    center:      document.getElementById('cert-center')?.value?.trim() || '',
    cert_number: document.getElementById('cert-number')?.value?.trim() || '',
    date_from:   document.getElementById('cert-date-from')?.value || null,
    date_to:     document.getElementById('cert-date-to')?.value || null,
  };

  if (certId) {
    await window.api.certsUpdate(certId, data);
    showToast('Запись обновлена');
  } else {
    await window.api.certsAdd(data);
    showToast('Запись добавлена');
  }
  document.getElementById('modal-cert')?.remove();
  await loadCerts(clientId);
}

async function deleteCert(clientId, certId) {
  if (!confirm('Удалить запись об обучении?')) return;
  await window.api.certsDelete(certId);
  showToast('Удалено');
  await loadCerts(clientId);
}

function toggleDivisionsBlock() {
  const body = document.getElementById('divisions-body');
  const chevron = document.getElementById('divisions-chevron');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
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

function renderEmptyDocs(scope, clientId) {
  const names = { OT:'Охрана труда', PD:'Персональные данные', VU:'Воинский учёт' };
  const name = names[scope] || scope;
  return `<div class="empty-state">
    <div class="empty-icon">${ic("file-text",40)}</div>
    <div class="empty-title">Документов нет</div>
    <div class="empty-sub">Документы по модулю «${name}» появятся здесь после генерации</div>
    <button class="btn btn-primary" style="margin-top:8px" onclick="generateDocs(${clientId},'${scope}')">${ic("zap",14)} Сформировать пакет</button>
  </div>`;
}

// ─── Группировка документов по разделам ───────────────────────
// Иконки и цвета разделов для аккордеона (по ключу icon из sections.js).
const SECTION_ICONS = {
  clipboard: { color:'#60a5fa', svg:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>` },
  book:      { color:'#a78bfa', svg:`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>` },
  zap:       { color:'#fbbf24', svg:`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>` },
  list:      { color:'#f87171', svg:`<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>` },
  notebook:  { color:'#fb923c', svg:`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/>` },
  cap:       { color:'#e879f9', svg:`<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>` },
  check:     { color:'#34d399', svg:`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>` },
  calendar:  { color:'#38bdf8', svg:`<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>` },
  doc:       { color:'#c084fc', svg:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>` },
  send:      { color:'#2dd4bf', svg:`<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>` },
  folder:    { color:'#94a3b8', svg:`<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>` },
};

/**
 * Рисует аккордеон документов по разделам.
 * Классификация — через единый реестр sections.js (sectionOf/groupBySections),
 * одинаково для ОТ/ПДн/ВУ. Вёрстка (прогресс, проценты, стрелка) — общая.
 *
 * @param {array}  docs   — документы клиента (одного модуля)
 * @param {string} module — 'OT' | 'PD' | 'VU' (по умолчанию определяется по docs[0].module)
 */
function renderDocsBySection(docs, module) {
  const mod = module || (docs[0] && docs[0].module) || 'OT';
  const groups = (typeof groupBySections === 'function')
    ? groupBySections(mod, docs)
    : [{ section:{ title:'Документы', icon:'folder' }, docs }];

  let html = '';
  for (const g of groups) {
    const sec = g.section;
    const iconDef = SECTION_ICONS[sec.icon] || SECTION_ICONS.folder;
    const okCount  = g.docs.filter(d=>d.status==='ok').length;
    const pct      = Math.round(okCount / g.docs.length * 100);
    const pctColor = pct===100 ? '#34d399' : pct>=50 ? '#fbbf24' : '#f87171';
    const iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconDef.svg}</svg>`;
    const sectionHtml = g.docs.map(d => renderDocRow(d)).join('');
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
          border-left:3px solid ${iconDef.color};
          cursor:pointer;user-select:none;
          box-shadow:0 2px 8px rgba(0,0,0,0.15);
          transition:all .2s ease">
          <span style="font-size:18px;color:${iconDef.color};filter:drop-shadow(0 0 4px ${iconDef.color}44)">${iconSvg}</span>
          <span style="font-size:12px;font-weight:600;color:#f1f5f9;flex:1;letter-spacing:.2px">${sec.title}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:60px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${pctColor};border-radius:2px;transition:width .3s"></div>
            </div>
            <span style="font-size:10px;color:${pctColor};font-weight:600;min-width:28px;text-align:right">${pct}%</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.07);
                         padding:2px 8px;border-radius:8px;min-width:20px;text-align:center">${g.docs.length}</span>
            <span class="section-arrow" style="color:rgba(255,255,255,0.3);font-size:10px;
                  transition:transform .2s;transform:rotate(-90deg)">▼</span>
          </div>
        </div>
        <div class="section-docs" style="display:none;padding:4px 0 4px 8px;
             border-left:1px solid ${iconDef.color}33;margin-left:14px">
          ${sectionHtml}
        </div>
      </div>`;
  }

  return html || emptyState("file-text","Документов нет");
}

function toggleScoreBreakdown() {
  const el = document.getElementById('score-breakdown');
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => document.addEventListener('click', function hide(e) {
      if (!el.contains(e.target)) { el.style.display='none'; document.removeEventListener('click',hide); }
    }), 0);
  }
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

function renderEmpRow(e, divisions = []) {
  const birthYear = e.birth_date ? ' · ' + e.birth_date.slice(0,4) + ' г.р.' : '';
  const training  = e.training || {};
  const TYPES = ['prog_a','first_aid','fire','siz','repeat','medcheck','medcheck_714','psycho'];
  const today = new Date();
  const division = divisions.find(d => d.id === e.division_id);
  const divBadge = division
    ? `<span style="font-size:10px;background:rgba(96,165,250,0.12);color:#60a5fa;padding:1px 7px;border-radius:10px;margin-right:4px">${ic(DIVISION_WORK_TYPES[division.work_type]?.icon||'building',10)} ${division.name}</span>`
    : '';

  // Считаем статус обучения
  let alertCount = 0;
  TYPES.forEach(key => {
    const t = training[key];
    if (!t?.required || !t?.date) return;
    const last = new Date(t.date);
    const next = new Date(last);
    if (key === 'repeat') next.setMonth(next.getMonth() + 6);
    else if (key === 'medcheck' || key === 'medcheck_714') next.setFullYear(next.getFullYear() + 1);
    else if (key === 'psycho') next.setFullYear(next.getFullYear() + 5);
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
      <div class="client-meta">${e.position||'—'}${birthYear}${e.is_military?' · '+ic('star',12):''}${divBadge ? ' · ' : ''}${divBadge}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      ${alertBadge}
      <button class="btn btn-ghost" style="padding:4px 10px;display:flex;align-items:center;gap:5px;font-size:11px" onclick="openTraining(${e.id})" title="Обучение">${ic('graduation-cap',14)}</button>
      <button class="btn btn-ghost" style="padding:4px 10px;display:flex;align-items:center;gap:5px;font-size:11px" onclick="editEmployeePrompt(${e.id})" title="Редактировать">${ic('edit',14)}</button>
      <button class="btn btn-ghost" style="padding:4px 10px;display:flex;align-items:center;gap:5px;font-size:11px;color:var(--red)" onclick="deleteEmployee(${e.id})" title="Удалить">${ic('trash',14)}</button>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
//  ПОДРАЗДЕЛЕНИЯ
// ═══════════════════════════════════════════════════════

async function openDivisionModal(clientId, divisionId = null) {
  const existing = divisionId ? (await window.api.divisionsList(clientId)).find(d => d.id === divisionId) : null;

  const workTypeOptions = Object.entries(DIVISION_WORK_TYPES).map(([key, wt]) =>
    `<option value="${key}" ${existing?.work_type === key ? 'selected' : key === 'standard' && !existing ? 'selected' : ''}>
      ${wt.label}
    </option>`
  ).join('');

  let modal = document.getElementById('modalDivision');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'modalDivision';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:18px;padding:26px;width:500px;max-height:88vh;overflow-y:auto">
      <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:18px">
        ${existing ? ic("edit",16) + ' Редактировать подразделение' : '+ Добавить подразделение'}
      </div>

      <div class="form-group" style="margin-bottom:14px">
        <div class="form-label">Название подразделения</div>
        <input class="form-input" id="div-name" placeholder="Например: Администрация, Флот, Цех №1, ПАСФ" value="${existing?.name || ''}">
      </div>

      <div class="form-group" style="margin-bottom:14px">
        <div class="form-label">Тип работ</div>
        <select class="form-select" id="div-work-type" onchange="updateDivisionPreview()">
          ${workTypeOptions}
        </select>
      </div>

      <div class="form-group" style="margin-bottom:18px">
        <div class="form-label">Класс СОУТ (если отличается от типа)</div>
        <select class="form-select" id="div-soat-class">
          <option value="" ${!existing?.soat_class?'selected':''}>По умолчанию для типа работ</option>
          <option value="1" ${existing?.soat_class==='1'?'selected':''}>Класс 1 — Оптимальные</option>
          <option value="2" ${existing?.soat_class==='2'?'selected':''}>Класс 2 — Допустимые</option>
          <option value="31" ${existing?.soat_class==='31'?'selected':''}>Класс 3.1 — Вредные (1 ст.)</option>
          <option value="32" ${existing?.soat_class==='32'?'selected':''}>Класс 3.2 — Вредные (2 ст.)</option>
          <option value="33" ${existing?.soat_class==='33'?'selected':''}>Класс 3.3 — Вредные (3 ст.)</option>
          <option value="34" ${existing?.soat_class==='34'?'selected':''}>Класс 3.4 — Вредные (4 ст.)</option>
          <option value="4" ${existing?.soat_class==='4'?'selected':''}>Класс 4 — Опасные</option>
        </select>
      </div>

      <!-- Предпросмотр требований -->
      <div id="div-preview" style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:18px;font-size:12px"></div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('modalDivision').remove()">Отмена</button>
        ${existing ? `<button class="btn btn-red" style="flex:0 0 auto" onclick="deleteDivision(${divisionId}, ${clientId})">Удалить</button>` : ''}
        <button class="btn btn-primary" style="flex:2" onclick="saveDivision(${clientId}, ${divisionId || 'null'})">
          ${existing ? '${ic("save",14)} Сохранить' : '+ Добавить'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  updateDivisionPreview();
}

function updateDivisionPreview() {
  const key = document.getElementById('div-work-type')?.value;
  const wt = DIVISION_WORK_TYPES[key];
  if (!wt) return;
  const preview = document.getElementById('div-preview');
  if (!preview) return;

  const reqs = [];
  reqs.push(`<span style="color:var(--green)">✓ Программа А (ОТ), Первая помощь, Пожарный минимум, Повторный инструктаж</span>`);
  if (wt.medcheck) reqs.push(`<span style="color:#f87171">✓ Медосмотр по Приказу 29н</span>`);
  if (wt.medcheck_714) reqs.push(`<span style="color:#fbbf24">✓ Медосмотр плавсостава по Приказу 714н</span>`);
  if (wt.psycho) reqs.push(`<span style="color:#a78bfa">✓ Психиатрическое освидетельствование</span>`);
  if (wt.siz) reqs.push(`<span style="color:#60a5fa">✓ Обучение применению СИЗ</span>`);

  preview.innerHTML = `
    <div style="font-weight:700;color:var(--text);margin-bottom:8px">${ic(wt.icon,14)} ${wt.label}</div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">${reqs.join('')}</div>
    ${wt.note ? `<div style="color:#475569;font-size:11px;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">${ic("info",12)} ${wt.note}</div>` : ''}`;
}

async function saveDivision(clientId, divisionId) {
  const name = document.getElementById('div-name')?.value.trim();
  if (!name) { showToast('Введите название подразделения', 'var(--amber)'); return; }

  const workType = document.getElementById('div-work-type')?.value || 'standard';

  // ── МЯГКАЯ ПРОВЕРКА ОКВЭД ──────────────────────────
  // Соответствие типа работ и ОКВЭД (первые 2 цифры)
  const OKVED_MAP = {
    maritime: { codes: ['50'], name: 'Водный транспорт (50.xx)' },
    port:     { codes: ['52'], name: 'Вспомогательная транспортная деятельность (52.xx)' },
    pasf:     { codes: ['84','38','39'], name: 'Госуправление, утилизация (84.xx, 38-39.xx)' },
    diver:    { codes: ['50','71','72'], name: 'Водный транспорт, научные исследования (50.xx, 71-72.xx)' },
    production: { codes: ['10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33'], name: 'Производство (10-33.xx)' },
    height:   { codes: ['41','42','43'], name: 'Строительство (41-43.xx)' },
    hazardous:{ codes: ['05','06','07','08','09','19','20','24'], name: 'Добыча, нефтехимия (05-09.xx, 19-20.xx, 24.xx)' },
  };

  const mapping = OKVED_MAP[workType];
  if (mapping) {
    const c = await window.api.clientGet(clientId);
    const okved = (c?.okved || '').replace('.','').slice(0,2);
    const matches = mapping.codes.some(code => okved.startsWith(code));

    if (!matches && okved) {
      // Показываем предупреждение прямо в модалке
      const existing = document.getElementById('div-okved-warning');
      if (existing) existing.remove();

      const wt = DIVISION_WORK_TYPES[workType];
      const warning = document.createElement('div');
      warning.id = 'div-okved-warning';
      warning.style.cssText = 'background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12px';
      warning.innerHTML = `
        <div style="font-weight:700;color:#fbbf24;margin-bottom:6px">${ic("alert-triangle",14)} ОКВЭД не совпадает с типом работ</div>
        <div style="color:#d4d4d8;line-height:1.5">
          ОКВЭД организации: <b>${c.okved}</b><br>
          Тип «${ic(wt.icon,12)} ${wt.label}» обычно применяется для: <b>${mapping.name}</b>
        </div>
        <div style="color:#94a3b8;font-size:11px;margin-top:8px">Если это корректно — нажмите «Сохранить» ещё раз.</div>
        <button onclick="document.getElementById('div-okved-warning').remove()" 
          style="margin-top:8px;padding:5px 12px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);border-radius:6px;color:#fbbf24;cursor:pointer;font-size:11px">
          Понял, всё равно сохранить →
        </button>`;

      // Вставляем предупреждение перед кнопками
      const btns = document.querySelector('#modalDivision .btn.btn-primary')?.parentElement;
      if (btns) btns.parentElement.insertBefore(warning, btns);

      // Первый клик показывает предупреждение, второй — сохраняет
      return;
    }
  }

  // Предупреждение уже было показано или ОКВЭД совпадает — сохраняем
  const data = {
    client_id:  clientId,
    name,
    work_type:  workType,
    soat_class: document.getElementById('div-soat-class')?.value || '',
  };

  if (divisionId) {
    await window.api.divisionsUpdate(divisionId, data);
    showToast('Подразделение обновлено');
  } else {
    await window.api.divisionsAdd(data);
    showToast('Подразделение добавлено');
  }

  document.getElementById('modalDivision')?.remove();
  await navigate('client', clientId);
}

async function deleteDivision(divisionId, clientId) {
  if (!confirm('Удалить подразделение? Сотрудники будут откреплены.')) return;
  await window.api.divisionsDelete(divisionId);
  document.getElementById('modalDivision')?.remove();
  showToast('Подразделение удалено');
  await navigate('client', clientId);
}

// ═══════════════════════════════════════════════════════
//  МОДУЛЬ ОБУЧЕНИЯ
// ═══════════════════════════════════════════════════════
const TRAINING_TYPES_BASE = [
  { key:'prog_a',    label:'Программа А — общие вопросы ОТ',           period:'3 года',  years:3,   who:'Руководитель, отв. за ОТ',       alwaysRequired: true  },
  { key:'prog_b',    label:'Программа Б — безопасные методы работы',   period:'3 года',  years:3,   who:'Специалисты, рабочие',            alwaysRequired: false },
  { key:'prog_v',    label:'Программа В — работы повышенной опасности',period:'1 год',   years:1,   who:'Работники с допуском к РПО',      alwaysRequired: false },
  { key:'first_aid', label:'Первая помощь пострадавшим',               period:'3 года',  years:3,   who:'Все работники',                   alwaysRequired: true  },
  { key:'fire',      label:'Пожарно-технический минимум',              period:'3 года',  years:3,   who:'Руководитель, отв. за ПБ',        alwaysRequired: true  },
  { key:'siz',       label:'Применение СИЗ',                          period:'3 года',  years:3,   who:'Работники применяющие СИЗ',       alwaysRequired: false },
  { key:'repeat',    label:'Повторный инструктаж на р.м.',             period:'6 мес.',  months:6,  who:'Все (кроме освобождённых)',       alwaysRequired: true  },
  { key:'medcheck',  label:'Медицинский осмотр (Приказ 29н)',          period:'1 год',   years:1,   who:'При наличии оснований',           alwaysRequired: false },
  { key:'medcheck_714', label:'Медосмотр плавсостава (Приказ 714н)',   period:'2 года',  years:2,   who:'Моряки, плавсостав',              alwaysRequired: false },
  { key:'psycho',    label:'Психиатрическое освидетельствование',      period:'5 лет',   years:5,   who:'ПАСФ, спасатели, высотники',      alwaysRequired: false },
];

// Типы работ подразделения и их требования
const DIVISION_WORK_TYPES = {
  standard: {
    label: 'Обычные (офис, торговля, услуги)',
    icon: 'building',
    soatDefault: '2',
    medcheck: false,
    medcheck_714: false,
    psycho: false,
    hazard: false,
    siz: false,
    note: '',
  },
  production: {
    label: 'Производство / склад / цех',
    icon: 'building',
    soatDefault: '31',
    medcheck: true,
    medcheck_714: false,
    psycho: false,
    hazard: false,
    siz: true,
    note: 'Медосмотр по Приказу 29н обязателен при классе 3+',
  },
  maritime: {
    label: 'Морской / плавсостав',
    icon: 'anchor',
    soatDefault: '32',
    medcheck: true,
    medcheck_714: true,
    psycho: false,
    hazard: true,
    siz: true,
    note: 'Оба медосмотра: Приказ 29н + Приказ 714н (КТМ РФ)',
  },
  port: {
    label: 'Портовые рабочие / докеры / стивидоры',
    icon: 'anchor',
    soatDefault: '32',
    medcheck: true,
    medcheck_714: false,
    psycho: false,
    hazard: true,
    siz: true,
    note: 'Отраслевые ПОТ для портов действуют до 01.09.2027',
  },
  pasf: {
    label: 'ПАСФ / спасатели / аварийные службы',
    icon: 'alert-triangle',
    soatDefault: '33',
    medcheck: true,
    medcheck_714: false,
    psycho: true,
    hazard: true,
    siz: true,
    note: 'Медосмотр по п.14 Приказа 29н (АСФ) + психосвидетельствование',
  },
  diver: {
    label: 'Водолазные работы',
    icon: 'anchor',
    soatDefault: '33',
    medcheck: true,
    medcheck_714: false,
    psycho: true,
    hazard: true,
    siz: true,
    note: 'Медосмотр по п.19 Приказа 29н (водолазные работы) обязателен',
  },
  height: {
    label: 'Работы на высоте',
    icon: 'hard-hat',
    soatDefault: '31',
    medcheck: true,
    medcheck_714: false,
    psycho: false,
    hazard: true,
    siz: true,
    note: 'ПОТ при работах на высоте действуют до 01.09.2031',
  },
  hazardous: {
    label: 'Опасные / вредные производства',
    icon: 'alert-triangle',
    soatDefault: '34',
    medcheck: true,
    medcheck_714: false,
    psycho: false,
    hazard: true,
    siz: true,
    note: 'Класс условий труда уточняется по результатам СОУТ',
  },
};

// Определяем какие программы нужны для конкретного сотрудника
// с учётом его подразделения
function getRequiredTraining(client, employee, existingTraining, division) {
  // Приоритет: подразделение → клиент → умолчания
  const divWorkType = division?.work_type ? DIVISION_WORK_TYPES[division.work_type] : null;
  const soatClass   = parseInt(division?.soat_class || client?.soat_class || '2');
  const hazardWorks = divWorkType?.hazard || !!client?.hazard_works;
  const medRequired = divWorkType?.medcheck || !!client?.medcheck_required || !!employee?.medcheck_required;
  const med714      = divWorkType?.medcheck_714 || false;
  const psycho      = divWorkType?.psycho || false;
  const needSiz     = divWorkType?.siz || soatClass >= 31 || hazardWorks;
  const isOffice    = soatClass <= 2 && !hazardWorks;
  const progBExempt = !!employee?.prog_b_exempt;

  return TRAINING_TYPES_BASE.map(tt => {
    const existing = existingTraining?.[tt.key] || {};
    let required = existing.required;

    if (required === undefined) {
      if (tt.key === 'prog_a')       required = true;
      if (tt.key === 'prog_b')       required = !isOffice && !progBExempt;
      if (tt.key === 'prog_v')       required = hazardWorks;
      if (tt.key === 'first_aid')    required = true;
      if (tt.key === 'fire')         required = true;
      if (tt.key === 'siz')          required = needSiz;
      if (tt.key === 'repeat')       required = true;
      if (tt.key === 'medcheck')     required = medRequired;
      if (tt.key === 'medcheck_714') required = med714;
      if (tt.key === 'psycho')       required = psycho;
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
  if (!t?.date)     return { icon:'x-circle', color:'var(--red)',   label:'Не пройдено',  days:null };
  const next = calcNextDate(t.date, tt);
  const days = Math.ceil((next - new Date()) / 86400000);
  if (days < 0)   return { icon:'circle', color:'var(--red)',   label:`Просрочено ${Math.abs(days)} дн.`, days };
  if (days <= 14) return { icon:'circle', color:'var(--amber)', label:`${days} дн.`,   days };
  if (days <= 30) return { icon:'circle', color:'var(--amber)', label:`${days} дн.`,   days };
  return { icon:'check-circle', color:'var(--green)', label:formatDate(next.toISOString()), days };
}

async function openTraining(empId) {
  const emps = await window.api.employeesList(currentClientId);
  const e = emps.find(x => x.id === empId);
  if (!e) return;

  const client   = await window.api.clientGet(currentClientId);
  const training = e.training || {};
  const allDivisions = await window.api.divisionsList(currentClientId);
  const division = allDivisions.find(d => d.id === e.division_id) || null;
  const types    = getRequiredTraining(client, e, training, division);

  const modal = document.createElement('div');
  modal.id = 'trainingModal';
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
          <span style="font-size:13px;color:${st.color}">${st.icon === '—' ? '—' : ic(st.icon,13)}</span>
          <span style="font-size:11px;font-weight:600;color:${st.color}">${st.label}</span>
        </div>
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">${ic('graduation-cap', 14)} Обучение</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${e.full_name} · ${e.position||''}</div>
        </div>
        <button onclick="document.getElementById('trainingModal').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px">✕</button>
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
        <button onclick="saveTraining(${empId})" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">${ic("save",14)} Сохранить</button>
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
  document.getElementById('trainingModal')?.remove();
  showToast('Данные обучения сохранены');
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

// Склонение названия должности по падежам (для составных/нестандартных
// формулировок вроде "Ведущий специалист по охране труда и пожарной
// безопасности" — программная декпинация ненадёжна для произвольного
// текста, поэтому используем тот же AI-механизм, что и для ФИО).
// Должность в официальных документах не меняется по роду держателя
// должности (стандартная канцелярская норма), поэтому пол не запрашиваем.
async function declinePosition(positionText) {
  try {
    const result = await window.api.aiRequest({
      system: 'Ты — помощник по русской грамматике. Отвечай ТОЛЬКО валидным JSON без markdown и пояснений.',
      prompt: `Просклоняй название должности "${positionText}" по падежам, как она пишется в служебных документах (форма должности не меняется по роду).
Верни ТОЛЬКО JSON в формате:
{"nom":"${positionText}","gen":"...","dat":"...","acc":"...","ins":"...","pre":"..."}`,
    });
    if (!result.ok) return null;
    const text = result.text.replace(/```json|```/g,'').trim();
    const data = JSON.parse(text);
    return data;
  } catch(e) {
    console.error('declinePosition error:', e);
    return null;
  }
}

// Сворачиваемый блок «Паспортные данные» (СНИЛС + паспорт) — общий для форм
// добавления и редактирования сотрудника. prefix различает id полей между
// двумя формами (emp / edit-emp), e — существующий сотрудник при редактировании
// (для добавления передаём null, тогда все поля пустые).
function passportBlockHtml(prefix, e) {
  const v = (key) => e?.[key] || '';
  const hasData = e && (e.snils || e.passport_series || e.passport_number || e.passport_issued_by || e.passport_issued_date);
  return `
      <div class="panel" style="padding:0;margin-bottom:16px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden">
        <div onclick="togglePassportBlock('${prefix}')" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:12px 14px;user-select:none">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;text-transform:uppercase;display:flex;align-items:center;gap:6px">
            ${ic('id-card',13)} Паспортные данные ${hasData ? '' : '<span style="font-weight:400;text-transform:none;color:#475569">(необязательно)</span>'}
          </div>
          <svg id="${prefix}-passport-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .2s;${hasData ? 'transform:rotate(180deg)' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div id="${prefix}-passport-body" style="display:${hasData ? 'block' : 'none'};padding:0 14px 14px">
          <div style="margin-bottom:10px">
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">СНИЛС</label>
            <input id="${prefix}-snils" value="${v('snils')}" placeholder="123-456-789 00" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div>
              <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Серия паспорта</label>
              <input id="${prefix}-pass-series" value="${v('passport_series')}" placeholder="0000" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
            </div>
            <div>
              <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Номер паспорта</label>
              <input id="${prefix}-pass-number" value="${v('passport_number')}" placeholder="000000" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
            </div>
          </div>
          <div style="margin-bottom:10px">
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Кем выдан</label>
            <input id="${prefix}-pass-issued-by" value="${v('passport_issued_by')}" placeholder="УМВД России по г. ..." style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Дата выдачи</label>
            <input id="${prefix}-pass-issued-date" type="date" value="${v('passport_issued_date')}" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>
        </div>
      </div>`;
}

function togglePassportBlock(prefix) {
  const body = document.getElementById(`${prefix}-passport-body`);
  const chevron = document.getElementById(`${prefix}-passport-chevron`);
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  chevron.style.transform = open ? '' : 'rotate(180deg)';
}

// Считывает значения блока «Паспортные данные» из формы по prefix — общая
// логика для обработчиков сохранения в addEmployeePrompt и editEmployeePrompt.
function readPassportBlock(prefix) {
  return {
    snils:                  document.getElementById(`${prefix}-snils`)?.value.trim() || '',
    passport_series:        document.getElementById(`${prefix}-pass-series`)?.value.trim() || '',
    passport_number:        document.getElementById(`${prefix}-pass-number`)?.value.trim() || '',
    passport_issued_by:     document.getElementById(`${prefix}-pass-issued-by`)?.value.trim() || '',
    passport_issued_date:   document.getElementById(`${prefix}-pass-issued-date`)?.value || '',
  };
}

// Разворачивает/сворачивает список сотрудников внутри карточки подразделения
function toggleDivisionExpand(divisionId) {
  const body = document.getElementById(`div-employees-${divisionId}`);
  const chevron = document.getElementById(`div-chevron-${divisionId}`);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

async function addEmployeePrompt(clientId) {
  const clientDivisions = await window.api.divisionsList(clientId);
  const divOptions = clientDivisions.length
    ? `<option value="">— Без подразделения —</option>` + clientDivisions.map(d => {
        const wt = DIVISION_WORK_TYPES[d.work_type] || DIVISION_WORK_TYPES.standard;
        return `<option value="${d.id}">${d.name}</option>`;
      }).join('')
    : `<option value="">— Подразделения не созданы —</option>`;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:20px">${ic("plus",16)} Добавить сотрудника</div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">ФИО полностью <span style="color:#f87171">*</span></label>
        <input id="emp-name" placeholder="Иванов Иван Иванович" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Должность <span style="color:#f87171">*</span></label>
        <input id="emp-pos" placeholder="Менеджер по продажам" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      ${clientDivisions.length ? `
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">${ic("building",12)} Подразделение</label>
        <select id="emp-division" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          ${divOptions}
        </select>
      </div>` : ''}
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
          ${ic("star",14)} Военнообязанный
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="emp-prog-b-exempt" style="width:16px;height:16px;cursor:pointer">
          ${ic("clipboard-list",14)} Освобождён от первичного инструктажа на РМ (только ПЭВМ/офис)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="emp-medcheck" style="width:16px;height:16px;cursor:pointer">
          ${ic("heart",14)} Требуется медосмотр
        </label>
      </div>

      ${passportBlockHtml('emp', null)}

      <!-- Воинский учёт -->
      <div style="padding:14px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.15);border-radius:10px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:#60a5fa;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Воинский учёт
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Категория ВУ</label>
            <select id="emp-vu-cat" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
              <option value="">— Не на учёте —</option>
              <option value="призывник">Призывник (18–27 лет)</option>
              <option value="запас">Военнообязанный запаса</option>
              <option value="ограниченно_годный">Ограниченно годный (кат. В)</option>
              <option value="бронь">Забронированный</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Воинское звание</label>
            <select id="emp-vu-rank" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
              <option value="">— Не указано —</option>
              <option value="рядовой">Рядовой / Матрос</option>
              <option value="сержант">Сержант / Старшина</option>
              <option value="прапорщик">Прапорщик / Мичман</option>
              <option value="офицер">Офицер</option>
            </select>
          </div>
        </div>
        <div style="margin-top:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
            <input type="checkbox" id="emp-vu-mobpred" style="width:14px;height:14px;cursor:pointer;accent-color:#60a5fa">
            Имеет мобилизационное предписание
          </label>
        </div>
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
      const divEl = document.getElementById('emp-division');
      const divisionId = divEl?.value ? parseInt(divEl.value) : null;
      const vuCat     = document.getElementById('emp-vu-cat')?.value || '';
      const vuRank    = document.getElementById('emp-vu-rank')?.value || '';
      const vuMobpred = document.getElementById('emp-vu-mobpred')?.checked || false;
      const passportData = readPassportBlock('emp');

      if (!name) {
        const el = document.getElementById('emp-name');
        el.style.borderColor = '#f87171';
        el.placeholder = 'Обязательное поле';
        el.addEventListener('input', () => { el.style.borderColor = ''; el.placeholder = 'Иванов Иван Иванович'; }, { once: true });
        return;
      }
      if (!pos) {
        const el = document.getElementById('emp-pos');
        el.style.borderColor = '#f87171';
        el.placeholder = 'Обязательное поле';
        el.addEventListener('input', () => { el.style.borderColor = ''; el.placeholder = 'Должность'; }, { once: true });
        return;
      }

      const saveBtn = document.getElementById('emp-save');
      saveBtn.innerHTML = `${ic("refresh",14)} Обработка...`;
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
        division_id:       divisionId,
        is_military:       mil,
        prog_b_exempt:     progBExempt,
        medcheck_required: medcheck,
        name_gen:          declension?.gen   || '',
        name_dat:          declension?.dat   || '',
        name_acc:          declension?.acc   || '',
        name_ins:          declension?.ins   || '',
        name_short:        declension?.short || '',
        vu_category:       vuCat,
        vu_rank:           vuRank,
        vu_mobpredpisanie: vuMobpred ? 1 : 0,
        ...passportData,
      });

      if (declension?.dat) {
        showToast('Сотрудник добавлен · ' + declension.short);
      } else {
        showToast('Сотрудник добавлен');
      }
      // Обновляем счётчик сотрудников в базе клиента
      const updatedEmps = await window.api.employeesList(clientId);
      await window.api.clientUpdate(clientId, { staff: updatedEmps.length });
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

  const editClientDivisions = await window.api.divisionsList(currentClientId);
  const editDivOptions = editClientDivisions.length
    ? `<option value="" ${!e.division_id ? 'selected' : ''}>— Без подразделения —</option>` + editClientDivisions.map(d =>
        `<option value="${d.id}" ${e.division_id === d.id ? 'selected' : ''}>${d.name}</option>`
      ).join('')
    : '';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:420px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:20px">${ic("edit",16)} Редактировать сотрудника</div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">ФИО полностью</label>
        <input id="edit-emp-name" value="${e.full_name||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Должность</label>
        <input id="edit-emp-pos" value="${e.position||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      ${editClientDivisions.length ? `
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">${ic("building",12)} Подразделение</label>
        <select id="edit-emp-division" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          ${editDivOptions}
        </select>
      </div>` : ''}
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Дата рождения</label>
        <input id="edit-emp-birth" type="date" value="${e.birth_date||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:20px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-mil" ${e.is_military?'checked':''} style="width:16px;height:16px;cursor:pointer">
          ${ic("star",14)} Военнообязанный
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-prog-b-exempt" ${e.prog_b_exempt?'checked':''} style="width:16px;height:16px;cursor:pointer">
          ${ic("clipboard-list",14)} Освобождён от первичного инструктажа на РМ (только ПЭВМ/офис)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-medcheck" ${e.medcheck_required?'checked':''} style="width:16px;height:16px;cursor:pointer">
          ${ic("heart",14)} Требуется медосмотр
        </label>
      </div>

      ${passportBlockHtml('edit-emp', e)}

      <!-- Воинский учёт -->
      <div style="padding:14px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.15);border-radius:10px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:#60a5fa;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Воинский учёт
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Категория ВУ</label>
            <select id="edit-emp-vu-cat" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
              <option value="" ${!e.vu_category?'selected':''}>— Не на учёте —</option>
              <option value="призывник" ${e.vu_category==='призывник'?'selected':''}>Призывник (18–27 лет)</option>
              <option value="запас" ${e.vu_category==='запас'?'selected':''}>Военнообязанный запаса</option>
              <option value="ограниченно_годный" ${e.vu_category==='ограниченно_годный'?'selected':''}>Ограниченно годный (кат. В)</option>
              <option value="бронь" ${e.vu_category==='бронь'?'selected':''}>Забронированный</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Воинское звание</label>
            <select id="edit-emp-vu-rank" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
              <option value="" ${!e.vu_rank?'selected':''}>— Не указано —</option>
              <option value="рядовой" ${e.vu_rank==='рядовой'?'selected':''}>Рядовой / Матрос</option>
              <option value="сержант" ${e.vu_rank==='сержант'?'selected':''}>Сержант / Старшина</option>
              <option value="прапорщик" ${e.vu_rank==='прапорщик'?'selected':''}>Прапорщик / Мичман</option>
              <option value="офицер" ${e.vu_rank==='офицер'?'selected':''}>Офицер</option>
            </select>
          </div>
        </div>
        <div style="margin-top:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
            <input type="checkbox" id="edit-emp-vu-mobpred" ${e.vu_mobpredpisanie?'checked':''} style="width:14px;height:14px;cursor:pointer;accent-color:#60a5fa">
            Имеет мобилизационное предписание
          </label>
        </div>
      </div>

      <!-- РОЛЬ В КОМИССИИ -->
      <div style="padding:14px;background:rgba(167,139,250,0.04);border:1px solid rgba(167,139,250,0.12);border-radius:10px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#a78bfa;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Комиссия по проверке знаний
        </div>
        <select id="edit-emp-commission" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
          <option value="" ${!e.commission_role?'selected':''}>— Не является членом комиссии —</option>
          <option value="chairman" ${e.commission_role==='chairman'?'selected':''}>Председатель комиссии</option>
          <option value="member"   ${e.commission_role==='member'  ?'selected':''}>Член комиссии</option>
        </select>
        <div style="font-size:11px;color:#475569;margin-top:7px">Удостоверение берётся из реестра «Внешний центр»</div>
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
      const vuCat2     = document.getElementById('edit-emp-vu-cat')?.value || '';
      const vuRank2    = document.getElementById('edit-emp-vu-rank')?.value || '';
      const vuMobpred2 = document.getElementById('edit-emp-vu-mobpred')?.checked || false;
      const passportData2 = readPassportBlock('edit-emp');
      const divisionEl2 = document.getElementById('edit-emp-division');
      const divisionId2 = divisionEl2 && divisionEl2.value ? parseInt(divisionEl2.value) : null;
      if (!name) { document.getElementById('edit-emp-name').style.border = '1px solid #f87171'; return; }

      const saveBtn2 = document.getElementById('edit-emp-save');
      saveBtn2.innerHTML = `${ic("refresh",14)} Обработка...`;
      saveBtn2.disabled = true;

      let declension = null;
      if (window.api.aiRequest) {
        declension = await declineFIO(name);
      }

      // Читаем commission_role ДО удаления модала
      const commissionRole = document.getElementById('edit-emp-commission')?.value || null;

      modal.remove();
      const empResult = await window.api.employeeUpdate(empId, {
        full_name:         name,
        position:          pos,
        birth_date:        birth,
        is_military:       mil,
        prog_b_exempt:     progBExempt,
        medcheck_required: medcheck,
        vu_category:       vuCat2,
        vu_rank:           vuRank2,
        vu_mobpredpisanie: vuMobpred2 ? 1 : 0,
        commission_role:   commissionRole || null,
        division_id:       divisionId2,
        name_gen:          declension?.gen   || '',
        name_dat:          declension?.dat   || '',
        name_acc:          declension?.acc   || '',
        name_ins:          declension?.ins   || '',
        name_short:        declension?.short || '',
        ...passportData2,
      });
      if (empResult?.error) {
        showToast(empResult.error, 'var(--red)');
        await navigate('client', currentClientId);
        resolve(false);
        return;
      }
      if (declension?.dat) {
        showToast('Сотрудник обновлён · ' + declension.short);
      } else {
        showToast('Сотрудник обновлён');
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
  // Обновляем счётчик сотрудников в базе клиента
  const updatedEmps = await window.api.employeesList(currentClientId);
  await window.api.clientUpdate(currentClientId, { staff: updatedEmps.length });
  showToast('Удалено');
  await navigate('client', currentClientId);
}
