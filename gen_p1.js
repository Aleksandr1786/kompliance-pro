'use strict';
// КомплаенсПро generator.js v2.0 — PART 1: утилиты + Раздел 1
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, BorderStyle, WidthType, VerticalAlign,
  PageNumber, PageOrientation, LevelFormat, TabStopType, TabStopPosition,
} = require('docx');
const fs = require('fs');
const path = require('path');

const FONT='Times New Roman', SZ=24, SZ_S=20, SZ_H=28;
const MP={top:1134,right:851,bottom:1134,left:1701};
const ML={top:720,right:720,bottom:720,left:1134};
const CW=9072;
const B={style:BorderStyle.SINGLE,size:6,color:'000000'};
const BN={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
const BALL={top:B,bottom:B,left:B,right:B};
const BNONE={top:BN,bottom:BN,left:BN,right:BN};

function p(text,o={}){
  const runs=Array.isArray(text)
    ?text.map(t=>new TextRun({text:t.t,bold:t.b,size:o.sz||SZ,font:FONT}))
    :[new TextRun({text:String(text),bold:o.bold,size:o.sz||SZ,font:FONT})];
  return new Paragraph({
    alignment:o.al!==undefined?o.al:AlignmentType.BOTH,
    spacing:{before:o.before??60,after:o.after??60,line:276},
    indent:o.indent?{firstLine:720}:undefined,
    children:runs,
  });
}
const pC=(t,o={})=>p(t,{...o,al:AlignmentType.CENTER});
const pR=(t,o={})=>p(t,{...o,al:AlignmentType.RIGHT});
const pL=(t,o={})=>p(t,{...o,al:AlignmentType.LEFT});
const eL=(n=1)=>Array.from({length:n},()=>new Paragraph({spacing:{before:0,after:0},children:[new TextRun({text:'',size:SZ,font:FONT})]}));
const H=(t,sz=SZ_H)=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:100,after:100},children:[new TextRun({text:t,bold:true,size:sz,font:FONT})]});
const SH=(t)=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:200,after:80},children:[new TextRun({text:t,bold:true,size:SZ,font:FONT})]});
const bul=(t,sz=SZ)=>new Paragraph({numbering:{reference:'bullets',level:0},spacing:{before:40,after:40,line:276},children:[new TextRun({text:t,size:sz,font:FONT})]});

function cell(text,width,o={}){
  return new TableCell({
    borders:o.nb?BNONE:BALL,
    width:{size:width,type:WidthType.DXA},
    margins:{top:60,bottom:60,left:100,right:100},
    verticalAlign:o.va||VerticalAlign.CENTER,
    rowSpan:o.rs,columnSpan:o.cs,
    children:[new Paragraph({alignment:o.center?AlignmentType.CENTER:AlignmentType.LEFT,children:[new TextRun({text:String(text??''),bold:o.bold,size:o.sz||SZ,font:FONT})]})],
  });
}
const row=cells=>new TableRow({children:cells});
const tbl=(cols,rows)=>new Table({width:{size:cols.reduce((a,b)=>a+b,0),type:WidthType.DXA},columnWidths:cols,rows});
const footer=label=>new Footer({children:[new Paragraph({tabStops:[{type:TabStopType.RIGHT,position:TabStopPosition.MAX}],children:[new TextRun({text:label,size:18,font:FONT,color:'888888'}),new TextRun({text:'\t',size:18}),new TextRun({children:[PageNumber.CURRENT],size:18,font:FONT,color:'888888'})]})]});

