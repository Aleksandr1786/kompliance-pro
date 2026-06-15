// ============================================================
// КОМПЛАЕНСПРО — docs-generation.js
// Генерация документов, открытие файлов и папки клиента
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================

// ── ГЕНЕРАЦИЯ ДОКУМЕНТОВ ─────────────────────────────────
async function generateDocs(clientId, scope = 'OT') {
  const MODULE_NAMES = { OT:'Охрана труда', PD:'Персональные данные', VU:'Воинский учёт', ALL:'все модули' };
  const moduleName = MODULE_NAMES[scope] || '';
  showToast('⚙️ Формирую: ' + moduleName + '...');
  const result = await window.api.docsGenerate(clientId, scope);
  if (!result.ok) {
    showToast('Ошибка: ' + result.error, 'var(--red)');
    return;
  }

  // Показываем отчёт об изменениях
  const r = result.report || {};
  const updated   = r.updated   || [];
  const added     = r.added     || [];
  const unchanged = r.unchanged || [];
  const archived  = r.archived  || [];
  const errors    = result.errors || [];

  // Формируем модальное окно с отчётом
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999';

  const cleanName = n => n.replace(/_/g,' ').replace(/\.docx$/i,'').replace(/^\d{2}\.\d{2}\s*/,'').replace(/Приказ\s+\d+\s*/gi,'Приказ ').replace(/ИОТ\s+\d+\s*/gi,'ИОТ ').trim();

  const makeList = (items, color, icon) => items.length
    ? items.map(n => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <span style="font-size:12px">${icon}</span>
        <span style="font-size:12px;color:${color}">${cleanName(n)}</span>
      </div>`).join('')
    : '';

  const hasChanges = updated.length > 0 || added.length > 0;

  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:560px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="font-size:28px">${hasChanges ? '🔄' : '✅'}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">Отчёт сформирован${moduleName ? ' — ' + moduleName : ''}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">
            ${hasChanges
              ? `Обновлено ${updated.length + added.length} из ${result.generated.length} документов`
              : `Все ${result.generated.length} документов актуальны`}
          </div>
        </div>
      </div>

      ${added.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#34d399;letter-spacing:.5px;margin-bottom:6px">➕ НОВЫЕ ДОКУМЕНТЫ (${added.length})</div>
        <div style="background:rgba(52,211,153,0.05);border:1px solid rgba(52,211,153,0.15);border-radius:8px;padding:8px 12px">
          ${makeList(added, '#34d399', '📄')}
        </div>
      </div>` : ''}

      ${updated.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#60a5fa;letter-spacing:.5px;margin-bottom:6px">🔄 ОБНОВЛЕНЫ (${updated.length})</div>
        <div style="background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.15);border-radius:8px;padding:8px 12px">
          ${makeList(updated, '#60a5fa', '📝')}
        </div>
      </div>` : ''}

      ${unchanged.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:.5px;margin-bottom:6px">✓ БЕЗ ИЗМЕНЕНИЙ (${unchanged.length})</div>
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px 12px">
          ${makeList(unchanged, '#64748b', '✓')}
        </div>
      </div>` : ''}

      ${archived.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#a78bfa;letter-spacing:.5px;margin-bottom:6px">🗄 ПРЕДЫДУЩИЕ ВЕРСИИ В АРХИВ (${archived.length})</div>
        <div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.15);border-radius:8px;padding:8px 12px">
          ${archived.map(a => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="font-size:12px">🗄</span>
            <span style="font-size:12px;color:#c4b5fd">${cleanName(a.basename)} → Архив/${a.year}</span>
          </div>`).join('')}
        </div>
      </div>` : ''}

      ${errors.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#f87171;letter-spacing:.5px;margin-bottom:6px">❌ ОШИБКИ (${errors.length})</div>
        <div style="background:rgba(248,113,113,0.05);border:1px solid rgba(248,113,113,0.15);border-radius:8px;padding:8px 12px">
          ${errors.map(e => `<div style="font-size:11px;color:#f87171;padding:3px 0">${e}</div>`).join('')}
        </div>
      </div>` : ''}

      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="this.closest('[style*=fixed]').remove();navigate('client',${clientId})" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Закрыть</button>
        ${result.dir ? `<button onclick="window.api.docsOpenFolder('${result.dir.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}');this.closest('[style*=fixed]').remove();navigate('client',${clientId})" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">📁 Открыть папку</button>` : ''}
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', ev => { if (ev.target === modal) { modal.remove(); navigate('client', clientId); } });
}

function openDocFile(filepath, event) {
  if (event) event.stopPropagation();
  window.api.docsOpenFile(filepath);
}

// Глобальная переменная для папки текущего клиента
let _currentClientDocDir = null;

function openClientFolder() {
  if (_currentClientDocDir) window.api.docsOpenFolder(_currentClientDocDir);
}
