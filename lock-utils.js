'use strict';

// ══════════════════════════════════════════════════════════════════
//  lock-utils.js — простая файловая блокировка для kompliance.json
// ══════════════════════════════════════════════════════════════════
//
// ЗАЧЕМ: lowdb v1 (FileSync) пишет файл синхронно, без какой-либо
// собственной блокировки. Пока писал только один процесс (Electron-
// приложение) — это было безопасно. Как только запись в базу сможет
// делать ВТОРОЙ процесс (MCP-сервер, вызывающий generate_document_
// package при закрытом приложении) — появляется риск гонки: два
// процесса одновременно читают файл, оба пишут — итоговое состояние
// непредсказуемо, вплоть до потери данных.
//
// КАК РАБОТАЕТ: рядом с kompliance.json создаётся файл-маркер
// kompliance.json.lock с PID процесса, который его создал. Перед
// любой записью — берём блокировку (ждём, если она уже занята),
// после записи — снимаем. Если процесс упал и не снял блокировку —
// она считается "протухшей" через staleMs и снимается автоматически,
// чтобы не заблокировать работу навсегда.
//
// Это НЕ промышленный distributed lock (для двух локальных процессов
// на одной машине большего и не нужно) — просто дисциплинированная
// защита от самой частой и самой опасной ошибки: одновременной записи.
//
// РАСПОЛОЖЕНИЕ: файл живёт В КОРНЕ проекта (не в mcp-server/), написан
// на CommonJS — используется main.js напрямую через require(), а
// mcp-server/server.js (ESM, там "type": "module") подключает его через
// стандартный интероп Node (import {...} from '../lock-utils.js').

const fs = require('fs');

/**
 * Захватывает блокировку. Блокирующий (синхронный) вызов — соответствует
 * стилю остального проекта (lowdb v1 FileSync тоже синхронный).
 *
 * @param {string} dbPath — путь к kompliance.json
 * @param {object} [opts]
 * @param {number} [opts.staleMs=30000]   — через сколько мс "чужая" блокировка считается протухшей
 * @param {number} [opts.maxWaitMs=8000]  — сколько максимум ждать освобождения перед ошибкой
 * @param {number} [opts.pollMs=100]      — интервал проверки в мс
 * @returns {() => void} — функция release(), обязательно вызвать в finally
 */
function acquireLock(dbPath, opts = {}) {
  const lockPath = dbPath + '.lock';
  const staleMs = opts.staleMs ?? 30000;
  const maxWaitMs = opts.maxWaitMs ?? 8000;
  const pollMs = opts.pollMs ?? 100;

  const start = Date.now();

  for (;;) {
    if (!fs.existsSync(lockPath)) {
      try {
        fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), { flag: 'wx' });
        return () => {
          try { fs.unlinkSync(lockPath); } catch (_) { /* уже снята — не страшно */ }
        };
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
    }

    try {
      const stat = fs.statSync(lockPath);
      const age = Date.now() - stat.mtimeMs;
      if (age > staleMs) {
        try { fs.unlinkSync(lockPath); } catch (_) {}
        continue;
      }
    } catch (_) {
      continue;
    }

    if (Date.now() - start > maxWaitMs) {
      throw new Error(
        `База данных занята другим процессом дольше ${maxWaitMs} мс (${lockPath}). ` +
        `Если уверены, что другой процесс не работает с базой — удалите файл блокировки вручную.`
      );
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pollMs);
  }
}

/**
 * Удобная обёртка: захватить лок, выполнить fn, гарантированно снять лок.
 * @param {string} dbPath
 * @param {() => Promise<any> | any} fn
 * @param {object} [opts]
 */
async function withLock(dbPath, fn, opts = {}) {
  const release = acquireLock(dbPath, opts);
  try {
    return await fn();
  } finally {
    release();
  }
}

module.exports = { acquireLock, withLock };
