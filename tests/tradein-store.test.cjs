const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const newRows = [['hang','tensanphamdoilen','tiletrogia','tiletrogiaApple','muctrogia','nganhhangmaydoilen','minmuctrogia','minmuctrogiaApple'], ['OPPO','Reno Test',0.1,0.15,500000,'Điện thoại',0,0]];
const oldRows = [['Hãng','Model','Bộ nhớ','Loại 1','','Loại 2','','Loại 3','','Loại 4','','Loại 5',''], ['Apple','iPhone Test','128GB',1000000,900000,900000,800000,800000,700000,700000,600000,600000,500000]];
function setup() {
  const state = { row: null, sourceError: false, badHeaders: false, onRead: null, reads: 0, writes: 0 };
  const mockDb = {
    isSupabaseConfigured: () => true,
    selectRows: async () => state.row ? [structuredClone(state.row)] : [],
    insertRows: async (_, rows) => {
      if (state.row) throw new Error('23505 duplicate');
      state.writes++; state.row = structuredClone(rows[0]); return rows;
    },
    updateRows: async (_, filters, row) => {
      if (!state.row || !filters.value.includes(JSON.parse(state.row.value).version)) return [];
      state.writes++; state.row = structuredClone(row); return [row];
    },
  };
  const mocks = {
    'server-only': {},
    './supabase-rest': mockDb,
    googleapis: { google: { auth: { JWT: class {} }, sheets: () => ({ spreadsheets: { values: { batchGet: async () => {
      state.reads++;
      if (state.sourceError) throw new Error('Google source unreachable: private connection detail');
      if (state.onRead) state.onRead();
      return { data: { valueRanges: [{values: state.badHeaders ? [['wrong'], ['x']] : newRows}, {values: oldRows}] } };
    } } } }) } },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const module = {exports:{}}; cache.set(file,module.exports);
    const requireLocal = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.resolve(path.dirname(file),name+'.ts')) : require(name);
    new Function('require','module','exports',source)(requireLocal,module,module.exports);
    cache.set(file,module.exports);return module.exports;
  }
  return { state, store: load(path.resolve(__dirname,'../lib/tradein-store.ts')) };
}
process.env.SPREADSHEET_ID = 'test-sheet-only';
process.env.GOOGLE_CLIENT_EMAIL = 'test@example.invalid';
process.env.GOOGLE_PRIVATE_KEY = 'test-key-only';

test('publishing a validated source snapshot exposes only public price data', async () => {
  const {state,store} = setup();
  assert.equal(await store.getTradeinSnapshot(),null);
  const snapshot = await store.syncTradeinSource('', 'Admin Test');
  assert.equal(state.writes,1);
  assert.equal(snapshot.oldProducts.length,1);
  assert.equal(snapshot.newProducts.length,1);
  assert.equal((await store.getTradeinSnapshot()).version,snapshot.version);
  const publicData = store.publicTradeinData(snapshot);
  assert.deepEqual(Object.keys(publicData).sort(),['newProducts','oldProducts','syncedAt','version']);
  assert.ok(!JSON.stringify(publicData).includes('Admin Test'));
});
test('source outage or invalid sheet headers preserve the previous snapshot atomically', async () => {
  const {state,store} = setup();
  const first = await store.syncTradeinSource('', 'Admin');
  const saved = state.row.value;
  state.sourceError = true;
  await assert.rejects(store.syncTradeinSource(first.version, 'Admin'));
  assert.equal(state.row.value,saved);
  state.sourceError = false; state.badHeaders = true;
  await assert.rejects(store.syncTradeinSource(first.version, 'Admin'));
  assert.equal(state.row.value,saved);
  assert.equal(state.writes,1);
});
test('stale clients and concurrent imports cannot replace a newer snapshot', async () => {
  const {state,store} = setup();
  const first = await store.syncTradeinSource('', 'Admin');
  await assert.rejects(store.syncTradeinSource('', 'Other'), error=>error.status===409);
  assert.equal(state.reads,1);
  state.onRead = () => { const winner=JSON.parse(state.row.value);winner.version='concurrent-winner';state.row.value=JSON.stringify(winner); };
  await assert.rejects(store.syncTradeinSource(first.version, 'Other'), error=>error.status===409);
  assert.equal(JSON.parse(state.row.value).version,'concurrent-winner');
  assert.equal(state.writes,1);
});
