const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function setup() {
  const rows = new Map([['TRADEIN_PUBLIC_SNAPSHOT_V1', { value: 'price snapshot unchanged' }]]);
  const cache = new Map();
  const mocks = {
    'server-only': {},
    './supabase-rest': {
      selectRows: async (_, query) => { const row = rows.get(query.filters.key.slice(3)); return row ? [structuredClone(row)] : []; },
      insertRows: async (_, items) => { if (rows.has(items[0].key)) throw new Error('23505 duplicate'); rows.set(items[0].key, structuredClone(items[0])); return items; },
      updateRows: async (_, filters, row) => { const current = rows.get(row.key); if (!current || !filters.value.includes(JSON.parse(current.value).revision)) return []; rows.set(row.key, structuredClone(row)); return [row]; },
    },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const m = { exports: {} };
    new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), m, m.exports);
    cache.set(file, m.exports); return m.exports;
  }
  return { rows, store: load(path.resolve(__dirname, '../lib/tradein-grade-guide-store.ts')) };
}

test('confirmed default definitions are available before the first admin save', async () => {
  const { store } = setup();
  const guide = await store.getTradeinGradeGuide();
  assert.match(guide.descriptions[1], /90%/);
  assert.match(guide.descriptions[1], /14 series.*VN\/A/);
  assert.match(guide.descriptions[2], /dưới 3 vết/);
  assert.equal(guide.descriptions[5], 'Lỗi màn hình.');
});

test('edits persist with conflict detection and cannot replace the price snapshot', async () => {
  const { store, rows } = setup();
  const initial = await store.getTradeinGradeGuide();
  const updated = await store.writeTradeinGradeGuide({ ...initial, descriptions: { ...initial.descriptions, 5: 'Tiêu chí đã cập nhật.' } }, 'Admin QA');
  assert.equal((await store.getTradeinGradeGuide()).descriptions[5], 'Tiêu chí đã cập nhật.');
  assert.notEqual(updated.revision, initial.revision);
  await assert.rejects(store.writeTradeinGradeGuide(initial, 'Other QA'), error => error.status === 409);
  assert.equal(rows.get('TRADEIN_PUBLIC_SNAPSHOT_V1').value, 'price snapshot unchanged');
});

test('blank, oversized and invalid definitions are rejected before saving', async () => {
  const { store, rows } = setup();
  const initial = await store.getTradeinGradeGuide();
  for (const invalid of ['', 'x'.repeat(601), null, 5]) {
    await assert.rejects(store.writeTradeinGradeGuide({ ...initial, descriptions: { ...initial.descriptions, 3: invalid } }, 'Admin QA'), error => error.status === 400);
    assert.ok(!rows.has('TRADEIN_GRADE_GUIDE_V1'));
  }
});