function approvalBlock(c){
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[CW/2,CW/2],
    borders:{top:BN,bottom:BN,left:BN,right:BN,insideH:BN,insideV:BN},
    rows:[new TableRow({children:[
      new TableCell({borders:BNONE,width:{size:CW/2,type:WidthType.DXA},children:[new Paragraph('')]}),
      new TableCell({borders:BNONE,width:{size:CW/2,type:WidthType.DXA},children:[
        pL('УТВЕРЖДАЮ',{bold:true}),pL(c.manager_position),
        pL('__________  '+c.manager_name),pL('«___» ____________ '+c.doc_year+' г.'),
      ]}),
    ]})],
  });
}
function approvalOrder(c,orderNum){
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[CW/2,CW/2],
    borders:{top:BN,bottom:BN,left:BN,right:BN,insideH:BN,insideV:BN},
    rows:[new TableRow({children:[
      new TableCell({borders:BNONE,width:{size:CW/2,type:WidthType.DXA},children:[new Paragraph('')]}),
      new TableCell({borders:BNONE,width:{size:CW/2,type:WidthType.DXA},children:[
        pL('УТВЕРЖДЕНА',{bold:true}),pL('Приказом '+c.manager_position),
        pL(c.name),pL('от «'+c.doc_date+'» № '+orderNum),
      ]}),
    ]})],
  });
}
function orderHead(c,num,subject){
  return [pR(c.name),...eL(1),H('ПРИКАЗ'),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:80},tabStops:[{type:TabStopType.RIGHT,position:TabStopPosition.MAX}],children:[new TextRun({text:c.city,size:SZ,font:FONT}),new TextRun({text:'\t№ '+num+' от '+c.doc_date,size:SZ,font:FONT})]}),
    ...eL(1),pC(subject,{bold:true})];
}
function orderSign(c){return [...eL(2),pL(c.manager_position+':'),...eL(1),pL('________________  '+c.manager_name)];}
function famSheet(c,label){
  const emp=c.employees||[];
  const colW=[500,2500,2500,1200,1372];
  const hdr=row([cell('№ п/п',colW[0],{bold:true,center:true}),cell('Фамилия И.О.',colW[1],{bold:true,center:true}),cell('Должность',colW[2],{bold:true,center:true}),cell('Дата',colW[3],{bold:true,center:true}),cell('Подпись',colW[4],{bold:true,center:true})]);
  const dr=emp.map((e,i)=>row([cell(String(i+1),colW[0],{center:true,sz:SZ_S}),cell('',colW[1],{sz:SZ_S}),cell(e.position,colW[2],{sz:SZ_S}),cell(c.doc_date,colW[3],{center:true,sz:SZ_S}),cell('',colW[4],{sz:SZ_S})]));
  const er=[1,2,3].map((_,i)=>row([cell(String(emp.length+i+1),colW[0],{center:true,sz:SZ_S}),cell('',colW[1],{sz:SZ_S}),cell('',colW[2],{sz:SZ_S}),cell('',colW[3],{sz:SZ_S}),cell('',colW[4],{sz:SZ_S})]));
  return [...eL(2),H('Лист ознакомления — '+label,SZ),...eL(1),tbl(colW,[hdr,...dr,...er]),...eL(1),pL('Ответственный за ознакомление:'),pL(c.manager_position+'  _______________  '+c.manager_name)];
}
function famSheetOrder(c,label){
  const emp=c.employees||[];
  const colW=[500,2500,2500,1200,1372];
  const hdr=row([cell('№ п/п',colW[0],{bold:true,center:true}),cell('Фамилия И.О.',colW[1],{bold:true,center:true}),cell('Должность',colW[2],{bold:true,center:true}),cell('Дата',colW[3],{bold:true,center:true}),cell('Подпись',colW[4],{bold:true,center:true})]);
  const dr=emp.map((e,i)=>row([cell(String(i+1),colW[0],{center:true,sz:SZ_S}),cell('',colW[1],{sz:SZ_S}),cell(e.position,colW[2],{sz:SZ_S}),cell(c.doc_date,colW[3],{center:true,sz:SZ_S}),cell('',colW[4],{sz:SZ_S})]));
  const er=[1,2,3].map((_,i)=>row([cell(String(emp.length+i+1),colW[0],{center:true,sz:SZ_S}),cell('',colW[1],{sz:SZ_S}),cell('',colW[2],{sz:SZ_S}),cell('',colW[3],{sz:SZ_S}),cell('',colW[4],{sz:SZ_S})]));
  return [...eL(2),H('Лист ознакомления с приказом '+label,SZ),...eL(1),tbl(colW,[hdr,...dr,...er])];
}
function devSign(c){return [...eL(2),pL([{t:'Разработал: '},{t:c.manager_position+'  _______________  '+c.manager_name}]),pL('«'+c.doc_date+'»')];}

