'use strict';
// КомплаенсПро generator.js v2.0 — PART 3: Разделы 6, 7, чек-лист, главная функция

const base=require('./gen_p1');
const {norm,save,oNum,approvalBlock,approvalOrder,orderHead,orderSign,famSheet,famSheetOrder,devSign,bul,H,SH,p,pC,pR,pL,eL,cell,row,tbl,footer,FONT,SZ,SZ_S,SZ_H,MP,ML,CW}=base;
const {PageOrientation}=require('docx');

// ── РАЗДЕЛ 6 ───────────────────────────────────────────
// Ширина контента альбомный A4 = 15398 DXA

async function gen_06_01(c,s,dir){
  // Журнал вводного инструктажа — по образцу
  const CW_L = 15398;
  const colW = [600, 1200, 2800, 800, 2200, 2200, 2200, 2199];
  const hdr = row([
    cell('№ п/п',              colW[0],{bold:true,center:true,sz:SZ_S}),
    cell('Дата',               colW[1],{bold:true,center:true,sz:SZ_S}),
    cell('ФИО инструктируемого',colW[2],{bold:true,center:true,sz:SZ_S}),
    cell('Год рожд.',          colW[3],{bold:true,center:true,sz:SZ_S}),
    cell('Должность',          colW[4],{bold:true,center:true,sz:SZ_S}),
    cell('Инструктаж проводил',colW[5],{bold:true,center:true,sz:SZ_S}),
    cell('Подпись инструктора',colW[6],{bold:true,center:true,sz:SZ_S}),
    cell('Подпись инструктируемого',colW[7],{bold:true,center:true,sz:SZ_S}),
  ]);
  const emp = c.employees||[];
  const empRows = emp.map((e,i)=>row([
    cell(String(i+1),colW[0],{center:true,sz:SZ_S}),
    cell(c.doc_date, colW[1],{sz:SZ_S}),
    cell('',         colW[2],{sz:SZ_S}),
    cell('',         colW[3],{sz:SZ_S}),
    cell(e.position, colW[4],{sz:SZ_S}),
    cell('',         colW[5],{sz:SZ_S}),
    cell('',         colW[6],{sz:SZ_S}),
    cell('',         colW[7],{sz:SZ_S}),
  ]));
  const emptyRows = Array.from({length:25},(_,i)=>row(colW.map((w,j)=>cell(j===0?String(emp.length+i+1):'',w,{center:j===0,sz:SZ_S}))));
  const ch = [
    pC(c.name,{bold:true}),
    ...eL(1),
    H('ЖУРНАЛ'),
    H('регистрации вводного инструктажа по охране труда',SZ),
    ...eL(1),
    pL('Начат: «____» __________________ '+c.doc_year+' г.'),
    pL('Окончен: «____» __________________ ______ г.'),
    ...eL(1),
    tbl(colW,[hdr,...empRows,...emptyRows]),
  ];
  return save([{properties:{page:{size:{width:16838,height:11906,orientation:PageOrientation.LANDSCAPE},margin:ML}},footers:{default:footer('06.01')},children:ch}],dir,'Журнал регистрации вводного инструктажа.docx');
}

async function gen_06_02(c,s,dir){
  // Журнал инструктажа на рабочем месте — по образцу
  const colW = [500, 1000, 2500, 700, 1800, 1300, 800, 1800, 1800, 1800, 1400];
  const hdr = row([
    cell('№',                    colW[0],{bold:true,center:true,sz:SZ_S}),
    cell('Дата',                 colW[1],{bold:true,center:true,sz:SZ_S}),
    cell('ФИО инструктируемого', colW[2],{bold:true,center:true,sz:SZ_S}),
    cell('Год рожд.',            colW[3],{bold:true,center:true,sz:SZ_S}),
    cell('Должность',            colW[4],{bold:true,center:true,sz:SZ_S}),
    cell('Вид инструктажа',      colW[5],{bold:true,center:true,sz:SZ_S}),
    cell('Причина внепл.',       colW[6],{bold:true,center:true,sz:SZ_S}),
    cell('Инструктаж проводил',  colW[7],{bold:true,center:true,sz:SZ_S}),
    cell('Подпись инструктора',  colW[8],{bold:true,center:true,sz:SZ_S}),
    cell('Подпись инструктируемого',colW[9],{bold:true,center:true,sz:SZ_S}),
    cell('Допуск к работе',      colW[10],{bold:true,center:true,sz:SZ_S}),
  ]);
  const emptyRows = Array.from({length:30},(_,i)=>row(colW.map((w,j)=>cell(j===0?String(i+1):'',w,{center:j===0,sz:SZ_S}))));
  const ch = [
    pC(c.name,{bold:true}),
    ...eL(1),
    H('ЖУРНАЛ'),
    H('регистрации инструктажа на рабочем месте',SZ),
    ...eL(1),
    pL('Начат: «____» __________________ '+c.doc_year+' г.'),
    pL('Окончен: «____» __________________ ______ г.'),
    ...eL(1),
    tbl(colW,[hdr,...emptyRows]),
    ...eL(1),
    p([{t:'Виды инструктажей: ',b:true},{t:'П — первичный; Пв — повторный; Вн — внеплановый; Ц — целевой.'}],{sz:SZ_S}),
  ];
  return save([{properties:{page:{size:{width:16838,height:11906,orientation:PageOrientation.LANDSCAPE},margin:ML}},footers:{default:footer('06.02')},children:ch}],dir,'Журнал регистрации инструктажа на рабочем месте.docx');
}

