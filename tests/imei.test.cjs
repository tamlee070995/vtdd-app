const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const { NextRequest } = require('next/server');
const { matches, query } = require('./helpers/postgrest-fake.cjs');

function setup({ fixedRandom = false } = {}) {
  const rows = [], cache = new Map(), reads = [];
  let actor = { maNV: '00123', name: 'Admin thử', permission: 'admin', modules: [], actions: [] };
  let authenticated = true, dropReply = false, offline = false;
  const pause = () => new Promise(resolve => setImmediate(resolve));
  const db = {
    isSupabaseConfigured: () => true,
    selectRows: async (_, options) => { await pause(); if (offline) throw new Error('offline'); reads.push(options); return query(rows, options); },
    selectAllRows: async (_, options) => { reads.push(options); return query(rows, options); },
    countRows: async (_, filters) => { await pause(); return rows.filter(row => matches(row, filters)).length; },
    insertRows: async (_, records) => {
      await pause();
      if (records.some(record => rows.some(row => row.key === record.key))) throw new Error('23505 duplicate key');
      rows.push(...structuredClone(records));
      if (dropReply && records.some(row => row.key.startsWith('IMEI_V1_CODE_'))) { dropReply = false; throw new Error('Lost response after commit'); }
      return structuredClone(records);
    },
    updateRows: async (_, filters, patch) => {
      await pause();
      const selected = rows.filter(row => matches(row, filters));
      selected.forEach(row => Object.assign(row, structuredClone(patch)));
      if (dropReply && selected.length) { dropReply = false; throw new Error('Lost response after commit'); }
      return structuredClone(selected);
    },
  };
  const mocks = {
    'server-only': {},
    'node:crypto': { ...crypto, ...(fixedRandom ? { randomInt: () => 0 } : {}) },
    '@/lib/supabase-rest': db,
    'googleapis': { google: {} }, '@/lib/sheets': {}, '@/lib/quote-log-store': {},
    '@/lib/admin-auth': { requireAdminApi: async () => authenticated ? { admin: actor, response: null } : { admin: null, response: new Response('{}', { status: 401 }) } },
  };
  function load(relative) {
    const file = path.resolve(__dirname, '..', relative);
    if (cache.has(file)) return cache.get(file);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const m = { exports: {} };
    new Function('require', 'module', 'exports', source)(name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), m, m.exports);
    cache.set(file, m.exports); return m.exports;
  }
  const store = load('lib/imei-store.ts'), rules = load('lib/imei.ts'), route = load('app/api/admin/imei/route.ts');
  const request = (body, origin = 'http://localhost') => new NextRequest('http://localhost/api/admin/imei', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) });
  return { rows, reads, store, rules, route, request, actor, load, setActor: value => { actor = value; }, unauthorized: () => { authenticated = false; }, loseResponse: () => { dropReply = true; }, offline: () => { offline = true; } };
}
const own = { canCancelOwn: true, canManageAll: false };
const all = { canCancelOwn: true, canManageAll: true };
const rejectStatus = status => error => error.status === status;

test('Luhn matches an independent known vector; all brands preserve exact prefixes and 15 decimal digits', async () => {
  const ctx = setup();
  assert.equal(ctx.rules.completeImei('49015420323751'), '490154203237518');
  assert.equal(ctx.rules.validImei('490154203237519'), false);
  for (const [brand, prefix] of [['samsung', '35399'], ['xiaomi', '867'], ['other', '00123']]) {
    for (let index = 0; index < 8; index++) {
      const result = await ctx.store.generateImei(brand, crypto.randomUUID(), ctx.actor);
      assert.equal(result.status, 'active'); assert.ok(result.imei.startsWith(prefix)); assert.match(result.imei, /^\d{15}$/);
      // Independent right-to-left Luhn verification, not a call back to the generator.
      const sum = [...result.imei].reverse().reduce((total, char, i) => { const n = +char * (i % 2 ? 2 : 1); return total + Math.floor(n / 10) + n % 10; }, 0);
      assert.equal(sum % 10, 0);
    }
  }
  assert.throws(() => ctx.rules.imeiPrefix('other', 'NV12'), /mã nhân viên/i);
  assert.throws(() => ctx.rules.imeiPrefix('other', '12345678901234'), /1–13/);
  await assert.rejects(ctx.store.generateImei('apple', crypto.randomUUID(), ctx.actor), rejectStatus(400));
  await assert.rejects(ctx.store.generateImei('samsung', 'bad', ctx.actor), rejectStatus(400));
});

