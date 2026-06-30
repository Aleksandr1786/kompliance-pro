// ============================================================
// КОМПЛАЕНСПРО — sout.js
// Мастер СОУТ для микропредприятий
// Нормативная база: 426-ФЗ, Приказ Минтруда №699н от 31.10.2022
// ============================================================

// ─── Перечни ОКВЭД по ПП №1830 ───────────────────────────
// ДО 01.09.2026: 12 видов деятельности (только микропредприятия до 15 чел.)
// Источник: ПП №1830 от 14.10.2022 (оригинальная редакция), Приказ №699н
const SOUT_OKVED_PRE_SEP = [
  '62', // Разработка ПО и IT-консультирование
  '63', // Деятельность в области IT
  '64', // Финансовая деятельность
  '65', // Страхование и пенсионное обеспечение
  '66', // Вспомогательная финансовая деятельность
  '68', // Операции с недвижимостью
  '69', // Деятельность в области права и бухучёта
  '70', // Деятельность головных офисов; консультирование
  '71', // Архитектура и инженерно-техническое проектирование
  '73', // Реклама и исследование конъюнктуры рынка
  '82', // Административная деятельность и сопутствующие услуги
  '94', // Деятельность общественных организаций
];

// С 01.09.2026: 55 видов деятельности (МСП — микро + малые до 100 чел.)
// Источник: ПП №39 от 26.01.2026 (вступает в силу 01.09.2026)
// Включает всё из PRE_SEP плюс новые коды:
const SOUT_OKVED_POST_SEP = [
  // Из старого перечня
  '62','63','64','65','66','68','69','70','71','73','82','94',
  // Производство продуктов (отдельные подклассы)
  '10', // Производство пищевых продуктов (скоропортящиеся, выпечка и др.)
  '11', // Производство напитков (в т.ч. минеральные воды)
  // Производство одежды/обуви/изделий на заказ
  '13', // Производство текстильных изделий (пошив на заказ)
  '14', // Производство одежды (индивидуальный пошив)
  '15', // Производство кожи и обуви (пошив на заказ)
  // Ремонт и прочие услуги
  '33', // Ремонт и монтаж машин и оборудования (отдельные виды)
  '45', // Торговля и ремонт автомобилей (ряд подклассов)
  '47', // Розничная торговля (в т.ч. свежие фрукты/овощи, непродовольственные)
  '56', // Деятельность по предоставлению продуктов питания и напитков
  '72', // Научные исследования и разработки
  '74', // Прочая профессиональная деятельность
  '75', // Деятельность ветеринарная
  '77', // Аренда и лизинг
  '78', // Трудоустройство и подбор персонала
  '79', // Туристическая деятельность
  '80', // Деятельность по обеспечению безопасности (ряд)
  '81', // Обслуживание зданий и территорий
  '84', // Государственное управление (НКО)
  '85', // Образование
  '86', // Деятельность в области здравоохранения
  '87', // Уход с обеспечением проживания
  '88', // Социальные услуги
  '90', // Деятельность в области культуры
  '91', // Деятельность библиотек, архивов, музеев
  '92', // Деятельность по организации досуга
  '93', // Деятельность в области спорта
  '95', // Ремонт компьютеров, предметов личного и домашнего обихода
  '96', // Прочие виды деятельности по обслуживанию (парикмахерские и др.)
];

// Должности с повышенным риском — упрощённый порядок не применяется
// к их рабочим местам (требуется аккредитованная организация)
const SOUT_HIGH_RISK_POSITIONS = [
  'водитель', 'шофёр', 'машинист', 'оператор', 'механик', 'сварщик',
  'электрик', 'электромонтёр', 'слесарь', 'токарь', 'фрезеровщик',
  'грузчик', 'кладовщик', 'кухонный', 'повар', 'технолог производства',
  'лаборант', 'медицинская сестра', 'медсестра', 'санитар',
  'строитель', 'монтажник', 'плотник', 'каменщик',
];

// Дата вступления в силу расширенного перечня
const SOUT_NEW_RULES_DATE = new Date('2026-09-01');

const SOUT_FACTORS_SHORT = [
  'Химический фактор',
  'Биологический фактор',
  'Шум',
  'Инфразвук',
  'Ультразвук воздушный',
  'Вибрация общая',
  'Вибрация локальная',
  'Неионизирующие излучения',
  'Лазерное излучение',
  'Ультрафиолетовое излучение',
  'Ионизирующее излучение',
  'Микроклимат',
  'Световая среда (освещение)',
  'Тяжесть трудового процесса',
  'Напряжённость трудового процесса',
];

// ─── Состояние мастера ────────────────────────────────────
let _soutData = null;     // текущие данные СОУТ
let _soutStep = 1;        // текущий шаг мастера
let _soutClient = null;   // текущий клиент
let _soutEmployees = [];  // сотрудники клиента
let _soutGeneralMode = false; // true — общий порядок (через аккредитованную организацию)

// ─── Вход в мастер ────────────────────────────────────────
async function renderSout() {
  const content = document.getElementById('content');
  content.innerHTML = '';

  _soutClient = currentClientId ? await window.api.clientGet(currentClientId) : null;
  if (!_soutClient) {
    content.innerHTML = '<div style="padding:40px;color:#475569;text-align:center">Выберите клиента для проведения СОУТ</div>';
    return;
  }

  _soutEmployees = currentClientId ? await window.api.employeesList(currentClientId) : [];

  // Загружаем сохранённые данные СОУТ
  const saved = await window.api.soutGet(currentClientId);
  _soutData = saved || {
    date: new Date().toISOString().split('T')[0],
    protocol_date: new Date().toISOString().split('T')[0],
    order_num: '1',
    commission: [],
    worksheets: [],
    has_substitution: false,
    substitution: {},
    declaration_status: 'pending',
  };
  _soutStep = 1;

  renderSoutStep();
}

