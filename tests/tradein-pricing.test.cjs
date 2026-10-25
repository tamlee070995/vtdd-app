const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/tradein-pricing.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', source)(loaded, loaded.exports);
const { parseTradeinSheets, calculateTradeinSupport, calculateTradeinQuote, formatTradeinRange, tradeinMatches } = loaded.exports;

const newHeader = ['hang', 'tensanphamdoilen', 'tiletrogia', 'tiletrogiaApple', 'muctrogia', 'nganhhangmaydoilen', 'minmuctrogia', 'minmuctrogiaApple'];
const oldHeader = ['Hãng', 'Model', 'Bộ nhớ', 'Loại 1', '', 'Loại 2', '', 'Loại 3', '', 'Loại 4', '', 'Loại 5', '', 'nganhhangmaythuvao', 'LOAI 1 MWG', 'LOAI 2 MWG'];
const newRow = ['Apple', 'Máy mới kiểm thử', 0.1, 0.15, 3_000_000, 'Điện thoại', 100_000, 200_000];
// Real source column layout, including descending price endpoints and extra legacy columns.
const oldRow = ['Apple', 'IPHONE 11 PRO MAX_256G', '4GB/256GB', 4_950_000, 4_455_000, 4_454_999, 3_465_000, 3_464_999, 2_475_000, 2_474_999, 1_485_000, 1_484_999, 700_000, 'Điện thoại', 0, 0];
const parse = (next = [newRow], old = [oldRow]) => parseTradeinSheets([newHeader, ...next], [oldHeader, ...old]);

