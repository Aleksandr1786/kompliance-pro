const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const { generatePackage } = require('./generator');
const { generateSoutPackage } = require('./gen_sout');
const path = require('path');
const fs = require('fs');

// ─── База данных на JSON (не требует компиляции) ──────────
const low    = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

let db;
let mainWindow = null;
let pendingUpdate = null;

// Лог автообновления в файл (для диагностики в packaged-режиме)
function updateLog(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'update.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch(_) {}
  console.log(`[Updater] ${msg}`);
}

// ─── ВЕРСИОНИРОВАНИЕ СХЕМЫ ДАННЫХ ────────────────────────
//
// Как добавить новую миграцию:
// 1. Увеличь DB_VERSION на 1
// 2. Добавь новый объект в конец массива MIGRATIONS
// 3. В функции up(db) опиши что нужно изменить в базе
//
// Правила:
// - Каждая миграция идемпотентна (можно запустить дважды — результат тот же)
// - Никогда не удаляй существующие миграции
// - Нумерация строго последовательная: 1, 2, 3...

const DB_VERSION = 11;

const MIGRATIONS = [
  {
    version: 1,
    description: 'Начальная схема: базовые поля клиентов и сотрудников',
    up(db) {
      // Добавляем недостающие поля клиентам
      db.get('clients').each(c => {
        if (c.score       === undefined) c.score       = 0;
        if (c.modules     === undefined) c.modules     = 'OT';
        if (c.color       === undefined) c.color       = '#3b82f6';
        if (c.archived    === undefined) c.archived    = 0;
        if (c.okved_extra === undefined) c.okved_extra = '';
        if (c.pd_checklist === undefined) c.pd_checklist = {};
        if (c.czn         === undefined) c.czn         = '';
        if (c.soat_class  === undefined) c.soat_class  = '2';
        if (c.hazard_works      === undefined) c.hazard_works      = 0;
        if (c.medcheck_required === undefined) c.medcheck_required = 0;
      }).write();

      // Добавляем недостающие поля сотрудникам
      db.get('employees').each(e => {
        if (e.gender          === undefined) e.gender          = 'm';
        if (e.division_id     === undefined) e.division_id     = null;
        if (e.is_military     === undefined) e.is_military     = 0;
        if (e.prog_b_exempt   === undefined) e.prog_b_exempt   = 0;
        if (e.medcheck_required === undefined) e.medcheck_required = 0;
        if (e.name_gen        === undefined) e.name_gen        = '';
        if (e.name_dat        === undefined) e.name_dat        = '';
        if (e.name_acc        === undefined) e.name_acc        = '';
        if (e.name_ins        === undefined) e.name_ins        = '';
        if (e.name_short      === undefined) e.name_short      = '';
        if (e.vu_category     === undefined) e.vu_category     = '';
        if (e.vu_rank         === undefined) e.vu_rank         = '';
        if (e.vu_mobpredpisanie === undefined) e.vu_mobpredpisanie = 0;
        if (e.training        === undefined) e.training        = {};
        if (e.commission_role === undefined) e.commission_role = null; // 'chairman' | 'member' | null
      }).write();

      // Добавляем недостающие поля задачам
      db.get('tasks').each(t => {
        if (t.priority  === undefined) t.priority  = 'normal';
        if (t.module    === undefined) t.module    = null;
        if (t.due_date  === undefined) t.due_date  = '';
        if (t.client_id === undefined) t.client_id = null;
      }).write();
    }
  },

  // ── v2: очистка демо/хардкод-данных, попавших в ранние сборки ──
  {
    version: 2,
    description: 'Очистка дефолтных данных разработчика и ложной DEV-лицензии из ранних сборок',
    up(db) {
      const s = db.get('settings');
      const v = s.value() || {};

      // Стираем профиль, только если там остались старые ХАРДКОД-значения
      // (данные, которые пользователь ввёл сам, НЕ трогаем)
      if (v.user_name     === 'Александр Свинцов')                 s.assign({ user_name: '' }).write();
      if (v.user_position === 'Специалист по охране труда')        s.assign({ user_position: '' }).write();
      if (v.user_phone    === '[скрыто]')                  s.assign({ user_phone: '' }).write();
      if (v.user_email    === '[скрыто]')                s.assign({ user_email: '' }).write();
      if (v.company_name  === 'ИП Свинцов Александр Викторович')   s.assign({ company_name: '' }).write();

      // Сбрасываем ложную «вечную» лицензию, если она не настоящая
      // (настоящие ключи имеют license_machine; DEV-MODE и пустые сбрасываем в триал)
      const cur = s.value();
      if (cur.trial_status === 'licensed' && (!cur.license_machine || cur.license_key === 'DEV-MODE')) {
        s.assign({
          trial_status: '',
          license_key: '',
          license_expires: '',
          license_machine: ''
        }).write();
      }
    }
  },

  // ── v3: добавление поля sout_data для хранения данных СОУТ ──
  {
    version: 3,
    description: 'Добавление sout_data в клиентов для хранения данных мастера СОУТ',
    up(db) {
      db.get('clients').each(c => {
        if (c.sout_data === undefined) c.sout_data = null;
        if (c.address_actual === undefined) c.address_actual = '';
      }).write();
    }
  },

  // ── v4: СНИЛС/паспорт сотрудника + сохранённый маппинг импорта из 1С/Excel ──
  {
    version: 4,
    description: 'Добавление snils/паспорта сотрудникам и import_mapping клиентам (импорт из 1С/Excel/CSV)',
    up(db) {
      db.get('employees').each(e => {
        if (e.snils                  === undefined) e.snils                  = '';
        if (e.passport_series        === undefined) e.passport_series        = '';
        if (e.passport_number        === undefined) e.passport_number        = '';
        if (e.passport_issued_by     === undefined) e.passport_issued_by     = '';
        if (e.passport_issued_date   === undefined) e.passport_issued_date   = '';
      }).write();

      db.get('clients').each(c => {
        // Маппинг колонок файла импорта → поля сотрудника, запоминается
        // per-клиент, чтобы при повторном импорте (например, ежемесячная
        // выгрузка из 1С) не настраивать соответствие заново.
        if (c.import_mapping === undefined) c.import_mapping = null;
      }).write();
    }
  },

  // ── v5: ОГРН и контактный email — нужны для полной шапки формы отчёта ЦЗН
  // (Постановление №1591 требует ОГРН и email отдельно от ИНН/телефона) ──
  {
    version: 5,
    description: 'Добавление ogrn/email клиентам для шапки отчёта ЦЗН',
    up(db) {
      db.get('clients').each(c => {
        if (c.ogrn  === undefined) c.ogrn  = '';
        if (c.email === undefined) c.email = '';
      }).write();
    }
  },

  // ── v6: медицинские допуски сотрудника — общая подсистема вместо
  // единого чекбокса medcheck_required. Нужна для ЧОП (медосмотр 29н +
  // справка охранника 1252н + психиатрическое освидетельствование 392н —
  // три НЕЗАВИСИМЫХ допуска одновременно) и будущего ФЛОТа (29н + 714н).
  // Каждый аддон декларирует свои типы допусков отдельно, ядро БД просто
  // хранит массив записей на сотрудника. Старое medcheck_required не
  // трогаем — оставлено для обратной совместимости ──
  {
    version: 6,
    description: 'Добавление medical_clearances[] сотрудникам — независимые медицинские допуски',
    up(db) {
      db.get('employees').each(e => {
        if (e.medical_clearances === undefined) e.medical_clearances = [];
      }).write();
    }
  },

  // ── v7: медосмотр (29н), медосмотр плавсостава (714н) и психосвиде-
  // тельствование (392н) жили как под-объекты training.medcheck/
  // medcheck_714/psycho — единственное место, где они использовались,
  // это модалка «Обучение» в client-card.js, ни один генератор документов
  // их не читал. Это создавало риск трёх параллельных источников правды
  // про медосмотры (training.*, medcheck_required, medical_clearances).
  // Переносим существующие даты в medical_clearances[] и убираем из
  // training — обучение и медицинские допуски теперь чётко разделены ──
  {
    version: 7,
    description: 'Перенос training.medcheck/medcheck_714/psycho в medical_clearances[], разделение обучения и мед. допусков',
    up(db) {
      const MOVE_MAP = [
        { trKey: 'medcheck',     type: 'periodic_29n',     years: 1 },
        { trKey: 'medcheck_714', type: 'maritime_714n',    years: 2 },
        { trKey: 'psycho',       type: 'psychiatric_392n', years: 5 },
      ];

      db.get('employees').each(e => {
        const training   = e.training || {};
        const clearances = e.medical_clearances || [];

        MOVE_MAP.forEach(m => {
          const t = training[m.trKey];
          if (t && t.date) {
            const alreadyMoved = clearances.some(c => c.type === m.type && c.issued_date === t.date);
            if (!alreadyMoved) {
              const issued = new Date(t.date);
              const until  = new Date(issued);
              until.setFullYear(until.getFullYear() + m.years);
              clearances.push({
                id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                type: m.type,
                basis_order: '',
                issued_date: t.date,
                valid_until: until.toISOString().slice(0, 10),
              });
            }
          }
          // Удаляем из training — единственный источник правды теперь medical_clearances
          delete training[m.trKey];
        });

        e.training           = training;
        e.medical_clearances = clearances;
      }).write();
    }
  },

  // ── v8: поле chop{} у сотрудника для данных, специфичных для аддона
  // ЧОП (разряд охранника 4/5/6, допуск к оружию, тип поста, режим
  // смен) — Закон №2487-1. Хранится в отдельном пространстве имён, а не
  // плоскими полями employee.*, чтобы не засорять схему сотрудника
  // данными, которые видны и заполняются только при активном аддоне.
  // null, пока аддон не используется/поля не заполнены ──
  {
    version: 8,
    description: 'Добавление chop{} сотрудникам — данные для аддона ЧОП (разряд, оружие, пост, смены)',
    up(db) {
      db.get('employees').each(e => {
        if (e.chop === undefined) e.chop = null;
      }).write();
    }
  },

  // ── v9: mcp_enabled — фиче-флаг MCP-сервера (read-only доступ к
  // данным для AI-агентов). settings — не массив, а объект, поэтому
  // без .each(), обычная точечная проверка/assign, как в v2 ──
  {
    version: 9,
    description: 'Добавление settings.mcp_enabled — фиче-флаг MCP-сервера, по умолчанию выключен',
    up(db) {
      const s = db.get('settings');
      if (s.value().mcp_enabled === undefined) {
        s.assign({ mcp_enabled: '0' }).write();
      }
    }
  },

  // ── v10: поля pasf{} у клиента и сотрудника для аддона ПАСФ
  // (Профессиональное аварийно-спасательное формирование, 151-ФЗ + ПП №1091).
  // В отличие от ЧОП, здесь ДВА уровня данных, а не один:
  //   - client.pasf   — аттестация формирования как организации (раз в 3 года,
  //     блокирующий статус для всей компании — аналога у других аддонов нет);
  //   - employee.pasf — класс спасателя, дактилоскопия (ст.24.1 151-ФЗ) и
  //     work_permits[] — допуски к конкретным видам АСР персонально
  //     (аттестационная комиссия допускает не ко всем видам сразу).
  // Медицинские допуски спасателя НЕ дублируем — используем уже существующую
  // общую подсистему employee.medical_clearances[] (v6), как и ЧОП/ФЛОТ ──
  {
    version: 10,
    description: 'Добавление pasf{} клиентам (аттестация формирования) и сотрудникам (класс, дактилоскопия, допуски к видам АСР) — аддон ПАСФ',
    up(db) {
      db.get('clients').each(c => {
        if (c.pasf === undefined) c.pasf = null;
      }).write();

      db.get('employees').each(e => {
        if (e.pasf === undefined) e.pasf = null;
      }).write();
    }
  },

  {
    version: 11,
    description: 'Аудит актуальности цитат НПА — новая коллекция npa_citation_audit (не задачи: см. обоснование в чате 19 — это технический аудит кода генераторов, не клиентская задача, и нужна полная история проверок, а не todo-список) + настройка периодичности в settings.',
    up(db) {
      if (!Array.isArray(db.get('npa_citation_audit').value())) {
        db.set('npa_citation_audit', []).write();
      }
      const s = db.get('settings');
      const v = s.value() || {};
      if (v.npa_citation_last_check_date === undefined) s.assign({ npa_citation_last_check_date: '' }).write();
    }
  },

];

// ─── Справочники ПАСФ (аддон PASF) ────────────────────────────────
// Декларируются здесь же, рядом с медицинскими типами ЧОП/ФЛОТа — main.js
// не хранит бизнес-логику аддона, но справочники видов работ/классов
// нужны и генераторам документов, и UI карточки сотрудника/клиента.

// 24 вида работ по образцу клиента (виды_работ_АСР.docx) — каждый спасатель
// аттестуется на конкретное подмножество, не на всё сразу (ПП №1091, п.13).
const PASF_WORK_TYPES = [
  { key: 'flammables',       label: 'Работа с ГСМ, ЛКМ, нефтепродуктами, клеями' },
  { key: 'sharp_tools',      label: 'Работа с колюще-режущими инструментами' },
  { key: 'pumps',            label: 'Работа с перекачивающими насосами, помпами, электрооборудованием' },
  { key: 'drilling',         label: 'Работа со сверлильным, точильным оборудованием' },
  { key: 'rigging_height',   label: 'Стропильные, высотные работы' },
  { key: 'engines',          label: 'Работа с ДВС, гидравлическими силовыми установками' },
  { key: 'vessel_work',      label: 'Работа на судах' },
  { key: 'overboard_rescue', label: 'Работа за бортом судов при поиске и спасении' },
  { key: 'emergency_zone',   label: 'Работа в зонах ЧС' },
  { key: 'high_pressure',    label: 'Работа с моющими устройствами высокого давления и температуры' },
  { key: 'boom',             label: 'Работа с боновыми заграждениями' },
  { key: 'skimmer',          label: 'Работа со скиммерами' },
  { key: 'containers',       label: 'Работа с плавающими и составными ёмкостями для нефтепродуктов' },
  { key: 'gas_detection',    label: 'Работа с приборами учёта и контроля (газовая разведка)' },
  { key: 'equipment_repair', label: 'Ремонт оборудования' },
  { key: 'confined_space',   label: 'Работы в закрытых загазованных помещениях' },
  { key: 'damaged_vessels',  label: 'Работы на аварийных судах' },
  { key: 'fuel_tanks',       label: 'Работы в топливных танках судов и МО' },
  { key: 'firefighting',     label: 'Работы по тушению пожаров' },
  { key: 'gas_rescue',       label: 'Газоспасательные работы' },
  { key: 'construction',     label: 'Строительные работы' },
  { key: 'cleanup',          label: 'Уборка территории и помещений' },
  { key: 'loading',          label: 'Погрузочные работы' },
  { key: 'household',        label: 'Хозяйственные работы' },
];

// Классы квалификации спасателя (151-ФЗ ст.24, ПП №1091) — периодичность
// переаттестации у каждого класса своя (2-2-3-3 года).
const PASF_CLASSES = [
  { key: 'rescuer',          label: 'Спасатель',            years_to_next: 2 },
  { key: 'class_3',          label: 'Спасатель 3 класса',   years_to_next: 2 },
  { key: 'class_2',          label: 'Спасатель 2 класса',   years_to_next: 3 },
  { key: 'class_1',          label: 'Спасатель 1 класса',   years_to_next: 3 },
  { key: 'international',    label: 'Спасатель международного класса', years_to_next: null },
];

function runMigrations(db) {
  // Читаем текущую версию схемы из базы (0 если не было)
  const currentVersion = db.get('settings.db_version').value() || 0;

  if (currentVersion >= DB_VERSION) return; // всё актуально

  const pending = MIGRATIONS.filter(m => m.version > currentVersion);
  if (!pending.length) return;

  console.log(`[Migration] База версии ${currentVersion}, нужна ${DB_VERSION}. Запускаем ${pending.length} миграций...`);

  for (const migration of pending) {
    try {
      console.log(`[Migration] v${migration.version}: ${migration.description}`);
      migration.up(db);
      // Обновляем версию после каждой успешной миграции
      db.set('settings.db_version', migration.version).write();
      console.log(`[Migration] v${migration.version}: ✅ выполнена`);
    } catch (e) {
      console.error(`[Migration] v${migration.version}: ❌ ошибка — ${e.message}`);
      // Останавливаемся — не накатываем следующие
      break;
    }
  }
}

function initDB() {
  const dbPath = path.join(app.getPath('userData'), 'kompliance.json');

  // Защита от повреждённой базы: если JSON битый — восстанавливаем из последнего бэкапа
  if (fs.existsSync(dbPath)) {
    try {
      JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      // База повреждена — пытаемся восстановить
      const corruptPath = dbPath + '.corrupt_' + Date.now();
      try { fs.renameSync(dbPath, corruptPath); } catch(_) {}
      // Ищем последний авто-бэкап
      try {
        const autoDir = path.join(app.getPath('userData'), 'autobackup');
        if (fs.existsSync(autoDir)) {
          const backups = fs.readdirSync(autoDir).filter(f => f.endsWith('.json')).sort().reverse();
          if (backups.length) {
            fs.copyFileSync(path.join(autoDir, backups[0]), dbPath);
          }
        }
      } catch(_) {}
    }
  }

  const adapter = new FileSync(dbPath);
  db = low(adapter);
  db.defaults({
    clients: [],
    employees: [],
    documents: [],
    events: [],
    tasks: [],
    npa_changes: [],
    npa_citation_audit: [],
    divisions: [],
    certifications: [], // реестр удостоверений Центра обучения
    settings: {
      user_name: '',
      user_position: '',
      user_phone: '',
      user_email: '',
      company_name: '',
      company_inn: '',
      company_ogrn: '',
      company_address: '',
      default_region: 'Краснодарский край',
      remind_days_1: '30',
      remind_days_2: '14',
      remind_days_3: '3',
      tg_token: '',
      tg_chat_id: '',
      tg_morning: '1',
      tg_urgent: '1',
      tg_npa: '1',
      npa_general_feed: '1',
      npa_citation_last_check_date: '',
      tg_last_morning_date: '',
      npa_last_check_date: '',
      autostart: '0',
      backup_path: '',
      ai_provider: 'deepseek',
      ai_key: '',
      remind_weekends: '1',
      remind_escalate: '1',
      window_bounds: '',
      eula_accepted: '',
      eula_date: '',
      db_version: 0,
      pin_hash: '',
      pin_enabled: '0',
      trial_start: '',
      trial_status: '',
      license_key: '',
      license_email: '',
      license_plan: '',
      license_expire: '',
      license_limit: '',
      mcp_enabled: '0', // Фиче-флаг MCP-сервера (чтение-только доступ к данным для AI-агентов), по умолчанию выключен
    }
  }).write();

  // Накатываем миграции схемы
  runMigrations(db);
}

// Раньше nextId брал max(id) среди ЖИВЫХ записей коллекции — после удаления
// последнего по счёту клиента (или сотрудника и т.п.) следующий добавленный
// получал тот же ID. Если по какой-то причине связанные записи не были
// каскадно удалены до конца (ручная правка базы, сбой, старая версия кода
// без каскадного удаления) — они "прилипали" к новой записи с переиспользо-
// ванным ID. Найдено 12.07.2026 (сотрудник от удалённого тестового клиента
// показался у только что созданного). Теперь ID монотонно растёт и
// никогда не переиспользуется, даже если все записи коллекции удалены.
function nextId(collection) {
  const counters = db.get('id_counters').value() || {};
  const liveMax = (() => {
    const items = db.get(collection).value();
    return items.length ? Math.max(...items.map(i => i.id)) : 0;
  })();
  const next = Math.max(counters[collection] || 0, liveMax) + 1;
  db.set(`id_counters.${collection}`, next).write();
  return next;
}