function norm(client){
  const c=Object.assign({},client);
  c.name=c.name||'Организация';c.form=c.form||'ООО';
  c.city=((c.city||'').replace(/^г\.?\s*/i,'').trim())||'б/м';
  c.doc_date=c.doc_date||new Date().toLocaleDateString('ru-RU');
  c.doc_year=c.doc_year||String(new Date().getFullYear());
  c.manager_name=c.manager_name||'Руководитель';
  c.manager_position=c.manager_position||'Руководитель';
  c.ot_name=c.ot_name||c.manager_name;c.ot_position=c.ot_position||c.manager_position;
  c.ot_dative=c.ot_dative||c.ot_name_full||c.ot_name;
  c.employees=Array.isArray(c.employees)?c.employees:[];
  c.staff=c.staff||1;c.order_prefix=parseInt(c.order_prefix)||3;
  c.micro=c.staff<=15;c.small=c.staff>15&&c.staff<=100;c.medium=c.staff>100;
  return c;
}
async function save(sections,dir,filename){
  const doc=new Document({
    styles:{default:{document:{run:{font:FONT,size:SZ}}}},
    numbering:{config:[
      {reference:'bullets',levels:[{level:0,format:LevelFormat.BULLET,text:'\u2013',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}}]},
      {reference:'ordered',levels:[{level:0,format:LevelFormat.DECIMAL,text:'%1.',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}}]},
    ]},sections});
  const buf=await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(dir,filename),buf);
  return filename;
}
function oNum(c,offset){return String(c.order_prefix+offset).padStart(2,'0');}

// ── РАЗДЕЛ 1 ───────────────────────────────────────────

async function gen_01_01(c,s,dir){
  const ch=[approvalBlock(c),...eL(1),H('ПОЛИТИКА В ОБЛАСТИ ОХРАНЫ ТРУДА'),H(c.name.toUpperCase(),SZ),...eL(1),
    SH('1. Общие положения'),
    p(c.name+' осознаёт ответственность за жизнь и здоровье работников. Политика разработана в соответствии с ТК РФ (ст.209–231), ПП РФ от 24.12.2021 № 2464.',{indent:true}),
    SH('2. Основные принципы'),
    p('Организация основывает деятельность в сфере ОТ на следующих принципах:',{indent:true}),
    bul('приоритет сохранения жизни и здоровья работников;'),
    bul('обеспечение безопасных условий труда на каждом рабочем месте;'),
    bul('соблюдение требований законодательства в области охраны труда;'),
    bul('управление профессиональными рисками;'),
    bul('непрерывное совершенствование СУОТ;'),
    bul('вовлечение работников в решение вопросов охраны труда.'),
    SH('3. Обязательства работодателя'),
    p('3.1. Соблюдать требования законодательства РФ в области охраны труда.',{indent:true}),
    p('3.2. Предотвращать травматизм и профессиональные заболевания.',{indent:true}),
    p('3.3. Проводить СОУТ и ОПР.',{indent:true}),
    p('3.4. Обеспечивать СИЗ, смывающими средствами.',{indent:true}),
    p('3.5. Организовывать обучение, инструктажи в установленные сроки.',{indent:true}),
    p('3.6. Расследовать НС и микротравмы, устранять причины.',{indent:true}),
    p('3.7. Обеспечивать целевое финансирование мероприятий по ОТ.',{indent:true}),
    SH('4. Цели на '+c.doc_year+' год'),
    p('4.1. Нулевой производственный травматизм.',{indent:true}),
    p('4.2. Своевременное обучение по ОТ 100% работников.',{indent:true}),
    p('4.3. Актуализация инструкций по ОТ и документации СУОТ.',{indent:true}),
    SH('5. Заключительные положения'),
    p('Политика обязательна для всех работников. Пересматривается не реже 1 раза в 3 года.',{indent:true}),
    ...famSheet(c,'01.01')];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.01')},children:ch}],dir,'01.01_Политика_в_области_охраны_труда.docx');
}