async function gen_06_03(c,s,dir){
  // Журнал учёта микротравм
  const colW = [500, 2200, 1800, 2000, 2000, 1800, 1800, 1800, 1500];
  const hdr = row([
    cell('№',                           colW[0],{bold:true,center:true,sz:SZ_S}),
    cell('ФИО, должность пострадавшего',colW[1],{bold:true,center:true,sz:SZ_S}),
    cell('Место, дата и время',         colW[2],{bold:true,center:true,sz:SZ_S}),
    cell('Краткие обстоятельства',      colW[3],{bold:true,center:true,sz:SZ_S}),
    cell('Причины',                     colW[4],{bold:true,center:true,sz:SZ_S}),
    cell('Характер микротравмы',        colW[5],{bold:true,center:true,sz:SZ_S}),
    cell('Принятые меры',               colW[6],{bold:true,center:true,sz:SZ_S}),
    cell('Последствия',                 colW[7],{bold:true,center:true,sz:SZ_S}),
    cell('Кто внёс запись',             colW[8],{bold:true,center:true,sz:SZ_S}),
  ]);
  const emptyRows = Array.from({length:20},(_,i)=>row(colW.map((w,j)=>cell(j===0?String(i+1):'',w,{center:j===0,sz:SZ_S}))));
  const ch = [
    pC(c.name,{bold:true}),
    ...eL(1),
    H('ЖУРНАЛ'),
    H('учёта микроповреждений (микротравм) работников',SZ),
    ...eL(1),
    pL('Начат: «____» __________________ '+c.doc_year+' г.'),
    pL('Окончен: «____» __________________ ______ г.'),
    pL('Ответственный: '+c.ot_position+'  '+c.ot_name),
    ...eL(1),
    tbl(colW,[hdr,...emptyRows]),
  ];
  return save([{properties:{page:{size:{width:16838,height:11906,orientation:PageOrientation.LANDSCAPE},margin:ML}},footers:{default:footer('06.03')},children:ch}],dir,'Журнал учёта микротравм.docx');
}

async function gen_06_04(c,s,dir){
  // Журнал выдачи СИЗ
  const colW = [500, 2500, 2000, 700, 3000, 700, 1200, 1200, 1200, 1000];
  // сумма = 14000 — умещается в альбом
  const hdr = row([
    cell('№',                   colW[0],{bold:true,center:true,sz:SZ_S}),
    cell('ФИО работника',       colW[1],{bold:true,center:true,sz:SZ_S}),
    cell('Должность',           colW[2],{bold:true,center:true,sz:SZ_S}),
    cell('Таб. №',              colW[3],{bold:true,center:true,sz:SZ_S}),
    cell('Наименование СИЗ',    colW[4],{bold:true,center:true,sz:SZ_S}),
    cell('Кол-во',              colW[5],{bold:true,center:true,sz:SZ_S}),
    cell('Дата выдачи',         colW[6],{bold:true,center:true,sz:SZ_S}),
    cell('Срок носки (мес.)',   colW[7],{bold:true,center:true,sz:SZ_S}),
    cell('Подпись',             colW[8],{bold:true,center:true,sz:SZ_S}),
    cell('Примечание',          colW[9],{bold:true,center:true,sz:SZ_S}),
  ]);
  const emptyRows = Array.from({length:25},(_,i)=>row(colW.map((w,j)=>cell(j===0?String(i+1):'',w,{center:j===0,sz:SZ_S}))));
  const ch = [
    pC(c.name,{bold:true}),
    ...eL(1),
    H('ЖУРНАЛ'),
    H('учёта выдачи средств индивидуальной защиты',SZ),
    ...eL(1),
    pL('Начат: «____» __________________ '+c.doc_year+' г.'),
    pL('Окончен: «____» __________________ ______ г.'),
    ...eL(1),
    tbl(colW,[hdr,...emptyRows]),
  ];
  return save([{properties:{page:{size:{width:16838,height:11906,orientation:PageOrientation.LANDSCAPE},margin:ML}},footers:{default:footer('06.04')},children:ch}],dir,'Журнал учёта выдачи СИЗ.docx');
}