test('source pairs are normalized without reading the extra MWG columns', () => {
  const data = parse();
  assert.deepEqual(data.oldProducts[0].ranges[1], { min: 4_455_000, max: 4_950_000, incomplete: false });
  assert.deepEqual(data.oldProducts[0].ranges[5], { min: 700_000, max: 1_484_999, incomplete: false });
  assert.equal(data.oldProducts[0].storage, '4GB/256GB');
  assert.equal(data.quality.incompleteRanges, 0);
});
test('Apple and non-Apple use the correct rate and floor; rounded totals match the supplied formula', () => {
  const data = parse();
  const old = data.oldProducts[0], next = data.newProducts[0];
  assert.deepEqual(calculateTradeinQuote(old, next, 1), { support: { min: 670_000, max: 745_000 }, total: { min: 5_125_000, max: 5_695_000 } });
  assert.deepEqual(calculateTradeinQuote({ ...old, brand: 'Samsung', model: 'Galaxy' }, next, 1), {
    support: { min: 445_000, max: 495_000 }, total: { min: 4_900_000, max: 5_445_000 },
  });
  assert.equal(calculateTradeinSupport(4_950_000, 0.15, 0, 500_000), 500_000);
  assert.equal(calculateTradeinSupport(100_000, 0.15, 200_000, 3_000_000), 200_000);
  assert.equal(calculateTradeinSupport(0, 0.15, 200_000, 3_000_000), 0);
  assert.equal(calculateTradeinSupport(1_000_000, 0.0125, 0, 0), 15_000);
});
test('missing endpoints remain incomplete and never yield a fabricated quote', () => {
  const row = [...oldRow]; row[4] = '';
  const data = parse(undefined, [row]);
  assert.equal(data.oldProducts[0].ranges[1].incomplete, true);
  assert.equal(calculateTradeinQuote(data.oldProducts[0], data.newProducts[0], 1), null);
  assert.equal(formatTradeinRange(data.oldProducts[0].ranges[1]), 'Thiếu mốc giá');
  assert.equal(data.quality.incompleteRanges, 1);
  row[3] = 0;
  const empty = parse(undefined, [row]);
  assert.equal(empty.quality.unavailableRanges, 1);
  assert.equal(calculateTradeinQuote(empty.oldProducts[0], empty.newProducts[0], 1), null);
});
test('zero subsidy is displayed as zero and remains a valid quote', () => {
  const data = parse([[...newRow.slice(0, 2), 0, 0, 0, 'Điện thoại', 0, 0]]);
  const quote = calculateTradeinQuote(data.oldProducts[0], data.newProducts[0], 1);
  assert.deepEqual(quote.support, { min: 0, max: 0 });
  assert.deepEqual(quote.total, { min: 4_455_000, max: 4_950_000 });
  assert.equal(formatTradeinRange(quote.support, true), '0\u00a0₫');
});
test('header-based mapping survives inserted columns and prevents cross-grade pairing', () => {
  const heads = [...oldHeader]; heads.splice(3, 0, 'Ghi chú');
  const row = [...oldRow]; row.splice(3, 0, 'Không phải giá');
  const data = parseTradeinSheets([newHeader, newRow], [heads, row]);
  assert.equal(data.oldProducts[0].ranges[1].min, 4_455_000);
  heads[5] = 'Loại 2';
  assert.throws(() => parseTradeinSheets([newHeader, newRow], [heads, row]), /hai cột giá liền kề/);
  const newHeads = [...newHeader], newValues = [...newRow];
  newHeads.splice(2, 0, 'Ghi chú'); newValues.splice(2, 0, 'X');
  assert.equal(parseTradeinSheets([newHeads, newValues], [oldHeader, oldRow]).newProducts[0].appleRate, 0.15);
});
test('percentage and formatted currency imports retain the intended numeric values', () => {
  const row = [...newRow]; row[2] = '15%'; row[3] = '0,2'; row[4] = '3.000.000 ₫';
  const product = parse([row]).newProducts[0];
  assert.equal(product.rate, 0.15); assert.equal(product.appleRate, 0.2); assert.equal(product.maxSupport, 3_000_000);
});
test('invalid prices, conflicting duplicate models and conflicting floors block the replacement', () => {
  for (const value of [-100, '#N/A', 'giá 300000', 12.5]) {
    const row = [...oldRow]; row[3] = value;
    assert.throws(() => parse(undefined, [row]), /giá không hợp lệ/);
  }
  const row = [...newRow]; row[6] = 4_000_000;
  assert.throws(() => parse([row]), /tối thiểu lớn hơn/);
  const duplicate = [...oldRow]; duplicate[3] = 5_000_000;
  assert.throws(() => parse(undefined, [oldRow, duplicate]), /trùng nhưng khác giá/);
  const changed = [...newRow]; changed[2] = 0.2;
  assert.throws(() => parse([newRow, changed]), /trùng model/);
  assert.throws(() => parseTradeinSheets([], [oldHeader, oldRow]), /phải có dữ liệu/);
});
test('tablets are excluded as in the source tool; matching accepts accents and separated model tokens', () => {
  const tablet = [...newRow]; tablet[1] = 'iPad Pro'; tablet[5] = 'Tablet';
  const data = parse([newRow, tablet]);
  assert.equal(data.newProducts.length, 1); assert.equal(data.quality.excludedTablets, 1);
  assert.equal(tradeinMatches(data.oldProducts[0], 'iphone 256 pro'), true);
  assert.equal(tradeinMatches({ brand: 'OPPO', model: 'Điện thoại Reno' }, 'dien thoai'), true);
  assert.equal(tradeinMatches(data.oldProducts[0], '512'), false);
});
test('Plus variants remain distinct models with their own prices', () => {
  const plain = [...oldRow]; plain[0] = 'Samsung'; plain[1] = 'GALAXY S20';
  const plus = [...plain]; plus[1] = 'GALAXY S20+'; plus[3] = 6_000_000;
  const data = parse(undefined, [plain, plus]);
  assert.equal(data.oldProducts.length, 2);
  assert.equal(tradeinMatches(data.oldProducts[0], 's20+'), false);
  assert.equal(tradeinMatches(data.oldProducts[1], 's20 plus'), true);
});
test('trimmed blank cells at the end of the header do not discard the final price endpoint', () => {
  const data = parseTradeinSheets([newHeader,newRow], [oldHeader.slice(0,12),oldRow.slice(0,13)]);
  assert.deepEqual(data.oldProducts[0].ranges[5], {min:700_000,max:1_484_999,incomplete:false});
});
