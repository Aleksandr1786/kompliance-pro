'use strict';
/**
 * КомплаенсПро — generator.js
 * Генератор документов по охране труда
 * 7 разделов, 41 документ
 *
 * Главная функция: generatePackage(client, settings, outputDir)
 *
 * client = {
 *   name,             // 'ООО "Абилон"' или 'ИП Иванов И.И.'
 *   form,             // 'ООО' | 'ИП' | 'АО' | 'ПАО' и т.д.
 *   okved,            // '82.11'
 *   okved_name,       // 'Деятельность офисная'
 *   staff,            // 5  (численность)
 *   region,           // 'Краснодарский край'
 *   manager_name,     // 'Свинцов А.А.'
 *   manager_name_full,// 'Свинцов Александр Александрович'
 *   manager_position, // 'Генеральный директор'
 *   manager_dative,   // 'Свинцову Александру Александровичу'
 *   ot_name,          // ответственный за ОТ (ФИО кратко)
 *   ot_name_full,     // полностью
 *   ot_position,      // должность
 *   ot_dative,        // дательный
 *   address,          // юр. адрес
 *   inn,              // ИНН
 *   phone,
 *   city,             // 'Новороссийск'
 *   doc_date,         // '01.03.2026'
 *   doc_year,         // '2026'
 * }
 *
 * settings = {
 *   user_name,        // 'А.А. Свинцов'  (специалист-аутсорсер)
 *   user_position,    // 'Специалист по охране труда'
 *   company_name,     // название аутсорс-компании
 *   company_inn,
 * }
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TabStopType, TabStopPosition, PageOrientation,
} = require('docx');

const fs   = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════════
//  КОНСТАНТЫ И УТИЛИТЫ
// ════════════════════════════════════════════════════════════

const FONT    = 'Times New Roman';
const SZ      = 24;   // 12pt
const SZ_SM   = 20;   // 10pt
const SZ_H    = 28;   // 14pt

// Поля A4 портрет (DXA): левое 3 см, правое 1.5 см, верх/низ 2 см
const MARGIN_PORT = { top: 1134, right: 851, bottom: 1134, left: 1701 };
// Поля A4 альбом
const MARGIN_LAND = { top: 720,  right: 720,  bottom: 720,  left: 1134 };

// Ширина контента для A4 портрет с полями 3+1.5 см ≈ 9072 DXA
const CW = 9072;

const BORDER = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDERS_NONE = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 2, color: '888888' };
const BORDERS_THIN = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

// ─── Абзац ───────────────────────────────────────────────
function p(text, opts = {}) {
  const runs = Array.isArray(text)
    ? text.map(t => new TextRun({ text: t.text, bold: t.bold, size: opts.size || SZ, font: FONT }))
    : [new TextRun({ text, bold: opts.bold, size: opts.size || SZ, font: FONT })];
  return new Paragraph({
    alignment: opts.align !== undefined ? opts.align : AlignmentType.BOTH,
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60, line: 276 },
    indent: opts.indent ? { firstLine: 720 } : undefined,
    children: runs,
  });
}

function pCenter(text, opts = {}) {
  return p(text, { ...opts, align: AlignmentType.CENTER });
}
function pRight(text, opts = {}) {
  return p(text, { ...opts, align: AlignmentType.RIGHT });
}

// ─── Пустые строки ───────────────────────────────────────
function emptyLines(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: '', size: SZ, font: FONT })] })
  );
}

// ─── Заголовок документа (жирный по центру) ──────────────
function docTitle(text, size = SZ_H) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
    children: [new TextRun({ text, bold: true, size, font: FONT })],
  });
}

// ─── Заголовок раздела ────────────────────────────────────
function secTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, size: SZ, font: FONT })],
  });
}

// ─── Маркированный пункт ─────────────────────────────────
function bul(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40, line: 276 },
    children: [new TextRun({ text, size: opts.size || SZ, font: FONT })],
  });
}

// ─── Нумерованный пункт ──────────────────────────────────
function num(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'ordered', level: 0 },
    spacing: { before: 50, after: 50, line: 276 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size || SZ, font: FONT })],
  });
}

// ─── Ячейка таблицы ──────────────────────────────────────
function cell(text, width, opts = {}) {
  return new TableCell({
    borders: opts.noBorder ? BORDERS_NONE : (opts.thin ? BORDERS_THIN : BORDERS),
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: opts.vAlign || VerticalAlign.CENTER,
    rowSpan: opts.rowSpan,
    columnSpan: opts.colSpan,
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: opts.bold, size: opts.size || SZ, font: FONT })],
    })],
  });
}

// ─── Строка таблицы ──────────────────────────────────────
function row(cells) {
  return new TableRow({ children: cells });
}

// ─── Простая таблица ─────────────────────────────────────
function simpleTable(colWidths, rows) {
  return new Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

// ─── Блок «УТВЕРЖДАЮ» (только должность + ФИО) ───────────
function approvalBlock(client) {
  // Располагается справа; используем таблицу без рамок
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [CW / 2, CW / 2],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideH: NO_BORDER, insideV: NO_BORDER,
    },
    rows: [new TableRow({
      children: [
        new TableCell({ borders: BORDERS_NONE, width: { size: CW / 2, type: WidthType.DXA }, children: [new Paragraph('')] }),
        new TableCell({ borders: BORDERS_NONE, width: { size: CW / 2, type: WidthType.DXA }, children: [
          p('УТВЕРЖДАЮ', { bold: true, align: AlignmentType.LEFT }),
          p(client.manager_position, { align: AlignmentType.LEFT }),
          p('__________  ' + client.manager_name, { align: AlignmentType.LEFT }),
          p('«___» ____________ ' + client.doc_year + ' г.', { align: AlignmentType.LEFT }),
        ]}),
      ],
    })],
  });
}

// ─── Строки подписей в конце документа ───────────────────
function signBlock(client, settings) {
  return [
    ...emptyLines(2),
    p([{ text: client.manager_position + ':  ', bold: false }, { text: '________________  ' + client.manager_name }]),
    ...emptyLines(1),
    p([{ text: 'Разработал:  ', bold: false }, { text: '________________  ' }]),
  ];
}

// ─── Колонтитул ──────────────────────────────────────────
function makeFooter(label) {
  return new Footer({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: label, size: 18, font: FONT, color: '888888' }),
      new TextRun({ text: '\t', size: 18 }),
      new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT, color: '888888' }),
    ],
  })] });
}

// ─── Шапка приказа ────────────────────────────────────────
function orderHeader(client, number, subject) {
  return [
    pRight(client.name),
    ...emptyLines(1),
    docTitle('ПРИКАЗ'),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: `г. ${client.city}`, size: SZ, font: FONT }),
        new TextRun({ text: `\t№ ${number} от ${client.doc_date}`, size: SZ, font: FONT }),
      ],
    }),
    ...emptyLines(1),
    pCenter(subject, { bold: true }),
  ];
}

// ─── Подпись приказа ──────────────────────────────────────
function orderSignature(client) {
  return [
    ...emptyLines(2),
    p(client.manager_position + ':'),
    ...emptyLines(1),
    p('________________  ' + client.manager_name),
  ];
}

// ─── Нормативная преамбула для приказов ───────────────────
function orderPreamble(text) {
  return p('В соответствии с ' + text, { indent: true });
}

// ─── ПРИКАЗЫВАЮ ───────────────────────────────────────────
function orderCommand() {
  return p('ПРИКАЗЫВАЮ:', { bold: true });
}

// ─── Сборка и сохранение документа ───────────────────────
async function saveDoc(sections, outputDir, filename) {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: SZ } } },
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '\u2013',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
        {
          reference: 'ordered',
          levels: [{
            level: 0, format: LevelFormat.DECIMAL, text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
        {
          reference: 'ordered2',
          levels: [{
            level: 0, format: LevelFormat.DECIMAL, text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    sections,
  });
  const buf = await Packer.toBuffer(doc);
  const fullPath = path.join(outputDir, filename);
  fs.writeFileSync(fullPath, buf);
  return filename;
}

// ─── Вспомогательная: название организации правильным образом ─
function orgName(client) {
  // ИП — без кавычек, ООО/АО/ПАО — с кавычками (если ещё нет)
  const name = client.name || '';
  return name; // предполагаем что name уже полное с формой собственности
}

// ════════════════════════════════════════════════════════════
//  РАЗДЕЛ 01 — ОРГАНИЗАЦИОННО-РАСПОРЯДИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ
// ════════════════════════════════════════════════════════════

// 01.01 — Политика в области охраны труда
async function gen_01_01(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПОЛИТИКА В ОБЛАСТИ ОХРАНЫ ТРУДА'),
    pCenter(orgName(client).toUpperCase()),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p(`${orgName(client)} (далее — Организация) признаёт охрану труда безусловным приоритетом своей деятельности и принимает обязательства по обеспечению безопасных условий труда для каждого работника.`, { indent: true }),
    p('Настоящая Политика разработана в соответствии с Трудовым кодексом Российской Федерации (ст. 209–231), Постановлением Правительства РФ от 24.12.2021 № 2464 и иными нормативными правовыми актами в сфере охраны труда.', { indent: true }),
    p('Политика распространяется на всех работников Организации без исключения.', { indent: true }),

    secTitle('2. Цели и обязательства'),
    p('Организация принимает на себя обязательства:', { indent: true }),
    bul('соблюдать требования законодательства РФ в сфере охраны труда;'),
    bul('выявлять опасности, оценивать и снижать профессиональные риски;'),
    bul('предупреждать производственный травматизм и профессиональные заболевания;'),
    bul('проводить своевременное обучение и инструктаж работников;'),
    bul('обеспечивать работников средствами индивидуальной защиты;'),
    bul('расследовать несчастные случаи и устранять их причины;'),
    bul('непрерывно совершенствовать систему управления охраной труда.'),

    secTitle('3. Ответственность руководства'),
    p(`${client.manager_position} ${orgName(client)} несёт персональную ответственность за организацию работы по охране труда, выделение необходимых ресурсов и соблюдение требований законодательства.`, { indent: true }),

    secTitle('4. Обязанности работников'),
    p('Каждый работник обязан соблюдать требования охраны труда, применять выданные СИЗ, немедленно сообщать руководителю о любой ситуации, угрожающей жизни и здоровью.', { indent: true }),

    secTitle('5. Информирование'),
    p('Политика размещается на информационных стендах и доводится до каждого работника при вводном инструктаже. Актуальная редакция доступна у ответственного за охрану труда.', { indent: true }),

    secTitle('6. Пересмотр'),
    p(`Политика пересматривается не реже одного раза в год, а также при изменении законодательства или условий деятельности Организации.`, { indent: true }),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.01') },
    children,
  }], dir, '01.01_Политика_ОТ.docx');
}

// 01.02 — Положение о СУОТ
async function gen_01_02(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПОЛОЖЕНИЕ'),
    docTitle('о системе управления охраной труда (СУОТ)', SZ),
    pCenter(orgName(client)),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p('1.1. Настоящее Положение устанавливает структуру, цели, задачи и порядок функционирования системы управления охраной труда (СУОТ) в Организации.', { indent: true }),
    p('1.2. Положение разработано в соответствии с Трудовым кодексом РФ, Приказом Минтруда России от 29.10.2021 № 776н, Постановлением Правительства РФ от 24.12.2021 № 2464.', { indent: true }),
    p(`1.3. Действие Положения распространяется на всех работников ${orgName(client)}.`, { indent: true }),

    secTitle('2. Политика и цели в области охраны труда'),
    p('2.1. Политика в области охраны труда является основополагающим документом СУОТ, определяет стратегические обязательства и цели Организации.', { indent: true }),
    p('2.2. Цели в области охраны труда устанавливаются ежегодно Планом мероприятий.', { indent: true }),

    secTitle('3. Структура управления и ответственность'),
    p(`3.1. Общее руководство охраной труда осуществляет ${client.manager_position}.`, { indent: true }),
    p(`3.2. Непосредственную организацию работы по охране труда осуществляет ${client.ot_position || client.manager_position} ${client.ot_name || client.manager_name}, назначенный(-ая) приказом.`, { indent: true }),
    p('3.3. Каждый работник несёт ответственность за соблюдение требований охраны труда на своём рабочем месте.', { indent: true }),

    secTitle('4. Ресурсное обеспечение'),
    p('4.1. Финансирование мероприятий по охране труда осуществляется в размере не менее 0,2% от суммы затрат на производство продукции (выполнение работ, оказание услуг).', { indent: true }),
    p('4.2. Работники обеспечиваются необходимыми СИЗ, санитарно-бытовыми помещениями, аптечками первой помощи.', { indent: true }),

    secTitle('5. Управление профессиональными рисками'),
    p('5.1. В Организации на постоянной основе проводится идентификация опасностей и оценка уровней профессиональных рисков.', { indent: true }),
    p('5.2. Специальная оценка условий труда (СОУТ) проводится в порядке, установленном Федеральным законом от 28.12.2013 № 426-ФЗ.', { indent: true }),
    p('5.3. По результатам оценки рисков разрабатываются и реализуются меры управления: устранение, замена, инженерные меры, административные меры, применение СИЗ.', { indent: true }),

    secTitle('6. Обучение и инструктажи'),
    p('6.1. Все работники проходят вводный инструктаж при приёме на работу, первичный инструктаж на рабочем месте, повторный инструктаж — не реже 1 раза в 6 месяцев.', { indent: true }),
    p('6.2. Обучение по охране труда, пожарно-техническому минимуму и оказанию первой помощи — не реже 1 раза в 3 года в аккредитованных учебных центрах.', { indent: true }),

    secTitle('7. Контроль и мониторинг'),
    p('7.1. Контроль функционирования СУОТ осуществляется в форме трёхступенчатого контроля: оперативный — ежедневно, периодический — ежеквартально, итоговый — ежегодно.', { indent: true }),
    p('7.2. Результаты контроля документируются. По итогам анализа принимаются корректирующие меры.', { indent: true }),

    secTitle('8. Документирование'),
    p('8.1. Документация СУОТ хранится у ответственного за охрану труда в течение сроков, установленных законодательством РФ.', { indent: true }),
    p('8.2. Перечень документов СУОТ: настоящее Положение, Политика ОТ, инструкции по ОТ, программы инструктажей, журналы учёта, приказы, планы мероприятий.', { indent: true }),

    secTitle('9. Расследование происшествий'),
    p('9.1. Расследование несчастных случаев и микротравм проводится в порядке, установленном ст. 227–231 Трудового кодекса РФ и Приказом Минтруда России от 20.04.2022 № 223н.', { indent: true }),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.02') },
    children,
  }], dir, '01.02_Положение_СУОТ.docx');
}

// 01.03 — Приказ об утверждении документации по ОТ (№03)
async function gen_01_03(client, settings, dir) {
  const children = [
    ...orderHeader(client, '03', 'Об утверждении документации по охране труда'),
    ...emptyLines(1),
    orderPreamble('требованиями Трудового кодекса Российской Федерации (ст. 214, 222, 223), Постановления Правительства РФ от 24.12.2021 № 2464,'),
    orderCommand(),
    num(`Утвердить и ввести в действие с ${client.doc_date} следующие документы по охране труда:`),
    bul('Политику в области охраны труда;'),
    bul('Положение о системе управления охраной труда (СУОТ);'),
    bul('Положение о порядке обучения по охране труда;'),
    bul('Положение о разработке инструкций по охране труда;'),
    bul('Положение об учёте и рассмотрении микротравм;'),
    bul('Правила внутреннего трудового распорядка;'),
    bul('Положение об обеспечении работников СИЗ и смывающими средствами;'),
    bul('Инструкции по охране труда (согласно отдельному приказу).'),
    num(`Назначить ответственным за хранение и актуализацию документов по охране труда ${client.ot_position || client.manager_position} ${client.ot_name_full || client.manager_name_full || client.ot_name || client.manager_name}.`),
    num('Пересматривать документы не реже одного раза в 5 лет, а также при изменении законодательства.'),
    num('Контроль за исполнением приказа оставляю за собой.'),
    ...orderSignature(client),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.03') },
    children,
  }], dir, '01.03_Приказ_03_утверждение_документации.docx');
}

// 01.04 — Приказ о назначении ответственных (№04)
async function gen_01_04(client, settings, dir) {
  const otName = client.ot_name_full || client.ot_name || client.manager_name;
  const otPos  = client.ot_position || client.manager_position;
  const otDat  = client.ot_dative   || client.manager_dative || otName;

  const children = [
    ...orderHeader(client, '04', 'О назначении ответственных лиц по охране труда'),
    ...emptyLines(1),
    orderPreamble('требованиями ст. 214, 217 Трудового кодекса Российской Федерации,'),
    orderCommand(),
    num(`Назначить ответственным за организацию работы по охране труда в ${orgName(client)} ${otPos} ${otName}.`),
    num(`Возложить на ${otDat} следующие обязанности:`),
    bul('организация и контроль работы по охране труда;'),
    bul('проведение вводных инструктажей с работниками;'),
    bul('контроль проведения первичных и повторных инструктажей на рабочих местах;'),
    bul('ведение журналов учёта инструктажей;'),
    bul('разработка и актуализация документации по охране труда;'),
    bul('мониторинг изменений законодательства в сфере охраны труда;'),
    bul('организация медицинских осмотров (при необходимости).'),
    num(`Всем работникам ${orgName(client)} выполнять требования охраны труда и исполнять указания ответственного лица.`),
    num('Контроль за исполнением приказа оставляю за собой.'),
    ...orderSignature(client),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.04') },
    children,
  }], dir, '01.04_Приказ_04_назначение_ответственных.docx');
}

// 01.05 — План мероприятий по охране труда
async function gen_01_05(client, settings, dir) {
  const yr  = client.doc_year;
  const otN = client.ot_name || client.manager_name;
  const mgrN = client.manager_name;

  const colW = [400, 3700, 1500, 1700, 1372]; // сумма = CW ≈ 9072 (ост.)
  const hdr  = row([
    cell('№', colW[0], { bold: true, center: true }),
    cell('Наименование мероприятия', colW[1], { bold: true, center: true }),
    cell('Срок', colW[2], { bold: true, center: true }),
    cell('Ответственный', colW[3], { bold: true, center: true }),
    cell('Отметка', colW[4], { bold: true, center: true }),
  ]);

  const planItems = [
    ['1',  'Проведение вводного инструктажа по ОТ со всеми вновь принятыми работниками',           'При приёме',       otN, ''],
    ['2',  'Проведение повторных инструктажей на рабочих местах',                                   '1 раз в 6 мес.',   otN, ''],
    ['3',  'Обучение и проверка знаний по ОТ (аккредитованный учебный центр)',                      yr + ' год',        mgrN, ''],
    ['4',  'Обучение оказанию первой помощи пострадавшим',                                          yr + ' год',        mgrN, ''],
    ['5',  'Противопожарный инструктаж',                                                            yr + ' год',        otN, ''],
    ['6',  'Проверка наличия и комплектности аптечек первой помощи',                                'Ежеквартально',    otN, ''],
    ['7',  'Присвоение I группы по электробезопасности неэлектротехническому персоналу',            'I кв. ' + yr,      otN, ''],
    ['8',  'Актуализация инструкций по охране труда',                                               'I кв. ' + yr,      otN, ''],
    ['9',  'Актуализация документации СУОТ при изменении НПА',                                      'По необходимости', otN, ''],
    ['10', 'Мониторинг изменений нормативно-правовых актов по ОТ',                                  'Ежеквартально',    otN, ''],
    ['11', 'Подготовка отчётности: форма №1-Т, ЕФС-1 Раздел 2',                                    'Январь ' + yr,     mgrN, ''],
    ['12', 'Проверка соответствия рабочих мест требованиям охраны труда',                           'II кв. ' + yr,     otN, ''],
  ];

  const dataRows = planItems.map(r =>
    row(r.map((t, i) => cell(t, colW[i], { center: i === 0 || i === 4, size: SZ_SM })))
  );

  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle(`ПЛАН МЕРОПРИЯТИЙ ПО ОХРАНЕ ТРУДА НА ${yr} ГОД`),
    pCenter(orgName(client)),
    ...emptyLines(1),
    simpleTable(colW, [hdr, ...dataRows]),
    ...emptyLines(2),
    p(`${client.ot_position || client.manager_position} (ответственный за ОТ):  ________________  ${otN}`),
  ];

  // Альбомная ориентация для таблицы
  return saveDoc([{
    properties: {
      page: {
        size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
        margin: MARGIN_LAND,
      },
    },
    footers: { default: makeFooter('01.05') },
    children,
  }], dir, '01.05_План_мероприятий_ОТ.docx');
}

// 01.06 — Приказ об утверждении инструкций по ОТ (№05)
async function gen_01_06(client, settings, dir) {
  const children = [
    ...orderHeader(client, '05', 'Об утверждении инструкций по охране труда'),
    ...emptyLines(1),
    orderPreamble('требованиями ст. 214 Трудового кодекса РФ, Приказа Минтруда России от 29.10.2021 № 772н,'),
    orderCommand(),
    num(`Утвердить и ввести в действие с ${client.doc_date} инструкции по охране труда:`),
    bul('№ 01-ИОТ — для руководителя организации;'),
    bul('№ 02-ИОТ — для работников офиса;'),
    bul('№ 03-ИОТ — при работе с ПЭВМ и оргтехникой;'),
    bul('№ 04-ИОТ — при эксплуатации копировально-множительной техники;'),
    bul('№ 05-ИОТ — о порядке использования аптечки первой помощи.'),
    num(`Ознакомить работников с инструкциями под роспись. Ответственный — ${client.ot_position || client.manager_position} ${client.ot_name_full || client.ot_name || client.manager_name}.`),
    num('Инструкции хранить в доступном для работников месте. Пересматривать не реже 1 раза в 5 лет.'),
    num('Контроль за исполнением приказа оставляю за собой.'),
    ...orderSignature(client),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.06') },
    children,
  }], dir, '01.06_Приказ_05_утверждение_инструкций.docx');
}

// 01.07 — Приказ о назначении ответственного за ДСИЗ (№06)
async function gen_01_07(client, settings, dir) {
  const dsizName = client.dsiz_name_full || client.ot_name_full || client.ot_name || client.manager_name;
  const dsizPos  = client.dsiz_position  || client.ot_position  || client.manager_position;
  const dsizDat  = client.dsiz_dative    || client.ot_dative    || dsizName;

  const children = [
    ...orderHeader(client, '06', 'О назначении ответственного за обеспечение работников СИЗ и смывающими средствами'),
    ...emptyLines(1),
    orderPreamble('требованиями ст. 214 Трудового кодекса РФ, Приказа Минтруда России от 29.10.2021 № 766н,'),
    orderCommand(),
    num(`Назначить ответственным за организацию обеспечения работников ${orgName(client)} средствами индивидуальной защиты и смывающими средствами (далее — ДСИЗ) ${dsizPos} ${dsizName}.`),
    num(`Возложить на ${dsizDat} следующие обязанности:`),
    bul('ведение учёта выдачи СИЗ и смывающих средств;'),
    bul('контроль соответствия СИЗ техническим регламентам и нормам выдачи;'),
    bul('организация стирки, чистки, дезинфекции и ремонта СИЗ;'),
    bul('списание пришедших в негодность СИЗ в установленном порядке;'),
    bul('хранение документации по ДСИЗ.'),
    num('Контроль за исполнением приказа оставляю за собой.'),
    ...orderSignature(client),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.07') },
    children,
  }], dir, '01.07_Приказ_06_ответственный_ДСИЗ.docx');
}

// 01.08 — Приказ об обеспечении аптечками (№07)
async function gen_01_08(client, settings, dir) {
  const children = [
    ...orderHeader(client, '07', 'Об обеспечении работников аптечками первой помощи'),
    ...emptyLines(1),
    orderPreamble('требованиями ст. 223 Трудового кодекса РФ, Приказа Минздрава России от 24.05.2024 № 262н,'),
    orderCommand(),
    num(`Обеспечить наличие аптечки первой помощи работникам в офисе ${orgName(client)}.`),
    num(`Назначить ${client.ot_position || client.manager_position} ${client.ot_name_full || client.ot_name || client.manager_name} ответственным за:`),
    bul('своевременное пополнение аптечки (проверка — не реже 1 раза в 6 месяцев);'),
    bul('ведение журнала контроля аптечки;'),
    bul('ознакомление работников с местом нахождения аптечки и правилами использования.'),
    num('Аптечку разместить в доступном, известном всем работникам месте. Запрещается использование содержимого аптечки в иных целях.'),
    num('Контроль за исполнением приказа оставляю за собой.'),
    ...orderSignature(client),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.08') },
    children,
  }], dir, '01.08_Приказ_07_аптечки.docx');
}

// 01.09 — Приказ о назначении ответственного за электрохозяйство (№08)
async function gen_01_09(client, settings, dir) {
  const elecName = client.elec_name_full || client.ot_name_full || client.ot_name || client.manager_name;
  const elecPos  = client.elec_position  || client.ot_position  || client.manager_position;

  const children = [
    ...orderHeader(client, '08', 'О назначении ответственного за электрохозяйство'),
    ...emptyLines(1),
    orderPreamble('требованиями Правил технической эксплуатации электроустановок потребителей (Приказ Минэнерго России от 12.08.2022 № 811), Правил по охране труда при эксплуатации электроустановок (Приказ Минтруда России от 15.12.2020 № 903н),'),
    orderCommand(),
    num(`Назначить ответственным за безопасную эксплуатацию электроустановок ${orgName(client)} ${elecPos} ${elecName}.`),
    num(`Возложить следующие обязанности:`),
    bul('организация безопасной эксплуатации электрооборудования;'),
    bul('обеспечение проведения инструктажа по электробезопасности;'),
    bul('присвоение I группы по электробезопасности неэлектротехническому персоналу с записью в журнале;'),
    bul('контроль технического состояния электрооборудования;'),
    bul('ведение документации по электрохозяйству.'),
    num('Контроль за исполнением приказа оставляю за собой.'),
    ...orderSignature(client),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.09') },
    children,
  }], dir, '01.09_Приказ_08_электрохозяйство.docx');
}

// 01.10 — Приказ об утверждении программ обучения (№09)
async function gen_01_10(client, settings, dir) {
  const children = [
    ...orderHeader(client, '09', 'Об утверждении программ обучения по охране труда'),
    ...emptyLines(1),
    orderPreamble('требованиями Постановления Правительства РФ от 24.12.2021 № 2464 «О порядке обучения по охране труда»,'),
    orderCommand(),
    num(`Утвердить и ввести в действие с ${client.doc_date} следующие программы обучения:`),
    bul('№ 01-ПИ — Программа вводного инструктажа по охране труда;'),
    bul('№ 02-ПИ — Программа первичного инструктажа на рабочем месте;'),
    bul('№ 03-ПИ — Программа противопожарного инструктажа.'),
    num(`Ответственным за проведение инструктажей назначить ${client.ot_position || client.manager_position} ${client.ot_name_full || client.ot_name || client.manager_name}.`),
    num('Программы пересматривать при изменении НПА, технологий и условий труда, но не реже 1 раза в 3 года.'),
    num('Контроль за исполнением приказа оставляю за собой.'),
    ...orderSignature(client),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('01.10') },
    children,
  }], dir, '01.10_Приказ_09_программы_обучения.docx');
}

// ════════════════════════════════════════════════════════════
//  РАЗДЕЛ 02 — ЛОКАЛЬНЫЕ НОРМАТИВНЫЕ АКТЫ
// ════════════════════════════════════════════════════════════

// 02.01 — Положение о порядке обучения по охране труда
async function gen_02_01(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПОЛОЖЕНИЕ'),
    docTitle('о порядке обучения по охране труда', SZ),
    pCenter(orgName(client)),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p('1.1. Настоящее Положение определяет виды, порядок и периодичность обучения работников по охране труда.', { indent: true }),
    p('1.2. Положение разработано в соответствии с Постановлением Правительства РФ от 24.12.2021 № 2464 «О порядке обучения по охране труда и проверки знания требований охраны труда».', { indent: true }),
    p(`1.3. Действие Положения распространяется на всех работников ${orgName(client)}.`, { indent: true }),

    secTitle('2. Виды обучения и инструктажей'),
    p('2.1. В Организации проводятся следующие виды инструктажей:', { indent: true }),
    bul('вводный инструктаж — при приёме каждого нового работника;'),
    bul('первичный инструктаж на рабочем месте — до начала самостоятельной работы;'),
    bul('повторный инструктаж — не реже 1 раза в 6 месяцев;'),
    bul('внеплановый инструктаж — при изменении условий труда, после несчастных случаев, по требованию органов надзора;'),
    bul('целевой инструктаж — при выполнении разовых работ, ликвидации аварий.'),
    p('2.2. Виды обучения, проводимые в аккредитованных учебных организациях (не реже 1 раза в 3 года):', { indent: true }),
    bul('обучение по охране труда и проверка знаний;'),
    bul('обучение пожарной безопасности (пожарно-технический минимум);'),
    bul('обучение оказанию первой помощи пострадавшим.'),

    secTitle('3. Порядок проведения инструктажей'),
    p('3.1. Вводный инструктаж проводит ответственный за охрану труда по Программе вводного инструктажа (№ 01-ПИ).', { indent: true }),
    p('3.2. Первичный и повторный инструктажи на рабочем месте проводит непосредственный руководитель по Программе первичного инструктажа (№ 02-ПИ).', { indent: true }),
    p('3.3. Каждый вид инструктажа завершается проверкой знаний и записью в соответствующем журнале учёта.', { indent: true }),

    secTitle('4. Учёт обучения'),
    p('4.1. Проведение инструктажей фиксируется в журналах с подписями инструктирующего и инструктируемого.', { indent: true }),
    p('4.2. Ведётся реестр сотрудников с датами обучения, сроками действия и данными удостоверений.', { indent: true }),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('02.01') },
    children,
  }], dir, '02.01_Положение_обучение_ОТ.docx');
}

// 02.02 — Положение об организации работы по охране труда
async function gen_02_02(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПОЛОЖЕНИЕ'),
    docTitle('об организации работы по охране труда', SZ),
    pCenter(orgName(client)),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p(`1.1. Настоящее Положение определяет порядок организации работы по охране труда в ${orgName(client)}.`, { indent: true }),
    p('1.2. Положение разработано в соответствии с Трудовым кодексом РФ (раздел X), Постановлением Правительства РФ от 24.12.2021 № 2464.', { indent: true }),

    secTitle('2. Обязанности работодателя'),
    p('2.1. Работодатель обязан:', { indent: true }),
    bul('обеспечить безопасные условия и охрану труда (ст. 214 ТК РФ);'),
    bul('расследовать и учитывать несчастные случаи и микротравмы;'),
    bul('проводить специальную оценку условий труда;'),
    bul('обеспечивать работников СИЗ и смывающими средствами;'),
    bul('финансировать мероприятия по охране труда.'),

    secTitle('3. Права и обязанности работников'),
    p('3.1. Работник имеет право на рабочее место, соответствующее требованиям охраны труда, получение информации об условиях труда, отказ от работы в случае опасности для жизни.', { indent: true }),
    p('3.2. Работник обязан соблюдать требования охраны труда, применять СИЗ, немедленно извещать руководителя о любой опасной ситуации или несчастном случае.', { indent: true }),

    secTitle('4. Контроль и надзор'),
    p('4.1. Контроль за соблюдением требований охраны труда осуществляет ответственный за охрану труда и руководитель Организации.', { indent: true }),
    p('4.2. Государственный надзор и контроль осуществляется Государственной инспекцией труда.', { indent: true }),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('02.02') },
    children,
  }], dir, '02.02_Положение_организация_ОТ.docx');
}

// 02.03 — Положение о разработке инструкций по охране труда
async function gen_02_03(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПОЛОЖЕНИЕ'),
    docTitle('о разработке, согласовании и пересмотре инструкций по охране труда', SZ),
    pCenter(orgName(client)),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p('1.1. Настоящее Положение устанавливает порядок разработки, согласования, утверждения, регистрации, хранения, пересмотра и отмены инструкций по охране труда.', { indent: true }),
    p('1.2. Положение разработано в соответствии с Приказом Минтруда России от 29.10.2021 № 772н «Об утверждении Основных требований к порядку разработки и содержанию правил и инструкций по охране труда».', { indent: true }),

    secTitle('2. Структура инструкции по охране труда'),
    p('2.1. Инструкция по охране труда должна содержать следующие разделы:', { indent: true }),
    bul('общие требования охраны труда;'),
    bul('требования охраны труда перед началом работы;'),
    bul('требования охраны труда во время работы;'),
    bul('требования охраны труда в аварийных ситуациях;'),
    bul('требования охраны труда по окончании работы.'),

    secTitle('3. Порядок разработки и утверждения'),
    p('3.1. Инструкции разрабатываются ответственным за охрану труда на основе типовых инструкций, анализа условий труда и требований НПА.', { indent: true }),
    p('3.2. Инструкции утверждаются приказом руководителя Организации.', { indent: true }),
    p('3.3. Работники знакомятся с инструкциями под роспись при первичном инструктаже и при пересмотре.', { indent: true }),

    secTitle('4. Пересмотр инструкций'),
    p('4.1. Инструкции пересматриваются:', { indent: true }),
    bul('не реже одного раза в 5 лет (плановый пересмотр);'),
    bul('при изменении условий труда или технологического процесса;'),
    bul('по требованию органов надзора и контроля;'),
    bul('после расследования несчастного случая.'),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('02.03') },
    children,
  }], dir, '02.03_Положение_разработка_инструкций.docx');
}

// 02.04 — Положение об учёте микротравм
async function gen_02_04(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПОЛОЖЕНИЕ'),
    docTitle('об особенностях расследования и учёта микроповреждений (микротравм)', SZ),
    pCenter(orgName(client)),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p('1.1. Настоящее Положение устанавливает порядок регистрации, расследования и учёта микроповреждений (микротравм) работников.', { indent: true }),
    p('1.2. Положение разработано в соответствии со ст. 226 Трудового кодекса РФ, Приказом Минтруда России от 15.09.2021 № 632н.', { indent: true }),
    p('1.3. Микроповреждение (микротравма) — ссадины, кровоподтёки, ушибы мягких тканей, поверхностные раны и другие незначительные повреждения, не повлёкшие расстройства здоровья и потери трудоспособности.', { indent: true }),

    secTitle('2. Порядок учёта и расследования'),
    p('2.1. Работник, получивший микротравму, обязан немедленно сообщить об этом своему непосредственному руководителю.', { indent: true }),
    p('2.2. Ответственный за охрану труда в течение суток с момента получения сообщения:', { indent: true }),
    bul('рассматривает обстоятельства и причины микротравмы;'),
    bul('фиксирует факт получения микротравмы в журнале учёта микроповреждений;'),
    bul('разрабатывает меры по недопущению повторных случаев.'),
    p('2.3. Медицинская помощь работнику оказывается из аптечки первой помощи.', { indent: true }),

    secTitle('3. Документирование'),
    p('3.1. Учёт микротравм ведётся в журнале учёта микроповреждений (микротравм) работников.', { indent: true }),
    p('3.2. Ежеквартально ответственный за охрану труда анализирует данные журнала для выявления системных причин и разработки профилактических мер.', { indent: true }),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('02.04') },
    children,
  }], dir, '02.04_Положение_микротравмы.docx');
}

// 02.05 — Правила внутреннего трудового распорядка
async function gen_02_05(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПРАВИЛА ВНУТРЕННЕГО ТРУДОВОГО РАСПОРЯДКА'),
    pCenter(orgName(client)),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p(`1.1. Настоящие Правила внутреннего трудового распорядка (далее — Правила) регулируют порядок приёма и увольнения работников, основные права, обязанности и ответственность сторон трудового договора, режим работы и отдыха, применяемые меры поощрения и взыскания в ${orgName(client)}.`, { indent: true }),
    p('1.2. Правила разработаны в соответствии с Трудовым кодексом РФ (ст. 189, 190).', { indent: true }),

    secTitle('2. Порядок приёма и увольнения работников'),
    p('2.1. Работники принимаются на работу на основании трудового договора. При приёме предъявляются документы, предусмотренные ст. 65 ТК РФ.', { indent: true }),
    p('2.2. При приёме на работу работник знакомится под роспись с Правилами, должностной инструкцией, инструкциями по охране труда, локальными нормативными актами.', { indent: true }),
    p('2.3. Прекращение трудового договора осуществляется по основаниям, предусмотренным Трудовым кодексом РФ.', { indent: true }),

    secTitle('3. Режим рабочего времени и отдыха'),
    p('3.1. Для работников устанавливается пятидневная рабочая неделя с двумя выходными днями (суббота, воскресенье).', { indent: true }),
    p('3.2. Продолжительность рабочего дня — 8 часов. Начало работы — 09:00, окончание — 18:00.', { indent: true }),
    p('3.3. Перерыв для отдыха и питания — 1 час (с 13:00 до 14:00), в рабочее время не включается.', { indent: true }),
    p('3.4. Ежегодный оплачиваемый отпуск предоставляется продолжительностью 28 календарных дней.', { indent: true }),

    secTitle('4. Основные права и обязанности работников'),
    p('4.1. Работник имеет права, предусмотренные ст. 21 ТК РФ, в том числе право на безопасное рабочее место, своевременную оплату труда, защиту персональных данных.', { indent: true }),
    p('4.2. Работник обязан:', { indent: true }),
    bul('добросовестно исполнять трудовые обязанности;'),
    bul('соблюдать требования охраны труда, пожарной безопасности;'),
    bul('бережно относиться к имуществу Организации;'),
    bul('сообщать руководителю о возникновении опасных ситуаций.'),

    secTitle('5. Ответственность'),
    p('5.1. За нарушение трудовой дисциплины к работнику могут применяться дисциплинарные взыскания: замечание, выговор, увольнение (ст. 192 ТК РФ).', { indent: true }),
    p('5.2. Применение дисциплинарных взысканий, не предусмотренных ТК РФ, не допускается.', { indent: true }),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('02.05') },
    children,
  }], dir, '02.05_ПВТР.docx');
}

// 02.06 — Положение об обеспечении СИЗ и смывающими средствами
async function gen_02_06(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПОЛОЖЕНИЕ'),
    docTitle('об обеспечении работников средствами индивидуальной защиты и смывающими средствами', SZ),
    pCenter(orgName(client) + '  № 01-П'),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p('1.1. Настоящее Положение устанавливает порядок приобретения, выдачи, хранения, учёта, ухода и списания средств индивидуальной защиты (СИЗ) и смывающих средств.', { indent: true }),
    p('1.2. Положение разработано в соответствии с Приказом Минтруда России от 29.10.2021 № 766н «О порядке обеспечения работников средствами индивидуальной защиты и смывающими средствами».', { indent: true }),

    secTitle('2. Порядок выдачи СИЗ'),
    p('2.1. СИЗ выдаются работникам бесплатно по нормам, установленным по результатам оценки профессиональных рисков и СОУТ.', { indent: true }),
    p('2.2. Выдача СИЗ фиксируется в личной карточке учёта выдачи СИЗ и журнале учёта выдачи СИЗ.', { indent: true }),
    p('2.3. Работник расписывается в карточке учёта при получении каждого вида СИЗ.', { indent: true }),

    secTitle('3. Хранение и уход за СИЗ'),
    p('3.1. Работодатель организует хранение, стирку, сушку, ремонт и замену пришедших в негодность СИЗ за счёт собственных средств.', { indent: true }),
    p('3.2. СИЗ, выданные работнику, являются собственностью Организации и подлежат возврату при увольнении или истечении срока использования.', { indent: true }),

    secTitle('4. Смывающие средства'),
    p('4.1. Работники, занятые работами, связанными с загрязнением, обеспечиваются смывающими средствами в соответствии с нормами, установленными Приказом Минтруда № 766н.', { indent: true }),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('02.06') },
    children,
  }], dir, '02.06_Положение_СИЗ.docx');
}

// ════════════════════════════════════════════════════════════
//  РАЗДЕЛ 03 — ЭЛЕКТРОБЕЗОПАСНОСТЬ
// ════════════════════════════════════════════════════════════

// 03.01 — Приказ о назначении ответственного за электрохозяйство (дубль из 01.09, но в папку 03)
async function gen_03_01(client, settings, dir) {
  // Тот же документ что 01.09 — сохраняем копию в папку электробезопасности
  const elecName = client.elec_name_full || client.ot_name_full || client.ot_name || client.manager_name;
  const elecPos  = client.elec_position  || client.ot_position  || client.manager_position;

  const children = [
    ...orderHeader(client, '08', 'О назначении ответственного за электрохозяйство'),
    ...emptyLines(1),
    orderPreamble('требованиями Правил технической эксплуатации электроустановок потребителей (Приказ Минэнерго России от 12.08.2022 № 811), Правил по охране труда при эксплуатации электроустановок (Приказ Минтруда России от 15.12.2020 № 903н),'),
    orderCommand(),
    num(`Назначить ответственным за безопасную эксплуатацию электроустановок ${orgName(client)} ${elecPos} ${elecName}.`),
    num('Возложить следующие обязанности:'),
    bul('организация безопасной эксплуатации электрооборудования;'),
    bul('обеспечение проведения инструктажа по электробезопасности;'),
    bul('присвоение I группы по электробезопасности неэлектротехническому персоналу с записью в журнале;'),
    bul('контроль технического состояния электрооборудования;'),
    bul('ведение документации по электрохозяйству.'),
    num('Контроль за исполнением приказа оставляю за собой.'),
    ...orderSignature(client),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('03.01') },
    children,
  }], dir, '03.01_Приказ_08_электрохозяйство.docx');
}

// 03.02 — Журнал учёта присвоения I группы по электробезопасности
async function gen_03_02(client, settings, dir) {
  const colW = [500, 2200, 1800, 1000, 800, 1400, 1372];

  const hdr = row([
    cell('№', colW[0], { bold: true, center: true }),
    cell('ФИО работника', colW[1], { bold: true, center: true }),
    cell('Должность', colW[2], { bold: true, center: true }),
    cell('Дата', colW[3], { bold: true, center: true }),
    cell('Группа', colW[4], { bold: true, center: true }),
    cell('Кто проводил инструктаж', colW[5], { bold: true, center: true }),
    cell('Подпись', colW[6], { bold: true, center: true }),
  ]);

  const emptyRows = Array.from({ length: 20 }, (_, i) =>
    row(colW.map((w, j) => cell(j === 0 ? String(i + 1) : '', w, { center: j === 0, size: SZ_SM })))
  );

  const titlePage = [
    pCenter(orgName(client), { bold: true }),
    ...emptyLines(2),
    docTitle('ЖУРНАЛ УЧЁТА'),
    docTitle('присвоения группы I по электробезопасности', SZ),
    docTitle('неэлектротехническому персоналу', SZ),
    ...emptyLines(2),
    p(`Начат: «___» ____________ ${client.doc_year} г.`),
    p('Окончен: «___» ____________ ______ г.'),
    ...emptyLines(1),
    p(`Ответственный: ${client.elec_position || client.ot_position || client.manager_position}  ${client.elec_name || client.ot_name || client.manager_name}`),
  ];

  const mainPage = [
    new Paragraph({ children: [new PageBreak()] }),
    p('Инструктаж по электробезопасности с присвоением I группы проводится ответственным за электрохозяйство или работником из числа электротехнического персонала с группой не ниже III. Периодичность — 1 раз в год. Результаты фиксируются в настоящем журнале.', { size: SZ_SM }),
    ...emptyLines(1),
    simpleTable(colW, [hdr, ...emptyRows]),
  ];

  return saveDoc([{
    properties: {
      page: {
        size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
        margin: MARGIN_LAND,
      },
    },
    footers: { default: makeFooter('03.02') },
    children: [...titlePage, ...mainPage],
  }], dir, '03.02_Журнал_I_группа_электробезопасность.docx');
}

// 03.03 — Программа инструктажа по электробезопасности
async function gen_03_03(client, settings, dir) {
  const children = [
    approvalBlock(client),
    ...emptyLines(1),
    docTitle('ПРОГРАММА'),
    docTitle('инструктажа по электробезопасности', SZ),
    docTitle('с присвоением I группы неэлектротехническому персоналу', SZ),
    pCenter(orgName(client)),
    ...emptyLines(1),

    secTitle('1. Цель и область применения'),
    p('1.1. Программа предназначена для проведения инструктажа с работниками, не относящимися к электротехническому персоналу, но использующими в работе электроприборы и оргтехнику (компьютеры, принтеры, сканеры, телефоны).', { indent: true }),
    p('1.2. Цель: формирование базовых знаний по безопасному обращению с электроприборами и понимание опасности электрического тока.', { indent: true }),
    p('1.3. Нормативная основа: Приказ Минэнерго России от 12.08.2022 № 811; Приказ Минтруда России от 15.12.2020 № 903н.', { indent: true }),

    secTitle('2. Содержание инструктажа'),
    p('Тема 1. Опасность электрического тока (20 мин.):', { indent: true, bold: false }),
    bul('действие электрического тока на организм человека;'),
    bul('виды электрических травм (электрический удар, ожоги, электрометки);'),
    bul('факторы, влияющие на исход поражения током;'),
    bul('пороговые значения тока (0,1 мА — ощутимый, 10 мА — неотпускающий, 100 мА — смертельный).'),
    p('Тема 2. Безопасная эксплуатация электроприборов (20 мин.):', { indent: true }),
    bul('внешний осмотр перед включением: целостность корпуса, вилки, провода;'),
    bul('запрет на работу с повреждёнными приборами;'),
    bul('правила подключения к розеткам (не перегружать, не тянуть за провод);'),
    bul('запрет на самостоятельный ремонт электрооборудования;'),
    bul('порядок выключения приборов по окончании работы.'),
    p('Тема 3. Действия при поражении электрическим током (10 мин.):', { indent: true }),
    bul('немедленно отключить пострадавшего от источника тока (рубильник, выключатель);'),
    bul('при невозможности отключения — оттащить пострадавшего сухим непроводящим предметом;'),
    bul('вызвать скорую помощь (112);'),
    bul('до прибытия скорой — провести СЛР при необходимости.'),

    secTitle('3. Проверка знаний'),
    p('По итогам инструктажа проводится устная проверка знаний. Работник должен уметь:', { indent: true }),
    bul('назвать основные опасности при работе с электроприборами;'),
    bul('перечислить признаки неисправного оборудования;'),
    bul('описать действия при поражении током.'),
    p('Результат фиксируется в журнале учёта присвоения I группы с подписями инструктирующего и инструктируемого.', { indent: true }),

    secTitle('4. Периодичность'),
    p('Инструктаж проводится при приёме на работу и не реже 1 раза в год в последующем.', { indent: true }),

    ...signBlock(client, settings),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('03.03') },
    children,
  }], dir, '03.03_Программа_инструктаж_электробезопасность.docx');
}

// ════════════════════════════════════════════════════════════
//  РАЗДЕЛ 05 — ИНСТРУКЦИИ ПО ОХРАНЕ ТРУДА
// ════════════════════════════════════════════════════════════

// Шаблон инструкции по ОТ — используется для всех инструкций
function buildInstrukciya(num_instr, title_text, sections_content) {
  return (client, settings, dir, filename) => {
    const children = [
      approvalBlock(client),
      ...emptyLines(1),
      docTitle(`ИНСТРУКЦИЯ ПО ОХРАНЕ ТРУДА`),
      docTitle(title_text.toUpperCase(), SZ),
      pCenter(`${num_instr}  |  ${orgName(client)}`),
      ...emptyLines(1),
      ...sections_content,
      ...signBlock(client, settings),
    ];
    return saveDoc([{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
      footers: { default: makeFooter(num_instr) },
      children,
    }], dir, filename);
  };
}

// 05.01 — ИОТ для руководителя
async function gen_05_01(client, settings, dir) {
  const fn = buildInstrukciya('№ 01-ИОТ', 'для руководителя организации', [
    secTitle('1. Общие требования охраны труда'),
    p('1.1. К самостоятельной работе в должности руководителя допускаются лица, достигшие 18 лет, прошедшие вводный инструктаж, первичный инструктаж на рабочем месте и обучение по охране труда.', { indent: true }),
    p('1.2. Руководитель обязан знать требования законодательства в сфере охраны труда, пожарной безопасности и электробезопасности.', { indent: true }),
    p('1.3. Рабочее место: офис, рабочий стол, ПЭВМ. Основные вредные факторы: зрительное и психоэмоциональное напряжение, статическая нагрузка, электромагнитное излучение.', { indent: true }),
    p('1.4. Запрещается: работать при плохом освещении, с неисправной оргтехникой, игнорировать требования охраны труда.', { indent: true }),

    secTitle('2. Требования перед началом работы'),
    p('2.1. Осмотреть рабочее место, убедиться в порядке и исправности оборудования.', { indent: true }),
    p('2.2. Проверить исправность ПЭВМ, монитора, клавиатуры и мыши.', { indent: true }),
    p('2.3. Отрегулировать положение кресла, расстояние до монитора (50–70 см), освещённость.', { indent: true }),

    secTitle('3. Требования во время работы'),
    p('3.1. При работе с ПЭВМ делать перерывы не реже 1 раза в час (10–15 минут).', { indent: true }),
    p('3.2. Не допускать захламления рабочего места. Не загораживать вентиляционные отверстия оборудования.', { indent: true }),
    p('3.3. Не допускать к работе с электрооборудованием посторонних лиц.', { indent: true }),

    secTitle('4. Требования в аварийных ситуациях'),
    p('4.1. При обнаружении неисправности оборудования, появлении запаха гари, дыма — немедленно отключить оборудование и сообщить в службу технической поддержки.', { indent: true }),
    p('4.2. При возгорании — вызвать пожарную охрану (101), отключить электропитание, приступить к тушению первичными средствами пожаротушения.', { indent: true }),
    p('4.3. При несчастном случае — вызвать скорую помощь (112), оказать первую помощь пострадавшему, сообщить в контролирующие органы.', { indent: true }),

    secTitle('5. Требования по окончании работы'),
    p('5.1. Выключить ПЭВМ, оргтехнику и электроприборы.', { indent: true }),
    p('5.2. Привести рабочее место в порядок.', { indent: true }),
    p('5.3. При обнаружении недостатков — сообщить ответственному за охрану труда.', { indent: true }),
  ]);
  return fn(client, settings, dir, '05.01_ИОТ_01_руководитель.docx');
}

// 05.02 — ИОТ для офисных работников
async function gen_05_02(client, settings, dir) {
  const fn = buildInstrukciya('№ 02-ИОТ', 'для работников офиса (бухгалтер, экономист, менеджер, специалист)', [
    secTitle('1. Общие требования охраны труда'),
    p('1.1. К самостоятельной работе допускаются лица, достигшие 18 лет, прошедшие вводный и первичный инструктажи.', { indent: true }),
    p('1.2. Основные вредные и опасные факторы: повышенное зрительное напряжение, статическая нагрузка на опорно-двигательный аппарат, электромагнитное излучение от ПЭВМ.', { indent: true }),
    p('1.3. Работнику выдаются необходимые СИЗ согласно нормам. Работа с ПЭВМ нормируется: не более 6 часов в смену для пользователей категории А и Б.', { indent: true }),

    secTitle('2. Требования перед началом работы'),
    p('2.1. Осмотреть рабочее место, убедиться в чистоте и порядке.', { indent: true }),
    p('2.2. Проверить исправность кресла, стола, ПЭВМ и периферийных устройств.', { indent: true }),
    p('2.3. Отрегулировать яркость монитора и освещение рабочей зоны.', { indent: true }),

    secTitle('3. Требования во время работы'),
    p('3.1. Соблюдать режим труда и отдыха: 5–10 минут перерыва каждый час при работе с ПЭВМ.', { indent: true }),
    p('3.2. Не работать с пищей и напитками вблизи ПЭВМ.', { indent: true }),
    p('3.3. Не прикасаться к задней панели системного блока при включённом питании.', { indent: true }),
    p('3.4. Не самостоятельно чинить или вскрывать электрооборудование.', { indent: true }),

    secTitle('4. Требования в аварийных ситуациях'),
    p('4.1. При запахе горелой изоляции, дыме или искрении — отключить питание кнопкой и немедленно сообщить руководителю.', { indent: true }),
    p('4.2. При возгорании — вызвать 101, покинуть помещение, воспользоваться эвакуационным выходом.', { indent: true }),

    secTitle('5. Требования по окончании работы'),
    p('5.1. Выключить ПЭВМ в установленном порядке (завершить программы, затем питание).', { indent: true }),
    p('5.2. Привести в порядок рабочее место, убрать документы.', { indent: true }),
  ]);
  return fn(client, settings, dir, '05.02_ИОТ_02_офисные_работники.docx');
}

// 05.03 — ИОТ при работе с ПЭВМ и оргтехникой
async function gen_05_03(client, settings, dir) {
  const fn = buildInstrukciya('№ 03-ИОТ', 'при работе с ПЭВМ, оргтехникой и электроприборами', [
    secTitle('1. Общие требования охраны труда'),
    p('1.1. Инструкция разработана в соответствии с Приказом Минтруда России от 29.10.2021 № 772н, СанПиН 1.2.3685-21.', { indent: true }),
    p('1.2. К работе с ПЭВМ допускаются лица, не имеющие медицинских противопоказаний, прошедшие инструктаж.', { indent: true }),
    p('1.3. Непрерывная работа с монитором без перерыва — не более 2 часов. Суммарное время — не более 6 часов за смену.', { indent: true }),

    secTitle('2. Требования перед началом работы'),
    p('2.1. Убедиться в исправности кабелей питания и соединительных шнуров.', { indent: true }),
    p('2.2. Монитор устанавливать на расстоянии 50–70 см от глаз, верхний край экрана — на уровне глаз или чуть ниже.', { indent: true }),
    p('2.3. Рабочая поверхность стола должна быть освещена рассеянным светом без бликов.', { indent: true }),

    secTitle('3. Требования во время работы'),
    p('3.1. Не класть на монитор и системный блок посторонние предметы, не закрывать вентиляционные отверстия.', { indent: true }),
    p('3.2. При перерыве в работе — выключать монитор или переводить в спящий режим.', { indent: true }),
    p('3.3. При появлении нехарактерных звуков, запаха горелого, мерцания экрана — немедленно выключить ПК и сообщить руководителю.', { indent: true }),

    secTitle('4. Требования в аварийных ситуациях'),
    p('4.1. При поражении электрическим током — немедленно отключить питание, вызвать скорую помощь (112).', { indent: true }),
    p('4.2. При возгорании — использовать порошковый или углекислотный огнетушитель. Водой не тушить.', { indent: true }),

    secTitle('5. Требования по окончании работы'),
    p('5.1. Выключить оборудование в порядке: завершить работу программ, затем выключить ПК, затем монитор.', { indent: true }),
    p('5.2. Отключить от сети все приборы, не предназначенные для круглосуточной работы.', { indent: true }),
  ]);
  return fn(client, settings, dir, '05.03_ИОТ_03_ПЭВМ_оргтехника.docx');
}

// 05.04 — ИОТ при эксплуатации копировально-множительной техники
async function gen_05_04(client, settings, dir) {
  const fn = buildInstrukciya('№ 04-ИОТ', 'при эксплуатации копировально-множительной техники', [
    secTitle('1. Общие требования охраны труда'),
    p('1.1. К работе на копировально-множительной технике допускаются работники, прошедшие инструктаж.', { indent: true }),
    p('1.2. Основные опасные факторы: электрический ток, нагрев поверхностей, выделение озона и паров органических растворителей (при работе с тонером).', { indent: true }),

    secTitle('2. Требования перед началом работы'),
    p('2.1. Убедиться в наличии заземления у аппарата.', { indent: true }),
    p('2.2. Проверить целостность корпуса, кабеля питания.', { indent: true }),
    p('2.3. Убедиться в наличии достаточного количества бумаги и тонера.', { indent: true }),

    secTitle('3. Требования во время работы'),
    p('3.1. Не открывать крышки аппарата во время работы.', { indent: true }),
    p('3.2. При замятии бумаги — выключить аппарат, подождать остывания, затем извлечь бумагу.', { indent: true }),
    p('3.3. При замене тонер-картриджа использовать перчатки. Не допускать попадания тонера в глаза и дыхательные пути.', { indent: true }),
    p('3.4. Помещение с копировальной техникой должно регулярно проветриваться.', { indent: true }),

    secTitle('4. Требования в аварийных ситуациях'),
    p('4.1. При возгорании — немедленно отключить аппарат от сети, вызвать пожарную охрану (101).', { indent: true }),
    p('4.2. При поражении электрическим током — действовать согласно ИОТ № 03-ИОТ.', { indent: true }),

    secTitle('5. Требования по окончании работы'),
    p('5.1. Выключить аппарат кнопкой питания.', { indent: true }),
    p('5.2. При длительном перерыве или окончании рабочего дня — отключить от сети.', { indent: true }),
  ]);
  return fn(client, settings, dir, '05.04_ИОТ_04_копировальная_техника.docx');
}

// 05.05 — ИОТ об использовании аптечки первой помощи
async function gen_05_05(client, settings, dir) {
  const fn = buildInstrukciya('№ 05-ИОТ', 'о порядке размещения, хранения и использования аптечки первой помощи', [
    secTitle('1. Общие положения'),
    p('1.1. Инструкция разработана в соответствии с Приказом Минздрава России от 24.05.2024 № 262н.', { indent: true }),
    p('1.2. Аптечка первой помощи работникам предназначена для оказания первой помощи при производственных травмах и острых заболеваниях до прибытия медицинского персонала.', { indent: true }),

    secTitle('2. Место хранения'),
    p('2.1. Аптечка хранится в доступном, известном всем работникам месте.', { indent: true }),
    p('2.2. Место хранения обозначается знаком «Аптечка первой помощи» (белый крест на зелёном фоне).', { indent: true }),
    p('2.3. Использование содержимого аптечки в иных целях (кроме первой помощи) запрещается.', { indent: true }),

    secTitle('3. Состав аптечки'),
    p('3.1. Аптечка комплектуется согласно требованиям Приказа Минздрава № 262н. Обязательный состав:', { indent: true }),
    bul('перевязочный материал (бинты стерильные и нестерильные, салфетки);'),
    bul('лейкопластырь (рулонный и бактерицидный);'),
    bul('жгут кровоостанавливающий;'),
    bul('ножницы для разрезания повязок;'),
    bul('перчатки медицинские нестерильные;'),
    bul('устройство для проведения искусственного дыхания;'),
    bul('покрывало спасательное изотермическое.'),

    secTitle('4. Контроль и пополнение'),
    p('4.1. Ответственный за аптечку проверяет её состав и сроки годности не реже 1 раза в 6 месяцев.', { indent: true }),
    p('4.2. Израсходованные или просроченные изделия немедленно заменяются.', { indent: true }),
    p('4.3. Результаты проверки фиксируются в журнале контроля аптечки.', { indent: true }),
  ]);
  return fn(client, settings, dir, '05.05_ИОТ_05_аптечка.docx');
}

// ════════════════════════════════════════════════════════════
//  РАЗДЕЛ 06 — ЖУРНАЛЫ УЧЁТА
// ════════════════════════════════════════════════════════════

// Общий шаблон для журналов
async function buildJournal(client, settings, dir, journalNum, journalTitle, colW, headerCells, filename, instructions) {
  const hdr = row(headerCells.map((h, i) => cell(h, colW[i], { bold: true, center: true, size: SZ_SM })));
  const emptyRows = Array.from({ length: 25 }, (_, i) =>
    row(colW.map((w, j) => cell(j === 0 ? String(i + 1) : '', w, { center: j === 0, size: SZ_SM })))
  );

  const titlePage = [
    pCenter(orgName(client), { bold: true }),
    ...emptyLines(2),
    docTitle('ЖУРНАЛ'),
    docTitle(journalTitle.toUpperCase(), SZ),
    ...emptyLines(2),
    p(`Начат: «___» ____________ ${client.doc_year} г.`),
    p('Окончен: «___» ____________ ______ г.'),
    ...emptyLines(1),
    p(`Ответственный: ${client.ot_position || client.manager_position}  ${client.ot_name || client.manager_name}`),
  ];

  const mainPage = [
    new Paragraph({ children: [new PageBreak()] }),
    p(instructions, { size: SZ_SM, indent: true }),
    ...emptyLines(1),
    simpleTable(colW, [hdr, ...emptyRows]),
  ];

  return saveDoc([{
    properties: {
      page: {
        size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
        margin: MARGIN_LAND,
      },
    },
    footers: { default: makeFooter(journalNum) },
    children: [...titlePage, ...mainPage],
  }], dir, filename);
}

// 06.01 — Журнал регистрации вводного инструктажа
async function gen_06_01(client, settings, dir) {
  return buildJournal(
    client, settings, dir,
    '06.01',
    'регистрации вводного инструктажа по охране труда',
    [400, 2000, 1500, 1200, 1000, 1200, 1200, 1272],
    ['№', 'ФИО работника', 'Должность', 'Дата', 'Подразделение', 'Инструктаж проводил', 'Подпись инструктора', 'Подпись инструктируемого'],
    '06.01_Журнал_вводный_инструктаж.docx',
    'Журнал ведётся ответственным за охрану труда. Вводный инструктаж проводится при приёме на работу со всеми без исключения работниками. Результаты фиксируются в день проведения инструктажа. Основание: Постановление Правительства РФ от 24.12.2021 № 2464.'
  );
}

// 06.02 — Журнал регистрации инструктажа на рабочем месте
async function gen_06_02(client, settings, dir) {
  return buildJournal(
    client, settings, dir,
    '06.02',
    'регистрации инструктажа на рабочем месте',
    [400, 2000, 1500, 900, 900, 800, 1200, 1200, 872],
    ['№', 'ФИО работника', 'Должность', 'Дата', 'Вид инструктажа', 'Номер ИОТ', 'Инструктаж проводил', 'Подпись инструктора', 'Подпись инструктируемого'],
    '06.02_Журнал_инструктаж_рабочее_место.docx',
    'Журнал ведётся непосредственным руководителем работника. Первичный инструктаж — до начала самостоятельной работы. Повторный — не реже 1 раза в 6 месяцев. Внеплановый — при изменении условий труда, после НС. Виды: П — первичный, Пв — повторный, Вн — внеплановый, Ц — целевой.'
  );
}

// 06.03 — Журнал учёта микротравм
async function gen_06_03(client, settings, dir) {
  return buildJournal(
    client, settings, dir,
    '06.03',
    'учёта микроповреждений (микротравм) работников',
    [400, 2000, 1400, 900, 1500, 1500, 1172],
    ['№', 'ФИО пострадавшего', 'Должность', 'Дата', 'Описание микротравмы', 'Обстоятельства получения', 'Принятые меры'],
    '06.03_Журнал_микротравмы.docx',
    'Журнал ведётся ответственным за охрану труда. Работник, получивший микротравму, немедленно сообщает руководителю. Факт фиксируется в течение суток. Основание: ст. 226 ТК РФ, Приказ Минтруда России от 15.09.2021 № 632н.'
  );
}

// 06.04 — Журнал учёта выдачи СИЗ
async function gen_06_04(client, settings, dir) {
  return buildJournal(
    client, settings, dir,
    '06.04',
    'учёта выдачи средств индивидуальной защиты',
    [400, 2000, 1400, 1200, 1000, 800, 800, 1272],
    ['№', 'ФИО работника', 'Наименование СИЗ', 'Дата выдачи', 'Размер / норма', 'Кол-во', 'Срок носки (мес.)', 'Подпись'],
    '06.04_Журнал_выдача_СИЗ.docx',
    'Журнал ведётся ответственным за ДСИЗ. Каждая выдача СИЗ фиксируется с подписью получателя. При выдаче проверяется соответствие размера и наличие сертификата. Основание: Приказ Минтруда России от 29.10.2021 № 766н.'
  );
}

// 06.05 — Журнал контроля аптечки
async function gen_06_05(client, settings, dir) {
  return buildJournal(
    client, settings, dir,
    '06.05',
    'контроля аптечки первой помощи работникам',
    [400, 1200, 2800, 1400, 1400, 1872],
    ['№', 'Дата проверки', 'Проверяемые позиции', 'Обнаруженные недостатки', 'Принятые меры', 'Подпись ответственного'],
    '06.05_Журнал_контроль_аптечки.docx',
    'Журнал ведётся ответственным за аптечку. Проверка — не реже 1 раза в 6 месяцев и после каждого использования. Проверяется наличие всех позиций, сроки годности. Основание: Приказ Минздрава России от 24.05.2024 № 262н.'
  );
}

// 06.06 — Личная карточка учёта выдачи СИЗ
async function gen_06_06(client, settings, dir) {
  const colW = [400, 2500, 1000, 800, 800, 800, 800, 1972];

  const hdr = row([
    cell('№', colW[0], { bold: true, center: true, size: SZ_SM }),
    cell('Наименование СИЗ', colW[1], { bold: true, center: true, size: SZ_SM }),
    cell('Норма (ед./год)', colW[2], { bold: true, center: true, size: SZ_SM }),
    cell('Дата выдачи', colW[3], { bold: true, center: true, size: SZ_SM }),
    cell('Кол-во', colW[4], { bold: true, center: true, size: SZ_SM }),
    cell('Размер', colW[5], { bold: true, center: true, size: SZ_SM }),
    cell('% износа', colW[6], { bold: true, center: true, size: SZ_SM }),
    cell('Подпись работника', colW[7], { bold: true, center: true, size: SZ_SM }),
  ]);

  const emptyRows = Array.from({ length: 15 }, (_, i) =>
    row(colW.map((w, j) => cell(j === 0 ? String(i + 1) : '', w, { center: j === 0, size: SZ_SM })))
  );

  const children = [
    pCenter(orgName(client), { bold: true }),
    ...emptyLines(1),
    docTitle('ЛИЧНАЯ КАРТОЧКА УЧЁТА ВЫДАЧИ СРЕДСТВ ИНДИВИДУАЛЬНОЙ ЗАЩИТЫ'),
    ...emptyLines(1),
    p('ФИО работника: _______________________________________________________'),
    p('Должность: ____________________________________________________________'),
    p('Табельный номер: ________________  Дата приёма на работу: ________________'),
    p('Структурное подразделение: ____________________________________________'),
    ...emptyLines(1),
    simpleTable(colW, [hdr, ...emptyRows]),
    ...emptyLines(2),
    p('Ответственный за ДСИЗ: ________________  ' + (client.dsiz_name || client.ot_name || client.manager_name)),
  ];

  return saveDoc([{
    properties: {
      page: {
        size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
        margin: MARGIN_LAND,
      },
    },
    footers: { default: makeFooter('06.06') },
    children,
  }], dir, '06.06_Личная_карточка_СИЗ.docx');
}

// ════════════════════════════════════════════════════════════
//  РАЗДЕЛ 07 — ПРОГРАММЫ ОБУЧЕНИЯ
// ════════════════════════════════════════════════════════════

// 07.01 — Программа вводного инструктажа
async function gen_07_01(client, settings, dir) {
  // Гриф «УТВЕРЖДЕНА Приказом…» — отличается от обычного approvalBlock
  const approvalGranted = new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [CW / 2, CW / 2],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideH: NO_BORDER, insideV: NO_BORDER,
    },
    rows: [new TableRow({
      children: [
        new TableCell({ borders: BORDERS_NONE, width: { size: CW / 2, type: WidthType.DXA }, children: [new Paragraph('')] }),
        new TableCell({ borders: BORDERS_NONE, width: { size: CW / 2, type: WidthType.DXA }, children: [
          p('УТВЕРЖДЕНА', { bold: true, align: AlignmentType.LEFT }),
          p(`Приказом ${client.manager_position}`, { align: AlignmentType.LEFT }),
          p(orgName(client), { align: AlignmentType.LEFT }),
          p(`от «${client.doc_date}» № 09`, { align: AlignmentType.LEFT }),
        ]}),
      ],
    })],
  });

  // Тематический план — таблица
  const planColW = [700, 5500, 1400];
  const planHdr = row([
    cell('№ темы', planColW[0], { bold: true, center: true }),
    cell('Наименование темы', planColW[1], { bold: true, center: true }),
    cell('Время (мин)', planColW[2], { bold: true, center: true }),
  ]);
  const planData = [
    ['1', 'Общие сведения об организации, характерные особенности производства', '5'],
    ['2', 'Основные положения законодательства об охране труда', '5'],
    ['3', 'Правила внутреннего трудового распорядка, ответственность за их нарушение', '5'],
    ['4', 'Основные опасные и вредные производственные факторы, профессиональные риски', '5'],
    ['5', 'Средства индивидуальной защиты, смывающие средства, порядок выдачи и применения', '3'],
    ['6', 'Аптечка первой помощи: место хранения, порядок использования и контроля', '3'],
    ['7', 'Порядок действий при несчастном случае, микротравме', '2'],
    ['8', 'Пожарная безопасность. Действия при пожаре', '2'],
  ];
  const planRows = planData.map(r => row([
    cell(r[0], planColW[0], { center: true, size: SZ_SM }),
    cell(r[1], planColW[1], { size: SZ_SM }),
    cell(r[2], planColW[2], { center: true, size: SZ_SM }),
  ]));
  const planTotal = row([
    cell('ИТОГО:', planColW[0] + planColW[1], { bold: true }),
    cell('30', planColW[2], { bold: true, center: true }),
  ]);
  const planTable = new Table({
    width: { size: planColW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: planColW,
    rows: [planHdr, ...planRows, planTotal],
  });

  const children = [
    approvalGranted,
    ...emptyLines(1),
    docTitle('ПРОГРАММА № 01-ПИ'),
    docTitle('ВВОДНОГО ИНСТРУКТАЖА ПО ОХРАНЕ ТРУДА'),
    docTitle(orgName(client).toUpperCase(), SZ),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p(`1.1. Настоящая программа определяет порядок и темы проведения вводного инструктажа по охране труда с работниками ${orgName(client)}.`, { indent: true }),
    p(`1.2. Вводный инструктаж проводит ${client.manager_position} (как лицо, ответственное за охрану труда) со всеми принимаемыми на работу лицами, а также с командированными работниками и лицами, проходящими производственную практику.`, { indent: true }),
    p('1.3. Вводный инструктаж проводится по утверждённой программе в день оформления работника на работу, до начала выполнения трудовых функций.', { indent: true }),
    p('1.4. Продолжительность вводного инструктажа устанавливается в соответствии с утверждённой программой и составляет не менее 30 минут.', { indent: true }),
    p('1.5. О проведении вводного инструктажа делается запись в Журнале регистрации вводного инструктажа с обязательной подписью инструктируемого и инструктирующего.', { indent: true }),

    secTitle('2. Тематический план вводного инструктажа'),
    planTable,

    secTitle('3. Содержание программы вводного инструктажа'),

    p('Тема 1. Общие сведения об организации, характерные особенности производства', { bold: true }),
    bul('Полное и сокращённое наименование организации, юридический и фактический адрес.'),
    bul(`Структура организации, основные направления деятельности (ОКВЭД: ${client.okved}${client.okved_name ? ' — ' + client.okved_name : ''}).`),
    bul('Расположение основных помещений, кабинетов, служебных зон.'),
    bul('Места расположения санитарно-бытовых помещений (туалеты, места приёма пищи, кулеры с водой).'),

    p('Тема 2. Основные положения законодательства об охране труда', { bold: true }),
    bul('Основные статьи Трудового кодекса РФ в части охраны труда (ст. 212, 214, 215, 221, 223).'),
    bul('Права и обязанности работника в области охраны труда.'),
    bul('Права и обязанности работодателя по обеспечению безопасных условий труда.'),
    bul('Ответственность за нарушение требований охраны труда (дисциплинарная, административная, уголовная).'),
    bul('Локальные нормативные акты по охране труда (ознакомление, местонахождение).'),

    p('Тема 3. Правила внутреннего трудового распорядка, ответственность за их нарушение', { bold: true }),
    bul('Режим работы: начало рабочего дня в 9:00, окончание в 18:00, пятидневная рабочая неделя.'),
    bul('Обеденный перерыв с 13:00 до 14:00.'),
    bul('Порядок оформления опозданий, отсутствия на рабочем месте.'),
    bul('Правила поведения в офисе, этика общения с коллегами и клиентами.'),
    bul('Дисциплинарные взыскания за нарушение трудовой дисциплины.'),

    p('Тема 4. Основные опасные и вредные производственные факторы, профессиональные риски', { bold: true }),
    bul('Факторы, связанные с работой на ПЭВМ: повышенная зрительная нагрузка; длительное статическое напряжение мышц спины, шеи, рук; электромагнитное излучение.'),
    bul('Факторы, связанные с работой в офисе: недостаточная освещённость; нервно-психические перегрузки; опасность поражения электрическим током.'),
    bul('Профессиональные риски: риск травмирования, риск развития профессиональных заболеваний.'),

    p('Тема 5. Средства индивидуальной защиты, смывающие средства, порядок выдачи и применения', { bold: true }),
    bul('Виды СИЗ, применяемых в организации (при наличии).'),
    bul('Дерматологические СИЗ: жидкое мыло в дозаторах в санитарно-бытовых помещениях.'),
    bul('Нормы выдачи смывающих средств (250 мл на работника в месяц).'),
    bul('Порядок использования дозаторов, информирование ответственного лица о необходимости пополнения.'),

    p('Тема 6. Аптечка первой помощи: место хранения, порядок использования и контроля', { bold: true }),
    bul('Место хранения аптечки первой помощи (уточняется при инструктаже).'),
    bul('Внешний вид аптечки, сигнальный знак (зелёный квадрат с белым крестом).'),
    bul('Состав аптечки (ознакомление с перечнем изделий по Приказу Минздрава № 262н).'),
    bul('Порядок использования: при оказании первой помощи использовать перчатки, маску; после использования сообщить ответственному лицу о факте расходования компонентов.'),
    bul('Запрещается: использовать аптечку не по назначению; изымать компоненты для личных целей.'),

    p('Тема 7. Порядок действий при несчастном случае, микротравме', { bold: true }),
    bul('Обязанность работника немедленно извещать руководителя о любой травме или ухудшении здоровья.'),
    bul('Действия при микротравме (ссадина, ушиб, порез): обратиться к руководителю; при необходимости оказать первую помощь (аптечка); зафиксировать факт в журнале микротравм.'),
    bul('Действия при несчастном случае: оказать первую помощь пострадавшему; вызвать скорую помощь (103); сохранить обстановку происшествия; сообщить руководителю.'),

    p('Тема 8. Пожарная безопасность. Действия при пожаре', { bold: true }),
    bul('Основные правила пожарной безопасности в офисе: запрет курения в помещениях; запрет использования электроприборов с открытой спиралью; запрет загромождения проходов и выходов; запрет оставления включённых электроприборов без присмотра.'),
    bul('Действия при обнаружении пожара: сообщить в пожарную охрану по телефону 101 или 112; сообщить руководителю; отключить электрооборудование; приступить к тушению первичными средствами (огнетушитель); организовать эвакуацию людей.'),
    bul('Местонахождение огнетушителей, планов эвакуации (уточняется при инструктаже).'),

    secTitle('4. Заключительные положения'),
    p('4.1. Вводный инструктаж завершается устной проверкой приобретённых знаний и навыков лицом, проводившим инструктаж.', { indent: true }),
    p('4.2. Работник, показавший неудовлетворительные знания, к работе не допускается и обязан пройти инструктаж повторно.', { indent: true }),

    ...emptyLines(2),
    p('Программу разработал:'),
    ...emptyLines(1),
    p(`${client.manager_position}  _______________  ${client.manager_name}`),
    p(`«${client.doc_date}»`),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('07.01') },
    children,
  }], dir, '07.01_Программа_вводного_инструктажа.docx');
}

// 07.02 — Программа первичного инструктажа на рабочем месте
async function gen_07_02(client, settings, dir) {
  const approvalGranted = new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [CW / 2, CW / 2],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideH: NO_BORDER, insideV: NO_BORDER,
    },
    rows: [new TableRow({
      children: [
        new TableCell({ borders: BORDERS_NONE, width: { size: CW / 2, type: WidthType.DXA }, children: [new Paragraph('')] }),
        new TableCell({ borders: BORDERS_NONE, width: { size: CW / 2, type: WidthType.DXA }, children: [
          p('УТВЕРЖДЕНА', { bold: true, align: AlignmentType.LEFT }),
          p(`Приказом ${client.manager_position}`, { align: AlignmentType.LEFT }),
          p(orgName(client), { align: AlignmentType.LEFT }),
          p(`от «${client.doc_date}» № 09`, { align: AlignmentType.LEFT }),
        ]}),
      ],
    })],
  });

  const planColW = [700, 5500, 1400];
  const planHdr = row([
    cell('№ темы', planColW[0], { bold: true, center: true }),
    cell('Наименование темы', planColW[1], { bold: true, center: true }),
    cell('Время (мин)', planColW[2], { bold: true, center: true }),
  ]);
  const planData = [
    ['1', 'Общие сведения о технологическом процессе и оборудовании на рабочем месте', '5'],
    ['2', 'Опасные и вредные производственные факторы на рабочем месте', '5'],
    ['3', 'Безопасная организация и содержание рабочего места', '5'],
    ['4', 'Опасные зоны, средства безопасности оборудования', '5'],
    ['5', 'Порядок подготовки к работе, требования к спецодежде и СИЗ', '3'],
    ['6', 'Безопасные методы и приёмы выполнения работ', '4'],
    ['7', 'Действия при возникновении аварийной ситуации, несчастного случая', '3'],
  ];
  const planRows = planData.map(r => row([
    cell(r[0], planColW[0], { center: true, size: SZ_SM }),
    cell(r[1], planColW[1], { size: SZ_SM }),
    cell(r[2], planColW[2], { center: true, size: SZ_SM }),
  ]));
  const planTotal = row([
    cell('ИТОГО:', planColW[0] + planColW[1], { bold: true }),
    cell('30', planColW[2], { bold: true, center: true }),
  ]);
  const planTable = new Table({
    width: { size: planColW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: planColW,
    rows: [planHdr, ...planRows, planTotal],
  });

  // Должность того, кто проводит первичный инструктаж на рабочем месте
  const instrPos  = client.ot_position  || client.manager_position;
  const instrName = client.ot_name      || client.manager_name;

  const children = [
    approvalGranted,
    ...emptyLines(1),
    docTitle('ПРОГРАММА № 02-ПИ'),
    docTitle('ПЕРВИЧНОГО ИНСТРУКТАЖА НА РАБОЧЕМ МЕСТЕ'),
    docTitle(orgName(client).toUpperCase(), SZ),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p(`1.1. Настоящая программа определяет порядок и темы проведения первичного инструктажа на рабочем месте с работниками ${orgName(client)}.`, { indent: true }),
    p(`1.2. Первичный инструктаж на рабочем месте проводит ${instrPos} (как непосредственный руководитель) со всеми работниками, кроме лиц, освобождённых от прохождения первичного инструктажа в соответствии с утверждённым Перечнем.`, { indent: true }),
    p('1.3. Первичный инструктаж проводится с работниками до начала самостоятельной работы по программам, разработанным с учётом специфики трудовых функций.', { indent: true }),
    p('1.4. О проведении первичного инструктажа делается запись в Журнале регистрации инструктажа на рабочем месте с обязательной подписью инструктируемого и инструктирующего.', { indent: true }),

    secTitle('2. Тематический план первичного инструктажа'),
    planTable,

    secTitle('3. Содержание программы первичного инструктажа'),

    p('Тема 1. Общие сведения о технологическом процессе и оборудовании на рабочем месте', { bold: true }),
    bul('Ознакомление с рабочим местом, оборудованием (ПЭВМ, оргтехника, копировальная техника).'),
    bul('Технологический процесс выполнения должностных обязанностей.'),
    bul('Взаимодействие с другими работниками, подчинённость.'),

    p('Тема 2. Опасные и вредные производственные факторы на рабочем месте', { bold: true }),
    bul('Факторы, характерные для конкретного рабочего места.'),
    bul('Источники опасности: неисправная электропроводка, розетки; неисправная оргтехника; неудобная мебель; скользкие полы.'),

    p('Тема 3. Безопасная организация и содержание рабочего места', { bold: true }),
    bul('Требования к чистоте и порядку на рабочем месте.'),
    bul('Запрет загромождения проходов, путей эвакуации.'),
    bul('Правила хранения документов, канцелярских принадлежностей.'),
    bul('Требования к микроклимату, освещению, проветриванию.'),

    p('Тема 4. Опасные зоны, средства безопасности оборудования', { bold: true }),
    bul('Движущиеся части оргтехники (лотки подачи бумаги, механизмы принтера).'),
    bul('Элементы оборудования, представляющие опасность (нагревательные элементы, высоковольтные блоки).'),
    bul('Предохранительные устройства, блокировки, защитные кожухи.'),

    p('Тема 5. Порядок подготовки к работе, требования к спецодежде и СИЗ', { bold: true }),
    bul('Проверка исправности оборудования перед началом работы.'),
    bul('Проверка освещённости, вентиляции.'),
    bul('Надлежащий вид одежды, обуви (нескользкая подошва, отсутствие свисающих элементов).'),
    bul('Применение СИЗ (при необходимости).'),

    p('Тема 6. Безопасные методы и приёмы выполнения работ', { bold: true }),
    bul('Правила включения и выключения оборудования.'),
    bul('Правила работы с ПЭВМ (положение тела, расстояние до экрана не менее 50 см, перерывы каждый час).'),
    bul('Правила работы с электроприборами (чайник, СВЧ-печь).'),
    bul('Правила работы с копировальной техникой (заправка картриджей, удаление замятий).'),
    bul('Запрещённые действия: самостоятельный ремонт оборудования; использование неисправных розеток; оставление включённых приборов без присмотра.'),

    p('Тема 7. Действия при возникновении аварийной ситуации, несчастного случая', { bold: true }),
    bul('Действия при задымлении, искрении, запахе гари.'),
    bul('Действия при поражении электрическим током.'),
    bul('Действия при замятии бумаги.'),
    bul('Действия при микротравме (порез, ушиб).'),
    bul('Местонахождение аптечки, огнетушителя.'),
    bul('Порядок информирования руководителя.'),

    secTitle('4. Заключительные положения'),
    p('4.1. Первичный инструктаж завершается устной проверкой приобретённых знаний и навыков.', { indent: true }),
    p('4.2. Работник, показавший неудовлетворительные знания, к самостоятельной работе не допускается и обязан пройти инструктаж повторно.', { indent: true }),

    ...emptyLines(2),
    p('Программу разработал:'),
    ...emptyLines(1),
    p(`${instrPos}  _______________  ${instrName}`),
    p(`«${client.doc_date}»`),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('07.02') },
    children,
  }], dir, '07.02_Программа_первичного_инструктажа.docx');
}

// 07.03 — Программа противопожарного инструктажа
async function gen_07_03(client, settings, dir) {
  const approvalGranted = new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [CW / 2, CW / 2],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideH: NO_BORDER, insideV: NO_BORDER,
    },
    rows: [new TableRow({
      children: [
        new TableCell({ borders: BORDERS_NONE, width: { size: CW / 2, type: WidthType.DXA }, children: [new Paragraph('')] }),
        new TableCell({ borders: BORDERS_NONE, width: { size: CW / 2, type: WidthType.DXA }, children: [
          p('УТВЕРЖДЕНА', { bold: true, align: AlignmentType.LEFT }),
          p(`Приказом ${client.manager_position}`, { align: AlignmentType.LEFT }),
          p(orgName(client), { align: AlignmentType.LEFT }),
          p(`от «${client.doc_date}» № 09`, { align: AlignmentType.LEFT }),
        ]}),
      ],
    })],
  });

  const planColW = [700, 5500, 1400];
  const planHdr = row([
    cell('№ темы', planColW[0], { bold: true, center: true }),
    cell('Наименование темы', planColW[1], { bold: true, center: true }),
    cell('Время (мин)', planColW[2], { bold: true, center: true }),
  ]);
  const planData = [
    ['1', 'Основные требования пожарной безопасности в офисе', '5'],
    ['2', 'Причины пожаров и меры их предотвращения', '5'],
    ['3', 'Действия при обнаружении пожара', '5'],
    ['4', 'Правила эвакуации', '5'],
    ['5', 'Первичные средства пожаротушения, правила пользования', '5'],
  ];
  const planRows = planData.map(r => row([
    cell(r[0], planColW[0], { center: true, size: SZ_SM }),
    cell(r[1], planColW[1], { size: SZ_SM }),
    cell(r[2], planColW[2], { center: true, size: SZ_SM }),
  ]));
  const planTotal = row([
    cell('ИТОГО:', planColW[0] + planColW[1], { bold: true }),
    cell('25', planColW[2], { bold: true, center: true }),
  ]);
  const planTable = new Table({
    width: { size: planColW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: planColW,
    rows: [planHdr, ...planRows, planTotal],
  });

  const children = [
    approvalGranted,
    ...emptyLines(1),
    docTitle('ПРОГРАММА № 03-ПИ'),
    docTitle('ПРОТИВОПОЖАРНОГО ИНСТРУКТАЖА'),
    docTitle(orgName(client).toUpperCase(), SZ),
    ...emptyLines(1),

    secTitle('1. Общие положения'),
    p(`1.1. Настоящая программа определяет порядок и темы проведения противопожарного инструктажа с работниками ${orgName(client)}.`, { indent: true }),
    p(`1.2. Противопожарный инструктаж проводит ${client.manager_position} (как лицо, ответственное за пожарную безопасность) со всеми работниками организации.`, { indent: true }),
    p('1.3. Проводятся следующие виды противопожарного инструктажа:', { indent: true }),
    bul('вводный — при приёме на работу;'),
    bul('первичный на рабочем месте — при приёме на работу, затем не реже 1 раза в год;'),
    bul('повторный — не реже 1 раза в год по программе первичного;'),
    bul('внеплановый — при изменении требований, при пожарах, по предписанию;'),
    bul('целевой — перед выполнением работ повышенной опасности.'),
    p('1.4. О проведении противопожарного инструктажа делается запись в Журнале регистрации инструктажей.', { indent: true }),

    secTitle('2. Тематический план противопожарного инструктажа'),
    planTable,

    secTitle('3. Содержание программы противопожарного инструктажа'),

    p('Тема 1. Основные требования пожарной безопасности в офисе', { bold: true }),
    bul('Правила пожарной безопасности в здании: запрет курения в помещениях (только в отведённых местах); запрет использования открытого огня; запрет загромождения путей эвакуации, проходов, выходов; запрет хранения горючих материалов вблизи электрощитов, розеток.'),
    bul('Требования к эксплуатации электроприборов: запрет использования неисправных розеток, вилок, кабелей; запрет оставления включённых электроприборов без присмотра; запрет использования электроприборов с открытой спиралью; запрет перегрузки электросети (включение нескольких мощных приборов в одну розетку).'),

    p('Тема 2. Причины пожаров и меры их предотвращения', { bold: true }),
    bul('Наиболее вероятные причины пожаров в офисе: короткое замыкание электропроводки; неисправность электроприборов; нарушение правил эксплуатации оргтехники; оставление включённых приборов без присмотра; неосторожное обращение с огнём (курение).'),
    bul('Меры предотвращения: своевременное отключение неисправного оборудования; регулярная проверка состояния розеток, вилок, кабелей; содержание рабочего места в чистоте.'),

    p('Тема 3. Действия при обнаружении пожара', { bold: true }),
    bul('НЕ ПАНИКОВАТЬ.'),
    bul('Немедленно сообщить в пожарную охрану по телефону 101 или 112 (чётко назвать адрес, место пожара, свою фамилию).'),
    bul('Сообщить руководителю.'),
    bul('Отключить электрооборудование от сети.'),
    bul('Приступить к тушению пожара первичными средствами (огнетушитель).'),
    bul('Если потушить невозможно — организовать эвакуацию людей.'),

    p('Тема 4. Правила эвакуации', { bold: true }),
    bul('Места расположения эвакуационных выходов (основной и запасной).'),
    bul('План эвакуации (место размещения, схема).'),
    bul('Пути эвакуации, запрет их загромождения.'),
    bul('Действия при эвакуации: двигаться спокойно, без паники; при сильном задымлении дышать через влажную ткань; помочь пострадавшим; собраться в месте сбора; пройти перекличку.'),

    p('Тема 5. Первичные средства пожаротушения, правила пользования', { bold: true }),
    bul('Типы огнетушителей в организации (углекислотные ОУ, порошковые ОП).'),
    bul('Места расположения огнетушителей (уточняется при инструктаже).'),
    bul('Правила пользования углекислотным огнетушителем (ОУ): сорвать пломбу, выдернуть чеку; направить раструб на очаг пожара; нажать рычаг; НЕ ДЕРЖАТЬСЯ ЗА РАСТРУБ (обморожение); тушить с наветренной стороны.'),
    bul('Правила пользования порошковым огнетушителем (ОП): сорвать пломбу, выдернуть чеку; нажать рычаг; направить на очаг; тушить с наветренной стороны.'),
    bul('Запрет использования воды для тушения электрооборудования под напряжением.'),

    secTitle('4. Заключительные положения'),
    p('4.1. Противопожарный инструктаж завершается проверкой знаний в форме устного опроса.', { indent: true }),
    p('4.2. Работник, показавший неудовлетворительные знания, к работе не допускается и обязан пройти инструктаж повторно.', { indent: true }),

    ...emptyLines(2),
    p('Программу разработал:'),
    ...emptyLines(1),
    p(`${client.manager_position}  _______________  ${client.manager_name}`),
    p(`«${client.doc_date}»`),
  ];
  return saveDoc([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
    footers: { default: makeFooter('07.03') },
    children,
  }], dir, '07.03_Программа_противопожарный_инструктаж.docx');
}

// 07.04 — Приказ об утверждении программ обучения (дубль в папку 07)
// (используем gen_01_10 — тот же приказ №09)

// ════════════════════════════════════════════════════════════
//  ГЛАВНАЯ ФУНКЦИЯ: generatePackage
// ════════════════════════════════════════════════════════════

/**
 * Генерирует все документы по охране труда для клиента.
 * @param {Object} client  — данные организации
 * @param {Object} settings — настройки специалиста
 * @param {string} outputDir — корневая папка для сохранения
 * @returns {Promise<{generated: string[], errors: string[]}>}
 */
