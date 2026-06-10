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
        <div style="font-size:13px;font-weight:600;color:var(--muted)">${c.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.form||''} · Архивирован: ${c.archived_at||'—'}</div>
      </div>
      <button class="btn btn-ghost" style="padding:5px 12px;font-size:11px;color:var(--green);border-color:rgba(52,211,153,0.3)" onclick="restoreClient(${c.id})">
        ${ic('refresh',12)} Восстановить
      </button>
    </div>
  `).join('');
}

async function restoreClient(clientId) {
  await window.api.clientUpdate(clientId, { archived: 0, archived_at: '' });
  showToast('Клиент восстановлен ✓', 'var(--green)');
  await loadArchiveList();
  await updateBadges();
}
