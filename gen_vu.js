'use strict';
// КомплаенсПро gen_vu.js — Воинский учёт, 10 документов
// Зависит от gen_p1.js (base helpers)

const base = require('./gen_p1');
const { safe, makeRunner } = require('./utils');
const { sectionOf, sectionFolder, SECTIONS } = require('./sections');
const {
  norm, save, oNum,
  p, pC, pR, pL, H, SH, bul, eL,
  cell, row, tbl,
  footer, orderHead, orderSign, approvalBlock,
  FONT, SZ, SZ_S, SZ_H, MP, ML, CW
} = base;

const { BorderStyle, WidthType, AlignmentType, TableRow, TableCell,
        Paragraph, TextRun, Table } = require('docx');

// ── ВСПОМОГАТЕЛЬНЫЕ ────────────────────────────────────────

// Получить данные ВУ клиента
function getVuData(c) {
  try { return JSON.parse(c.vu_data || '{}'); } catch(_) { return {}; }
}

// ФИО руководителя / ответственного
function directorFio(c)     { return c.director_fio     || c.responsible || '_______________'; }
function directorPos(c)     { return c.director_position || 'Директор'; }
function vuRespFio(c, vu)   { return vu.responsible_name || directorFio(c); }
function vuRespPos(c, vu)   { return vu.responsible_position || directorPos(c); }
function vuRespPhone(c, vu) { return vu.responsible_phone || c.phone || ''; }

// Инициалы из ФИО: "Иванов Иван Иванович" → "И.И. Иванов"
function initials(fio) {
  if (!fio || fio === '_______________') return '_______________';
  const p = fio.trim().split(/\s+/);
  if (p.length === 1) return fio;
  const [last, first, mid] = p;
  return `${first?first[0]+'.':''}${mid?mid[0]+'.':''} ${last}`.trim();
}

// Строка подписи: должность + пробел + инициалы
function signLine(pos, fio) {
  return p([
    new TextRun({ text: `${pos}`, font: FONT, size: SZ }),
    new TextRun({ text: `\t`, font: FONT, size: SZ }),
    new TextRun({ text: `______________`, font: FONT, size: SZ }),
    new TextRun({ text: `\t`, font: FONT, size: SZ }),
    new TextRun({ text: initials(fio), font: FONT, size: SZ }),
  ], { tabStops: [
    { type: 'left', position: 4000 },
    { type: 'left', position: 7000 },
  ]});
}

// Год из doc_date
function docYear(c) {
  const y = safe(c.doc_year, '');
  if (y) return y;
  const d = safe(c.doc_date, '');
  if (d) return d.split('.').pop() || String(new Date().getFullYear());
  return String(new Date().getFullYear());
}

// Год как число (с защитой от NaN)
function docYearNum(c) {
  const n = parseInt(docYear(c), 10);
  return Number.isFinite(n) ? n : new Date().getFullYear();
}

// Военкомат
function voenkomat(vu) { return vu.voenkomat || 'военный комиссариат г. ______________'; }

// Считаем численность из employees
function empStats(c) {
  const emps = c.employees || [];
  const total = emps.length;
  const vuEmps = emps.filter(e => e.vu_category);
  const zapas = vuEmps.filter(e => e.vu_category === 'запас' || e.vu_category === 'ограниченно_годный');
  const oficery = vuEmps.filter(e => e.vu_rank === 'офицер');
  const praporsh = zapas.filter(e => e.vu_rank !== 'офицер');
  const ogr = vuEmps.filter(e => e.vu_category === 'ограниченно_годный');
  const bron = vuEmps.filter(e => e.vu_category === 'бронь');
  const mobpred = vuEmps.filter(e => e.vu_mobpredpisanie);
  const prizyvniki = vuEmps.filter(e => e.vu_category === 'призывник');
  const nezabron = zapas.filter(e => e.vu_category !== 'бронь');

  return {
    total,
    zapas: zapas.length,
    oficery: oficery.length,
    praporsh: praporsh.length,
    ogr: ogr.length,
    bron: bron.length,
    mobpred: mobpred.length,
    prizyvniki: prizyvniki.length,
    nezabron: nezabron.length,
  };
}

// Сводная таблица по должностям для Формы 18
function empByPosition(c) {
  const emps = c.employees || [];
  const cats = ['Руководители', 'Специалисты', 'Служащие', 'Рабочие'];
  const posMap = { 'руководитель': 0, 'директор': 0, 'начальник': 0, 'заведующий': 0,
                   'специалист': 1, 'инженер': 1, 'бухгалтер': 1, 'юрист': 1,
                   'служащий': 2, 'секретарь': 2, 'кассир': 2,
                   'рабочий': 3, 'водитель': 3, 'оператор': 3 };
  const res = cats.map(() => ({ total: 0, zapas: 0, oficery: 0, praporsh: 0 }));
  emps.forEach(e => {
    const pos = (e.position || '').toLowerCase();
    let idx = 1; // по умолчанию — специалист
    for (const [key, val] of Object.entries(posMap)) {
      if (pos.includes(key)) { idx = val; break; }
    }
    res[idx].total++;
    if (e.vu_category && e.vu_category !== 'призывник') {
      res[idx].zapas++;
      if (e.vu_rank === 'офицер') res[idx].oficery++;
      else res[idx].praporsh++;
    }
  });
  return res.map((r, i) => ({ name: cats[i], ...r }));
}

// ── ДОКУМЕНТ 1: ПРИКАЗ О НАЗНАЧЕНИИ ОТВЕТСТВЕННОГО ─────────

async function gen_vu_01(c, s, dir) {
  const vu = getVuData(c);
  const orderN = oNum(c, 20); // номер приказа VU серии
  const year = docYear(c);
  const dirFio = directorFio(c);
  const dirPos = directorPos(c);
  const respFio = vuRespFio(c, vu);
  const respPos = vuRespPos(c, vu);
  const sameDir = !vu.responsible_name || vu.responsible_name === dirFio;

  const ch = [
    ...orderHead(c, `№ ${orderN}`, `об организации воинского учёта\nв ${safe(c.name)}`),
    ...eL(1),
    p('На основании Федерального закона от 28.03.1998 № 53-ФЗ «О воинской обязанности и военной службе», Постановления Правительства РФ от 27.11.2006 № 719 «Об утверждении Положения о воинском учёте» и Методических рекомендаций по ведению воинского учёта в организациях (утв. Генштабом ВС РФ 11.07.2017),'),
    ...eL(1),
    H('ПРИКАЗЫВАЮ:'),
    ...eL(1),
    bul(`Организовать воинский учёт граждан, пребывающих в запасе, и граждан, подлежащих призыву на военную службу, в ${safe(c.name)}.`),
    bul(`Назначить ответственным за ведение воинского учёта ${respFio}, ${respPos}.`),
    ...(sameDir ? [] : [
      bul(`На период отпуска, командировки или временной нетрудоспособности ответственного за воинский учёт его обязанности исполняет ${dirPos} ${dirFio}.`),
    ]),
    bul('Ответственному за воинский учёт обеспечить своевременную постановку на учёт и снятие с учёта граждан, пребывающих в запасе, в соответствии с требованиями законодательства.'),
    bul(`Взаимодействие с ${voenkomat(vu)} осуществлять в установленном порядке.`),
    bul('Контроль за исполнением настоящего приказа оставляю за собой.'),
    ...eL(2),
    ...orderSign(c),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-01') },
    children: ch,
  }], dir, 'ВУ-01 Приказ о назначении ответственного за воинский учёт.docx');
}

