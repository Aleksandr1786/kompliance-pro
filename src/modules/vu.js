// ============================================================
// КОМПЛАЕНСПРО — vu.js
// Воинский учёт: справочник, карточка, отчёты, центр готовности ВУ, симулятор военкомата
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================

// ══════════════════════════════════════════════════════════
// МОДУЛЬ: ВОИНСКИЙ УЧЁТ
// ══════════════════════════════════════════════════════════

function renderVu() {
  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';

  const npa = [
    { title: 'Федеральный закон №53-ФЗ', date: '28.03.1998', desc: 'О воинской обязанности и военной службе — основной закон', url: 'http://www.consultant.ru/document/cons_doc_LAW_18260/' },
    { title: 'Постановление Правительства №719', date: '27.11.2006', desc: 'Положение о воинском учёте — порядок ведения учёта', url: 'http://www.consultant.ru/document/cons_doc_LAW_64499/' },
    { title: 'Приказ Министра обороны №700', date: '22.11.2021', desc: 'Инструкция по ведению воинского учёта в организациях', url: 'http://www.consultant.ru/document/cons_doc_LAW_407578/' },
    { title: 'Федеральный закон №31-ФЗ', date: '26.02.1997', desc: 'О мобилизационной подготовке и мобилизации', url: 'http://www.consultant.ru/document/cons_doc_LAW_13454/' },
  ];

  const calendar = [
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`, title: 'Сверка данных с военным комиссариатом', period: 'Ежегодно', deadline: 'до 31 декабря', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.18 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`, title: 'Представление сведений в военкомат', period: 'При приёме/увольнении военнообязанного', deadline: 'в течение 2 недель', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`, title: 'Актуализация карточек воинского учёта', period: 'При изменении данных', deadline: 'в течение 5 дней', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, title: 'Отчёт о численности военнообязанных', period: 'Ежегодно', deadline: 'до 1 ноября', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`, title: 'Оповещение военнообязанных о явке в военкомат', deadline: 'по запросу военкомата', period: 'По требованию', color: '#60a5fa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`, title: 'Хранение документов воинского учёта', period: 'Постоянно', deadline: '75 лет', color: '#34d399' },
  ];

  const checklist = [
    'Назначен ответственный за воинский учёт (есть приказ)',
    'Разработано положение о воинском учёте в организации',
    'Ведётся журнал проверок воинского учёта',
    'Все военнообязанные поставлены на учёт',
    'Личные карточки (форма Т-2) заполнены корректно',
    'Картотека воинского учёта актуализирована',
    'Проведена ежегодная сверка с военкоматом',
    'Военнообязанные уведомлены об обязанностях',
    'Хранение документов организовано по правилам',
    'Отчёт в военкомат представлен в срок',
  ];

  const categories = [
    { icon: '🎖️', title: 'Призывники', desc: 'Мужчины 18–27 лет, не прошедшие военную службу', color: '#f87171' },
    { icon: '⭐', title: 'Военнообязанные запаса', desc: 'Прошедшие службу, офицеры запаса, военнообязанные женщины', color: '#60a5fa' },
    { icon: '🏥', title: 'Ограниченно годные', desc: 'Категория В — состоят на учёте до 50 лет', color: '#fbbf24' },
    { icon: '📌', title: 'Забронированные', desc: 'Работники организаций, имеющие бронь от призыва', color: '#34d399' },
  ];

  const processes = [
    {
      title: 'Постановка работника на воинский учёт',
      steps: [
        'При приёме проверить документы воинского учёта (военный билет или приписное свидетельство)',
        'Сделать отметку в личной карточке Т-2 (раздел II)',
        'В течение 2 недель уведомить военкомат по месту жительства работника',
        'Сверить данные с военкоматом по месту нахождения организации',
        'Внести в картотеку воинского учёта',
      ]
    },
    {
      title: 'Снятие с воинского учёта при увольнении',
      steps: [
        'При увольнении сделать отметку в карточке Т-2',
        'В течение 2 недель уведомить военкомат об увольнении',
        'Изъять карточку из картотеки воинского учёта',
        'Сохранить документы в архиве организации',
      ]
    },
    {
      title: 'Ежегодная сверка с военкоматом',
      steps: [
        'До 31 декабря составить список военнообязанных работников',
        'Сверить данные карточек Т-2 с данными военкомата',
        'Актуализировать информацию о воинских званиях, составах',
        'Подписать акт сверки с военкоматом',
        'Хранить акт сверки не менее 3 лет',
      ]
    },
  ];

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="display:grid;gap:16px;max-width:900px">

      <!-- Заголовок-баннер -->
      <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:20px 24px;background:linear-gradient(135deg,rgba(96,165,250,0.1),rgba(167,139,250,0.1));border:1px solid rgba(96,165,250,0.2);border-radius:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(59,130,246,0.3)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Воинский учёт</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">Обязателен для всех организаций · Постановление Правительства №719 · Приказ МО №700</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:280px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Нарушение порядка ВУ</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#fbbf24;white-space:nowrap">до 500 000 ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Несколько нарушений сразу</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#f87171;white-space:nowrap">штрафы суммируются</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Уклонение от мобилизации</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#ef4444;white-space:nowrap">УК РФ ст. 328</span>
          </div>
        </div>
      </div>

      <!-- Категории военнообязанных -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Категории работников, подлежащих учёту
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${categories.map(cat => `
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px">
              <span style="font-size:22px;flex-shrink:0">${cat.icon}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:${cat.color}">${cat.title}</div>
                <div style="font-size:11px;color:var(--muted2);margin-top:2px;line-height:1.4">${cat.desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- НПА -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          ${ic("clipboard-list", 16)} Нормативная база
        </div>
        <div style="display:grid;gap:8px">
          ${npa.map(n => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px">
              <div>
                <div style="font-weight:600;color:var(--blue);font-size:13px">${n.title}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:3px">${n.date} · ${n.desc}</div>
              </div>
              <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px;flex-shrink:0;margin-left:12px" onclick="openUrl(this.getAttribute('data-url'))" data-url="${n.url}">🔗 Открыть</button>
            </div>`).join('')}
        </div>
      </div>

      <!-- ОБЯЗАТЕЛЬНЫЕ МЕРОПРИЯТИЯ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>📅</span> Обязательные мероприятия
        </div>
        <div style="display:grid;gap:8px">
          ${calendar.map(c => `
            <div style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:12px;background:rgba(255,255,255,0.02);border-left:3px solid ${c.color};border-radius:6px">
              <span style="display:flex;align-items:center;justify-content:center;color:${c.color};flex-shrink:0">${c.icon}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">${c.title}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.period}</div>
              </div>
              <div style="font-size:11px;background:${c.color};color:#fff;padding:3px 8px;border-radius:4px;white-space:nowrap">${c.deadline}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ТИПОВЫЕ ПРОЦЕССЫ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>⚙️</span> Типовые процессы
        </div>
        <div style="display:grid;gap:10px">
          ${processes.map((p, i) => `
            <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
              <div onclick="var b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none'" style="padding:12px 16px;background:rgba(96,165,250,0.08);cursor:pointer;font-weight:600;color:var(--blue);font-size:13px;display:flex;justify-content:space-between;align-items:center">
                ${p.title}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div style="display:none;padding:14px 16px;background:rgba(255,255,255,0.01)">
                <ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px">
                  ${p.steps.map(s => `<li style="font-size:12px;color:#94a3b8;line-height:1.5">${s}</li>`).join('')}
                </ol>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ЧЕК-ЛИСТ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>✅</span> Базовый чек-лист
        </div>
        <div style="display:grid;gap:7px">
          ${checklist.map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:12px;color:#94a3b8">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${item}
            </div>`).join('')}
        </div>
      </div>

    </div>`;
}

// ── ВОИНСКИЙ УЧЁТ В КАРТОЧКЕ КЛИЕНТА ─────────────────────

async function renderClientVu(clientId) {
  const clients = await getClients();
  const client = clients.find(c => c.id === clientId);
  const panel = document.getElementById('tab-vu');
  if (!panel || !client) return;

  const s = await window.api.settingsGet();
  const vuKey = `vu_data_${clientId}`;
  let vuData = {};
  try { vuData = JSON.parse(s[vuKey] || '{}'); } catch(_) {}

  const emps = await window.api.employeesList(clientId);
  const vuEmps = emps.filter(e => e.vu_category);

  // Документы ВУ из реестра приложения (база documents, module='VU')
  const allDocs = await window.api.documentsList(clientId);
  const vuDocs = allDocs.filter(d => d.module === 'VU');
  let vuFolder = '';
  if (vuDocs.length && vuDocs[0].filepath) {
    const fp0 = vuDocs[0].filepath;
    const m = fp0.match(/^(.*[\\/]Воинский учёт)[\\/]/);
    vuFolder = (m ? m[1] : fp0.replace(/[\\/][^\\/]+$/, '')).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  const totalEmps   = emps.length;
  const vuCount     = vuEmps.length;
  const призывники  = vuEmps.filter(e => e.vu_category === 'призывник').length;
  const запасники   = vuEmps.filter(e => e.vu_category === 'запас').length;
  const забронир    = vuEmps.filter(e => e.vu_category === 'бронь').length;

  // Score ВУ
  const checks = [
    !!vuData.responsible_name,
    !!vuData.order_number,
    !!vuData.last_reconciliation,
    vuCount > 0,
    !!vuData.journal_started,
    !!vuData.regulation_done,
  ];
  const vuScore = Math.round(checks.filter(Boolean).length / checks.length * 100);
  const scoreColor = vuScore >= 80 ? '#34d399' : vuScore >= 50 ? '#fbbf24' : '#f87171';

  panel.innerHTML = `
    <div style="max-width:700px;display:grid;gap:14px">

      <!-- Статистика -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${[
          { val: vuCount,    label: 'На учёте',      color: vuCount > 0 ? '#60a5fa' : '#475569' },
          { val: призывники, label: 'Призывники',    color: призывники > 0 ? '#f87171' : '#475569' },
          { val: запасники,  label: 'Запас',          color: запасники > 0 ? '#60a5fa' : '#475569' },
          { val: забронир,   label: 'Бронь',          color: забронир > 0 ? '#34d399' : '#475569' },
        ].map(s => `
          <div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:${s.color}">${s.val}</div>
            <div style="font-size:10px;color:var(--muted2);margin-top:3px">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Готовность ВУ -->
      <div style="padding:16px 20px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">Готовность воинского учёта</div>
          <div style="font-size:20px;font-weight:800;color:${scoreColor}">${vuScore}%</div>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="width:${vuScore}%;height:100%;background:${scoreColor};border-radius:3px;transition:width .5s ease"></div>
        </div>
      </div>

      <!-- Ответственный и реквизиты -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Организация учёта
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Ответственный</div>
            <input class="form-input" id="vu-resp-${clientId}" value="${vuData.responsible_name||''}" placeholder="ФИО ответственного"
              style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(59,130,246,0.6)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
          <div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">№ Приказа о назначении</div>
            <input class="form-input" id="vu-order-${clientId}" value="${vuData.order_number||''}" placeholder="Пр. №12 от 01.01.2024"
              style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(59,130,246,0.6)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
          <div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Последняя сверка с военкоматом</div>
            <input type="date" id="vu-reconcil-${clientId}" value="${vuData.last_reconciliation||''}"
              style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box;cursor:pointer"
              onfocus="this.style.borderColor='rgba(59,130,246,0.6)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
          <div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Военкомат</div>
            <input class="form-input" id="vu-vk-${clientId}" value="${vuData.voenkomat||''}" placeholder="Военкомат Приморского района"
              style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(59,130,246,0.6)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
        </div>

        <!-- Чекбоксы -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
          ${[
            { key:'journal_started',  label:'Журнал проверок заведён' },
            { key:'regulation_done',  label:'Положение о ВУ утверждено' },
            { key:'cards_filled',     label:'Карточки Т-2 заполнены' },
            { key:'notifications_sent',label:'Работники уведомлены' },
          ].map(cb => `
            <label style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;cursor:pointer;font-size:12px;color:#94a3b8;transition:background .15s"
              onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
              <input type="checkbox" id="vu-cb-${cb.key}-${clientId}" ${vuData[cb.key]?'checked':''} style="width:14px;height:14px;accent-color:#60a5fa;cursor:pointer">
              ${cb.label}
            </label>`).join('')}
        </div>

        <button onclick="saveVuData(${clientId})" style="
          margin-top:14px;width:100%;padding:10px;
          background:linear-gradient(135deg,#2563eb,#7c3aed);
          border:none;border-radius:10px;
          color:#fff;font-size:13px;font-weight:600;cursor:pointer;
          box-shadow:0 4px 14px rgba(59,130,246,0.25);transition:all .2s"
          onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
          💾 Сохранить данные ВУ
        </button>
      </div>

      <!-- Дополнительные коды для Формы 18 -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
          Коды для Формы №18
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          ${[
            { key:'ogrn',      label:'ОГРН',  ph:'1202300051755' },
            { key:'okato',     label:'ОКАТО', ph:'03420380000' },
            { key:'okpo',      label:'ОКПО',  ph:'45665033' },
            { key:'okopf',     label:'ОКОПФ', ph:'12300' },
            { key:'okfs',      label:'ОКФС',  ph:'16' },
            { key:'okved_name',label:'ОКВЭД (расшифровка)', ph:'Торговля оптовая...' },
          ].map(f => `<div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:5px">${f.label}</div>
            <input id="vu-code-${f.key}-${clientId}" value="${vuData[f.key]||''}" placeholder="${f.ph}"
              style="width:100%;padding:8px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:11px;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(59,130,246,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>`).join('')}
        </div>
        <div style="margin-top:10px">
          <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:5px">Дата и место регистрации</div>
          <input id="vu-code-reg_date_place-${clientId}" value="${vuData.reg_date_place||''}" placeholder="21.09.2020, Межрайонная ИФНС №16 по Краснодарскому краю"
            style="width:100%;padding:8px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:11px;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='rgba(59,130,246,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:#94a3b8;cursor:pointer">
          <input type="checkbox" id="vu-code-has_bronirowanie-${clientId}" ${vuData.has_bronirowanie?'checked':''} style="width:14px;height:14px;accent-color:#fbbf24;cursor:pointer">
          Организация ведёт бронирование граждан запаса
        </label>
      </div>

      <!-- Кнопки генерации -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">

        <!-- Весь пакет ВУ -->
        <div style="padding:16px 20px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.2);border-radius:12px;display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:13px;font-weight:700;color:#60a5fa">Все документы ВУ</div>
            <div style="font-size:11px;color:var(--muted2);margin-top:2px">10 документов: приказ, обязанности, журналы, уведомления и др.</div>
          </div>
          <button onclick="generateVuDocs(${clientId})" style="
            padding:10px;
            background:linear-gradient(135deg,#2563eb,#7c3aed);
            border:none;border-radius:10px;
            color:#fff;font-size:12px;font-weight:700;cursor:pointer;
            box-shadow:0 4px 14px rgba(59,130,246,0.25);transition:all .2s;
            display:flex;align-items:center;justify-content:center;gap:8px"
            onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Сформировать пакет
          </button>
        </div>

        <!-- Отчётные документы -->
        <div style="padding:16px 20px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.2);border-radius:12px;display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:13px;font-weight:700;color:#34d399">Сдать отчёт</div>
            <div style="font-size:11px;color:var(--muted2);margin-top:2px">Форма №18 (до 15 нояб.) · План ВУ (до 31 дек.)</div>
          </div>
          <button onclick="showVuReportModal(${clientId})" style="
            padding:10px;
            background:linear-gradient(135deg,#059669,#10b981);
            border:none;border-radius:10px;
            color:#fff;font-size:12px;font-weight:700;cursor:pointer;
            box-shadow:0 4px 14px rgba(16,185,129,0.25);transition:all .2s;
            display:flex;align-items:center;justify-content:center;gap:8px"
            onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/><path d="M3 12h8"/></svg>
            Сдать отчёт
          </button>
        </div>

      </div>

      <!-- Документы — Воинский учёт (из реестра) -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <span style="font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Документы — Воинский учёт
            <span style="font-size:11px;color:var(--muted2);font-weight:500">${vuDocs.length} шт.</span>
          </span>
          ${vuFolder ? `<button onclick="window.api.docsOpenFolder('${vuFolder}')" style="padding:6px 12px;font-size:11px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer">📁 Открыть папку</button>` : ''}
        </div>
        ${vuDocs.length ? `
        <div>${renderDocsBySection(vuDocs, 'VU')}</div>` : `<div style="font-size:12px;color:var(--muted2);padding:8px 0">Пока не сформированы — нажмите «Сформировать пакет» выше.</div>`}
      </div>

      <!-- Список военнообязанных сотрудников -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
          <span style="display:flex;align-items:center;gap:8px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Военнообязанные сотрудники
          </span>
          <span style="font-size:11px;color:var(--muted2)">${vuCount} из ${totalEmps}</span>
        </div>
        ${vuEmps.length ? `
        <div style="display:flex;flex-direction:column;gap:6px">
          ${vuEmps.map(e => {
            const catColor = e.vu_category==='призывник'?'#f87171':e.vu_category==='бронь'?'#34d399':'#60a5fa';
            const catLabel = e.vu_category==='призывник'?'Призывник':e.vu_category==='бронь'?'Бронь':'Запас';
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.06);border-radius:8px">
              <div style="width:28px;height:28px;border-radius:8px;background:${catColor}22;border:1px solid ${catColor}44;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${catColor};flex-shrink:0">${(e.full_name||'').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.full_name||'—'}</div>
                <div style="font-size:10px;color:var(--muted2);margin-top:1px">${e.position||''}</div>
              </div>
              <span style="font-size:10px;font-weight:700;color:${catColor};background:${catColor}15;padding:2px 8px;border-radius:8px;flex-shrink:0">${catLabel}</span>
            </div>`;
          }).join('')}
        </div>` : `
        <div style="text-align:center;padding:20px;color:var(--muted2)">
          <div style="font-size:24px;margin-bottom:8px">👥</div>
          <div style="font-size:13px;font-weight:600;color:#475569">Нет данных о военнообязанных</div>
          <div style="font-size:11px;color:#334155;margin-top:4px">Укажите категорию ВУ в карточке сотрудника</div>
        </div>`}
      </div>

      <!-- Чек-лист готовности -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">✅ Чек-лист готовности</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[
            { key:'responsible', label:'Назначен ответственный (есть приказ)', done: !!vuData.responsible_name && !!vuData.order_number },
            { key:'journal',     label:'Журнал проверок воинского учёта заведён', done: !!vuData.journal_started },
            { key:'regulation',  label:'Положение о воинском учёте утверждено', done: !!vuData.regulation_done },
            { key:'reconcil',    label:'Сверка с военкоматом проведена', done: !!vuData.last_reconciliation },
            { key:'emps',        label:'Все военнообязанные поставлены на учёт', done: vuCount > 0 },
            { key:'cards',       label:'Личные карточки Т-2 заполнены', done: !!vuData.cards_filled },
          ].map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${item.done?'rgba(52,211,153,0.04)':'rgba(255,255,255,0.01)'};border:1px solid ${item.done?'rgba(52,211,153,0.15)':'rgba(255,255,255,0.05)'};border-radius:8px">
              ${item.done
                ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);flex-shrink:0"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
                : `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.12);flex-shrink:0"></span>`}
              <span style="font-size:12px;color:${item.done?'#94a3b8':'#64748b'};${item.done?'text-decoration:line-through':''}">${item.label}</span>
            </div>`).join('')}
        </div>
      </div>

      <div style="font-size:10px;color:#334155;padding:10px 14px;background:rgba(255,255,255,0.01);border-radius:8px;line-height:1.7">
        ФЗ №53 от 28.03.1998 · Постановление Правительства №719 от 27.11.2006 · Приказ МО №700 от 22.11.2021
      </div>
    </div>`;
}

async function saveVuData(clientId) {
  const s = await window.api.settingsGet();
  const vuKey = `vu_data_${clientId}`;
  let vuData = {};
  try { vuData = JSON.parse(s[vuKey] || '{}'); } catch(_) {}

  vuData.responsible_name     = document.getElementById(`vu-resp-${clientId}`)?.value?.trim() || '';
  vuData.responsible_position = document.getElementById(`vu-order-${clientId}`)?.value?.trim() ? vuData.responsible_position : vuData.responsible_position || '';
  vuData.order_number         = document.getElementById(`vu-order-${clientId}`)?.value?.trim() || '';
  vuData.last_reconciliation  = document.getElementById(`vu-reconcil-${clientId}`)?.value || '';
  vuData.voenkomat            = document.getElementById(`vu-vk-${clientId}`)?.value?.trim() || '';
  vuData.journal_started      = document.getElementById(`vu-cb-journal_started-${clientId}`)?.checked || false;
  vuData.regulation_done      = document.getElementById(`vu-cb-regulation_done-${clientId}`)?.checked || false;
  vuData.cards_filled         = document.getElementById(`vu-cb-cards_filled-${clientId}`)?.checked || false;
  vuData.notifications_sent   = document.getElementById(`vu-cb-notifications_sent-${clientId}`)?.checked || false;

  // Дополнительные коды для Формы 18
  for (const key of ['ogrn','okato','okpo','okopf','okfs','okved_name','reg_date_place']) {
    const el = document.getElementById(`vu-code-${key}-${clientId}`);
    if (el) vuData[key] = el.value.trim();
  }
  const bronEl = document.getElementById(`vu-code-has_bronirowanie-${clientId}`);
  if (bronEl) vuData.has_bronirowanie = bronEl.checked;

  await window.api.settingsSave({ [vuKey]: JSON.stringify(vuData) });
  showToast('✅ Данные воинского учёта сохранены');
  await renderClientVu(clientId);
}

async function generateVuDocs(clientId) {
  await saveVuData(clientId);
  // Используем общий путь generateDocs() из docs-generation.js — он показывает
  // то же окно «Отчёт сформирован» со списком изменений (новые/обновлены/
  // без изменений/архив), что и ОТ/ПДн. Раньше здесь был только тост.
  await generateDocs(clientId, 'VU');
}

function showVuReportModal(clientId) {
  const existing = document.getElementById('modal-vu-report');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-vu-report';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <style>@keyframes ob-card-in{from{opacity:0;transform:scale(.96) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px;width:460px;box-shadow:0 24px 60px rgba(0,0,0,0.7);animation:ob-card-in .3s cubic-bezier(.22,.68,0,1.1) both">

      <!-- Шапка -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.2);display:flex;align-items:center;justify-content:center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#f1f5f9">Сдать отчёт</div>
            <div style="font-size:11px;color:#475569">Воинский учёт</div>
          </div>
        </div>
        <button onclick="document.getElementById('modal-vu-report').remove()"
          style="background:none;border:none;color:#475569;cursor:pointer;font-size:18px;line-height:1;padding:4px 8px;border-radius:6px"
          onmouseover="this.style.color='#f1f5f9'" onmouseout="this.style.color='#475569'">✕</button>
      </div>

      <!-- Документы на выбор -->
      <div style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Выберите документы для формирования:</div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">

        <!-- Форма 18 -->
        <label id="vu-rep-label-form18" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;cursor:pointer;transition:all .15s"
          onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          <input type="checkbox" id="vu-rep-form18" checked
            style="width:16px;height:16px;margin-top:2px;flex-shrink:0;accent-color:#60a5fa;cursor:pointer"
            onchange="updateVuRepLabel('form18',this.checked)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:#e2e8f0">Карточка учёта организации (Форма №18)</div>
            <div style="font-size:11px;color:#475569;margin-top:3px;line-height:1.5">Ежегодный отчёт в военкомат · срок сдачи — <span style="color:#f87171;font-weight:600">до 15 ноября</span></div>
            <div style="font-size:10px;color:#334155;margin-top:3px">Основание: Постановление Правительства №719 от 27.11.2006</div>
          </div>
          <div id="vu-rep-check-form18" style="flex-shrink:0;opacity:1;transition:opacity .2s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </label>

        <!-- План -->
        <label id="vu-rep-label-plan" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;cursor:pointer;transition:all .15s"
          onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          <input type="checkbox" id="vu-rep-plan" checked
            style="width:16px;height:16px;margin-top:2px;flex-shrink:0;accent-color:#60a5fa;cursor:pointer"
            onchange="updateVuRepLabel('plan',this.checked)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:#e2e8f0">План работы по воинскому учёту</div>
            <div style="font-size:11px;color:#475569;margin-top:3px;line-height:1.5">На следующий год · срок согласования — <span style="color:#fbbf24;font-weight:600">до 31 декабря</span></div>
            <div style="font-size:10px;color:#334155;margin-top:3px">Согласовывается с военным комиссариатом</div>
          </div>
          <div id="vu-rep-check-plan" style="flex-shrink:0;opacity:1;transition:opacity .2s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </label>

      </div>

      <!-- Статус (скрыт до генерации) -->
      <div id="vu-rep-status" style="display:none;margin-bottom:16px;padding:12px 16px;border-radius:10px;font-size:12px;font-weight:600"></div>

      <!-- Кнопки -->
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('modal-vu-report').remove()"
          style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer;transition:all .2s"
          onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          Отмена
        </button>
        <button id="vu-rep-submit" onclick="submitVuReport(${clientId})"
          style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(59,130,246,0.3);transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px"
          onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Сформировать документы
        </button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function updateVuRepLabel(key, checked) {
  const check = document.getElementById(`vu-rep-check-${key}`);
  if (check) check.style.opacity = checked ? '1' : '0.15';
}

async function submitVuReport(clientId) {
  const form18 = document.getElementById('vu-rep-form18')?.checked;
  const plan   = document.getElementById('vu-rep-plan')?.checked;

  if (!form18 && !plan) {
    showToast('Выберите хотя бы один документ', 'var(--amber)');
    return;
  }

  const docs = [];
  if (form18) docs.push('form18');
  if (plan)   docs.push('plan');

  // Блокируем кнопку
  const btn = document.getElementById('vu-rep-submit');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg> Формирую...';
    btn.style.opacity = '0.7';
  }

  const statusEl = document.getElementById('vu-rep-status');

  try {
    // Сначала сохраняем данные ВУ
    await saveVuData(clientId);

    const result = await window.api.vuGenerateReports(clientId, docs);

    if (!result.ok) throw new Error(result.error || 'Ошибка генерации');

    // Краткая сводка изменений (added/updated/unchanged) + архивация
    const rep = result.report || {};
    const added     = rep.added     || [];
    const updated    = rep.updated    || [];
    const unchanged = rep.unchanged || [];
    const archived  = rep.archived  || [];
    const cleanVuName = n => String(n).replace(/\.docx$/i,'').replace(/^ВУ-\d+\s*/,'').trim();

    let changesHtml = '';
    if (added.length) {
      changesHtml += `<div style="margin-top:8px"><div style="font-size:10px;font-weight:700;color:#34d399;letter-spacing:.4px">➕ НОВЫЕ (${added.length})</div>` +
        added.map(n => `<div style="font-size:11px;color:#86efac;padding:2px 0">${cleanVuName(n)}</div>`).join('') + `</div>`;
    }
    if (updated.length) {
      changesHtml += `<div style="margin-top:8px"><div style="font-size:10px;font-weight:700;color:#60a5fa;letter-spacing:.4px">🔄 ОБНОВЛЕНЫ (${updated.length})</div>` +
        updated.map(it => {
          const uName   = (typeof it === 'string') ? it : it.name;
          const uReason = (typeof it === 'string') ? null : it.reason;
          return `<div style="padding:2px 0">
            <div style="font-size:11px;color:#93c5fd">${cleanVuName(uName)}</div>
            <div style="font-size:10px;color:#475569;margin-left:2px">${uReason || 'причина уточнится при следующем формировании'}</div>
          </div>`;
        }).join('') + `</div>`;
    }
    if (unchanged.length) {
      changesHtml += `<div style="margin-top:8px"><div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.4px">✓ БЕЗ ИЗМЕНЕНИЙ (${unchanged.length})</div>` +
        unchanged.map(n => `<div style="font-size:11px;color:#64748b;padding:2px 0">${cleanVuName(n)}</div>`).join('') + `</div>`;
    }
    if (archived.length) {
      changesHtml += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)"><div style="font-size:10px;font-weight:700;color:#a78bfa;letter-spacing:.4px">🗄 ПРЕДЫДУЩИЕ ВЕРСИИ В АРХИВ (${archived.length})</div>` +
        archived.map(a => `<div style="font-size:11px;color:#c4b5fd;padding:2px 0">${cleanVuName(a.basename)} → Архив/${a.year}</div>`).join('') + `</div>`;
    }

    const totalChanged = added.length + updated.length;

    // Успех
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(52,211,153,0.08)';
      statusEl.style.border = '1px solid rgba(52,211,153,0.2)';
      statusEl.style.color = '#34d399';
      statusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Отчёт сформирован — ${totalChanged > 0
            ? `обновлено ${totalChanged} из ${result.generated?.length || docs.length}`
            : `все ${result.generated?.length || docs.length} актуальны`}
        </div>
        <div style="max-height:200px;overflow-y:auto">${changesHtml}</div>
        ${result.errors?.length ? `<div style="color:#fbbf24;font-size:11px;margin-top:6px">Предупреждения: ${result.errors[0]}</div>` : ''}
        <button onclick="window.api.docsOpenFolder('${(result.folder||'').replace(/\\/g,'\\\\')}')"
          style="margin-top:10px;padding:6px 14px;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);border-radius:8px;color:#34d399;font-size:11px;font-weight:600;cursor:pointer">
          📂 Открыть папку
        </button>`;
    }

    // Предлагаем отметить как сданные в системе отчётности
    setTimeout(() => {
      if (statusEl) {
        statusEl.innerHTML += `
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(52,211,153,0.15)">
            <div style="font-size:11px;color:#475569;margin-bottom:6px">Отметить в отчётности как сданные?</div>
            <div style="display:flex;gap:8px">
              ${form18 ? `<button onclick="markVuReportDone(${clientId},'form18',this)"
                style="flex:1;padding:6px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);border-radius:8px;color:#60a5fa;font-size:11px;font-weight:600;cursor:pointer">
                ✅ Форма №18 сдана</button>` : ''}
              ${plan ? `<button onclick="markVuReportDone(${clientId},'plan',this)"
                style="flex:1;padding:6px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);border-radius:8px;color:#60a5fa;font-size:11px;font-weight:600;cursor:pointer">
                ✅ План согласован</button>` : ''}
            </div>
          </div>`;
      }
    }, 300);

    if (btn) {
      btn.disabled = false;          // ← БЫЛО true (стр. блокировки выше); без снятия onclick «Готово» не срабатывал
      btn.innerHTML = '✅ Готово';
      btn.style.background = 'linear-gradient(135deg,#059669,#10b981)';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.onclick = () => document.getElementById('modal-vu-report')?.remove();
    }

  } catch(e) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(248,113,113,0.08)';
      statusEl.style.border = '1px solid rgba(248,113,113,0.2)';
      statusEl.style.color = '#f87171';
      statusEl.textContent = '⚠ ' + e.message;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Повторить';
      btn.style.opacity = '1';
    }
  }
}

async function markVuReportDone(clientId, type, btnEl) {
  // Отмечаем в системе отчётности через ключ submitted
  const s = await window.api.settingsGet();
  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  const now = new Date();
  const year = now.getFullYear();
  const key = type === 'form18'
    ? `${clientId}__federal_${year}-11-15_Карточка учёта организации (Фо`
    : `${clientId}__federal_${year}-12-31_План работы по воинскому учёту`;

  submitted[key] = new Date().toISOString();
  await window.api.settingsSave({ reports_submitted: JSON.stringify(submitted) });

  // Анимируем кнопку
  if (btnEl) {
    btnEl.style.background = 'rgba(52,211,153,0.15)';
    btnEl.style.borderColor = 'rgba(52,211,153,0.3)';
    btnEl.style.color = '#34d399';
    btnEl.innerHTML = '✅ Отмечено';
    btnEl.disabled = true;
  }

  showToast('✅ Отмечено как сданное');
}

function renderVuCategoryField(emp) {
  // Используется в форме редактирования сотрудника
  const cats = [
    { value:'', label:'Не указано' },
    { value:'призывник', label:'Призывник (18–27 лет)' },
    { value:'запас', label:'Военнообязанный запаса' },
    { value:'бронь', label:'Забронированный' },
  ];
  return `<div style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Категория ВУ</div>
    <select id="emp-vu-cat" style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
      ${cats.map(c => `<option value="${c.value}" ${emp?.vu_category===c.value?'selected':''}>${c.label}</option>`).join('')}
    </select>
  </div>`;
}


// ── ЦЕНТР ГОТОВНОСТИ: ВОИНСКИЙ УЧЁТ ─────────────────────────

async function renderVuReadiness(clientId) {
  const c    = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId);
  const s    = await window.api.settingsGet();

  let vuData = {};
  try { vuData = JSON.parse(s[`vu_data_${clientId}`] || '{}'); } catch(_) {}

  const now = new Date();
  const vuEmps = emps.filter(e => e.vu_category);
  const vuCount = vuEmps.length;
  const hasBron = vuData.has_bronirowanie === true || vuData.has_bronirowanie === 'true';

  // Score ВУ — единая формула, см. readiness-calc.js (calcVuReadiness).
  // checks/hasBron оставлены здесь же — они нужны ниже для рендера
  // чек-листа и списка рисков, а не только для самого числа.
  const checks = {
    responsible: !!(vuData.responsible_name && vuData.order_number),
    plan:        !!(vuData.last_reconciliation),
    journal:     !!vuData.journal_started,
    regulation:  !!vuData.regulation_done,
    cards:       !!vuData.cards_filled,
    emps:        vuCount > 0 || emps.length === 0,
  };
  // Доп. проверки только для организаций с бронированием
  if (hasBron) {
    checks.bron_codes  = !!(vuData.bron_codes);
    checks.gov_organ   = !!(vuData.gov_organ);
  }

  const scorePct = calcVuReadiness(c, emps, vuData);
  const scoreColor = scorePct >= 80 ? '#34d399' : scorePct >= 50 ? '#fbbf24' : '#f87171';

  // Риски ВУ — базовые
  const risks = [];
  if (!checks.responsible) risks.push({
    level: 'high', title: 'Не назначен ответственный за воинский учёт',
    law: 'п.12 Положения о ВУ (Пост. №719)', fine: 'до 500 000 ₽',
    fix: 'Оформить приказ о назначении во вкладке ВУ',
  });
  if (!checks.regulation) risks.push({
    level: 'high', title: 'Отсутствует положение о воинском учёте',
    law: 'п.39 Методических рекомендаций ГШ ВС РФ', fine: 'до 300 000 ₽',
    fix: 'Утвердить положение о ВУ',
  });
  if (!checks.journal) risks.push({
    level: 'medium', title: 'Не заведён журнал проверок воинского учёта',
    law: 'п.40 Методических рекомендаций ГШ ВС РФ', fine: 'до 100 000 ₽',
    fix: 'Завести журнал (шаблон — кнопка «Сформировать пакет»)',
  });
  if (emps.length > 0 && vuCount === 0) risks.push({
    level: 'medium', title: 'Данные о военнообязанных сотрудниках не заполнены',
    law: 'п.28 Положения о ВУ (Пост. №719)', fine: 'до 200 000 ₽',
    fix: 'Указать категорию ВУ в карточках сотрудников',
  });
  if (!checks.plan) risks.push({
    level: 'medium', title: 'Нет отметки о последней сверке с военкоматом',
    law: 'п.32 Положения о ВУ (Пост. №719)', fine: 'до 100 000 ₽',
    fix: 'Провести сверку и внести дату во вкладке ВУ',
  });
  if (!checks.cards) risks.push({
    level: 'low', title: 'Личные карточки (Т-2) не актуализированы',
    law: 'п.28 Положения о ВУ (Пост. №719)', fine: 'предупреждение',
    fix: 'Актуализировать карточки Т-2 для военнообязанных',
  });

  // Риски только для организаций с бронированием
  if (hasBron) {
    if (!checks.bron_codes) risks.push({
      level: 'high', title: 'Не указаны коды должностей для бронирования',
      law: 'п.11 Формы 18 (Письмо Минкультуры № 344-01-39-ВА)', fine: 'до 300 000 ₽',
      fix: 'Указать коды должностей из Перечня бронирования во вкладке ВУ',
    });
    if (!checks.gov_organ) risks.push({
      level: 'high', title: 'Не указан орган государственной власти для бронирования',
      law: 'п.13 Формы 18 (Письмо Минкультуры № 344-01-39-ВА)', fine: 'до 200 000 ₽',
      fix: 'Указать орган госвласти в блоке кодов вкладки ВУ',
    });
  }

  const totalFine = risks.filter(r => r.level === 'high').length * 300000
    + risks.filter(r => r.level === 'medium').length * 100000;

  const highRisks = risks.filter(r => r.level === 'high').length;
  let probability = Math.min(95, Math.max(5, 100 - scorePct + highRisks * 10));
  if (risks.length === 0) probability = 5;

  let riskLabel, riskColor;
  if (probability >= 70)      { riskLabel = 'ВЫСОКИЙ';  riskColor = '#f87171'; }
  else if (probability >= 40) { riskLabel = 'СРЕДНИЙ';  riskColor = '#fbbf24'; }
  else                        { riskLabel = 'НИЗКИЙ';   riskColor = '#34d399'; }

  const levelColor = l => l==='high'?'#f87171':l==='medium'?'#fbbf24':'#60a5fa';
  const levelLabel = l => l==='high'?'ВЫСОКИЙ':l==='medium'?'СРЕДНИЙ':'НИЗКИЙ';

  const content = document.getElementById('rc-mode-content');
  if (!content) return;

  // Чек-лист — базовый + доп. для бронирования
  const checklistItems = [
    { done: checks.responsible, label: 'Назначен ответственный (есть приказ о назначении)' },
    { done: checks.regulation,  label: 'Утверждено положение о воинском учёте' },
    { done: checks.journal,     label: 'Заведён журнал проверок воинского учёта' },
    { done: checks.cards,       label: 'Личные карточки Т-2 заполнены и актуальны' },
    { done: checks.emps,        label: 'Все военнообязанные сотрудники поставлены на учёт' },
    { done: checks.plan,        label: 'Проведена ежегодная сверка с военкоматом' },
  ];
  if (hasBron) {
    checklistItems.push({ done: checks.bron_codes, label: 'Коды должностей для бронирования заполнены (Форма 18 п.12)' });
    checklistItems.push({ done: checks.gov_organ,  label: 'Указан орган государственной власти (Форма 18 п.13)' });
  }

  // Симулятор — шаги с учётом бронирования
  const simSteps = [
    { label: 'Проверка наличия приказа о назначении ответственного',     ok: checks.responsible,  fine: '500 000 ₽' },
    { label: 'Проверка положения о воинском учёте',                       ok: checks.regulation,   fine: '300 000 ₽' },
    { label: 'Проверка журнала проверок воинского учёта',                 ok: checks.journal,      fine: '100 000 ₽' },
    { label: 'Проверка наличия карточек Т-2 на военнообязанных',          ok: checks.cards,        fine: '100 000 ₽' },
    { label: 'Сверка списков с данными военкомата',                       ok: checks.plan,         fine: '100 000 ₽' },
    { label: 'Проверка учёта призывников и запасников',                   ok: checks.emps,         fine: '200 000 ₽' },
  ];
  if (hasBron) {
    simSteps.push({ label: 'Проверка кодов должностей для бронирования (Форма 18 п.12)',   ok: checks.bron_codes, fine: '300 000 ₽' });
    simSteps.push({ label: 'Проверка органа госвласти для бронирования (Форма 18 п.13)',    ok: checks.gov_organ,  fine: '200 000 ₽' });
  }

  // Сохраняем для симулятора
  window._vuSimSteps = simSteps;

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- СИМУЛЯТОР ВОЕНКОМАТА -->
      <div class="rc-card panel" style="grid-column:1/-1">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Что будет, если завтра проверка военкомата?</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Симуляция проверки воинского учёта в организации</div>
          </div>
          <button onclick="runVuSimulator(${clientId})" id="vuSimBtn" style="
            padding:11px 22px;background:linear-gradient(90deg,#7c3aed,#6d28d9);
            border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;
            cursor:pointer;white-space:nowrap;transition:opacity .15s"
            onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ▶ Запустить проверку
          </button>
        </div>
        <div id="vuSimResult"></div>
      </div>

      <!-- ИНДЕКС РИСКА -->
      <div class="rc-card panel">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">Индекс риска ВУ</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
          <div style="position:relative;width:80px;height:80px;flex-shrink:0">
            <svg viewBox="0 0 80 80" style="width:80px;height:80px;transform:rotate(-90deg)">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
              <circle cx="40" cy="40" r="32" fill="none" stroke="${riskColor}" stroke-width="10"
                stroke-dasharray="${2*Math.PI*32}" stroke-dashoffset="${2*Math.PI*32*(1-probability/100)}"
                stroke-linecap="round"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-size:18px;font-weight:800;color:${riskColor}">${probability}%</div>
            </div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--muted2);margin-bottom:4px">Вероятность нарушений</div>
            <div style="font-size:16px;font-weight:800;color:${riskColor}">${riskLabel}</div>
            <div style="font-size:11px;color:var(--muted2);margin-top:4px">Макс. штраф: ~${totalFine > 0 ? (totalFine/1000).toFixed(0)+'K ₽' : '—'}</div>
          </div>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="width:${scorePct}%;height:100%;background:${scoreColor};border-radius:3px;transition:width .8s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          <div style="font-size:11px;color:var(--muted2)">Готовность ВУ</div>
          <div style="font-size:11px;font-weight:700;color:${scoreColor}">${scorePct}%</div>
        </div>
      </div>

      <!-- СТАТИСТИКА УЧЁТА -->
      <div class="rc-card panel">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">Военнообязанные</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${[
            { val: emps.length, label: 'Всего сотрудников', color: '#94a3b8' },
            { val: vuCount,     label: 'На воинском учёте',  color: vuCount > 0 ? '#60a5fa' : '#475569' },
            { val: vuEmps.filter(e=>e.vu_category==='призывник').length,  label: 'Призывники',  color: '#f87171' },
            { val: vuEmps.filter(e=>e.vu_category==='запас').length,      label: 'Запас',        color: '#60a5fa' },
            { val: vuEmps.filter(e=>e.vu_category==='бронь').length,      label: 'Бронь',        color: '#34d399' },
            { val: vuEmps.filter(e=>e.vu_mobpredpisanie).length,          label: 'Мобпредписание', color: '#fbbf24' },
          ].map(s => `
            <div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;text-align:center">
              <div style="font-size:18px;font-weight:800;color:${s.color}">${s.val}</div>
              <div style="font-size:10px;color:var(--muted2);margin-top:2px">${s.label}</div>
            </div>`).join('')}
        </div>
      </div>

    </div>

    <!-- РИСКИ -->
    ${risks.length ? `
    <div class="rc-card panel" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Выявленные риски (${risks.length})
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${risks.map(r => `
          <div style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-left:3px solid ${levelColor(r.level)};border-radius:8px">
            <span style="font-size:9px;font-weight:800;color:${levelColor(r.level)};background:${levelColor(r.level)}18;padding:2px 6px;border-radius:4px;white-space:nowrap;margin-top:1px">${levelLabel(r.level)}</span>
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--text)">${r.title}</div>
              <div style="font-size:10px;color:var(--muted2);margin-top:3px">${r.law} · штраф ${r.fine}</div>
              <div style="font-size:10px;color:#60a5fa;margin-top:3px">→ ${r.fix}</div>
            </div>
            <div style="font-size:11px;font-weight:700;color:${levelColor(r.level)};white-space:nowrap">${r.fine}</div>
          </div>`).join('')}
      </div>
    </div>` : `
    <div class="rc-card panel" style="text-align:center;padding:28px;margin-bottom:16px">
      <div style="font-size:28px;margin-bottom:8px">✅</div>
      <div style="font-size:14px;font-weight:700;color:#34d399">Воинский учёт в порядке</div>
      <div style="font-size:12px;color:var(--muted2);margin-top:4px">Критических нарушений не выявлено</div>
    </div>`}

    <!-- ЧЕК-ЛИСТ -->
    <div class="rc-card panel">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">Чек-лист готовности к проверке</div>
      ${hasBron ? `<div style="font-size:11px;color:#fbbf24;margin-bottom:10px">⭐ Расширенный — включает проверки для организаций с бронированием</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:7px">
        ${checklistItems.map(item => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${item.done?'rgba(52,211,153,0.04)':'rgba(255,255,255,0.01)'};border:1px solid ${item.done?'rgba(52,211,153,0.15)':'rgba(255,255,255,0.05)'};border-radius:8px">
            ${item.done
              ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);flex-shrink:0"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
              : `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.12);flex-shrink:0"></span>`}
            <span style="font-size:12px;color:${item.done?'#94a3b8':'#64748b'};${item.done?'text-decoration:line-through':''}">${item.label}</span>
          </div>`).join('')}
      </div>
    </div>`;

  // Переставляем активную вкладку на ВУ
  const btnVu = document.getElementById('rc-tab-vu');
  if (btnVu) {
    btnVu.style.background  = 'rgba(167,139,250,0.12)';
    btnVu.style.borderColor = 'rgba(167,139,250,0.5)';
    btnVu.style.color       = '#a78bfa';
  }
}

async function runVuSimulator(clientId) {
  const btn = document.getElementById('vuSimBtn');
  const result = document.getElementById('vuSimResult');
  if (!btn || !result) return;

  btn.textContent = '⏳ Проверка идёт...';
  btn.disabled = true;

  // Берём шаги из подготовленного массива (адаптированного под клиента)
  const steps = window._vuSimSteps || [];
  result.innerHTML = '';

  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 400));
    const st = steps[i];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;margin-bottom:6px;animation:typewriter .3s ease both;background:rgba(255,255,255,0.02)';
    row.innerHTML = `
      <span style="font-size:16px">${st.ok ? '✅' : '❌'}</span>
      <span style="flex:1;font-size:12px;color:${st.ok?'#94a3b8':'#f1f5f9'};${st.ok?'text-decoration:line-through':''}">${st.label}</span>
      ${!st.ok ? `<span style="font-size:11px;font-weight:700;color:#f87171;white-space:nowrap">штраф до ${st.fine}</span>` : ''}`;
    result.appendChild(row);
  }

  await new Promise(r => setTimeout(r, 400));
  const violations = steps.filter(s => !s.ok).length;
  const summary = document.createElement('div');
  summary.style.cssText = `margin-top:12px;padding:14px 16px;border-radius:10px;background:${violations===0?'rgba(52,211,153,0.08)':'rgba(248,113,113,0.08)'};border:1px solid ${violations===0?'rgba(52,211,153,0.2)':'rgba(248,113,113,0.2)'}`;
  summary.innerHTML = violations === 0
    ? `<div style="font-size:14px;font-weight:700;color:#34d399">✅ Нарушений не выявлено — организация готова к проверке!</div>`
    : `<div style="font-size:14px;font-weight:700;color:#f87171">⚠ Выявлено нарушений: ${violations}</div>
       <div style="font-size:12px;color:#94a3b8;margin-top:4px">Устраните нарушения во вкладке «Воинский учёт» карточки клиента</div>`;
  result.appendChild(summary);

  btn.textContent = '▶ Запустить снова';
  btn.disabled = false;
}
