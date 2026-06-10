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

// ── СИСТЕМА ЛИЦЕНЗИЙ И ДОСТУПА ───────────────────────────

// Текущая лицензия (загружается из настроек при старте)
var LICENSE = {
  type:        'OUTSOURCE',        // SOLO | OUTSOURCE
  modules:     ['OT','PD','VU'],   // доступные модули
  max_clients: 999,                // лимит клиентов (999 = без лимита для разработки)
  size:        null,               // MICRO|SMALL|MEDIUM|LARGE (для SOLO)
  expires_at:  '2030-01-01',       // дата окончания
  active:      true,               // активна ли лицензия
  key:         'DEV-MODE',         // лицензионный ключ
};

// Режим администратора (виден внутренний механизм)
var IS_ADMIN = false;

// Проверить доступ к модулю
function checkAccess(module) {
  if (!LICENSE.active) return false;
  if (new Date(LICENSE.expires_at) < new Date()) return false;
  return LICENSE.modules.includes(module) || LICENSE.modules.includes('ALL');
}

// Проверить лимит клиентов
function checkClientLimit(currentCount) {
  if (LICENSE.type === 'OUTSOURCE') return currentCount < LICENSE.max_clients;
  if (LICENSE.type === 'SOLO') return currentCount < 1;
  return true;
}

// Показать блокировку модуля (замок)
function showModuleLocked(moduleName) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px">
      <div style="width:64px;height:64px;border-radius:18px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center">
        ${ic('lock',28)}
      </div>
      <div style="font-size:18px;font-weight:700;color:var(--text)">Модуль недоступен</div>
      <div style="font-size:13px;color:var(--muted);text-align:center;max-width:320px">
        Модуль <strong>${moduleName}</strong> не включён в ваш тариф.<br>
        Для подключения свяжитесь с поставщиком.
      </div>
      <div style="padding:10px 20px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);border-radius:10px;font-size:12px;color:#60a5fa">
        Текущий тариф: <strong>${LICENSE.type === 'OUTSOURCE' ? 'Аутсорсер' : 'Своя организация'}</strong>
      </div>
    </div>`;
}

// Показать блокировку лимита клиентов
function showClientLimitReached() {
  const limit = LICENSE.type === 'SOLO' ? '1 организация' : `${LICENSE.max_clients} клиентов`;
  showToast(`Лимит тарифа: ${limit}. Для расширения свяжитесь с поставщиком.`, 'var(--amber)');
}

// Войти в режим администратора
function showAdminLogin() {
  let modal = document.getElementById('modalAdminLogin');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'modalAdminLogin';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--s2);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;width:340px">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">${ic('settings',16)} Режим администратора</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:18px">Введите пароль для доступа</div>
      <input id="admin-pwd-input" type="password" class="form-input" placeholder="Пароль администратора"
        onkeydown="if(event.key==='Enter') submitAdminLogin()">
      <div id="admin-pwd-error" style="font-size:11px;color:var(--red);margin-top:6px;display:none">Неверный пароль</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" onclick="document.getElementById('modalAdminLogin').remove()">Отмена</button>
        <button class="btn btn-primary" onclick="submitAdminLogin()">${ic('check-circle',14)} Войти</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  setTimeout(() => document.getElementById('admin-pwd-input')?.focus(), 100);
}

function submitAdminLogin() {
  const input = document.getElementById('admin-pwd-input');
  const err   = document.getElementById('admin-pwd-error');
  if (!input) return;
  // Пароль хранится в настройках (задаётся при первом входе)
  const savedPwd = settings.admin_password || 'Kompliance2026!';
  if (input.value === savedPwd) {
    IS_ADMIN = true;
    document.getElementById('modalAdminLogin')?.remove();
    applySettings();
    showToast('Режим администратора активен', 'var(--green)');
    navigate('settings');
  } else {
    if (err) { err.style.display = 'block'; }
    input.value = '';
    input.focus();
  }
}

function logoutAdmin() {
  IS_ADMIN = false;
  applySettings();
  showToast('Режим пользователя', 'var(--muted)');
  navigate('settings');
}

function setDashboardMode(mode) {
  LICENSE.type = mode === 'outsourcer' ? 'OUTSOURCE' : 'SOLO';
  showToast(mode === 'outsourcer' ? 'Режим: Аутсорсер' : 'Режим: Штатный специалист', 'var(--green)');
  navigate('dashboard');
}

// ── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────
// ─── АВТООБНОВЛЕНИЕ — UI ─────────────────────────────────

function initAutoUpdater() {
  if (!window.api.onUpdateAvailable) {
    console.log('[Updater] onUpdateAvailable недоступен');
    return;
  }
  console.log('[Updater] Слушатели зарегистрированы');

  window.api.onUpdateAvailable((info) => {
    console.log('[Updater] Получено update:available', info);
    showUpdateBanner(info.version);
  });

  let updateReadyShown = false;
  let updateFallbackTimer = null;

  function showReadyOnce() {
    if (updateReadyShown) return;
    updateReadyShown = true;
    if (updateFallbackTimer) { clearTimeout(updateFallbackTimer); updateFallbackTimer = null; }
    console.log('[Updater] Показываем баннер готовности');
    document.getElementById('update-banner')?.remove();
    showUpdateReadyBanner();
  }

  window.api.onUpdateProgress((data) => {
    console.log('[Updater] Прогресс:', data.percent);
    const bar = document.getElementById('update-progress-bar');
    const txt = document.getElementById('update-progress-text');
    if (bar) bar.style.width = data.percent + '%';
    if (txt) txt.textContent = `Скачивание... ${data.percent}%`;
    // Фолбэк: если update:downloaded не пришёл за 5 сек после 100% — показываем сами
    if (data.percent >= 100) {
      updateFallbackTimer = setTimeout(showReadyOnce, 5000);
    }
  });

  window.api.onUpdateDownloaded(() => {
    console.log('[Updater] Скачано (событие update:downloaded)');
    showReadyOnce();
  });
}
function showUpdateBanner(version) {
  document.getElementById('update-banner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = `
    position:fixed;bottom:20px;left:20px;z-index:9001;
    background:rgba(15,23,42,0.97);border:1px solid rgba(37,99,235,0.5);
    border-radius:14px;padding:14px 18px;max-width:340px;
    box-shadow:0 4px 24px rgba(0,0,0,0.5);
  `;
  banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="font-size:24px;flex-shrink:0">🆕</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:4px">
          Доступна версия ${version}
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px">
          Обновление улучшает стабильность и добавляет новые функции
        </div>
        <div id="update-progress-bar-wrap" style="display:none;background:rgba(255,255,255,0.05);
          border-radius:4px;height:4px;margin-bottom:8px;overflow:hidden">
          <div id="update-progress-bar" style="height:100%;width:0%;
            background:linear-gradient(90deg,#2563eb,#7c3aed);transition:width 0.3s"></div>
        </div>
        <div id="update-progress-text" style="display:none;font-size:11px;
          color:#60a5fa;margin-bottom:8px"></div>
        <div style="display:flex;gap:8px">
          <button id="update-now-btn"
            style="flex:1;padding:8px;background:linear-gradient(135deg,#2563eb,#7c3aed);
            border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
            ⬇️ Обновить
          </button>
          <button id="update-later-btn"
            style="padding:8px 12px;background:transparent;border:1px solid rgba(255,255,255,0.1);
            border-radius:8px;color:#64748b;font-size:12px;cursor:pointer">
            Позже
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('update-now-btn').onclick = async () => {
    document.getElementById('update-now-btn').textContent = 'Скачивание...';
    document.getElementById('update-now-btn').disabled = true;
    document.getElementById('update-later-btn').style.display = 'none';
    document.getElementById('update-progress-bar-wrap').style.display = 'block';
    document.getElementById('update-progress-text').style.display = 'block';
    await window.api.updateDownload();
  };

  document.getElementById('update-later-btn').onclick = () => {
    banner.style.transition = 'opacity 0.3s';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 300);
  };
}

function showUpdateReadyBanner() {
  document.getElementById('update-ready-banner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'update-ready-banner';
  banner.style.cssText = `
    position:fixed;bottom:20px;left:20px;z-index:9001;
    background:rgba(15,23,42,0.97);border:1px solid rgba(52,211,153,0.5);
    border-radius:14px;padding:14px 18px;max-width:320px;
    box-shadow:0 4px 24px rgba(0,0,0,0.5);
  `;
  banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="font-size:24px;flex-shrink:0">✅</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:4px">
          Обновление готово к установке
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px">
          Установится автоматически при следующем запуске
        </div>
        <button id="update-install-btn"
          style="width:100%;padding:8px;background:rgba(52,211,153,0.15);
          border:1px solid rgba(52,211,153,0.3);border-radius:8px;
          color:#34d399;font-size:12px;font-weight:700;cursor:pointer">
          🔄 Перезапустить сейчас
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  document.getElementById('update-install-btn').onclick = async () => {
    await window.api.updateInstall();
  };
}

// ─── ТРИАЛ И ЛИЦЕНЗИЯ ────────────────────────────────────

async function activateLicensePublic() {
  const key    = document.getElementById('lic-key-public')?.value?.trim();
  const expire = document.getElementById('lic-expire-public')?.value?.trim();
  const errEl  = document.getElementById('lic-public-error');

  if (!key)    { errEl.textContent = 'Введите лицензионный ключ'; return; }
  if (!expire) { errEl.textContent = 'Введите дату окончания (например: 2027-06-06)'; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) {
    errEl.textContent = 'Формат даты: ГГГГ-ММ-ДД';
    return;
  }

  const result = await window.api.licenseActivate(key, expire);
  if (!result.ok) {
    errEl.textContent = result.error || 'Неверный ключ или ключ от другого устройства.';
    return;
  }

  LICENSE.key        = key;
  LICENSE.expires_at = expire;
  LICENSE.active     = true;
  LICENSE.type       = result.type || 'OUTSOURCE';
  LICENSE.modules    = ['OT', 'PD', 'VU'];

  document.getElementById('trial-badge')?.remove();
  errEl.textContent = '';
  const expireStr = new Date(expire).toLocaleDateString('ru-RU');
  showToast(`✅ Лицензия активирована до ${expireStr}`, 'var(--green)', 5000);
  setTimeout(() => renderSettings(), 800);
}

async function activateLicenseFromSettings() {
  const key    = document.getElementById('lic-key-input')?.value?.trim();
  const expire = document.getElementById('lic-expire-input')?.value?.trim();

  if (!key)    { showToast('Введите лицензионный ключ', 'var(--red)'); return; }
  if (!expire) { showToast('Введите дату окончания (например: 2027-06-06)', 'var(--red)'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) {
    showToast('Формат даты: ГГГГ-ММ-ДД', 'var(--red)');
    return;
  }

  const result = await window.api.licenseActivate(key, expire);
  if (!result.ok) {
    showToast(result.error || 'Неверный ключ или ключ от другого устройства', 'var(--red)');
    return;
  }

  LICENSE.key        = key;
  LICENSE.expires_at = expire;
  LICENSE.active     = true;
  LICENSE.type       = result.type || 'OUTSOURCE';
  LICENSE.modules    = ['OT', 'PD', 'VU'];

  document.getElementById('trial-badge')?.remove();
  const expireStr = new Date(expire).toLocaleDateString('ru-RU');
  showToast(`✅ Лицензия активирована до ${expireStr}`, 'var(--green)', 5000);
  setTimeout(() => renderSettings(), 800);
}


async function checkTrialOnStartup() {
  if (!window.api.trialStatus) return;
  const trial = await window.api.trialStatus();

  if (trial.status === 'licensed') {
    if (trial.daysLeft !== null && trial.daysLeft <= 14) {
      showTrialBadge(trial.daysLeft, 'license');
      if (trial.daysLeft <= 3) {
        showToast(`⚠️ Лицензия истекает через ${trial.daysLeft} дн. Обратитесь к специалисту.`, 'var(--red)', 8000);
      } else if (trial.daysLeft <= 7) {
        showToast(`Лицензия истекает через ${trial.daysLeft} дней`, 'var(--amber)', 5000);
      }
    }
    return;
  }

  if (trial.status === 'wrong_machine') {
    showToast('⚠️ Лицензия привязана к другому устройству. Обратитесь к специалисту.', 'var(--red)', 8000);
    return;
  }

  if (trial.status === 'subscription_expired') {
    await showExpiredScreen(trial.machineId, 'subscription');
    return;
  }

  if (trial.status === 'expired') {
    await showExpiredScreen(trial.machineId, 'trial');
    return;
  }

  if (trial.status === 'trial') {
    window.__TRIAL_MAX_CLIENTS = trial.maxClients || 2;
    showTrialBadge(trial.daysLeft, 'trial');
    if (trial.daysLeft <= 3) {
      showToast(`🔴 Пробный период истекает через ${trial.daysLeft} дн. Свяжитесь со специалистом.`, 'var(--red)', 8000);
    } else if (trial.daysLeft <= 7) {
      showToast(`Пробный период: осталось ${trial.daysLeft} дней`, 'var(--amber)', 5000);
    }
  }
}

function showTrialBadge(daysLeft, mode) {
  document.getElementById('trial-badge')?.remove();
  const isLic  = mode === 'license';
  const color  = daysLeft <= 3 ? '#f87171' : daysLeft <= 7 ? '#fbbf24' : '#60a5fa';
  const label  = isLic ? 'Лицензия' : 'Пробный период';
  const action = isLic ? 'Продлить →' : 'Активировать →';
  const days   = daysLeft === 1 ? '1 день' : daysLeft < 5 ? `${daysLeft} дня` : `${daysLeft} дней`;

  const badge = document.createElement('div');
  badge.id = 'trial-badge';
  badge.style.cssText = `
    position:fixed;bottom:20px;right:20px;z-index:9000;
    background:rgba(15,23,42,0.97);border:1px solid ${color};
    border-radius:12px;padding:10px 16px;
    display:flex;align-items:center;gap:10px;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:pointer;
  `;
  badge.innerHTML = `
    <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
    <div>
      <div style="font-size:11px;color:#94a3b8;line-height:1">${label}</div>
      <div style="font-size:13px;font-weight:700;color:${color};line-height:1.4">осталось ${days}</div>
    </div>
    <div style="font-size:11px;color:#60a5fa;margin-left:4px">${action}</div>
  `;
  badge.onclick = () => { navigate('settings'); setTimeout(() => document.getElementById('s-license')?.scrollIntoView({ behavior: 'smooth' }), 300); };
  document.body.appendChild(badge);
}

function showExpiredScreen(machineId, type) {
  return new Promise(resolve => {
    document.getElementById('expired-overlay')?.remove();
    const isTrial = type === 'trial';

    const overlay = document.createElement('div');
    overlay.id = 'expired-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99998;
      background:linear-gradient(135deg,#080c14 0%,#0d1520 100%);
      display:flex;align-items:center;justify-content:center;
      flex-direction:column;padding:20px;overflow-y:auto;
    `;
    overlay.innerHTML = `
      <div style="text-align:center;max-width:500px;width:100%;padding:20px 0">
        <div style="font-size:52px;margin-bottom:16px">${isTrial ? '⏰' : '📅'}</div>
        <h2 style="font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:10px">
          ${isTrial ? 'Пробный период завершён' : 'Срок подписки истёк'}
        </h2>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin-bottom:24px">
          ${isTrial
            ? 'Вы пользовались программой бесплатно 14 дней.<br>Все ваши данные сохранены.<br>Для продолжения работы приобретите лицензию.'
            : 'Ваша лицензия истекла.<br>Данные сохранены — продлите подписку чтобы продолжить.'}
        </p>

        <div style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.3);
          border-radius:12px;padding:16px;margin-bottom:20px">
          <div style="font-size:11px;color:#64748b;margin-bottom:6px">ВАШ ID УСТРОЙСТВА — сообщите его специалисту</div>
          <div style="font-size:24px;font-weight:800;color:#60a5fa;
            font-family:monospace;letter-spacing:3px;margin-bottom:10px">
            ${machineId || '...'}
          </div>
          <button onclick="navigator.clipboard.writeText('${machineId||''}').then(()=>showToast('ID скопирован ✓','var(--green)',2000))"
            style="background:rgba(37,99,235,0.2);border:1px solid rgba(37,99,235,0.3);
            border-radius:8px;padding:6px 16px;color:#60a5fa;font-size:12px;cursor:pointer">
            📋 Скопировать ID
          </button>
        </div>

        <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:14px;
          margin-bottom:20px;text-align:left">
          <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:8px">КАК ПОЛУЧИТЬ ЛИЦЕНЗИЮ:</div>
          <div style="font-size:13px;color:#94a3b8;line-height:1.9">
            1️⃣ Скопируйте ID устройства выше<br>
            2️⃣ Напишите специалисту который установил программу<br>
            3️⃣ Сообщите ID и выберите тариф подписки<br>
            4️⃣ Получите ключ и дату — введите их ниже
          </div>
        </div>

        <input id="exp-key" type="text" placeholder="KP-XXXXXXXXXXXXXXXXXXXXXXXX"
          style="width:100%;padding:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;color:#f1f5f9;font-size:13px;font-family:monospace;
          outline:none;box-sizing:border-box;margin-bottom:8px;letter-spacing:0.5px">
        <input id="exp-expire" type="text" placeholder="Дата окончания: 2027-06-06"
          style="width:100%;padding:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;color:#f1f5f9;font-size:13px;
          outline:none;box-sizing:border-box;margin-bottom:8px">
        <div id="exp-error" style="color:#f87171;font-size:12px;min-height:18px;margin-bottom:8px"></div>
        <button id="exp-btn"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#2563eb,#7c3aed);
          border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;cursor:pointer">
          🔑 Активировать лицензию
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('exp-btn').onclick = async () => {
      const key    = document.getElementById('exp-key').value.trim();
      const expire = document.getElementById('exp-expire').value.trim();
      const errEl  = document.getElementById('exp-error');
      const btn    = document.getElementById('exp-btn');

      if (!key)    { errEl.textContent = 'Введите ключ'; return; }
      if (!expire) { errEl.textContent = 'Введите дату окончания'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) { errEl.textContent = 'Формат даты: ГГГГ-ММ-ДД'; return; }

      btn.textContent = 'Проверяем...';
      btn.disabled = true;

      const result = await window.api.licenseActivate(key, expire);
      if (result.ok) {
        overlay.style.transition = 'opacity 0.3s';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          document.getElementById('trial-badge')?.remove();
          showToast('✅ Лицензия активирована! Добро пожаловать.', 'var(--green)', 5000);
          resolve(true);
        }, 300);
      } else {
        errEl.textContent = result.error || 'Неверный ключ или ключ от другого устройства';
        btn.textContent = '🔑 Активировать лицензию';
        btn.disabled = false;
      }
    };
  });
}



// ─── PIN-КОД ─────────────────────────────────────────────

function showPinScreen(mode) {
  // mode: 'enter' — ввод PIN, 'setup' — первоначальная настройка
  return new Promise(resolve => {
    const isSetup = mode === 'setup';
    const overlay = document.createElement('div');
    overlay.id = 'pin-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:linear-gradient(135deg,#080c14 0%,#0d1520 100%);
      display:flex;align-items:center;justify-content:center;
      flex-direction:column;gap:0;
    `;

    overlay.innerHTML = `
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-size:42px;margin-bottom:12px">🔐</div>
        <div style="font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:6px">КомплаенсПро</div>
        <div style="font-size:14px;color:#64748b">${isSetup ? 'Установите PIN-код для защиты' : 'Введите PIN-код'}</div>
      </div>

      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;width:320px">
        ${isSetup ? `
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;text-align:center">Придумайте PIN (4–8 цифр)</div>
          <input id="pin-input-1" type="password" inputmode="numeric" maxlength="30" placeholder="••••"
            style="width:100%;padding:14px;text-align:center;font-size:24px;letter-spacing:8px;
            background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:12px;
            color:#f1f5f9;outline:none;box-sizing:border-box;margin-bottom:12px">
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;text-align:center">Повторите PIN</div>
          <input id="pin-input-2" type="password" inputmode="numeric" maxlength="30" placeholder="••••"
            style="width:100%;padding:14px;text-align:center;font-size:24px;letter-spacing:8px;
            background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:12px;
            color:#f1f5f9;outline:none;box-sizing:border-box;margin-bottom:16px">
        ` : `
          <input id="pin-input-1" type="password" maxlength="30" placeholder="••••"
            style="width:100%;padding:14px;text-align:center;font-size:24px;letter-spacing:8px;
            background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:12px;
            color:#f1f5f9;outline:none;box-sizing:border-box;margin-bottom:16px">
        `}
        <div id="pin-error" style="color:#f87171;font-size:12px;text-align:center;min-height:18px;margin-bottom:12px"></div>
        <button id="pin-submit"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#2563eb,#7c3aed);
          border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;cursor:pointer">
          ${isSetup ? '✓ Установить PIN' : '→ Войти'}
        </button>
        ${isSetup ? `
          <button id="pin-skip"
            style="width:100%;padding:10px;margin-top:8px;background:transparent;
            border:none;color:#475569;font-size:12px;cursor:pointer">
            Пропустить (не рекомендуется)
          </button>
        ` : ''}
      </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('pin-input-1')?.focus(), 80);

    // Enter — подтвердить
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('pin-submit').click();
    });

    document.getElementById('pin-submit').onclick = async () => {
      const pin1 = document.getElementById('pin-input-1')?.value?.trim();
      const errEl = document.getElementById('pin-error');

      // Мастер-пароль не проверяем на формат — он буквенно-цифровой
      const isMasterKey = pin1.length > 8;
      if (!isMasterKey) {
        if (!pin1 || pin1.length < 4) {
          errEl.textContent = 'PIN должен содержать минимум 4 цифры';
          document.getElementById('pin-input-1').style.borderColor = '#f87171';
          return;
        }
        if (!/^\d+$/.test(pin1)) {
          errEl.textContent = 'PIN должен содержать только цифры';
          document.getElementById('pin-input-1').style.borderColor = '#f87171';
          return;
        }
      }

      if (isSetup) {
        const pin2 = document.getElementById('pin-input-2')?.value?.trim();
        if (pin1 !== pin2) {
          errEl.textContent = 'PIN-коды не совпадают';
          document.getElementById('pin-input-2').style.borderColor = '#f87171';
          return;
        }
        await window.api.pinSet(pin1);
        overlay.remove();
        resolve(true);
      } else {
        // Мастер-пароль разработчика — аварийный сброс PIN
        if (pin1 === 'KOMPLIANCE-RESET-2026') {
          await window.api.pinSet('');
          overlay.remove();
          resolve(true);
          // Сразу предлагаем установить новый PIN
          setTimeout(async () => {
            const want = await showPinScreen('setup');
            if (want) showToast('Новый PIN установлен ✅', 'var(--green)');
          }, 400);
          return;
        }
        const result = await window.api.pinCheck(pin1);
        if (result.ok) {
          // Анимация успеха
          overlay.style.transition = 'opacity 0.3s';
          overlay.style.opacity = '0';
          setTimeout(() => { overlay.remove(); resolve(true); }, 300);
        } else {
          errEl.textContent = 'Неверный PIN. Попробуйте ещё раз.';
          const inp = document.getElementById('pin-input-1');
          inp.style.borderColor = '#f87171';
          inp.value = '';
          inp.addEventListener('input', () => inp.style.borderColor = '', { once: true });
          // Тряска
          inp.style.animation = 'pinShake 0.4s ease';
          setTimeout(() => inp.style.animation = '', 400);
        }
      }
    };

    if (isSetup) {
      document.getElementById('pin-skip').onclick = async () => {
        overlay.remove();
        resolve(false);
      };
    }
  });
}

// Экран управления PIN в настройках
async function showPinSettings() {
  const status = await window.api.pinStatus();
  const action = status.enabled
    ? confirm('PIN-код установлен. Хотите его отключить?')
    : await showPinScreen('setup');

  if (status.enabled && action) {
    await window.api.pinSet(''); // передаём пустой — отключает
    showToast('PIN-код отключён', 'var(--amber)');
  } else if (!status.enabled && action) {
    showToast('PIN-код установлен ✅', 'var(--green)');
  }
}

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

  const hasKey = settings.ai_key && settings.ai_key.length > 10;
  const dot = document.querySelector('.ai-dot');
  const txt = document.getElementById('aiStatusText');

  if (hasKey) {
    dot.classList.add('active');
    // Admin видит название провайдера, пользователь — нейтральный текст
    if (IS_ADMIN) {
      const providerNames = { deepseek:'DeepSeek', claude:'Claude', yandex:'YandexGPT', giga:'GigaChat', ollama:'Ollama' };
      txt.textContent = (providerNames[settings.ai_provider] || 'AI') + ' активен';
    } else {
      txt.textContent = '✨ Ассистент активен';
    }
    txt.style.color = 'var(--green)';
  } else {
    dot.classList.remove('active');
    txt.textContent = 'Базовый режим';
    txt.style.color = '';
  }
}

// ── НАВИГАЦИЯ ────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });
}


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
                  <input id="ob-phone" value="${settings.user_phone||''}" placeholder="[скрыто]"
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

async function navigate(page, clientId = null) {
  currentPage = page;
  currentClientId = clientId;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';
  // Скрываем кнопку редактирования клиента на всех страницах кроме карточки
  if (page !== 'client') {
    const editBtn = document.getElementById('topbarEdit');
    if (editBtn) editBtn.style.display = 'none';
  }
  const titles = {
    dashboard:'Дашборд', clients:'Клиенты', tasks:'Задачи',
    ot:'Охрана труда', pd:'Персональные данные', vu:'Воинский учёт',
    reporting:'Отчётность', settings:'Настройки', client:'Карточка клиента'
  };
  document.getElementById('topbarTitle').textContent = titles[page] || page;
  await updateBadges();
  const content = document.getElementById('content');
  content.innerHTML = '';
  if (page === 'dashboard') await renderDashboard();
  else if (page === 'clients')   await renderClients();
  else if (page === 'client')    await renderClientCard(clientId);
  else if (page === 'tasks')     await renderTasks();
  else if (page === 'reporting') await renderReporting();
  else if (page === 'settings')  await renderSettings();
  else if (page === 'pd') { checkAccess('PD') ? renderPd() : showModuleLocked('Персональные данные (152-ФЗ)'); }
  else if (page === 'ot') { checkAccess('OT') ? renderOt() : showModuleLocked('Охрана труда'); }
  else if (page === 'vu') { checkAccess('VU') ? renderVu() : showModuleLocked('Воинский учёт'); }
  else renderComingSoon(titles[page] || page);
}

async function updateBadges() {
  const clients = await getClients();
  document.getElementById('badge-clients').textContent = clients.length;
  const tasks = await window.api.tasksList();
  const open = tasks.filter(t => !t.done).length;
  document.getElementById('badge-tasks').textContent = open;
}

// ── ДАШБОРД ──────────────────────────────────────────────
// async function renderDashboard() {
//   const stats   = await window.api.dashboardStats();
//   const clients = await getClients();
//   const tasks   = await window.api.tasksList();
//   const events  = await window.api.eventsList(null);
//   const alerts  = await window.api.trainingAlerts();
// 
//   const btn = document.getElementById('topbarAction');
//   btn.textContent = '+ Добавить клиента';
//   btn.style.display = 'flex';
//   btn.onclick = () => openModal('modalAddClient');
//   const editBtn = document.getElementById('topbarEdit');
//   if (editBtn) editBtn.style.display = 'none';
// 
//   // Сохраняем для календаря
//   window._dashEvents = events;
//   window._dashTasks = tasks;
// 
//   // ── РЕКОМЕНДАЦИИ АССИСТЕНТА ───────────────────────────
//   const recs = [];
//   const now = new Date();
// 
//   // Реальный счётчик просрочек: обучение + просроченные события
//   const overdueTraining = alerts.filter(a => a.overdue).length;
//   const overdueEvents = events.filter(e => new Date(e.due_date) < now).length;
//   const totalOverdue = overdueTraining + overdueEvents;
// 
//   // 1. Просроченное обучение
//   const overdueAlerts = alerts.filter(a => a.overdue);
//   if (overdueAlerts.length) {
//     const byClient = {};
//     overdueAlerts.forEach(a => {
//       if (!byClient[a.client_name]) byClient[a.client_name] = 0;
//       byClient[a.client_name]++;
//     });
//     Object.entries(byClient).slice(0,2).forEach(([name, count]) => {
//       recs.push({
//         svg: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
//         color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)',
//         text: `Провести обучение — ${name}`,
//         sub: `${count} сотр. с просроченным обучением`,
//         action: null,
//       });
//     });
//   }
// 
//   // 2. Обучение истекает скоро (≤14 дней)
//   const soonAlerts = alerts.filter(a => !a.overdue && a.days_left <= 14);
//   if (soonAlerts.length && recs.length < 4) {
//     const byClient = {};
//     soonAlerts.forEach(a => {
//       if (!byClient[a.client_id]) byClient[a.client_id] = { name: a.client_name, count: 0, days: a.days_left };
//       byClient[a.client_id].count++;
//       if (a.days_left < byClient[a.client_id].days) byClient[a.client_id].days = a.days_left;
//     });
//     Object.entries(byClient).slice(0,2).forEach(([id, info]) => {
//       recs.push({
//         svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
//         color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',
//         text: `Запланировать обучение — ${info.name}`,
//         sub: `${info.count} сотр., срок через ${info.days} дн.`,
//         action: `navigate('client',${id})`,
//       });
//     });
//   }
// 
//   // 3. Клиенты без документов
//   const noDocs = clients.filter(c => (c.score||0) === 0);
//   if (noDocs.length && recs.length < 4) {
//     recs.push({
//       svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
//       color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)',
//       text: `Сгенерировать документы — ${noDocs[0].name}`,
//       sub: `Документы ещё не созданы`,
//       action: `navigate('client',${noDocs[0].id})`,
//     });
//   }
// 
//   // 4. Клиенты с низким score
//   const lowScore = clients.filter(c => (c.score||0) > 0 && (c.score||0) < 40);
//   if (lowScore.length && recs.length < 4) {
//     recs.push({
//       svg: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
//       color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)',
//       text: `Заполнить данные — ${lowScore[0].name}`,
//       sub: `Готовность ${lowScore[0].score||0}% — требует внимания`,
//       action: `navigate('client',${lowScore[0].id})`,
//     });
//   }
// 
//   // 5. Клиенты без сотрудников
//   const noStaff = clients.filter(c => !c.staff || c.staff === 0);
//   if (noStaff.length && recs.length < 4) {
//     recs.push({
//       svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
//       color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)',
//       text: `Добавить сотрудников — ${noStaff[0].name}`,
//       sub: `Сотрудники не внесены`,
//       action: `navigate('client',${noStaff[0].id})`,
//     });
//   }
// 
//   // 6. Открытые задачи с дедлайном
//   const dueTasks = tasks.filter(t => !t.done && t.due_date);
//   dueTasks.filter(t => Math.ceil((new Date(t.due_date)-now)/86400000) <= 7)
//     .slice(0,1).forEach(t => {
//       if (recs.length >= 5) return;
//       const d = Math.ceil((new Date(t.due_date)-now)/86400000);
//       recs.push({
//         svg: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
//         color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',
//         text: t.title,
//         sub: `Срок${d<=0?' истёк':' через '+d+' дн.'}${t.client_name?' · '+t.client_name:''}`,
//         action: `navigate('tasks')`,
//       });
//     });
// 
//   // 7. Приближающийся плановый обход / проверка ГИТ
//   clients.forEach(c => {
//     if (recs.length >= 5) return;
//     if (c.next_visit_date) {
//       const d = Math.ceil((new Date(c.next_visit_date) - now) / 86400000);
//       if (d >= 0 && d <= 14) {
//         recs.push({
//           svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
//           color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)',
//           text: `Плановый обход — ${c.name}`,
//           sub: `Через ${d} дн. · ${new Date(c.next_visit_date).toLocaleDateString('ru-RU')}`,
//           action: `navigate('client',${c.id})`,
//         });
//       }
//     }
//     if (recs.length >= 5) return;
//     if (c.git_next_date) {
//       const d = Math.ceil((new Date(c.git_next_date) - now) / 86400000);
//       if (d >= 0 && d <= 30) {
//         recs.push({
//           svg: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
//           color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)',
//           text: `Плановая проверка ГИТ — ${c.name}`,
//           sub: `Через ${d} дн. · Подготовьтесь заранее`,
//           action: `navigate('client',${c.id})`,
//         });
//       }
//     }
//   });
// 
//   // 8. Отчётность — ближайший несданный отчёт
//   try {
//     const sett = await window.api.settingsGet();
//     let submitted = {};
//     try { submitted = JSON.parse(sett.reports_submitted || '{}'); } catch(_) {}
//     const regions2 = [...new Set(clients.map(c => c.region).filter(Boolean))];
//     const hasKrasnodar2 = regions2.some(r => r && r.includes('Краснодар'));
//     let repList = getFederalReports(now.getFullYear()).map(r => ({ ...r, scope:'federal' }));
//     if (hasKrasnodar2) repList = repList.concat(getKrasnodarReports(now.getFullYear()).map(r => ({ ...r, scope:'krasnodar' })));
//     repList.forEach(r => { r.dueDate = shiftToWorkday(r.due); r.id = `${r.scope}_${r.due}_${r.name.slice(0,20).replace(/\s/g,'_')}`; });
//     repList.sort((a,b) => a.dueDate - b.dueDate);
//     // Отчёт считается несданным, если хотя бы у одного клиента нет галочки
//     const nextRep = repList.find(r => {
//       if (r.dueDate < now) return false;
//       return clients.some(c => !submitted[`${c.id}__${r.id}`]);
//     });
//     if (nextRep && recs.length < 5) {
//       const d = Math.ceil((nextRep.dueDate - now) / 86400000);
//       if (d <= 14) {
//         recs.push({
//           svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
//           color: d <= 3 ? '#f87171' : '#fbbf24',
//           bg: d <= 3 ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)',
//           border: d <= 3 ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)',
//           text: `Сдать отчёт: ${nextRep.name}`,
//           sub: `${nextRep.period} · до ${nextRep.dueDate.toLocaleDateString('ru-RU')} · через ${d} дн.`,
//           action: `navigate('reporting')`,
//         });
//       }
//     }
//   } catch(_) {}
// 
//   const recIcon = (icon, bg, border) => `<div style="width:30px;height:30px;border-radius:8px;background:${bg};border:1px solid ${border};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${icon}</div>`;
// 
//   // 9. Ближайшие события клиентов (в течение 14 дней)
//   events.filter(e => {
//     const d = Math.ceil((new Date(e.due_date) - now) / 86400000);
//     return d >= 0 && d <= 14;
//   }).slice(0, 2).forEach(e => {
//     if (recs.length >= 5) return;
//     const d = Math.ceil((new Date(e.due_date) - now) / 86400000);
//     recs.push({
//       svg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
//       color: d <= 3 ? '#f87171' : '#94a3b8',
//       bg: d <= 3 ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)',
//       border: d <= 3 ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)',
//       text: e.title,
//       sub: `${e.client_name || ''} · ${d === 0 ? 'сегодня' : 'через ' + d + ' дн.'}`,
//       action: `navigate('client',${e.client_id})`,
//     });
//   });
// 
//   const recsHtml = recs.length ? recs.slice(0,4).map((r,i) => `
//     <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;
//       border-bottom:1px solid rgba(255,255,255,0.05);cursor:${r.action?'pointer':'default'};
//       border-radius:6px;transition:background .15s"
//       ${r.action?`onclick="${r.action}"`:''}
//       onmouseover="this.style.background='rgba(255,255,255,0.02)'"
//       onmouseout="this.style.background='transparent'">
//       <div style="width:30px;height:30px;border-radius:8px;background:${r.bg};border:1px solid ${r.border};
//         display:flex;align-items:center;justify-content:center;flex-shrink:0">
//         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${r.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${r.svg}</svg>
//       </div>
//       <div style="flex:1;min-width:0">
//         <div style="font-size:12.5px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.text}</div>
//         <div style="font-size:11px;color:#475569;margin-top:2px">${r.sub}</div>
//       </div>
//       ${r.action?`<div style="color:#334155;font-size:12px;align-self:center;flex-shrink:0">→</div>`:''}
//     </div>`).join('')
//   : `<div style="padding:12px 0;text-align:center;color:#334155;font-size:12px">Нет рекомендаций — всё в порядке 👍</div>`;
// 
//   // Формируем блок алертов обучения
//   const alertsHtml = alerts.length ? alerts.slice(0,5).map(a => {
//     const color = a.overdue ? 'var(--red)' : a.days_left <= 14 ? 'var(--amber)' : '#fbbf24';
//     const icon  = a.overdue ? '🔴' : a.days_left <= 14 ? '🟠' : '🟡';
//     const label = a.overdue ? `Просрочено ${Math.abs(a.days_left)} дн.` : `${a.days_left} дн.`;
//     return `<div class="event-row" style="cursor:pointer" onclick="navigate('client',${a.client_id})">
//       <div class="ev-dot" style="background:${color}"></div>
//       <div class="ev-body">
//         <div class="ev-title">${a.employee_name} — ${a.training_type}</div>
//         <div class="ev-sub">${a.client_name}</div>
//       </div>
//       <div class="ev-when" style="color:${color}">${icon} ${label}</div>
//     </div>`;
//   }).join('') : '';
// 
//   document.getElementById('content').innerHTML = `
//     <div class="stats-grid">
//       <div class="stat-card"><div class="stat-label">${ic('building', 14)} Клиенты</div><div class="stat-value">${stats.clients}</div><div class="stat-sub">на сопровождении</div></div>
//       <div class="stat-card"><div class="stat-label">${ic('clipboard-list', 14)} Открытых задач</div><div class="stat-value">${stats.tasks}</div><div class="stat-sub">${stats.urgent > 0 ? stats.urgent + ' срочных' : 'нет срочных'}</div></div>
//       <div class="stat-card"><div class="stat-label">${ic('graduation-cap', 14)} Обучение</div><div class="stat-value" style="color:${alerts.length?'var(--amber)':'var(--green)'}">${alerts.length}</div><div class="stat-sub">истекает в течение 30 дн.</div></div>
//       <div class="stat-card"><div class="stat-label">${ic('alert-triangle', 14)} Просрочено</div><div class="stat-value" style="color:${totalOverdue?'var(--red)':'var(--green)'}">${totalOverdue}</div><div class="stat-sub">требуют действий</div></div>
//     </div>
//     <div class="grid2">
//       <div>
//         <div class="panel">
//           <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="panel-title">Клиенты</div><div class="panel-count">${clients.length} орг.</div><div class="panel-action" onclick="navigate('clients')">Все →</div></div>
//           <div class="client-search"><input class="search-input" placeholder="🔍 Поиск клиента..." oninput="filterDashClients(this.value)"></div>
//           <div id="dashClientList">${renderClientRows(clients)}</div>
//         </div>
//         ${clients.length >= 2 ? `
//         <div class="panel">
//           <div class="panel-head">
//             <span style="font-size:15px">🏆</span>
//             <div class="panel-title">Рейтинг готовности</div>
//             <div class="panel-count">${clients.length} клиентов</div>
//           </div>
//           <div style="padding:4px 0">
//             ${[...clients].sort((a,b) => (b.score||0)-(a.score||0)).map((c, i) => {
//               const score = c.score || 0;
//               const color = score >= 80 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171';
//               const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="font-size:11px;color:#475569;width:18px;text-align:center;display:inline-block">${i+1}</span>`;
//               const initials = getInitials(c.name);
//               return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer" onclick="navigate('client',${c.id})">
//                 <div style="width:22px;text-align:center;flex-shrink:0;font-size:15px">${medal}</div>
//                 <div style="width:28px;height:28px;border-radius:8px;background:${c.color||'#60a5fa'}22;border:1px solid ${c.color||'#60a5fa'}44;color:${c.color||'#60a5fa'};font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
//                 <div style="flex:1;min-width:0">
//                   <div style="font-size:12px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
//                   <div style="margin-top:4px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">
//                     <div style="width:${score}%;height:100%;background:${color};border-radius:2px;transition:width .6s ease"></div>
//                   </div>
//                 </div>
//                 <div style="font-size:12px;font-weight:700;color:${color};flex-shrink:0;min-width:36px;text-align:right">${score}%</div>
//               </div>`;
//             }).join('')}
//           </div>
//         </div>` : ''}
//         ${tasks.length ? `
//         <div class="panel">
//           <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span><div class="panel-title">Задачи</div><div class="panel-action" onclick="navigate('tasks')">Все →</div></div>
//           <div>${tasks.slice(0,5).map(t => renderTaskRow(t)).join('')}</div>
//         </div>` : ''}
//       </div>
//       <div style="display:flex;flex-direction:column;gap:14px">
//         <div class="panel">
//           <div class="panel-head">
//             <span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;background:rgba(251,191,36,0.2);border-radius:50%"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24" stroke="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="#1a1f2e" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg></span>
//             <div class="panel-title">Ассистент рекомендует</div>
//             <div class="panel-count">${recs.length} ${recs.length===1?'задача':recs.length>=2&&recs.length<=4?'задачи':'задач'}</div>
//           </div>
//           <div style="padding:4px 0">${recsHtml}</div>
//         </div>
//         ${renderProductionCalendar(events, tasks)}
//       </div>
//     </div>
//   `;
// }
// 
// var allDashClients = [];
// async function filterDashClients(q) {
//   if (!allDashClients.length) allDashClients = await getClients();
//   const filtered = allDashClients.filter(c =>
//     c.name.toLowerCase().includes(q.toLowerCase()) ||
//     (c.inn||'').includes(q) || (c.okved||'').includes(q)
//   );
//   document.getElementById('dashClientList').innerHTML = renderClientRows(filtered);
// }
// 
// function renderClientRows(clients) {
//   if (!clients.length) return emptyState("building","Клиентов пока нет","Нажмите «+ Добавить клиента»");
//   return clients.map(c => {
//     const mods = (c.modules||'OT').split(',');
//     const dots = mods.map(m => `<div class="mod-dot" style="background:${m==='OT'?'var(--green)':m==='PD'?'var(--amber)':'var(--red)'}" title="${m}"></div>`).join('');
//     const initials = getInitials(c.name);
//     const scoreColor = (c.score||0) >= 80 ? 'var(--green)' : (c.score||0) >= 40 ? 'var(--amber)' : 'var(--red)';
//     return `<div class="client-row" onclick="navigate('client',${c.id})">
//       <div class="client-avatar-sm" style="background:${c.color||'#60a5fa'}22;border:1px solid ${c.color||'#60a5fa'}44;color:${c.color||'#60a5fa'}">${initials}</div>
//       <div class="client-info"><div class="client-name">${c.name}</div><div class="client-meta">ОКВЭД ${c.okved||'—'} · ${c.staff||0} чел. · ${c.region||''}</div></div>
//       <div class="mod-dots">${dots}</div>
//       <div class="client-score" style="color:${scoreColor}">${c.score||0}%</div>
//     </div>`;
//   }).join('');
// }
// 
// function renderEventRow(e) {
//   const due = new Date(e.due_date);
//   const now = new Date();
//   const diff = Math.round((due - now) / 86400000);
//   let color = 'var(--muted2)', label = formatDate(e.due_date);
//   if (diff < 0) { color = 'var(--red)'; label = 'Просрочено'; }
//   else if (diff <= 3) color = 'var(--red)';
//   else if (diff <= 14) color = 'var(--amber)';
//   else if (diff <= 30) color = 'var(--blue2)';
//   const modColor = e.module==='OT'?'var(--green)':e.module==='PD'?'var(--amber)':'var(--red)';
//   return `<div class="event-row">
//     <div class="ev-dot" style="background:${color}"></div>
//     <div class="ev-body"><div class="ev-title">${e.title}</div><div class="ev-sub">${e.client_name||''}</div></div>
//     <div class="ev-when" style="color:${color}">${label}</div>
//   </div>`;
// }
// 
// function renderTaskRow(t) {
//   const tagClass = t.module==='OT'?'tag-ot':t.module==='PD'?'tag-pd':'tag-vu';
//   const tagLabel = t.module==='OT'?'ОТ':t.module==='PD'?'ПД':'ВУ';
//   const isDone = !!t.done;
//   const checkInner = isDone
//     ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);box-shadow:0 0 8px rgba(0,200,83,0.5);flex-shrink:0"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
//     : `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.15);flex-shrink:0;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(0,200,83,0.5)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)'"></span>`;
//   return `<div class="task-row" id="task-row-${t.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;transition:background .15s" onmouseover="this.querySelector('.task-del-btn').style.opacity='1'" onmouseout="this.querySelector('.task-del-btn').style.opacity='0'">
//     <div class="task-check ${isDone?'done':''}" onclick="toggleTask(${t.id},this)" id="task-check-${t.id}" style="flex-shrink:0;cursor:pointer">${checkInner}</div>
//     <div class="task-text ${isDone?'done':''}" style="flex:1;min-width:0;font-size:13px;${isDone?'text-decoration:line-through;color:#475569':'color:var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}${t.client_name?' <span style="color:var(--muted);font-size:11px">· '+t.client_name+'</span>':''}</div>
//     ${t.module?`<div class="task-tag ${tagClass}" style="flex-shrink:0">${tagLabel}</div>`:''}
//     <button class="task-del-btn" onclick="deleteTask(${t.id})" title="Удалить задачу"
//       style="flex-shrink:0;opacity:0;background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:#475569;transition:all .15s;display:flex;align-items:center"
//       onmouseover="this.style.color='#f87171';this.style.background='rgba(248,113,113,0.1)'"
//       onmouseout="this.style.color='#475569';this.style.background='none'">
//       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
//     </button>
//   </div>`;
// }
// 
// async function deleteTask(id) {
//   const row = document.getElementById('task-row-' + id);
// 
//   // Анимация исчезновения
//   if (row) {
//     row.style.transition = 'all .25s ease';
//     row.style.opacity = '0';
//     row.style.transform = 'translateX(20px)';
//     row.style.maxHeight = row.offsetHeight + 'px';
//     await new Promise(r => setTimeout(r, 250));
//     row.style.maxHeight = '0';
//     row.style.padding = '0';
//     row.style.margin = '0';
//     row.style.overflow = 'hidden';
//     await new Promise(r => setTimeout(r, 200));
//     row.remove();
//   }
// 
//   await window.api.taskDelete(id);
//   showToast('Задача удалена');
// }
// 
// async function toggleTask(id, checkEl) {
//   if (!document.getElementById('task-check-styles')) {
//     const s = document.createElement('style');
//     s.id = 'task-check-styles';
//     s.textContent = `
//       @keyframes tc-pop { 0%{transform:scale(0) rotate(-45deg);opacity:0} 55%{transform:scale(1.3) rotate(8deg)} 75%{transform:scale(0.88) rotate(-3deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
//       @keyframes tc-glow { 0%{box-shadow:0 0 0 0 rgba(0,200,83,0.8)} 50%{box-shadow:0 0 0 7px rgba(0,200,83,0.25)} 100%{box-shadow:0 0 0 13px rgba(0,200,83,0)} }
//       @keyframes tc-stroke { to{stroke-dashoffset:0} }
//       @keyframes tc-row-flash { 0%{background:rgba(0,200,83,0.1)} 100%{background:transparent} }
//     `;
//     document.head.appendChild(s);
//   }
// 
//   await window.api.taskToggle(id);
//   const row    = document.getElementById('task-row-' + id);
//   const isDone = checkEl.classList.contains('done');
//   const textEl = checkEl.nextElementSibling;
// 
//   if (!isDone) {
//     checkEl.classList.add('done');
//     if (textEl) textEl.classList.add('done');
//     if (row) { row.style.animation = ''; void row.offsetWidth; row.style.animation = 'tc-row-flash .7s ease forwards'; }
//     checkEl.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);animation:tc-pop .45s cubic-bezier(.22,.68,0,1.4) both,tc-glow 1.4s ease .1s both;flex-shrink:0"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14" style="animation:tc-stroke .3s ease .12s forwards"/></svg></span>`;
//   } else {
//     checkEl.classList.remove('done');
//     if (textEl) textEl.classList.remove('done');
//     if (row) row.style.animation = '';
//     checkEl.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.15);flex-shrink:0;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(0,200,83,0.5)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)'"></span>`;
//   }
// }
// 
// 
// ── КЛИЕНТЫ ──────────────────────────────────────────────
async function renderClients() {
  const clients = await getClients();
  const btn = document.getElementById('topbarAction');
  btn.textContent = '+ Добавить клиента';
  btn.style.display = 'flex';
  btn.onclick = () => openModal('modalAddClient');

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="panel-title">Все клиенты</div><div class="panel-count">${clients.length} организаций</div></div>
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
async function renderClientCard(id) {
  const c = await window.api.clientGet(id);
  if (!c) { renderComingSoon('Клиент не найден'); return; }
  const docs = await window.api.documentsList(id);
  const events = await window.api.eventsList(id);
  const emps = await window.api.employeesList(id);
  const divisions = await window.api.divisionsList(id);
  const tasks = await window.api.tasksList();
  const clientTasks = tasks.filter(t => t.client_id == id);
  const mods = (c.modules||'OT').split(',');
  const initials = getInitials(c.name);

  // ── КОМПЛЕКСНЫЙ ПОДСЧЁТ ГОТОВНОСТИ (100 баллов) ──────────
  let scoreTotal = 0;
  const scoreBreakdown = [];

  // 1. ДОКУМЕНТЫ — 35 баллов
  const totalDocs = docs.length;
  const okDocs    = docs.filter(d => d.status === 'ok').length;
  let docsScore = 0;
  if (totalDocs > 0) {
    docsScore = Math.round(okDocs / totalDocs * 35);
  }
  scoreTotal += docsScore;
  scoreBreakdown.push({ label:'Документы', score:docsScore, max:35, pct: totalDocs>0 ? Math.round(okDocs/totalDocs*100) : 0 });

  // 2. ОБУЧЕНИЕ СОТРУДНИКОВ — 25 баллов
  let trainingScore = 25;
  const now = new Date();
  if (emps.length === 0) {
    trainingScore = 0; // нет сотрудников — нет баллов
  } else {
    let badCount = 0;
    emps.forEach(e => {
      const tr = e.training || {};
      ['prog_a','first_aid','fire','repeat'].forEach(key => {
        const t = tr[key];
        if (!t?.required) return;
        if (!t?.date) { badCount++; return; }
        const last = new Date(t.date);
        const next = new Date(last);
        if (key === 'repeat') next.setMonth(next.getMonth() + 6);
        else next.setFullYear(next.getFullYear() + 3);
        const days = Math.ceil((next - now) / 86400000);
        if (days < 0) badCount += 2;
        else if (days <= 14) badCount += 1;
      });
    });
    const maxBad = emps.length * 4;
    trainingScore = Math.max(0, Math.round((1 - badCount / maxBad) * 25));
  }
  scoreTotal += trainingScore;
  scoreBreakdown.push({ label:'Обучение', score:trainingScore, max:25 });

  // 3. ЗАПОЛНЕННОСТЬ ДАННЫХ — 25 баллов
  const requiredFields = [
    { key:'inn',              label:'ИНН' },
    { key:'okved',            label:'ОКВЭД' },
    { key:'manager_name',     label:'ФИО руководителя' },
    { key:'manager_position', label:'Должность руководителя' },
    { key:'address',          label:'Юридический адрес' },
    { key:'city',             label:'Город' },
    { key:'phone',            label:'Телефон' },
    { key:'staff',            label:'Количество сотрудников' },
    { key:'region',           label:'Регион' },
    { key:'form',             label:'Форма организации' },
  ];
  const filledFields = requiredFields.filter(f => c[f.key] && String(c[f.key]).trim() !== '' && String(c[f.key]) !== '0').length;
  const dataScore = Math.round(filledFields / requiredFields.length * 25);
  scoreTotal += dataScore;
  scoreBreakdown.push({ label:'Данные клиента', score:dataScore, max:25, filled:filledFields, total:requiredFields.length, missing: requiredFields.filter(f => !c[f.key] || String(c[f.key]).trim()==='' || String(c[f.key])==='0').map(f=>f.label) });

  // 4. СОТРУДНИКИ — 15 баллов
  let empScore = 0;
  if (emps.length > 0) {
    const withPosition = emps.filter(e => e.position && e.position.trim()).length;
    empScore = Math.round(withPosition / emps.length * 15);
  }
  scoreTotal += empScore;
  scoreBreakdown.push({ label:'Сотрудники', score:empScore, max:15 });

  const realScore = Math.min(100, scoreTotal);
  // Обновляем score в базе если изменился
  if (realScore !== (c.score||0)) window.api.clientUpdate(id, { score: realScore });
  const scoreColor = realScore >= 80 ? 'var(--green)' : realScore >= 40 ? 'var(--amber)' : 'var(--red)';

  document.getElementById('topbarTitle').textContent = c.name;
  const btn = document.getElementById('topbarAction');
  btn.textContent = '← Все клиенты';
  btn.style.display = 'flex';
  btn.className = 'btn btn-ghost';
  btn.onclick = () => { btn.className = 'btn btn-primary'; navigate('clients'); };

  // Add edit button
  let editBtn = document.getElementById('topbarEdit');
  if (!editBtn) {
    editBtn = document.createElement('button');
    editBtn.id = 'topbarEdit';
    editBtn.className = 'btn btn-ghost';
    editBtn.textContent = '✏️ Редактировать';
    document.getElementById('topbarAction').after(editBtn);
  }
  editBtn.style.display = 'flex';
  const _cid = id;
  editBtn.onclick = () => openEditModal(_cid);

  const otDocs = docs.filter(d => d.module === 'OT');
  const pdDocs = docs.filter(d => d.module === 'PD');
  const vuDocs = docs.filter(d => d.module === 'VU');
  // Папка клиента на рабочем столе (для кнопки "Открыть папку")
  const safeName = (c.name || '').replace(/[\/\\:*?"<>|]/g, '_').slice(0, 60);
  const clientDocDir = otDocs.length && otDocs[0].filepath
    ? otDocs[0].filepath.replace(/[\\/][^\\/]+$/, '') // папка из пути первого файла
    : null;
  _currentClientDocDir = clientDocDir;

  document.getElementById('content').innerHTML = `
    <div class="hero">
      <div class="hero-top">
        <div class="hero-avatar" style="background:${c.color||'#60a5fa'}22;border:1px solid ${c.color||'#60a5fa'}44">${initials}</div>
        <div style="flex:1;min-width:0">
          <div class="hero-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
          <div class="hero-tags">
            ${c.inn?`<span class="hero-tag">ИНН: ${c.inn}</span>`:''}
            ${c.okved?`<span class="hero-tag">ОКВЭД: ${c.okved}</span>`:''}
            ${c.region?`<span class="hero-tag">📍 ${c.region}</span>`:''}
            ${c.staff?`<span class="hero-tag">${emps.length || c.staff} сотр.</span>`:''}
            ${c.form?`<span class="hero-tag">${c.form}</span>`:''}
            ${c.contract_date?`<span class="hero-tag" title="Дата договора">📝 с ${formatDate(c.contract_date)}</span>`:''}
            ${c.git_last_date?`<span class="hero-tag" title="Последняя проверка ГИТ" style="color:var(--amber)">🔍 ГИТ: ${formatDate(c.git_last_date)}</span>`:''}
            ${c.next_visit_date?`<span class="hero-tag" title="Следующий обход" style="color:var(--blue2)">🔄 Обход: ${formatDate(c.next_visit_date)}</span>`:''}
            ${c.git_next_date?`<span class="hero-tag" title="Плановая проверка ГИТ" style="color:var(--red)">⚠️ Пл.ГИТ: ${formatDate(c.git_next_date)}</span>`:''}
          </div>
        </div>
        <div class="hero-score" style="text-align:right;cursor:pointer;position:relative" onclick="toggleScoreBreakdown()" title="Нажмите для деталей">
          <div class="score-val" style="color:${scoreColor}">${realScore}%</div>
          <div class="score-label">Готовность</div>
          <div style="display:flex;gap:3px;justify-content:flex-end;margin-top:4px">
            ${scoreBreakdown.map(s => {
              const pct = Math.round(s.score/s.max*100);
              const c = pct===100?'#34d399':pct>=50?'#fbbf24':'#f87171';
              return `<div title="${s.label}: ${s.score}/${s.max}" style="width:18px;height:3px;border-radius:2px;background:${c}"></div>`;
            }).join('')}
          </div>
        </div>
        <!-- Score breakdown panel -->
        <div id="score-breakdown" style="display:none;position:absolute;top:100%;right:0;margin-top:8px;z-index:100;
          background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px 18px;
          min-width:240px;box-shadow:0 16px 40px rgba(0,0,0,0.5)">
          <div style="font-size:11px;font-weight:700;color:#475569;letter-spacing:.8px;margin-bottom:10px">ДЕТАЛИЗАЦИЯ ГОТОВНОСТИ</div>
          ${scoreBreakdown.map(s => {
            const pct = Math.round(s.score/s.max*100);
            const col = pct===100?'#34d399':pct>=50?'#fbbf24':'#f87171';
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-size:12px;color:#e2e8f0">${s.label}</span>
                <span style="font-size:11px;font-weight:700;color:${col}">${s.score}/${s.max}</span>
              </div>
              <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div>
              </div>
              ${s.missing?.length ? `<div style="font-size:10px;color:#475569;margin-top:3px">Не заполнено: ${s.missing.slice(0,3).join(', ')}${s.missing.length>3?'...':''}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="hero-stats">
        <div class="hstat"><div class="hstat-val" style="color:var(--green)">${docs.length}</div><div class="hstat-label">Документов</div></div>
        <div class="hstat"><div class="hstat-val" style="color:var(--amber)">${docs.filter(d=>d.status==='outdated').length}</div><div class="hstat-label">Обновить</div></div>
        <div class="hstat"><div class="hstat-val" style="color:var(--red)">${events.filter(e=>new Date(e.due_date)<new Date()).length}</div><div class="hstat-label">Просрочено</div></div>
        <div class="hstat"><div class="hstat-val">${emps.length}</div><div class="hstat-label">Сотрудников</div></div>
      </div>
    </div>

    <!-- ЦЕНТР ГОТОВНОСТИ — кнопка-баннер -->
    <div onclick="openReadinessCenter(${id})" style="
      display:flex;align-items:center;gap:16px;
      background:linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12));
      border:1px solid rgba(96,165,250,0.25);
      border-radius:16px;padding:18px 22px;margin-bottom:14px;
      cursor:pointer;transition:all .2s;position:relative;overflow:hidden
    " onmouseover="this.style.borderColor='rgba(96,165,250,0.5)';this.style.transform='translateY(-1px)'"
       onmouseout="this.style.borderColor='rgba(96,165,250,0.25)';this.style.transform='translateY(0)'">
      <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#a78bfa);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(96,165,250,0.4)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:4px">Центр готовности</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);border-radius:6px;color:#f87171">ГИТ</span>
          ${(c.modules||'').includes('PD') ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.25);border-radius:6px;color:#60a5fa">РКН</span>` : ''}
          ${(c.modules||'').includes('VU') ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);border-radius:6px;color:#a78bfa">Военкомат</span>` : ''}
          <span style="font-size:11px;color:#475569">· индекс риска · прогноз · отчёт</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:800;color:${scoreColor};line-height:1">${realScore}%</div>
          <div style="font-size:10px;color:#475569">готовность</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>

    <div class="tabs">
      <div class="tab active" onclick="switchTab('overview')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> Обзор</span></div>
      ${mods.includes('OT')?`<div class="tab" onclick="switchTab('ot')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Охрана труда</span></div>`:''}
      ${mods.includes('PD')?`<div class="tab" onclick="switchTab('pd')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ПДн</span></div>`:''}
      ${mods.includes('VU')?`<div class="tab" onclick="switchTab('vu');renderClientVu(${id})"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Воинский учёт</span></div>`:''}
      <div class="tab" onclick="switchTab('divisions')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg> Подразделения${divisions.length?` <span style="background:#3b82f6;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px">${divisions.length}</span>`:''}</span></div>
      <div class="tab" onclick="switchTab('staff')"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Сотрудники</span></div>
      <div class="tab" onclick="switchTab('reporting');renderClientReporting(${id})"><span style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Отчётность</span></div>
    </div>

    <div class="tab-panel active" id="tab-overview">
      <div class="grid2">
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span><div class="panel-title">Ближайшие события</div></div>
          <div>${events.length ? events.slice(0,6).map(e=>renderEventRow(e)).join('') : emptyState("calendar","Событий нет")}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span><div class="panel-title">Задачи</div><div class="panel-action" onclick="addTaskForClient(${id})">+ Добавить</div></div>
          <div>${clientTasks.length ? clientTasks.map(t=>renderTaskRow(t)).join('') : emptyState("check-circle","Задач нет")}</div>
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-ot">
      <div class="panel">
        <div class="panel-head">
          ${ic("hard-hat", 18)}
          <div class="panel-title">Документы — Охрана труда</div>
          <div class="panel-count">${otDocs.length} шт.</div>
          <div style="margin-left:auto;display:flex;gap:8px">
            ${clientDocDir ? `<button class="btn" style="padding:6px 12px;font-size:11px;background:var(--s3);color:var(--text)" onclick="openClientFolder()">📁 Открыть папку</button>` : ''}
            <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="generateDocs(${id})">${ic("zap",14)} Сгенерировать</button>
          </div>
        </div>
        <div>${otDocs.length ? renderDocsBySection(otDocs) : renderEmptyDocs('ОТ', id)}</div>
      </div>

      <!-- СПРАВКА ДЛЯ БУХГАЛТЕРА (ЕФС-1) -->
      <div class="panel">
        <div class="panel-head">
          ${ic("bar-chart", 18)}
          <div class="panel-title">Справка для бухгалтера — ЕФС-1</div>
          <div style="margin-left:auto">
            <button class="btn btn-primary" style="padding:6px 14px;font-size:11px" onclick="generateEFS1Memo(${id})">
              📝 Сформировать в Word
            </button>
          </div>
        </div>
        <div style="padding:10px 4px;font-size:12.5px;color:var(--muted);line-height:1.6">
          Сведения для заполнения <b style="color:var(--text)">подраздела 2.3 ЕФС-1</b> (СОУТ, медосмотры, инвалиды).
          Бухгалтер получает готовый Word-документ с данными по охране труда — остаётся только перенести в СФР.
          Данные берутся из карточки клиента и сотрудников.
        </div>
      </div>

      <!-- ПРОТОКОЛ ПРОВЕРКИ ЗНАНИЙ -->
      <div class="panel">
        <div class="panel-head">
          ${ic("clipboard-list", 18)}
          <div class="panel-title">Протокол проверки знаний</div>
          <div style="margin-left:auto">
            <button class="btn btn-primary" style="padding:6px 14px;font-size:11px" onclick="openProtocolModal(${id})">
              ${ic("clipboard-list",14)} Сформировать протокол
            </button>
          </div>
        </div>
        <div style="padding:14px 4px;font-size:12.5px;color:var(--muted);line-height:1.6">
          Протокол заседания комиссии по проверке знаний требований охраны труда.
          Формируется по результатам обучения выбранных сотрудников — с составом комиссии,
          программой и итогами. Готовый документ можно скачать в PDF.
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-pd">

      <!-- SCORE ПДн -->
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">
          ${ic("lock", 18)}
          <div class="panel-title">Готовность к 152-ФЗ</div>
          <div style="margin-left:auto;font-size:22px;font-weight:700;color:${
            (() => {
              let s = 0;
              if (c.pd_responsible_name) s += 25;
              if (c.pd_notified_rkn) s += 25;
              if (pdDocs.length > 0) s += 35;
              if ((c.pd_ispdn_list||[]).length > 0) s += 15;
              return s >= 80 ? 'var(--green)' : s >= 40 ? 'var(--amber)' : 'var(--red)';
            })()
          }">${
            (() => {
              let s = 0;
              if (c.pd_responsible_name) s += 25;
              if (c.pd_notified_rkn) s += 25;
              if (pdDocs.length > 0) s += 35;
              if ((c.pd_ispdn_list||[]).length > 0) s += 15;
              return s;
            })()
          }%</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px">
          ${[
            { label: 'Документы', val: pdDocs.length > 0, pts: 35 },
            { label: 'Уведомление РКН', val: !!c.pd_notified_rkn, pts: 25 },
            { label: 'Ответственный', val: !!c.pd_responsible_name, pts: 25 },
            { label: 'ИСПДн', val: (c.pd_ispdn_list||[]).length > 0, pts: 15 },
          ].map(b => `
            <div style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid ${b.val ? 'rgba(52,211,153,0.3)' : 'var(--border)'};border-radius:10px;text-align:center">
              <div style="margin-bottom:4px">${b.val ? ic("check-circle",18,"color:var(--green)") : ic("x-circle",18,"color:var(--muted)")}</div>
              <div style="font-size:11px;font-weight:600;color:${b.val ? 'var(--green)' : 'var(--muted)'}">${b.label}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${b.pts} балл.</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ОТВЕТСТВЕННЫЙ ЗА ПД -->
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">${ic("user", 18)}<div class="panel-title">Ответственный за обработку ПДн</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div>
            <div class="form-label">ФИО ответственного</div>
            <input class="form-input" id="pd-resp-name-${id}" value="${c.pd_responsible_name||''}" placeholder="Иванова Мария Ивановна">
          </div>
          <div>
            <div class="form-label">Должность</div>
            <input class="form-input" id="pd-resp-pos-${id}" value="${c.pd_responsible_position||''}" placeholder="Юрист / Специалист по комплаенсу">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;margin-top:12px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap">
            <input type="checkbox" id="pd-rkn-${id}" ${c.pd_notified_rkn ? 'checked' : ''} style="width:15px;height:15px;cursor:pointer">
            <span style="font-size:13px;color:var(--text);font-weight:500">РКН уведомлена</span>
          </label>
          <div>
            <div class="form-label" style="margin-bottom:4px">Дата уведомления</div>
            <input type="date" class="form-input" id="pd-rkn-date-${id}" value="${c.pd_notification_date||''}" style="max-width:180px">
          </div>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end">
          <button class="btn btn-primary" onclick="savePdData(${id})">${ic("save",14)} Сохранить</button>
        </div>
      </div>

      <!-- ИСПДн -->
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">
          ${ic("monitor", 18)}
          <div class="panel-title">Информационные системы ПД (ИСПДн)</div>
          <div class="panel-action" onclick="addIspdnItem(${id})">+ Добавить</div>
        </div>
        <div id="ispdn-list-${id}" style="margin-top:8px">
          ${(c.pd_ispdn_list||[]).length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Ещё нет ни одной ИСПДн.<br><span style="font-size:11px">Пример: 1С:Бухгалтерия, Кадровая система, CRM</span></div>`
            : (c.pd_ispdn_list||[]).map((item,idx) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.02);border-left:3px solid var(--blue);border-radius:6px;margin-bottom:6px">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text)">${item.name}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px">Добавлена: ${item.added||'—'}</div>
                </div>
                <button class="btn btn-ghost" style="padding:4px 8px;font-size:11px" onclick="removeIspdnItem(${id},${idx})">✕</button>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- ДОКУМЕНТЫ ПДн + КНОПКИ ГЕНЕРАЦИИ -->
      <div class="panel">
        <div class="panel-head">
          ${ic("file-text", 18)}
          <div class="panel-title">Документы — ПДн</div>
          <div class="panel-count">${pdDocs.length} шт.</div>
          <button class="btn btn-primary" style="margin-left:auto;font-size:12px" onclick="generatePdDocs(${id})">${ic("zap",14)} Сгенерировать</button>
        </div>
        <div style="margin-top:8px">
          ${pdDocs.length
            ? pdDocs.map(d=>renderDocRow(d)).join('')
            : `<div style="padding:20px;text-align:center">
                <div style="margin-bottom:8px">${ic("clipboard-list",40)}</div>
                <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">Документы ещё не сгенерированы</div>
                <div style="font-size:12px;color:var(--muted)">Политика ПД, согласия сотрудников, приказ об ответственном</div>
                <div style="font-size:11px;color:var(--muted);margin-top:8px;padding:8px;background:rgba(248,113,113,0.08);border-radius:6px;border-left:3px solid var(--red)">
                  ${ic("alert-triangle",13)} Штрафы по ст.13.11 КоАП — до <strong style="color:#f87171">18 млн ₽</strong> оборотных за нарушение 152-ФЗ
                </div>
              </div>`
          }
        </div>
      </div>

    </div>

    <div class="tab-panel" id="tab-vu">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted2);font-size:13px">Загрузка...</div>
    </div>

    <div class="tab-panel" id="tab-divisions">
      <div class="panel">
        <div class="panel-head">
          <span>🏢</span>
          <div class="panel-title">Подразделения</div>
          <div class="panel-count">${divisions.length} подр.</div>
          <div class="panel-action" onclick="openDivisionModal(${id})">+ Добавить</div>
        </div>
        ${divisions.length ? `
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          ${divisions.map(div => {
            const wt = DIVISION_WORK_TYPES[div.work_type] || DIVISION_WORK_TYPES.standard;
            const empCount = emps.filter(e => e.division_id === div.id).length;
            const tags = [];
            if (wt.medcheck) tags.push(`<span style="font-size:10px;background:rgba(248,113,113,0.12);color:#f87171;padding:2px 7px;border-radius:10px">29н</span>`);
            if (wt.medcheck_714) tags.push(`<span style="font-size:10px;background:rgba(251,191,36,0.12);color:#fbbf24;padding:2px 7px;border-radius:10px">714н</span>`);
            if (wt.psycho) tags.push(`<span style="font-size:10px;background:rgba(167,139,250,0.12);color:#a78bfa;padding:2px 7px;border-radius:10px">психо</span>`);
            if (wt.siz) tags.push(`<span style="font-size:10px;background:rgba(96,165,250,0.12);color:#60a5fa;padding:2px 7px;border-radius:10px">СИЗ</span>`);
            return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px">
              <div style="font-size:20px;flex-shrink:0">${wt.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--text)">${div.name}</div>
                <div style="font-size:11px;color:var(--muted2);margin-top:2px">${wt.label} · СОУТ класс ${div.soat_class || wt.soatDefault} · ${empCount} сотр.</div>
                ${wt.note ? `<div style="font-size:10px;color:#334155;margin-top:3px">${wt.note}</div>` : ''}
                ${tags.length ? `<div style="display:flex;gap:4px;margin-top:5px">${tags.join('')}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button onclick="openDivisionModal(${id}, ${div.id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px" onmouseover="this.style.color='var(--blue2)'" onmouseout="this.style.color='var(--muted2)'">✏️</button>
                <button onclick="deleteDivision(${div.id}, ${id})" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted2)'">🗑</button>
              </div>
            </div>`;
          }).join('')}
        </div>` : `
        <div class="empty-state">
          <div class="empty-icon">${ic("building",40)}</div>
          <div class="empty-title">Подразделений нет</div>
          <div class="empty-sub">Добавьте подразделения если в организации разные условия труда (офис, цех, флот, ПАСФ)</div>
          <button class="btn btn-primary" style="margin-top:12px" onclick="openDivisionModal(${id})">+ Добавить подразделение</button>
        </div>`}
      </div>

      ${divisions.length ? `
      <div class="panel" style="margin-top:12px">
        <div class="panel-head">${ic("bar-chart", 18)}<div class="panel-title">СОУТ по подразделениям — для ЕФС-1</div></div>
        <div style="margin-top:8px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:rgba(255,255,255,0.03)">
              <th style="padding:8px 10px;text-align:left;color:var(--muted2);font-weight:600;border-bottom:1px solid var(--border)">Подразделение</th>
              <th style="padding:8px 10px;text-align:center;color:var(--muted2);font-weight:600;border-bottom:1px solid var(--border)">Класс СОУТ</th>
              <th style="padding:8px 10px;text-align:center;color:var(--muted2);font-weight:600;border-bottom:1px solid var(--border)">Сотрудников</th>
              <th style="padding:8px 10px;text-align:center;color:var(--muted2);font-weight:600;border-bottom:1px solid var(--border)">Медосмотр</th>
            </tr></thead>
            <tbody>
              ${divisions.map(div => {
                const wt = DIVISION_WORK_TYPES[div.work_type] || DIVISION_WORK_TYPES.standard;
                const empCount = emps.filter(e => e.division_id === div.id).length;
                const soat = div.soat_class || wt.soatDefault;
                const soatColor = soat >= 4 ? '#f87171' : soat >= 31 ? '#fbbf24' : '#34d399';
                const medLabel = wt.medcheck_714 ? '29н + 714н' : wt.medcheck ? '29н' : '—';
                return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                  <td style="padding:10px;color:var(--text)">${wt.icon} ${div.name}</td>
                  <td style="padding:10px;text-align:center;font-weight:700;color:${soatColor}">${soat}</td>
                  <td style="padding:10px;text-align:center;color:var(--muted2)">${empCount}</td>
                  <td style="padding:10px;text-align:center;color:${wt.medcheck?'#f87171':'var(--muted2)'}">
                    <span style="font-size:11px">${medLabel}</span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    </div>

    <div class="tab-panel" id="tab-staff">
      <div class="panel">
        <div class="panel-head"><span style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="panel-title">Сотрудники</div><div class="panel-count">${emps.length} чел.</div><div class="panel-action" onclick="addEmployeePrompt(${id})">+ Добавить</div></div>
        <div>${emps.length ? emps.map(e=>renderEmpRow(e, divisions)).join('') : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Сотрудников нет</div><div class="empty-sub">Добавьте сотрудников для учёта обучений</div></div>'}</div>
      </div>
    </div>

    <div class="tab-panel" id="tab-reporting">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted2);font-size:13px">Загрузка...</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
//  ЦЕНТР ГОТОВНОСТИ
// ═══════════════════════════════════════════════════════
let _readinessClientId = null;

async function openReadinessCenter(clientId) {
  _readinessClientId = clientId;
  const c = await window.api.clientGet(clientId);
  if (!c) return;
  const docs = await window.api.documentsList(clientId);
  const emps = await window.api.employeesList(clientId);
  const events = await window.api.eventsList(clientId);
  const now = new Date();

  // ── РАСЧЁТ РИСКОВ ПО РЕАЛЬНЫМ СТАТЬЯМ КоАП РФ ──────────
  // ст. 5.27.1 КоАП — нарушения требований ОТ
  const risks = [];

  // Обучение по охране труда (ч.3 ст.5.27.1 — до 130 000 ₽)
  let trainingOverdue = 0, trainingSoon = 0;
  emps.forEach(e => {
    const tr = e.training || {};
    ['prog_a','first_aid','fire','repeat'].forEach(key => {
      const t = tr[key];
      if (!t?.required) return;
      if (!t?.date) { trainingOverdue++; return; }
      const next = new Date(t.date);
      if (key === 'repeat') next.setMonth(next.getMonth()+6);
      else next.setFullYear(next.getFullYear()+3);
      const days = Math.ceil((next-now)/86400000);
      if (days < 0) trainingOverdue++;
      else if (days <= 30) trainingSoon++;
    });
  });

  if (trainingOverdue > 0) {
    risks.push({
      level: 'high',
      title: 'Не пройдено обучение по охране труда',
      detail: `${trainingOverdue} нарушений у сотрудников`,
      law: 'ч.3 ст.5.27.1 КоАП РФ',
      fineMin: 110000, fineMax: 130000,
      fix: 'Провести обучение и проверку знаний',
    });
  }

  // Медосмотры (ч.3 ст.5.27.1 — до 130 000 ₽)
  if (c.medcheck_required) {
    const noMed = emps.filter(e => {
      const m = e.training?.medcheck;
      return !m?.date;
    }).length;
    if (noMed > 0) {
      risks.push({
        level: 'high',
        title: 'Отсутствуют медосмотры',
        detail: `${noMed} сотр. без медосмотра`,
        law: 'ч.3 ст.5.27.1 КоАП РФ',
        fineMin: 110000, fineMax: 130000,
        fix: 'Направить сотрудников на медосмотр',
      });
    }
  }

  // СОУТ (ч.2 ст.5.27.1 — до 80 000 ₽)
  if (!c.soat_class || c.soat_class === '0') {
    risks.push({
      level: 'high',
      title: 'Не проведена СОУТ',
      detail: 'Спецоценка условий труда отсутствует',
      law: 'ч.2 ст.5.27.1 КоАП РФ',
      fineMin: 60000, fineMax: 80000,
      fix: 'Заказать спецоценку условий труда',
    });
  }

  // Документы ОТ (ч.1 ст.5.27.1 — до 80 000 ₽)
  const okDocs = docs.filter(d => d.status === 'ok').length;
  const totalDocs = docs.length;
  if (totalDocs === 0) {
    risks.push({
      level: 'high',
      title: 'Отсутствует документация по ОТ',
      detail: 'Локальные акты не разработаны',
      law: 'ч.1 ст.5.27.1 КоАП РФ',
      fineMin: 50000, fineMax: 80000,
      fix: 'Сгенерировать документы в разделе ОТ',
    });
  } else if (okDocs < totalDocs) {
    const outdated = totalDocs - okDocs;
    risks.push({
      level: 'medium',
      title: 'Часть документов не актуальна',
      detail: `${outdated} из ${totalDocs} требуют обновления`,
      law: 'ч.1 ст.5.27.1 КоАП РФ',
      fineMin: 50000, fineMax: 80000,
      fix: 'Обновить документы (повторная генерация)',
    });
  }

  // СИЗ (ч.4 ст.5.27.1 — до 150 000 ₽)
  if (parseInt(c.soat_class) >= 31 || c.hazard_works) {
    const noSiz = emps.filter(e => {
      const s = e.training?.siz;
      return s?.required && !s?.date;
    }).length;
    if (noSiz > 0) {
      risks.push({
        level: 'high',
        title: 'Не обеспечены СИЗ / нет обучения по СИЗ',
        detail: `${noSiz} сотр. без подтверждения`,
        law: 'ч.4 ст.5.27.1 КоАП РФ',
        fineMin: 130000, fineMax: 150000,
        fix: 'Выдать СИЗ и провести обучение',
      });
    }
  }

  // Просроченные события
  const overdueEvents = events.filter(e => new Date(e.due_date) < now);
  if (overdueEvents.length > 0) {
    risks.push({
      level: 'medium',
      title: 'Просроченные мероприятия',
      detail: `${overdueEvents.length} событий требуют действий`,
      law: 'ч.1 ст.5.27.1 КоАП РФ',
      fineMin: 30000, fineMax: 50000,
      fix: 'Закрыть просроченные события',
    });
  }

  // Подсчёт суммарного риска
  const totalFineMin = risks.reduce((s,r) => s + r.fineMin, 0);
  const totalFineMax = risks.reduce((s,r) => s + r.fineMax, 0);
  const highRisks = risks.filter(r => r.level === 'high').length;

  // ── Расчёт готовности (для паспорта) ──
  const scoreBreakdown = [];
  // Документы 35
  let docsScoreP = totalDocs > 0 ? Math.round(okDocs / totalDocs * 35) : 0;
  scoreBreakdown.push({ label:'Документация', score:docsScoreP, max:35 });
  // Обучение 25
  let trScoreP = 25;
  if (emps.length === 0) trScoreP = 0;
  else {
    let bad = 0;
    emps.forEach(e => {
      const tr = e.training || {};
      ['prog_a','first_aid','fire','repeat'].forEach(key => {
        const t = tr[key];
        if (!t?.required) return;
        if (!t?.date) { bad++; return; }
        const nx = new Date(t.date);
        if (key === 'repeat') nx.setMonth(nx.getMonth()+6); else nx.setFullYear(nx.getFullYear()+3);
        const dd = Math.ceil((nx-now)/86400000);
        if (dd < 0) bad += 2; else if (dd <= 14) bad += 1;
      });
    });
    trScoreP = Math.max(0, Math.round((1 - bad/(emps.length*4)) * 25));
  }
  scoreBreakdown.push({ label:'Обучение персонала', score:trScoreP, max:25 });
  // Данные 25
  const reqF = ['inn','okved','manager_name','manager_position','address','city','phone','staff','region','form'];
  const fF = reqF.filter(k => c[k] && String(c[k]).trim() !== '' && String(c[k]) !== '0').length;
  const dataScoreP = Math.round(fF / reqF.length * 25);
  scoreBreakdown.push({ label:'Кадровые данные', score:dataScoreP, max:25 });
  // Сотрудники 15
  let empScoreP = 0;
  if (emps.length > 0) empScoreP = Math.round(emps.filter(e => e.position && e.position.trim()).length / emps.length * 15);
  scoreBreakdown.push({ label:'Сотрудники', score:empScoreP, max:15 });

  const realScore = Math.min(100, docsScoreP + trScoreP + dataScoreP + empScoreP);
  const scoreColor = realScore >= 80 ? 'var(--green)' : realScore >= 40 ? 'var(--amber)' : 'var(--red)';

  // Вероятность штрафа (эвристика)
  const score = realScore;
  let probability = Math.min(95, Math.max(5, 100 - score + highRisks * 8));
  if (risks.length === 0) probability = 5;

  // Уровень риска
  let riskLabel, riskColor;
  if (probability >= 70)      { riskLabel = 'ВЫСОКИЙ';  riskColor = '#f87171'; }
  else if (probability >= 40) { riskLabel = 'СРЕДНИЙ';  riskColor = '#fbbf24'; }
  else                        { riskLabel = 'НИЗКИЙ';   riskColor = '#34d399'; }

  const fmtMoney = n => n.toLocaleString('ru-RU') + ' ₽';

  // Навигация
  currentPage = 'readiness';
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('topbarTitle').textContent = 'Центр готовности — ' + c.name;
  const btn = document.getElementById('topbarAction');
  btn.textContent = '← К клиенту';
  btn.style.display = 'flex';
  btn.className = 'btn btn-ghost';
  btn.onclick = () => { btn.className = 'btn btn-primary'; navigate('client', clientId); };
  const editBtn = document.getElementById('topbarEdit');
  if (editBtn) editBtn.style.display = 'none';

  const hasPD = (c.modules||'').includes('PD');
  const hasVU = (c.modules||'').includes('VU');

  document.getElementById('content').innerHTML = `
    <style>
      @keyframes rc-in { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      .rc-card { animation:rc-in .4s cubic-bezier(.22,.68,0,1.1) both }
      .rc-card:nth-child(2){animation-delay:.05s}
      .rc-card:nth-child(3){animation-delay:.1s}
      @keyframes rc-pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
      @keyframes typewriter { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
      .type-line { animation:typewriter .3s ease both }
    </style>

    <!-- ПЕРЕКЛЮЧАТЕЛЬ МОДУЛЕЙ -->
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">

      <button id="rc-tab-ot" onclick="rcSwitchMode('ot',${clientId})" style="
        display:flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:12px;
        border:2px solid rgba(248,113,113,0.5);
        background:rgba(248,113,113,0.12);
        color:#f87171;font-size:13px;font-weight:700;cursor:pointer;
        transition:all .2s;flex:1;min-width:160px">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(248,113,113,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div style="text-align:left">
          <div>Охрана труда</div>
          <div style="font-size:10px;font-weight:500;opacity:.7;margin-top:1px">Симулятор ГИТ</div>
        </div>
      </button>

      ${hasPD ? `
      <button id="rc-tab-pd" onclick="rcSwitchMode('pd',${clientId})" style="
        display:flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:12px;
        border:2px solid rgba(255,255,255,0.08);
        background:rgba(255,255,255,0.03);
        color:#475569;font-size:13px;font-weight:700;cursor:pointer;
        transition:all .2s;flex:1;min-width:160px"
        onmouseover="this.style.borderColor='rgba(96,165,250,0.4)';this.style.color='#60a5fa'"
        onmouseout="if(!this.classList.contains('rc-active')){this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='#475569'}">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(96,165,250,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div style="text-align:left">
          <div>Персональные данные</div>
          <div style="font-size:10px;font-weight:500;opacity:.7;margin-top:1px">Симулятор РКН</div>
        </div>
      </button>` : ''}

      ${hasVU ? `
      <button id="rc-tab-vu" onclick="rcSwitchMode('vu',${clientId})" style="
        display:flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:12px;
        border:2px solid rgba(255,255,255,0.08);
        background:rgba(255,255,255,0.03);
        color:#475569;font-size:13px;font-weight:700;cursor:pointer;
        transition:all .2s;flex:1;min-width:160px"
        onmouseover="this.style.borderColor='rgba(167,139,250,0.4)';this.style.color='#a78bfa'"
        onmouseout="if(!this.classList.contains('rc-active')){this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='#475569'}">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(167,139,250,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div style="text-align:left">
          <div>Воинский учёт</div>
          <div style="font-size:10px;font-weight:500;opacity:.7;margin-top:1px">Симулятор военкомата</div>
        </div>
      </button>` : ''}

    </div>

    <div id="rc-mode-content">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- ВИДЖЕТ: СИМУЛЯТОР ПРОВЕРКИ -->
      <div class="rc-card panel" style="grid-column:1/-1">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Что будет, если завтра проверка?</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Симуляция проверки государственного инспектора труда</div>
          </div>
          <button onclick="runInspection(${clientId})" id="runInspectionBtn" style="
            padding:11px 22px;background:linear-gradient(90deg,#ef4444,#dc2626);
            border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;
            cursor:pointer;white-space:nowrap;transition:opacity .15s
          " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ▶ Запустить проверку
          </button>
        </div>
        <div id="inspectionResult"></div>
      </div>

    </div>

    <!-- ВТОРАЯ СТРОКА: Спидометр + Машина времени -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- ВИДЖЕТ: ИНДЕКС РИСКА — СПИДОМЕТР -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Индекс риска ГИТ</div>
            <div style="font-size:11px;color:#94a3b8">Вероятность штрафа при проверке</div>
          </div>
        </div>

        <!-- SVG Спидометр -->
        <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0">
          <svg width="220" height="130" viewBox="0 0 220 130">
            <!-- Фоновая дуга -->
            <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="18" stroke-linecap="round"/>
            <!-- Зелёная зона -->
            <path d="M 20 110 A 90 90 0 0 1 75 27" fill="none" stroke="#34d399" stroke-width="18" stroke-linecap="round" opacity=".35"/>
            <!-- Жёлтая зона -->
            <path d="M 75 27 A 90 90 0 0 1 145 27" fill="none" stroke="#fbbf24" stroke-width="18" stroke-linecap="round" opacity=".35"/>
            <!-- Красная зона -->
            <path d="M 145 27 A 90 90 0 0 1 200 110" fill="none" stroke="#f87171" stroke-width="18" stroke-linecap="round" opacity=".35"/>

            <!-- Активная дуга (прогресс) -->
            ${(() => {
              const pct = probability / 100;
              // Угол от -180° до 0° (дуга 180°)
              const angle = -180 + pct * 180;
              const rad = (angle * Math.PI) / 180;
              const cx = 110, cy = 110, r = 90;
              const x = cx + r * Math.cos(rad);
              const y = cy + r * Math.sin(rad);
              const largeArc = pct > 0.5 ? 1 : 0;
              const activeColor = probability >= 70 ? '#f87171' : probability >= 40 ? '#fbbf24' : '#34d399';
              return `<path d="M 20 110 A 90 90 0 ${largeArc} 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${activeColor}" stroke-width="18" stroke-linecap="round"/>`;
            })()}

            <!-- Стрелка -->
            ${(() => {
              const pct = probability / 100;
              const angle = -180 + pct * 180;
              const rad = (angle * Math.PI) / 180;
              const cx = 110, cy = 110;
              const nx = cx + 72 * Math.cos(rad);
              const ny = cy + 72 * Math.sin(rad);
              const activeColor = probability >= 70 ? '#f87171' : probability >= 40 ? '#fbbf24' : '#34d399';
              return `
                <line x1="110" y1="110" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${activeColor}" stroke-width="3" stroke-linecap="round"/>
                <circle cx="110" cy="110" r="6" fill="${activeColor}"/>
              `;
            })()}

            <!-- Метки -->
            <text x="14" y="126" fill="#475569" font-size="10" text-anchor="middle">0%</text>
            <text x="110" y="18" fill="#475569" font-size="10" text-anchor="middle">50%</text>
            <text x="206" y="126" fill="#475569" font-size="10" text-anchor="middle">100%</text>

            <!-- Центральное значение -->
            <text x="110" y="95" fill="${riskColor}" font-size="26" font-weight="800" text-anchor="middle">${probability}%</text>
            <text x="110" y="113" fill="#94a3b8" font-size="11" text-anchor="middle">${riskLabel}</text>
          </svg>
        </div>

        <div style="display:flex;justify-content:center;gap:16px;margin-top:4px">
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#34d399"></div>Низкий</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#fbbf24"></div>Средний</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#f87171"></div>Высокий</div>
        </div>
      </div>

      <!-- ВИДЖЕТ: МАШИНА ВРЕМЕНИ -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Машина времени</div>
            <div style="font-size:11px;color:#94a3b8">Прогноз нарушений на будущее</div>
          </div>
        </div>

        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:12px;color:#94a3b8">Смотреть вперёд:</span>
            <span id="tm-label" style="font-size:13px;font-weight:700;color:#a78bfa">3 месяца</span>
          </div>
          <input type="range" id="tm-slider" min="1" max="12" value="3" oninput="updateTimeMachine(${clientId}, this.value)"
            style="width:100%;accent-color:#a78bfa;cursor:pointer">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#334155;margin-top:4px">
            <span>1 мес</span><span>6 мес</span><span>12 мес</span>
          </div>
        </div>

        <div id="tm-result" style="min-height:80px">
          ${buildTimeMachineResult(emps, events, 3)}
        </div>
      </div>

    </div>

    <!-- ТРЕТЬЯ СТРОКА: Паспорт безопасности -->
    <div class="rc-card panel" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700;color:#f1f5f9">Паспорт безопасности</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px">Красивый отчёт о состоянии охраны труда для вашего клиента</div>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="previewPassport(${clientId})" style="padding:10px 18px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:10px;color:#34d399;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s" onmouseover="this.style.background='rgba(52,211,153,0.2)'" onmouseout="this.style.background='rgba(52,211,153,0.1)'">
            👁 Предпросмотр
          </button>
          <button onclick="downloadPassport(${clientId})" style="padding:10px 18px;background:linear-gradient(90deg,#059669,#34d399);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            📥 Скачать PDF
          </button>
        </div>
      </div>

      <!-- Превью паспорта -->
      <div id="passport-preview" style="display:none;margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
            <div>
              <div style="font-size:18px;font-weight:800;color:#f1f5f9">${c.name}</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px">ПАСПОРТ БЕЗОПАСНОСТИ · ${new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:32px;font-weight:800;color:${scoreColor}">${realScore}%</div>
              <div style="font-size:11px;color:#64748b">общая готовность</div>
            </div>
          </div>
          ${scoreBreakdown.map(s => {
            const pct = Math.round(s.score/s.max*100);
            const col = pct===100?'#34d399':pct>=50?'#fbbf24':'#f87171';
            const icon = pct===100?'✅':pct>=50?'⚠️':'❌';
            return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div style="font-size:16px">${icon}</div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                  <span style="font-size:13px;font-weight:600;color:#e2e8f0">${s.label}</span>
                  <span style="font-size:13px;font-weight:700;color:${col}">${pct}%</span>
                </div>
                <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
                  <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${col}99,${col});border-radius:3px;transition:width .6s ease"></div>
                </div>
              </div>
            </div>`;
          }).join('')}
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#334155">
            Подготовлено: ${settings?.user_name||'Специалист по ОТ'} · ${settings?.company_name||''}
          </div>
        </div>
      </div>
    </div>

    <!-- Скрытые данные для симулятора -->
    <script id="rc-data" type="application/json">${JSON.stringify({
      risks, totalFineMin, totalFineMax, probability, riskLabel, riskColor, score,
      clientName: c.name, highRisks
    })}</script>
    </div><!-- /rc-mode-content -->
  `;

  // Сохраняем данные для симулятора
  window._rcData = { risks, totalFineMin, totalFineMax, probability, riskLabel, riskColor, score, clientName: c.name, highRisks, fmtMoney };
  window._rcClient = c;
}

function buildTimeMachineResult(emps, events, months) {
  const future = new Date();
  future.setMonth(future.getMonth() + months);
  const now = new Date();
  const items = [];

  emps.forEach(e => {
    const tr = e.training || {};
    const TYPES = [
      { key:'prog_a',    label:'Программа А', years:3 },
      { key:'first_aid', label:'Первая помощь', years:3 },
      { key:'fire',      label:'Пожарный минимум', years:3 },
      { key:'repeat',    label:'Повторный инструктаж', months:6 },
    ];
    TYPES.forEach(tt => {
      const t = tr[tt.key];
      if (!t?.required || !t?.date) return;
      const next = new Date(t.date);
      if (tt.months) next.setMonth(next.getMonth() + tt.months);
      else next.setFullYear(next.getFullYear() + tt.years);
      if (next > now && next <= future) {
        const days = Math.ceil((next - now) / 86400000);
        items.push({ text:`${e.full_name} — ${tt.label}`, days, date: next });
      }
    });
  });

  events.forEach(ev => {
    const d = new Date(ev.due_date);
    if (d > now && d <= future) {
      const days = Math.ceil((d - now) / 86400000);
      items.push({ text: ev.title, days, date: d });
    }
  });

  items.sort((a,b) => a.days - b.days);

  if (!items.length) return `<div style="text-align:center;padding:16px 0;color:#334155;font-size:12px">
    <div style="font-size:24px;margin-bottom:6px">✨</div>
    В ближайшие ${months} мес. нарушений не ожидается
  </div>`;

  return items.slice(0,4).map(item => {
    const col = item.days <= 14 ? '#f87171' : item.days <= 30 ? '#fbbf24' : '#94a3b8';
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="width:36px;text-align:center;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:${col}">${item.days}</div>
        <div style="font-size:9px;color:#334155">дн.</div>
      </div>
      <div style="flex:1;font-size:11.5px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.text}</div>
      <div style="font-size:10px;color:#475569;flex-shrink:0">${item.date.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
    </div>`;
  }).join('') + (items.length > 4 ? `<div style="font-size:11px;color:#475569;text-align:center;padding:8px 0">+ещё ${items.length-4} событий</div>` : '');
}

async function updateTimeMachine(clientId, months) {
  months = parseInt(months);
  const labels = ['','1 мес','2 мес','3 мес','4 мес','5 мес','6 мес','7 мес','8 мес','9 мес','10 мес','11 мес','12 мес'];
  const label = document.getElementById('tm-label');
  if (label) label.textContent = labels[months] || months + ' мес';
  const emps = await window.api.employeesList(clientId);
  const events = await window.api.eventsList(clientId);
  const result = document.getElementById('tm-result');
  if (result) result.innerHTML = buildTimeMachineResult(emps, events, months);
}

function previewPassport(clientId) {
  const preview = document.getElementById('passport-preview');
  if (!preview) return;
  const isOpen = preview.style.display !== 'none';
  preview.style.display = isOpen ? 'none' : 'block';
}

async function downloadPassport(clientId) {
  showToast('📄 Готовлю паспорт безопасности...');
  const c = await window.api.clientGet(clientId);
  const docs = await window.api.documentsList(clientId);
  const emps = await window.api.employeesList(clientId);
  const s = await window.api.settingsGet();
  const now = new Date();

  const okDocs = docs.filter(d => d.status === 'ok').length;
  const totalDocs = docs.length;
  const sb = [];
  sb.push({ label:'Документация', score: totalDocs>0?Math.round(okDocs/totalDocs*35):0, max:35 });
  let tr = 25;
  if (emps.length === 0) tr = 0; else {
    let bad = 0;
    emps.forEach(e => { const t=e.training||{}; ['prog_a','first_aid','fire','repeat'].forEach(k=>{const x=t[k];if(!x?.required)return;if(!x?.date){bad++;return;}const nx=new Date(x.date);if(k==='repeat')nx.setMonth(nx.getMonth()+6);else nx.setFullYear(nx.getFullYear()+3);const dd=Math.ceil((nx-now)/86400000);if(dd<0)bad+=2;else if(dd<=14)bad+=1;});});
    tr = Math.max(0, Math.round((1-bad/(emps.length*4))*25));
  }
  sb.push({ label:'Обучение персонала', score:tr, max:25 });
  const reqF=['inn','okved','manager_name','manager_position','address','city','phone','staff','region','form'];
  const fF=reqF.filter(k=>c[k]&&String(c[k]).trim()!==''&&String(c[k])!=='0').length;
  sb.push({ label:'Кадровые данные', score:Math.round(fF/reqF.length*25), max:25 });
  let es=0; if(emps.length>0) es=Math.round(emps.filter(e=>e.position&&e.position.trim()).length/emps.length*15);
  sb.push({ label:'Сотрудники', score:es, max:15 });
  const total = Math.min(100, sb.reduce((a,b)=>a+b.score,0));
  const tColor = total>=80?'#059669':total>=40?'#d97706':'#dc2626';

  const rows = sb.map(x => {
    const pct = Math.round(x.score/x.max*100);
    const col = pct===100?'#059669':pct>=50?'#d97706':'#dc2626';
    return `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#1f2937;font-weight:600">${x.label}</td>
      <td style="padding:14px 0;border-bottom:1px solid #e5e7eb;width:50%">
        <div style="background:#f3f4f6;border-radius:6px;height:10px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${col};border-radius:6px"></div>
        </div>
      </td>
      <td style="padding:14px 0 14px 16px;border-bottom:1px solid #e5e7eb;font-size:15px;font-weight:700;color:${col};text-align:right">${pct}%</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
    body{padding:50px 56px;color:#1f2937;background:#fff}
  </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${tColor};padding-bottom:24px;margin-bottom:32px">
      <div>
        <div style="font-size:13px;letter-spacing:2px;color:#9ca3af;font-weight:700;margin-bottom:8px">ПАСПОРТ БЕЗОПАСНОСТИ</div>
        <div style="font-size:24px;font-weight:800;color:#111827">${c.name}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:6px">
          ${c.inn?'ИНН: '+c.inn+' · ':''}${c.okved?'ОКВЭД: '+c.okved+' · ':''}${c.region||''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:48px;font-weight:800;color:${tColor};line-height:1">${total}%</div>
        <div style="font-size:12px;color:#9ca3af">общая готовность</div>
      </div>
    </div>

    <div style="font-size:15px;font-weight:700;color:#374151;margin-bottom:8px">Состояние охраны труда</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px">${rows}</table>

    <div style="background:#f9fafb;border-radius:12px;padding:24px;margin-bottom:32px">
      <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:14px">Сводка</div>
      <div style="display:flex;gap:32px">
        <div><div style="font-size:28px;font-weight:800;color:#111827">${totalDocs}</div><div style="font-size:12px;color:#6b7280">документов</div></div>
        <div><div style="font-size:28px;font-weight:800;color:#111827">${emps.length}</div><div style="font-size:12px;color:#6b7280">сотрудников</div></div>
        <div><div style="font-size:28px;font-weight:800;color:${tColor}">${total>=80?'Готов':total>=40?'Частично':'Требует работы'}</div><div style="font-size:12px;color:#6b7280">к проверке ГИТ</div></div>
      </div>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:13px;color:#6b7280">Подготовил:</div>
        <div style="font-size:15px;font-weight:700;color:#111827;margin-top:4px">${s.user_name||'Специалист по ОТ'}</div>
        <div style="font-size:12px;color:#6b7280">${s.user_position||''}${s.company_name?' · '+s.company_name:''}</div>
        ${s.user_phone?`<div style="font-size:12px;color:#6b7280">${s.user_phone}</div>`:''}
      </div>
      <div style="text-align:right;font-size:12px;color:#9ca3af">
        ${now.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}<br>
        КомплаенсПро
      </div>
    </div>
  </body></html>`;

  const fname = 'Паспорт_безопасности_' + (c.name||'').replace(/[^а-яёa-z0-9]/gi,'_').slice(0,40);
  const result = await window.api.pdfGenerate({ html, filename: fname });
  if (result.ok) showToast('✅ Паспорт сохранён');
  else if (!result.canceled) showToast('Ошибка: ' + (result.error||'не удалось создать PDF'), 'var(--red)');
}

function runInspection(clientId) {
  const btn = document.getElementById('runInspectionBtn');
  const result = document.getElementById('inspectionResult');
  const d = window._rcData;
  if (!d) return;

  const fmtMoney = n => n.toLocaleString('ru-RU') + ' ₽';

  // Анимация "проверки"
  btn.textContent = '⏳ Инспектор проверяет...';
  btn.disabled = true;
  btn.style.opacity = '.7';

  const steps = [
    'Проверка документации по охране труда...',
    'Проверка обучения и инструктажей...',
    'Проверка медосмотров...',
    'Проверка СОУТ и оценки рисков...',
    'Формирование заключения...',
  ];

  let stepIdx = 0;
  result.innerHTML = `<div style="padding:16px 0;display:flex;align-items:center;gap:12px;color:#94a3b8;font-size:13px">
    <div style="width:16px;height:16px;border:2px solid rgba(96,165,250,0.3);border-top-color:#60a5fa;border-radius:50%;animation:spin 0.8s linear infinite"></div>
    <span id="inspStep">${steps[0]}</span>
  </div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

  const stepTimer = setInterval(() => {
    stepIdx++;
    const stepEl = document.getElementById('inspStep');
    if (stepEl && steps[stepIdx]) stepEl.textContent = steps[stepIdx];
    if (stepIdx >= steps.length - 1) clearInterval(stepTimer);
  }, 500);

  // Результат через 2.7 сек
  setTimeout(() => {
    btn.textContent = '🔄 Повторить проверку';
    btn.disabled = false;
    btn.style.opacity = '1';

    const risksHtml = d.risks.length ? d.risks.map(r => {
      const col = r.level === 'high' ? '#f87171' : '#fbbf24';
      const icon = r.level === 'high' ? '🔴' : '🟡';
      return `<div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:rgba(${r.level==='high'?'248,113,113':'251,191,36'},0.06);border:1px solid rgba(${r.level==='high'?'248,113,113':'251,191,36'},0.18);border-radius:12px;margin-bottom:8px">
        <div style="font-size:16px;flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#f1f5f9">${r.title}</div>
          <div style="font-size:11.5px;color:#94a3b8;margin-top:3px">${r.detail} · <span style="color:#64748b">${r.law}</span></div>
          <div style="font-size:11.5px;color:#34d399;margin-top:5px">✓ ${r.fix}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:13px;font-weight:700;color:${col}">${fmtMoney(r.fineMax)}</div>
          <div style="font-size:10px;color:#475569">до</div>
        </div>
      </div>`;
    }).join('') : `<div style="text-align:center;padding:24px">
      <div style="font-size:40px;margin-bottom:10px">✅</div>
      <div style="font-size:16px;font-weight:700;color:#34d399">Нарушений не найдено!</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:4px">Вы полностью готовы к проверке ГИТ</div>
    </div>`;

    result.innerHTML = `
      <div style="animation:rc-in .4s ease both">
        <!-- ВЕРДИКТ -->
        <div style="display:flex;gap:16px;margin-bottom:18px">
          <div style="flex:1;background:rgba(${d.riskColor==='#f87171'?'248,113,113':d.riskColor==='#fbbf24'?'251,191,36':'52,211,153'},0.1);border:1px solid ${d.riskColor}44;border-radius:14px;padding:18px;text-align:center">
            <div style="font-size:11px;color:#94a3b8;letter-spacing:.5px;margin-bottom:6px">УРОВЕНЬ РИСКА</div>
            <div style="font-size:22px;font-weight:800;color:${d.riskColor}">${d.riskLabel}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">вероятность штрафа ~${d.probability}%</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;text-align:center">
            <div style="font-size:11px;color:#94a3b8;letter-spacing:.5px;margin-bottom:6px">ВОЗМОЖНЫЙ ШТРАФ</div>
            <div style="font-size:22px;font-weight:800;color:${d.riskColor}">${d.totalFineMax > 0 ? 'до ' + fmtMoney(d.totalFineMax) : '0 ₽'}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">${d.risks.length} нарушени${d.risks.length===1?'е':d.risks.length>=2&&d.risks.length<=4?'я':'й'}</div>
          </div>
        </div>

        <!-- ЧТО НАЙДЁТ ИНСПЕКТОР -->
        ${d.risks.length ? `<div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:10px">ЧТО НАЙДЁТ ИНСПЕКТОР</div>` : ''}
        ${risksHtml}

        ${d.risks.length ? `<div style="font-size:11px;color:#475569;margin-top:12px;padding:12px;background:rgba(255,255,255,0.02);border-radius:10px;line-height:1.5">
          ⚖️ Суммы указаны для юридических лиц по ст. 5.27.1 КоАП РФ. При повторном нарушении штрафы увеличиваются, возможна дисквалификация до 3 лет или приостановка деятельности до 90 суток.
        </div>` : ''}
      </div>`;
  }, 2700);
}

async function generateEFS1Memo(clientId) {
  const c = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId);
  const s = await window.api.settingsGet();
  const now = new Date();

  // Считаем инвалидов из сотрудников
  const disabledCount = emps.filter(e => e.is_disabled).length;

  // Медосмотры: подлежат и прошли
  const medReq = c.soat_med_req || emps.filter(e => e.training?.medcheck?.required).length;
  const medDone = emps.filter(e => {
    const m = e.training?.medcheck;
    return m?.required && m?.date;
  }).length;

  const period = `I квартал ${now.getFullYear()}`;
  const reportDate = now.toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });

  const H = (text) => ({ text, bold:true, shading:'E8E8E8', size:18, center:true });
  const V = (text, bold=false) => ({ text: String(text ?? '—'), bold, size:20 });
  const N = (val) => ({ text: String(val || '0'), center:true, size:20 });

  const rows = [
    // Заголовок таблицы
    { cells:[{ text:'СВЕДЕНИЯ ДЛЯ ПОДРАЗДЕЛА 2.3 ФОРМЫ ЕФС-1', bold:true, colspan:3, center:true, shading:'D0D8F0', size:20 }] },
    { cells:[{ text:`Организация: ${c.name}`, colspan:3, bold:true, size:20 }] },
    { cells:[{ text:`Отчётный период: ${period}`, colspan:2, size:18 }, { text:`Дата: ${reportDate}`, size:18 }] },
    { cells:[H('Показатель'), H('На 01.01. отч. года'), H('Примечание')] },

    // СОУТ
    { cells:[{ text:'СПЕЦИАЛЬНАЯ ОЦЕНКА УСЛОВИЙ ТРУДА (СОУТ)', bold:true, colspan:3, shading:'F0F4FF', size:18 }] },
    { cells:[V('Всего рабочих мест, подлежащих СОУТ'), N(c.soat_total), V(c.soat_total ? '' : '⚠️ Не заполнено')] },
    { cells:[V('Проведена СОУТ (рабочих мест)'), N(c.soat_done), V('')] },
    { cells:[V('в т.ч. Класс 1 — Оптимальные'), N(c.soat_c1), V('')] },
    { cells:[V('в т.ч. Класс 2 — Допустимые'), N(c.soat_c2), V('')] },
    { cells:[V('в т.ч. Класс 3.1 — Вредные (1 ст.)'), N(c.soat_c31), V('')] },
    { cells:[V('в т.ч. Класс 3.2 — Вредные (2 ст.)'), N(c.soat_c32), V('')] },
    { cells:[V('в т.ч. Класс 3.3 — Вредные (3 ст.)'), N(c.soat_c33), V('')] },
    { cells:[V('в т.ч. Класс 3.4 — Вредные (4 ст.)'), N(c.soat_c34), V('')] },
    { cells:[V('в т.ч. Класс 4 — Опасные'), N(c.soat_c4), V('')] },

    // Медосмотры
    { cells:[{ text:'МЕДИЦИНСКИЕ ОСМОТРЫ', bold:true, colspan:3, shading:'F0F4FF', size:18 }] },
    { cells:[V('Подлежат обязательным медосмотрам'), N(medReq), V('По условиям труда')] },
    { cells:[V('Прошли медосмотр в отчётном периоде'), N(medDone), V('')] },

    // Инвалиды
    { cells:[{ text:'ЧИСЛЕННОСТЬ РАБОТАЮЩИХ ИНВАЛИДОВ (новое с 2026)', bold:true, colspan:3, shading:'F0F4FF', size:18 }] },
    { cells:[V('Работающие инвалиды (начисляются взносы на травматизм)'), N(disabledCount), V(disabledCount === 0 ? 'По данным приложения' : '')] },

    // Подпись
    { cells:[{ text:'', colspan:3 }] },
    { cells:[{ text:`Специалист по ОТ: ${s.user_name || '_______________'}`, colspan:2, size:18 }, { text:'Подпись: _______________', size:18 }] },
    { cells:[{ text:`Должность: ${s.user_position || 'Специалист по охране труда'}`, colspan:3, size:18 }] },
    { cells:[{ text:`Контакт: ${s.user_phone || ''} ${s.user_email || ''}`.trim() || '—', colspan:3, size:18 }] },
  ];

  const result = await window.api.docxGenerate({
    title: 'СПРАВКА ДЛЯ БУХГАЛТЕРА',
    subtitle: `Сведения по охране труда для заполнения ЕФС-1 · ${c.name}`,
    rows,
    filename: `ЕФС-1_Справка_ОТ_${(c.name||'').replace(/[^а-яёa-z0-9]/gi,'_').slice(0,30)}`,
  });

  if (result.ok) showToast('✅ Справка сохранена в Word');
  else if (!result.canceled) showToast('Ошибка: ' + (result.error || 'не удалось создать документ'), 'var(--red)');
}

// ═══════════════════════════════════════════════════════
//  ПРОТОКОЛ ПРОВЕРКИ ЗНАНИЙ
// ═══════════════════════════════════════════════════════

// Точка контроля тарифа — пока всегда разрешено.
// Когда внедрим лицензии, здесь будет проверка тарифа.
function checkTariffAccess(feature) {
  // feature: 'protocol', 'passport', 'simulator' и т.д.
  // TODO: интеграция с системой лицензий
  return true;
}

// Определение категории предприятия по числу сотрудников (ФЗ-209)
function getEnterpriseCategory(staffCount) {
  if (staffCount <= 15) return {
    key: 'micro',
    name: 'Микропредприятие',
    trainingForm: 'instruction',
    formLabel: 'обучение в форме инструктажа',
    info: 'Обучение проводится в форме инструктажа. Проверку знаний может проводить назначенное руководителем лицо без формирования комиссии (п. 2464). Руководитель обязан пройти обучение.',
    color: '#34d399',
    needsCommission: false,
    canChoose: false,
  };
  if (staffCount <= 100) return {
    key: 'small',
    name: 'Малое предприятие',
    trainingForm: 'commission',
    formLabel: 'обучение комиссией или во внешнем центре',
    info: 'Часть работников обязательно обучается во внешнем аккредитованном учебном центре (Приложение № 4 к ПП № 2464). Остальных можно обучать внутри организации при соблюдении условий.',
    color: '#fbbf24',
    needsCommission: true,
    canChoose: true,
  };
  return {
    key: 'large',
    name: 'Среднее/крупное предприятие',
    trainingForm: 'commission',
    formLabel: 'обучение комиссией внутри организации',
    info: 'Обучение проводится внутри организации комиссией. Требуется регистрация ИП/ЮЛ в реестре Минтруда, не менее 2 обучающих лиц, материально-техническая база (учебные места из расчёта 1 на 100 работников).',
    color: '#60a5fa',
    needsCommission: true,
    canChoose: false,
  };
}

async function openProtocolModal(clientId) {
  if (!checkTariffAccess('protocol')) {
    showToast('📋 Протоколы доступны на тарифе «Профи» и выше', 'var(--amber)');
    return;
  }

  const c = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId);

  if (!emps.length) {
    showToast('Сначала добавьте сотрудников', 'var(--amber)');
    return;
  }

  const staffCount = emps.length;
  const cat = getEnterpriseCategory(staffCount);

  // ── ПРОВЕРКА УЛУЧШЕНИЙ ──────────────────────────
  const improvements = [];
  if (cat.needsCommission && !c.ot_name) improvements.push('Не указан ответственный за ОТ (председатель комиссии)');
  const noProgA = emps.filter(e => {
    const t = e.training?.prog_a;
    return t?.required && !t?.date;
  });
  if (noProgA.length) improvements.push(`${noProgA.length} сотр. без даты обучения по Программе А`);
  if (!c.manager_name) improvements.push('Не указан руководитель организации');

  const empRows = emps.map(e => {
    const progA = e.training?.prog_a;
    const trained = progA?.date;
    return `<label style="display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all .15s" 
      onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" class="protocol-emp" value="${e.id}" ${trained?'checked':''} style="width:17px;height:17px;accent-color:var(--blue);cursor:pointer">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${e.full_name}</div>
        <div style="font-size:11px;color:var(--muted2)">${e.position||'—'}${trained?` · обучен ${formatDate(progA.date)}`:' · нет даты обучения'}</div>
      </div>
      ${trained?'<span style="font-size:10px;color:var(--green);font-weight:700">✓ готов</span>':'<span style="font-size:10px;color:var(--amber);font-weight:700">! без даты</span>'}
    </label>`;
  }).join('');

  // Переключатель формы (только для малого бизнеса)
  const choiceBlock = cat.canChoose ? `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.5px;margin-bottom:8px">ФОРМА ОБУЧЕНИЯ</div>
      <div style="display:flex;gap:8px">
        <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="protocol-form" value="commission" checked style="accent-color:var(--blue)"> Комиссией внутри
        </label>
        <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="protocol-form" value="external" style="accent-color:var(--blue)"> Внешний центр
        </label>
      </div>
    </div>` : '';

  let modal = document.getElementById('modalProtocol');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'modalProtocol';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div class="modal" style="max-width:560px;width:90%;max-height:88vh;overflow-y:auto;background:var(--s2);border:1px solid var(--border);border-radius:18px;padding:26px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <span style="font-size:22px">📋</span>
        <div style="font-size:18px;font-weight:700;color:var(--text)">Протокол проверки знаний</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">${c.name}</div>

      <!-- ИНФО О КАТЕГОРИИ -->
      <div style="background:${cat.color}14;border:1px solid ${cat.color}40;border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${cat.color}"></span>
          <span style="font-size:13px;font-weight:700;color:${cat.color}">${cat.name} · ${staffCount} чел.</span>
        </div>
        <div style="font-size:11.5px;color:#d4d4d8;line-height:1.55">${cat.info}</div>
      </div>

      ${improvements.length ? `
      <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:8px">${ic("lightbulb",14)} Ассистент советует дозаполнить:</div>
        ${improvements.map(i=>`<div style="font-size:12px;color:#d4d4d8;padding:3px 0">• ${i}</div>`).join('')}
        <div style="font-size:11px;color:var(--muted2);margin-top:8px">Можно сформировать и сейчас, но с этими данными протокол будет полным.</div>
      </div>` : ''}

      ${choiceBlock}

      <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.5px;margin-bottom:10px">ВЫБЕРИТЕ СОТРУДНИКОВ</div>
      ${empRows}

      <div style="margin-top:16px">
        <div class="form-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">Дата ${cat.needsCommission?'заседания комиссии':'проведения инструктажа'}</div>
        <input class="form-input" id="protocol-date" type="date" value="${new Date().toISOString().slice(0,10)}">
      </div>

      <div style="display:flex;gap:10px;margin-top:22px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('modalProtocol').remove()">Отмена</button>
        <button class="btn btn-primary" style="flex:2" onclick="generateProtocol(${clientId}, '${cat.key}')">📥 Сформировать PDF</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function generateProtocol(clientId, catKey) {
  const checked = [...document.querySelectorAll('.protocol-emp:checked')].map(cb => parseInt(cb.value));
  if (!checked.length) {
    showToast('Выберите хотя бы одного сотрудника', 'var(--amber)');
    return;
  }
  const protocolDate = document.getElementById('protocol-date').value;
  const formChoice = document.querySelector('input[name="protocol-form"]:checked')?.value || 'commission';
  document.getElementById('modalProtocol').remove();
  showToast('📋 Формирую протокол...');

  const c = await window.api.clientGet(clientId);
  const allEmps = await window.api.employeesList(clientId);
  const emps = allEmps.filter(e => checked.includes(e.id));
  const s = await window.api.settingsGet();
  const cat = getEnterpriseCategory(allEmps.length);

  const dateStr = new Date(protocolDate).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
  const yr = new Date(protocolDate).getFullYear();

  // Внешний центр для малого бизнеса
  if (cat.canChoose && formChoice === 'external') {
    const html = buildExternalNotice(c, emps, dateStr, s);
    const fname = `Направление_на_обучение_${(c.name||'').replace(/[^а-яёa-z0-9]/gi,'_').slice(0,30)}`;
    const result = await window.api.pdfGenerate({ html, filename: fname });
    if (result.ok) showToast('✅ Документ сохранён');
    else if (!result.canceled) showToast('Ошибка: ' + (result.error||'PDF'), 'var(--red)');
    return;
  }

  const isMicro = catKey === 'micro';
  const protocolNum = `${(c.order_prefix||1)}-${isMicro?'ИН':'ПЗ'}/${yr}`;
  const chairman = c.ot_name || c.manager_name || 'Председатель комиссии';
  const chairmanPos = c.ot_position || 'Специалист по охране труда';

  const empTableRows = emps.map((e, i) => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;font-size:12px">${i+1}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${e.full_name}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${e.position||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;text-align:center">${isMicro?'Инструктаж':'Программа А'}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;text-align:center;color:#059669;font-weight:600">${isMicro?'проведён':'сдал'}</td>
    </tr>`).join('');

  const docTitle = isMicro
    ? 'ПРОТОКОЛ проведения инструктажа и проверки знаний требований охраны труда'
    : 'ПРОТОКОЛ заседания комиссии по проверке знаний требований охраны труда';

  const intro = isMicro
    ? `Проверку знаний требований охраны труда провёл <b>${chairman}</b> (${chairmanPos}), назначенный приказом работодателя. В соответствии с п. 100 Правил, утв. Постановлением Правительства РФ № 2464 от 24.12.2021, на микропредприятии обучение проведено в форме инструктажа.`
    : `Комиссия в составе председателя <b>${chairman}</b> (${chairmanPos}) провела проверку знаний требований охраны труда у работников организации в объёме программы обучения по охране труда (Программа А) в соответствии с Постановлением Правительства РФ № 2464 от 24.12.2021.`;

  const conclusion = isMicro
    ? `Указанные работники прошли инструктаж по охране труда, проверку знаний и допущены к самостоятельной работе.`
    : `Проверяемые показали удовлетворительные знания требований охраны труда и признаны прошедшими проверку знаний.`;

  const signBlock = isMicro
    ? `<div style="margin-bottom:24px"><b>Инструктаж и проверку провёл:</b><br><br>_______________________ / ${chairman} /</div>`
    : `<div style="margin-bottom:24px"><b>Председатель комиссии:</b><br><br>_______________________ / ${chairman} /</div>
       <div style="margin-bottom:14px;font-size:13px;color:#555">Члены комиссии:</div>
       <div style="margin-bottom:14px">_______________________ / _________________ /</div>
       <div style="margin-bottom:14px">_______________________ / _________________ /</div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Times New Roman',serif}
  body{padding:50px 56px;color:#000;font-size:14px;line-height:1.5}</style></head><body>
    <div style="text-align:center;margin-bottom:8px;font-weight:700;font-size:15px">${c.name}</div>
    <div style="text-align:center;margin-bottom:24px;font-size:12px;color:#444">${c.address||''}${c.inn?' · ИНН '+c.inn:''}</div>
    <div style="text-align:center;font-weight:700;font-size:15px;margin-bottom:4px">ПРОТОКОЛ № ${protocolNum}</div>
    <div style="text-align:center;font-size:13px;margin-bottom:24px">${docTitle.replace('ПРОТОКОЛ ','')}</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px">
      <span>${c.city||'г. ___________'}</span><span>${dateStr}</span>
    </div>
    <p style="margin-bottom:14px;text-align:justify">${intro}</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;width:40px">№</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">Ф.И.О.</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">Должность</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${isMicro?'Вид':'Программа'}</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;width:90px">Результат</th>
      </tr></thead>
      <tbody>${empTableRows}</tbody>
    </table>
    <p style="margin:18px 0;text-align:justify">${conclusion}</p>
    <div style="margin-top:40px">${signBlock}
      <div style="font-size:11px;color:#666;margin-top:30px">Протокол сформирован в системе КомплаенсПро · ${new Date().toLocaleDateString('ru-RU')}</div>
    </div>
  </body></html>`;

  const fname = `Протокол_${protocolNum.replace(/\//g,'-')}_${(c.name||'').replace(/[^а-яёa-z0-9]/gi,'_').slice(0,30)}`;
  const result = await window.api.pdfGenerate({ html, filename: fname });
  if (result.ok) showToast('✅ Протокол сохранён');
  else if (!result.canceled) showToast('Ошибка: ' + (result.error||'не удалось создать PDF'), 'var(--red)');
}

function buildExternalNotice(c, emps, dateStr, s) {
  const rows = emps.map((e,i)=>`<tr>
    <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;font-size:12px">${i+1}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${e.full_name}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">${e.position||'—'}</td>
  </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Times New Roman',serif}
  body{padding:50px 56px;color:#000;font-size:14px;line-height:1.5}</style></head><body>
    <div style="text-align:center;margin-bottom:8px;font-weight:700;font-size:15px">${c.name}</div>
    <div style="text-align:center;margin-bottom:24px;font-size:12px;color:#444">${c.address||''}${c.inn?' · ИНН '+c.inn:''}</div>
    <div style="text-align:center;font-weight:700;font-size:15px;margin-bottom:20px">СПИСОК работников для направления на обучение по охране труда</div>
    <div style="text-align:right;margin-bottom:16px;font-size:13px">${dateStr}</div>
    <p style="margin-bottom:14px;text-align:justify">Направить на обучение по охране труда (Программа А) во внешний аккредитованный учебный центр следующих работников в соответствии с Приложением № 4 к ПП № 2464:</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;width:40px">№</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">Ф.И.О.</th>
        <th style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px">Должность</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>
    <div style="margin-top:40px"><b>Руководитель:</b><br><br>_______________________ / ${c.manager_name||'_________________'} /</div>
    <div style="font-size:11px;color:#666;margin-top:30px">Сформировано в системе КомплаенсПро · ${new Date().toLocaleDateString('ru-RU')}</div>
  </body></html>`;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => { if (t.getAttribute('onclick') && t.getAttribute('onclick').includes(name)) t.classList.add('active'); });
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
}

function renderDocRow(d) {
  const statusMap = { ok:'✓ Актуален', outdated:'⚠ Обновить', draft:'В работе', missing:'Отсутствует' };
  const colorMap  = { ok:'var(--green)', outdated:'var(--red)', draft:'var(--amber)', missing:'var(--muted2)' };
  const canOpen   = d.filepath && d.status === 'ok';
  const fp        = canOpen ? d.filepath.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
  const openBtn   = canOpen
    ? `<button onclick="openDocFile('${fp}', event)" style="background:none;border:none;cursor:pointer;color:var(--muted2);padding:4px 6px;border-radius:6px;transition:color .2s;display:flex;align-items:center" title="Открыть файл" onmouseover="this.style.color='var(--blue2)'" onmouseout="this.style.color='var(--muted2)'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>`
    : '';
  return `<div class="client-row" style="cursor:${canOpen?'pointer':'default'}" ${canOpen?`onclick="openDocFile('${fp}', event)"`:''}">
    <div class="client-avatar-sm" style="background:var(--s3);color:var(--muted2);display:flex;align-items:center;justify-content:center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
    <div class="client-info">
      <div class="client-name" style="font-size:12px">${(()=>{
        let n=(d.name||'').replace(/.*[\/\\]/,'').replace(/_/g,' ').replace(/\.docx$/i,'');
        n=n.replace(/^\d{2}\.\d{2}\s*/,'').replace(/^\d+\s+/,'');
        n=n.replace(/\bПриказ\s+\d+\s*/gi,'Приказ ');
        n=n.replace(/\bИОТ\s+№?\s*\d+[\-\w]*\s*/gi,'ИОТ ');
        return n.replace(/\s+/g,' ').trim();
      })()}</div>
      <div class="client-meta">${d.updated_at ? formatDate(d.updated_at) : 'Не создан'}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
      <span style="font-size:11px;font-weight:600;color:${colorMap[d.status]||'var(--muted2)'}">${statusMap[d.status]||d.status}</span>
      ${openBtn}
    </div>
  </div>`;
}

function renderEmptyDocs(mod, clientId) {
  return `<div class="empty-state">
    <div class="empty-icon">${ic("file-text",40)}</div>
    <div class="empty-title">Документов нет</div>
    <div class="empty-sub">Документы по модулю ${mod} появятся здесь после генерации</div>
    <button class="btn btn-primary" style="margin-top:8px" onclick="showToast('Генерация документов будет доступна после подключения AI')">${ic("zap",14)} Сгенерировать</button>
  </div>`;
}

// ─── Группировка документов по разделам ───────────────────────
function renderDocsBySection(docs) {
  // Конфигурация разделов — короткие названия для UI
  const sections = [
    { key:'s1', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, label:'Организационные',    color:'#60a5fa', docs:[] },
    { key:'s2', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`, label:'Нормативные акты',   color:'#a78bfa', docs:[] },
    { key:'s3', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, label:'Электробезопасность', color:'#fbbf24', docs:[] },
    { key:'s4', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`, label:'СОУТ и риски',        color:'#34d399', docs:[] },
    { key:'s5', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`, label:'Инструкции',          color:'#f87171', docs:[] },
    { key:'s6', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`, label:'Журналы учёта',       color:'#fb923c', docs:[] },
    { key:'s7', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`, label:'Программы обучения',  color:'#e879f9', docs:[] },
    { key:'s0', icon:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, label:'Прочие документы',    color:'#94a3b8', docs:[] },
  ];

  docs.forEach(d => {
    // Определяем раздел по пути файла (папке) или по ключевым словам имени
    const fp   = (d.filepath || d.name || '').replace(/\\/g, '/');
    const name = (d.name || d.filename || '').replace(/\\/g, '/');

    if      (/Раздел.?1|01_Орган|Организационн|Политика|Положение.*СУОТ|Приказ|План.мероприятий|График.*мероприятий/i.test(fp+name)) sections[0].docs.push(d);
    else if (/Раздел.?2|02_Норм|Нормативн|Положение.*(обучени|организаци|разработк|микротравм|СИЗ)|Правила.*трудов/i.test(fp+name)) sections[1].docs.push(d);
    else if (/Раздел.?3|03_Электр|Электробезопасн|Журнал.*группа|Программа.*электро/i.test(fp+name)) sections[2].docs.push(d);
    else if (/Раздел.?4|04_СОУТ|СОУТ|оценк.*риск/i.test(fp+name)) sections[3].docs.push(d);
    else if (/Раздел.?5|05_Инстр|Инструкци|ИОТ/i.test(fp+name)) sections[4].docs.push(d);
    else if (/Раздел.?6|06_Журн|Журнал|Личная.карточка/i.test(fp+name)) sections[5].docs.push(d);
    else if (/Раздел.?7|07_Прогр|Программа.*(вводного|первичного|противопожарн)/i.test(fp+name)) sections[6].docs.push(d);
    else    sections[7].docs.push(d);
  });

  let html = '';
  sections.forEach(sec => {
    if (!sec.docs.length) return;
    const okCount  = sec.docs.filter(d=>d.status==='ok').length;
    const pct      = Math.round(okCount / sec.docs.length * 100);
    const pctColor = pct===100 ? '#34d399' : pct>=50 ? '#fbbf24' : '#f87171';
    const sectionHtml = sec.docs.map(d => renderDocRow(d)).join('');
    html += `
      <div class="doc-section" style="margin-bottom:8px">
        <div class="doc-section-header" onclick="toggleSection(this)" style="
          display:flex;align-items:center;gap:10px;
          padding:12px 16px;
          background:linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%);
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
          border-radius:12px;
          border:1px solid rgba(255,255,255,0.08);
          border-left:3px solid ${sec.color};
          cursor:pointer;user-select:none;
          box-shadow:0 2px 8px rgba(0,0,0,0.15);
          transition:all .2s ease">
          <span style="font-size:18px;filter:drop-shadow(0 0 4px ${sec.color}44)">${sec.icon}</span>
          <span style="font-size:12px;font-weight:600;color:#f1f5f9;flex:1;letter-spacing:.2px">${sec.label}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:60px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${pctColor};border-radius:2px;transition:width .3s"></div>
            </div>
            <span style="font-size:10px;color:${pctColor};font-weight:600;min-width:28px;text-align:right">${pct}%</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.07);
                         padding:2px 8px;border-radius:8px;min-width:20px;text-align:center">${sec.docs.length}</span>
            <span class="section-arrow" style="color:rgba(255,255,255,0.3);font-size:10px;
                  transition:transform .2s;transform:rotate(-90deg)">▼</span>
          </div>
        </div>
        <div class="section-docs" style="display:none;padding:4px 0 4px 8px;
             border-left:1px solid ${sec.color}33;margin-left:14px">
          ${sectionHtml}
        </div>
      </div>`;
  });

  return html || emptyState("file-text","Документов нет");
}

function toggleScoreBreakdown() {
  const el = document.getElementById('score-breakdown');
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => document.addEventListener('click', function hide(e) {
      if (!el.contains(e.target)) { el.style.display='none'; document.removeEventListener('click',hide); }
    }), 0);
  }
}

function toggleSection(header) {
  const docs  = header.nextElementSibling;
  const arrow = header.querySelector('.section-arrow');
  const isOpen = docs.style.display !== 'none';
  docs.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
  header.style.background = isOpen
    ? 'linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)'
    : 'linear-gradient(135deg,rgba(255,255,255,0.1) 0%,rgba(255,255,255,0.04) 100%)';
}

function renderEmpRow(e, divisions = []) {
  const birthYear = e.birth_date ? ' · ' + e.birth_date.slice(0,4) + ' г.р.' : '';
  const training  = e.training || {};
  const TYPES = ['prog_a','first_aid','fire','siz','repeat','medcheck','medcheck_714','psycho'];
  const today = new Date();
  const division = divisions.find(d => d.id === e.division_id);
  const divBadge = division
    ? `<span style="font-size:10px;background:rgba(96,165,250,0.12);color:#60a5fa;padding:1px 7px;border-radius:10px;margin-right:4px">${(DIVISION_WORK_TYPES[division.work_type]?.icon||'🏢')} ${division.name}</span>`
    : '';

  // Считаем статус обучения
  let alertCount = 0;
  TYPES.forEach(key => {
    const t = training[key];
    if (!t?.required || !t?.date) return;
    const last = new Date(t.date);
    const next = new Date(last);
    if (key === 'repeat') next.setMonth(next.getMonth() + 6);
    else if (key === 'medcheck' || key === 'medcheck_714') next.setFullYear(next.getFullYear() + 1);
    else if (key === 'psycho') next.setFullYear(next.getFullYear() + 5);
    else next.setFullYear(next.getFullYear() + 3);
    const days = Math.ceil((next - today) / 86400000);
    if (days <= 30) alertCount++;
  });

  const alertBadge = alertCount > 0
    ? `<span style="background:${alertCount > 0 ? 'var(--red)' : 'var(--amber)'};color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;margin-right:4px">${alertCount}</span>`
    : '';

  return `<div class="client-row">
    <div class="client-avatar-sm" style="background:var(--s3);color:var(--muted2);font-size:11px;font-weight:700">${e.full_name.split(' ').map(w=>w[0]||'').join('').slice(0,2)}</div>
    <div class="client-info">
      <div class="client-name">${e.full_name}</div>
      <div class="client-meta">${e.position||'—'}${birthYear}${e.is_military?' · '+ic('star',12):''}${divBadge ? ' · ' : ''}${divBadge}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      ${alertBadge}
      <button class="btn btn-ghost" style="padding:4px 10px;display:flex;align-items:center;gap:5px;font-size:11px" onclick="openTraining(${e.id})" title="Обучение">${ic('graduation-cap',14)}</button>
      <button class="btn btn-ghost" style="padding:4px 10px;display:flex;align-items:center;gap:5px;font-size:11px" onclick="editEmployeePrompt(${e.id})" title="Редактировать">${ic('edit',14)}</button>
      <button class="btn btn-ghost" style="padding:4px 10px;display:flex;align-items:center;gap:5px;font-size:11px;color:var(--red)" onclick="deleteEmployee(${e.id})" title="Удалить">${ic('trash',14)}</button>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
//  ПОДРАЗДЕЛЕНИЯ
// ═══════════════════════════════════════════════════════

async function openDivisionModal(clientId, divisionId = null) {
  const existing = divisionId ? (await window.api.divisionsList(clientId)).find(d => d.id === divisionId) : null;

  const workTypeOptions = Object.entries(DIVISION_WORK_TYPES).map(([key, wt]) =>
    `<option value="${key}" ${existing?.work_type === key ? 'selected' : key === 'standard' && !existing ? 'selected' : ''}>
      ${wt.icon} ${wt.label}
    </option>`
  ).join('');

  let modal = document.getElementById('modalDivision');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'modalDivision';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:18px;padding:26px;width:500px;max-height:88vh;overflow-y:auto">
      <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:18px">
        ${existing ? '✏️ Редактировать подразделение' : '+ Добавить подразделение'}
      </div>

      <div class="form-group" style="margin-bottom:14px">
        <div class="form-label">Название подразделения</div>
        <input class="form-input" id="div-name" placeholder="Например: Администрация, Флот, Цех №1, ПАСФ" value="${existing?.name || ''}">
      </div>

      <div class="form-group" style="margin-bottom:14px">
        <div class="form-label">Тип работ</div>
        <select class="form-select" id="div-work-type" onchange="updateDivisionPreview()">
          ${workTypeOptions}
        </select>
      </div>

      <div class="form-group" style="margin-bottom:18px">
        <div class="form-label">Класс СОУТ (если отличается от типа)</div>
        <select class="form-select" id="div-soat-class">
          <option value="" ${!existing?.soat_class?'selected':''}>По умолчанию для типа работ</option>
          <option value="1" ${existing?.soat_class==='1'?'selected':''}>Класс 1 — Оптимальные</option>
          <option value="2" ${existing?.soat_class==='2'?'selected':''}>Класс 2 — Допустимые</option>
          <option value="31" ${existing?.soat_class==='31'?'selected':''}>Класс 3.1 — Вредные (1 ст.)</option>
          <option value="32" ${existing?.soat_class==='32'?'selected':''}>Класс 3.2 — Вредные (2 ст.)</option>
          <option value="33" ${existing?.soat_class==='33'?'selected':''}>Класс 3.3 — Вредные (3 ст.)</option>
          <option value="34" ${existing?.soat_class==='34'?'selected':''}>Класс 3.4 — Вредные (4 ст.)</option>
          <option value="4" ${existing?.soat_class==='4'?'selected':''}>Класс 4 — Опасные</option>
        </select>
      </div>

      <!-- Предпросмотр требований -->
      <div id="div-preview" style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:18px;font-size:12px"></div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('modalDivision').remove()">Отмена</button>
        ${existing ? `<button class="btn btn-red" style="flex:0 0 auto" onclick="deleteDivision(${divisionId}, ${clientId})">Удалить</button>` : ''}
        <button class="btn btn-primary" style="flex:2" onclick="saveDivision(${clientId}, ${divisionId || 'null'})">
          ${existing ? '${ic("save",14)} Сохранить' : '+ Добавить'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  updateDivisionPreview();
}

function updateDivisionPreview() {
  const key = document.getElementById('div-work-type')?.value;
  const wt = DIVISION_WORK_TYPES[key];
  if (!wt) return;
  const preview = document.getElementById('div-preview');
  if (!preview) return;

  const reqs = [];
  reqs.push(`<span style="color:var(--green)">✓ Программа А (ОТ), Первая помощь, Пожарный минимум, Повторный инструктаж</span>`);
  if (wt.medcheck) reqs.push(`<span style="color:#f87171">✓ Медосмотр по Приказу 29н</span>`);
  if (wt.medcheck_714) reqs.push(`<span style="color:#fbbf24">✓ Медосмотр плавсостава по Приказу 714н</span>`);
  if (wt.psycho) reqs.push(`<span style="color:#a78bfa">✓ Психиатрическое освидетельствование</span>`);
  if (wt.siz) reqs.push(`<span style="color:#60a5fa">✓ Обучение применению СИЗ</span>`);

  preview.innerHTML = `
    <div style="font-weight:700;color:var(--text);margin-bottom:8px">${wt.icon} ${wt.label}</div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">${reqs.join('')}</div>
    ${wt.note ? `<div style="color:#475569;font-size:11px;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">ℹ️ ${wt.note}</div>` : ''}`;
}

async function saveDivision(clientId, divisionId) {
  const name = document.getElementById('div-name')?.value.trim();
  if (!name) { showToast('Введите название подразделения', 'var(--amber)'); return; }

  const workType = document.getElementById('div-work-type')?.value || 'standard';

  // ── МЯГКАЯ ПРОВЕРКА ОКВЭД ──────────────────────────
  // Соответствие типа работ и ОКВЭД (первые 2 цифры)
  const OKVED_MAP = {
    maritime: { codes: ['50'], name: 'Водный транспорт (50.xx)' },
    port:     { codes: ['52'], name: 'Вспомогательная транспортная деятельность (52.xx)' },
    pasf:     { codes: ['84','38','39'], name: 'Госуправление, утилизация (84.xx, 38-39.xx)' },
    diver:    { codes: ['50','71','72'], name: 'Водный транспорт, научные исследования (50.xx, 71-72.xx)' },
    production: { codes: ['10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33'], name: 'Производство (10-33.xx)' },
    height:   { codes: ['41','42','43'], name: 'Строительство (41-43.xx)' },
    hazardous:{ codes: ['05','06','07','08','09','19','20','24'], name: 'Добыча, нефтехимия (05-09.xx, 19-20.xx, 24.xx)' },
  };

  const mapping = OKVED_MAP[workType];
  if (mapping) {
    const c = await window.api.clientGet(clientId);
    const okved = (c?.okved || '').replace('.','').slice(0,2);
    const matches = mapping.codes.some(code => okved.startsWith(code));

    if (!matches && okved) {
      // Показываем предупреждение прямо в модалке
      const existing = document.getElementById('div-okved-warning');
      if (existing) existing.remove();

      const wt = DIVISION_WORK_TYPES[workType];
      const warning = document.createElement('div');
      warning.id = 'div-okved-warning';
      warning.style.cssText = 'background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12px';
      warning.innerHTML = `
        <div style="font-weight:700;color:#fbbf24;margin-bottom:6px">⚠️ ОКВЭД не совпадает с типом работ</div>
        <div style="color:#d4d4d8;line-height:1.5">
          ОКВЭД организации: <b>${c.okved}</b><br>
          Тип «${wt.icon} ${wt.label}» обычно применяется для: <b>${mapping.name}</b>
        </div>
        <div style="color:#94a3b8;font-size:11px;margin-top:8px">Если это корректно — нажмите «Сохранить» ещё раз.</div>
        <button onclick="document.getElementById('div-okved-warning').remove()" 
          style="margin-top:8px;padding:5px 12px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);border-radius:6px;color:#fbbf24;cursor:pointer;font-size:11px">
          Понял, всё равно сохранить →
        </button>`;

      // Вставляем предупреждение перед кнопками
      const btns = document.querySelector('#modalDivision .btn.btn-primary')?.parentElement;
      if (btns) btns.parentElement.insertBefore(warning, btns);

      // Первый клик показывает предупреждение, второй — сохраняет
      return;
    }
  }

  // Предупреждение уже было показано или ОКВЭД совпадает — сохраняем
  const data = {
    client_id:  clientId,
    name,
    work_type:  workType,
    soat_class: document.getElementById('div-soat-class')?.value || '',
  };

  if (divisionId) {
    await window.api.divisionsUpdate(divisionId, data);
    showToast('✅ Подразделение обновлено');
  } else {
    await window.api.divisionsAdd(data);
    showToast('✅ Подразделение добавлено');
  }

  document.getElementById('modalDivision')?.remove();
  await navigate('client', clientId);
}

async function deleteDivision(divisionId, clientId) {
  if (!confirm('Удалить подразделение? Сотрудники будут откреплены.')) return;
  await window.api.divisionsDelete(divisionId);
  document.getElementById('modalDivision')?.remove();
  showToast('Подразделение удалено');
  await navigate('client', clientId);
}

// ═══════════════════════════════════════════════════════
//  МОДУЛЬ ОБУЧЕНИЯ
// ═══════════════════════════════════════════════════════
const TRAINING_TYPES_BASE = [
  { key:'prog_a',    label:'Программа А — общие вопросы ОТ',           period:'3 года',  years:3,   who:'Руководитель, отв. за ОТ',       alwaysRequired: true  },
  { key:'prog_b',    label:'Программа Б — безопасные методы работы',   period:'3 года',  years:3,   who:'Специалисты, рабочие',            alwaysRequired: false },
  { key:'prog_v',    label:'Программа В — работы повышенной опасности',period:'1 год',   years:1,   who:'Работники с допуском к РПО',      alwaysRequired: false },
  { key:'first_aid', label:'Первая помощь пострадавшим',               period:'3 года',  years:3,   who:'Все работники',                   alwaysRequired: true  },
  { key:'fire',      label:'Пожарно-технический минимум',              period:'3 года',  years:3,   who:'Руководитель, отв. за ПБ',        alwaysRequired: true  },
  { key:'siz',       label:'Применение СИЗ',                          period:'3 года',  years:3,   who:'Работники применяющие СИЗ',       alwaysRequired: false },
  { key:'repeat',    label:'Повторный инструктаж на р.м.',             period:'6 мес.',  months:6,  who:'Все (кроме освобождённых)',       alwaysRequired: true  },
  { key:'medcheck',  label:'Медицинский осмотр (Приказ 29н)',          period:'1 год',   years:1,   who:'При наличии оснований',           alwaysRequired: false },
  { key:'medcheck_714', label:'Медосмотр плавсостава (Приказ 714н)',   period:'2 года',  years:2,   who:'Моряки, плавсостав',              alwaysRequired: false },
  { key:'psycho',    label:'Психиатрическое освидетельствование',      period:'5 лет',   years:5,   who:'ПАСФ, спасатели, высотники',      alwaysRequired: false },
];

// Типы работ подразделения и их требования
const DIVISION_WORK_TYPES = {
  standard: {
    label: 'Обычные (офис, торговля, услуги)',
    icon: '🏢',
    soatDefault: '2',
    medcheck: false,
    medcheck_714: false,
    psycho: false,
    hazard: false,
    siz: false,
    note: '',
  },
  production: {
    label: 'Производство / склад / цех',
    icon: '🏭',
    soatDefault: '31',
    medcheck: true,
    medcheck_714: false,
    psycho: false,
    hazard: false,
    siz: true,
    note: 'Медосмотр по Приказу 29н обязателен при классе 3+',
  },
  maritime: {
    label: 'Морской / плавсостав',
    icon: '⚓',
    soatDefault: '32',
    medcheck: true,
    medcheck_714: true,
    psycho: false,
    hazard: true,
    siz: true,
    note: 'Оба медосмотра: Приказ 29н + Приказ 714н (КТМ РФ)',
  },
  port: {
    label: 'Портовые рабочие / докеры / стивидоры',
    icon: '🚢',
    soatDefault: '32',
    medcheck: true,
    medcheck_714: false,
    psycho: false,
    hazard: true,
    siz: true,
    note: 'Отраслевые ПОТ для портов действуют до 01.09.2027',
  },
  pasf: {
    label: 'ПАСФ / спасатели / аварийные службы',
    icon: '🚨',
    soatDefault: '33',
    medcheck: true,
    medcheck_714: false,
    psycho: true,
    hazard: true,
    siz: true,
    note: 'Медосмотр по п.14 Приказа 29н (АСФ) + психосвидетельствование',
  },
  diver: {
    label: 'Водолазные работы',
    icon: '🤿',
    soatDefault: '33',
    medcheck: true,
    medcheck_714: false,
    psycho: true,
    hazard: true,
    siz: true,
    note: 'Медосмотр по п.19 Приказа 29н (водолазные работы) обязателен',
  },
  height: {
    label: 'Работы на высоте',
    icon: '🏗️',
    soatDefault: '31',
    medcheck: true,
    medcheck_714: false,
    psycho: false,
    hazard: true,
    siz: true,
    note: 'ПОТ при работах на высоте действуют до 01.09.2031',
  },
  hazardous: {
    label: 'Опасные / вредные производства',
    icon: '⚠️',
    soatDefault: '34',
    medcheck: true,
    medcheck_714: false,
    psycho: false,
    hazard: true,
    siz: true,
    note: 'Класс условий труда уточняется по результатам СОУТ',
  },
};

// Определяем какие программы нужны для конкретного сотрудника
// с учётом его подразделения
function getRequiredTraining(client, employee, existingTraining, division) {
  // Приоритет: подразделение → клиент → умолчания
  const divWorkType = division?.work_type ? DIVISION_WORK_TYPES[division.work_type] : null;
  const soatClass   = parseInt(division?.soat_class || client?.soat_class || '2');
  const hazardWorks = divWorkType?.hazard || !!client?.hazard_works;
  const medRequired = divWorkType?.medcheck || !!client?.medcheck_required || !!employee?.medcheck_required;
  const med714      = divWorkType?.medcheck_714 || false;
  const psycho      = divWorkType?.psycho || false;
  const needSiz     = divWorkType?.siz || soatClass >= 31 || hazardWorks;
  const isOffice    = soatClass <= 2 && !hazardWorks;
  const progBExempt = !!employee?.prog_b_exempt;

  return TRAINING_TYPES_BASE.map(tt => {
    const existing = existingTraining?.[tt.key] || {};
    let required = existing.required;

    if (required === undefined) {
      if (tt.key === 'prog_a')       required = true;
      if (tt.key === 'prog_b')       required = !isOffice && !progBExempt;
      if (tt.key === 'prog_v')       required = hazardWorks;
      if (tt.key === 'first_aid')    required = true;
      if (tt.key === 'fire')         required = true;
      if (tt.key === 'siz')          required = needSiz;
      if (tt.key === 'repeat')       required = true;
      if (tt.key === 'medcheck')     required = medRequired;
      if (tt.key === 'medcheck_714') required = med714;
      if (tt.key === 'psycho')       required = psycho;
    }

    return { ...tt, required };
  });
}

const TRAINING_TYPES = TRAINING_TYPES_BASE; // для обратной совместимости

function calcNextDate(dateStr, tt) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (tt.years)  d.setFullYear(d.getFullYear() + tt.years);
  if (tt.months) d.setMonth(d.getMonth() + tt.months);
  return d;
}

function trainingStatus(tt, t) {
  if (!t?.required) return { icon:'—', color:'var(--muted)', label:'Не требуется', days:null };
  if (!t?.date)     return { icon:'❌', color:'var(--red)',   label:'Не пройдено',  days:null };
  const next = calcNextDate(t.date, tt);
  const days = Math.ceil((next - new Date()) / 86400000);
  if (days < 0)   return { icon:'🔴', color:'var(--red)',   label:`Просрочено ${Math.abs(days)} дн.`, days };
  if (days <= 14) return { icon:'🟠', color:'var(--amber)', label:`${days} дн.`,   days };
  if (days <= 30) return { icon:'🟡', color:'var(--amber)', label:`${days} дн.`,   days };
  return { icon:'✅', color:'var(--green)', label:formatDate(next.toISOString()), days };
}

async function openTraining(empId) {
  const emps = await window.api.employeesList(currentClientId);
  const e = emps.find(x => x.id === empId);
  if (!e) return;

  const client   = await window.api.clientGet(currentClientId);
  const training = e.training || {};
  const allDivisions = await window.api.divisionsList(currentClientId);
  const division = allDivisions.find(d => d.id === e.division_id) || null;
  const types    = getRequiredTraining(client, e, training, division);

  const modal = document.createElement('div');
  modal.id = 'trainingModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999';

  const rows = types.map(tt => {
    const t  = { ...tt, ...(training[tt.key]||{}) };
    const st = trainingStatus(tt, { required: tt.required, date: training[tt.key]?.date });
    const nextD = t.date ? calcNextDate(t.date, tt) : null;
    return `
      <div style="display:grid;grid-template-columns:1fr 110px 130px 160px;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
        <div>
          <div style="font-size:12px;font-weight:600;color:#f1f5f9">${tt.label}</div>
          <div style="font-size:10px;color:#64748b">${tt.who} · каждые ${tt.period}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="checkbox" id="tr-req-${tt.key}" ${t.required?'checked':''} style="width:15px;height:15px;cursor:pointer" onchange="updateTrainingRequired('${tt.key}',this.checked)">
          <label style="font-size:11px;color:#94a3b8">Требуется</label>
        </div>
        <div>
          <input type="date" id="tr-date-${tt.key}" value="${t.date||''}" style="width:100%;padding:6px 8px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#f1f5f9;font-size:12px;outline:none" ${!t.required?'disabled':''}>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:13px">${st.icon}</span>
          <span style="font-size:11px;font-weight:600;color:${st.color}">${st.label}</span>
        </div>
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">${ic('graduation-cap', 14)} Обучение</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${e.full_name} · ${e.position||''}</div>
        </div>
        <button onclick="document.getElementById('trainingModal').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 110px 130px 160px;gap:8px;padding-bottom:8px;border-bottom:2px solid rgba(255,255,255,0.08);margin-bottom:4px">
        <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px">ВИД ОБУЧЕНИЯ</div>
        <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px">НУЖЕН</div>
        <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px">ПОСЛЕДНЕЕ</div>
        <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px">СЛЕДУЮЩЕЕ</div>
      </div>
      ${rows}
      <div style="margin-top:16px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Учебная организация</label>
        <input id="tr-org" value="${training.org||''}" placeholder="ООО УЦ Профессионал" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
        <button onclick="saveTraining(${empId})" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">${ic("save",14)} Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', ev => { if (ev.target === modal) modal.remove(); });

  // Сохраняем текущий training в window для обновления
  window._currentTraining = JSON.parse(JSON.stringify(training));
  window._currentTrainingEmpId = empId;
}

function updateTrainingRequired(key, checked) {
  if (!window._currentTraining) return;
  if (!window._currentTraining[key]) window._currentTraining[key] = {};
  window._currentTraining[key].required = checked;
  const dateInput = document.getElementById('tr-date-' + key);
  if (dateInput) dateInput.disabled = !checked;
}

async function saveTraining(empId) {
  const training = window._currentTraining || {};
  training.org = document.getElementById('tr-org')?.value || '';

  TRAINING_TYPES.forEach(tt => {
    if (!training[tt.key]) training[tt.key] = {};
    const dateEl = document.getElementById('tr-date-' + tt.key);
    const reqEl  = document.getElementById('tr-req-' + tt.key);
    if (dateEl) training[tt.key].date     = dateEl.value;
    if (reqEl)  training[tt.key].required = reqEl.checked;
  });

  await window.api.trainingUpdate(empId, training);
  document.getElementById('trainingModal')?.remove();
  showToast('✅ Данные обучения сохранены');
  await navigate('client', currentClientId);
}



// ─── СКЛОНЕНИЕ ФИО ЧЕРЕЗ AI ──────────────────────────────
async function declineFIO(fullName) {
  try {
    const result = await window.api.aiRequest({
      system: 'Ты — помощник по русской грамматике. Отвечай ТОЛЬКО валидным JSON без markdown и пояснений.',
      prompt: `Просклоняй ФИО "${fullName}" по падежам. Определи пол автоматически.
Верни ТОЛЬКО JSON в формате:
{"nom":"${fullName}","gen":"...","dat":"...","acc":"...","ins":"...","pre":"...","short":"..."}
где short — краткая форма "Фамилия И.О."`,
    });
    if (!result.ok) return null;
    const text = result.text.replace(/```json|```/g,'').trim();
    const data = JSON.parse(text);
    return data;
  } catch(e) {
    console.error('declineFIO error:', e);
    return null;
  }
}

async function addEmployeePrompt(clientId) {
  const clientDivisions = await window.api.divisionsList(clientId);
  const divOptions = clientDivisions.length
    ? `<option value="">— Без подразделения —</option>` + clientDivisions.map(d => {
        const wt = DIVISION_WORK_TYPES[d.work_type] || DIVISION_WORK_TYPES.standard;
        return `<option value="${d.id}">${wt.icon} ${d.name}</option>`;
      }).join('')
    : `<option value="">— Подразделения не созданы —</option>`;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:20px">➕ Добавить сотрудника</div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">ФИО полностью <span style="color:#f87171">*</span></label>
        <input id="emp-name" placeholder="Иванов Иван Иванович" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Должность <span style="color:#f87171">*</span></label>
        <input id="emp-pos" placeholder="Менеджер по продажам" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      ${clientDivisions.length ? `
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">🏢 Подразделение</label>
        <select id="emp-division" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
          ${divOptions}
        </select>
      </div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Пол</label>
          <div style="display:flex;gap:8px">
            <button id="emp-gender-m" onclick="selectGender('m')" style="flex:1;padding:9px;background:rgba(59,130,246,0.15);border:1px solid var(--blue);border-radius:8px;color:#60a5fa;cursor:pointer;font-size:13px;font-weight:600">М</button>
            <button id="emp-gender-f" onclick="selectGender('f')" style="flex:1;padding:9px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px;font-weight:600">Ж</button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Табельный №</label>
          <input id="emp-tab" placeholder="001" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Дата рождения</label>
          <input id="emp-birth" type="date" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Дата приёма</label>
          <input id="emp-hired" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
        </div>
      </div>
      <div style="margin-bottom:20px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="emp-mil" style="width:16px;height:16px;cursor:pointer">
          ${ic("star",14)} Военнообязанный
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="emp-prog-b-exempt" style="width:16px;height:16px;cursor:pointer">
          ${ic("clipboard-list",14)} Освобождён от Программы Б (только ПЭВМ/офис)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="emp-medcheck" style="width:16px;height:16px;cursor:pointer">
          🏥 Требуется медосмотр
        </label>
      </div>

      <!-- Воинский учёт -->
      <div style="padding:14px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.15);border-radius:10px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:#60a5fa;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Воинский учёт
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Категория ВУ</label>
            <select id="emp-vu-cat" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
              <option value="">— Не на учёте —</option>
              <option value="призывник">Призывник (18–27 лет)</option>
              <option value="запас">Военнообязанный запаса</option>
              <option value="ограниченно_годный">Ограниченно годный (кат. В)</option>
              <option value="бронь">Забронированный</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Воинское звание</label>
            <select id="emp-vu-rank" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
              <option value="">— Не указано —</option>
              <option value="рядовой">Рядовой / Матрос</option>
              <option value="сержант">Сержант / Старшина</option>
              <option value="прапорщик">Прапорщик / Мичман</option>
              <option value="офицер">Офицер</option>
            </select>
          </div>
        </div>
        <div style="margin-top:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
            <input type="checkbox" id="emp-vu-mobpred" style="width:14px;height:14px;cursor:pointer;accent-color:#60a5fa">
            Имеет мобилизационное предписание
          </label>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button id="emp-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
        <button id="emp-save" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Добавить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('emp-name').focus();

  // Выбор пола
  window.selectGender = (g) => {
    const m = document.getElementById('emp-gender-m');
    const f = document.getElementById('emp-gender-f');
    if (g === 'm') {
      m.style.background = 'rgba(59,130,246,0.15)'; m.style.borderColor = '#3b82f6'; m.style.color = '#60a5fa';
      f.style.background = '#0f1520';               f.style.borderColor = 'rgba(255,255,255,0.1)'; f.style.color = '#94a3b8';
    } else {
      f.style.background = 'rgba(236,72,153,0.15)'; f.style.borderColor = '#ec4899'; f.style.color = '#f472b6';
      m.style.background = '#0f1520';               m.style.borderColor = 'rgba(255,255,255,0.1)'; m.style.color = '#94a3b8';
    }
    m.dataset.selected = g === 'm' ? '1' : '';
    f.dataset.selected = g === 'f' ? '1' : '';
  };

  await new Promise(resolve => {
    document.getElementById('emp-cancel').onclick = () => { modal.remove(); resolve(false); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
    document.getElementById('emp-save').onclick = async () => {
      const name   = document.getElementById('emp-name').value.trim();
      const pos    = document.getElementById('emp-pos').value.trim();
      const birth  = document.getElementById('emp-birth').value || '';
      const hired  = document.getElementById('emp-hired').value || new Date().toISOString().slice(0,10);
      const tab    = document.getElementById('emp-tab').value.trim();
      const mil         = document.getElementById('emp-mil').checked ? 1 : 0;
      const progBExempt = document.getElementById('emp-prog-b-exempt')?.checked ? 1 : 0;
      const medcheck    = document.getElementById('emp-medcheck')?.checked ? 1 : 0;
      const genderM = document.getElementById('emp-gender-m');
      const gender = genderM?.dataset.selected === '1' ? 'm' : 'f';
      const divEl = document.getElementById('emp-division');
      const divisionId = divEl?.value ? parseInt(divEl.value) : null;
      const vuCat     = document.getElementById('emp-vu-cat')?.value || '';
      const vuRank    = document.getElementById('emp-vu-rank')?.value || '';
      const vuMobpred = document.getElementById('emp-vu-mobpred')?.checked || false;

      if (!name) {
        const el = document.getElementById('emp-name');
        el.style.borderColor = '#f87171';
        el.placeholder = 'Обязательное поле';
        el.addEventListener('input', () => { el.style.borderColor = ''; el.placeholder = 'Иванов Иван Иванович'; }, { once: true });
        return;
      }
      if (!pos) {
        const el = document.getElementById('emp-pos');
        el.style.borderColor = '#f87171';
        el.placeholder = 'Обязательное поле';
        el.addEventListener('input', () => { el.style.borderColor = ''; el.placeholder = 'Должность'; }, { once: true });
        return;
      }

      const saveBtn = document.getElementById('emp-save');
      saveBtn.textContent = '⏳ Обработка...';
      saveBtn.disabled = true;

      // Склоняем ФИО через AI
      let declension = null;
      if (window.api.aiRequest) {
        declension = await declineFIO(name);
      }

      modal.remove();

      await window.api.employeeAdd({
        client_id:         clientId,
        full_name:         name,
        position:          pos,
        birth_date:        birth,
        hired_at:          hired,
        tab_number:        tab,
        gender:            gender,
        department:        '',
        division_id:       divisionId,
        is_military:       mil,
        prog_b_exempt:     progBExempt,
        medcheck_required: medcheck,
        name_gen:          declension?.gen   || '',
        name_dat:          declension?.dat   || '',
        name_acc:          declension?.acc   || '',
        name_ins:          declension?.ins   || '',
        name_short:        declension?.short || '',
        vu_category:       vuCat,
        vu_rank:           vuRank,
        vu_mobpredpisanie: vuMobpred ? 1 : 0,
      });

      if (declension?.dat) {
        showToast('✅ Сотрудник добавлен · ' + declension.short);
      } else {
        showToast('✅ Сотрудник добавлен');
      }
      // Обновляем счётчик сотрудников в базе клиента
      const updatedEmps = await window.api.employeesList(clientId);
      await window.api.clientUpdate(clientId, { staff: updatedEmps.length });
      await navigate('client', clientId);
      resolve(true);
    };
    modal.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') document.getElementById('emp-save').click();
      if (e.key === 'Escape') { modal.remove(); resolve(false); }
    });
  });
}

async function editEmployeePrompt(empId) {
  // Получаем список сотрудников и находим нужного
  const emps = await window.api.employeesList(currentClientId);
  const e = emps.find(x => x.id === empId);
  if (!e) return;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:20px">✏️ Редактировать сотрудника</div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">ФИО полностью</label>
        <input id="edit-emp-name" value="${e.full_name||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Должность</label>
        <input id="edit-emp-pos" value="${e.position||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:6px">Дата рождения</label>
        <input id="edit-emp-birth" type="date" value="${e.birth_date||''}" style="width:100%;padding:10px 12px;background:#0f1520;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:20px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-mil" ${e.is_military?'checked':''} style="width:16px;height:16px;cursor:pointer">
          ${ic("star",14)} Военнообязанный
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-prog-b-exempt" ${e.prog_b_exempt?'checked':''} style="width:16px;height:16px;cursor:pointer">
          ${ic("clipboard-list",14)} Освобождён от Программы Б (только ПЭВМ/офис)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
          <input type="checkbox" id="edit-emp-medcheck" ${e.medcheck_required?'checked':''} style="width:16px;height:16px;cursor:pointer">
          🏥 Требуется медосмотр
        </label>
      </div>

      <!-- Воинский учёт -->
      <div style="padding:14px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.15);border-radius:10px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:#60a5fa;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Воинский учёт
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Категория ВУ</label>
            <select id="edit-emp-vu-cat" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
              <option value="" ${!e.vu_category?'selected':''}>— Не на учёте —</option>
              <option value="призывник" ${e.vu_category==='призывник'?'selected':''}>Призывник (18–27 лет)</option>
              <option value="запас" ${e.vu_category==='запас'?'selected':''}>Военнообязанный запаса</option>
              <option value="ограниченно_годный" ${e.vu_category==='ограниченно_годный'?'selected':''}>Ограниченно годный (кат. В)</option>
              <option value="бронь" ${e.vu_category==='бронь'?'selected':''}>Забронированный</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:#475569;display:block;margin-bottom:5px">Воинское звание</label>
            <select id="edit-emp-vu-rank" style="width:100%;padding:9px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
              <option value="" ${!e.vu_rank?'selected':''}>— Не указано —</option>
              <option value="рядовой" ${e.vu_rank==='рядовой'?'selected':''}>Рядовой / Матрос</option>
              <option value="сержант" ${e.vu_rank==='сержант'?'selected':''}>Сержант / Старшина</option>
              <option value="прапорщик" ${e.vu_rank==='прапорщик'?'selected':''}>Прапорщик / Мичман</option>
              <option value="офицер" ${e.vu_rank==='офицер'?'selected':''}>Офицер</option>
            </select>
          </div>
        </div>
        <div style="margin-top:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#94a3b8">
            <input type="checkbox" id="edit-emp-vu-mobpred" ${e.vu_mobpredpisanie?'checked':''} style="width:14px;height:14px;cursor:pointer;accent-color:#60a5fa">
            Имеет мобилизационное предписание
          </label>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button id="edit-emp-cancel" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);border:none;border-radius:8px;color:#94a3b8;cursor:pointer;font-size:13px">Отмена</button>
        <button id="edit-emp-save" style="flex:1;padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('edit-emp-name').focus();

  await new Promise(resolve => {
    document.getElementById('edit-emp-cancel').onclick = () => { modal.remove(); resolve(false); };
    modal.onclick = (ev) => { if (ev.target === modal) { modal.remove(); resolve(false); } };
    document.getElementById('edit-emp-save').onclick = async () => {
      const name  = document.getElementById('edit-emp-name').value.trim();
      const pos   = document.getElementById('edit-emp-pos').value.trim();
      const birth = document.getElementById('edit-emp-birth').value || '';
      const mil         = document.getElementById('edit-emp-mil').checked ? 1 : 0;
      const progBExempt = document.getElementById('edit-emp-prog-b-exempt')?.checked ? 1 : 0;
      const medcheck    = document.getElementById('edit-emp-medcheck')?.checked ? 1 : 0;
      const vuCat2     = document.getElementById('edit-emp-vu-cat')?.value || '';
      const vuRank2    = document.getElementById('edit-emp-vu-rank')?.value || '';
      const vuMobpred2 = document.getElementById('edit-emp-vu-mobpred')?.checked || false;
      if (!name) { document.getElementById('edit-emp-name').style.border = '1px solid #f87171'; return; }

      const saveBtn2 = document.getElementById('edit-emp-save');
      saveBtn2.textContent = '⏳ Обработка...';
      saveBtn2.disabled = true;

      let declension = null;
      if (window.api.aiRequest) {
        declension = await declineFIO(name);
      }

      modal.remove();
      await window.api.employeeUpdate(empId, {
        full_name:         name,
        position:          pos,
        birth_date:        birth,
        is_military:       mil,
        prog_b_exempt:     progBExempt,
        medcheck_required: medcheck,
        vu_category:       vuCat2,
        vu_rank:           vuRank2,
        vu_mobpredpisanie: vuMobpred2 ? 1 : 0,
        name_gen:          declension?.gen   || '',
        name_dat:          declension?.dat   || '',
        name_acc:          declension?.acc   || '',
        name_ins:          declension?.ins   || '',
        name_short:        declension?.short || '',
      });
      if (declension?.dat) {
        showToast('✅ Сотрудник обновлён · ' + declension.short);
      } else {
        showToast('✅ Сотрудник обновлён');
      }
      await navigate('client', currentClientId);
      resolve(true);
    };
    modal.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') document.getElementById('edit-emp-save').click();
      if (ev.key === 'Escape') { modal.remove(); resolve(false); }
    });
  });
}

async function deleteEmployee(id) {
  if (!confirm('Удалить сотрудника?')) return;
  await window.api.employeeDelete(id);
  // Обновляем счётчик сотрудников в базе клиента
  const updatedEmps = await window.api.employeesList(currentClientId);
  await window.api.clientUpdate(currentClientId, { staff: updatedEmps.length });
  showToast('Удалено');
  await navigate('client', currentClientId);
}

async function addTaskForClient(clientId) {
  showAddTaskModal(clientId);
}

// ── ЗАДАЧИ ───────────────────────────────────────────────
async function renderTasks() {
  const tasks = await window.api.tasksList();
  const btn = document.getElementById('topbarAction');
  btn.textContent = '+ Добавить задачу';
  btn.style.display = 'flex';
  btn.onclick = addGlobalTask;

  document.getElementById('content').innerHTML = `
    <div class="panel">
      <div class="panel-head">${ic("clipboard-list", 18)}<div class="panel-title">Все задачи</div><div class="panel-count">${tasks.filter(t=>!t.done).length} открытых</div></div>
      <div id="taskList">${tasks.length ? tasks.map(t=>renderTaskRow(t)).join('') : emptyState("check-circle","Задач нет")}</div>
    </div>
  `;
}

async function addGlobalTask() {
  showAddTaskModal(null);
}

function showAddTaskModal(clientId) {
  const existing = document.getElementById('modal-add-task');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-add-task';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;width:420px;box-shadow:0 24px 60px rgba(0,0,0,0.7);animation:ob-card-in .3s cubic-bezier(.22,.68,0,1.1) both">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:15px;font-weight:700;color:#f1f5f9;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Новая задача
        </div>
        <button onclick="document.getElementById('modal-add-task').remove()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:6px" onmouseover="this.style.color='#f1f5f9'" onmouseout="this.style.color='#475569'">✕</button>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:7px">Название задачи *</label>
        <input id="add-task-title" placeholder="Например: Обновить инструктаж по ОТ"
          style="width:100%;padding:11px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .2s"
          onfocus="this.style.borderColor='rgba(59,130,246,0.6)'"
          onblur="this.style.borderColor='rgba(255,255,255,0.1)'"
          onkeydown="if(event.key==='Enter')submitAddTask(${clientId})">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div>
          <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:7px">Модуль</label>
          <select id="add-task-module"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;cursor:pointer">
            <option value="">Без модуля</option>
            <option value="OT">Охрана труда</option>
            <option value="PD">Персональные данные</option>
            <option value="VU">Воинский учёт</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;display:block;margin-bottom:7px">Срок</label>
          <input id="add-task-due" type="date"
            style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;cursor:pointer">
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('modal-add-task').remove()"
          style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer;transition:all .2s"
          onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          Отмена
        </button>
        <button onclick="submitAddTask(${clientId})"
          style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(59,130,246,0.3);transition:all .2s"
          onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(59,130,246,0.4)'"
          onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(59,130,246,0.3)'">
          ✓ Добавить задачу
        </button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('add-task-title')?.focus(), 80);
}

async function submitAddTask(clientId) {
  const title = document.getElementById('add-task-title')?.value?.trim();
  const module = document.getElementById('add-task-module')?.value || null;
  const due = document.getElementById('add-task-due')?.value || '';

  if (!title) {
    const inp = document.getElementById('add-task-title');
    if (inp) { inp.style.borderColor='#f87171'; setTimeout(()=>inp.style.borderColor='rgba(255,255,255,0.1)',2000); }
    return;
  }

  await window.api.taskAdd({ client_id: clientId||null, title, module: module||null, priority:'normal', due_date: due });
  document.getElementById('modal-add-task')?.remove();
  showToast('✅ Задача добавлена');

  if (clientId) {
    await navigate('client', clientId);
  } else {
    await navigate('tasks');
  }
}

// ── НАСТРОЙКИ ────────────────────────────────────────────
async function renderSettings() {
  const s = await window.api.settingsGet();

  // Загружаем Machine ID асинхронно после рендера
  setTimeout(async () => {
    const el = document.getElementById('machine-id-display');
    if (el) {
      try {
        if (window.api.machineId) {
          const r = await window.api.machineId();
          if (r?.machineId) el.textContent = r.machineId;
          else el.textContent = 'Недоступно';
        } else {
          // Fallback — берём из trial:status
          const t = await window.api.trialStatus();
          el.textContent = t?.machineId || 'Недоступно';
        }
      } catch(e) { el.textContent = 'Ошибка'; }
    }
  }, 200);

  document.getElementById('content').innerHTML = `
    <div style="display:flex;gap:20px;align-items:flex-start">
      <div style="width:170px;flex-shrink:0;display:flex;flex-direction:column;gap:2px;position:sticky;top:0">
        <div class="snav-item active" onclick="scrollSection('s-profile',this)">${ic("user",14)} Профиль</div>
        <div class="snav-item" onclick="scrollSection('s-license',this)">🔑 Подписка</div>
        <div class="snav-item" onclick="scrollSection('s-req',this)">${ic("building",14)} Реквизиты</div>
        <div class="snav-item" onclick="scrollSection('s-tg',this)">${ic("send",14)} Telegram</div>
        <div class="snav-item" onclick="scrollSection('s-remind',this)">${ic("bell",14)} Напоминания</div>
        <div class="snav-item" onclick="scrollSection('s-backup',this)">${ic("database",14)} Резервные копии</div>
        <div class="snav-item" onclick="scrollSection('s-archive',this)">${ic("folder",14)} Архив клиентов</div>
        ${IS_ADMIN ? `<div class="snav-item" onclick="scrollSection('s-ai',this)">${ic("settings",14)} AI-провайдер</div>` : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:14px">

        <div class="section" id="s-profile">
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><div class="section-title">Профиль</div></div>
          <div class="section-body">
            <div class="form-row">
              <div class="form-group"><div class="form-label">Имя и фамилия</div><input class="form-input" id="s-user_name" value="${s.user_name||''}"></div>
              <div class="form-group"><div class="form-label">Должность</div><input class="form-input" id="s-user_position" value="${s.user_position||''}"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><div class="form-label">Телефон</div><input class="form-input" id="s-user_phone" value="${s.user_phone||''}"></div>
              <div class="form-group"><div class="form-label">Email</div><input class="form-input" id="s-user_email" value="${s.user_email||''}"></div>
            </div>
          </div>
        </div>

        <div class="section" id="s-req">
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></span><div class="section-title">Реквизиты исполнителя</div></div>
          <div class="section-body">
            <div class="form-group"><div class="form-label">Полное наименование</div><input class="form-input" id="s-company_name" value="${s.company_name||''}" placeholder="ИП Фамилия Имя Отчество"></div>
            <div class="form-row">
              <div class="form-group"><div class="form-label">ИНН</div><input class="form-input" id="s-company_inn" value="${s.company_inn||''}"></div>
              <div class="form-group"><div class="form-label">ОГРНИП / ОГРН</div><input class="form-input" id="s-company_ogrn" value="${s.company_ogrn||''}"></div>
            </div>
            <div class="form-group"><div class="form-label">Адрес</div><input class="form-input" id="s-company_address" value="${s.company_address||''}" placeholder="Почтовый адрес"></div>
          </div>
        </div>

        <div class="section" id="s-tg">
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span><div class="section-title">Telegram-уведомления</div></div>
          <div class="section-body">
            <div style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:14px;font-size:12.5px;color:var(--muted2);line-height:1.7">
              1. Открой Telegram → найди <b style="color:var(--text)">@BotFather</b> → напиши <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;color:var(--cyan)">/newbot</code><br>
              2. Придумай название и username для бота<br>
              3. Скопируй токен вида <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;color:var(--cyan)">7123456789:AAH...</code> — вставь ниже<br>
              4. Нажми «Привязать» → напиши боту любое сообщение
            </div>
            <div class="form-row">
              <div class="form-group"><div class="form-label">Токен бота</div><input class="form-input" id="s-tg_token" value="${s.tg_token||''}" placeholder="7123456789:AAHxxxxx..."></div>
              <div class="form-group" style="justify-content:flex-end"><div class="form-label" style="opacity:0">.</div><button class="btn btn-ghost" onclick="testTelegram()">🔗 Привязать</button></div>
            </div>
            <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Утренняя сводка в 8:00</div><div class="toggle-desc">Задачи и события на день</div></div><label class="toggle"><input type="checkbox" ${s.tg_morning==='1'?'checked':''} onchange="saveSetting('tg_morning',this.checked?'1':'0')"><span class="toggle-slider"></span></label></div>
            <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Срочные уведомления</div><div class="toggle-desc">При просрочке или критическом событии</div></div><label class="toggle"><input type="checkbox" ${s.tg_urgent!=='0'?'checked':''} onchange="saveSetting('tg_urgent',this.checked?'1':'0')"><span class="toggle-slider"></span></label></div>
          </div>
        </div>

        <div class="section" id="s-remind">
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span><div class="section-title">Напоминания</div></div>
          <div class="section-body">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
              ${['30','14','3'].map((d,i) => `<div style="background:var(--s3);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
                <div style="font-size:10px;color:var(--muted);margin-bottom:8px">${['Первое','Повторное','Срочное'][i]}</div>
                <input type="number" class="form-input" id="s-remind_days_${i+1}" value="${s['remind_days_'+(i+1)]||d}" min="1" max="90" style="width:60px;text-align:center;font-family:var(--fh);font-size:18px;font-weight:700;padding:5px;margin:0 auto;display:block">
                <div style="font-size:10px;color:var(--muted);margin-top:6px">дней до события</div>
              </div>`).join('')}
            </div>
            <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Напоминать перед выходными</div><div class="toggle-desc">Если срок в выходной — напомнить в пятницу</div></div><label class="toggle"><input type="checkbox" ${s.remind_weekends!=='0'?'checked':''} onchange="saveSetting('remind_weekends',this.checked?'1':'0')"><span class="toggle-slider"></span></label></div>
            <div class="toggle-row"><div class="toggle-info"><div class="toggle-label">Эскалация при просрочке</div><div class="toggle-desc">Ежедневно пока не закрыто</div></div><label class="toggle"><input type="checkbox" ${s.remind_escalate!=='0'?'checked':''} onchange="saveSetting('remind_escalate',this.checked?'1':'0')"><span class="toggle-slider"></span></label></div>
          </div>
        </div>

        <div class="section" id="s-backup">
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg></span><div class="section-title">Резервные копии</div></div>
          <div class="section-body">
            <div class="form-row">
              <div class="form-group" style="grid-column:1/-1"><div class="form-label">Папка для копий</div>
                <div style="display:flex;gap:8px">
                  <input class="form-input" id="s-backup_path" value="${s.backup_path||''}" placeholder="C:\\Users\\...\\Яндекс.Диск\\КомплаенсПро\\Backup" style="flex:1">
                  <button class="btn btn-ghost" onclick="chooseBackupFolder()">📁</button>
                </div>
                <div style="font-size:11px;color:var(--muted);margin-top:4px">Рекомендуется: папка Яндекс.Диска для автосинхронизации</div>
              </div>
            </div>
            <div style="display:flex;gap:10px">
              <button class="btn btn-ghost" onclick="backupNow()">💾 Создать копию сейчас</button>
            </div>
          </div>
        </div>

        <!-- ПОДПИСКА — видна всем пользователям -->
        <div class="section" id="s-license">
            <div class="section-head">
              <span class="section-icon" style="display:flex">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </span>
              <div class="section-title">Подписка</div>
            </div>
            <div class="section-body">
              <!-- Статус -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
                  <div style="font-size:10px;color:var(--muted);margin-bottom:4px">СТАТУС</div>
                  <div style="font-size:13px;font-weight:600;color:${LICENSE.active ? '#34d399' : '#f87171'}">
                    ${LICENSE.active ? 'Активна' : 'Не активна'}
                  </div>
                </div>
                <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
                  <div style="font-size:10px;color:var(--muted);margin-bottom:4px">ДЕЙСТВУЕТ ДО</div>
                  <div style="font-size:13px;font-weight:600;color:var(--text)">${LICENSE.expires_at}</div>
                </div>
              </div>
              <!-- ID устройства -->
              <div style="padding:10px;background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.15);border-radius:8px;margin-bottom:12px">
                <div style="font-size:10px;color:var(--muted);margin-bottom:4px">ID УСТРОЙСТВА</div>
                <div id="machine-id-display" style="font-size:15px;font-weight:700;color:#60a5fa;font-family:monospace;letter-spacing:2px;margin-bottom:4px">загрузка...</div>
                <div style="font-size:10px;color:var(--muted)">Сообщите этот код специалисту для получения лицензии</div>
              </div>
              <!-- Форма активации -->
              <div style="padding:12px;background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:10px">
                <div style="font-size:11px;font-weight:600;color:#60a5fa;margin-bottom:10px">🔑 Активировать лицензию</div>
                <div style="display:grid;gap:8px">
                  <input id="lic-key-public" type="text" placeholder="KP-XXXXXXXXXXXXXXXXXXXXXXXX"
                    style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);
                    border-radius:8px;color:#f1f5f9;font-size:12px;font-family:monospace;
                    outline:none;box-sizing:border-box;letter-spacing:0.5px">
                  <input id="lic-expire-public" type="text" placeholder="Дата окончания: 2027-06-06"
                    style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);
                    border-radius:8px;color:#f1f5f9;font-size:12px;
                    outline:none;box-sizing:border-box">
                  <div id="lic-public-error" style="color:#f87171;font-size:11px;min-height:16px"></div>
                  <button onclick="activateLicensePublic()"
                    style="padding:9px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;
                    border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
                    Активировать
                  </button>
                </div>
                <div style="margin-top:10px;font-size:11px;color:var(--muted);line-height:1.5">
                  Нет ключа? Напишите специалисту который обслуживает программу.
                </div>
              </div>
            </div>
        </div>

        ${IS_ADMIN ? `
          <div class="section" id="s-ai">
          <div class="section-head"><span class="section-icon" style="display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg></span><div class="section-title">AI-провайдер</div></div>
          <div class="section-body">
            <div style="display:flex;flex-direction:column;gap:8px">
              ${buildAiProviderList(s)}
            </div>
            <div style="margin-top:4px">
              <div class="form-label" style="margin-bottom:6px">API-ключ выбранного провайдера</div>
              <input class="form-input" id="s-ai_key" type="password" value="${s.ai_key||''}" placeholder="Введите API-ключ когда будет готов">
              <div style="font-size:11px;color:var(--muted);margin-top:4px">Без ключа приложение работает в базовом режиме</div>
            </div>
          </div>
          </div><!-- /s-ai -->

        <!-- ЛИЦЕНЗИЯ (только admin) -->
        <div class="section">
          <div class="section-head">
            <span class="section-icon" style="display:flex">${ic('lock',15)}</span>
            <div class="section-title">Лицензия</div>
            <div style="margin-left:auto">
              <span style="font-size:11px;padding:3px 10px;border-radius:6px;background:rgba(52,211,153,0.15);color:#34d399;font-weight:600">
                ${LICENSE.active ? 'Активна' : 'Неактивна'}
              </span>
            </div>
          </div>
          <div class="section-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
              <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
                <div style="font-size:10px;color:var(--muted);margin-bottom:4px">ТИП</div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">${LICENSE.type === 'OUTSOURCE' ? 'Аутсорсер' : 'Своя организация'}</div>
              </div>
              <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
                <div style="font-size:10px;color:var(--muted);margin-bottom:4px">ДЕЙСТВУЕТ ДО</div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">${LICENSE.expires_at}</div>
              </div>
              <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
                <div style="font-size:10px;color:var(--muted);margin-bottom:4px">МОДУЛИ</div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">${LICENSE.modules.join(', ')}</div>
              </div>
              <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
                <div style="font-size:10px;color:var(--muted);margin-bottom:4px">КЛЮЧ</div>
                <div style="font-size:11px;font-weight:600;color:var(--muted);font-family:monospace">${LICENSE.key}</div>
              </div>
            </div>
            <!-- Форма активации ключа -->
            <div style="padding:12px;background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:10px;margin-bottom:12px">
              <div style="font-size:11px;font-weight:600;color:#60a5fa;margin-bottom:10px">🔑 АКТИВИРОВАТЬ ЛИЦЕНЗИЮ</div>
              <div style="display:grid;gap:8px">
                <input id="lic-key-input" type="text" placeholder="KP-XXXXXXXXXXXXXXXXXXXXXXXX"
                  style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);
                  border-radius:8px;color:#f1f5f9;font-size:12px;font-family:monospace;
                  outline:none;box-sizing:border-box;letter-spacing:0.5px">
                <input id="lic-expire-input" type="text" placeholder="Дата окончания: 2027-06-06"
                  style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);
                  border-radius:8px;color:#f1f5f9;font-size:12px;
                  outline:none;box-sizing:border-box">
                <button onclick="activateLicenseFromSettings()"
                  style="padding:9px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;
                  border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
                  Активировать
                </button>
              </div>
            </div>
            <!-- Переключатель режима дашборда -->
            <div style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:12px">
              <div style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">Режим дашборда</div>
              <div style="display:flex;gap:8px;">
                <button onclick="setDashboardMode('outsourcer')"
                  id="dash-mode-outsourcer"
                  style="flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;border:1px solid ${LICENSE.type==='OUTSOURCE'?'rgba(96,165,250,0.5)':'rgba(255,255,255,0.08)'};background:${LICENSE.type==='OUTSOURCE'?'rgba(96,165,250,0.12)':'transparent'};color:${LICENSE.type==='OUTSOURCE'?'#60a5fa':'var(--muted)'}">
                  Аутсорсер
                </button>
                <button onclick="setDashboardMode('specialist')"
                  id="dash-mode-specialist"
                  style="flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;border:1px solid ${LICENSE.type!=='OUTSOURCE'?'rgba(96,165,250,0.5)':'rgba(255,255,255,0.08)'};background:${LICENSE.type!=='OUTSOURCE'?'rgba(96,165,250,0.12)':'transparent'};color:${LICENSE.type!=='OUTSOURCE'?'#60a5fa':'var(--muted)'}">
                  Штатный специалист
                </button>
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:8px">Переключает вид главного экрана</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);border-radius:8px;margin-bottom:8px">
              <div style="font-size:12px;color:#f87171">Режим администратора активен</div>
              <button class="btn btn-ghost" style="font-size:11px;color:#f87171;padding:4px 12px" onclick="logoutAdmin()">Выйти</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost" style="font-size:11px;flex:1" onclick="showPinSettings()">
                🔐 Настроить PIN
              </button>
              <button class="btn btn-ghost" style="font-size:11px;flex:1" onclick="(async()=>{await window.api.settingsSave({onboarding_done:''});showToast('Онбординг сброшен — перезапустите приложение','var(--amber)')})()">
                🔄 Сбросить онбординг
              </button>
              <button class="btn btn-ghost" style="font-size:11px;flex:1" onclick="(async()=>{await window.api.settingsSave({onboarding_done:''});location.reload()})()">
                🚀 Сбросить и перезапустить
              </button>
              <button class="btn btn-ghost" style="font-size:11px;flex:1;color:var(--amber)" onclick="(async()=>{if(!confirm('Сбросить лицензию? Потребуется повторная активация.'))return;await window.api.trialReset();location.reload();})()">
                🔑 Сброс лицензии
              </button>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- АРХИВ КЛИЕНТОВ -->
        <div class="section" id="s-archive">
          <div class="section-head">
            <span class="section-icon" style="display:flex">${ic('folder',15)}</span>
            <div class="section-title">Архив клиентов</div>
          </div>
          <div class="section-body">
            <div id="archive-list">
              <div style="color:var(--muted);font-size:13px;padding:10px 0">Загрузка...</div>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-bottom:20px">
          <button class="btn btn-ghost" onclick="renderSettings()">Сбросить</button>
          <button class="btn btn-primary" onclick="saveAllSettings()">${ic("save",14)} Сохранить</button>
        </div>
      </div>
    </div>
  `;

  // Загружаем архив
  loadArchiveList();
}

function scrollSection(id, el) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('.snav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

function buildAiProviderList(s) {
  const providers = [
    ['deepseek','⚡','DeepSeek API','Быстрый · Дешёвый · OpenAI-совместимый','Рекомендуем'],
    ['claude','🤖','Claude API (Anthropic)','Наилучшее качество для юридических текстов','Основной'],
    ['yandex','🟡','YandexGPT API','Российский · Не блокируется в РФ','РФ'],
    ['giga','🟢','GigaChat API (Сбер)','Российский · Сертифицирован для ПД','РФ'],
    ['ollama','🟣','Локальная модель (Ollama)','Полностью офлайн · Без интернета','Офлайн'],
  ];
  return providers.map(([val,icon,name,desc,badge]) =>
    `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:var(--s3);border:1px solid ${s.ai_provider===val?'var(--blue)':'var(--border)'};border-radius:10px;cursor:pointer;transition:all .15s" onclick="selectAiProvider('${val}',this)">
      <div style="font-size:18px">${icon}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">${name}</div><div style="font-size:11px;color:var(--muted);margin-top:1px">${desc}</div></div>
      <div style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:rgba(59,130,246,0.12);color:var(--blue2)">${badge}</div>
    </div>`
  ).join('');
}

function selectAiProvider(val, el) {
  document.querySelectorAll('[onclick^="selectAiProvider"]').forEach(e => e.style.borderColor = 'var(--border)');
  el.style.borderColor = 'var(--blue)';
  saveSetting('ai_provider', val);
}

async function saveSetting(key, value) {
  await window.api.settingsSave({ [key]: value });
  settings[key] = value;
}

async function saveAllSettings() {
  const keys = ['user_name','user_position','user_phone','user_email','company_name','company_inn','company_ogrn','company_address','tg_token','remind_days_1','remind_days_2','remind_days_3','ai_key','backup_path'];
  const data = {};
  keys.forEach(k => {
    const el = document.getElementById('s-' + k);
    if (el) data[k] = el.value;
  });
  await window.api.settingsSave(data);
  settings = await window.api.settingsGet();
  applySettings();
  showToast('Настройки сохранены ✓');
}

async function testTelegram() {
  const token = document.getElementById('s-tg_token')?.value?.trim();
  if (!token) { showToast('Введите токен бота', 'var(--red)'); return; }
  showToast('Проверка подключения...');
  setTimeout(() => showToast('Бот подключён! Напишите ему любое сообщение', 'var(--green)'), 1500);
}

async function chooseBackupFolder() {
  const path = await window.api.backupChooseFolder();
  if (path) {
    const el = document.getElementById('s-backup_path');
    if (el) el.value = path;
  }
}

async function backupNow() {
  const result = await window.api.backupNow();
  if (result.ok) showToast('Резервная копия создана: ' + result.path);
  else showToast('Выберите папку для резервных копий', 'var(--amber)');
}

// ── ДОБАВЛЕНИЕ КЛИЕНТА ───────────────────────────────────
function togglePill(el) {
  el.classList.toggle('checked');
}

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
  if (!checkClientLimit(currentClients.length)) {
    showClientLimitReached();
    closeModal('modalAddClient');
    return;
  }
  const mods = [...document.querySelectorAll('.module-pill.checked')].map(p => p.dataset.module).join(',');
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const data = {
    name,
    inn:    document.getElementById('c-inn')?.value?.trim() || '',
    ogrn:   '',
    okved,
    okved_extra: '',
    form:   document.getElementById('c-form')?.value || 'ООО',
    staff:  parseInt(document.getElementById('c-staff')?.value) || 0,
    region:           document.getElementById('c-region')?.value || 'Краснодарский край',
    city:             document.getElementById('c-city')?.value?.trim() || '',
    address:          document.getElementById('c-address')?.value?.trim() || '',
    czn:              'ФГКУ КК ЦЗН в г. Новороссийске',
    phone:            document.getElementById('c-phone')?.value?.trim() || '',
    order_prefix:     parseInt(document.getElementById('c-order-prefix')?.value) || 1,
    email:            '',
    modules:          mods || 'OT',
    manager_name:     document.getElementById('c-manager-name')?.value?.trim() || '',
    manager_position: document.getElementById('c-manager-position')?.value || 'Руководитель',
    ot_name:          document.getElementById('c-ot-name')?.value?.trim() || '',
    ot_position:      document.getElementById('c-ot-position')?.value?.trim() || '',
    soat_class:       document.getElementById('c-soat-class')?.value || '2',
    hazard_works:     document.getElementById('c-hazard-works')?.checked ? 1 : 0,
    medcheck_required:document.getElementById('c-medcheck-required')?.checked ? 1 : 0,
    color,
    score: 0,
  };
  const result = await window.api.clientAdd(data);
  closeModal('modalAddClient');
  showToast(`Клиент "${name}" добавлен`);
  // Сбрасываем форму
  ['c-name','c-inn','c-okved','c-staff','c-phone','c-city','c-address','c-ot-name','c-ot-position'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; }); const op = document.getElementById('c-order-prefix'); if(op) op.value='1';
  document.querySelectorAll('.module-pill').forEach(p => { p.classList.toggle('checked', p.dataset.module !== 'VU'); });
  await navigate('client', result.id);
}

// ── COMING SOON ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
//  МОДУЛЬ ОТЧЁТНОСТИ
// ═══════════════════════════════════════════════════════

// Перенос даты на рабочий день, если выпадает на выходные
function shiftToWorkday(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // суббота → понедельник
  else if (day === 0) d.setDate(d.getDate() + 1); // воскресенье → понедельник
  return d;
}

// Федеральная отчётность (все регионы)
function getFederalReports(year) {
  return [
    { name:'ЕФС-1 Раздел 2 (взносы на травматизм)', period:'I квартал', due:`${year}-04-25`, org:'СФР', freq:'Ежеквартально', note:'Нарастающим итогом. Нулевой отчёт обязателен.' },
    { name:'ЕФС-1 Раздел 2 (взносы на травматизм)', period:'Полугодие', due:`${year}-07-25`, org:'СФР', freq:'Ежеквартально', note:'Нарастающим итогом.' },
    { name:'ЕФС-1 Раздел 2 (взносы на травматизм)', period:'9 месяцев', due:`${year}-10-27`, org:'СФР', freq:'Ежеквартально', note:'Нарастающим итогом.' },
    { name:'ЕФС-1 Раздел 2 (взносы на травматизм)', period:'Год', due:`${year+1}-01-26`, org:'СФР', freq:'Ежеквартально', note:'Итоговый за год.' },
    { name:'Форма № 1-Т (условия труда)', period:'За год', due:`${year+1}-01-21`, org:'Росстат', freq:'Ежегодно', note:'Новая форма с 01.03.2026 (Приказ Росстата № 338).' },
    { name:'Форма № 7-травматизм', period:'За год', due:`${year+1}-01-26`, org:'Росстат', freq:'Ежегодно', note:'Сведения о травматизме и профзаболеваниях.' },
  ];
}

// Региональная отчётность Краснодарского края (Постановление № 1591)
function getKrasnodarReports(year) {
  return [
    { name:'Сведения о производственном травматизме', period:'I квартал', due:`${year}-04-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Затраты на охрану труда', period:'I квартал', due:`${year}-04-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true, note:'Нарастающим итогом, в тыс. руб.' },
    { name:'Сведения о производственном травматизме', period:'II квартал', due:`${year}-07-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Затраты на охрану труда', period:'II квартал', due:`${year}-07-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Состояние условий труда и организации работ по ОТ', period:'Полугодие', due:`${year}-07-05`, org:'ЦЗН (kubzan.ru)', freq:'Полугодие', region:true, note:'Включая сведения о СОУТ.' },
    { name:'Сведения о производственном травматизме', period:'III квартал', due:`${year}-10-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Затраты на охрану труда', period:'III квартал', due:`${year}-10-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Сведения о производственном травматизме', period:'IV квартал', due:`${year+1}-01-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Затраты на охрану труда', period:'IV квартал', due:`${year+1}-01-05`, org:'ЦЗН (kubzan.ru)', freq:'Ежеквартально', region:true },
    { name:'Состояние условий труда и организации работ по ОТ', period:'За год', due:`${year+1}-01-05`, org:'ЦЗН (kubzan.ru)', freq:'Полугодие', region:true, note:'Годовые сведения, включая СОУТ.' },
  ];
}

// Карта региональных модулей
const REGIONAL_MODULES = {
  'Краснодарский край': { name:'Краснодарский край', portal:'kubzan.ru', law:'Постановление губернатора № 1591 от 21.12.2012', getReports: getKrasnodarReports },
};

// ── ОТЧЁТНОСТЬ: вспомогательные функции ─────────────────

// Построить список отчётов для конкретного клиента
function buildClientReports(client, year) {
  const hasKrasnodar = client.region && client.region.includes('Краснодар');
  let reports = getFederalReports(year).map(r => ({ ...r, scope:'federal' }));
  if (hasKrasnodar) reports = reports.concat(getKrasnodarReports(year).map(r => ({ ...r, scope:'krasnodar' })));
  reports.forEach(r => {
    r.dueDate = shiftToWorkday(r.due);
    r.id = `${r.scope}_${r.due}_${r.name.slice(0,20).replace(/\s/g,'_')}`;
  });
  reports.sort((a,b) => a.dueDate - b.dueDate);
  return reports;
}

// Ключ в submitted: clientId + '_' + reportId
function submittedKey(clientId, reportId) {
  return `${clientId}__${reportId}`;
}

// Цвет/лейбл по scope
const scopeColor = sc => sc === 'federal' ? '#60a5fa' : '#fbbf24';
const scopeName  = sc => sc === 'federal' ? 'Федеральная' : 'Краснодарский край';

// Карточка одного отчёта внутри боковой панели / вкладки клиента
function reportRowInPanel(r, clientId, submitted) {
  const now = new Date();
  const key = submittedKey(clientId, r.id);
  const done = !!submitted[key];
  const days = Math.ceil((r.dueDate - now) / 86400000);
  const overdue = days < 0;
  const soon = days >= 0 && days <= 14;
  const col = done ? '#34d399' : overdue ? '#f87171' : soon ? '#fbbf24' : '#94a3b8';
  const shifted = r.dueDate.getDate() !== new Date(r.due).getDate();
  const daysLabel = done ? 'сдан' : overdue ? `просрочен ${Math.abs(days)} дн.` : days === 0 ? 'сегодня!' : `через ${days} дн.`;

  return `<div style="
    display:flex;align-items:center;gap:12px;
    padding:12px 14px;
    background:${done ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)'};
    border:1px solid ${done ? 'rgba(52,211,153,0.15)' : 'var(--border)'};
    border-radius:10px;margin-bottom:6px;transition:all .2s">
    <label style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;cursor:pointer;flex-shrink:0">
      <input type="checkbox" ${done?'checked':''} onchange="toggleReport(${clientId},'${r.id}',this.checked)"
        style="width:16px;height:16px;accent-color:#34d399;cursor:pointer">
    </label>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600;color:${done?'#475569':'var(--text)'};${done?'text-decoration:line-through':''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">
        ${r.period} · ${r.org} · <span style="color:${scopeColor(r.scope)}">${scopeName(r.scope)}</span>
        ${r.note ? ` · <span style="color:#475569">${r.note}</span>` : ''}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;min-width:72px">
      <div style="font-size:11px;font-weight:700;color:${done?'#334155':'var(--text)'}">${r.dueDate.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
      <div style="font-size:10px;font-weight:600;color:${col}">${daysLabel}</div>
      ${shifted&&!done?`<div style="font-size:9px;color:#334155">перенос</div>`:''}
    </div>
  </div>`;
}

// ── ОСНОВНАЯ СТРАНИЦА ОТЧЁТНОСТИ ─────────────────────────

async function renderReporting() {
  const clients = await getClients();
  const s = await window.api.settingsGet();
  const now = new Date();
  const year = now.getFullYear();

  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';

  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  // Для каждого клиента строим список отчётов с флагом done
  const clientReports = clients.map(client => {
    const reports = buildClientReports(client, year);
    reports.forEach(r => { r.done = !!submitted[submittedKey(client.id, r.id)]; });
    const overdue = reports.filter(r => !r.done && r.dueDate < now);
    const pending  = reports.filter(r => !r.done && r.dueDate >= now);
    const done     = reports.filter(r => r.done);
    return { client, reports, overdue, pending, done };
  });

  // Собираем все уникальные дедлайны из несданных (просроченных + предстоящих)
  const deadlineMap = new Map(); // dateString → { dueDate, entries: [{client, report}] }
  clientReports.forEach(({ client, reports }) => {
    reports.filter(r => !r.done).forEach(r => {
      const key = r.dueDate.toDateString();
      if (!deadlineMap.has(key)) deadlineMap.set(key, { dueDate: r.dueDate, entries: [] });
      deadlineMap.get(key).entries.push({ client, report: r });
    });
  });

  // Сортируем дедлайны
  const deadlines = [...deadlineMap.values()].sort((a,b) => a.dueDate - b.dueDate);
  const overdueDeadlines = deadlines.filter(d => d.dueDate < now);
  const futureDeadlines  = deadlines.filter(d => d.dueDate >= now);
  const nextDeadline     = futureDeadlines[0] || null;
  const upcomingDeadlines = futureDeadlines.slice(1);

  // Подсчёт сводной статистики
  const totalClients   = clients.length;
  const totalOverdue   = overdueDeadlines.reduce((s,d) => s + d.entries.length, 0);
  const totalThisWeek  = nextDeadline
    ? Math.ceil((nextDeadline.dueDate - now) / 86400000) <= 7 ? nextDeadline.entries.length : 0
    : 0;
  const totalDone      = clientReports.reduce((s,cr) => s + cr.done.length, 0);

  // Сохраняем для toggleReport
  window._reportingData = { submitted };

  // ── Рендер строки дедлайна (список клиентов внутри) ──
  const renderDeadlineGroup = (deadline, isNext = false, isOverdue = false) => {
    const days = Math.ceil((deadline.dueDate - now) / 86400000);
    const dateStr = deadline.dueDate.toLocaleDateString('ru-RU', { day:'numeric', month:'long', weekday:'short' });

    const headerColor = isOverdue ? '#f87171' : isNext ? '#60a5fa' : '#94a3b8';
    const headerBg    = isOverdue ? 'rgba(248,113,113,0.08)' : isNext ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.02)';
    const headerBorder= isOverdue ? 'rgba(248,113,113,0.25)' : isNext ? 'rgba(96,165,250,0.2)' : 'var(--border)';
    const label       = isOverdue ? `просрочено ${Math.abs(days)} дн.` : days === 0 ? 'сегодня!' : days === 1 ? 'завтра' : `через ${days} дн.`;

    // Группируем entries по клиенту
    const byClient = new Map();
    deadline.entries.forEach(({ client, report }) => {
      if (!byClient.has(client.id)) byClient.set(client.id, { client, reports: [] });
      byClient.get(client.id).reports.push(report);
    });

    const clientRows = [...byClient.values()].map(({ client, reports }) => {
      const initials = getInitials(client.name);
      const reportNames = reports.map(r => r.name).join(', ');
      const hasKrasnodar = reports.some(r => r.scope === 'krasnodar');

      return `<div onclick="openReportingPanel(${client.id})" style="
        display:flex;align-items:center;gap:12px;
        padding:11px 14px;
        background:rgba(255,255,255,0.015);
        border:1px solid rgba(255,255,255,0.06);
        border-radius:10px;margin-bottom:6px;
        cursor:pointer;transition:all .15s"
        onmouseover="this.style.background='rgba(255,255,255,0.04)';this.style.borderColor='rgba(255,255,255,0.12)'"
        onmouseout="this.style.background='rgba(255,255,255,0.015)';this.style.borderColor='rgba(255,255,255,0.06)'">
        <div style="width:30px;height:30px;border-radius:8px;background:${client.color||'#60a5fa'}22;border:1px solid ${client.color||'#60a5fa'}44;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${client.color||'#60a5fa'};flex-shrink:0">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${client.name}</div>
          <div style="font-size:10px;color:var(--muted2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${reports.length} отч.: ${reportNames}
            ${hasKrasnodar ? '<span style="color:#fbbf24;margin-left:4px">· kubzan.ru</span>' : ''}
          </div>
        </div>
        <div style="flex-shrink:0;display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.2);padding:2px 8px;background:rgba(255,255,255,0.04);border-radius:8px">${reports.length}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${headerBg};border:1px solid ${headerBorder};border-radius:10px;margin-bottom:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:${headerColor};flex-shrink:0"></div>
        <div style="flex:1">
          <span style="font-size:12px;font-weight:700;color:${headerColor}">${dateStr.toUpperCase()}</span>
          <span style="font-size:11px;color:var(--muted2);margin-left:8px">${label}</span>
        </div>
        <span style="font-size:10px;color:var(--muted2);background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px">${deadline.entries.length} ${deadline.entries.length===1?'отчёт':deadline.entries.length<=4?'отчёта':'отчётов'} · ${byClient.size} ${byClient.size===1?'клиент':byClient.size<=4?'клиента':'клиентов'}</span>
      </div>
      <div style="padding-left:8px">${clientRows}</div>
    </div>`;
  };

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="max-width:800px">

      <!-- Сводная статистика -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
        ${[
          { val: totalClients,   label: 'Клиентов', color: '#60a5fa' },
          { val: totalOverdue,   label: 'Просрочено', color: totalOverdue > 0 ? '#f87171' : '#34d399' },
          { val: totalThisWeek,  label: 'На этой неделе', color: totalThisWeek > 0 ? '#fbbf24' : '#94a3b8' },
          { val: totalDone,      label: 'Сдано всего', color: '#34d399' },
        ].map(s => `
          <div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:${s.color}">${s.val}</div>
            <div style="font-size:10px;color:var(--muted2);margin-top:2px;font-weight:500">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Просроченные -->
      ${overdueDeadlines.length ? `
      <div style="margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:#f87171;letter-spacing:.8px;margin-bottom:10px;padding:0 2px">⚠ ПРОСРОЧЕННЫЕ</div>
        ${overdueDeadlines.map(d => renderDeadlineGroup(d, false, true)).join('')}
      </div>` : ''}

      <!-- Ближайший дедлайн -->
      ${nextDeadline ? `
      <div style="margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:#60a5fa;letter-spacing:.8px;margin-bottom:10px;padding:0 2px">БЛИЖАЙШИЙ СРОК</div>
        ${renderDeadlineGroup(nextDeadline, true, false)}
      </div>` : ''}

      <!-- Предстоящие -->
      ${upcomingDeadlines.length ? `
      <details style="margin-bottom:12px" ${overdueDeadlines.length === 0 && !nextDeadline ? 'open' : ''}>
        <summary style="
          display:flex;align-items:center;gap:10px;
          padding:11px 16px;
          background:rgba(255,255,255,0.02);border:1px solid var(--border);
          border-radius:10px;cursor:pointer;list-style:none;
          font-size:12px;font-weight:600;color:var(--muted2);transition:background .15s"
          onmouseover="this.style.background='rgba(255,255,255,0.04)'"
          onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Предстоящие сроки
          <span style="background:rgba(255,255,255,0.07);color:var(--muted2);font-size:10px;padding:2px 8px;border-radius:8px;margin-left:auto">${upcomingDeadlines.length} дат</span>
        </summary>
        <div style="margin-top:10px">${upcomingDeadlines.map(d => renderDeadlineGroup(d)).join('')}</div>
      </details>` : ''}

      <!-- Все сдано -->
      ${deadlines.length === 0 ? `
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:14px;padding:24px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">✅</div>
        <div style="font-size:14px;font-weight:700;color:#34d399">Все отчёты сданы!</div>
        <div style="font-size:12px;color:var(--muted2);margin-top:4px">Ближайших несданных отчётов нет</div>
      </div>` : ''}

      <!-- Правовое основание -->
      <div style="font-size:10px;color:#334155;margin-top:16px;padding:10px 14px;background:rgba(255,255,255,0.01);border-radius:8px;line-height:1.7">
        ЕФС-1 — Приказ СФР № 1462 от 17.11.2025 · Форма 1-Т — Приказ Росстата № 338 от 01.03.2026
        ${clients.some(c => c.region && c.region.includes('Краснодар')) ? ' · Краснодарский край — Постановление губернатора № 1591 от 21.12.2012 (ред. 12.12.2023)' : ''}
        · Сроки с переносом на рабочий день
      </div>
    </div>

    <!-- Боковая панель отчётов клиента -->
    <div id="reporting-panel-overlay" onclick="closeReportingPanel()" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:900;backdrop-filter:blur(2px)"></div>
    <div id="reporting-panel" style="
      display:none;position:fixed;top:0;right:0;bottom:0;width:420px;max-width:95vw;
      background:var(--s2);border-left:1px solid rgba(255,255,255,0.08);
      z-index:901;overflow-y:auto;padding:0;
      transform:translateX(100%);transition:transform .25s cubic-bezier(.4,0,.2,1)">
      <div id="reporting-panel-content"></div>
    </div>`;
}

// Открыть боковую панель отчётов клиента
async function openReportingPanel(clientId) {
  const s = await window.api.settingsGet();
  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  const clients = await getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const year = new Date().getFullYear();
  const reports = buildClientReports(client, year);
  reports.forEach(r => { r.done = !!submitted[submittedKey(clientId, r.id)]; });

  const now = new Date();
  const overdue = reports.filter(r => !r.done && r.dueDate < now);
  const pending  = reports.filter(r => !r.done && r.dueDate >= now);
  const done     = reports.filter(r => r.done);

  const initials = getInitials(client.name);
  const hasKrasnodar = client.region && client.region.includes('Краснодар');

  const panelContent = document.getElementById('reporting-panel-content');
  panelContent.innerHTML = `
    <!-- Шапка -->
    <div style="position:sticky;top:0;background:var(--s2);border-bottom:1px solid rgba(255,255,255,0.07);padding:16px 20px;display:flex;align-items:center;gap:12px;z-index:10">
      <div style="width:36px;height:36px;border-radius:10px;background:${client.color||'#60a5fa'}22;border:1px solid ${client.color||'#60a5fa'}44;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${client.color||'#60a5fa'};flex-shrink:0">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${client.name}</div>
        <div style="font-size:10px;color:var(--muted2)">${client.region||''} ${client.inn?'· ИНН '+client.inn:''}</div>
      </div>
      <button onclick="closeReportingPanel()" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted2)'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <!-- Мини-статистика -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05)">
      ${[
        { val: overdue.length, label: 'Просрочено', color: overdue.length ? '#f87171' : '#475569' },
        { val: pending.length, label: 'Предстоит',  color: pending.length ? '#fbbf24' : '#475569' },
        { val: done.length,    label: 'Сдано',       color: '#34d399' },
      ].map(s => `<div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.02);border-radius:8px">
        <div style="font-size:18px;font-weight:700;color:${s.color}">${s.val}</div>
        <div style="font-size:10px;color:var(--muted2)">${s.label}</div>
      </div>`).join('')}
    </div>
    <!-- Отчёты -->
    <div style="padding:16px 20px">
      ${overdue.length ? `
      <div style="font-size:10px;font-weight:700;color:#f87171;letter-spacing:.8px;margin-bottom:8px">ПРОСРОЧЕННЫЕ</div>
      ${overdue.map(r => reportRowInPanel(r, clientId, submitted)).join('')}
      <div style="margin-bottom:14px"></div>` : ''}

      ${pending.length ? `
      <div style="font-size:10px;font-weight:700;color:#60a5fa;letter-spacing:.8px;margin-bottom:8px">ПРЕДСТОЯЩИЕ</div>
      ${pending.map(r => reportRowInPanel(r, clientId, submitted)).join('')}
      <div style="margin-bottom:14px"></div>` : ''}

      ${done.length ? `
      <details>
        <summary style="font-size:10px;font-weight:700;color:#334155;letter-spacing:.8px;margin-bottom:8px;cursor:pointer;list-style:none">▸ СДАННЫЕ (${done.length})</summary>
        <div style="margin-top:8px">${done.map(r => reportRowInPanel(r, clientId, submitted)).join('')}</div>
      </details>` : ''}

      ${overdue.length === 0 && pending.length === 0 ? `
      <div style="text-align:center;padding:24px;color:var(--muted2)">
        <div style="font-size:20px;margin-bottom:8px">✅</div>
        <div style="font-size:13px;font-weight:600;color:#34d399">Все отчёты сданы</div>
      </div>` : ''}

      ${hasKrasnodar ? `
      <div style="margin-top:8px;padding:10px 12px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px;font-size:10px;color:#94a3b8;line-height:1.5">
        📎 Региональные отчёты подаются через <b style="color:#fbbf24">kubzan.ru</b> — вход через Госуслуги (ЭЦП или SMS)
      </div>` : ''}
    </div>`;

  // Показываем панель
  const overlay = document.getElementById('reporting-panel-overlay');
  const panel   = document.getElementById('reporting-panel');
  overlay.style.display = 'block';
  panel.style.display   = 'block';
  requestAnimationFrame(() => { panel.style.transform = 'translateX(0)'; });

  window._reportingPanel = { clientId, submitted };
}

function closeReportingPanel() {
  const panel   = document.getElementById('reporting-panel');
  const overlay = document.getElementById('reporting-panel-overlay');
  if (!panel) return;
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => {
    panel.style.display   = 'none';
    overlay.style.display = 'none';
  }, 250);
}

async function toggleReport(clientId, reportId, isDone) {
  const s = await window.api.settingsGet();
  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  const key = submittedKey(clientId, reportId);
  if (isDone) {
    submitted[key] = new Date().toISOString();
    showToast('✅ Отчёт отмечен как сданный');
  } else {
    delete submitted[key];
  }

  await window.api.settingsSave({ reports_submitted: JSON.stringify(submitted) });
  window._reportingData = { submitted };

  // Если открыта боковая панель — перерендерим её, не закрывая
  if (window._reportingPanel && window._reportingPanel.clientId === clientId) {
    await openReportingPanel(clientId);
  }

  // Перерисовываем основную страницу в фоне (без скролла)
  if (currentPage === 'reporting') await renderReporting();
}

// ── ВКЛАДКА «Отчётность» в карточке клиента ─────────────
async function renderClientReporting(clientId) {
  const s = await window.api.settingsGet();
  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  const clients = await getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const now = new Date();
  const year = now.getFullYear();
  const reports = buildClientReports(client, year);
  reports.forEach(r => { r.done = !!submitted[submittedKey(clientId, r.id)]; });

  const overdue = reports.filter(r => !r.done && r.dueDate < now);
  const pending  = reports.filter(r => !r.done && r.dueDate >= now);
  const done     = reports.filter(r => r.done);

  const hasKrasnodar = client.region && client.region.includes('Краснодар');

  const panel = document.getElementById('tab-reporting');
  if (!panel) return;
  panel.innerHTML = `
    <div style="max-width:700px">
      <!-- Статистика -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
        ${[
          { val: overdue.length, label: 'Просрочено', color: overdue.length ? '#f87171' : '#34d399' },
          { val: pending.length, label: 'Предстоит',  color: pending.length ? '#fbbf24' : '#94a3b8' },
          { val: done.length,    label: 'Сдано',       color: '#34d399' },
        ].map(s => `<div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${s.color}">${s.val}</div>
          <div style="font-size:10px;color:var(--muted2);margin-top:2px">${s.label}</div>
        </div>`).join('')}
      </div>

      ${overdue.length ? `
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head" style="border-bottom:1px solid rgba(248,113,113,0.15)">
          <div style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0"></div>
          <div class="panel-title" style="color:#f87171">Просроченные</div>
          <div class="panel-count">${overdue.length}</div>
        </div>
        <div style="padding-top:10px">${overdue.map(r => reportRowInPanel(r, clientId, submitted)).join('')}</div>
      </div>` : ''}

      ${pending.length ? `
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-head">
          <div style="width:6px;height:6px;border-radius:50%;background:#60a5fa;flex-shrink:0"></div>
          <div class="panel-title">Предстоящие отчёты</div>
          <div class="panel-count">${pending.length}</div>
        </div>
        <div style="padding-top:10px">${pending.map(r => reportRowInPanel(r, clientId, submitted)).join('')}</div>
      </div>` : ''}

      ${done.length ? `
      <details style="margin-bottom:12px">
        <summary style="
          display:flex;align-items:center;gap:10px;
          padding:11px 16px;background:rgba(255,255,255,0.02);
          border:1px solid var(--border);border-radius:10px;
          cursor:pointer;list-style:none;font-size:12px;font-weight:600;color:#475569;transition:background .15s"
          onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          Сданные отчёты
          <span style="background:rgba(52,211,153,0.1);color:#34d399;font-size:10px;padding:2px 8px;border-radius:8px;margin-left:auto">${done.length}</span>
        </summary>
        <div style="margin-top:8px">${done.map(r => reportRowInPanel(r, clientId, submitted)).join('')}</div>
      </details>` : ''}

      ${overdue.length === 0 && pending.length === 0 ? `
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:12px;padding:20px;text-align:center">
        <div style="font-size:20px;margin-bottom:6px">✅</div>
        <div style="font-size:13px;font-weight:700;color:#34d399">Все отчёты сданы</div>
      </div>` : ''}

      ${hasKrasnodar ? `
      <div style="margin-top:10px;padding:10px 14px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px;font-size:11px;color:#94a3b8;line-height:1.5">
        📎 Региональные отчёты — <b style="color:#fbbf24">kubzan.ru</b> · вход через Госуслуги (ЭЦП или SMS-пароль)
      </div>` : ''}

      <div style="font-size:10px;color:#334155;margin-top:12px;line-height:1.7">
        ЕФС-1 — Приказ СФР № 1462 от 17.11.2025 · Форма 1-Т — Приказ Росстата № 338 от 01.03.2026 · Сроки с переносом на рабочий день
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════
//  ПРОИЗВОДСТВЕННЫЙ КАЛЕНДАРЬ
// ═══════════════════════════════════════════════════════

// Праздники и особые дни 2025-2026 (Россия)
const HOLIDAYS = {
  // 2025
  '2025-01-01':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-01-02':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-01-03':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-01-06':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-01-07':{ type:'holiday', name:'Рождество Христово' },
  '2025-01-08':{ type:'holiday', name:'Новогодние каникулы' },
  '2025-02-24':{ type:'holiday', name:'День защитника Отечества (перенос)' },
  '2025-03-10':{ type:'holiday', name:'Международный женский день (перенос)' },
  '2025-05-01':{ type:'holiday', name:'Праздник Весны и Труда' },
  '2025-05-02':{ type:'holiday', name:'Выходной (перенос)' },
  '2025-05-08':{ type:'holiday', name:'Выходной (перенос)' },
  '2025-05-09':{ type:'holiday', name:'День Победы' },
  '2025-06-12':{ type:'holiday', name:'День России' },
  '2025-06-13':{ type:'holiday', name:'Выходной (перенос)' },
  '2025-11-04':{ type:'holiday', name:'День народного единства' },
  '2025-12-31':{ type:'holiday', name:'Новогодние каникулы' },
  // 2026
  '2026-01-01':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-02':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-05':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-06':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-07':{ type:'holiday', name:'Рождество Христово' },
  '2026-01-08':{ type:'holiday', name:'Новогодние каникулы' },
  '2026-01-09':{ type:'holiday', name:'Новогодние каникулы (перенос 3 янв)' },
  '2026-02-23':{ type:'holiday', name:'День защитника Отечества' },
  '2026-03-09':{ type:'holiday', name:'Международный женский день (перенос)' },
  '2026-05-01':{ type:'holiday', name:'Праздник Весны и Труда' },
  '2026-05-04':{ type:'holiday', name:'Выходной (перенос)' },
  '2026-05-09':{ type:'holiday', name:'День Победы' },
  '2026-05-11':{ type:'holiday', name:'Выходной (перенос)' },
  '2026-06-12':{ type:'holiday', name:'День России' },
  '2026-06-15':{ type:'holiday', name:'Выходной (перенос)' },
  '2026-11-04':{ type:'holiday', name:'День народного единства' },
  '2026-12-31':{ type:'holiday', name:'Новогодние каникулы' },
  // Сокращённые дни 2026
  '2026-04-30':{ type:'short', name:'Предпраздничный день (−1 час)' },
  '2026-05-08':{ type:'short', name:'Предпраздничный день (−1 час)' },
  '2026-06-11':{ type:'short', name:'Предпраздничный день (−1 час)' },
  '2026-11-03':{ type:'short', name:'Предпраздничный день (−1 час)' },
};

let _calMonth = null; // текущий отображаемый месяц

function renderProductionCalendar(events = [], tasks = []) {
  const now = new Date();
  if (!_calMonth) _calMonth = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = _calMonth;

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  // Строим карту событий по датам
  const evMap = {};
  events.forEach(e => {
    const d = e.due_date?.slice(0,10);
    if (d) { if (!evMap[d]) evMap[d] = []; evMap[d].push({ label: e.title, color:'#60a5fa', client: e.client_name }); }
  });
  tasks.filter(t => !t.done && t.due_date).forEach(t => {
    const d = t.due_date?.slice(0,10);
    if (d) { if (!evMap[d]) evMap[d] = []; evMap[d].push({ label: t.title, color:'#fbbf24', client: t.client_name }); }
  });

  // Считаем рабочие дни месяца
  const daysInMonth = new Date(y, m+1, 0).getDate();
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = HOLIDAYS[key]?.type === 'holiday';
    if (!isWeekend && !isHoliday) workDays++;
  }

  // Первый день месяца (0=вс, нужно пн=0)
  const firstDay = new Date(y, m, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Строим ячейки
  let cells = '';
  // Пустые ячейки до начала
  for (let i = 0; i < startOffset; i++) cells += `<div></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const holiday = HOLIDAYS[key];
    const isHoliday = holiday?.type === 'holiday';
    const isShort = holiday?.type === 'short';
    const isToday = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
    const hasEvents = !!evMap[key];
    const evColors = hasEvents ? [...new Set(evMap[key].map(e => e.color))] : [];

    const bg = isToday ? 'var(--blue)' : isHoliday ? 'rgba(248,113,113,0.15)' : isWeekend ? 'rgba(255,255,255,0.04)' : 'transparent';
    const textCol = isToday ? '#fff' : isHoliday ? '#f87171' : isWeekend ? '#64748b' : isShort ? '#fbbf24' : 'var(--text)';
    const border = isToday ? '1px solid var(--blue)' : isShort ? '1px solid rgba(251,191,36,0.3)' : '1px solid transparent';
    const title = holiday?.name || (hasEvents ? evMap[key].map(e=>e.label+(e.client?' ('+e.client+')':'')).join(', ') : '');

    cells += `<div onclick="showCalendarDay('${key}')" style="
      height:30px;display:flex;flex-direction:column;align-items:center;justify-content:center;
      border-radius:6px;cursor:${hasEvents||holiday?'pointer':'default'};
      background:${bg};border:${border};
      transition:background .15s;position:relative;
      font-size:11px;font-weight:${isToday?'700':'500'};color:${textCol}
    " ${title?`title="${title}"`:''}
    onmouseover="if(!${isToday}) this.style.background='rgba(255,255,255,0.06)'"
    onmouseout="if(!${isToday}) this.style.background='${bg}'">
      ${d}
      ${hasEvents ? `<div style="display:flex;gap:2px;position:absolute;bottom:2px;justify-content:center">
        ${evColors.slice(0,3).map(c=>`<div style="width:3px;height:3px;border-radius:50%;background:${c}"></div>`).join('')}
      </div>` : ''}
      ${isShort ? `<div style="position:absolute;top:2px;right:2px;width:4px;height:4px;border-radius:50%;background:#fbbf24;opacity:.8"></div>` : ''}
    </div>`;
  }

  return `
    <div class="panel" id="prod-calendar">
      <div class="panel-head" style="margin-bottom:8px">
        <span>📅</span>
        <div class="panel-title">Производственный календарь</div>
        <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
          <button onclick="calNav(-1)" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:16px;line-height:1" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted2)'">‹</button>
          <span style="font-size:13px;font-weight:600;color:var(--text);min-width:130px;text-align:center">${monthNames[m]} ${y}</span>
          <button onclick="calNav(1)" style="background:none;border:none;color:var(--muted2);cursor:pointer;padding:4px 8px;border-radius:6px;font-size:16px;line-height:1" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted2)'">›</button>
        </div>
      </div>

      <!-- Дни недели -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:2px">
        ${dayNames.map((d,i) => `<div style="text-align:center;font-size:9px;font-weight:700;color:${i>=5?'#64748b':'var(--muted2)'};padding:2px 0">${d}</div>`).join('')}
      </div>

      <!-- Ячейки дней -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">
        ${cells}
      </div>

      <!-- Легенда + статистика -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05)">
        <div style="display:flex;gap:10px">
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b">
            <div style="width:7px;height:7px;border-radius:2px;background:rgba(248,113,113,0.3)"></div>Праздник
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b">
            <div style="width:7px;height:7px;border-radius:50%;background:#fbbf24"></div>Сокращённый
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b">
            <div style="width:7px;height:7px;border-radius:50%;background:#60a5fa"></div>Событие
          </div>
        </div>
        <div style="font-size:10px;color:#475569">${workDays} раб. дн.</div>
      </div>

      <!-- Попап событий дня -->
      <div id="cal-day-popup" style="display:none;margin-top:10px;padding:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;font-size:12px"></div>
    </div>`;
}

async function calNav(dir) {
  if (!_calMonth) { const n = new Date(); _calMonth = { y:n.getFullYear(), m:n.getMonth() }; }
  _calMonth.m += dir;
  if (_calMonth.m > 11) { _calMonth.m = 0; _calMonth.y++; }
  if (_calMonth.m < 0)  { _calMonth.m = 11; _calMonth.y--; }
  // Перерендерим только дашборд
  await renderDashboard();
}

function showCalendarDay(dateKey) {
  const popup = document.getElementById('cal-day-popup');
  if (!popup) return;

  const holiday = HOLIDAYS[dateKey];
  const items = [];

  if (holiday) {
    const col = holiday.type === 'holiday' ? '#f87171' : '#fbbf24';
    items.push(`<div style="color:${col};font-weight:600">${holiday.type === 'short' ? '⏰' : '🎉'} ${holiday.name}</div>`);
  }

  // Ищем события этого дня в глобальном state
  if (window._dashEvents) {
    window._dashEvents.filter(e => e.due_date?.slice(0,10) === dateKey).forEach(e => {
      items.push(`<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><div style="width:6px;height:6px;border-radius:50%;background:#60a5fa;flex-shrink:0"></div><div>${e.title}${e.client_name?' <span style="color:#475569">· '+e.client_name+'</span>':''}</div></div>`);
    });
    window._dashTasks?.filter(t => !t.done && t.due_date?.slice(0,10) === dateKey).forEach(t => {
      items.push(`<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div><div>${t.title}${t.client_name?' <span style="color:#475569">· '+t.client_name+'</span>':''}</div></div>`);
    });
  }

  if (!items.length) { popup.style.display = 'none'; return; }

  const d = new Date(dateKey);
  popup.innerHTML = `<div style="font-weight:700;color:var(--muted2);font-size:10px;letter-spacing:.5px;margin-bottom:8px">${d.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</div>${items.join('')}`;
  popup.style.display = 'block';
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
  document.getElementById(id)?.addEventListener('click', e => { if(e.target.id===id) closeModal(id); }, { once: true });
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
        <div class="modal-title">✏️ Редактировать клиента</div>
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
        </div>

        <div class="modal-actions">
          <button class="btn btn-red" onclick="deleteClient(currentEditClientId)">🗑 Удалить</button>
          <button class="btn btn-ghost" onclick="closeModal('modalEditClient')">Отмена</button>
          <button class="btn btn-primary" onclick="submitEditClient(currentEditClientId)">${ic("save",14)} Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal('modalEditClient'); });
  }

  // Сохраняем ID клиента глобально (нужно для кнопок внутри модала)
  window.currentEditClientId = clientId;

  // Заполняем форму текущими данными
  document.getElementById('e-name').value          = c.name             || '';
  document.getElementById('e-inn').value           = c.inn              || '';
  document.getElementById('e-okved').value         = c.okved            || '';
  document.getElementById('e-staff').value         = c.staff            || '';
  document.getElementById('e-phone').value         = c.phone            || '';
  document.getElementById('e-city').value          = c.city             || '';
  document.getElementById('e-address').value       = c.address          || '';
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

  const data = {
    name,
    inn:              document.getElementById('e-inn').value.trim(),
    okved,
    staff:            parseInt(document.getElementById('e-staff').value) || 0,
    form:             document.getElementById('e-form').value,
    region:           document.getElementById('e-region').value,
    city:             document.getElementById('e-city').value.trim(),
    phone:            document.getElementById('e-phone').value.trim(),
    address:          document.getElementById('e-address').value.trim(),
    order_prefix:     parseInt(document.getElementById('e-order-prefix').value) || 1,
    manager_name:     document.getElementById('e-manager-name').value.trim(),
    manager_position: document.getElementById('e-manager-position').value,
    ot_name:           document.getElementById('e-ot-name').value.trim(),
    ot_position:       document.getElementById('e-ot-position').value.trim(),
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

  await window.api.clientUpdate(clientId, data);
  closeModal('modalEditClient');
  showToast('Данные клиента сохранены ✓');
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
          <div style="font-size:16px;font-weight:700;color:var(--text)">Архивировать клиента?</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${c.name}</div>
        </div>
      </div>

      <div style="padding:12px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);border-radius:10px;margin-bottom:16px">
        <div style="font-size:12px;color:#f87171;line-height:1.6">
          Клиент будет перемещён в архив. Все данные, сотрудники и документы сохранятся.<br>
          Восстановить можно в разделе <strong>Настройки → Архив клиентов</strong>.
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

// ── ГЕНЕРАЦИЯ ДОКУМЕНТОВ ─────────────────────────────────
async function generateDocs(clientId) {
  showToast('⚙️ Генерирую документы...');
  const result = await window.api.docsGenerate(clientId);
  if (!result.ok) {
    showToast('Ошибка: ' + result.error, 'var(--red)');
    return;
  }

  // Показываем отчёт об изменениях
  const r = result.report || {};
  const updated   = r.updated   || [];
  const added     = r.added     || [];
  const unchanged = r.unchanged || [];
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
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">Генерация завершена</div>
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


// Хелпер: пустое состояние с SVG иконкой
function emptyState(iconName, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${ic(iconName,40)}</div><div class="empty-title">${title}</div>${sub?`<div class="empty-sub">${sub}</div>`:''}</div>`;
}

// ── СПРАВОЧНИК ПДн (152-ФЗ) ──────────────────────────────
// ══════════════════════════════════════════════════════════
// МОДУЛЬ: ВОИНСКИЙ УЧЁТ
// ══════════════════════════════════════════════════════════

function renderVu() {
  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';

  const npa = [
    { title: 'Федеральный закон №53-ФЗ', date: '28.03.1998', desc: 'О воинской обязанности и военной службе — основной закон', url: 'http://www.consultant.ru/document/cons_doc_LAW_18260/' },
    { title: 'Постановление Правительства №719', date: '27.11.2006', desc: 'Положение о воинском учёте — порядок ведения учёта', url: 'http://www.consultant.ru/document/cons_doc_LAW_64499/' },
    { title: 'Приказ Министра обороны №700', date: '22.11.2021', desc: 'Инструкция по ведению воинского учёта в организациях', url: 'http://www.consultant.ru/document/cons_doc_LAW_407578/' },
    { title: 'Федеральный закон №31-ФЗ', date: '26.02.1997', desc: 'О мобилизационной подготовке и мобилизации', url: 'http://www.consultant.ru/document/cons_doc_LAW_13454/' },
  ];

  const calendar = [
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`, title: 'Сверка данных с военным комиссариатом', period: 'Ежегодно', deadline: 'до 31 декабря', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.18 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`, title: 'Представление сведений в военкомат', period: 'При приёме/увольнении военнообязанного', deadline: 'в течение 2 недель', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`, title: 'Актуализация карточек воинского учёта', period: 'При изменении данных', deadline: 'в течение 5 дней', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, title: 'Отчёт о численности военнообязанных', period: 'Ежегодно', deadline: 'до 1 ноября', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`, title: 'Оповещение военнообязанных о явке в военкомат', deadline: 'по запросу военкомата', period: 'По требованию', color: '#60a5fa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`, title: 'Хранение документов воинского учёта', period: 'Постоянно', deadline: '75 лет', color: '#34d399' },
  ];

  const checklist = [
    'Назначен ответственный за воинский учёт (есть приказ)',
    'Разработано положение о воинском учёте в организации',
    'Ведётся журнал проверок воинского учёта',
    'Все военнообязанные поставлены на учёт',
    'Личные карточки (форма Т-2) заполнены корректно',
    'Картотека воинского учёта актуализирована',
    'Проведена ежегодная сверка с военкоматом',
    'Военнообязанные уведомлены об обязанностях',
    'Хранение документов организовано по правилам',
    'Отчёт в военкомат представлен в срок',
  ];

  const categories = [
    { icon: '🎖️', title: 'Призывники', desc: 'Мужчины 18–27 лет, не прошедшие военную службу', color: '#f87171' },
    { icon: '⭐', title: 'Военнообязанные запаса', desc: 'Прошедшие службу, офицеры запаса, военнообязанные женщины', color: '#60a5fa' },
    { icon: '🏥', title: 'Ограниченно годные', desc: 'Категория В — состоят на учёте до 50 лет', color: '#fbbf24' },
    { icon: '📌', title: 'Забронированные', desc: 'Работники организаций, имеющие бронь от призыва', color: '#34d399' },
  ];

  const processes = [
    {
      title: 'Постановка работника на воинский учёт',
      steps: [
        'При приёме проверить документы воинского учёта (военный билет или приписное свидетельство)',
        'Сделать отметку в личной карточке Т-2 (раздел II)',
        'В течение 2 недель уведомить военкомат по месту жительства работника',
        'Сверить данные с военкоматом по месту нахождения организации',
        'Внести в картотеку воинского учёта',
      ]
    },
    {
      title: 'Снятие с воинского учёта при увольнении',
      steps: [
        'При увольнении сделать отметку в карточке Т-2',
        'В течение 2 недель уведомить военкомат об увольнении',
        'Изъять карточку из картотеки воинского учёта',
        'Сохранить документы в архиве организации',
      ]
    },
    {
      title: 'Ежегодная сверка с военкоматом',
      steps: [
        'До 31 декабря составить список военнообязанных работников',
        'Сверить данные карточек Т-2 с данными военкомата',
        'Актуализировать информацию о воинских званиях, составах',
        'Подписать акт сверки с военкоматом',
        'Хранить акт сверки не менее 3 лет',
      ]
    },
  ];

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="display:grid;gap:16px;max-width:900px">

      <!-- Заголовок-баннер -->
      <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:20px 24px;background:linear-gradient(135deg,rgba(96,165,250,0.1),rgba(167,139,250,0.1));border:1px solid rgba(96,165,250,0.2);border-radius:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(59,130,246,0.3)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Воинский учёт</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">Обязателен для всех организаций · Постановление Правительства №719 · Приказ МО №700</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:280px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Нарушение порядка ВУ</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#fbbf24;white-space:nowrap">до 500 000 ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Несколько нарушений сразу</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#f87171;white-space:nowrap">штрафы суммируются</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Уклонение от мобилизации</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#ef4444;white-space:nowrap">УК РФ ст. 328</span>
          </div>
        </div>
      </div>

      <!-- Категории военнообязанных -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Категории работников, подлежащих учёту
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${categories.map(cat => `
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px">
              <span style="font-size:22px;flex-shrink:0">${cat.icon}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:${cat.color}">${cat.title}</div>
                <div style="font-size:11px;color:var(--muted2);margin-top:2px;line-height:1.4">${cat.desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- НПА -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          ${ic("clipboard-list", 16)} Нормативная база
        </div>
        <div style="display:grid;gap:8px">
          ${npa.map(n => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px">
              <div>
                <div style="font-weight:600;color:var(--blue);font-size:13px">${n.title}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:3px">${n.date} · ${n.desc}</div>
              </div>
              <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px;flex-shrink:0;margin-left:12px" onclick="openUrl(this.getAttribute('data-url'))" data-url="${n.url}">🔗 Открыть</button>
            </div>`).join('')}
        </div>
      </div>

      <!-- ОБЯЗАТЕЛЬНЫЕ МЕРОПРИЯТИЯ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>📅</span> Обязательные мероприятия
        </div>
        <div style="display:grid;gap:8px">
          ${calendar.map(c => `
            <div style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:12px;background:rgba(255,255,255,0.02);border-left:3px solid ${c.color};border-radius:6px">
              <span style="display:flex;align-items:center;justify-content:center;color:${c.color};flex-shrink:0">${c.icon}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text)">${c.title}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.period}</div>
              </div>
              <div style="font-size:11px;background:${c.color};color:#fff;padding:3px 8px;border-radius:4px;white-space:nowrap">${c.deadline}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ТИПОВЫЕ ПРОЦЕССЫ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>⚙️</span> Типовые процессы
        </div>
        <div style="display:grid;gap:10px">
          ${processes.map((p, i) => `
            <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
              <div onclick="var b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none'" style="padding:12px 16px;background:rgba(96,165,250,0.08);cursor:pointer;font-weight:600;color:var(--blue);font-size:13px;display:flex;justify-content:space-between;align-items:center">
                ${p.title}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div style="display:none;padding:14px 16px;background:rgba(255,255,255,0.01)">
                <ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px">
                  ${p.steps.map(s => `<li style="font-size:12px;color:#94a3b8;line-height:1.5">${s}</li>`).join('')}
                </ol>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ЧЕК-ЛИСТ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>✅</span> Базовый чек-лист
        </div>
        <div style="display:grid;gap:7px">
          ${checklist.map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:12px;color:#94a3b8">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${item}
            </div>`).join('')}
        </div>
      </div>

    </div>`;
}

// ── ВОИНСКИЙ УЧЁТ В КАРТОЧКЕ КЛИЕНТА ─────────────────────

async function renderClientVu(clientId) {
  const clients = await getClients();
  const client = clients.find(c => c.id === clientId);
  const panel = document.getElementById('tab-vu');
  if (!panel || !client) return;

  const s = await window.api.settingsGet();
  const vuKey = `vu_data_${clientId}`;
  let vuData = {};
  try { vuData = JSON.parse(s[vuKey] || '{}'); } catch(_) {}

  const emps = await window.api.employeesList(clientId);
  const vuEmps = emps.filter(e => e.vu_category);

  const totalEmps   = emps.length;
  const vuCount     = vuEmps.length;
  const призывники  = vuEmps.filter(e => e.vu_category === 'призывник').length;
  const запасники   = vuEmps.filter(e => e.vu_category === 'запас').length;
  const забронир    = vuEmps.filter(e => e.vu_category === 'бронь').length;

  // Score ВУ
  const checks = [
    !!vuData.responsible_name,
    !!vuData.order_number,
    !!vuData.last_reconciliation,
    vuCount > 0,
    !!vuData.journal_started,
    !!vuData.regulation_done,
  ];
  const vuScore = Math.round(checks.filter(Boolean).length / checks.length * 100);
  const scoreColor = vuScore >= 80 ? '#34d399' : vuScore >= 50 ? '#fbbf24' : '#f87171';

  panel.innerHTML = `
    <div style="max-width:700px;display:grid;gap:14px">

      <!-- Статистика -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${[
          { val: vuCount,    label: 'На учёте',      color: vuCount > 0 ? '#60a5fa' : '#475569' },
          { val: призывники, label: 'Призывники',    color: призывники > 0 ? '#f87171' : '#475569' },
          { val: запасники,  label: 'Запас',          color: запасники > 0 ? '#60a5fa' : '#475569' },
          { val: забронир,   label: 'Бронь',          color: забронир > 0 ? '#34d399' : '#475569' },
        ].map(s => `
          <div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:${s.color}">${s.val}</div>
            <div style="font-size:10px;color:var(--muted2);margin-top:3px">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Готовность ВУ -->
      <div style="padding:16px 20px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">Готовность воинского учёта</div>
          <div style="font-size:20px;font-weight:800;color:${scoreColor}">${vuScore}%</div>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="width:${vuScore}%;height:100%;background:${scoreColor};border-radius:3px;transition:width .5s ease"></div>
        </div>
      </div>

      <!-- Ответственный и реквизиты -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Организация учёта
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Ответственный</div>
            <input class="form-input" id="vu-resp-${clientId}" value="${vuData.responsible_name||''}" placeholder="ФИО ответственного"
              style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(59,130,246,0.6)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
          <div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">№ Приказа о назначении</div>
            <input class="form-input" id="vu-order-${clientId}" value="${vuData.order_number||''}" placeholder="Пр. №12 от 01.01.2024"
              style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(59,130,246,0.6)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
          <div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Последняя сверка с военкоматом</div>
            <input type="date" id="vu-reconcil-${clientId}" value="${vuData.last_reconciliation||''}"
              style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box;cursor:pointer"
              onfocus="this.style.borderColor='rgba(59,130,246,0.6)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
          <div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Военкомат</div>
            <input class="form-input" id="vu-vk-${clientId}" value="${vuData.voenkomat||''}" placeholder="Военкомат Приморского района"
              style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(59,130,246,0.6)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>
        </div>

        <!-- Чекбоксы -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
          ${[
            { key:'journal_started',  label:'Журнал проверок заведён' },
            { key:'regulation_done',  label:'Положение о ВУ утверждено' },
            { key:'cards_filled',     label:'Карточки Т-2 заполнены' },
            { key:'notifications_sent',label:'Работники уведомлены' },
          ].map(cb => `
            <label style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;cursor:pointer;font-size:12px;color:#94a3b8;transition:background .15s"
              onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
              <input type="checkbox" id="vu-cb-${cb.key}-${clientId}" ${vuData[cb.key]?'checked':''} style="width:14px;height:14px;accent-color:#60a5fa;cursor:pointer">
              ${cb.label}
            </label>`).join('')}
        </div>

        <button onclick="saveVuData(${clientId})" style="
          margin-top:14px;width:100%;padding:10px;
          background:linear-gradient(135deg,#2563eb,#7c3aed);
          border:none;border-radius:10px;
          color:#fff;font-size:13px;font-weight:600;cursor:pointer;
          box-shadow:0 4px 14px rgba(59,130,246,0.25);transition:all .2s"
          onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
          💾 Сохранить данные ВУ
        </button>
      </div>

      <!-- Дополнительные коды для Формы 18 -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
          Коды для Формы №18
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          ${[
            { key:'ogrn',      label:'ОГРН',  ph:'1202300051755' },
            { key:'okato',     label:'ОКАТО', ph:'03420380000' },
            { key:'okpo',      label:'ОКПО',  ph:'45665033' },
            { key:'okopf',     label:'ОКОПФ', ph:'12300' },
            { key:'okfs',      label:'ОКФС',  ph:'16' },
            { key:'okved_name',label:'ОКВЭД (расшифровка)', ph:'Торговля оптовая...' },
          ].map(f => `<div>
            <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:5px">${f.label}</div>
            <input id="vu-code-${f.key}-${clientId}" value="${vuData[f.key]||''}" placeholder="${f.ph}"
              style="width:100%;padding:8px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:11px;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(59,130,246,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
          </div>`).join('')}
        </div>
        <div style="margin-top:10px">
          <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:5px">Дата и место регистрации</div>
          <input id="vu-code-reg_date_place-${clientId}" value="${vuData.reg_date_place||''}" placeholder="21.09.2020, Межрайонная ИФНС №16 по Краснодарскому краю"
            style="width:100%;padding:8px 10px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:11px;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='rgba(59,130,246,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:#94a3b8;cursor:pointer">
          <input type="checkbox" id="vu-code-has_bronirowanie-${clientId}" ${vuData.has_bronirowanie?'checked':''} style="width:14px;height:14px;accent-color:#fbbf24;cursor:pointer">
          Организация ведёт бронирование граждан запаса
        </label>
      </div>

      <!-- Кнопки генерации -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">

        <!-- Весь пакет ВУ -->
        <div style="padding:16px 20px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.2);border-radius:12px;display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:13px;font-weight:700;color:#60a5fa">Все документы ВУ</div>
            <div style="font-size:11px;color:var(--muted2);margin-top:2px">10 документов: приказ, обязанности, журналы, уведомления и др.</div>
          </div>
          <button onclick="generateVuDocs(${clientId})" style="
            padding:10px;
            background:linear-gradient(135deg,#2563eb,#7c3aed);
            border:none;border-radius:10px;
            color:#fff;font-size:12px;font-weight:700;cursor:pointer;
            box-shadow:0 4px 14px rgba(59,130,246,0.25);transition:all .2s;
            display:flex;align-items:center;justify-content:center;gap:8px"
            onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Сгенерировать пакет
          </button>
        </div>

        <!-- Отчётные документы -->
        <div style="padding:16px 20px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.2);border-radius:12px;display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:13px;font-weight:700;color:#34d399">Сдать отчёт</div>
            <div style="font-size:11px;color:var(--muted2);margin-top:2px">Форма №18 (до 15 нояб.) · План ВУ (до 31 дек.)</div>
          </div>
          <button onclick="showVuReportModal(${clientId})" style="
            padding:10px;
            background:linear-gradient(135deg,#059669,#10b981);
            border:none;border-radius:10px;
            color:#fff;font-size:12px;font-weight:700;cursor:pointer;
            box-shadow:0 4px 14px rgba(16,185,129,0.25);transition:all .2s;
            display:flex;align-items:center;justify-content:center;gap:8px"
            onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/><path d="M3 12h8"/></svg>
            Сдать отчёт
          </button>
        </div>

      </div>

      <!-- Список военнообязанных сотрудников -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
          <span style="display:flex;align-items:center;gap:8px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Военнообязанные сотрудники
          </span>
          <span style="font-size:11px;color:var(--muted2)">${vuCount} из ${totalEmps}</span>
        </div>
        ${vuEmps.length ? `
        <div style="display:flex;flex-direction:column;gap:6px">
          ${vuEmps.map(e => {
            const catColor = e.vu_category==='призывник'?'#f87171':e.vu_category==='бронь'?'#34d399':'#60a5fa';
            const catLabel = e.vu_category==='призывник'?'Призывник':e.vu_category==='бронь'?'Бронь':'Запас';
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.06);border-radius:8px">
              <div style="width:28px;height:28px;border-radius:8px;background:${catColor}22;border:1px solid ${catColor}44;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${catColor};flex-shrink:0">${(e.full_name||'').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.full_name||'—'}</div>
                <div style="font-size:10px;color:var(--muted2);margin-top:1px">${e.position||''}</div>
              </div>
              <span style="font-size:10px;font-weight:700;color:${catColor};background:${catColor}15;padding:2px 8px;border-radius:8px;flex-shrink:0">${catLabel}</span>
            </div>`;
          }).join('')}
        </div>` : `
        <div style="text-align:center;padding:20px;color:var(--muted2)">
          <div style="font-size:24px;margin-bottom:8px">👥</div>
          <div style="font-size:13px;font-weight:600;color:#475569">Нет данных о военнообязанных</div>
          <div style="font-size:11px;color:#334155;margin-top:4px">Укажите категорию ВУ в карточке сотрудника</div>
        </div>`}
      </div>

      <!-- Чек-лист готовности -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">✅ Чек-лист готовности</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[
            { key:'responsible', label:'Назначен ответственный (есть приказ)', done: !!vuData.responsible_name && !!vuData.order_number },
            { key:'journal',     label:'Журнал проверок воинского учёта заведён', done: !!vuData.journal_started },
            { key:'regulation',  label:'Положение о воинском учёте утверждено', done: !!vuData.regulation_done },
            { key:'reconcil',    label:'Сверка с военкоматом проведена', done: !!vuData.last_reconciliation },
            { key:'emps',        label:'Все военнообязанные поставлены на учёт', done: vuCount > 0 },
            { key:'cards',       label:'Личные карточки Т-2 заполнены', done: !!vuData.cards_filled },
          ].map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${item.done?'rgba(52,211,153,0.04)':'rgba(255,255,255,0.01)'};border:1px solid ${item.done?'rgba(52,211,153,0.15)':'rgba(255,255,255,0.05)'};border-radius:8px">
              ${item.done
                ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);flex-shrink:0"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
                : `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.12);flex-shrink:0"></span>`}
              <span style="font-size:12px;color:${item.done?'#94a3b8':'#64748b'};${item.done?'text-decoration:line-through':''}">${item.label}</span>
            </div>`).join('')}
        </div>
      </div>

      <div style="font-size:10px;color:#334155;padding:10px 14px;background:rgba(255,255,255,0.01);border-radius:8px;line-height:1.7">
        ФЗ №53 от 28.03.1998 · Постановление Правительства №719 от 27.11.2006 · Приказ МО №700 от 22.11.2021
      </div>
    </div>`;
}

async function saveVuData(clientId) {
  const s = await window.api.settingsGet();
  const vuKey = `vu_data_${clientId}`;
  let vuData = {};
  try { vuData = JSON.parse(s[vuKey] || '{}'); } catch(_) {}

  vuData.responsible_name     = document.getElementById(`vu-resp-${clientId}`)?.value?.trim() || '';
  vuData.responsible_position = document.getElementById(`vu-order-${clientId}`)?.value?.trim() ? vuData.responsible_position : vuData.responsible_position || '';
  vuData.order_number         = document.getElementById(`vu-order-${clientId}`)?.value?.trim() || '';
  vuData.last_reconciliation  = document.getElementById(`vu-reconcil-${clientId}`)?.value || '';
  vuData.voenkomat            = document.getElementById(`vu-vk-${clientId}`)?.value?.trim() || '';
  vuData.journal_started      = document.getElementById(`vu-cb-journal_started-${clientId}`)?.checked || false;
  vuData.regulation_done      = document.getElementById(`vu-cb-regulation_done-${clientId}`)?.checked || false;
  vuData.cards_filled         = document.getElementById(`vu-cb-cards_filled-${clientId}`)?.checked || false;
  vuData.notifications_sent   = document.getElementById(`vu-cb-notifications_sent-${clientId}`)?.checked || false;

  // Дополнительные коды для Формы 18
  for (const key of ['ogrn','okato','okpo','okopf','okfs','okved_name','reg_date_place']) {
    const el = document.getElementById(`vu-code-${key}-${clientId}`);
    if (el) vuData[key] = el.value.trim();
  }
  const bronEl = document.getElementById(`vu-code-has_bronirowanie-${clientId}`);
  if (bronEl) vuData.has_bronirowanie = bronEl.checked;

  await window.api.settingsSave({ [vuKey]: JSON.stringify(vuData) });
  showToast('✅ Данные воинского учёта сохранены');
  await renderClientVu(clientId);
}

async function generateVuDocs(clientId) {
  await saveVuData(clientId);
  showToast('⏳ Генерация документов ВУ...');
  try {
    const result = await window.api.docsGenerate(clientId);
    if (result.errors?.length) {
      showToast('⚠ Сгенерировано с ошибками: ' + result.errors[0], 'var(--amber)');
    } else {
      showToast('✅ Документы ВУ сгенерированы!');
    }
    await navigate('client', clientId);
  } catch(e) {
    showToast('Ошибка генерации: ' + e.message, 'var(--red)');
  }
}

function showVuReportModal(clientId) {
  const existing = document.getElementById('modal-vu-report');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-vu-report';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <style>@keyframes ob-card-in{from{opacity:0;transform:scale(.96) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px;width:460px;box-shadow:0 24px 60px rgba(0,0,0,0.7);animation:ob-card-in .3s cubic-bezier(.22,.68,0,1.1) both">

      <!-- Шапка -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.2);display:flex;align-items:center;justify-content:center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#f1f5f9">Сдать отчёт</div>
            <div style="font-size:11px;color:#475569">Воинский учёт</div>
          </div>
        </div>
        <button onclick="document.getElementById('modal-vu-report').remove()"
          style="background:none;border:none;color:#475569;cursor:pointer;font-size:18px;line-height:1;padding:4px 8px;border-radius:6px"
          onmouseover="this.style.color='#f1f5f9'" onmouseout="this.style.color='#475569'">✕</button>
      </div>

      <!-- Документы на выбор -->
      <div style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Выберите документы для формирования:</div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">

        <!-- Форма 18 -->
        <label id="vu-rep-label-form18" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;cursor:pointer;transition:all .15s"
          onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          <input type="checkbox" id="vu-rep-form18" checked
            style="width:16px;height:16px;margin-top:2px;flex-shrink:0;accent-color:#60a5fa;cursor:pointer"
            onchange="updateVuRepLabel('form18',this.checked)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:#e2e8f0">Карточка учёта организации (Форма №18)</div>
            <div style="font-size:11px;color:#475569;margin-top:3px;line-height:1.5">Ежегодный отчёт в военкомат · срок сдачи — <span style="color:#f87171;font-weight:600">до 15 ноября</span></div>
            <div style="font-size:10px;color:#334155;margin-top:3px">Основание: Постановление Правительства №719 от 27.11.2006</div>
          </div>
          <div id="vu-rep-check-form18" style="flex-shrink:0;opacity:1;transition:opacity .2s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </label>

        <!-- План -->
        <label id="vu-rep-label-plan" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;cursor:pointer;transition:all .15s"
          onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          <input type="checkbox" id="vu-rep-plan" checked
            style="width:16px;height:16px;margin-top:2px;flex-shrink:0;accent-color:#60a5fa;cursor:pointer"
            onchange="updateVuRepLabel('plan',this.checked)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:#e2e8f0">План работы по воинскому учёту</div>
            <div style="font-size:11px;color:#475569;margin-top:3px;line-height:1.5">На следующий год · срок согласования — <span style="color:#fbbf24;font-weight:600">до 31 декабря</span></div>
            <div style="font-size:10px;color:#334155;margin-top:3px">Согласовывается с военным комиссариатом</div>
          </div>
          <div id="vu-rep-check-plan" style="flex-shrink:0;opacity:1;transition:opacity .2s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </label>

      </div>

      <!-- Статус (скрыт до генерации) -->
      <div id="vu-rep-status" style="display:none;margin-bottom:16px;padding:12px 16px;border-radius:10px;font-size:12px;font-weight:600"></div>

      <!-- Кнопки -->
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('modal-vu-report').remove()"
          style="flex:1;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#64748b;font-size:13px;cursor:pointer;transition:all .2s"
          onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          Отмена
        </button>
        <button id="vu-rep-submit" onclick="submitVuReport(${clientId})"
          style="flex:2;padding:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(59,130,246,0.3);transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px"
          onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Сформировать документы
        </button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function updateVuRepLabel(key, checked) {
  const check = document.getElementById(`vu-rep-check-${key}`);
  if (check) check.style.opacity = checked ? '1' : '0.15';
}

async function submitVuReport(clientId) {
  const form18 = document.getElementById('vu-rep-form18')?.checked;
  const plan   = document.getElementById('vu-rep-plan')?.checked;

  if (!form18 && !plan) {
    showToast('Выберите хотя бы один документ', 'var(--amber)');
    return;
  }

  const docs = [];
  if (form18) docs.push('form18');
  if (plan)   docs.push('plan');

  // Блокируем кнопку
  const btn = document.getElementById('vu-rep-submit');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg> Формирую...';
    btn.style.opacity = '0.7';
  }

  const statusEl = document.getElementById('vu-rep-status');

  try {
    // Сначала сохраняем данные ВУ
    await saveVuData(clientId);

    const result = await window.api.vuGenerateReports(clientId, docs);

    if (!result.ok) throw new Error(result.error || 'Ошибка генерации');

    // Успех
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(52,211,153,0.08)';
      statusEl.style.border = '1px solid rgba(52,211,153,0.2)';
      statusEl.style.color = '#34d399';
      statusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Документы сформированы (${result.generated?.length || docs.length} шт.)
        </div>
        ${result.errors?.length ? `<div style="color:#fbbf24;font-size:11px">Предупреждения: ${result.errors[0]}</div>` : ''}
        <button onclick="window.api.docsOpenFolder('${(result.folder||'').replace(/\\/g,'\\\\')}')"
          style="margin-top:8px;padding:6px 14px;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);border-radius:8px;color:#34d399;font-size:11px;font-weight:600;cursor:pointer">
          📂 Открыть папку
        </button>`;
    }

    // Предлагаем отметить как сданные в системе отчётности
    setTimeout(() => {
      if (statusEl) {
        statusEl.innerHTML += `
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(52,211,153,0.15)">
            <div style="font-size:11px;color:#475569;margin-bottom:6px">Отметить в отчётности как сданные?</div>
            <div style="display:flex;gap:8px">
              ${form18 ? `<button onclick="markVuReportDone(${clientId},'form18',this)"
                style="flex:1;padding:6px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);border-radius:8px;color:#60a5fa;font-size:11px;font-weight:600;cursor:pointer">
                ✅ Форма №18 сдана</button>` : ''}
              ${plan ? `<button onclick="markVuReportDone(${clientId},'plan',this)"
                style="flex:1;padding:6px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);border-radius:8px;color:#60a5fa;font-size:11px;font-weight:600;cursor:pointer">
                ✅ План согласован</button>` : ''}
            </div>
          </div>`;
      }
    }, 300);

    if (btn) {
      btn.innerHTML = '✅ Готово';
      btn.style.background = 'linear-gradient(135deg,#059669,#10b981)';
      btn.style.opacity = '1';
      btn.onclick = () => document.getElementById('modal-vu-report')?.remove();
    }

  } catch(e) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(248,113,113,0.08)';
      statusEl.style.border = '1px solid rgba(248,113,113,0.2)';
      statusEl.style.color = '#f87171';
      statusEl.textContent = '⚠ ' + e.message;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Повторить';
      btn.style.opacity = '1';
    }
  }
}

async function markVuReportDone(clientId, type, btnEl) {
  // Отмечаем в системе отчётности через ключ submitted
  const s = await window.api.settingsGet();
  let submitted = {};
  try { submitted = JSON.parse(s.reports_submitted || '{}'); } catch(_) {}

  const now = new Date();
  const year = now.getFullYear();
  const key = type === 'form18'
    ? `${clientId}__federal_${year}-11-15_Карточка учёта организации (Фо`
    : `${clientId}__federal_${year}-12-31_План работы по воинскому учёту`;

  submitted[key] = new Date().toISOString();
  await window.api.settingsSave({ reports_submitted: JSON.stringify(submitted) });

  // Анимируем кнопку
  if (btnEl) {
    btnEl.style.background = 'rgba(52,211,153,0.15)';
    btnEl.style.borderColor = 'rgba(52,211,153,0.3)';
    btnEl.style.color = '#34d399';
    btnEl.innerHTML = '✅ Отмечено';
    btnEl.disabled = true;
  }

  showToast('✅ Отмечено как сданное');
}

function renderVuCategoryField(emp) {
  // Используется в форме редактирования сотрудника
  const cats = [
    { value:'', label:'Не указано' },
    { value:'призывник', label:'Призывник (18–27 лет)' },
    { value:'запас', label:'Военнообязанный запаса' },
    { value:'бронь', label:'Забронированный' },
  ];
  return `<div style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:600;color:#475569;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Категория ВУ</div>
    <select id="emp-vu-cat" style="width:100%;padding:9px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f1f5f9;font-size:12px;outline:none;cursor:pointer">
      ${cats.map(c => `<option value="${c.value}" ${emp?.vu_category===c.value?'selected':''}>${c.label}</option>`).join('')}
    </select>
  </div>`;
}

// ══════════════════════════════════════════════════════════
// МОДУЛЬ: ОХРАНА ТРУДА — СПРАВОЧНИК
// ══════════════════════════════════════════════════════════

function renderOt() {
  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';

  const npa = [
    { title: 'Трудовой кодекс РФ, раздел X', date: '30.12.2001', desc: 'Охрана труда — основные права и обязанности', url: 'https://www.consultant.ru/document/cons_doc_LAW_34683/' },
    { title: 'Приказ Минтруда №771н', date: '29.10.2021', desc: 'Примерное положение о системе управления охраной труда', url: 'https://www.consultant.ru/document/cons_doc_LAW_399350/' },
    { title: 'Приказ Минтруда №2н', date: '29.01.2021', desc: 'Правила обеспечения работников СИЗ', url: 'https://www.consultant.ru/document/cons_doc_LAW_379283/' },
    { title: 'Приказ Минтруда №776н', date: '29.10.2021', desc: 'Примерное положение о комитете (комиссии) по охране труда', url: 'https://www.consultant.ru/document/cons_doc_LAW_401112/' },
    { title: 'Приказ Минтруда №782н', date: '29.10.2021', desc: 'Порядок обучения по охране труда (ЕТКС, профстандарты)', url: 'https://www.consultant.ru/document/cons_doc_LAW_401869/' },
    { title: 'Приказ Минздрава №29н', date: '28.01.2021', desc: 'Порядок проведения обязательных медосмотров', url: 'https://www.consultant.ru/document/cons_doc_LAW_378424/' },
    { title: 'Федеральный закон №426-ФЗ', date: '28.12.2013', desc: 'О специальной оценке условий труда (СОУТ)', url: 'https://www.consultant.ru/document/cons_doc_LAW_156555/' },
    { title: 'Постановление Правительства №1101', date: '24.12.2021', desc: 'О расследовании несчастных случаев на производстве', url: 'https://www.consultant.ru/document/cons_doc_LAW_402503/' },
  ];

  const sections = [
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)',
      title: 'СОУТ',
      desc: 'Специальная оценка условий труда — обязательна для всех рабочих мест',
      fine: 'до 80 000 ₽',
      law: 'ч.2 ст.5.27.1 КоАП',
      details: 'Проводится не реже 1 раза в 5 лет. При вводе новых рабочих мест — внеплановая СОУТ в течение 12 месяцев.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)',
      title: 'Обучение по ОТ',
      desc: 'Три программы по ПП РФ №2464: А — общие вопросы ОТ и СУОТ, Б — безопасные методы работ при вредных факторах, В — работы повышенной опасности',
      fine: 'до 130 000 ₽ за каждого',
      law: 'ч.3 ст.5.27.1 КоАП',
      details: 'Программа А — руководители, специалисты, офис (1 раз в 3 года). Программа Б — рабочие профессии, вредные/опасные факторы (1 раз в 3 года). Программа В — работы повышенной опасности, только в аккредитованном центре (1 раз в год или по НПА). Неправильный выбор программы = недействительное обучение.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)',
      title: 'Инструктажи',
      desc: 'Вводный, первичный, повторный, внеплановый, целевой',
      fine: 'до 130 000 ₽',
      law: 'ч.3 ст.5.27.1 КоАП',
      details: 'Повторный инструктаж — не реже 1 раза в 6 месяцев. Вводный — при каждом приёме на работу. Регистрация в журналах обязательна.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)',
      title: 'СИЗ',
      desc: 'Средства индивидуальной защиты — выдача, учёт, хранение, списание',
      fine: 'до 150 000 ₽',
      law: 'ч.4 ст.5.27.1 КоАП',
      details: 'Выдача по нормам согласно приказу Минтруда №766н. Обязательный учёт в личных карточках. Замена при выходе из строя — немедленно.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
      color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)',
      title: 'Медосмотры',
      desc: 'Предварительные, периодические, предсменные — по перечню Минздрава',
      fine: 'до 130 000 ₽',
      law: 'ч.3 ст.5.27.1 КоАП',
      details: 'Обязательны для 52 видов работ по приказу Минздрава №29н. Периодические — 1 раз в 1-2 года. Предварительные — при приёме.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.2)',
      title: 'Документация',
      desc: 'Положения, приказы, инструкции по ОТ, программы обучения',
      fine: 'до 80 000 ₽',
      law: 'ч.1 ст.5.27.1 КоАП',
      details: '36+ локальных актов. Инструкции по ОТ — для каждой должности. Пересматриваются не реже 1 раза в 5 лет.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)',
      title: 'Несчастные случаи',
      desc: 'Расследование, оформление актов Н-1, отчётность в ФСС и ГИТ',
      fine: 'до 200 000 ₽ + уголовная',
      law: 'ст.5.27.1, ст.143 УК РФ',
      details: 'Расследование — в течение 3 суток (лёгкий) или 15 суток (тяжёлый/групповой). Акт по форме Н-1 хранится 75 лет.',
    },
    {
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      color: '#e879f9', bg: 'rgba(232,121,249,0.1)', border: 'rgba(232,121,249,0.2)',
      title: 'Микротравмы',
      desc: 'Учёт и рассмотрение обстоятельств микроповреждений здоровья',
      fine: 'до 80 000 ₽',
      law: 'ст.226 ТК РФ',
      details: 'С 01.03.2022 работодатель обязан вести учёт микротравм. Рассмотрение — в течение суток. Журнал учёта — обязателен.',
    },
  ];

  const calendar = [
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`, title: 'Разработать план мероприятий по ОТ', period: 'Ежегодно', deadline: 'до 31 декабря', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`, title: 'Провести повторный инструктаж всех сотрудников', period: 'Каждые 6 месяцев', deadline: 'январь / июль', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/></svg>`, title: 'Провести периодический медосмотр', period: 'По графику Минздрава №29н', deadline: 'по графику', color: '#60a5fa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`, title: 'Проверка и выдача СИЗ по нормам', period: 'При истечении срока носки', deadline: 'по факту', color: '#34d399' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`, title: 'Подать отчёт по форме 7-травматизм', period: 'Ежегодно', deadline: 'до 25 января', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`, title: 'Пересмотр инструкций по охране труда', period: 'Не реже 1 раза в 5 лет', deadline: 'по дате утверждения', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, title: 'Проверка знаний электробезопасности (I группа)', period: 'Ежегодно', deadline: 'по дате последней проверки', color: '#a78bfa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`, title: 'Внеплановая СОУТ при изменении условий труда', period: 'При вводе новых рабочих мест', deadline: 'в течение 12 мес.', color: '#60a5fa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M12 8v8M8 12h8"/></svg>`, title: 'Проверка первичных средств пожаротушения', period: 'Ежегодно', deadline: 'по графику', color: '#fb923c' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="18" cy="18" r="4"/><path d="M18 16v4M16 18h4"/></svg>`, title: 'Пополнение аптечек первой помощи', period: 'По мере использования', deadline: 'по факту', color: '#34d399' },
  ];

  const processes = [
    {
      title: 'Проведение вводного инструктажа',
      steps: [
        'Разработать и утвердить программу вводного инструктажа (отдельный документ, не Программа А)',
        'Провести инструктаж до начала работы — в первый рабочий день',
        'Охватить темы: общие сведения об организации, правила внутреннего распорядка, основные опасности, СИЗ, действия при НС',
        'Проверить знания: устный опрос или тестирование',
        'Зафиксировать в журнале регистрации вводного инструктажа',
        'Подписи: проводивший инструктаж и инструктируемый',
        'Журнал хранить 45 лет',
      ]
    },
    {
      title: 'Расследование несчастного случая',
      steps: [
        'Немедленно сообщить в ФСС (при тяжёлом/групповом — также в ГИТ, прокуратуру, администрацию)',
        'Создать комиссию по расследованию (приказ в течение 24 часов)',
        'Собрать документы: объяснительные, схему места НС, медзаключение',
        'Провести расследование: лёгкий НС — 3 суток, тяжёлый — 15 суток',
        'Составить акт по форме Н-1 в 3 экземплярах',
        'Направить акт пострадавшему, в ФСС, хранить 75 лет',
        'Учесть в журнале регистрации несчастных случаев',
      ]
    },
    {
      title: 'Обучение по охране труда (программы А, Б, В)',
      steps: [
        'Определить категории работников: офис/руководство → Программа А, рабочие/вредные факторы → Программа Б, работы повышенной опасности → Программа В',
        'Программы А и Б — можно проводить внутри организации (при наличии комиссии) или в учебном центре',
        'Программа В — только в аккредитованном учебном центре',
        'Утвердить состав аттестационной комиссии (не менее 3 человек, прошедших обучение по Программе А)',
        'Провести обучение по утверждённым программам',
        'Провести проверку знаний, оформить протокол',
        'Выдать удостоверения о проверке знаний требований ОТ',
        'Внести данные в реестр обученных (ЕИСОТ с 01.09.2023)',
        'Периодичность: Программы А и Б — 1 раз в 3 года, Программа В — 1 раз в год или по НПА',
      ]
    },
    {
      title: 'Проведение СОУТ',
      steps: [
        'Издать приказ о проведении СОУТ, утвердить состав комиссии',
        'Заключить договор с аккредитованной организацией',
        'Составить перечень рабочих мест, подлежащих СОУТ',
        'Организовать проведение измерений условий труда',
        'Утвердить отчёт о СОУТ в течение 30 дней',
        'Уведомить сотрудников под подпись о результатах',
        'Разместить сводные данные на сайте организации',
        'Подать декларацию в ГИТ для рабочих мест 1-2 класса',
      ]
    },
    {
      title: 'Обеспечение СИЗ',
      steps: [
        'Определить перечень необходимых СИЗ по типовым нормам (приказ №766н)',
        'Разработать локальные нормы выдачи СИЗ (с учётом СОУТ)',
        'Утвердить локальные нормы приказом руководителя',
        'Организовать закупку сертифицированных СИЗ',
        'Выдать СИЗ сотрудникам, зафиксировать в личной карточке',
        'Организовать хранение, стирку, обеззараживание и ремонт СИЗ',
        'Провести инструктаж по применению СИЗ',
      ]
    },
  ];

  const checklist = [
    'Назначен ответственный за ОТ (есть приказ)',
    'Утверждено Положение о системе управления ОТ (СУОТ)',
    'Проведена СОУТ, результаты задекларированы/размещены на сайте',
    'Все сотрудники прошли вводный инструктаж и обучение по ОТ',
    'Проведены периодические медосмотры (при необходимости)',
    'Работники обеспечены СИЗ по нормам, карточки заполнены',
    'Инструкции по ОТ разработаны для каждой должности',
    'Журналы инструктажей ведутся и хранятся правильно',
    'Аптечки укомплектованы, огнетушители в порядке',
    'Журнал учёта микроповреждений заведён и ведётся',
    'Программы обучения по ОТ утверждены',
    'Разработан и утверждён план мероприятий по ОТ на год',
  ];

  const штрафыСводка = [
    { art: 'ч.1 ст.5.27.1', desc: 'Нарушение требований ОТ (общее)', org: '50–80 тыс. ₽', dir: '2–5 тыс. ₽', note: '' },
    { art: 'ч.2 ст.5.27.1', desc: 'Нарушение порядка СОУТ', org: '60–80 тыс. ₽', dir: '5–10 тыс. ₽', note: '' },
    { art: 'ч.3 ст.5.27.1', desc: 'Допуск без обучения — за каждого сотрудника', org: '110–130 тыс. ₽', dir: '15–25 тыс. ₽', note: 'за каждого' },
    { art: 'ч.3 ст.5.27.1', desc: 'Допуск без медосмотра — за каждого сотрудника', org: '110–130 тыс. ₽', dir: '15–25 тыс. ₽', note: 'за каждого' },
    { art: 'ч.4 ст.5.27.1', desc: 'Необеспечение СИЗ — за каждого сотрудника', org: '130–150 тыс. ₽', dir: '20–30 тыс. ₽', note: 'за каждого' },
    { art: 'ч.5 ст.5.27.1', desc: 'Повторное нарушение', org: '100–200 тыс. ₽ / приост.', dir: 'дискв. 1–3 года', note: '' },
  ];

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="display:grid;gap:16px;max-width:960px">

      <!-- Баннер -->
      <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:20px 24px;background:linear-gradient(135deg,rgba(248,113,113,0.1),rgba(251,146,60,0.08));border:1px solid rgba(248,113,113,0.2);border-radius:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#ef4444,#f97316);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(239,68,68,0.35)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Охрана труда</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Обязательна для всех работодателей · ТК РФ, раздел X · 8 направлений контроля</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:280px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Первичное нарушение</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#fbbf24;white-space:nowrap">до 200 000 ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">10 чел. без обучения</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#f87171;white-space:nowrap">до 1 300 000 ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Повторное / НС со смертью</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#ef4444;white-space:nowrap">УК РФ / приост.</span>
          </div>
        </div>
      </div>

      <!-- 8 направлений -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          8 направлений охраны труда
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          ${sections.map(s => `
            <div style="padding:14px;background:${s.bg};border:1px solid ${s.border};border-radius:12px;cursor:default;transition:transform .15s"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
              <div style="width:36px;height:36px;border-radius:10px;background:${s.bg};border:1px solid ${s.border};display:flex;align-items:center;justify-content:center;margin-bottom:10px;color:${s.color}">${s.icon}</div>
              <div style="font-size:13px;font-weight:700;color:${s.color};margin-bottom:4px">${s.title}</div>
              <div style="font-size:10px;color:#64748b;line-height:1.5;margin-bottom:8px">${s.desc}</div>
              <div style="font-size:10px;color:#475569;line-height:1.4">${s.details}</div>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:10px;font-weight:700;color:${s.color}">${s.fine}</span>
                <span style="font-size:9px;color:#334155">${s.law}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Таблица штрафов -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          Штрафы по ст. 5.27.1 КоАП РФ
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:rgba(255,255,255,0.03)">
                <th style="padding:10px 14px;text-align:left;color:#475569;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">Статья</th>
                <th style="padding:10px 14px;text-align:left;color:#475569;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">Нарушение</th>
                <th style="padding:10px 14px;text-align:right;color:#f87171;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">Юр. лицо</th>
                <th style="padding:10px 14px;text-align:right;color:#fbbf24;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06)">Должн. лицо</th>
              </tr>
            </thead>
            <tbody>
              ${штрафыСводка.map((r, i) => `
                <tr style="background:${i%2===0?'transparent':'rgba(255,255,255,0.01)'}">
                  <td style="padding:10px 14px;color:#60a5fa;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap">${r.art}</td>
                  <td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.04)">
                    ${r.desc}
                    ${r.note ? `<span style="margin-left:6px;font-size:9px;font-weight:800;color:#f87171;background:rgba(248,113,113,0.12);padding:2px 6px;border-radius:4px;white-space:nowrap">× ${r.note}</span>` : ''}
                  </td>
                  <td style="padding:10px 14px;text-align:right;font-weight:700;color:#f87171;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap">${r.org}</td>
                  <td style="padding:10px 14px;text-align:right;font-weight:700;color:#fbbf24;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap">${r.dir}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Нормативная база -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          ${ic("clipboard-list", 16)} Нормативная база
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${npa.map(n => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;gap:10px">
              <div style="min-width:0">
                <div style="font-weight:600;color:#60a5fa;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.title}</div>
                <div style="font-size:10px;color:#475569;margin-top:3px">${n.date} · ${n.desc}</div>
              </div>
              <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;flex-shrink:0" onclick="openUrl(this.getAttribute('data-url'))" data-url="${n.url}">🔗</button>
            </div>`).join('')}
        </div>
      </div>

      <!-- Производственный календарь -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Обязательные мероприятия
        </div>
        <div style="display:grid;gap:7px">
          ${calendar.map(c => `
            <div style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:11px 14px;background:rgba(255,255,255,0.02);border-left:3px solid ${c.color};border-radius:6px">
              <span style="display:flex;align-items:center;justify-content:center;color:${c.color};flex-shrink:0">${c.icon}</span>
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--text)">${c.title}</div>
                <div style="font-size:10px;color:#475569;margin-top:2px">${c.period}</div>
              </div>
              <div style="font-size:11px;font-weight:700;color:#fff;background:${c.color};padding:3px 10px;border-radius:6px;white-space:nowrap">${c.deadline}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Типовые процессы -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>⚙️</span> Типовые процессы
        </div>
        <div style="display:grid;gap:8px">
          ${processes.map(p => `
            <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
              <summary style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:rgba(248,113,113,0.06);cursor:pointer;font-weight:600;color:#f87171;font-size:13px;list-style:none"
                onmouseover="this.style.background='rgba(248,113,113,0.1)'" onmouseout="this.style.background='rgba(248,113,113,0.06)'">
                ${p.title}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </summary>
              <div style="padding:14px 16px;background:rgba(255,255,255,0.01)">
                <ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px">
                  ${p.steps.map(s => `<li style="font-size:12px;color:#94a3b8;line-height:1.5">${s}</li>`).join('')}
                </ol>
              </div>
            </details>`).join('')}
        </div>
      </div>

      <!-- Чек-лист -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>✅</span> Базовый чек-лист
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
          ${checklist.map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:12px;color:#64748b">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" flex-shrink:0><polyline points="20 6 9 17 4 12"/></svg>
              ${item}
            </div>`).join('')}
        </div>
      </div>

      <!-- Правовое основание -->
      <div style="font-size:10px;color:#334155;padding:10px 14px;background:rgba(255,255,255,0.01);border-radius:8px;line-height:1.7">
        ТК РФ раздел X · Приказ Минтруда №771н от 29.10.2021 · Приказ Минтруда №782н от 29.10.2021 · ФЗ №426-ФЗ от 28.12.2013 · Приказ Минздрава №29н от 28.01.2021
      </div>
    </div>`;
}

function renderPd() {
  const content = document.getElementById('content');

  const npa = [
    { title: 'Федеральный закон №152-ФЗ', date: '27.07.2006', desc: 'Об обработке персональных данных — основной закон', url: 'http://www.consultant.ru/document/cons_doc_LAW_61801/' },
    { title: 'Приказ Роскомнадзора №178', date: '28.10.2022', desc: 'Форма уведомления об обработке ПД', url: 'http://rkn.gov.ru' },
    { title: 'Постановление Правительства №1119', date: '01.11.2012', desc: 'Требования к защите ПД в информационных системах', url: 'http://www.consultant.ru/document/cons_doc_LAW_137356/' },
    { title: 'ГОСТ Р 57580.1-2017', date: '01.01.2018', desc: 'Безопасность финансовых операций. Защита информации', url: 'http://protect.gost.ru' },
  ];

  const calendar = [
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.18 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`, title: 'Уведомить Роскомнадзор об ИСПДн', period: 'При создании/изменении системы', deadline: 'в течение 30 дней', color: '#f87171' },
    { icon: ic('file-text',20), title: 'Актуализировать Политику обработки ПД', period: 'Ежегодно', deadline: '31 декабря', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`, title: 'Переподписать согласия сотрудников', period: 'При изменении условий обработки', deadline: 'в течение 30 дней', color: '#f87171' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`, title: 'Провести внутренний аудит ИСПДн', period: 'Ежегодно', deadline: 'по плану организации', color: '#fbbf24' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`, title: 'Обучить ответственного за ПД', period: 'Ежегодно', deadline: '31 декабря', color: '#60a5fa' },
    { icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, title: 'Проверить сроки хранения ПД', period: 'Ежегодно', deadline: 'по плану организации', color: '#fbbf24' },
  ];

  const processes = [
    {
      title: 'Согласие на обработку персональных данных',
      steps: [
        'Указать полные реквизиты организации (оператор)',
        'Перечислить конкретные данные: ФИО, паспорт, телефон, email',
        'Указать цель: кадровый учёт, расчёт зарплаты, отчётность',
        'Способ обработки: ручная, автоматизированная',
        'Срок хранения: в течение срока действия трудового договора',
        'Подписать сотрудником лично, хранить в личном деле',
      ]
    },
    {
      title: 'Уведомление Роскомнадзора об ИСПДн',
      steps: [
        'Войти в личный кабинет на rkn.gov.ru',
        'Раздел "Реестр операторов" → Подать уведомление',
        'Заполнить: название организации, ИНН, руководитель, адрес',
        'Описать ИСПДн: название системы, какие ПД обрабатываются',
        'Указать категории: общедоступные, специальные, биометрические',
        'Отправить, сохранить номер регистрации',
      ]
    },
    {
      title: 'Политика обработки персональных данных',
      steps: [
        'Реквизиты организации и ФИО ответственного за ПД',
        'Перечень категорий ПД: ФИО, паспорт, СНИЛС, ИНН, телефон',
        'Источники получения: сотрудники, клиенты, контрагенты',
        'Цели обработки и правовые основания',
        'Сроки хранения по каждой категории',
        'Права субъектов ПД: доступ, исправление, удаление',
        'Опубликовать на сайте или вывесить в офисе',
      ]
    },
  ];

  const checklist = [
    'Получены письменные согласия от всех сотрудников',
    'Составлена и утверждена Политика обработки ПД',
    'Назначен ответственный за ПД (есть приказ)',
    'РКН уведомлена об ИСПДн',
    'Проведено обучение ответственного',
    'Проведён внутренний аудит ИСПДн',
    'Ведётся журнал учёта обращений субъектов ПД',
    'Разработан регламент обработки ПД',
    'Определены и задокументированы меры защиты',
    'Установлены и соблюдаются сроки хранения ПД',
  ];

  content.innerHTML = `
    <div style="display:grid;gap:16px;max-width:960px">

      <!-- Баннер -->
      <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:20px 24px;background:linear-gradient(135deg,rgba(96,165,250,0.1),rgba(167,139,250,0.08));border:1px solid rgba(96,165,250,0.2);border-radius:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(59,130,246,0.35)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Персональные данные (152-ФЗ)</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Обязателен для всех операторов ПД · ФЗ №152, ст.18.1 · Роскомнадзор</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:280px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Нарушение обработки ПД</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#fbbf24;white-space:nowrap">до 300 000 ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Утечка данных</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#f87171;white-space:nowrap">от 3 до 15 млн ₽</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;gap:12px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0"></div>
              <span style="font-size:10px;color:#94a3b8">Повторно / массовая утечка</span>
            </div>
            <span style="font-size:12px;font-weight:800;color:#ef4444;white-space:nowrap">до 500 млн ₽</span>
          </div>
        </div>
      </div>

      <!-- НПА -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          ${ic("clipboard-list", 16)} Нормативная база
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${npa.map(n => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;gap:10px">
              <div style="min-width:0">
                <div style="font-weight:600;color:#60a5fa;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.title}</div>
                <div style="font-size:10px;color:#475569;margin-top:3px">${n.date} · ${n.desc}</div>
              </div>
              <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;flex-shrink:0" onclick="openUrl(this.getAttribute('data-url'))" data-url="${n.url}">🔗</button>
            </div>`).join('')}
        </div>
      </div>

      <!-- КАЛЕНДАРЬ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Обязательные мероприятия
        </div>
        <div style="display:grid;gap:7px">
          ${calendar.map(c => `
            <div style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:11px 14px;background:rgba(255,255,255,0.02);border-left:3px solid ${c.color};border-radius:6px">
              <span style="display:flex;align-items:center;justify-content:center;color:${c.color};flex-shrink:0">${c.icon}</span>
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--text)">${c.title}</div>
                <div style="font-size:10px;color:#475569;margin-top:2px">${c.period}</div>
              </div>
              <div style="font-size:11px;font-weight:700;color:#fff;background:${c.color};padding:3px 10px;border-radius:6px;white-space:nowrap">${c.deadline}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ПРОЦЕССЫ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          Типовые процессы
        </div>
        <div style="display:grid;gap:8px">
          ${processes.map(p => `
            <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
              <summary style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:rgba(96,165,250,0.06);cursor:pointer;font-weight:600;color:#60a5fa;font-size:13px;list-style:none"
                onmouseover="this.style.background='rgba(96,165,250,0.1)'" onmouseout="this.style.background='rgba(96,165,250,0.06)'">
                ${p.title}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </summary>
              <div style="padding:14px 16px;background:rgba(255,255,255,0.01)">
                <ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px">
                  ${p.steps.map(s => `<li style="font-size:12px;color:#94a3b8;line-height:1.5">${s}</li>`).join('')}
                </ol>
              </div>
            </details>`).join('')}
        </div>
      </div>

      <!-- ЧЕК-ЛИСТ -->
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Чек-лист готовности к 152-ФЗ
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
          ${checklist.map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:12px;color:#64748b">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
              ${item}
            </div>`).join('')}
        </div>
      </div>

      <div style="font-size:10px;color:#334155;padding:10px 14px;background:rgba(255,255,255,0.01);border-radius:8px;line-height:1.7">
        ФЗ №152 от 27.07.2006 · Приказ Роскомнадзора №178 от 28.10.2022 · Постановление Правительства №1119 от 01.11.2012 · Актуально на 2026 год
      </div>

    </div>`;
}

async function savePdData(clientId) {
  const name  = document.getElementById(`pd-resp-name-${clientId}`)?.value?.trim() || '';
  const pos   = document.getElementById(`pd-resp-pos-${clientId}`)?.value?.trim() || '';
  const rkn   = document.getElementById(`pd-rkn-${clientId}`)?.checked ? 1 : 0;
  const rknDate = document.getElementById(`pd-rkn-date-${clientId}`)?.value || '';

  await window.api.clientUpdate(clientId, {
    pd_responsible_name:     name,
    pd_responsible_position: pos,
    pd_notified_rkn:         rkn,
    pd_notification_date:    rknDate,
  });
  showToast('ПДн-данные сохранены ✓', 'var(--green)');
  await navigate('client', clientId);
}

// ── ПДн: добавить ИСПДн ──────────────────────────────────
async function addIspdnItem(clientId) {
  // Создаём модальное окно вместо prompt
  let modal = document.getElementById('ispdn-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'ispdn-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999';
  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;width:400px">
      <div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Добавить ИСПДн</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:14px">Примеры: 1С:Бухгалтерия, Кадровая система, CRM, Почта</div>
      <input id="ispdn-name-input" type="text" placeholder="Название информационной системы" style="width:100%;padding:10px 14px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:16px" onkeydown="if(event.key==='Enter')document.getElementById('ispdn-submit').click()">
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('ispdn-modal').remove()">Отмена</button>
        <button id="ispdn-submit" class="btn btn-primary" onclick="submitIspdn(${clientId})">Добавить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('ispdn-name-input')?.focus(), 100);
}

async function submitIspdn(clientId) {
  const input = document.getElementById('ispdn-name-input');
  const name = input?.value?.trim();
  if (!name) return;
  const client = await window.api.clientGet(clientId);
  const list = client.pd_ispdn_list || [];
  const today = new Date().toLocaleDateString('ru-RU');
  list.push({ name, added: today });
  await window.api.clientUpdate(clientId, { pd_ispdn_list: list });
  document.getElementById('ispdn-modal')?.remove();
  showToast('ИСПДн добавлена ✓', 'var(--green)');
  await navigate('client', clientId);
}

// ── ПДн: удалить ИСПДн ───────────────────────────────────
async function removeIspdnItem(clientId, idx) {
  const client = await window.api.clientGet(clientId);
  const list = client.pd_ispdn_list || [];
  const item = list[idx];
  if (!item) return;
  if (!confirm(`Удалить "${item.name}"?`)) return;
  list.splice(idx, 1);
  await window.api.clientUpdate(clientId, { pd_ispdn_list: list });
  showToast('ИСПДн удалена', 'var(--amber)');
  await navigate('client', clientId);
}

// ── Генерация документов ПДн ─────────────────────────────
async function generatePdDocs(clientId) {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Генерация...'; }
  try {
    const result = await window.api.docsGenerate(clientId);
    if (!result.ok) {
      showToast('Ошибка: ' + (result.error || 'неизвестная'), 'var(--red)');
      return;
    }
    const r = result.report || {};
    const pdGenerated = [...new Set(result.generated.filter(f => f.replace(/\\/g,'/').includes('Персональные данные')))];
    const userMod = (r.userModified || []);
    let msg = `✅ ПДн: ${pdGenerated.length} документов`;
    if (userMod.length > 0) msg += ` · ${userMod.length} с правками сохранены`;
    showToast(msg, 'var(--green)');
    await navigate('client', clientId);
  } catch(e) {
    showToast('Ошибка генерации: ' + e.message, 'var(--red)');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '${ic("zap",14)} Сгенерировать'; }
  }
}

// ═══════════════════════════════════════════════════════════
// ЦЕНТР ГОТОВНОСТИ — РЕЖИМ ПДн
// ═══════════════════════════════════════════════════════════

// Переключение режима ОТ / ПДн
async function rcSwitchMode(mode, clientId) {
  const btnOt = document.getElementById('rc-tab-ot');
  const btnPd = document.getElementById('rc-tab-pd');
  const btnVu = document.getElementById('rc-tab-vu');

  // Сбрасываем все вкладки в неактивное состояние
  [
    { btn: btnOt, color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.5)' },
    { btn: btnPd, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.5)'  },
    { btn: btnVu, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.5)' },
  ].forEach(({ btn, color, bg, border }) => {
    if (!btn) return;
    btn.classList.remove('rc-active');
    btn.style.background   = 'rgba(255,255,255,0.03)';
    btn.style.borderColor  = 'rgba(255,255,255,0.08)';
    btn.style.color        = '#475569';
  });

  // Активируем нужную вкладку
  const configs = {
    ot: { btn: btnOt, color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.5)' },
    pd: { btn: btnPd, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.5)'  },
    vu: { btn: btnVu, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.5)' },
  };
  const active = configs[mode];
  if (active?.btn) {
    active.btn.classList.add('rc-active');
    active.btn.style.background  = active.bg;
    active.btn.style.borderColor = active.border;
    active.btn.style.color       = active.color;
  }

  if (mode === 'ot') {
    await openReadinessCenter(clientId);
  } else if (mode === 'pd') {
    await renderPdReadiness(clientId);
  } else if (mode === 'vu') {
    await renderVuReadiness(clientId);
  }
}

// Главная функция ПДн-центра готовности
async function renderPdReadiness(clientId) {
  const c = await window.api.clientGet(clientId);
  const docs = (await window.api.documentsList(clientId)).filter(d => d.module === 'PD');
  const emps = await window.api.employeesList(clientId);
  const now = new Date();

  // Score ПДн
  const pdResp = c.pd_responsible_name || '';
  const pdRkn  = c.pd_notified_rkn;
  const pdDate = c.pd_notification_date ? new Date(c.pd_notification_date) : null;
  const ispdn  = (c.pd_ispdn_list || []).length;

  let score = 0;
  if (docs.length > 0) score += 35;
  if (pdRkn) score += 25;
  if (pdResp) score += 25;
  if (ispdn > 0) score += 15;

  const scoreColor = score >= 80 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--red)';

  // Риски ПДн
  const risks = [];
  if (!pdRkn) risks.push({ level:'high', title:'РКН не уведомлена об ИСПДн', law:'ст. 22 ФЗ-152', fine:'до 5 000 ₽ / день', fix:'Подать уведомление на rkn.gov.ru' });
  if (!pdResp) risks.push({ level:'high', title:'Не назначен ответственный за ПДн', law:'ч.1 ст.18.1 ФЗ-152', fine:'до 100 000 ₽', fix:'Назначить приказом во вкладке ПДн' });
  if (docs.length === 0) risks.push({ level:'high', title:'Отсутствует пакет документов ПДн', law:'ст. 18.1 ФЗ-152', fine:'до 300 000 ₽', fix:'Сгенерировать документы во вкладке ПДн' });
  if (ispdn === 0) risks.push({ level:'medium', title:'Не указаны ИСПДн', law:'ст. 22 ФЗ-152', fine:'до 100 000 ₽', fix:'Добавить ИСПДн во вкладке ПДн' });
  if (pdDate) {
    const daysSince = Math.floor((now - pdDate) / 86400000);
    if (daysSince > 365) risks.push({ level:'medium', title:'Давно не проводилась актуализация Политики ПДн', law:'ст. 18.1 ФЗ-152', fine:'предписание', fix:'Обновить Политику (повторная генерация)' });
  }
  const noConsent = emps.filter(e => !e.pd_consent_given).length;
  if (emps.length > 0 && noConsent > 0) risks.push({ level:'medium', title:`Не подписаны согласия: ${noConsent} сотр.`, law:'ст. 9 ФЗ-152', fine:'до 75 000 ₽', fix:'Подписать согласия и хранить в личных делах' });

  const probability = risks.length === 0 ? 5 : Math.min(95, risks.filter(r=>r.level==='high').length * 25 + risks.filter(r=>r.level==='medium').length * 10 + 5);
  let riskLabel = probability >= 70 ? 'ВЫСОКИЙ' : probability >= 40 ? 'СРЕДНИЙ' : 'НИЗКИЙ';
  let riskColor = probability >= 70 ? '#f87171' : probability >= 40 ? '#fbbf24' : '#34d399';

  // Живая лента изменений 152-ФЗ
  const newsItems = [
    { date:'01.09.2024', tag:'ВАЖНО', color:'#f87171', text:'Оборотные штрафы за утечку ПДн — до 3% выручки. Повторное нарушение — до 18 млн ₽ (ст.13.11 КоАП).' },
    { date:'01.03.2023', tag:'ТРЕБУЕТ ДЕЙСТВИЙ', color:'#fbbf24', text:'Обязательное уведомление РКН в течение 24 часов при утечке ПДн. Журнал инцидентов теперь обязателен.' },
    { date:'01.09.2022', tag:'ИЗМЕНЕНИЕ', color:'#60a5fa', text:'ФЗ-266: уведомление РКН теперь до начала обработки ПДн (раньше было в течение 30 дней). Форма уведомления обновлена.' },
    { date:'2026', tag:'ОЖИДАЕТСЯ', color:'#a78bfa', text:'Законопроект об ужесточении ответственности должностных лиц за нарушение 152-ФЗ. Штрафы для руководителей до 500 000 ₽.' },
  ];

  // Календарь совести
  const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  const duties = [
    { month:11, label:'Актуализация Политики ПДн', done: pdDate && new Date(pdDate).getFullYear() >= now.getFullYear() },
    { month:11, label:'Обучение ответственного', done: false },
    { month:now.getMonth(), label:'Проверка сроков хранения ПДн', done: false },
    { month:2, label:'Внутренний аудит ИСПДн', done: docs.length > 0 },
    { month:5, label:'Актуализация согласий', done: noConsent === 0 },
    { month:8, label:'Проверка антивирусной защиты', done: false },
  ];

  const el = document.getElementById('rc-mode-content');
  if (!el) return;

  el.innerHTML = `
    <div style="display:grid;gap:16px">

      <!-- СИМУЛЯТОР ПРОВЕРКИ РКН -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${ic('shield',22)}
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Что будет, если завтра придёт Роскомнадзор?</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Симуляция проверки инспектора РКН по вашим реальным данным</div>
          </div>
          <button onclick="runRknSimulator(${clientId})" id="rknSimBtn" style="padding:11px 22px;background:linear-gradient(90deg,#ef4444,#dc2626);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ▶ Запустить проверку
          </button>
        </div>
        <div id="rkn-sim-result" style="margin-top:16px"></div>
      </div>

      <!-- ИНДЕКС РИСКА + ПИСЬМО ОТ РКН -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- Спидометр -->
        <div class="rc-card panel">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${ic('target',18)}
            </div>
            <div>
              <div style="font-size:14px;font-weight:700;color:#f1f5f9">Индекс риска РКН</div>
              <div style="font-size:11px;color:#94a3b8">Вероятность нарушений при проверке</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0">
            <svg width="220" height="130" viewBox="0 0 220 130">
              <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="18" stroke-linecap="round"/>
              <path d="M 20 110 A 90 90 0 0 1 75 27" fill="none" stroke="#34d399" stroke-width="18" stroke-linecap="round" opacity=".35"/>
              <path d="M 75 27 A 90 90 0 0 1 145 27" fill="none" stroke="#fbbf24" stroke-width="18" stroke-linecap="round" opacity=".35"/>
              <path d="M 145 27 A 90 90 0 0 1 200 110" fill="none" stroke="#f87171" stroke-width="18" stroke-linecap="round" opacity=".35"/>
              ${(() => {
                const pct = probability/100;
                const angle = -180+pct*180;
                const rad = angle*Math.PI/180;
                const x = 110+90*Math.cos(rad), y = 110+90*Math.sin(rad);
                const la = pct>0.5?1:0;
                return `<path d="M 20 110 A 90 90 0 ${la} 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${riskColor}" stroke-width="18" stroke-linecap="round"/>
                <line x1="110" y1="110" x2="${(110+72*Math.cos(rad)).toFixed(1)}" y2="${(110+72*Math.sin(rad)).toFixed(1)}" stroke="${riskColor}" stroke-width="3" stroke-linecap="round"/>
                <circle cx="110" cy="110" r="6" fill="${riskColor}"/>`;
              })()}
              <text x="14" y="126" fill="#475569" font-size="10" text-anchor="middle">0%</text>
              <text x="110" y="18" fill="#475569" font-size="10" text-anchor="middle">50%</text>
              <text x="206" y="126" fill="#475569" font-size="10" text-anchor="middle">100%</text>
              <text x="110" y="95" fill="${riskColor}" font-size="26" font-weight="800" text-anchor="middle">${probability}%</text>
              <text x="110" y="113" fill="#94a3b8" font-size="11" text-anchor="middle">${riskLabel}</text>
            </svg>
          </div>
          <div style="display:flex;justify-content:center;gap:16px;margin-top:4px">
            <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#34d399"></div>Низкий</div>
            <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#fbbf24"></div>Средний</div>
            <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:8px;height:8px;border-radius:50%;background:#f87171"></div>Высокий</div>
          </div>
        </div>

        <!-- Письмо от РКН -->
        <div class="rc-card panel">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${ic('file-text',18)}
            </div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700;color:#f1f5f9">Письмо от РКН</div>
              <div style="font-size:11px;color:#94a3b8">Как выглядело бы предписание сегодня</div>
            </div>
            <button onclick="toggleRknLetter()" style="padding:5px 10px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);border-radius:6px;color:#a78bfa;font-size:11px;cursor:pointer">Показать</button>
          </div>
          <div id="rkn-letter" style="display:none">
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px;font-size:11px;line-height:1.7;color:#cbd5e1">
              <div style="font-weight:700;color:#f1f5f9;margin-bottom:8px;font-size:12px">ФЕДЕРАЛЬНАЯ СЛУЖБА ПО НАДЗОРУ В СФЕРЕ СВЯЗИ,<br>ИНФОРМАЦИОННЫХ ТЕХНОЛОГИЙ И МАССОВЫХ КОММУНИКАЦИЙ</div>
              <div style="color:#94a3b8;margin-bottom:10px">Исх. № РКН-${Math.floor(Math.random()*90000+10000)}-ПД от ${new Date().toLocaleDateString('ru-RU')}</div>
              <div style="font-weight:600;margin-bottom:8px">${c.name}</div>
              <div style="margin-bottom:10px">По результатам проверки соблюдения требований Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» выявлены следующие нарушения:</div>
              ${risks.length === 0
                ? '<div style="color:#34d399">✓ Нарушений не выявлено. Оператор соответствует требованиям 152-ФЗ.</div>'
                : risks.map((r,i) => `<div style="margin-bottom:6px;padding:8px;background:rgba(248,113,113,0.06);border-left:2px solid ${r.level==='high'?'#f87171':'#fbbf24'};border-radius:4px">
                  <span style="font-weight:600">${i+1}. ${r.title}</span><br>
                  <span style="color:#94a3b8">${r.law} · Штраф: ${r.fine}</span>
                </div>`).join('')}
              ${risks.length > 0 ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);color:#94a3b8">Срок устранения нарушений: <strong style="color:#fbbf24">30 календарных дней</strong> с даты получения предписания.</div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- ЖИВАЯ ЛЕНТА ИЗМЕНЕНИЙ 152-ФЗ -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${ic('bar-chart',18)}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Живая лента изменений 152-ФЗ</div>
            <div style="font-size:11px;color:#94a3b8">Последние изменения на человеческом языке</div>
          </div>
        </div>
        <div style="display:grid;gap:8px">
          ${newsItems.map(n => `
            <div style="display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:start;padding:10px;background:rgba(255,255,255,0.02);border-radius:8px">
              <span style="font-size:11px;color:#64748b;white-space:nowrap">${n.date}</span>
              <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${n.color}22;color:${n.color};font-weight:700;white-space:nowrap">${n.tag}</span>
              <span style="font-size:12px;color:#cbd5e1;line-height:1.5">${n.text}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- КАЛЕНДАРЬ СОВЕСТИ -->
      <div class="rc-card panel">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${ic('calendar',18)}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">Календарь совести</div>
            <div style="font-size:11px;color:#94a3b8">Что было должно быть сделано по ПДн в ${now.getFullYear()} году</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px;margin-bottom:16px">
          ${months.map((m,i) => {
            const monthDuties = duties.filter(d => d.month === i);
            const hasDuty = monthDuties.length > 0;
            const isDone = monthDuties.every(d => d.done);
            const isPast = i <= now.getMonth();
            let bg = 'rgba(255,255,255,0.03)', color = '#475569';
            if (hasDuty && isPast) { bg = isDone ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'; color = isDone ? '#34d399' : '#f87171'; }
            if (hasDuty && !isPast) { bg = 'rgba(251,191,36,0.12)'; color = '#fbbf24'; }
            return `<div style="padding:6px 4px;background:${bg};border-radius:6px;text-align:center;font-size:10px;font-weight:600;color:${color};position:relative" title="${monthDuties.map(d=>d.label).join(', ') || m}">${m}${hasDuty?`<div style="position:absolute;top:2px;right:2px;width:5px;height:5px;border-radius:50%;background:${color}"></div>`:''}
            </div>`;
          }).join('')}
        </div>
        <div style="display:grid;gap:6px">
          ${duties.sort((a,b)=>a.month-b.month).map(d => {
            const isPast = d.month <= now.getMonth();
            const statusColor = d.done ? '#34d399' : isPast ? '#f87171' : '#fbbf24';
            const statusText = d.done ? '✓ Выполнено' : isPast ? '✗ Просрочено' : '○ Предстоит';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,0.02);border-radius:6px;border-left:3px solid ${statusColor}">
              <div>
                <span style="font-size:12px;color:#e2e8f0">${d.label}</span>
                <span style="font-size:10px;color:#64748b;margin-left:8px">${months[d.month]}</span>
              </div>
              <span style="font-size:11px;font-weight:600;color:${statusColor}">${statusText}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- ОТЧЁТ О СОСТОЯНИИ ПДн (WORD) -->
      <div class="rc-card panel" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${ic('file-text',22)}
          </div>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:700;color:#f1f5f9">Отчёт о состоянии персональных данных</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Документ для руководителя — готовность к 152-ФЗ, риски, рекомендации</div>
          </div>
          <button onclick="generatePdReport(${clientId})" id="pdReportBtn" style="padding:10px 18px;background:linear-gradient(90deg,#059669,#34d399);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ${ic('save',14)} Сохранить Word
          </button>
        </div>
      </div>

    </div>
  `;

  window._rcPdData = { c, docs, emps, risks, score, probability, riskLabel, riskColor };
}

// Переключатель письма РКН
function toggleRknLetter() {
  const el = document.getElementById('rkn-letter');
  if (!el) return;
  const btn = el.previousElementSibling.querySelector('button');
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (btn) btn.textContent = 'Скрыть';
  } else {
    el.style.display = 'none';
    if (btn) btn.textContent = 'Показать';
  }
}

// ── ЦЕНТР ГОТОВНОСТИ: ВОИНСКИЙ УЧЁТ ─────────────────────────

async function renderVuReadiness(clientId) {
  const c    = await window.api.clientGet(clientId);
  const emps = await window.api.employeesList(clientId);
  const s    = await window.api.settingsGet();

  let vuData = {};
  try { vuData = JSON.parse(s[`vu_data_${clientId}`] || '{}'); } catch(_) {}

  const now = new Date();
  const vuEmps = emps.filter(e => e.vu_category);
  const vuCount = vuEmps.length;
  const hasBron = vuData.has_bronirowanie === true || vuData.has_bronirowanie === 'true';

  // Score ВУ — базовые проверки + доп. для бронирования
  const checks = {
    responsible: !!(vuData.responsible_name && vuData.order_number),
    plan:        !!(vuData.last_reconciliation),
    journal:     !!vuData.journal_started,
    regulation:  !!vuData.regulation_done,
    cards:       !!vuData.cards_filled,
    emps:        vuCount > 0 || emps.length === 0,
  };
  // Доп. проверки только для организаций с бронированием
  if (hasBron) {
    checks.bron_codes  = !!(vuData.bron_codes);
    checks.gov_organ   = !!(vuData.gov_organ);
  }

  const scorePct = Math.round(Object.values(checks).filter(Boolean).length / Object.keys(checks).length * 100);
  const scoreColor = scorePct >= 80 ? '#34d399' : scorePct >= 50 ? '#fbbf24' : '#f87171';

  // Риски ВУ — базовые
  const risks = [];
  if (!checks.responsible) risks.push({
    level: 'high', title: 'Не назначен ответственный за воинский учёт',
    law: 'п.12 Положения о ВУ (Пост. №719)', fine: 'до 500 000 ₽',
    fix: 'Оформить приказ о назначении во вкладке ВУ',
  });
  if (!checks.regulation) risks.push({
    level: 'high', title: 'Отсутствует положение о воинском учёте',
    law: 'п.39 Методических рекомендаций ГШ ВС РФ', fine: 'до 300 000 ₽',
    fix: 'Утвердить положение о ВУ',
  });
  if (!checks.journal) risks.push({
    level: 'medium', title: 'Не заведён журнал проверок воинского учёта',
    law: 'п.40 Методических рекомендаций ГШ ВС РФ', fine: 'до 100 000 ₽',
    fix: 'Завести журнал (шаблон — кнопка «Сгенерировать пакет»)',
  });
  if (emps.length > 0 && vuCount === 0) risks.push({
    level: 'medium', title: 'Данные о военнообязанных сотрудниках не заполнены',
    law: 'п.28 Положения о ВУ (Пост. №719)', fine: 'до 200 000 ₽',
    fix: 'Указать категорию ВУ в карточках сотрудников',
  });
  if (!checks.plan) risks.push({
    level: 'medium', title: 'Нет отметки о последней сверке с военкоматом',
    law: 'п.32 Положения о ВУ (Пост. №719)', fine: 'до 100 000 ₽',
    fix: 'Провести сверку и внести дату во вкладке ВУ',
  });
  if (!checks.cards) risks.push({
    level: 'low', title: 'Личные карточки (Т-2) не актуализированы',
    law: 'п.28 Положения о ВУ (Пост. №719)', fine: 'предупреждение',
    fix: 'Актуализировать карточки Т-2 для военнообязанных',
  });

  // Риски только для организаций с бронированием
  if (hasBron) {
    if (!checks.bron_codes) risks.push({
      level: 'high', title: 'Не указаны коды должностей для бронирования',
      law: 'п.11 Формы 18 (Письмо Минкультуры № 344-01-39-ВА)', fine: 'до 300 000 ₽',
      fix: 'Указать коды должностей из Перечня бронирования во вкладке ВУ',
    });
    if (!checks.gov_organ) risks.push({
      level: 'high', title: 'Не указан орган государственной власти для бронирования',
      law: 'п.13 Формы 18 (Письмо Минкультуры № 344-01-39-ВА)', fine: 'до 200 000 ₽',
      fix: 'Указать орган госвласти в блоке кодов вкладки ВУ',
    });
  }

  const totalFine = risks.filter(r => r.level === 'high').length * 300000
    + risks.filter(r => r.level === 'medium').length * 100000;

  const highRisks = risks.filter(r => r.level === 'high').length;
  let probability = Math.min(95, Math.max(5, 100 - scorePct + highRisks * 10));
  if (risks.length === 0) probability = 5;

  let riskLabel, riskColor;
  if (probability >= 70)      { riskLabel = 'ВЫСОКИЙ';  riskColor = '#f87171'; }
  else if (probability >= 40) { riskLabel = 'СРЕДНИЙ';  riskColor = '#fbbf24'; }
  else                        { riskLabel = 'НИЗКИЙ';   riskColor = '#34d399'; }

  const levelColor = l => l==='high'?'#f87171':l==='medium'?'#fbbf24':'#60a5fa';
  const levelLabel = l => l==='high'?'ВЫСОКИЙ':l==='medium'?'СРЕДНИЙ':'НИЗКИЙ';

  const content = document.getElementById('rc-mode-content');
  if (!content) return;

  // Чек-лист — базовый + доп. для бронирования
  const checklistItems = [
    { done: checks.responsible, label: 'Назначен ответственный (есть приказ о назначении)' },
    { done: checks.regulation,  label: 'Утверждено положение о воинском учёте' },
    { done: checks.journal,     label: 'Заведён журнал проверок воинского учёта' },
    { done: checks.cards,       label: 'Личные карточки Т-2 заполнены и актуальны' },
    { done: checks.emps,        label: 'Все военнообязанные сотрудники поставлены на учёт' },
    { done: checks.plan,        label: 'Проведена ежегодная сверка с военкоматом' },
  ];
  if (hasBron) {
    checklistItems.push({ done: checks.bron_codes, label: 'Коды должностей для бронирования заполнены (Форма 18 п.12)' });
    checklistItems.push({ done: checks.gov_organ,  label: 'Указан орган государственной власти (Форма 18 п.13)' });
  }

  // Симулятор — шаги с учётом бронирования
  const simSteps = [
    { label: 'Проверка наличия приказа о назначении ответственного',     ok: checks.responsible,  fine: '500 000 ₽' },
    { label: 'Проверка положения о воинском учёте',                       ok: checks.regulation,   fine: '300 000 ₽' },
    { label: 'Проверка журнала проверок воинского учёта',                 ok: checks.journal,      fine: '100 000 ₽' },
    { label: 'Проверка наличия карточек Т-2 на военнообязанных',          ok: checks.cards,        fine: '100 000 ₽' },
    { label: 'Сверка списков с данными военкомата',                       ok: checks.plan,         fine: '100 000 ₽' },
    { label: 'Проверка учёта призывников и запасников',                   ok: checks.emps,         fine: '200 000 ₽' },
  ];
  if (hasBron) {
    simSteps.push({ label: 'Проверка кодов должностей для бронирования (Форма 18 п.12)',   ok: checks.bron_codes, fine: '300 000 ₽' });
    simSteps.push({ label: 'Проверка органа госвласти для бронирования (Форма 18 п.13)',    ok: checks.gov_organ,  fine: '200 000 ₽' });
  }

  // Сохраняем для симулятора
  window._vuSimSteps = simSteps;

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- СИМУЛЯТОР ВОЕНКОМАТА -->
      <div class="rc-card panel" style="grid-column:1/-1">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">Что будет, если завтра проверка военкомата?</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Симуляция проверки воинского учёта в организации</div>
          </div>
          <button onclick="runVuSimulator(${clientId})" id="vuSimBtn" style="
            padding:11px 22px;background:linear-gradient(90deg,#7c3aed,#6d28d9);
            border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;
            cursor:pointer;white-space:nowrap;transition:opacity .15s"
            onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ▶ Запустить проверку
          </button>
        </div>
        <div id="vuSimResult"></div>
      </div>

      <!-- ИНДЕКС РИСКА -->
      <div class="rc-card panel">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">Индекс риска ВУ</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
          <div style="position:relative;width:80px;height:80px;flex-shrink:0">
            <svg viewBox="0 0 80 80" style="width:80px;height:80px;transform:rotate(-90deg)">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
              <circle cx="40" cy="40" r="32" fill="none" stroke="${riskColor}" stroke-width="10"
                stroke-dasharray="${2*Math.PI*32}" stroke-dashoffset="${2*Math.PI*32*(1-probability/100)}"
                stroke-linecap="round"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-size:18px;font-weight:800;color:${riskColor}">${probability}%</div>
            </div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--muted2);margin-bottom:4px">Вероятность нарушений</div>
            <div style="font-size:16px;font-weight:800;color:${riskColor}">${riskLabel}</div>
            <div style="font-size:11px;color:var(--muted2);margin-top:4px">Макс. штраф: ~${totalFine > 0 ? (totalFine/1000).toFixed(0)+'K ₽' : '—'}</div>
          </div>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="width:${scorePct}%;height:100%;background:${scoreColor};border-radius:3px;transition:width .8s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          <div style="font-size:11px;color:var(--muted2)">Готовность ВУ</div>
          <div style="font-size:11px;font-weight:700;color:${scoreColor}">${scorePct}%</div>
        </div>
      </div>

      <!-- СТАТИСТИКА УЧЁТА -->
      <div class="rc-card panel">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">Военнообязанные</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${[
            { val: emps.length, label: 'Всего сотрудников', color: '#94a3b8' },
            { val: vuCount,     label: 'На воинском учёте',  color: vuCount > 0 ? '#60a5fa' : '#475569' },
            { val: vuEmps.filter(e=>e.vu_category==='призывник').length,  label: 'Призывники',  color: '#f87171' },
            { val: vuEmps.filter(e=>e.vu_category==='запас').length,      label: 'Запас',        color: '#60a5fa' },
            { val: vuEmps.filter(e=>e.vu_category==='бронь').length,      label: 'Бронь',        color: '#34d399' },
            { val: vuEmps.filter(e=>e.vu_mobpredpisanie).length,          label: 'Мобпредписание', color: '#fbbf24' },
          ].map(s => `
            <div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;text-align:center">
              <div style="font-size:18px;font-weight:800;color:${s.color}">${s.val}</div>
              <div style="font-size:10px;color:var(--muted2);margin-top:2px">${s.label}</div>
            </div>`).join('')}
        </div>
      </div>

    </div>

    <!-- РИСКИ -->
    ${risks.length ? `
    <div class="rc-card panel" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Выявленные риски (${risks.length})
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${risks.map(r => `
          <div style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-left:3px solid ${levelColor(r.level)};border-radius:8px">
            <span style="font-size:9px;font-weight:800;color:${levelColor(r.level)};background:${levelColor(r.level)}18;padding:2px 6px;border-radius:4px;white-space:nowrap;margin-top:1px">${levelLabel(r.level)}</span>
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--text)">${r.title}</div>
              <div style="font-size:10px;color:var(--muted2);margin-top:3px">${r.law} · штраф ${r.fine}</div>
              <div style="font-size:10px;color:#60a5fa;margin-top:3px">→ ${r.fix}</div>
            </div>
            <div style="font-size:11px;font-weight:700;color:${levelColor(r.level)};white-space:nowrap">${r.fine}</div>
          </div>`).join('')}
      </div>
    </div>` : `
    <div class="rc-card panel" style="text-align:center;padding:28px;margin-bottom:16px">
      <div style="font-size:28px;margin-bottom:8px">✅</div>
      <div style="font-size:14px;font-weight:700;color:#34d399">Воинский учёт в порядке</div>
      <div style="font-size:12px;color:var(--muted2);margin-top:4px">Критических нарушений не выявлено</div>
    </div>`}

    <!-- ЧЕК-ЛИСТ -->
    <div class="rc-card panel">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">Чек-лист готовности к проверке</div>
      ${hasBron ? `<div style="font-size:11px;color:#fbbf24;margin-bottom:10px">⭐ Расширенный — включает проверки для организаций с бронированием</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:7px">
        ${checklistItems.map(item => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${item.done?'rgba(52,211,153,0.04)':'rgba(255,255,255,0.01)'};border:1px solid ${item.done?'rgba(52,211,153,0.15)':'rgba(255,255,255,0.05)'};border-radius:8px">
            ${item.done
              ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#00c853,#69f0ae);flex-shrink:0"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 5,9.5 10,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
              : `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.12);flex-shrink:0"></span>`}
            <span style="font-size:12px;color:${item.done?'#94a3b8':'#64748b'};${item.done?'text-decoration:line-through':''}">${item.label}</span>
          </div>`).join('')}
      </div>
    </div>`;

  // Переставляем активную вкладку на ВУ
  const btnVu = document.getElementById('rc-tab-vu');
  if (btnVu) {
    btnVu.style.background  = 'rgba(167,139,250,0.12)';
    btnVu.style.borderColor = 'rgba(167,139,250,0.5)';
    btnVu.style.color       = '#a78bfa';
  }
}

async function runVuSimulator(clientId) {
  const btn = document.getElementById('vuSimBtn');
  const result = document.getElementById('vuSimResult');
  if (!btn || !result) return;

  btn.textContent = '⏳ Проверка идёт...';
  btn.disabled = true;

  // Берём шаги из подготовленного массива (адаптированного под клиента)
  const steps = window._vuSimSteps || [];
  result.innerHTML = '';

  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 400));
    const st = steps[i];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;margin-bottom:6px;animation:typewriter .3s ease both;background:rgba(255,255,255,0.02)';
    row.innerHTML = `
      <span style="font-size:16px">${st.ok ? '✅' : '❌'}</span>
      <span style="flex:1;font-size:12px;color:${st.ok?'#94a3b8':'#f1f5f9'};${st.ok?'text-decoration:line-through':''}">${st.label}</span>
      ${!st.ok ? `<span style="font-size:11px;font-weight:700;color:#f87171;white-space:nowrap">штраф до ${st.fine}</span>` : ''}`;
    result.appendChild(row);
  }

  await new Promise(r => setTimeout(r, 400));
  const violations = steps.filter(s => !s.ok).length;
  const summary = document.createElement('div');
  summary.style.cssText = `margin-top:12px;padding:14px 16px;border-radius:10px;background:${violations===0?'rgba(52,211,153,0.08)':'rgba(248,113,113,0.08)'};border:1px solid ${violations===0?'rgba(52,211,153,0.2)':'rgba(248,113,113,0.2)'}`;
  summary.innerHTML = violations === 0
    ? `<div style="font-size:14px;font-weight:700;color:#34d399">✅ Нарушений не выявлено — организация готова к проверке!</div>`
    : `<div style="font-size:14px;font-weight:700;color:#f87171">⚠ Выявлено нарушений: ${violations}</div>
       <div style="font-size:12px;color:#94a3b8;margin-top:4px">Устраните нарушения во вкладке «Воинский учёт» карточки клиента</div>`;
  result.appendChild(summary);

  btn.textContent = '▶ Запустить снова';
  btn.disabled = false;
}

// Анимированный симулятор проверки РКН с бегунком
async function runRknSimulator(clientId) {
  const c = window._rcPdData?.c || await window.api.clientGet(clientId);
  const docs = window._rcPdData?.docs || (await window.api.documentsList(clientId)).filter(d => d.module === 'PD');
  const emps = window._rcPdData?.emps || await window.api.employeesList(clientId);
  const risks = window._rcPdData?.risks || [];

  const btn = document.getElementById('rknSimBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = '⏳ Идёт проверка...'; }

  const result = document.getElementById('rkn-sim-result');
  if (!result) return;

  // Контейнер для анимации
  result.innerHTML = `
    <div id="rkn-step-box" style="min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.06)">
      <div id="rkn-step-icon" style="font-size:32px;margin-bottom:12px;transition:opacity .4s">🏛️</div>
      <div id="rkn-step-text" style="font-size:14px;font-weight:600;color:#f1f5f9;text-align:center;margin-bottom:16px;transition:opacity .4s;min-height:20px"></div>
      <div style="width:100%;max-width:340px">
        <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden">
          <div id="rkn-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa);border-radius:2px;transition:width 2.8s linear"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          <div id="rkn-progress-label" style="font-size:10px;color:#475569"></div>
          <div id="rkn-step-status" style="font-size:11px;font-weight:600"></div>
        </div>
      </div>
    </div>
    <div id="rkn-log" style="margin-top:12px;display:flex;flex-direction:column;gap:4px"></div>
  `;

  const iconEl   = document.getElementById('rkn-step-icon');
  const textEl   = document.getElementById('rkn-step-text');
  const barEl    = document.getElementById('rkn-progress-bar');
  const labelEl  = document.getElementById('rkn-progress-label');
  const statusEl = document.getElementById('rkn-step-status');
  const logEl    = document.getElementById('rkn-log');

  const steps = [
    { icon:'🏛️', text:'Инспектор РКН входит в организацию...', duration:3000, status:null },
    { icon:'📋', text:'Запрашиваю реестр операторов ПДн...', duration:3000,
      status: c.pd_notified_rkn ? 'ok' : 'error',
      result: c.pd_notified_rkn
        ? `✅ ${c.name} найдена в реестре · дата: ${c.pd_notification_date||'не указана'}`
        : `❌ ${c.name} не найдена в реестре операторов!` },
    { icon:'📄', text:'Запрашиваю документацию по ПДн...', duration:3000,
      status: docs.find(d=>d.name.includes('Политика')) ? 'ok' : 'error',
      result: docs.find(d=>d.name.includes('Политика'))
        ? `✅ Политика обработки ПДн — обнаружена (${docs.length} документов)`
        : `❌ Политика обработки ПДн — отсутствует` },
    { icon:'👤', text:'Проверяю назначение ответственного...', duration:3000,
      status: c.pd_responsible_name ? 'ok' : 'error',
      result: c.pd_responsible_name
        ? `✅ Ответственный: ${c.pd_responsible_name} — назначен`
        : `❌ Ответственный за ПДн — не назначен` },
    { icon:'🖥️', text:'Проверяю регистрацию ИСПДн...', duration:3000,
      status: (c.pd_ispdn_list||[]).length>0 ? 'ok' : 'warn',
      result: (c.pd_ispdn_list||[]).length>0
        ? `✅ ИСПДн: ${(c.pd_ispdn_list||[]).map(i=>i.name||i).join(', ')}`
        : `⚠️ Информационные системы ПД не указаны` },
    { icon:'✍️', text:'Проверяю согласия сотрудников...', duration:3000,
      status: emps.length===0 ? 'warn' : 'ok',
      result: emps.length===0
        ? `⚠️ Сотрудники не добавлены в систему`
        : `✅ Сотрудников: ${emps.length} чел.` },
    { icon:'📝', text:'Составляю протокол проверки...', duration:3000, status:null },
  ];

  const statusColors = { ok:'#34d399', error:'#f87171', warn:'#fbbf24' };
  const statusLabels = { ok:'✓ OK', error:'✗ Нарушение', warn:'⚠ Замечание' };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fadeOut = el => { el.style.opacity='0'; return sleep(400); };
  const fadeIn  = el => { el.style.opacity='0'; void el.offsetWidth; setTimeout(()=>el.style.opacity='1',50); };

  for (let i=0; i<steps.length; i++) {
    const step = steps[i];

    // Fade in нового текста
    await fadeOut(iconEl);
    await fadeOut(textEl);
    iconEl.style.transition = 'opacity .4s';
    textEl.style.transition = 'opacity .4s';
    iconEl.textContent = step.icon;
    textEl.textContent = step.text;
    statusEl.textContent = '';
    labelEl.textContent = `Шаг ${i+1} из ${steps.length}`;
    fadeIn(iconEl);
    fadeIn(textEl);

    // Бегунок
    barEl.style.transition = 'none';
    barEl.style.width = '0%';
    void barEl.offsetWidth;
    barEl.style.transition = `width ${step.duration - 200}ms linear`;
    await sleep(50);
    barEl.style.width = '95%';

    await sleep(step.duration - 400);

    // Бегунок завершается
    barEl.style.transition = 'width .3s ease';
    barEl.style.width = '100%';
    if (step.status) {
      barEl.style.background = `linear-gradient(90deg,${statusColors[step.status]}99,${statusColors[step.status]})`;
      statusEl.style.color = statusColors[step.status];
      statusEl.textContent = statusLabels[step.status];
    }
    await sleep(400);

    // Добавляем строку в лог если есть результат
    if (step.result) {
      const logLine = document.createElement('div');
      logLine.style.cssText = `padding:7px 12px;border-radius:8px;font-size:12px;color:${step.status?statusColors[step.status]:'#94a3b8'};background:rgba(255,255,255,0.02);border-left:3px solid ${step.status?statusColors[step.status]:'rgba(255,255,255,0.1)'};opacity:0;transition:opacity .3s`;
      logLine.textContent = step.result;
      logEl.appendChild(logLine);
      void logLine.offsetWidth;
      logLine.style.opacity = '1';
    }

    // Сброс цвета бегунка для следующего шага
    barEl.style.background = 'linear-gradient(90deg,#60a5fa,#a78bfa)';
    await sleep(200);
  }

  // Финальный fade out анимации
  await fadeOut(iconEl);
  await fadeOut(textEl);
  document.getElementById('rkn-step-box').style.display = 'none';

  // Протокол
  await sleep(300);
  const errorCount = risks.filter(r=>r.level==='high').length;
  const warnCount  = risks.filter(r=>r.level==='medium').length;

  const protocol = document.createElement('div');
  protocol.style.cssText = 'margin-top:16px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;opacity:0;transition:opacity .5s';
  protocol.innerHTML = `
    <div style="padding:14px 16px;background:${errorCount>0?'rgba(248,113,113,0.1)':'rgba(52,211,153,0.1)'};border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:14px;font-weight:700;color:#f1f5f9">📋 ПРОТОКОЛ ПРОВЕРКИ РКН</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">${c.name} · ${new Date().toLocaleDateString('ru-RU')} · Автоматическая проверка</div>
    </div>
    <div style="padding:14px 16px">
      ${risks.length === 0
        ? `<div style="color:#34d399;font-size:13px;padding:10px 0">✅ Нарушений не выявлено. Организация соответствует требованиям 152-ФЗ.</div>`
        : risks.map((r,i) => `
          <div style="padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.02);border-left:3px solid ${r.level==='high'?'#f87171':'#fbbf24'};border-radius:6px">
            <div style="font-size:12px;font-weight:600;color:#f1f5f9">${i+1}. ${r.title}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px">${r.law} · Санкция: ${r.fine}</div>
            <div style="font-size:11px;color:#60a5fa;margin-top:2px">→ ${r.fix}</div>
          </div>`).join('')}
      <div style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.02);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12px;color:#94a3b8">Нарушений: <strong style="color:#f87171">${errorCount}</strong> критичных · <strong style="color:#fbbf24">${warnCount}</strong> средних</div>
        ${risks.length>0?`<div style="font-size:12px;font-weight:600;color:#fbbf24">Срок устранения: 30 дней</div>`:''}
      </div>
    </div>
  `;
  result.appendChild(protocol);
  void protocol.offsetWidth;
  protocol.style.opacity = '1';

  if (btn) { btn.disabled=false; btn.style.opacity='1'; btn.textContent='↺ Повторить'; }
}

// Генерация Word-отчёта о состоянии ПДн
async function generatePdReport(clientId) {
  const btn = document.getElementById('pdReportBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Формирую...'; }
  try {
    const d = window._rcPdData;
    if (!d) { showToast('Сначала откройте раздел ПДн', 'var(--amber)'); return; }
    const { c, docs, emps, risks, score, probability, riskLabel } = d;
    const today = new Date().toLocaleDateString('ru-RU');

    const data = {
      title: `Отчёт о состоянии обработки персональных данных`,
      subtitle: `${c.name} · ${today}`,
      rows: [
        { cells: [{ text: 'ОБЩАЯ ИНФОРМАЦИЯ', bold: true, colspan: 2 }] },
        { cells: [{ text: 'Организация' }, { text: c.name }] },
        { cells: [{ text: 'ИНН' }, { text: c.inn || '—' }] },
        { cells: [{ text: 'Ответственный за ПДн' }, { text: c.pd_responsible_name || 'Не назначен' }] },
        { cells: [{ text: 'РКН уведомлена' }, { text: c.pd_notified_rkn ? `Да (${c.pd_notification_date||'дата не указана'})` : 'Нет' }] },
        { cells: [{ text: 'ИСПДн' }, { text: (c.pd_ispdn_list||[]).map(i=>i.name||i).join(', ') || 'Не указаны' }] },
        { cells: [{ text: '' }, { text: '' }] },
        { cells: [{ text: 'ОЦЕНКА ГОТОВНОСТИ', bold: true, colspan: 2 }] },
        { cells: [{ text: 'Общий score' }, { text: `${score}% (${score>=80?'Высокий':score>=40?'Средний':'Низкий'} уровень)` }] },
        { cells: [{ text: 'Документы ПДн' }, { text: `${docs.length} документов` }] },
        { cells: [{ text: 'Сотрудников' }, { text: `${emps.length} чел.` }] },
        { cells: [{ text: 'Индекс риска РКН' }, { text: `${probability}% — ${riskLabel}` }] },
        { cells: [{ text: '' }, { text: '' }] },
        { cells: [{ text: 'ВЫЯВЛЕННЫЕ НАРУШЕНИЯ', bold: true, colspan: 2 }] },
        ...( risks.length === 0
          ? [{ cells: [{ text: 'Нарушений не выявлено', colspan: 2 }] }]
          : risks.map((r,i) => ({ cells: [{ text: `${i+1}. ${r.title}` }, { text: `${r.law} · ${r.fine}` }] }))
        ),
        { cells: [{ text: '' }, { text: '' }] },
        { cells: [{ text: 'РЕКОМЕНДАЦИИ', bold: true, colspan: 2 }] },
        ...( risks.length === 0
          ? [{ cells: [{ text: 'Продолжать поддерживать текущий уровень соответствия', colspan: 2 }] }]
          : risks.map((r,i) => ({ cells: [{ text: `${i+1}.` }, { text: r.fix }] }))
        ),
        { cells: [{ text: '' }, { text: '' }] },
        { cells: [{ text: `Отчёт подготовлен: ${today}`, colspan: 2 }] },
      ],
      filename: `Отчёт_ПДн_${c.name.replace(/[^а-яёa-z0-9]/gi,'_').slice(0,30)}_${today.replace(/\./g,'-')}`
    };

    const result = await window.api.docxGenerate(data);
    if (result?.ok) {
      showToast('✅ Отчёт сохранён в Word', 'var(--green)');
      if (result.path) window.api.docsOpenFile(result.path);
    } else {
      showToast('Ошибка при создании отчёта', 'var(--red)');
    }
  } catch(e) {
    showToast('Ошибка: ' + e.message, 'var(--red)');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = ic('save',14) + ' Сохранить Word'; }
  }
}

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
