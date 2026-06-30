'use strict';
// КомплаенсПро — gen_sout.js
// Генераторы документов СОУТ для микропредприятий
// Нормативная база: 426-ФЗ, Приказ Минтруда №699н от 31.10.2022, ПП №1830

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, BorderStyle, WidthType, VerticalAlign,
  PageNumber,
} = require('docx');
const fs   = require('fs');
const path = require('path');
const { safe } = require('./utils');
const {
  norm, save, p, pC, pR, pL, eL, H, SH, cell, row, tbl, footer,
  FONT, SZ, SZ_S, SZ_H, MP, CW, BALL, BNONE,
} = require('./gen_p1');

// ─── 15 факторов СОУТ (Приложение №1 к Приказу №699н) ────
const SOUT_FACTORS = [
  'Химический фактор',
  'Биологический фактор',
  'Шум',
  'Инфразвук',
  'Ультразвук воздушный',
  'Вибрация общая',
  'Вибрация локальная',
  'Неионизирующие излучения (электростатическое поле, постоянное магнитное поле, электрическое и магнитное поле промышленной частоты, электромагнитные излучения радиочастотного диапазона, широкополосные электромагнитные импульсы)',
  'Лазерное излучение',
  'Ультрафиолетовое излучение',
  'Ионизирующее излучение',
  'Микроклимат (температура воздуха, влажность воздуха, скорость движения воздуха, тепловое излучение)',
  'Световая среда (освещение)',
  'Тяжесть трудового процесса',
  'Напряженность трудового процесса',
];

// ─── Хелперы ──────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '«___» __________ ____';
  try {
    const dt = new Date(d);
    const day = String(dt.getDate()).padStart(2,'0');
    const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    return `«${day}» ${months[dt.getMonth()]} ${dt.getFullYear()} г.`;
  } catch(_) { return d; }
}

function fmtDateShort(d) {
  if (!d) return '__.__.____';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('ru-RU');
  } catch(_) { return d; }
}

function addWorkingDays(dateStr, days) {
  try {
    const dt = new Date(dateStr);
    let count = 0;
    while (count < days) {
      dt.setDate(dt.getDate() + 1);
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return dt.toISOString().split('T')[0];
  } catch(_) { return ''; }
}

function addCalDays(dateStr, days) {
  try {
    const dt = new Date(dateStr);
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().split('T')[0];
  } catch(_) { return ''; }
}

// Строка подписи членов комиссии
function commissionSignRows(sout, c) {
  const rows = [];
  const members = sout.commission || [];
  if (!members.length) return [eL(1), pL('Председатель комиссии:'), eL(1), pL(safe(c.manager_position)+' __________________ /'+safe(c.manager_name)+'/'), eL(1)];

  for (const m of members) {
    rows.push(pL(safe(m.position) + ':'));
    rows.push(pL(safe(m.position_short || m.position) + ' __________________ /' + safe(m.name) + '/ ' + fmtDate(sout.protocol_date)));
    rows.push(...eL(1));
  }
  return rows;
}

// ─── СОУТ-01: Приказ о создании комиссии ──────────────────
async function gen_sout_01(c, sout, dir) {
  const date = fmtDate(sout.protocol_date || sout.date);
  const members = sout.commission || [];
  const chair = members.find(m => m.is_chair) || members[0] || { name: c.manager_name, position: c.manager_position };
  const otherMembers = members.filter(m => !m.is_chair);

  const ch = [
    pR(safe(c.name)), ...eL(1),
    H('ПРИКАЗ'),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: safe(c.city || c.region || ''), size: SZ, font: FONT }),
        new TextRun({ text: '\t', size: SZ }),
        new TextRun({ text: date, size: SZ, font: FONT }),
      ],
      tabStops: [{ type: 'right', position: 9072 }],
    }),
    ...eL(1),
    pC('«О создании комиссии по проведению специальной оценки условий труда»', { bold: true }),
    ...eL(1),
    p('Во исполнение требований Федерального закона от 28.12.2013 № 426-ФЗ «О специальной оценке условий труда» и Приказа Минтруда России от 31.10.2022 № 699н,'),
    p('ПРИКАЗЫВАЮ:', { bold: true }),
    p('1. Создать комиссию по проведению специальной оценки условий труда (далее — Комиссия) в следующем составе:'),
    ...eL(1),
    p('Председатель Комиссии:'),
    p('— ' + safe(chair.name) + ' – ' + safe(chair.position) + '.'),
    ...eL(1),
    ...(otherMembers.length ? [
      p('Члены Комиссии:'),
      ...otherMembers.map(m => p('— ' + safe(m.name) + ' – ' + safe(m.position) + ';')),
      ...eL(1),
    ] : []),
    p('2. Комиссии в своей работе руководствоваться действующим законодательством Российской Федерации о специальной оценке условий труда.'),
    p('3. Комиссии в срок до ' + date + ' подготовить и утвердить перечень рабочих мест, подлежащих специальной оценке условий труда.'),
    p('4. Контроль за исполнением настоящего приказа оставляю за собой.'),
    p('Основание: часть 1 статьи 9 Федерального закона от 28.12.2013 № 426-ФЗ.'),
    ...eL(2),
    pL(safe(c.manager_position) + ' ' + safe(c.name) + '  ______________  /' + safe(c.manager_name) + '/'),
    ...eL(2),
    pL('С приказом ознакомлены:'),
    ...eL(1),
    ...otherMembers.map(m => pL(safe(m.name) + '  ______________  ' + fmtDate(sout.protocol_date || sout.date))),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-01') },
    children: ch,
  }], dir, 'СОУТ-01 Приказ о создании комиссии.docx');
}

