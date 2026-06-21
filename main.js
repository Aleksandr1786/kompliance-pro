const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const { generatePackage } = require('./generator');
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

const DB_VERSION = 2;

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
      if (v.user_phone    === '+7 961 519-24-00')                  s.assign({ user_phone: '' }).write();
      if (v.user_email    === 'asvincov@gmail.com')                s.assign({ user_email: '' }).write();
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
    divisions: [],
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
      tg_last_morning_date: '',
      npa_last_check_date: '',
      autostart: '0',
      backup_path: '',
      ai_provider: 'claude',
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
    }
  }).write();

  // Накатываем миграции схемы
  runMigrations(db);
}

function nextId(collection) {
  const items = db.get(collection).value();
  if (!items.length) return 1;
  return Math.max(...items.map(i => i.id)) + 1;
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
  return null;
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
  }

  const id = nextId('clients');
  const client = { ...data, id, created_at: now(), score: 0 };
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

ipcMain.handle('employees:delete', (_, id) => {
  db.get('employees').remove({ id }).write();
  return { ok: true };
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
  setTimeout(() => { maybeSendMorningDigest(); checkUrgentEvents(); checkNpaUpdates(); }, 15000);
  // Дальше — каждые 5 минут, пока приложение открыто (checkNpaUpdates сам
  // ограничивает себя одним реальным запуском в день, см. npa_last_check_date).
  setInterval(() => { maybeSendMorningDigest(); checkUrgentEvents(); checkNpaUpdates(); }, 5 * 60 * 1000);
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
  const MODULE_LABELS = { ot: 'охране труда', pd: 'персональным данным', vu: 'воинскому учёту' };
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
  const docsText = docs ? `Обновите: ${docs.join(', ')}.` : `Проверьте документы по ${moduleLabel}.`;
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
  { module: 'ot', code: '2464',   label: 'ПП РФ № 2464 — обучение по охране труда',
    relatedDocs: ['Положение о системе управления охраной труда','Приказ об утверждении программ обучения','Положение о порядке обучения по охране труда'] },
  { module: 'ot', code: '772н',   label: 'Приказ Минтруда № 772н — обеспечение СИЗ',
    relatedDocs: ['Приказ об утверждении инструкций по охране труда','Положение о разработке инструкций по охране труда'] },
  { module: 'ot', code: '766н',   label: 'Приказ Минтруда № 766н — нормы выдачи СИЗ',
    relatedDocs: ['Приказ о назначении ответственного за СИЗ','Положение об обеспечении работников СИЗ'] },
  { module: 'ot', code: '776н',   label: 'Приказ Минтруда № 776н — система управления охраной труда',
    relatedDocs: ['Положение о системе управления охраной труда'] },
  { module: 'ot', code: '632н',   label: 'Приказ Минтруда № 632н',
    relatedDocs: ['Положение о системе управления охраной труда','Положение об учёте микротравм'] },
  { module: 'ot', code: '223н',   label: 'Приказ Минтруда № 223н — расследование несчастных случаев',
    relatedDocs: ['Положение о системе управления охраной труда'] },
  { module: 'ot', code: '398н',   label: 'Приказ Минтруда № 398н — аптечки первой помощи',
    relatedDocs: ['Приказ об обеспечении аптечками первой помощи','Инструкция о порядке использования аптечки'] },
  { module: 'ot', code: '811',    label: 'Приказ Минэнерго № 811 — электробезопасность',
    clientFilter: c => !!c.hazard_works,
    relatedDocs: ['Приказ о назначении ответственного за электрохозяйство','Журнал учёта присвоения I группы электробезопасности','Программа инструктажа по электробезопасности'] },
  { module: 'ot', code: '903н',   label: 'Приказ Минтруда № 903н — электробезопасность',
    clientFilter: c => !!c.hazard_works,
    relatedDocs: ['Приказ о назначении ответственного за электрохозяйство','Журнал учёта присвоения I группы электробезопасности','Программа инструктажа по электробезопасности'] },
  { module: 'ot', code: '29н',    label: 'Приказ Минздрава № 29н — медосмотры',
    clientFilter: c => !!c.medcheck_required,
    relatedDocs: ['Приказ об организации медицинских осмотров','Список контингента для медицинских осмотров'] },
  { module: 'ot', code: '782н',   label: 'Приказ Минтруда № 782н — работы на высоте',
    clientFilter: c => !!c.hazard_works,
    relatedDocs: ['Инструкция по охране труда при работах на высоте'] },
  { module: 'pd', code: '152-ФЗ', label: 'ФЗ № 152-ФЗ — о персональных данных' },
  { module: 'pd', code: '266-ФЗ', label: 'ФЗ № 266-ФЗ — поправки в 152-ФЗ' },
  { module: 'pd', code: '1119',   label: 'ПП РФ № 1119 — защита ПДн в информационных системах' },
  { module: 'pd', code: '178',    label: 'Приказ РКН № 178' },
  { module: 'vu', code: '719',    label: 'ПП РФ № 719 — положение о воинском учёте' },
  { module: 'vu', code: '53-ФЗ',  label: 'ФЗ № 53-ФЗ — о воинской обязанности и военной службе' },
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
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
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
        db.get('documents').push({
          id:          maxId,
          client_id:   clientId,
          module:      'VU',
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
  let client = db.get('clients').find({ id: clientId }).value();
  if (!client) return { ok: false, error: 'Клиент не найден' };
  const settings = db.get('settings').value();

  // Фиксируем дату документов один раз — при первом формировании
  // (см. комментарий в vu:generate-reports — та же причина).
  if (!client.doc_date) {
    const fixedDate = new Date().toLocaleDateString('ru-RU');
    db.get('clients').find({ id: clientId }).assign({ doc_date: fixedDate }).write();
    client = db.get('clients').find({ id: clientId }).value();
  }

  // Папка клиента: <корень документов> / Название организации
  const rootDir  = getOutputRoot();
  const safeName = (client.name || 'Клиент').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 60).replace(/[ .]+$/, '') || 'Клиент';
  const outputDir = path.join(rootDir, safeName);
  fs.mkdirSync(outputDir, { recursive: true });

  // Подтягиваем сотрудников клиента из базы
  const employees = db.get('employees').filter({ client_id: clientId }).value();

  // Считаем хеш данных клиента для умной генерации
  const crypto = require('crypto');
  const clientHash = crypto.createHash('md5')
    .update(JSON.stringify({ ...client, employees }))
    .digest('hex');

  const clientWithEmployees = {
    ...client,
    // Нормализуем город — убираем лишний "г."
    city: (client.city || client.region || '').replace(/^г\.?\s*/i,'').trim() || '',
    // Передаём все поля СОУТ и особых условий
    soat_class:        client.soat_class        || '2',
    hazard_works:      client.hazard_works       || 0,
    medcheck_required: client.medcheck_required  || 0,
    // Ответственный за ОТ (если не указан — руководитель)
    ot_name:           client.ot_name           || client.manager_name || '',
    ot_position:       client.ot_position       || client.manager_position || '',
    ot_name_full:      client.ot_name_full      || client.ot_name || client.manager_name || '',
    employees: employees.map(e => ({
      full_name:    e.full_name    || '',
      position:     e.position    || '',
      // Падежи ФИО для документов
      name_gen:     e.name_gen    || '',  // родительный
      name_dat:     e.name_dat    || '',  // дательный (для приказов)
      name_acc:     e.name_acc    || '',  // винительный
      name_ins:     e.name_ins    || '',  // творительный
      name_short:   e.name_short  || '',  // Фамилия И.О.
      birth_date:   e.birth_date  || '',
      hired_at:     e.hired_at    || '',
      tab_number:   e.tab_number  || '',
      gender:       e.gender      || 'm',
      is_military:  e.is_military || 0,
    })),
  };

  // Получаем старые документы для сравнения
  const oldDocs = db.get('documents').filter({ client_id: clientId }).value();
  const oldDocMap = {};
  oldDocs.forEach(d => { oldDocMap[d.name] = d; });

  // Собираем карту хэшей файлов на диске (для умной генерации)
  const { buildDiskHashMap, getDocYear, docContentHash, diffClientFields, snapshotClientFields } = require('./utils');
  const diskHashMap = buildDiskHashMap(oldDocs);

  // Реестр версий шаблонов документов — для причины «обновлены требования
  // законодательства» (см. doc-meta.js).
  const DOC_META = require('./doc-meta');

  try {
    const result = await generatePackage(clientWithEmployees, {
      ...settings,
      diskHashMap,
      currentClientHash: clientHash,
    }, outputDir, scope);

    // Обновляем документы в БД — upsert по имени файла (без дублей)
    // При scoped-генерации удаляем из реестра ТОЛЬКО записи этого модуля,
    // чтобы не затереть документы других модулей.
    // Исключение — «накопительные» документы (Акт об уничтожении ПД с датой
    // в имени, 🟢➕): они не пересоздаются каждый запуск, поэтому их записи
    // из реестра не удаляем, иначе файл останется на диске, а из реестра пропадёт.
    const isAccumulatingDoc = (name) => /^Акт об уничтожении персональных данных от .+\.docx$/.test(name);

    if (scope === 'ALL') {
      db.get('documents').remove(d => d.client_id === clientId && !isAccumulatingDoc(d.name)).write();
    } else {
      db.get('documents').remove(d => d.client_id === clientId && d.module === scope && !isAccumulatingDoc(d.name)).write();
    }
    let maxId = Math.max(0, ...db.get('documents').value().map(d => d.id), 0);

    // Дедупликация реестра по (client_id, name): дубли одного документа —
    // всегда ошибка (один файл = одна запись). Накопительные акты с РАЗНЫМИ
    // датами имеют разные имена, поэтому не схлопываются между собой, а вот
    // повторные записи одного и того же акта (одна дата) — убираем.
    // Это чистит и «вечные» записи-сироты, которые исключены из массового
    // remove выше как накопительные, но физически уже не пересоздаются.
    {
      const seen = new Set();
      const toRemoveIds = [];
      for (const d of db.get('documents').value()
                        .filter(x => x.client_id === clientId)
                        .sort((a,b) => b.id - a.id)) {           // свежие (больший id) — первыми
        const key = d.name;
        if (seen.has(key)) toRemoveIds.push(d.id);
        else seen.add(key);
      }
      if (toRemoveIds.length) {
        db.get('documents').remove(d => toRemoveIds.includes(d.id)).write();
      }
    }

    const report = { updated: [], added: [], unchanged: [] };
    const seenNames = new Set(); // защита от дублей внутри одной генерации
    // Какие модули реально обрабатывались в этом запуске — для точечного
    // обновления per-модульного снимка last_gen_snapshot (см. ниже).
    const touchedModules = new Set();

    for (const filename of result.generated) {
      maxId++;
      const baseName = path.basename(filename);

      // Пропускаем дубли (один и тот же файл не может быть два раза)
      if (seenNames.has(baseName)) continue;
      seenNames.add(baseName);
      // Хеш байтов файла (для обратной совместимости) + хеш СОДЕРЖИМОГО.
      // Решение «изменился/не изменился» принимаем по содержимому (document.xml),
      // т.к. байты .docx меняются всегда из-за таймстампов — иначе отчёт всегда
      // показывал бы «обновлено всё», даже когда реально ничего не менялось.
      let fileHash = '';
      try {
        const buf = fs.readFileSync(filename);
        fileHash = crypto.createHash('md5').update(buf).digest('hex');
      } catch(e) {}
      const contentHash = docContentHash(filename);

      const oldDoc = oldDocMap[baseName];
      let status = 'ok';
      let changeType = 'added';

      if (oldDoc) {
        // Сравниваем по содержимому, если оно сохранено; иначе фоллбэк на байты.
        if (oldDoc.doc_content_hash) {
          changeType = (oldDoc.doc_content_hash === contentHash) ? 'unchanged' : 'updated';
        } else if (oldDoc.file_hash && oldDoc.file_hash === fileHash) {
          changeType = 'unchanged';
        } else {
          changeType = 'updated';
        }
      }

      // Определяем модуль по папке файла — нужен и для причины (свой снимок
      // на модуль), и для записи в реестр.
      const filePath = filename.replace(/\\/g, '/');
      let docModule = 'OT';
      if (filePath.includes('Персональные данные'))   docModule = 'PD';
      else if (filePath.includes('Воинский учёт'))     docModule = 'VU';
      touchedModules.add(docModule);

      // «Почему изменился документ» (Фаза 1). Разделитель причин:
      //   - версия шаблона выросла (doc-meta.js) → обновлены требования НПА;
      //   - версия та же, но изменились отслеживаемые поля клиента
      //     (FIELD_LABELS) → изменились данные клиента;
      //   - ни то ни другое (например, первое формирование этого модуля
      //     после внедрения фичи, нет снимка) → причина не подбирается,
      //     чтобы не показать ложную информацию в доказательной базе.
      //
      // Снимок — per-модульный (client.last_gen_snapshot[docModule]), а не
      // общий: doc_content_hash документов каждого модуля «протухает» в свой
      // момент — когда этот модуль формировался последний раз. Общий снимок
      // приводил к тому, что формирование одного модуля «съедало» диф и
      // следующее формирование другого модуля его уже не видело.
      const docMeta = DOC_META[baseName] || {};
      const newTemplateVersion = docMeta.version || 1;
      let changeReason = null;

      if (changeType === 'updated') {
        const oldTemplateVersion = (oldDoc && oldDoc.template_version) || 1;
        if (newTemplateVersion > oldTemplateVersion) {
          changeReason = 'Обновлены требования законодательства'
            + (docMeta.npa ? ': ' + docMeta.npa : '')
            + ` (версия документа ${oldTemplateVersion} → ${newTemplateVersion})`;
        } else {
          const moduleSnapshot = client.last_gen_snapshot && client.last_gen_snapshot[docModule];
          const changedFields = diffClientFields(moduleSnapshot, clientWithEmployees);
          if (changedFields.length) {
            changeReason = 'Изменились данные клиента: '
              + changedFields.map(c => `${c.label} (${c.from} → ${c.to})`).join(', ');
          }
        }
      }

      if (changeType === 'unchanged') report.unchanged.push(baseName);
      else if (changeType === 'updated') report.updated.push({ name: baseName, reason: changeReason });
      else report.added.push(baseName);

      const npaText =
          docModule === 'PD' ? 'ФЗ-152 от 27.07.2006, ФЗ-266 от 14.07.2022, ПП РФ №1119'
        : docModule === 'VU' ? 'ФЗ-53 от 28.03.1998, ПП РФ №719 от 27.11.2006'
        :                      'ТК РФ, Постановление Правительства №2464';

      // Upsert по имени: убираем возможную существующую запись этого документа,
      // чтобы не плодить дубли. Важно для накопительных актов (Акт об уничтожении
      // ПД с датой): они исключены из массового remove выше, поэтому без этого
      // точечного удаления повторные генерации добавляли бы новую запись каждый
      // раз (один файл на диске → много записей в реестре).
      db.get('documents').remove(d => d.client_id === clientId && d.name === baseName).write();

      db.get('documents').push({
        id:          maxId,
        client_id:   clientId,
        module:      docModule,
        name:        baseName,
        filename:    baseName,
        filepath:    filename,
        file_hash:   fileHash,
        doc_content_hash: contentHash,
        client_hash: clientHash,
        doc_year:    getDocYear(client),
        template_version: newTemplateVersion,
        status:      'ok',
        created_at:  oldDoc?.created_at || new Date().toISOString(),
        updated_at:  new Date().toISOString(),
        npa_basis:   npaText,
        notes:       '',
      }).write();
    }

    // Снимок отслеживаемых полей клиента — per-модульный (см. комментарий
    // выше про touchedModules): обновляем только те ветки last_gen_snapshot,
    // модули которых реально формировались в этом запуске. Остальные ветки
    // (например, VU, если формировали только ОТ/ПДн) остаются как были —
    // иначе следующее формирование VU не увидело бы диф, накопленный с
    // момента ЕГО последнего формирования.
    {
      const newSnapshot = { ...(client.last_gen_snapshot || {}) };
      const currentSnapshot = snapshotClientFields(clientWithEmployees);
      for (const m of touchedModules) newSnapshot[m] = currentSnapshot;
      db.get('clients').find({ id: clientId }).assign({ last_gen_snapshot: newSnapshot }).write();
    }

    return {
      ok:           true,
      generated:    result.generated,
      errors:       result.errors,
      dir:          outputDir,
      report: {
        ...report,
        userModified: result.report?.userModified || [],
        archived:     result.report?.archived || [],
      },
    };
  } catch(e) {
    return { ok: false, error: e.message };
  }
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
async function callAI(prompt, system) {
  const s = db.get('settings').value();
  const provider = s.ai_provider || 'deepseek';
  const apiKey   = s.ai_key || '';

  if (!apiKey) return { ok: false, error: 'API ключ не указан в настройках' };

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
        max_tokens: 512,
        system:     system || 'Ты помощник. Отвечай только JSON без markdown.',
        messages:   [{ role: 'user', content: prompt }],
      });
    } else {
      // DeepSeek — OpenAI-совместимый формат
      url = 'https://api.deepseek.com/v1/chat/completions';
      headers = {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + apiKey,
      };
      body = JSON.stringify({
        model:       'deepseek-chat',
        max_tokens:  512,
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
// ─── ОБУЧЕНИЕ СОТРУДНИКОВ ────────────────────────────────
ipcMain.handle('training:get', (_, employeeId) => {
  const emp = db.get('employees').find({ id: employeeId }).value();
  return emp?.training || {};
});

ipcMain.handle('training:save', (_, employeeId, data) => {
  db.get('employees').find({ id: employeeId }).assign({ training: data }).write();
  return { ok: true };
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
ipcMain.handle('docx:generate', async (_, { rows, title, subtitle, filename }) => {
  try {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell,
            TextRun, WidthType, BorderStyle, AlignmentType,
            HeadingLevel, VerticalAlign } = require('docx');

    // Строим таблицу из строк { cells: [{text, bold, width, colspan}] }
    const tableRows = rows.map(row =>
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
    );

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
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
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

// Активировать лицензию
ipcMain.handle('license:activate', (_, key, expireDate, type) => {
  if (!key || !expireDate) return { ok: false, error: 'Заполните все поля' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) return { ok: false, error: 'Неверный формат даты' };

  const machineId = getMachineId();

  // DEV-MODE — для разработчика, без привязки к машине
  if (key.trim() === 'DEV-MODE-KP2026') {
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
      return { ok: true, type: combo.type, limit: combo.limit };
    }
  }

  return { ok: false, error: 'Неверный ключ. Ключ привязан к другому устройству или неверная дата.' };
});

// Сброс триала (только через admin-режим)
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
