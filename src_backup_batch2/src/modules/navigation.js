// ============================================================
// КОМПЛАЕНСПРО — navigation.js
// Навигация и обновление счётчиков
// Выделен из app.js, версия 08.06.2026
// ============================================================

async function navigate(page, clientId = null) {
  currentPage = page;
  currentClientId = clientId;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  const btn = document.getElementById('topbarAction');
  btn.style.display = 'none';
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