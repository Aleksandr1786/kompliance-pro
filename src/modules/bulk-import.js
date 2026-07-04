// ─── МАССОВЫЙ ИМПОРТ СОТРУДНИКОВ ПО НЕСКОЛЬКИМ ОРГАНИЗАЦИЯМ ──────────────
//
// В отличие от обычного импорта (employee-import.js, который работает
// внутри карточки одного клиента), этот модуль запускается из общего
// списка клиентов и разбирает файл, где вперемешку идут сотрудники
// РАЗНЫХ организаций (например, 23 региона Газпром АЗС в одном файле).
//
// Логика сопоставления масштабируется под размер задачи:
//   ≤3 организации в файле  → интерактивный выбор клиента на каждую
//   >3 организаций          → автоматическое сопоставление по названию
//                              (точное совпадение без учёта регистра),
//                              иначе создаётся новый клиент; в конце —
//                              подробный отчёт для проверки постфактум
//
// Подразделения внутри каждой организации всегда резолвятся автоматически
// (без модалки на каждую) — при большом количестве организаций показывать
// ещё и окно подразделений на каждую было бы уже неюзабельно. Ошибки
// сопоставления (опечатки и т.п.) видны в итоговом отчёте и правятся
// вручную за секунды, как и в обычном импорте.

const BULK_ORG_FIELD = { key: 'organization', label: 'Организация / Юрлицо', required: true };

async function importEmployeesBulkPrompt() {
  const filePath = await window.api.employeesPickImportFile();
  if (!filePath) return;

  const fileResult = await window.api.employeesReadImportFile(filePath);
  if (fileResult.error) {
    showToast(fileResult.error);
    return;
  }
  const allRows = (fileResult.rows || []).filter(r => r.some(cell => String(cell).trim() !== ''));
  if (allRows.length < 2) {
    showToast('В файле не найдено строк с данными');
    return;
  }

  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  const proceedRows = await showBulkMappingModal(headers, dataRows);
  if (!proceedRows) return;

  await resolveOrganizationsAndImport(proceedRows);
}