async function generatePackage(client, settings, outputDir) {
  // Подпапки по разделам
  const dirs = {
    '01': path.join(outputDir, '01_Организационные'),
    '02': path.join(outputDir, '02_Нормативные_акты'),
    '03': path.join(outputDir, '03_Электробезопасность'),
    '05': path.join(outputDir, '05_Инструкции_ОТ'),
    '06': path.join(outputDir, '06_Журналы'),
    '07': path.join(outputDir, '07_Программы_обучения'),
  };

  // Создаём папки
  for (const d of Object.values(dirs)) {
    fs.mkdirSync(d, { recursive: true });
  }

  // Нормализация полей клиента (fallback'и для опциональных полей)
  const c = {
    name:            client.name            || 'Организация',
    form:            client.form            || 'ООО',
    okved:           client.okved           || '',
    okved_name:      client.okved_name      || '',
    staff:           client.staff           || 1,
    region:          client.region          || '',
    manager_name:    client.manager_name    || 'Руководитель',
    manager_name_full: client.manager_name_full || client.manager_name || 'Руководитель',
    manager_position: client.manager_position || 'Руководитель',
    manager_dative:  client.manager_dative  || client.manager_name || 'Руководителю',
    ot_name:         client.ot_name         || client.manager_name    || 'Руководитель',
    ot_name_full:    client.ot_name_full    || client.manager_name_full || client.manager_name || '',
    ot_position:     client.ot_position     || client.manager_position || 'Руководитель',
    ot_dative:       client.ot_dative       || client.manager_dative   || '',
    dsiz_name:       client.dsiz_name       || client.ot_name          || client.manager_name,
    elec_name:       client.elec_name       || client.ot_name          || client.manager_name,
    elec_position:   client.elec_position   || client.ot_position      || client.manager_position,
    address:         client.address         || '',
    inn:             client.inn             || '',
    phone:           client.phone           || '',
    city:            client.city            || 'г.',
    doc_date:        client.doc_date        || new Date().toLocaleDateString('ru-RU'),
    doc_year:        client.doc_year        || String(new Date().getFullYear()),
  };

  const generated = [];
  const errors    = [];

  const run = async (fn, dir) => {
    try {
      const fname = await fn(c, settings, dir);
      generated.push(fname);
    } catch (e) {
      errors.push(`${fn.name}: ${e.message}`);
    }
  };

  // ── Раздел 01 ──────────────────────────────────────────
  await run(gen_01_01, dirs['01']);
  await run(gen_01_02, dirs['01']);
  await run(gen_01_03, dirs['01']);
  await run(gen_01_04, dirs['01']);
  await run(gen_01_05, dirs['01']);
  await run(gen_01_06, dirs['01']);
  await run(gen_01_07, dirs['01']);
  await run(gen_01_08, dirs['01']);
  await run(gen_01_09, dirs['01']);
  await run(gen_01_10, dirs['01']);

  // ── Раздел 02 ──────────────────────────────────────────
  await run(gen_02_01, dirs['02']);
  await run(gen_02_02, dirs['02']);
  await run(gen_02_03, dirs['02']);
  await run(gen_02_04, dirs['02']);
  await run(gen_02_05, dirs['02']);
  await run(gen_02_06, dirs['02']);

  // ── Раздел 03 ──────────────────────────────────────────
  await run(gen_03_01, dirs['03']);
  await run(gen_03_02, dirs['03']);
  await run(gen_03_03, dirs['03']);

  // ── Раздел 05 ──────────────────────────────────────────
  await run(gen_05_01, dirs['05']);
  await run(gen_05_02, dirs['05']);
  await run(gen_05_03, dirs['05']);
  await run(gen_05_04, dirs['05']);
  await run(gen_05_05, dirs['05']);

  // ── Раздел 06 ──────────────────────────────────────────
  await run(gen_06_01, dirs['06']);
  await run(gen_06_02, dirs['06']);
  await run(gen_06_03, dirs['06']);
  await run(gen_06_04, dirs['06']);
  await run(gen_06_05, dirs['06']);
  await run(gen_06_06, dirs['06']);

  // ── Раздел 07 ──────────────────────────────────────────
  await run(gen_07_01, dirs['07']);
  await run(gen_07_02, dirs['07']);
  await run(gen_07_03, dirs['07']);
  // 07.04 — тот же приказ что 01.10, сохраняем в папку 07
  await run(async (c2, s2, d2) => {
    // Копируем логику gen_01_10 с сохранением в папку 07
    const children = [
      ...orderHeader(c2, '09', 'Об утверждении программ обучения по охране труда'),
      ...emptyLines(1),
      orderPreamble('требованиями Постановления Правительства РФ от 24.12.2021 № 2464,'),
      orderCommand(),
      num(`Утвердить и ввести в действие с ${c2.doc_date} программы обучения:`),
      bul('№ 01-ПИ — Программа вводного инструктажа по охране труда;'),
      bul('№ 02-ПИ — Программа первичного инструктажа на рабочем месте;'),
      bul('№ 03-ПИ — Программа противопожарного инструктажа.'),
      num(`Ответственным за проведение инструктажей назначить ${c2.ot_position} ${c2.ot_name_full || c2.ot_name}.`),
      num('Программы пересматривать не реже 1 раза в 3 года.'),
      num('Контроль за исполнением приказа оставляю за собой.'),
      ...orderSignature(c2),
    ];
    return saveDoc([{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: MARGIN_PORT } },
      footers: { default: makeFooter('07.04') },
      children,
    }], d2, '07.04_Приказ_09_программы_обучения.docx');
  }, dirs['07']);

  return { generated, errors };
}

module.exports = { generatePackage };
