// ============================================================
// КОМПЛАЕНСПРО — onboarding.js
// Онбординг первого запуска, утренний дайджест
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================

// ─── ОНБОРДИНГ ───────────────────────────────────────────
async function checkOnboarding() {
  // Показываем только при первом запуске
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
    greeting    = 'Доброе утро';
    timeOfDay   = 'morning';
    greetGrad   = 'linear-gradient(135deg,#f59e0b,#fbbf24,#fde68a)';
    bgGrad      = 'radial-gradient(ellipse at 20% 50%,rgba(245,158,11,0.12) 0%,transparent 60%),linear-gradient(160deg,#0f1419 0%,#141824 100%)';
    accentColor = '#fbbf24';
    timeEmoji   = ic('sunrise', 40);
  } else if (hour >= 12 && hour < 17) {
    greeting    = 'Добрый день';
    timeOfDay   = 'day';
    greetGrad   = 'linear-gradient(135deg,#3b82f6,#60a5fa,#bfdbfe)';
    bgGrad      = 'radial-gradient(ellipse at 20% 50%,rgba(59,130,246,0.12) 0%,transparent 60%),linear-gradient(160deg,#0f1419 0%,#141824 100%)';
    accentColor = '#60a5fa';
    timeEmoji   = ic('sun', 40);
  } else if (hour >= 17 && hour < 22) {
    greeting    = 'Добрый вечер';
    timeOfDay   = 'evening';
    greetGrad   = 'linear-gradient(135deg,#6d28d9,#8b5cf6,#c4b5fd)';
    bgGrad      = 'radial-gradient(ellipse at 20% 50%,rgba(109,40,217,0.12) 0%,transparent 60%),linear-gradient(160deg,#0f1419 0%,#141824 100%)';
    accentColor = '#8b5cf6';
    timeEmoji   = ic('sunset', 40);
  } else {
    greeting    = 'Доброй ночи';
    timeOfDay   = 'night';
    greetGrad   = 'linear-gradient(135deg,#7c3aed,#a78bfa,#ddd6fe)';
    bgGrad      = 'radial-gradient(ellipse at 20% 50%,rgba(124,58,237,0.15) 0%,transparent 60%),linear-gradient(160deg,#0a0d18 0%,#0f1220 100%)';
    accentColor = '#a78bfa';
    timeEmoji   = ic('moon', 40);
  }

  const name   = (settings.user_name || '').split(' ')[0] || 'Коллега';
  const today  = new Date().toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' });
  const timeStr = `${String(hour).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`;

  const [tasks, clients, sett] = await Promise.all([
    window.api.tasksList(),
    getClients(),
    window.api.settingsGet(),
  ]);

  // ── Считаем достижения (только позитив) ──────────────────
  const clientCount  = clients.length;
  const doneTasks    = tasks.filter(t => t.done).length;
  const openTasks    = tasks.filter(t => !t.done).length;

  // Средний score по всем клиентам (упрощённо — по наличию документов)
  let totalDocs = 0;
  try {
    for (const c of clients) {
      const docs = await window.api.documentsList(c.id);
      totalDocs += docs.length;
    }
  } catch(_) {}

  // Ближайший отчёт — только намёк, без деталей
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

  // ── Строки секретаря — только позитив ────────────────────
  const timeDesc = hour < 9 ? 'раннее утро' : hour < 12 ? 'утро' :
    hour < 14 ? 'полдень' : hour < 17 ? 'день' :
    hour < 20 ? 'вечер' : hour < 22 ? 'поздний вечер' : 'ночь';

  let secretaryLines = [];

  // Строка 1: дата + время
  secretaryLines.push(`${today.charAt(0).toUpperCase() + today.slice(1)}. Сейчас ${timeStr} — ${timeDesc}.`);

  // Строка 2: портфель клиентов — всегда позитивно
  if (clientCount === 0) {
    secretaryLines.push('Готовы к первому клиенту — всё настроено.');
  } else if (clientCount === 1) {
    secretaryLines.push('На сопровождении 1 клиент — отличное начало.');
  } else if (clientCount <= 5) {
    secretaryLines.push(`Портфель: ${clientCount} клиента${totalDocs ? `, ${totalDocs} документов` : ''}.`);
  } else {
    secretaryLines.push(`Серьёзный портфель: ${clientCount} клиентов${totalDocs ? `, ${totalDocs} документов` : ''}.`);
  }

  // Строка 3: задачи — фокус на достижениях, не на долгах
  if (doneTasks > 0 && openTasks === 0) {
    if (timeOfDay === 'evening' || timeOfDay === 'night') {
      secretaryLines.push(`Все задачи закрыты — отличный день. ✅`);
    } else {
      secretaryLines.push(`${doneTasks} ${doneTasks === 1 ? 'задача выполнена' : 'задачи выполнены'} — вы в хорошем темпе. ✅`);
    }
  } else if (doneTasks > 0 && openTasks > 0) {
    secretaryLines.push(`${doneTasks} ${doneTasks === 1 ? 'задача выполнена' : 'задачи выполнены'} ✅ — есть ещё пространство для роста.`);
  } else if (openTasks === 0) {
    if (timeOfDay === 'morning') secretaryLines.push('Чистый старт — день свободен для важного.');
    else secretaryLines.push('Задачи под контролем.');
  } else {
    // Есть открытые — но говорим о них мягко, без цифр и тревоги
    if (timeOfDay === 'morning') secretaryLines.push('Хороший момент взять задачи в работу.');
    else secretaryLines.push('Есть пара вещей, которые ждут вашего внимания.');
  }

  // Факт дня
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
    'Согласие на обработку персональных данных недействительно, если оно "спрятано" в договоре мелким шрифтом — прямое нарушение 152-ФЗ.',
    'Каждый пятый работодатель не знает, что обязан проводить повторный инструктаж по охране труда каждые 6 месяцев.',
    'Утечка персональных данных стоила российским компаниям в 2024 году более 60 млрд ₽ репутационных и финансовых потерь.',
    'По закону, сотрудник вправе потребовать уничтожить его персональные данные после увольнения — работодатель обязан выполнить это за 30 дней.',
    'Правильно оформленная СОУТ снижает страховые взносы в ФСС до 40% для вредных производств.',
    'Медосмотр — не право, а обязанность работодателя для 52 видов работ по приказу Минздрава № 29н.',
    'Роскомнадзор может проверить любую организацию без предупреждения по жалобе одного гражданина.',
    'Журнал вводного инструктажа без подписи сотрудника юридически равнозначен его полному отсутствию.',
    'Аутсорсинг комплаенса снижает издержки на соответствие требованиям в среднем на 35% по сравнению со штатным специалистом.',
    'С 2024 года штраф за повторную утечку персональных данных рассчитывается от оборота компании — минимум 1%.',
    'Каждый третий трудовой спор в суде связан с ненадлежащим оформлением документов при приёме на работу.',
    'Политика обработки персональных данных обязана быть в открытом доступе — на сайте или информационном стенде.',
    'Обучение по охране труда без утверждённой программы считается непроведённым с точки зрения ГИТ.',
    'Компании с выстроенным комплаенсом продаются на 20–30% дороже при сделках M&A — это готовая прозрачная структура.',
    'По данным ВОЗ, правильная организация условий труда повышает производительность сотрудников на 21%.',
    'Роскомнадзор ввёл обязательную регистрацию всех ИСПДн в 2022 году. Незарегистрированная система — автоматическое нарушение.',
    'Срок хранения кадровых документов — 75 лет. Электронный архив с резервным копированием — обязательное условие для ИСПДн.',
    'Каждый рубль, вложенный в охрану труда, экономит 7 рублей на лечении, компенсациях и простоях — данные Минтруда РФ.',
    'Инспектор ГИТ вправе запросить любой документ по охране труда за последние 3 года.',
    'Назначение ответственного за ПДн без оформления приказа не имеет юридической силы — только письменный приказ.',
  ];
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const todayFact = facts[dayOfYear % facts.length];

  // ── Кнопка: с мягким намёком если есть срочное ───────────
  const btnLabel = hasUrgentReport
    ? 'Начать работу — есть кое-что на этой неделе →'
    : 'Начать работу →';

  const modal = document.createElement('div');
  modal.id = 'morning-digest';
  modal.style.cssText = `position:fixed;inset:0;background:${bgGrad};display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99998`;

  modal.innerHTML = `
    <style>
      @keyframes dg-in  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      @keyframes cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes dg-check-pop {
        0%   { transform:scale(0) rotate(-45deg); opacity:0 }
        60%  { transform:scale(1.25) rotate(8deg) }
        80%  { transform:scale(0.9) rotate(-3deg) }
        100% { transform:scale(1) rotate(0deg); opacity:1 }
      }
      @keyframes dg-stroke-in {
        to { stroke-dashoffset:0 }
      }
      @keyframes dg-check-glow {
        0%   { box-shadow:0 0 0 0 rgba(0,200,83,0.8) }
        40%  { box-shadow:0 0 0 8px rgba(0,200,83,0.3) }
        100% { box-shadow:0 0 0 14px rgba(0,200,83,0) }
      }
      #dg-inner { animation:dg-in .5s cubic-bezier(.22,.68,0,1.1) both }
      .dg-cursor { display:inline-block;width:2px;height:1em;background:${accentColor};vertical-align:middle;margin-left:2px;animation:cursor-blink .8s infinite }
    </style>

    <div id="dg-inner" style="width:min(620px,90vw);display:flex;flex-direction:column;gap:32px">

      <!-- ПРИВЕТСТВИЕ -->
      <div style="display:flex;align-items:center;gap:22px">
        <div style="flex-shrink:0;filter:drop-shadow(0 0 20px ${accentColor}55)">${timeEmoji}</div>
        <div>
          <div style="
            font-size:44px;font-weight:800;letter-spacing:-2px;line-height:1.05;
            background:${greetGrad};
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text
          ">${greeting}, ${name}!</div>
        </div>
      </div>

      <!-- РАЗДЕЛИТЕЛЬ -->
      <div style="height:1px;background:linear-gradient(90deg,${accentColor}55,transparent)"></div>

      <!-- ТЕКСТ СЕКРЕТАРЯ -->
      <div id="dg-secretary" style="display:flex;flex-direction:column;gap:10px;min-height:80px"></div>

      <!-- ФАКТ ДНЯ -->
      <div id="dg-fact" style="opacity:0;transition:opacity .6s ease;padding:18px 22px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;border-left:3px solid ${accentColor}">
        <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:${accentColor};margin-bottom:8px">ЗНАЕТЕ ЛИ ВЫ</div>
        <div style="font-size:13px;color:#e2e8f0;line-height:1.7">${todayFact}</div>
      </div>

      <!-- КНОПКА -->
      <div id="dg-btn-wrap" style="opacity:0;transition:opacity .5s ease;display:flex;justify-content:flex-end">
        <button onclick="document.getElementById('morning-digest').remove()" style="
          padding:13px 36px;
          background:${greetGrad};
          border:none;border-radius:12px;
          color:#fff;font-size:14px;font-weight:700;
          cursor:pointer;letter-spacing:.3px;
          transition:opacity .15s;white-space:nowrap;
          box-shadow:0 4px 20px ${accentColor}44
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          ${btnLabel}
        </button>
      </div>

    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Анимация печатающегося текста
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

      for (let i = 0; i < cleanLine.length; i++) {
        textNode.textContent += cleanLine[i];
        await new Promise(r => setTimeout(r, 22));
      }

      el.querySelector('.dg-cursor')?.remove();

      if (hasCheck) {
        el.style.color = '#00e676';
        const checkWrap = document.createElement('span');
        checkWrap.style.cssText = [
          'display:inline-flex', 'align-items:center', 'justify-content:center',
          'width:22px', 'height:22px', 'border-radius:50%',
          'background:linear-gradient(135deg,#00c853,#69f0ae)',
          'box-shadow:0 0 12px rgba(0,200,83,0.6)',
          'flex-shrink:0',
          'animation:dg-check-pop .45s cubic-bezier(.22,.68,0,1.4) both'
        ].join(';');
        checkWrap.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14" style="animation:dg-stroke-in .35s ease .1s forwards"/></svg>';
        el.appendChild(checkWrap);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    const factEl = document.getElementById('dg-fact');
    const btnEl  = document.getElementById('dg-btn-wrap');
    if (factEl) factEl.style.opacity = '1';
    await new Promise(r => setTimeout(r, 400));
    if (btnEl) btnEl.style.opacity = '1';
  }

  typeLines(secretaryLines, document.getElementById('dg-secretary'), '#94a3b8', 400);
}

function showOnboarding() {
  let step = 0; // 0 = Welcome+EULA, 1 = Профиль, 2 = Готово
  const modal = document.createElement('div');
  modal.id = 'onboarding-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999';

  function render() {
    // ── ШАГ 0: WELCOME + EULA ──────────────────────────────
    if (step === 0) {
      modal.innerHTML = `
        <style>
          @keyframes ob-in { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
          @keyframes ob-float {
            0%,100%{transform:translateY(0px) rotate(-1deg)}
            50%{transform:translateY(-10px) rotate(1deg)}
          }
          @keyframes ob-pulse-ring {
            0%{transform:scale(1);opacity:.6}
            100%{transform:scale(1.55);opacity:0}
          }
          .ob-feature { animation:ob-in .5s cubic-bezier(.22,.68,0,1.1) both }
          .ob-feature:nth-child(1){animation-delay:.15s}
          .ob-feature:nth-child(2){animation-delay:.25s}
          .ob-feature:nth-child(3){animation-delay:.35s}
        </style>
        <div style="
          position:absolute;inset:0;
          background:radial-gradient(ellipse at 30% 40%,rgba(59,130,246,0.18) 0%,transparent 55%),
                     radial-gradient(ellipse at 75% 70%,rgba(139,92,246,0.14) 0%,transparent 50%),
                     linear-gradient(160deg,#080c14 0%,#0f1420 60%,#0a0d1a 100%);
          display:flex;align-items:center;justify-content:center;overflow:hidden">

          <!-- Декоративные круги фона -->
          <div style="position:absolute;width:500px;height:500px;border-radius:50%;border:1px solid rgba(59,130,246,0.07);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none"></div>
          <div style="position:absolute;width:750px;height:750px;border-radius:50%;border:1px solid rgba(59,130,246,0.04);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none"></div>

          <div style="display:flex;align-items:center;gap:80px;max-width:960px;width:100%;padding:0 60px;animation:ob-in .6s cubic-bezier(.22,.68,0,1.1) both">

            <!-- Левая часть: лого + текст -->
            <div style="flex:1;min-width:0">
              <!-- Лого -->
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:36px">
                <div style="position:relative;width:52px;height:52px">
                  <div style="position:absolute;inset:0;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);opacity:.15;animation:ob-pulse-ring 2.5s ease-out infinite"></div>
                  <div style="position:relative;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#1d4ed8,#6d28d9);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(59,130,246,0.35)">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                </div>
                <div>
                  <div style="font-size:20px;font-weight:800;color:#f1f5f9;letter-spacing:-.3px">КомплаенсПро</div>
                  <div style="font-size:11px;color:#4b6cb7;font-weight:500;letter-spacing:.5px;text-transform:uppercase">Профессиональный комплаенс</div>
                </div>
              </div>

              <!-- Заголовок -->
              <div style="font-size:36px;font-weight:800;color:#f1f5f9;line-height:1.15;margin-bottom:16px;letter-spacing:-.5px">
                Ваш бизнес<br>под надёжной<br><span style="background:linear-gradient(90deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">защитой</span>
              </div>
              <div style="font-size:14px;color:#64748b;line-height:1.7;margin-bottom:36px;max-width:360px">
                Автоматизация охраны труда, персональных данных и воинского учёта. Вместо рутины — уверенность.
              </div>

              <!-- EULA -->
              <div style="margin-bottom:28px">
                <label id="ob-eula-label" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:12px;color:#475569;line-height:1.5;transition:color .2s">
                  <input type="checkbox" id="eula-accept" style="width:15px;height:15px;margin-top:2px;flex-shrink:0;accent-color:#3b82f6;cursor:pointer">
                  <span>Принимаю <span style="color:#3b82f6;text-decoration:underline;cursor:pointer" onclick="showEulaModal()">условия лицензионного соглашения</span> и подтверждаю, что являюсь специалистом в области комплаенса</span>
                </label>
              </div>

              <button onclick="onboardingNext()" style="
                padding:14px 36px;
                background:linear-gradient(135deg,#2563eb,#7c3aed);
                border:none;border-radius:12px;
                color:#fff;font-size:14px;font-weight:700;
                cursor:pointer;letter-spacing:.2px;
                box-shadow:0 8px 24px rgba(59,130,246,0.35);
                transition:all .2s;
                display:inline-flex;align-items:center;gap:8px"
                onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 32px rgba(59,130,246,0.45)'"
                onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 8px 24px rgba(59,130,246,0.35)'">
                Начать работу
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>

            <!-- Правая часть: карточки возможностей -->
            <div style="flex:0 0 320px;display:flex;flex-direction:column;gap:12px">
              <div class="ob-feature" style="padding:18px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;display:flex;align-items:center;gap:16px;backdrop-filter:blur(10px)">
                <div style="width:42px;height:42px;border-radius:12px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <div style="font-size:13px;font-weight:700;color:#e2e8f0">36+ документов</div>
                  <div style="font-size:11px;color:#475569;margin-top:2px">Охрана труда и ПДн за 30 секунд</div>
                </div>
              </div>
              <div class="ob-feature" style="padding:18px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;display:flex;align-items:center;gap:16px;backdrop-filter:blur(10px)">
                <div style="width:42px;height:42px;border-radius:12px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <div style="font-size:13px;font-weight:700;color:#e2e8f0">Контроль сроков</div>
                  <div style="font-size:11px;color:#475569;margin-top:2px">Отчётность и обучение — без пропусков</div>
                </div>
              </div>
              <div class="ob-feature" style="padding:18px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;display:flex;align-items:center;gap:16px;backdrop-filter:blur(10px)">
                <div style="width:42px;height:42px;border-radius:12px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <div style="font-size:13px;font-weight:700;color:#e2e8f0">Симулятор ГИТ и РКН</div>
                  <div style="font-size:11px;color:#475569;margin-top:2px">Готовность к проверке — в одном экране</div>
                </div>
              </div>
              <div class="ob-feature" style="padding:18px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;display:flex;align-items:center;gap:16px;backdrop-filter:blur(10px)">
                <div style="width:42px;height:42px;border-radius:12px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div>
                  <div style="font-size:13px;font-weight:700;color:#e2e8f0">Мультиклиентская база</div>
                  <div style="font-size:11px;color:#475569;margin-top:2px">Все организации в одном месте</div>
                </div>
              </div>
            </div>

          </div>
        </div>`;
      return;
    }

    // ── ШАГ 1: ПРОФИЛЬ ──────────────────────────────────────
    if (step === 1) {
      modal.innerHTML = `
        <style>
          @keyframes ob-card-in { from{opacity:0;transform:scale(.96) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        </style>
        <div style="
          position:absolute;inset:0;
          background:radial-gradient(ellipse at 60% 30%,rgba(59,130,246,0.12) 0%,transparent 55%),
                     linear-gradient(160deg,#080c14 0%,#0f1420 100%);
          display:flex;align-items:center;justify-content:center">
          <div style="background:#111827;border:1px solid rgba(255,255,255,0.09);border-radius:24px;padding:40px;width:440px;box-shadow:0 32px 80px rgba(0,0,0,0.7);animation:ob-card-in .4s cubic-bezier(.22,.68,0,1.1) both">

            <!-- Прогресс -->
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:32px">
              <div style="flex:1;height:3px;border-radius:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6)"></div>
              <div style="flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,0.1)"></div>
              <div style="font-size:10px;color:#334155;margin-left:6px">1 / 2</div>
            </div>

            <!-- Аватар live-preview -->
            <div style="display:flex;align-items:center;gap:18px;margin-bottom:28px">
              <div id="ob-avatar" style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#2563eb22,#7c3aed22);border:2px solid rgba(99,102,241,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#818cf8;flex-shrink:0;transition:all .2s">—</div>
              <div>
                <div style="font-size:17px;font-weight:700;color:#f1f5f9">Расскажите о себе</div>
                <div style="font-size:12px;color:#475569;margin-top:3px">Эти данные попадут в реквизиты документов</div>
              </div>
            </div>

            <!-- Поля -->
            <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:28px">
              <div>
                <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:6px">Ваше имя *</label>
                <input id="ob-name" value="${settings.user_name||''}" placeholder="Александр Свинцов"
                  oninput="const v=this.value.trim();const av=document.getElementById('ob-avatar');av.textContent=getInitials(v)||'—'"
                  style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .2s"
                  onfocus="this.style.borderColor='rgba(59,130,246,0.6)'"
                  onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:6px">Должность</label>
                <input id="ob-position" value="${settings.user_position||''}" placeholder="Специалист по охране труда"
                  style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .2s"
                  onfocus="this.style.borderColor='rgba(59,130,246,0.6)'"
                  onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:6px">Компания</label>
                  <input id="ob-company" value="${settings.company_name||''}" placeholder="ИП Свинцов А.В."
                    style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .2s"
                    onfocus="this.style.borderColor='rgba(59,130,246,0.6)'"
                    onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
                </div>
                <div>
                  <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:6px">Телефон</label>
                  <input id="ob-phone" value="${settings.user_phone||''}" placeholder="+7 961 519-24-00"
                    style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .2s"
                    onfocus="this.style.borderColor='rgba(59,130,246,0.6)'"
                    onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
                </div>
              </div>
            </div>

            <button onclick="onboardingNext()" style="
              width:100%;padding:13px;
              background:linear-gradient(135deg,#2563eb,#7c3aed);
              border:none;border-radius:11px;
              color:#fff;font-size:14px;font-weight:700;cursor:pointer;
              box-shadow:0 6px 20px rgba(59,130,246,0.3);
              transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px"
              onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 10px 28px rgba(59,130,246,0.4)'"
              onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 6px 20px rgba(59,130,246,0.3)'">
              Продолжить
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>`;

      // Запускаем live-аватар если имя уже заполнено
      const nm = document.getElementById('ob-name');
      if (nm?.value) nm.dispatchEvent(new Event('input'));
      return;
    }

    // ── ШАГ 2: ГОТОВО ───────────────────────────────────────
    if (step === 2) {
      const firstName = (settings.user_name || '').split(' ')[0] || 'Коллега';
      modal.innerHTML = `
        <style>
          @keyframes ob-card-in { from{opacity:0;transform:scale(.96) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes ob-check { 0%{transform:scale(0) rotate(-45deg);opacity:0} 60%{transform:scale(1.2) rotate(5deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
          @keyframes ob-confetti { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(-80px) rotate(720deg);opacity:0} }
          .ob-conf { position:absolute;width:6px;height:6px;border-radius:1px;animation:ob-confetti 1.2s ease-out both }
        </style>
        <div style="
          position:absolute;inset:0;
          background:radial-gradient(ellipse at 50% 40%,rgba(52,211,153,0.1) 0%,transparent 55%),
                     linear-gradient(160deg,#080c14 0%,#0f1420 100%);
          display:flex;align-items:center;justify-content:center;overflow:hidden">

          <div id="ob-done-card" style="background:#111827;border:1px solid rgba(255,255,255,0.09);border-radius:24px;padding:40px;width:440px;box-shadow:0 32px 80px rgba(0,0,0,0.7);animation:ob-card-in .4s cubic-bezier(.22,.68,0,1.1) both;text-align:center;position:relative">

            <!-- Иконка успеха -->
            <div style="position:relative;width:72px;height:72px;margin:0 auto 24px;display:flex;align-items:center;justify-content:center">
              <div style="position:absolute;inset:0;border-radius:50%;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25)"></div>
              <div id="ob-checkmark" style="animation:ob-check .5s cubic-bezier(.22,.68,0,1.1) .2s both">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>

            <div style="font-size:22px;font-weight:800;color:#f1f5f9;margin-bottom:8px">Всё готово, ${firstName}!</div>
            <div style="font-size:13px;color:#475569;line-height:1.6;margin-bottom:28px">КомплаенсПро настроен и готов к работе.<br>Добавьте первого клиента, чтобы начать.</div>

            <!-- Три плашки -->
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:28px;text-align:left">
              ${[
                { color:'#34d399', bg:'rgba(52,211,153,0.08)', border:'rgba(52,211,153,0.2)', icon:'M9 11l3 3L22 4', text:'Документы генерируются автоматически' },
                { color:'#60a5fa', bg:'rgba(96,165,250,0.08)', border:'rgba(96,165,250,0.2)', icon:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', text:'Готовность к ГИТ и РКН под контролем' },
                { color:'#fbbf24', bg:'rgba(251,191,36,0.08)', border:'rgba(251,191,36,0.2)', icon:'M3 4h18M3 8h18M3 12h18M3 16h12', text:'Сроки отчётности — никогда не пропустите' },
              ].map(f => `
                <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:${f.bg};border:1px solid ${f.border};border-radius:10px">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${f.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${f.icon}"/></svg>
                  <span style="font-size:12px;font-weight:500;color:#cbd5e1">${f.text}</span>
                </div>`).join('')}
            </div>

            <button onclick="onboardingNext()" style="
              width:100%;padding:14px;
              background:linear-gradient(135deg,#059669,#10b981);
              border:none;border-radius:11px;
              color:#fff;font-size:14px;font-weight:700;cursor:pointer;
              box-shadow:0 6px 20px rgba(16,185,129,0.3);
              transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px"
              onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 10px 28px rgba(16,185,129,0.4)'"
              onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 6px 20px rgba(16,185,129,0.3)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Добавить первого клиента
            </button>
          </div>
        </div>`;

      // Мини-конфетти из DOM-элементов
      setTimeout(() => {
        const card = document.getElementById('ob-done-card');
        if (!card) return;
        const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#f43f5e','#06b6d4'];
        for (let i = 0; i < 18; i++) {
          const el = document.createElement('div');
          el.className = 'ob-conf';
          el.style.cssText = `
            left:${20 + Math.random()*60}%;bottom:${30 + Math.random()*20}%;
            background:${colors[i % colors.length]};
            animation-delay:${Math.random()*0.4}s;
            animation-duration:${0.9 + Math.random()*0.5}s`;
          card.appendChild(el);
        }
      }, 100);
      return;
    }
  }

  window.onboardingNext = async () => {
    if (step === 0) {
      const accepted = document.getElementById('eula-accept')?.checked;
      if (!accepted) {
        const label = document.getElementById('ob-eula-label');
        if (label) {
          label.style.color = '#f87171';
          label.style.transform = 'translateX(4px)';
          setTimeout(() => { label.style.color = '#475569'; label.style.transform = ''; }, 2000);
        }
        showToast('Необходимо принять условия соглашения', 'var(--amber)');
        return;
      }
      await window.api.settingsSave({ eula_accepted: '1', eula_date: new Date().toISOString() });
      step = 1; render(); return;
    }
    if (step === 1) {
      const name     = document.getElementById('ob-name')?.value?.trim();
      const position = document.getElementById('ob-position')?.value?.trim();
      const company  = document.getElementById('ob-company')?.value?.trim();
      const phone    = document.getElementById('ob-phone')?.value?.trim();
      if (!name) {
        const inp = document.getElementById('ob-name');
        if (inp) { inp.style.borderColor='#f87171'; setTimeout(()=>inp.style.borderColor='rgba(255,255,255,0.1)',2000); }
        showToast('Укажите ваше имя', 'var(--amber)');
        return;
      }
      await window.api.settingsSave({ user_name:name, user_position:position, company_name:company, user_phone:phone });
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

  window.onboardingSkip = async () => {
    await finishOnboarding();
  };

  async function finishOnboarding() {
    await window.api.settingsSave({ onboarding_done: '1' });
    settings = await window.api.settingsGet();
    modal.remove();
    showToast('✅ Добро пожаловать в КомплаенсПро!');
  }

  // Модалка с текстом EULA (вызывается по ссылке)
  window.showEulaModal = () => {
    let em = document.getElementById('eula-full-modal');
    if (em) { em.remove(); return; }
    em = document.createElement('div');
    em.id = 'eula-full-modal';
    em.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    em.innerHTML = `
      <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;width:500px;max-height:80vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,0.8)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div style="font-size:15px;font-weight:700;color:#f1f5f9">Лицензионное соглашение</div>
          <button onclick="document.getElementById('eula-full-modal').remove()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px" onmouseover="this.style.color='#f1f5f9'" onmouseout="this.style.color='#475569'">✕</button>
        </div>
        <div style="font-size:12px;color:#94a3b8;line-height:1.8">
          <p style="color:#e2e8f0;font-weight:700;margin-bottom:12px">ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ (EULA) — КомплаенсПро</p>
          <p style="margin-bottom:10px"><b style="color:#cbd5e1">1. Назначение программы</b><br>КомплаенсПро — программный инструмент автоматизации делопроизводства в области охраны труда, персональных данных и воинского учёта. Предназначен для профессиональных специалистов по комплаенсу.</p>
          <p style="margin-bottom:10px"><b style="color:#cbd5e1">2. Ответственность пользователя</b><br>Пользователь самостоятельно несёт ответственность за корректность вносимых данных, соответствие документов актуальному законодательству и правильность их применения.</p>
          <p style="margin-bottom:10px"><b style="color:#cbd5e1">3. Ограничение ответственности разработчика</b><br>Программа предоставляется «как есть». Разработчик не несёт ответственности за последствия использования сформированных документов и убытки от применения рекомендаций программы.</p>
          <p style="margin-bottom:10px"><b style="color:#cbd5e1">4. Актуальность законодательства</b><br>Программа обновляется по мере изменений законодательства. Пользователь обязан самостоятельно отслеживать изменения нормативно-правовой базы.</p>
          <p style="margin-bottom:10px"><b style="color:#cbd5e1">5. Конфиденциальность данных</b><br>Все данные хранятся локально на устройстве пользователя. Разработчик не имеет доступа к данным клиентов.</p>
          <p style="margin-bottom:10px"><b style="color:#cbd5e1">6. Интеллектуальная собственность</b><br>КомплаенсПро защищён авторским правом. Копирование, распространение и декомпиляция запрещены без письменного согласия правообладателя.</p>
          <p><b style="color:#cbd5e1">7. Принятие условий</b><br>Нажимая «Начать работу», вы подтверждаете согласие со всеми условиями настоящего соглашения.</p>
        </div>
      </div>`;
    em.onclick = e => { if (e.target === em) em.remove(); };
    document.body.appendChild(em);
  };

  render();
  document.body.appendChild(modal);
}

