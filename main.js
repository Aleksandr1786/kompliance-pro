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

const DB_VERSION = 1;

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

  // ── Шаблон для следующей миграции ──────────────────────
  // {
  //   version: 2,
  //   description: 'Описание что меняется',
  //   up(db) {
  //     db.get('clients').each(c => {
  //       if (c.new_field === undefined) c.new_field = 'default';
  //     }).write();
  //   }
  // },
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
    divisions: [],
    settings: {
      user_name: 'Александр Свинцов',
      user_position: 'Специалист по охране труда',
      user_phone: '+7 961 519-24-00',
      user_email: 'asvincov@gmail.com',
      company_name: 'ИП Свинцов Александр Викторович',
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

// ─── КЛИЕНТЫ ─────────────────────────────────────────────
ipcMain.handle('clients:list', () => {
  return db.get('clients').sortBy('name').value();
});

ipcMain.handle('clients:get', (_, id) => {
  return db.get('clients').find({ id }).value();
});

ipcMain.handle('clients:add', (_, data) => {
  if (!data.name?.trim()) return { error: 'Название организации обязательно' };
  if (!data.okved?.trim()) return { error: 'ОКВЭД обязателен' };
  const inn = (data.inn || '').trim();
  if (inn && !/^\d{10}$|^\d{12}$/.test(inn)) return { error: 'ИНН должен содержать 10 или 12 цифр' };

  // Ограничение триала: максимум 2 клиента
  const trial = checkTrial(db);
  if (trial.status === 'trial' || trial.status === 'expired') {
    const count = db.get('clients').filter({ archived: 0 }).value().length;
    if (count >= 2) {
      return { error: 'В пробной версии можно добавить не более 2 клиентов. Приобретите лицензию для снятия ограничения.' };
    }
  }

  const id = nextId('clients');
  const client = { ...data, id, created_at: now(), score: 0 };
  db.get('clients').push(client).write();
  return { id };
});

ipcMain.handle('clients:update', (_, id, data) => {
  db.get('clients').find({ id }).assign(data).write();
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
  if (!data.full_name?.trim()) return { error: 'ФИО сотрудника обязательно' };
  if (!data.position?.trim()) return { error: 'Должность обязательна' };
  const id = nextId('employees');
  db.get('employees').push({ ...data, id }).write();
  return { id };
});

ipcMain.handle('employees:update', (_, id, data) => {
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
  const client = db.get('clients').find({ id: clientId }).value();
  if (!client) return { ok: false, error: 'Клиент не найден' };
  const settings = db.get('settings').value();

  const rootDir  = path.join(app.getPath('desktop'), 'КомплаенсПро_Документы');
  const safeName = (client.name || 'Клиент').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 60);
  const outputDir = path.join(rootDir, safeName);
  fs.mkdirSync(outputDir, { recursive: true });

  const employees = db.get('employees').filter({ client_id: clientId }).value();
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
    const result = await generateVuReports(clientWithEmployees, settings, outputDir, docs);
    const vuDir = require('path').join(outputDir, 'Воинский учёт');
    return { ok: true, generated: result.generated, errors: result.errors, folder: vuDir };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('docs:generate', async (_, clientId) => {
  const client = db.get('clients').find({ id: clientId }).value();
  if (!client) return { ok: false, error: 'Клиент не найден' };
  const settings = db.get('settings').value();

  // Папка клиента: КомплаенсПро_Документы / Название организации
  const rootDir  = path.join(app.getPath('desktop'), 'КомплаенсПро_Документы');
  const safeName = (client.name || 'Клиент').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 60);
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
  const { buildDiskHashMap } = require('./utils');
  const diskHashMap = buildDiskHashMap(oldDocs);

  try {
    const result = await generatePackage(clientWithEmployees, {
      ...settings,
      diskHashMap,
      currentClientHash: clientHash,
    }, outputDir);

    // Обновляем документы в БД — upsert по имени файла (без дублей)
    // Сначала удаляем ВСЕ старые записи клиента
    db.get('documents').remove({ client_id: clientId }).write();
    let maxId = Math.max(0, ...db.get('documents').value().map(d => d.id), 0);

    const report = { updated: [], added: [], unchanged: [] };
    const seenNames = new Set(); // защита от дублей внутри одной генерации

    for (const filename of result.generated) {
      maxId++;
      const baseName = path.basename(filename);

      // Пропускаем дубли (один и тот же файл не может быть два раза)
      if (seenNames.has(baseName)) continue;
      seenNames.add(baseName);
      // Хеш содержимого файла для сравнения
      let fileHash = '';
      try {
        const buf = fs.readFileSync(filename);
        fileHash = crypto.createHash('md5').update(buf).digest('hex');
      } catch(e) {}

      const oldDoc = oldDocMap[baseName];
      let status = 'ok';
      let changeType = 'added';

      if (oldDoc) {
        if (oldDoc.file_hash && oldDoc.file_hash === fileHash) {
          changeType = 'unchanged';
        } else {
          changeType = 'updated';
        }
      }

      if (changeType === 'unchanged') report.unchanged.push(baseName);
      else if (changeType === 'updated') report.updated.push(baseName);
      else report.added.push(baseName);

      // Определяем модуль по папке файла
      const filePath = filename.replace(/\\/g, '/');
      const docModule = filePath.includes('Персональные данные') ? 'PD' : 'OT';
      const npaText   = docModule === 'PD'
        ? 'ФЗ-152 от 27.07.2006, ФЗ-266 от 14.07.2022, ПП РФ №1119'
        : 'ТК РФ, Постановление Правительства №2464';

      db.get('documents').push({
        id:          maxId,
        client_id:   clientId,
        module:      docModule,
        name:        baseName,
        filename:    baseName,
        filepath:    filename,
        file_hash:   fileHash,
        client_hash: clientHash,
        status:      'ok',
        created_at:  oldDoc?.created_at || new Date().toISOString(),
        updated_at:  new Date().toISOString(),
        npa_basis:   npaText,
        notes:       '',
      }).write();
    }

    return {
      ok:           true,
      generated:    result.generated,
      errors:       result.errors,
      dir:          outputDir,
      report: {
        ...report,
        userModified: result.report?.userModified || [],
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
ipcMain.handle('ai:request', async (_, { prompt, system }) => {
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

// Генерация ключа: SECRET + тип + дата + ID машины
function generateMachineKey(type, expireDate, machineId) {
  const crypto = require('crypto');
  const raw = LICENSE_SECRET + ':' + type + ':' + expireDate + ':' + machineId;
  return 'KP-' + crypto.createHash('sha256').update(raw).digest('hex').substring(0, 24).toUpperCase();
}

function checkTrial(db) {
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
      return { status: 'licensed', daysLeft, machineId };
    }
    return { status: 'licensed', daysLeft: null, machineId };
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
      license_modules: 'OT,PD,VU',
      trial_status:    'licensed',
    }).write();
    return { ok: true };
  }

  // Проверяем ключ с привязкой к машине
  for (const t of ['OUTSOURCE', 'SOLO']) {
    const expected = generateMachineKey(t, expireDate, machineId);
    if (key.trim().toUpperCase() === expected) {
      db.get('settings').assign({
        license_key:     key.trim().toUpperCase(),
        license_expires: expireDate,
        license_machine: machineId,
        license_type:    t,
        license_modules: 'OT,PD,VU',
        trial_status:    'licensed',
      }).write();
      return { ok: true, type: t };
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
    console.log(`[Updater] Доступна версия ${info.version}`);
    if (!mainWindow) return;

    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  // Новой версии нет
  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] Версия актуальна');
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
    console.log('[Updater] Обновление скачано — установка при закрытии');
    if (!mainWindow) return;
    mainWindow.webContents.send('update:downloaded');
  });

  // Ошибка обновления
  autoUpdater.on('error', (err) => {
    console.error('[Updater] Ошибка:', err.message);
  });

  // Проверяем обновления через 3 секунды после запуска
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[Updater] Не удалось проверить обновления:', err.message);
    });
  }, 3000);
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

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
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
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