function now() { return new Date().toISOString(); }

/**
 * Валидация данных клиента. Используется и в clients:add, и в clients:update —
 * единая точка проверки независимо от того, идут ли данные из формы рендерера
 * или из любого другого источника (импорт, будущие интеграции). До этой правки
 * clients:update писал в БД data без проверок вовсе — название/ОКВЭД/ИНН могли
 * стать пустыми или некорректными при редактировании, в отличие от добавления.
 * Возвращает null, если всё корректно, иначе { error }.
 * partial=true — для update: проверяет только те поля, что реально пришли в data
 * (не требует name/okved, если их не передавали — иначе нельзя было бы обновить
 * только, например, ФИО руководителя без пересылки всех остальных полей).
 */
function validateClient(data, partial) {
  if ((!partial || 'name' in data) && !data.name?.trim()) {
    return { error: 'Название организации обязательно' };
  }
  if ((!partial || 'okved' in data) && !data.okved?.trim()) {
    return { error: 'ОКВЭД обязателен' };
  }
  if ('inn' in data) {
    const inn = (data.inn || '').trim();
    if (inn && !/^\d{10}$|^\d{12}$/.test(inn)) {
      return { error: 'ИНН должен содержать 10 или 12 цифр' };
    }
  }
  if ('soat_class' in data && data.soat_class !== '' && data.soat_class != null) {
    const cls = String(data.soat_class).trim();
    // Реальные значения <option value="..."> в выпадающем списке СОУТ
    // (clients.js, #e-soat-class и #c-soat-class) — БЕЗ точки: '31','32','33','34'.
    // Старый regex требовал '3.1'/'3.2' и т.п. — ни одно реальное значение 3.x
    // через него не проходило, из-за чего сохранение карточки клиента с любым
    // классом условий труда 3.1–3.4 падало с этой ошибкой независимо от того,
    // какие ещё поля редактировались.
    if (cls && !/^(0|1|2|31|32|33|34|4)$/.test(cls)) {
      return { error: 'Класс условий труда (СОУТ) указан некорректно' };
    }
  }
  return null;
}

/**
 * Синхронизирует «плановые» даты клиента (следующий обход / следующая
 * проверка ГИТ) с коллекцией events — единственным источником данных,
 * который читает dashboard.js (просрочки, «на этой неделе», «ближайшее
 * событие» на карточке клиента, блок «Что делать сегодня»). Без этого
 * синка даты, заполненные в форме редактирования клиента, сохранялись
 * только в clients и никогда не попадали в events — на дашборде их
 * просто не существовало.
 * kind помечает событие как авто-сгенерированное из конкретного поля
 * клиента — не пересекается с событиями, добавленными вручную через
 * events:add (у них kind не задан). Вызов идемпотентен: повторное
 * сохранение той же даты не создаёт дублей, очистка поля удаляет событие.
 */
function syncClientDateEvent(clientId, kind, title, dateValue) {
  const existing = db.get('events').find({ client_id: clientId, kind }).value();
  const date = (dateValue || '').trim();
  if (!date) {
    if (existing) db.get('events').remove({ client_id: clientId, kind }).write();
    return;
  }
  if (existing) {
    if (existing.due_date !== date) {
      db.get('events').find({ client_id: clientId, kind }).assign({ due_date: date, status: 'pending' }).write();
    }
  } else {
    const id = nextId('events');
    db.get('events').push({ id, client_id: clientId, kind, title, due_date: date, status: 'pending' }).write();
  }
}

/** Вызывается из clients:add и clients:update — прогоняет обе плановые даты через syncClientDateEvent. */
function syncClientEvents(clientId, data) {
  if ('next_visit_date' in data) {
    syncClientDateEvent(clientId, 'next_visit', 'Плановый обход', data.next_visit_date);
  }
  if ('git_next_date' in data) {
    syncClientDateEvent(clientId, 'git_check', 'Плановая проверка ГИТ', data.git_next_date);
  }
}

/** Аналогично validateClient — для сотрудников, используется в add и update. */
function validateEmployee(data, partial) {
  if ((!partial || 'full_name' in data) && !data.full_name?.trim()) {
    return { error: 'ФИО сотрудника обязательно' };
  }
  if ((!partial || 'position' in data) && !data.position?.trim()) {
    return { error: 'Должность обязательна' };
  }
  // СНИЛС необязателен, но если указан — проверяем формат (11 цифр)
  if ('snils' in data && data.snils) {
    const digits = String(data.snils).replace(/\D/g, '');
    if (digits.length !== 11) {
      return { error: 'СНИЛС должен содержать 11 цифр' };
    }
  }
  return null;
}

/**
 * Нормализует СНИЛС к виду "123-456-789 00" из произвольного ввода
 * (1С часто выгружает либо чистые цифры, либо уже отформатированную строку).
 */
