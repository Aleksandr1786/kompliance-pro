'use strict';
// КомплаенсПро utils.js — общие утилиты генератора

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

/**
 * Определяет нужно ли перезаписывать файл при генерации.
 *
 * true  = перезаписать
 *   - файла нет на диске (первая генерация)
 *   - файл не изменялся пользователем
 *   - данные клиента изменились (новый сотрудник, адрес и т.д.)
 *
 * false = НЕ трогать (сохранить правки пользователя)
 *   - пользователь изменил файл И данные клиента те же
 */
function shouldOverwrite(basename, diskHashMap, currentClientHash) {
  const info = diskHashMap && diskHashMap[basename];
  if (!info) return true;                                  // файла нет → создать
  if (info.diskHash === info.storedFileHash) return true;  // не изменялся → перезаписать
  if (info.storedClientHash !== currentClientHash) return true; // данные изменились → перезаписать
  return false; // файл изменён пользователем, данные те же → НЕ трогать
}

/**
 * Создаёт runner для генерации документов с умной перезаписью.
 * Генерирует во временную папку, затем копирует в финальную только если нужно.
 *
 * @param {object} c           — нормализованный клиент
 * @param {object} s           — settings (содержит diskHashMap, currentClientHash)
 * @param {string} outputDir   — корневая папка документов клиента
 * @param {string} tmpRoot     — временная папка для генерации
 * @param {array}  generated   — массив сгенерированных путей (мутируется)
 * @param {array}  errors      — массив ошибок (мутируется)
 * @param {object} report      — отчёт об изменениях (мутируется)
 */
function makeRunner(c, s, outputDir, tmpRoot, generated, errors, report) {
  return async function run(fn, finalDir) {
    const relPath = path.relative(outputDir, finalDir);
    const tmpDir  = relPath ? path.join(tmpRoot, relPath) : tmpRoot;
    fs.mkdirSync(tmpDir, {recursive: true});

    try {
      const result = await fn(c, s, tmpDir);
      const files  = Array.isArray(result) ? result : [result];

      for (const tmpFile of files) {
        const basename  = path.basename(tmpFile);
        const finalFile = path.join(finalDir, basename);

        if (shouldOverwrite(basename, s.diskHashMap, s.currentClientHash)) {
          fs.copyFileSync(tmpFile, finalFile);
          generated.push(finalFile);
        } else {
          // Правки пользователя сохраняем — финальный файл уже существует
          generated.push(finalFile);
          if (!report.userModified) report.userModified = [];
          report.userModified.push(basename);
        }

        try { fs.unlinkSync(tmpFile); } catch(e) {}
      }
    } catch(e) {
      errors.push(fn.name + ': ' + e.message);
    }
  };
}

/**
 * Считает MD5-хэш файла на диске.
 * Возвращает пустую строку если файл не существует или недоступен.
 */
function fileHash(filepath) {
  try {
    const buf = fs.readFileSync(filepath);
    return crypto.createHash('md5').update(buf).digest('hex');
  } catch(e) {
    return '';
  }
}

/**
 * Собирает карту хэшей файлов на диске из записей БД.
 * Используется в main.js перед вызовом generatePackage.
 *
 * @param {array} oldDocs — документы клиента из БД
 * @returns {object} diskHashMap — { baseName: { diskHash, storedFileHash, storedClientHash } }
 */
function buildDiskHashMap(oldDocs) {
  const map = {};
  for (const d of oldDocs) {
    if (!d.filepath) continue;
    try {
      if (fs.existsSync(d.filepath)) {
        map[d.name] = {
          diskHash:         fileHash(d.filepath),
          storedFileHash:   d.file_hash   || '',
          storedClientHash: d.client_hash || '',
        };
      }
    } catch(e) {}
  }
  return map;
}

/**
 * Защита от undefined/null/пустых строк в документах.
 * Использовать во всех генераторах вместо прямого обращения к полям клиента.
 *
 * @param {*}      value    — значение поля (может быть undefined, null, '')
 * @param {string} fallback — заглушка по умолчанию (по умолчанию '—')
 * @returns {string}
 *
 * @example
 * safe(client.name)            // 'ООО Ромашка' или '—'
 * safe(client.inn, 'б/н')      // '1234567890' или 'б/н'
 * safe(employee.position)      // 'Директор' или '—'
 */
function safe(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).trim() || fallback;
}

module.exports = { shouldOverwrite, makeRunner, fileHash, buildDiskHashMap, safe };
