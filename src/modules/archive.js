// ============================================================
// КОМПЛАЕНСПРО — archive.js
// Архив клиентов: список и восстановление
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================


// ── АРХИВ КЛИЕНТОВ ───────────────────────────────────────

// ── АРХИВ КЛИЕНТОВ ───────────────────────────────────────
async function loadArchiveList() {
  const el = document.getElementById('archive-list');
  if (!el) return;

  const all = await getClients(true); // все включая архивных
  const archived = all.filter(c => c.archived);

  if (!archived.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:16px 0;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px">${ic('check-circle',16)} Архив пуст</div>`;
    return;
  }

  el.innerHTML = archived.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:6px">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--muted)">${escapeHtml(c.name)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHtml(c.form||'')} · Архивирован: ${c.archived_at||'—'}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost" style="padding:5px 12px;font-size:11px;color:var(--green);border-color:rgba(52,211,153,0.3)" onclick="restoreClient(${c.id})">
          ${ic('refresh',12)} Восстановить
        </button>
        <button class="btn btn-ghost archive-delete-btn" data-client-id="${c.id}" data-client-name="${escapeHtml(c.name)}" style="padding:5px 12px;font-size:11px;color:#f87171;border-color:rgba(248,113,113,0.3)">
          ${ic('trash',12)} Удалить навсегда
        </button>
      </div>
    </div>
  `).join('');

  // Кнопка удаления навсегда — сознательно НЕ через inline onclick с именем
  // клиента внутри строки: названия компаний часто содержат кавычки
  // (например, ООО "ЮгТранс"), которые ломают HTML-атрибут onclick="...",
  // обрывая его раньше времени. Через data-атрибут + addEventListener имя
  // читается безопасно независимо от того, какие символы в нём есть.
  el.querySelectorAll('.archive-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      permanentlyDeleteClient(parseInt(btn.dataset.clientId), btn.dataset.clientName);
    });
  });
}

// Экранирует HTML-спецсимволы (кавычки, амперсанд, теги) при вставке
// произвольного текста (например, названия клиента) внутрь HTML-атрибутов
// или разметки. ВАЖНО: делаем явной заменой символов, а не через
// textContent/innerHTML — тот способ не экранирует кавычки в обычном
// тексте (браузер экранирует только &, <, > вне атрибутов), из-за чего
// названия вроде ООО "ЮгТранс" всё равно ломали data-атрибут.
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── БЕЗВОЗВРАТНОЕ УДАЛЕНИЕ КЛИЕНТА (ТОЛЬКО ИЗ АРХИВА) ─────
//
// Двухступенчатая защита от потери данных: обычное «Удалить» в карточке
// клиента ведёт только в архив (см. clients.js confirmArchiveClient) —
// данные, сотрудники и документы сохраняются, можно восстановить.
// Настоящее, необратимое удаление доступно ТОЛЬКО отсюда, из архива, и
// требует точного ввода названия компании — этого нет даже в архивной
// карточке случайного клика недостаточно, чтобы стереть данные навсегда.
function permanentlyDeleteClient(clientId, clientName) {
  const existing = document.getElementById('modalPermanentDelete');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modalPermanentDelete';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--s2);border:1px solid rgba(248,113,113,0.4);border-radius:18px;padding:28px;width:440px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${ic('trash',22)}
        </div>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text)">Удалить навсегда?</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${clientName}</div>
        </div>
      </div>

      <div style="padding:12px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:10px;margin-bottom:16px">
        <div style="font-size:12.5px;color:#f87171;line-height:1.6;font-weight:600">
          ${ic('alert-triangle',13)} Это действие необратимо. Восстановить данные будет невозможно.
        </div>
        <div style="font-size:12px;color:#f87171;line-height:1.6;margin-top:6px">
          Удаляются безвозвратно: карточка клиента, все сотрудники, подразделения, сформированные документы и история — в отличие от архивирования, откатить это нельзя.
        </div>
      </div>

      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Чтобы подтвердить, введите точное название компании — <strong style="color:var(--text)">${clientName}</strong>:</div>
      <input id="permanent-delete-input" placeholder="${clientName}" style="width:100%;padding:10px 12px;background:var(--s1);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box;margin-bottom:18px">

      <div style="display:flex;gap:10px">
        <button style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:10px;color:var(--muted);cursor:pointer;font-size:13px" onclick="document.getElementById('modalPermanentDelete').remove()">Отмена</button>
        <button id="permanent-delete-btn" disabled style="flex:1;opacity:0.4;padding:10px;background:linear-gradient(90deg,#dc2626,#ef4444);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s" onclick="confirmPermanentDeleteClient(${clientId})">
          Удалить навсегда →
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  const input = document.getElementById('permanent-delete-input');
  const btn = document.getElementById('permanent-delete-btn');
  input.addEventListener('input', () => {
    const match = input.value.trim() === clientName.trim();
    btn.disabled = !match;
    btn.style.opacity = match ? '1' : '0.4';
  });
  setTimeout(() => input.focus(), 100);
}

async function confirmPermanentDeleteClient(clientId) {
  document.getElementById('modalPermanentDelete')?.remove();
  const result = await window.api.clientDelete(clientId);
  if (result?.error) {
    showToast(result.error, 'var(--red)');
    return;
  }
  showToast('Клиент удалён безвозвратно', 'var(--red)');
  await loadArchiveList();
  await updateBadges();
}

async function restoreClient(clientId) {
  await window.api.clientUpdate(clientId, { archived: 0, archived_at: '' });
  showToast('Клиент восстановлен ✓', 'var(--green)');
  await loadArchiveList();
  await updateBadges();
}
