// ============================================================
// КОМПЛАЕНСПРО — readiness-calc.js
// Единые формулы готовности по модулям (ОТ/ПДн/ВУ).
// Извлечены 1:1 из readiness.js (ОТ), pd.js (ПДн), vu.js (ВУ),
// чтобы Центр готовности и дашборд аутсорсера показывали ОДНО
// И ТО ЖЕ число, а не три независимо посчитанные версии правды.
// Подключать в index.html РАНЬШЕ readiness.js/pd.js/vu.js/dashboard.js.
// 17.06.2026
// ============================================================

// ── ОТ: документы 35 + обучение 25 + данные клиента 25 + сотрудники 15 ──
// Идентично openReadinessCenter() в readiness.js и общему client.score
// в client-card.js. Возвращает realScore (0–100, выше = лучше).
function calcOtReadiness(c, docsOt, emps) {
  const now = new Date();

  let docsScoreP = docsOt.length > 0
    ? Math.round(docsOt.filter(d => d.status === 'ok').length / docsOt.length * 35)
    : 0;

  let trScoreP = 25;
  if (emps.length === 0) {
    trScoreP = 0;
  } else {
    let bad = 0;
    emps.forEach(e => {
      const tr = e.training || {};
      ['prog_a', 'first_aid', 'fire', 'repeat'].forEach(key => {
        const t = tr[key];
        if (!t?.required) return;
        if (!t?.date) { bad++; return; }
        const nx = new Date(t.date);
        if (key === 'repeat') nx.setMonth(nx.getMonth() + 6);
        else nx.setFullYear(nx.getFullYear() + 3);
        const dd = Math.ceil((nx - now) / 86400000);
        if (dd < 0) bad += 2;
        else if (dd <= 14) bad += 1;
      });
    });
    trScoreP = Math.max(0, Math.round((1 - bad / (emps.length * 4)) * 25));
  }

  const reqF = ['inn', 'okved', 'manager_name', 'manager_position', 'address', 'city', 'phone', 'staff', 'region', 'form'];
  const fF = reqF.filter(k => c[k] && String(c[k]).trim() !== '' && String(c[k]) !== '0').length;
  const dataScoreP = Math.round(fF / reqF.length * 25);

  let empScoreP = 0;
  if (emps.length > 0) {
    empScoreP = Math.round(emps.filter(e => e.position && e.position.trim()).length / emps.length * 15);
  }

  return Math.min(100, docsScoreP + trScoreP + dataScoreP + empScoreP);
}

// ── ПДн: документы 35 + уведомление РКН 25 + ответственный 25 + ИСПДн 15 ──
// Идентично началу renderPdReadiness() в pd.js.
function calcPdReadiness(c, docsPd) {
  let score = 0;
  if (docsPd.length > 0) score += 35;
  if (c.pd_notified_rkn) score += 25;
  if (c.pd_responsible_name) score += 25;
  if ((c.pd_ispdn_list || []).length > 0) score += 15;
  return score;
}

// ── ВУ: равновесный чек-лист (доля выполненных проверок) ──
// Идентично расчёту checks/scorePct в renderVuReadiness() в vu.js.
// vuData — это JSON.parse(settings['vu_data_' + clientId] || '{}').
function calcVuReadiness(c, emps, vuData) {
  const vuCount = emps.filter(e => e.vu_category).length;
  const hasBron = vuData.has_bronirowanie === true || vuData.has_bronirowanie === 'true';

  const checks = {
    responsible: !!(vuData.responsible_name && vuData.order_number),
    plan:        !!(vuData.last_reconciliation),
    journal:     !!vuData.journal_started,
    regulation:  !!vuData.regulation_done,
    cards:       !!vuData.cards_filled,
    emps:        vuCount > 0 || emps.length === 0,
  };
  if (hasBron) {
    checks.bron_codes = !!(vuData.bron_codes);
    checks.gov_organ  = !!(vuData.gov_organ);
  }

  return Math.round(Object.values(checks).filter(Boolean).length / Object.keys(checks).length * 100);
}

// ── Хелпер для дашборда: безопасный парс vu_data из settings ──
function parseVuData(settings, clientId) {
  try { return JSON.parse(settings[`vu_data_${clientId}`] || '{}'); }
  catch (_) { return {}; }
}