async function gen_06_05(c,s,dir){
  // Журнал контроля аптечки — портрет нормально
  const colW = [600, 1400, 2200, 1800, 3072, 2200, 1800];
  const hdr = row([
    cell('№',                       colW[0],{bold:true,center:true,sz:SZ_S}),
    cell('Дата проверки',           colW[1],{bold:true,center:true,sz:SZ_S}),
    cell('Соответствие комплектации',colW[2],{bold:true,center:true,sz:SZ_S}),
    cell('Сроки годности',          colW[3],{bold:true,center:true,sz:SZ_S}),
    cell('Выявленные недостатки',   colW[4],{bold:true,center:true,sz:SZ_S}),
    cell('Отметка об устранении',   colW[5],{bold:true,center:true,sz:SZ_S}),
    cell('Подпись',                 colW[6],{bold:true,center:true,sz:SZ_S}),
  ]);
  const emptyRows = Array.from({length:15},(_,i)=>row(colW.map((w,j)=>cell(j===0?String(i+1):'',w,{center:j===0,sz:SZ_S}))));
  const ch = [
    pC(c.name,{bold:true}),
    ...eL(1),
    H('ЖУРНАЛ'),
    H('контроля аптечки первой помощи',SZ),
    ...eL(1),
    pL('Ответственный: '+c.ot_position+'  '+c.ot_name),
    ...eL(1),
    tbl(colW,[hdr,...emptyRows]),
  ];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('06.05')},children:ch}],dir,'Журнал контроля аптечки первой помощи.docx');
}

async function gen_06_06(c,s,dir){
  // Личная карточка СИЗ — альбом
  const colW = [600, 4000, 1400, 1400, 1200, 1200, 1200, 2800];
  // сумма = 13800
  const hdr = row([
    cell('№',                   colW[0],{bold:true,center:true,sz:SZ_S}),
    cell('Наименование СИЗ',    colW[1],{bold:true,center:true,sz:SZ_S}),
    cell('Норма (ед./год)',      colW[2],{bold:true,center:true,sz:SZ_S}),
    cell('Дата выдачи',         colW[3],{bold:true,center:true,sz:SZ_S}),
    cell('Кол-во',              colW[4],{bold:true,center:true,sz:SZ_S}),
    cell('Размер',              colW[5],{bold:true,center:true,sz:SZ_S}),
    cell('% износа',            colW[6],{bold:true,center:true,sz:SZ_S}),
    cell('Подпись работника',   colW[7],{bold:true,center:true,sz:SZ_S}),
  ]);
  const emptyRows = Array.from({length:12},(_,i)=>row(colW.map((w,j)=>cell(j===0?String(i+1):'',w,{center:j===0,sz:SZ_S}))));
  const ch = [
    pC(c.name,{bold:true}),
    ...eL(1),
    H('ЛИЧНАЯ КАРТОЧКА',SZ_H),
    H('учёта выдачи средств индивидуальной защиты',SZ),
    ...eL(1),
    pL('ФИО работника: _______________________________________________________'),
    pL('Должность: ____________________________________________________________'),
    pL('Дата приёма на работу: ________________  Таб. №: ________________'),
    ...eL(1),
    tbl(colW,[hdr,...emptyRows]),
    ...eL(2),
    pL('Ответственный за ДСИЗ: ________________  '+(c.dsiz_name||c.manager_name)),
  ];
  return save([{properties:{page:{size:{width:16838,height:11906,orientation:PageOrientation.LANDSCAPE},margin:ML}},footers:{default:footer('06.06')},children:ch}],dir,'Личная карточка учёта выдачи СИЗ.docx');
}

// ── РАЗДЕЛ 7 ───────────────────────────────────────────

