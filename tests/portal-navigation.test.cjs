const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const absolute = path.resolve(__dirname, '..', file);
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(absolute), name + '.ts'))) : require(name), m, m.exports);
  return m.exports;
}
const nav = load('lib/admin-navigation.ts');
const search = load('lib/tradein-search.ts');

test('MOD sees only granted groups, including standalone action grants', () => {
  assert.deepEqual(nav.visibleAdminScreens('mod', [], []), []);
  assert.deepEqual(nav.visibleAdminScreens('mod', ['demo', 'may-cu'], []), ['may-cu', 'demo']);
  assert.deepEqual(nav.visibleAdminScreens('mod', [], ['reload-data']), ['tcdm']);
  assert.deepEqual(nav.visibleAdminScreens('mod', [], ['staff-security']), ['people']);
  assert.deepEqual(nav.visibleAdminScreens('mod', [], ['tools-checkin']), ['tools']);
  assert.deepEqual(nav.visibleAdminScreens('mod', [], ['dashboard-view']), ['system']);
  assert.ok(!nav.visibleAdminScreens('mod', ['tools'], []).includes('system'));
});
test('ADMIN retains all functions under four non-overlapping groups', () => {
  assert.deepEqual(nav.ADMIN_SECTIONS.map(section => section.label), ['Nội dung', 'Bảng giá', 'Tài khoản', 'Hệ thống']);
  const screens = nav.visibleAdminScreens('admin', [], []);
  assert.equal(screens.length, new Set(screens).size);
  for (const expected of ['tcdm', 'quy-trinh-thu-cu', 'may-moi', 'may-cu', 'demo', 'tools', 'people', 'system']) assert.ok(screens.includes(expected));
});
test('suggestions match separated tokens and accents without mixing storage or Plus variants', () => {
  const products = [
    { brand: 'Apple', model: 'IPHONE 15 PLUS_128G', storage: '128GB' },
    { brand: 'Apple', model: 'IPHONE 15_256G', storage: '256GB' },
    { brand: 'Apple', model: 'IPHONE 15_128G', storage: '128GB' },
    { brand: 'Điện thoại khác', model: 'Model A60', storage: '128GB' },
  ];
  assert.equal(search.suggestTradeinProducts(products, 'iphone 15 256').products[0].storage, '256GB');
  assert.equal(search.suggestTradeinProducts(products, '15 plus').total, 1);
  assert.equal(search.suggestTradeinProducts(products, 'dien thoai a60').total, 1);
  assert.equal(search.suggestTradeinProducts(products, 'nonsense').total, 0);
  assert.equal(search.suggestTradeinProducts(products, '').total, 0);
  assert.equal(search.suggestTradeinProducts(products, 'IPHONE 15_128G').products[0].model, 'IPHONE 15_128G');
});
test('large suggestion lists are capped while preserving the full match count and source data', () => {
  const products = Array.from({ length: 100 }, (_, index) => ({ brand: 'Apple', model: `iPhone ${index}` }));
  const before = JSON.stringify(products);
  const result = search.suggestTradeinProducts(products, 'iphone');
  assert.equal(result.total, 100); assert.equal(result.products.length, 12);
  assert.equal(JSON.stringify(products), before);
});