// ── ДОКУМЕНТ 2: ФУНКЦИОНАЛЬНЫЕ ОБЯЗАННОСТИ ─────────────────

async function gen_vu_02(c, s, dir) {
  const vu = getVuData(c);
  const respFio = vuRespFio(c, vu);
  const respPos = vuRespPos(c, vu);
  const dirFio  = directorFio(c);
  const dirPos  = directorPos(c);

  const ch = [
    pC('УТВЕРЖДАЮ'),
    pC(`${dirPos} ${safe(c.name)}`),
    ...eL(1),
    pC('______________  ' + initials(dirFio)),
    pC(`«____» ______________ ${docYear(c)} г.`),
    ...eL(1),
    H('ФУНКЦИОНАЛЬНЫЕ ОБЯЗАННОСТИ'),
    SH(`ответственного за воинский учёт\n${safe(c.name)}`),
    ...eL(1),
    p(`Ответственный за воинский учёт — ${respPos} ${respFio} — обязан:`),
    ...eL(1),
    H('1. ОРГАНИЗАЦИЯ ВОИНСКОГО УЧЁТА'),
    bul('Осуществлять воинский учёт граждан, пребывающих в запасе, и граждан, подлежащих призыву на военную службу.'),
    bul('Поддерживать в актуальном состоянии сведения о военнообязанных работниках в личных карточках (форма № Т-2).'),
    bul('Вести картотеку воинского учёта и обеспечивать её сохранность.'),
    bul('Вести журнал проверок состояния воинского учёта.'),
    ...eL(1),
    H('2. ПОСТАНОВКА И СНЯТИЕ С УЧЁТА'),
    bul('При приёме на работу проверять у граждан наличие воинских документов (военный билет, удостоверение гражданина, подлежащего призыву).'),
    bul(`В течение 5 рабочих дней направлять в ${voenkomat(vu)} сведения о приёме на работу военнообязанных.`),
    bul(`В течение 5 рабочих дней направлять в ${voenkomat(vu)} сведения об увольнении военнообязанных.`),
    bul('При изменении сведений о семейном положении, образовании, должности, месте жительства вносить изменения в карточки в течение 5 рабочих дней.'),
    ...eL(1),
    H('3. ВЗАИМОДЕЙСТВИЕ С ВОЕНКОМАТОМ'),
    bul(`Представлять в ${voenkomat(vu)} сведения по форме № 18 (карточка учёта организации) ежегодно до 15 ноября.`),
    bul('Проводить ежегодную сверку карточек воинского учёта с учётными данными военного комиссариата.'),
    bul('Оповещать граждан о вызовах (повестках) военного комиссариата и обеспечивать их своевременную явку.'),
    bul('Направлять в военный комиссариат необходимые сведения по запросу.'),
    ...eL(1),
    H('4. СОСТАВЛЕНИЕ ОТЧЁТНОСТИ'),
    bul('Составлять отчёт по форме № 18 ежегодно до 15 ноября текущего года.'),
    bul('Разрабатывать и согласовывать с военкоматом план работы по воинскому учёту на следующий год до 31 декабря.'),
    bul('Вести учёт граждан, заявивших об изменении состояния здоровья.'),
    ...eL(1),
    H('5. ХРАНЕНИЕ ДОКУМЕНТОВ'),
    bul('Обеспечивать хранение документов воинского учёта в соответствии с установленными сроками (личные карточки — 75 лет).'),
    bul('Соблюдать требования по защите персональных данных военнообязанных работников.'),
    ...eL(2),
    signLine(respPos, respFio),
    ...eL(1),
    p(`Дата: «____» ______________ ${docYear(c)} г.`),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-02') },
    children: ch,
  }], dir, 'ВУ-02 Функциональные обязанности ответственного за воинский учёт.docx');
}

// ── ДОКУМЕНТ 3: ПЛАН РАБОТЫ ПО ВОИНСКОМУ УЧЁТУ ─────────────

