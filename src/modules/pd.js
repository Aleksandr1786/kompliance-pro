// ============================================================
// КОМПЛАЕНСПРО — pd.js
// ПДн (152-ФЗ): справочник, ИСПДн, центр готовности ПДн, симулятор РКН, отчёт
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================


function renderPd() {
  const content = document.getElementById('content');

  const npa = [
    { title: 'Федеральный закон №152-ФЗ', date: '27.07.2006', desc: 'Об обработке персональных данных — основной закон', url: 'http://www.consultant.ru/document/cons_doc_LAW_61801/' },
    { title: 'Приказ Роскомнадзора №178', date: '28.10.2022', desc: 'Форма уведомления об обработке ПД', url: 'http://rkn.gov.ru' },
    { title: 'Постановление Правительства №1119', date: '01.11.2012', desc: 'Требования к защите ПД в информационных системах', url: 'http://www.consultant.ru/document/cons_doc_LAW_137356/' },
    { title: 'ГОСТ Р 57580.1-2017', date: '01.01.2018', desc: 'Безопасность финансовых операций. Защита информации', url: 'http://protect.gost.ru' },
  ];

  const calendar = [
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.18 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`, title: 'Уведомить Роскомнадзор об ИСПДн', period: 'При создании/изменении системы', deadline: 'в течение 30 дней', color: '#f87171' },
    { icon: ic('file-text',20), title: 'Актуализировать Политику обработки ПД', period: 'Ежегодно', deadline: '31 декабря', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`, title: 'Переподписать согласия сотрудников', period: 'При изменении условий обработки', deadline: 'в течение 30 дней', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`, title: 'Провести внутренний аудит ИСПДн', period: 'Ежегодно', deadline: 'по плану организации', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`, title: 'Обучить ответственного за ПД', period: 'Ежегодно', deadline: '31 декабря', color: '#60a5fa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, title: 'Проверить сроки хранения ПД', period: 'Ежегодно', deadline: 'по плану организации', color: '#fbbf24' },
  ];

  const processes = [
    {
      title: 'Согласие на обработку персональных данных',
      steps: [
        'Указать полные реквизиты организации (оператор)',
        'Перечислить конкретные данные: ФИО, паспорт, телефон, email',
        'Указать цель: кадровый учёт, расчёт зарплаты, отчётность',
        'Способ обработки: ручная, автоматизированная',
        'Срок хранения: в течение срока действия трудового договора',
        'Подписать сотрудником лично, хранить в личном деле',
      ]
    },
    {
      title: 'Уведомление Роскомнадзора об ИСПДн',
      steps: [
        'Войти в личный кабинет на rkn.gov.ru',
        'Раздел "Реестр операторов" → Подать уведомление',
        'Заполнить: название организации, ИНН, руководитель, адрес',
        'Описать ИСПДн: название системы, какие ПД обрабатываются',
        'Указать категории: общедоступные, специальные, биометрические',
        'Отправить, сохранить номер регистрации',
      ]
    },
    {
      title: 'Политика обработки персональных данных',
      steps: [
        'Реквизиты организации и ФИО ответственного за ПД',
        'Перечень категорий ПД: ФИО, паспорт, СНИЛС, ИНН, телефон',
        'Источники получения: сотрудники, клиенты, контрагенты',
        'Цели обработки и правовые основания',
        'Сроки хранения по каждой категории',
        'Права субъектов ПД: доступ, исправление, удаление',
        'Опубликовать на сайте или вывесить в офисе',
      ]
    },
  ];

  const checklist = [
    'Получены письменные согласия от всех сотрудников',
    'Составлена и утверждена Политика обработки ПД',
    'Назначен ответственный за ПД (есть приказ)',
    'РКН уведомлена об ИСПДн',
    'Проведено обучение ответственного',
    'Проведён внутренний аудит ИСПДн',
    'Ведётся журнал учёта обращений субъектов ПД',
    'Разработан регламент обработки ПД',
    'Определены и задокументированы меры защиты',
    'Установлены и соблюдаются сроки хранения ПД',
  ];

  content.innerHTML = `
    <div style="display:grid;gap:16px;max-width:960px">

      <!-- Баннер -->
      <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:20px 24px;background:linear-gradient(135deg,rgba(96,165,250,0.1),rgba(167,139,250,0.08));border:1px solid rgba(96,165,250,0.2);border-radius:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(59,130,246,0.35)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Персональные данные (152-ФЗ)</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Обязателен для всех операторов ПД · ФЗ №152, ст.18.1 · Роскомнадзор</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:280px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Нарушение обработки ПД</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#fbbf24;white-space:nowrap">до 300 000 ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Утечка данных</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#f87171;white-space:nowrap">от 3 до 15 млн ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Повторно / массовая утечка</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#ef4444;white-space:nowrap">до 500 млн ₽</span>
          </div>
        </div>
      </div>

      <!-- НПА -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          ${ic("clipboard-list", 16)} Нормативная база
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${npa.map(n => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;gap:10px">
              <div style="min-width:0">
                <div style="font-weight:600;color:#60a5fa;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.title}</div>
                <div style="font-size:10px;color:#475569;margin-top:3px">${n.date} · ${n.desc}</div>
              </div>
              <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;flex-shrink:0" onclick="openUrl(this.getAttribute('data-url'))" data-url="${n.url}">🔗</button>
            </div>`).join('')}
        </div>
      </div>

      <!-- КАЛЕНДАРЬ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Обязательные мероприятия
        </div>
        <div style="display:grid;gap:7px">
          ${calendar.map(c => `
            <div style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:11px 14px;background:rgba(255,255,255,0.02);border-left:3px solid ${c.color};border-radius:6px">
              <span style="display:flex;align-items:center;justify-content:center;color:${c.color};flex-shrink:0">${c.icon}</span>
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--text)">${c.title}</div>
                <div style="font-size:10px;color:#475569;margin-top:2px">${c.period}</div>
              </div>
              <div style="font-size:11px;font-weight:700;color:#fff;background:${c.color};padding:3px 10px;border-radius:6px;white-space:nowrap">${c.deadline}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ПРОЦЕССЫ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          Типовые процессы
        </div>
        <div style="display:grid;gap:8px">
          ${processes.map(p => `
            <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
              <summary style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:rgba(96,165,250,0.06);cursor:pointer;font-weight:600;color:#60a5fa;font-size:13px;list-style:none"
                onmouseover="this.style.background='rgba(96,165,250,0.1)'" onmouseout="this.style.background='rgba(96,165,250,0.06)'">
                ${p.title}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </summary>
              <div style="padding:14px 16px;background:rgba(255,255,255,0.01)">
                <ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px">
                  ${p.steps.map(s => `<li style="font-size:12px;color:#94a3b8;line-height:1.5">${s}</li>`).join('')}
                </ol>
              </div>
            </details>`).join('')}
        </div>
      </div>

      <!-- ЧЕК-ЛИСТ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Чек-лист готовности к 152-ФЗ
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
          ${checklist.map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:12px;color:#64748b">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
              ${item}
            </div>`).join('')}
        </div>
      </div>

      <div style="font-size:10px;color:#334155;padding:10px 14px;background:rgba(255,255,255,0.01);border-radius:8px;line-height:1.7">
        ФЗ №152 от 27.07.2006 · Приказ Роскомнадзора №178 от 28.10.2022 · Постановление Правительства №1119 от 01.11.2012 · Актуально на 2026 год
      </div>

    </div>`;
}

async function savePdData(clientId) {
  const name  = document.getElementById(`pd-resp-name-${clientId}`)?.value?.trim() || '';
  const pos   = document.getElementById(`pd-resp-pos-${clientId}`)?.value?.trim() || '';
  const rkn   = document.getElementById(`pd-rkn-${clientId}`)?.checked ? 1 : 0;
  const rknDate = document.getElementById(`pd-rkn-date-${clientId}`)?.value || '';

  await window.api.clientUpdate(clientId, {
    pd_responsible_name:     name,
    pd_responsible_position: pos,
    pd_notified_rkn:         rkn,
    pd_notification_date:    rknDate,
  });
  showToast('ПДн-данные сохранены ✓', 'var(--green)');
  await navigate('client', clientId);
}

// ── ПДн: добавить ИСПДн ──────────────────────────────────
async function addIspdnItem(clientId) {
  // Создаём модальное окно вместо prompt
  let modal = document.getElementById('ispdn-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'ispdn-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999';
  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;width:400px">
      <div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Добавить ИСПДн</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:14px">Примеры: 1С:Бухгалтерия, Кадровая система, CRM, Почта</div>
      <input id="ispdn-name-input" type="text" placeholder="Название информационной системы" style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:16px" onkeydown="if(event.key==='Enter')document.getElementById('ispdn-submit').click()">
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('ispdn-modal').remove()">Отмена</button>
        <button id="ispdn-submit" class="btn btn-primary" onclick="submitIspdn(${clientId})">Добавить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('ispdn-name-input')?.focus(), 100);
}

async function submitIspdn(clientId) {
  const input = document.getElementById('ispdn-name-input');
  const name = input?.value?.trim();
  if (!name) return;
  const client = await window.api.clientGet(clientId);
  const list = client.pd_ispdn_list || [];
  const today = new Date().toLocaleDateString('ru-RU');
  list.push({ name, added: today });
  await window.api.clientUpdate(clientId, { pd_ispdn_list: list });
  document.getElementById('ispdn-modal')?.remove();
  showToast('ИСПДн добавлена ✓', 'var(--green)');
  await navigate('client', clientId);
}

// ── ПДн: удалить ИСПДн ───────────────────────────────────
async function removeIspdnItem(clientId, idx) {
  const client = await window.api.clientGet(clientId);
  const list = client.pd_ispdn_list || [];
  const item = list[idx];
  if (!item) return;
  if (!confirm(`Удалить "${item.name}"?`)) return;
  list.splice(idx, 1);
  await window.api.clientUpdate(clientId, { pd_ispdn_list: list });
  showToast('ИСПДн удалена', 'var(--amber)');
  await navigate('client', clientId);
}

// ── Генерация документов ПДн ─────────────────────────────
async function generatePdDocs(clientId) {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Генерация...'; }
  try {
    const result = await window.api.docsGenerate(clientId);
    if (!result.ok) {
      showToast('Ошибка: ' + (result.error || 'неизвестная'), 'var(--red)');
      return;
    }
    const r = result.report || {};
    const pdGenerated = [...new Set(result.generated.filter(f => f.replace(/\\/g,'/').includes('Персональные данные')))];
    const userMod = (r.userModified || []);
    let msg = `✅ ПДн: ${pdGenerated.length} документов`;
    if (userMod.length > 0) msg += ` · ${userMod.length} с правками сохранены`;
    showToast(msg, 'var(--green)');
    await navigate('client', clientId);
  } catch(e) {
    showToast('Ошибка генерации: ' + e.message, 'var(--red)');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '${ic("zap",14)} Сформировать пакет'; }
  }
}

// ═══════════════════════════════════════════════════════════


// Главная функция ПДн-центра готовности
async function renderPdReadiness(clientId) {
  const c = await window.api.clientGet(clientId);
  const docs = (await window.api.documentsList(clientId)).filter(d => d.module === 'PD');
  const emps = await window.api.employeesList(clientId);
  const now = new Date();

  // Score ПДн
  const pdResp = c.pd_responsible_name || '';
  const pdRkn  = c.pd_notified_rkn;
  const pdDate = c.pd_notification_date ? new Date(c.pd_notification_date) : null;
  const ispdn  = (c.pd_ispdn_list || []).length;

  let score = 0;
  if (docs.length > 0) score += 35;
  if (pdRkn) score += 25;
  if (pdResp) score += 25;
  if (ispdn > 0) score += 15;

  const scoreColor = score >= 80 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--red)';

  // Риски ПДн
  const risks = [];
  if (!pdRkn) risks.push({ level:'high', title:'РКН не уведомлена об ИСПДн', law:'ст. 22 ФЗ-152', fine:'до 5 000 ₽ / день', fix:'Подать уведомление на rkn.gov.ru' });
  if (!pdResp) risks.push({ level:'high', title:'Не назначен ответственный за ПДн', law:'ч.1 ст.18.1 ФЗ-152', fine:'до 100 000 ₽', fix:'Назначить приказом во вкладке ПДн' });
  if (docs.length === 0) risks.push({ level:'high', title:'Отсутствует пакет документов ПДн', law:'ст. 18.1 ФЗ-152', fine:'до 300 000 ₽', fix:'Сформировать документы во вкладке ПДн' });
  if (ispdn === 0) risks.push({ level:'medium', title:'Не указаны ИСПДн', law:'ст. 22 ФЗ-152', fine:'до 100 000 ₽', fix:'Добавить ИСПДн во вкладке ПДн' });
  if (pdDate) {
    const daysSince = Math.floor((now - pdDate) / 86400000);
    if (daysSince > 365) risks.push({ level:'medium', title:'Давно не проводилась актуализация Политики ПДн', law:'ст. 18.1 ФЗ-152', fine:'предписание', fix:'Обновить Политику (повторная генерация)' });
  }
  const noConsent = emps.filter(e => !e.pd_consent_given).length;
  if (emps.length > 0 && noConsent > 0) risks.push({ level:'medium', title:`Не подписаны согласия: ${noConsent} сотр.`, law:'ст. 9 ФЗ-152', fine:'до 75 000 ₽', fix:'Подписать согласия и хранить в личных делах' });

  const probability = risks.length === 0 ? 5 : Math.min(95, risks.filter(r=>r.level==='high').length * 25 + risks.filter(r=>r.level==='medium').length * 10 + 5);
  let riskLabel = probability >= 70 ? 'ВЫСОКИЙ' : probability >= 40 ? 'СРЕДНИЙ' : 'НИЗКИЙ';
  let riskColor = probability >= 70 ? '#f87171' : probability >= 40 ? '#fbbf24' : '#34d399';

  // Живая лента изменений 152-ФЗ
  const newsItems = [
    { date:'01.09.2024', tag:'ВАЖНО', color:'#f87171', text:'Оборотные штрафы за утечку ПДн — до 3% выручки. Повторное нарушение — до 18 млн ₽ (ст.13.11 КоАП).' },
    { date:'01.03.2023', tag:'ТРЕБУЕТ ДЕЙСТВИЙ', color:'#fbbf24', text:'Обязательное уведомление РКН в течение 24 часов при утечке ПДн. Журнал инцидентов теперь обязателен.' },
    { date:'01.09.2022', tag:'ИЗМЕНЕНИЕ', color:'#60a5fa', text:'ФЗ-266: уведомление РКН теперь до начала обработки ПДн (раньше было в течение 30 дней). Форма уведомления обновлена.' },
    { date:'2026', tag:'ОЖИДАЕТСЯ', color:'#a78bfa', text:'Законопроект об ужесточении ответственности должностных лиц за нарушение 152-ФЗ. Штрафы для руководителей до 500 000 ₽.' },
  ];

  // Календарь совести
  const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  const duties = [
    { month:11, label:'Актуализация Политики ПДн', done: pdDate && new Date(pdDate).getFullYear() >= now.getFullYear() },
    { month:11, label:'Обучение ответственного', done: false },
    { month:now.getMonth(), label:'Проверка сроков хранения ПДн', done: false },
    { month:2, label:'Внутренний аудит ИСПДн', done: docs.length > 0 },
    { month:5, label:'Актуализация согласий', done: noConsent === 0 },
    { month:8, label:'Проверка антивирусной защиты', done: false },
  ];

  const el = document.getElementById('rc-mode-content');
  if (!el) return;

  el.innerHTML = `
    <div style="display:grid;gap:16px">

      <!-- СИМУЛЯТОР ПРОВЕРКИ РКН -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${ic('shield',22)}
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Что будет, если завтра придёт Роскомнадзор?</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Симуляция проверки инспектора РКН по вашим реальным данным</div>
          </div>
          <button onclick="runRknSimulator(${clientId})" id="rknSimBtn" style="padding:11px 22px;background:linear-gradient(90deg,#ef4444,#dc2626);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ▶ Запустить проверку
          </button>
        </div>
        <div id="rkn-sim-result" style="margin-top:16px"></div>
      </div>

      <!-- ИНДЕКС РИСКА + ПИСЬМО ОТ РКН -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- Спидометр -->
        <div class="rc-card panel">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${ic('target',18)}
            </div>
            <div>
              <div style="font-size:14px;font-weight:700;color:#f1f5f9">Индекс риска РКН</div>
              <div style="font-size:11px;color:#94a3b8">Вероятность нарушений при проверке</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0">
            <svg width="220" height="130" viewBox="0 0 220 130">
              <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="18" stroke-linecap="round"/>
              <path d="M 20 110 A 90 90 0 0 1 75 27" fill="none" stroke="#34d399" stroke-width="18" stroke-linecap="round" opacity=".35"/>
              <path d="M 75 27 A 90 90 0 0 1 145 27" fill="none" stroke="#fbbf24" stroke-width="18" stroke-linecap="round" opacity=".35"/>
              <path d="M 145 27 A 90 90 0 0 1 200 110" fill="none" stroke="#f87171" stroke-width="18" stroke-linecap="round" opacity=".35"/>
              ${(() => {
                const pct = probability/100;
                const angle = -180+pct*180;
                const rad = angle*Math.PI/180;
                const x = 110+90*Math.cos(rad), y = 110+90*Math.sin(rad);
                const la = pct>0.5?1:0;
                return `<path d="M 20 110 A 90 90 0 ${la} 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${riskColor}" stroke-width="18" stroke-linecap="round"/>
                <line x1="110" y1="110" x2="${(110+72*Math.cos(rad)).toFixed(1)}" y2="${(110+72*Math.sin(rad)).toFixed(1)}" stroke="${riskColor}" stroke-width="3" stroke-linecap="round"/>
                <circle cx="110" cy="110" r="6" fill="${riskColor}"/>`;
              })()}
              <text x="14" y="126" fill="#475569" font-size="10" text-anchor="middle">0%</text>
              <text x="110" y="18" fill="#475569" font-size="10" text-anchor="middle">50%</text>
              <text x="206" y="126" fill="#475569" font-size="10" text-anchor="middle">100%</text>
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

        <!-- Письмо от РКН -->
        <div class="rc-card panel">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${ic('file-text',18)}
            </div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700;color:#f1f5f9">Письмо от РКН</div>
              <div style="font-size:11px;color:#94a3b8">Как выглядело бы предписание сегодня</div>
            </div>
            <button onclick="toggleRknLetter()" style="padding:5px 10px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);border-radius:6px;color:#a78bfa;font-size:11px;cursor:pointer">Показать</button>
          </div>
          <div id="rkn-letter" style="display:none">
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px;font-size:11px;line-height:1.7;color:#cbd5e1">
              <div style="font-weight:700;color:#f1f5f9;margin-bottom:8px;font-size:12px">ФЕДЕРАЛЬНАЯ СЛУЖБА ПО НАДЗОРУ В СФЕРЕ СВЯЗИ,<br>ИНФОРМАЦИОННЫХ ТЕХНОЛОГИЙ И МАССОВЫХ КОММУНИКАЦИЙ</div>
              <div style="color:#94a3b8;margin-bottom:10px">Исх. № РКН-${Math.floor(Math.random()*90000+10000)}-ПД от ${new Date().toLocaleDateString('ru-RU')}</div>
              <div style="font-weight:600;margin-bottom:8px">${c.name}</div>
              <div style="margin-bottom:10px">По результатам проверки соблюдения требований Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» выявлены следующие нарушения:</div>
              ${risks.length === 0
                ? '<div style="color:#34d399">✓ Нарушений не выявлено. Оператор соответствует требованиям 152-ФЗ.</div>'
                : risks.map((r,i) => `<div style="margin-bottom:6px;padding:8px;background:rgba(248,113,113,0.06);border-left:2px solid ${r.level==='high'?'#f87171':'#fbbf24'};border-radius:4px">
                  <span style="font-weight:600">${i+1}. ${r.title}</span><br>
                  <span style="color:#94a3b8">${r.law} · Штраф: ${r.fine}</span>
                </div>`).join('')}
              ${risks.length > 0 ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);color:#94a3b8">Срок устранения нарушений: <strong style="color:#fbbf24">30 календарных дней</strong> с даты получения предписания.</div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- ЖИВАЯ ЛЕНТА ИЗМЕНЕНИЙ 152-ФЗ -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${ic('bar-chart',18)}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Живая лента изменений 152-ФЗ</div>
            <div style="font-size:11px;color:#94a3b8">Последние изменения на человеческом языке</div>
          </div>
        </div>
        <div style="display:grid;gap:8px">
          ${newsItems.map(n => `
            <div style="display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:start;padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
              <span style="font-size:11px;color:#64748b;white-space:nowrap">${n.date}</span>
              <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${n.color}22;color:${n.color};font-weight:700;white-space:nowrap">${n.tag}</span>
              <span style="font-size:12px;color:#cbd5e1;line-height:1.5">${n.text}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- КАЛЕНДАРЬ СОВЕСТИ -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${ic('calendar',18)}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Календарь совести</div>
            <div style="font-size:11px;color:#94a3b8">Что было должно быть сделано по ПДн в ${now.getFullYear()} году</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px;margin-bottom:16px">
          ${months.map((m,i) => {
            const monthDuties = duties.filter(d => d.month === i);
            const hasDuty = monthDuties.length > 0;
            const isDone = monthDuties.every(d => d.done);
            const isPast = i <= now.getMonth();
            let bg = 'rgba(255,255,255,0.03)', color = '#475569';
            if (hasDuty && isPast) { bg = isDone ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'; color = isDone ? '#34d399' : '#f87171'; }
            if (hasDuty && !isPast) { bg = 'rgba(251,191,36,0.12)'; color = '#fbbf24'; }
            return `<div style="padding:6px 4px;background:${bg};border-radius:6px;text-align:center;font-size:10px;font-weight:600;color:${color};position:relative" title="${monthDuties.map(d=>d.label).join(', ') || m}">${m}${hasDuty?`<div style="position:absolute;top:2px;right:2px;width:5px;height:5px;border-radius:50%;background:${color}"></div>`:''}
            </div>`;
          }).join('')}
        </div>
        <div style="display:grid;gap:6px">
          ${duties.sort((a,b)=>a.month-b.month).map(d => {
            const isPast = d.month <= now.getMonth();
            const statusColor = d.done ? '#34d399' : isPast ? '#f87171' : '#fbbf24';
            const statusText = d.done ? '✓ Выполнено' : isPast ? '✗ Просрочено' : '○ Предстоит';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,0.02);border-radius:6px;border-left:3px solid ${statusColor}">
              <div>
                <span style="font-size:12px;color:#e2e8f0">${d.label}</span>
                <span style="font-size:10px;color:#64748b;margin-left:8px">${months[d.month]}</span>
              </div>
              <span style="font-size:11px;font-weight:600;color:${statusColor}">${statusText}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- ОТЧЁТ О СОСТОЯНИИ ПДн (WORD) -->
      <div class="rc-card panel" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${ic('file-text',22)}
          </div>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:700;color:#f1f5f9">Отчёт о состоянии персональных данных</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Документ для руководителя — готовность к 152-ФЗ, риски, рекомендации</div>
          </div>
          <button onclick="generatePdReport(${clientId})" id="pdReportBtn" style="padding:10px 18px;background:linear-gradient(90deg,#059669,#34d399);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ${ic('save',14)} Сохранить Word
          </button>
        </div>
      </div>

    </div>
  `;

  window._rcPdData = { c, docs, emps, risks, score, probability, riskLabel, riskColor };
}

// Переключатель письма РКН
function toggleRknLetter() {
  const el = document.getElementById('rkn-letter');
  if (!el) return;
  const btn = el.previousElementSibling.querySelector('button');
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (btn) btn.textContent = 'Скрыть';
  } else {
    el.style.display = 'none';
    if (btn) btn.textContent = 'Показать';
  }
}



