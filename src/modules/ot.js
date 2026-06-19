// ============================================================
// КОМПЛАЕНСПРО — ot.js
// Охрана труда: справочник модуля
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================

// ══════════════════════════════════════════════════════════
// МОДУЛЬ: ОХРАНА ТРУДА — СПРАВОЧНИК
// ══════════════════════════════════════════════════════════

async function renderOt() {
  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';

  const [npaFeedFull, s] = await Promise.all([
    window.api.npaList('ot'),
    window.api.settingsGet(),
  ]);
  const npaFeed = npaFeedFull.slice(0, 30);
  const unseenCount = npaFeedFull.filter(n => !n.seen).length;
  const lastCheck = s.npa_last_check_date
    ? new Date(s.npa_last_check_date).toLocaleDateString('ru-RU')
    : '';

  const npa = [
    { title: 'Трудовой кодекс РФ, раздел X', date: '30.12.2001', desc: 'Охрана труда — основные права и обязанности', url: 'https://www.consultant.ru/document/cons_doc_LAW_34683/' },
    { title: 'Приказ Минтруда №771н', date: '29.10.2021', desc: 'Примерное положение о системе управления охраной труда', url: 'https://www.consultant.ru/document/cons_doc_LAW_399350/' },
    { title: 'Приказ Минтруда №2н', date: '29.01.2021', desc: 'Правила обеспечения работников СИЗ', url: 'https://www.consultant.ru/document/cons_doc_LAW_379283/' },
    { title: 'Приказ Минтруда №776н', date: '29.10.2021', desc: 'Примерное положение о комитете (комиссии) по охране труда', url: 'https://www.consultant.ru/document/cons_doc_LAW_401112/' },
    { title: 'Приказ Минтруда №782н', date: '29.10.2021', desc: 'Порядок обучения по охране труда (ЕТКС, профстандарты)', url: 'https://www.consultant.ru/document/cons_doc_LAW_401869/' },
    { title: 'Приказ Минздрава №29н', date: '28.01.2021', desc: 'Порядок проведения обязательных медосмотров', url: 'https://www.consultant.ru/document/cons_doc_LAW_378424/' },
    { title: 'Федеральный закон №426-ФЗ', date: '28.12.2013', desc: 'О специальной оценке условий труда (СОУТ)', url: 'https://www.consultant.ru/document/cons_doc_LAW_156555/' },
    { title: 'Постановление Правительства №1101', date: '24.12.2021', desc: 'О расследовании несчастных случаев на производстве', url: 'https://www.consultant.ru/document/cons_doc_LAW_402503/' },
  ];

  const sections = [
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)',
      title: 'СОУТ',
      desc: 'Специальная оценка условий труда — обязательна для всех рабочих мест',
      fine: 'до 80 000 ₽',
      law: 'ч.2 ст.5.27.1 КоАП',
      details: 'Проводится не реже 1 раза в 5 лет. При вводе новых рабочих мест — внеплановая СОУТ в течение 12 месяцев.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)',
      title: 'Обучение по ОТ',
      desc: 'Три программы по ПП РФ №2464: А — общие вопросы ОТ и СУОТ, Б — безопасные методы работ при вредных факторах, В — работы повышенной опасности',
      fine: 'до 130 000 ₽ за каждого',
      law: 'ч.3 ст.5.27.1 КоАП',
      details: 'Программа А — руководители, специалисты, офис (1 раз в 3 года). Программа Б — рабочие профессии, вредные/опасные факторы (1 раз в 3 года). Программа В — работы повышенной опасности, только в аккредитованном центре (1 раз в год или по НПА). Неправильный выбор программы = недействительное обучение.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)',
      title: 'Инструктажи',
      desc: 'Вводный, первичный, повторный, внеплановый, целевой',
      fine: 'до 130 000 ₽',
      law: 'ч.3 ст.5.27.1 КоАП',
      details: 'Повторный инструктаж — не реже 1 раза в 6 месяцев. Вводный — при каждом приёме на работу. Регистрация в журналах обязательна.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)',
      title: 'СИЗ',
      desc: 'Средства индивидуальной защиты — выдача, учёт, хранение, списание',
      fine: 'до 150 000 ₽',
      law: 'ч.4 ст.5.27.1 КоАП',
      details: 'Выдача по нормам согласно приказу Минтруда №766н. Обязательный учёт в личных карточках. Замена при выходе из строя — немедленно.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
      color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)',
      title: 'Медосмотры',
      desc: 'Предварительные, периодические, предсменные — по перечню Минздрава',
      fine: 'до 130 000 ₽',
      law: 'ч.3 ст.5.27.1 КоАП',
      details: 'Обязательны для 52 видов работ по приказу Минздрава №29н. Периодические — 1 раз в 1-2 года. Предварительные — при приёме.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.2)',
      title: 'Документация',
      desc: 'Положения, приказы, инструкции по ОТ, программы обучения',
      fine: 'до 80 000 ₽',
      law: 'ч.1 ст.5.27.1 КоАП',
      details: '36+ локальных актов. Инструкции по ОТ — для каждой должности. Пересматриваются не реже 1 раза в 5 лет.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)',
      title: 'Несчастные случаи',
      desc: 'Расследование, оформление актов Н-1, отчётность в ФСС и ГИТ',
      fine: 'до 200 000 ₽ + уголовная',
      law: 'ст.5.27.1, ст.143 УК РФ',
      details: 'Расследование — в течение 3 суток (лёгкий) или 15 суток (тяжёлый/групповой). Акт по форме Н-1 хранится 75 лет.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      color: '#e879f9', bg: 'rgba(232,121,249,0.1)', border: 'rgba(232,121,249,0.2)',
      title: 'Микротравмы',
      desc: 'Учёт и рассмотрение обстоятельств микроповреждений здоровья',
      fine: 'до 80 000 ₽',
      law: 'ст.226 ТК РФ',
      details: 'С 01.03.2022 работодатель обязан вести учёт микротравм. Рассмотрение — в течение суток. Журнал учёта — обязателен.',
    },
  ];

  const calendar = [
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`, title: 'Разработать план мероприятий по ОТ', period: 'Ежегодно', deadline: 'до 31 декабря', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`, title: 'Провести повторный инструктаж всех сотрудников', period: 'Каждые 6 месяцев', deadline: 'январь / июль', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/></svg>`, title: 'Провести периодический медосмотр', period: 'По графику Минздрава №29н', deadline: 'по графику', color: '#60a5fa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`, title: 'Проверка и выдача СИЗ по нормам', period: 'При истечении срока носки', deadline: 'по факту', color: '#34d399' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`, title: 'Подать отчёт по форме 7-травматизм', period: 'Ежегодно', deadline: 'до 25 января', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`, title: 'Пересмотр инструкций по охране труда', period: 'Не реже 1 раза в 5 лет', deadline: 'по дате утверждения', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, title: 'Проверка знаний электробезопасности (I группа)', period: 'Ежегодно', deadline: 'по дате последней проверки', color: '#a78bfa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`, title: 'Внеплановая СОУТ при изменении условий труда', period: 'При вводе новых рабочих мест', deadline: 'в течение 12 мес.', color: '#60a5fa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M12 8v8M8 12h8"/></svg>`, title: 'Проверка первичных средств пожаротушения', period: 'Ежегодно', deadline: 'по графику', color: '#fb923c' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="18" cy="18" r="4"/><path d="M18 16v4M16 18h4"/></svg>`, title: 'Пополнение аптечек первой помощи', period: 'По мере использования', deadline: 'по факту', color: '#34d399' },
  ];

  const processes = [
    {
      title: 'Проведение вводного инструктажа',
      steps: [
        'Разработать и утвердить программу вводного инструктажа (отдельный документ, не Программа А)',
        'Провести инструктаж до начала работы — в первый рабочий день',
        'Охватить темы: общие сведения об организации, правила внутреннего распорядка, основные опасности, СИЗ, действия при НС',
        'Проверить знания: устный опрос или тестирование',
        'Зафиксировать в журнале регистрации вводного инструктажа',
        'Подписи: проводивший инструктаж и инструктируемый',
        'Журнал хранить 45 лет',
      ]
    },
    {
      title: 'Расследование несчастного случая',
      steps: [
        'Немедленно сообщить в ФСС (при тяжёлом/групповом — также в ГИТ, прокуратуру, администрацию)',
        'Создать комиссию по расследованию (приказ в течение 24 часов)',
        'Собрать документы: объяснительные, схему места НС, медзаключение',
        'Провести расследование: лёгкий НС — 3 суток, тяжёлый — 15 суток',
        'Составить акт по форме Н-1 в 3 экземплярах',
        'Направить акт пострадавшему, в ФСС, хранить 75 лет',
        'Учесть в журнале регистрации несчастных случаев',
      ]
    },
    {
      title: 'Обучение по охране труда (программы А, Б, В)',
      steps: [
        'Определить категории работников: офис/руководство → Программа А, рабочие/вредные факторы → Программа Б, работы повышенной опасности → Программа В',
        'Программы А и Б — можно проводить внутри организации (при наличии комиссии) или в учебном центре',
        'Программа В — только в аккредитованном учебном центре',
        'Утвердить состав аттестационной комиссии (не менее 3 человек, прошедших обучение по Программе А)',
        'Провести обучение по утверждённым программам',
        'Провести проверку знаний, оформить протокол',
        'Выдать удостоверения о проверке знаний требований ОТ',
        'Внести данные в реестр обученных (ЕИСОТ с 01.09.2023)',
        'Периодичность: Программы А и Б — 1 раз в 3 года, Программа В — 1 раз в год или по НПА',
      ]
    },
    {
      title: 'Проведение СОУТ',
      steps: [
        'Издать приказ о проведении СОУТ, утвердить состав комиссии',
        'Заключить договор с аккредитованной организацией',
        'Составить перечень рабочих мест, подлежащих СОУТ',
        'Организовать проведение измерений условий труда',
        'Утвердить отчёт о СОУТ в течение 30 дней',
        'Уведомить сотрудников под подпись о результатах',
        'Разместить сводные данные на сайте организации',
        'Подать декларацию в ГИТ для рабочих мест 1-2 класса',
      ]
    },
    {
      title: 'Обеспечение СИЗ',
      steps: [
        'Определить перечень необходимых СИЗ по типовым нормам (приказ №766н)',
        'Разработать локальные нормы выдачи СИЗ (с учётом СОУТ)',
        'Утвердить локальные нормы приказом руководителя',
        'Организовать закупку сертифицированных СИЗ',
        'Выдать СИЗ сотрудникам, зафиксировать в личной карточке',
        'Организовать хранение, стирку, обеззараживание и ремонт СИЗ',
        'Провести инструктаж по применению СИЗ',
      ]
    },
  ];

  const checklist = [
    'Назначен ответственный за ОТ (есть приказ)',
    'Утверждено Положение о системе управления ОТ (СУОТ)',
    'Проведена СОУТ, результаты задекларированы/размещены на сайте',
    'Все сотрудники прошли вводный инструктаж и обучение по ОТ',
    'Проведены периодические медосмотры (при необходимости)',
    'Работники обеспечены СИЗ по нормам, карточки заполнены',
    'Инструкции по ОТ разработаны для каждой должности',
    'Журналы инструктажей ведутся и хранятся правильно',
    'Аптечки укомплектованы, огнетушители в порядке',
    'Журнал учёта микроповреждений заведён и ведётся',
    'Программы обучения по ОТ утверждены',
    'Разработан и утверждён план мероприятий по ОТ на год',
  ];

  const штрафыСводка = [
    { art: 'ч.1 ст.5.27.1', desc: 'Нарушение требований ОТ (общее)', org: '50–80 тыс. ₽', dir: '2–5 тыс. ₽', note: '' },
    { art: 'ч.2 ст.5.27.1', desc: 'Нарушение порядка СОУТ', org: '60–80 тыс. ₽', dir: '5–10 тыс. ₽', note: '' },
    { art: 'ч.3 ст.5.27.1', desc: 'Допуск без обучения — за каждого сотрудника', org: '110–130 тыс. ₽', dir: '15–25 тыс. ₽', note: 'за каждого' },
    { art: 'ч.3 ст.5.27.1', desc: 'Допуск без медосмотра — за каждого сотрудника', org: '110–130 тыс. ₽', dir: '15–25 тыс. ₽', note: 'за каждого' },
    { art: 'ч.4 ст.5.27.1', desc: 'Необеспечение СИЗ — за каждого сотрудника', org: '130–150 тыс. ₽', dir: '20–30 тыс. ₽', note: 'за каждого' },
    { art: 'ч.5 ст.5.27.1', desc: 'Повторное нарушение', org: '100–200 тыс. ₽ / приост.', dir: 'дискв. 1–3 года', note: '' },
  ];

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="display:grid;gap:16px;max-width:960px">

      <!-- Баннер -->
      <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:20px 24px;background:linear-gradient(135deg,rgba(248,113,113,0.1),rgba(251,146,60,0.08));border:1px solid rgba(248,113,113,0.2);border-radius:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#ef4444,#f97316);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(239,68,68,0.35)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Охрана труда</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Обязательна для всех работодателей · ТК РФ, раздел X · 8 направлений контроля</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:280px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Первичное нарушение</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#fbbf24;white-space:nowrap">до 200 000 ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">10 чел. без обучения</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#f87171;white-space:nowrap">до 1 300 000 ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Повторное / НС со смертью</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#ef4444;white-space:nowrap">УК РФ / приост.</span>
          </div>
        </div>
      </div>

      <!-- Изменения в законодательстве -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px">
          <div style="font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px">
            <span>⚖️</span> Изменения в законодательстве
            ${unseenCount > 0 ? `<span style="font-size:10px;font-weight:800;color:#fff;background:#f87171;padding:2px 8px;border-radius:10px">${unseenCount}</span>` : ''}
          </div>
          <button class="btn btn-ghost" style="padding:6px 12px;font-size:11px;flex-shrink:0" onclick="checkNpaNow()">🔄 Проверить сейчас</button>
        </div>
        ${npaFeed.length === 0 ? `
          <div style="text-align:center;padding:22px 10px;color:#475569;font-size:12px;line-height:1.6">
            ${lastCheck ? `Изменений не найдено. Последняя проверка: ${lastCheck}` : 'Проверка ещё не проводилась — нажмите «Проверить сейчас» или подождите автоматической проверки при следующем запуске.'}
          </div>` : (() => {
          const critical   = npaFeed.filter(n => n.tier === 'critical' && n.ai_verified);
          const unverified = npaFeed.filter(n => n.tier === 'critical' && !n.ai_verified);
          const general    = npaFeed.filter(n => n.tier === 'general');

          function renderCard(n) {
            const dateStr = (n.documentDate || n.created_at || '').slice(0, 10);
            const borderColor = n.ai_verified ? '#f87171' : n.tier === 'critical' ? '#fb923c' : '#334155';
            return `
              <div style="padding:12px 14px;background:rgba(255,255,255,0.02);border-left:3px solid ${borderColor};border-radius:8px;opacity:${n.seen?0.5:1}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                  <div style="min-width:0">
                    <div style="font-size:10px;color:#475569;margin-bottom:4px">${dateStr}${n.matched ? ` · ${n.matched}` : ''}</div>
                    <div style="font-size:12.5px;color:var(--text);font-weight:600;line-height:1.4">${n.title || ''}</div>
                    ${n.ai_summary ? `<div style="font-size:11.5px;color:#94a3b8;margin-top:7px;line-height:1.5">${n.ai_summary}</div>` : ''}
                  </div>
                  ${!n.seen ? `<button class="btn btn-ghost" style="padding:4px 10px;font-size:10px;flex-shrink:0" onclick="markNpaSeen(${n.id})">✓ Просмотрел</button>` : ''}
                </div>
              </div>`;
          }

          function renderGroup(id, label, color, bg, items, openByDefault) {
            if (!items.length) return '';
            return `
              <div style="border:1px solid ${bg};border-radius:10px;overflow:hidden;margin-bottom:8px">
                <div onclick="document.getElementById('npa-group-${id}').style.display=document.getElementById('npa-group-${id}').style.display==='none'?'block':'none'"
                  style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${bg};cursor:pointer;user-select:none">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:11px;font-weight:700;color:${color}">${label}</span>
                    <span style="font-size:10px;font-weight:800;color:#fff;background:${color};padding:1px 7px;border-radius:8px">${items.length}</span>
                  </div>
                  <span style="font-size:10px;color:#64748b">▼</span>
                </div>
                <div id="npa-group-${id}" style="display:${openByDefault?'block':'none'};display:${openByDefault?'block':'none'};padding:10px;display:${openByDefault?'block':'none'}">
                  <div style="display:grid;gap:6px">${items.map(renderCard).join('')}</div>
                </div>
              </div>`;
          }

          return renderGroup('critical', '⚠ Касается шаблонов документов', '#f87171', 'rgba(248,113,113,0.08)', critical, true)
               + renderGroup('unverified', '? Требует проверки', '#fb923c', 'rgba(251,146,60,0.08)', unverified, true)
               + renderGroup('general', 'Общая лента по охране труда', '#64748b', 'rgba(255,255,255,0.03)', general, false);
        })()}
      </div>

      <!-- 8 направлений -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          8 направлений охраны труда
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          ${sections.map(s => `
            <div style="padding:14px;background:${s.bg};border:1px solid ${s.border};border-radius:12px;cursor:default;transition:transform .15s"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
              <div style="width:36px;height:36px;border-radius:10px;background:${s.bg};border:1px solid ${s.border};display:flex;align-items:center;justify-content:center;margin-bottom:10px;color:${s.color}">${s.icon}</div>
              <div style="font-size:13px;font-weight:700;color:${s.color};margin-bottom:4px">${s.title}</div>
              <div style="font-size:10px;color:#64748b;line-height:1.5;margin-bottom:8px">${s.desc}</div>
              <div style="font-size:10px;color:#475569;line-height:1.4">${s.details}</div>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:10px;font-weight:700;color:${s.color}">${s.fine}</span>
                <span style="font-size:9px;color:#334155">${s.law}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Таблица штрафов -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          Штрафы по ст. 5.27.1 КоАП РФ
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:rgba(255,255,255,0.03)">
                <th style="padding:10px 14px;text-align:left;color:#475569;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">Статья</th>
                <th style="padding:10px 14px;text-align:left;color:#475569;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">Нарушение</th>
                <th style="padding:10px 14px;text-align:right;color:#f87171;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">Юр. лицо</th>
                <th style="padding:10px 14px;text-align:right;color:#fbbf24;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">Должн. лицо</th>
              </tr>
            </thead>
            <tbody>
              ${штрафыСводка.map((r, i) => `
                <tr style="background:${i%2===0?'transparent':'rgba(255,255,255,0.01)'}">
                  <td style="padding:10px 14px;color:#60a5fa;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap">${r.art}</td>
                  <td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.04)">
                    ${r.desc}
                    ${r.note ? `<span style="margin-left:6px;font-size:9px;font-weight:800;color:#f87171;background:rgba(248,113,113,0.12);padding:2px 6px;border-radius:4px;white-space:nowrap">× ${r.note}</span>` : ''}
                  </td>
                  <td style="padding:10px 14px;text-align:right;font-weight:700;color:#f87171;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap">${r.org}</td>
                  <td style="padding:10px 14px;text-align:right;font-weight:700;color:#fbbf24;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap">${r.dir}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Нормативная база -->
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

      <!-- Производственный календарь -->
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

      <!-- Типовые процессы -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>⚙️</span> Типовые процессы
        </div>
        <div style="display:grid;gap:8px">
          ${processes.map(p => `
            <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
              <summary style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:rgba(248,113,113,0.06);cursor:pointer;font-weight:600;color:#f87171;font-size:13px;list-style:none"
                onmouseover="this.style.background='rgba(248,113,113,0.1)'" onmouseout="this.style.background='rgba(248,113,113,0.06)'">
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

      <!-- Чек-лист -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>✅</span> Базовый чек-лист
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
          ${checklist.map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:12px;color:#64748b">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" flex-shrink:0><polyline points="20 6 9 17 4 12"/></svg>
              ${item}
            </div>`).join('')}
        </div>
      </div>

      <!-- Правовое основание -->
      <div style="font-size:10px;color:#334155;padding:10px 14px;background:rgba(255,255,255,0.01);border-radius:8px;line-height:1.7">
        ТК РФ раздел X · Приказ Минтруда №771н от 29.10.2021 · Приказ Минтруда №782н от 29.10.2021 · ФЗ №426-ФЗ от 28.12.2013 · Приказ Минздрава №29н от 28.01.2021
      </div>
    </div>`;
}

async function markNpaSeen(id) {
  await window.api.npaMarkSeen(id);
  renderOt();
}

async function checkNpaNow() {
  showToast('Проверяем pravo.gov.ru...');
  try {
    const res = await window.api.npaCheckNow();
    showToast(res && res.ok ? 'Проверка завершена' : 'Не удалось проверить', res && res.ok ? 'var(--green)' : 'var(--red)');
  } catch (e) {
    showToast('Не удалось проверить — нет связи с pravo.gov.ru', 'var(--red)');
  }
  renderOt();
}
