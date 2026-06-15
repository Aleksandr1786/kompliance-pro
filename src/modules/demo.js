// ============================================================
// КОМПЛАЕНСПРО — demo.js v2.0
// Демо-режим: выбор роли, два тура, баннер, подмена API
// ============================================================

var IS_DEMO = false;
var DEMO_ROLE = null; // 'outsourcer' | 'specialist'
var DEMO_TOUR_STEP = 0;
var DEMO_TOUR_ACTIVE = false;
var _tourPrevTargets = [];

// ─── ТОЧКА ВХОДА ─────────────────────────────────────────
function startDemoFromExpired() {
  document.getElementById('expired-overlay')?.remove();
  showDemoRoleScreen();
}

// ─── ЭКРАН ВЫБОРА РОЛИ ───────────────────────────────────
function showDemoRoleScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'demo-role-screen';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:linear-gradient(135deg,#050810 0%,#080c18 50%,#050810 100%);
    display:flex;align-items:center;justify-content:center;
    padding:20px;
    animation:roleScreenIn .4s cubic-bezier(.22,.68,0,1.2) both;
  `;

  overlay.innerHTML = `
    <style>
      @keyframes roleScreenIn {
        from{opacity:0;transform:scale(0.96);}
        to{opacity:1;transform:scale(1);}
      }
      @keyframes cardHover {
        from{transform:translateY(0);}
        to{transform:translateY(-4px);}
      }
      .role-card {
        flex:1;
        max-width:340px;
        background:linear-gradient(145deg,#0d1525,#111827);
        border:1px solid rgba(255,255,255,0.08);
        border-radius:20px;
        padding:32px 28px;
        cursor:pointer;
        transition:all .25s cubic-bezier(.22,.68,0,1.2);
        position:relative;
        overflow:hidden;
      }
      .role-card::before {
        content:'';
        position:absolute;
        inset:0;
        opacity:0;
        transition:opacity .25s;
        border-radius:20px;
      }
      .role-card.outsourcer::before {
        background:radial-gradient(ellipse at top left,rgba(96,165,250,0.12),transparent 60%);
      }
      .role-card.specialist::before {
        background:radial-gradient(ellipse at top left,rgba(52,211,153,0.12),transparent 60%);
      }
      .role-card:hover {
        transform:translateY(-6px);
        border-color:rgba(255,255,255,0.15);
        box-shadow:0 24px 48px rgba(0,0,0,0.4);
      }
      .role-card:hover::before { opacity:1; }
      .role-card:hover .role-btn { opacity:1; transform:translateY(0); }
      .role-icon {
        width:56px;height:56px;border-radius:16px;
        display:flex;align-items:center;justify-content:center;
        margin-bottom:20px;
      }
      .role-title {
        font-family:'Unbounded',sans-serif;
        font-size:15px;font-weight:700;color:#f1f5f9;
        margin-bottom:8px;
      }
      .role-desc {
        font-size:12.5px;color:#64748b;
        line-height:1.7;margin-bottom:20px;
      }
      .role-tags {
        display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px;
      }
      .role-tag {
        font-size:10.5px;font-weight:600;
        padding:3px 10px;border-radius:20px;
        background:rgba(255,255,255,0.05);
        color:#475569;
      }
      .role-btn {
        width:100%;padding:11px;border:none;border-radius:12px;
        font-family:'Unbounded',sans-serif;font-size:11px;font-weight:700;
        cursor:pointer;transition:all .2s;
        opacity:0.7;transform:translateY(4px);
      }
    </style>

    <div style="max-width:760px;width:100%;text-align:center;">

      <!-- Логотип -->
      <div style="margin-bottom:12px;">
        <div style="font-family:'Unbounded',sans-serif;font-size:18px;font-weight:700;color:#fff;letter-spacing:-.3px">
          Комплаенс<span style="color:#60a5fa">Про</span>
        </div>
      </div>

      <!-- Заголовок -->
      <h1 style="font-family:'Unbounded',sans-serif;font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:10px;line-height:1.3">
        Добро пожаловать в демо
      </h1>
      <p style="font-size:13px;color:#475569;margin-bottom:40px;line-height:1.6">
        Выберите сценарий — и мы покажем как программа решает именно вашу задачу
      </p>

      <!-- Карточки ролей -->
      <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">

        <div class="role-card outsourcer" onclick="selectDemoRole('outsourcer')">
          <div class="role-icon" style="background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="role-title">Аутсорсер</div>
          <div class="role-desc">Веду охрану труда в нескольких организациях одновременно. Важно не пропустить дедлайны ни у одного клиента.</div>
          <div class="role-tags">
            <span class="role-tag">5–20 клиентов</span>
            <span class="role-tag">Сводный контроль</span>
            <span class="role-tag">Аутсорс ОТ</span>
          </div>
          <button class="role-btn" style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;box-shadow:0 8px 20px rgba(37,99,235,0.3)">
            Начать демо →
          </button>
        </div>

        <div class="role-card specialist" onclick="selectDemoRole('specialist')">
          <div class="role-icon" style="background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div class="role-title">Штатный специалист</div>
          <div class="role-desc">Отвечаю за охрану труда в одной организации. Совмещаю с другими обязанностями. Боюсь проверок и штрафов.</div>
          <div class="role-tags">
            <span class="role-tag">1 организация</span>
            <span class="role-tag">Защита от штрафов</span>
            <span class="role-tag">Все требования ОТ</span>
          </div>
          <button class="role-btn" style="background:linear-gradient(135deg,#059669,#34d399);color:#fff;box-shadow:0 8px 20px rgba(5,150,105,0.3)">
            Начать демо →
          </button>
        </div>

      </div>

      <!-- Пропустить -->
      <button onclick="document.getElementById('demo-role-screen')?.remove()" style="
        margin-top:28px;background:transparent;border:none;
        color:#334155;font-size:12px;cursor:pointer;
        font-family:'Manrope',sans-serif;
        text-decoration:underline;text-underline-offset:3px;
        transition:color .15s;
      " onmouseover="this.style.color='#64748b'" onmouseout="this.style.color='#334155'">
        Пропустить и активировать лицензию
      </button>

    </div>
  `;

  document.body.appendChild(overlay);
}

function selectDemoRole(role) {
  DEMO_ROLE = role;
  IS_DEMO = true;

  // Устанавливаем тип лицензии
  if (typeof LICENSE !== 'undefined') {
    LICENSE.type = role === 'outsourcer' ? 'OUTSOURCE' : 'SOLO';
    LICENSE.active = true;
  }

  // Подменяем API
  window._realApi = window.api;
  window.api = buildDemoApi();

  // Убираем экран выбора
  document.getElementById('demo-role-screen')?.remove();

  // Показываем баннер
  showDemoBanner();

  // Переходим на дашборд и запускаем тур
  navigate('dashboard');
  setTimeout(() => startDemoTour(), 700);
}

// ─── ДЕМО API ────────────────────────────────────────────
function buildDemoApi() {
  const D = DEMO_DATA;

  const readonly = () => {
    showToast('В демо-режиме данные не сохраняются', 'var(--amber)');
    return { ok: true };
  };

  return {
    clientsList:    async () => D.clients.filter(c => !c.archived),
    clientGet:      async (id) => D.clients.find(c => c.id === Number(id)) || null,
    clientAdd:      async () => readonly(),
    clientUpdate:   async () => readonly(),
    clientDelete:   async () => readonly(),
    divisionsList:  async (cid) => D.divisions.filter(d => d.client_id === Number(cid)),
    divisionsAdd:   async () => readonly(),
    divisionsUpdate:async () => readonly(),
    divisionsDelete:async () => readonly(),
    employeesList:  async (cid) => D.employees.filter(e => e.client_id === Number(cid)),
    employeeAdd:    async () => readonly(),
    employeeDelete: async () => readonly(),
    employeeUpdate: async () => readonly(),
    trainingGet:    async (id) => { const e = D.employees.find(e => e.id === Number(id)); return e?.training || {}; },
    trainingUpdate: async () => readonly(),
    trainingAlerts: async () => {
      const today = new Date();
      const alerts = [];
      const TYPES = [
        { key:'prog_a',    label:'Программа А (ОТ)',     years:3 },
        { key:'first_aid', label:'Первая помощь',        years:3 },
        { key:'fire',      label:'Пожарный минимум',     years:3 },
        { key:'siz',       label:'Применение СИЗ',       years:3 },
        { key:'repeat',    label:'Повторный инструктаж', months:6 },
        { key:'medcheck',  label:'Медосмотр',            years:1 },
      ];
      D.employees.forEach(emp => {
        if (!emp.training) return;
        const client = D.clients.find(c => c.id === emp.client_id);
        TYPES.forEach(tt => {
          const t = emp.training[tt.key];
          if (!t?.date || !t?.required) return;
          const next = new Date(t.date);
          if (tt.years)  next.setFullYear(next.getFullYear() + tt.years);
          if (tt.months) next.setMonth(next.getMonth() + tt.months);
          const daysLeft = Math.ceil((next - today) / 86400000);
          if (daysLeft <= 30) alerts.push({
            employee_id: emp.id, employee_name: emp.full_name,
            client_name: client?.name || '', client_id: emp.client_id,
            training_type: tt.label, next_date: next.toISOString().slice(0,10),
            days_left: daysLeft, overdue: daysLeft < 0,
          });
        });
      });
      return alerts.sort((a,b) => a.days_left - b.days_left);
    },
    documentsList:  async (cid) => D.documents.filter(d => d.client_id === Number(cid)),
    documentAdd:    async () => readonly(),
    documentStatus: async () => readonly(),
    eventsList:     async (cid) => cid ? D.events.filter(e => e.client_id === Number(cid)) : D.events,
    eventAdd:       async () => readonly(),
    tasksList:      async () => D.tasks,
    taskAdd:        async () => readonly(),
    taskToggle:     async () => readonly(),
    taskDelete:     async () => readonly(),
    settingsGet:    async () => D.settings,
    settingsSave:   async () => readonly(),
    dashboardStats: async () => ({
      clients: D.clients.filter(c=>!c.archived).length,
      tasks: D.tasks.filter(t=>!t.done).length,
      urgent: D.tasks.filter(t=>!t.done&&t.priority==='urgent').length,
      overdue: D.events.filter(e=>new Date(e.due_date)<new Date()).length,
      upcoming: D.events.filter(e=>new Date(e.due_date)>=new Date()).length,
    }),
    backupNow:          async () => { showToast('В демо-режиме резервное копирование недоступно','var(--amber)'); return {ok:true}; },
    backupChooseFolder: async () => readonly(),
    docsGenerate:       async (clientId) => window._realApi?.docsGenerate(clientId),
    docsOpenFolder:     async () => readonly(),
    docsOpenFile:       async () => readonly(),
    vuGenerateReports:  async () => readonly(),
    pdfGenerate:        async () => readonly(),
    docxGenerate:       async () => readonly(),
    aiRequest:          async (d) => window._realApi?.aiRequest(d),
    openExternal:       async (u) => window._realApi?.openExternal(u),
    pinCheck:           async () => ({ok:true}),
    pinSet:             async () => readonly(),
    pinStatus:          async () => ({enabled:false}),
    updateDownload:     ()=>{}, updateInstall:()=>{},
    onUpdateAvailable:  ()=>{}, onUpdateProgress:()=>{}, onUpdateDownloaded:()=>{},
    trialStatus:        async () => ({status:'demo',active:true,plan:DEMO_ROLE==='outsourcer'?'OUTSOURCE':'SOLO',machineId:'DEMO',expires_at:'—'}),
    licenseActivate:    async () => readonly(),
    machineId:          async () => ({machineId:'DEMO-MODE'}),
    trialReset:         async () => readonly(),
  };
}

// ─── БАННЕР ДЕМО ─────────────────────────────────────────
function showDemoBanner() {
  if (document.getElementById('demo-banner')) return;

  const s = document.createElement('style');
  s.id = 'demo-banner-style';
  s.textContent = `
    #demo-banner {
      position:fixed;top:0;left:0;right:0;height:38px;
      background:linear-gradient(90deg,rgba(251,191,36,0.12),rgba(251,191,36,0.06),rgba(251,191,36,0.12));
      border-bottom:1px solid rgba(251,191,36,0.25);
      display:flex;align-items:center;justify-content:center;gap:16px;
      z-index:9998;font-family:'Manrope',sans-serif;
      font-size:12px;font-weight:600;color:#fbbf24;
      backdrop-filter:blur(12px);
    }
    #demo-banner .demo-pulse {
      width:7px;height:7px;border-radius:50%;background:#fbbf24;
      animation:demoPulse 2.5s ease-in-out infinite;
      box-shadow:0 0 8px rgba(251,191,36,0.6);
    }
    @keyframes demoPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.6);}}
    #demo-banner .demo-sep{width:1px;height:16px;background:rgba(251,191,36,0.2);}
    #demo-banner .demo-btn {
      padding:5px 16px;
      background:rgba(251,191,36,0.12);
      border:1px solid rgba(251,191,36,0.35);
      border-radius:20px;color:#fbbf24;
      font-size:11px;font-weight:700;cursor:pointer;
      transition:all .15s;font-family:'Manrope',sans-serif;
    }
    #demo-banner .demo-btn:hover{background:rgba(251,191,36,0.22);border-color:rgba(251,191,36,0.55);}
    .sidebar{top:38px!important;height:calc(100vh - 38px)!important;}
    .main{padding-top:38px;}
  `;
  document.head.appendChild(s);

  const banner = document.createElement('div');
  banner.id = 'demo-banner';
  const roleLabel = DEMO_ROLE === 'outsourcer' ? 'Аутсорсер' : 'Штатный специалист';
  banner.innerHTML = `
    <div class="demo-pulse"></div>
    <span>Демо-режим</span>
    <div class="demo-sep"></div>
    <span style="color:#94a3b8;font-weight:500">Данные ненастоящие · ${roleLabel}</span>
    <div class="demo-sep"></div>
    <button class="demo-btn" onclick="exitDemoMode()">Активировать лицензию →</button>
  `;
  document.body.prepend(banner);
}

function exitDemoMode() {
  IS_DEMO = false;
  if (window._realApi) window.api = window._realApi;
  document.getElementById('demo-banner')?.remove();
  document.getElementById('demo-banner-style')?.remove();
  stopDemoTour();
  // Сбрасываем стили sidebar/main
  document.querySelector('.sidebar').style.top = '';
  document.querySelector('.sidebar').style.height = '';
  document.querySelector('.main').style.paddingTop = '';
  navigate('settings');
  setTimeout(() => document.getElementById('s-license')?.scrollIntoView({behavior:'smooth'}), 400);
}

// ─── ТУРЫ ────────────────────────────────────────────────

const TOUR_OUTSOURCER = [
  {
    nav: () => navigate('dashboard'),
    target: () => document.getElementById('outsourcerClientList'),
    title: 'Диспетчерская аутсорсера',
    text: 'Открываешь утром — сразу видишь у кого проблемы. 🔴 Красный — просрочено, 🟡 жёлтый — горит на этой неделе. Никаких Excel и «вроде помню».',
    hint: 'Нажми на клиента чтобы открыть его карточку',
  },
  {
    nav: () => navigate('client', 1),
    target: () => document.querySelector('.hero-score'),
    title: 'Готовность организации',
    text: 'Единый показатель защищённости клиента. Система считает автоматически: документы, обучение, мероприятия. 100% — организация полностью защищена от штрафов ГИТ.',
    hint: null,
  },
  {
    nav: () => navigate('client', 1),
    target: () => document.querySelector('[onclick*="openReadinessCenter"]'),
    title: 'Центр готовности',
    text: 'Чеклист всех требований закона для этого клиента. Каждый пункт — конкретное действие. Зелёный — закрыто, красный — нужно исправить до проверки.',
    hint: 'Нажми на блок чтобы открыть',
  },
  {
    nav: () => { navigate('client', 1); setTimeout(() => typeof switchTab !== 'undefined' && switchTab('staff'), 600); },
    target: () => document.querySelector('.tab[onclick*="staff"]'),
    title: 'Обучение сотрудников',
    text: 'Система сама считает когда у кого истекает обучение. 🔴 Красный — уже просрочено, 🟡 жёлтый — меньше 30 дней. Ты узнаешь раньше инспектора ГИТ.',
    hint: 'Перейди на вкладку Сотрудники',
  },
  {
    nav: () => { navigate('client', 1); setTimeout(() => typeof switchTab !== 'undefined' && switchTab('ot'), 600); },
    target: () => document.querySelector('button[onclick*="docsGenerate"], .btn-generate'),
    title: '34 документа — одной кнопкой',
    text: 'Приказы, программы инструктажей, журналы — по актуальным НПА. Формируются за 30 секунд, готовы к подписи.',
    hint: 'Нажми «Сформировать пакет» чтобы проверить',
  },
  {
    nav: () => navigate('dashboard'),
    target: () => document.getElementById('outsourcerClientList'),
    title: 'Готово. Это работает. 🎉',
    text: 'За 5 минут ты увидел то, что экономит 3 часа в неделю на каждом клиенте. При 10 клиентах — это 30 часов в месяц. Один специалист — 20 организаций.',
    hint: null,
    isLast: true,
  },
];

const TOUR_SPECIALIST = [
  {
    nav: () => navigate('dashboard'),
    target: () => document.querySelector('.stats-grid'),
    title: 'Твой рабочий стол',
    text: 'Открываешь программу — сразу видишь что делать. Просрочено, на этой неделе, задачи. Никаких таблиц Excel, никакого «где-то записано».',
    hint: null,
  },
  {
    nav: () => navigate('dashboard'),
    target: () => document.querySelector('.panel'),
    title: 'Что делать сегодня',
    text: 'Программа сама расставляет приоритеты. Самое срочное — вверху. Нажми на любую задачу — перейдёшь прямо к нужному разделу.',
    hint: 'Нажми на задачу чтобы перейти к ней',
  },
  {
    nav: () => navigate('client', 1),
    target: () => document.querySelector('[onclick*="openReadinessCenter"]'),
    title: 'Готовность к проверке',
    text: 'Единый показатель по трём направлениям: охрана труда (ГИТ), персональные данные (РКН) и воинский учёт (военкомат). Нажми — увидишь что именно не закрыто.',
    hint: 'Нажми на блок чтобы открыть',
  },
  {
    nav: () => { navigate('client', 1); setTimeout(() => typeof switchTab !== 'undefined' && switchTab('ot'), 600); },
    target: () => document.querySelector('button[onclick*="docsGenerate"], .btn-generate'),
    title: 'Документы за 30 секунд',
    text: 'Нажмёшь одну кнопку — получишь полный пакет документов по ОТ. Приказы, инструкции, журналы — по закону, с реквизитами твоей организации.',
    hint: 'Нажми «Сформировать пакет» чтобы проверить',
  },
  {
    nav: () => { navigate('client', 1); setTimeout(() => typeof switchTab !== 'undefined' && switchTab('staff'), 600); },
    target: () => document.querySelector('.tab[onclick*="staff"]'),
    title: 'Обучение сотрудников',
    text: 'Программа сама считает когда кому нужно пройти обучение, медосмотр или инструктаж. 🔴 Красный — уже просрочено, 🟡 жёлтый — скоро. Уведомит заранее.',
    hint: 'Перейди на вкладку Сотрудники',
  },
  {
    nav: () => navigate('dashboard'),
    target: () => document.querySelector('.stats-grid'),
    title: 'Проверка не страшна. 🛡️',
    text: 'ГИТ, РКН, военкомат — программа держит всё под контролем. Документы, обучение, мероприятия — всё в одном месте. Активируй лицензию и начни прямо сейчас.',
    hint: null,
    isLast: true,
  },
];

function startDemoTour() {
  DEMO_TOUR_ACTIVE = true;
  DEMO_TOUR_STEP = 0;
  showTourStep(0);
}

function showTourStep(index) {
  cleanupTourTargets();
  removeTourOverlay();

  const steps = DEMO_ROLE === 'outsourcer' ? TOUR_OUTSOURCER : TOUR_SPECIALIST;
  if (index >= steps.length) { stopDemoTour(); return; }

  const step = steps[index];
  DEMO_TOUR_STEP = index;

  // Навигация
  if (step.nav) step.nav();

  // Ждём рендера
  setTimeout(() => {
    const target = step.target ? step.target() : null;
    renderTourTooltip(step, target, index, steps.length);
    if (target) highlightTarget(target);
  }, step.nav ? 600 : 100);
}

function highlightTarget(el) {
  if (!el) return;
  _tourPrevTargets.push({
    el,
    prevPosition: el.style.position,
    prevZIndex: el.style.zIndex,
    prevOutline: el.style.outline,
    prevOutlineOffset: el.style.outlineOffset,
    prevBoxShadow: el.style.boxShadow,
    prevAnimation: el.style.animation,
    prevBorderRadius: el.style.borderRadius,
  });

  if (!document.getElementById('tour-pulse-style')) {
    const s = document.createElement('style');
    s.id = 'tour-pulse-style';
    s.textContent = `
      @keyframes tourPulse {
        0%,100%{
          box-shadow:0 0 0 6px rgba(96,165,250,0.15),0 0 30px rgba(96,165,250,0.25);
          outline-color:rgba(96,165,250,0.9);
        }
        50%{
          box-shadow:0 0 0 14px rgba(96,165,250,0),0 0 50px rgba(96,165,250,0.15);
          outline-color:rgba(96,165,250,0.5);
        }
      }
      @keyframes tooltipIn {
        from{opacity:0;transform:translateY(8px) scale(0.96);}
        to{opacity:1;transform:translateY(0) scale(1);}
      }
    `;
    document.head.appendChild(s);
  }

  const computed = window.getComputedStyle(el).position;
  if (computed === 'static') el.style.position = 'relative';
  el.style.zIndex = '10001';
  const glowColor = DEMO_ROLE === 'outsourcer' ? '96,165,250' : '52,211,153';
  el.style.outline = `3px solid rgba(${glowColor},0.9)`;
  el.style.outlineOffset = '6px';
  el.style.borderRadius = el.style.borderRadius || '8px';
  el.style.boxShadow = `0 0 0 6px rgba(${glowColor},0.15), 0 0 30px rgba(${glowColor},0.25)`;
  el.style.animation = 'tourPulse 1.8s ease-in-out infinite';
}

function cleanupTourTargets() {
  _tourPrevTargets.forEach(({ el, prevPosition, prevZIndex, prevOutline, prevOutlineOffset, prevBoxShadow, prevAnimation, prevBorderRadius }) => {
    el.style.position = prevPosition;
    el.style.zIndex = prevZIndex;
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOutlineOffset;
    el.style.boxShadow = prevBoxShadow;
    el.style.animation = prevAnimation;
    el.style.borderRadius = prevBorderRadius;
  });
  _tourPrevTargets = [];
}

function renderTourTooltip(step, target, index, total) {
  // Тултип
  const tooltip = document.createElement('div');
  tooltip.id = 'tour-tooltip';

  // Умное позиционирование: тултип всегда в свободной зоне, не перекрывает цель
  const tipW = 280;
  const tipH = 210;
  const gap = 16;
  const margin = 16;
  const sW = 220; // sidebar
  let posStyle;

  if (!target) {
    // Нет цели — центр экрана
    posStyle = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%)`;
  } else {
    const r = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Определяем где больше места: сверху или снизу, слева или справа от цели
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top - 50; // 50px = баннер
    const spaceRight = vw - r.right;
    const spaceLeft = r.left - sW;

    let left, top;

    // Предпочитаем размещение ПОД целью если места >= tipH+gap
    if (spaceBelow >= tipH + gap) {
      top = r.bottom + gap;
    } else if (spaceAbove >= tipH + gap) {
      top = r.top - tipH - gap;
    } else {
      // Нет места ни сверху ни снизу — прижимаем к низу экрана
      top = vh - tipH - margin;
    }

    // По горизонтали: предпочитаем левее цели (чтобы не перекрывать правую часть)
    if (spaceLeft >= tipW + gap) {
      left = r.left - tipW - gap;
    } else if (spaceRight >= tipW + gap) {
      left = r.right + gap;
    } else {
      // Выравниваем по левому краю цели, не выходя за экран
      left = Math.max(sW + margin, Math.min(r.left, vw - tipW - margin));
    }

    // Финальные ограничения
    left = Math.max(sW + margin, Math.min(left, vw - tipW - margin));
    top = Math.max(50 + margin, Math.min(top, vh - tipH - margin));

    posStyle = `position:fixed;left:${left}px;top:${top}px`;
  }

  const accentColor = DEMO_ROLE === 'outsourcer' ? '#60a5fa' : '#34d399';
  const isLast = step.isLast;

  tooltip.style.cssText = `
    ${posStyle};
    z-index:10002;
    width:280px;
    max-width:calc(100vw - 260px);
    background:linear-gradient(145deg,#0d1525,#111827);
    border:1px solid rgba(255,255,255,0.1);
    border-top:2px solid ${accentColor};
    border-radius:14px;
    padding:16px;
    box-shadow:0 24px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04);
    animation:tooltipIn .25s cubic-bezier(.22,.68,0,1.2) both;
    pointer-events:all;
    user-select:none;
  `;

  // Прогресс-бар
  const progress = ((index + 1) / total) * 100;

  tooltip.innerHTML = `
    <!-- Прогресс -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="flex:1;height:2px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden;margin-right:10px;">
        <div style="width:${progress}%;height:100%;background:${accentColor};border-radius:99px;transition:width .4s ease;"></div>
      </div>
      <span style="font-size:10px;color:#334155;font-weight:700;font-family:'Manrope',sans-serif;white-space:nowrap;">${index+1} / ${total}</span>
    </div>

    <!-- Заголовок -->
    <div style="font-family:'Unbounded',sans-serif;font-size:11.5px;font-weight:700;color:#f1f5f9;margin-bottom:6px;line-height:1.3;">
      ${step.title}
    </div>

    <!-- Текст -->
    <div style="font-size:11.5px;color:#64748b;line-height:1.6;margin-bottom:${step.hint ? '8px' : '12px'};">
      ${step.text}
    </div>

    <!-- Подсказка действия -->
    ${step.hint ? `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:7px;margin-bottom:10px;">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span style="font-size:10.5px;color:#475569;font-family:'Manrope',sans-serif;">${step.hint}</span>
    </div>` : ''}

    <!-- Кнопки -->
    <div style="display:flex;gap:8px;">
      <button onclick="stopDemoTour()" style="
        flex:1;padding:7px 10px;border-radius:8px;
        background:transparent;border:1px solid rgba(255,255,255,0.07);
        color:#334155;font-size:11px;font-weight:600;cursor:pointer;
        font-family:'Manrope',sans-serif;transition:all .15s;
      " onmouseover="this.style.color='#64748b';this.style.borderColor='rgba(255,255,255,0.12)'"
         onmouseout="this.style.color='#334155';this.style.borderColor='rgba(255,255,255,0.07)'">
        Пропустить
      </button>
      <button onclick="${isLast ? 'exitDemoMode()' : `showTourStep(${index+1})`}" style="
        flex:2;padding:7px 10px;border-radius:8px;
        background:linear-gradient(135deg,${accentColor === '#60a5fa' ? '#2563eb,#3b82f6' : '#059669,#34d399'});
        border:none;color:#fff;font-size:11.5px;font-weight:700;
        cursor:pointer;font-family:'Manrope',sans-serif;
        box-shadow:0 4px 14px rgba(${accentColor === '#60a5fa' ? '37,99,235' : '5,150,105'},0.35);
        transition:all .15s;
      " onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
        ${isLast ? 'Активировать →' : 'Далее →'}
      </button>
    </div>
  `;

  document.body.appendChild(tooltip);
}

function removeTourOverlay() {
  document.getElementById('tour-tooltip')?.remove();
}

function stopDemoTour() {
  DEMO_TOUR_ACTIVE = false;
  cleanupTourTargets();
  removeTourOverlay();
}