function normalizeSnils(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length !== 11) return String(raw || '').trim();
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,9)} ${digits.slice(9)}`;
}

/**
 * Корневая папка для документов клиентов.
 * Намеренно вне Desktop/Documents — в %LOCALAPPDATA%, которая НЕ
 * синхронизируется облачными клиентами (OneDrive и т.п.). Это убирает
 * целый класс проблем: блокировки файлов при перезаписи/архивации,
 * конфликтные дубли папок, ложное «файл отсутствует» при отложенной
 * синхронизации. Пользователь открывает папку кнопками «Открыть папку».
 */
function getOutputRoot() {
  // app.getPath('appData') = %APPDATA% (Roaming, может синхронизироваться
  // доменными политиками); 'userData' указывает внутрь appData.
  // Для документов берём LOCALAPPDATA — он не роумится и не синхронизируется.
  const base = process.env.LOCALAPPDATA
            || app.getPath('userData')   // запасной вариант, если переменной нет
            || app.getPath('desktop');
  return path.join(base, 'КомплаенсПро', 'Документы');
}

// ─── КЛИЕНТЫ ─────────────────────────────────────────────
ipcMain.handle('clients:list', () => {
  return db.get('clients').sortBy('name').value();
});

ipcMain.handle('clients:get', (_, id) => {
  return db.get('clients').find({ id }).value();
});

ipcMain.handle('clients:add', (_, data) => {
  const err = validateClient(data, false);
  if (err) return err;

  // Ограничение триала: максимум 2 клиента
  const trial = checkTrial(db);
  if (trial.status === 'trial' || trial.status === 'expired') {
    const count = db.get('clients').filter({ archived: 0 }).value().length;
    if (count >= 2) {
      return { error: 'В пробной версии можно добавить не более 2 клиентов. Приобретите лицензию для снятия ограничения.' };
    }
  }

  // Лимит тарифа «Аутсорсер» (до 10 клиентов) — «Аутсорсер Про» (limit=0)
  // безлимитный. Проверяется только на собранном приложении (exe) — в
  // dev-режиме (start.bat) лицензия не действует вообще, см. checkTrial.
  if (app.isPackaged) {
    const settings = db.get('settings').value();
    if (settings.license_type === 'OUTSOURCE' && Number(settings.license_limit) > 0) {
      const activeCount = db.get('clients').filter({ archived: 0 }).value().length;
      if (activeCount >= Number(settings.license_limit)) {
        return { error: `Лимит тарифа «Аутсорсер» — ${settings.license_limit} клиентов. Перейдите на «Аутсорсер Про» для безлимитного количества.` };
      }
    }
    // ПАСФ — строго одна организация (весь смысл тарифа «приложение в
    // приложении» под конкретное формирование). Не «мягкая рекомендация»,
    // а жёсткий блок — иначе PASF+OT автоматически проставлялись бы любому
    // количеству компаний при активации ключа, что противоречит модели.
    if (settings.license_type === 'PASF') {
      const activeCount = db.get('clients').filter({ archived: 0 }).value().length;
      if (activeCount >= 1) {
        return { error: 'Тариф ПАСФ рассчитан на одну организацию. Добавление второй компании не предусмотрено этим тарифом.' };
      }
    }
  }

  const id = nextId('clients');
  const client = { ...data, id, created_at: now(), score: 0 };

  // ПАСФ-тариф — единственная компания пользователя сразу получает модули
  // PASF+OT, без отдельного шага активации аддона (см. license:activate).
  const licSettings = db.get('settings').value();
  if (licSettings.license_type === 'PASF') {
    const mods = new Set((client.modules || '').split(',').filter(Boolean));
    mods.add('PASF'); mods.add('OT');
    client.modules = Array.from(mods).join(',');
  }

  db.get('clients').push(client).write();
  syncClientEvents(id, data);
  return { id };
});

ipcMain.handle('clients:update', (_, id, data) => {
  const err = validateClient(data, true);
  if (err) return err;
  db.get('clients').find({ id }).assign(data).write();
  syncClientEvents(id, data);
  return { ok: true };
});

ipcMain.handle('clients:delete', (_, id) => {
  db.get('clients').remove({ id }).write();
  db.get('employees').remove({ client_id: id }).write();
  db.get('documents').remove({ client_id: id }).write();
  db.get('events').remove({ client_id: id }).write();
  db.get('tasks').remove({ client_id: id }).write();
  db.get('divisions').remove({ client_id: id }).write();
  db.get('certifications').remove({ client_id: id }).write();
  return { ok: true };
});

// ─── СОТРУДНИКИ ──────────────────────────────────────────
ipcMain.handle('employees:list', (_, clientId) => {
  return db.get('employees').filter({ client_id: clientId }).sortBy('full_name').value();
});

// Для дашборда аутсорсера: учёт обучения (Программа А/Первая помощь/Пожарный
// минимум/Повторный инструктаж) при подсчёте кольца готовности ОТ. Без этого
// готовность считалась только по статусу документов и могла показывать 100%
// даже при просроченном обучении у сотрудников — см. training:alerts.
ipcMain.handle('employees:list-all', () => {
  return db.get('employees').value();
});

// ─── ПОДРАЗДЕЛЕНИЯ ───────────────────────────────────────
ipcMain.handle('divisions:list', (_, clientId) => {
  return db.get('divisions').filter({ client_id: clientId }).value();
});

ipcMain.handle('divisions:add', (_, data) => {
  const id = Date.now();
  db.get('divisions').push({ ...data, id }).write();
  return id;
});

ipcMain.handle('divisions:update', (_, id, data) => {
  db.get('divisions').find({ id }).assign(data).write();
});

ipcMain.handle('divisions:delete', (_, id) => {
  // При удалении подразделения — снимаем привязку с сотрудников
  db.get('employees').filter({ division_id: id }).each(e => {
    db.get('employees').find({ id: e.id }).assign({ division_id: null }).write();
  }).value();
  db.get('divisions').remove({ id }).write();
});

ipcMain.handle('employees:add', (_, data) => {
  const err = validateEmployee(data, false);
  if (err) return err;

  // Лимит тарифа SOLO (Микро/Малый/Средний — по числу сотрудников). В
  // режиме «Своя организация» клиент всегда один, поэтому считаем всех
  // сотрудников в базе целиком. Не действует в dev-режиме (start.bat).
  if (app.isPackaged) {
    const settings = db.get('settings').value();
    if (settings.license_type === 'SOLO' && Number(settings.license_limit) > 0) {
      const empCount = db.get('employees').value().length;
      if (empCount >= Number(settings.license_limit)) {
        return { error: `Лимит вашего тарифа — ${settings.license_limit} сотрудников. Перейдите на тариф выше для увеличения лимита.` };
      }
    }
  }

  const id = nextId('employees');
  db.get('employees').push({ ...data, id }).write();
  return { id };
});

ipcMain.handle('employees:update', (_, id, data) => {
  const err = validateEmployee(data, true);
  if (err) return err;
  db.get('employees').find({ id }).assign(data).write();
  return { ok: true };
});

// Генерирует шаблон для импорта сотрудников (xlsx) с заголовками и примером
// строки — чтобы клиент мог выгрузить из 1С в этом формате и импортировать
// без ручного мэппинга колонок.
ipcMain.handle('employees:download-template', async () => {
  try {
    const XLSX = require('xlsx');
    const headers = [
      'ФИО', 'Должность', 'Подразделение', 'Дата рождения', 'Дата приёма',
      'Табельный номер', 'СНИЛС', 'Серия паспорта', 'Номер паспорта',
      'Кем выдан', 'Дата выдачи паспорта',
    ];
    const example = [
      'Иванов Иван Иванович', 'Водитель', 'Транспортный отдел', '1985-06-01', '2022-03-14',
      '0001', '112-233-445 95', '0314', '556677',
      'УМВД России по г. Новороссийску', '2015-04-20',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Сотрудники');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить шаблон импорта',
      defaultPath: path.join(app.getPath('desktop'), 'Шаблон_импорта_сотрудников.xlsx'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (res.canceled) return { ok: false, canceled: true };
    fs.writeFileSync(res.filePath, buffer);
    return { ok: true, filePath: res.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('employees:delete', (_, id) => {
  db.get('employees').remove({ id }).write();
  return { ok: true };
});

// ─── ИМПОРТ СОТРУДНИКОВ ИЗ ФАЙЛА (1С/Excel/CSV) ──────────
//
// rows — массив уже смэппленных объектов { full_name, position, ... } с
// фронтенда (парсинг файла и мэппинг колонок делает employee-import.js).
// resolutions — карта { [rowIndex]: 'update' | 'skip' | 'create' } для строк,
// у которых нашлось совпадение по ФИО+СНИЛС с уже существующим сотрудником;
// если для строки нет записи в resolutions — считаем, что дублей нет, и
// создаём нового сотрудника.
ipcMain.handle('employees:import', (_, clientId, rows, resolutions) => {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };
  const existing = db.get('employees').filter({ client_id: clientId }).value();

  rows.forEach((row, idx) => {
    const data = { ...row, client_id: clientId };
    if (data.snils) data.snils = normalizeSnils(data.snils);

    const resolution = resolutions?.[idx];
    const match = existing.find(e =>
      e.full_name?.trim().toLowerCase() === data.full_name?.trim().toLowerCase() &&
      (!data.snils || !e.snils || e.snils === data.snils)
    );

    if (match && resolution === 'skip') {
      result.skipped++;
      return;
    }

    if (match && (resolution === 'update' || resolution === undefined)) {
      const err = validateEmployee(data, true);
      if (err) { result.errors.push({ row: idx, ...err }); return; }
      db.get('employees').find({ id: match.id }).assign(data).write();
      result.updated++;
      return;
    }

    // Новый сотрудник (нет совпадения, либо пользователь явно выбрал "создать")
    const err = validateEmployee(data, false);
    if (err) { result.errors.push({ row: idx, ...err }); return; }
    const id = nextId('employees');
    db.get('employees').push({ ...data, id }).write();
    result.created++;
  });

  return result;
});

// Сохранение/чтение маппинга колонок файла → полей сотрудника, per-клиент,
// чтобы при повторном импорте (регулярная выгрузка из 1С) не настраивать
// соответствие заново.
ipcMain.handle('clients:get-import-mapping', (_, clientId) => {
  return db.get('clients').find({ id: clientId }).value()?.import_mapping || null;
});

ipcMain.handle('clients:save-import-mapping', (_, clientId, mapping) => {
  db.get('clients').find({ id: clientId }).assign({ import_mapping: mapping }).write();
  return { ok: true };
});

// Открывает системный диалог выбора файла, отфильтрованный под Excel/CSV.
// Возвращает путь к файлу или null, если пользователь отменил.
ipcMain.handle('employees:pick-import-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите файл со списком сотрудников',
    filters: [
      { name: 'Таблицы', extensions: ['xlsx', 'xls', 'csv'] },
      { name: 'Все файлы', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// Читает файл (xlsx/xls/csv) и возвращает "сырые" строки как массив массивов
// (первая строка обычно — заголовки 1С). Парсинг через xlsx делаем в main-
// процессе, т.к. Node-модуль 'xlsx' надёжнее читает файлы с диска, чем
// FileReader в рендерере, и не тянет доступ к произвольным путям во фронтенд.
// Простой парсер строки CSV с поддержкой кавычек (запятая/точка с запятой
// внутри "поля в кавычках" не считается разделителем).
function parseCsvLine(line, delimiter) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { result.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

ipcMain.handle('employees:read-import-file', (_, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.csv') {
      // Читаем как текст напрямую — библиотека xlsx у CSV нередко путает
      // кодировку (двойное декодирование UTF-8) и не всегда угадывает
      // разделитель ';', которым обычно выгружает 1С. Поэтому парсим сами.
      let text = fs.readFileSync(filePath, 'utf8');
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // срезаем BOM

      const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
      if (!lines.length) return { rows: [] };

      // Автоопределение разделителя по первой строке — считаем, каких
      // разделителей больше вне кавычек: запятых или точек с запятой.
      const semicolons = (lines[0].match(/;/g) || []).length;
      const commas = (lines[0].match(/,/g) || []).length;
      const delimiter = semicolons >= commas ? ';' : ',';

      const rows = lines.map(l => parseCsvLine(l, delimiter));
      return { rows };
    }

    // .xlsx / .xls — обычное бинарное чтение через библиотеку xlsx
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    return { rows };
  } catch (e) {
    return { error: 'Не удалось прочитать файл: ' + e.message };
  }
});

// ─── ДОКУМЕНТЫ ───────────────────────────────────────────
ipcMain.handle('documents:list', (_, clientId) => {
  return db.get('documents').filter({ client_id: clientId }).value();
});

// Для дашборда аутсорсера: готовность по модулям (ОТ/ПДн/ВУ) считается по
// всем клиентам сразу. Один проход по всей таблице документов вместо N
// отдельных documents:list — иначе при росте числа клиентов (цель — 200+)
// открытие дашборда дёргало бы IPC по разу на каждого клиента.
ipcMain.handle('documents:list-all', () => {
  return db.get('documents').value();
});

ipcMain.handle('documents:add', (_, data) => {
  const id = nextId('documents');
  db.get('documents').push({ ...data, id, created_at: now(), updated_at: now() }).write();
  return { id };
});

ipcMain.handle('documents:update-status', (_, id, status) => {
  db.get('documents').find({ id }).assign({ status, updated_at: now() }).write();
  return { ok: true };
});

// Удаление одного документа — и записи в базе, и физического файла на
// диске. Раньше такой функции не существовало вообще: единственный
// способ был лезть в файл базы руками (найдено 12.07.2026 на реальном
// кейсе — переиспользованный client_id "прицепил" чужие документы к
// новому клиенту, а убрать их через интерфейс было нельзя).
ipcMain.handle('documents:delete', (_, id) => {
  const doc = db.get('documents').find({ id }).value();
  if (!doc) return { error: 'Документ не найден' };
  if (doc.filepath) {
    try { fs.unlinkSync(doc.filepath); }
    catch (_) { /* файла уже нет на диске — не страшно, всё равно чистим запись в базе */ }
  }
  db.get('documents').remove({ id }).write();
  return { ok: true };
});

// Массовая очистка пакета документов клиента — целиком (module не
// передан) или по конкретному модулю (OT/PD/VU/CHOP/SOUT). Нужна для
// пересборки пакета с нуля, а не только для чистки багов вроде описанного
// выше.
ipcMain.handle('documents:clear', (_, clientId, module) => {
  const query = module ? { client_id: clientId, module } : { client_id: clientId };
  const docs = db.get('documents').filter(query).value();
  let deleted = 0;
  for (const doc of docs) {
    if (doc.filepath) {
      try { fs.unlinkSync(doc.filepath); } catch (_) {}
    }
    deleted++;
  }
  db.get('documents').remove(query).write();
  return { ok: true, deleted };
});

// ─── СОБЫТИЯ ─────────────────────────────────────────────
ipcMain.handle('events:list', (_, clientId) => {
  if (clientId) {
    return db.get('events').filter({ client_id: clientId }).sortBy('due_date').value();
  }
  const events = db.get('events').sortBy('due_date').value();
  const clients = db.get('clients').value();
  return events.map(e => ({
    ...e,
    client_name: (clients.find(c => c.id === e.client_id) || {}).name || ''
  }));
});

ipcMain.handle('events:add', (_, data) => {
  const id = nextId('events');
  db.get('events').push({ ...data, id, status: 'pending' }).write();
  return { id };
});

// ─── ЗАДАЧИ ──────────────────────────────────────────────
ipcMain.handle('tasks:list', () => {
  const tasks = db.get('tasks').sortBy('created_at').value();
  const clients = db.get('clients').value();
  return tasks.map(t => ({
    ...t,
    client_name: t.client_id ? (clients.find(c => c.id === t.client_id) || {}).name || '' : ''
  }));
});

ipcMain.handle('tasks:add', (_, data) => {
  if (!data.title?.trim()) return { error: 'Текст задачи обязателен' };
  const id = nextId('tasks');
  db.get('tasks').push({ ...data, id, done: 0, created_at: now() }).write();
  return { id };
});

ipcMain.handle('tasks:toggle', (_, id) => {
  const task = db.get('tasks').find({ id }).value();
  db.get('tasks').find({ id }).assign({ done: task.done ? 0 : 1 }).write();
  return { ok: true };
});

ipcMain.handle('tasks:delete', (_, id) => {
  db.get('tasks').remove({ id }).write();
  return { ok: true };
});

// ─── TELEGRAM ────────────────────────────────────────────
// Минимальный клиент Bot API на чистом https, без новых npm-зависимостей —
// тот же стиль, что уже использован в ai:request.
function telegramApi(token, method, params) {
  return new Promise((resolve) => {
    const https = require('https');
    const data = JSON.stringify(params || {});
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve({ ok: false, description: 'Некорректный ответ Telegram (' + res.statusCode + ')' }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, description: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, description: 'Таймаут запроса к Telegram' }); });
    req.write(data);
    req.end();
  });
}

// Привязка бота: берём последнее сообщение пользователя боту через getUpdates,
// достаём оттуда chat_id (без него слать сообщения некому), сохраняем и сразу
// шлём настоящее подтверждение в сам чат — чтобы человек увидел реальный
// результат в Telegram, а не просто зелёный тост в приложении.
ipcMain.handle('telegram:bind', async (_, token) => {
  token = (token || '').trim();
  if (!token) return { ok: false, error: 'Введите токен бота' };

  const updates = await telegramApi(token, 'getUpdates', {});
  if (!updates.ok) {
    return { ok: false, error: 'Не удалось подключиться к Telegram: ' + (updates.description || 'проверьте токен') };
  }
  if (!updates.result || !updates.result.length) {
    return { ok: false, error: 'Сообщений от вас боту не найдено. Откройте бота в Telegram, напишите ему что угодно, и нажмите «Привязать» ещё раз.' };
  }

  const last = updates.result[updates.result.length - 1];
  const chatId = last.message?.chat?.id ?? last.channel_post?.chat?.id;
  if (!chatId) return { ok: false, error: 'Не удалось определить chat_id из последнего сообщения' };

  const sent = await telegramApi(token, 'sendMessage', {
    chat_id: chatId,
    text: '✅ КомплаенсПро привязан к этому чату.\n\nСюда будут приходить утренняя сводка и срочные уведомления о просрочках — пока приложение открыто на компьютере.',
  });
  if (!sent.ok) {
    return { ok: false, error: 'Бот найден, но сообщение не отправилось: ' + (sent.description || '') };
  }

  db.get('settings').assign({ tg_token: token, tg_chat_id: String(chatId) }).write();
  return { ok: true, chatId: String(chatId) };
});

// Собирает текст утренней сводки: просрочено + сегодня + открытые срочные задачи.
function buildMorningDigestText() {
  const today    = new Date().toISOString().slice(0, 10);
  const clients  = db.get('clients').value();
  const events   = db.get('events').value();
  const tasks    = db.get('tasks').filter({ done: 0 }).value();

  const overdue = events.filter(e => e.status === 'pending' && e.due_date < today);
  const todayEv = events.filter(e => e.status === 'pending' && e.due_date === today);
  const urgentTasks = tasks.filter(t => t.priority === 'urgent');

  const clientName = (id) => (clients.find(c => c.id === id) || {}).name || 'Клиент';

  let text = `☀️ Доброе утро! Сводка на ${new Date().toLocaleDateString('ru-RU')}\n`;

  if (!overdue.length && !todayEv.length && !urgentTasks.length) {
    text += '\nНа сегодня всё в порядке, просрочек нет ✅';
    return text;
  }

  if (overdue.length) {
    text += `\n🔴 Просрочено (${overdue.length}):\n`;
    text += overdue.slice(0, 8).map(e => `• ${e.title} — ${clientName(e.client_id)}`).join('\n');
    if (overdue.length > 8) text += `\n…и ещё ${overdue.length - 8}`;
  }
  if (todayEv.length) {
    text += `\n\n🟡 Сегодня (${todayEv.length}):\n`;
    text += todayEv.slice(0, 8).map(e => `• ${e.title} — ${clientName(e.client_id)}`).join('\n');
  }
  if (urgentTasks.length) {
    text += `\n\n⚡ Срочных задач открыто: ${urgentTasks.length}`;
  }
  return text;
}

// Если включена утренняя сводка, не отправлена сегодня и сейчас 8:00 или позже —
// отправляем. Это даёт «догоняющую» логику само по себе: если приложение
// открыли в 14:00, а сводка за сегодня ещё не уходила — она уйдёт прямо сейчас.
async function maybeSendMorningDigest() {
  const s = db.get('settings').value();
  if (!s.tg_token || !s.tg_chat_id || s.tg_morning !== '1') return;

  const today = new Date().toISOString().slice(0, 10);
  if (s.tg_last_morning_date === today) return;
  if (new Date().getHours() < 8) return;

  const text = buildMorningDigestText();
  const res = await telegramApi(s.tg_token, 'sendMessage', { chat_id: s.tg_chat_id, text });
  if (res.ok) {
    db.get('settings').assign({ tg_last_morning_date: today }).write();
  }
}

// Срочные уведомления: шлём только про события, которые СТАЛИ просроченными
// и о которых ещё не уведомляли (флаг tg_notified на самом событии) — чтобы
// не дублировать одно и то же сообщение при каждой проверке.
async function checkUrgentEvents() {
  const s = db.get('settings').value();
  if (!s.tg_token || !s.tg_chat_id || s.tg_urgent !== '1') return;

  const today = new Date().toISOString().slice(0, 10);
  const clients = db.get('clients').value();
  const newlyOverdue = db.get('events')
    .filter(e => e.status === 'pending' && e.due_date < today && !e.tg_notified)
    .value();

  for (const e of newlyOverdue) {
    const name = (clients.find(c => c.id === e.client_id) || {}).name || 'Клиент';
    const text = `🔴 Просрочено: «${e.title}» — ${name}\nСрок был: ${e.due_date}`;
    const res = await telegramApi(s.tg_token, 'sendMessage', { chat_id: s.tg_chat_id, text });
    if (res.ok) {
      db.get('events').find({ id: e.id }).assign({ tg_notified: 1 }).write();
    }
  }
}

function startTelegramScheduler() {
  // Первая проверка — с небольшой задержкой, чтобы БД успела инициализироваться.
  setTimeout(() => { maybeSendMorningDigest(); checkUrgentEvents(); checkNpaUpdates(); checkNpaCitations(); }, 15000);
  // Дальше — каждые 5 минут, пока приложение открыто (checkNpaUpdates сам
  // ограничивает себя одним реальным запуском в день, checkNpaCitations —
  // одним запуском в 30 дней, см. соответствующие функции).
  setInterval(() => { maybeSendMorningDigest(); checkUrgentEvents(); checkNpaUpdates(); checkNpaCitations(); }, 5 * 60 * 1000);
}

// ─── МОНИТОРИНГ НПА ──────────────────────────────────────
// Уровень 1 — узкий список фундаментальных актов, на которых построены сами
// шаблоны документов (взято напрямую из gen_p1.js/gen_p2.js/gen_pd.js/gen_vu.js
// 18.06.2026). Изменение любого из них касается практически всех клиентов
// модуля — уходит в Telegram немедленно. Если меняете шаблон и он начинает
// ссылаться на новый акт — добавьте его сюда же.
// Создаёт по отдельной задаче каждому подходящему клиенту, когда ИИ
// подтвердил реальное изменение отслеживаемого акта. Не общая задача на
// всех — у каждого клиента своя, с указанием какой конкретно закон
// изменился и почему это важно (используем уже готовое ai-объяснение).
// Если акт меняется повторно — создаём новую задачу, не объединяем со старой
// (решение от 19.06.2026): так нагляднее видно историю изменений по клиенту.
function createNpaTasksForClients(watch, item, aiSummary) {
  const MODULE_LABELS = { ot: 'охране труда', pd: 'персональным данным', vu: 'воинскому учёту', chop: 'частной охранной деятельности', pasf: 'аварийно-спасательному формированию' };
  const moduleCode = (watch.module || 'ot').toUpperCase(); // 'OT' | 'PD' | 'VU' — как хранится в client.modules
  const moduleLabel = MODULE_LABELS[watch.module] || watch.module;

  const clients = db.get('clients').value();
  const targets = clients.filter(c => {
    if (c.archived) return false;
    const mods = (c.modules || '').split(',').map(m => m.trim());
    if (!mods.includes(moduleCode)) return false;
    if (typeof watch.clientFilter === 'function' && !watch.clientFilter(c)) return false;
    return true;
  });

  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const existingTasks = db.get('tasks').value();

  // Конкретные документы, которые нужно перегенерировать — если знаем (relatedDocs),
  // показываем их явно вместо общей фразы «проверить документы по модулю».
  const docs = Array.isArray(watch.relatedDocs) && watch.relatedDocs.length ? watch.relatedDocs : null;

  // ВАЖНО (найдено 12.07.2026, реальный кейс — Александр заметил сам):
  // само обнаружение изменения закона НИКАК не связано с тем, дошла ли
  // правка текста генератора до ЭТОЙ КОНКРЕТНОЙ установки. NPA_WATCHLIST
  // видит изменение сразу у всех подписчиков (каждый опрашивает
  // pravo.gov.ru сам), а исправленный текст в generator.js/gen_pd.js/
  // gen_vu.js доезжает только через коммит + package.json + автообновление
  // — с задержкой. Раньше задача сразу звала «Сформируйте пакет», подписчик
  // жал кнопку, получал СТАРЫЙ текст и решал, что уже всё актуально —
  // ложное чувство соответствия закону. Теперь сверяемся с doc-meta.js:
  // если version у затронутых документов в ЭТОЙ установленной копии кода
  // ещё не поднята — значит фикс сюда не доехал, зовём не «формируйте»,
  // а «дождитесь обновления программы».
  const DOC_META = require('./doc-meta');
  const fixAlreadyShipped = docs
    ? docs.some(name => (DOC_META[name + '.docx'] || {}).version > 1)
    : false;

  const docsText = docs
    ? (fixAlreadyShipped
        ? `Обновите: ${docs.join(', ')}.`
        : `Затронутые документы: ${docs.join(', ')}. Обновление программы для этого ещё готовится — дождитесь новой версии приложения (Настройки → Подписка → проверка обновлений), формировать пакет заново пока бесполезно.`)
    : `Проверьте документы по ${moduleLabel}.`;
  const policyNote = mightAffectPolicy(aiSummary)
    ? ' Возможно, затрагивает Политику в области охраны труда — проверьте вручную (структурное изменение).'
    : '';

  for (const c of targets) {
    // Защита от дублей: если у этого клиента уже есть незакрытая задача
    // по этому же самому документу (eoNumber) — не плодим вторую. Повторное
    // РЕАЛЬНОЕ изменение акта будет иметь другой eoNumber и создаст новую
    // задачу как договаривались — это именно защита от случайных повторов.
    const alreadyExists = existingTasks.some(t =>
      t.client_id === c.id && t.npa_eoNumber === item.eoNumber && !t.done
    );
    if (alreadyExists) continue;

    db.get('tasks').push({
      id: nextId('tasks'),
      title: `Изменился ${watch.label} — ${docsText}${policyNote}`,
      client_id: c.id,
      module: moduleCode, // 'OT'/'PD'/'VU' — без этого dashboard.js не знает, в какую вкладку отправлять подсказку
      priority: 'urgent',
      due_date: dueDate,
      done: 0,
      source: 'npa', // помечаем автосозданные задачи отдельно от ручных
      npa_summary: aiSummary || '',
      npa_eoNumber: item.eoNumber || '',
      npa_related_docs: docs || [],
      created_at: now(),
    }).write();
  }
}


// clientFilter — необязательная функция (client) => boolean. Если не задана,
// задача создаётся всем клиентам у которых подключён указанный module.
// Используем уже существующие поля карточки клиента — medcheck_required и hazard_works.
//
// relatedDocs — список конкретных документов, которые нужно перегенерировать
// при изменении этого акта (составлено по реальным ссылкам на законы внутри
// генераторов, не предположительно). «Политика в области ОТ» НЕ включена
// в список для № 2464 намеренно: это документ верхнего уровня, который
// должен меняться только при структурных изменениях (новые разделы,
// категории — например упрощёнка для микропредприятий), а не при любой
// технической правке. Эта проверка вынесена отдельно — см. POLICY_SIGNAL_WORDS.
const NPA_WATCHLIST = [
  { module: 'ot', code: '2464',   label: 'ПП РФ № 2464 — обучение по охране труда', actDate: '24.12.2021',
    skipSearch: true, skipReason: 'Подтверждено веб-поиском 09.07.2026: Постановление Правительства РФ от 24.12.2021 № 2464. Поиск на pravo.gov.ru нестабильно подтягивает другой акт с тем же номером из другого года (28.12.2022, про экономическую программу) — не доверяем автоматике для этого номера.',
    relatedDocs: ['Положение о системе управления охраной труда','Приказ об утверждении программ обучения','Положение о порядке обучения по охране труда'] },
  { module: 'ot', code: '772н',   label: 'Приказ Минтруда № 772н — обеспечение СИЗ', actDate: '29.10.2021',
    relatedDocs: ['Приказ об утверждении инструкций по охране труда','Положение о разработке инструкций по охране труда'] },
  { module: 'ot', code: '766н',   label: 'Приказ Минтруда № 766н — нормы выдачи СИЗ', actDate: '29.10.2021',
    relatedDocs: ['Приказ о назначении ответственного за СИЗ','Положение об обеспечении работников СИЗ'] },
  { module: 'ot', code: '776н',   label: 'Приказ Минтруда № 776н — система управления охраной труда', actDate: '29.10.2021',
    relatedDocs: ['Положение о системе управления охраной труда'] },
  { module: 'ot', code: '632н',   label: 'Приказ Минтруда № 632н', actDate: '15.09.2021',
    relatedDocs: ['Положение о системе управления охраной труда','Положение об учёте микротравм'] },
  { module: 'ot', code: '223н',   label: 'Приказ Минтруда № 223н — расследование несчастных случаев', actDate: '20.04.2022',
    relatedDocs: ['Положение о системе управления охраной труда'] },
  { module: 'ot', code: '398н',   label: 'Приказ Минтруда № 398н — аптечки первой помощи', actDate: '09.08.2024',
    relatedDocs: ['Приказ об обеспечении аптечками первой помощи','Инструкция о порядке использования аптечки'] },
  { module: 'ot', code: '811',    label: 'Приказ Минэнерго № 811 — электробезопасность', actDate: '12.08.2022',
    skipSearch: true, skipReason: 'Подтверждено веб-поиском 09.07.2026 (источники: ГАРАНТ, КонсультантПлюс, Контур.Норматив, официальный текст на imes.su): Приказ Минэнерго России от 12.08.2022 № 811 "Об утверждении Правил технической эксплуатации электроустановок потребителей электрической энергии", в силе с 07.01.2023. Не путать с Приказом Минтруда №903н (отдельный, тоже актуальный акт про охрану труда при эксплуатации электроустановок) — автоматическая проверка ранее ошибочно предлагала считать их одним и тем же.',
    clientFilter: c => !!c.hazard_works,
    relatedDocs: ['Приказ о назначении ответственного за электрохозяйство','Журнал учёта присвоения I группы электробезопасности','Программа инструктажа по электробезопасности'] },
  { module: 'ot', code: '903н',   label: 'Приказ Минтруда № 903н — электробезопасность', actDate: '15.12.2020',
    clientFilter: c => !!c.hazard_works,
    relatedDocs: ['Приказ о назначении ответственного за электрохозяйство','Журнал учёта присвоения I группы электробезопасности','Программа инструктажа по электробезопасности'] },
  { module: 'ot', code: '29н',    label: 'Приказ Минздрава № 29н — медосмотры', actDate: '28.01.2021',
    skipSearch: true, skipReason: 'Подтверждено веб-поиском 09.07.2026 (источники: ГАРАНТ, КонсультантПлюс, Контур.Норматив, publication.pravo.gov.ru): Приказ Минздрава России от 28.01.2021 № 29н. Поиск по номеру на pravo.gov.ru не находит этот акт в первых 10 результатах — более новые акты с тем же номером (напр. от 19.01.2026, про стоматологию) вытесняют его.',
    clientFilter: c => !!c.medcheck_required,
    relatedDocs: ['Приказ об организации медицинских осмотров','Список контингента для медицинских осмотров'] },
  { module: 'ot', code: '782н',   label: 'Приказ Минтруда № 782н — работы на высоте', actDate: '16.11.2020',
    clientFilter: c => !!c.hazard_works,
    relatedDocs: ['Инструкция по охране труда при работах на высоте'] },
  { module: 'pd', code: '152-ФЗ', label: 'ФЗ № 152-ФЗ — о персональных данных', actDate: '27.07.2006',
    skipSearch: true, skipReason: 'Широко известный основополагающий закон о персональных данных (дата уже используется в pd.js). Не находится в топ-10 поиска по номеру на pravo.gov.ru — ФЗ №152 переиздаётся каждый год под разными темами, и версия 2006 года тонет среди десятков более поздних поправочных актов с тем же номером.',
    relatedDocs: ['Приказ о назначении ответственного за ПД','Политика об обработке персональных данных','Положение о защите персональных данных работников','Согласие на обработку персональных данных'] },
  { module: 'pd', code: '156-ФЗ', label: 'ФЗ № 156-ФЗ — поправки в 152-ФЗ (обязательное отдельное согласие, трансграничная передача)', actDate: '24.06.2025',
    // ИСПРАВЛЕНО 09.07.2026: было '266-ФЗ' (от 14.07.2022) — устарело.
    // Подтверждено прямым просмотром gen_pd.js: везде цитируется именно
    // ФЗ №156 от 24.06.2025 (ст.9 ч.1 — обязательное отдельное согласие
    // с 01.09.2025), ни одного упоминания 266-ФЗ во всём файле. watchlist
    // был несинхронизирован с реальным кодом генератора — расхождение
    // предположительно возникло в сессии по ПДн (чат 18), когда gen_pd.js
    // обновили, но забыли обновить эту запись.
    relatedDocs: ['Приказ о назначении ответственного за ПД','Политика об обработке персональных данных','Согласие на обработку персональных данных'] },
  { module: 'pd', code: '1119',   label: 'ПП РФ № 1119 — защита ПДн в информационных системах', actDate: '01.11.2012',
    skipSearch: true, skipReason: 'Дата уже используется в pd.js. Не находится в топ-10 поиска по номеру — та же проблема ежегодного переиспользования номера другими ведомствами/регионами.',
    relatedDocs: ['Приказ о назначении ответственного за безопасность ПД','Приказ о создании комиссии по уровню защищённости','Акт определения уровня защищённости ИСПДн','Инструкция пользователя ИСПДн'] },
  { module: 'pd', code: '180',    label: 'Приказ РКН № 180 — форма уведомления об обработке персональных данных', actDate: '28.10.2022',
    // ИСПРАВЛЕНО 09.07.2026: было '178' — неверный номер. Подтверждено
    // веб-поиском: актуальная форма уведомления об обработке ПДн
    // утверждена Приказом Роскомнадзора от 28.10.2022 № 180 (заменил
    // старый приказ №94 от 30.05.2017). Откуда взялся именно "178" в
    // исходном коде — неизвестно, возможно опечатка при первом
    // составлении watchlist. relatedDocs ниже не менялись, но при первой
    // возможности стоит перепроверить, не ссылается ли где-то в коде
    // генераторов (gen_pd.js) старый номер 178 или устаревший 94.
    relatedDocs: ['Акт оценки вреда субъектам ПДн','Памятка подачи уведомления в РКН'] },
  { module: 'vu', code: '719',    label: 'ПП РФ № 719 — положение о воинском учёте', actDate: '27.11.2006',
    skipSearch: true, skipReason: 'Дата подтверждена в комментариях кодовой базы предыдущих сессий. Не находится в топ-10 поиска по номеру — та же проблема переиспользования номера.',
    relatedDocs: ['ВУ-01 Приказ о назначении ответственного за воинский учёт','ВУ-04 Карточка учёта организации (Форма №18)','ВУ-07 Уведомление в военкомат о приёме военнообязанного','ВУ-08 Уведомление в военкомат об увольнении военнообязанного'] },
  { module: 'vu', code: '53-ФЗ',  label: 'ФЗ № 53-ФЗ — о воинской обязанности и военной службе', actDate: '28.03.1998',
    skipSearch: true, skipReason: 'Широко известный неизменный федеральный закон, дата подтверждена в комментариях кодовой базы. Не находится в топ-10 поиска по номеру — ФЗ №53 переиздаётся ежегодно под разными темами.',
    relatedDocs: ['ВУ-01 Приказ о назначении ответственного за воинский учёт','ВУ-02 Функциональные обязанности ответственного за воинский учёт','ВУ-03 План работы по осуществлению воинского учёта'] },

  // ───────── ЧОП (аддон CHOP) ─────────
  // module:'chop' → moduleCode='CHOP' (см. createNpaTasksForClients) — задачи
  // создаются только клиентам с модулем CHOP, дополнительный clientFilter
  // не нужен, сама принадлежность к модулю уже фильтрует нужных клиентов.
  { module: 'chop', code: '2487-1', label: 'Закон РФ № 2487-1 — о частной детективной и охранной деятельности', actDate: '11.03.1992',
    skipSearch: true, skipReason: 'Акт 1992 года — pravo.gov.ru не находит его по номеру даже с датным окном (проверено на живом тесте 09.07.2026, дважды). Номер и содержание подтверждены вручную и независимо совпадением с предварительным вариантом системы — Закон РФ от 11.03.1992 № 2487-1, действует в текущей редакции.',
    relatedDocs: ['Приказ об утверждении табеля постов охраны','Приказ о допуске к оружию и специальным средствам','Инструкция охраннику поста'] },
  { module: 'chop', code: '272н',  label: 'Приказ Минздрава № 272н — медицинское освидетельствование частных охранников (002-ЧО/у, 002-О/у)', actDate: '13.04.2026',
    // ИСПРАВЛЕНО 09.07.2026: было '1252н' (от 26.11.2020). Подтверждено
    // веб-поиском — акт РЕАЛЬНО заменён новым Приказом Минздрава №272н
    // от 13.04.2026. Это первая находка через полноценный веб-поиск,
    // не через pravo.gov.ru API — акт вступил в силу совсем недавно,
    // возможно, ещё не был замечен обычным мониторингом (checkNpaUpdates).
    relatedDocs: ['Приказ о допуске к оружию и специальным средствам'] },
  { module: 'chop', code: '342н',   label: 'Приказ Минздрава № 342н — психиатрическое освидетельствование работников (базовый акт)', actDate: '20.05.2022',
    relatedDocs: ['Приказ о допуске к оружию и специальным средствам'] },
  { module: 'chop', code: '392н',   label: 'Приказ Минздрава № 392н — изменения в порядок психиатрического освидетельствования (с 01.03.2026)', actDate: '02.07.2025',
    relatedDocs: ['Приказ о допуске к оружию и специальным средствам'] },

  // ───────── ПАСФ (аддон PASF) ─────────
  // module:'pasf' → moduleCode='PASF' — задачи создаются только клиентам
  // с модулем PASF, отдельный clientFilter не нужен по той же логике, что у ЧОП.
  { module: 'pasf', code: '151-ФЗ', label: 'ФЗ № 151-ФЗ — об аварийно-спасательных службах и статусе спасателей', actDate: '22.08.1995',
    skipSearch: true, skipReason: 'Акт 1995 года — та же ситуация, что и с 2487-1: pravo.gov.ru не находит по номеру даже с датным окном. Номер и название подтверждены как широко известный неизменный федеральный закон.',
    relatedDocs: ['Инструкция по охране труда спасателя АСФ', 'Инструкция по охране труда для дежурного диспетчера АСФ'] },
  { module: 'pasf', code: '1091',   label: 'ПП РФ № 1091 — аттестация АСС, АСФ и спасателей', actDate: '22.12.2011',
    skipSearch: true, skipReason: 'Подтверждено веб-поиском 09.07.2026 (источники: ГАРАНТ, МЧС России, government.ru): Постановление Правительства РФ от 22.12.2011 № 1091 "О некоторых вопросах аттестации аварийно-спасательных служб, аварийно-спасательных формирований, спасателей и граждан, приобретающих статус спасателя" — заменило собой более раннее ПП №1479 от 1997 года.',
    relatedDocs: ['Протокол аттестации формирования', 'Свидетельство об аттестации спасателя'] },
  { module: 'pasf', code: '2451',   label: 'ПП РФ № 2451 — предупреждение и ликвидация разливов нефти и нефтепродуктов', actDate: '31.12.2020',
    skipSearch: true, skipReason: 'Подтверждено веб-поиском 09.07.2026 (источники: ГАРАНТ, Пепеляев Групп, Росприроднадзор, government.ru, официальный текст на publication.pravo.gov.ru/Document/View/0001202101090019): Постановление Правительства РФ от 31.12.2020 № 2451 "Об утверждении Правил организации мероприятий по предупреждению и ликвидации разливов нефти и нефтепродуктов...", опубликовано 09.01.2021, заменило ПП №240 от 2002 года. Ранее система ошибочно предложила несуществующий вариант "№1189 от 2014" — этому варианту не доверять.',
    relatedDocs: ['Инструкция по недопущению вторичного загрязнения при проведении АСР', 'Инструкция по обеспечению доступа в зону работ ЛРН'] },
  { module: 'pasf', code: '116-ФЗ', label: 'ФЗ № 116-ФЗ — промышленная безопасность опасных производственных объектов', actDate: '21.07.1997',
    skipSearch: true, skipReason: 'Акт 1997 года — не находится по номеру даже с датным окном (проверено дважды, 09.07.2026). Дата и название совпали с предварительным вариантом системы на этом же прогоне, дополнительное подтверждение уверенности.',
    relatedDocs: ['Инструкция по электробезопасности при эксплуатации опасных производственных объектов'] },
];

// Сигнальные слова — если ИИ-объяснение находки содержит одно из них,
// добавляем в задачу отдельную пометку проверить Политику в области ОТ
// вручную. Это не замена экспертной оценки, а подсказка не пропустить
// действительно структурное изменение.
const POLICY_SIGNAL_WORDS = ['микропредприят', 'упрощён', 'упрощен', 'новый раздел', 'категори'];
function mightAffectPolicy(aiSummary) {
  const text = (aiSummary || '').toLowerCase();
  return POLICY_SIGNAL_WORDS.some(w => text.includes(w));
}

// Официальный read-only API публикации правовых актов (без AI, без скрейпинга
// HTML — структурированный JSON). Документация: publication.pravo.gov.ru/help
function pravoApiSearch(params) {
  return new Promise((resolve) => {
    const https = require('https');
    const http = require('http');
    const qs = new URLSearchParams(params).toString();
    console.log('[NPA] запрос →', `http://publication.pravo.gov.ru/api/Documents?${qs}`);
    const req = http.request({
      hostname: 'publication.pravo.gov.ru',
      path: `/api/Documents?${qs}`,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('[NPA] статус:', res.statusCode, '| длина ответа:', body.length, '| начало:', body.slice(0, 300));
        // ВАЖНО: не-200 ответ (напр. 429 при частых запросах подряд) может
        // прийти с телом, в котором просто нет поля items — раньше это
        // молча трактовалось как "документов не найдено" (ложный сигнал
        // проблемы), хотя на самом деле запрос был отклонён. Найдено на
        // живом тесте 09.07.2026: массовый ложный "не найден" по ~25 актам
        // разом — явный признак именно такого отказа, а не 25 реальных
        // проблем с номерами.
        if (res.statusCode !== 200) {
          resolve({ items: [], error: 'HTTP ' + res.statusCode + ' от pravo.gov.ru' });
          return;
        }
        try {
          const parsed = JSON.parse(body);
          console.log('[NPA] ключи в ответе:', Object.keys(parsed), '| найдено items:', (parsed.items || []).length);
          resolve(parsed);
        }
        catch (e) { console.log('[NPA] не распарсился JSON:', e.message); resolve({ items: [], error: 'Некорректный ответ pravo.gov.ru (' + res.statusCode + ')' }); }
      });
    });
    req.on('error', (e) => { console.log('[NPA] ошибка сети:', e.message); resolve({ items: [], error: e.message }); });
    req.on('timeout', () => { req.destroy(); console.log('[NPA] таймаут'); resolve({ items: [], error: 'Таймаут запроса к pravo.gov.ru' }); });
    req.end();
  });
}