// ─── СОУТ-02: Перечень рабочих мест ───────────────────────
async function gen_sout_02(c, sout, dir) {
  const date = fmtDate(sout.protocol_date || sout.date);
  const employees = sout.worksheets || [];
  const colW = [500, 2500, 2500, 2000, 1572];

  const hdrRow = row([
    cell('№ п/п', colW[0], { bold: true, center: true }),
    cell('Структурное подразделение', colW[1], { bold: true, center: true }),
    cell('Наименование должности', colW[2], { bold: true, center: true }),
    cell('Фамилия, инициалы работника', colW[3], { bold: true, center: true }),
    cell('Примечание', colW[4], { bold: true, center: true }),
  ]);

  const dataRows = employees.map((e, i) => row([
    cell(String(i + 1), colW[0], { center: true, sz: SZ_S }),
    cell(safe(e.department || c.name), colW[1], { sz: SZ_S }),
    cell(safe(e.position), colW[2], { sz: SZ_S }),
    cell(safe(e.full_name), colW[3], { sz: SZ_S }),
    cell('', colW[4], { sz: SZ_S }),
  ]));

  const chair = (sout.commission || []).find(m => m.is_chair) || { name: c.manager_name, position: c.manager_position };
  const otherMembers = (sout.commission || []).filter(m => !m.is_chair);

  const ch = [
    pR('Приложение № 1 к протоколу № 1 от ' + fmtDateShort(sout.protocol_date || sout.date)),
    ...eL(1),
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [CW / 2, CW / 2],
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
      rows: [new TableRow({ children: [
        new TableCell({ borders: BNONE, width: { size: CW / 2, type: WidthType.DXA }, children: [new Paragraph('')] }),
        new TableCell({ borders: BNONE, width: { size: CW / 2, type: WidthType.DXA }, children: [
          pL('УТВЕРЖДАЮ', { bold: true }),
          pL(safe(c.manager_position) + ' ' + safe(c.name)),
          pL('______________  /' + safe(c.manager_name) + '/'),
          pL(fmtDate(sout.protocol_date || sout.date)),
        ]}),
      ]})],
    }),
    ...eL(1),
    H('ПЕРЕЧЕНЬ'),
    pC('рабочих мест, подлежащих специальной оценке условий труда в ' + safe(c.name)),
    ...eL(1),
    p('Комиссия, созданная приказом № ' + safe(sout.order_num || '____') + ' от ' + fmtDateShort(sout.protocol_date || sout.date) + ', утвердила настоящий перечень рабочих мест, подлежащих специальной оценке условий труда:'),
    ...eL(1),
    tbl(colW, [hdrRow, ...dataRows]),
    ...eL(1),
    p('ИТОГО: ' + employees.length + ' (' + numToWords(employees.length) + ') ' + pluralRabochihMest(employees.length)),
    p('Примечание: аналогичные рабочие места отсутствуют.'),
    ...eL(2),
    pL('Председатель комиссии:'),
    pL(safe(chair.position) + '  ______________  /' + safe(chair.name) + '/'),
    ...eL(1),
    ...(otherMembers.length ? [pL('Члены комиссии:'), ...otherMembers.map(m => pL(safe(m.position) + '  ______________  /' + safe(m.name) + '/'))] : []),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-02') },
    children: ch,
  }], dir, 'СОУТ-02 Перечень рабочих мест.docx');
}