test('concurrent retries share one allocation; lost responses can be recovered with the same request ID', async () => {
  const ctx = setup(), id = crypto.randomUUID();
  const results = await Promise.all(Array.from({ length: 12 }, () => ctx.store.generateImei('samsung', id, ctx.actor)));
  assert.equal(new Set(results.map(item => item.imei)).size, 1);
  assert.equal(ctx.rows.filter(row => row.type === 'IMEI_REQUEST').length, 1);
  assert.equal(JSON.parse(ctx.rows.find(row => row.type === 'IMEI_ACTIVE').value).events.length, 1);
  await assert.rejects(ctx.store.generateImei('xiaomi', id, ctx.actor), rejectStatus(409));
  const lost = crypto.randomUUID(); ctx.loseResponse();
  await assert.rejects(ctx.store.generateImei('xiaomi', lost, ctx.actor), /Lost response/);
  const recovered = await ctx.store.generateImei('xiaomi', lost, ctx.actor);
  assert.equal(recovered.status, 'active');
  assert.equal((await ctx.store.listImei(ctx.actor.maNV, false, 1, '')).total, 2);
});

test('a cancelled code is reused; old cancellation/retry cannot cancel or reactivate its newer lease', async () => {
  const ctx = setup(), first = await ctx.store.generateImei('samsung', crypto.randomUUID(), ctx.actor);
  const cancel = { requestId: first.requestId, actor: first.actor, reason: 'Không còn cần mã' };
  await ctx.store.cancelImei(cancel, ctx.actor, own);
  const nextActor = { maNV: '00999', name: 'Mod thử' };
  const second = await ctx.store.generateImei('samsung', crypto.randomUUID(), nextActor);
  assert.equal(second.imei, first.imei); assert.notEqual(second.requestId, first.requestId);
  assert.equal((await ctx.store.cancelImei(cancel, ctx.actor, own)).status, 'cancelled');
  assert.equal((await ctx.store.generateImei('samsung', first.requestId, ctx.actor)).status, 'cancelled');
  const history = await ctx.store.listImei('', true, 1, first.imei);
  assert.equal(history.items.length, 2);
  assert.equal(history.items.find(item => item.actor === nextActor.maNV).status, 'active');
  assert.equal(history.items.find(item => item.actor === first.actor).reason, cancel.reason);
  const ledger = JSON.parse(ctx.rows.find(row => row.type === 'IMEI_ACTIVE').value);
  assert.equal(ledger.events.filter(item => !item.rejected && !item.cancelledAt).length, 1);
});

test('simultaneous users never hold the same active code; collision outcomes remain terminal after cancellation', async () => {
  const ctx = setup({ fixedRandom: true });
  const requests = Array.from({ length: 8 }, () => crypto.randomUUID());
  const results = await Promise.allSettled(requests.map(requestId => ctx.store.generateImei('samsung', requestId, ctx.actor)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.code === 'IMEI_COLLISION'));
  const successful = results.find(result => result.status === 'fulfilled').value;
  await ctx.store.cancelImei({ requestId: successful.requestId, actor: successful.actor, reason: 'Thử cấp lại' }, ctx.actor, all);
  const failedId = requests[results.findIndex(result => result.status === 'rejected')];
  await assert.rejects(ctx.store.generateImei('samsung', failedId, ctx.actor), error => error.code === 'IMEI_COLLISION');
  const next = await ctx.store.generateImei('samsung', crypto.randomUUID(), ctx.actor);
  assert.equal(next.imei, successful.imei);
});

test('lost cancellation responses are idempotent and cancellation checks owner, reason and exact issue', async () => {
  const ctx = setup(), item = await ctx.store.generateImei('xiaomi', crypto.randomUUID(), ctx.actor);
  const command = { requestId: item.requestId, actor: item.actor, reason: 'Ghi sai nghiệp vụ' };
  await assert.rejects(ctx.store.cancelImei(command, { maNV: '456', name: 'Other' }, own), rejectStatus(403));
  await assert.rejects(ctx.store.cancelImei(command, ctx.actor, { canCancelOwn: false, canManageAll: false }), rejectStatus(403));
  await assert.rejects(ctx.store.cancelImei({ ...command, reason: ' ' }, ctx.actor, all), rejectStatus(400));
  await assert.rejects(ctx.store.cancelImei({ ...command, requestId: crypto.randomUUID() }, ctx.actor, all), rejectStatus(404));
  ctx.loseResponse(); await assert.rejects(ctx.store.cancelImei(command, ctx.actor, all), /Lost response/);
  assert.equal((await ctx.store.cancelImei(command, ctx.actor, all)).status, 'cancelled');
  assert.equal((await ctx.store.listImei(item.actor, false, 1, '')).items[0].reason, command.reason);
});

