const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Клиенты
  clientsList:    ()          => ipcRenderer.invoke('clients:list'),
  clientGet:      (id)        => ipcRenderer.invoke('clients:get', id),
  clientAdd:      (data)      => ipcRenderer.invoke('clients:add', data),
  clientUpdate:   (id, data)  => ipcRenderer.invoke('clients:update', id, data),
  clientDelete:   (id)        => ipcRenderer.invoke('clients:delete', id),

  // Сотрудники
  employeesList:  (cid)       => ipcRenderer.invoke('employees:list', cid),
  employeeAdd:    (data)      => ipcRenderer.invoke('employees:add', data),
  employeeDelete: (id)        => ipcRenderer.invoke('employees:delete', id),

  // Документы
  documentsList:  (cid)       => ipcRenderer.invoke('documents:list', cid),
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

  // Статистика
  dashboardStats: ()          => ipcRenderer.invoke('stats:dashboard'),

  // Резервное копирование
  backupNow:      ()          => ipcRenderer.invoke('backup:now'),
  backupChooseFolder: ()      => ipcRenderer.invoke('backup:choose-folder'),

  // Генерация документов
  docsGenerate:   (clientId)  => ipcRenderer.invoke('docs:generate', clientId),
  docsOpenFolder: (dir)       => ipcRenderer.invoke('docs:open-folder', dir),
docsOpenFile:  (filepath) => ipcRenderer.invoke('docs:open-file', filepath),
  // Утилиты
  openExternal:   (url)       => ipcRenderer.invoke('open-external', url),
});