// ─── СОУТ-03: Проверочный лист (на каждого сотрудника) ────
async function gen_sout_03(c, sout, dir, employee, num) {
  const date = fmtDate(sout.protocol_date || sout.date);
  const factors = employee.factors || {};
  const colW = [500, 6572, 2000];
  const allNo = SOUT_FACTORS.every((_, i) => !factors[`f${i + 1}`]);
  const chair = (sout.commission || []).find(m => m.is_chair) || { name: c.manager_name, position: c.manager_position };
  const otherMembers = (sout.commission || []).filter(m => !m.is_chair);

  const hdrRow = row([
    cell('№ п/п', colW[0], { bold: true, center: true }),
    cell('Наименование фактора', colW[1], { bold: true, center: true }),
    cell('Наличие фактора на рабочем месте (ДА/НЕТ)', colW[2], { bold: true, center: true }),
  ]);

  const dataRows = SOUT_FACTORS.map((factor, i) => row([
    cell(String(i + 1), colW[0], { center: true, sz: SZ_S }),
    cell(factor, colW[1], { sz: SZ_S }),
    cell(factors[`f${i + 1}`] ? 'ДА' : 'НЕТ', colW[2], { center: true, sz: SZ_S }),
  ]));

  const conclusion = allNo
    ? 'потенциально вредные и (или) опасные производственные факторы не идентифицированы.'
    : 'выявлены потенциально вредные и (или) опасные производственные факторы. Требуется проведение исследований (испытаний) и измерений вредных и (или) опасных производственных факторов.';

  const ch = [
    pC('ПРОВЕРОЧНЫЙ ЛИСТ (СПИСОК КОНТРОЛЬНЫХ ВОПРОСОВ)', { bold: true }),
    pC('применяемый при проведении специальной оценки условий труда в отношении рабочих мест лиц, занятых на рабочих местах, включённых в перечень рабочих мест в организациях, осуществляющих отдельные виды деятельности, в целях идентификации потенциально вредных и (или) опасных факторов'),
    ...eL(1),
    H('Раздел 1. Сведения о работодателе', SZ),
    p('1.1. Наименование работодателя: ' + safe(c.name)),
    p('1.2. Место нахождения и место осуществления деятельности: ' + safe(c.address || c.city || c.region)),
    p('1.3. Наименование структурного подразделения (при наличии): ' + safe(employee.department || '—')),
    p('1.4. Контактные данные (телефон, адрес электронной почты): ' + safe(c.phone || '—')),
    ...eL(1),
    H('Раздел 2. Сведения о рабочем месте', SZ),
    p('2.1. Номер рабочего места в соответствии с перечнем рабочих мест: ' + num),
    p('2.2. Наименование должности (профессии) работника: ' + safe(employee.position)),
    p('2.3. Фамилия, имя, отчество работника: ' + safe(employee.full_name)),
    ...eL(1),
    H('Раздел 3. Результаты идентификации потенциально вредных и (или) опасных производственных факторов', SZ),
    ...eL(1),
    tbl(colW, [hdrRow, ...dataRows]),
    ...eL(1),
    p([{ t: 'Заключение комиссии: ', b: true }, { t: conclusion }]),
    ...eL(2),
    pL('Председатель комиссии:'),
    pL(safe(chair.position) + '  __________________________  /' + safe(chair.name) + '/  ' + date),
    ...eL(1),
    ...(otherMembers.length ? [
      pL('Члены комиссии:'),
      ...otherMembers.flatMap(m => [
        pL(safe(m.position) + '  __________________________  /' + safe(m.name) + '/  ' + date),
        ...eL(1),
      ]),
    ] : []),
    pL('С результатами идентификации ознакомлен(а):'),
    pL('______________  /' + safe(employee.full_name) + '/  ' + (employee.date_acquainted ? fmtDate(employee.date_acquainted) : date)),
  ];

  const safePos = safe(employee.position).replace(/[/\\?%*:|"<>]/g, '').trim().slice(0, 40);
  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-03') },
    children: ch,
  }], dir, `СОУТ-03 Проверочный лист ${num} ${safePos}.docx`);
}

// ─── СОУТ-04: Протокол заседания комиссии ─────────────────
async function gen_sout_04(c, sout, dir) {
  const date = fmtDate(sout.protocol_date || sout.date);
  const dateShort = fmtDateShort(sout.protocol_date || sout.date);
  const employees = sout.worksheets || [];
  const chair = (sout.commission || []).find(m => m.is_chair) || { name: c.manager_name, position: c.manager_position };
  const otherMembers = (sout.commission || []).filter(m => !m.is_chair);
  const allNoFactors = employees.every(e => Object.values(e.factors || {}).every(v => !v));

  const ch = [
    pC('ПРОТОКОЛ № 1', { bold: true }),
    pC('заседания комиссии по проведению специальной оценки условий труда', { bold: true }),
    ...eL(1),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: safe(c.city || c.region || ''), size: SZ, font: FONT }),
        new TextRun({ text: '\t', size: SZ }),
        new TextRun({ text: date, size: SZ, font: FONT }),
      ],
      tabStops: [{ type: 'right', position: 9072 }],
    }),
    ...eL(1),
    p('Присутствовали:', { bold: true }),
    ...eL(1),
    p('Председатель комиссии:', { bold: true }),
    p('— ' + safe(chair.name) + ' – ' + safe(chair.position) + '.'),
    ...eL(1),
    ...(otherMembers.length ? [
      p('Члены комиссии:', { bold: true }),
      ...otherMembers.map(m => p('— ' + safe(m.name) + ' – ' + safe(m.position) + ';')),
      ...eL(1),
    ] : []),
    p('Повестка дня:', { bold: true }),
    p('Рассмотрение результатов идентификации потенциально вредных и (или) опасных производственных факторов на рабочих местах ' + safe(c.name) + '.'),
    ...eL(1),
    p('Рассмотрев:', { bold: true }),
    p('— Перечень рабочих мест, подлежащих специальной оценке условий труда, утверждённый ' + date + '.'),
    p('— Проверочные листы (списки контрольных вопросов), заполненные комиссией на каждое рабочее место (всего ' + employees.length + ' ' + pluralListov(employees.length) + '), в которых по всем 15 факторам получены ответы «НЕТ».'),
    ...eL(1),
    p('Комиссия установила:', { bold: true }),
    p('— На рабочих местах ' + safe(c.name) + ' отсутствуют следующие потенциально вредные и (или) опасные производственные факторы:'),
    p('— химические факторы;'),
    p('— биологические факторы;'),
    p('— шум, инфразвук, ультразвук воздушный;'),
    p('— вибрация общая и локальная;'),
    p('— неионизирующие излучения (электростатическое поле, постоянное магнитное поле, электрическое и магнитное поле промышленной частоты, электромагнитные излучения радиочастотного диапазона, широкополосные электромагнитные импульсы);'),
    p('— лазерное излучение;'),
    p('— ультрафиолетовое излучение;'),
    p('— ионизирующее излучение.'),
    p('— Параметры микроклимата и световой среды соответствуют нормативным требованиям, что обеспечивается конструкцией здания и штатными системами отопления, вентиляции и кондиционирования.'),
    p('— Тяжесть и напряжённость трудового процесса не превышают допустимых значений для офисных работ.'),
    p('— Потенциально вредные и (или) опасные производственные факторы не идентифицированы.'),
    ...eL(1),
    p('Решили:', { bold: true }),
    p('1. Признать условия труда на всех рабочих местах ' + safe(c.name) + ' допустимыми (класс 2).'),
    p('2. Утвердить проверочные листы (списки контрольных вопросов) в количестве ' + employees.length + ' (' + numToWords(employees.length) + ') ' + pluralListov(employees.length) + ' как итоговый документ специальной оценки условий труда.'),
    p('3. Утвердить перечень рабочих мест, подлежащих специальной оценке условий труда (Приложение № 1 к настоящему протоколу).'),
    p('4. Направить декларацию соответствия условий труда государственным нормативным требованиям охраны труда в Государственную инспекцию труда в ' + getGitName(c.region) + ' в установленный законом срок (не позднее 30 рабочих дней с даты утверждения протокола).'),
    ...eL(1),
    p('Голосовали:'),
    p('За – ' + ((sout.commission || []).length || 1) + ' человек.'),
    p('Против – 0 человек.'),
    p('Воздержались – 0 человек.'),
    p('Решение принято единогласно.', { bold: true }),
    ...eL(2),
    pL('Подписи членов комиссии:'),
    ...eL(1),
    pL('Председатель комиссии:'),
    pL(safe(chair.position) + '  __________________  /' + safe(chair.name) + '/'),
    ...eL(1),
    ...(otherMembers.flatMap(m => [
      pL(safe(m.position) + '  __________________  /' + safe(m.name) + '/'),
      ...eL(1),
    ])),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-04') },
    children: ch,
  }], dir, 'СОУТ-04 Протокол заседания комиссии.docx');
}

