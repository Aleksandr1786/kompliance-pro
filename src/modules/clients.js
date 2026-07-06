// ============================================================
// КОМПЛАЕНСПРО — clients.js
// Список клиентов: рендер, поиск, добавление, редактирование, удаление, архив
// Декомпозиция app.js — батч 2, 10.06.2026
// ============================================================

async function renderClients() {
  const clients = await getClients();
  const btn = document.getElementById('topbarAction');
  btn.textContent = '+ ' + term('addClient');
  btn.style.display = 'flex';
  btn.onclick = () => openModal('modalAddClient');

  // Массовый импорт по нескольким организациям имеет смысл только для
  // аутсорсера (ведёт несколько клиентов сразу) — у штатного специалиста
  // всегда ровно одна компания, распределять сотрудников по организациям
  // физически нечего, кнопка была бы лишней и путающей.
  const settings = await window.api.settingsGet();
  const isOutsourcer = settings?.license_type !== 'SOLO';
  const bulkImportBtn = isOutsourcer
    ? `<div class="panel-action" onclick="importEmployeesBulkPrompt()" style="margin-left:auto"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:3px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Массовый импорт сотрудников</div>`
    : '';

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="panel-title">Все ${term('clients')}</div><div class="panel-count">${clients.length} организаций</div>${bulkImportBtn}</div>
      <div class="client-search"><input class="search-input" placeholder="🔍 Поиск по названию, ИНН, ОКВЭД..." oninput="filterClients(this.value)" id="clientSearch"></div>
      <div id="fullClientList">${renderClientRows(clients)}</div>
    </div>
  `;
  window._allClients = clients;
}

async function filterClients(q) {
  const clients = window._allClients || [];
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.inn||'').includes(q) || (c.okved||'').includes(q)
  );
  document.getElementById('fullClientList').innerHTML = renderClientRows(filtered);
}

// ── КАРТОЧКА КЛИЕНТА ─────────────────────────────────────

// ── ДОБАВЛЕНИЕ КЛИЕНТА ───────────────────────────────────
function togglePill(el) {
  el.classList.toggle('checked');
  el.dataset.userTouched = '1';
}

// ── АВТОПОДСКАЗКА МОДУЛЯ ЧОП ПО ОКВЭД ─────────────────────
// ОКВЭД 80.10 «Деятельность частных охранных служб» — специфичный код,
// не зависящий от того, как называется юрлицо (ЧОП, ООО «Охрана» и т.п.),
// поэтому надёжнее самоназвания. Но это МЯГКАЯ подсказка, не жёсткая
// привязка: ОКВЭД мог быть введён неверно, охрана может быть доп. видом
// деятельности, поэтому пользователь всегда может снять галку сам —
// после чего dataset.userTouched больше не даст автоподсказке её вернуть.
function suggestChopByOkved(okved, pillsContainerId) {
  const clean = (okved || '').replace(/\./g, '');
  if (!clean.startsWith('8010')) return;
  const container = document.getElementById(pillsContainerId);
  if (!container) return;
  const chopPill = container.querySelector('[data-module="CHOP"]');
  if (chopPill && !chopPill.classList.contains('checked') && !chopPill.dataset.userTouched) {
    chopPill.classList.add('checked');
    showToast('ОКВЭД 80.10 — похоже на охранную деятельность. Отметил модуль «ЧОП», при необходимости снимите галку', 'var(--blue)');
  }
}

// Слушаем ввод ОКВЭД глобально (делегирование) — работает независимо
// от того, когда именно открыта модалка добавления/редактирования клиента
document.addEventListener('input', (ev) => {
  if (ev.target?.id === 'c-okved') suggestChopByOkved(ev.target.value, 'c-modules-pills');
  if (ev.target?.id === 'e-okved') suggestChopByOkved(ev.target.value, 'e-modules-pills');
});

function _fieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#f87171';
  el.title = msg;
  el.addEventListener('input', () => { el.style.borderColor = ''; el.title = ''; }, { once: true });
}

async function submitAddClient() {
  const name  = document.getElementById('c-name')?.value?.trim();
  const okved = document.getElementById('c-okved')?.value?.trim();
  const inn   = document.getElementById('c-inn')?.value?.trim() || '';

  let hasError = false;
  if (!name)  { _fieldError('c-name',  'Обязательное поле'); hasError = true; }
  if (!okved) { _fieldError('c-okved', 'Обязательное поле'); hasError = true; }
  if (inn && !/^\d{10}$|^\d{12}$/.test(inn)) {
    _fieldError('c-inn', 'ИНН должен содержать 10 или 12 цифр');
    hasError = true;
  }
  if (hasError) { showToast('Заполните обязательные поля', 'var(--red)'); return; }

  // Проверяем лимит тарифа
  const currentClients = await getClients();
  // Обновляем лицензию перед проверкой — важно при вызове из онбординга,
  // когда sync ещё не завершился на момент первого запуска.
  if (typeof syncLicenseFromBackend === 'function') await syncLicenseFromBackend();
  if (!checkClientLimit(currentClients.length)) {
    showClientLimitReached();
    closeModal('modalAddClient');
    return;
  }
  const mods = [...document.querySelectorAll('#c-modules-pills .module-pill.checked')].map(p => p.dataset.module).join(',');
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const otName = document.getElementById('c-ot-name')?.value?.trim() || '';
  const otPos  = document.getElementById('c-ot-position')?.value?.trim() || '';
  // Склоняем ФИО и должность ответственного за ОТ через ИИ — нужны для
  // фраз вида "Назначить (кого?) [должность] [ФИО]" (винительный падеж).
  // Делаем только если поля реально заполнены — иначе нечего склонять.
  let nameDecl = null, posDecl = null;
  if ((otName || otPos) && window.api.aiRequest) showToast('⏳ Согласование падежей...');
  if (otName && window.api.aiRequest) nameDecl = await declineFIO(otName);
  if (otPos  && window.api.aiRequest) posDecl  = await declinePosition(otPos);
  const data = {
    name,
    inn:    document.getElementById('c-inn')?.value?.trim() || '',
    ogrn:   document.getElementById('c-ogrn')?.value?.trim() || '',
    okved,
    okved_extra: '',
    form:   document.getElementById('c-form')?.value || 'ООО',
    staff:  parseInt(document.getElementById('c-staff')?.value) || 0,
    region:           document.getElementById('c-region')?.value || 'Краснодарский край',
    city:             document.getElementById('c-city')?.value?.trim() || '',
    address:          document.getElementById('c-address')?.value?.trim() || '',
    address_actual:   document.getElementById('c-address-actual')?.value?.trim() || '',
    czn:              'ФГКУ КК ЦЗН в г. Новороссийске',
    phone:            document.getElementById('c-phone')?.value?.trim() || '',
    order_prefix:     parseInt(document.getElementById('c-order-prefix')?.value) || 1,
    email:            document.getElementById('c-email')?.value?.trim() || '',
    modules:          mods || 'OT',
    manager_name:     document.getElementById('c-manager-name')?.value?.trim() || '',
    manager_position: document.getElementById('c-manager-position')?.value || 'Руководитель',
    ot_name:          otName,
    ot_position:      otPos,
    ot_name_acc:      nameDecl?.acc || '',
    ot_position_acc:  posDecl?.acc  || '',
    soat_class:       document.getElementById('c-soat-class')?.value || '2',
    hazard_works:     document.getElementById('c-hazard-works')?.checked ? 1 : 0,
    medcheck_required:document.getElementById('c-medcheck-required')?.checked ? 1 : 0,
    contract_date:    document.getElementById('c-contract-date')?.value || '',
    git_last_date:    document.getElementById('c-git-last-date')?.value || '',
    next_visit_date:  document.getElementById('c-next-visit-date')?.value || '',
    git_next_date:    document.getElementById('c-git-next-date')?.value || '',
    soat_total:       parseInt(document.getElementById('c-soat-total')?.value) || 0,
    soat_done:        parseInt(document.getElementById('c-soat-done')?.value) || 0,
    soat_c1:          parseInt(document.getElementById('c-soat-c1')?.value) || 0,
    soat_c2:          parseInt(document.getElementById('c-soat-c2')?.value) || 0,
    soat_c31:         parseInt(document.getElementById('c-soat-c31')?.value) || 0,
    soat_c32:         parseInt(document.getElementById('c-soat-c32')?.value) || 0,
    soat_c33:         parseInt(document.getElementById('c-soat-c33')?.value) || 0,
    soat_c34:         parseInt(document.getElementById('c-soat-c34')?.value) || 0,
    soat_c4:          parseInt(document.getElementById('c-soat-c4')?.value) || 0,
    soat_med_req:     parseInt(document.getElementById('c-soat-med-req')?.value) || 0,
    color,
    score: 0,
  };
  const isFirstClient = currentClients.length === 0;
  const result = await window.api.clientAdd(data);
  if (result?.error) { showToast('Ошибка: ' + result.error, 'var(--red)'); return; }
  if (!result?.id) { showToast('Ошибка при добавлении клиента', 'var(--red)'); return; }
  closeModal('modalAddClient');
  showToast(`Клиент "${name}" добавлен`);
  // Сбрасываем форму
  ['c-name','c-inn','c-ogrn','c-email','c-okved','c-staff','c-phone','c-city','c-address','c-address-actual','c-ot-name','c-ot-position',
   'c-manager-name','c-contract-date','c-git-last-date','c-next-visit-date','c-git-next-date',
   'c-soat-total','c-soat-done','c-soat-c1','c-soat-c2','c-soat-c31','c-soat-c32','c-soat-c33','c-soat-c34','c-soat-c4','c-soat-med-req'
  ].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const op = document.getElementById('c-order-prefix'); if(op) op.value='1';
  document.querySelectorAll('#c-modules-pills .module-pill').forEach(p => {
    p.classList.toggle('checked', p.dataset.module !== 'VU' && p.dataset.module !== 'CHOP');
    delete p.dataset.userTouched;
  });
  await navigate('client', result.id);
  // Показываем тур при добавлении первого клиента
  if (isFirstClient && typeof showClientTour === 'function') {
    setTimeout(() => showClientTour(), 700);
  }
}

// ── COMING SOON ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
//  МОДУЛЬ ОТЧЁТНОСТИ

// ── РЕДАКТИРОВАНИЕ КЛИЕНТА ───────────────────────────────
async function openEditModal(clientId) {
  const c = await window.api.clientGet(clientId);
  if (!c) return;

  // Create edit modal dynamically
  let modal = document.getElementById('modalEditClient');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalEditClient';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-height:90vh;overflow-y:auto">
        <div class="modal-title">✏️ Редактировать ${term('clientAcc')}</div>
        <div class="modal-sub">Измените данные организации</div>
        <div class="form-row">
          <div class="form-group full"><div class="form-label">Название <span class="req">*</span></div><input class="form-input" id="e-name"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">ИНН</div><input class="form-input" id="e-inn"></div>
          <div class="form-group"><div class="form-label">Форма</div>
            <select class="form-select" id="e-form">
              <option>ООО</option><option>ИП</option><option>АО / ЗАО</option><option>ГУП / МУП</option><option>НКО</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">ОГРН</div><input class="form-input" id="e-ogrn" placeholder="1027700000000"></div>
          <div class="form-group"><div class="form-label">Email</div><input class="form-input" id="e-email" type="email" placeholder="info@company.ru"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">ОКВЭД <span class="req">*</span></div><input class="form-input" id="e-okved"></div>
          <div class="form-group"><div class="form-label">Сотрудников</div><input class="form-input" id="e-staff" type="number"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Регион</div>
            <select class="form-select" id="e-region">
              <option>Краснодарский край</option><option>Москва</option><option>Санкт-Петербург</option>
              <option>Московская область</option><option>Ростовская область</option>
              <option>Ставропольский край</option><option>Другой регион</option>
            </select>
          </div>
          <div class="form-group"><div class="form-label">Город</div><input class="form-input" id="e-city" placeholder="Новороссийск"></div>
        </div>
        <div class="form-row">
          <div class="form-group full"><div class="form-label">Юридический адрес</div><input class="form-input" id="e-address" placeholder="г. Новороссийск, ул. Примерная, д. 1"></div>
        </div>
        <div class="form-row">
          <div class="form-group full"><div class="form-label">Фактический адрес</div><input class="form-input" id="e-address-actual" placeholder="Если совпадает с юридическим — оставьте пустым"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Телефон</div><input class="form-input" id="e-phone"></div>
          <div class="form-group"><div class="form-label">Начальный № приказа</div><input class="form-input" id="e-order-prefix" type="number" min="1"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Должность руководителя</div>
            <select class="form-select" id="e-manager-position">
              <option>Индивидуальный предприниматель</option>
              <option>Генеральный директор</option><option>Директор</option>
              <option>Исполнительный директор</option><option>Руководитель</option>
            </select>
          </div>
          <div class="form-group"><div class="form-label">ФИО руководителя</div><input class="form-input" id="e-manager-name" placeholder="Иванов Иван Иванович"></div>
        </div>
        <div style="padding:10px 0 4px;font-size:11px;color:var(--muted2);font-weight:600;letter-spacing:.5px">УСЛОВИЯ ТРУДА</div>
        <div class="form-row">
          <div class="form-group">
            <div class="form-label">Класс условий труда (СОУТ)</div>
            <select class="form-select" id="e-soat-class">
              <option value="2">Класс 2 — Допустимые (офис, ПЭВМ)</option>
              <option value="31">Класс 3.1 — Вредные (1 степень)</option>
              <option value="32">Класс 3.2 — Вредные (2 степень)</option>
              <option value="33">Класс 3.3 — Вредные (3 степень)</option>
              <option value="34">Класс 3.4 — Вредные (4 степень)</option>
              <option value="4">Класс 4 — Опасные</option>
              <option value="0">СОУТ не проводилась</option>
            </select>
          </div>
        </div>

        <!-- ДЕТАЛИЗАЦИЯ СОУТ для ЕФС-1 подраздел 2.3 -->
        <div style="padding:10px 0 4px;font-size:11px;color:var(--muted2);font-weight:600;letter-spacing:.5px">СОУТ — ДЕТАЛИЗАЦИЯ ДЛЯ ЕФС-1 (подраздел 2.3)</div>
        <div style="font-size:11px;color:#334155;margin-bottom:10px">Заполните для генерации справки бухгалтеру. На 1 января отчётного года.</div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Всего р/мест подлежащих СОУТ</div><input class="form-input" id="e-soat-total" type="number" min="0" placeholder="0"></div>
          <div class="form-group"><div class="form-label">Проведена СОУТ (р/мест)</div><input class="form-input" id="e-soat-done" type="number" min="0" placeholder="0"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Класс 1 (оптимальные)</div><input class="form-input" id="e-soat-c1" type="number" min="0" placeholder="0"></div>
          <div class="form-group"><div class="form-label">Класс 2 (допустимые)</div><input class="form-input" id="e-soat-c2" type="number" min="0" placeholder="0"></div>
          <div class="form-group"><div class="form-label">Класс 3.1</div><input class="form-input" id="e-soat-c31" type="number" min="0" placeholder="0"></div>
          <div class="form-group"><div class="form-label">Класс 3.2</div><input class="form-input" id="e-soat-c32" type="number" min="0" placeholder="0"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Класс 3.3</div><input class="form-input" id="e-soat-c33" type="number" min="0" placeholder="0"></div>
          <div class="form-group"><div class="form-label">Класс 3.4</div><input class="form-input" id="e-soat-c34" type="number" min="0" placeholder="0"></div>
          <div class="form-group"><div class="form-label">Класс 4 (опасные)</div><input class="form-input" id="e-soat-c4" type="number" min="0" placeholder="0"></div>
          <div class="form-group"><div class="form-label">Подлежат медосмотрам</div><input class="form-input" id="e-soat-med-req" type="number" min="0" placeholder="0"></div>
        </div>
        <div class="form-row">
          <div class="form-group" style="grid-column:1/-1"><div class="form-label" style="justify-content:flex-end">Особые условия</div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
              <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12px;color:var(--muted2)">
                <input type="checkbox" id="e-hazard-works" style="width:15px;height:15px;margin-top:1px;flex-shrink:0">
                <div>
                  <div style="color:var(--text);font-weight:600">⚠️ Есть работы повышенной опасности</div>
                  <div style="color:#475569;font-size:11px;margin-top:2px">Включает проверку наличия СИЗ в симуляторе ГИТ (штраф до 150 000 ₽ по ч.4 ст.5.27.1)</div>
                </div>
              </label>
              <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12px;color:var(--muted2)">
                <input type="checkbox" id="e-medcheck-required" style="width:15px;height:15px;margin-top:1px;flex-shrink:0">
                <div>
                  <div style="color:var(--text);font-weight:600">🏥 Медосмотры обязательны по условиям труда</div>
                  <div style="color:#475569;font-size:11px;margin-top:2px">Включает проверку медосмотров в симуляторе ГИТ (штраф до 130 000 ₽ по ч.3 ст.5.27.1)</div>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div style="padding:10px 0 4px;font-size:11px;color:var(--muted2);font-weight:600;letter-spacing:.5px">ОТВЕТСТВЕННЫЙ ЗА ОХРАНУ ТРУДА</div>
        <div style="font-size:11px;color:var(--muted2);margin-bottom:8px">Если отличается от руководителя — заполните. Иначе оставьте пустым.</div>
        <div class="form-row">
          <div class="form-group"><div class="form-label">Должность отв. за ОТ</div><input class="form-input" id="e-ot-position" placeholder="Специалист по ОТ"></div>
          <div class="form-group"><div class="form-label">ФИО отв. за ОТ</div><input class="form-input" id="e-ot-name" placeholder="Петров Пётр Петрович"></div>
        </div>
        <div style="padding:10px 0 4px;font-size:11px;color:var(--muted2);font-weight:600;letter-spacing:.5px">КЛЮЧЕВЫЕ ДАТЫ</div>
        <div class="form-row">
          <div class="form-group">
            <div class="form-label">📅 Дата заключения договора</div>
            <input class="form-input" id="e-contract-date" type="date">
          </div>
          <div class="form-group">
            <div class="form-label">🔍 Последняя проверка ГИТ</div>
            <input class="form-input" id="e-git-last-date" type="date">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <div class="form-label">🔄 Следующий плановый обход</div>
            <input class="form-input" id="e-next-visit-date" type="date">
          </div>
          <div class="form-group">
            <div class="form-label">📋 Следующая проверка ГИТ (план)</div>
            <input class="form-input" id="e-git-next-date" type="date">
          </div>
        </div>
        <div style="padding:10px 0 6px;font-size:11px;color:var(--muted2);font-weight:600;letter-spacing:.5px">МОДУЛИ</div>
        <div class="modules-check" id="e-modules-pills">
          <div class="module-pill" data-module="OT" onclick="togglePill(this)">Охрана труда</div>
          <div class="module-pill" data-module="PD" onclick="togglePill(this)">ПДн</div>
          <div class="module-pill" data-module="VU" onclick="togglePill(this)">Воинский учёт</div>
          <div class="module-pill" data-module="CHOP" onclick="togglePill(this)" title="Требует активного аддона CHOP для доступа к разряду/оружию/постам сотрудников">ЧОП (частная охрана)</div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-red" onclick="deleteClient(currentEditClientId)">🗑 Удалить</button>
          <button class="btn btn-ghost" onclick="closeModal('modalEditClient')">Отмена</button>
          <button class="btn btn-primary" onclick="submitEditClient(currentEditClientId)">${ic("save",14)} Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Сохраняем ID клиента глобально (нужно для кнопок внутри модала)
  window.currentEditClientId = clientId;

  // Заполняем форму текущими данными
  document.getElementById('e-name').value          = c.name             || '';
  document.getElementById('e-inn').value           = c.inn              || '';
  document.getElementById('e-ogrn').value          = c.ogrn             || '';
  document.getElementById('e-email').value         = c.email            || '';
  document.getElementById('e-okved').value         = c.okved            || '';
  document.getElementById('e-staff').value         = c.staff            || '';
  document.getElementById('e-phone').value         = c.phone            || '';
  document.getElementById('e-city').value          = c.city             || '';
  document.getElementById('e-address').value       = c.address          || '';
  document.getElementById('e-address-actual').value = c.address_actual   || '';
  document.getElementById('e-order-prefix').value  = c.order_prefix     || 1;
  document.getElementById('e-manager-name').value  = c.manager_name     || '';
  document.getElementById('e-ot-position').value   = c.ot_position      || '';
  document.getElementById('e-ot-name').value       = c.ot_name          || '';
  document.getElementById('e-contract-date').value  = c.contract_date   || '';
  document.getElementById('e-git-last-date').value  = c.git_last_date   || '';
  document.getElementById('e-next-visit-date').value = c.next_visit_date || '';
  document.getElementById('e-git-next-date').value  = c.git_next_date   || '';

  // Заполняем модули
  const currentModules = c.modules || '';
  document.querySelectorAll('#e-modules-pills .module-pill').forEach(pill => {
    const mod = pill.dataset.module;
    if (currentModules.includes(mod)) {
      pill.classList.add('checked');
    } else {
      pill.classList.remove('checked');
    }
  });
  document.getElementById('e-soat-total')?.setAttribute('value', c.soat_total || '');
  document.getElementById('e-soat-done')?.setAttribute('value', c.soat_done || '');
  document.getElementById('e-soat-c1')?.setAttribute('value', c.soat_c1 || '');
  document.getElementById('e-soat-c2')?.setAttribute('value', c.soat_c2 || '');
  document.getElementById('e-soat-c31')?.setAttribute('value', c.soat_c31 || '');
  document.getElementById('e-soat-c32')?.setAttribute('value', c.soat_c32 || '');
  document.getElementById('e-soat-c33')?.setAttribute('value', c.soat_c33 || '');
  document.getElementById('e-soat-c34')?.setAttribute('value', c.soat_c34 || '');
  document.getElementById('e-soat-c4')?.setAttribute('value', c.soat_c4 || '');
  document.getElementById('e-soat-med-req')?.setAttribute('value', c.soat_med_req || '');

  // СОУТ и опасные работы
  const soatSel = document.getElementById('e-soat-class');
  if (soatSel) { for (let opt of soatSel.options) if (opt.value === String(c.soat_class||'2')) { opt.selected=true; break; } }
  const hazEl = document.getElementById('e-hazard-works');
  if (hazEl) hazEl.checked = !!c.hazard_works;
  const medEl = document.getElementById('e-medcheck-required');
  if (medEl) medEl.checked = !!c.medcheck_required;

  const formSel = document.getElementById('e-form');
  for (let opt of formSel.options) if (opt.value === c.form || opt.text === c.form) { opt.selected = true; break; }
  const regionSel = document.getElementById('e-region');
  for (let opt of regionSel.options) if (opt.value === c.region || opt.text === c.region) { opt.selected = true; break; }
  const posSel = document.getElementById('e-manager-position');
  for (let opt of posSel.options) if (opt.value === c.manager_position || opt.text === c.manager_position) { opt.selected = true; break; }

  openModal('modalEditClient');
}

async function submitEditClient(clientId) {
  const name = document.getElementById('e-name').value.trim();
  const okved = document.getElementById('e-okved').value.trim();
  if (!name) { showToast('Введите название', 'var(--red)'); return; }

  const otName = document.getElementById('e-ot-name').value.trim();
  const otPos  = document.getElementById('e-ot-position').value.trim();
  // Раньше тут была проверка "изменилось ли значение" (чтобы не дёргать ИИ
  // зря) — но сравнение шло после .trim(), и если пользователь правил поле
  // не меняя текста по сути (пробелы и т.п.), проверка решала, что ничего
  // не изменилось, и склонение оставалось старым/пустым. Проще и надёжнее
  // всегда пересчитывать при сохранении, если поля заполнены — лишний
  // ИИ-запрос раз в правку карточки клиента не критичен.
  let nameAcc = '', posAcc = '';
  if ((otName || otPos) && window.api.aiRequest) showToast('⏳ Согласование падежей...');
  if (otName && window.api.aiRequest) { const d = await declineFIO(otName); nameAcc = d?.acc || ''; }
  if (otPos  && window.api.aiRequest) { const d = await declinePosition(otPos); posAcc = d?.acc || ''; }

  const data = {
    name,
    inn:              document.getElementById('e-inn').value.trim(),
    ogrn:             document.getElementById('e-ogrn').value.trim(),
    email:            document.getElementById('e-email').value.trim(),
    okved,
    staff:            parseInt(document.getElementById('e-staff').value) || 0,
    form:             document.getElementById('e-form').value,
    region:           document.getElementById('e-region').value,
    city:             document.getElementById('e-city').value.trim(),
    phone:            document.getElementById('e-phone').value.trim(),
    address:          document.getElementById('e-address').value.trim(),
    address_actual:   document.getElementById('e-address-actual').value.trim(),
    order_prefix:     parseInt(document.getElementById('e-order-prefix').value) || 1,
    manager_name:     document.getElementById('e-manager-name').value.trim(),
    manager_position: document.getElementById('e-manager-position').value,
    ot_name:           otName,
    ot_position:       otPos,
    ot_name_acc:       nameAcc,
    ot_position_acc:   posAcc,
    soat_class:        document.getElementById('e-soat-class')?.value || '2',
    hazard_works:      document.getElementById('e-hazard-works')?.checked ? 1 : 0,
    medcheck_required: document.getElementById('e-medcheck-required')?.checked ? 1 : 0,
    contract_date:     document.getElementById('e-contract-date')?.value || '',
    git_last_date:     document.getElementById('e-git-last-date')?.value || '',
    next_visit_date:   document.getElementById('e-next-visit-date')?.value || '',
    modules:           [...document.querySelectorAll('#e-modules-pills .module-pill.checked')].map(p => p.dataset.module).join(','),
    git_next_date:     document.getElementById('e-git-next-date')?.value || '',
    soat_total:        parseInt(document.getElementById('e-soat-total')?.value) || 0,
    soat_done:         parseInt(document.getElementById('e-soat-done')?.value) || 0,
    soat_c1:           parseInt(document.getElementById('e-soat-c1')?.value) || 0,
    soat_c2:           parseInt(document.getElementById('e-soat-c2')?.value) || 0,
    soat_c31:          parseInt(document.getElementById('e-soat-c31')?.value) || 0,
    soat_c32:          parseInt(document.getElementById('e-soat-c32')?.value) || 0,
    soat_c33:          parseInt(document.getElementById('e-soat-c33')?.value) || 0,
    soat_c34:          parseInt(document.getElementById('e-soat-c34')?.value) || 0,
    soat_c4:           parseInt(document.getElementById('e-soat-c4')?.value) || 0,
    soat_med_req:      parseInt(document.getElementById('e-soat-med-req')?.value) || 0,
  };

  const result = await window.api.clientUpdate(clientId, data);
  if (result?.error) { showToast(result.error, 'var(--red)'); return; }
  closeModal('modalEditClient');
  showToast('Данные ' + term('clientGen') + ' сохранены ✓');
  await navigate('client', clientId);
}

async function deleteClient(clientId) {
  const c = await window.api.clientGet(clientId);
  if (!c) return;

  // Красивый модал подтверждения
  let confirmModal = document.getElementById('modalDeleteConfirm');
  if (confirmModal) confirmModal.remove();

  confirmModal = document.createElement('div');
  confirmModal.id = 'modalDeleteConfirm';
  confirmModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px)';
  confirmModal.innerHTML = `
    <div style="background:var(--s2);border:1px solid rgba(248,113,113,0.3);border-radius:18px;padding:28px;width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${ic('trash',22)}
        </div>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text)">Архивировать ${term('clientAcc')}?</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${c.name}</div>
        </div>
      </div>

      <div style="padding:12px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);border-radius:10px;margin-bottom:16px">
        <div style="font-size:12px;color:#f87171;line-height:1.6">
          ${term('client')} будет перемещён в архив. Все данные, сотрудники и документы сохранятся.<br>
          Восстановить можно в разделе <strong>Настройки → Архив ${term('clientsGenPl').toLowerCase()}</strong>.
        </div>
      </div>

      <div style="margin-bottom:16px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Для подтверждения введите <strong style="color:#f87171">АРХИВ</strong>:</div>
        <input id="delete-confirm-input" class="form-input" placeholder="Введите АРХИВ" oninput="
          const val = this.value.trim().toUpperCase();
          document.getElementById('delete-confirm-btn').disabled = val !== 'АРХИВ';
          document.getElementById('delete-confirm-btn').style.opacity = val === 'АРХИВ' ? '1' : '0.4';
        ">
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('modalDeleteConfirm').remove()">Отмена</button>
        <button id="delete-confirm-btn" disabled style="opacity:0.4;padding:10px 20px;background:linear-gradient(90deg,#dc2626,#ef4444);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s" onclick="confirmArchiveClient(${clientId})">
          Архивировать →
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
  confirmModal.addEventListener('click', e => { if (e.target === confirmModal) confirmModal.remove(); });
  setTimeout(() => document.getElementById('delete-confirm-input')?.focus(), 100);
}

async function confirmArchiveClient(clientId) {
  document.getElementById('modalDeleteConfirm')?.remove();
  closeModal('modalEditClient');
  await window.api.clientUpdate(clientId, {
    archived: 1,
    archived_at: new Date().toISOString().slice(0, 10),
  });
  showToast('Клиент перемещён в архив', 'var(--amber)');
  await navigate('clients');
}