async function gen_vu_03(c, s, dir) {
  const vu = getVuData(c);
  const year = docYear(c);
  const nextYear = String(docYearNum(c) + 1);
  const dirFio  = directorFio(c);
  const dirPos  = directorPos(c);
  const respFio = vuRespFio(c, vu);
  const respPos = vuRespPos(c, vu);
  const vk = voenkomat(vu);

  const CW_PLAN = 11906 - 1800 * 2; // контентная ширина
  const colW = [600, 4200, 1800, 2200, 2100]; // №, мероприятие, срок, ответственный, отметка

  const hdr = row([
    cell('№', colW[0], { bold: true, center: true, sz: SZ_S }),
    cell('Наименование мероприятий', colW[1], { bold: true, center: true, sz: SZ_S }),
    cell('Срок выполнения', colW[2], { bold: true, center: true, sz: SZ_S }),
    cell('Ответственный', colW[3], { bold: true, center: true, sz: SZ_S }),
    cell('Отметка о выполнении', colW[4], { bold: true, center: true, sz: SZ_S }),
  ]);

  const mk = (n, title, term, resp) => row([
    cell(n, colW[0], { center: true, sz: SZ_S }),
    cell(title, colW[1], { sz: SZ_S }),
    cell(term, colW[2], { center: true, sz: SZ_S }),
    cell(resp, colW[3], { sz: SZ_S }),
    cell('', colW[4], { sz: SZ_S }),
  ]);

  const resp = `${respPos}\n${initials(respFio)}`;

  const ch = [
    // Шапка согласования
    new Table({
      width: { size: CW_PLAN + colW.reduce((a,b) => a+b, 0) - CW_PLAN, type: WidthType.DXA },
      columnWidths: [4500, 4500],
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                 left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                 insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 4500, type: WidthType.DXA },
          borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
          children: [
            pL('СОГЛАСОВАНО'),
            pL(`Военный комиссар`),
            pL(vk),
            ...eL(1),
            pL('______________  _______________'),
            pL(`«____» ______________ ${nextYear} г.`),
          ],
        }),
        new TableCell({
          width: { size: 4500, type: WidthType.DXA },
          borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
          children: [
            pL('УТВЕРЖДАЮ'),
            pL(`${dirPos}`),
            pL(`${safe(c.name)}`),
            ...eL(1),
            pL(`______________  ${initials(dirFio)}`),
            pL(`«____» ______________ ${nextYear} г.`),
          ],
        }),
      ]})]
    }),
    ...eL(1),
    H('ПЛАН'),
    SH(`работы по осуществлению воинского учёта\nграждан, пребывающих в запасе, в ${nextYear} году`),
    SH(`${safe(c.name)}`),
    ...eL(1),

    tbl(colW, [
      hdr,
      // Раздел: текущий учёт
      row([cell('', colW[0], {bold:true, sz:SZ_S}),
           cell('ТЕКУЩИЙ ВОИНСКИЙ УЧЁТ', colW[1], {bold:true, sz:SZ_S}),
           cell('', colW[2], {sz:SZ_S}), cell('', colW[3], {sz:SZ_S}), cell('', colW[4], {sz:SZ_S})]),
      mk('1', 'Постановка на воинский учёт граждан, принятых на работу. Проверка наличия и подлинности документов воинского учёта, заполнение карточек (форма № 10)', 'В дни приёма на работу', resp),
      mk('2', 'Снятие с учёта граждан, уволенных с работы', 'В дни увольнения', resp),
      mk('3', 'Внесение в карточки сведений об изменениях семейного положения, образования, должности, места жительства', 'Постоянно', resp),
      mk('4', 'Направление в военкомат сведений о принятых/уволенных военнообязанных', 'В течение 5 рабочих дней', resp),
      mk('5', 'Проведение сверки сведений воинского учёта в карточках с документами воинского учёта граждан', 'Ежеквартально', resp),
      mk('6', 'Сверка карточек с табелями, финансовыми ведомостями. Выявление граждан, не состоящих на воинском учёте', 'Ежеквартально', resp),
      mk('7', 'Проверка состояния картотеки: правильность построения, полнота и качество заполнения карточек', 'Ежеквартально', resp),
      mk('8', 'Обновление карточек, пришедших в негодность', 'По мере необходимости', resp),
      mk('9', 'Направление для сверки списков работающих граждан, пребывающих в запасе в других военкоматах', 'Ежегодно', resp),
      mk('10', 'Подготовка карточек на лиц, снятых с воинского учёта по состоянию здоровья', '1 раз в полугодие', resp),
      mk('11', 'Проведение сверки карточек с учётными данными военного комиссариата', 'В срок, устанавливаемый военкоматом', resp),

      // Раздел: отчётность
      row([cell('', colW[0], {bold:true, sz:SZ_S}),
           cell('СОСТАВЛЕНИЕ ОТЧЁТНОСТИ', colW[1], {bold:true, sz:SZ_S}),
           cell('', colW[2], {sz:SZ_S}), cell('', colW[3], {sz:SZ_S}), cell('', colW[4], {sz:SZ_S})]),
      mk('12', 'Изъятие из картотек карточек на граждан, подлежащих исключению с воинского учёта по возрасту или болезни', 'Перед составлением отчёта', resp),
      mk('13', 'Составление отчёта по форме № 18', 'До 15 ноября', resp),

      // Раздел: прочие мероприятия
      row([cell('', colW[0], {bold:true, sz:SZ_S}),
           cell('ДРУГИЕ МЕРОПРИЯТИЯ', colW[1], {bold:true, sz:SZ_S}),
           cell('', colW[2], {sz:SZ_S}), cell('', colW[3], {sz:SZ_S}), cell('', colW[4], {sz:SZ_S})]),
      mk('14', 'Учёт граждан, заявивших об изменении состояния здоровья, и уведомление военкомата', 'Ежемесячно', resp),
      mk('15', 'Выявление граждан женского пола, подлежащих постановке на воинский учёт', 'Постоянно', resp),
      mk('16', 'Уточнение плана оповещения граждан, имеющих мобилизационные предписания', '1 раз в полугодие', resp),
      mk('17', 'Изучение руководящих документов по воинскому учёту', 'Постоянно', resp),
      mk('18', 'Подготовка проекта приказа и акта на передачу документов на период отпуска/командировки/нетрудоспособности', 'Перед отпуском, командировкой', resp),
    ]),

    ...eL(2),
    p(`Ответственный за кадровое делопроизводство`),
    signLine(respPos, respFio),
    ...eL(1),
    p(`Ответственный за военно-учётную работу`),
    signLine(respPos, respFio),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-03') },
    children: ch,
  }], dir, 'ВУ-03 План работы по осуществлению воинского учёта.docx');
}

// ── ДОКУМЕНТ 4: КАРТОЧКА УЧЁТА ОРГАНИЗАЦИИ (ФОРМА № 18) ────

