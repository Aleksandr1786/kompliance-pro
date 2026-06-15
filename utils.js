'use strict';
// КомплаенсПро utils.js — общие утилиты генератора

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const zlib   = require('zlib');

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

    // Корень модуля («Охрана труда» / «Персональные данные» / «Воинский учёт») —
    // первый уровень папки внутри outputDir. Нужен для архива версионируемых документов.
    const moduleRoot = relPath
      ? path.join(outputDir, relPath.split(path.sep)[0])
      : outputDir;

    try {
      const result = await fn(c, s, tmpDir);
      const files  = Array.isArray(result) ? result : [result];

      const seenInRun = new Set();
      for (const tmpFile of files) {
        if (!tmpFile) continue;
        if (seenInRun.has(tmpFile)) continue;   // один и тот же файл не обрабатываем дважды (фикс v1.0.17)
        seenInRun.add(tmpFile);
        if (!fs.existsSync(tmpFile)) continue;  // источник не создан — пропускаем без падения (фикс v1.0.17)

        const basename  = path.basename(tmpFile);
        const finalFile = path.join(finalDir, basename);

        if (shouldOverwrite(basename, s.diskHashMap, s.currentClientHash)) {
          // Версионирование: архивируем старую версию, только если СОДЕРЖИМОЕ
          // документа реально изменилось. Сравниваем по хэшу word/document.xml
          // (docContentHash), а НЕ по байтам файла и НЕ по client_hash:
          //   - байты .docx меняются всегда (docx встраивает таймстампы) →
          //     давало архивацию при каждой перегенерации (баг с 41 файлом);
          //   - client_hash меняется при ЛЮБОЙ правке данных клиента →
          //     архивировало даже документы, которых правка не касалась
          //     (например, Акт оценки вреда при смене ответственного за ПД).
          // Хэш document.xml меняется тогда и только тогда, когда изменилось
          // видимое содержимое именно этого документа.
          if (isVersioned(basename) && fs.existsSync(finalFile)) {
            const oldContent = docContentHash(finalFile);
            const newContent = docContentHash(tmpFile);
            if (oldContent && newContent && oldContent !== newContent) {
              const info = s.diskHashMap && s.diskHashMap[basename];
              const year = (info && info.docYear) || fs.statSync(finalFile).mtime.getFullYear();
              const archivedTo = archivePreviousVersion(finalFile, moduleRoot, year);
              if (archivedTo) {
                if (!report.archived) report.archived = [];
                report.archived.push({basename, archivedTo, year});
              }
            }
          }

          fs.copyFileSync(tmpFile, finalFile);
          generated.push(finalFile);
        } else {
          // Данные те же — сохраняем правки пользователя. НО если файла нет
          // в целевой папке (например, после переноса структуры папок) —
          // всё равно создаём, иначе папка/документ просто не появятся (фикс v1.0.17).
          if (!fs.existsSync(finalFile)) fs.copyFileSync(tmpFile, finalFile);
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
 * Извлекает запись из ZIP-архива (.docx) по имени, без сторонних библиотек.
 * Использует встроенный zlib для распаковки deflate-сжатых записей.
 *
 * .docx — это ZIP-контейнер; нужное нам содержимое лежит в word/document.xml.
 * Читаем локальные заголовки записей (сигнатура PK\x03\x04) последовательно.
 *
 * @param {Buffer} buf       — содержимое .docx
 * @param {string} entryName — имя записи (например 'word/document.xml')
 * @returns {Buffer|null}
 */
function readZipEntry(buf, entryName) {
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // не локальный заголовок — конец потока записей
    const compMethod = buf.readUInt16LE(offset + 8);
    const compSize   = buf.readUInt32LE(offset + 18);
    const nameLen    = buf.readUInt16LE(offset + 26);
    const extraLen   = buf.readUInt16LE(offset + 28);
    const nameStart  = offset + 30;
    const name       = buf.toString('utf8', nameStart, nameStart + nameLen);
    const dataStart  = nameStart + nameLen + extraLen;
    const data       = buf.subarray(dataStart, dataStart + compSize);
    if (name === entryName) {
      try {
        if (compMethod === 0) return data;                      // stored (без сжатия)
        if (compMethod === 8) return zlib.inflateRawSync(data); // deflate
      } catch(e) {
        return null;
      }
      return null;
    }
    offset = dataStart + compSize;
  }
  return null;
}

/**
 * Хэш СОДЕРЖИМОГО документа .docx (word/document.xml), а НЕ байтов файла.
 *
 * Зачем: библиотека docx при каждой генерации встраивает в .docx разные
 * таймстампы (docProps/core.xml и метаданные ZIP), поэтому MD5 самого файла
 * меняется при каждой перегенерации даже без изменения данных. document.xml
 * содержит ТОЛЬКО видимое содержимое документа (текст + форматирование),
 * без таймстампов — его хэш стабилен, пока не изменились данные клиента,
 * влияющие на этот конкретный документ.
 *
 * Используется для решения об архивации: версионируем старую копию, только
 * если содержимое документа реально изменилось (а не из-за docx-таймстампов
 * и не из-за изменения данных клиента, не затрагивающих данный документ).
 *
 * @param {string} filepath — путь к .docx
 * @returns {string} MD5 содержимого, либо '' если не удалось прочитать
 */
function docContentHash(filepath) {
  try {
    const buf = fs.readFileSync(filepath);
    const xml = readZipEntry(buf, 'word/document.xml');
    if (!xml) return '';
    return crypto.createHash('md5').update(xml).digest('hex');
  } catch(e) {
    return '';
  }
}

/**
 * Собирает карту хэшей файлов на диске из записей БД.
 * Используется в main.js перед вызовом generatePackage.
 *
 * @param {array} oldDocs — документы клиента из БД
 * @returns {object} diskHashMap — { baseName: { diskHash, storedFileHash, storedClientHash, docYear } }
 */
function buildDiskHashMap(oldDocs) {
  const map = {};
  for (const d of oldDocs) {
    if (!d.filepath) continue;
    try {
      if (fs.existsSync(d.filepath)) {
        map[d.name] = {
          diskHash:         fileHash(d.filepath),
          storedFileHash:   d.file_hash    || '',
          storedClientHash: d.client_hash  || '',
          storedContentHash: d.doc_content_hash || '',
          docYear:          d.doc_year     || null,
        };
      }
    } catch(e) {}
  }
  return map;
}

// ---------------------------------------------------------------------
// Версионирование документов (доказательная база)
// ---------------------------------------------------------------------

/**
 * Whitelist версионируемых документов — единый источник правды.
 * Заполняется по результатам анализа gen_p1/p2/pd/vu.js (см. чат 9, шаг 2).
 *
 * VERSIONED_DOCUMENTS — точные имена файлов (с расширением).
 * VERSIONED_PREFIXES  — префиксы для динамических документов
 *   (например, ИОТ «для <должность>», которые генерируются по числу должностей).
 */
const VERSIONED_DOCUMENTS = new Set([
  // — ВОИНСКИЙ УЧЁТ —
  'ВУ-01 Приказ о назначении ответственного за воинский учёт.docx',
  'ВУ-02 Функциональные обязанности ответственного за воинский учёт.docx',
  'ВУ-03 План работы по осуществлению воинского учёта.docx',
  'ВУ-04 Карточка учёта организации (Форма №18).docx',
  'ВУ-09 Акт сверки с военным комиссариатом.docx',

  // — ОХРАНА ТРУДА —
  // Раздел 1: Приказы (9, из них 2 условные — медосмотры/повышенная опасность)
  'Приказ об утверждении документации по охране труда.docx',
  'Приказ о назначении ответственных лиц.docx',
  'Приказ об утверждении инструкций по охране труда.docx',
  'Приказ о назначении ответственного за СИЗ.docx',
  'Приказ об обеспечении аптечками первой помощи.docx',
  'Приказ о назначении ответственного за электрохозяйство.docx',
  'Приказ об утверждении программ обучения.docx',
  'Приказ об организации медицинских осмотров.docx',       // условный (hasMedcheck)
  'Приказ о порядке работ повышенной опасности.docx',       // условный (hasHazard)
  // Раздел 2: ЛНА — Положения/Политика (8)
  'Политика в области охраны труда.docx',
  'Положение о системе управления охраной труда.docx',
  'Положение о порядке обучения по охране труда.docx',
  'Положение об организации работы по охране труда.docx',
  'Положение о разработке инструкций по охране труда.docx',
  'Положение об учёте микротравм.docx',
  'Правила внутреннего трудового распорядка.docx',
  'Положение об обеспечении работников СИЗ.docx',
  // Раздел 3: Электробезопасность — программа (журнал и договор НЕ версионируются)
  'Программа инструктажа по электробезопасности.docx',
  // Раздел 5: Инструкции по охране труда — фиксированные (3)
  'Инструкция по охране труда при работе с ПЭВМ.docx',
  'Инструкция по охране труда при работе с копировальной техникой.docx',
  'Инструкция о порядке использования аптечки.docx',
  // Раздел 7: Программы обучения — Программа В (условная, hasHazard)
  // + три программы из generator.js (генерируются всегда, по тому же
  // принципу «программа обучения, периодическая», что и Программа В
  // и Программа инструктажа по электробезопасности; добавлены в чате 9)
  'Программа В обучение работы повышенной опасности.docx',
  'Программа вводного инструктажа по охране труда.docx',
  'Программа первичного инструктажа на рабочем месте.docx',
  'Программа противопожарного инструктажа.docx',
  // Планы/графики
  'План мероприятий по охране труда.docx',
  'График периодических мероприятий.docx',

  // — ПЕРСОНАЛЬНЫЕ ДАННЫЕ —
  // Приказы (8)
  'Приказ о назначении ответственного за ПД.docx',
  'Приказ о назначении ответственного за безопасность ПД.docx',
  'Приказ о допуске должностных лиц к ПД.docx',
  'Приказ о проведении обучения по ПД.docx',
  'Приказ о создании комиссии по уровню защищённости.docx',
  'Приказ об утверждении Политики ПД.docx',
  'Приказ об утверждении Положения о защите ПД.docx',
  'Приказ об утверждении инструкций ПД.docx',
  // Политика и Положение (2)
  'Политика об обработке персональных данных.docx',
  'Положение о защите персональных данных работников.docx',
  // Инструкции ИСПДн (6)
  'Инструкция администратора безопасности ИСПДн.docx',
  'Инструкция пользователя ИСПДн.docx',
  'Инструкция по антивирусной защите ИСПДн.docx',
  'Инструкция по парольной защите ИСПДн.docx',
  'Инструкция по резервированию и восстановлению ПДн.docx',
  'Инструкция по учёту машинных носителей ПДн.docx',
  // Планы (2)
  'План внутреннего контроля ПДн.docx',
  'План мероприятий по защите ПДн.docx',
  // Акты/протоколы оценки (3)
  'Акт определения уровня защищённости ИСПДн.docx',
  'Акт оценки вреда субъектам ПДн.docx',
  'Протокол обучения по персональным данным.docx',
  // Примечание: «Акт об уничтожении персональных данных.docx» — НЕ здесь.
  // 🟢➕ копим все акты с датой в имени, без перезаписи — отдельный механизм (шаг G).
]);

const VERSIONED_PREFIXES = [
  // Раздел 5: ИОТ для конкретной должности — динамические, генерируются
  // по числу должностей у клиента (gen_05_01 + gen_05_employees в gen_p2.js).
  'Инструкция по охране труда для ',
];

/**
 * Проверяет, входит ли документ в список версионируемых.
 * @param {string} basename — имя файла с расширением
 * @returns {boolean}
 */
function isVersioned(basename) {
  if (VERSIONED_DOCUMENTS.has(basename)) return true;
  return VERSIONED_PREFIXES.some(prefix => basename.startsWith(prefix));
}

/**
 * Архивирует предыдущую версию документа перед перезаписью.
 * Переносит существующий файл в `<корень модуля>/Архив/<год>/`.
 * Если в этой папке уже есть файл с таким именем — добавляет дату
 * (а при повторе в тот же день — порядковый номер) к имени.
 *
 * Вызывать ТОЛЬКО когда уже подтверждено, что:
 *   - документ версионируемый (isVersioned),
 *   - старый файл существует,
 *   - содержимое реально изменилось (MD5 старой ≠ новой).
 *
 * @param {string} filepath   — путь к текущему (старому) файлу на диске
 * @param {string} moduleRoot — корневая папка модуля клиента
 *                              («Охрана труда» / «Персональные данные» / «Воинский учёт»)
 * @param {number|string} year — отчётный год для папки архива
 * @returns {string|null} путь к заархивированному файлу, либо null при ошибке
 */
function archivePreviousVersion(filepath, moduleRoot, year) {
  if (!fs.existsSync(filepath)) return null;

  const archiveDir = path.join(moduleRoot, 'Архив', String(year));
  try {
    fs.mkdirSync(archiveDir, {recursive: true});
  } catch(e) {
    return null;
  }

  const ext  = path.extname(filepath);
  const base = path.basename(filepath, ext);

  let archiveName = path.basename(filepath);
  let archivePath = path.join(archiveDir, archiveName);

  if (fs.existsSync(archivePath)) {
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    archiveName = `${base} (архив от ${dateStr})${ext}`;
    archivePath = path.join(archiveDir, archiveName);

    let counter = 2;
    while (fs.existsSync(archivePath)) {
      archiveName = `${base} (архив от ${dateStr}, ${counter})${ext}`;
      archivePath = path.join(archiveDir, archiveName);
      counter++;
    }
  }

  try {
    fs.renameSync(filepath, archivePath);
    return archivePath;
  } catch(e) {
    // rename может не сработать между разными дисками — фоллбэк на copy+unlink
    try {
      fs.copyFileSync(filepath, archivePath);
      fs.unlinkSync(filepath);
      return archivePath;
    } catch(e2) {
      return null;
    }
  }
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

/**
 * Отчётный год документа — на основе client.doc_year, либо (если не задан)
 * последних 4 символов client.doc_date, либо текущего года.
 *
 * Используется при сохранении записи в db.documents (поле doc_year).
 * При следующей генерации этот год попадёт в diskHashMap.docYear и
 * archivePreviousVersion положит предыдущую версию в Архив/<этот год>/ —
 * то есть в год, ЗА КОТОРЫЙ был составлен прежний документ.
 *
 * @param {object} client — клиент (сырой из БД или нормализованный — оба подходят)
 * @returns {string}
 */
function getDocYear(client) {
  const y = safe(client && client.doc_year, '');
  if (y) return y;
  const d = safe(client && client.doc_date, '');
  if (d) {
    const parts = d.split('.');
    return parts[parts.length - 1] || String(new Date().getFullYear());
  }
  return String(new Date().getFullYear());
}

// ---------------------------------------------------------------------
// «Почему изменился документ» (доказательная база, Фаза 1)
// ---------------------------------------------------------------------

/**
 * Человекочитаемые названия полей клиента — для отчёта «почему изменился
 * документ» (причина «изменились данные клиента»).
 *
 * Ключ — имя поля в объекте клиента (как в main.js / БД db.clients).
 * Значение — подпись, которую увидит пользователь в отчёте.
 *
 * Добавление нового поля = одна строка здесь, архитектура не меняется.
 * Если в карточке появятся отдельные ответственные за ПД/ВУ — добавь их
 * сюда тем же способом (например, pd_responsible_name: 'Ответственный за ПД').
 */
const FIELD_LABELS = {
  name:              'Наименование организации',
  inn:               'ИНН',
  okved:             'ОКВЭД',
  region:            'Регион',
  city:              'Город',
  address:           'Юридический адрес',
  phone:             'Телефон',
  manager_position:  'Должность руководителя',
  manager_name:      'ФИО руководителя',
  soat_class:        'Класс условий труда (СОУТ)',
  hazard_works:      'Работы повышенной опасности',
  medcheck_required: 'Медосмотры обязательны',
  ot_position:       'Должность отв. за ОТ',
  ot_name:           'ФИО отв. за ОТ',
};

/**
 * Снимок полей клиента для client.last_gen_snapshot — только те поля,
 * что входят в FIELD_LABELS (диф остальных полей не нужен для отчёта).
 *
 * Сохраняется в БД после каждого «Сформировать пакет», чтобы при следующем
 * формировании можно было показать, ЧТО именно изменилось у клиента.
 *
 * @param {object} client — клиент (нормализованный, как clientWithEmployees)
 * @returns {object}
 */
function snapshotClientFields(client) {
  const snap = {};
  for (const key of Object.keys(FIELD_LABELS)) {
    snap[key] = (client && client[key] !== undefined) ? client[key] : '';
  }
  return snap;
}

/**
 * Сравнивает снимок прошлого формирования с текущими данными клиента.
 * Возвращает список изменённых полей с подписями и значениями «было/стало».
 *
 * Если снимка нет (client.last_gen_snapshot отсутствует — первое
 * формирование после внедрения фичи), возвращает [] — причина в этом
 * случае не подбирается, чтобы не показать ложное «не изменилось».
 *
 * @param {object|undefined} oldSnapshot — client.last_gen_snapshot
 * @param {object} client — текущий клиент (нормализованный)
 * @returns {Array<{field:string, label:string, from:string, to:string}>}
 */
function diffClientFields(oldSnapshot, client) {
  if (!oldSnapshot) return [];
  const changes = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    const oldVal = String(oldSnapshot[key] ?? '');
    const newVal = String((client && client[key]) ?? '');
    if (oldVal !== newVal) {
      changes.push({
        field: key,
        label: FIELD_LABELS[key],
        from:  oldVal || '—',
        to:    newVal || '—',
      });
    }
  }
  return changes;
}

module.exports = {
  shouldOverwrite,
  makeRunner,
  fileHash,
  docContentHash,
  buildDiskHashMap,
  safe,
  getDocYear,
  archivePreviousVersion,
  isVersioned,
  VERSIONED_DOCUMENTS,
  VERSIONED_PREFIXES,
  FIELD_LABELS,
  snapshotClientFields,
  diffClientFields,
};
