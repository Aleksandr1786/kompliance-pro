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
  { key: 'birth_date',           label: 'Дата рождения',               required: false, type: 'date' },
  { key: 'hired_at',             label: 'Дата приёма',                 required: false, type: 'date' },
  { key: 'tab_number',           label: 'Табельный номер',             required: false },
  { key: 'snils',                label: 'СНИЛС',                       required: false },
  { key: 'passport_series',      label: 'Паспорт: серия',              required: false },
  { key: 'passport_number',      label: 'Паспорт: номер',              required: false },
  { key: 'passport_issued_by',   label: 'Паспорт: кем выдан',          required: false },
  { key: 'passport_issued_date', label: 'Паспорт: дата выдачи',        required: false, type: 'date' },
];

// Эвристика для автоподстановки маппинга по заголовку колонки — экономит
// время при первом импорте, пока нет сохранённого маппинга для клиента.
const HEADER_HINTS = {
  full_name:            ['фио', 'фамилия имя отчество', 'ф.и.о', 'сотрудник'],
  position:              ['должность'],
  department:            ['подразделение', 'отдел'],
  birth_date:            ['дата рождения'],
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

// ─── НОРМАЛИЗАЦИЯ ДАТ ─────────────────────────────────────────────
//
// <input type="date"> в HTML требует значение строго в формате YYYY-MM-DD.
// 1С/Excel обычно отдают дату как "ДД.ММ.ГГГГ" (например "01.04.1988") —
// при прямой записи такой строки в поле-дату браузер её молча не
// показывает (поле выглядит пустым), хотя в базе сохраняется мусор.
// Раньше даты писались в БД как есть (rawRow.toString().trim()) без
// какой-либо нормализации — отсюда "дата рождения и дата выдачи не
// перенеслись в карточку" при том, что текстовые поля переносились.
function normalizeDateForInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  // Уже ISO (YYYY-MM-DD), в т.ч. с временем — берём только дату
  let m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  // Настоящие Excel-даты (числовой формат, а не текст) при чтении через
  // xlsx/SheetJS форматируются встроенным форматом Excel "m/d/yy" —
  // американский порядок МЕСЯЦ/ДЕНЬ/год, обычно с двузначным годом
  // (например "4/1/88" для 01.04.1988). Отличаем по разделителю "/":
  // это признак того, что дата пришла из настоящей Excel-ячейки даты,
  // а не из текстового поля 1С.
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, mo, d, yRaw] = m;
    const year = yRaw.length === 2
      ? (Number(yRaw) <= 30 ? '20' + yRaw : '19' + yRaw) // 00-30 → 2000-2030, иначе 1900-е
      : yRaw;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Текстовые поля 1С (не настоящие Excel-даты) обычно уже в привычном
  // российском формате ДД.ММ.ГГГГ — разделитель точка, день первым
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Excel иногда отдаёт дату как "серийное число" (дней с 30.12.1899) —
  // подстраховка на случай, если raw:false в читалке файла не сработал
  const num = Number(s);
  if (/^\d+$/.test(s) && num > 20000 && num < 60000) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + num * 86400000).toISOString().slice(0, 10);
  }

  // Не удалось распознать формат — не подставляем мусор в поле даты,
  // пользователь увидит пустое поле и сможет ввести дату вручную
  return '';
}

