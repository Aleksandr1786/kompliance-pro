// ═══════════════════════════════════════════════════════
//  КомплаенсПро — app.js
// ═══════════════════════════════════════════════════════

const COLORS = ['#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa','#22d3ee','#fb923c','#4ade80'];
let currentPage = 'dashboard';
let currentClientId = null;
let settings = {};

// Получить клиентов (по умолчанию без архивных)
function getInitials(name) {
  return (name || '')
    .replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '')
    .replace(/["«»„"''\-–—]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

async function getClients(includeArchived = false) {
  const all = await window.api.clientsList();
  return includeArchived ? all : all.filter(c => !c.archived);
}

// Лицензии, триал, PIN, автообновление — см. modules/auth.js

window.addEventListener('DOMContentLoaded', async () => {
  // PIN shake animation
  const pinStyle = document.createElement('style');
  pinStyle.textContent = '@keyframes pinShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}';
  document.head.appendChild(pinStyle);

  settings = await window.api.settingsGet();

  // ── Автообновление ─────────────────────────────────────
  initAutoUpdater();

  // ── Проверка триала при запуске ───────────────────────
  await checkTrialOnStartup();

  // ── Проверка PIN при запуске ──────────────────────────
  if (window.api.pinStatus) {
    const pinStatus = await window.api.pinStatus();
    if (pinStatus.enabled) {
      await showPinScreen('enter');
    } else if (settings.onboarding_done === '1' && !settings.pin_setup_asked) {
      // Онбординг пройден, но PIN ещё не предлагался — один раз спросим
      const want = await showPinScreen('setup');
      await window.api.settingsSave({ pin_setup_asked: '1' });
    }
  }
  // Загружаем лицензию из настроек (если есть)
  if (settings.license_type)    LICENSE.type        = settings.license_type;
  if (settings.license_modules) LICENSE.modules     = settings.license_modules.split(',');
  if (settings.license_max)     LICENSE.max_clients = parseInt(settings.license_max);
  if (settings.license_expires) LICENSE.expires_at  = settings.license_expires;
  if (settings.license_key)     LICENSE.key         = settings.license_key;
  LICENSE.active = settings.license_active !== '0';

  applySettings();
  setupNav();

  // 5 кликов на логотип → форма пароля администратора (скрыто от пользователей)
  let clickCount = 0, clickTimer;
  document.querySelector('.logo')?.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      if (clickCount >= 5) {
        if (IS_ADMIN) {
          logoutAdmin();
        } else {
          showAdminLogin();
        }
      }
      clickCount = 0;
    }, 600);
  });
  await navigate('dashboard');
  await checkOnboarding();
  await showMorningDigest();
});

function applySettings() {
  const name = settings.user_name || 'А. Свинцов';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('userName').textContent = name;
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userRole').textContent = settings.user_position || 'Специалист по ОТ';
  applyNavTerms();
  applyPasfNavFilter();
  applyAdminNavFilter();

  const hasKey = true; // Ключ DeepSeek встроен по умолчанию
  const dot = document.querySelector('.ai-dot');
  const txt = document.getElementById('aiStatusText');

  if (hasKey) {
    dot.classList.add('active');
    if (IS_ADMIN) {
      const providerNames = { deepseek:'DeepSeek', claude:'Claude', yandex:'YandexGPT', giga:'GigaChat', ollama:'Ollama' };
      const provider = settings.ai_provider || 'deepseek';
      txt.textContent = (providerNames[provider] || 'AI') + ' активен';
    } else {
      txt.textContent = '✨ Контроль активен';
    }
    txt.style.color = 'var(--green)';
  } else {
    dot.classList.remove('active');
    txt.textContent = 'Базовый режим';
    txt.style.color = '';
  }
}




// Для лицензии ПАСФ автоматически выдаются только модули OT+PASF (решение
// от 08.07.2026 — ПАСФ покупается как самостоятельный тариф, ПДн/ВУ туда
// не входят). Пункты меню на них при этом режиме прячем — иначе ведут
// в раздел без активированного модуля, что выглядит как баг, а не фича.
function applyPasfNavFilter() {
  const isPasf = typeof LICENSE !== 'undefined' && LICENSE.type === 'PASF';
  document.querySelectorAll('[data-page="pd"], [data-page="vu"]').forEach(el => {
    el.style.display = isPasf ? 'none' : '';
  });
}

// «Аудит нормативки» — технический инструмент для проверки актуальности
// цитат НПА в самом коде генераторов документов, нужен только Александру
// (разработчику), не клиентам продукта. Скрыт по умолчанию, появляется
// только в режиме администратора (5 кликов на логотип + пароль, см.
// app.js/auth.js) — тот же механизм, что уже используется для доступа
// к внутренним настройкам ИИ-провайдера. Решение от 09.07.2026.
function applyAdminNavFilter() {
  document.querySelectorAll('[data-page="npaAudit"]').forEach(el => {
    el.style.display = (typeof IS_ADMIN !== 'undefined' && IS_ADMIN) ? '' : 'none';
  });
}

function renderComingSoon(title) {
  document.getElementById('content').innerHTML = `
    <div class="empty-state" style="height:60vh">
      <div class="empty-icon">🚧</div>
      <div class="empty-title">${title}</div>
      <div class="empty-sub">Этот модуль в разработке — будет готов в следующей сессии</div>
    </div>
  `;
}

// ── УТИЛИТЫ ──────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function openUrl(url) {
  if (url && window.api && window.api.openExternal) {
    window.api.openExternal(url);
  }
}

function showToast(msg, color = 'var(--green)') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color;
  t.style.color = (color === 'var(--green)') ? '#000' : '#fff';
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' });
}

// ── Терминология по режиму (Аутсорсер / Штатный) ─────────
// Единый источник правды. Меняем формулировки ЗДЕСЬ, а не по всему UI.
// LICENSE.type: 'SOLO' и 'PASF' = штатные режимы → «Компания», иначе → «Клиент».
function term(key) {
  const staff = (typeof LICENSE !== 'undefined' && (LICENSE.type === 'SOLO' || LICENSE.type === 'PASF'));
  const DICT = {
    outsourcer: { clients:'Клиенты', client:'Клиент', clientAcc:'клиента', clientGen:'клиента', addClient:'Добавить клиента', clientsGenPl:'Клиентов' },
    staff:      { clients:'Компании', client:'Компания', clientAcc:'компанию', clientGen:'компании', addClient:'Добавить компанию', clientsGenPl:'Компаний' },
  };
  return (staff ? DICT.staff : DICT.outsourcer)[key] || key;
}

// Проставляет термины в статичный HTML (сайдбар, заголовки модалов).
// Вызывать при старте и сразу после смены режима.
function applyNavTerms() {
  document.querySelectorAll('[data-term]').forEach(el => {
    el.textContent = term(el.dataset.term);
  });
  const addTitle = document.getElementById('addClientTitle');
  if (addTitle) addTitle.textContent = '🏢 ' + term('addClient');
}

// Хелпер: пустое состояние с SVG иконкой
function emptyState(iconName, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${ic(iconName,40)}</div><div class="empty-title">${title}</div>${sub?`<div class="empty-sub">${sub}</div>`:''}</div>`;
}

