'use strict';

// Контракт облачной передачи ПДн. Версия меняется только вместе с web-контрактом.
const DATA_CONTRACT_VERSION = 1;

const CLIENT_SYNC_FIELDS = Object.freeze([
  'name', 'inn', 'kpp', 'ogrn', 'form', 'okved', 'okved_extra', 'email',
  'staff', 'region', 'city', 'address', 'address_actual', 'phone', 'czn',
  'manager_name', 'manager_position', 'ot_name', 'ot_position', 'ot_name_acc',
  'ot_position_acc', 'instr_name', 'instr_position', 'instr_name_acc',
  'instr_position_acc', 'modules', 'color', 'score', 'order_prefix',
  'soat_class', 'soat_total', 'soat_done', 'soat_c1', 'soat_c2', 'soat_c31',
  'soat_c32', 'soat_c33', 'soat_c34', 'soat_c4', 'soat_med_req',
  'hazard_works', 'medcheck_required', 'contract_date', 'git_last_date',
  'next_visit_date', 'git_next_date', 'doc_date', 'last_gen_snapshot',
  'pd_checklist', 'pd_notified_rkn', 'pd_notification_date', 'pd_order_base',
  'pd_responsible_name', 'pd_responsible_position', 'pd_resp_name',
  'pd_resp_pos', 'pd_resp_pos_acc', 'pd_ispdn', 'pd_ispdn_arr', 'pd_ispdn_list',
  'pd_consent_given', 'sout', 'sout_data', 'pasf', 'vu_data', 'created_at',
  'updated_at', 'archived', 'archived_at', 'short_name', 'org_type',
  'director_fio', 'director_name', 'director_position', 'manager_name_full',
  'manager_position_gen', 'ot_dative', 'ot_name_full', 'instr_name_full',
  'dsiz_name', 'dsiz_name_full', 'dsiz_name_acc', 'dsiz_dative',
  'dsiz_position', 'dsiz_position_acc', 'elec_name', 'elec_name_full',
  'elec_name_acc', 'elec_position', 'elec_position_acc', 'hr_chief_fio',
  'hr_chief_pos', 'date_acquainted', 'tg_notified', 'is_hazard',
]);

const EMPLOYEE_SYNC_FIELDS = Object.freeze([
  'full_name', 'position', 'birth_date', 'hired_at', 'hire_date', 'tab_number',
  'department', 'division_id', 'gender', 'snils', 'passport_series',
  'passport_number', 'passport_issued_by', 'passport_issued_date', 'is_military',
  'prog_b_exempt', 'medcheck_required', 'name_gen', 'name_dat', 'name_acc',
  'name_ins', 'name_short', 'vu_category', 'vu_rank', 'vu_mobpredpisanie',
  'commission_role', 'training', 'medical_clearances', 'chop', 'pasf',
  'created_at', 'updated_at',
]);

const VU_SYNC_FIELDS = Object.freeze([
  'responsible_name', 'responsible_position', 'order_number',
  'last_reconciliation', 'voenkomat', 'journal_started', 'regulation_done',
  'cards_filled', 'notifications_sent', 'ogrn', 'okato', 'okpo', 'okopf',
  'okfs', 'okved_name', 'reg_date_place', 'has_bronirowanie', 'bron_codes',
  'gov_organ',
]);

const MEDICAL_CLEARANCE_TYPES = Object.freeze([
  'periodic_29n',
  'maritime_714n',
  'guard_cert_1252n',
  'psychiatric_392n',
]);

const MEDICAL_CLEARANCE_FIELDS = Object.freeze([
  'id', 'type', 'basis_order', 'issued_date', 'valid_until',
]);

function pickKnownFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(value, key)) result[key] = value[key];
  }
  return result;
}

function sanitizeMedicalClearances(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && MEDICAL_CLEARANCE_TYPES.includes(item.type))
    .map((item) => pickKnownFields(item, MEDICAL_CLEARANCE_FIELDS));
}

function sanitizeClientData(value) {
  return pickKnownFields(value, CLIENT_SYNC_FIELDS);
}

function sanitizeEmployeeData(value) {
  const result = pickKnownFields(value, EMPLOYEE_SYNC_FIELDS);
  if (Object.prototype.hasOwnProperty.call(result, 'medical_clearances')) {
    result.medical_clearances = sanitizeMedicalClearances(result.medical_clearances);
  }
  return result;
}

function sanitizeVuData(value) {
  return pickKnownFields(value, VU_SYNC_FIELDS);
}

function isCloudSyncedPath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').toLowerCase();
  return [
    '/onedrive/', '/dropbox/', '/google drive/', '/google диске/',
    '/yandex.disk/', '/yandex disk/', '/яндекс.диск/', '/яндекс диск/',
    '/mail.ru cloud/', '/облако mail.ru/',
  ].some((marker) => normalized.includes(marker));
}

module.exports = {
  DATA_CONTRACT_VERSION,
  CLIENT_SYNC_FIELDS,
  EMPLOYEE_SYNC_FIELDS,
  VU_SYNC_FIELDS,
  MEDICAL_CLEARANCE_TYPES,
  sanitizeClientData,
  sanitizeEmployeeData,
  sanitizeMedicalClearances,
  sanitizeVuData,
  isCloudSyncedPath,
};