// ─── Рендер текущего шага ────────────────────────────────
function renderSoutStep() {
  const content = document.getElementById('content');

  // Проверяем право на упрощённый порядок
  const eligible = checkSoutEligibility(_soutClient, _soutEmployees);
  const staffCount = parseInt(_soutClient.staff || 0);
  _soutGeneralMode = eligible.generalProcedureNeeded;

  const steps = _soutGeneralMode ? [
    { num: 1, title: 'Проверка права' },
    { num: 2, title: 'Состав комиссии' },
    { num: 3, title: 'Документы' },
  ] : [
    { num: 1, title: 'Проверка права' },
    { num: 2, title: 'Состав комиссии' },
    { num: 3, title: 'Проверочные листы' },
    { num: 4, title: 'Дата и подтверждение' },
    { num: 5, title: 'Формирование документов' },
  ];
  const totalSteps = steps.length;

  const progressBar = `
    <div style="display:flex;gap:0;margin-bottom:28px">
      ${steps.map(s => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
          <div style="display:flex;align-items:center;width:100%">
            ${s.num > 1 ? `<div style="flex:1;height:2px;background:${_soutStep > s.num - 1 ? '#3b82f6' : 'rgba(255,255,255,0.1)'}"></div>` : '<div style="flex:1"></div>'}
            <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;
              background:${_soutStep === s.num ? '#2563eb' : _soutStep > s.num ? '#1d4ed8' : 'rgba(255,255,255,0.05)'};
              border:2px solid ${_soutStep >= s.num ? '#3b82f6' : 'rgba(255,255,255,0.1)'};
              color:${_soutStep >= s.num ? '#fff' : '#475569'}">
              ${_soutStep > s.num ? '✓' : s.num}
            </div>
            ${s.num < totalSteps ? `<div style="flex:1;height:2px;background:${_soutStep > s.num ? '#3b82f6' : 'rgba(255,255,255,0.1)'}"></div>` : '<div style="flex:1"></div>'}
          </div>
          <div style="font-size:10px;color:${_soutStep === s.num ? '#93c5fd' : '#475569'};text-align:center;white-space:nowrap">${s.title}</div>
        </div>
      `).join('')}
    </div>`;

  let stepContent = '';
  if (_soutGeneralMode) {
    if (_soutStep === 1) stepContent = renderSoutStep1(eligible, staffCount);
    else if (_soutStep === 2) stepContent = renderSoutStep2();
    else if (_soutStep === 3) stepContent = renderSoutStepGeneralFinal();
  } else {
    if (_soutStep === 1) stepContent = renderSoutStep1(eligible, staffCount);
    else if (_soutStep === 2) stepContent = renderSoutStep2();
    else if (_soutStep === 3) stepContent = renderSoutStep3();
    else if (_soutStep === 4) stepContent = renderSoutStep4();
    else if (_soutStep === 5) stepContent = renderSoutStep5();
  }

  content.innerHTML = `
    <div style="max-width:860px;margin:0 auto;padding:24px 0">
      <div style="background:rgba(15,21,32,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:28px 32px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div>
            <div style="font-size:18px;font-weight:700;color:#f1f5f9">СОУТ ${_soutGeneralMode ? '— общий порядок' : 'в упрощённом порядке'}</div>
            <div style="font-size:12px;color:#475569;margin-top:2px">${safe(_soutClient.name)} · ${_soutGeneralMode ? 'Федеральный закон №426-ФЗ' : 'Приказ Минтруда №699н от 31.10.2022'}</div>
          </div>
          <div style="font-size:11px;color:#334155;padding:6px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px">
            Шаг ${_soutStep} из ${totalSteps}
          </div>
        </div>
        ${progressBar}
        ${stepContent}
      </div>
    </div>`;
}

// ─── ШАГ 1: Проверка права на упрощённый порядок ─────────
function renderSoutStep1(eligible, staffCount) {
  const okved = (_soutClient.okved || '').split('.')[0];
  const isEligible = eligible.ok;

  return `
    <div>
      <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Шаг 1. Проверка права на упрощённый порядок</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px">КомплаенсПро автоматически проверяет, может ли ваш клиент провести СОУТ самостоятельно</div>

      ${infoBox(
        eligible.isNewRules
          ? 'Действует расширенный перечень (ПП №39 от 26.01.2026)'
          : 'Внимание: расширенный перечень вступит в силу 01.09.2026',
        eligible.isNewRules
          ? 'С 1 сентября 2026 года упрощённый порядок доступен субъектам МСП по 55 видам деятельности (микро до 15 чел. и малые до 100 чел.). Основание: ПП №1830 в редакции ПП №39 от 26.01.2026.'
          : 'До 1 сентября 2026 года упрощённый порядок доступен только микропредприятиям (до 15 чел.) по 12 видам деятельности. С 01.09.2026 перечень расширится до 55 видов и охватит малые предприятия до 100 чел.'
      )}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0">
        ${checkCard(
          'Численность сотрудников',
          staffCount + ' чел.',
          staffCount <= eligible.staffLimit ? 'ok' : 'error',
          staffCount <= eligible.staffLimit
            ? `В пределах лимита ${eligible.staffLimit} чел. — упрощённый порядок доступен`
            : `Превышает лимит ${eligible.staffLimit} чел. — требуется аккредитованная организация`
        )}
        ${checkCard(
          'ОКВЭД',
          safe(_soutClient.okved || '—'),
          eligible.okvedOk ? 'ok' : 'warn',
          eligible.okvedOk
            ? `Вид деятельности входит в перечень ПП №1830${eligible.isNewRules ? ' (ред. №39)' : ''}`
            : `ОКВЭД не найден в перечне — уточните применимость`
        )}
      </div>

      ${eligible.ok && !eligible.warn
        ? `<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:10px;margin-bottom:12px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <div>
              <div style="font-size:13px;font-weight:700;color:#34d399">Можно провести СОУТ самостоятельно</div>
              <div style="font-size:11px;color:#475569;margin-top:2px">Привлекать аккредитованную организацию не требуется. Стоимость: 0 ₽.</div>
            </div>
          </div>`
        : eligible.ok && eligible.warn
          ? `<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:10px;margin-bottom:12px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <div style="font-size:13px;font-weight:700;color:#fbbf24">Требуется уточнение</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px">${eligible.reason} Если применимость подтверждена — продолжайте.</div>
              </div>
            </div>`
          : `<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:10px;margin-bottom:12px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <div style="font-size:13px;font-weight:700;color:#f87171">Упрощённый порядок недоступен</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px">${eligible.reason}</div>
              </div>
            </div>`
      }

      ${eligible.mixedWarning ? `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px;margin-bottom:12px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" style="flex-shrink:0;margin-top:2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <div style="font-size:11.5px;font-weight:700;color:#fbbf24;margin-bottom:3px">Обнаружены рабочие места повышенного риска</div>
            <div style="font-size:11px;color:#94a3b8;line-height:1.6">${eligible.mixedWarning}</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px">Для этих должностей проведите СОУТ через аккредитованную организацию отдельно. Остальные рабочие места можно оценить самостоятельно.</div>
          </div>
        </div>` : ''
      }

      ${eligible.generalProcedureNeeded ? renderGeneralProcedureGuide(eligible) : ''}

      <div style="padding:12px 16px;background:rgba(255,255,255,0.02);border-radius:8px;margin-bottom:20px">
        <div style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Когда упрощённый порядок НЕ применяется:</div>
        <div style="font-size:12px;color:#64748b;line-height:1.7">
          • Рабочие места с вредными или опасными классами по предыдущей СОУТ<br>
          • Работы в перечне ст. 147, 117, 118 ТК РФ (вредные условия труда)<br>
          • Производственные рабочие места с оборудованием, излучением, химическими веществами<br>
          • Рабочие места водителей транспортных средств
        </div>
      </div>

      ${eligible.generalProcedureNeeded
        ? `<div style="display:flex;gap:10px;margin-top:20px">
            <button onclick="navigate('client',currentClientId)" style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer">← Вернуться к карточке клиента</button>
            <button onclick="_soutNextStep()" style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Сформировать вспомогательные документы →</button>
          </div>`
        : stepNav(null, () => '_soutNextStep()')
      }
    </div>`;
}

// ─── ШАГ 2: Состав комиссии ───────────────────────────────
function renderSoutStep2() {
  const commission = _soutData.commission || [];

  const memberRows = commission.map((m, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;margin-bottom:8px">
      <div style="flex:1">
        <div style="font-size:13px;color:#e2e8f0;font-weight:500">${safe(m.name)}</div>
        <div style="font-size:11px;color:#475569">${safe(m.position)} · <span style="padding:2px 7px;border-radius:5px;font-size:10px;font-weight:600;background:${m.is_chair ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.05)"};color:${m.is_chair ? "#60a5fa" : "#64748b"}">${m.is_chair ? "Председатель" : "Член комиссии"}</span></div>
      </div>
      <button onclick="_soutRemoveMember(${i})" style="background:none;border:none;color:#475569;cursor:pointer;padding:4px;border-radius:4px" onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#475569'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');

  const empOptions = _soutEmployees.map(e =>
    `<option value="${e.id}" data-name="${safe(e.full_name)}" data-pos="${safe(e.position)}">${safe(e.full_name)} — ${safe(e.position)}</option>`
  ).join('');

  return `
    <div>
      <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Шаг 2. Состав комиссии по проведению СОУТ</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px">Определите кто войдёт в комиссию. Комиссию возглавляет руководитель организации или уполномоченное им лицо.</div>

      ${infoBox('Требования к составу комиссии (ч. 1 ст. 9 №426-ФЗ)',
        'Комиссию по проведению СОУТ возглавляет работодатель или его представитель. В состав комиссии включаются представители работодателя и специалист по охране труда. Число членов комиссии должно быть нечётным. На микропредприятии (до 15 чел.) функции комиссии может выполнять сам руководитель.'
      )}

      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:8px">Текущий состав комиссии (${commission.length} чел.):</div>
        ${commission.length ? memberRows : '<div style="font-size:12px;color:#334155;padding:12px;text-align:center">Комиссия пока не сформирована. Добавьте членов ниже.</div>'}
      </div>

      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:12px">Добавить члена комиссии:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end">
          <div>
            <div style="font-size:11px;color:#475569;margin-bottom:4px">Из списка сотрудников</div>
            <select id="sout-member-emp" style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none" onchange="_soutFillMemberFromEmp(this)">
              <option value="">— выбрать сотрудника —</option>
              ${empOptions}
            </select>
          </div>
          <div>
            <div style="font-size:11px;color:#475569;margin-bottom:4px">Или введите вручную</div>
            <input id="sout-member-name" placeholder="ФИО" style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>
          <div>
            <div style="font-size:11px;color:#475569;margin-bottom:4px">&nbsp;</div>
            <button onclick="_soutAddMember()" style="padding:9px 16px;background:#2563eb;border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">+ Добавить</button>
          </div>
        </div>
        <div style="margin-top:10px">
          <input id="sout-member-pos" placeholder="Должность члена комиссии" style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
        </div>
        <div style="margin-top:8px">
          <div style="font-size:11px;color:#475569;margin-bottom:6px">Роль в комиссии:</div>
          <div style="display:flex;gap:8px">
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:7px 14px;border:1.5px solid rgba(96,165,250,0.5);background:rgba(96,165,250,0.1);border-radius:8px">
              <input type="radio" name="sout-member-role" id="sout-role-chair" value="chair" style="accent-color:#3b82f6">
              <span style="font-size:12px;font-weight:600;color:#93c5fd">Председатель</span>
            </label>
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:7px 14px;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);border-radius:8px">
              <input type="radio" name="sout-member-role" id="sout-role-member" value="member" checked style="accent-color:#3b82f6">
              <span style="font-size:12px;font-weight:600;color:#94a3b8">Член комиссии</span>
            </label>
          </div>
          <div style="font-size:10.5px;color:#334155;margin-top:5px">Председатель — руководитель или уполномоченный им сотрудник. Членов комиссии может быть несколько.</div>
        </div>
      </div>

      ${commission.length > 0 && commission.filter(m => m.is_chair).length === 0
        ? warnBox('Не назначен председатель комиссии. Отметьте одного из членов как председателя.')
        : ''}

      ${stepNav(() => '_soutPrevStep()', () => '_soutNextStep()')}
    </div>`;
}

// ─── ШАГ 3: Проверочные листы ────────────────────────────
function renderSoutStep3() {
  const worksheets = _soutData.worksheets || [];

  // Если не заполнены рабочие места — инициализируем из сотрудников
  if (!worksheets.length && _soutEmployees.length) {
    _soutData.worksheets = _soutEmployees.map(e => ({
      employee_id: e.id,
      full_name: e.full_name,
      position: e.position,
      department: e.department || '',
      factors: {},
      date_acquainted: '',
    }));
  }

  const sheets = _soutData.worksheets || [];
  const anyYes = sheets.some(s => Object.values(s.factors || {}).some(v => v));

  const sheetHtml = sheets.map((s, si) => {
    const hasYes = Object.values(s.factors || {}).some(v => v);
    return `
      <div style="background:rgba(255,255,255,0.02);border:1px solid ${hasYes ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)'};border-radius:10px;padding:16px;margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:13px;font-weight:600;color:#e2e8f0">РМ ${si + 1}: ${safe(s.position)}</div>
            <div style="font-size:11px;color:#475569">${safe(s.full_name)}</div>
          </div>
          ${hasYes
            ? `<div style="font-size:11px;color:#f87171;padding:4px 10px;background:rgba(248,113,113,0.1);border-radius:6px">Выявлены факторы!</div>`
            : `<div style="font-size:11px;color:#34d399;padding:4px 10px;background:rgba(52,211,153,0.08);border-radius:6px">Факторы не выявлены</div>`
          }
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          ${SOUT_FACTORS_SHORT.map((f, fi) => {
            const checked = !!(s.factors && s.factors[`f${fi + 1}`]);
            return `
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:6px 8px;background:${checked ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.01)'};border:1px solid ${checked ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)'};border-radius:6px;transition:all .15s">
                <input type="checkbox" data-si="${si}" data-fi="${fi + 1}" onchange="_soutToggleFactor(this)" ${checked ? 'checked' : ''} style="width:13px;height:13px;cursor:pointer;accent-color:#ef4444">
                <span style="font-size:10.5px;color:${checked ? '#fca5a5' : '#64748b'};line-height:1.3">${f}</span>
              </label>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  return `
    <div>
      <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Шаг 3. Проверочные листы</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px">Заполните проверочный лист для каждого рабочего места. Отметьте факторы, которые присутствуют на рабочем месте.</div>

      ${infoBox('Как заполнять проверочный лист',
        'Для каждого рабочего места ответьте: присутствует ли данный фактор? Если на офисном рабочем месте нет вредных веществ, шума, вибрации и излучений — все ответы НЕТ (не отмечены). Если хотя бы один ответ ДА — потребуется привлечение аккредитованной организации для измерения этого фактора.'
      )}

      ${anyYes ? warnBox('На одном или нескольких рабочих местах выявлены потенциально вредные факторы. Для этих рабочих мест необходимо привлечение аккредитованной организации СОУТ для проведения измерений.') : ''}

      ${sheets.length === 0 ? `
        <div style="text-align:center;padding:32px;color:#475569">
          <div style="font-size:13px">Сотрудники клиента не добавлены</div>
          <div style="font-size:11px;margin-top:4px">Добавьте сотрудников в карточке клиента, затем вернитесь к СОУТ</div>
        </div>` : sheetHtml
      }

      ${stepNav(() => '_soutPrevStep()', () => '_soutNextStep()')}
    </div>`;
}

// ─── ШАГ 4: Дата и подтверждение ─────────────────────────
function renderSoutStep4() {
  const anyYes = (_soutData.worksheets || []).some(s => Object.values(s.factors || {}).some(v => v));

  return `
    <div>
      <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Шаг 4. Дата протокола и подтверждение</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px">Укажите дату проведения заседания комиссии. Это дата, которая появится во всех документах СОУТ.</div>

      ${infoBox('Что происходит на заседании комиссии',
        'Комиссия рассматривает проверочные листы по каждому рабочему месту и принимает решение. Протокол подписывают все члены комиссии. На основании протокола формируется декларация, которую нужно направить в ГИТ в течение 30 рабочих дней.'
      )}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div>
          <div style="font-size:11px;color:#475569;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Дата заседания комиссии / протокола</div>
          <input type="date" id="sout-protocol-date" value="${_soutData.protocol_date || ''}" onchange="_soutData.protocol_date=this.value"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          <div style="font-size:10.5px;color:#334155;margin-top:4px">С этой даты отсчитывается 30 рабочих дней для подачи декларации</div>
        </div>
        <div>
          <div style="font-size:11px;color:#475569;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Номер приказа о создании комиссии</div>
          <input type="text" id="sout-order-num" value="${_soutData.order_num || '1'}" onchange="_soutData.order_num=this.value" placeholder="1"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
      </div>

      <!-- Замещение -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:20px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:12px">
          <input type="checkbox" id="sout-has-sub" ${_soutData.has_substitution ? 'checked' : ''} onchange="_soutToggleSubstitution(this)" style="width:15px;height:15px">
          <div>
            <div style="font-size:13px;font-weight:600;color:#e2e8f0">Есть сотрудник в отпуске/на замещении</div>
            <div style="font-size:11px;color:#475569">Если кто-то из сотрудников временно отсутствует, СОУТ проводится с его заместителем, а после выхода — ознакомление</div>
          </div>
        </label>
        <div id="sout-sub-fields" style="display:${_soutData.has_substitution ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div style="font-size:11px;color:#475569;margin-bottom:4px">ФИО отсутствующего</div>
            <input id="sout-sub-from-name" value="${safe((_soutData.substitution || {}).from_name || '')}" placeholder="Иванова А.А."
              style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>
          <div>
            <div style="font-size:11px;color:#475569;margin-bottom:4px">Должность отсутствующего</div>
            <input id="sout-sub-from-pos" value="${safe((_soutData.substitution || {}).from_position || '')}" placeholder="Юрист"
              style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>
          <div>
            <div style="font-size:11px;color:#475569;margin-bottom:4px">ФИО заместителя</div>
            <input id="sout-sub-to-name" value="${safe((_soutData.substitution || {}).to_name || '')}" placeholder="Петров И.И."
              style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>
          <div>
            <div style="font-size:11px;color:#475569;margin-bottom:4px">Причина отсутствия</div>
            <input id="sout-sub-reason" value="${safe((_soutData.substitution || {}).reason || '')}" placeholder="Декретный отпуск"
              style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>
        </div>
      </div>

      ${anyYes ? warnBox('Внимание: на некоторых рабочих местах выявлены вредные факторы. Для этих рабочих мест документы СОУТ будут сформированы, но потребуется привлечение аккредитованной организации для измерений.') : ''}

      <!-- Итоговая сводка -->
      <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:10px">Сводка перед формированием документов:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${summaryItem('Членов комиссии', String((_soutData.commission || []).length))}
          ${summaryItem('Рабочих мест', String((_soutData.worksheets || []).length))}
          ${summaryItem('Документов будет сформировано', String(7 + (_soutData.worksheets || []).length + (_soutData.has_substitution ? 2 : 0)))}
        </div>
      </div>

      ${stepNav(() => '_soutPrevStep()', () => '_soutSaveAndGenerate()')}
    </div>`;
}

// ─── ШАГ 5: Результат ────────────────────────────────────
function renderSoutStep5() {
  const status = _soutData.declaration_status || 'pending';

  return `
    <div>
      <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Шаг 5. Документы сформированы</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px">Все документы СОУТ готовы. Следуйте инструкции для завершения процедуры.</div>

      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:10px;margin-bottom:20px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
        <div>
          <div style="font-size:14px;font-weight:700;color:#34d399">Пакет документов сформирован</div>
          <div style="font-size:12px;color:#475569;margin-top:2px">Папка: СОУТ / СОУТ ${safe(_soutData.protocol_date || '')}</div>
        </div>
        <button onclick="_soutOpenFolder()" style="margin-left:auto;padding:8px 16px;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);border-radius:8px;color:#34d399;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
          Открыть папку
        </button>
      </div>

      <!-- Дальнейшие шаги -->
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:10px">Что делать дальше:</div>
        ${nextStep('1', 'Распечатайте и подпишите СОУТ-01, СОУТ-02', 'Сегодня', 'Руководитель + все члены комиссии')}
        ${nextStep('2', 'Распечатайте проверочные листы СОУТ-03', 'Сегодня', 'Подписи председателя и членов комиссии внизу каждого листа')}
        ${nextStep('3', 'Ознакомьте каждого сотрудника под подпись', '30 календарных дней', 'Каждый сотрудник ставит подпись в своём листе')}
        ${nextStep('4', 'Подайте декларацию в ГИТ через declaration.rostrud.gov.ru', '30 рабочих дней с даты протокола', 'Файл: СОУТ-06. Подробная инструкция — в файле СОУТ-08')}
        ${nextStep('5', 'Сохраните все документы в папке СОУТ не менее 50 лет', 'Постоянно', 'Статья 22.1 Приказа №558н')}
      </div>

      <!-- Дата ознакомления сотрудников -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:4px">Дата ознакомления сотрудников с результатами:</div>
        <div style="font-size:10.5px;color:#475569;margin-bottom:12px">Заполните по мере того как сотрудники подписывают свои проверочные листы. Срок — 30 календарных дней с даты протокола (${fmtSoutDate(_soutData.protocol_date)}).</div>
        ${(_soutData.worksheets || []).map((s, si) => `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <div style="flex:1;font-size:12px;color:#cbd5e1">${safe(s.full_name)} <span style="color:#475569">— ${safe(s.position)}</span></div>
            <input type="date" data-si="${si}" value="${s.date_acquainted || ''}" onchange="_soutSetAcquaintDate(this)"
              style="padding:5px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#f1f5f9;font-size:11px;outline:none">
          </div>`).join('')}
      </div>

      <!-- Статус декларации -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:10px">Статус декларации:</div>
        <div style="display:flex;gap:8px">
          ${['pending','submitted','registered'].map(s => `
            <button onclick="_soutSetDeclStatus('${s}')" style="padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;
              background:${status === s ? statusBg(s) : 'rgba(255,255,255,0.03)'};
              border:1px solid ${status === s ? statusBorder(s) : 'rgba(255,255,255,0.08)'};
              color:${status === s ? statusColor(s) : '#475569'}">
              ${statusLabel(s)}
            </button>`).join('')}
        </div>
        ${status === 'registered' ? `
          <div style="margin-top:10px">
            <div style="font-size:11px;color:#475569;margin-bottom:4px">Регистрационный номер декларации:</div>
            <input id="sout-reg-num" value="${safe(_soutData.declaration_reg_number || '')}" placeholder="Введите номер из ГИТ"
              onchange="_soutData.declaration_reg_number=this.value;_soutAutoSave()"
              style="width:100%;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box">
          </div>` : ''}
      </div>

      <div style="display:flex;gap:10px">
        <button onclick="_soutPrevStep()" style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer">
          ← Назад
        </button>
        <button onclick="navigate('client',currentClientId)" style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">
          Готово — вернуться к карточке клиента
        </button>
      </div>
    </div>`;
}

// ─── Вспомогательные компоненты ───────────────────────────
function infoBox(title, text) {
  return `<div style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.2);border-radius:8px;padding:12px 14px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:#93c5fd;margin-bottom:4px">${title}</div>
    <div style="font-size:11px;color:#64748b;line-height:1.6">${text}</div>
  </div>`;
}

function warnBox(text) {
  return `<div style="display:flex;align-items:flex-start;gap:10px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:12px 14px;margin-bottom:16px">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <div style="font-size:11px;color:#94a3b8;line-height:1.6">${text}</div>
  </div>`;
}

function checkCard(title, value, status, desc) {
  const colors = { ok: '#34d399', warn: '#fbbf24', error: '#f87171' };
  const bgs = { ok: 'rgba(52,211,153,0.06)', warn: 'rgba(251,191,36,0.06)', error: 'rgba(248,113,113,0.06)' };
  const borders = { ok: 'rgba(52,211,153,0.2)', warn: 'rgba(251,191,36,0.2)', error: 'rgba(248,113,113,0.2)' };
  return `<div style="background:${bgs[status]};border:1px solid ${borders[status]};border-radius:10px;padding:14px">
    <div style="font-size:11px;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">${title}</div>
    <div style="font-size:18px;font-weight:700;color:${colors[status]};margin-bottom:4px">${value}</div>
    <div style="font-size:11px;color:#64748b;line-height:1.4">${desc}</div>
  </div>`;
}

function stepNav(prevFn, nextFn) {
  return `<div style="display:flex;gap:10px;margin-top:20px">
    ${prevFn ? `<button onclick="${prevFn()}" style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer">← Назад</button>` : '<div style="flex:1"></div>'}
    ${nextFn ? `<button onclick="${nextFn()}" style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Далее →</button>` : ''}
  </div>`;
}

function nextStep(num, action, deadline, who) {
  return `<div style="display:flex;gap:12px;padding:10px 14px;margin-bottom:8px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid rgba(255,255,255,0.05)">
    <div style="width:22px;height:22px;border-radius:50%;background:#1e3a5f;border:1.5px solid #3b82f6;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#93c5fd;flex-shrink:0">${num}</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:600;color:#e2e8f0">${action}</div>
      <div style="font-size:11px;color:#475569;margin-top:2px">Срок: ${deadline} · ${who}</div>
    </div>
  </div>`;
}

function summaryItem(label, value) {
  return `<div style="text-align:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
    <div style="font-size:20px;font-weight:700;color:#93c5fd">${value}</div>
    <div style="font-size:10.5px;color:#475569;margin-top:2px">${label}</div>
  </div>`;
}

function statusLabel(s) { return s === 'pending' ? 'Не подана' : s === 'submitted' ? 'Подана в ГИТ' : 'Зарегистрирована'; }
function statusBg(s) { return s === 'pending' ? 'rgba(251,191,36,0.1)' : s === 'submitted' ? 'rgba(96,165,250,0.1)' : 'rgba(52,211,153,0.1)'; }
function statusBorder(s) { return s === 'pending' ? 'rgba(251,191,36,0.3)' : s === 'submitted' ? 'rgba(96,165,250,0.3)' : 'rgba(52,211,153,0.3)'; }
function statusColor(s) { return s === 'pending' ? '#fbbf24' : s === 'submitted' ? '#60a5fa' : '#34d399'; }

// ─── ШАГ 3 (общий порядок): Документы для аккредитованной организации ───
function renderSoutStepGeneralFinal() {
  const generated = !!_soutData._folder;

  return `
    <div>
      <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Шаг 3. Документы для передачи в аккредитованную организацию</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px">КомплаенсПро сформирует приказ о создании комиссии и перечень рабочих мест — эти документы понадобятся при заключении договора с аккредитованной организацией.</div>

      ${infoBox('Что будет сформировано',
        'Приказ о создании комиссии по СОУТ и перечень рабочих мест, подлежащих специальной оценке. Дальнейшую работу — измерения, карты СОУТ и декларацию — выполняет аккредитованная организация.'
      )}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div>
          <div style="font-size:11px;color:#475569;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Дата приказа</div>
          <input type="date" id="sout-protocol-date" value="${_soutData.protocol_date || ''}" onchange="_soutData.protocol_date=this.value;_soutAutoSave()"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:11px;color:#475569;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Номер приказа</div>
          <input type="text" id="sout-order-num" value="${_soutData.order_num || '1'}" onchange="_soutData.order_num=this.value;_soutAutoSave()" placeholder="1"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
      </div>

      ${generated ? `
        <div style="display:flex;align-items:center;gap:12px;padding:16px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:10px;margin-bottom:20px">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            <div style="font-size:14px;font-weight:700;color:#34d399">Документы сформированы</div>
            <div style="font-size:12px;color:#475569;margin-top:2px">Папка: СОУТ / СОУТ ${safe(_soutData.protocol_date || '')}</div>
          </div>
          <button onclick="_soutOpenFolder()" style="margin-left:auto;padding:8px 16px;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);border-radius:8px;color:#34d399;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
            Открыть папку
          </button>
        </div>` : ''
      }

      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="_soutPrevStep()" style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer">← Назад</button>
        ${generated
          ? `<button onclick="navigate('client',currentClientId)" style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Готово — вернуться к карточке клиента</button>`
          : `<button onclick="_soutGenerateGeneralDocs()" style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Сформировать документы →</button>`
        }
      </div>
    </div>`;
}

async function _soutGenerateGeneralDocs() {
  const btn = document.querySelector('button[onclick="_soutGenerateGeneralDocs()"]');
  if (btn) { btn.textContent = 'Формирую…'; btn.disabled = true; }
  try {
    // Для общего порядка формируем только приказ и перечень рабочих мест —
    // worksheets нужны для перечня (список должностей), но без факторов и проверочных листов
    const dataForGen = {
      ..._soutData,
      worksheets: _soutEmployees.map(e => ({ employee_id: e.id, full_name: e.full_name, position: e.position, department: e.department || '', factors: {} })),
      _generalMode: true,
    };
    const result = await window.api.soutGenerate(currentClientId, dataForGen);
    _soutData._folder = result.folder;
    await window.api.soutSave(currentClientId, _soutData);
    renderSoutStep();
    showToast('Документы сформированы ✓');
  } catch(e) {
    showToast('Ошибка формирования: ' + (e.message || e), 'var(--red)');
    if (btn) { btn.textContent = 'Сформировать документы →'; btn.disabled = false; }
  }
}

// ─── Инструкция по общему порядку СОУТ (через аккредитованную организацию) ───
function renderGeneralProcedureGuide(eligible) {
  return `
    <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(248,113,113,0.2);border-radius:12px;padding:18px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><path d="M9 11l3 3L22 4"/><circle cx="12" cy="12" r="10"/></svg>
        <div style="font-size:13px;font-weight:700;color:#f1f5f9">Как провести СОУТ в общем порядке</div>
      </div>

      ${generalStep('1', 'Выбор аккредитованной организации',
        'Реестр организаций, проводящих СОУТ — на сайте Минтруда: <span style="color:#60a5fa">akot.rosmintrud.ru</span>. Запросите коммерческое предложение у 2-3 организаций. Перед подписанием договора проверьте действующую аккредитацию в реестре.')}

      ${generalStep('2', 'Что подготовить для организации',
        'Список рабочих мест и должностей, штатное расписание, технологические карты (при наличии производства), данные о применяемом оборудовании и материалах.')}

      ${generalStep('3', 'Что делает работодатель самостоятельно',
        'Создаёт комиссию по СОУТ (приказ — КомплаенсПро сформирует автоматически), утверждает перечень рабочих мест, организует доступ эксперта организации к рабочим местам.')}

      ${generalStep('4', 'После получения отчёта от организации',
        'Аккредитованная организация сама формирует и передаёт заполненную декларацию вместе с картами СОУТ. Вам останется подписать декларацию и направить её через declaration.rostrud.gov.ru либо почтой в бумажном виде. Ознакомление сотрудников с результатами фиксируется прямо в карте СОУТ, которую готовит организация — отдельный документ не требуется. Сохраните все документы не менее 50 лет.')}

      <div style="margin-top:14px;padding:12px 14px;background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.2);border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:#93c5fd;margin-bottom:4px">Чем может помочь КомплаенсПро</div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6">Приказ о создании комиссии · Перечень рабочих мест для передачи аккредитованной организации</div>
      </div>
    </div>`;
}

function generalStep(num, title, text) {
  return `<div style="display:flex;gap:12px;margin-bottom:12px">
    <div style="width:22px;height:22px;border-radius:50%;background:rgba(248,113,113,0.12);border:1.5px solid rgba(248,113,113,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#f87171;flex-shrink:0">${num}</div>
    <div>
      <div style="font-size:12.5px;font-weight:600;color:#e2e8f0;margin-bottom:3px">${title}</div>
      <div style="font-size:11.5px;color:#64748b;line-height:1.65">${text}</div>
    </div>
  </div>`;
}

// ─── Проверка права на упрощённый порядок ────────────────
function checkSoutEligibility(client, employees) {
  const today = new Date();
  const isNewRules = today >= SOUT_NEW_RULES_DATE;
  const staff = parseInt(client.staff || 0);
  const okved = (client.okved || '').split('.')[0];

  // Актуальный перечень в зависимости от даты
  const eligibleList = isNewRules ? SOUT_OKVED_POST_SEP : SOUT_OKVED_PRE_SEP;
  const okvedOk = eligibleList.includes(okved);

  // ОКВЭД не входит ни в текущий, ни в будущий (после 01.09.2026) перечень —
  // упрощённый порядок недоступен в принципе, а не временно
  const okvedNeverEligible = !SOUT_OKVED_PRE_SEP.includes(okved) && !SOUT_OKVED_POST_SEP.includes(okved);

  // Лимит численности: до 01.09.2026 — только микро (≤15), после — малые (≤100)
  const staffLimit = isNewRules ? 100 : 15;
  const staffOk = staff > 0 && staff <= staffLimit;

  // Проверка смешанного состава сотрудников
  const highRiskEmps = (employees || []).filter(e => {
    const pos = (e.position || '').toLowerCase();
    return SOUT_HIGH_RISK_POSITIONS.some(kw => pos.includes(kw));
  });

  // Предупреждение о смешанном составе
  const mixedWarning = highRiskEmps.length > 0
    ? `Обнаружены должности повышенного риска: ${highRiskEmps.map(e => e.position).join(', ')}. Для этих рабочих мест потребуется аккредитованная организация.`
    : null;

  // Нужна инструкция по общему порядку — численность превышена ИЛИ ОКВЭД
  // никогда не попадёт в перечень упрощённого порядка
  const generalProcedureNeeded = !staffOk || okvedNeverEligible;

  // Формируем результат — больше нет жёсткой блокировки по ОКВЭД
  if (!staffOk) {
    return {
      ok: false,
      warn: false,
      okvedOk,
      okvedNeverEligible,
      generalProcedureNeeded,
      isNewRules,
      staffLimit,
      mixedWarning,
      reason: `Численность ${staff} чел. превышает лимит ${staffLimit} чел. для упрощённого порядка${isNewRules ? ' (малые предприятия)' : ' (микропредприятия)'}. Потребуется аккредитованная организация.`,
    };
  }

  if (okvedNeverEligible) {
    return {
      ok: false,
      warn: false,
      okvedOk: false,
      okvedNeverEligible: true,
      generalProcedureNeeded: true,
      isNewRules,
      staffLimit,
      mixedWarning,
      reason: `Вид деятельности по ОКВЭД ${okved} не входит в перечень ПП №1830 ни сейчас, ни после 01.09.2026. Требуется аккредитованная организация.`,
    };
  }

  if (!okvedOk) {
    // Не блокируем — только предупреждаем (ОКВЭД появится в перечне после 01.09.2026)
    return {
      ok: true,  // разрешаем продолжить
      warn: true, // но показываем предупреждение
      okvedOk: false,
      okvedNeverEligible: false,
      generalProcedureNeeded: false,
      isNewRules,
      staffLimit,
      mixedWarning,
      reason: `ОКВЭД ${okved} не найден в перечне ПП №1830${isNewRules ? ' (ред. от 26.01.2026 №39)' : ' — но появится в нём с 01.09.2026'}. Уточните у специалиста применимость упрощённого порядка. Если уверены — продолжайте.`,
    };
  }

  return {
    ok: true,
    warn: !!mixedWarning,
    okvedOk: true,
    okvedNeverEligible: false,
    generalProcedureNeeded: false,
    isNewRules,
    staffLimit,
    mixedWarning,
    reason: null,
  };
}

// ─── Обработчики событий ──────────────────────────────────
function _soutNextStep() {
  // Валидация перед переходом
  if (_soutStep === 2) {
    if (!_soutData.commission || !_soutData.commission.length) {
      showToast('Добавьте хотя бы одного члена комиссии', 'var(--amber)');
      return;
    }
    if (!_soutData.commission.some(m => m.is_chair)) {
      showToast('Назначьте председателя комиссии', 'var(--amber)');
      return;
    }
  }
  _soutStep = Math.min(5, _soutStep + 1);
  _soutAutoSave();
  renderSoutStep();
}

function _soutPrevStep() {
  _soutStep = Math.max(1, _soutStep - 1);
  renderSoutStep();
}

function _soutAddMember() {
  const empSel = document.getElementById('sout-member-emp');
  const nameInp = document.getElementById('sout-member-name');
  const posInp = document.getElementById('sout-member-pos');
  const isChair = document.getElementById('sout-role-chair')?.checked;

  const name = (empSel?.options[empSel.selectedIndex]?.dataset?.name || nameInp?.value || '').trim();
  const pos = (empSel?.options[empSel.selectedIndex]?.dataset?.pos || posInp?.value || '').trim();

  if (!name || !pos) { showToast('Укажите ФИО и должность члена комиссии', 'var(--amber)'); return; }

  if (!_soutData.commission) _soutData.commission = [];
  if (isChair) _soutData.commission.forEach(m => m.is_chair = false);
  _soutData.commission.push({ name, position: pos, is_chair: !!isChair });
  _soutAutoSave();
  renderSoutStep();
}

function _soutFillMemberFromEmp(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  const nameInp = document.getElementById('sout-member-name');
  const posInp = document.getElementById('sout-member-pos');
  if (nameInp) nameInp.value = opt.dataset.name || '';
  if (posInp) posInp.value = opt.dataset.pos || '';
}

function _soutRemoveMember(i) {
  if (_soutData.commission) {
    _soutData.commission.splice(i, 1);
    _soutAutoSave();
    renderSoutStep();
  }
}

function _soutToggleFactor(cb) {
  const si = parseInt(cb.dataset.si);
  const fi = parseInt(cb.dataset.fi);
  if (!_soutData.worksheets[si].factors) _soutData.worksheets[si].factors = {};
  _soutData.worksheets[si].factors[`f${fi}`] = cb.checked;
  _soutAutoSave();
  // Обновляем цвет карточки без перерендера
  const card = cb.closest('[style*="border-radius:10px"]');
  if (card) {
    const hasYes = Object.values(_soutData.worksheets[si].factors).some(v => v);
    card.style.borderColor = hasYes ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)';
    const badge = card.querySelector('[style*="border-radius:6px"]');
    if (badge) {
      badge.textContent = hasYes ? 'Выявлены факторы!' : 'Факторы не выявлены';
      badge.style.color = hasYes ? '#f87171' : '#34d399';
      badge.style.background = hasYes ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.08)';
    }
  }
}

function _soutSetAcquaintDate(inp) {
  const si = parseInt(inp.dataset.si);
  if (_soutData.worksheets[si]) _soutData.worksheets[si].date_acquainted = inp.value;
  _soutAutoSave();
}

function _soutToggleSubstitution(cb) {
  _soutData.has_substitution = cb.checked;
  const fields = document.getElementById('sout-sub-fields');
  if (fields) fields.style.display = cb.checked ? 'grid' : 'none';
  _soutAutoSave();
}

async function _soutSaveAndGenerate() {
  // Сохраняем данные замещения перед генерацией
  if (_soutData.has_substitution) {
    _soutData.substitution = {
      from_name:     document.getElementById('sout-sub-from-name')?.value?.trim() || '',
      from_position: document.getElementById('sout-sub-from-pos')?.value?.trim() || '',
      to_name:       document.getElementById('sout-sub-to-name')?.value?.trim() || '',
      reason:        document.getElementById('sout-sub-reason')?.value?.trim() || '',
    };
  }
  _soutData.protocol_date = document.getElementById('sout-protocol-date')?.value || _soutData.protocol_date;
  _soutData.order_num = document.getElementById('sout-order-num')?.value || _soutData.order_num;

  const btn = document.querySelector('button[onclick="_soutSaveAndGenerate()"]');
  if (btn) { btn.textContent = 'Формирую документы…'; btn.disabled = true; }

  try {
    const result = await window.api.soutGenerate(currentClientId, _soutData);
    _soutData._folder = result.folder;
    _soutData.declaration_status = _soutData.declaration_status || 'pending';
    await window.api.soutSave(currentClientId, _soutData);
    _soutStep = 5;
    renderSoutStep();
    showToast('Документы СОУТ сформированы ✓');
  } catch(e) {
    showToast('Ошибка формирования: ' + (e.message || e), 'var(--red)');
    if (btn) { btn.textContent = 'Сформировать документы →'; btn.disabled = false; }
  }
}

function _soutSetDeclStatus(status) {
  _soutData.declaration_status = status;
  _soutAutoSave();
  renderSoutStep();
}

function _soutOpenFolder() {
  if (_soutData._folder) window.api.docsOpenFolder(_soutData._folder);
}

async function _soutAutoSave() {
  if (currentClientId && _soutData) {
    try { await window.api.soutSave(currentClientId, _soutData); } catch(_) {}
  }
}

function safe(v) { return String(v || ''); }
function fmtSoutDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('ru-RU'); } catch(_) { return d; } }
