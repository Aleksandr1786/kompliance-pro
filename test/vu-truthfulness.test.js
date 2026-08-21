const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const vu = fs.readFileSync(path.join(root, 'src/modules/vu.js'), 'utf8');
const generator = fs.readFileSync(path.join(root, 'gen_vu.js'), 'utf8');

test('VU copy uses current age, deadline and form terminology', () => {
  assert.doesNotMatch(vu, /18[–-]27/);
  assert.match(vu, /18–30/);
  assert.doesNotMatch(vu, /2 недель/);
  assert.match(vu, /в течение 5 дней/);
  assert.doesNotMatch(vu, /Т-2/);
  assert.match(vu, /форма № 10/);
  assert.doesNotMatch(generator, /5 рабочих дней/);
  assert.match(generator, /В течение 5 дней/);
  assert.doesNotMatch(generator, /Т-2/);
  assert.match(generator, /форма № 10/);
});

test('VU UI does not invent probabilities or aggregate penalties', () => {
  assert.doesNotMatch(vu, /Вероятность нарушений при проверках/);
  assert.doesNotMatch(vu, /Макс\. штраф/);
  assert.doesNotMatch(vu, /\bfine\s*:/);
  assert.doesNotMatch(vu, /штраф до/);
  assert.match(vu, /Уровень выявленных рисков/);
  assert.match(vu, /требует подтверждающих документов/);
});

test('all desktop VU views use the canonical readiness calculator', () => {
  const calls = vu.match(/calcVuReadiness\(/g) || [];
  assert.ok(calls.length >= 2, 'client card and readiness center must share calcVuReadiness');
  assert.match(vu, /const vuScore = calcVuReadiness\(client, emps, vuData\);/);
  assert.doesNotMatch(vu, /организация готова к проверке!/);
  assert.doesNotMatch(vu, /Выявлено нарушений|Устраните нарушения/);
  assert.match(vu, /Факторов, требующих проверки/);
});
