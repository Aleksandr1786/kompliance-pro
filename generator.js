// generator.js — Генератор документов по охране труда v2.0
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, Header, Footer, TabStopType, PageNumber, PageOrientation
} = require('docx');
const fs = require('fs');
const path = require('path');

const BLUE = '1E3A6E';
const WHITE = 'FFFFFF';
const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

// ── Вспомогательные функции ──────────────────────────────

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Times New Roman', color: BLUE })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Times New Roman' })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    indent: { firstLine: 720 },
    children: [new TextRun({ text, size: 24, font: 'Times New Roman', ...opts })]
  });
}

function paraNoIndent(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 24, font: 'Times New Roman', ...opts })]
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 24, font: 'Times New Roman' })]
  });
}

function sp() {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: '', size: 24 })] });
}

function centerPara(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 24, font: 'Times New Roman', ...opts })]
  });
}

function rightPara(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 24, font: 'Times New Roman', ...opts })]
  });
}

// Получить отображаемое имя организации (без кавычек для ИП)
function getOrgDisplay(client) {
  if (client.form === 'ИП') return client.name;
  const shortName = client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '');
  return client.form + ' «' + shortName + '»';
}

// Получить ФИО руководителя
function getManagerName(client) {
  return client.manager_name || '______________________________';
}

// Получить должность руководителя
function getManagerPosition(client) {
  return client.manager_position || 'Руководитель';
}

// Гриф УТВЕРЖДАЮ (правый верхний угол)
function utverzdayu(client) {
  return [
    rightPara('УТВЕРЖДАЮ', { bold: true }),
    rightPara(getManagerPosition(client)),
    rightPara(getOrgDisplay(client)),
    rightPara(getManagerName(client)),
    rightPara('«___» __________ ' + new Date().getFullYear() + ' г.'),
    sp(),
  ];
}

// Подпись руководителя внизу документа
function signatureBlock(client) {
  return [
    sp(), sp(),
    paraNoIndent(getManagerPosition(client) + ':'),
    paraNoIndent('__________    ' + getManagerName(client)),
    paraNoIndent('(подпись)      (расшифровка подписи)'),
    sp(),
    paraNoIndent('«___» __________ ' + new Date().getFullYear() + ' г.'),
  ];
}

function makeDoc(children) {
  return new Document({
    numbering: { config: [{ reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
    ]}]},
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: 24 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Times New Roman', color: BLUE },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Times New Roman' },
          paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
      ]
    },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 } }
      },
      headers: { default: new Header({ children: [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
          spacing: { before: 0, after: 80 },
          children: [new TextRun({ text: getOrgDisplay, size: 18, font: 'Times New Roman', color: '666666' })]
        })
      ]})},
      footers: { default: new Footer({ children: [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
          spacing: { before: 80, after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: 9026 }],
          children: [
            new TextRun({ text: 'Актуален: ' + new Date().toLocaleDateString('ru-RU'), size: 16, font: 'Times New Roman', color: '999999' }),
            new TextRun({ text: '\tСтр. ', size: 16, font: 'Times New Roman', color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Times New Roman', color: BLUE }),
          ]
        })
      ]})},
      children
    }]
  });
}

function makeDocWithHeader(children, client) {
  return new Document({
    numbering: { config: [{ reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
    ]}]},
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: 24 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Times New Roman', color: BLUE },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Times New Roman' },
          paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
      ]
    },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 } }
      },
      headers: { default: new Header({ children: [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
          spacing: { before: 0, after: 80 },
          children: [new TextRun({ text: getOrgDisplay(client), size: 18, font: 'Times New Roman', color: '666666' })]
        })
      ]})},
      footers: { default: new Footer({ children: [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
          spacing: { before: 80, after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: 9026 }],
          children: [
            new TextRun({ text: 'Актуален: ' + new Date().toLocaleDateString('ru-RU'), size: 16, font: 'Times New Roman', color: '999999' }),
            new TextRun({ text: '\tСтр. ', size: 16, font: 'Times New Roman', color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Times New Roman', color: BLUE }),
          ]
        })
      ]})},
      children
    }]
  });
}

