'use strict';

// ══════════════════════════════════════════════════════════════════
//  mcp-write-bridge.js — единственная точка входа, откуда MCP-сервер
//  может ИЗМЕНИТЬ kompliance.json (запустить генерацию документов).
// ══════════════════════════════════════════════════════════════════
//
// ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ (не прямо в server.js): server.js — ESM
// ("type": "module" в mcp-server/package.json), а lowdb v1 — пакет в
// стиле CommonJS. Проще и надёжнее держать всю CommonJS-обвязку в одном
// маленьком файле в корне (там же, где main.js и doc-generation.js уже
// требуют lowdb тем же способом), чем разбираться с интеропом путей
// импорта пакета внутри ESM-файла. server.js подключает этот мост через
// динамический import() — Node сам разворачивает CommonJS-экспорты.
//
// ЧТО ДЕЛАЕТ generateForClient():
//   1. Повторно проверяет settings.mcp_enabled — на случай, если флаг
//      выключили ПОКА MCP-сервер уже был запущен (стартовая проверка в
//      server.js не защищает от этого сценария).
//   2. Требует настроенный settings.backup_path — без него отказывает,
//      а не генерирует "на удачу". Резервная копия обязательна ПЕРЕД
//      записью, не после.
//   3. Берёт файловую блокировку (lock-utils.js) на время всей операции.
//   4. Вызывает generateDocsForClient() — тот же код, что и кнопка
//      "Сформировать пакет" в интерфейсе.

const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const { withLock } = require('./lock-utils.js');
const { generateDocsForClient } = require('./doc-generation.js');

function backupNow(dbPath, backupDir) {
  if (!backupDir) {
    throw new Error(
      'Резервное копирование не настроено (settings.backup_path пуст). ' +
      'Настройте папку для бэкапов в приложении — это обязательное условие ' +
      'для генерации документов через MCP без присмотра.'
    );
  }
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Папка для резервных копий не найдена: ${backupDir}`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `kompliance_backup_mcp_${stamp}.json`);
  fs.copyFileSync(dbPath, dest);
  return dest;
}

/**
 * @param {string} dbPath — путь к kompliance.json
 * @param {number|string} clientId
 * @param {string} [scope='ALL'] — 'ALL' | 'OT' | 'PD' | 'VU'
 * @returns {Promise<object>} — то же, что возвращает generateDocsForClient,
 *   плюс backupPath.
 */
async function generateForClient(dbPath, clientId, scope = 'ALL') {
  return withLock(dbPath, async () => {
    const adapter = new FileSync(dbPath);
    const db = low(adapter);
    const settings = db.get('settings').value() || {};

    if (settings.mcp_enabled !== '1') {
      throw new Error('settings.mcp_enabled выключен — генерация через MCP запрещена.');
    }

    // Валидация scope — до бэкапа, чтобы опечатка в вызове MCP-агента не
    // тратила бэкап впустую (см. также проверку клиента ниже).
    const ALLOWED_SCOPES = ['ALL', 'OT', 'PD', 'VU'];
    if (!ALLOWED_SCOPES.includes(scope)) {
      throw new Error(`Некорректный scope: "${scope}". Допустимые значения: ${ALLOWED_SCOPES.join(', ')}.`);
    }

    // Проверка существования клиента — mcp-write-bridge.js исторически не
    // имел этой проверки, хотя параллельный путь того же действия из
    // интерфейса (main.js, ipcMain.handle('docs:generate', ...)) её
    // всегда делал. Без неё несуществующий clientId от MCP-агента сначала
    // тратил бы бэкап впустую, а понятная ошибка появлялась бы только
    // изнутри generateDocsForClient. Восстановлено 14.07.2026 для
    // паритета с main.js.
    const client = db.get('clients').find({ id: clientId }).value();
    if (!client) {
      throw new Error(`Клиент с id="${clientId}" не найден.`);
    }

    const backupPath = backupNow(dbPath, settings.backup_path);

    const result = await generateDocsForClient({ db, clientId, scope, settings });
    return { ...result, backupPath };
  });
}

module.exports = { generateForClient };
