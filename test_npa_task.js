// test_npa_task.js — диагностический скрипт для проверки пункта 3 «Самого срочного»:
// показывает ли заголовок автозадачи конкретные документы из relatedDocs вместо
// общей фразы. НЕ меняет логику приложения — только добавляет ОДНУ тестовую
// задачу в реальную базу (с явной пометкой [ТЕСТ]) тестовым клиентам id 1 и 2.
//
// КАК ЗАПУСТИТЬ:
//   1. Закрой приложение КомплаенсПро (если открыто) — иначе возможен конфликт
//      доступа к файлу базы.
//   2. Открой консоль (cmd/PowerShell) в папке проекта (там же, где main.js).
//   3. Команда: node test_npa_task.js
//   4. Открой приложение → карточка ИП Свинцова и/или ООО «Абилон» → Задачи.
//   5. Проверь, что заголовок выглядит так:
//      «Изменился Приказ Минтруда № 398н — аптечки первой помощи —
//       Обновите: Приказ об обеспечении аптечками первой помощи,
//       Инструкция о порядке использования аптечки.»
//   6. После проверки — удали тестовую задачу вручную через интерфейс
//      (это обычная задача, удаляется как любая другая).

const fs = require('fs');
const path = require('path');
const os = require('os');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

function findDbPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  if (!fs.existsSync(appData)) return null;
  const dirs = fs.readdirSync(appData);
  for (const d of dirs) {
    const candidate = path.join(appData, d, 'kompliance.json');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const dbPath = findDbPath();
if (!dbPath) {
  console.error('Не нашёл kompliance.json автоматически в %APPDATA%.');
  console.error('Открой файл скрипта и впиши путь вручную в переменную dbPath ниже этой строки, затем запусти снова.');
  process.exit(1);
}
console.log('Найдена база:', dbPath);

// Бэкап перед изменением — на случай если что-то пойдёт не так
const backupPath = dbPath + '.before_test_' + Date.now();
fs.copyFileSync(dbPath, backupPath);
console.log('Сделан бэкап:', backupPath);

const adapter = new FileSync(dbPath);
const db = low(adapter);

function nextId(collection) {
  const items = db.get(collection).value();
  if (!items.length) return 1;
  return Math.max(...items.map(i => i.id)) + 1;
}
function now() { return new Date().toISOString(); }

// Точная копия записи №398н из NPA_WATCHLIST в main.js (строки 771-772 на момент теста)
const watch = {
  module: 'ot', code: '398н', label: 'Приказ Минтруда № 398н — аптечки первой помощи',
  relatedDocs: ['Приказ об обеспечении аптечками первой помощи', 'Инструкция о порядке использования аптечки'],
};
// Фейковый уникальный номер находки — чтобы скрипт можно было запускать
// повторно и не путать с реальными записями мониторинга
const item = { eoNumber: 'TEST-398n-' + Date.now() };
const aiSummary = '[ТЕСТ] Тестовое ИИ-объяснение для проверки формата задачи — не реальное изменение закона.';

const TEST_CLIENT_IDS = [1, 2]; // ИП Свинцова, ООО «Абилон»
const MODULE_LABELS = { ot: 'охране труда', pd: 'персональным данным', vu: 'воинскому учёту' };
const moduleCode = (watch.module || 'ot').toUpperCase();

const clients = db.get('clients').value();
const targets = clients.filter(c => {
  if (!TEST_CLIENT_IDS.includes(c.id)) return false;
  if (c.archived) return false;
  const mods = (c.modules || '').split(',').map(m => m.trim());
  return mods.includes(moduleCode);
});

if (!targets.length) {
  console.log('Ни один из тестовых клиентов (id 1, 2) не подключён к модулю ОТ — нечего проверять.');
  process.exit(0);
}

const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const docs = watch.relatedDocs;
const docsText = `Обновите: ${docs.join(', ')}.`;

for (const c of targets) {
  db.get('tasks').push({
    id: nextId('tasks'),
    title: `Изменился ${watch.label} — ${docsText}`,
    client_id: c.id,
    module: moduleCode, // 'OT' — без этого dashboard.js не покажет подсказку с названием вкладки
    priority: 'urgent',
    due_date: dueDate,
    done: 0,
    source: 'npa',
    npa_summary: aiSummary,
    npa_eoNumber: item.eoNumber,
    npa_related_docs: docs,
    created_at: now(),
  }).write();
  console.log(`Создана тестовая задача для клиента "${c.name}" (id ${c.id})`);
}

console.log('\nГотово. Открой приложение → карточка клиента → Задачи и проверь заголовок.');
console.log('После проверки удали тестовую задачу вручную через интерфейс приложения.');
console.log(`Если нужно откатить базу полностью — восстанови файл из бэкапа: ${backupPath}`);
