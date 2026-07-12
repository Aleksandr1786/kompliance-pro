'use strict';

// ══════════════════════════════════════════════════════════════════
//  doc-generation.js — генерация пакета документов клиента
// ══════════════════════════════════════════════════════════════════
//
// Это логика, ранее жившая ТОЛЬКО внутри ipcMain.handle('docs:generate',
// ...) в main.js. Вынесена сюда один в один (алгоритм не менялся), чтобы
// ей мог пользоваться и main.js (через IPC, как раньше), и MCP-сервер
// (напрямую, без Electron) — БЕЗ дублирования кода в двух местах.
//
// ВАЖНОЕ ОТЛИЧИЕ ОТ ОРИГИНАЛА: не читает глобальную переменную `db` и не
// использует Electron API (`app.getPath`) — всё нужное передаётся
// параметрами. main.js при вызове передаёт свои db/settings как раньше;
// MCP-сервер передаёт свои (открытые отдельно через lowdb).
//
// ЭТА ФУНКЦИЯ САМА НЕ БЕРЁТ БЛОКИРОВКУ (lock-utils.js) — ответственность
// вызывающего кода обернуть вызов в withLock(), чтобы два процесса не
// писали в базу одновременно. main.js и mcp-server/server.js оба это
// делают на своей стороне.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Корень папки с документами клиентов. Повторяет логику оригинального
 * getOutputRoot() из main.js, но без app.getPath (Electron) — везде,
 * где оригинал падал на app.getPath('userData')/app.getPath('desktop'),
 * здесь используется обычный путь профиля пользователя Windows.
 */
function getOutputRoot() {
  const base =
    process.env.LOCALAPPDATA ||
    path.join(os.homedir(), 'AppData', 'Local'); // эквивалент app.getPath('userData') без Electron
  return path.join(base, 'КомплаенсПро', 'Документы');
}

/**
 * Генерирует пакет документов для клиента и обновляет реестр документов
 * в базе — идентично поведению исходного ipcMain.handle('docs:generate').
 *
 * @param {object} params
 * @param {object} params.db — открытый lowdb-инстанс (та же структура,
 *   что в main.js: db.get('clients')/'employees'/'documents'/'divisions').
 * @param {number|string} params.clientId
 * @param {string} [params.scope='ALL'] — 'ALL' | 'OT' | 'PD' | 'VU'
 * @param {object} params.settings — db.get('settings').value()
 * @param {string} [params.generatorPath] — путь к generator.js (по
 *   умолчанию — рядом с этим файлом, как в main.js)
 * @param {string} [params.utilsPath] — путь к utils.js
 * @param {string} [params.docMetaPath] — путь к doc-meta.js
 * @param {string} [params.sectionsPath] — путь к sections.js
 * @returns {Promise<{ok:boolean, generated?:string[], errors?:string[], dir?:string, report?:object, error?:string}>}
 */