test('history is paginated and scoped on the server; private settings are not bulk-loaded', async () => {
  const ctx = setup();
  for (let index = 0; index < 23; index++) await ctx.store.generateImei('samsung', crypto.randomUUID(), ctx.actor);
  const other = await ctx.store.generateImei('other', crypto.randomUUID(), { maNV: '789', name: 'Other' });
  const first = await ctx.store.listImei(ctx.actor.maNV, false, 1, '');
  const second = await ctx.store.listImei(ctx.actor.maNV, false, 2, '');
  assert.equal(first.total, 23); assert.equal(first.items.length, 20); assert.equal(second.items.length, 3); assert.equal(first.pages, 2);
  assert.ok(first.items.every(item => item.actor === ctx.actor.maNV));
  assert.equal((await ctx.store.listImei(ctx.actor.maNV, false, 1, other.imei)).total, 0);
  assert.equal((await ctx.store.listImei('', true, 1, other.imei)).total, 1);
  await assert.rejects(ctx.store.listImei('', true, 1, 'abc'), rejectStatus(400));
  assert.ok(ctx.reads.every(options => options.limit <= 20));
});

test('API requires explicit Mod grants, rejects forged origin/body and enforces cancellation ownership', async () => {
  const ctx = setup();
  ctx.setActor({ ...ctx.actor, permission: 'mod', modules: [], actions: [] });
  assert.equal((await ctx.route.GET(new NextRequest('http://localhost/api/admin/imei'))).status, 403);
  ctx.setActor({ ...ctx.actor, permission: 'mod', modules: ['imei'], actions: [] });
  assert.equal((await ctx.route.GET(new NextRequest('http://localhost/api/admin/imei'))).status, 200);
  const generate = { action: 'GENERATE', brand: 'samsung', requestId: crypto.randomUUID() };
  assert.equal((await ctx.route.POST(ctx.request(generate))).status, 403);
  ctx.setActor({ ...ctx.actor, permission: 'mod', modules: [], actions: ['imei-create'] });
  assert.equal((await ctx.route.POST(ctx.request(generate, 'https://wrong.test'))).status, 403);
  const created = await ctx.route.POST(ctx.request(generate)); assert.equal(created.status, 200);
  assert.match(created.headers.get('Cache-Control'), /no-store/);
  const item = (await created.json()).item;
  const command = { action: 'CANCEL', requestId: item.requestId, actor: item.actor, reason: 'Thử hủy' };
  assert.equal((await ctx.route.POST(ctx.request(command))).status, 403);
  ctx.setActor({ ...ctx.actor, permission: 'mod', modules: [], actions: ['imei-cancel-own'] });
  assert.equal((await ctx.route.POST(ctx.request(command))).status, 200);
  assert.equal((await ctx.route.POST(ctx.request({ action: 'GENERATE', brand: 'samsung', requestId: crypto.randomUUID() }))).status, 403);
  assert.equal((await ctx.route.POST(ctx.request({ action: 'DELETE' }))).status, 400);
  assert.equal((await ctx.route.POST(ctx.request('not an object'))).status, 400);
  assert.equal((await ctx.route.POST(ctx.request({ action: 'CANCEL', reason: 'x'.repeat(5000) }))).status, 413);
  ctx.unauthorized(); assert.equal((await ctx.route.GET(new NextRequest('http://localhost/api/admin/imei'))).status, 401);
});

test('create grant cannot manage everyone; full Admin and manage-all have the intended distinct rights', () => {
  const { rules } = setup();
  assert.deepEqual(rules.imeiAccess({ permission: 'admin' }), { canView: true, canCreate: true, canCancelOwn: true, canManageAll: true });
  assert.deepEqual(rules.imeiAccess({ permission: 'mod', actions: ['imei-create'] }), { canView: true, canCreate: true, canCancelOwn: false, canManageAll: false });
  assert.deepEqual(rules.imeiAccess({ permission: 'mod', modules: ['imei'] }), { canView: true, canCreate: false, canCancelOwn: false, canManageAll: false });
  assert.deepEqual(rules.imeiAccess({ permission: 'mod', actions: ['imei-manage-all'] }), { canView: true, canCreate: false, canCancelOwn: false, canManageAll: true });
});

test('general page settings exclude the private register and pricing snapshot at the database query', async () => {
  const ctx = setup();
  await ctx.store.generateImei('samsung', crypto.randomUUID(), ctx.actor);
  ctx.rows.push({ key: 'HOME_CMS_MAY_MOI_PUBLISHED', value: '1' }, { key: 'TRADEIN_PUBLIC_SNAPSHOT_V1', value: 'large-price-data' });
  const settings = await ctx.load('lib/system-store.ts').getSystemSettings();
  assert.equal(settings.HOME_CMS_MAY_MOI_PUBLISHED, '1');
  assert.equal(settings.TRADEIN_PUBLIC_SNAPSHOT_V1, undefined);
  assert.ok(Object.keys(settings).every(key => !key.startsWith('IMEI_V1_')));
  const options = ctx.reads.at(-1);
  assert.ok(query(ctx.rows, options).every(row => !row.key.startsWith('IMEI_V1_')));
});
