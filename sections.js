'use strict';
// КомплаенсПро sections.js
// Единый реестр разделов документов — источник правды для:
//   1. структуры папок на диске (имя папки = folder);
//   2. группировки документов в приложении (аккордеон по разделам);
//   3. порядка и оформления разделов (order, icon, title).
//
// Чтобы ДОБАВИТЬ новый раздел: добавь объект в SECTIONS[модуль] и
// (если нужно) правило в matchSection(). Больше нигде править не нужно —
// и папка, и вид в приложении подхватятся автоматически.
//
// Нумерация ОТ — сквозная 1–7 (внутренняя, для удобства организации).
// История: бывшие «Раздел 5/6/7» переименованы в 4/5/6, добавлен 7 (Протоколы).

// ─────────────────────────────────────────────────────────────
// РЕЕСТР РАЗДЕЛОВ
// id     — стабильный идентификатор (НЕ меняется при переименовании папки!),
//          используется в БД (документы хранят section = id) и в коде.
// folder — имя папки на диске внутри папки модуля.
// title  — заголовок раздела в приложении.
// icon   — ключ иконки (сопоставляется в UI с ic(...)).
// order  — порядок отображения и нумерация.
// ─────────────────────────────────────────────────────────────
const SECTIONS = {
  OT: [
    { id:'OT_ORDERS',    order:1, folder:'Раздел 1. Организационно-распорядительная документация', title:'Приказы',              icon:'clipboard' },
    { id:'OT_LNA',       order:2, folder:'Раздел 2. Локальные нормативные акты',                    title:'Положения и политика', icon:'book' },
    { id:'OT_ELECTRO',   order:3, folder:'Раздел 3. Электробезопасность',                          title:'Электробезопасность',  icon:'zap' },
    { id:'OT_INSTRUCT',  order:4, folder:'Раздел 4. Инструкции по охране труда',                   title:'Инструкции по ОТ',     icon:'list' },
    { id:'OT_JOURNALS',  order:5, folder:'Раздел 5. Журналы учёта',                                title:'Журналы учёта',        icon:'notebook' },
    { id:'OT_PROGRAMS',  order:6, folder:'Раздел 6. Программы обучения',                           title:'Программы обучения',   icon:'cap' },
    { id:'OT_PROTOCOLS', order:7, folder:'Раздел 7. Протоколы обучения',                           title:'Протоколы обучения',   icon:'check' },
    { id:'OT_OTHER',     order:99, folder:'Прочее',                                                title:'Прочее',               icon:'folder' },
  ],
  PD: [
    { id:'PD_ORDERS',    order:1, folder:'Раздел 1. Приказы',                  title:'Приказы',                icon:'clipboard' },
    { id:'PD_POLICY',    order:2, folder:'Раздел 2. Политика и положение',     title:'Политика и положение',   icon:'book' },
    { id:'PD_CONSENTS',  order:3, folder:'Раздел 3. Согласия и обязательства', title:'Согласия и обязательства', icon:'doc' },
    { id:'PD_JOURNALS',  order:4, folder:'Раздел 4. Журналы',                  title:'Журналы',                icon:'notebook' },
    { id:'PD_ACTS',      order:5, folder:'Раздел 5. Акты',                     title:'Акты',                   icon:'check' },
    { id:'PD_PLANS',     order:6, folder:'Раздел 6. Планы',                    title:'Планы',                  icon:'calendar' },
    { id:'PD_INSTRUCT',  order:7, folder:'Раздел 7. Инструкции',              title:'Инструкции ИСПДн',       icon:'list' },
    { id:'PD_TRAINING',  order:8, folder:'Раздел 8. Обучение',                title:'Обучение',               icon:'cap' },
    { id:'PD_OTHER',     order:99, folder:'Прочее',                            title:'Прочее',                 icon:'folder' },
  ],
  VU: [
    { id:'VU_ORDERS',    order:1, folder:'Раздел 1. Приказы и обязанности',   title:'Приказы и обязанности',  icon:'clipboard' },
    { id:'VU_PLANS',     order:2, folder:'Раздел 2. Планы и карточки',        title:'Планы и карточки',       icon:'calendar' },
    { id:'VU_JOURNALS',  order:3, folder:'Раздел 3. Журналы и расписки',      title:'Журналы и расписки',     icon:'notebook' },
    { id:'VU_NOTICES',   order:4, folder:'Раздел 4. Уведомления в военкомат', title:'Уведомления',            icon:'send' },
    { id:'VU_REPORTS',   order:5, folder:'Раздел 5. Отчётность и сверки',     title:'Отчётность и сверки',    icon:'check' },
    { id:'VU_OTHER',     order:99, folder:'Прочее',                           title:'Прочее',                 icon:'folder' },
  ],
};

