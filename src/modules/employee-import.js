// ─── ИМПОРТ СОТРУДНИКОВ ИЗ ФАЙЛА (1С / Excel / CSV) ──────────────────────
//
// Гибкий импорт: 1С у разных клиентов выгружает список сотрудников в разном
// порядке колонок и с разными заголовками, поэтому вместо жёсткого формата
// делаем экран ручного сопоставления "колонка файла → поле сотрудника".
// Маппинг сохраняется per-клиент (clients:save-import-mapping), чтобы при
// повторном импорте (например, ежемесячная выгрузка) не настраивать заново.

// Поля сотрудника, доступные для импорта. key — как в БД (см. validateEmployee
// и схему employees в main.js), label — что видит пользователь на экране
// мэппинга, required — обязательные поля.
const IMPORT_FIELDS = [
  { key: 'full_name',            label: 'ФИО',                         required: true },
  { key: 'position',             label: 'Должность',                   required: true },
  { key: 'department',           label: 'Подразделение (текстом)',     required: false },
  { key: 'birth_date',           label: 'Дата рождения',               required: false },
  { key: 'hired_at',             label: 'Дата приёма',                 required: false },
  { key: 'tab_number',           label: 'Табельный номер',             required: false },
  { key: 'snils',                label: 'СНИЛС',                       required: false },
  { key: 'passport_series',      label: 'Паспорт: серия',              required: false },
  { key: 'passport_number',      label: 'Паспорт: номер',              required: false },
  { key: 'passport_issued_by',   label: 'Паспорт: кем выдан',          required: false },
  { key: 'passport_issued_date', label: 'Паспорт: дата выдачи',        required: false },
];

// Эвристика для автоподстановки маппинга по заголовку колонки — экономит
// время при первом импорте, пока нет сохранённого маппинга для клиента.
const HEADER_HINTS = {
  full_name:            ['фио', 'фамилия имя отчество', 'ф.и.о'],
  position:              ['должность'],
  department:            ['подразделение', 'отдел'],
  birth_date:            ['дата рождения', 'рождения'],
  hired_at:              ['дата приема', 'дата приёма', 'принят'],
  tab_number:            ['табельный', 'таб. номер', 'таб номер'],
  snils:                 ['снилс'],
  passport_series:       ['серия паспорта', 'серия'],
  passport_number:       ['номер паспорта'],
  passport_issued_by:    ['кем выдан'],
  passport_issued_date:  ['дата выдачи'],
};

function guessFieldForHeader(header) {
  const h = String(header || '').trim().toLowerCase();
  if (!h) return '';
  for (const field of IMPORT_FIELDS) {
    const hints = HEADER_HINTS[field.key] || [];
    if (hints.some(hint => h.includes(hint))) return field.key;
  }
  return '';
}

async function importEmployeesPrompt(clientId) {
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

  const savedMapping = await window.api.clientGetImportMapping(clientId);

  await showMappingModal(clientId, headers, dataRows, savedMapping);
}