// ─── АВТООПРЕДЕЛЕНИЕ СТРОКИ ЗАГОЛОВКОВ ─────────────────────────────
//
// Выгрузки 1С почти всегда начинаются со служебной шапки отчёта — «Отбор:»,
// «Организация: ...», «Количество: ...» — и только через 5-10 строк идёт
// настоящая строка заголовков колонок. Раньше бралась жёстко allRows[0],
// из-за чего вся эта шапка принималась за заголовки, а реальные названия
// колонок терялись (все колонки уходили в "(без названия)").
//
// Ищем среди первых 20 строк ту, где больше всего ячеек похожи на
// заголовки полей (совпадают с HEADER_HINTS) — это и есть строка заголовков.
// Если ни одна строка не набрала совпадений (нестандартный файл без
// узнаваемых названий) — откатываемся к старому поведению (первая строка),
// чтобы не сломать уже работающие сценарии импорта.
function detectHeaderRowIndex(allRows) {
  const SEARCH_LIMIT = Math.min(allRows.length, 20);
  let bestIndex = 0;
  let bestScore = 0;

  for (let i = 0; i < SEARCH_LIMIT; i++) {
    const row = allRows[i];
    const score = row.reduce((acc, cell) => acc + (guessFieldForHeader(cell) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  // Требуем минимум 2 узнанных поля — одно случайное совпадение
  // (например, ячейка "Отдел кадров" в служебной шапке) не должно сбивать
  return bestScore >= 2 ? bestIndex : 0;
}

// Похоже ли значение на ФИО ("Фамилия Имя Отчество", 2-3 слова с большой
// буквы)? Нужно, чтобы отличить настоящую строку данных от второй строки
// двухуровневого заголовка (например "Вид"/"Серия"/"Номер" под общей
// группой "Удостоверение личности") — короткие подписи колонок на это
// не похожи, а реальное ФИО сотрудника — похоже.
function looksLikeFullName(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  const parts = s.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every(p => /^[А-ЯЁ][а-яёA-Za-z\-]+$/.test(p));
}

// ─── ДВУХУРОВНЕВЫЕ ЗАГОЛОВКИ (объединённые ячейки Excel) ───────────
//
// 1С нередко выгружает "составные" заголовки: группа на одной строке
// (например "Удостоверение личности"), а конкретные подполя (Вид/Серия/
// Номер/Дата выдачи/Кем выдано) — строкой ниже. При чтении через
// sheet_to_json такая объединённая ячейка отдаёт текст только в верхней
// левой ячейке диапазона — соседние клетки приходят пустыми. Если этого
// не учесть, вторая строка заголовков будет ошибочно принята за первую
// строку ДАННЫХ сотрудника.
//
// Определяем: если строка сразу после найденной строки заголовков не
// похожа на данные (нет ФИО-подобного значения в колонке ФИО) и при
// этом сама содержит узнаваемые названия полей — считаем её второй
// строкой заголовков и объединяем обе в одну плоскую шапку.
function detectHeaderBlock(allRows) {
  const primaryIndex = detectHeaderRowIndex(allRows);
  const rowA = allRows[primaryIndex] || [];
  const rowB = allRows[primaryIndex + 1] || null;

  if (!rowB) return { primaryIndex, secondaryIndex: null };

  const fullNameCol = rowA.findIndex(h => guessFieldForHeader(h) === 'full_name');
  const nextLooksLikeData = fullNameCol >= 0 && looksLikeFullName(rowB[fullNameCol]);
  const nextScore = rowB.reduce((acc, cell) => acc + (guessFieldForHeader(cell) ? 1 : 0), 0);

  const secondaryIndex = (!nextLooksLikeData && nextScore >= 1) ? primaryIndex + 1 : null;
  return { primaryIndex, secondaryIndex };
}

// Объединяет две строки заголовков в одну: если в нижней строке (более
// конкретное подполе, например "Вид") есть значение — берём его, иначе
// берём значение из верхней строки (например "Должность", у которой нет
// подполей и объединение идёт просто по вертикали).
function mergeHeaderRows(rowA, rowB) {
  const len = Math.max(rowA.length, rowB ? rowB.length : 0);
  const merged = [];
  for (let i = 0; i < len; i++) {
    const b = rowB ? String(rowB[i] || '').trim() : '';
    const a = String(rowA[i] || '').trim();
    merged.push(b || a);
  }
  return merged;
}

// Короткая справка «зачем нужен шаблон и как работает импорт» — вызывается
// по иконке (?) рядом с кнопками «Шаблон» / «Импорт из файла».
function showImportHelpModal() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#161b26;border-radius:14px;padding:24px;width:480px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:16px;display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Импорт сотрудников — как это работает</div>

      <div style="font-size:12.5px;color:#e2e8f0;line-height:1.6;margin-bottom:14px">
        Загрузите файл со списком сотрудников — из 1С, Excel или любой другой программы, которую использует клиент. Приложение само предложит, какая колонка файла соответствует какому полю (ФИО, должность и т.д.) — можно поправить вручную, если угадано неверно.
      </div>

      <div style="padding:12px 14px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.15);border-radius:8px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:#60a5fa;margin-bottom:6px">Зачем нужна кнопка «Шаблон»</div>
        <div style="font-size:12px;color:#cbd5e1;line-height:1.6">
          Если у клиента нет 1С и данные о сотрудниках ведутся вручную (или их вообще ещё нет в цифровом виде) — скачайте шаблон и передайте клиенту: пусть заполнит его как обычную таблицу. Файл, собранный по шаблону, распознаётся автоматически, без ручной подстройки колонок.
        </div>
      </div>

      <div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-bottom:14px">
        <strong style="color:#cbd5e1">Если у клиента уже есть 1С</strong> — шаблон необязателен. Достаточно выгрузить список сотрудников в любом привычном виде (Excel/CSV из 1С, кадровый отчёт и т.п.) — порядок и названия колонок могут отличаться, приложение всё равно предложит сопоставление при импорте.
      </div>

      <div style="font-size:11px;color:#475569;line-height:1.5;margin-bottom:18px">
        Обязательные поля — ФИО и должность. Остальное (СНИЛС, паспорт, дата приёма, подразделение) — по возможности, можно дозаполнить позже вручную.
      </div>

      <button id="import-help-close" style="width:100%;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Понятно</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#import-help-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// Скачивает готовый xlsx-шаблон с правильными заголовками и примером
// строки — чтобы клиент/бухгалтер мог выгрузить из 1С в этом формате и
// пропустить ручной мэппинг колонок при импорте.
async function downloadEmployeeTemplate() {
  const result = await window.api.employeesDownloadTemplate();
  if (result?.canceled) return;
  if (result?.error) {
    showToast('Не удалось сохранить шаблон: ' + result.error);
    return;
  }
  showToast('Шаблон сохранён ✓');
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

  const { primaryIndex, secondaryIndex } = detectHeaderBlock(allRows);
  const lastHeaderIndex = secondaryIndex !== null ? secondaryIndex : primaryIndex;
  let headers = secondaryIndex !== null
    ? mergeHeaderRows(allRows[primaryIndex], allRows[secondaryIndex])
    : allRows[primaryIndex];
  let dataRows = allRows.slice(lastHeaderIndex + 1);

  if (primaryIndex > 0) {
    showToast(`Пропущено ${primaryIndex} служебных строк перед заголовками (стандартная шапка отчёта 1С)`);
  }
  if (secondaryIndex !== null) {
    showToast('Обнаружена двухуровневая шапка (например «Удостоверение личности» → Вид/Серия/Номер) — объединил в одну строку заголовков');
  }

  // 1С часто выгружает технические колонки-разделители для визуальной
  // группировки (видны как узкие пустые столбцы в Excel) — у них нет ни
  // заголовка, ни данных ни в одной строке. Незачем показывать их на экране
  // сопоставления — только путают счётом "35 колонок" и местом на экране.
  const keepIdx = [];
  for (let i = 0; i < headers.length; i++) {
    const hasHeader = String(headers[i] || '').trim() !== '';
    const hasData = dataRows.some(row => String(row[i] || '').trim() !== '');
    if (hasHeader || hasData) keepIdx.push(i);
  }
  const removedCount = headers.length - keepIdx.length;
  if (removedCount > 0) {
    headers = keepIdx.map(i => headers[i]);
    dataRows = dataRows.map(row => keepIdx.map(i => row[i]));
    showToast(`Скрыто ${removedCount} пустых технических колонок (без заголовка и без данных)`);
  }

  const savedMapping = await window.api.clientGetImportMapping(clientId);

  await showMappingModal(clientId, headers, dataRows, savedMapping);
}

// ─── AI-мэппинг колонок (страховка поверх словаря ключевых слов) ─────────
//
// Вызывается только когда обычная эвристика (guessFieldForHeader) угадала
// меньше половины колонок — то есть заголовки файла нестандартные. В запрос
// уходят ТОЛЬКО названия колонок файла (например, "Таб. номер", "ФИО") —
// никакие данные сотрудников (ФИО, СНИЛС и т.п.) никуда не отправляются,
// это чисто служебный запрос на сопоставление структуры таблицы.
//
// Результат — только подсказка: подставляется в те же выпадающие списки,
// пользователь по-прежнему видит и может поправить каждое поле вручную
// перед импортом, финальное решение не автоматизируется.
async function requestAiColumnMapping(headers, modal, fields) {
  fields = fields || IMPORT_FIELDS;
  const btn = modal.querySelector('#ai-suggest-btn');
  const originalText = btn.textContent;
  btn.textContent = 'КомплаенсПро анализирует…';
  btn.disabled = true;

  const fieldList = fields.map(f => `"${f.key}" — ${f.label}`).join('\n');
  const headersList = headers.map((h, i) => `${i}: "${h || '(без названия)'}"`).join('\n');

  const system = 'Ты помогаешь сопоставить заголовки колонок таблицы кадрового учёта (выгрузка из 1С или Excel) с полями базы данных сотрудников. Отвечай ТОЛЬКО валидным JSON без markdown-разметки и пояснений.';
  const prompt = `Вот список допустимых полей (ключ — описание):\n${fieldList}\n\nВот заголовки колонок файла по индексам:\n${headersList}\n\nВерни JSON вида {"mapping": [значение_для_колонки_0, значение_для_колонки_1, ...]} — массив той же длины, что и число колонок (${headers.length}). Для каждой колонки укажи наиболее подходящий ключ поля из списка выше, либо null, если колонка не подходит ни к одному полю (например, лишняя техническая колонка). Используй только ключи из списка — не придумывай новые.`;

  try {
    const result = await window.api.aiRequest({ prompt, system });
    if (!result?.ok) {
      // Логируем сырой ответ в консоль (DevTools: Ctrl+Shift+I) — помогает
      // понять, что реально вернул DeepSeek, если это не просто пустой ответ.
      if (result?.raw) console.warn('AI raw response:', result.raw);
      throw new Error(result?.error || 'Нет ответа от AI');
    }

    // Ответ может прийти обёрнутым в ```json ... ``` — на всякий случай чистим.
    const cleanText = result.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    const suggestion = parsed.mapping;

    if (!Array.isArray(suggestion) || suggestion.length !== headers.length) {
      throw new Error('AI вернул сопоставление неверной длины');
    }

    const validKeys = new Set(fields.map(f => f.key));
    suggestion.forEach((key, colIdx) => {
      if (key && !validKeys.has(key)) return; // игнорируем несуществующие ключи, не подставляем мусор
      const sel = modal.querySelector(`[data-col="${colIdx}"]`);
      if (sel) sel.value = key || '';
    });

    showToast('Сопоставление подставлено — проверьте и поправьте при необходимости');
    modal.querySelector('#ai-suggest-box')?.remove();
  } catch (e) {
    showToast('Не удалось получить рекомендацию: ' + e.message);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// Нормализует текст заголовка для использования как ключ сохранённого
// маппинга — без этого «Дата рождения» и «Дата рожд.» считались бы разными
// ключами при малейшей вариации, а сравнение по номеру колонки (как было
// раньше) — вообще небезопасно: если следующий файл того же клиента придёт
// с другим порядком/составом колонок, старый маппинг по индексу молча
// подставится не туда (см. баг с перепутанными Должность/Подразделение).
function normalizeHeaderKey(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function showMappingModal(clientId, headers, dataRows, savedMapping) {
  return new Promise(resolve => {
    // savedMapping теперь словарь { нормализованный_заголовок: field_key },
    // а не массив по номеру колонки — применяем сохранённое значение только
    // если ТЕКСТ заголовка совпадает с тем, что был в прошлый раз. Если
    // заголовка нет в сохранённом маппинге (новая колонка, другой файл) —
    // используем обычную эвристику по ключевым словам.
    const initialMapping = headers.map(h => {
      const key = normalizeHeaderKey(h);
      if (savedMapping && savedMapping[key] !== undefined) return savedMapping[key];
      return guessFieldForHeader(h);
    });

    // Показываем кнопку рекомендации ИИ, если эвристика либо угадала меньше
    // половины колонок, либо (что важнее) не смогла найти хотя бы одно
    // обязательное поле — пропуск обязательного поля явный сигнал, что
    // автоматическое распознавание не справилось, даже если по количеству
    // формально угадано больше половины колонок.
    const matchedCount = initialMapping.filter(Boolean).length;
    const missingRequiredInGuess = IMPORT_FIELDS.some(f => f.required && !initialMapping.includes(f.key));
    const showAiSuggestButton = window.api.aiRequest && (matchedCount < Math.ceil(headers.length / 2) || missingRequiredInGuess);

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div style="background:#161b26;border-radius:14px;padding:24px;width:560px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
        <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:6px">${ic('upload', 16)} Сопоставление колонок</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Файл: ${headers.length} колонок, ${dataRows.length} строк. Укажите, какому полю соответствует каждая колонка.</div>
        ${showAiSuggestButton ? `
        <div id="ai-suggest-box" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.2);border-radius:8px;margin-bottom:14px">
          <div style="font-size:11.5px;color:#c4b5fd">Часть колонок не распознана автоматически — заголовки нестандартные.</div>
          <button id="ai-suggest-btn" style="flex-shrink:0;padding:7px 12px;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.4);border-radius:7px;color:#c4b5fd;cursor:pointer;font-size:11.5px;font-weight:600;white-space:nowrap">КомплаенсПро порекомендует сопоставление</button>
        </div>` : ''}
        <div id="mapping-rows" style="display:flex;flex-direction:column;gap:8px">
          ${headers.map((h, colIdx) => {
            const hasHeader = String(h || '').trim() !== '';
            let sample = '';
            if (!hasHeader) {
              const row = dataRows.find(r => String(r[colIdx] || '').trim() !== '');
              sample = row ? String(row[colIdx]).trim() : '';
            }
            return `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;min-width:0;font-size:12px;color:#e2e8f0;background:#0f1520;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(h||'').toString()}">
                ${h || '(без названия)'}
                ${sample ? `<div style="font-size:10.5px;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">например: «${sample}»</div>` : ''}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" style="flex-shrink:0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <select data-col="${colIdx}" class="mapping-select" style="flex:1;padding:8px 10px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
                <option value="">— Пропустить —</option>
                ${IMPORT_FIELDS.map(f => `<option value="${f.key}" ${initialMapping[colIdx] === f.key ? 'selected' : ''}>${f.label}${f.required ? ' *' : ''}</option>`).join('')}
              </select>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button id="mapping-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
          <button id="mapping-next" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Далее — предпросмотр</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#ai-suggest-btn')?.addEventListener('click', () => requestAiColumnMapping(headers, modal));

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

      // Сохраняем маппинг по тексту заголовка (не по номеру колонки) — так
      // следующий импорт того же клиента безопасно переиспользует только те
      // сопоставления, где заголовок реально совпал, а не «что попало под
      // тот же номер колонки».
      const mappingByHeader = {};
      headers.forEach((h, colIdx) => {
        if (mapping[colIdx]) mappingByHeader[normalizeHeaderKey(h)] = mapping[colIdx];
      });
      await window.api.clientSaveImportMapping(clientId, mappingByHeader);
      modal.remove();

      const rows = dataRows.map(rawRow => {
        const obj = {};
        let unparsedDates = 0;
        mapping.forEach((key, colIdx) => {
          if (!key) return;
          // Если две колонки файла случайно сопоставлены с одним и тем же
          // полем (например "Дата рождения" и "День рождения" — с виду
          // похожие заголовки, но по сути разные вещи) — первое непустое
          // значение побеждает, вторая колонка его не затирает молча
          if (obj[key]) return;

          const raw = (rawRow[colIdx] ?? '').toString().trim();
          const field = IMPORT_FIELDS.find(f => f.key === key);
          if (field?.type === 'date') {
            const normalized = normalizeDateForInput(raw);
            if (raw && !normalized) unparsedDates++;
            if (normalized) obj[key] = normalized;
          } else if (raw) {
            obj[key] = raw;
          }
        });
        if (unparsedDates > 0) obj._unparsedDates = unparsedDates;
        return obj;
      }).filter(obj => obj.full_name);

      const totalUnparsedDates = rows.reduce((sum, r) => sum + (r._unparsedDates || 0), 0);
      if (totalUnparsedDates > 0) {
        showToast(`Не удалось распознать формат ${totalUnparsedDates} дат — эти поля оставлены пустыми, заполните вручную`);
      }
      rows.forEach(r => delete r._unparsedDates);

      // Если в файле есть колонка «Подразделение» — предлагаем сопоставить
      // текстовые значения с реальными подразделениями клиента (или создать
      // новые), чтобы сотрудники сразу попали в нужный раздел, а не просто
      // получили текстовую подпись без связи с структурой клиента.
      const hasDepartment = rows.some(r => r.department);
      if (hasDepartment) {
        const proceed = await showDivisionMappingModal(clientId, rows);
        if (!proceed) { resolve(false); return; }
      }

      const done = await showPreviewModal(clientId, rows);
      resolve(done);
    };
  });
}

// ─── Сопоставление подразделений ─────────────────────────────────────────
// Файл обычно содержит подразделение текстом («Транспортный отдел» и т.п.).
// У клиента в системе уже могут быть заведены реальные подразделения
// (divisions) — здесь предлагаем связать текст из файла с существующим
// подразделением, создать новое, либо оставить только текстовой меткой
// без привязки (division_id останется null).
async function showDivisionMappingModal(clientId, rows) {
  const uniqueDepartments = [...new Set(rows.map(r => r.department).filter(Boolean))];
  if (!uniqueDepartments.length) return true;

  const existingDivisions = await window.api.divisionsList(clientId);

  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div style="background:#161b26;border-radius:14px;padding:24px;width:560px;max-height:80vh;overflow-y:auto;box-sizing:border-box">
        <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:6px">${ic('building', 16)} Сопоставление подразделений</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">В файле найдено ${uniqueDepartments.length} уникальных значений «Подразделение». Свяжите их с подразделениями клиента.</div>
        <div id="division-rows" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
          ${uniqueDepartments.map((dept, idx) => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;min-width:0;font-size:12px;color:#e2e8f0;background:#0f1520;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${dept}">${dept}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" style="flex-shrink:0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <select data-dept-idx="${idx}" class="division-select" style="flex:1;padding:8px 10px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
                <option value="__create__" selected>+ Создать новое «${dept}»</option>
                ${existingDivisions.map(d => `<option value="${d.id}" ${d.name?.trim().toLowerCase() === dept.trim().toLowerCase() ? 'selected' : ''}>${d.name}</option>`).join('')}
                <option value="__none__">— Не привязывать (только текстом) —</option>
              </select>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px">
          <button id="division-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
          <button id="division-next" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Далее — предпросмотр</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#division-cancel').onclick = () => { modal.remove(); resolve(false); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };

    modal.querySelector('#division-next').onclick = async () => {
      const btn = modal.querySelector('#division-next');
      btn.textContent = 'Обработка…';
      btn.disabled = true;

      // Резолвим каждое уникальное значение в реальный division_id — создаём
      // новые подразделения там, где выбрано «Создать новое».
      const resolvedMap = {};
      for (let idx = 0; idx < uniqueDepartments.length; idx++) {
        const dept = uniqueDepartments[idx];
        const sel = modal.querySelector(`.division-select[data-dept-idx="${idx}"]`);
        const value = sel.value;
        if (value === '__none__') {
          resolvedMap[dept] = null;
        } else if (value === '__create__') {
          const newId = await window.api.divisionsAdd({ client_id: clientId, name: dept });
          resolvedMap[dept] = newId;
        } else {
          resolvedMap[dept] = parseInt(value);
        }
      }

      // Проставляем division_id каждой строке по её текстовому «Подразделение».
      rows.forEach(row => {
        if (row.department && resolvedMap[row.department] !== undefined) {
          row.division_id = resolvedMap[row.department];
        }
      });

      modal.remove();
      resolve(true);
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

  // Отчёт о расхождениях: сотрудники клиента, которых нет ни в одной строке
  // нового файла — вероятно, уволены, но мы не удаляем их автоматически,
  // только показываем для ручного решения (безопаснее, чем угадывать).
  const matchedIds = new Set(conflicts.map(c => c.match.id));
  const missing = existing.filter(e => !matchedIds.has(e.id));

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
        ${missing.length ? `
        <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Не найдены в файле (возможно уволены) · ${missing.length}</div>
        <div id="missing-rows" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;max-height:200px;overflow-y:auto">
          ${missing.map((m, i) => `
            <div data-missing-row="${i}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);border-radius:8px">
              <div style="flex:1;min-width:0;font-size:12px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.full_name}<div style="font-size:10.5px;color:#94a3b8">${m.position || ''}</div></div>
              <button data-missing-delete="${i}" style="padding:6px 10px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.3);border-radius:6px;color:#f87171;cursor:pointer;font-size:11px;flex-shrink:0">Удалить</button>
            </div>`).join('')}
        </div>
        <div style="font-size:10.5px;color:#475569;margin-bottom:16px">Эти сотрудники не удаляются автоматически — при необходимости удалите вручную или оставьте, если это не увольнение (например, декрет, филиал не попал в файл).</div>` : ''}
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

    modal.querySelectorAll('[data-missing-delete]').forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.dataset.missingDelete);
        const m = missing[idx];
        if (!confirm(`Удалить сотрудника «${m.full_name}» из базы? Это действие нельзя отменить.`)) return;
        await window.api.employeeDelete(m.id);
        const row = modal.querySelector(`[data-missing-row="${idx}"]`);
        if (row) row.remove();
        showToast(`${m.full_name} удалён`);
      };
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