// ─── СОУТ-05: Титульный лист отчёта ───────────────────────
async function gen_sout_05(c, sout, dir) {
  const date = fmtDate(sout.protocol_date || sout.date);
  const dateShort = fmtDateShort(sout.protocol_date || sout.date);
  const employees = sout.worksheets || [];
  const chair = (sout.commission || []).find(m => m.is_chair) || { name: c.manager_name, position: c.manager_position };
  const otherMembers = (sout.commission || []).filter(m => !m.is_chair);

  const colW2 = [2500, 6572];
  const infoRows = [
    ['Полное наименование', safe(c.name)],
    ['Сокращённое наименование', safe(c.short_name || c.name)],
    ['ИНН', safe(c.inn || '—')],
    ['ОГРН', safe(c.ogrn || '—')],
    ['Основной вид деятельности (ОКВЭД)', safe(c.okved || '—')],
    ['Юридический адрес', safe(c.address || c.city || '—')],
    ['Фактический адрес', safe(c.address_actual || c.address || c.city || '—')],
    ['ФИО руководителя', safe(c.manager_name)],
  ];

  const infoTable = tbl(colW2, infoRows.map(([l, r]) => row([
    cell(l, colW2[0], { bold: true, sz: SZ_S }),
    cell(r, colW2[1], { sz: SZ_S }),
  ])));

  const svedTable = tbl(colW2, [
    row([cell('Показатель', colW2[0], { bold: true }), cell('Значение', colW2[1], { bold: true })]),
    row([cell('Наименование', colW2[0], { sz: SZ_S }), cell('Специальная оценка условий труда проведена работодателем самостоятельно в упрощённом порядке', colW2[1], { sz: SZ_S })]),
    row([cell('Основание', colW2[0], { sz: SZ_S }), cell('Приказ Минтруда России от 31.10.2022 № 699н', colW2[1], { sz: SZ_S })]),
  ]);

  const commColW = [2500, 6572];
  const commRows = [
    row([cell('Показатель', commColW[0], { bold: true }), cell('Значение', commColW[1], { bold: true })]),
    row([cell('Председатель комиссии', commColW[0], { sz: SZ_S }), cell(safe(chair.name) + ' – ' + safe(chair.position), commColW[1], { sz: SZ_S })]),
    ...otherMembers.map(m => row([cell('Член комиссии', commColW[0], { sz: SZ_S }), cell(safe(m.name) + ' – ' + safe(m.position), commColW[1], { sz: SZ_S })])),
  ];

  const docColW = [400, 5072, 2000, 1600];
  const docList = [
    ['1', 'Приказ о создании комиссии (СОУТ-01 от ' + dateShort + ')', '1', ''],
    ['2', 'Перечень рабочих мест (утверждён ' + dateShort + ')', '1', ''],
    ['3', 'Протокол заседания комиссии № 1 от ' + dateShort, '2', ''],
    ['4', 'Проверочные листы (' + employees.length + ' шт.)', String(employees.length), ''],
  ];

  const ch = [
    H('ТИТУЛЬНЫЙ ЛИСТ'),
    H('ОТЧЁТ'),
    H('о проведении специальной оценки условий труда', SZ),
    ...eL(2),
    H('Сведения о работодателе', SZ),
    infoTable,
    ...eL(1),
    H('Сведения об организации, проводившей СОУТ', SZ),
    svedTable,
    ...eL(1),
    H('Сведения о комиссии по проведению СОУТ', SZ),
    tbl(commColW, commRows),
    ...eL(1),
    H('Перечень прилагаемых документов', SZ),
    tbl(docColW, [
      row([cell('№', docColW[0], { bold: true, center: true }), cell('Наименование документа', docColW[1], { bold: true }), cell('Кол-во листов', docColW[2], { bold: true, center: true }), cell('Примечание', docColW[3], { bold: true })]),
      ...docList.map(d => row([cell(d[0], docColW[0], { center: true, sz: SZ_S }), cell(d[1], docColW[1], { sz: SZ_S }), cell(d[2], docColW[2], { center: true, sz: SZ_S }), cell(d[3], docColW[3], { sz: SZ_S })])),
    ]),
    ...eL(2),
    pL(safe(c.manager_position) + ' ' + safe(c.name)),
    pL('_______________  /' + safe(c.manager_name) + '/'),
    pL(date),
    ...eL(1),
    pL('М.П.'),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-05') },
    children: ch,
  }], dir, 'СОУТ-05 Титульный лист отчёта.docx');
}