// ─────────────────────────────────────────────────────────────
// ПРИВЯЗКА ДОКУМЕНТА К РАЗДЕЛУ ПО ИМЕНИ ФАЙЛА
// Возвращает id раздела для данного имени файла внутри модуля.
// Это единый «классификатор», который использует и раскладка по папкам,
// и группировка в приложении. Правила — по точным именам и паттернам.
// ─────────────────────────────────────────────────────────────

// Точные соответствия «имя файла → id раздела».
const FILE_SECTION = {
  // ───────── ОХРАНА ТРУДА ─────────
  // Раздел 1. Приказы
  'Приказ об утверждении документации по охране труда.docx': 'OT_ORDERS',
  'Приказ о назначении ответственных лиц.docx': 'OT_ORDERS',
  'Приказ об утверждении инструкций по охране труда.docx': 'OT_ORDERS',
  'Приказ о назначении ответственного за СИЗ.docx': 'OT_ORDERS',
  'Приказ об обеспечении аптечками первой помощи.docx': 'OT_ORDERS',
  'Приказ о назначении ответственного за электрохозяйство.docx': 'OT_ORDERS',
  'Приказ об утверждении программ обучения.docx': 'OT_ORDERS',
  'Приказ об организации медицинских осмотров.docx': 'OT_ORDERS',
  'Приказ о порядке работ повышенной опасности.docx': 'OT_ORDERS',
  // Раздел 2. ЛНА
  'Политика в области охраны труда.docx': 'OT_LNA',
  'Положение о системе управления охраной труда.docx': 'OT_LNA',
  'Положение о порядке обучения по охране труда.docx': 'OT_LNA',
  'Положение об организации работы по охране труда.docx': 'OT_LNA',
  'Положение о разработке инструкций по охране труда.docx': 'OT_LNA',
  'Положение об учёте микротравм.docx': 'OT_LNA',
  'Правила внутреннего трудового распорядка.docx': 'OT_LNA',
  'Положение об обеспечении работников СИЗ.docx': 'OT_LNA',
  'Список контингента для медицинских осмотров.docx': 'OT_LNA',
  // Раздел 3. Электробезопасность
  'Программа инструктажа по электробезопасности.docx': 'OT_ELECTRO',
  'Журнал инструктажа по электробезопасности.docx': 'OT_ELECTRO',
  // Раздел 4. Инструкции по ОТ (фиксированные; ИОТ по должностям — по префиксу ниже)
  'Инструкция по охране труда при работе с ПЭВМ.docx': 'OT_INSTRUCT',
  'Инструкция по охране труда при работе с копировальной техникой.docx': 'OT_INSTRUCT',
  'Инструкция о порядке использования аптечки.docx': 'OT_INSTRUCT',
  // Раздел 6. Программы обучения
  'Программа В обучение работы повышенной опасности.docx': 'OT_PROGRAMS',
  'Программа вводного инструктажа по охране труда.docx': 'OT_PROGRAMS',
  'Программа первичного инструктажа на рабочем месте.docx': 'OT_PROGRAMS',
  'Программа противопожарного инструктажа.docx': 'OT_PROGRAMS',
  'Программа А обучения по охране труда (16 часов).docx': 'OT_PROGRAMS',
  'Программа А обучения по охране труда (40 часов).docx': 'OT_PROGRAMS',
  'Программа Б обучения по охране труда.docx': 'OT_PROGRAMS',
  'Программа обучения оказанию первой помощи.docx': 'OT_PROGRAMS',
  // Раздел 7. Протоколы обучения
  'Журнал регистрации противопожарных инструктажей.docx': 'OT_PROTOCOLS',
  'Протокол проверки знания требований охраны труда.docx': 'OT_PROTOCOLS',
  // Прочее
  'Чек-лист подписания документов.docx': 'OT_OTHER',
  'Памятка по проверке ГИТ.docx': 'OT_OTHER',
  'Договор на электробезопасность.docx': 'OT_OTHER',
  'Акт выполненных работ.docx': 'OT_OTHER',

  // ───────── ПЕРСОНАЛЬНЫЕ ДАННЫЕ ─────────
  // Раздел 1. Приказы
  'Памятка подачи уведомления в РКН.docx': 'PD_ORDERS',
  'Приказ о назначении ответственного за ПД.docx': 'PD_ORDERS',
  'Приказ о назначении ответственного за безопасность ПД.docx': 'PD_ORDERS',
  'Приказ о допуске должностных лиц к ПД.docx': 'PD_ORDERS',
  'Приказ о проведении обучения по ПД.docx': 'PD_ORDERS',
  'Приказ о создании комиссии по уровню защищённости.docx': 'PD_ORDERS',
  'Приказ об утверждении Политики ПД.docx': 'PD_ORDERS',
  'Приказ об утверждении Положения о защите ПД.docx': 'PD_ORDERS',
  'Приказ об утверждении инструкций ПД.docx': 'PD_ORDERS',
  // Раздел 2. Политика и положение
  'Политика об обработке персональных данных.docx': 'PD_POLICY',
  'Положение о защите персональных данных работников.docx': 'PD_POLICY',
  // Раздел 4. Журналы
  'Журнал учёта выдачи ПД сторонним организациям.docx': 'PD_JOURNALS',
  'Журнал учёта внутренней передачи персональных данных.docx': 'PD_JOURNALS',
  // Раздел 5. Акты (Акт об уничтожении — по префиксу ниже)
  'Акт определения уровня защищённости ИСПДн.docx': 'PD_ACTS',
  'Акт оценки вреда субъектам ПДн.docx': 'PD_ACTS',
  // Раздел 6. Планы
  'План внутреннего контроля ПДн.docx': 'PD_PLANS',
  'План мероприятий по защите ПДн.docx': 'PD_PLANS',
  // Раздел 7. Инструкции ИСПДн
  'Инструкция администратора безопасности ИСПДн.docx': 'PD_INSTRUCT',
  'Инструкция пользователя ИСПДн.docx': 'PD_INSTRUCT',
  'Инструкция по антивирусной защите ИСПДн.docx': 'PD_INSTRUCT',
  'Инструкция по парольной защите ИСПДн.docx': 'PD_INSTRUCT',
  'Инструкция по резервированию и восстановлению ПДн.docx': 'PD_INSTRUCT',
  'Инструкция по учёту машинных носителей ПДн.docx': 'PD_INSTRUCT',
  // Раздел 8. Обучение
  'Протокол обучения по персональным данным.docx': 'PD_TRAINING',

  // ───────── ВОИНСКИЙ УЧЁТ ─────────
  'ВУ-01 Приказ о назначении ответственного за воинский учёт.docx': 'VU_ORDERS',
  'ВУ-02 Функциональные обязанности ответственного за воинский учёт.docx': 'VU_ORDERS',
  'ВУ-03 План работы по осуществлению воинского учёта.docx': 'VU_PLANS',
  'ВУ-04 Карточка учёта организации (Форма №18).docx': 'VU_PLANS',
  'ВУ-05 Журнал проверок осуществления воинского учёта.docx': 'VU_JOURNALS',
  'ВУ-06 Расписка в получении документов воинского учёта.docx': 'VU_JOURNALS',
  'ВУ-07 Уведомление в военкомат о приёме военнообязанного.docx': 'VU_NOTICES',
  'ВУ-08 Уведомление в военкомат об увольнении военнообязанного.docx': 'VU_NOTICES',
  'ВУ-09 Акт сверки с военным комиссариатом.docx': 'VU_REPORTS',
  'ВУ-10 Справка о численности военнообязанных работников.docx': 'VU_REPORTS',
};