function showMappingModal(clientId, headers, dataRows, savedMapping) {
  return new Promise(resolve => {
    // Если есть сохранённый маппинг и он ссылается на существующие колонки —
    // используем его; иначе пытаемся угадать по заголовкам.
    const initialMapping = headers.map((h, colIdx) => {
      if (savedMapping && savedMapping[colIdx] !== undefined) return savedMapping[colIdx];
      return guessFieldForHeader(h);
    });

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div style="background:#161b26;border-radius:14px;padding:24px;width:560px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
        <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:6px">${ic('upload', 16)} Сопоставление колонок</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">Файл: ${headers.length} колонок, ${dataRows.length} строк. Укажите, какому полю соответствует каждая колонка.</div>
        <div id="mapping-rows" style="display:flex;flex-direction:column;gap:8px">
          ${headers.map((h, colIdx) => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;min-width:0;font-size:12px;color:#e2e8f0;background:#0f1520;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(h||'').toString()}">${h || '(без названия)'}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" style="flex-shrink:0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <select data-col="${colIdx}" class="mapping-select" style="flex:1;padding:8px 10px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
                <option value="">— Пропустить —</option>
                ${IMPORT_FIELDS.map(f => `<option value="${f.key}" ${initialMapping[colIdx] === f.key ? 'selected' : ''}>${f.label}${f.required ? ' *' : ''}</option>`).join('')}
              </select>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button id="mapping-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
          <button id="mapping-next" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Далее — предпросмотр</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#mapping-cancel').onclick = () => { modal.remove(); resolve(false); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };

    modal.querySelector('#mapping-next').onclick = async () => {
      const mapping = headers.map((_, colIdx) => {
        const sel = modal.querySelector(`.mapping-select[data-col="${colIdx}"]`);
        return sel.value || null;
      });

      const mappedKeys = mapping.filter(Boolean);
      const missingRequired = IMPORT_FIELDS.filter(f => f.required && !mappedKeys.includes(f.key));
      if (missingRequired.length) {
        showToast('Не сопоставлены обязательные поля: ' + missingRequired.map(f => f.label).join(', '));
        return;
      }

      await window.api.clientSaveImportMapping(clientId, mapping);
      modal.remove();

      const rows = dataRows.map(rawRow => {
        const obj = {};
        mapping.forEach((key, colIdx) => {
          if (key) obj[key] = (rawRow[colIdx] ?? '').toString().trim();
        });
        return obj;
      }).filter(obj => obj.full_name);

      const done = await showPreviewModal(clientId, rows);
      resolve(done);
    };
  });
}

async function showPreviewModal(clientId, rows) {
  const existing = await window.api.employeesList(clientId);

  // Помечаем строки, у которых есть совпадение по ФИО (+СНИЛС, если указан
  // в обеих сторонах) с уже существующим сотрудником — эти строки требуют
  // решения пользователя (обновить/пропустить/создать нового).
  const withMatch = rows.map(row => {
    const match = existing.find(e =>
      e.full_name?.trim().toLowerCase() === row.full_name?.trim().toLowerCase() &&
      (!row.snils || !e.snils || e.snils === row.snils)
    );
    return { row, match };
  });

  const conflicts = withMatch.filter(x => x.match);
  const fresh = withMatch.filter(x => !x.match);

  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div style="background:#161b26;border-radius:14px;padding:24px;width:560px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
        <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:6px">${ic('users', 16)} Предпросмотр импорта</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:16px">
          Новых сотрудников: <strong style="color:#4ade80">${fresh.length}</strong>
          ${conflicts.length ? ` · Совпадений с существующими: <strong style="color:#fbbf24">${conflicts.length}</strong>` : ''}
        </div>
        ${conflicts.length ? `
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button id="resolve-all-update" style="flex:1;padding:7px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:7px;color:#60a5fa;cursor:pointer;font-size:11px">Обновить все совпадения</button>
          <button id="resolve-all-skip" style="flex:1;padding:7px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#94a3b8;cursor:pointer;font-size:11px">Пропустить все совпадения</button>
        </div>
        <div id="conflict-rows" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;max-height:240px;overflow-y:auto">
          ${conflicts.map((c, i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px">
              <div style="flex:1;min-width:0;font-size:12px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.row.full_name}<div style="font-size:10.5px;color:#94a3b8">уже есть в базе</div></div>
              <select data-conflict="${i}" class="conflict-select" style="padding:6px 8px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#f1f5f9;font-size:11px;outline:none;cursor:pointer">
                <option value="update">Обновить</option>
                <option value="skip">Пропустить</option>
                <option value="create">Создать нового</option>
              </select>
            </div>`).join('')}
        </div>` : ''}
        <div style="display:flex;gap:10px">
          <button id="preview-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
          <button id="preview-import" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Импортировать</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#resolve-all-update')?.addEventListener('click', () => {
      modal.querySelectorAll('.conflict-select').forEach(sel => sel.value = 'update');
    });
    modal.querySelector('#resolve-all-skip')?.addEventListener('click', () => {
      modal.querySelectorAll('.conflict-select').forEach(sel => sel.value = 'skip');
    });

    modal.querySelector('#preview-cancel').onclick = () => { modal.remove(); resolve(false); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };

    modal.querySelector('#preview-import').onclick = async () => {
      // Собираем финальный список строк в исходном порядке withMatch и
      // карту решений по индексу — так main.js однозначно знает, что делать
      // с каждой строкой (см. employees:import в main.js).
      const finalRows = withMatch.map(x => x.row);
      const resolutions = {};
      conflicts.forEach((c, i) => {
        const sel = modal.querySelector(`.conflict-select[data-conflict="${i}"]`);
        const originalIdx = withMatch.indexOf(c);
        resolutions[originalIdx] = sel.value;
      });

      const btn = modal.querySelector('#preview-import');
      btn.innerHTML = `${ic('refresh', 14)} Импорт...`;
      btn.disabled = true;

      const result = await window.api.employeesImport(clientId, finalRows, resolutions);
      modal.remove();

      const parts = [];
      if (result.created) parts.push(`добавлено: ${result.created}`);
      if (result.updated) parts.push(`обновлено: ${result.updated}`);
      if (result.skipped) parts.push(`пропущено: ${result.skipped}`);
      if (result.errors?.length) parts.push(`ошибок: ${result.errors.length}`);
      showToast('Импорт завершён · ' + parts.join(', '));

      const updatedEmps = await window.api.employeesList(clientId);
      await window.api.clientUpdate(clientId, { staff: updatedEmps.length });
      await navigate('client', clientId);
      resolve(true);
    };
  });
}