// Раз в день: точный список (Уровень 1, → Telegram + запись с пометкой
// critical) и общая лента по охране труда (Уровень 2, → только запись с
// пометкой general, для ленты в боковом меню). Догоняющая логика как у
// утренней сводки: если не проверяли неделю — спросим за весь пропущенный
// период, а не только за сегодня.
let npaCheckInProgress = false;

async function checkNpaUpdates(force = false) {
  if (npaCheckInProgress) { console.log('[NPA] уже запущено, пропускаем'); return { ok: true, skipped: true }; }
  npaCheckInProgress = true;
  try {
    return await _checkNpaUpdates(force);
  } finally {
    npaCheckInProgress = false;
  }
}

async function _checkNpaUpdates(force = false) {
  const s = db.get('settings').value();
  const today = new Date().toISOString().slice(0, 10);
  if (!force && s.npa_last_check_date === today) return { ok: true, skipped: true };

  const sinceDate = s.npa_last_check_date || new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const existingIds = new Set(db.get('npa_changes').value().map(n => n.eoNumber));

  let anySuccess = false;
  let tgSentThisRun = 0;
  const TG_LIMIT_PER_RUN = 3; // не более 3 уведомлений за один прогон, чтобы не спамить

  for (const watch of NPA_WATCHLIST) {
    // Ищем по Number (точный номер) чтобы не ловить совпадения в названиях других документов.
    // NumberSearchType=1 означает "содержит" — это лучше чем Name для коротких кодов вроде "2464"
    const res = await pravoApiSearch({ Number: watch.code, NumberSearchType: 1, PublishDateFrom: sinceDate, PublishDateTo: today, PageSize: 10 });
    if (!res.error) anySuccess = true;
    for (const item of (res.items || [])) {
      if (existingIds.has(item.eoNumber)) continue;

      // Спрашиваем ИИ — реально ли этот документ меняет тот акт, который мы отслеживаем.
      // Требуем строго ДА/НЕТ без пояснений, чтобы не путаться в интерпретации.
      const relevanceCheck = await callAI(
        `Документ с портала pravo.gov.ru: "${item.title || item.complexName}".\n` +
        `Мы отслеживаем изменения в: ${watch.label}.\n` +
        `Ответь ТОЛЬКО одним словом без пояснений:\n` +
        `ДА — если этот документ напрямую вносит изменения, поправки или отменяет именно этот конкретный федеральный акт.\n` +
        `НЕТ — во всех остальных случаях: региональный акт, случайное совпадение номера, косвенная связь, признание утратившим силу другого акта, иная тематика.`
      );
      const aiAnswer = relevanceCheck.ok ? relevanceCheck.text.trim().toUpperCase().slice(0, 10) : 'НЕТ (нет ключа)';
      const isRelevant = aiAnswer.startsWith('ДА');
      const hasKey = relevanceCheck.ok || (aiAnswer !== 'НЕТ (нет ключа)');
      console.log('[NPA] ИИ-фильтр:', isRelevant ? '✅ ДА' : '❌ НЕТ', '|', aiAnswer, '|', (item.title || item.complexName || '').slice(0, 80));
      if (!isRelevant && hasKey) continue;

      existingIds.add(item.eoNumber);

      const ai = await callAI(
        `Документ с портала pravo.gov.ru: "${item.title || item.complexName}".\n` +
        `Он вносит изменения в: ${watch.label}.\n` +
        `Напиши одно-два предложения по-русски: что это значит для работодателя и какие документы (по охране труда / ПДн / воинскому учёту) нужно проверить или обновить.\n` +
        `Отвечай только текстом, без JSON, без кавычек, без структуры.`
      );

      // На случай если ИИ всё равно вернул JSON — вытаскиваем текст
      let aiSummary = '';
      if (ai.ok) {
        const raw = ai.text.trim();
        try {
          const parsed = JSON.parse(raw);
          aiSummary = parsed.summary || parsed.text || parsed.result || raw;
        } catch (e) {
          aiSummary = raw;
        }
      }

      db.get('npa_changes').push({
        id: nextId('npa_changes'), eoNumber: item.eoNumber,
        title: item.title || item.complexName || item.name,
        number: item.number, documentDate: item.documentDate, publishDate: item.publishDateShort,
        module: watch.module, matched: watch.label, tier: 'critical',
        ai_summary: aiSummary, ai_verified: isRelevant, seen: 0, created_at: now(),
      }).write();

      // Автозадачи по клиентам — только для подтверждённых ИИ изменений.
      // Каждому подходящему клиенту своя отдельная задача (не общая на всех).
      if (isRelevant) {
        createNpaTasksForClients(watch, item, aiSummary);
      }

      if (isRelevant && s.tg_npa !== '0' && s.tg_token && s.tg_chat_id && tgSentThisRun < TG_LIMIT_PER_RUN) {
        const text = `⚖️ Изменение в законодательстве\n\n${watch.label}\n\n${item.title || item.complexName}\n\n${aiSummary || 'Откройте документ на pravo.gov.ru для деталей.'}`;
        await telegramApi(s.tg_token, 'sendMessage', { chat_id: s.tg_chat_id, text });
        tgSentThisRun++;
      }
    }
  }

  // Уровень 2 — широкая лента по охране труда (правила по видам работ,
  // изменения ТК РФ и т.п.), без AI и без Telegram — просто копится для
  // бокового меню «Охрана труда». Стоп-слова убирают региональный мусор
  // без дополнительных AI-вызовов.
  const STOP_WORDS = ['конкурс', 'аппарат', 'межведомственн', 'состав комисс', 'губернатор', 'республик', 'городск', 'областн комисс', 'муниципальн'];
  if (s.npa_general_feed !== '0') {
    const general = await pravoApiSearch({ Name: 'охране труда', PublishDateFrom: sinceDate, PublishDateTo: today });
    if (!general.error) anySuccess = true;
    for (const item of (general.items || [])) {
      if (existingIds.has(item.eoNumber)) continue;
      const title = (item.title || item.complexName || '').toLowerCase();
      if (STOP_WORDS.some(w => title.includes(w))) continue;
      existingIds.add(item.eoNumber);
      db.get('npa_changes').push({
        id: nextId('npa_changes'), eoNumber: item.eoNumber,
        title: item.title || item.complexName || item.name,
        number: item.number, documentDate: item.documentDate, publishDate: item.publishDateShort,
        module: 'ot', matched: 'Общая лента по охране труда', tier: 'general',
        ai_summary: '', seen: 0, created_at: now(),
      }).write();
    }
  }

  if (anySuccess) {
    db.get('settings').assign({ npa_last_check_date: today }).write();
  }
  return { ok: anySuccess, skipped: false };
} // конец _checkNpaUpdates

// ─── АУДИТ АКТУАЛЬНОСТИ ЦИТАТ НПА ────────────────────────────────
// Отличие от checkNpaUpdates выше: та функция ищет НОВЫЕ акты, которые
// вносят изменения в уже занесённый в NPA_WATCHLIST номер (мониторинг
// за период). Эта функция проверяет сам ФАКТ — правилен ли и актуален
// ли номер, который у нас записан как watch.code, прямо сейчас. Это
// ловит другой класс проблем: неверно указанный номер акта с самого
// начала (реальный прецедент — ПП №240 вместо №2451, 1/29 вместо №2464,
// №1094 вместо №304, найдено вручную в сессии по модулю ПАСФ 08.07.2026).
//
// Переиспользует NPA_WATCHLIST как готовый реестр цитат (code+label+
// relatedDocs уже составлены по реальным ссылкам в generator.js) —
// отдельного сканирования gen_*.js не строим, чтобы не дублировать
// источник истины.
//
// Экономия AI-вызовов: обращаемся к ИИ ТОЛЬКО когда структурированный
// ответ pravo.gov.ru сам по себе неоднозначен (акт не найден, найдено
// несколько кандидатов с одним номером, или тип найденного акта не
// совпадает с ожидаемым). Если найден ровно один акт с точным
// совпадением номера и ожидаемым типом — это уже полноценное
// доказательство само по себе, спрашивать ИИ незачем.