// Паттерны для динамических/префиксных имён (проверяются, если нет точного совпадения).
const SECTION_PATTERNS = [
  // ИОТ для конкретной должности (Раздел 4 ОТ)
  { test: n => n.startsWith('Инструкция по охране труда для '), section: 'OT_INSTRUCT' },
  // Накопительные акты об уничтожении ПД с датой в имени (Раздел 5 ПДн)
  { test: n => /^Акт об уничтожении персональных данных( от .+)?\.docx$/.test(n), section: 'PD_ACTS' },
  // Раздел 7 ОТ (Протоколы обучения) — точные имена в FILE_SECTION выше.
];

/**
 * Определяет id раздела для документа по имени файла.
 * @param {string} module   — 'OT' | 'PD' | 'VU'
 * @param {string} basename — имя файла (с расширением)
 * @returns {string} id раздела; если не распознан — '<MODULE>_OTHER'
 */
function sectionOf(module, basename) {
  if (FILE_SECTION[basename]) return FILE_SECTION[basename];
  for (const p of SECTION_PATTERNS) {
    if (p.test(basename)) return p.section;
  }
  return module + '_OTHER';
}

/**
 * Возвращает описание раздела по id.
 * @param {string} module
 * @param {string} sectionId
 * @returns {object|null}
 */
