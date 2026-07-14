#!/usr/bin/env node
'use strict';

// ══════════════════════════════════════════════════════════════════
//  MCP-СЕРВЕР «КОМПЛАЕНСПРО» v0.2 — read-write, этап 2
// ══════════════════════════════════════════════════════════════════
//
// АРХИТЕКТУРНЫЕ ПРИНЦИПЫ (не нарушать при доработке):
//
// 1. ЗАПИСЬ — ТОЛЬКО через mcp-write-bridge.js. Этот сервер сам никогда
//    не пишет в kompliance.json напрямую (через fs/lowdb) — единственный
//    путь записи это инструмент generate_document_package ниже, который
//    делегирует всё mcp-write-bridge.js (см. АРХИТЕКТУРНЫЕ ПРИНЦИПЫ в
//    том файле: повторная проверка mcp_enabled, обязательный бэкап перед
//    записью, файловая блокировка на время операции). Прямая синхронная
//    запись через lowdb (FileSync) без блокировки из отдельного процесса
//    реально может повредить базу, если совпадёт с записью из основного
//    приложения — именно поэтому вся запись идёт через один узкий мост,
//    а не разбросана по инструментам.
//
// 2. НЕ ГЕНЕРИРУЕТ ЮРИДИЧЕСКИЙ ТЕКСТ. Ни один инструмент, включая
//    generate_document_package, не позволяет модели-хосту сочинять текст
//    документа с нуля — генерация идёт по существующим детерминированным
//    шаблонам (тот же код, что и кнопка "Сформировать пакет" в
//    интерфейсе). Это осознанное ограничение, не недоработка.
//
// 3. МАСКИРОВАНИЕ ПДн ПО УМОЛЧАНИЮ. Ответы read-only инструментов
//    агрегированы (количества, статусы, проценты) — не содержат ФИО,
//    дат рождения, СНИЛС и т.п. Причина: то, что попадает в ответ
//    инструмента, уходит в контекст диалога агента, а значит — на
//    сторонние сервера провайдера ИИ (Anthropic/OpenAI/...). Передача
//    туда персональных данных российских граждан — прямая коллизия с
//    требованиями локализации ПДн. Если когда-нибудь понадобится отдавать
//    ФИО конкретного сотрудника — это отдельный, явно помеченный
//    инструмент с предупреждением в описании, не тихая правка этого.
//
// 4. ФИЧЕ-ФЛАГ. Сервер проверяет settings.mcp_enabled при старте и
//    завершает работу, если флаг не включён явно — быстрый рубильник
//    без отката кода. generate_document_package дополнительно проверяет
//    флаг ЕЩЁ РАЗ на момент вызова (внутри mcp-write-bridge.js) — на
//    случай, если флаг выключили, пока сервер уже был запущен.
//
// ТРАНСПОРТ: stdio (локальный подпроцесс). См. README про запуск из
// Electron main-процесса.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// ── Путь к базе ──────────────────────────────────────────────────────
// Подтверждено по main.js: path.join(app.getPath('userData'), 'kompliance.json').
// Вне Electron-контекста app.getPath недоступен, поэтому либо передаём
// путь явно через переменную окружения (из main-процесса при спавне),
// либо используем стандартный путь Windows-профиля как фолбэк для
// ручного локального тестирования.
const DB_PATH =
  process.env.KOMPLIANCE_DB_PATH ||
  path.join(os.homedir(), 'AppData', 'Roaming', 'kompliance-pro', 'kompliance.json');