async function gen_07_01(c,s,dir){
  const orderN=oNum(c,6);
  const pColW=[700,5500,1400];
  const pH=row([cell('№ темы',pColW[0],{bold:true,center:true}),cell('Наименование темы',pColW[1],{bold:true,center:true}),cell('Время (мин)',pColW[2],{bold:true,center:true})]);
  const pD=[['1','Общие сведения об организации, характерные особенности деятельности','5'],['2','Основные положения законодательства об охране труда','5'],['3','Правила внутреннего трудового распорядка, ответственность','5'],['4','Основные вредные и опасные факторы, профессиональные риски','5'],['5','СИЗ, смывающие средства — порядок выдачи и применения','3'],['6','Аптечка первой помощи: место хранения, использование, контроль','3'],['7','Порядок действий при несчастном случае, микротравме','2'],['8','Пожарная безопасность. Действия при пожаре','2']];
  const pR=pD.map(r=>row([cell(r[0],pColW[0],{center:true,sz:SZ_S}),cell(r[1],pColW[1],{sz:SZ_S}),cell(r[2],pColW[2],{center:true,sz:SZ_S})]));
  const pT=row([cell('ИТОГО:',pColW[0]+pColW[1],{bold:true}),cell('30',pColW[2],{bold:true,center:true})]);
  const ch=[approvalOrder(c,orderN),...eL(1),H('ПРОГРАММА № 01-ПИ'),H('ВВОДНОГО ИНСТРУКТАЖА ПО ОХРАНЕ ТРУДА'),H(c.name.toUpperCase(),SZ),...eL(1),
    SH('1. Общие положения'),
    p('1.1. Определяет порядок и темы вводного инструктажа с работниками '+c.name+'.',{indent:true}),
    p('1.2. Проводит '+c.manager_position+' со всеми вновь принимаемыми, командированными, практикантами.',{indent:true}),
    p('1.3. Инструктаж — в день оформления на работу. Продолжительность: не менее 30 минут.',{indent:true}),
    p('1.4. Результат фиксируется в Журнале вводного инструктажа.',{indent:true}),
    SH('2. Тематический план'),
    tbl(pColW,[pH,...pR,pT]),
    SH('3. Содержание'),
    p([{t:'Тема 1. ',b:true},{t:'Общие сведения об организации'}]),
    bul(c.name+', г. '+c.city+'. ОКВЭД: '+c.okved+(c.okved_name?' — '+c.okved_name:'')+'.'),
    bul('Расположение помещений, санитарно-бытовых зон.'),
    p([{t:'Тема 2. ',b:true},{t:'Законодательство об охране труда'}]),
    bul('Ст. 212, 214, 215, 221, 223 ТК РФ — права и обязанности сторон.'),
    bul('Ответственность: дисциплинарная, административная, уголовная.'),
    p([{t:'Тема 3. ',b:true},{t:'Правила внутреннего трудового распорядка'}]),
    bul('Режим: пн–пт, 09:00–18:00, обед 13:00–14:00.'),
    p([{t:'Тема 4. ',b:true},{t:'Вредные и опасные факторы, профессиональные риски'}]),
    bul('ПЭВМ: зрительная нагрузка, статическое напряжение, ЭМИ.'),
    bul('Офис: недостаточная освещённость, нервно-психические перегрузки, опасность поражения током.'),
    p([{t:'Тема 5. ',b:true},{t:'СИЗ и смывающие средства'}]),
    bul('Жидкое мыло через дозаторы — 250 мл/чел./мес.'),
    p([{t:'Тема 6. ',b:true},{t:'Аптечка первой помощи'}]),
    bul('Место хранения (уточняется). Знак — зелёный квадрат с белым крестом.'),
    bul('Использовать перчатки и маску. После использования — сообщить ответственному.'),
    p([{t:'Тема 7. ',b:true},{t:'Несчастный случай, микротравма'}]),
    bul('Микротравма: руководитель → первая помощь → запись в журнал.'),
    bul('НС: первая помощь → 103/112 → сохранить обстановку → сообщить руководителю.'),
    p([{t:'Тема 8. ',b:true},{t:'Пожарная безопасность'}]),
    bul('Запрет курения, открытого огня, загромождения выходов.'),
    bul('При пожаре: 101/112 → руководитель → эвакуация → огнетушитель.'),
    SH('4. Заключительные положения'),
    p('4.1. Устная проверка знаний. Неудовлетворительный результат — к работе не допускается.',{indent:true}),
    ...devSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('07.01')},children:ch}],dir,'Программа вводного инструктажа по охране труда.docx');
}

