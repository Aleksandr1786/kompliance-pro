// ============================================================
// КОМПЛАЕНСПРО — clients.js
// Список клиентов и карточка клиента
// Выделен из app.js, версия 08.06.2026
// ============================================================

async function renderClients() {
  const clients = await getClients();
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

  // ── РАСЧЁТ ГОТОВНОСТИ ──
  let scoreTotal = 0;
  const scoreBreakdown = [];

  const totalDocs = docs.length;
  const okDocs = docs.filter(d => d.status === 'ok').length;
  let docsScore = totalDocs > 0 ? Math.round(okDocs / totalDocs * 35) : 0;
  scoreTotal += docsScore;
  scoreBreakdown.push({ label:'Документы', score:docsScore, max:35, pct: totalDocs>0 ? Math.round(okDocs/totalDocs*100) : 0 });

  let trainingScore = 25;
  const now = new Date();
  if (emps.length === 0) { trainingScore = 0; }
  else {
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
        if (Math.ceil((next - now) / 86400000) < 0) badCount += 2;
        else if (Math.ceil((next - now) / 86400000) <= 14) badCount += 1;
      });
    });
    trainingScore = Math.max(0, Math.round((1 - badCount / (emps.length * 4)) * 25));
  }
  scoreTotal += trainingScore;
  scoreBreakdown.push({ label:'Обучение', score:trainingScore, max:25 });

  const requiredFields = ['inn','okved','manager_name','manager_position','address','city','phone','staff','region','form'];
  const filledFields = requiredFields.filter(f => c[f] && String(c[f]).trim() !== '' && String(c[f]) !== '0').length;
  const dataScore = Math.round(filledFields / requiredFields.length * 25);
  scoreTotal += dataScore;
  scoreBreakdown.push({ label:'Данные клиента', score:dataScore, max:25, filled:filledFields, total:requiredFields.length, missing: requiredFields.filter(f => !c[f] || String(c[f]).trim()==='' || String(c[f])==='0').map(f=>f.label) });

  let empScore = 0;
  if (emps.length > 0) empScore = Math.round(emps.filter(e => e.position && e.position.trim()).length / emps.length * 15);
  scoreTotal += empScore;
  scoreBreakdown.push({ label:'Сотрудники', score:empScore, max:15 });

  const realScore = Math.min(100, scoreTotal);
  if (realScore !== (c.score||0)) window.api.clientUpdate(id, { score: realScore });
  const scoreColor = realScore >= 80 ? 'var(--green)' : realScore >= 40 ? 'var(--amber)' : 'var(--red)';

  document.getElementById('topbarTitle').textContent = c.name;
  const btn = document.getElementById('topbarAction');
  btn.textContent = '← Все клиенты';
  btn.style.display = 'flex';
  btn.className = 'btn btn-ghost';
  btn.onclick = () => { btn.className = 'btn btn-primary'; navigate('clients'); };

  let editBtn = document.getElementById('topbarEdit');
  if (!editBtn) {
    editBtn = document.createElement('button');
    editBtn.id = 'topbarEdit';
    editBtn.className = 'btn btn-ghost';
    editBtn.textContent = '✏️ Редактировать';
    document.getElementById('topbarAction').after(editBtn);
  }
  editBtn.style.display = 'flex';
  editBtn.onclick = () => openEditModal(id);

  const otDocs = docs.filter(d => d.module === 'OT');
  const pdDocs = docs.filter(d => d.module === 'PD');
  const vuDocs = docs.filter(d => d.module === 'VU');
  const safeName = (c.name || '').replace(/[\/\\:*?"<>|]/g, '_').slice(0, 60);
  const clientDocDir = otDocs.length && otDocs[0].filepath ? otDocs[0].filepath.replace(/[\\/][^\\/]+$/, '') : null;
  window._currentClientDocDir = clientDocDir;

  document.getElementById('content').innerHTML = `
    <div class="hero">
      <div class="hero-top">
        <div class="hero-avatar" style="background:${c.color||'#60a5fa'}22;border:1px solid ${c.color||'#60a5fa'}44">${initials}</div>
        <div style="flex:1;min-width:0">
          <div class="hero-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
          <div class="hero-tags">
            ${c.inn?`<span class="hero-tag">ИНН: ${c.inn}</span>`:''}
            ${c.okved?`<span class="hero-tag">ОКВЭД: ${c.okved}</span>`:''}
            ${c.region?`<span class="hero-tag">📍 ${c.region}</span>`:''}
            ${c.staff?`<span class="hero-tag">${emps.length || c.staff} сотр.</span>`:''}
            ${c.form?`<span class="hero-tag">${c.form}</span>`:''}
          </div>
        </div>
        <div class="hero-score" style="text-align:right;cursor:pointer;position:relative" onclick="toggleScoreBreakdown()" title="Нажмите для деталей">
          <div class="score-val" style="color:${scoreColor}">${realScore}%</div>
          <div class="score-label">Готовность</div>
          <div style="display:flex;gap:3px;justify-content:flex-end;margin-top:4px">
            ${scoreBreakdown.map(s => {
              const pct = Math.round(s.score/s.max*100);
              const col = pct===100?'#34d399':pct>=50?'#fbbf24':'#f87171';
              return `<div title="${s.label}: ${s.score}/${s.max}" style="width:18px;height:3px;border-radius:2px;background:${col}"></div>`;
            }).join('')}
          </div>
        </div>
        <div id="score-breakdown" style="display:none;position:absolute;top:100%;right:0;margin-top:8px;z-index:100;background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px 18px;min-width:240px;box-shadow:0 16px 40px rgba(0,0,0,0.5)">
          <div style="font-size:11px;font-weight:700;color:#475569;letter-spacing:.8px;margin-bottom:10px">ДЕТАЛИЗАЦИЯ ГОТОВНОСТИ</div>
          ${scoreBreakdown.map(s => {
            const pct = Math.round(s.score/s.max*100);
            const col = pct===100?'#34d399':pct>=50?'#fbbf24':'#f87171';
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:12px;color:#e2e8f0">${s.label}</span><span style="font-size:11px;font-weight:700;color:${col}">${s.score}/${s.max}</span></div>
              <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div></div>
              ${s.missing?.length ? `<div style="font-size:10px;color:#475569;margin-top:3px">Не заполнено: ${s.missing.slice(0,3).join(', ')}${s.missing.length>3?'...':''}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="hero-stats">
        <div class="hstat"><div class="hstat-val" style="color:var(--green)">${docs.length}</div><div class="hstat-label">Документов</div></div>
        <div class="hstat"><div class="hstat-val" style="color:var(--amber)">${docs.filter(d=>d.status==='outdated').length}</div><div class="hstat-label">Обновить</div></div>
        <div class="hstat"><div class="hstat-val" style="color:var(--red)">${events.filter(e=>new Date(e.due_date)<now).length}</div><div class="hstat-label">Просрочено</div></div>
        <div class="hstat"><div class="hstat-val">${emps.length}</div><div class="hstat-label">Сотрудников</div></div>
      </div>
    </div>

    <div onclick="openReadinessCenter(${id})" style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12));border:1px solid rgba(96,165,250,0.25);border-radius:16px;padding:18px 22px;margin-bottom:14px;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor='rgba(96,165,250,0.5)';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='rgba(96,165,250,0.25)';this.style.transform='translateY(0)'">
      <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#a78bfa);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(96,165,250,0.4)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
      <div style="flex:1"><div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:4px">Центр готовности</div><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:11px;font-weight:600;padding:2px 8px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);border-radius:6px;color:#f87171">ГИТ</span><span style="font-size:11px;color:#475569">· индекс риска · прогноз · отчёт</span></div></div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0"><div style="text-align:right"><div style="font-size:22px;font-weight:800;color:${scoreColor};line-height:1">${realScore}%</div><div style="font-size:10px;color:#475569">готовность</div></div><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>
    </div>

    <div class="tabs">
      <div class="tab active" onclick="switchTab('overview')">📋 Обзор</div>
      ${mods.includes('OT')?`<div class="tab" onclick="switchTab('ot')">🛡️ Охрана труда</div>`:''}
      ${mods.includes('PD')?`<div class="tab" onclick="switchTab('pd')">🔒 ПДн</div>`:''}
      ${mods.includes('VU')?`<div class="tab" onclick="switchTab('vu');renderClientVu(${id})">⭐ Воинский учёт</div>`:''}
      <div class="tab" onclick="switchTab('divisions')">🏢 Подразделения${divisions.length?` <span style="background:#3b82f6;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px">${divisions.length}</span>`:''}</div>
      <div class="tab" onclick="switchTab('staff')">👥 Сотрудники</div>
      <div class="tab" onclick="switchTab('reporting');renderClientReporting(${id})">📅 Отчётность</div>
    </div>

    <div class="tab-panel active" id="tab-overview">
      <div class="grid2">
        <div class="panel">
          <div class="panel-head"><span>🔔</span><div class="panel-title">Ближайшие события</div></div>
          <div>${events.length ? events.slice(0,6).map(e=>renderEventRow(e)).join('') : emptyState("calendar","Событий нет")}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><span>✅</span><div class="panel-title">Задачи</div><div class="panel-action" onclick="addTaskForClient(${id})">+ Добавить</div></div>
          <div>${clientTasks.length ? clientTasks.map(t=>renderTaskRow(t)).join('') : emptyState("check-circle","Задач нет")}</div>
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-ot">
      <div class="panel">
        <div class="panel-head">${ic("hard-hat", 18)}<div class="panel-title">Документы — Охрана труда</div><div class="panel-count">${otDocs.length} шт.</div>
          <div style="margin-left:auto;display:flex;gap:8px">
            ${clientDocDir ? `<button class="btn" style="padding:6px 12px;font-size:11px;background:var(--s3);color:var(--text)" onclick="openClientFolder()">📁 Открыть папку</button>` : ''}
            <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="generateDocs(${id})">${ic("zap",14)} Сгенерировать</button>
          </div>
        </div>
        <div>${otDocs.length ? renderDocsBySection(otDocs) : renderEmptyDocs('ОТ', id)}</div>
      </div>
    </div>

    <div class="tab-panel" id="tab-pd">
      <div class="panel">
        <div class="panel-head">${ic("lock", 18)}<div class="panel-title">Готовность к 152-ФЗ</div>
          <div style="margin-left:auto;font-size:22px;font-weight:700;color:${(()=>{let s=0;if(c.pd_responsible_name)s+=25;if(c.pd_notified_rkn)s+=25;if(pdDocs.length>0)s+=35;if((c.pd_ispdn_list||[]).length>0)s+=15;return s>=80?'var(--green)':s>=40?'var(--amber)':'var(--red)';})()}">${(()=>{let s=0;if(c.pd_responsible_name)s+=25;if(c.pd_notified_rkn)s+=25;if(pdDocs.length>0)s+=35;if((c.pd_ispdn_list||[]).length>0)s+=15;return s;})()}%</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px">
          ${[{label:'Документы',val:pdDocs.length>0,pts:35},{label:'Уведомление РКН',val:!!c.pd_notified_rkn,pts:25},{label:'Ответственный',val:!!c.pd_responsible_name,pts:25},{label:'ИСПДн',val:(c.pd_ispdn_list||[]).length>0,pts:15}].map(b=>`<div style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid ${b.val?'rgba(52,211,153,0.3)':'var(--border)'};border-radius:10px;text-align:center"><div style="margin-bottom:4px">${b.val?ic("check-circle",18,"color:var(--green)"):ic("x-circle",18,"color:var(--muted)")}</div><div style="font-size:11px;font-weight:600;color:${b.val?'var(--green)':'var(--muted)'}">${b.label}</div><div style="font-size:10px;color:var(--muted);margin-top:2px">${b.pts} балл.</div></div>`).join('')}
        </div>
      </div>
      <div class="panel" style="margin-top:12px">
        <div class="panel-head">${ic("file-text", 18)}<div class="panel-title">Документы — ПДн</div><div class="panel-count">${pdDocs.length} шт.</div>
          <button class="btn btn-primary" style="margin-left:auto;font-size:12px" onclick="generatePdDocs(${id})">${ic("zap",14)} Сгенерировать</button>
        </div>
        <div>${pdDocs.length ? pdDocs.map(d=>renderDocRow(d)).join('') : '<div style="padding:20px;text-align:center;color:var(--muted)">Документы ещё не сгенерированы</div>'}</div>
      </div>
    </div>

      <!-- Ответственный за ПД -->
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">${ic("user", 18)}<div class="panel-title">Ответственный за обработку ПДн</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div><div class="form-label">ФИО ответственного</div><input class="form-input" id="pd-resp-name-${id}" value="${c.pd_responsible_name||''}" placeholder="Иванова Мария Ивановна"></div>
          <div><div class="form-label">Должность</div><input class="form-input" id="pd-resp-pos-${id}" value="${c.pd_responsible_position||''}" placeholder="Юрист / Специалист по комплаенсу"></div>
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;margin-top:12px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap"><input type="checkbox" id="pd-rkn-${id}" ${c.pd_notified_rkn ? 'checked' : ''} style="width:15px;height:15px;cursor:pointer"><span style="font-size:13px;color:var(--text);font-weight:500">РКН уведомлена</span></label>
          <div><div class="form-label" style="margin-bottom:4px">Дата уведомления</div><input type="date" class="form-input" id="pd-rkn-date-${id}" value="${c.pd_notification_date||''}" style="max-width:180px"></div>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn btn-primary" onclick="savePdData(${id})">${ic("save",14)} Сохранить</button></div>
      </div>

      <!-- ИСПДн -->
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">${ic("monitor", 18)}<div class="panel-title">Информационные системы ПД (ИСПДн)</div><div class="panel-action" onclick="addIspdnItem(${id})">+ Добавить</div></div>
        <div id="ispdn-list-${id}" style="margin-top:8px">
          ${(c.pd_ispdn_list||[]).length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Ещё нет ни одной ИСПДн.<br><span style="font-size:11px">Пример: 1С:Бухгалтерия, Кадровая система, CRM</span></div>`
            : (c.pd_ispdn_list||[]).map((item,idx) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.02);border-left:3px solid var(--blue);border-radius:6px;margin-bottom:6px">
                <div><div style="font-size:13px;font-weight:600;color:var(--text)">${item.name}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Добавлена: ${item.added||'—'}</div></div>
                <button class="btn btn-ghost" style="padding:4px 8px;font-size:11px" onclick="removeIspdnItem(${id},${idx})">✕</button>
              </div>`).join('')
          }
        </div>
      </div>

      <!-- СОУТ по подразделениям — для ЕФС-1 -->
      ${divisions.length ? `
      <div class="panel" style="margin-top:12px">
        <div class="panel-head">${ic("bar-chart", 18)}<div class="panel-title">СОУТ по подразделениям — для ЕФС-1</div></div>
        <div style="margin-top:8px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:rgba(255,255,255,0.03)">
              <th style="padding:8px 10px;text-align:left;color:var(--muted2);font-weight:600;border-bottom:1px solid var(--border)">Подразделение</th>
              <th style="padding:8px 10px;text-align:center;color:var(--muted2);font-weight:600;border-bottom:1px solid var(--border)">Класс СОУТ</th>
              <th style="padding:8px 10px;text-align:center;color:var(--muted2);font-weight:600;border-bottom:1px solid var(--border)">Сотрудников</th>
              <th style="padding:8px 10px;text-align:center;color:var(--muted2);font-weight:600;border-bottom:1px solid var(--border)">Медосмотр</th>
            </tr></thead>
            <tbody>
              ${divisions.map(div => {
                const wt = typeof DIVISION_WORK_TYPES !== 'undefined' ? (DIVISION_WORK_TYPES[div.work_type] || DIVISION_WORK_TYPES.standard) : { icon:'🏢', soatDefault:2, medcheck:false, medcheck_714:false };
                const empCount = emps.filter(e => e.division_id === div.id).length;
                const soat = div.soat_class || wt.soatDefault;
                const soatColor = soat >= 4 ? '#f87171' : soat >= 3 ? '#fbbf24' : '#34d399';
                const medLabel = wt.medcheck_714 ? '29н + 714н' : wt.medcheck ? '29н' : '—';
                return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                  <td style="padding:10px;color:var(--text)">${wt.icon} ${div.name}</td>
                  <td style="padding:10px;text-align:center;font-weight:700;color:${soatColor}">${soat}</td>
                  <td style="padding:10px;text-align:center;color:var(--muted2)">${empCount}</td>
                  <td style="padding:10px;text-align:center;color:${wt.medcheck?'#f87171':'var(--muted2)'}"><span style="font-size:11px">${medLabel}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

    <div class="tab-panel" id="tab-vu"><div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted2);font-size:13px">Загрузка...</div></div>

    <div class="tab-panel" id="tab-divisions">
      <div class="panel">
        <div class="panel-head"><span>🏢</span><div class="panel-title">Подразделения</div><div class="panel-count">${divisions.length} подр.</div><div class="panel-action" onclick="openDivisionModal(${id})">+ Добавить</div></div>
        ${divisions.length ? divisions.map(div => {
          const wt = typeof DIVISION_WORK_TYPES !== 'undefined' ? (DIVISION_WORK_TYPES[div.work_type] || DIVISION_WORK_TYPES.standard) : { icon:'🏢', label:'Стандартное', soatDefault:2, medcheck:false, psycho:false, siz:false };
          const empCount = emps.filter(e => e.division_id === div.id).length;
          return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;margin-bottom:6px">
            <div style="font-size:20px;flex-shrink:0">${wt.icon}</div>
            <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text)">${div.name}</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">${wt.label} · СОУТ класс ${div.soat_class || wt.soatDefault} · ${empCount} сотр.</div></div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button onclick="openDivisionModal(${id}, ${div.id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px">✏️</button>
              <button onclick="deleteDivision(${div.id}, ${id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px">🗑</button>
            </div>
          </div>`;
        }).join('') : '<div class="empty-state"><div class="empty-icon">🏢</div><div class="empty-title">Подразделений нет</div><div class="empty-sub">Добавьте подразделения если в организации разные условия труда</div></div>'}
      </div>
    </div>

    <div class="tab-panel" id="tab-staff">
      <div class="panel">
        <div class="panel-head"><span>👥</span><div class="panel-title">Сотрудники</div><div class="panel-count">${emps.length} чел.</div><div class="panel-action" onclick="addEmployeePrompt(${id})">+ Добавить</div></div>
        <div>${emps.length ? emps.map(e=>renderEmpRow(e, divisions)).join('') : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Сотрудников нет</div><div class="empty-sub">Добавьте сотрудников для учёта обучений</div></div>'}</div>
      </div>
    </div>

    <div class="tab-panel" id="tab-reporting"><div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted2);font-size:13px">Загрузка...</div></div>
  `;
}
function toggleScoreBreakdown() {
  const el = document.getElementById('score-breakdown');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}