async function gen_01_02(c,s,dir){
  const ch=[approvalBlock(c),...eL(1),H('ПОЛОЖЕНИЕ'),H('о системе управления охраной труда (СУОТ)',SZ),H(c.name,SZ),...eL(1),
    SH('1. Общие положения'),
    p('1.1. Положение устанавливает структуру, цели, задачи СУОТ в Организации.',{indent:true}),
    p('1.2. Разработано в соответствии с ТК РФ (раздел X), Приказом Минтруда от 29.10.2021 № 776н, ПП РФ от 24.12.2021 № 2464.',{indent:true}),
    p('1.3. Действует для всех работников '+c.name+'.',{indent:true}),
    ...(c.micro?[p('1.4. Организация — микропредприятие (до 15 работников), применяет упрощённый порядок документооборота (ст. 309.2 ТК РФ).',{indent:true})]:[]),
    SH('2. Политика и цели'),
    p('2.1. Политика ОТ — основополагающий документ СУОТ.',{indent:true}),
    p('2.2. Цели устанавливаются ежегодно Планом мероприятий.',{indent:true}),
    SH('3. Структура управления'),
    p('3.1. Общее руководство — '+c.manager_position+' '+c.manager_name+'.',{indent:true}),
    p('3.2. Организацию работы по ОТ осуществляет '+c.ot_position+' '+c.ot_name+', назначенный приказом.',{indent:true}),
    SH('4. Ресурсное обеспечение'),
    p('4.1. Финансирование — не менее 0,2% затрат на производство (ст. 225 ТК РФ).',{indent:true}),
    SH('5. Управление профессиональными рисками'),
    p('5.1. Идентификация опасностей и ОПР — на постоянной основе.',{indent:true}),
    p('5.2. СОУТ — по Федеральному закону от 28.12.2013 № 426-ФЗ.',{indent:true}),
    SH('6. Обучение и инструктажи'),
    p('6.1. Вводный инструктаж — при приёме. Повторный — не реже 1 раза в 6 месяцев.',{indent:true}),
    p('6.2. Обучение в учебных центрах — не реже 1 раза в 3 года (ПП РФ № 2464).',{indent:true}),
    SH('7. Контроль и мониторинг'),
    p('7.1. Оперативный (ежедневно), периодический (ежеквартально), итоговый (ежегодно).',{indent:true}),
    SH('8. Расследование происшествий'),
    p('8.1. НС — ст. 227–231 ТК РФ, Приказ Минтруда от 20.04.2022 № 223н.',{indent:true}),
    p('8.2. Микротравмы — ст. 226 ТК РФ, Приказ Минтруда от 15.09.2021 № 632н.',{indent:true}),
    ...famSheet(c,'01.02')];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.02')},children:ch}],dir,'01.02_Положение_о_СУОТ.docx');
}

