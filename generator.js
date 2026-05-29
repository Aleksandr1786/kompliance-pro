// generator.js — Генератор документов по охране труда
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, Header, Footer, TabStopType, PageNumber
} = require('docx');
const fs = require('fs');
const path = require('path');

const BLUE  = '1E3A6E';
const WHITE = 'FFFFFF';
const LIGHT = 'EBF2FA';

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

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

function makeDoc(children, settings = {}) {
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
          children: [new TextRun({ text: settings.company_name || 'Организация', size: 18, font: 'Times New Roman', color: '666666' })]
        })
      ]})},
      footers: { default: new Footer({ children: [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
          spacing: { before: 80, after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: 9026 }],
          children: [
            new TextRun({ text: `Документ актуален на: ${new Date().toLocaleDateString('ru-RU')}`, size: 16, font: 'Times New Roman', color: '999999' }),
            new TextRun({ text: '\tСтр. ', size: 16, font: 'Times New Roman', color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Times New Roman', color: BLUE }),
          ]
        })
      ]})},
      children
    }]
  });
}

// ═══════════════════════════════════════════════════════
// ДОКУМЕНТ 1: Приказ о назначении ответственного за ОТ
// ═══════════════════════════════════════════════════════
async function genPrikazOT(client, settings, outputDir) {
  const today = new Date().toLocaleDateString('ru-RU');
  const children = [
    centerPara(client.form + ' ' + client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, ''), { bold: true }),
    centerPara('ПРИКАЗ', { bold: true, size: 32 }),
    centerPara(`№ ___ от «___» __________ ${new Date().getFullYear()} г.`),
    centerPara('г. ' + (client.address || '___________')),
    sp(),
    centerPara('Об организации работы по охране труда', { bold: true }),
    sp(),
    para(`В соответствии с требованиями Трудового кодекса Российской Федерации (статьи 212, 217), Постановления Правительства РФ от 24.12.2021 № 2464 «О порядке обучения по охране труда», в целях обеспечения безопасных условий и охраны труда работников,`),
    sp(),
    paraNoIndent('ПРИКАЗЫВАЮ:', { bold: true }),
    sp(),
    bullet(`Назначить ответственным за организацию работы по охране труда в ${client.form} «${client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '')}» ___________________________ (ФИО), должность ___________________________.`),
    bullet(`Ответственному за охрану труда обеспечить: проведение инструктажей по охране труда; ведение журналов регистрации инструктажей; контроль за соблюдением требований охраны труда работниками.`),
    bullet(`Обеспечить проведение вводного инструктажа со всеми вновь принимаемыми на работу, а также инструктажа на рабочем месте не реже 1 раза в 6 месяцев.`),
    bullet(`Организовать обучение работников по охране труда в аккредитованной организации в сроки, установленные законодательством РФ.`),
    bullet(`Контроль за исполнением настоящего приказа оставляю за собой.`),
    sp(),
    para(`Основание: статья 217 Трудового кодекса Российской Федерации.`),
    sp(), sp(),
    paraNoIndent(`Руководитель: __________________ / ${settings.user_name || '_______________'} /`),
    sp(),
    paraNoIndent(`С приказом ознакомлен(а): __________________ / _____________________ /`),
    paraNoIndent(`Дата: «___» __________ ${new Date().getFullYear()} г.`),
  ];
  const doc = makeDoc(children, settings);
  const buf = await Packer.toBuffer(doc);
  const filename = `Приказ_ОТ_назначение_${sanitize(client.name)}.docx`;
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ═══════════════════════════════════════════════════════
// ДОКУМЕНТ 2: Положение об охране труда
// ═══════════════════════════════════════════════════════
async function genPolozhenie(client, settings, outputDir) {
  const children = [
    centerPara('УТВЕРЖДАЮ', { bold: true }),
    centerPara(`Руководитель ${client.form} «${client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '')}»`),
    centerPara(`__________________ / ${settings.user_name || '_______________'} /`),
    centerPara(`«___» __________ ${new Date().getFullYear()} г.`),
    sp(),
    centerPara('ПОЛОЖЕНИЕ ОБ ОХРАНЕ ТРУДА', { bold: true, size: 28 }),
    centerPara(client.form + ' «' + client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '') + '»'),
    sp(),
    h1('1. ОБЩИЕ ПОЛОЖЕНИЯ'),
    para(`1.1. Настоящее Положение об охране труда (далее — Положение) разработано в соответствии с Трудовым кодексом Российской Федерации, Федеральным законом от 28.12.2013 № 426-ФЗ «О специальной оценке условий труда», Постановлением Правительства РФ от 24.12.2021 № 2464 и иными нормативными правовыми актами в сфере охраны труда.`),
    para(`1.2. Положение устанавливает систему управления охраной труда в ${client.form} «${client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '')}» (далее — Организация), определяет обязанности работодателя и работников, порядок проведения инструктажей и обучения по охране труда.`),
    para(`1.3. Основным видом деятельности Организации является деятельность по ОКВЭД ${client.okved || '___'}. Списочная численность работников — ${client.staff || '___'} человек.`),
    para(`1.4. Действие настоящего Положения распространяется на всех работников Организации, а также на лиц, находящихся на территории Организации.`),
    sp(),
    h1('2. ОБЯЗАННОСТИ РАБОТОДАТЕЛЯ'),
    para(`2.1. Работодатель обязан обеспечить безопасность работников при эксплуатации зданий, сооружений, оборудования, осуществлении технологических процессов.`),
    para(`2.2. Работодатель обязан проводить инструктажи по охране труда, обучение безопасным методам и приёмам выполнения работ и оказанию первой помощи пострадавшим.`),
    para(`2.3. Работодатель обязан организовывать проведение специальной оценки условий труда в соответствии с законодательством о специальной оценке условий труда.`),
    para(`2.4. Работодатель обязан информировать работников об условиях и охране труда на рабочих местах, о риске повреждения здоровья, полагающихся им гарантиях и компенсациях.`),
    sp(),
    h1('3. ОБЯЗАННОСТИ РАБОТНИКОВ'),
    para(`3.1. Работники обязаны соблюдать требования охраны труда, установленные законодательством и локальными нормативными актами Организации.`),
    para(`3.2. Работники обязаны проходить обучение безопасным методам и приёмам выполнения работ, инструктажи по охране труда, стажировку на рабочем месте и проверку знаний требований охраны труда.`),
    para(`3.3. Работники обязаны немедленно извещать своего непосредственного или вышестоящего руководителя о любой ситуации, угрожающей жизни и здоровью людей.`),
    sp(),
    h1('4. ИНСТРУКТАЖИ ПО ОХРАНЕ ТРУДА'),
    para(`4.1. Вводный инструктаж проводится при приёме на работу со всеми вновь поступающими работниками. Проводит: ответственный за охрану труда.`),
    para(`4.2. Первичный инструктаж на рабочем месте проводится до начала самостоятельной работы с каждым работником. Проводит: непосредственный руководитель.`),
    para(`4.3. Повторный инструктаж проводится не реже одного раза в 6 месяцев по программам первичного инструктажа.`),
    para(`4.4. Внеплановый инструктаж проводится при изменении технологических процессов, замене оборудования, нарушениях требований охраны труда, а также по требованию органов надзора.`),
    para(`4.5. Целевой инструктаж проводится при выполнении разовых работ, не связанных с прямыми обязанностями работника.`),
    sp(),
    h1('5. ОБУЧЕНИЕ ПО ОХРАНЕ ТРУДА'),
    para(`5.1. Обучение по охране труда проводится в аккредитованных организациях, осуществляющих деятельность по обучению работодателей и работников вопросам охраны труда.`),
    para(`5.2. Руководители и специалисты проходят обучение по охране труда в течение первого месяца после назначения на должность, далее — не реже одного раза в 3 года.`),
    para(`5.3. Обучение работников по оказанию первой помощи пострадавшим проводится не реже одного раза в 3 года.`),
    para(`5.4. Обучение по пожарной безопасности проводится не реже одного раза в 3 года в организации, имеющей лицензию МЧС.`),
    sp(),
    h1('6. СПЕЦИАЛЬНАЯ ОЦЕНКА УСЛОВИЙ ТРУДА'),
    para(`6.1. Специальная оценка условий труда (СОУТ) проводится в соответствии с Федеральным законом от 28.12.2013 № 426-ФЗ не реже одного раза в 5 лет.`),
    para(`6.2. СОУТ проводится совместно работодателем и организацией, проводящей специальную оценку условий труда, соответствующей требованиям статьи 19 Федерального закона № 426-ФЗ.`),
    sp(),
    h1('7. РАССЛЕДОВАНИЕ НЕСЧАСТНЫХ СЛУЧАЕВ'),
    para(`7.1. Расследование несчастных случаев на производстве проводится в соответствии со статьями 227–231 Трудового кодекса Российской Федерации.`),
    para(`7.2. О каждом несчастном случае, произошедшем на производстве, пострадавший или очевидец немедленно извещает непосредственного руководителя.`),
    sp(),
    h1('8. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ'),
    para(`8.1. Настоящее Положение вводится в действие с момента утверждения руководителем Организации.`),
    para(`8.2. Изменения и дополнения в настоящее Положение вносятся приказом руководителя Организации.`),
    para(`8.3. Контроль за соблюдением настоящего Положения осуществляет ответственный за охрану труда.`),
    sp(), sp(),
    paraNoIndent(`Разработал: ${settings.user_name || '_______________'}, ${settings.user_position || 'специалист по охране труда'}`),
    paraNoIndent(`Дата: ${new Date().toLocaleDateString('ru-RU')}`),
  ];
  const doc = makeDoc(children, settings);
  const buf = await Packer.toBuffer(doc);
  const filename = `Положение_об_ОТ_${sanitize(client.name)}.docx`;
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ═══════════════════════════════════════════════════════
// ДОКУМЕНТ 3: Программа вводного инструктажа
// ═══════════════════════════════════════════════════════
async function genProgrammaVvodnogo(client, settings, outputDir) {
  const children = [
    centerPara('УТВЕРЖДАЮ', { bold: true }),
    centerPara(`Руководитель ${client.form} «${client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '')}»`),
    centerPara(`__________________ / ${settings.user_name || '_______________'} /`),
    centerPara(`«___» __________ ${new Date().getFullYear()} г.`),
    sp(),
    centerPara('ПРОГРАММА', { bold: true, size: 28 }),
    centerPara('вводного инструктажа по охране труда', { bold: true }),
    centerPara(client.form + ' «' + client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '') + '»'),
    sp(),
    h1('1. ОБЩИЕ СВЕДЕНИЯ ОБ ОРГАНИЗАЦИИ'),
    para(`Полное наименование: ${client.form} «${client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '')}». Основной вид деятельности (ОКВЭД): ${client.okved || '___'}. Численность работников: ${client.staff || '___'} человек. Регион: ${client.region || '___'}.`),
    para(`Краткое описание технологических процессов, характера производства, основных профессий и должностей работников.`),
    sp(),
    h1('2. ОСНОВНЫЕ ПОЛОЖЕНИЯ ЗАКОНОДАТЕЛЬСТВА ОБ ОХРАНЕ ТРУДА'),
    para(`2.1. Трудовой кодекс Российской Федерации: основные права и обязанности работника и работодателя в области охраны труда (статьи 21, 22, 212, 214).`),
    para(`2.2. Ответственность за нарушение требований охраны труда: дисциплинарная, административная, уголовная.`),
    para(`2.3. Порядок расследования и учёта несчастных случаев на производстве. Действия работника при несчастном случае.`),
    para(`2.4. Право работника на отказ от выполнения работ в случае возникновения опасности для его жизни и здоровья.`),
    sp(),
    h1('3. ОБЩИЕ ПРАВИЛА ПОВЕДЕНИЯ НА ТЕРРИТОРИИ ОРГАНИЗАЦИИ'),
    para(`3.1. Правила внутреннего трудового распорядка. Режим работы и отдыха.`),
    para(`3.2. Основные опасные и вредные производственные факторы, характерные для данной организации.`),
    para(`3.3. Требования к спецодежде, спецобуви и другим средствам индивидуальной защиты.`),
    para(`3.4. Порядок прохода на территорию организации. Запрещённые зоны и маршруты.`),
    sp(),
    h1('4. ОСНОВНЫЕ ТРЕБОВАНИЯ ПРОИЗВОДСТВЕННОЙ САНИТАРИИ И ГИГИЕНЫ'),
    para(`4.1. Санитарно-бытовые помещения, их расположение и правила пользования.`),
    para(`4.2. Требования к личной гигиене работника. Запрет приёма пищи на рабочем месте (при наличии вредных факторов).`),
    para(`4.3. Вредные производственные факторы и меры защиты от их воздействия.`),
    sp(),
    h1('5. ОСНОВНЫЕ ТРЕБОВАНИЯ ПОЖАРНОЙ БЕЗОПАСНОСТИ'),
    para(`5.1. Общие правила пожарной безопасности на объектах организации.`),
    para(`5.2. Расположение первичных средств пожаротушения и порядок их применения.`),
    para(`5.3. Действия работников при пожаре и при обнаружении задымления. Порядок эвакуации.`),
    para(`5.4. Запрет курения в неустановленных местах. Недопустимость использования открытого огня.`),
    sp(),
    h1('6. ОКАЗАНИЕ ПЕРВОЙ ПОМОЩИ ПОСТРАДАВШИМ'),
    para(`6.1. Расположение аптечки первой помощи, её состав и правила применения.`),
    para(`6.2. Порядок оказания первой помощи при различных видах травм: порезах, ожогах, переломах, отравлениях, поражении электрическим током.`),
    para(`6.3. Порядок вызова скорой медицинской помощи. Телефон экстренных служб: 112.`),
    sp(),
    h1('7. ПОРЯДОК ПРОВЕДЕНИЯ ИНСТРУКТАЖА'),
    para(`Продолжительность вводного инструктажа: не менее 2 часов. Проводит: ответственный за охрану труда — ${settings.user_name || '_______________'}. По окончании инструктажа проводится проверка знаний путём устного опроса. Результаты фиксируются в Журнале регистрации вводного инструктажа.`),
    sp(), sp(),
    paraNoIndent(`Разработал: ${settings.user_name || '_______________'}, ${settings.user_position || 'специалист по охране труда'}`),
    paraNoIndent(`Дата: ${new Date().toLocaleDateString('ru-RU')}`),
  ];
  const doc = makeDoc(children, settings);
  const buf = await Packer.toBuffer(doc);
  const filename = `Программа_вводного_инструктажа_${sanitize(client.name)}.docx`;
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ═══════════════════════════════════════════════════════
// ДОКУМЕНТ 4: Журнал регистрации вводного инструктажа
// ═══════════════════════════════════════════════════════
async function genZhurnalVvodnogo(client, settings, outputDir) {
  const w = [500, 2000, 1500, 1000, 1000, 1200, 1200, 626];
  const headerRow = new TableRow({ children: [
    '№', 'ФИО инструктируемого', 'Профессия, должность', 'Дата прохождения', 'Подразделение',
    'ФИО проводившего инструктаж', 'Подпись проводившего', 'Подпись инструктируемого'
  ].map((h, i) => new TableCell({
    borders, shading: { fill: '1E3A6E', type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    width: { size: w[i], type: WidthType.DXA },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, size: 16, font: 'Times New Roman', color: 'FFFFFF' })] })]
  }))});

  const emptyRows = Array.from({ length: 20 }, (_, i) => new TableRow({
    height: { value: 400, rule: 'atLeast' },
    children: [i + 1, '', '', '', '', settings.user_name || '', '', ''].map((v, ci) => new TableCell({
      borders,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      width: { size: w[ci], type: WidthType.DXA },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(v), size: 18, font: 'Times New Roman' })] })]
    }))
  }));

  const children = [
    centerPara('УТВЕРЖДАЮ', { bold: true }),
    centerPara(`Руководитель ${client.form} «${client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '')}»`),
    centerPara(`__________________ / ${settings.user_name || '_______________'} /`),
    sp(),
    centerPara('ЖУРНАЛ', { bold: true, size: 28 }),
    centerPara('регистрации вводного инструктажа по охране труда', { bold: true }),
    sp(),
    centerPara(client.form + ' «' + client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '') + '»'),
    centerPara(`Начат: «___» __________ ${new Date().getFullYear()} г.   Окончен: «___» __________ ______ г.`),
    sp(),
    paraNoIndent(`Инструктаж проводит: ${settings.user_name || '_______________'}, ${settings.user_position || 'специалист по охране труда'}`),
    sp(),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: w,
      rows: [headerRow, ...emptyRows]
    }),
  ];
  const doc = makeDoc(children, { ...settings, landscape: false });
  const buf = await Packer.toBuffer(doc);
  const filename = `Журнал_вводного_инструктажа_${sanitize(client.name)}.docx`;
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ═══════════════════════════════════════════════════════
// ДОКУМЕНТ 5: Приказ об утверждении Положения об ОТ
// ═══════════════════════════════════════════════════════
async function genPrikazUtv(client, settings, outputDir) {
  const children = [
    centerPara(client.form + ' «' + client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '') + '»', { bold: true }),
    centerPara('ПРИКАЗ', { bold: true, size: 32 }),
    centerPara(`№ ___ от «___» __________ ${new Date().getFullYear()} г.`),
    sp(),
    centerPara('Об утверждении Положения об охране труда и Программы вводного инструктажа', { bold: true }),
    sp(),
    para(`В соответствии с требованиями Трудового кодекса Российской Федерации, Постановления Правительства РФ от 24.12.2021 № 2464, в целях организации работы по охране труда,`),
    sp(),
    paraNoIndent('ПРИКАЗЫВАЮ:', { bold: true }),
    sp(),
    bullet(`Утвердить Положение об охране труда ${client.form} «${client.name.replace(/^(ООО|ИП|ЗАО|АО|МУП|ГУП|НКО)\s*/i, '')}» и ввести его в действие с «___» __________ ${new Date().getFullYear()} г.`),
    bullet(`Утвердить Программу проведения вводного инструктажа по охране труда.`),
    bullet(`Ознакомить всех работников с Положением об охране труда под подпись в течение 5 рабочих дней с момента подписания настоящего приказа.`),
    bullet(`Контроль за исполнением настоящего приказа возложить на ответственного за охрану труда — ___________________________ (ФИО).`),
    sp(), sp(),
    paraNoIndent(`Руководитель: __________________ / ${settings.user_name || '_______________'} /`),
  ];
  const doc = makeDoc(children, settings);
  const buf = await Packer.toBuffer(doc);
  const filename = `Приказ_утверждение_ОТ_${sanitize(client.name)}.docx`;
  fs.writeFileSync(path.join(outputDir, filename), buf);
  return filename;
}

// ═══════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ: Генерация пакета документов
// ═══════════════════════════════════════════════════════
async function generatePackage(client, settings, outputDir) {
  // Создаём папку для документов клиента
  const clientDir = path.join(outputDir, sanitize(client.name));
  if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });

  const results = [];
  const generators = [
    { name: 'Приказ о назначении ответственного за ОТ', fn: genPrikazOT },
    { name: 'Положение об охране труда',                fn: genPolozhenie },
    { name: 'Программа вводного инструктажа',           fn: genProgrammaVvodnogo },
    { name: 'Журнал регистрации вводного инструктажа',  fn: genZhurnalVvodnogo },
    { name: 'Приказ об утверждении Положения об ОТ',    fn: genPrikazUtv },
  ];

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