function loadDb() {
  // Читаем файл заново при каждом запросе — база меняется, пока открыто
  // основное приложение, кэшировать нельзя. lowdb v1 (FileSync) пишет
  // обычный JSON, поэтому здесь не нужна сама библиотека lowdb — читаем
  // напрямую через fs, это и проще, и безопаснее (нет риска рассинхрона
  // версий lowdb между этим процессом и основным приложением).
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

// ── Проверка фиче-флага перед стартом ────────────────────────────────
function checkEnabled() {
  let data;
  try {
    data = loadDb();
  } catch (e) {
    console.error('[kompliancepro-mcp] Не удалось прочитать базу:', e.message);
    process.exit(1);
  }
  if (!data.settings || data.settings.mcp_enabled !== '1') {
    console.error('[kompliancepro-mcp] settings.mcp_enabled не включён — сервер не запускается.');
    console.error('[kompliancepro-mcp] Включи флаг в настройках приложения, чтобы разрешить MCP.');
    process.exit(1);
  }
}
checkEnabled();

// ── readiness-calc.js — написан для <script> в index.html, без
// module.exports; загружаем через vm, оригинал не трогаем. ───────────
const READINESS_CALC_PATH =
  process.env.KOMPLIANCE_READINESS_CALC_PATH ||
  fileURLToPath(new URL('./readiness-calc.js', import.meta.url));

let calcOtReadiness, calcPdReadiness, calcVuReadiness;
try {
  const src = fs.readFileSync(READINESS_CALC_PATH, 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    src +
      '\n;this.calcOtReadiness=calcOtReadiness;this.calcPdReadiness=calcPdReadiness;' +
      'this.calcVuReadiness=calcVuReadiness;',
    sandbox
  );
  ({ calcOtReadiness, calcPdReadiness, calcVuReadiness } = sandbox);
} catch (e) {
  console.error('[kompliancepro-mcp] Не удалось загрузить readiness-calc.js:', e.message);
}

// ── Хелперы доступа к данным (реальная схема — плоские таблицы с
// client_id, подтверждено по main.js: db.defaults({clients, employees,
// documents, events, tasks, npa_changes, divisions, certifications,
// settings})) ──────────────────────────────────────────────────────
function getClients(data) {
  return data.clients || [];
}
function getEmployees(data, clientId) {
  return (data.employees || []).filter((e) => e.client_id === clientId);
}
function getDocuments(data, clientId) {
  return (data.documents || []).filter((d) => d.client_id === clientId);
}
function getEvents(data, clientId) {
  const all = data.events || [];
  // String() — client_id из схемы инструмента приходит строкой, а
  // e.client_id в базе хранится как Number (тот же класс несовпадения
  // типов, что чинили в mcp-write-bridge.js для generateForClient).
  // Без приведения строгое сравнение никогда не совпадёт, и фильтр по
  // конкретному клиенту молча возвращал бы пустой список.
  return clientId ? all.filter((e) => String(e.client_id) === String(clientId)) : all;
}
function findClient(data, clientId) {
  // id в базе — то, что возвращает nextId('clients') в main.js (число).
  return getClients(data).find((c) => String(c.id) === String(clientId));
}

// ══════════════════════════════════════════════════════════════════
//  MCP-СЕРВЕР
// ══════════════════════════════════════════════════════════════════

const server = new McpServer({ name: 'kompliancepro', version: '0.2.0' });

// ── list_clients ──────────────────────────────────────────────────
server.registerTool(
  'list_clients',
  {
    title: 'Список клиентов',
    description:
      'Список клиентов аутсорсера с базовыми параметрами (название организации, ОКВЭД, класс СОУТ, число сотрудников). Не содержит персональных данных физлиц. Только чтение.',
    inputSchema: {
      okved_prefix: z.string().optional().describe('Фильтр по первым цифрам ОКВЭД, например "52"'),
      soat_class: z.string().optional().describe('Фильтр по классу условий труда, например "2" или "3.1"'),
      include_archived: z.boolean().default(false).describe('Включать архивных клиентов'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ okved_prefix, soat_class, include_archived }) => {
    const data = loadDb();
    let clients = getClients(data);
    if (!include_archived) clients = clients.filter((c) => !c.archived);
    if (okved_prefix) clients = clients.filter((c) => String(c.okved || '').startsWith(okved_prefix));
    if (soat_class) clients = clients.filter((c) => String(c.soat_class || '') === soat_class);

    const result = clients.map((c) => ({
      id: c.id,
      name: c.name, // название организации — не персональные данные физлица
      manager_position: c.manager_position,
      okved: c.okved,
      soat_class: c.soat_class,
      employees_count: getEmployees(data, c.id).length,
    }));

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ── get_client_readiness ─────────────────────────────────────────────
server.registerTool(
  'get_client_readiness',
  {
    title: 'Готовность клиента по модулям',
    description:
      'Процент готовности документооборота клиента по модулям (ОТ/ПДн/ВУ) — та же формула, что и в интерфейсе приложения (readiness-calc.js). Отдаёт только числа, не персональные данные.',
    inputSchema: {
      client_id: z.string().describe('ID клиента (см. list_clients)'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ client_id }) => {
    const data = loadDb();
    const client = findClient(data, client_id);
    if (!client) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Клиент не найден' }) }], isError: true };
    }
    const emps = getEmployees(data, client.id);
    const docs = getDocuments(data, client.id);

    const readiness = {};
    if (calcOtReadiness) readiness.ot = calcOtReadiness(client, docs, emps);
    if (calcPdReadiness) readiness.pd = calcPdReadiness(client, docs.filter((d) => d.module === 'PD'));
    // ВУ пока не считаем: calcVuReadiness ожидает vuData из settings
    // (settings[`vu_data_${clientId}`]), это отдельный TODO — см. README.

    return { content: [{ type: 'text', text: JSON.stringify({ client: client.name, readiness }, null, 2) }] };
  }
);

// ── get_overdue_documents ─────────────────────────────────────────────
// ВАЖНО: источник просрочек — таблица events (поле due_date), НЕ поле
// expires_at в documents (такого поля в схеме нет вовсе — выяснено по
// main.js: documents:add просто пишет status/module/filename, срок
// хранится отдельно, в events).
server.registerTool(
  'get_overdue_documents',
  {
    title: 'Просроченные и приближающиеся события',
    description:
      'Список событий (мероприятий/сроков) из планировщика приложения, которые просрочены или наступают в ближайшие N дней — по одному клиенту или по всей базе. Только чтение.',
    inputSchema: {
      client_id: z.string().optional().describe('Если не указан — проверяются все клиенты'),
      days_ahead: z.number().default(30).describe('Горизонт "скоро наступает", в днях'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ client_id, days_ahead }) => {
    const data = loadDb();
    const events = getEvents(data, client_id);
    const clients = getClients(data);
    const now = Date.now();
    const horizon = now + days_ahead * 24 * 60 * 60 * 1000;

    const result = events
      .filter((e) => e.due_date)
      .map((e) => {
        const t = new Date(e.due_date).getTime();
        const status = t < now ? 'просрочено' : t < horizon ? 'скоро наступает' : null;
        if (!status) return null;
        const client = clients.find((c) => c.id === e.client_id);
        return {
          client: client ? client.name : '(не найден)',
          title: e.title || e.name || '(без названия)',
          due_date: e.due_date,
          status,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ── generate_document_package ─────────────────────────────────────────
// ЕДИНСТВЕННЫЙ инструмент, который что-то ПИШЕТ. Делает это не сам —
// вызывает mcp-write-bridge.js (CommonJS, в корне проекта), который: (1)
// ещё раз проверяет mcp_enabled, (2) требует настроенный бэкап и делает
// его ПЕРЕД записью, (3) берёт файловую блокировку на время операции,
// (4) вызывает тот же generateDocsForClient, что и кнопка "Сформировать
// пакет" в интерфейсе. Работает даже при закрытом основном приложении —
// именно ради этого и затевался весь Вариант Б.
server.registerTool(
  'generate_document_package',
  {
    title: 'Сформировать пакет документов',
    description:
      'Запускает штатную генерацию пакета документов для клиента — тот же код, что и кнопка "Сформировать пакет" в интерфейсе. Не сочиняет текст, использует существующие шаблоны. Перед записью делает обязательный бэкап базы. Работает и при закрытом приложении.',
    inputSchema: {
      client_id: z.string().describe('ID клиента (см. list_clients)'),
      module: z.enum(['ALL', 'OT', 'PD', 'VU']).default('ALL').describe('Какой модуль формировать'),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true, // перезаписывает записи реестра документов затронутого модуля
      idempotentHint: true,  // повторный вызов с теми же данными клиента → те же файлы (unchanged)
      openWorldHint: false,
    },
  },
  async ({ client_id, module }) => {
    let generateForClient;
    try {
      ({ generateForClient } = await import(
        process.env.KOMPLIANCE_WRITE_BRIDGE_PATH ||
          new URL('../mcp-write-bridge.js', import.meta.url).href
      ));
    } catch (e) {
      return {
        content: [{ type: 'text', text: 'Не удалось подключить mcp-write-bridge.js: ' + e.message }],
        isError: true,
      };
    }

    try {
      // client_id приходит строкой (схема инструмента), а в базе id клиента
      // хранится как Number — без приведения строгое сравнение внутри
      // doc-generation.js (db.get('clients').find({id})) не найдёт клиента.
      const numericClientId = /^\d+$/.test(client_id) ? Number(client_id) : client_id;
      const result = await generateForClient(DB_PATH, numericClientId, module);
      if (!result.ok) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }], isError: true };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                generated: result.generated?.length ?? 0,
                added: result.report?.added?.length ?? 0,
                updated: result.report?.updated?.length ?? 0,
                unchanged: result.report?.unchanged?.length ?? 0,
                errors: result.errors ?? [],
                backupPath: result.backupPath,
                dir: result.dir,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: 'text', text: 'Ошибка генерации: ' + e.message }], isError: true };
    }
  }
);

// ══════════════════════════════════════════════════════════════════
//  ЗАПУСК
// ══════════════════════════════════════════════════════════════════

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[kompliancepro-mcp] сервер запущен (stdio, read-write, этап 2)');
