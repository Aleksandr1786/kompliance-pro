const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { generatePackage } = require('./generator');
const path = require('path');
const fs = require('fs');

// ─── База данных на JSON (не требует компиляции) ──────────
const low    = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

let db;

function initDB() {
  const dbPath = path.join(app.getPath('userData'), 'kompliance.json');
  const adapter = new FileSync(dbPath);
  db = low(adapter);
  db.defaults({
    clients: [],
    employees: [],
    documents: [],
    events: [],
    tasks: [],
    settings: {
      user_name: 'Александр Свинцов',
      user_position: 'Специалист по охране труда',
      user_phone: '[скрыто]',
      user_email: '[скрыто]',
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
    }
  }).write();
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

ipcMain.handle('employees:add', (_, data) => {
  const id = nextId('employees');
  db.get('employees').push({ ...data, id }).write();
  return { id };
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

ipcMain.handle('open-external', (_, url) => shell.openExternal(url));


// ─── ГЕНЕРАЦИЯ ДОКУМЕНТОВ ────────────────────────────────────
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
  const clientWithEmployees = {
    ...client,
    employees: employees.map(e => ({
      full_name: e.full_name || '',
      position:  e.position  || '',
      dative:    e.dative    || '',
    })),
  };

  try {
    const result = await generatePackage(clientWithEmployees, settings, outputDir);

    // Сбрасываем старые документы клиента и записываем свежие
    db.get('documents').remove({ client_id: clientId }).write();
    let maxId = Math.max(0, ...db.get('documents').value().map(d => d.id));
    for (const filename of result.generated) {
      maxId++;
      db.get('documents').push({
        id:         maxId,
        client_id:  clientId,
        module:     'OT',
        name:       path.basename(filename), // только имя файла без пути
        filename:   path.basename(filename),
        filepath:   filename, // генератор теперь возвращает полный путь
        status:     'ok',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        npa_basis:  'ТК РФ, Постановление Правительства №2464',
        notes:      '',
      }).write();
    }

    return { ok: true, generated: result.generated, errors: result.errors, dir: outputDir };
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

// ─── ОКНО ────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
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
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  initDB();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