async function gen_vu_04(c, s, dir) {
  const vu  = getVuData(c);
  const st  = empStats(c);
  const byPos = empByPosition(c);
  const hasBron = vu.has_bronirowanie === true || vu.has_bronirowanie === 'true';
  const dirFio  = directorFio(c);
  const dirPos  = directorPos(c);
  const respFio = vuRespFio(c, vu);
  const respPos = vuRespPos(c, vu);
  const respPhone = vuRespPhone(c, vu);
  const year = docYear(c);
  const reportDate = `01.01.${String(docYearNum(c) + 1)}`;

  const CW_FORM = 9026; // A4 портрет
  const col2 = [4500, 4526];

  // Строка двух ячеек: метка | значение
  const f2 = (label, value, opts = {}) => row([
    cell(label,  col2[0], { sz: SZ_S, ...opts }),
    cell(value || '—', col2[1], { sz: SZ_S, bold: !!opts.boldVal }),
  ]);

  // Строка кодов
  const colCodes = [3200, 1200, 1200, 1200, 2426];
  const codeTbl = new Table({
    width: { size: CW_FORM, type: WidthType.DXA },
    columnWidths: colCodes,
    rows: [
      new TableRow({ children: [
        cell('Наименование показателя', colCodes[0], { bold:true, sz:SZ_S }),
        cell('Аббр.', colCodes[1], { bold:true, center:true, sz:SZ_S }),
        cell('Код', colCodes[2], { bold:true, center:true, sz:SZ_S }),
        cell('', colCodes[3], { sz:SZ_S }),
        cell('', colCodes[4], { sz:SZ_S }),
      ]}),
      new TableRow({ children: [
        cell('Индивидуальный номер налогоплательщика', colCodes[0], { sz:SZ_S }),
        cell('ИНН', colCodes[1], { center:true, sz:SZ_S }),
        cell(c.inn || '', colCodes[2], { bold:true, center:true, sz:SZ_S }),
        cell('', colCodes[3], { sz:SZ_S }),
        cell('', colCodes[4], { sz:SZ_S }),
      ]}),
      new TableRow({ children: [
        cell('Основной государственный регистрационный номер', colCodes[0], { sz:SZ_S }),
        cell('ОГРН', colCodes[1], { center:true, sz:SZ_S }),
        cell(c.ogrn || vu.ogrn || '', colCodes[2], { bold:true, center:true, sz:SZ_S }),
        cell('', colCodes[3], { sz:SZ_S }),
        cell('', colCodes[4], { sz:SZ_S }),
      ]}),
      new TableRow({ children: [
        cell('Код административно-территориального деления', colCodes[0], { sz:SZ_S }),
        cell('ОКАТО', colCodes[1], { center:true, sz:SZ_S }),
        cell(vu.okato || '', colCodes[2], { center:true, sz:SZ_S }),
        cell('', colCodes[3], { sz:SZ_S }),
        cell('', colCodes[4], { sz:SZ_S }),
      ]}),
      new TableRow({ children: [
        cell('Код по общероссийскому классификатору предприятий и организаций', colCodes[0], { sz:SZ_S }),
        cell('ОКПО', colCodes[1], { center:true, sz:SZ_S }),
        cell(vu.okpo || '', colCodes[2], { center:true, sz:SZ_S }),
        cell('', colCodes[3], { sz:SZ_S }),
        cell('', colCodes[4], { sz:SZ_S }),
      ]}),
      new TableRow({ children: [
        cell('Организационно-правовая форма', colCodes[0], { sz:SZ_S }),
        cell('ОКОПФ', colCodes[1], { center:true, sz:SZ_S }),
        cell(vu.okopf || '', colCodes[2], { center:true, sz:SZ_S }),
        cell(c.org_type || '', colCodes[3], { sz:SZ_S }),
        cell('', colCodes[4], { sz:SZ_S }),
      ]}),
      new TableRow({ children: [
        cell('Форма собственности', colCodes[0], { sz:SZ_S }),
        cell('ОКФС', colCodes[1], { center:true, sz:SZ_S }),
        cell(vu.okfs || '16', colCodes[2], { center:true, sz:SZ_S }),
        cell('Частная собственность', colCodes[3], { sz:SZ_S }),
        cell('', colCodes[4], { sz:SZ_S }),
      ]}),
      new TableRow({ children: [
        cell('Основной код ОКВЭД', colCodes[0], { sz:SZ_S }),
        cell('ОКВЭД', colCodes[1], { center:true, sz:SZ_S }),
        cell(c.okved || '', colCodes[2], { center:true, sz:SZ_S }),
        cell(vu.okved_name || '', colCodes[3], { sz:SZ_S }),
        cell('', colCodes[4], { sz:SZ_S }),
      ]}),
      new TableRow({ children: [
        cell('Неосновные коды ОКВЭД', colCodes[0], { sz:SZ_S }),
        cell('', colCodes[1], { sz:SZ_S }),
        cell(c.okved_extra || vu.okved_extra || '', colCodes[2]+colCodes[3]+colCodes[4], { sz:SZ_S }),
      ]}),
    ],
  });

  // Таблица сведений о работающих
  const colStats = [4500, 4526];
  const stat = (label, val) => new TableRow({ children: [
    cell(label, colStats[0], { sz:SZ_S }),
    cell(String(val ?? '—'), colStats[1], { bold: true, center: true, sz:SZ_S }),
  ]});

  const statsTbl = new Table({
    width: { size: CW_FORM, type: WidthType.DXA },
    columnWidths: colStats,
    rows: [
      new TableRow({ children: [
        cell('10. Сведения о работающих (чел.):', colStats[0]+colStats[1], { bold:true, sz:SZ_S }),
      ]}),
      stat('   всего работающих', st.total),
      stat('   из них:', ''),
      stat('10.1   Граждан, пребывающих в запасе:', st.zapas),
      stat('        из них:', ''),
      stat('        а) офицеров и генералов', st.oficery),
      stat('        б) прапорщиков, мичманов, сержантов и старшин, солдат и матросов', st.praporsh),
      stat('        в том числе, ограниченно годных к военной службе', st.ogr),
      stat('10.2   Забронированных граждан, пребывающих в запасе', hasBron ? st.bron : '—'),
      stat('10.3   Граждан, пребывающих в запасе, имеющих мобилизационное предписание', st.mobpred),
      stat('10.4   Граждан, подлежащих призыву на военную службу', st.prizyvniki),
      stat('10.5   Незабронированных граждан, пребывающих в запасе', hasBron ? st.nezabron : st.zapas),
    ],
  });

  // Таблица пунктов 11-15
  const infoRows = [
    new TableRow({ children: [
      cell('11. Ведёт ли организация бронирование (да, нет)', colStats[0], { sz:SZ_S }),
      cell(hasBron ? 'да' : 'нет', colStats[1], { bold:true, center:true, sz:SZ_S }),
    ]}),
  ];
  if (hasBron) {
    infoRows.push(new TableRow({ children: [
      cell('12. Коды вида экономической деятельности и должности из Перечня должностей и профессий, по которым бронируются граждане', colStats[0], { sz:SZ_S }),
      cell(vu.bron_codes || '', colStats[1], { sz:SZ_S }),
    ]}));
    infoRows.push(new TableRow({ children: [
      cell('13. В сфере ведения какого органа государственной власти находится', colStats[0], { sz:SZ_S }),
      cell(vu.gov_organ || '', colStats[1], { sz:SZ_S }),
    ]}));
    infoRows.push(new TableRow({ children: [
      cell('14. Входит в орган управления государственной власти (да, нет)', colStats[0], { sz:SZ_S }),
      cell(vu.in_gov_organ ? 'да' : 'нет', colStats[1], { bold:true, center:true, sz:SZ_S }),
    ]}));
  }
  infoRows.push(new TableRow({ children: [
    cell('15. Дополнительная информация', colStats[0], { sz:SZ_S }),
    cell(vu.dop_info || (hasBron ? '' : '—'), colStats[1], { sz:SZ_S }),
  ]}));
  const infoTbl = new Table({ width: { size: CW_FORM, type: WidthType.DXA }, columnWidths: colStats, rows: infoRows });

  // Итоговая таблица по должностям
  const colFinal = [2600, 1500, 1500, 1700, 1726];
  const finalHdr = new TableRow({ children: [
    cell('Наименование должностей', colFinal[0], { bold:true, center:true, sz:SZ_S }),
    cell('Всего работающих', colFinal[1], { bold:true, center:true, sz:SZ_S }),
    cell('Пребывающих в запасе всего', colFinal[2], { bold:true, center:true, sz:SZ_S }),
    cell('в том числе офицеров', colFinal[3], { bold:true, center:true, sz:SZ_S }),
    cell('Прапорщиков, мичманов, сержантов, старшин, солдат и матросов', colFinal[4], { bold:true, center:true, sz:SZ_S }),
  ]});

  const posRows = byPos.map(pos => new TableRow({ children: [
    cell(pos.name, colFinal[0], { sz:SZ_S }),
    cell(String(pos.total || '—'), colFinal[1], { center:true, sz:SZ_S }),
    cell(String(pos.zapas || '—'), colFinal[2], { center:true, sz:SZ_S }),
    cell(String(pos.oficery || '—'), colFinal[3], { center:true, sz:SZ_S }),
    cell(String(pos.praporsh || '—'), colFinal[4], { center:true, sz:SZ_S }),
  ]}));

  const totals = byPos.reduce((acc, p) => ({
    total: acc.total + p.total,
    zapas: acc.zapas + p.zapas,
    oficery: acc.oficery + p.oficery,
    praporsh: acc.praporsh + p.praporsh,
  }), { total:0, zapas:0, oficery:0, praporsh:0 });

  const finalTbl = new Table({
    width: { size: CW_FORM, type: WidthType.DXA },
    columnWidths: colFinal,
    rows: [
      finalHdr,
      ...posRows,
      new TableRow({ children: [
        cell('Всего:', colFinal[0], { bold:true, sz:SZ_S }),
        cell(String(totals.total), colFinal[1], { bold:true, center:true, sz:SZ_S }),
        cell(String(totals.zapas), colFinal[2], { bold:true, center:true, sz:SZ_S }),
        cell(String(totals.oficery), colFinal[3], { bold:true, center:true, sz:SZ_S }),
        cell(String(totals.praporsh), colFinal[4], { bold:true, center:true, sz:SZ_S }),
      ]}),
    ],
  });

  const ch = [
    // Заголовок
    new Table({
      width: { size: CW_FORM, type: WidthType.DXA },
      columnWidths: [7000, 2026],
      borders: { top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE}, insideH:{style:BorderStyle.NONE}, insideV:{style:BorderStyle.NONE} },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 7000, type: WidthType.DXA },
          borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Форма 18', font: FONT, size: SZ, bold: true })] }),
          ],
        }),
        new TableCell({
          width: { size: 2026, type: WidthType.DXA },
          borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [
              new TextRun({ text: `По состоянию на  ${reportDate}`, font: FONT, size: SZ_S }),
            ]}),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [
              new TextRun({ text: 'Регистрационный номер __________', font: FONT, size: SZ_S }),
            ]}),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [
              new TextRun({ text: '(присваивается районной комиссией)', font: FONT, size: SZ_S - 2, italics: true }),
            ]}),
          ],
        }),
      ]})]
    }),
    ...eL(1),
    H('КАРТОЧКА'),
    SH('учёта организации'),
    ...eL(1),

    // Основные реквизиты
    new Table({
      width: { size: CW_FORM, type: WidthType.DXA },
      columnWidths: col2,
      rows: [
        f2('Полное наименование организации:', c.full_name || c.name, { boldVal: true }),
        f2('Ф.И.О., телефон (факс), должность руководителя:', `${dirPos}, ${dirFio}${c.phone ? ', ' + c.phone : ''}`),
        f2('Ф.И.О., телефон (факс), должность ответственного за воинский учёт:', `${respFio}${respPhone ? ', ' + respPhone : ''}, ${respPos}`),
        f2('Дата и место регистрации (перерегистрации):', vu.reg_date_place || ''),
        f2('Юридический адрес:', c.address || vu.address_legal || ''),
        f2('Фактический адрес:', vu.address_actual || c.address || ''),
        f2('Почтовый адрес:', vu.address_postal || c.address || ''),
        f2('Вышестоящая организация:', vu.parent_org || '—'),
        f2('Основные коды организации:', c.okved || ''),
      ],
    }),
    ...eL(1),

    // Коды организации
    codeTbl,
    ...eL(1),

    // Сведения о работающих
    statsTbl,
    ...eL(1),

    // Пункты 11-15
    infoTbl,
    ...eL(1),

    // Итоговая таблица по должностям
    finalTbl,
    ...eL(2),

    // Подпись
    signLine(dirPos, dirFio),
    ...eL(1),
    p('М. П.'),
    ...eL(1),
    p(`«____» _________________ ${docYear(c)} г.`),
    ...eL(2),
    p('Отметка о снятии с учёта (ликвидации организации)'),
    p('(заполняется в районной комиссии)'),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-04 Форма 18') },
    children: ch,
  }], dir, 'ВУ-04 Карточка учёта организации (Форма №18).docx');
}