async function gen_01_03(c,s,dir){
  const num=oNum(c,0);
  const ch=[...orderHead(c,num,'«Об утверждении и введении в действие документации по охране труда»'),...eL(1),
    p('Во исполнение требований ТК РФ и в целях обеспечения функционирования СУОТ,',{indent:true}),
    p('ПРИКАЗЫВАЮ:',{bold:true}),
    p([{t:'1. Утвердить и ввести в действие с '},{t:c.doc_date,b:true},{t:' следующие ЛНА:'}]),
    p('1.1. Политику в области охраны труда.',{indent:true}),
    p('1.2. Положение о СУОТ.',{indent:true}),
    p('1.3. Положение о порядке обучения по охране труда.',{indent:true}),
    p('1.4. Положение об организации работы по охране труда.',{indent:true}),
    p('1.5. Положение о разработке инструкций по охране труда.',{indent:true}),
    p('1.6. Положение об учёте микротравм.',{indent:true}),
    p('1.7. Правила внутреннего трудового распорядка.',{indent:true}),
    p('1.8. Положение об обеспечении работников СИЗ и смывающими средствами.',{indent:true}),
    p('2. Признать утратившими силу аналогичные документы (при наличии).'),
    p('3. '+c.ot_position+' '+(c.ot_name_full||c.ot_name)+': ознакомить работников с документами под подпись в срок до 5 рабочих дней.'),
    p('4. Контроль за исполнением оставляю за собой.'),
    ...orderSign(c),...famSheetOrder(c,'№ '+num)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.03')},children:ch}],dir,'01.03_Приказ_'+num+'_утверждение_документации.docx');
}

async function gen_01_04(c,s,dir){
  const num=oNum(c,1);
  const otN=c.ot_name_full||c.ot_name,otP=c.ot_position,otD=c.ot_dative;
  const ch=[...orderHead(c,num,'«О назначении ответственных лиц по охране труда»'),...eL(1),
    p('В соответствии с требованиями ст. 214, 217 ТК РФ,',{indent:true}),
    p('ПРИКАЗЫВАЮ:',{bold:true}),
    p('1. Назначить ответственным за организацию работы по ОТ в '+c.name+' '+otP+' '+otN+'.'),
    p('2. Возложить на '+otD+' следующие обязанности:'),
    p('2.1. Организация и контроль работы по охране труда.',{indent:true}),
    p('2.2. Проведение вводных инструктажей.',{indent:true}),
    p('2.3. Контроль первичных и повторных инструктажей.',{indent:true}),
    p('2.4. Ведение журналов регистрации инструктажей.',{indent:true}),
    p('2.5. Разработка и актуализация документации по ОТ.',{indent:true}),
    p('2.6. Мониторинг изменений законодательства в сфере ОТ.',{indent:true}),
    p('2.7. Организация обучения в учебных центрах.',{indent:true}),
    p('3. Всем работникам выполнять требования ОТ и указания ответственного лица.'),
    p('4. Контроль за исполнением оставляю за собой.'),
    ...orderSign(c),...famSheetOrder(c,'№ '+num)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.04')},children:ch}],dir,'01.04_Приказ_'+num+'_назначение_ответственных.docx');
}

async function gen_01_05(c,s,dir){
  const num=oNum(c,2);
  const iList=c.employees.length>0
    ?c.employees.map((e,i)=>p('1.'+(i+1)+'. № '+String(i+1).padStart(2,'0')+'-ИОТ — для '+e.position+'.',{indent:true}))
    :[p('1.1. № 01-ИОТ — для руководителя организации.',{indent:true})];
  const ch=[...orderHead(c,num,'«Об утверждении инструкций по охране труда»'),...eL(1),
    p('В соответствии со ст. 214 ТК РФ, Приказа Минтруда от 29.10.2021 № 772н,',{indent:true}),
    p('ПРИКАЗЫВАЮ:',{bold:true}),
    p('1. Утвердить с '+c.doc_date+' инструкции по охране труда:'),
    ...iList,
    p('1.N. № 06-ИОТ — при работе с ПЭВМ, оргтехникой и электроприборами.',{indent:true}),
    p('1.N. № 07-ИОТ — при эксплуатации копировально-множительной техники.',{indent:true}),
    p('1.N. № 08-ИОТ — о порядке использования аптечки первой помощи.',{indent:true}),
    p('2. '+c.ot_position+' '+(c.ot_name_full||c.ot_name)+': ознакомить работников с инструкциями под подпись.'),
    p('3. Инструкции хранить в доступном месте. Пересматривать не реже 1 раза в 5 лет.'),
    p('4. Контроль за исполнением оставляю за собой.'),
    ...orderSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.05')},children:ch}],dir,'01.05_Приказ_'+num+'_утверждение_инструкций.docx');
}

async function gen_01_06(c,s,dir){
  const num=oNum(c,3);
  const dN=c.dsiz_name_full||c.ot_name_full||c.ot_name,dP=c.dsiz_position||c.ot_position,dD=c.dsiz_dative||c.ot_dative;
  const ch=[...orderHead(c,num,'«О назначении ответственного за обеспечение работников СИЗ и смывающими средствами»'),...eL(1),
    p('В соответствии со ст. 214, 221 ТК РФ, Приказа Минтруда от 29.10.2021 № 766н,',{indent:true}),
    p('ПРИКАЗЫВАЮ:',{bold:true}),
    p('1. Назначить ответственным за ДСИЗ '+dP+' '+dN+'.'),
    p('2. Возложить обязанности:'),
    p('2.1. Ведение учёта выдачи СИЗ в журналах и карточках.',{indent:true}),
    p('2.2. Контроль соответствия СИЗ техническим регламентам.',{indent:true}),
    p('2.3. Организация стирки, дезинфекции, ремонта СИЗ.',{indent:true}),
    p('2.4. Пополнение дозаторов смывающими средствами.',{indent:true}),
    p('3. Контроль за исполнением оставляю за собой.'),
    ...orderSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.06')},children:ch}],dir,'01.06_Приказ_'+num+'_ответственный_ДСИЗ.docx');
}

async function gen_01_07(c,s,dir){
  const num=oNum(c,4);
  const ch=[...orderHead(c,num,'«Об обеспечении работников аптечками первой помощи»'),...eL(1),
    p('В соответствии со ст. 223 ТК РФ, Приказа Минтруда России от 09.08.2024 № 398н,',{indent:true}),
    p('ПРИКАЗЫВАЮ:',{bold:true}),
    p('1. Обеспечить наличие аптечки первой помощи в офисе '+c.name+'.'),
    p('2. Назначить '+c.ot_position+' '+(c.ot_name_full||c.ot_name)+' ответственным за:'),
    p('2.1. Приобретение, комплектацию и пополнение аптечки.',{indent:true}),
    p('2.2. Проверку комплектации не реже 1 раза в 3 месяца.',{indent:true}),
    p('2.3. Контроль сроков годности медицинских изделий.',{indent:true}),
    p('2.4. Ознакомление работников с местом хранения аптечки.',{indent:true}),
    p('3. Аптечку разместить в доступном месте, обозначить знаком (зелёный квадрат с белым крестом).'),
    p('4. Контроль за исполнением оставляю за собой.'),
    ...orderSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.07')},children:ch}],dir,'01.07_Приказ_'+num+'_аптечки.docx');
}

async function gen_01_08(c,s,dir){
  const num=oNum(c,5);
  const eN=c.elec_name_full||c.ot_name_full||c.ot_name,eP=c.elec_position||c.ot_position;
  const ch=[...orderHead(c,num,'«О назначении ответственного за электрохозяйство»'),...eL(1),
    p('В соответствии с Приказом Минэнерго России от 12.08.2022 № 811, Приказом Минтруда России от 15.12.2020 № 903н,',{indent:true}),
    p('ПРИКАЗЫВАЮ:',{bold:true}),
    p('1. Назначить ответственным за эксплуатацию электроустановок '+c.name+' '+eP+' '+eN+'.'),
    p('2. Возложить обязанности:'),
    p('2.1. Организация безопасной эксплуатации электрооборудования.',{indent:true}),
    p('2.2. Присвоение I группы электробезопасности неэлектротехническому персоналу.',{indent:true}),
    p('2.3. Контроль технического состояния электрооборудования.',{indent:true}),
    p('3. Контроль за исполнением оставляю за собой.'),
    ...orderSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.08')},children:ch}],dir,'01.08_Приказ_'+num+'_электрохозяйство.docx');
}

async function gen_01_09(c,s,dir){
  const num=oNum(c,6);
  const ch=[...orderHead(c,num,'«Об утверждении программ обучения по охране труда»'),...eL(1),
    p('В соответствии с ПП РФ от 24.12.2021 № 2464,',{indent:true}),
    p('ПРИКАЗЫВАЮ:',{bold:true}),
    p('1. Утвердить с '+c.doc_date+' программы обучения:'),
    p('1.1. № 01-ПИ — Программа вводного инструктажа по охране труда.',{indent:true}),
    p('1.2. № 02-ПИ — Программа первичного инструктажа на рабочем месте.',{indent:true}),
    p('1.3. № 03-ПИ — Программа противопожарного инструктажа.',{indent:true}),
    p('2. Ответственным назначить '+c.ot_position+' '+(c.ot_name_full||c.ot_name)+'.'),
    p('3. Программы пересматривать не реже 1 раза в 3 года.'),
    p('4. Контроль за исполнением оставляю за собой.'),
    ...orderSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.09')},children:ch}],dir,'01.09_Приказ_'+num+'_программы_обучения.docx');
}

async function gen_01_10(c,s,dir){
  const yr=c.doc_year,otN=c.ot_name||c.manager_name,mN=c.manager_name;
  const colW=[400,4200,1600,1700,1172];
  const pd=[
    ['1','Актуализация ЛНА по охране труда','Март '+yr,mN],
    ['2','Вводный инструктаж со всеми вновь принятыми','При приёме',otN],
    ['3','Первичный, повторный, внеплановый инструктажи','По графику',otN],
    ['4','Противопожарный инструктаж','При приёме, 1/год',mN],
    ['5','Инструктаж по электробезопасности (I группа)','Ежегодно, апрель',c.elec_name||otN],
    ['6','Обучение руководителя — программа А (учебный центр)','1 раз в 3 года',mN],
    ['7','Обучение работников оказанию первой помощи','1 раз в 3 года',mN],
    ['8','Пожарно-технический минимум (учебный центр)','1 раз в 3 года',mN],
    ['9','Обучение применению СИЗ (при необходимости)','1 раз в 3 года',mN],
    ['10','СОУТ (не реже 1 раза в 5 лет)','По графику',mN],
    ['11','Медосмотр (при наличии оснований)','По графику',mN],
    ['12','Обеспечение СИЗ и смывающими средствами','По необходимости',c.dsiz_name||otN],
    ['13','Проверка первичных средств пожаротушения','Ежеквартально',mN],
    ['14','Проверка состояния электробезопасности','Ежеквартально',c.elec_name||otN],
    ['15','Проверка условий труда на рабочих местах','Ежемесячно',otN],
    ['16','Учёт и анализ микротравм','Постоянно',otN],
    ['17','Отчётность в СФР и Росстат','По срокам',mN],
  ];
  const hdr=row([cell('№',colW[0],{bold:true,center:true}),cell('Наименование мероприятия',colW[1],{bold:true,center:true}),cell('Срок',colW[2],{bold:true,center:true}),cell('Ответственный',colW[3],{bold:true,center:true}),cell('Отметка',colW[4],{bold:true,center:true})]);
  const dr=pd.map(r=>row([cell(r[0],colW[0],{center:true,sz:SZ_S}),cell(r[1],colW[1],{sz:SZ_S}),cell(r[2],colW[2],{sz:SZ_S}),cell(r[3],colW[3],{sz:SZ_S}),cell('',colW[4],{sz:SZ_S})]));
  const ch=[approvalBlock(c),...eL(1),H('ПЛАН МЕРОПРИЯТИЙ ПО ОХРАНЕ ТРУДА'),H(c.name+' на '+yr+' год',SZ),...eL(1),tbl(colW,[hdr,...dr]),...eL(2),pL(c.ot_position+' (ответственный за ОТ):  ________________  '+otN)];
  return save([{properties:{page:{size:{width:16838,height:11906,orientation:PageOrientation.LANDSCAPE},margin:ML}},footers:{default:footer('01.10')},children:ch}],dir,'01.10_План_мероприятий_по_охране_труда.docx');
}

async function gen_01_11(c,s,dir){
  const yr=c.doc_year,mN=c.manager_name,otN=c.ot_name||c.manager_name;
  function sub(headers,colW,data){
    const h=row(headers.map((t,i)=>cell(t,colW[i],{bold:true,center:true,sz:SZ_S})));
    return tbl(colW,[h,...data.map(r=>row(r.map((t,i)=>cell(t,colW[i],{sz:SZ_S}))))]);
  }
  const ch=[approvalBlock(c),...eL(1),H('ГРАФИК № 01-ПМ'),H('ПЕРИОДИЧЕСКИХ МЕРОПРИЯТИЙ ПО ОХРАНЕ ТРУДА'),H(c.name+' на '+yr+' год',SZ),...eL(1),
    SH('1. Ежегодные мероприятия'),
    sub(['№','Мероприятие','Срок','Ответственный','Отметка'],[300,4500,1500,1700,1072],[
      ['1','Противопожарный инструктаж (повторный)','Апрель '+yr,mN,''],
      ['2','Инструктаж по электробезопасности (I группа)','Апрель '+yr,c.elec_name||otN,''],
      ['3','Актуализация Плана мероприятий на следующий год','Декабрь '+yr,mN,''],
      ['4','Проверка сроков удостоверений по ОТ','Январь '+yr,otN,''],
    ]),...eL(1),
    SH('2. Ежеквартальные мероприятия'),
    sub(['№','Мероприятие','Сроки','Ответственный','Отметка'],[300,4500,1500,1700,1072],[
      ['1','Проверка огнетушителей','Март, июнь, сент., дек.',mN,''],
      ['2','Проверка электробезопасности','Март, июнь, сент., дек.',c.elec_name||otN,''],
      ['3','Проверка аптечки первой помощи','Март, июнь, сент., дек.',otN,''],
    ]),...eL(1),
    SH('3. Ежемесячные мероприятия'),
    sub(['№','Мероприятие','Срок','Ответственный','Отметка'],[300,4500,1500,1700,1072],[
      ['1','Проверка условий труда на рабочих местах','Последняя неделя месяца',otN,''],
      ['2','Контроль наличия смывающих средств','Ежемесячно',c.dsiz_name||otN,''],
    ]),...eL(1),
    SH('4. Мероприятия 1 раз в 3 года'),
    sub(['№','Мероприятие','Последнее','Следующее','Ответственный'],[300,3500,1700,1700,1872],[
      ['1','Обучение по ОТ (программа А) — руководитель','______ г.','______ г.',mN],
      ['2','Обучение по оказанию первой помощи','______ г.','______ г.',mN],
      ['3','Пожарно-технический минимум','______ г.','______ г.',mN],
      ['4','Пересмотр ЛНА по охране труда','______ г.','______ г.',mN],
      ['5','Оценка профессиональных рисков (плановая)','______ г.','______ г.',mN],
    ]),...eL(1),
    SH('5. Мероприятия при приёме нового работника'),
    sub(['№','Мероприятие','Срок','Ответственный'],[300,4500,2000,3272],[
      ['1','Вводный инструктаж по охране труда','В день приёма',mN],
      ['2','Ознакомление с инструкциями и ЛНА','В день приёма',mN],
      ['3','Направление на обучение в учебный центр','В течение 60 дней',mN],
      ['4','Первичный инструктаж (если не освобождён)','До начала работы',otN],
    ]),...eL(2),...famSheet(c,'График № 01-ПМ'),...devSign(c)];
  return save([{properties:{page:{size:{width:11906,height:16838},margin:MP}},footers:{default:footer('01.11')},children:ch}],dir,'01.11_График_периодических_мероприятий.docx');
}

module.exports={norm,save,oNum,approvalBlock,approvalOrder,orderHead,orderSign,famSheet,famSheetOrder,devSign,bul,H,SH,p,pC,pR,pL,eL,cell,row,tbl,footer,FONT,SZ,SZ_S,SZ_H,MP,ML,CW,BALL,BNONE,
  gen_01_01,gen_01_02,gen_01_03,gen_01_04,gen_01_05,gen_01_06,gen_01_07,gen_01_08,gen_01_09,gen_01_10,gen_01_11};