async function gen_07_02(c,s,dir){
  const orderN=oNum(c,6);
  const pColW=[700,5500,1400];
  const pD=[['1','Технологический процесс и оборудование на рабочем месте','5'],['2','Опасные и вредные факторы на рабочем месте','5'],['3','Безопасная организация и содержание рабочего места','5'],['4','Опасные зоны, средства безопасности оборудования','5'],['5','Подготовка к работе, требования к СИЗ','3'],['6','Безопасные методы и приёмы выполнения работ','4'],['7','Действия при аварийной ситуации, несчастном случае','3']];
  const pH=row([cell('№ темы',pColW[0],{bold:true,center:true}),cell('Наименование темы',pColW[1],{bold:true,center:true}),cell('Время (мин)',pColW[2],{bold:true,center:true})]);
  const pR=pD.map(r=>row([cell(r[0],pColW[0],{center:true,sz:SZ_S}),cell(r[1],pColW[1],{sz:SZ_S}),cell(r[2],pColW[2],{center:true,sz:SZ_S})]));
  const pT=row([cell('ИТОГО:',pColW[0]+pColW[1],{bold:true}),cell('30',pColW[2],{bold:true,center:true})]);
  const ch=[approvalOrder(c,orderN),...eL(1),H('ПРОГРАММА № 02-ПИ'),H('ПЕРВИЧНОГО ИНСТРУКТАЖА НА РАБОЧЕМ МЕСТЕ'),H(c.name.toUpperCase(),SZ),...eL(1),
    SH('1. Общие положения'),
    p('1.1. Определяет порядок первичного инструктажа на рабочем месте.',{indent:true}),
    p('1.2. Проводит '+c.ot_position+' с работниками, не освобождёнными от инструктажа.',{indent:true}),
    p('1.3. Продолжительность: не менее 30 минут. Повторный — не реже 1 раза в 6 месяцев.',{indent:true}),
    SH('2. Тематический план'),
    tbl(pColW,[pH,...pR,pT]),
    SH('3. Содержание'),
    p([{t:'Тема 1. ',b:true},{t:'Рабочее место и оборудование'}]),
    bul('ПЭВМ, оргтехника, копировальная техника — ознакомление.'),
    p([{t:'Тема 2. ',b:true},{t:'Опасные и вредные факторы'}]),
    bul('Неисправная электропроводка, розетки. Неисправная оргтехника. Скользкие полы.'),
    p([{t:'Тема 3. ',b:true},{t:'Безопасная организация рабочего места'}]),
    bul('Чистота, порядок. Запрет загромождения путей эвакуации.'),
    p([{t:'Тема 4. ',b:true},{t:'Опасные зоны и средства безопасности'}]),
    bul('Движущиеся части оргтехники. Нагревательные элементы, высоковольтные блоки.'),
    p([{t:'Тема 5. ',b:true},{t:'Подготовка к работе, СИЗ'}]),
    bul('Проверка исправности. Освещённость. Нескользкая обувь.'),
    p([{t:'Тема 6. ',b:true},{t:'Безопасные методы работы'}]),
    bul('ПЭВМ: поза, расстояние, перерывы. КМТ: заправка, удаление замятий.'),
    p([{t:'Тема 7. ',b:true},{t:'Аварийные ситуации, НС'}]),
    bul('Задымление, искрение: отключить питание, сообщить. Аптечка и огнетушитель.'),
    SH('4. Заключительные положения'),
    p('4.1. Устная проверка знаний. Неудовлетворительный результат — к работе не допускается.',{indent:true}),
    ...devSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('07.02')},children:ch}],dir,'Программа первичного инструктажа на рабочем месте.docx');
}