function sectionById(module, sectionId) {
  const list = SECTIONS[module] || [];
  return list.find(s => s.id === sectionId) || null;
}

/**
 * Имя папки раздела (относительно папки модуля).
 * @param {string} module
 * @param {string} sectionId
 * @returns {string}
 */
function sectionFolder(module, sectionId) {
  const s = sectionById(module, sectionId);
  return s ? s.folder : 'Прочее';
}

/**
 * Имя папки раздела для документа по его имени файла (удобный шорткат).
 * @param {string} module
 * @param {string} basename
 * @returns {string}
 */
function folderForFile(module, basename) {
  return sectionFolder(module, sectionOf(module, basename));
}

/**
 * Группирует список документов по разделам в порядке order.
 * Возвращает массив { section, docs[] } только для непустых разделов.
 * Используется для аккордеона в приложении.
 *
 * @param {string} module
 * @param {array}  docs — документы [{name, ...}]
 * @returns {array<{section:object, docs:array}>}
 */
function groupBySections(module, docs) {
  const list = (SECTIONS[module] || []).slice().sort((a,b) => a.order - b.order);
  const buckets = {};
  for (const d of (docs || [])) {
    const sid = sectionOf(module, d.name || d.filename || '');
    (buckets[sid] = buckets[sid] || []).push(d);
  }
  const result = [];
  for (const s of list) {
    if (buckets[s.id] && buckets[s.id].length) {
      result.push({ section: s, docs: buckets[s.id] });
    }
  }
  // Документы, не попавшие ни в один известный раздел (на всякий случай)
  const knownIds = new Set(list.map(s => s.id));
  const orphanIds = Object.keys(buckets).filter(id => !knownIds.has(id));
  for (const id of orphanIds) {
    result.push({ section: { id, title:'Прочее', folder:'Прочее', order:100, icon:'folder' }, docs: buckets[id] });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// ЭКСПОРТ — работает и в Node (генераторы, main.js), и во фронтенде
// (client-card.js, vu.js, pd.js грузятся через <script> без require).
// ─────────────────────────────────────────────────────────────
const _sectionsApi = {
  SECTIONS,
  sectionOf,
  sectionById,
  sectionFolder,
  folderForFile,
  groupBySections,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _sectionsApi;          // Node-окружение
}
if (typeof globalThis !== 'undefined') {
  // Браузер/Electron-renderer: кладём в глобальную область,
  // чтобы фронтенд-модули могли вызывать sectionOf(...) напрямую.
  Object.assign(globalThis, _sectionsApi);
}