// ══════════════════════════════════════════════════════════
// ДОКУМЕНТ 1: Приказ о назначении ответственного за ОТ
// ══════════════════════════════════════════════════════════
async function genPrikazOT(client, settings, outputDir) {
  const org = getOrgDisplay(client);
  const year = new Date().getFullYear();

  const children = [
    centerPara(org, { bold: true }),
    centerPara('ПРИКАЗ', { bold: true, size: 32 }),
    centerPara('№ ___ от «___» __________ ' + year + ' г.'),
    centerPara(client.address ? 'г. ' + client.address : ''),
    sp(),
    centerPara('Об организации работы по охране труда', { bold: true }),
    sp(),
    para('В соответствии с требованиями Трудового кодекса Российской Федерации (статьи 214, 223), Постановления Правительства РФ от 24.12.2021 № 2464 «О порядке обучения по охране труда», в целях обеспечения безопасных условий и охраны труда работников,'),
    sp(),
    paraNoIndent('ПРИКАЗЫВАЮ:', { bold: true }),
    sp(),
    bullet('Назначить ответственным за организацию работы по охране труда в ' + org + ' ______________________________ (ФИО), ______________________________ (должность).'),
    bullet('Ответственному за охрану труда обеспечить: проведение инструктажей по охране труда; ведение журналов регистрации инструктажей; контроль за соблюдением требований охраны труда работниками.'),
    bullet('Обеспечить проведение вводного инструктажа со всеми вновь принимаемыми на работу, а также инструктажа на рабочем месте не реже 1 раза в 6 месяцев.'),
    bullet('Организовать обучение работников по охране труда в аккредитованной организации в сроки, установленные законодательством РФ.'),
    bullet('Контроль за исполнением настоящего приказа оставляю за собой.'),
    sp(),
    para('Основание: статьи 214, 223 Трудового кодекса Российской Федерации.'),
    ...signatureBlock(client),
    sp(),
    paraNoIndent('С приказом ознакомлен(а):'),
    paraNoIndent('__________    ______________________________'),
    paraNoIndent('(подпись)      (ФИО)'),
    paraNoIndent('«___» __________ ' + year + ' г.'),
  ];

  const doc = makeDocWithHeader(children, client);
  const buf = await Packer.toBuffer(doc);
  const filename = 'Приказ_ОТ_назначение_' + sanitize(client.name) + '.docx';
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ══════════════════════════════════════════════════════════
// ДОКУМЕНТ 2: Положение об охране труда
// ══════════════════════════════════════════════════════════
async function genPolozhenie(client, settings, outputDir) {
  const org = getOrgDisplay(client);
  const year = new Date().getFullYear();

  const children = [
    ...utverzdayu(client),
    centerPara('ПОЛОЖЕНИЕ ОБ ОХРАНЕ ТРУДА', { bold: true, size: 28 }),
    centerPara(org),
    sp(),
    h1('1. ОБЩИЕ ПОЛОЖЕНИЯ'),
    para('1.1. Настоящее Положение об охране труда (далее — Положение) разработано в соответствии с Трудовым кодексом Российской Федерации, Федеральным законом от 28.12.2013 № 426-ФЗ «О специальной оценке условий труда», Постановлением Правительства РФ от 24.12.2021 № 2464 и иными нормативными правовыми актами в сфере охраны труда.'),
    para('1.2. Положение устанавливает систему управления охраной труда в ' + org + ' (далее — Организация), определяет обязанности работодателя и работников, порядок проведения инструктажей и обучения по охране труда.'),
    para('1.3. Основным видом деятельности Организации является деятельность по ОКВЭД ' + (client.okved || '___') + '. Списочная численность работников — ' + (client.staff || '___') + ' человек.'),
    para('1.4. Действие настоящего Положения распространяется на всех работников Организации, а также на лиц, находящихся на территории Организации.'),
    sp(),
    h1('2. ОБЯЗАННОСТИ РАБОТОДАТЕЛЯ'),
    para('2.1. Работодатель обязан обеспечить безопасность работников при эксплуатации зданий, сооружений, оборудования, осуществлении технологических процессов.'),
    para('2.2. Работодатель обязан проводить инструктажи по охране труда, обучение безопасным методам и приёмам выполнения работ и оказанию первой помощи пострадавшим.'),
    para('2.3. Работодатель обязан организовывать проведение специальной оценки условий труда в соответствии с законодательством о специальной оценке условий труда.'),
    para('2.4. Работодатель обязан информировать работников об условиях и охране труда на рабочих местах, о риске повреждения здоровья, полагающихся им гарантиях и компенсациях.'),
    sp(),
    h1('3. ОБЯЗАННОСТИ РАБОТНИКОВ'),
    para('3.1. Работники обязаны соблюдать требования охраны труда, установленные законодательством и локальными нормативными актами Организации.'),
    para('3.2. Работники обязаны проходить обучение безопасным методам и приёмам выполнения работ, инструктажи по охране труда, стажировку на рабочем месте и проверку знаний требований охраны труда.'),
    para('3.3. Работники обязаны немедленно извещать своего непосредственного или вышестоящего руководителя о любой ситуации, угрожающей жизни и здоровью людей.'),
    sp(),
    h1('4. ИНСТРУКТАЖИ ПО ОХРАНЕ ТРУДА'),
    para('4.1. Вводный инструктаж проводится при приёме на работу со всеми вновь поступающими работниками. Проводит: ответственный за охрану труда.'),
    para('4.2. Первичный инструктаж на рабочем месте проводится до начала самостоятельной работы с каждым работником. Проводит: непосредственный руководитель.'),
    para('4.3. Повторный инструктаж проводится не реже одного раза в 6 месяцев по программам первичного инструктажа.'),
    para('4.4. Внеплановый инструктаж проводится при изменении технологических процессов, замене оборудования, нарушениях требований охраны труда, а также по требованию органов надзора.'),
    para('4.5. Целевой инструктаж проводится при выполнении разовых работ, не связанных с прямыми обязанностями работника.'),
    sp(),
    h1('5. ОБУЧЕНИЕ ПО ОХРАНЕ ТРУДА'),
    para('5.1. Обучение по охране труда проводится в аккредитованных организациях, осуществляющих деятельность по обучению работодателей и работников вопросам охраны труда.'),
    para('5.2. Руководители и специалисты проходят обучение по охране труда в течение первого месяца после назначения на должность, далее — не реже одного раза в 3 года.'),
    para('5.3. Обучение работников по оказанию первой помощи пострадавшим проводится не реже одного раза в 3 года.'),
    para('5.4. Обучение по пожарной безопасности проводится не реже одного раза в 3 года в организации, имеющей лицензию МЧС.'),
    sp(),
    h1('6. СПЕЦИАЛЬНАЯ ОЦЕНКА УСЛОВИЙ ТРУДА'),
    para('6.1. Специальная оценка условий труда (СОУТ) проводится в соответствии с Федеральным законом от 28.12.2013 № 426-ФЗ не реже одного раза в 5 лет.'),
    para('6.2. СОУТ проводится совместно работодателем и организацией, проводящей специальную оценку условий труда, соответствующей требованиям статьи 19 Федерального закона № 426-ФЗ.'),
    sp(),
    h1('7. РАССЛЕДОВАНИЕ НЕСЧАСТНЫХ СЛУЧАЕВ'),
    para('7.1. Расследование несчастных случаев на производстве проводится в соответствии со статьями 227–231 Трудового кодекса Российской Федерации.'),
    para('7.2. О каждом несчастном случае, произошедшем на производстве, пострадавший или очевидец немедленно извещает непосредственного руководителя.'),
    sp(),
    h1('8. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ'),
    para('8.1. Настоящее Положение вводится в действие с момента утверждения руководителем Организации.'),
    para('8.2. Изменения и дополнения в настоящее Положение вносятся приказом руководителя Организации.'),
    para('8.3. Контроль за соблюдением настоящего Положения осуществляет ответственный за охрану труда.'),
    sp(), sp(),
    paraNoIndent('Разработал: ______________________________'),
    paraNoIndent('Дата: «___» __________ ' + year + ' г.'),
  ];

  const doc = makeDocWithHeader(children, client);
  const buf = await Packer.toBuffer(doc);
  const filename = 'Положение_об_ОТ_' + sanitize(client.name) + '.docx';
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ══════════════════════════════════════════════════════════
// ДОКУМЕНТ 3: Программа вводного инструктажа
// ══════════════════════════════════════════════════════════
async function genProgrammaVvodnogo(client, settings, outputDir) {
  const org = getOrgDisplay(client);
  const year = new Date().getFullYear();

  const children = [
    ...utverzdayu(client),
    centerPara('ПРОГРАММА', { bold: true, size: 28 }),
    centerPara('вводного инструктажа по охране труда', { bold: true }),
    centerPara(org),
    sp(),
    h1('1. ОБЩИЕ СВЕДЕНИЯ ОБ ОРГАНИЗАЦИИ'),
    para('Полное наименование: ' + org + '. Основной вид деятельности (ОКВЭД): ' + (client.okved || '___') + '. Численность работников: ' + (client.staff || '___') + ' человек. Регион: ' + (client.region || '___') + '.'),
    para('Краткое описание характера деятельности организации и основных должностей работников.'),
    sp(),
    h1('2. ОСНОВНЫЕ ПОЛОЖЕНИЯ ЗАКОНОДАТЕЛЬСТВА ОБ ОХРАНЕ ТРУДА'),
    para('2.1. Трудовой кодекс Российской Федерации: основные права и обязанности работника и работодателя в области охраны труда (статьи 21, 22, 214, 223).'),
    para('2.2. Ответственность за нарушение требований охраны труда: дисциплинарная, административная, уголовная.'),
    para('2.3. Порядок расследования и учёта несчастных случаев на производстве. Действия работника при несчастном случае.'),
    para('2.4. Право работника на отказ от выполнения работ в случае возникновения опасности для его жизни и здоровья.'),
    sp(),
    h1('3. ОБЩИЕ ПРАВИЛА ПОВЕДЕНИЯ НА ТЕРРИТОРИИ ОРГАНИЗАЦИИ'),
    para('3.1. Правила внутреннего трудового распорядка. Режим работы и отдыха.'),
    para('3.2. Основные опасные и вредные производственные факторы, характерные для данной организации.'),
    para('3.3. Требования к спецодежде, спецобуви и другим средствам индивидуальной защиты.'),
    para('3.4. Порядок прохода на территорию организации. Запрещённые зоны и маршруты.'),
    sp(),
    h1('4. ОСНОВНЫЕ ТРЕБОВАНИЯ ПРОИЗВОДСТВЕННОЙ САНИТАРИИ И ГИГИЕНЫ'),
    para('4.1. Санитарно-бытовые помещения, их расположение и правила пользования.'),
    para('4.2. Требования к личной гигиене работника.'),
    para('4.3. Вредные производственные факторы и меры защиты от их воздействия.'),
    sp(),
    h1('5. ОСНОВНЫЕ ТРЕБОВАНИЯ ПОЖАРНОЙ БЕЗОПАСНОСТИ'),
    para('5.1. Общие правила пожарной безопасности на объектах организации.'),
    para('5.2. Расположение первичных средств пожаротушения и порядок их применения.'),
    para('5.3. Действия работников при пожаре и при обнаружении задымления. Порядок эвакуации.'),
    para('5.4. Запрет курения в неустановленных местах. Недопустимость использования открытого огня.'),
    sp(),
    h1('6. ОКАЗАНИЕ ПЕРВОЙ ПОМОЩИ ПОСТРАДАВШИМ'),
    para('6.1. Расположение аптечки первой помощи, её состав и правила применения.'),
    para('6.2. Порядок оказания первой помощи при различных видах травм: порезах, ожогах, переломах, отравлениях, поражении электрическим током.'),
    para('6.3. Порядок вызова скорой медицинской помощи. Телефон экстренных служб: 112.'),
    sp(),
    h1('7. ПОРЯДОК ПРОВЕДЕНИЯ ИНСТРУКТАЖА'),
    para('Продолжительность вводного инструктажа: не менее 2 часов. По окончании инструктажа проводится проверка знаний путём устного опроса. Результаты фиксируются в Журнале регистрации вводного инструктажа.'),
    sp(), sp(),
    paraNoIndent('Разработал: ______________________________'),
    paraNoIndent('Дата: «___» __________ ' + year + ' г.'),
  ];

  const doc = makeDocWithHeader(children, client);
  const buf = await Packer.toBuffer(doc);
  const filename = 'Программа_вводного_инструктажа_' + sanitize(client.name) + '.docx';
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ══════════════════════════════════════════════════════════
// ДОКУМЕНТ 4: Журнал регистрации вводного инструктажа
// ══════════════════════════════════════════════════════════
async function genZhurnalVvodnogo(client, settings, outputDir) {
  const org = getOrgDisplay(client);
  const year = new Date().getFullYear();
  const pageW = 16838, pageH = 11906;
  const margin = { top: 720, right: 720, bottom: 720, left: 1134 };

  // ЛИСТ 1: Титул (альбомный)
  const titlePage = [
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BLUE, space: 4 } },
      spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: org, size: 18, font: 'Times New Roman', color: '666666' })]
    }),
    sp(), sp(),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: 'УТВЕРЖДАЮ', bold: true, size: 24, font: 'Times New Roman' })]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: getManagerPosition(client), size: 24, font: 'Times New Roman' })]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: org, size: 24, font: 'Times New Roman' })]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: '__________    ' + getManagerName(client), size: 24, font: 'Times New Roman' })]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: '«___» __________ ' + year + ' г.', size: 24, font: 'Times New Roman' })]
    }),
    ...Array(4).fill(sp()),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'ЖУРНАЛ', bold: true, size: 40, font: 'Times New Roman' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'регистрации вводного инструктажа по охране труда', bold: true, size: 28, font: 'Times New Roman' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text: org, size: 26, font: 'Times New Roman' })]
    }),
    ...Array(5).fill(sp()),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: 'Начат: «___» _______________ ' + year + ' г.', size: 24, font: 'Times New Roman' })]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: 'Окончен: «___» _______________ ________ г.', size: 24, font: 'Times New Roman' })]
    }),
  ];

  // ЛИСТ 2: Инструкция (альбомный)
  const instructionPage = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 160 },
      children: [new TextRun({ text: 'ИНСТРУКЦИЯ ПО ВЕДЕНИЮ ЖУРНАЛА', bold: true, size: 26, font: 'Times New Roman' })]
    }),
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '1. Настоящий журнал предназначен для регистрации проведения вводного инструктажа по охране труда в соответствии с Постановлением Правительства РФ от 24.12.2021 № 2464.', size: 22, font: 'Times New Roman' })] }),
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '2. Журнал ведётся ответственным за охрану труда организации.', size: 22, font: 'Times New Roman' })] }),
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '3. Вводный инструктаж проводится со всеми вновь принимаемыми на работу сотрудниками до начала самостоятельной работы.', size: 22, font: 'Times New Roman' })] }),
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '4. Записи производятся чётко и разборчиво, без исправлений. Исправления заверяются подписью ответственного лица.', size: 22, font: 'Times New Roman' })] }),
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '5. Страницы журнала нумеруются, журнал прошнуровывается и опломбируется печатью организации.', size: 22, font: 'Times New Roman' })] }),
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '6. После проведения инструктажа инструктируемый и инструктирующий расписываются в соответствующих графах.', size: 22, font: 'Times New Roman' })] }),
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '7. Журнал хранится у ответственного за охрану труда: 45 лет (вредные/опасные условия) или 10 лет (остальные).', size: 22, font: 'Times New Roman' })] }),
    new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: 'ПОРЯДОК ЗАПОЛНЕНИЯ ГРАФ:', bold: true, size: 22, font: 'Times New Roman' })] }),
    ...['Графа 1 (№) — порядковый номер записи',
        'Графа 2 (ФИО) — фамилия, имя, отчество работника полностью',
        'Графа 3 (Должность) — наименование по штатному расписанию',
        'Графа 4 (Дата) — дата проведения инструктажа (дд.мм.гггг)',
        'Графа 5 (Подразделение) — наименование отдела',
        'Графа 6 (ФИО проводившего) — фамилия и инициалы инструктирующего',
        'Графы 7, 8 (Подписи) — личные подписи инструктирующего и инструктируемого',
      ].map(t => new Paragraph({ spacing: { before: 40, after: 40 }, numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: t, size: 22, font: 'Times New Roman' })] })),
  ];

  // ЛИСТ 3: Таблица (альбомный)
  const totalW = 14400;
  const colW = [500, 2800, 2000, 1200, 1500, 2200, 1100, 1100];

  const headerRow = new TableRow({
    tableHeader: true,
    children: ['№', 'ФИО инструктируемого', 'Профессия, должность', 'Дата', 'Подразделение', 'ФИО проводившего инструктаж', 'Подпись проводившего', 'Подпись инструктируемого']
      .map((h, i) => new TableCell({
        borders, shading: { fill: '1E3A6E', type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        width: { size: colW[i], type: WidthType.DXA },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, size: 18, font: 'Times New Roman', color: 'FFFFFF' })] })]
      }))
  });

  const dataRows = Array.from({ length: 20 }, (_, i) => new TableRow({
    height: { value: 600, rule: 'atLeast' },
    children: [i + 1, '', '', '', '', '', '', ''].map((v, ci) => new TableCell({
      borders, margins: { top: 40, bottom: 40, left: 80, right: 80 },
      width: { size: colW[ci], type: WidthType.DXA },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(v), size: 20, font: 'Times New Roman' })] })]
    }))
  }));

  const tableSheet = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [new TextRun({ text: 'Журнал регистрации вводного инструктажа по охране труда', bold: true, size: 22, font: 'Times New Roman' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 160 }, children: [new TextRun({ text: org, size: 20, font: 'Times New Roman', color: '666666' })] }),
    new Table({ width: { size: totalW, type: WidthType.DXA }, columnWidths: colW, rows: [headerRow, ...dataRows] }),
  ];

  const numbering = { config: [{ reference: 'bullets', levels: [
    { level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 560, hanging: 280 } } } }
  ]}]};

  const doc = new Document({
    numbering,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [
      { properties: { page: { size: { width: pageW, height: pageH, orientation: PageOrientation.LANDSCAPE }, margin } }, children: titlePage },
      { properties: { page: { size: { width: pageW, height: pageH, orientation: PageOrientation.LANDSCAPE }, margin } }, children: instructionPage },
      { properties: { page: { size: { width: pageW, height: pageH, orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children: tableSheet },
    ]
  });

  const buf = await Packer.toBuffer(doc);
  const filename = 'Журнал_вводного_инструктажа_' + sanitize(client.name) + '.docx';
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ══════════════════════════════════════════════════════════
// ДОКУМЕНТ 5: Приказ об утверждении Положения об ОТ
// ══════════════════════════════════════════════════════════
async function genPrikazUtv(client, settings, outputDir) {
  const org = getOrgDisplay(client);
  const year = new Date().getFullYear();

  const children = [
    centerPara(org, { bold: true }),
    centerPara('ПРИКАЗ', { bold: true, size: 32 }),
    centerPara('№ ___ от «___» __________ ' + year + ' г.'),
    sp(),
    centerPara('Об утверждении Положения об охране труда и Программы вводного инструктажа', { bold: true }),
    sp(),
    para('В соответствии с требованиями Трудового кодекса Российской Федерации, Постановления Правительства РФ от 24.12.2021 № 2464, в целях организации работы по охране труда,'),
    sp(),
    paraNoIndent('ПРИКАЗЫВАЮ:', { bold: true }),
    sp(),
    bullet('Утвердить Положение об охране труда ' + org + ' и ввести его в действие с «___» __________ ' + year + ' г.'),
    bullet('Утвердить Программу проведения вводного инструктажа по охране труда.'),
    bullet('Ознакомить всех работников с Положением об охране труда под подпись в течение 5 рабочих дней с момента подписания настоящего приказа.'),
    bullet('Контроль за исполнением настоящего приказа возложить на ответственного за охрану труда — ______________________________ (ФИО).'),
    ...signatureBlock(client),
  ];

  const doc = makeDocWithHeader(children, client);
  const buf = await Packer.toBuffer(doc);
  const filename = 'Приказ_утверждение_ОТ_' + sanitize(client.name) + '.docx';
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ══════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ
// ══════════════════════════════════════════════════════════
async function generatePackage(client, settings, outputDir) {
  const clientDir = path.join(outputDir, sanitize(client.name));
  if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });

  const generators = [
    { name: 'Приказ о назначении ответственного за ОТ', fn: genPrikazOT },
    { name: 'Положение об охране труда',                fn: genPolozhenie },
    { name: 'Программа вводного инструктажа',           fn: genProgrammaVvodnogo },
    { name: 'Журнал регистрации вводного инструктажа',  fn: genZhurnalVvodnogo },
    { name: 'Приказ об утверждении Положения об ОТ',    fn: genPrikazUtv },
  ];

  const results = [];
  for (const g of generators) {
    try {
      const filename = await g.fn(client, settings, clientDir);
      results.push({ name: g.name, filename, status: 'ok', path: path.join(clientDir, filename) });
    } catch (e) {
      results.push({ name: g.name, status: 'error', error: e.message });
    }
  }
  return { results, dir: clientDir };
}

function sanitize(name) {
  return (name || 'client').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
}

module.exports = { generatePackage };