async function gen_07_03(c,s,dir){
  const orderN=oNum(c,6);
  const pColW=[700,5500,1400];
  const pD=[['1','Основные требования пожарной безопасности в офисе','5'],['2','Причины пожаров и меры предотвращения','5'],['3','Действия при обнаружении пожара','5'],['4','Правила эвакуации','5'],['5','Первичные средства пожаротушения — правила пользования','5']];
  const pH=row([cell('№ темы',pColW[0],{bold:true,center:true}),cell('Наименование темы',pColW[1],{bold:true,center:true}),cell('Время (мин)',pColW[2],{bold:true,center:true})]);
  const pR=pD.map(r=>row([cell(r[0],pColW[0],{center:true,sz:SZ_S}),cell(r[1],pColW[1],{sz:SZ_S}),cell(r[2],pColW[2],{center:true,sz:SZ_S})]));
  const pT=row([cell('ИТОГО:',pColW[0]+pColW[1],{bold:true}),cell('25',pColW[2],{bold:true,center:true})]);
  const ch=[approvalOrder(c,orderN),...eL(1),H('ПРОГРАММА № 03-ПИ'),H('ПРОТИВОПОЖАРНОГО ИНСТРУКТАЖА'),H(c.name.toUpperCase(),SZ),...eL(1),
    SH('1. Общие положения'),
    p('1.1. Определяет порядок противопожарного инструктажа с работниками '+c.name+'.',{indent:true}),
    p('1.2. Проводит '+c.manager_position+'. Виды: вводный; первичный; повторный (не реже 1 раза в год); внеплановый; целевой.',{indent:true}),
    SH('2. Тематический план'),
    tbl(pColW,[pH,...pR,pT]),
    SH('3. Содержание'),
    p([{t:'Тема 1. ',b:true},{t:'Требования ПБ в офисе'}]),
    bul('Запрет курения в помещениях; открытого огня; загромождения выходов.'),
    bul('Запрет неисправных розеток; оставления включённых приборов; перегрузки сети.'),
    p([{t:'Тема 2. ',b:true},{t:'Причины пожаров и меры предотвращения'}]),
    bul('КЗ электропроводки; неисправность приборов; нарушение эксплуатации оргтехники; курение.'),
    p([{t:'Тема 3. ',b:true},{t:'Действия при пожаре'}]),
    bul('НЕ ПАНИКОВАТЬ.'),
    bul('101 или 112 (адрес, место, фамилия). Сообщить руководителю. Эвакуация. Огнетушитель.'),
    p([{t:'Тема 4. ',b:true},{t:'Правила эвакуации'}]),
    bul('Эвакуационные выходы (уточнить). При задымлении — ткань. Место сбора. Перекличка.'),
    p([{t:'Тема 5. ',b:true},{t:'Первичные средства пожаротушения'}]),
    bul('ОУ (углекислотный): пломба → чека → раструб на очаг → рычаг. НЕ ДЕРЖАТЬ ЗА РАСТРУБ.'),
    bul('ОП (порошковый): пломба → чека → рычаг → на очаг. Оба — с наветренной стороны.'),
    bul('ЗАПРЕЩЕНО тушить электрооборудование под напряжением водой.'),
    SH('4. Заключительные положения'),
    p('4.1. Устный опрос. Неудовлетворительный результат — к работе не допускается.',{indent:true}),
    ...devSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('07.03')},children:ch}],dir,'Программа противопожарного инструктажа.docx');
}

// ── ЧЕК-ЛИСТ ──────────────────────────────────────────

