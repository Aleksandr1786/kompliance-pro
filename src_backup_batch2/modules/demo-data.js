// ============================================================
// КОМПЛАЕНСПРО — demo-data.js
// Реалистичные демо-данные для интерактивного тура
// ============================================================

const DEMO_DATA = (() => {
  const today = new Date();
  const d = (daysOffset) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + daysOffset);
    return dt.toISOString().slice(0, 10);
  };

  // ─── КЛИЕНТЫ ─────────────────────────────────────────────
  const clients = [
    {
      id: 1,
      name: 'ООО «СтройГрупп»',
      inn: '2315123456',
      form: 'ООО',
      okved: '41.20',
      staff: 12,
      region: 'Краснодарский край',
      city: 'Новороссийск',
      address: 'г. Новороссийск, ул. Строителей, д. 14',
      phone: '+7 861 200-01-01',
      manager_position: 'Генеральный директор',
      manager_name: 'Громов Андрей Петрович',
      ot_position: 'Специалист по ОТ',
      ot_name: 'Семёнов Виктор Алексеевич',
      soat_class: '31',
      hazard_works: true,
      medcheck_required: true,
      modules: 'OT,PD,VU',
      color: '#f87171',
      score: 62,
      order_prefix: 1,
      archived: 0,
      created_at: new Date(today.getFullYear(), today.getMonth() - 3, 15).toISOString(),
    },
    {
      id: 2,
      name: 'ИП Морозова Е.В.',
      inn: '231519998877',
      form: 'ИП',
      okved: '47.11',
      staff: 3,
      region: 'Краснодарский край',
      city: 'Новороссийск',
      address: 'г. Новороссийск, ул. Советов, д. 38, офис 5',
      phone: '+7 861 300-02-02',
      manager_position: 'Индивидуальный предприниматель',
      manager_name: 'Морозова Елена Викторовна',
      ot_position: '',
      ot_name: '',
      soat_class: '2',
      hazard_works: false,
      medcheck_required: false,
      modules: 'OT,PD',
      color: '#60a5fa',
      score: 88,
      order_prefix: 1,
      archived: 0,
      created_at: new Date(today.getFullYear(), today.getMonth() - 1, 5).toISOString(),
    }
  ];

  // ─── ПОДРАЗДЕЛЕНИЯ ───────────────────────────────────────
  const divisions = [
    { id: 1, client_id: 1, name: 'Строительный участок №1', work_types: 'Монтажные работы, работы на высоте', soat_required: true, medcheck_required: true },
    { id: 2, client_id: 1, name: 'Административный отдел', work_types: 'Работа за ПЭВМ', soat_required: false, medcheck_required: false },
    { id: 3, client_id: 2, name: 'Торговый зал', work_types: 'Торговля', soat_required: false, medcheck_required: false },
  ];

  // ─── СОТРУДНИКИ ──────────────────────────────────────────
  const employees = [
    // ООО СтройГрупп — 4 сотрудника
    {
      id: 1, client_id: 1, division_id: 1,
      full_name: 'Громов Андрей Петрович',
      position: 'Генеральный директор',
      hire_date: d(-730),
      training: {
        prog_a:     { required: true,  date: d(-400) }, // просрочено
        first_aid:  { required: true,  date: d(-200) },
        fire:       { required: true,  date: d(-200) },
        siz:        { required: true,  date: d(-200) },
        repeat:     { required: true,  date: d(-190) }, // просрочено
        medcheck:   { required: false, date: null },
      }
    },
    {
      id: 2, client_id: 1, division_id: 1,
      full_name: 'Петров Сергей Николаевич',
      position: 'Прораб',
      hire_date: d(-500),
      training: {
        prog_a:     { required: true,  date: d(-300) },
        first_aid:  { required: true,  date: d(-300) },
        fire:       { required: true,  date: d(-300) },
        siz:        { required: true,  date: d(-10)  }, // истекает через ~170 дн
        repeat:     { required: true,  date: d(-160) }, // истекает через ~20 дн
        medcheck:   { required: true,  date: d(-300) },
      }
    },
    {
      id: 3, client_id: 1, division_id: 1,
      full_name: 'Захаров Илья Дмитриевич',
      position: 'Монтажник',
      hire_date: d(-200),
      training: {
        prog_a:     { required: true,  date: d(-100) },
        first_aid:  { required: true,  date: d(-100) },
        fire:       { required: true,  date: d(-100) },
        siz:        { required: true,  date: d(-100) },
        repeat:     { required: true,  date: d(-155) }, // истекает через ~25 дн
        medcheck:   { required: true,  date: d(-300) },
      }
    },
    {
      id: 4, client_id: 1, division_id: 2,
      full_name: 'Орлова Татьяна Игоревна',
      position: 'Бухгалтер',
      hire_date: d(-400),
      training: {
        prog_a:     { required: true,  date: d(-50)  },
        first_aid:  { required: false, date: null    },
        fire:       { required: true,  date: d(-50)  },
        siz:        { required: false, date: null    },
        repeat:     { required: true,  date: d(-140) },
        medcheck:   { required: false, date: null    },
      }
    },
    // ИП Морозова — 3 сотрудника
    {
      id: 5, client_id: 2, division_id: 3,
      full_name: 'Морозова Елена Викторовна',
      position: 'Индивидуальный предприниматель',
      hire_date: d(-365),
      training: {
        prog_a:     { required: true,  date: d(-20)  },
        first_aid:  { required: false, date: null    },
        fire:       { required: true,  date: d(-20)  },
        siz:        { required: false, date: null    },
        repeat:     { required: true,  date: d(-100) },
        medcheck:   { required: false, date: null    },
      }
    },
    {
      id: 6, client_id: 2, division_id: 3,
      full_name: 'Кузнецова Анна Сергеевна',
      position: 'Продавец-кассир',
      hire_date: d(-180),
      training: {
        prog_a:     { required: true,  date: d(-20)  },
        first_aid:  { required: false, date: null    },
        fire:       { required: true,  date: d(-20)  },
        siz:        { required: false, date: null    },
        repeat:     { required: true,  date: d(-100) },
        medcheck:   { required: false, date: null    },
      }
    },
    {
      id: 7, client_id: 2, division_id: 3,
      full_name: 'Лебедев Роман Андреевич',
      position: 'Грузчик',
      hire_date: d(-90),
      training: {
        prog_a:     { required: true,  date: d(-20)  },
        first_aid:  { required: false, date: null    },
        fire:       { required: true,  date: d(-20)  },
        siz:        { required: false, date: null    },
        repeat:     { required: true,  date: d(-90)  },
        medcheck:   { required: false, date: null    },
      }
    },
  ];

  // ─── СОБЫТИЯ ─────────────────────────────────────────────
  const events = [
    { id: 1, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Плановый медосмотр работников', due_date: d(-5),  status: 'pending', notes: 'Клиника «Здоровье», договор №44' },
    { id: 2, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Проверка наличия аптечек', due_date: d(3),   status: 'pending', notes: '' },
    { id: 3, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Обновить инструкции по ОТ', due_date: d(6),   status: 'pending', notes: 'После изменений в Приказе №772н' },
    { id: 4, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Провести повторный инструктаж', due_date: d(12),  status: 'pending', notes: 'Петров, Захаров' },
    { id: 5, client_id: 2, client_name: 'ИП Морозова Е.В.', title: 'Сдать отчёт СЗВ-ТД', due_date: d(2),   status: 'pending', notes: '' },
    { id: 6, client_id: 2, client_name: 'ИП Морозова Е.В.', title: 'Обновить политику ПДн', due_date: d(18),  status: 'pending', notes: 'Новая форма согласия' },
    { id: 7, client_id: 2, client_name: 'ИП Морозова Е.В.', title: 'Ознакомить сотрудников с ПВТР', due_date: d(30),  status: 'pending', notes: '' },
  ];

  // ─── ЗАДАЧИ ──────────────────────────────────────────────
  const tasks = [
    // Аутсорсер — задачи по клиентам
    { id: 1, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Запросить у клиента акт СОУТ', module: 'OT', done: 0, priority: 'normal', created_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3).toISOString() },
    { id: 2, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Согласовать дату медосмотра', module: 'OT', done: 0, priority: 'urgent', created_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString() },
    { id: 3, client_id: 2, client_name: 'ИП Морозова Е.В.', title: 'Подготовить согласие на ПДн для нового сотрудника', module: 'PD', done: 1, priority: 'normal', created_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5).toISOString() },
    // Штатный специалист — задачи по одной организации
    { id: 4, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Провести повторный инструктаж — Петров, Захаров', module: 'OT', done: 0, priority: 'urgent', created_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2).toISOString() },
    { id: 5, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Обновить список работников во вредных условиях', module: 'OT', done: 0, priority: 'normal', created_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 4).toISOString() },
    { id: 6, client_id: 1, client_name: 'ООО «СтройГрупп»', title: 'Получить подписи под инструкцией по ОТ №3', module: 'OT', done: 0, priority: 'normal', created_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString() },
  ];

  // ─── ДОКУМЕНТЫ ───────────────────────────────────────────
  const documents = [
    { id: 1, client_id: 1, title: 'Приказ о назначении ответственного за ОТ', status: 'done', created_at: d(-90), updated_at: d(-90) },
    { id: 2, client_id: 1, title: 'Положение об охране труда', status: 'done', created_at: d(-90), updated_at: d(-90) },
    { id: 3, client_id: 1, title: 'Программа вводного инструктажа', status: 'done', created_at: d(-90), updated_at: d(-90) },
    { id: 4, client_id: 1, title: 'Журнал вводного инструктажа', status: 'pending', created_at: d(-30), updated_at: d(-30) },
    { id: 5, client_id: 2, title: 'Приказ о назначении ответственного за ОТ', status: 'done', created_at: d(-30), updated_at: d(-30) },
    { id: 6, client_id: 2, title: 'Политика обработки персональных данных', status: 'done', created_at: d(-30), updated_at: d(-30) },
    { id: 7, client_id: 2, title: 'Согласие на обработку ПДн (форма)', status: 'done', created_at: d(-30), updated_at: d(-30) },
    { id: 8, client_id: 2, title: 'Положение об охране труда', status: 'done', created_at: d(-30), updated_at: d(-30) },
  ];

  // ─── НАСТРОЙКИ ───────────────────────────────────────────
  const settings = {
    user_name: 'Александр Свинцов',
    user_position: 'Специалист по охране труда',
    user_phone: '+7 961 519-24-00',
    user_email: 'demo@kompliance.ru',
    company_name: 'ИП Свинцова Д.И.',
    company_inn: '231519527860',
    company_ogrn: '326237500003201',
    company_address: 'Краснодарский край, г. Новороссийск',
    remind_days_1: '30',
    remind_days_2: '14',
    remind_days_3: '3',
    remind_weekends: '1',
    remind_escalate: '1',
    tg_morning: '0',
    tg_urgent: '1',
    onboarding_done: '1',
    ai_provider: 'deepseek',
    ai_key: '',
  };

  return { clients, divisions, employees, events, tasks, documents, settings };
})();