// Нормализация номера акта для сравнения: убираем пробелы, «№», приводим
// к нижнему регистру. "772н" / "772 н" / "№772Н" — должны совпадать.
function normalizeActNumber(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/№/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// Извлекаем «тип акта» из label для грубой проверки соответствия
// (label у нас всегда в формате "ТИП № КОД — описание", см. NPA_WATCHLIST).
// Точная лингвистика не нужна — это лишь сигнал «похоже/не похоже»,
// решающий, эскалировать ли к ИИ, а не финальный вердикт.
const ACT_KIND_KEYWORDS = {
  'пп рф':          ['постановление правительства'],
  'приказ минтруда':['минтруда', 'министерства труда'],
  'приказ минздрава':['минздрав', 'министерства здравоохранения'],
  'приказ минэнерго':['минэнерго', 'министерства энергетики'],
  'фз':             ['федеральный закон'],
  'закон рф':       ['закон рф', 'закон российской федерации'],
};
function extractActKind(label) {
  const beforeNumber = String(label || '').split('№')[0].trim().toLowerCase();
  return beforeNumber;
}
function actKindMatchesTitle(kind, titleText) {
  const keywords = ACT_KIND_KEYWORDS[kind];
  if (!keywords) return true; // неизвестный тип метки — не блокируем, пусть решает ИИ ниже по неоднозначности
  const t = String(titleText || '').toLowerCase();
  return keywords.some(k => t.includes(k));
}

// Мягкая проверка темы (не жёсткий фильтр!) — найдено на живом тесте
// 09.07.2026: одно и то же ведомство переиздаёт один и тот же номер в
// разные годы на совершенно разные темы (напр. Минтруд №398н один год —
// про аптечки, другой год — про ортезирование инвалидов). Фильтр по
// ведомству (kind) один этого не ловит. НО делать это жёстким фильтром
// нельзя — заголовки формулируют тему другими словами, чем в нашем
// label (напр. "электробезопасность" в label vs "электроустановки" в
// реальном заголовке акта — тот же акт, разная лексика). Поэтому это
// не блокирующий критерий, а триггер: "тип совпал, тема не узнаётся
// по ключевым словам — стоит перепроверить у ИИ одним быстрым запросом,
// не считать это ни автоматическим OK, ни автоматической проблемой".
function extractTopicKeywords(label) {
  const afterDash = String(label || '').split('—')[1] || '';
  return afterDash.toLowerCase().replace(/[.,;:()«»"']/g, ' ').split(/\s+/).filter(w => w.length >= 5);
}
function topicMatchesTitle(topicWords, titleText) {
  if (!topicWords.length) return true; // не смогли извлечь ключевые слова темы — не блокируем
  const t = String(titleText || '').toLowerCase();
  return topicWords.some(w => t.includes(w));
}

// Защитный парсер ответа ИИ — на случай если модель всё равно завернула
// ответ в JSON, несмотря на просьбу отвечать одним словом/коротко (та же
// защита уже применяется к aiSummary в checkNpaUpdates выше). Без этого
// строгая проверка "startsWith('ДА')" ломается на ответах вида
// {"answer":"ДА"}, и такой случай тихо считается "НЕТ" — ложная тревога.
function extractAiText(raw) {
  const text = String(raw || '').trim();
  try {
    const parsed = JSON.parse(text);
    return String(parsed.answer || parsed.text || parsed.result || parsed.summary || text).trim();
  } catch (e) {
    return text;
  }
}

// Небольшая пауза между запросами — снижает риск рейт-лимита при аудите
// ~20 актов подряд, каждый из которых может делать 1-3 AI-вызова.
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Работа с известной датой принятия акта (watch.actDate, формат ДД.ММ.ГГГГ)
// — используется, чтобы сузить поиск на pravo.gov.ru датным окном и не
// путать целевой акт с десятками омонимов (нумерация ФЗ/ПП обнуляется
// каждый год у каждого органа — см. комментарий у _checkNpaCitations).
function parseRuDate(s) {
  const m = String(s || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
}
function addDays(date, days) { return new Date(date.getTime() + days * 86400000); }
function toApiDate(date) { return date.toISOString().slice(0, 10); }

let npaCitationCheckInProgress = false;

async function checkNpaCitations(force = false) {
  if (npaCitationCheckInProgress) return { ok: true, skipped: true };
  npaCitationCheckInProgress = true;
  try {
    return await _checkNpaCitations(force);
  } finally {
    npaCitationCheckInProgress = false;
  }
}

async function _checkNpaCitations(force = false) {
  const s = db.get('settings').value();
  const today = new Date().toISOString().slice(0, 10);

  if (!force) {
    const last = s.npa_citation_last_check_date;
    if (last) {
      const daysSince = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      if (daysSince < 30) return { ok: true, skipped: true };
    }
  }

  const results = [];
  let problemsFound = 0;

  for (const watch of NPA_WATCHLIST) {
    const base = {
      id: nextId('npa_citation_audit'),
      code: watch.code,
      module: watch.module,
      label: watch.label,
      checked_at: now(),
      seen: 0,
      relatedDocs: watch.relatedDocs || [],
    };

    // Акты, для которых уже установлено (на живых тестах), что pravo.gov.ru
    // структурно не находит их по номеру ни при каких условиях (обычно —
    // акты 1990-х/2000-х годов, старше периода индексации API) — не
    // тратим на них ни сетевые запросы, ни AI-вызовы каждый месяц заново.
    // Статус "ok" тут — это "проверено вручную", честно помечено в ai_note.
    if (watch.skipSearch) {
      const rec = {
        ...base, status: 'ok', found_title: '',
        ai_note: 'Не проверяется автоматически: ' + (watch.skipReason || 'подтверждено вручную, вне периметра поиска API.'),
        ai_suggested_fix: '',
      };
      db.get('npa_citation_audit').push(rec).write();
      results.push(rec);
      if (mainWindow) {
        mainWindow.webContents.send('npa:citationProgress', { done: results.length, total: NPA_WATCHLIST.length, current: watch.label });
      }
      continue;
    }

    // Пауза перед каждым актом (кроме самого первого) — снижает риск
    // рейт-лимита при последовательном аудите ~20 актов, каждый из
    // которых может делать 1-3 AI-вызова подряд. Найдено на живом тесте
    // 09.07.2026: без паузы результаты "мигали" между прогонами — одни
    // и те же актуальные акты то помечались проблемными, то нет, из-за
    // случайных сбоев AI-вызовов под нагрузкой, а не реальных изменений.
    if (results.length > 0) await sleep(1500);

    // Ищем сам акт по номеру. Пробовали сужать поиск на СЕРВЕРЕ через
    // PublishDateFrom/PublishDateTo — не сработало: на живом тесте
    // 09.07.2026 в результатах "узкого" окна ±180 дней вокруг известной
    // даты всё равно попадались акты 2026 года при ожидаемой дате 2022 —
    // судя по всему, pravo.gov.ru игнорирует диапазон дат в комбинации
    // с Number-поиском (аналогично уже известной особенности — "API
    // отклоняет PageSize для Name-запросов", видимо у Number-поиска свой
    // набор игнорируемых параметров). Фильтруем по дате на СВОЕЙ стороне —
    // среди уже полученных результатов широкого поиска, см. ниже.
    // PageSize:25 вызывал HTTP 400 на ВСЕХ актах разом (живой тест
    // 09.07.2026) — у API есть предел, возвращено на рабочее значение 10.
    // NumberSearchType:0 = точное совпадение номера (не 'содержит', как у
    // checkNpaUpdates выше, — это намеренно другой режим). Найдено на живом
    // тесте 09.07.2026: NumberSearchType:1 ('содержит') ловит вообще ЛЮБОЙ
    // документ, где искомый номер встречается как подстрока где угодно —
    // отсюда и был весь шум из посторонних актов. Точное совпадение резко
    // сокращает список кандидатов у источника, а не после факта.
    // Откат NumberSearchType:0 → 1 обратно (живой тест 09.07.2026: exact-match
    // без параметра DocumentTypes вызывал HTTP 500 почти на всех актах —
    // судя по примеру в документации API, NumberSearchType:0 ожидает
    // DocumentTypes рядом, а мы его не передаём. Не гоняемся дальше за
    // недокументированными особенностями этого API — вместо этого
    // отмечаем вручную подтверждённые вебом акты через skipSearch, см. ниже).
    const res = await pravoApiSearch({ Number: watch.code, NumberSearchType: 1, PageSize: 10 });

    if (res.error) {
      const rec = { ...base, status: 'needs_review', found_title: '', ai_note: 'Ошибка запроса к pravo.gov.ru: ' + res.error, ai_suggested_fix: '' };
      db.get('npa_citation_audit').push(rec).write();
      results.push(rec);
      continue;
    }

    const items = res.items || [];
    const kind = extractActKind(watch.label);
    const actDateParsed = watch.actDate ? parseRuDate(watch.actDate) : null;

    // ВАЖНО (найдено на живом тесте 09.07.2026): номера актов на
    // pravo.gov.ru НЕ уникальны глобально — каждое ведомство и регион
    // нумерует свои акты заново каждый год. Поиск по голому номеру без
    // даты возвращает ВСЕ акты с таким номером за всю историю сайта:
    // Постановления Правительства, приказы совсем других министерств,
    // региональные указы — настоящий акт тонет среди них. Поэтому фильтр
    // по типу акта (kind) здесь — ПЕРВИЧНЫЙ критерий отбора.
    const numberMatches = items.filter(it => normalizeActNumber(it.number) === normalizeActNumber(watch.code));

    // Если знаем точную дату принятия — сверяем её напрямую с documentDate
    // каждого кандидата из уже полученных numberMatches (допуск ±3 дня на
    // случай расхождений между источниками). Совпадение номера И точной
    // даты — практически стопроцентное доказательство, AI не нужен вообще.
    let dateMatches = [];
    if (actDateParsed) {
      dateMatches = numberMatches.filter(it => {
        const raw = it.documentDate ? String(it.documentDate).slice(0, 10) : null;
        if (!raw) return false;
        const itDate = new Date(raw);
        if (isNaN(itDate.getTime())) return false;
        return Math.abs(itDate.getTime() - actDateParsed.getTime()) <= 3 * 86400000;
      });
    }

    if (dateMatches.length === 1) {
      const rec = {
        ...base, status: 'ok',
        found_title: dateMatches[0].title || dateMatches[0].complexName || '',
        found_eoNumber: dateMatches[0].eoNumber || '',
        ai_note: 'Номер и известная дата принятия совпали точно.',
        ai_suggested_fix: '',
      };
      db.get('npa_citation_audit').push(rec).write();
      results.push(rec);
      if (mainWindow) mainWindow.webContents.send('npa:citationProgress', { done: results.length, total: NPA_WATCHLIST.length, current: watch.label });
      continue;
    }

    const kindFiltered = numberMatches.filter(it => actKindMatchesTitle(kind, (it.title || '') + ' ' + (it.complexName || '')));

    let rec;

    if (kindFiltered.length === 1) {
      const topicWords = extractTopicKeywords(watch.label);
      const titleText = (kindFiltered[0].title || '') + ' ' + (kindFiltered[0].complexName || '');
      if (topicMatchesTitle(topicWords, titleText)) {
        // Номер, ведомство и тема совпали — доказательство полное, ИИ не нужен.
        rec = {
          ...base, status: 'ok',
          found_title: kindFiltered[0].title || kindFiltered[0].complexName || '',
          found_eoNumber: kindFiltered[0].eoNumber || '',
          ai_note: '', ai_suggested_fix: '',
        };
      } else {
        // Номер и ведомство совпали, но тема по ключевым словам не
        // узнаётся — не обязательно ошибка (может быть просто другая
        // формулировка), но и не автоматический OK. Один быстрый
        // AI-запрос на подтверждение единственного кандидата.
        //
        // ВАЖНО: если сам вызов ИИ не удался (таймаут/рейт-лимит) — это
        // НЕ считается подтверждённым "НЕТ". Кандидат по номеру и
        // ведомству и так единственный — при недоступности ИИ мягче
        // довериться этому частичному совпадению, чем помечать акт как
        // проблемный из-за временного сбоя сети.
        const confirm = await callAI(
          `Мы отслеживаем нормативный акт: "${watch.label}".\n` +
          `На pravo.gov.ru по номеру "${watch.code}" найден акт того же ведомства:\n"${titleText.trim()}"\n\n` +
          `Это тот же акт, просто сформулированный другими словами, или другой документ на другую тему? ` +
          `Ответь строго ДА (это тот же акт) или НЕТ (другой документ).`
        );
        if (!confirm.ok) {
          rec = {
            ...base, status: 'needs_review',
            found_title: titleText.trim(),
            ai_note: 'Номер и ведомство совпали, но тема сформулирована иначе, а автоматическая проверка темы была недоступна — проверьте вручную.',
            ai_suggested_fix: '',
          };
        } else {
          const confirmText = extractAiText(confirm.text).toUpperCase();
          if (confirmText.startsWith('ДА')) {
            rec = {
              ...base, status: 'ok',
              found_title: kindFiltered[0].title || kindFiltered[0].complexName || '',
              found_eoNumber: kindFiltered[0].eoNumber || '',
              ai_note: 'Тема не совпала по ключевым словам, но автоматическая проверка подтвердила, что это тот же акт.',
              ai_suggested_fix: '',
            };
          } else {
            // Мягкий статус, не "проблема" — единственный кандидат по
            // номеру+ведомству есть, просто не уверены в теме. Не создаём
            // AI-черновик замены (это не подтверждённая проблема), только
            // помечаем на ручную проверку.
            rec = {
              ...base, status: 'needs_review',
              found_title: titleText.trim(),
              ai_note: 'Тип ведомства совпал, но автоматическая проверка не подтвердила совпадение темы: ' + confirmText,
              ai_suggested_fix: '',
            };
          }
        }
      }
    } else if (kindFiltered.length > 1) {
      // Несколько актов ОДНОГО типа с этим номером (например, старая и
      // новая редакция) — эскалируем к ИИ, но со списком, уже очищенным
      // от посторонних ведомств/регионов, а не полным сырым списком.
      const candidatesText = kindFiltered.map((it, i) => `${i + 1}. ${it.title || it.complexName} (от ${it.documentDate || '?'})`).join('\n');
      const judgement = await callAI(
        `Мы отслеживаем нормативный акт: "${watch.label}".\n` +
        `На pravo.gov.ru по номеру "${watch.code}" (уже отфильтровано по типу акта) найдены кандидаты:\n${candidatesText}\n\n` +
        `Какой из них актуальная действующая редакция? Ответь строго в формате:\n` +
        `ДА <номер кандидата>\nНЕТ — если ни один явно не подходит`
      );
      if (!judgement.ok) {
        // Сбой вызова ИИ — НЕ проблема с актом, а недоступность проверки.
        // Все кандидаты уже отфильтрованы по правильному ведомству —
        // это существенно смягчает риск при откладывании до ручной проверки.
        rec = { ...base, status: 'needs_review', found_title: candidatesText, ai_note: 'Несколько кандидатов совпадающего типа, автоматическая проверка была недоступна для выбора — проверьте вручную.', ai_suggested_fix: '' };
      } else {
        const judgeText = extractAiText(judgement.text);
        const matchIdx = judgeText.toUpperCase().startsWith('ДА') ? parseInt(judgeText.replace(/\D+/g, ''), 10) : null;
        if (matchIdx && kindFiltered[matchIdx - 1]) {
          const found = kindFiltered[matchIdx - 1];
          rec = {
            ...base, status: 'ok',
            found_title: found.title || found.complexName || '',
            found_eoNumber: found.eoNumber || '',
            ai_note: 'Подтверждено автоматической проверкой из нескольких кандидатов того же типа: ' + judgeText,
            ai_suggested_fix: '',
          };
        } else {
          rec = { ...base, status: 'needs_review', found_title: candidatesText, ai_note: 'Несколько кандидатов совпадающего типа, автоматическая проверка не выбрала ни одного: ' + judgeText, ai_suggested_fix: '' };
        }
      }
    } else if (numberMatches.length > 0) {
      // Номер совпал, но НИ ОДИН кандидат не прошёл фильтр по типу акта.
      // Это может быть (а) реальная проблема с номером, либо (б) наш
      // список ключевых слов ACT_KIND_KEYWORDS неполон и отсеял верный
      // акт. Понижаем уверенность: не сразу "not_found" с черновиком
      // замены, а сначала эскалируем к ИИ с полным (не отфильтрованным
      // по типу) списком совпадений по номеру — пусть ИИ, а не наша
      // упрощённая эвристика, вынесет вердикт.
      const candidatesText = numberMatches.slice(0, 10).map((it, i) => `${i + 1}. ${it.title || it.complexName} (от ${it.documentDate || '?'})`).join('\n');
      const judgement = await callAI(
        `Мы отслеживаем нормативный акт: "${watch.label}".\n` +
        `На pravo.gov.ru по номеру "${watch.code}" найдены кандидаты (возможно, из разных ведомств):\n${candidatesText}\n\n` +
        `Соответствует ли один из них тому акту, что мы отслеживаем? Ответь строго в формате:\n` +
        `ДА <номер кандидата>\nНЕТ — если ни один не соответствует`
      );
      if (!judgement.ok) {
        // Сбой вызова ИИ. Здесь кандидаты НЕ отфильтрованы по ведомству
        // (это и есть причина эскалации), поэтому доверять им напрямую
        // нельзя — но и объявлять "проблема" без единого подтверждения
        // от ИИ тоже нельзя. Мягкий статус, без черновика замены —
        // черновик на основе неполной информации может ввести в
        // заблуждение больше, чем помочь.
        rec = { ...base, status: 'needs_review', found_title: candidatesText, ai_note: 'Тип ведомства не совпал с эвристикой, автоматическая проверка была недоступна — проверьте вручную.', ai_suggested_fix: '' };
      } else {
        const judgeText = extractAiText(judgement.text);
        const matchIdx = judgeText.toUpperCase().startsWith('ДА') ? parseInt(judgeText.replace(/\D+/g, ''), 10) : null;
        if (matchIdx && numberMatches[matchIdx - 1]) {
          const found = numberMatches[matchIdx - 1];
          rec = {
            ...base, status: 'ok',
            found_title: found.title || found.complexName || '',
            found_eoNumber: found.eoNumber || '',
            ai_note: 'Подтверждено автоматической проверкой (тип акта не совпал с эвристикой, но акт подтверждён): ' + judgeText,
            ai_suggested_fix: '',
          };
        } else {
          // Только здесь — реально подтверждённая ИИ проблема (вызов
          // удался, и ИИ явно сказал "ни один не подходит"). Только
          // теперь оправдано тратить второй AI-вызов на черновик замены.
          problemsFound++;
          const suggestion = await callAI(
            `В коде продукта по охране труда/комплаенсу цитируется нормативный акт "${watch.label}", ` +
            `но среди найденных на pravo.gov.ru кандидатов по номеру "${watch.code}" ни один явно не подходит.\n` +
            `Предложи наиболее вероятный актуальный номер и название акта по этой теме (по-русски, 1-2 предложения). ` +
            `Если не уверен — так и скажи, не выдумывай номер.`
          );
          rec = {
            ...base, status: 'mismatch',
            found_title: candidatesText,
            ai_note: 'Автоматическая проверка не подтвердила соответствие ни одного кандидата: ' + judgeText,
            ai_suggested_fix: suggestion.ok ? extractAiText(suggestion.text) : '',
          };
        }
      }
    } else {
      // numberMatches.length === 0 — номер не найден вообще, ни в каком
      // виде. Это самый сильный, однозначный сигнал проблемы — не
      // зависит от AI-вызова (сам факт «на pravo.gov.ru нет ни одного
      // документа с таким номером» уже установлен структурированным
      // ответом API). AI здесь только для черновика замены.
      problemsFound++;
      const suggestion = await callAI(
        `В коде продукта по охране труда/комплаенсу цитируется нормативный акт "${watch.label}", ` +
        `но при прямом поиске по номеру "${watch.code}" на портале pravo.gov.ru ничего не найдено — ` +
        `похоже, номер указан неверно или акт был переименован/заменён.\n` +
        `Предложи наиболее вероятный актуальный номер и название акта по этой теме (по-русски, 1-2 предложения). ` +
        `Если не уверен — так и скажи, не выдумывай номер.`
      );
      rec = {
        ...base, status: 'not_found', found_title: '',
        ai_note: 'Акт с этим номером не найден на pravo.gov.ru.',
        ai_suggested_fix: suggestion.ok ? extractAiText(suggestion.text) : '',
      };
    }

    db.get('npa_citation_audit').push(rec).write();
    results.push(rec);

    // Прогресс для UI — операция небыстрая (~20+ актов с паузами и
    // AI-вызовами, может занимать несколько минут), без этого события
    // окно «Проверяем...» выглядит зависшим до самого конца.
    if (mainWindow) {
      mainWindow.webContents.send('npa:citationProgress', {
        done: results.length,
        total: NPA_WATCHLIST.length,
        current: watch.label,
      });
    }
  }

  db.get('settings').assign({ npa_citation_last_check_date: today }).write();

  // Telegram — только если реально что-то нашли и не превышаем общий лимит,
  // используем тот же тумблер tg_npa, что и основной мониторинг (не отдельный,
  // чтобы не плодить настройки без необходимости).
  if (problemsFound > 0 && s.tg_npa !== '0' && s.tg_token && s.tg_chat_id) {
    const text = `⚖️ Аудит нормативки: найдено ${problemsFound} акт(ов), требующих проверки номера/актуальности. Откройте раздел «Аудит нормативки» в приложении.`;
    await telegramApi(s.tg_token, 'sendMessage', { chat_id: s.tg_chat_id, text });
  }

  return { ok: true, results, problemsFound };
}

ipcMain.handle('npa:checkCitationsNow', async () => {
  return await checkNpaCitations(true);
});

ipcMain.handle('npa:citationAuditList', () => {
  // Фильтруем "осиротевшие" записи — исторические результаты проверки по
  // кодам, которых больше нет в NPA_WATCHLIST (например, старый '178',
  // переименованный в '180' 09.07.2026). Без этого такие записи повисают
  // в «Требует проверки» навечно — новых проверок по несуществующему
  // коду больше не будет, чтобы их вытеснить.
  const activeCodes = new Set(NPA_WATCHLIST.map(w => w.code));
  return db.get('npa_citation_audit').value()
    .filter(r => activeCodes.has(r.code))
    .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
});

ipcMain.handle('npa:citationMarkSeen', (_, id) => {
  db.get('npa_citation_audit').find({ id }).assign({ seen: 1 }).write();
  return { ok: true };
});

ipcMain.handle('npa:checkNow', async () => {
  return await checkNpaUpdates(true);
});

ipcMain.handle('npa:list', (_, module) => {
  const all = db.get('npa_changes').sortBy('created_at').value().reverse();
  return module ? all.filter(n => n.module === module) : all;
});

ipcMain.handle('npa:markSeen', (_, id) => {
  db.get('npa_changes').find({ id }).assign({ seen: 1 }).write();
  return { ok: true };
});

// ─── АВТОЗАПУСК ──────────────────────────────────────────
ipcMain.handle('app:setAutostart', (_, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
  db.get('settings').assign({ autostart: enabled ? '1' : '0' }).write();
  return { ok: true };
});

function applyAutostartSetting() {
  const s = db.get('settings').value();
  app.setLoginItemSettings({ openAtLogin: s.autostart === '1' });
}

// ─── НАСТРОЙКИ ───────────────────────────────────────────
ipcMain.handle('settings:get', () => {
  return db.get('settings').value();
});

ipcMain.handle('settings:save', (_, data) => {
  db.get('settings').assign(data).write();
  return { ok: true };
});

// ─── СТАТИСТИКА ──────────────────────────────────────────
ipcMain.handle('stats:dashboard', () => {
  const clients  = db.get('clients').value().length;
  const tasks    = db.get('tasks').filter({ done: 0 }).value().length;
  const urgent   = db.get('tasks').filter({ done: 0, priority: 'urgent' }).value().length;
  const allEvents = db.get('events').value();
  const today    = new Date().toISOString().slice(0, 10);
  const overdue  = allEvents.filter(e => e.status === 'pending' && e.due_date < today).length;
  const clientsList = db.get('clients').value();
  const upcoming = db.get('events')
    .filter(e => e.status === 'pending' && e.due_date >= today)
    .sortBy('due_date')
    .take(10)
    .value()
    .map(e => ({ ...e, client_name: (clientsList.find(c => c.id === e.client_id) || {}).name || '' }));
  return { clients, tasks, urgent, overdue, upcoming };
});

// ─── РЕЗЕРВНАЯ КОПИЯ ─────────────────────────────────────
ipcMain.handle('backup:now', async () => {
  const s = db.get('settings').value();
  let backupDir = s.backup_path;
  if (!backupDir) {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (res.canceled) return { ok: false };
    backupDir = res.filePaths[0];
    db.get('settings').assign({ backup_path: backupDir }).write();
  }
  const date = new Date().toISOString().slice(0, 10);
  const src  = path.join(app.getPath('userData'), 'kompliance.json');
  const dest = path.join(backupDir, `kompliance_backup_${date}.json`);
  fs.copyFileSync(src, dest);
  return { ok: true, path: dest };
});

ipcMain.handle('backup:choose-folder', async () => {
  const currentPath = db.get('settings').value().backup_path;
  const opts = {
    title: 'Выберите папку для резервных копий',
    buttonLabel: 'Выбрать эту папку',
    properties: ['openDirectory'],
  };
  if (currentPath && fs.existsSync(currentPath)) {
    // Уже выбирали раньше — открываем именно там, где реально лежат бэкапы.
    opts.defaultPath = currentPath;
  } else {
    // Первый выбор: НЕ отдаём диалог на волю системного дефолта. На машинах
    // с OneDrive системная папка "Документы" существует в двух вариантах
    // с одинаковым отображаемым именем (обычная локальная и
    // OneDrive-синхронизируемая) — Windows иногда открывает не ту, которую
    // ожидает пользователь. app.getPath('documents') возвращает конкретный,
    // детерминированный путь — с ним пользователь всегда видит одно и то же.
    const docsPath = app.getPath('documents');
    if (fs.existsSync(docsPath)) opts.defaultPath = docsPath;
  }
  const res = await dialog.showOpenDialog(opts);
  if (res.canceled) return null;
  return res.filePaths[0];
});

ipcMain.handle('open-external', async (_, url) => {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) return;
  const { exec } = require('child_process');
  if (process.platform === 'win32') {
    exec(`start chrome "${cleanUrl}"`);
  } else if (process.platform === 'darwin') {
    exec(`open "${cleanUrl}"`);
  } else {
    exec(`xdg-open "${cleanUrl}"`);
  }
});


// ─── ГЕНЕРАЦИЯ ДОКУМЕНТОВ ────────────────────────────────────
ipcMain.handle('vu:generate-reports', async (_, clientId, docs) => {
  let client = db.get('clients').find({ id: clientId }).value();
  if (!client) return { ok: false, error: 'Клиент не найден' };
  const settings = db.get('settings').value();

  // Фиксируем дату документов один раз — при первом формировании.
  // Без этого c.doc_date (gen_p1.js) каждый день фоллбэчился бы на
  // «сегодня», и тексты документов с датой («от «ДД.ММ.ГГГГ» №…»,
  // «Утвердить с ДД.ММ.ГГГГ», «Разработал … «ДД.ММ.ГГГГ»») менялись
  // бы ЕЖЕДНЕВНО без какой-либо причины в доказательной базе (doc_date
  // не входит в FIELD_LABELS — диф никогда бы это не объяснил).
  if (!client.doc_date) {
    const fixedDate = new Date().toLocaleDateString('ru-RU');
    db.get('clients').find({ id: clientId }).assign({ doc_date: fixedDate }).write();
    client = db.get('clients').find({ id: clientId }).value();
  }

  const rootDir  = getOutputRoot();
  const safeName = (client.name || 'Клиент').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 60).replace(/[ .]+$/, '') || 'Клиент';
  const outputDir = path.join(rootDir, safeName);
  fs.mkdirSync(outputDir, { recursive: true });

  const employees = db.get('employees').filter({ client_id: clientId }).value();

  // Хэш данных клиента — та же база, что и в docs:generate, чтобы
  // shouldOverwrite корректно распознавал «данные не менялись» независимо
  // от того, каким путём документ генерировался в прошлый раз.
  const crypto = require('crypto');
  const clientHash = crypto.createHash('md5')
    .update(JSON.stringify({ ...client, employees }))
    .digest('hex');

  // Карта хэшей файлов на диске — защита правок пользователя + doc_year
  // для архивации (см. utils.makeRunner/archivePreviousVersion).
  const { buildDiskHashMap, getDocYear, docContentHash, diffClientFields, snapshotClientFields } = require('./utils');
  const oldDocs = db.get('documents').filter({ client_id: clientId }).value();
  const diskHashMap = buildDiskHashMap(oldDocs);

  // Реестр версий шаблонов документов — для причины «обновлены требования
  // законодательства» (см. doc-meta.js). Общий с docs:generate.
  const DOC_META = require('./doc-meta');

  const clientWithEmployees = {
    ...client,
    city: (client.city || client.region || '').replace(/^г\.?\s*/i,'').trim() || '',
    employees: employees.map(e => ({
      full_name:   e.full_name   || '',
      position:    e.position    || '',
      vu_category: e.vu_category || '',
      vu_rank:     e.vu_rank     || '',
      vu_mobpredpisanie: e.vu_mobpredpisanie || false,
    })),
  };

  // Подгружаем vu_data из settings
  try {
    const vuKey = `vu_data_${clientId}`;
    clientWithEmployees.vu_data = settings[vuKey] || '{}';
  } catch(_) {}

  try {
    const { generateVuReports } = require('./gen_vu');
    const result = await generateVuReports(clientWithEmployees, {
      ...settings,
      diskHashMap,
      currentClientHash: clientHash,
    }, outputDir, docs);
    const vuDir = path.join(outputDir, 'Воинский учёт');

    // Регистрируем сгенерированные документы в реестре приложения.
    // Upsert по имени файла: обновляем только эти документы, остальные ВУ не трогаем.
    // Попутно строим отчёт об изменениях (added/updated/unchanged) — по содержимому
    // document.xml, чтобы окно результата показывало правду, а не «обновлено всё».
    const changeReport = { added: [], updated: [], unchanged: [] };
    try {
      let maxId = Math.max(0, ...db.get('documents').value().map(d => d.id), 0);
      for (const filename of (result.generated || [])) {
        const baseName = path.basename(filename);
        let fileHash = '';
        try { fileHash = crypto.createHash('md5').update(fs.readFileSync(filename)).digest('hex'); } catch(_) {}
        const contentHash = docContentHash(filename);
        const old = db.get('documents').find({ client_id: clientId, name: baseName }).value();

        // Тип изменения по содержимому
        let changeType = 'added';
        if (old) {
          if (old.doc_content_hash) {
            changeType = (old.doc_content_hash === contentHash) ? 'unchanged' : 'updated';
          } else {
            changeType = (old.file_hash && old.file_hash === fileHash) ? 'unchanged' : 'updated';
          }
        }

        // «Почему изменился документ» (Фаза 1, хвост для пути «Сдать отчёт» —
        // та же логика, что в docs:generate; см. utils.diffClientFields).
        // Снимок — per-модульный, ветка VU (см. комментарий в docs:generate
        // про touchedModules / last_gen_snapshot[docModule]).
        const docMeta = DOC_META[baseName] || {};
        const newTemplateVersion = docMeta.version || 1;
        let changeReason = null;

        if (changeType === 'updated') {
          const oldTemplateVersion = (old && old.template_version) || 1;
          if (newTemplateVersion > oldTemplateVersion) {
            changeReason = 'Обновлены требования законодательства'
              + (docMeta.npa ? ': ' + docMeta.npa : '')
              + ` (версия документа ${oldTemplateVersion} → ${newTemplateVersion})`;
          } else {
            const moduleSnapshot = client.last_gen_snapshot && client.last_gen_snapshot.VU;
            const changedFields = diffClientFields(moduleSnapshot, clientWithEmployees);
            if (changedFields.length) {
              changeReason = 'Изменились данные клиента: '
                + changedFields.map(c => `${c.label} (${c.from} → ${c.to})`).join(', ');
            }
          }
        }

        if (changeType === 'added') changeReport.added.push(baseName);
        else if (changeType === 'updated') changeReport.updated.push({ name: baseName, reason: changeReason });
        else changeReport.unchanged.push(baseName);

        db.get('documents').remove({ client_id: clientId, name: baseName }).write();
        maxId++;
        // section — по факту папки на диске, тот же единый механизм, что
        // теперь используется в doc-generation.js (найдено и закрыто
        // 12.07.2026, см. sections.js sectionByFolder).
        const { sectionByFolder, sectionOf } = require('./sections');
        const parentFolder = path.basename(path.dirname(filename));
        const vuSectionMatch = sectionByFolder('VU', parentFolder);
        const vuSection = vuSectionMatch ? vuSectionMatch.id : sectionOf('VU', baseName);
        db.get('documents').push({
          id:          maxId,
          client_id:   clientId,
          module:      'VU',
          section:     vuSection,
          name:        baseName,
          filename:    baseName,
          filepath:    filename,
          file_hash:   fileHash,
          doc_content_hash: contentHash,
          client_hash: clientHash,
          doc_year:    getDocYear(client),
          template_version: newTemplateVersion,
          status:      'ok',
          created_at:  old?.created_at || new Date().toISOString(),
          updated_at:  new Date().toISOString(),
          npa_basis:   'ФЗ-53 от 28.03.1998, ПП РФ №719 от 27.11.2006',
          notes:       '',
        }).write();
      }

      // Снимок отслеживаемых полей клиента — per-модульный, обновляем
      // только ветку VU (см. docs:generate / touchedModules).
      db.get('clients').find({ id: clientId }).assign({
        last_gen_snapshot: { ...(client.last_gen_snapshot || {}), VU: snapshotClientFields(clientWithEmployees) },
      }).write();
    } catch(e) { /* запись в реестр не критична для самой генерации файлов */ }

    return {
      ok: true,
      generated: result.generated,
      errors: result.errors,
      folder: vuDir,
      report: {
        added:        changeReport.added,
        updated:      changeReport.updated,
        unchanged:    changeReport.unchanged,
        userModified: result.report?.userModified || [],
        archived:     result.report?.archived || [],
      },
    };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('docs:generate', async (_, clientId, scope = 'ALL') => {
  // Логика вынесена в doc-generation.js — общий модуль, которым пользуется и здесь, и MCP-сервером (когда/если он сможет вызывать генерацию), чтобы не дублировать логику в двух местах.
  //
  // Блокировка (lock-utils.js) здесь сейчас избыточна (один писатель — это приложение), но держим её здесь заранее —
  // если когда-нибудь MCP-сервер попробует писать одновременно — он подождёт или честно откажет,
  // вместо повреждения базы.
  const { withLock } = require('./lock-utils.js');
  const { generateDocsForClient } = require('./doc-generation.js');
  const dbPath = path.join(app.getPath('userData'), 'kompliance.json');
  const settings = db.get('settings').value();

  return withLock(dbPath, () => generateDocsForClient({ db, clientId, scope, settings }));
});

// Открыть папку с документами клиента
ipcMain.handle('docs:open-folder', (_, dir) => {
  shell.openPath(dir);
});

// Открыть конкретный файл документа
ipcMain.handle('docs:open-file', (_, filepath) => {
  shell.openPath(filepath);
});

// ─── AI ЗАПРОСЫ ──────────────────────────────────────────
// Ключ DeepSeek хранится на сервере kompliancepro.ru/ai-proxy.php
// В приложении ключ не хранится и в репозиторий не попадает
// Прокси переименован в ai-proxy-v2.php (04.07.2026) — на сервере обнаружился
// кэш PHP-кода (OPcache без проверки времени изменения файла), из-за которого
// правки в ai-proxy.php не подхватывались даже после сохранения. Кэш привязан
// к имени файла, поэтому новое имя гарантированно выполняет свежий код.
const AI_PROXY_URL = 'https://kompliancepro.ru/ai-proxy-v2.php';

async function callAI(prompt, system, maxTokens) {
  const s = db.get('settings').value();
  const provider = s.ai_provider || 'deepseek';
  const apiKey   = s.ai_key || '';
  const tokens   = maxTokens || 512;

  // Если есть пользовательский ключ — используем напрямую
  // Если нет — для DeepSeek используем прокси
  const useProxy = !apiKey && provider !== 'claude';

  if (!apiKey && provider === 'claude') {
    return { ok: false, error: 'API ключ не указан в настройках' };
  }

  try {
    let url, headers, body;

    if (provider === 'claude') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      };
      body = JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: tokens,
        system:     system || 'Ты помощник. Отвечай только JSON без markdown.',
        messages:   [{ role: 'user', content: prompt }],
      });
    } else {
      // DeepSeek — через прокси или напрямую с ключом пользователя
      url = useProxy ? AI_PROXY_URL : 'https://api.deepseek.com/v1/chat/completions';
      headers = {
        'Content-Type':  'application/json',
        ...(!useProxy && { 'Authorization': 'Bearer ' + apiKey }),
      };
      body = JSON.stringify({
        model:       'deepseek-chat',
        max_tokens:  tokens,
        temperature: 0,
        messages: [
          { role: 'system', content: system || 'Ты помощник. Отвечай только JSON без markdown.' },
          { role: 'user',   content: prompt },
        ],
      });
    }

    const https  = require('https');
    const urlObj = new URL(url);

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: urlObj.hostname,
        path:     urlObj.pathname,
        method:   'POST',
        headers,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch(e) {
            reject(new Error('Ошибка парсинга ответа: ' + data.slice(0, 200)));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    // Извлекаем текст ответа
    let text = '';
    if (provider === 'claude') {
      text = result.content?.[0]?.text || '';
    } else {
      text = result.choices?.[0]?.message?.content || '';
    }

    if (!text) return { ok: false, error: 'Пустой ответ от AI', raw: result };
    return { ok: true, text };

  } catch(e) {
    return { ok: false, error: e.message };
  }
}

ipcMain.handle('ai:request', async (_, { prompt, system }) => {
  return callAI(prompt, system);
});

// ─── ЧЕРНОВИКИ ИНСТРУКЦИЙ ПО ОТ ЧЕРЕЗ ИИ (ai-draft.js) ─────────────
// Полностью отдельно от generate_document_package — см. комментарий
// в самом ai-draft.js. Лимит: 5 черновиков на клиента в календарный месяц
// (решение от 09.07.2026 — DeepSeek дешёвый, лимит не про деньги, а против
// нецелевого использования вместо пополнения SPECIALIZED_ROLES).
const AI_DRAFT_MONTHLY_LIMIT = 5;

// ─── СКЛОНЕНИЕ ФИО — ЛОКАЛЬНО, БЕЗ ВНЕШНИХ СЕРВИСОВ (09.07.2026) ────
// Раньше ФИО сотрудников уходило в DeepSeek (китайский сервис) для
// склонения по падежам — прямая передача ПДн за рубеж, что после 23-ФЗ
// (локализация с 01.07.2025) является юридическим риском для продукта,
// который сам продаётся как инструмент 152-ФЗ-комплаенса. lvovich —
// офлайн-библиотека (порт petrovich-js), работает полностью локально,
// без единого сетевого запроса. См. решение от 09.07.2026.
ipcMain.handle('fio:decline', (_, fullName) => {
  try {
    const { incline } = require('lvovich');
    const parts = String(fullName || '').trim().split(/\s+/);
    const base = { last: parts[0] || '', first: parts[1] || '', middle: parts[2] || '' };
    const cases = ['genitive','dative','accusative','instrumental','prepositional'];
    const keyMap = { genitive:'gen', dative:'dat', accusative:'acc', instrumental:'ins', prepositional:'pre' };
    const out = { nom: fullName };
    cases.forEach(declension => {
      const r = incline({ ...base, declension });
      out[keyMap[declension]] = [r.last, r.first, r.middle].filter(Boolean).join(' ');
    });
    const initials = [parts[1], parts[2]].filter(Boolean).map(w => w[0] + '.').join('');
    out.short = [parts[0], initials].filter(Boolean).join(' ');
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, error: 'Локальное склонение недоступно: ' + e.message };
  }
});

// ─── СКЛОНЕНИЕ ПРОИЗВОЛЬНЫХ ДОЛЖНОСТЕЙ — Морфер (RU-хостинг) ────────
// Название должности само по себе не персональные данные конкретного
// человека (не привязано к ФИО), но всё равно уводим от DeepSeek на
// российский специализированный сервис морфологии — не LLM общего
// назначения, а именно инструмент под эту задачу, и точнее, и локально
// с точки зрения юрисдикции. Требует settings.morpher_token (регистрация
// на morpher.ru — платно/бесплатно с лимитом, ключ вводит сам Александр).
// Пока ключ не настроен — вызов в сеть НЕ идёт вообще, просто возвращаем
// именительный падеж без изменений (безопасный дефолт, не DeepSeek).
ipcMain.handle('position:decline', async (_, positionText) => {
  const s = db.get('settings').value();
  const token = s.morpher_token || '';
  const text = String(positionText || '').trim();
  if (!text) return { ok: false, error: 'Пустая должность' };

  if (!token) {
    // Ключ Морфера не настроен — без сети, безопасный fallback.
    return { ok: true, nom: text, gen: text, dat: text, acc: text, ins: text, pre: text, fallback: true };
  }

  try {
    const https = require('https');
    const url = `https://ws3.morpher.ru/russian/declension?s=${encodeURIComponent(text)}&format=json&token=${encodeURIComponent(token)}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
      }).on('error', reject);
    });
    if (data.message) throw new Error(data.message); // Морфер возвращает {message:'...'} при ошибке токена/лимита

    // Ответ Морфера использует разные варианты ключей в зависимости от
    // версии сервиса — проверяем оба известных формата (короткие
    // кириллические буквы и полные английские названия).
    const pick = (ru, en) => data[ru] ?? data[en] ?? text;
    return {
      ok: true,
      nom: text,
      gen: pick('Р', 'genitive'),
      dat: pick('Д', 'dative'),
      acc: pick('В', 'accusative'),
      ins: pick('Т', 'instrumental'),
      pre: pick('П', 'prepositional'),
    };
  } catch (e) {
    // Сбой сети/сервиса — не роняем форму, просто именительный падеж.
    return { ok: true, nom: text, gen: text, dat: text, acc: text, ins: text, pre: text, error: e.message, fallback: true };
  }
});

ipcMain.handle('ai:draftInstruction', async (_, clientId, position, industry) => {
  if (!position || !String(position).trim()) {
    return { ok: false, error: 'Не указана должность' };
  }

  const s = db.get('settings').value();
  const usage = s.ai_draft_usage || {};
  const key = String(clientId);
  const curMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const entry = usage[key];
  const count = (entry && entry.month === curMonth) ? entry.count : 0;

  if (count >= AI_DRAFT_MONTHLY_LIMIT) {
    return { ok: false, error: `Лимит черновиков на этот месяц исчерпан (${AI_DRAFT_MONTHLY_LIMIT} на компанию). Если новых нестандартных должностей стабильно много — есть смысл добавить их в основной справочник, напишите в поддержку.` };
  }

  const client = db.get('clients').find({ id: clientId }).value();
  if (!client) return { ok: false, error: 'Компания не найдена' };

  try {
    const aiDraft = require('./ai-draft');
    // ИСПРАВЛЕНО 13.07.2026: safe() из utils.js — это экранирование текста
    // для .docx (XML-безопасность), а не очистка имени файла/папки от
    // запрещённых Windows-символов (< > : " / \ | ? *). Имя клиента с
    // кавычками (например, ООО "СПЛ") падало с ENOENT при mkdir даже с
    // recursive:true — Windows такую папку создать физически не может.
    // Используем тот же паттерн санитизации, что уже проверен в
    // doc-generation.js.
    const safeClientName = (client.name || 'Клиент').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60).replace(/[ .]+$/, '') || 'Клиент';
    const dir = path.join(app.getPath('userData'), 'Документы', safeClientName, 'Черновики инструкций');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = await aiDraft.draftInstruction(client, dir, position, callAI, industry);

    // Засчитываем попытку только при успехе — неудачный вызов (ошибка сети,
    // невалидный JSON от модели) не должен списывать лимит впустую.
    usage[key] = { count: count + 1, month: curMonth };
    db.get('settings').assign({ ai_draft_usage: usage }).write();

    return { ok: true, filepath, remaining: AI_DRAFT_MONTHLY_LIMIT - (count + 1) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
// ─── ОБУЧЕНИЕ СОТРУДНИКОВ ────────────────────────────────
// ─── ЦЕНТР ОБУЧЕНИЯ — реестр удостоверений ──────────────
// Каждая запись: {id, client_id, employee_id, program, center, cert_number, date_from, date_to, created_at}
// employee_id может быть null если сотрудник не заведён в системе (записи «задним числом»)

ipcMain.handle('certs:list', (_, clientId) => {
  const certs = db.get('certifications').filter({ client_id: clientId }).value();
  const employees = db.get('employees').value();
  return certs.map(c => ({
    ...c,
    employee_name: employees.find(e => e.id === c.employee_id)?.full_name || c.employee_name_manual || '—',
  }));
});

ipcMain.handle('certs:add', (_, data) => {
  const id = nextId('certifications');
  const cert = { ...data, id, created_at: now() };
  db.get('certifications').push(cert).write();
  return { ok: true, id };
});

ipcMain.handle('certs:update', (_, id, data) => {
  db.get('certifications').find({ id }).assign({ ...data }).write();
  return { ok: true };
});

ipcMain.handle('certs:delete', (_, id) => {
  db.get('certifications').remove({ id }).write();
  return { ok: true };
});

// ─── КОМИССИЯ ПО ПРОВЕРКЕ ЗНАНИЙ ─────────────────────────
// Возвращает членов комиссии с их удостоверениями из внешнего центра.
// Используется в трекере самообучения и при генерации протокола/приказа.
ipcMain.handle('commission:get', (_, clientId) => {
  const employees     = db.get('employees').filter({ client_id: clientId }).value();
  const certifications= db.get('certifications').filter({ client_id: clientId }).value();
  const today         = new Date();

  return employees
    .filter(e => e.commission_role)
    .map(e => {
      // Ищем актуальное удостоверение по Программе А (или любое последнее)
      const empCerts = certifications
        .filter(c => c.employee_id === e.id)
        .sort((a, b) => new Date(b.date_from||0) - new Date(a.date_from||0));

      const progACert = empCerts.find(c =>
        c.program && c.program.toLowerCase().includes('прогр. а') ||
        c.program && c.program.toLowerCase().includes('программа а')
      ) || empCerts[0] || null;

      const certExpired = progACert?.date_to
        ? new Date(progACert.date_to) < today
        : false;

      const daysLeft = progACert?.date_to
        ? Math.ceil((new Date(progACert.date_to) - today) / 86400000)
        : null;

      return {
        id:             e.id,
        full_name:      e.full_name,
        name_gen:       e.name_gen   || e.full_name,
        name_dat:       e.name_dat   || e.full_name,
        name_acc:       e.name_acc   || e.full_name,
        position:       e.position   || '',
        commission_role:e.commission_role,
        cert:           progACert,
        cert_expired:   certExpired,
        cert_days_left: daysLeft,
      };
    })
    .sort((a, b) => {
      // Председатель всегда первый
      if (a.commission_role === 'chairman') return -1;
      if (b.commission_role === 'chairman') return 1;
      return 0;
    });
});

// Генерация приказа о создании комиссии по проверке знаний
ipcMain.handle('docs:generateCommissionOrder', async (_, clientId, orderNum, orderDate) => {
  try {
    let client = db.get('clients').find({ id: clientId }).value();
    if (!client) return { ok: false, error: 'Клиент не найден' };

    // Получаем состав комиссии через тот же механизм что commission:get
    const employees      = db.get('employees').filter({ client_id: clientId }).value();
    const certifications = db.get('certifications').filter({ client_id: clientId }).value();
    const today          = new Date();

    const commission = employees
      .filter(e => e.commission_role)
      .map(e => {
        const empCerts = certifications
          .filter(c => c.employee_id === e.id)
          .sort((a, b) => new Date(b.date_from || 0) - new Date(a.date_from || 0));
        const progACert = empCerts.find(c =>
          c.program && (c.program.toLowerCase().includes('прогр. а') ||
                        c.program.toLowerCase().includes('программа а'))
        ) || empCerts[0] || null;
        return {
          id:              e.id,
          name:            e.full_name || '',
          full_name:       e.full_name || '',
          position:        e.position  || '',
          commission_role: e.commission_role,
          cert:            progACert,
          cert_expired:    progACert?.date_to ? new Date(progACert.date_to) < today : false,
        };
      })
      .sort((a, b) => {
        if (a.commission_role === 'chairman') return -1;
        if (b.commission_role === 'chairman') return 1;
        return 0;
      });

    // Папка клиента
    const rootDir  = getOutputRoot();
    const safeName = (client.name || 'Клиент').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60).replace(/[ .]+$/, '') || 'Клиент';
    const outputDir = path.join(rootDir, safeName);
    fs.mkdirSync(outputDir, { recursive: true });

    // Подготавливаем объект клиента (тот же паттерн что в docs:generate)
    const clientObj = {
      ...client,
      city: (client.city || client.region || '').replace(/^г\.?\s*/i, '').trim() || '',
      ot_name:     client.ot_name     || client.manager_name     || '',
      ot_position: client.ot_position || client.manager_position || '',
    };

    const { gen_commission_order } = require('./gen_p2');
    const filePath = await gen_commission_order(clientObj, commission, orderNum, orderDate, outputDir);

    return { ok: true, file: filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── АДДОНЫ ─────────────────────────────────────────────────────────
// Аддон-ключ: KP-ADDON-[TYPE]-[SHA256(SECRET+ADDON+TYPE+EXPIRE+MACHINE)[:20]]
// Формула совпадает с keygen-tool.html — не менять в одном месте без другого.
// Текущие аддоны: TRAINING (самообучение), FLEET (флот), PASF (Профессиональное аварийно-спасательное формирование, 151-ФЗ), CHOP (частные охранные организации, 2487-1),
// PD (персональные данные, 152-ФЗ), VU (воинский учёт, 53-ФЗ) — оба переведены на аддон-модель 11.07.2026, раньше были бандлом в базовом тарифе.
// Чтобы добавить новый — достаточно добавить его сюда и в keygen-tool.html.
const KNOWN_ADDONS = ['TRAINING', 'FLEET', 'PASF', 'CHOP', 'PD', 'VU'];

function generateAddonKey(addonType, expireDate, machineId) {
  const crypto = require('crypto');
  const raw = LICENSE_SECRET + ':ADDON:' + addonType + ':' + expireDate + ':' + machineId;
  return 'KP-ADDON-' + addonType + '-' + crypto.createHash('sha256').update(raw).digest('hex').substring(0, 20).toUpperCase();
}

function hasAddon(addonType) {
  const settings = db.get('settings').value();
  const addons = settings.license_addons || [];
  const addonExpires = settings.addon_expires || {};
  if (!addons.includes(addonType)) return false;
  // Проверяем срок аддона
  const exp = addonExpires[addonType];
  if (!exp) return true;
  return new Date(exp) > new Date();
}

ipcMain.handle('addon:activate', (_, key, expireDate, addonType) => {
  if (!key || !expireDate || !addonType) return { ok: false, error: 'Заполните все поля' };
  if (!KNOWN_ADDONS.includes(addonType)) return { ok: false, error: 'Неизвестный аддон: ' + addonType };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) return { ok: false, error: 'Неверный формат даты' };

  const machineId = getMachineId();
  const expected = generateAddonKey(addonType, expireDate, machineId);

  // DEV-MODE: любой аддон активируется командой 'DEV-ADDON-KP2026' —
  // ТОЛЬКО в режиме разработки (start.bat). В собранном .exe (app.isPackaged)
  // эта команда не работает вообще — иначе любой пользователь релизной
  // сборки мог бы бесплатно активировать любой аддон навсегда.
  const isDevBypass = !app.isPackaged && key.trim() === 'DEV-ADDON-KP2026';
  if (!isDevBypass && key.trim().toUpperCase() !== expected) {
    return { ok: false, error: 'Ключ аддона недействителен или не соответствует устройству' };
  }

  const settings   = db.get('settings').value();
  const addons     = settings.license_addons || [];
  const addonExpires = settings.addon_expires || {};

  if (!addons.includes(addonType)) addons.push(addonType);
  addonExpires[addonType] = expireDate;

  db.get('settings').assign({ license_addons: addons, addon_expires: addonExpires }).write();
  return { ok: true, addon: addonType, expires: expireDate };
});

ipcMain.handle('addon:status', () => {
  const settings = db.get('settings').value();
  const addons = settings.license_addons || [];
  const addonExpires = settings.addon_expires || {};
  return KNOWN_ADDONS.map(type => ({
    type,
    active: hasAddon(type),
    expires: addonExpires[type] || null,
  }));
});

// «Написать разработчику» — собирает контекст об установке (Machine ID,
// тариф, аддоны, версия приложения) и отправляет через серверный прокси
// (support-proxy.php на kompliancepro.ru) в Telegram Александра. Токен
// бота НЕ хранится в приложении — только на сервере, тем же принципом,
// что и DeepSeek-прокси (см. память: "переход на надёжное чтение ключа
// из PHP-файла"). 13.07.2026.
ipcMain.handle('support:send', async (_, message, contact) => {
  if (!message || !message.trim()) return { ok: false, error: 'Пустое сообщение' };
  const settings = db.get('settings').value();
  const activeAddons = KNOWN_ADDONS.filter(type => hasAddon(type));
  const payload = {
    message: message.trim().slice(0, 2000),
    contact: (contact || '').trim().slice(0, 200),
    machineId: getMachineId(),
    licenseType: settings.license_type || '—',
    expiresAt: settings.license_expires || '—',
    addons: activeAddons,
    appVersion: require('./package.json').version,
  };
  try {
    const resp = await fetch('https://kompliancepro.ru/support-proxy.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) return { ok: false, error: data.error || 'Не удалось отправить сообщение' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Нет соединения с сервером поддержки: ' + e.message };
  }
});

ipcMain.handle('training:get', (_, employeeId) => {
  const emp = db.get('employees').find({ id: employeeId }).value();
  return emp?.training || {};
});

ipcMain.handle('training:save', (_, employeeId, data) => {
  db.get('employees').find({ id: employeeId }).assign({ training: data }).write();
  return { ok: true };
});

// ─── МЕДИЦИНСКИЕ ДОПУСКИ (medical_clearances) ─────────────
// Общая подсистема: сотрудник хранит массив независимых допусков
// {id, type, basis_order, issued_date, valid_until}. Справочник типов
// (label, срок действия по умолчанию) декларируется на стороне
// конкретного аддона (например ЧОП, ФЛОТ) — main.js не знает про них.
ipcMain.handle('medical-clearances:get', (_, employeeId) => {
  const emp = db.get('employees').find({ id: employeeId }).value();
  return emp?.medical_clearances || [];
});

ipcMain.handle('medical-clearances:save', (_, employeeId, list) => {
  db.get('employees').find({ id: employeeId }).assign({ medical_clearances: list }).write();
  return { ok: true };
});

// ─── ЧОП — данные сотрудника (аддон CHOP) ─────────────────
// Разряд охранника, допуск к оружию, тип поста, режим смен.
// Видны/редактируются в UI только когда аддон CHOP активен.
ipcMain.handle('chop:get', (_, employeeId) => {
  const emp = db.get('employees').find({ id: employeeId }).value();
  return emp?.chop || null;
});

ipcMain.handle('chop:save', (_, employeeId, data) => {
  db.get('employees').find({ id: employeeId }).assign({ chop: data }).write();
  return { ok: true };
});

// ─── ПАСФ — аттестация формирования (аддон PASF, уровень клиента) ──
// {cert_number, attestation_date, expiry_date, attesting_body, work_types[]}
// Блокирующий статус: без действующей аттестации формирование не может
// обслуживать организации по договору (151-ФЗ ст.12).
ipcMain.handle('pasf-org:get', (_, clientId) => {
  const client = db.get('clients').find({ id: clientId }).value();
  return client?.pasf || null;
});

ipcMain.handle('pasf-org:save', (_, clientId, data) => {
  db.get('clients').find({ id: clientId }).assign({ pasf: data }).write();
  return { ok: true };
});

// ─── ПАСФ — данные спасателя (аддон PASF, уровень сотрудника) ─────
// {status_assigned_date, current_class, class_assigned_date, next_attestation_due,
//  international_lang_confirmed, dactyloscopy_registered, dactyloscopy_date,
//  work_permits: [{work_type, attested, attestation_date, valid_until}]}
// Медицинские допуски спасателя — НЕ здесь, см. medical-clearances:get/save (v6).
ipcMain.handle('pasf:get', (_, employeeId) => {
  const emp = db.get('employees').find({ id: employeeId }).value();
  return emp?.pasf || null;
});

ipcMain.handle('pasf:save', (_, employeeId, data) => {
  db.get('employees').find({ id: employeeId }).assign({ pasf: data }).write();
  return { ok: true };
});

// Справочники для UI (виды работ, классы) — см. PASF_WORK_TYPES/PASF_CLASSES выше
ipcMain.handle('pasf:reference', () => {
  return { workTypes: PASF_WORK_TYPES, classes: PASF_CLASSES };
});

// Получить всех сотрудников с просроченным/скоро истекающим обучением
ipcMain.handle('training:alerts', () => {
  const today     = new Date();
  const employees = db.get('employees').value();
  const clients   = db.get('clients').value();
  const alerts    = [];

  const TRAINING_TYPES = [
    { key: 'prog_a',     label: 'Программа А (ОТ)',        years: 3 },
    { key: 'first_aid',  label: 'Первая помощь',           years: 3 },
    { key: 'fire',       label: 'Пожарный минимум',        years: 3 },
    { key: 'siz',        label: 'Применение СИЗ',          years: 3 },
    { key: 'repeat',     label: 'Повторный инструктаж',    months: 6 },
    { key: 'medcheck',   label: 'Медосмотр',               years: 1 },
  ];

  employees.forEach(emp => {
    if (!emp.training) return;
    const client = clients.find(c => c.id === emp.client_id);
    const clientName = client?.name || '';

    TRAINING_TYPES.forEach(tt => {
      const t = emp.training[tt.key];
      if (!t?.date || !t?.required) return;

      const lastDate = new Date(t.date);
      let nextDate = new Date(lastDate);
      if (tt.years)  nextDate.setFullYear(nextDate.getFullYear() + tt.years);
      if (tt.months) nextDate.setMonth(nextDate.getMonth() + tt.months);

      const daysLeft = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 30) {
        alerts.push({
          employee_id:   emp.id,
          employee_name: emp.full_name,
          client_name:   clientName,
          client_id:     emp.client_id,
          training_type: tt.label,
          next_date:     nextDate.toISOString().slice(0, 10),
          days_left:     daysLeft,
          overdue:       daysLeft < 0,
        });
      }
    });
  });

  return alerts.sort((a, b) => a.days_left - b.days_left);
});

// ─── ГЕНЕРАЦИЯ DOCX (справки, протоколы в Word) ──────────
// Поддерживает два формата вызова:
//  1) { rows, title, subtitle, filename } — старый формат, одна таблица
//     (используется большинством генераторов справок/протоколов)
//  2) { sections: [{ heading, note, rows }, ...], title, subtitle, filename }
//     — новый формат, несколько отдельных таблиц с заголовками между ними
//     (нужен для форм вроде отчёта ЦЗН, где в оригинале несколько разноструктурных
//     таблиц подряд, а не одна большая)
ipcMain.handle('docx:generate', async (_, { rows, sections, title, subtitle, filename }) => {
  try {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell,
            TextRun, WidthType, BorderStyle, AlignmentType,
            HeadingLevel, VerticalAlign } = require('docx');

    function buildTable(tableRows) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows.map(row =>
          new TableRow({
            children: row.cells.map(cell =>
              new TableCell({
                width: cell.width ? { size: cell.width, type: WidthType.DXA } : undefined,
                columnSpan: cell.colspan || 1,
                verticalAlign: VerticalAlign.CENTER,
                borders: {
                  top:    { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
                  left:   { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
                  right:  { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
                },
                shading: cell.shading ? { fill: cell.shading } : undefined,
                children: [new Paragraph({
                  alignment: cell.center ? AlignmentType.CENTER : AlignmentType.LEFT,
                  children: [new TextRun({
                    text: String(cell.text ?? ''),
                    bold: cell.bold || false,
                    size: cell.size || 20,
                    font: 'Times New Roman',
                  })],
                })],
              })
            ),
          })
        ),
      });
    }

    // Нормализуем оба формата к единому списку секций.
    const normalizedSections = sections && sections.length
      ? sections
      : [{ heading: null, note: null, rows }];

    const bodyChildren = [];
    normalizedSections.forEach((section, idx) => {
      if (section.heading) {
        bodyChildren.push(new Paragraph({
          spacing: { before: idx === 0 ? 0 : 260, after: 100 },
          children: [new TextRun({ text: section.heading, bold: true, size: 22, font: 'Times New Roman' })],
        }));
      }
      if (section.note) {
        bodyChildren.push(new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: section.note, italics: true, size: 17, color: '666666', font: 'Times New Roman' })],
        }));
      }
      if (section.rows && section.rows.length) {
        bodyChildren.push(buildTable(section.rows));
      }
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1000, right: 1000, bottom: 1000, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: title, bold: true, size: 24, font: 'Times New Roman' })],
          }),
          ...(subtitle ? [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: subtitle, size: 20, font: 'Times New Roman', color: '555555' })],
          })] : [new Paragraph({ spacing: { after: 200 }, children: [] })]),
          ...bodyChildren,
          new Paragraph({
            spacing: { before: 300 },
            children: [new TextRun({
              text: `Сформировано: ${new Date().toLocaleDateString('ru-RU')} · КомплаенсПро`,
              size: 16, color: '888888', font: 'Times New Roman',
            })],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    const safeName = (filename || 'Документ').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить документ',
      defaultPath: path.join(app.getPath('desktop'), safeName + '.docx'),
      filters: [{ name: 'Word документ', extensions: ['docx'] }],
    });

    if (res.canceled) return { ok: false, canceled: true };
    fs.writeFileSync(res.filePath, buffer);
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── ГЕНЕРАЦИЯ PDF (Паспорт безопасности и др.) ──────────
ipcMain.handle('pdf:generate', async (_, { html, filename }) => {
  try {
    // Создаём скрытое окно для рендера PDF
    const pdfWin = new BrowserWindow({
      width: 800,
      height: 1130,
      show: false,
      webPreferences: { offscreen: true },
    });

    // Загружаем HTML
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    // Ждём отрисовки
    await new Promise(r => setTimeout(r, 400));

    const pdfData = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    pdfWin.close();

    // Сохраняем
    const safeName = (filename || 'Документ').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить PDF',
      defaultPath: path.join(app.getPath('desktop'), safeName + '.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (res.canceled) return { ok: false, canceled: true };

    fs.writeFileSync(res.filePath, pdfData);
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── АВТО-БЭКАП (тихий, раз в день при запуске) ──────────
function autoBackup() {
  try {
    const src = path.join(app.getPath('userData'), 'kompliance.json');
    if (!fs.existsSync(src)) return;

    const autoDir = path.join(app.getPath('userData'), 'autobackup');
    fs.mkdirSync(autoDir, { recursive: true });

    const today = new Date().toISOString().slice(0, 10);
    const dest = path.join(autoDir, `auto_${today}.json`);

    // Бэкап раз в день
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }

    // Чистим старые: оставляем последние 30
    const backups = fs.readdirSync(autoDir).filter(f => f.endsWith('.json')).sort();
    while (backups.length > 30) {
      const old = backups.shift();
      try { fs.unlinkSync(path.join(autoDir, old)); } catch(_) {}
    }
  } catch (e) {
    console.error('autoBackup error:', e);
  }
}

// ─── ТРИАЛ И ЛИЦЕНЗИЯ ────────────────────────────────────
//
// Логика:
// ─── ТРИАЛ (14 дней) + ЛИЦЕНЗИЯ (привязка к машине) ─────
//
// Триал:
//   - 14 дней, максимум 2 клиента
//   - Напоминания: день 7, 11, 13
//   - День 14: экран блокировки с ID устройства и инструкцией
//
// Лицензия:
//   - Ключ привязан к конкретной машине (серийник диска + имя ПК)
//   - Передать другому — невозможно, ключ не сработает
//   - Клиент видит свой ID в Настройках → Подписка
//   - Ты генерируешь ключ через keygen.js

const TRIAL_DAYS      = 14;
const TRIAL_MAX_CLIENTS = 2;
const LICENSE_SECRET  = 'KP-2026-SECRET-XJ9'; // не менять после релиза!

// Тарифные комбинации (тип лицензии + лимит). Для OUTSOURCE лимит — это
// максимум АКТИВНЫХ клиентов, для SOLO — максимум сотрудников. 0 = без
// ограничений. ВАЖНО: этот список должен СОВПАДАТЬ построчно с TARIFFS
// в keygen.js — если меняешь тарифы (цену, лимит, добавляешь новый),
// меняй сразу в обоих файлах, иначе уже выданные ключи перестанут
// проходить проверку или новые ключи не будут совпадать с тем, что
// генерирует keygen.js.
const TARIFF_COMBOS = [
  { type: 'OUTSOURCE', limit: 10  }, // Аутсорсер — до 10 клиентов — 3990₽
  { type: 'OUTSOURCE', limit: 0   }, // Аутсорсер Про — без лимита — 4990₽
  { type: 'SOLO',       limit: 15  }, // Микро — до 15 сотрудников — 2490₽
  { type: 'SOLO',       limit: 100 }, // Малый — до 100 сотрудников — 3990₽
  { type: 'SOLO',       limit: 250 }, // Средний — до 250 сотрудников — 5990₽
  { type: 'PASF',       limit: 1   }, // ПАСФ — самостоятельный тариф, СТРОГО одна организация
];

// Уникальный ID машины — серийник диска C: + имя компьютера
function getMachineId() {
  const crypto = require('crypto');
  const os     = require('os');
  try {
    const { execSync } = require('child_process');
    const vol = execSync('vol C:', { encoding: 'utf8', timeout: 3000 })
      .match(/[A-F0-9]{4}-[A-F0-9]{4}/i)?.[0] || '';
    const raw = os.hostname() + ':' + vol;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 12).toUpperCase();
  } catch(e) {
    return crypto.createHash('sha256').update(os.hostname()).digest('hex').substring(0, 12).toUpperCase();
  }
}

// Генерация ключа: SECRET + тип + дата + ID машины + лимит.
// Лимит добавлен в хеш, чтобы его нельзя было подменить вручную в
// settings.json — он криптографически зашит в сам ключ, как и тип.
function generateMachineKey(type, expireDate, machineId, limit) {
  const crypto = require('crypto');
  const raw = LICENSE_SECRET + ':' + type + ':' + expireDate + ':' + machineId + ':' + limit;
  return 'KP-' + crypto.createHash('sha256').update(raw).digest('hex').substring(0, 24).toUpperCase();
}

function checkTrial(db) {
  // Dev-режим: запуск через start.bat (электрон не упакован в exe).
  // Это твой собственный рабочий инструмент — баннер триала/лицензии
  // тут не нужен вообще, независимо от того, что лежит в settings.
  // На собранный exe (твой личный или клиентский) это не влияет —
  // там app.isPackaged === true и весь код ниже работает как раньше.
  if (!app.isPackaged) {
    return { status: 'licensed', daysLeft: null, machineId: getMachineId(), dev: true };
  }

  const settings  = db.get('settings').value();
  const machineId = getMachineId();

  // ── Активная лицензия ───────────────────────────────
  if (settings.trial_status === 'licensed' && settings.license_key) {

    // Проверяем привязку к машине (DEV-MODE пропускаем)
    if (settings.license_key !== 'DEV-MODE' && settings.license_machine &&
        settings.license_machine !== machineId) {
      return { status: 'wrong_machine', machineId };
    }

    // Проверяем срок
    if (settings.license_expires) {
      const daysLeft = Math.ceil(
        (new Date(settings.license_expires) - new Date()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 0) {
        db.get('settings').assign({ trial_status: 'subscription_expired' }).write();
        return { status: 'subscription_expired', machineId };
      }
      return { status: 'licensed', daysLeft, machineId, expires: settings.license_expires };
    }
    return { status: 'licensed', daysLeft: null, machineId, expires: settings.license_expires || '' };
  }

  // ── Подписка истекла ────────────────────────────────
  if (settings.trial_status === 'subscription_expired') {
    return { status: 'subscription_expired', machineId };
  }

  // ── Первый запуск — фиксируем дату ─────────────────
  if (!settings.trial_start) {
    const today = new Date().toISOString().slice(0, 10);
    db.get('settings').assign({ trial_start: today, trial_status: 'trial' }).write();
    return { status: 'trial', daysLeft: TRIAL_DAYS, maxClients: TRIAL_MAX_CLIENTS, machineId };
  }

  // ── Считаем дни триала ──────────────────────────────
  const diffDays = Math.floor(
    (new Date() - new Date(settings.trial_start)) / (1000 * 60 * 60 * 24)
  );
  const daysLeft = Math.max(0, TRIAL_DAYS - diffDays);

  if (daysLeft === 0) {
    return { status: 'expired', daysLeft: 0, machineId };
  }

  return { status: 'trial', daysLeft, maxClients: TRIAL_MAX_CLIENTS, machineId };
}

// Получить статус триала/лицензии
ipcMain.handle('trial:status', () => checkTrial(db));

// Получить ID машины
ipcMain.handle('machine:id', () => ({ machineId: getMachineId() }));

// Версия приложения для отображения в интерфейсе (сайдбар, Настройки →
// Подписка) — раньше нигде не показывалась пользователю, из-за чего было
// сложно понять, какая версия реально установлена (см. историю с потерянным
// апгрейдом Electron 13.07.2026 — часть путаницы была именно из-за того,
// что версию негде было посмотреть, кроме package.json на диске).
ipcMain.handle('app:version', () => require('./package.json').version);

// Активировать лицензию
ipcMain.handle('license:activate', (_, key, expireDate, type) => {
  if (!key || !expireDate) return { ok: false, error: 'Заполните все поля' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) return { ok: false, error: 'Неверный формат даты' };

  const machineId = getMachineId();

  // DEV-MODE — для разработчика, без привязки к машине.
  // ТОЛЬКО в !app.isPackaged — иначе в собранном .exe эта строка давала бы
  // ЛЮБОМУ пользователю полную безлимитную лицензию бесплатно навсегда.
  if (!app.isPackaged && key.trim() === 'DEV-MODE-KP2026') {
    db.get('settings').assign({
      license_key:     'DEV-MODE',
      license_expires: expireDate,
      license_machine: machineId,
      license_type:    'OUTSOURCE',
      license_limit:   0, // безлимит
      license_modules: 'OT,PD,VU',
      trial_status:    'licensed',
    }).write();
    return { ok: true };
  }

  // Проверяем ключ с привязкой к машине — перебираем все известные
  // тарифные комбинации (тип+лимит), а не просто два «голых» типа:
  // лимит зашит в хеш, поэтому угадывать его отдельно не нужно — какая
  // комбинация совпала, та и верна.
  for (const combo of TARIFF_COMBOS) {
    const expected = generateMachineKey(combo.type, expireDate, machineId, combo.limit);
    if (key.trim().toUpperCase() === expected) {
      db.get('settings').assign({
        license_key:     key.trim().toUpperCase(),
        license_expires: expireDate,
        license_machine: machineId,
        license_type:    combo.type,
        license_limit:   combo.limit,
        license_modules: 'OT,PD,VU',
        trial_status:    'licensed',
      }).write();

      // ПАСФ — один самостоятельный тариф «приложение в приложении»: ключ
      // сразу включает и режим дашборда, и сам функционал (без отдельного
      // шага активации аддона на клиента, как у ЧОП/FLEET). У ПАСФ-покупателя
      // организация всегда одна, ОТ ей нужна по умолчанию (свой персонал).
      if (combo.type === 'PASF') {
        db.get('clients').each(c => {
          const mods = new Set((c.modules || '').split(',').filter(Boolean));
          mods.add('PASF'); mods.add('OT');
          c.modules = Array.from(mods).join(',');
        }).write();

        // hasAddon('PASF') смотрит на settings.license_addons — он обычно
        // заполняется отдельным ключом аддона (addon:activate). Для ПАСФ
        // отдельного шага нет, поэтому помечаем аддон активным здесь же.
        const s = db.get('settings').value();
        const addons = s.license_addons || [];
        if (!addons.includes('PASF')) addons.push('PASF');
        const addonExpires = s.addon_expires || {};
        addonExpires['PASF'] = expireDate; // синхронно со сроком лицензии
        db.get('settings').assign({ license_addons: addons, addon_expires: addonExpires }).write();
      }

      return { ok: true, type: combo.type, limit: combo.limit };
    }
  }

  return { ok: false, error: 'Неверный ключ. Ключ привязан к другому устройству или неверная дата.' };
});

// Сброс триала (только через admin-режим)
// ─── СОУТ ────────────────────────────────────────────────
ipcMain.handle('sout:get', (_, clientId) => {
  const client = db.get('clients').find({ id: clientId }).value();
  return client ? (client.sout_data || null) : null;
});

ipcMain.handle('sout:save', (_, clientId, data) => {
  db.get('clients').find({ id: clientId }).assign({ sout_data: data }).write();
  return { ok: true };
});

ipcMain.handle('sout:generate', async (_, clientId, soutData) => {
  const client = db.get('clients').find({ id: clientId }).value();
  if (!client) throw new Error('Клиент не найден');

  // Базовая папка документов клиента
  const clientDocDir = path.join(
    app.getPath('appData'),
    'КомплаенсПро',
    'Документы',
    (client.name || 'Клиент').replace(/[/\\?%*:|"<>]/g, '').trim()
  );
  if (!fs.existsSync(clientDocDir)) fs.mkdirSync(clientDocDir, { recursive: true });

  // Добавляем сотрудников в объект клиента для генераторов
  const employees = db.get('employees').filter({ client_id: clientId }).value() || [];
  const clientWithEmps = { ...client, employees };

  const result = await generateSoutPackage(clientWithEmps, soutData, clientDocDir);

  if (result.errors && result.errors.length) {
    console.warn('[SOUT] Ошибки при генерации:', result.errors);
  }

  return { folder: result.folder, count: result.results.length, errors: result.errors };
});

ipcMain.handle('trial:reset', () => {
  db.get('settings').assign({
    trial_start:     '',
    trial_status:    '',
    license_key:     '',
    license_expires: '',
    license_machine: '',
    license_limit:   '',
    license_type:    '',
    license_modules: '',
  }).write();
  return { ok: true };
});

// ─── PIN-КОД ─────────────────────────────────────────────
ipcMain.handle('pin:check', (_, pin) => {
  const crypto = require('crypto');
  const stored = db.get('settings.pin_hash').value() || '';
  if (!stored) return { ok: true, noPin: true };
  const hash = crypto.createHash('sha256').update(String(pin)).digest('hex');
  return { ok: hash === stored };
});

ipcMain.handle('pin:set', (_, pin) => {
  const crypto = require('crypto');
  if (!pin) {
    // Отключить PIN
    db.get('settings').assign({ pin_hash: '', pin_enabled: '0' }).write();
    return { ok: true };
  }
  const hash = crypto.createHash('sha256').update(String(pin)).digest('hex');
  db.get('settings').assign({ pin_hash: hash, pin_enabled: '1' }).write();
  return { ok: true };
});

ipcMain.handle('pin:status', () => {
  const enabled = db.get('settings.pin_enabled').value();
  return { enabled: enabled === '1' };
});

// ─── ОКНО ────────────────────────────────────────────────


// ─── АВТООБНОВЛЕНИЕ ──────────────────────────────────────
//
// При каждом запуске программа проверяет GitHub Releases.
// Если есть новая версия — показывает диалог пользователю.
// Пользователь может обновить сейчас или отложить.
// Обновление скачивается в фоне, устанавливается при закрытии.

function setupAutoUpdater() {
  // Не проверяем обновления в режиме разработки
  if (!app.isPackaged) {
    console.log('[Updater] Пропускаем — режим разработки');
    return;
  }

  autoUpdater.autoDownload = false;       // Сначала спросим пользователя
  autoUpdater.autoInstallOnAppQuit = true; // Установить при закрытии если скачано

  // Новая версия найдена
  autoUpdater.on('update-available', (info) => {
    updateLog(`update-available: ${info.version}`);
    if (!mainWindow) { updateLog('mainWindow null — пропускаем'); return; }

    pendingUpdate = { version: info.version, releaseDate: info.releaseDate };

    // Если страница уже загружена — отправляем сразу
    if (!mainWindow.webContents.isLoading()) {
      updateLog(`страница загружена — отправляем сразу`);
      mainWindow.webContents.send('update:available', pendingUpdate);
      pendingUpdate = null;
    } else {
      updateLog(`страница ещё грузится — сохраняем в pendingUpdate`);
    }
  });

  // Новой версии нет
  autoUpdater.on('update-not-available', () => {
    updateLog('update-not-available — версия актуальна');
  });

  // Прогресс скачивания
  autoUpdater.on('download-progress', (progress) => {
    if (!mainWindow) return;
    mainWindow.webContents.send('update:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  // Скачивание завершено
  autoUpdater.on('update-downloaded', () => {
    updateLog('update-downloaded');
    if (!mainWindow) return;
    mainWindow.webContents.send('update:downloaded');
  });

  // Ошибка обновления
  autoUpdater.on('error', (err) => {
    updateLog(`error: ${err.message}`);
  });

  // Проверяем обновления через 10 секунд после запуска
  updateLog('таймер запущен (10 сек)');
  setTimeout(() => {
    updateLog('checkForUpdates...');
    autoUpdater.checkForUpdates().catch(err => {
      updateLog(`checkForUpdates failed: ${err.message}`);
    });
  }, 10000);
}

// IPC — пользователь согласился скачать обновление
ipcMain.handle('update:download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

// IPC — установить и перезапустить сейчас
ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

function createWindow() {
  // Восстанавливаем сохранённый размер окна
  let bounds = {};
  try {
    const saved = db.get('settings').value().window_bounds;
    if (saved) bounds = JSON.parse(saved);
  } catch(_) {}

  mainWindow = new BrowserWindow({
    width:  bounds.width  || 1280,
    height: bounds.height || 800,
    x:      bounds.x,
    y:      bounds.y,
    minWidth: 960,
    minHeight: 600,
    title: 'КомплаенсПро',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#080c14',
    show: false,
  });

  // Убираем стандартное английское меню (File/Edit/View...)
  Menu.setApplicationMenu(null);

  // Ctrl+Shift+I — открыть DevTools (временно для отладки)
  const { globalShortcut } = require('electron');
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools();
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Отправляем отложенное уведомление об обновлении после загрузки страницы
  mainWindow.webContents.on('did-finish-load', () => {
    updateLog(`did-finish-load, pendingUpdate: ${JSON.stringify(pendingUpdate)}`);
    if (pendingUpdate) {
      // Задержка 5 сек — даём время на инициализацию PIN/триал экранов
      setTimeout(() => {
        if (pendingUpdate && mainWindow) {
          updateLog(`отправляем update:available после did-finish-load`);
          mainWindow.webContents.send('update:available', pendingUpdate);
          pendingUpdate = null;
        }
      }, 5000);
    }
  });
  // Сохраняем размер окна при изменении
  const saveBounds = () => {
    if (!mainWindow) return;
    try {
      db.get('settings').assign({ window_bounds: JSON.stringify(mainWindow.getBounds()) }).write();
    } catch(_) {}
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
}

app.whenReady().then(() => {
  initDB();
  autoBackup();
  applyAutostartSetting();
  startTelegramScheduler();
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