async function gen_checklist(c,s,dir){
  const colW=[400,3500,700,1200,800,1472];
  const hdr=row([cell('№',colW[0],{bold:true,center:true,sz:SZ_S}),cell('Документ',colW[1],{bold:true,center:true,sz:SZ_S}),cell('Номер',colW[2],{bold:true,center:true,sz:SZ_S}),cell('Дата',colW[3],{bold:true,center:true,sz:SZ_S}),cell('Подп. □',colW[4],{bold:true,center:true,sz:SZ_S}),cell('Примечание',colW[5],{bold:true,center:true,sz:SZ_S})]);
  const mk=(num,doc,dNum,date,note='')=>row([cell(num,colW[0],{center:true,sz:SZ_S}),cell(doc,colW[1],{sz:SZ_S}),cell(dNum,colW[2],{center:true,sz:SZ_S}),cell(date,colW[3],{center:true,sz:SZ_S}),cell('□',colW[4],{center:true,sz:SZ_S}),cell(note,colW[5],{sz:SZ_S})]);
  const n=oNum(c,0),n1=oNum(c,1),n2=oNum(c,2),n3=oNum(c,3),n4=oNum(c,4),n5=oNum(c,5),n6=oNum(c,6);
  const ch=[H('ЧЕК-ЛИСТ ПОДПИСАНИЯ ДОКУМЕНТОВ ПО ОХРАНЕ ТРУДА'),H(c.name,SZ),...eL(1),
    pL([{t:'Дата подписания: ',b:true},{t:'«___» ___________ '+c.doc_year+' г.'}]),
    pL([{t:'Подписывает: ',b:true},{t:c.manager_position+' '+(c.manager_name_full||c.manager_name)}]),...eL(1),
    H('ПАПКА А (Разделы 1–2) — ОСНОВНАЯ ДОКУМЕНТАЦИЯ',SZ),
    tbl(colW,[hdr,mk('1.1','Политика в области охраны труда','—',c.doc_date),mk('1.2','Положение о СУОТ','—',c.doc_date),mk('1.3','Приказ «Об утверждении документации по ОТ»','№ '+n,c.doc_date),mk('1.4','Приказ «О назначении ответственных лиц»','№ '+n1,c.doc_date),mk('1.5','Приказ «Об утверждении инструкций по ОТ»','№ '+n2,c.doc_date),mk('1.6','Приказ «О назначении ответственного за ДСИЗ»','№ '+n3,c.doc_date),mk('1.7','Приказ «Об аптечках первой помощи»','№ '+n4,c.doc_date),mk('1.8','Приказ «Об ответственном за электрохозяйство»','№ '+n5,c.doc_date),mk('1.9','Приказ «Об утверждении программ обучения»','№ '+n6,c.doc_date),mk('1.10','План мероприятий по охране труда на '+c.doc_year+' год','—',c.doc_date),mk('1.11','График периодических мероприятий № 01-ПМ','—',c.doc_date),mk('2.1','Положение о порядке обучения по ОТ','—',c.doc_date),mk('2.2','Положение об организации работы по ОТ','—',c.doc_date),mk('2.3','Положение о разработке инструкций по ОТ','—',c.doc_date),mk('2.4','Положение об учёте микротравм','—',c.doc_date),mk('2.5','Правила внутреннего трудового распорядка','—',c.doc_date),mk('2.6','Положение об обеспечении работников СИЗ','—',c.doc_date)]),...eL(1),
    H('ПАПКА Б (Разделы 5+7) — ОБУЧЕНИЕ',SZ),
    tbl(colW,[hdr,...(c.employees||[]).map((e,i)=>mk('5.'+(i+1),'Инструкция № '+String(i+2).padStart(2,'0')+'-ИОТ для '+e.position,'№ '+String(i+2).padStart(2,'0')+'-ИОТ',c.doc_date)),mk('5.N','Инструкция № 06-ИОТ при работе с ПЭВМ','№ 06-ИОТ',c.doc_date),mk('5.N','Инструкция № 07-ИОТ КМТ','№ 07-ИОТ',c.doc_date),mk('5.N','Инструкция № 08-ИОТ аптечка','№ 08-ИОТ',c.doc_date),mk('7.1','Программа вводного инструктажа № 01-ПИ','№ 01-ПИ',c.doc_date),mk('7.2','Программа первичного инструктажа № 02-ПИ','№ 02-ПИ',c.doc_date),mk('7.3','Программа противопожарного инструктажа № 03-ПИ','№ 03-ПИ',c.doc_date)]),...eL(1),
    H('ПАПКА В (Раздел 6) — ЖУРНАЛЫ',SZ),
    tbl(colW,[hdr,mk('6.1','Журнал регистрации вводного инструктажа','—',c.doc_date,'Прошить, пронумеровать'),mk('6.2','Журнал регистрации инструктажа на рабочем месте','—',c.doc_date,'Прошить, пронумеровать'),mk('6.3','Журнал учёта микроповреждений (микротравм)','—',c.doc_date,'Прошить, пронумеровать'),mk('6.4','Журнал учёта выдачи СИЗ','—',c.doc_date,'Прошить, пронумеровать'),mk('6.5','Журнал контроля аптечки первой помощи','—',c.doc_date,''),mk('6.6','Личные карточки учёта выдачи СИЗ','—',c.doc_date,'На каждого работника')]),...eL(1),
    H('ПАПКА Г (Раздел 3) — ЭЛЕКТРОБЕЗОПАСНОСТЬ',SZ),
    tbl(colW,[hdr,mk('3.1','Журнал учёта присвоения I группы электробезопасности','—',c.doc_date,'Прошить, пронумеровать'),mk('3.2','Программа инструктажа по электробезопасности (I группа)','—',c.doc_date,'')])];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('Чек-лист')},children:ch}],dir,'Чек-лист подписания документов.docx');
}

// ── ГЛАВНАЯ ФУНКЦИЯ ─────────────────────────────────────