// ─── СОУТ-06: Декларация для портала Роструда ─────────────
// Структура строго соответствует эталонному файлу declaration.rostrud.gov.ru
async function gen_sout_06(c, sout, dir) {
  const employees = sout.worksheets || [];
  const dateShort = fmtDateShort(sout.protocol_date || sout.date);

  // Блок 1: реквизиты работодателя (одна ячейка — три строки таблицей)
  const colW1 = [9072];
  const t1 = tbl(colW1, [
    row([cell(safe(c.name), colW1[0])]),
    row([cell('(наименование юридического лица (фамилия, имя, отчество (при наличии) индивидуального предпринимателя, подавшего декларацию,', colW1[0], { sz: SZ_S })]),
    row([cell(safe(c.address || c.city || '') + (c.phone ? ', ' + c.phone : ''), colW1[0])]),
    row([cell('место нахождения и место осуществления деятельности, контактный телефон', colW1[0], { sz: SZ_S })]),
    row([cell(safe(c.inn || ''), colW1[0])]),
    row([cell('идентификационный номер налогоплательщика,', colW1[0], { sz: SZ_S })]),
    row([cell(safe(c.ogrn || ''), colW1[0])]),
    row([cell('основной государственный регистрационный номер)', colW1[0], { sz: SZ_S })]),
  ]);

  // Блок 2: список рабочих мест (формат: "N. Должность; X чел.")
  const workplacesRows = employees.map((e, i) => row([
    cell(`${i + 1}. ${safe(e.position)}; 1 чел.`, colW1[0]),
  ]));
  const t2 = tbl(colW1, [
    row([cell('(наименование должности, профессии или специальности работника (работников), занятого (занятых) на рабочем месте (рабочих местах),', colW1[0], { sz: SZ_S })]),
    ...workplacesRows,
    row([cell('индивидуальный номер (номера) рабочего места (рабочих мест), численность занятых работников в отношении каждого рабочего места)', colW1[0], { sz: SZ_S })]),
  ]);

  // Блок 3: основание
  const colW2 = [4536, 4536];
  const t3 = tbl(colW2, [
    row([
      cell('Декларация подана на основании', colW2[0]),
      cell('Протокол заседания комиссии № 1 от ' + dateShort, colW2[1]),
    ]),
    row([
      cell('(реквизиты заключения эксперта организации, проводившей специальную оценку условий труда, и (или) протокола (протоколов) проведения исследований (испытаний) или измерений вредных и (или) опасных производственных факторов)', colW2[0], { sz: SZ_S, cs: 2 }),
      new TableCell({ borders: BNONE, width: { size: 0, type: WidthType.DXA }, children: [] }),
    ]),
  ]);

  // Блок 4: кто проводил
  const t4 = tbl(colW1, [
    row([cell('Специальная оценка проведена комиссией работодателя (СОУТ в упрощённом порядке;', colW1[0])]),
    row([cell('(наименование организации, проводившей специальную оценку условий труда,', colW1[0], { sz: SZ_S })]),
    row([cell('Приказ Минтруда России от 31.10.2022 № 699н)', colW1[0])]),
    row([cell('регистрационный номер в реестре организаций, проводящих специальную оценку условий труда)', colW1[0], { sz: SZ_S })]),
  ]);

  // Блок 5: подпись
  const colW3 = [1500, 2500, 500, 1500, 3072];
  const t5 = tbl(colW3, [
    row([
      cell('М.П.', colW3[0], { center: true }),
      cell('', colW3[1]),
      cell('', colW3[2]),
      cell('', colW3[3]),
      cell(safe(c.manager_name), colW3[4]),
    ]),
    row([
      cell('', colW3[0]),
      cell('(подпись)', colW3[1], { center: true, sz: SZ_S }),
      cell('', colW3[2]),
      cell('', colW3[3]),
      cell('(инициалы, фамилия)', colW3[4], { sz: SZ_S }),
    ]),
  ]);

  const ch = [
    pC('Декларация соответствия', { bold: true }),
    pC('условий труда государственным нормативным', { bold: true }),
    pC('требованиям охраны труда', { bold: true }),
    ...eL(1),
    t1,
    ...eL(1),
    p('заявляет, что на рабочем месте (рабочих местах)'),
    ...eL(1),
    t2,
    ...eL(1),
    p('по результатам идентификации не выявлены вредные и (или) опасные производственные факторы или условия труда по результатам исследований (испытаний) и измерений вредных и (или) опасных производственных факторов признаны оптимальными или допустимыми, условия труда соответствуют государственным нормативным требованиям охраны труда.'),
    ...eL(1),
    t3,
    ...eL(1),
    p('Специальная оценка условий труда проведена'),
    ...eL(1),
    t4,
    ...eL(1),
    p('Дата подачи декларации «______» __________________ ' + new Date().getFullYear() + ' год'),
    ...eL(1),
    t5,
    ...eL(2),
    pC('Сведения о регистрации декларации', { bold: true }),
    ...eL(1),
    tbl([9072], [row([cell('(наименование территориального органа Федеральной службы по труду и занятости, зарегистрировавшего декларацию)', 9072, { sz: SZ_S })])]),
    ...eL(1),
    tbl([1800, 1500, 400, 1800, 1500, 2072], [
      row([cell('', 1800), cell('(дата регистрации)', 1500, { sz: SZ_S }), cell('', 400), cell('', 1800), cell('(регистрационный номер)', 1500, { sz: SZ_S }), cell('', 2072)]),
    ]),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-06') },
    children: ch,
  }], dir, 'СОУТ-06 Декларация (для портала Роструда).docx');
}