// ── ДОКУМЕНТ 5: ЖУРНАЛ ПРОВЕРОК ВОИНСКОГО УЧЁТА ────────────

async function gen_vu_05(c, s, dir) {
  const vu = getVuData(c);
  const CW_L = 15398;
  const colW = [800, 1600, 2000, 3000, 3000, 2800, 2198];
  const hdr = row([
    cell('№ п/п', colW[0], { bold:true, center:true, sz:SZ_S }),
    cell('Дата проверки', colW[1], { bold:true, center:true, sz:SZ_S }),
    cell('Кем проводилась проверка', colW[2], { bold:true, center:true, sz:SZ_S }),
    cell('Что проверялось', colW[3], { bold:true, center:true, sz:SZ_S }),
    cell('Результат проверки', colW[4], { bold:true, center:true, sz:SZ_S }),
    cell('Предложения по устранению нарушений', colW[5], { bold:true, center:true, sz:SZ_S }),
    cell('Отметка об устранении', colW[6], { bold:true, center:true, sz:SZ_S }),
  ]);
  const emptyRows = Array.from({length:20}, (_,i) => row([
    cell(String(i+1), colW[0], {center:true, sz:SZ_S}),
    ...colW.slice(1).map(w => cell('', w, {sz:SZ_S})),
  ]));

  const ch = [
    H('ЖУРНАЛ'),
    SH('проверок осуществления воинского учёта'),
    SH(safe(c.name)),
    ...eL(1),
    tbl(colW, [hdr, ...emptyRows]),
  ];

  return save([{
    properties: { page: { size: { width: 16838, height: 11906 }, margin: { top: 1000, bottom: 1000, left: 1200, right: 1000 } } },
    footers: { default: footer('ВУ-05') },
    children: ch,
  }], dir, 'ВУ-05 Журнал проверок осуществления воинского учёта.docx');
}

