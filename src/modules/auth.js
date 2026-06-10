// ============================================================
// КОМПЛАЕНСПРО — auth.js
// Лицензия, триал, PIN, автообновление, админ-доступ
// Выделен из app.js, версия 08.06.2026
// ============================================================

// ---------- ЛИЦЕНЗИЯ И ДОСТУП ----------

var LICENSE = {
  type:        'OUTSOURCE',
  modules:     ['OT','PD','VU'],
  max_clients: 999,
  size:        null,
  expires_at:  '2030-01-01',
  active:      true,
  key:         'DEV-MODE',
};

var IS_ADMIN = false;

function checkAccess(module) {
  if (!LICENSE.active) return false;
  if (new Date(LICENSE.expires_at) < new Date()) return false;
  return LICENSE.modules.includes(module) || LICENSE.modules.includes('ALL');
}

function checkClientLimit(currentCount) {
  if (LICENSE.type === 'OUTSOURCE') return currentCount < LICENSE.max_clients;
  if (LICENSE.type === 'SOLO') return currentCount < 1;
  return true;
}

function showModuleLocked(moduleName) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px">
      <div style="width:64px;height:64px;border-radius:18px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center">${ic('lock',28)}</div>
      <div style="font-size:18px;font-weight:700;color:var(--text)">Модуль недоступен</div>
      <div style="font-size:13px;color:var(--muted);text-align:center;max-width:320px">Модуль <strong>${moduleName}</strong> не включён в ваш тариф.<br>Для подключения свяжитесь с поставщиком.</div>
      <div style="padding:10px 20px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);border-radius:10px;font-size:12px;color:#60a5fa">Текущий тариф: <strong>${LICENSE.type === 'OUTSOURCE' ? 'Аутсорсер' : 'Своя организация'}</strong></div>
    </div>`;
}

function showClientLimitReached() {
  const limit = LICENSE.type === 'SOLO' ? '1 организация' : `${LICENSE.max_clients} клиентов`;
  showToast(`Лимит тарифа: ${limit}. Для расширения свяжитесь с поставщиком.`, 'var(--amber)');
}

// ---------- АДМИН-РЕЖИМ ----------

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
      <input id="admin-pwd-input" type="password" class="form-input" placeholder="Пароль администратора" onkeydown="if(event.key==='Enter') submitAdminLogin()">
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
  const err = document.getElementById('admin-pwd-error');
  if (!input) return;
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
// ---------- АВТООБНОВЛЕНИЕ (UI) ----------

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
        <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:4px">Доступна версия ${version}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px">Обновление улучшает стабильность и добавляет новые функции</div>
        <div id="update-progress-bar-wrap" style="display:none;background:rgba(255,255,255,0.05);border-radius:4px;height:4px;margin-bottom:8px;overflow:hidden">
          <div id="update-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#2563eb,#7c3aed);transition:width 0.3s"></div>
        </div>
        <div id="update-progress-text" style="display:none;font-size:11px;color:#60a5fa;margin-bottom:8px"></div>
        <div style="display:flex;gap:8px">
          <button id="update-now-btn" style="flex:1;padding:8px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer">⬇️ Обновить</button>
          <button id="update-later-btn" style="padding:8px 12px;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#64748b;font-size:12px;cursor:pointer">Позже</button>
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
        <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:4px">Обновление готово к установке</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px">Установится автоматически при следующем запуске</div>
        <button id="update-install-btn" style="width:100%;padding:8px;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);border-radius:8px;color:#34d399;font-size:12px;font-weight:700;cursor:pointer">🔄 Перезапустить сейчас</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  document.getElementById('update-install-btn').onclick = async () => {
    await window.api.updateInstall();
  };
}

// ---------- ТРИАЛ И ЛИЦЕНЗИЯ ----------

async function activateLicensePublic() {
  const key    = document.getElementById('lic-key-public')?.value?.trim();
  const expire = document.getElementById('lic-expire-public')?.value?.trim();
  const errEl  = document.getElementById('lic-public-error');

  if (!key)    { errEl.textContent = 'Введите лицензионный ключ'; return; }
  if (!expire) { errEl.textContent = 'Введите дату окончания (например: 2027-06-06)'; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) { errEl.textContent = 'Формат даты: ГГГГ-ММ-ДД'; return; }

  const result = await window.api.licenseActivate(key, expire);
  if (!result.ok) { errEl.textContent = result.error || 'Неверный ключ или ключ от другого устройства.'; return; }

  LICENSE.key = key; LICENSE.expires_at = expire; LICENSE.active = true;
  LICENSE.type = result.type || 'OUTSOURCE'; LICENSE.modules = ['OT', 'PD', 'VU'];

  document.getElementById('trial-badge')?.remove();
  errEl.textContent = '';
  showToast(`✅ Лицензия активирована до ${new Date(expire).toLocaleDateString('ru-RU')}`, 'var(--green)', 5000);
  setTimeout(() => renderSettings(), 800);
}

async function activateLicenseFromSettings() {
  const key    = document.getElementById('lic-key-input')?.value?.trim();
  const expire = document.getElementById('lic-expire-input')?.value?.trim();

  if (!key)    { showToast('Введите лицензионный ключ', 'var(--red)'); return; }
  if (!expire) { showToast('Введите дату окончания (например: 2027-06-06)', 'var(--red)'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) { showToast('Формат даты: ГГГГ-ММ-ДД', 'var(--red)'); return; }

  const result = await window.api.licenseActivate(key, expire);
  if (!result.ok) { showToast(result.error || 'Неверный ключ или ключ от другого устройства', 'var(--red)'); return; }

  LICENSE.key = key; LICENSE.expires_at = expire; LICENSE.active = true;
  LICENSE.type = result.type || 'OUTSOURCE'; LICENSE.modules = ['OT', 'PD', 'VU'];

  document.getElementById('trial-badge')?.remove();
  showToast(`✅ Лицензия активирована до ${new Date(expire).toLocaleDateString('ru-RU')}`, 'var(--green)', 5000);
  setTimeout(() => renderSettings(), 800);
}

async function checkTrialOnStartup() {
  if (!window.api.trialStatus) return;
  const trial = await window.api.trialStatus();

  if (trial.status === 'licensed') {
    if (trial.daysLeft !== null && trial.daysLeft <= 14) {
      showTrialBadge(trial.daysLeft, 'license');
      if (trial.daysLeft <= 3) showToast(`⚠️ Лицензия истекает через ${trial.daysLeft} дн.`, 'var(--red)', 8000);
      else if (trial.daysLeft <= 7) showToast(`Лицензия истекает через ${trial.daysLeft} дней`, 'var(--amber)', 5000);
    }
    return;
  }
  if (trial.status === 'wrong_machine') { showToast('⚠️ Лицензия привязана к другому устройству.', 'var(--red)', 8000); return; }
  if (trial.status === 'subscription_expired') { await showExpiredScreen(trial.machineId, 'subscription'); return; }
  if (trial.status === 'expired') { await showExpiredScreen(trial.machineId, 'trial'); return; }
  if (trial.status === 'trial') {
    window.__TRIAL_MAX_CLIENTS = trial.maxClients || 2;
    showTrialBadge(trial.daysLeft, 'trial');
    if (trial.daysLeft <= 3) showToast(`🔴 Пробный период истекает через ${trial.daysLeft} дн.`, 'var(--red)', 8000);
    else if (trial.daysLeft <= 7) showToast(`Пробный период: осталось ${trial.daysLeft} дней`, 'var(--amber)', 5000);
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
  badge.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9000;background:rgba(15,23,42,0.97);border:1px solid ${color};border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:pointer`;
  badge.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div><div><div style="font-size:11px;color:#94a3b8;line-height:1">${label}</div><div style="font-size:13px;font-weight:700;color:${color}">осталось ${days}</div></div><div style="font-size:11px;color:#60a5fa;margin-left:4px">${action}</div>`;
  badge.onclick = () => { navigate('settings'); setTimeout(() => document.getElementById('s-license')?.scrollIntoView({ behavior: 'smooth' }), 300); };
  document.body.appendChild(badge);
}

function showExpiredScreen(machineId, type) {
  return new Promise(resolve => {
    document.getElementById('expired-overlay')?.remove();
    const isTrial = type === 'trial';

    const overlay = document.createElement('div');
    overlay.id = 'expired-overlay';
    overlay.style.cssText = `position:fixed;inset:0;z-index:99998;background:linear-gradient(135deg,#080c14 0%,#0d1520 100%);display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;overflow-y:auto`;
    overlay.innerHTML = `
      <div style="text-align:center;max-width:500px;width:100%;padding:20px 0">
        <div style="font-size:52px;margin-bottom:16px">${isTrial ? '⏰' : '📅'}</div>
        <h2 style="font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:10px">${isTrial ? 'Пробный период завершён' : 'Срок подписки истёк'}</h2>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin-bottom:24px">${isTrial ? 'Вы пользовались программой бесплатно 14 дней.<br>Все ваши данные сохранены.<br>Для продолжения работы приобретите лицензию.' : 'Ваша лицензия истекла.<br>Данные сохранены — продлите подписку чтобы продолжить.'}</p>

        <div style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.3);border-radius:12px;padding:16px;margin-bottom:20px">
          <div style="font-size:11px;color:#64748b;margin-bottom:6px">ВАШ ID УСТРОЙСТВА — сообщите его специалисту</div>
          <div style="font-size:24px;font-weight:800;color:#60a5fa;font-family:monospace;letter-spacing:3px;margin-bottom:10px">${machineId || '...'}</div>
          <button onclick="navigator.clipboard.writeText('${machineId||''}').then(()=>showToast('ID скопирован ✓','var(--green)',2000))" style="background:rgba(37,99,235,0.2);border:1px solid rgba(37,99,235,0.3);border-radius:8px;padding:6px 16px;color:#60a5fa;font-size:12px;cursor:pointer">📋 Скопировать ID</button>
        </div>

        <input id="exp-key" type="text" placeholder="KP-XXXXXXXXXXXXXXXXXXXXXXXX" style="width:100%;padding:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;font-family:monospace;outline:none;box-sizing:border-box;margin-bottom:8px">
        <input id="exp-expire" type="text" placeholder="Дата окончания: 2027-06-06" style="width:100%;padding:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:8px">
        <div id="exp-error" style="color:#f87171;font-size:12px;min-height:18px;margin-bottom:8px"></div>
        <button id="exp-btn" style="width:100%;padding:13px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;cursor:pointer">🔑 Активировать лицензию</button>
        <div style="margin-top:12px;text-align:center">
          <button onclick="startDemoFromExpired()" style="background:transparent;border:none;color:#475569;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;transition:color .15s"
            onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#475569'">
            или начать с примером данных →
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('exp-btn').onclick = async () => {
      const key = document.getElementById('exp-key').value.trim();
      const expire = document.getElementById('exp-expire').value.trim();
      const errEl = document.getElementById('exp-error');
      const btn = document.getElementById('exp-btn');

      if (!key) { errEl.textContent = 'Введите ключ'; return; }
      if (!expire) { errEl.textContent = 'Введите дату окончания'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) { errEl.textContent = 'Формат даты: ГГГГ-ММ-ДД'; return; }

      btn.textContent = 'Проверяем...'; btn.disabled = true;
      const result = await window.api.licenseActivate(key, expire);
      if (result.ok) {
        overlay.style.transition = 'opacity 0.3s'; overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); document.getElementById('trial-badge')?.remove(); showToast('✅ Лицензия активирована! Добро пожаловать.', 'var(--green)', 5000); resolve(true); }, 300);
      } else {
        errEl.textContent = result.error || 'Неверный ключ или ключ от другого устройства';
        btn.textContent = '🔑 Активировать лицензию'; btn.disabled = false;
      }
    };
  });
}
// ─── ЗАПУСК ДЕМО-РЕЖИМА ──────────────────────────────────
function startDemoFromExpired() {
  document.getElementById('expired-overlay')?.remove();
  if (typeof initDemoMode === 'function') {
    initDemoMode();
  } else {
    showToast('Демо-режим недоступен', 'var(--red)');
  }
}