// ─── СОУТ-07: Декларация внутренняя (расширенная) ─────────
async function gen_sout_07(c, sout, dir) {
  const date = fmtDate(sout.protocol_date || sout.date);
  const dateShort = fmtDateShort(sout.protocol_date || sout.date);
  const employees = sout.worksheets || [];

  const colW = [500, 500, 3000, 1000, 2000, 2072];
  const hdrRow = row([
    cell('№ п/п', colW[0], { bold: true, center: true }),
    cell('Инд. номер РМ', colW[1], { bold: true, center: true }),
    cell('Наименование должности (профессии)', colW[2], { bold: true, center: true }),
    cell('Кол-во работников', colW[3], { bold: true, center: true }),
    cell('Класс (подкласс) условий труда', colW[4], { bold: true, center: true }),
    cell('Реквизиты проверочного листа', colW[5], { bold: true, center: true }),
  ]);

  const dataRows = employees.map((e, i) => row([
    cell(String(i + 1), colW[0], { center: true, sz: SZ_S }),
    cell(String(i + 1), colW[1], { center: true, sz: SZ_S }),
    cell(safe(e.position), colW[2], { sz: SZ_S }),
    cell('1', colW[3], { center: true, sz: SZ_S }),
    cell('2 (допустимый)', colW[4], { center: true, sz: SZ_S }),
    cell('б/н от ' + dateShort, colW[5], { center: true, sz: SZ_S }),
  ]));

  const ch = [
    pC('ДЕКЛАРАЦИЯ СООТВЕТСТВИЯ', { bold: true }),
    pC('УСЛОВИЙ ТРУДА ГОСУДАРСТВЕННЫМ НОРМАТИВНЫМ', { bold: true }),
    pC('ТРЕБОВАНИЯМ ОХРАНЫ ТРУДА', { bold: true }),
    ...eL(1),
    p('В Государственную инспекцию труда в ' + getGitName(c.region)),
    p('(территориальный орган Роструда)'),
    ...eL(1),
    H('1. Сведения о работодателе', SZ),
    p('1.1. Полное и сокращённое наименование: ' + safe(c.name)),
    p('1.2. Место нахождения и место осуществления деятельности: ' + safe(c.address || c.city || '—')),
    p('1.3. Основной вид экономической деятельности (код по ОКВЭД): ' + safe(c.okved || '—')),
    p('1.4. Численность работников: ' + employees.length + ' (' + numToWords(employees.length) + ') ' + pluralChelovek(employees.length)),
    p('1.5. Номер и дата утверждения перечня рабочих мест, на которых проведена специальная оценка условий труда: Перечень утверждён ' + date + ' (Приложение к протоколу заседания комиссии № 1)'),
    ...eL(1),
    H('2. Результаты специальной оценки условий труда', SZ),
    ...eL(1),
    tbl(colW, [hdrRow, ...dataRows]),
    ...eL(1),
    H('3. Подтверждение достоверности сведений', SZ),
    p('Достоверность и полноту сведений, указанных в настоящей декларации, подтверждаю.'),
    ...eL(2),
    pL(safe(c.manager_position) + ' ' + safe(c.name)),
    pL('_______________  /' + safe(c.manager_name) + '/'),
    pL('«___» ____________ ' + new Date().getFullYear() + ' г.'),
    ...eL(1),
    pL('М.П'),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-07') },
    children: ch,
  }], dir, 'СОУТ-07 Декларация (внутренняя).docx');
}