async function generatePackage(client,settings,outputDir){
  const c=norm(client);
  const s=settings||{};
  const path=require('path');
  const fs=require('fs');

  const dirs={
    root:outputDir,
    d1:path.join(outputDir,'Раздел 1. Организационно-распорядительная документация'),
    d2:path.join(outputDir,'Раздел 2. Локальные нормативные акты'),
    d3:path.join(outputDir,'Раздел 3. Электробезопасность'),
    d5:path.join(outputDir,'Раздел 5. Инструкции по охране труда'),
    d6:path.join(outputDir,'Раздел 6. Журналы учёта'),
    d7:path.join(outputDir,'Раздел 7. Программы обучения'),
  };

  // Создаём папки и очищаем старые .docx файлы перед генерацией
  for(const d of Object.values(dirs)){
    fs.mkdirSync(d,{recursive:true});
    // Удаляем только .docx файлы — не трогаем подпапки
    if(fs.existsSync(d)){
      fs.readdirSync(d)
        .filter(f=>f.toLowerCase().endsWith('.docx'))
        .forEach(f=>{ try{fs.unlinkSync(path.join(d,f));}catch(e){} });
    }
  }
  // Очищаем корень (чек-лист)
  if(fs.existsSync(outputDir)){
    fs.readdirSync(outputDir)
      .filter(f=>f.toLowerCase().endsWith('.docx'))
      .forEach(f=>{ try{fs.unlinkSync(path.join(outputDir,f));}catch(e){} });
  }

  const p1=require('./gen_p1');
  const p2=require('./gen_p2');
  const generated=[],errors=[];

  const run=async(fn,dir,...args)=>{
    try{const f=await fn(c,s,dir,...args);if(Array.isArray(f))generated.push(...f);else generated.push(f);}
    catch(e){errors.push(fn.name+': '+e.message);}
  };

  await run(p1.gen_01_01,dirs.d1);await run(p1.gen_01_02,dirs.d1);await run(p1.gen_01_03,dirs.d1);
  await run(p1.gen_01_04,dirs.d1);await run(p1.gen_01_05,dirs.d1);await run(p1.gen_01_06,dirs.d1);
  await run(p1.gen_01_07,dirs.d1);await run(p1.gen_01_08,dirs.d1);await run(p1.gen_01_09,dirs.d1);
  await run(p1.gen_01_10,dirs.d1);await run(p1.gen_01_11,dirs.d1);

  // Условные документы Раздела 1
  const soatClass   = parseInt(c.soat_class||'2');
  const hasHazard   = !!c.hazard_works;
  const hasMedcheck = !!c.medcheck_required || (c.employees||[]).some(e=>e.medcheck_required);
  const isMicro     = c.micro; // ≤15 сотрудников
  const isSmall     = c.small; // 16-100
  const isMedium    = c.medium;// >100

  // Медосмотры — если есть основания
  if(hasMedcheck){
    await run(p2.gen_01_med,dirs.d1); // приказ
    await run(p2.gen_02_med,dirs.d2); // список контингента
  }

  // Работы повышенной опасности
  if(hasHazard){
    await run(p2.gen_01_hazard,dirs.d1); // приказ
    await run(p2.gen_02_hazard,dirs.d7); // программа В
  }

  await run(p2.gen_02_01,dirs.d2);await run(p2.gen_02_02,dirs.d2);await run(p2.gen_02_03,dirs.d2);
  await run(p2.gen_02_04,dirs.d2);await run(p2.gen_02_05,dirs.d2);await run(p2.gen_02_06,dirs.d2);

  await run(p2.gen_03_01,dirs.d3);await run(p2.gen_03_02,dirs.d3);

  await run(p2.gen_05_01,dirs.d5);await run(p2.gen_05_employees,dirs.d5);
  await run(p2.gen_05_06,dirs.d5);await run(p2.gen_05_07,dirs.d5);await run(p2.gen_05_08,dirs.d5);

  await run(gen_06_01,dirs.d6);await run(gen_06_02,dirs.d6);await run(gen_06_03,dirs.d6);
  // Журнал выдачи СИЗ — только если СОУТ 3+ или работы повышенной опасности
  if(soatClass>=31||hasHazard){
    await run(gen_06_04,dirs.d6);
    await run(gen_06_06,dirs.d6); // личная карточка СИЗ
  }
  await run(gen_06_05,dirs.d6); // журнал контроля аптечки — всегда

  await run(gen_07_01,dirs.d7);await run(gen_07_02,dirs.d7);await run(gen_07_03,dirs.d7);

  await run(gen_checklist,outputDir);

  return{generated,errors};
}

module.exports={generatePackage};