// ── ДОКУМЕНТ 6: РАСПИСКА В ПОЛУЧЕНИИ ДОКУМЕНТОВ ────────────

async function gen_vu_06(c, s, dir) {
  const vu = getVuData(c);
  const respFio = vuRespFio(c, vu);
  const respPos = vuRespPos(c, vu);

  const ch = [
    H('РАСПИСКА'),
    SH('в получении документов воинского учёта'),
    ...eL(1),
    p([
      new TextRun({ text: 'Я, ', font: FONT, size: SZ }),
      new TextRun({ text: '______________________________________________________', font: FONT, size: SZ }),
      new TextRun({ text: ',', font: FONT, size: SZ }),
    ]),
    p('(фамилия, имя, отчество)'),
    ...eL(1),
    p([
      new TextRun({ text: 'принял(-а) от ответственного за воинский учёт ', font: FONT, size: SZ }),
      new TextRun({ text: `${safe(c.name)}`, font: FONT, size: SZ }),
    ]),
    p([
      new TextRun({ text: `${respPos} ${respFio}`, font: FONT, size: SZ }),
      new TextRun({ text: ' следующие документы воинского учёта:', font: FONT, size: SZ }),
    ]),
    ...eL(1),
    bul('□ Военный билет серия _______ № _______'),
    bul('□ Удостоверение гражданина, подлежащего призыву на военную службу № _______'),
    bul('□ Справка взамен военного билета серия _______ № _______'),
    bul('□ Иные документы: ___________________________________________________'),
    ...eL(2),
    p('Документы получил(-а):'),
    ...eL(1),
    signLine('', '_______________'),
    p('(подпись)                                          (расшифровка подписи)'),
    ...eL(1),
    p(`Дата: «____» ______________ ${docYear(c)} г.`),
    ...eL(2),
    p('Документы передал(-а):'),
    ...eL(1),
    signLine(respPos, respFio),
    ...eL(1),
    p(`Дата: «____» ______________ ${docYear(c)} г.`),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-06') },
    children: ch,
  }], dir, 'ВУ-06 Расписка в получении документов воинского учёта.docx');
}

// ── ДОКУМЕНТ 7: УВЕДОМЛЕНИЕ О ПРИЁМЕ НА РАБОТУ ─────────────

async function gen_vu_07(c, s, dir) {
  const vu  = getVuData(c);
  const vk  = voenkomat(vu);
  const dirFio = directorFio(c);
  const dirPos = directorPos(c);

  const ch = [
    pR(`${vk}`),
    pR('от ' + safe(c.name)),
    pR(c.address || ''),
    ...eL(2),
    H('УВЕДОМЛЕНИЕ'),
    SH('о принятии на работу гражданина,\nсостоящего на воинском учёте'),
    ...eL(1),
    p([
      new TextRun({ text: `${safe(c.name)} в соответствии с п. 32 Положения о воинском учёте (Постановление Правительства РФ от 27.11.2006 № 719) уведомляет о принятии на работу гражданина, состоящего на воинском учёте:`, font: FONT, size: SZ }),
    ]),
    ...eL(1),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4000, 5026],
      rows: [
        f2row('Фамилия, имя, отчество:', '______________________________________'),
        f2row('Дата рождения:', '______________________________________'),
        f2row('Место рождения:', '______________________________________'),
        f2row('Военкомат постановки на учёт:', '______________________________________'),
        f2row('Воинское звание:', '______________________________________'),
        f2row('Состав (профиль):', '______________________________________'),
        f2row('ВУС (код):', '______________________________________'),
        f2row('Категория запаса:', '______________________________________'),
        f2row('Наименование должности:', '______________________________________'),
        f2row('Дата приёма на работу:', '______________________________________'),
      ],
    }),
    ...eL(2),
    signLine(dirPos, dirFio),
    ...eL(1),
    p(`Дата: «____» ______________ ${docYear(c)} г.`),
    p('М. П.'),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-07') },
    children: ch,
  }], dir, 'ВУ-07 Уведомление в военкомат о приёме военнообязанного.docx');
}

function f2row(label, value) {
  return new TableRow({ children: [
    cell(label, 4000, { sz: SZ_S }),
    cell(value, 5026, { sz: SZ_S }),
  ]});
}

// ── ДОКУМЕНТ 8: УВЕДОМЛЕНИЕ ОБ УВОЛЬНЕНИИ ──────────────────

async function gen_vu_08(c, s, dir) {
  const vu  = getVuData(c);
  const vk  = voenkomat(vu);
  const dirFio = directorFio(c);
  const dirPos = directorPos(c);

  const ch = [
    pR(`${vk}`),
    pR('от ' + safe(c.name)),
    pR(c.address || ''),
    ...eL(2),
    H('УВЕДОМЛЕНИЕ'),
    SH('об увольнении гражданина,\nсостоящего на воинском учёте'),
    ...eL(1),
    p(`${safe(c.name)} в соответствии с п. 32 Положения о воинском учёте (Постановление Правительства РФ от 27.11.2006 № 719) уведомляет об увольнении с работы гражданина, состоящего на воинском учёте:`),
    ...eL(1),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4000, 5026],
      rows: [
        f2row('Фамилия, имя, отчество:', '______________________________________'),
        f2row('Дата рождения:', '______________________________________'),
        f2row('Воинское звание:', '______________________________________'),
        f2row('ВУС (код):', '______________________________________'),
        f2row('Занимаемая должность:', '______________________________________'),
        f2row('Дата увольнения:', '______________________________________'),
        f2row('Причина увольнения:', '______________________________________'),
      ],
    }),
    ...eL(2),
    signLine(dirPos, dirFio),
    ...eL(1),
    p(`Дата: «____» ______________ ${docYear(c)} г.`),
    p('М. П.'),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-08') },
    children: ch,
  }], dir, 'ВУ-08 Уведомление в военкомат об увольнении военнообязанного.docx');
}