// ─── СОУТ-08: Инструкция по дальнейшим шагам ──────────────
async function gen_sout_08(c, sout, dir) {
  const protDate = sout.protocol_date || sout.date || new Date().toISOString().split('T')[0];
  const dateAcquaint = addCalDays(protDate, 30);
  const dateDecl = addWorkingDays(protDate, 30);
  const employees = sout.worksheets || [];

  const colW = [400, 3000, 1800, 2200, 1672];
  const steps = [
    ['1', 'Распечатайте Приказ о создании комиссии (СОУТ-01)', 'Сегодня', safe(c.manager_position) + ' + все члены комиссии', 'Подписи внизу приказа'],
    ['2', 'Распечатайте Перечень рабочих мест (СОУТ-02)', 'Сегодня', safe(c.manager_position) + ' утверждает + члены комиссии', 'Подписи председателя и членов'],
    ['3', 'Распечатайте ' + employees.length + ' проверочных листа (СОУТ-03)', 'Сегодня', safe(c.manager_position) + ' + члены комиссии', 'Подписи внизу каждого листа'],
    ['4', 'Ознакомьте каждого сотрудника с его проверочным листом под подпись', 'До ' + fmtDateShort(dateAcquaint) + ' (30 кал. дней)', 'Каждый сотрудник', 'Подпись в строке «С результатами ознакомлен(а)»'],
    ['5', 'Распечатайте Декларацию для портала (СОУТ-06)', fmtDateShort(protDate), 'Только ' + safe(c.manager_position), 'Подпись с печатью'],
    ['6', 'Направьте декларацию + копии всех проверочных листов в ГИТ через портал declaration.rostrud.gov.ru или лично', 'До ' + fmtDateShort(dateDecl) + ' (30 рабочих дней)', '—', 'Сохраните квитанцию/скриншот'],
    ['7', 'Сложите все документы в папку «СОУТ» и храните не менее 50 лет', 'Постоянно', '—', 'Статья 22.1 Приказа №558н'],
  ];

  const hdrRow = row([
    cell('Шаг', colW[0], { bold: true, center: true }),
    cell('Действие', colW[1], { bold: true, center: true }),
    cell('Срок', colW[2], { bold: true, center: true }),
    cell('Кто подписывает / исполняет', colW[3], { bold: true, center: true }),
    cell('Примечание', colW[4], { bold: true, center: true }),
  ]);

  const dataRows = steps.map(s => row([
    cell(s[0], colW[0], { center: true, sz: SZ_S }),
    cell(s[1], colW[1], { sz: SZ_S }),
    cell(s[2], colW[2], { sz: SZ_S }),
    cell(s[3], colW[3], { sz: SZ_S }),
    cell(s[4], colW[4], { sz: SZ_S }),
  ]));

  const ch = [
    H('ИНСТРУКЦИЯ'),
    pC('что делать дальше после проведения СОУТ'),
    pC(safe(c.name)),
    ...eL(1),
    p('Дата протокола комиссии: ' + fmtDate(protDate)),
    p('Состав комиссии: ' + ((sout.commission || []).length || 1) + ' чел.'),
    p('Рабочих мест: ' + employees.length),
    ...eL(1),
    tbl(colW, [hdrRow, ...dataRows]),
    ...eL(2),
    H('Важные сроки', SZ),
    p('• 30 календарных дней — срок ознакомления сотрудников с результатами СОУТ (ч. 5 ст. 15 426-ФЗ)'),
    p('• 30 рабочих дней — срок подачи декларации в ГИТ с момента утверждения протокола (ч. 1 ст. 11 426-ФЗ)'),
    p('• Декларация является бессрочной при сохранении условий труда (ч. 4 ст. 11 426-ФЗ)'),
    p('• Внеплановая СОУТ — в течение 12 месяцев при вводе новых рабочих мест или изменении условий труда'),
    ...eL(1),
    H('Куда подавать декларацию', SZ),
    p('Портал подачи деклараций СОУТ: declaration.rostrud.gov.ru'),
    p('Территориальный орган: Государственная инспекция труда в ' + getGitName(c.region)),
    p('Файл для загрузки: СОУТ-06 Декларация (для портала Роструда).docx'),
  ];

  return save([{
    properties: { page: { size: { width: 16838, height: 11906, orientation: 'landscape' }, margin: { top: 720, right: 720, bottom: 720, left: 1134 } } },
    footers: { default: footer('СОУТ-08') },
    children: ch,
  }], dir, 'СОУТ-08 Инструкция по дальнейшим шагам.docx');
}

// ─── СОУТ-09: Приказ о возложении обязанностей (опционально)
async function gen_sout_09(c, sout, dir) {
  const sub = sout.substitution || {};
  const date = fmtDate(sout.protocol_date || sout.date);

  const ch = [
    pR(safe(c.name)), ...eL(1),
    H('ПРИКАЗ'),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: safe(c.city || ''), size: SZ, font: FONT }),
        new TextRun({ text: '\t', size: SZ }),
        new TextRun({ text: date, size: SZ, font: FONT }),
      ],
      tabStops: [{ type: 'right', position: 9072 }],
    }),
    ...eL(1),
    pC('О возложении обязанностей ' + safe(sub.from_position || '_______________'), { bold: true }),
    ...eL(1),
    p('В связи с отсутствием ' + safe(sub.from_position || '_______________') + ' ' + safe(sub.from_name || '_______________') + ' (' + safe(sub.reason || 'временное отсутствие') + ') и с целью обеспечения непрерывности рабочего процесса'),
    p('ПРИКАЗЫВАЮ:', { bold: true }),
    p('— Возложить исполнение обязанностей ' + safe(sub.from_position || '_______________') + ' ' + safe(sub.from_name || '_______________') + ' на ' + safe(sub.to_position || '_______________') + ' ' + safe(sub.to_name || '_______________') + ' с ' + fmtDate(sub.date_from) + ' до выхода основного сотрудника на работу.'),
    p('— Установить ' + safe(sub.to_name || '_______________') + ' доплату за временное замещение в размере _________________________________.'),
    p('— Контроль за исполнением приказа оставляю за собой.'),
    ...eL(2),
    pL(safe(c.manager_position) + '  _______________  /' + safe(c.manager_name) + '/'),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-09') },
    children: ch,
  }], dir, 'СОУТ-09 Приказ о возложении обязанностей.docx');
}