async function generateDocsForClient({
  db,
  clientId,
  scope = 'ALL',
  settings,
  generatorPath,
  utilsPath,
  docMetaPath,
  sectionsPath,
}) {
  let client = db.get('clients').find({ id: clientId }).value();
  if (!client) return { ok: false, error: 'Клиент не найден' };

  // Фиксируем дату документов один раз — при первом формировании (см.
  // оригинальный комментарий в main.js: без этого doc_date каждый день
  // фоллбэчился бы на «сегодня», и тексты документов менялись бы
  // ежедневно без причины в доказательной базе).
  if (!client.doc_date) {
    const fixedDate = new Date().toLocaleDateString('ru-RU');
    db.get('clients').find({ id: clientId }).assign({ doc_date: fixedDate }).write();
    client = db.get('clients').find({ id: clientId }).value();
  }

  // Папка клиента: <корень документов> / Название организации
  const rootDir = getOutputRoot();
  const safeName = (client.name || 'Клиент').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60).replace(/[ .]+$/, '') || 'Клиент';
  const outputDir = path.join(rootDir, safeName);
  fs.mkdirSync(outputDir, { recursive: true });

  const employees = db.get('employees').filter({ client_id: clientId }).value();

  // Хеш данных клиента для умной генерации
  const clientHash = crypto.createHash('md5')
    .update(JSON.stringify({ ...client, employees }))
    .digest('hex');

  const divisions = db.get('divisions').filter({ client_id: clientId }).value();

  const clientWithEmployees = {
    ...client,
    city: (client.city || client.region || '').replace(/^г\.?\s*/i, '').trim() || '',
    soat_class: client.soat_class || '2',
    hazard_works: client.hazard_works || 0,
    medcheck_required: client.medcheck_required || 0,
    ot_name: client.ot_name || client.manager_name || '',
    ot_position: client.ot_position || client.manager_position || '',
    ot_name_full: client.ot_name_full || client.ot_name || client.manager_name || '',
    divisions,
    employees: employees.map((e) => ({
      full_name: e.full_name || '',
      position: e.position || '',
      name_gen: e.name_gen || '',
      name_dat: e.name_dat || '',
      name_acc: e.name_acc || '',
      name_ins: e.name_ins || '',
      name_short: e.name_short || '',
      birth_date: e.birth_date || '',
      hired_at: e.hired_at || '',
      tab_number: e.tab_number || '',
      gender: e.gender || 'm',
      is_military: e.is_military || 0,
      division_id: e.division_id || null,
      chop: e.chop || null,
    })),
  };

  const oldDocs = db.get('documents').filter({ client_id: clientId }).value();
  const oldDocMap = {};
  oldDocs.forEach((d) => { oldDocMap[d.name] = d; });

  const { buildDiskHashMap, getDocYear, docContentHash, diffClientFields, snapshotClientFields } =
    require(utilsPath || './utils');
  const diskHashMap = buildDiskHashMap(oldDocs);

  const DOC_META = require(docMetaPath || './doc-meta');
  const { generatePackage } = require(generatorPath || './generator');
  const { sectionByFolder, sectionOf } = require(sectionsPath || './sections');

  try {
    const result = await generatePackage(
      clientWithEmployees,
      { ...settings, diskHashMap, currentClientHash: clientHash },
      outputDir,
      scope
    );

    const isAccumulatingDoc = (name) => /^Акт об уничтожении персональных данных от .+\.docx$/.test(name);

    if (scope === 'ALL') {
      db.get('documents').remove((d) => d.client_id === clientId && !isAccumulatingDoc(d.name)).write();
    } else {
      db.get('documents').remove((d) => d.client_id === clientId && d.module === scope && !isAccumulatingDoc(d.name)).write();
    }
    let maxId = Math.max(0, ...db.get('documents').value().map((d) => d.id), 0);

    // Дедупликация реестра по (client_id, name)
    {
      const seen = new Set();
      const toRemoveIds = [];
      for (const d of db.get('documents').value()
        .filter((x) => x.client_id === clientId)
        .sort((a, b) => b.id - a.id)) {
        const key = d.name;
        if (seen.has(key)) toRemoveIds.push(d.id);
        else seen.add(key);
      }
      if (toRemoveIds.length) {
        db.get('documents').remove((d) => toRemoveIds.includes(d.id)).write();
      }
    }

    const report = { updated: [], added: [], unchanged: [] };
    const seenNames = new Set();
    const touchedModules = new Set();

    for (const filename of result.generated) {
      maxId++;
      const baseName = path.basename(filename);

      if (seenNames.has(baseName)) continue;
      seenNames.add(baseName);

      let fileHash = '';
      try {
        const buf = fs.readFileSync(filename);
        fileHash = crypto.createHash('md5').update(buf).digest('hex');
      } catch (e) { /* см. оригинал — намеренно проглатывается */ }
      const contentHash = docContentHash(filename);

      const oldDoc = oldDocMap[baseName];
      let status = 'ok';
      let changeType = 'added';

      if (oldDoc) {
        if (oldDoc.doc_content_hash) {
          changeType = oldDoc.doc_content_hash === contentHash ? 'unchanged' : 'updated';
        } else if (oldDoc.file_hash && oldDoc.file_hash === fileHash) {
          changeType = 'unchanged';
        } else {
          changeType = 'updated';
        }
      }

      const filePath = filename.replace(/\\/g, '/');
      let docModule = 'OT';
      if (filePath.includes('Персональные данные')) docModule = 'PD';
      else if (filePath.includes('Воинский учёт')) docModule = 'VU';
      touchedModules.add(docModule);

      // Раздел документа — по факту того, в какую папку его реально записал
      // генератор (единственный надёжный источник, см. sections.js
      // sectionByFolder). Раньше раздел определялся заново по имени файла
      // через отдельный словарь FILE_SECTION — тот регулярно отставал от
      // новых генераторов, и документ в приложении оказывался не в том
      // разделе, что на диске (найдено и закрыто насовсем 12.07.2026).
      const parentFolder = path.basename(path.dirname(filename));
      const sectionMatch = sectionByFolder(docModule, parentFolder);
      const docSection = sectionMatch ? sectionMatch.id : sectionOf(docModule, baseName);

      const docMeta = DOC_META[baseName] || {};
      const newTemplateVersion = docMeta.version || 1;
      let changeReason = null;

      if (changeType === 'updated') {
        const oldTemplateVersion = (oldDoc && oldDoc.template_version) || 1;
        if (newTemplateVersion > oldTemplateVersion) {
          changeReason =
            'Обновлены требования законодательства' +
            (docMeta.npa ? ': ' + docMeta.npa : '') +
            ` (версия документа ${oldTemplateVersion} → ${newTemplateVersion})`;
        } else {
          const moduleSnapshot = client.last_gen_snapshot && client.last_gen_snapshot[docModule];
          const changedFields = diffClientFields(moduleSnapshot, clientWithEmployees);
          if (changedFields.length) {
            changeReason =
              'Изменились данные клиента: ' +
              changedFields.map((c) => `${c.label} (${c.from} → ${c.to})`).join(', ');
          }
        }
      }

      if (changeType === 'unchanged') report.unchanged.push(baseName);
      else if (changeType === 'updated') report.updated.push({ name: baseName, reason: changeReason });
      else report.added.push(baseName);

      const npaText =
        docModule === 'PD' ? 'ФЗ-152 от 27.07.2006, ФЗ-266 от 14.07.2022, ПП РФ №1119'
        : docModule === 'VU' ? 'ФЗ-53 от 28.03.1998, ПП РФ №719 от 27.11.2006'
        : 'ТК РФ, Постановление Правительства №2464';

      db.get('documents').remove((d) => d.client_id === clientId && d.name === baseName).write();

      db.get('documents').push({
        id: maxId,
        client_id: clientId,
        module: docModule,
        section: docSection,
        name: baseName,
        filename: baseName,
        filepath: filename,
        file_hash: fileHash,
        doc_content_hash: contentHash,
        client_hash: clientHash,
        doc_year: getDocYear(client),
        template_version: newTemplateVersion,
        status: 'ok',
        created_at: oldDoc?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        npa_basis: npaText,
        notes: '',
      }).write();
    }

    {
      const newSnapshot = { ...(client.last_gen_snapshot || {}) };
      const currentSnapshot = snapshotClientFields(clientWithEmployees);
      for (const m of touchedModules) newSnapshot[m] = currentSnapshot;
      db.get('clients').find({ id: clientId }).assign({ last_gen_snapshot: newSnapshot }).write();
    }

    return {
      ok: true,
      generated: result.generated,
      errors: result.errors,
      dir: outputDir,
      report: {
        ...report,
        userModified: result.report?.userModified || [],
        archived: result.report?.archived || [],
      },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { generateDocsForClient, getOutputRoot };
