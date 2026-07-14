// ============================================================
// КОМПЛАЕНСПРО — npa-audit.js
// Аудит актуальности цитат НПА в коде генераторов документов —
// отдельно от мониторинга изменений (pd.js/ot.js/vu.js лента).
// Разница: та лента ловит НОВЫЕ акты, меняющие уже занесённый в
// NPA_WATCHLIST номер. Этот экран проверяет сам факт — правилен ли
// и актуален ли номер, который у нас записан, прямо сейчас (ловит
// изначально неверно указанные номера, переименования, отмену).
// См. main.js: checkNpaCitations(). Решение вынести в отдельный
// экран, а не в задачи — чат 19, 09.07.2026: это технический аудит
// кода, не клиентская задача, и нужна полная история проверок.
// ============================================================

async function renderNpaAudit() {
  const content = document.getElementById('content');

  // Экранирование HTML для текста из внешних источников (pravo.gov.ru,
  // ответы ИИ-прокси) перед вставкой в innerHTML — без этого чужой текст,
  // случайно (или намеренно) содержащий HTML-теги, выполнился бы прямо в
  // окне приложения. Определяем один раз глобально (если ещё не
  // определена), чтобы другие модули рендерера могли переиспользовать ту
  // же функцию вместо копипасты по всему проекту.
  if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function escapeHtml(str) {
      return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[ch]));
    };
  }
  const esc = window.escapeHtml;

  const auditAll = await window.api.npaCitationAuditList(); // новые → старые
  const settings = await window.api.settingsGet().catch(() => ({}));

  // Берём только ПОСЛЕДНЮЮ проверку по каждому коду акта — это текущий
  // срез состояния. Полная история при этом остаётся в БД (auditAll),
  // не теряется — просто здесь показываем актуальное на сейчас.
  const latestByCode = new Map();
  for (const rec of auditAll) {
    if (!latestByCode.has(rec.code)) latestByCode.set(rec.code, rec);
  }
  const latest = [...latestByCode.values()];

  const problems     = latest.filter(r => r.status === 'not_found' || r.status === 'mismatch');
  const needsReview  = latest.filter(r => r.status === 'needs_review');
  const ok           = latest.filter(r => r.status === 'ok');

  const lastCheckDate = settings.npa_citation_last_check_date || '';
  const neverChecked = auditAll.length === 0;

  const STATUS_LABELS = {
    not_found:    { label: 'Номер не найден',        color: '#f87171' },
    mismatch:     { label: 'Несоответствие',          color: '#f87171' },
    needs_review: { label: 'Требует проверки',        color: '#fb923c' },
    ok:           { label: 'Актуален',                color: '#4ade80' },
  };

  function renderCard(r) {
    const st = STATUS_LABELS[r.status] || { label: r.status, color: '#94a3b8' };
    const dateStr = (r.checked_at || '').slice(0, 10);
    return `<div style="padding:12px 14px;background:rgba(255,255,255,0.02);border-left:3px solid ${st.color};border-radius:8px;opacity:${r.seen && r.status !== 'ok' ? 0.6 : 1}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
            <span style="font-size:10px;color:#64748b">${dateStr}</span>
            <span style="font-size:10px;font-weight:800;color:#fff;background:${st.color};padding:1px 8px;border-radius:8px">${st.label}</span>
          </div>
          <div style="font-size:12px;color:#f1f5f9;font-weight:600;line-height:1.4">${esc(r.label || '')}</div>
          ${r.found_title ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;line-height:1.5"><b>Найдено на pravo.gov.ru:</b> ${esc(r.found_title)}</div>` : ''}
          ${r.ai_note ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;line-height:1.5">${esc(r.ai_note)}</div>` : ''}
          ${r.ai_suggested_fix ? `<div style="font-size:11px;color:#fbbf24;margin-top:8px;line-height:1.5;padding:8px 10px;background:rgba(251,191,36,0.08);border-radius:6px"><b>Предварительный вариант замены (требует ручной проверки):</b><br>${esc(r.ai_suggested_fix)}</div>` : ''}
          ${(r.status !== 'ok' && r.relatedDocs && r.relatedDocs.length) ? `<div style="font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.5"><b>Документы для перегенерации после исправления:</b><br>${esc(r.relatedDocs.join(', '))}</div>` : ''}
        </div>
        ${!r.seen ? `<button class="btn btn-ghost" style="padding:3px 8px;font-size:10px;flex-shrink:0" onclick="markCitationSeen(${r.id})">✓</button>` : ''}
      </div>
    </div>`;
  }

  function renderGroup(id, label, color, bg, items, open) {
    if (!items.length) return '';
    return `<div style="border:1px solid ${bg};border-radius:8px;overflow:hidden;margin-bottom:8px">
      <div onclick="var el=document.getElementById('npa-audit-${id}');el.style.display=el.style.display==='none'?'block':'none'"
        style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${bg};cursor:pointer">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-weight:700;color:${color}">${label}</span>
          <span style="font-size:10px;color:#fff;background:${color};padding:1px 7px;border-radius:8px;font-weight:800">${items.length}</span>
        </div>
        <span style="font-size:10px;color:#64748b">▼</span>
      </div>
      <div id="npa-audit-${id}" style="display:${open ? 'block' : 'none'}">
        <div style="padding:10px;display:grid;gap:6px">${items.map(renderCard).join('')}</div>
      </div>
    </div>`;
  }

  content.innerHTML = `
    <div style="display:grid;gap:16px;max-width:900px">

      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--text)">Аудит актуальности цитат НПА</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.5">
              Проверяем, что номера нормативных актов, зашитые в генераторах документов,
              всё ещё корректны и актуальны — отдельно от ленты изменений в модулях ОТ/ПДн/ВУ.
              ${lastCheckDate ? `Последняя проверка: ${lastCheckDate}.` : 'Проверка ещё не запускалась.'}
            </div>
          </div>
          <button class="btn btn-primary" style="padding:8px 16px;font-size:12px;flex-shrink:0" onclick="checkCitationsNow()">🔄 Проверить сейчас</button>
        </div>
        <div id="npa-audit-progress-wrap" style="display:none;margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span id="npa-audit-progress-label" style="font-size:11px;color:#94a3b8"></span>
            <span id="npa-audit-progress-count" style="font-size:11px;color:#94a3b8;font-weight:700"></span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
            <div id="npa-audit-progress-bar" style="height:100%;width:0%;background:#60a5fa;border-radius:4px;transition:width 0.3s ease"></div>
          </div>
        </div>
      </div>

      ${neverChecked ? `
        <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center;color:#94a3b8;font-size:12px">
          Проверка ещё не запускалась. Нажмите «Проверить сейчас» — автоматически это будет
          происходить раз в 30 дней, но можно проверить в любой момент вручную.
        </div>
      ` : `
        <div>
          ${renderGroup('problems','⚠ Проблемы — требуют внимания','#f87171','rgba(248,113,113,0.08)',problems,true)}
          ${renderGroup('review','? Требует проверки','#fb923c','rgba(251,146,60,0.08)',needsReview,true)}
          ${renderGroup('ok','✓ Актуальны','#4ade80','rgba(74,222,128,0.08)',ok,false)}
        </div>
      `}

    </div>
  `;
}

async function markCitationSeen(id) {
  await window.api.npaCitationMarkSeen(id);
  renderNpaAudit();
  if (typeof updateBadges === 'function') updateBadges();
}

// Подписка на прогресс — регистрируем один раз при загрузке модуля, а не
// внутри checkCitationsNow(), иначе каждое нажатие кнопки добавляло бы
// ещё один обработчик поверх старых (preload.js не даёт снять слушатель).
// Обновляем полосу прогресса в DOM напрямую, а не через showToast —
// тост на каждый акт (раз в 1.5 сек, ~25 раз за прогон) быстро надоедает,
// репорт от 09.07.2026.
if (!window.__npaCitationProgressBound) {
  window.__npaCitationProgressBound = true;
  window.api.onNpaCitationProgress((d) => {
    const wrap  = document.getElementById('npa-audit-progress-wrap');
    const bar   = document.getElementById('npa-audit-progress-bar');
    const label = document.getElementById('npa-audit-progress-label');
    const count = document.getElementById('npa-audit-progress-count');
    if (!wrap || !bar || !label || !count) return; // страница уже не открыта — молча игнорируем
    wrap.style.display = 'block';
    const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
    bar.style.width = pct + '%';
    label.textContent = d.current || '';
    count.textContent = `${d.done} / ${d.total}`;
  });
}

async function checkCitationsNow() {
  const wrap = document.getElementById('npa-audit-progress-wrap');
  const bar = document.getElementById('npa-audit-progress-bar');
  if (wrap && bar) { wrap.style.display = 'block'; bar.style.width = '0%'; }
  showToast('Проверяем актуальность НПА на pravo.gov.ru... это может занять пару минут');
  try {
    const res = await window.api.npaCheckCitationsNow();
    if (res && res.ok) {
      const needsReviewCount = (res.results || []).filter(r => r.status === 'needs_review').length;
      let msg, color;
      if (res.problemsFound > 0) {
        msg = `Проверка завершена — найдено ${res.problemsFound} проблем(ы)`;
        color = 'var(--red)';
      } else if (needsReviewCount > 0) {
        msg = `Проверка завершена — ${needsReviewCount} акт(ов) требуют ручной проверки (не удалось однозначно подтвердить)`;
        color = 'var(--amber)';
      } else {
        msg = 'Проверка завершена — всё актуально';
        color = 'var(--green)';
      }
      showToast(msg, color);
    } else {
      showToast('Не удалось проверить', 'var(--red)');
    }
  } catch (e) {
    showToast('Нет связи с pravo.gov.ru', 'var(--red)');
  }
  renderNpaAudit();
  // Бейдж в сайдбаре обновляется штатно только при переходе между
  // страницами (см. navigate() в navigation.js) — без этого вызова
  // счётчик оставался "замороженным" до следующей смены вкладки, даже
  // если сама проверка уже нашла другое число проблем (репорт 09.07.2026).
  if (typeof updateBadges === 'function') updateBadges();
}