// ── ДОКУМЕНТ 9: АКТ СВЕРКИ С ВОЕНКОМАТОМ ───────────────────

async function gen_vu_09(c, s, dir) {
  const vu  = getVuData(c);
  const st  = empStats(c);
  const dirFio = directorFio(c);
  const dirPos = directorPos(c);
  const respFio = vuRespFio(c, vu);
  const respPos = vuRespPos(c, vu);
  const vk = voenkomat(vu);

  const ch = [
    H('АКТ'),
    SH(`сверки учётных данных граждан, пребывающих в запасе,\nсостоящих на воинском учёте в ${safe(c.name)},\nс учётными данными ${vk}`),
    ...eL(1),
    p(`«____» ______________ ${docYear(c)} г.`),
    ...eL(1),
    p(`Мы, нижеподписавшиеся, представитель ${vk} _____________________________ и ответственный за воинский учёт ${safe(c.name)} ${respFio}, составили настоящий акт о том, что произведена сверка учётных данных граждан, пребывающих в запасе, работающих в ${safe(c.name)}.`),
    ...eL(1),
    p('По состоянию на дату сверки:'),
    ...eL(1),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [6000, 1500, 1526],
      rows: [
        new TableRow({ children: [
          cell('Показатель', 6000, { bold:true, center:true, sz:SZ_S }),
          cell('По данным организации', 1500, { bold:true, center:true, sz:SZ_S }),
          cell('По данным военкомата', 1526, { bold:true, center:true, sz:SZ_S }),
        ]}),
        new TableRow({ children: [
          cell('Всего работающих', 6000, { sz:SZ_S }),
          cell(String(st.total), 1500, { center:true, sz:SZ_S }),
          cell('', 1526, { sz:SZ_S }),
        ]}),
        new TableRow({ children: [
          cell('Граждан, пребывающих в запасе', 6000, { sz:SZ_S }),
          cell(String(st.zapas), 1500, { center:true, sz:SZ_S }),
          cell('', 1526, { sz:SZ_S }),
        ]}),
        new TableRow({ children: [
          cell('Граждан, подлежащих призыву на военную службу', 6000, { sz:SZ_S }),
          cell(String(st.prizyvniki), 1500, { center:true, sz:SZ_S }),
          cell('', 1526, { sz:SZ_S }),
        ]}),
      ],
    }),
    ...eL(1),
    p('Расхождения (при наличии):'),
    p('___________________________________________________________________________________'),
    p('___________________________________________________________________________________'),
    ...eL(2),
    p('Сверку произвели:'),
    ...eL(1),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4500, 4526],
      borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE},insideH:{style:BorderStyle.NONE},insideV:{style:BorderStyle.NONE} },
      rows: [new TableRow({ children: [
        new TableCell({
          width:{size:4500,type:WidthType.DXA},
          borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}},
          children: [
            pL('От военного комиссариата:'),
            pL('______________  _______________'),
            pL('(подпись)           (ФИО)'),
          ],
        }),
        new TableCell({
          width:{size:4526,type:WidthType.DXA},
          borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}},
          children: [
            pL(`От ${safe(c.name)}:`),
            pL(`______________  ${initials(respFio)}`),
            pL(`${respPos}`),
          ],
        }),
      ]})]
    }),
    ...eL(1),
    p(`Дата: «____» ______________ ${docYear(c)} г.`),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-09') },
    children: ch,
  }], dir, 'ВУ-09 Акт сверки с военным комиссариатом.docx');
}

// ── ДОКУМЕНТ 10: СПРАВКА О ЧИСЛЕННОСТИ ВОЕННООБЯЗАННЫХ ─────

async function gen_vu_10(c, s, dir) {
  const vu  = getVuData(c);
  const st  = empStats(c);
  const dirFio = directorFio(c);
  const dirPos = directorPos(c);
  const respFio = vuRespFio(c, vu);
  const respPos = vuRespPos(c, vu);
  const year = docYear(c);
  const vk = voenkomat(vu);

  const ch = [
    H('СПРАВКА'),
    SH(`о численности военнообязанных работников\n${safe(c.name)}\nпо состоянию на «____» ______________ ${year} г.`),
    ...eL(1),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [6000, 3026],
      rows: [
        new TableRow({ children: [
          cell('Показатель', 6000, { bold:true, center:true, sz:SZ_S }),
          cell('Кол-во (чел.)', 3026, { bold:true, center:true, sz:SZ_S }),
        ]}),
        new TableRow({ children: [cell('Всего работников (по трудовым договорам)', 6000, {sz:SZ_S}), cell(String(st.total), 3026, {center:true,sz:SZ_S})] }),
        new TableRow({ children: [cell('Граждан, пребывающих в запасе — итого:', 6000, {bold:true,sz:SZ_S}), cell(String(st.zapas), 3026, {bold:true,center:true,sz:SZ_S})] }),
        new TableRow({ children: [cell('   в т.ч. офицеры и генералы', 6000, {sz:SZ_S}), cell(String(st.oficery), 3026, {center:true,sz:SZ_S})] }),
        new TableRow({ children: [cell('   прапорщики, мичманы, сержанты, солдаты и матросы', 6000, {sz:SZ_S}), cell(String(st.praporsh), 3026, {center:true,sz:SZ_S})] }),
        new TableRow({ children: [cell('   из них: ограниченно годные к военной службе', 6000, {sz:SZ_S}), cell(String(st.ogr), 3026, {center:true,sz:SZ_S})] }),
        new TableRow({ children: [cell('Забронированных граждан, пребывающих в запасе', 6000, {sz:SZ_S}), cell(String(st.bron), 3026, {center:true,sz:SZ_S})] }),
        new TableRow({ children: [cell('Граждан с мобилизационными предписаниями', 6000, {sz:SZ_S}), cell(String(st.mobpred), 3026, {center:true,sz:SZ_S})] }),
        new TableRow({ children: [cell('Граждан, подлежащих призыву на военную службу', 6000, {sz:SZ_S}), cell(String(st.prizyvniki), 3026, {center:true,sz:SZ_S})] }),
        new TableRow({ children: [cell('Незабронированных граждан, пребывающих в запасе', 6000, {sz:SZ_S}), cell(String(st.nezabron), 3026, {center:true,sz:SZ_S})] }),
      ],
    }),
    ...eL(2),
    p(`Справка составлена для представления в ${vk}.`),
    ...eL(2),
    signLine(respPos, respFio),
    ...eL(1),
    p(`Дата: «____» ______________ ${year} г.`),
    p('М. П.'),
  ];

  return save([{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: MP } },
    footers: { default: footer('ВУ-10') },
    children: ch,
  }], dir, 'ВУ-10 Справка о численности военнообязанных работников.docx');
}

// ── ГЛАВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ ПАКЕТА ВУ ────────────────────

async function generateVuPackage(client, settings, outputDir, tmpRoot) {
  const fs   = require('fs');
  const path = require('path');

  const s = settings || {};

  // Папка модуля ВУ
  const vuDir = path.join(outputDir, 'Воинский учёт');
  fs.mkdirSync(vuDir, { recursive: true });

  // Миграция: переносим документы из старой плоской структуры
  // (когда все файлы лежали прямо в «Воинский учёт») в подпапки разделов.
  migrateVuFolders(vuDir);

  // Временная папка (берём из generator.js или создаём свою)
  const myTmpRoot = tmpRoot || path.join(outputDir, '__tmp_vu');
  fs.mkdirSync(myTmpRoot, { recursive: true });

  const generated = [];
  const errors    = [];
  const report    = { userModified: [] };

  const run = makeRunner(client, s, outputDir, myTmpRoot, generated, errors, report);

  // Полные имена файлов нужны, чтобы определить раздел через sections.js.
  const docs = [
    { fn: gen_vu_01, file: 'ВУ-01 Приказ о назначении ответственного за воинский учёт.docx' },
    { fn: gen_vu_02, file: 'ВУ-02 Функциональные обязанности ответственного за воинский учёт.docx' },
    { fn: gen_vu_03, file: 'ВУ-03 План работы по осуществлению воинского учёта.docx' },
    { fn: gen_vu_04, file: 'ВУ-04 Карточка учёта организации (Форма №18).docx' },
    { fn: gen_vu_05, file: 'ВУ-05 Журнал проверок осуществления воинского учёта.docx' },
    { fn: gen_vu_06, file: 'ВУ-06 Расписка в получении документов воинского учёта.docx' },
    { fn: gen_vu_07, file: 'ВУ-07 Уведомление в военкомат о приёме военнообязанного.docx' },
    { fn: gen_vu_08, file: 'ВУ-08 Уведомление в военкомат об увольнении военнообязанного.docx' },
    { fn: gen_vu_09, file: 'ВУ-09 Акт сверки с военным комиссариатом.docx' },
    { fn: gen_vu_10, file: 'ВУ-10 Справка о численности военнообязанных работников.docx' },
  ];

  // Заранее создаём папки нужных разделов
  for (const doc of docs) {
    const folder = sectionFolder('VU', sectionOf('VU', doc.file));
    fs.mkdirSync(path.join(vuDir, folder), { recursive: true });
  }

  for (const doc of docs) {
    const folder   = sectionFolder('VU', sectionOf('VU', doc.file));
    const finalDir = path.join(vuDir, folder);
    await run(doc.fn, finalDir);
  }

  // Очищаем свою tmpRoot если создавали сами
  if (!tmpRoot) {
    try { fs.rmSync(myTmpRoot, {recursive:true, force:true}); } catch(e) {}
  }

  return { generated, errors, report };
}

/**
 * Миграция старой структуры ВУ: если документы лежат прямо в папке
 * «Воинский учёт» (плоско), переносит их в подпапки разделов согласно
 * sections.js. Безопасна для повторного вызова: если файл уже в подпапке
 * или его нет — ничего не делает. Существующие файлы в подпапке не трогаем
 * (чтобы не затереть правки пользователя — там разберётся обычная генерация).
 */
function migrateVuFolders(vuDir) {
  const fs   = require('fs');
  const path = require('path');
  if (!fs.existsSync(vuDir)) return;

  let entries;
  try { entries = fs.readdirSync(vuDir, { withFileTypes: true }); }
  catch(e) { return; }

  for (const ent of entries) {
    if (!ent.isFile()) continue;                 // только файлы верхнего уровня
    if (!ent.name.toLowerCase().endsWith('.docx')) continue;
    if (ent.name.startsWith('~$')) continue;     // временные файлы Word

    const sid = sectionOf('VU', ent.name);
    const folder = sectionFolder('VU', sid);
    const srcPath = path.join(vuDir, ent.name);
    const dstDir  = path.join(vuDir, folder);
    const dstPath = path.join(dstDir, ent.name);

    if (srcPath === dstPath) continue;           // уже на месте (не должно быть, но на всякий)
    try {
      fs.mkdirSync(dstDir, { recursive: true });
      if (fs.existsSync(dstPath)) {
        // В подпапке уже есть актуальная версия — старый плоский файл удаляем
        fs.unlinkSync(srcPath);
      } else {
        fs.renameSync(srcPath, dstPath);
      }
    } catch(e) {
      // Файл занят (открыт в Word) или иная ошибка — пропускаем, не валимся
    }
  }
}

async function generateVuReports(client, settings, outputDir, docs, tmpRoot) {
  const fs   = require('fs');
  const path = require('path');

  const s = settings || {};

  const vuDir = path.join(outputDir, 'Воинский учёт');
  fs.mkdirSync(vuDir, { recursive: true });

  // Миграция старой плоской структуры (если ещё не переносили)
  migrateVuFolders(vuDir);

  const myTmpRoot = tmpRoot || path.join(outputDir, '__tmp_vu_reports');
  fs.mkdirSync(myTmpRoot, { recursive: true });

  const generated = [];
  const errors    = [];
  const report    = { userModified: [] };

  const run = makeRunner(client, s, outputDir, myTmpRoot, generated, errors, report);

  const available = {
    form18: { fn: gen_vu_04, file: 'ВУ-04 Карточка учёта организации (Форма №18).docx' },
    plan:   { fn: gen_vu_03, file: 'ВУ-03 План работы по осуществлению воинского учёта.docx' },
  };

  for (const key of docs) {
    const doc = available[key];
    if (!doc) continue;
    const folder   = sectionFolder('VU', sectionOf('VU', doc.file));
    const finalDir = path.join(vuDir, folder);
    fs.mkdirSync(finalDir, { recursive: true });
    await run(doc.fn, finalDir);
  }

  if (!tmpRoot) {
    try { fs.rmSync(myTmpRoot, {recursive:true, force:true}); } catch(e) {}
  }

  return { generated, errors, report };
}

module.exports = { generateVuPackage, generateVuReports };
