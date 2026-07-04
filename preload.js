const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Клиенты
  clientsList:    ()          => ipcRenderer.invoke('clients:list'),
  clientGet:      (id)        => ipcRenderer.invoke('clients:get', id),
  clientAdd:      (data)      => ipcRenderer.invoke('clients:add', data),
  clientUpdate:   (id, data)  => ipcRenderer.invoke('clients:update', id, data),
  clientDelete:   (id)        => ipcRenderer.invoke('clients:delete', id),

  // Подразделения
  divisionsList:  (cid)       => ipcRenderer.invoke('divisions:list', cid),
  divisionsAdd:   (data)      => ipcRenderer.invoke('divisions:add', data),
  divisionsUpdate:(id, data)  => ipcRenderer.invoke('divisions:update', id, data),
  divisionsDelete:(id)        => ipcRenderer.invoke('divisions:delete', id),

  // Сотрудники
  employeesList:  (cid)       => ipcRenderer.invoke('employees:list', cid),
  employeesListAll: ()        => ipcRenderer.invoke('employees:list-all'),
  employeeAdd:    (data)      => ipcRenderer.invoke('employees:add', data),
  employeeDelete: (id)        => ipcRenderer.invoke('employees:delete', id),
  employeeUpdate: (id, data)  => ipcRenderer.invoke('employees:update', id, data),
  employeesPickImportFile: ()          => ipcRenderer.invoke('employees:pick-import-file'),
  employeesReadImportFile: (filePath)  => ipcRenderer.invoke('employees:read-import-file', filePath),
  employeesImport:         (cid, rows, resolutions) => ipcRenderer.invoke('employees:import', cid, rows, resolutions),
  employeesDownloadTemplate: ()        => ipcRenderer.invoke('employees:download-template'),
  clientGetImportMapping:  (cid)          => ipcRenderer.invoke('clients:get-import-mapping', cid),
  clientSaveImportMapping: (cid, mapping) => ipcRenderer.invoke('clients:save-import-mapping', cid, mapping),
  trainingGet:    (id)        => ipcRenderer.invoke('training:get', id),
  trainingUpdate: (id, data)  => ipcRenderer.invoke('training:save', id, data),
  trainingAlerts: ()          => ipcRenderer.invoke('training:alerts'),

  // Документы
  documentsList:  (cid)       => ipcRenderer.invoke('documents:list', cid),
  documentsListAll: ()        => ipcRenderer.invoke('documents:list-all'),
  documentAdd:    (data)      => ipcRenderer.invoke('documents:add', data),
  documentStatus: (id, s)     => ipcRenderer.invoke('documents:update-status', id, s),

  // События
  eventsList:     (cid)       => ipcRenderer.invoke('events:list', cid),
  eventAdd:       (data)      => ipcRenderer.invoke('events:add', data),

  // Задачи
  tasksList:      ()          => ipcRenderer.invoke('tasks:list'),
  taskAdd:        (data)      => ipcRenderer.invoke('tasks:add', data),
  taskToggle:     (id)        => ipcRenderer.invoke('tasks:toggle', id),
  taskDelete:     (id)        => ipcRenderer.invoke('tasks:delete', id),

  // Настройки
  settingsGet:    ()          => ipcRenderer.invoke('settings:get'),
  settingsSave:   (data)      => ipcRenderer.invoke('settings:save', data),

  // Telegram и автозапуск
  telegramBind:    (token)    => ipcRenderer.invoke('telegram:bind', token),
  appSetAutostart: (enabled)  => ipcRenderer.invoke('app:setAutostart', enabled),

  // Мониторинг НПА
  npaList:         (module)   => ipcRenderer.invoke('npa:list', module),
  npaMarkSeen:      (id)      => ipcRenderer.invoke('npa:markSeen', id),
  npaCheckNow:      ()        => ipcRenderer.invoke('npa:checkNow'),

  // Статистика
  dashboardStats: ()          => ipcRenderer.invoke('stats:dashboard'),

  // Резервное копирование
  backupNow:      ()          => ipcRenderer.invoke('backup:now'),
  backupChooseFolder: ()      => ipcRenderer.invoke('backup:choose-folder'),

  // Генерация документов
  docsGenerate:   (clientId, scope) => ipcRenderer.invoke('docs:generate', clientId, scope),
  docsOpenFolder: (dir)       => ipcRenderer.invoke('docs:open-folder', dir),
  docsOpenFile:   (filepath)  => ipcRenderer.invoke('docs:open-file', filepath),
  vuGenerateReports: (clientId, docs) => ipcRenderer.invoke('vu:generate-reports', clientId, docs),

  // PDF (паспорт безопасности и др.)
  pdfGenerate:    (data)      => ipcRenderer.invoke('pdf:generate', data),

  // Word / DOCX (справки, протоколы)
  docxGenerate:   (data)      => ipcRenderer.invoke('docx:generate', data),

  // AI / Ассистент
  aiRequest:      (data)      => ipcRenderer.invoke('ai:request', data),

  // Центр обучения — реестр удостоверений
  certsList:      (clientId)      => ipcRenderer.invoke('certs:list', clientId),
  certsAdd:       (data)          => ipcRenderer.invoke('certs:add', data),
  certsUpdate:    (id, data)      => ipcRenderer.invoke('certs:update', id, data),
  certsDelete:    (id)            => ipcRenderer.invoke('certs:delete', id),

  // Аддоны (дополнительные платные модули: TRAINING, FLEET, PASF)
  addonActivate:  (key, expire, type) => ipcRenderer.invoke('addon:activate', key, expire, type),
  addonStatus:    ()              => ipcRenderer.invoke('addon:status'),

  // Комиссия по проверке знаний
  commissionGet:             (clientId)                    => ipcRenderer.invoke('commission:get', clientId),
  generateCommissionOrder:   (clientId, orderNum, orderDate) => ipcRenderer.invoke('docs:generateCommissionOrder', clientId, orderNum, orderDate),

  // СОУТ
  soutGet:        (clientId)          => ipcRenderer.invoke('sout:get', clientId),
  soutSave:       (clientId, data)    => ipcRenderer.invoke('sout:save', clientId, data),
  soutGenerate:   (clientId, data)    => ipcRenderer.invoke('sout:generate', clientId, data),

  // Утилиты
  openExternal:   (url)       => ipcRenderer.invoke('open-external', url),

  // PIN-код
  pinCheck:       (pin)       => ipcRenderer.invoke('pin:check', pin),
  pinSet:         (pin)       => ipcRenderer.invoke('pin:set', pin),
  pinStatus:      ()          => ipcRenderer.invoke('pin:status'),

  // Автообновление
  updateDownload:  ()   => ipcRenderer.invoke('update:download'),
  updateInstall:   ()   => ipcRenderer.invoke('update:install'),
  onUpdateAvailable:  (cb) => ipcRenderer.on('update:available',  (_, d) => cb(d)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update:progress',   (_, d) => cb(d)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', ()     => cb()),

  // Триал и лицензия
  trialStatus:    ()                    => ipcRenderer.invoke('trial:status'),
  licenseActivate:(key, expire)         => ipcRenderer.invoke('license:activate', key, expire),
  machineId:      ()                    => ipcRenderer.invoke('machine:id'),
  trialReset:     ()                    => ipcRenderer.invoke('trial:reset'),
});
