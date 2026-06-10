// ============================================================
// КОМПЛАЕНСПРО — onboarding.js
// Онбординг, утренний дайджест, навигация
// Выделен из app.js, версия 08.06.2026
// ============================================================

function setupNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });
}

async function checkOnboarding() {
  if (settings.onboarding_done !== '1') {
    showOnboarding();
    return;
  }
}

async function showMorningDigest() {
  if (settings.onboarding_done !== '1') return;

  const hour = new Date().getHours();
  let greeting, greetGrad, bgGrad, accentColor, timeEmoji, timeOfDay;

  if (hour >= 5 && hour < 12) {
    greeting = 'Доброе утро'; timeOfDay = 'morning';
    greetGrad = 'linear-gradient(135deg,#f59e0b,#fbbf24,#fde68a)';
    bgGrad = 'radial-gradient(ellipse at 20% 50%,rgba(245,158,11,0.12) 0%,transparent 60%),linear-gradient(160deg,#0f1419 0%,#141824 100%)';
    accentColor = '#fbbf24'; timeEmoji = ic('sunrise', 40);
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Добрый день'; timeOfDay = 'day';
    greetGrad = 'linear-gradient(135deg,#3b82f6,#60a5fa,#bfdbfe)';
    bgGrad = 'radial-gradient(ellipse at 20% 50%,rgba(59,130,246,0.12) 0%,transparent 60%),linear-gradient(160deg,#0f1419 0%,#141824 100%)';
    accentColor = '#60a5fa'; timeEmoji = ic('sun', 40);
  } else if (hour >= 17 && hour < 22) {
    greeting = 'Добрый вечер'; timeOfDay = 'evening';
    greetGrad = 'linear-gradient(135deg,#6d28d9,#8b5cf6,#c4b5fd)';
    bgGrad = 'radial-gradient(ellipse at 20% 50%,rgba(109,40,217,0.12) 0%,transparent 60%),linear-gradient(160deg,#0f1419 0%,#141824 100%)';
    accentColor = '#8b5cf6'; timeEmoji = ic('sunset', 40);
  } else {
    greeting = 'Доброй ночи'; timeOfDay = 'night';
    greetGrad = 'linear-gradient(135deg,#7c3aed,#a78bfa,#ddd6fe)';
    bgGrad = 'radial-gradient(ellipse at 20% 50%,rgba(124,58,237,0.15) 0%,transparent 60%),linear-gradient(160deg,#0a0d18 0%,#0f1220 100%)';
    accentColor = '#a78bfa'; timeEmoji = ic('moon', 40);
  }

  const name = (settings.user_name || '').split(' ')[0] || 'Коллега';
  const today = new Date().toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' });
  const timeStr = `${String(hour).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`;

  const [tasks, clients, sett] = await Promise.all([
    window.api.tasksList(), getClients(), window.api.settingsGet()
  ]);

  const clientCount = clients.length;
  const doneTasks = tasks.filter(t => t.done).length;
  const openTasks = tasks.filter(t => !t.done).length;

  let totalDocs = 0;
  try { for (const c of clients) { const docs = await window.api.documentsList(c.id); totalDocs += docs.length; } } catch(_) {}

  let hasUrgentReport = false;
  try {
    let submitted = {};
    try { submitted = JSON.parse(sett.reports_submitted || '{}'); } catch(_) {}
    const now = new Date();
    for (const client of clients) {
      const reports = buildClientReports(client, now.getFullYear());
      const urgent = reports.find(r => {
        if (r.dueDate < now) return false;
        const days = Math.ceil((r.dueDate - now) / 86400000);
        return days <= 7 && !submitted[submittedKey(client.id, r.id)];
      });
      if (urgent) { hasUrgentReport = true; break; }
    }
  } catch(_) {}

  const timeDesc = hour < 9 ? 'раннее утро' : hour < 12 ? 'утро' : hour < 14 ? 'полдень' : hour < 17 ? 'день' : hour < 20 ? 'вечер' : hour < 22 ? 'поздний вечер' : 'ночь';

  let secretaryLines = [];
  secretaryLines.push(`${today.charAt(0).toUpperCase() + today.slice(1)}. Сейчас ${timeStr} — ${timeDesc}.`);

  if (clientCount === 0) secretaryLines.push('Готовы к первому клиенту — всё настроено.');
  else if (clientCount === 1) secretaryLines.push('На сопровождении 1 клиент — отличное начало.');
  else if (clientCount <= 5) secretaryLines.push(`Портфель: ${clientCount} клиента${totalDocs ? `, ${totalDocs} документов` : ''}.`);
  else secretaryLines.push(`Серьёзный портфель: ${clientCount} клиентов${totalDocs ? `, ${totalDocs} документов` : ''}.`);

  if (doneTasks > 0 && openTasks === 0) {
    if (timeOfDay === 'evening' || timeOfDay === 'night') secretaryLines.push('Все задачи закрыты — отличный день. ✅');
    else secretaryLines.push(`${doneTasks} ${doneTasks === 1 ? 'задача выполнена' : 'задачи выполнены'} — вы в хорошем темпе. ✅`);
  } else if (doneTasks > 0 && openTasks > 0) {
    secretaryLines.push(`${doneTasks} ${doneTasks === 1 ? 'задача выполнена' : 'задачи выполнены'} ✅ — есть ещё пространство для роста.`);
  } else if (openTasks === 0) {
    if (timeOfDay === 'morning') secretaryLines.push('Чистый старт — день свободен для важного.');
    else secretaryLines.push('Задачи под контролем.');
  } else {
    if (timeOfDay === 'morning') secretaryLines.push('Хороший момент взять задачи в работу.');
    else secretaryLines.push('Есть пара вещей, которые ждут вашего внимания.');
  }

  const facts = [
    'По статистике, 67% проверок ГИТ выявляют нарушения в документации по охране труда. Правильно оформленные документы — лучшая защита.',
    'Роскомнадзор в 2024 году провёл более 2 000 проверок операторов персональных данных. Каждая третья закончилась штрафом.',
    'Средний штраф за нарушение 152-ФЗ вырос в 4 раза с 2022 года — с 75 000 до 300 000 ₽ за одно нарушение.',
    'Исследования показывают: компании с выстроенной системой охраны труда тратят на больничные на 40% меньше.',
    'В России более 6 миллионов юридических лиц обязаны уведомить РКН об обработке персональных данных. Большинство этого не сделали.',
    'Один несчастный случай на производстве обходится работодателю в среднем в 1,5 млн ₽ — штрафы, компенсации, судебные издержки.',
    'Документация по охране труда снижает риск уголовной ответственности руководителя при несчастном случае в 3 раза.',
    'В 2023 году ГИТ провела более 130 000 проверок по всей России. Каждая вторая выявила нарушения.',
    '78% предпринимателей узнают о требованиях 152-ФЗ только получив первый штраф.',
    'Воинский учёт обязателен для всех организаций с 1 сотрудником. Штраф за нарушение — до 500 000 ₽ с 2023 года.',
  ];
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const todayFact = facts[dayOfYear % facts.length];

  const btnLabel = hasUrgentReport ? 'Начать работу — есть кое-что на этой неделе →' : 'Начать работу →';

  const modal = document.createElement('div');
  modal.id = 'morning-digest';
  modal.style.cssText = `position:fixed;inset:0;background:${bgGrad};display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99998`;

  modal.innerHTML = `
    <style>
      @keyframes dg-in { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      @keyframes cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes dg-check-pop { 0%{transform:scale(0) rotate(-45deg);opacity:0} 60%{transform:scale(1.25) rotate(8deg)} 80%{transform:scale(0.9) rotate(-3deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
      @keyframes dg-stroke-in { to { stroke-dashoffset:0 } }
      #dg-inner { animation:dg-in .5s cubic-bezier(.22,.68,0,1.1) both }
      .dg-cursor { display:inline-block;width:2px;height:1em;background:${accentColor};vertical-align:middle;margin-left:2px;animation:cursor-blink .8s infinite }
    </style>
    <div id="dg-inner" style="width:min(620px,90vw);display:flex;flex-direction:column;gap:32px">
      <div style="display:flex;align-items:center;gap:22px">
        <div style="flex-shrink:0;filter:drop-shadow(0 0 20px ${accentColor}55)">${timeEmoji}</div>
        <div><div style="font-size:44px;font-weight:800;letter-spacing:-2px;line-height:1.05;background:${greetGrad};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${greeting}, ${name}!</div></div>
      </div>
      <div style="height:1px;background:linear-gradient(90deg,${accentColor}55,transparent)"></div>
      <div id="dg-secretary" style="display:flex;flex-direction:column;gap:10px;min-height:80px"></div>
      <div id="dg-fact" style="opacity:0;transition:opacity .6s ease;padding:18px 22px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;border-left:3px solid ${accentColor}">
        <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:${accentColor};margin-bottom:8px">ЗНАЕТЕ ЛИ ВЫ</div>
        <div style="font-size:13px;color:#e2e8f0;line-height:1.7">${todayFact}</div>
      </div>
      <div id="dg-btn-wrap" style="opacity:0;transition:opacity .5s ease;display:flex;justify-content:flex-end">
        <button onclick="document.getElementById('morning-digest').remove()" style="padding:13px 36px;background:${greetGrad};border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:opacity .15s;white-space:nowrap;box-shadow:0 4px 20px ${accentColor}44" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">${btnLabel}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  async function typeLines(lines, container, color, delay) {
    await new Promise(r => setTimeout(r, delay));
    for (const line of lines) {
      const hasCheck = line.includes('✅');
      const cleanLine = line.replace('✅', '').trimEnd();
      const el = document.createElement('div');
      el.style.cssText = `font-size:15px;color:${color};line-height:1.6;min-height:24px;display:flex;align-items:center;gap:10px`;
      el.innerHTML = `<span class="dg-cursor"></span>`;
      container.appendChild(el);
      const textNode = document.createTextNode('');
      el.insertBefore(textNode, el.querySelector('.dg-cursor'));
      for (let i = 0; i < cleanLine.length; i++) { textNode.textContent += cleanLine[i]; await new Promise(r => setTimeout(r, 22)); }
      el.querySelector('.dg-cursor')?.remove();
      if (hasCheck) {
        el.style.color = '#00e676';
        const checkWrap = document.createElement('span');
        checkWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);box-shadow:0 0 12px rgba(0,200,83,0.6);flex-shrink:0;animation:dg-check-pop .45s cubic-bezier(.22,.68,0,1.4) both';
        checkWrap.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14" style="animation:dg-stroke-in .35s ease .1s forwards"/></svg>';
        el.appendChild(checkWrap);
      }
      await new Promise(r => setTimeout(r, 300));
    }
    const factEl = document.getElementById('dg-fact');
    const btnEl = document.getElementById('dg-btn-wrap');
    if (factEl) factEl.style.opacity = '1';
    await new Promise(r => setTimeout(r, 400));
    if (btnEl) btnEl.style.opacity = '1';
  }

  typeLines(secretaryLines, document.getElementById('dg-secretary'), '#94a3b8', 400);
}
function showOnboarding() {
  let step = 0;
  const modal = document.createElement('div');
  modal.id = 'onboarding-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999';

  function render() {
    // Шаг 0: WELCOME + EULA
    if (step === 0) {
      modal.innerHTML = `
        <style>
          @keyframes ob-in { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
          @keyframes ob-float { 0%,100%{transform:translateY(0px) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
          @keyframes ob-pulse-ring { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.55);opacity:0} }
          .ob-feature { animation:ob-in .5s cubic-bezier(.22,.68,0,1.1) both }
          .ob-feature:nth-child(1){animation-delay:.15s}
          .ob-feature:nth-child(2){animation-delay:.25s}
          .ob-feature:nth-child(3){animation-delay:.35s}
        </style>
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 40%,rgba(59,130,246,0.18) 0%,transparent 55%),radial-gradient(ellipse at 75% 70%,rgba(139,92,246,0.14) 0%,transparent 50%),linear-gradient(160deg,#080c14 0%,#0f1420 60%,#0a0d1a 100%);display:flex;align-items:center;justify-content:center;overflow:hidden">
          <div style="display:flex;align-items:center;gap:80px;max-width:960px;width:100%;padding:0 60px;animation:ob-in .6s cubic-bezier(.22,.68,0,1.1) both">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:36px">
                <div style="position:relative;width:52px;height:52px">
                  <div style="position:absolute;inset:0;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);opacity:.15;animation:ob-pulse-ring 2.5s ease-out infinite"></div>
                  <div style="position:relative;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#1d4ed8,#6d28d9);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(59,130,246,0.35)">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                </div>
                <div><div style="font-size:20px;font-weight:800;color:#f1f5f9">КомплаенсПро</div><div style="font-size:11px;color:#4b6cb7;font-weight:500;letter-spacing:.5px">ПРОФЕССИОНАЛЬНЫЙ КОМПЛАЕНС</div></div>
              </div>
              <div style="font-size:36px;font-weight:800;color:#f1f5f9;line-height:1.15;margin-bottom:16px;letter-spacing:-.5px">Ваш бизнес<br>под надёжной<br><span style="background:linear-gradient(90deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">защитой</span></div>
              <div style="font-size:14px;color:#64748b;line-height:1.7;margin-bottom:36px;max-width:360px">Автоматизация охраны труда, персональных данных и воинского учёта. Вместо рутины — уверенность.</div>
              <div style="margin-bottom:28px">
                <label id="ob-eula-label" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:12px;color:#475569;line-height:1.5;transition:color .2s">
                  <input type="checkbox" id="eula-accept" style="width:15px;height:15px;margin-top:2px;flex-shrink:0;accent-color:#3b82f6;cursor:pointer">
                  <span>Принимаю <span style="color:#3b82f6;text-decoration:underline;cursor:pointer" onclick="showEulaModal()">условия лицензионного соглашения</span> и подтверждаю, что являюсь специалистом в области комплаенса</span>
                </label>
              </div>
              <button onclick="onboardingNext()" style="padding:14px 36px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.2px;box-shadow:0 8px 24px rgba(59,130,246,0.35);display:inline-flex;align-items:center;gap:8px">Начать работу <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
            </div>
            <div style="flex:0 0 320px;display:flex;flex-direction:column;gap:12px">
              ${[
                { color:'#34d399', title:'36+ документов', sub:'Охрана труда и ПДн за 30 секунд' },
                { color:'#60a5fa', title:'Контроль сроков', sub:'Отчётность и обучение — без пропусков' },
                { color:'#fbbf24', title:'Симулятор ГИТ и РКН', sub:'Готовность к проверке — в одном экране' },
                { color:'#a78bfa', title:'Мультиклиентская база', sub:'Все организации в одном месте' },
              ].map(f => `<div class="ob-feature" style="padding:18px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;display:flex;align-items:center;gap:16px"><div style="width:42px;height:42px;border-radius:12px;background:${f.color}22;border:1px solid ${f.color}44;display:flex;align-items:center;justify-content:center;flex-shrink:0"><div style="width:8px;height:8px;border-radius:50%;background:${f.color}"></div></div><div><div style="font-size:13px;font-weight:700;color:#e2e8f0">${f.title}</div><div style="font-size:11px;color:#475569;margin-top:2px">${f.sub}</div></div></div>`).join('')}
            </div>
          </div>
        </div>`;
      return;
    }

    // Шаг 1: ПРОФИЛЬ
    if (step === 1) {
      modal.innerHTML = `
        <style>@keyframes ob-card-in { from{opacity:0;transform:scale(.96) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }</style>
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 60% 30%,rgba(59,130,246,0.12) 0%,transparent 55%),linear-gradient(160deg,#080c14 0%,#0f1420 100%);display:flex;align-items:center;justify-content:center">
          <div style="background:#111827;border:1px solid rgba(255,255,255,0.09);border-radius:24px;padding:40px;width:440px;box-shadow:0 32px 80px rgba(0,0,0,0.7);animation:ob-card-in .4s cubic-bezier(.22,.68,0,1.1) both">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:32px"><div style="flex:1;height:3px;border-radius:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6)"></div><div style="flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,0.1)"></div><div style="font-size:10px;color:#334155;margin-left:6px">1 / 2</div></div>
            <div style="display:flex;align-items:center;gap:18px;margin-bottom:28px">
              <div id="ob-avatar" style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#2563eb22,#7c3aed22);border:2px solid rgba(99,102,241,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#818cf8">—</div>
              <div><div style="font-size:17px;font-weight:700;color:#f1f5f9">Расскажите о себе</div><div style="font-size:12px;color:#475569;margin-top:3px">Эти данные попадут в реквизиты документов</div></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:28px">
              <div><label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;display:block;margin-bottom:6px">Ваше имя *</label><input id="ob-name" value="${settings.user_name||''}" placeholder="Александр Свинцов" oninput="const v=this.value.trim();const av=document.getElementById('ob-avatar');av.textContent=getInitials(v)||'—'" style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box"></div>
              <div><label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;display:block;margin-bottom:6px">Должность</label><input id="ob-position" value="${settings.user_position||''}" placeholder="Специалист по охране труда" style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box"></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div><label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;display:block;margin-bottom:6px">Компания</label><input id="ob-company" value="${settings.company_name||''}" placeholder="ИП Свинцов А.В." style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box"></div>
                <div><label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;display:block;margin-bottom:6px">Телефон</label><input id="ob-phone" value="${settings.user_phone||''}" placeholder="+7 961 519-24-00" style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box"></div>
              </div>
            </div>
            <button onclick="onboardingNext()" style="width:100%;padding:13px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:11px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center;gap:8px">Продолжить <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
          </div>
        </div>`;
      const nm = document.getElementById('ob-name');
      if (nm?.value) nm.dispatchEvent(new Event('input'));
      return;
    }

    // Шаг 2: ГОТОВО
    if (step === 2) {
      const firstName = (settings.user_name || '').split(' ')[0] || 'Коллега';
      modal.innerHTML = `
        <style>@keyframes ob-card-in { from{opacity:0;transform:scale(.96) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }</style>
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(52,211,153,0.1) 0%,transparent 55%),linear-gradient(160deg,#080c14 0%,#0f1420 100%);display:flex;align-items:center;justify-content:center;overflow:hidden">
          <div id="ob-done-card" style="background:#111827;border:1px solid rgba(255,255,255,0.09);border-radius:24px;padding:40px;width:440px;box-shadow:0 32px 80px rgba(0,0,0,0.7);animation:ob-card-in .4s cubic-bezier(.22,.68,0,1.1) both;text-align:center;position:relative">
            <div style="position:relative;width:72px;height:72px;margin:0 auto 24px;display:flex;align-items:center;justify-content:center">
              <div style="position:absolute;inset:0;border-radius:50%;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25)"></div>
              <div id="ob-checkmark" style="animation:ob-check .5s cubic-bezier(.22,.68,0,1.1) .2s both"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
            </div>
            <div style="font-size:22px;font-weight:800;color:#f1f5f9;margin-bottom:8px">Всё готово, ${firstName}!</div>
            <div style="font-size:13px;color:#475569;line-height:1.6;margin-bottom:28px">КомплаенсПро настроен и готов к работе.<br>Добавьте первого клиента, чтобы начать.</div>
            <button onclick="onboardingNext()" style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10b981);border:none;border-radius:11px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(16,185,129,0.3);display:flex;align-items:center;justify-content:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Добавить первого клиента</button>
          </div>
        </div>`;
      return;
    }
  }

  window.onboardingNext = async () => {
    if (step === 0) {
      const accepted = document.getElementById('eula-accept')?.checked;
      if (!accepted) { showToast('Необходимо принять условия соглашения', 'var(--amber)'); return; }
      await window.api.settingsSave({ eula_accepted: '1', eula_date: new Date().toISOString() });
      step = 1; render(); return;
    }
    if (step === 1) {
      const name = document.getElementById('ob-name')?.value?.trim();
      if (!name) { showToast('Укажите ваше имя', 'var(--amber)'); return; }
      await window.api.settingsSave({
        user_name: name,
        user_position: document.getElementById('ob-position')?.value?.trim(),
        company_name: document.getElementById('ob-company')?.value?.trim(),
        user_phone: document.getElementById('ob-phone')?.value?.trim(),
      });
      settings = await window.api.settingsGet();
      applySettings();
      step = 2; render(); return;
    }
    if (step === 2) {
      await finishOnboarding();
      openModal('modalAddClient');
      return;
    }
  };

  async function finishOnboarding() {
    await window.api.settingsSave({ onboarding_done: '1' });
    settings = await window.api.settingsGet();
    modal.remove();
    showToast('✅ Добро пожаловать в КомплаенсПро!');
  }

  window.showEulaModal = () => {
    let em = document.getElementById('eula-full-modal');
    if (em) { em.remove(); return; }
    em = document.createElement('div');
    em.id = 'eula-full-modal';
    em.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    em.innerHTML = `<div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;width:500px;max-height:80vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,0.8)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px"><div style="font-size:15px;font-weight:700;color:#f1f5f9">Лицензионное соглашение</div><button onclick="document.getElementById('eula-full-modal').remove()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:18px;line-height:1">✕</button></div><div style="font-size:12px;color:#94a3b8;line-height:1.8"><p style="color:#e2e8f0;font-weight:700;margin-bottom:12px">ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ (EULA) — КомплаенсПро</p><p style="margin-bottom:10px"><b style="color:#cbd5e1">1. Назначение программы</b><br>КомплаенсПро — программный инструмент автоматизации делопроизводства в области охраны труда, персональных данных и воинского учёта. Предназначен для профессиональных специалистов по комплаенсу.</p><p style="margin-bottom:10px"><b style="color:#cbd5e1">2. Ответственность пользователя</b><br>Пользователь самостоятельно несёт ответственность за корректность вносимых данных, соответствие документов актуальному законодательству и правильность их применения.</p><p style="margin-bottom:10px"><b style="color:#cbd5e1">3. Ограничение ответственности разработчика</b><br>Программа предоставляется «как есть». Разработчик не несёт ответственности за последствия использования сформированных документов и убытки от применения рекомендаций программы.</p><p style="margin-bottom:10px"><b style="color:#cbd5e1">4. Актуальность законодательства</b><br>Программа обновляется по мере изменений законодательства. Пользователь обязан самостоятельно отслеживать изменения нормативно-правовой базы.</p><p style="margin-bottom:10px"><b style="color:#cbd5e1">5. Конфиденциальность данных</b><br>Все данные хранятся локально на устройстве пользователя. Разработчик не имеет доступа к данным клиентов.</p><p style="margin-bottom:10px"><b style="color:#cbd5e1">6. Интеллектуальная собственность</b><br>КомплаенсПро защищён авторским правом. Копирование, распространение и декомпиляция запрещены без письменного согласия правообладателя.</p><p><b style="color:#cbd5e1">7. Принятие условий</b><br>Нажимая «Начать работу», вы подтверждаете согласие со всеми условиями настоящего соглашения.</p></div></div>`;
    em.onclick = e => { if (e.target === em) em.remove(); };
    document.body.appendChild(em);
  };

  render();
  document.body.appendChild(modal);
}