// ─── Шаг 1: мэппинг колонок (как в обычном импорте + обязательная колонка
// «Организация») ───────────────────────────────────────────────────────
function showBulkMappingModal(headers, dataRows) {
  const fields = [BULK_ORG_FIELD, ...IMPORT_FIELDS];

  return new Promise(resolve => {
    const initialMapping = headers.map(h => {
      const h_ = String(h || '').trim().toLowerCase();
      if (['организация', 'юрлицо', 'клиент', 'компания', 'точка'].some(hint => h_.includes(hint))) return 'organization';
      return guessFieldForHeader(h);
    });

    const matchedCount = initialMapping.filter(Boolean).length;
    const missingRequiredInGuess = fields.some(f => f.required && !initialMapping.includes(f.key));
    const showAiSuggestButton = window.api.aiRequest && (matchedCount < Math.ceil(headers.length / 2) || missingRequiredInGuess);

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div style="background:#161b26;border-radius:14px;padding:24px;width:560px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
        <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:6px">${ic('upload', 16)} Массовый импорт — сопоставление колонок</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Файл: ${headers.length} колонок, ${dataRows.length} строк. Обязательно укажите колонку «Организация / Юрлицо» — по ней строки распределятся по клиентам.</div>
        ${showAiSuggestButton ? `
        <div id="ai-suggest-box" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.2);border-radius:8px;margin-bottom:14px">
          <div style="font-size:11.5px;color:#c4b5fd">Часть колонок не распознана автоматически — заголовки нестандартные.</div>
          <button id="ai-suggest-btn" style="flex-shrink:0;padding:7px 12px;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.4);border-radius:7px;color:#c4b5fd;cursor:pointer;font-size:11.5px;font-weight:600;white-space:nowrap">КомплаенсПро порекомендует сопоставление</button>
        </div>` : ''}
        <div id="bulk-mapping-rows" style="display:flex;flex-direction:column;gap:8px">
          ${headers.map((h, colIdx) => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;min-width:0;font-size:12px;color:#e2e8f0;background:#0f1520;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(h||'').toString()}">${h || '(без названия)'}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" style="flex-shrink:0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <select data-col="${colIdx}" class="bulk-mapping-select" style="flex:1;padding:8px 10px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
                <option value="">— Пропустить —</option>
                ${fields.map(f => `<option value="${f.key}" ${initialMapping[colIdx] === f.key ? 'selected' : ''}>${f.label}${f.required ? ' *' : ''}</option>`).join('')}
              </select>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button id="bulk-mapping-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
          <button id="bulk-mapping-next" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Далее</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#ai-suggest-btn')?.addEventListener('click', () => requestAiColumnMapping(headers, modal, fields));

    modal.querySelector('#bulk-mapping-cancel').onclick = () => { modal.remove(); resolve(null); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };

    modal.querySelector('#bulk-mapping-next').onclick = () => {
      const mapping = headers.map((_, colIdx) => {
        const sel = modal.querySelector(`.bulk-mapping-select[data-col="${colIdx}"]`);
        return sel.value || null;
      });

      const mappedKeys = mapping.filter(Boolean);
      const missingRequired = fields.filter(f => f.required && !mappedKeys.includes(f.key));
      if (missingRequired.length) {
        showToast('Не сопоставлены обязательные поля: ' + missingRequired.map(f => f.label).join(', '));
        return;
      }

      modal.remove();

      const rows = dataRows.map(rawRow => {
        const obj = {};
        mapping.forEach((key, colIdx) => {
          if (key) obj[key] = (rawRow[colIdx] ?? '').toString().trim();
        });
        return obj;
      }).filter(obj => obj.full_name && obj.organization);

      resolve(rows);
    };
  });
}

// ─── Шаг 2: сопоставление организаций из файла с клиентами в системе ────
async function resolveOrganizationsAndImport(rows) {
  const uniqueOrgs = [...new Set(rows.map(r => r.organization).filter(Boolean))];
  const allClients = await window.api.clientsList();

  let resolution;
  if (uniqueOrgs.length <= 3) {
    resolution = await showOrgMappingModalInteractive(uniqueOrgs, allClients);
    if (!resolution) return; // отмена
  } else {
    resolution = await resolveOrgsAuto(uniqueOrgs, allClients);
  }

  await runBulkImport(rows, resolution.map, resolution.failedOrgs);
}

// Интерактивный режим (≤3 организации) — пользователь сам выбирает клиента
// на каждую, с автоподбором похожего по названию как значение по умолчанию.
function showOrgMappingModalInteractive(uniqueOrgs, allClients) {
  return new Promise(resolve => {
    const guesses = uniqueOrgs.map(org => findBestClientMatch(org, allClients));

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div style="background:#161b26;border-radius:14px;padding:24px;width:560px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
        <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:6px">${ic('building', 16)} Сопоставление организаций</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">В файле найдено ${uniqueOrgs.length} организаций. Свяжите каждую с клиентом в системе или создайте нового.</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
          ${uniqueOrgs.map((org, idx) => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;min-width:0;font-size:12px;color:#e2e8f0;background:#0f1520;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${org}">${org}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" style="flex-shrink:0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <select data-org-idx="${idx}" class="org-select" style="flex:1;padding:8px 10px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
                <option value="__create__" ${!guesses[idx] ? 'selected' : ''}>+ Создать нового клиента «${org}»</option>
                ${allClients.map(c => `<option value="${c.id}" ${guesses[idx]?.id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px">
          <button id="org-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
          <button id="org-next" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Импортировать</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#org-cancel').onclick = () => { modal.remove(); resolve(null); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };

    modal.querySelector('#org-next').onclick = async () => {
      const btn = modal.querySelector('#org-next');
      btn.textContent = 'Обработка…';
      btn.disabled = true;

      const map = {};
      const failedOrgs = [];
      for (let idx = 0; idx < uniqueOrgs.length; idx++) {
        const org = uniqueOrgs[idx];
        const sel = modal.querySelector(`.org-select[data-org-idx="${idx}"]`);
        const value = sel.value;
        if (value === '__create__') {
          const stub = await createClientStub(org);
          if (stub.error) { failedOrgs.push({ org, error: stub.error }); continue; }
          map[org] = stub.id;
        } else {
          map[org] = parseInt(value);
        }
      }
      modal.remove();
      resolve({ map, failedOrgs });
    };
  });
}

// Автоматический режим (>3 организаций) — точное совпадение по названию
// (без учёта регистра/пробелов), иначе создаём нового клиента без вопросов.
async function resolveOrgsAuto(uniqueOrgs, allClients) {
  const map = {};
  const failedOrgs = [];
  for (const org of uniqueOrgs) {
    const match = findBestClientMatch(org, allClients);
    if (match) { map[org] = match.id; continue; }
    const stub = await createClientStub(org);
    if (stub.error) { failedOrgs.push({ org, error: stub.error }); continue; }
    map[org] = stub.id;
  }
  return { map, failedOrgs };
}

// Точное совпадение названия (без учёта регистра/пробелов) — сознательно
// не делаем нечёткое сравнение (расстояние Левенштейна и т.п.), чтобы не
// склеить две разные организации с похожими названиями по ошибке. Лучше
// создать лишнего клиента и объединить вручную, чем перепутать компании.
function findBestClientMatch(orgText, allClients) {
  const norm = s => String(s || '').trim().toLowerCase().replace(/["«»]/g, '').replace(/\s+/g, ' ');
  const target = norm(orgText);
  return allClients.find(c => norm(c.name) === target) || null;
}

// Создаёт нового клиента-заглушку по названию из файла. ОКВЭД обязателен
// на бэкенде (validateClient) — подставляем плейсхолдер и явно помечаем
// таких клиентов в итоговом отчёте, чтобы donastroit карточку вручную.
// Может не получиться (лимит триала — 2 клиента, лимит тарифа «Аутсорсер»
// — 10) — в этом случае возвращаем null, а не падаем молча.
async function createClientStub(name) {
  const result = await window.api.clientAdd({
    name,
    okved: 'Требует уточнения',
    inn: '', phone: '', city: '', address: '', staff: '', region: '', form: 'ООО',
  });
  if (result?.error) return { id: null, error: result.error };
  const id = typeof result === 'object' ? result.id : result;
  return { id, error: null };
}

// ─── Шаг 3: сам импорт — группируем строки по клиенту, резолвим
// подразделения автоматически, вызываем обычный employees:import ────────
async function runBulkImport(rows, orgToClientId, failedOrgs = []) {
  const byClient = {};
  rows.forEach(row => {
    const clientId = orgToClientId[row.organization];
    if (!clientId) return;
    if (!byClient[clientId]) byClient[clientId] = [];
    byClient[clientId].push(row);
  });

  const allClients = await window.api.clientsList();
  const report = [];

  // Организации, для которых не удалось создать клиента (лимит триала/тарифа)
  // — их сотрудники НЕ импортированы, показываем явно, а не молчим об этом.
  failedOrgs.forEach(({ org, error }) => {
    const count = rows.filter(r => r.organization === org).length;
    report.push({ clientName: org, wasCreated: false, failed: true, error, created: 0, updated: 0, skipped: count, divisionsCreated: 0, errors: 0 });
  });

  for (const clientIdStr of Object.keys(byClient)) {
    const clientId = parseInt(clientIdStr);
    const clientRows = byClient[clientIdStr];
    const clientMeta = allClients.find(c => c.id === clientId);
    const wasCreated = clientMeta?.okved === 'Требует уточнения';

    // Подразделения — автоматическое сопоставление (без модалки), см.
    // комментарий в шапке файла про причину.
    const divisionsCreated = await resolveDivisionsAutoForRows(clientId, clientRows);

    const result = await window.api.employeesImport(clientId, clientRows, undefined);

    // Синхронизируем счётчик «N чел.» на карточке клиента — это отдельное
    // сохранённое поле (client.staff), не живой подсчёт, поэтому без этого
    // шага новые/обновлённые клиенты показывали бы 0 сотрудников в списке,
    // даже если сотрудники реально были импортированы (как и в обычном
    // одноклиентском импорте — см. employee-import.js showPreviewModal).
    const updatedEmps = await window.api.employeesList(clientId);
    await window.api.clientUpdate(clientId, { staff: updatedEmps.length });

    report.push({
      clientName: clientMeta?.name || `#${clientId}`,
      wasCreated,
      divisionsCreated,
      created: result.created || 0,
      updated: result.updated || 0,
      skipped: result.skipped || 0,
      errors: result.errors?.length || 0,
    });
  }

  showBulkReportModal(report);
}

// Автоматическое сопоставление подразделений для одного клиента в рамках
// массового импорта — без интерактивного окна (см. комментарий в шапке).
async function resolveDivisionsAutoForRows(clientId, rows) {
  const uniqueDepartments = [...new Set(rows.map(r => r.department).filter(Boolean))];
  if (!uniqueDepartments.length) return 0;

  const existingDivisions = await window.api.divisionsList(clientId);
  const norm = s => String(s || '').trim().toLowerCase();
  let createdCount = 0;
  const resolvedMap = {};

  for (const dept of uniqueDepartments) {
    const match = existingDivisions.find(d => norm(d.name) === norm(dept));
    if (match) {
      resolvedMap[dept] = match.id;
    } else {
      const newId = await window.api.divisionsAdd({ client_id: clientId, name: dept });
      resolvedMap[dept] = newId;
      existingDivisions.push({ id: newId, name: dept }); // чтобы не создать дубль повторно в этом же проходе
      createdCount++;
    }
  }

  rows.forEach(row => {
    if (row.department && resolvedMap[row.department] !== undefined) {
      row.division_id = resolvedMap[row.department];
    }
  });

  return createdCount;
}

// ─── Итоговый отчёт по всем организациям ─────────────────────────────────
function showBulkReportModal(report) {
  const totalCreated = report.reduce((s, r) => s + r.created, 0);
  const totalUpdated = report.reduce((s, r) => s + r.updated, 0);
  const totalNewClients = report.filter(r => r.wasCreated).length;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#161b26;border-radius:14px;padding:24px;width:560px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:6px">${ic('check-circle', 16)} Массовый импорт завершён</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:16px">
        Организаций: <strong style="color:#e2e8f0">${report.length}</strong> ·
        Добавлено: <strong style="color:#4ade80">${totalCreated}</strong> ·
        Обновлено: <strong style="color:#60a5fa">${totalUpdated}</strong>
        ${totalNewClients ? ` · Новых клиентов: <strong style="color:#fbbf24">${totalNewClients}</strong>` : ''}
      </div>
      ${totalNewClients ? `
      <div style="padding:10px 14px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;margin-bottom:14px;font-size:11.5px;color:#fbbf24">
        У новых клиентов ОКВЭД проставлен как «Требует уточнения» — донастройте карточки вручную (ОКВЭД, ИНН, адрес и т.д.).
      </div>` : ''}
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;max-height:320px;overflow-y:auto">
        ${report.map(r => `
          <div style="padding:10px 12px;background:${r.failed ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.02)'};border:1px solid ${r.failed ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)'};border-radius:8px">
            <div style="font-size:12.5px;font-weight:600;color:#e2e8f0">${r.clientName}${r.wasCreated ? ' <span style="font-size:10px;font-weight:400;color:#fbbf24">(новый клиент)</span>' : ''}</div>
            ${r.failed
              ? `<div style="font-size:11px;color:#f87171;margin-top:3px">Не удалось создать клиента: ${r.error} · сотрудники (${r.skipped}) не импортированы</div>`
              : `<div style="font-size:11px;color:#94a3b8;margin-top:3px">
              добавлено: ${r.created} · обновлено: ${r.updated}${r.skipped ? ` · пропущено: ${r.skipped}` : ''}${r.divisionsCreated ? ` · создано подразделений: ${r.divisionsCreated}` : ''}${r.errors ? ` · <span style="color:#f87171">ошибок: ${r.errors}</span>` : ''}
            </div>`}
          </div>`).join('')}
      </div>
      <button id="bulk-report-close" style="width:100%;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Готово</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#bulk-report-close').onclick = async () => {
    modal.remove();
    await navigate('clients');
  };
}