// Анимированный симулятор проверки РКН с бегунком
async function runRknSimulator(clientId) {
  const c = window._rcPdData?.c || await window.api.clientGet(clientId);
  const docs = window._rcPdData?.docs || (await window.api.documentsList(clientId)).filter(d => d.module === 'PD');
  const emps = window._rcPdData?.emps || await window.api.employeesList(clientId);
  const risks = window._rcPdData?.risks || [];

  const btn = document.getElementById('rknSimBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = '⏳ Идёт проверка...'; }

  const result = document.getElementById('rkn-sim-result');
  if (!result) return;

  // Контейнер для анимации
  result.innerHTML = `
    <div id="rkn-step-box" style="min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.06)">
      <div id="rkn-step-icon" style="font-size:32px;margin-bottom:12px;transition:opacity .4s">🏛️</div>
      <div id="rkn-step-text" style="font-size:14px;font-weight:600;color:#f1f5f9;text-align:center;margin-bottom:16px;transition:opacity .4s;min-height:20px"></div>
      <div style="width:100%;max-width:340px">
        <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden">
          <div id="rkn-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa);border-radius:2px;transition:width 2.8s linear"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          <div id="rkn-progress-label" style="font-size:10px;color:#475569"></div>
          <div id="rkn-step-status" style="font-size:11px;font-weight:600"></div>
        </div>
      </div>
    </div>
    <div id="rkn-log" style="margin-top:12px;display:flex;flex-direction:column;gap:4px"></div>
  `;

  const iconEl   = document.getElementById('rkn-step-icon');
  const textEl   = document.getElementById('rkn-step-text');
  const barEl    = document.getElementById('rkn-progress-bar');
  const labelEl  = document.getElementById('rkn-progress-label');
  const statusEl = document.getElementById('rkn-step-status');
  const logEl    = document.getElementById('rkn-log');

  const steps = [
    { icon:'🏛️', text:'Инспектор РКН входит в организацию...', duration:3000, status:null },
    { icon:'📋', text:'Запрашиваю реестр операторов ПДн...', duration:3000,
      status: c.pd_notified_rkn ? 'ok' : 'error',
      result: c.pd_notified_rkn
        ? `✅ ${c.name} найдена в реестре · дата: ${c.pd_notification_date||'не указана'}`
        : `❌ ${c.name} не найдена в реестре операторов!` },
    { icon:'📄', text:'Запрашиваю документацию по ПДн...', duration:3000,
      status: docs.find(d=>d.name.includes('Политика')) ? 'ok' : 'error',
      result: docs.find(d=>d.name.includes('Политика'))
        ? `✅ Политика обработки ПДн — обнаружена (${docs.length} документов)`
        : `❌ Политика обработки ПДн — отсутствует` },
    { icon:'👤', text:'Проверяю назначение ответственного...', duration:3000,
      status: c.pd_responsible_name ? 'ok' : 'error',
      result: c.pd_responsible_name
        ? `✅ Ответственный: ${c.pd_responsible_name} — назначен`
        : `❌ Ответственный за ПДн — не назначен` },
    { icon:'🖥️', text:'Проверяю регистрацию ИСПДн...', duration:3000,
      status: (c.pd_ispdn_list||[]).length>0 ? 'ok' : 'warn',
      result: (c.pd_ispdn_list||[]).length>0
        ? `✅ ИСПДн: ${(c.pd_ispdn_list||[]).map(i=>i.name||i).join(', ')}`
        : `⚠️ Информационные системы ПД не указаны` },
    { icon:'✍️', text:'Проверяю согласия сотрудников...', duration:3000,
      status: emps.length===0 ? 'warn' : 'ok',
      result: emps.length===0
        ? `⚠️ Сотрудники не добавлены в систему`
        : `✅ Сотрудников: ${emps.length} чел.` },
    { icon:'📝', text:'Составляю протокол проверки...', duration:3000, status:null },
  ];

  const statusColors = { ok:'#34d399', error:'#f87171', warn:'#fbbf24' };
  const statusLabels = { ok:'✓ OK', error:'✗ Нарушение', warn:'⚠ Замечание' };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fadeOut = el => { el.style.opacity='0'; return sleep(400); };
  const fadeIn  = el => { el.style.opacity='0'; void el.offsetWidth; setTimeout(()=>el.style.opacity='1',50); };

  for (let i=0; i<steps.length; i++) {
    const step = steps[i];

    // Fade in нового текста
    await fadeOut(iconEl);
    await fadeOut(textEl);
    iconEl.style.transition = 'opacity .4s';
    textEl.style.transition = 'opacity .4s';
    iconEl.textContent = step.icon;
    textEl.textContent = step.text;
    statusEl.textContent = '';
    labelEl.textContent = `Шаг ${i+1} из ${steps.length}`;
    fadeIn(iconEl);
    fadeIn(textEl);

    // Бегунок
    barEl.style.transition = 'none';
    barEl.style.width = '0%';
    void barEl.offsetWidth;
    barEl.style.transition = `width ${step.duration - 200}ms linear`;
    await sleep(50);
    barEl.style.width = '95%';

    await sleep(step.duration - 400);

    // Бегунок завершается
    barEl.style.transition = 'width .3s ease';
    barEl.style.width = '100%';
    if (step.status) {
      barEl.style.background = `linear-gradient(90deg,${statusColors[step.status]}99,${statusColors[step.status]})`;
      statusEl.style.color = statusColors[step.status];
      statusEl.textContent = statusLabels[step.status];
    }
    await sleep(400);

    // Добавляем строку в лог если есть результат
    if (step.result) {
      const logLine = document.createElement('div');
      logLine.style.cssText = `padding:7px 12px;border-radius:8px;font-size:12px;color:${step.status?statusColors[step.status]:'#94a3b8'};background:rgba(255,255,255,0.02);border-left:3px solid ${step.status?statusColors[step.status]:'rgba(255,255,255,0.1)'};opacity:0;transition:opacity .3s`;
      logLine.textContent = step.result;
      logEl.appendChild(logLine);
      void logLine.offsetWidth;
      logLine.style.opacity = '1';
    }

    // Сброс цвета бегунка для следующего шага
    barEl.style.background = 'linear-gradient(90deg,#60a5fa,#a78bfa)';
    await sleep(200);
  }

  // Финальный fade out анимации
  await fadeOut(iconEl);
  await fadeOut(textEl);
  document.getElementById('rkn-step-box').style.display = 'none';

  // Протокол
  await sleep(300);
  const errorCount = risks.filter(r=>r.level==='high').length;
  const warnCount  = risks.filter(r=>r.level==='medium').length;

  const protocol = document.createElement('div');
  protocol.style.cssText = 'margin-top:16px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;opacity:0;transition:opacity .5s';
  protocol.innerHTML = `
    <div style="padding:14px 16px;background:${errorCount>0?'rgba(248,113,113,0.1)':'rgba(52,211,153,0.1)'};border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:14px;font-weight:700;color:#f1f5f9">📋 ПРОТОКОЛ ПРОВЕРКИ РКН</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">${c.name} · ${new Date().toLocaleDateString('ru-RU')} · Автоматическая проверка</div>
    </div>
    <div style="padding:14px 16px">
      ${risks.length === 0
        ? `<div style="color:#34d399;font-size:13px;padding:10px 0">✅ Нарушений не выявлено. Организация соответствует требованиям 152-ФЗ.</div>`
        : risks.map((r,i) => `
          <div style="padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.02);border-left:3px solid ${r.level==='high'?'#f87171':'#fbbf24'};border-radius:6px">
            <div style="font-size:12px;font-weight:600;color:#f1f5f9">${i+1}. ${r.title}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px">${r.law} · Санкция: ${r.fine}</div>
            <div style="font-size:11px;color:#60a5fa;margin-top:2px">→ ${r.fix}</div>
          </div>`).join('')}
      <div style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.02);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12px;color:#94a3b8">Нарушений: <strong style="color:#f87171">${errorCount}</strong> критичных · <strong style="color:#fbbf24">${warnCount}</strong> средних</div>
        ${risks.length>0?`<div style="font-size:12px;font-weight:600;color:#fbbf24">Срок устранения: 30 дней</div>`:''}
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