// ─── СОУТ-10: Справка о замещении (опционально) ───────────
async function gen_sout_10(c, sout, dir) {
  const sub = sout.substitution || {};
  const dateShort = fmtDateShort(sout.protocol_date || sout.date);

  const ch = [
    pC(safe(c.name).toUpperCase(), { bold: true }),
    ...eL(2),
    H('Справка'),
    ...eL(1),
    p('В период с ' + fmtDate(sub.date_from) + ' по ' + fmtDate(sub.date_to) + ' (' + safe(sub.reason || 'временное отсутствие') + ') должность ' + safe(sub.from_position || '_______________') + ' исполнял(а) ' + safe(sub.to_name || '_______________') + '. СОУТ на этом рабочем месте проведена с его(её) участием (проверочный лист б/н от ' + dateShort + ').'),
    ...eL(1),
    p('После выхода ' + safe(sub.from_name || '_______________') + ' из ' + safe(sub.reason || 'отсутствия') + ' условия труда на её(его) рабочем месте не изменились. В соответствии с ч. 5.1 ст. 15 ФЗ № 426-ФЗ, она(он) ознакомлен(а) с результатами СОУТ (проверочный лист б/н от ' + dateShort + ', дата ознакомления — ' + fmtDate(sub.date_acquainted) + ').'),
    ...eL(2),
    pL(safe(c.manager_position) + '  _______________  /' + safe(c.manager_name) + '/'),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('СОУТ-10') },
    children: ch,
  }], dir, 'СОУТ-10 Справка о замещении.docx');
}

// ─── Главная функция — генерация полного пакета СОУТ ──────
async function generateSoutPackage(client, soutData, baseDir) {
  const c = norm(client);
  const sout = soutData || {};

  // Папка: .../[Клиент]/СОУТ/СОУТ [дата]/
  const dateStr = fmtDateShort(sout.protocol_date || sout.date || new Date().toISOString().split('T')[0]).replace(/\./g, '.');
  const soutFolder = path.join(baseDir, 'СОУТ', 'СОУТ ' + dateStr);
  if (!fs.existsSync(soutFolder)) fs.mkdirSync(soutFolder, { recursive: true });

  const results = [];
  const errors = [];

  let tasks;
  if (sout._generalMode) {
    // Общий порядок — только приказ о комиссии и перечень рабочих мест
    // для передачи аккредитованной организации
    tasks = [
      () => gen_sout_01(c, sout, soutFolder),
      () => gen_sout_02(c, sout, soutFolder),
    ];
  } else {
    tasks = [
      () => gen_sout_01(c, sout, soutFolder),
      () => gen_sout_02(c, sout, soutFolder),
      () => gen_sout_04(c, sout, soutFolder),
      () => gen_sout_05(c, sout, soutFolder),
      () => gen_sout_06(c, sout, soutFolder),
      () => gen_sout_07(c, sout, soutFolder),
      () => gen_sout_08(c, sout, soutFolder),
    ];

    // Проверочные листы — по одному на каждого сотрудника
    (sout.worksheets || []).forEach((e, i) => {
      tasks.push(() => gen_sout_03(c, sout, soutFolder, e, i + 1));
    });

    // Опциональные документы при замещении
    if (sout.has_substitution && sout.substitution) {
      tasks.push(() => gen_sout_09(c, sout, soutFolder));
      tasks.push(() => gen_sout_10(c, sout, soutFolder));
    }
  }

  for (const task of tasks) {
    try {
      const fp = await task();
      results.push(fp);
    } catch (e) {
      errors.push(e.message);
    }
  }

  return { folder: soutFolder, results, errors };
}

// ─── Вспомогательные функции ──────────────────────────────
function numToWords(n) {
  const words = ['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать'];
  return words[n] || String(n);
}

function pluralRabochihMest(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'рабочее место';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'рабочих места';
  return 'рабочих мест';
}

function pluralListov(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'листа';
  return 'листов';
}

function pluralChelovek(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'человек';
  return 'человек';
}

function getGitName(region) {
  if (!region) return 'субъекте РФ';
  if (region.includes('Краснодар')) return 'Краснодарском крае';
  if (region.includes('Москва')) return 'г. Москве';
  if (region.includes('Санкт-Петербург')) return 'г. Санкт-Петербурге';
  if (region.includes('Московская')) return 'Московской области';
  if (region.includes('Ростов')) return 'Ростовской области';
  if (region.includes('Ставрополь')) return 'Ставропольском крае';
  return region;
}

module.exports = {
  generateSoutPackage,
  gen_sout_01, gen_sout_02, gen_sout_03, gen_sout_04,
  gen_sout_05, gen_sout_06, gen_sout_07, gen_sout_08,
  gen_sout_09, gen_sout_10,
  SOUT_FACTORS,
};
