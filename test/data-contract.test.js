const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DATA_CONTRACT_VERSION,
  sanitizeClientData,
  sanitizeEmployeeData,
  sanitizeMedicalClearances,
  sanitizeVuData,
  isCloudSyncedPath,
} = require('../data-contract');

test('contract v1 removes local ids, tokens and unknown client fields', () => {
  assert.equal(DATA_CONTRACT_VERSION, 1);
  assert.deepEqual(
    sanitizeClientData({ id: 7, cloud_id: 'uuid', name: 'ООО Тест', inn: '123', ai_key: 'secret', arbitrary: true }),
    { name: 'ООО Тест', inn: '123' }
  );
});

test('employee contract keeps approved fields and filters medical records', () => {
  assert.deepEqual(sanitizeEmployeeData({
    id: 9,
    client_id: 7,
    full_name: 'Иванов Иван Иванович',
    diagnosis: 'must-not-leave-device',
    medical_clearances: [
      { id: 'ok', type: 'periodic_29n', issued_date: '2026-01-01', diagnosis: 'forbidden' },
      { id: 'bad', type: 'free_text_diagnosis', issued_date: '2026-01-01' },
    ],
  }), {
    full_name: 'Иванов Иван Иванович',
    medical_clearances: [{ id: 'ok', type: 'periodic_29n', issued_date: '2026-01-01' }],
  });
});

test('military contract strips unknown fields', () => {
  assert.deepEqual(
    sanitizeVuData({ responsible_name: 'Петров П.П.', journal_started: true, secret_note: 'no' }),
    { responsible_name: 'Петров П.П.', journal_started: true }
  );
});

test('medical sanitizer accepts only the fixed registry', () => {
  assert.deepEqual(sanitizeMedicalClearances([
    { type: 'guard_cert_1252n', valid_until: '2027-01-01' },
    { type: 'custom diagnosis', valid_until: '2027-01-01' },
  ]), [{ type: 'guard_cert_1252n', valid_until: '2027-01-01' }]);
});

test('cloud-synced backup folders are detected', () => {
  assert.equal(isCloudSyncedPath('C:\\Users\\User\\Яндекс.Диск\\Backup'), true);
  assert.equal(isCloudSyncedPath('C:\\KompliancePro\\Backup'), false);
});
