// ============================================================
// КОМПЛАЕНСПРО — settings-page.js
// Страница настроек: AI-провайдеры, Telegram, бэкапы
// Декомпозиция app.js — батч 3, 10.06.2026
// ============================================================

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
