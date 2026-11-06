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
  let authenticated = true, dropReply = false, offline = false, time = null, stopBeforeClaim = false, beforeUpdate = null;
  class ClockDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(time ?? Date.now()); }
    static now() { return time ?? Date.now(); }
  }
  const pause = () => new Promise(resolve => setImmediate(resolve));
  const db = {
    isSupabaseConfigured: () => true,
    selectRows: async (_, options) => { await pause(); if (offline) throw new Error('offline'); reads.push(options); return query(rows, options); },
    selectAllRows: async (_, options) => { reads.push(options); return query(rows, options); },
    countRows: async (_, filters) => { await pause(); return rows.filter(row => matches(row, filters)).length; },
    insertRows: async (_, records) => {
      await pause();
      if (stopBeforeClaim && records.some(row => row.key.startsWith('IMEI_V1_CODE_'))) { stopBeforeClaim = false; throw new Error('Interrupted before claim'); }
      if (records.some(record => rows.some(row => row.key === record.key))) throw new Error('23505 duplicate key');
      rows.push(...structuredClone(records));
      if (dropReply && records.some(row => row.key.startsWith('IMEI_V1_CODE_'))) { dropReply = false; throw new Error('Lost response after commit'); }
      return structuredClone(records);
    },
    updateRows: async (_, filters, patch) => {
      await pause();
      if (beforeUpdate) { const callback = beforeUpdate; beforeUpdate = null; callback(); }
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
    new Function('require', 'module', 'exports', 'Date', source)(name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), m, m.exports, ClockDate);
    cache.set(file, m.exports); return m.exports;
  }
  const store = load('lib/imei-store.ts'), rules = load('lib/imei.ts'), route = load('app/api/admin/imei/route.ts');
  const request = (body, origin = 'http://localhost') => new NextRequest('http://localhost/api/admin/imei', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify({recipient:"NV009",storeCode:"001",...body}) });
  return { rows, reads, store, rules, route, request, actor, load, setActor: value => { actor = value; }, unauthorized: () => { authenticated = false; }, loseResponse: () => { dropReply = true; }, offline: () => { offline = true; }, setTime: value => { time = value; }, stopBeforeClaim: () => { stopBeforeClaim = true; }, beforeUpdate: callback => { beforeUpdate = callback; } };
}
const own = { canCancelOwn: true, canManageAll: false };
const all = { canCancelOwn: true, canManageAll: true };
const rejectStatus = status => error => error.status === status;

test('brand locking is a separate child grant: manage-all alone and orphan child grants cannot change locks', async () => {
  const ctx = setup(), locks = ctx.load('app/api/admin/imei/brand-locks/route.ts');
  const request = (body, origin = 'http://localhost') => new NextRequest('http://localhost/api/admin/imei/brand-locks', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });
  const command = { revision: 'initial', lockedBrands: ['samsung'] };
  for (const actions of [['imei-manage-all'], ['imei-brand-lock'], ['imei-create'], ['imei-report']]) {
    ctx.setActor({ ...ctx.actor, permission: 'mod', modules: ['imei'], actions });
    assert.equal(ctx.rules.imeiAccess({permission:'mod',actions}).canManageBrandLocks, false);
    assert.equal((await locks.POST(request(command))).status, 403);
  }
  ctx.setActor({ ...ctx.actor, permission: 'mod', actions: ['imei-manage-all','imei-brand-lock'] });
  assert.equal((await locks.POST(request(command, 'https://wrong.test'))).status, 403);
  const response = await locks.POST(request(command));
  assert.equal(response.status, 200);
  const policy = (await response.json()).policy;
  assert.deepEqual(policy.lockedBrands, ['samsung']);
  assert.equal(policy.updatedBy, ctx.actor.maNV);
  // Revoking just the child permission takes effect on the next authenticated request.
  ctx.setActor({ ...ctx.actor, permission: 'mod', actions: ['imei-manage-all'] });
  assert.equal((await locks.POST(request({ revision: policy.revision, lockedBrands: [] }))).status, 403);
  const read = await locks.GET(new NextRequest('http://localhost/api/admin/imei/brand-locks'));
  assert.match(read.headers.get('Cache-Control'), /no-store/);
  assert.deepEqual((await read.json()).policy.lockedBrands, ['samsung']);
});

test('multiple locked brands reject direct API creation including Admin, while old issues remain recoverable and cancellation stays available', async () => {
  const ctx = setup(), locks = ctx.load('lib/imei-brand-lock-store.ts');
  const issued = await ctx.store.generateImei('samsung', crypto.randomUUID(), ctx.actor);
  ctx.stopBeforeClaim();
  const pending = crypto.randomUUID();
  await assert.rejects(ctx.store.generateImei('apple-13-plus', pending, ctx.actor), /Interrupted/);
  const policy = await locks.writeImeiBrandLocks({revision:'initial',lockedBrands:['samsung','apple-13-plus']}, ctx.actor.maNV);
  for (const brand of ['samsung', 'apple-13-plus']) {
    const response = await ctx.route.POST(ctx.request({action:'GENERATE',brand,requestId:crypto.randomUUID()}));
    assert.equal(response.status,403);assert.equal((await response.json()).code,'IMEI_BRAND_LOCKED');
  }
  await assert.rejects(ctx.store.generateImei('apple-13-plus', pending, ctx.actor), error => error.code === 'IMEI_BRAND_LOCKED');
  assert.equal((await ctx.store.generateImei('samsung', issued.requestId, ctx.actor)).imei, issued.imei);
  assert.equal((await ctx.store.cancelImei({requestId:issued.requestId,actor:issued.actor,reason:'Hủy sau khi khóa hãng'},ctx.actor,all)).status,'cancelled');
  assert.equal((await ctx.store.generateImei('xiaomi',crypto.randomUUID(),ctx.actor)).status,'active');
  const page = await ctx.route.GET(new NextRequest('http://localhost/api/admin/imei'));
  assert.deepEqual((await page.json()).policy.lockedBrands,['samsung','apple-13-plus']);
  await locks.writeImeiBrandLocks({revision:policy.revision,lockedBrands:[]},ctx.actor.maNV);
  assert.equal((await ctx.store.generateImei('apple-13-plus',pending,ctx.actor)).status,'active');
});

test('concurrent lock edits cannot overwrite each other; malformed or unavailable policy cannot open generation', async () => {
  const ctx = setup(), locks = ctx.load('lib/imei-brand-lock-store.ts');
  const edits = await Promise.allSettled([
    locks.writeImeiBrandLocks({revision:'initial',lockedBrands:['samsung']},'001'),
    locks.writeImeiBrandLocks({revision:'initial',lockedBrands:['xiaomi']},'002'),
  ]);
  assert.equal(edits.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(edits.find(result=>result.status==='rejected').reason.status,409);
  const previous = await locks.getImeiBrandLocks();
  await assert.rejects(locks.writeImeiBrandLocks({revision:previous.revision,lockedBrands:['bad']},'001'),rejectStatus(400));
  const results = await Promise.allSettled([
    locks.writeImeiBrandLocks({revision:previous.revision,lockedBrands:[]},'001'),
    locks.writeImeiBrandLocks({revision:previous.revision,lockedBrands:['other']},'002'),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  ctx.rows.find(row=>row.key==='IMEI_V1_BRAND_LOCKS').value='{}';
  await assert.rejects(ctx.store.generateImei('samsung',crypto.randomUUID(),ctx.actor),rejectStatus(503));
  assert.equal(ctx.rows.filter(row=>row.type==='IMEI_REQUEST').length,0);
  ctx.offline();
  assert.equal((await ctx.route.POST(ctx.request({action:'GENERATE',brand:'xiaomi',requestId:crypto.randomUUID()}))).status,503);
});

test('Luhn matches an independent known vector; all brands preserve exact prefixes and 15 decimal digits', async () => {
  const ctx = setup();
  assert.equal(ctx.rules.completeImei('49015420323751'), '490154203237518');
  assert.equal(ctx.rules.validImei('490154203237519'), false);
  for (const [brand, prefix] of [['samsung', '35399'], ['xiaomi', '86799'], ['other', '00123']]) {
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
  assert.deepEqual(rules.imeiAccess({ permission: 'admin' }), { canView: true, canCreate: true, canCancelOwn: true, canManageAll: true, canReport: true, canManageBrandLocks: true });
  assert.deepEqual(rules.imeiAccess({ permission: 'mod', actions: ['imei-create'] }), { canView: true, canCreate: true, canCancelOwn: false, canManageAll: false, canReport: false, canManageBrandLocks: false });
  assert.deepEqual(rules.imeiAccess({ permission: 'mod', modules: ['imei'] }), { canView: true, canCreate: false, canCancelOwn: false, canManageAll: false, canReport: false, canManageBrandLocks: false });
  assert.deepEqual(rules.imeiAccess({ permission: 'mod', actions: ['imei-manage-all'] }), { canView: true, canCreate: false, canCancelOwn: false, canManageAll: true, canReport: true, canManageBrandLocks: false });
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

test('own cancellation stops at exactly two minutes; only manage-all bypasses the deadline on the API', async () => {
  const start = Date.parse('2026-11-04T00:00:00Z');
  for (const elapsed of [119999, 120000, 120001]) {
    const ctx = setup(); ctx.setTime(start);
    ctx.setActor({ ...ctx.actor, permission: 'mod', actions: ['imei-cancel-own'] });
    const item = await ctx.store.generateImei('samsung', crypto.randomUUID(), ctx.actor);
    ctx.setTime(start + elapsed);
    const command = { action: 'CANCEL', requestId: item.requestId, actor: item.actor, reason: 'Thử hạn giờ', createdAt: new Date(start + elapsed).toISOString(), serverTime: start };
    const result = await ctx.route.POST(ctx.request(command));
    assert.equal(result.status, elapsed < 120000 ? 200 : 403);
    if (elapsed >= 120000) {
      const error = await result.json();
      assert.equal(error.code, 'IMEI_CANCEL_EXPIRED');
      assert.equal(error.message, 'Cần Hủy Mã Liên Hệ Quản Lý: 37804 - Lê Thanh Sang');
      assert.equal((await ctx.store.listImei(item.actor, false, 1, '')).items[0].status, 'active');
      ctx.setActor({ maNV: '456', name: 'Quản lý', permission: 'mod', actions: ['imei-manage-all'] });
      assert.equal((await ctx.route.POST(ctx.request(command))).status, 200);
    }
  }
});

test('time starts at allocation, not an interrupted plan; every reissue receives its own two-minute window', async () => {
  const ctx = setup(), start = Date.parse('2026-11-04T01:00:00Z'), id = crypto.randomUUID();
  ctx.setTime(start); ctx.stopBeforeClaim();
  await assert.rejects(ctx.store.generateImei('xiaomi', id, ctx.actor), /Interrupted before claim/);
  ctx.setTime(start + 20 * 60000);
  const first = await ctx.store.generateImei('xiaomi', id, ctx.actor);
  assert.equal(Date.parse(first.createdAt), start + 20 * 60000);
  const cancel = { requestId: id, actor: first.actor, reason: 'Thử cấp lại' };
  await ctx.store.cancelImei(cancel, ctx.actor, own);
  ctx.setTime(start + 40 * 60000);
  const second = await ctx.store.generateImei('xiaomi', crypto.randomUUID(), ctx.actor);
  assert.equal(second.imei, first.imei);
  assert.equal(Date.parse(second.createdAt), start + 40 * 60000);
  ctx.setTime(start + 41 * 60000);
  assert.equal(ctx.rules.canCancelImei(second, ctx.actor.maNV, own, start + 41 * 60000), true);
  assert.equal((await ctx.store.cancelImei(cancel, ctx.actor, own)).status, 'cancelled');
  assert.equal((await ctx.store.listImei(first.actor, false, 1, '')).items.find(item => item.requestId === second.requestId).status, 'active');
  ctx.setTime(start + 42 * 60000);
  await assert.rejects(ctx.store.cancelImei({ ...cancel, requestId: second.requestId }, ctx.actor, own), error => error.code === 'IMEI_CANCEL_EXPIRED');
});

test('server rechecks expiry after a failed CAS rather than allowing a request that began before the deadline', async () => {
  const ctx = setup(), start = Date.parse('2026-11-04T02:00:00Z'); ctx.setTime(start);
  const item = await ctx.store.generateImei('samsung', crypto.randomUUID(), ctx.actor);
  ctx.setTime(start + 119999);
  ctx.beforeUpdate(() => {
    const row = ctx.rows.find(row => row.type === 'IMEI_ACTIVE');
    row.value = JSON.stringify({ ...JSON.parse(row.value), revision: crypto.randomUUID() });
    ctx.setTime(start + 120000);
  });
  await assert.rejects(ctx.store.cancelImei({ requestId: item.requestId, actor: item.actor, reason: 'Thử cạnh tranh' }, ctx.actor, own), error => error.code === 'IMEI_CANCEL_EXPIRED');
  assert.equal((await ctx.store.listImei(item.actor, false, 1, '')).items[0].status, 'active');
});

test('shared cancellation rules fail closed for invalid times, future dates and missing ownership/rights', () => {
  const { rules } = setup(), start = Date.parse('2026-11-04T03:00:00Z');
  const item = { actor: '00123', status: 'active', createdAt: new Date(start).toISOString() };
  assert.equal(rules.canCancelImei(item, item.actor, own, start), true);
  assert.equal(rules.canCancelImei(item, item.actor, own, start - 1), false);
  assert.equal(rules.canCancelImei(item, '456', own, start), false);
  assert.equal(rules.canCancelImei({ ...item, createdAt: 'bad' }, item.actor, own, start), false);
  assert.equal(rules.canCancelImei({ ...item, status: 'cancelled' }, item.actor, all, start), false);
  assert.equal(rules.canCancelImei(item, '456', { canCancelOwn: false, canManageAll: true }, start + 6000000), true);
});

test('Apple serials use the confirmed 11/13 lengths, SWAP prefix and uppercase letters/digits excluding O/I', async () => {
  const ctx = setup(), codes = new Set();
  for (const [brand, length] of [['apple-13-plus', 11], ['apple-other', 13]]) {
    for (let index = 0; index < 120; index++) {
      const item = await ctx.store.generateImei(brand, crypto.randomUUID(), ctx.actor);
      assert.equal(item.status, 'active'); assert.equal(item.imei.length, length);
      assert.match(item.imei, /^SWAP[0-9A-HJ-NP-Z]+$/); assert.doesNotMatch(item.imei, /[OI]/);
      assert.equal(ctx.rules.validImeiCode(brand, item.imei), true);
      assert.equal(ctx.rules.validImei(item.imei), false);
      assert.equal(codes.has(item.imei), false); codes.add(item.imei);
    }
  }
  assert.deepEqual(Object.keys(ctx.rules.IMEI_BRANDS), ['samsung', 'xiaomi', 'apple-13-plus', 'apple-other', 'other']);
  assert.equal(ctx.rules.IMEI_BRANDS.other, 'Hãng còn lại');
  assert.equal(ctx.rules.validImeiCode('apple-13-plus', 'S99ABCDEFGH'), true);
  assert.equal(ctx.rules.validImeiCode('apple-other', 'S99ABCDEFGH12'), true);
  assert.equal(ctx.rules.validImeiCode('apple-13-plus', 'SWAPABCDEFG'), true);
  assert.equal(ctx.rules.validImeiCode('apple-other', 'SWAPABCDEFG12'), true);
  assert.equal(ctx.rules.validImeiCode('apple-13-plus', 'S99ABCDEFGI'), false);
  assert.equal(ctx.rules.validImeiCode('apple-13-plus', 'S99ABCDEFGO'), false);
  assert.equal(ctx.rules.validImeiCode('apple-13-plus', 'S99abcdefgh'), false);
  assert.equal(ctx.rules.validImeiCode('apple-other', 'S99ABCDEFGH'), false);
});

test('Apple retries allocate once, search accepts lowercase, history stays scoped, and reissues keep the correct length', async () => {
  const ctx = setup(), id = crypto.randomUUID();
  const results = await Promise.all(Array.from({ length: 8 }, () => ctx.store.generateImei('apple-13-plus', id, ctx.actor)));
  assert.equal(new Set(results.map(item => item.imei)).size, 1);
  const first = results[0];
  assert.equal((await ctx.store.listImei(first.actor, false, 1, first.imei.toLowerCase())).total, 1);
  assert.equal((await ctx.store.listImei('456', false, 1, first.imei)).total, 0);
  await ctx.store.cancelImei({ requestId: id, actor: first.actor, reason: 'Thử cấp lại SN' }, ctx.actor, own);
  const longer = await ctx.store.generateImei('apple-other', crypto.randomUUID(), ctx.actor);
  assert.equal(longer.imei.length, 13); assert.notEqual(longer.imei, first.imei);
  const reused = await ctx.store.generateImei('apple-13-plus', crypto.randomUUID(), ctx.actor);
  assert.equal(reused.imei, first.imei);
  assert.equal((await ctx.store.generateImei('apple-13-plus', id, ctx.actor)).status, 'cancelled');
  const history = await ctx.store.listImei(first.actor, false, 1, first.imei);
  assert.equal(history.total, 2); assert.equal(history.items.filter(item => item.status === 'active').length, 1);
  await assert.rejects(ctx.store.listImei(first.actor, false, 1, 'S99ABCDO123'), rejectStatus(400));
});

test('Apple serials enforce the same two-minute cancellation deadline and manager override', async () => {
  const ctx = setup(), start = Date.parse('2026-11-04T04:00:00Z'); ctx.setTime(start);
  const item = await ctx.store.generateImei('apple-other', crypto.randomUUID(), ctx.actor);
  const command = { requestId: item.requestId, actor: item.actor, reason: 'Hủy SN thử' };
  ctx.setTime(start + 120000);
  await assert.rejects(ctx.store.cancelImei(command, ctx.actor, own), error => error.code === 'IMEI_CANCEL_EXPIRED' && error.message === 'Cần Hủy Mã Liên Hệ Quản Lý: 37804 - Lê Thanh Sang');
  assert.equal((await ctx.store.cancelImei(command, { maNV: '456', name: 'Quản lý' }, { canCancelOwn: false, canManageAll: true })).status, 'cancelled');
});

test('legacy Xiaomi issued codes remain recoverable, while new and unfinished requests use the new prefix', async () => {
  const ctx = setup(), id = crypto.randomUUID(), createdAt = new Date().toISOString();
  const legacy = ctx.rules.completeImei('86712345678901');
  const plan = { revision: crypto.randomUUID(), requestId: id, imei: legacy, brand: 'xiaomi', prefix: '867', actor: ctx.actor.maNV, actorName: ctx.actor.name, createdAt };
  const setting = (key, value, type) => ({ key, value: JSON.stringify(value), type, updated_at_text: createdAt, updated_by: ctx.actor.maNV });
  ctx.rows.push(setting(`IMEI_V1_REQUEST_${ctx.actor.maNV}_${id}`, plan, 'IMEI_REQUEST'));
  ctx.rows.push(setting('IMEI_V1_CODE_' + legacy, { revision: crypto.randomUUID(), imei: legacy, events: [{ requestId: id, actor: ctx.actor.maNV, createdAt }] }, 'IMEI_ACTIVE'));
  assert.equal((await ctx.store.generateImei('xiaomi', id, ctx.actor)).imei, legacy);
  await ctx.store.cancelImei({ requestId: id, actor: ctx.actor.maNV, reason: 'Hủy mã cũ thử' }, ctx.actor, own);
  assert.equal((await ctx.store.listImei(ctx.actor.maNV, false, 1, legacy)).items[0].status, 'cancelled');
  const pending = crypto.randomUUID();
  ctx.rows.push(setting(`IMEI_V1_REQUEST_${ctx.actor.maNV}_${pending}`, { ...plan, requestId: pending }, 'IMEI_REQUEST'));
  await assert.rejects(ctx.store.generateImei('xiaomi', pending, ctx.actor), error => error.code === 'IMEI_RULE_CHANGED');
  assert.equal((await ctx.store.generateImei('xiaomi', crypto.randomUUID(), ctx.actor)).imei.startsWith('86799'), true);
});

 test('recipient is stored per issue and report filters retain leading zeros without granting cancellation',async()=>{
 const ctx=setup();const first=await ctx.store.generateImei('samsung',crypto.randomUUID(),ctx.actor,{recipient:'NV009',storeCode:'001'});
 assert.equal(first.recipient,'NV009');assert.equal(first.storeCode,'001');
 await assert.rejects(ctx.store.generateImei('xiaomi',crypto.randomUUID(),ctx.actor,{recipient:'',storeCode:'001'}),e=>e.status===400);
 await ctx.store.generateImei('xiaomi',crypto.randomUUID(),ctx.actor,{recipient:'NV010',storeCode:'002'});
 const report=ctx.load('lib/imei-report.ts');
 assert.equal((await report.imeiReport('',true,{store:'001',employee:'nv009',brand:'samsung',status:'active'})).length,1);
 await ctx.store.cancelImei({requestId:first.requestId,actor:first.actor,reason:'Thử'},ctx.actor,all);
 assert.equal((await report.imeiReport('',true,{store:'001',status:'cancelled'})).length,1);
 assert.equal((await report.imeiReport(first.actor,false,{store:'001'})).length,0);
 const rights=ctx.rules.imeiAccess({permission:'mod',actions:['imei-report']});assert.equal(rights.canReport,true);assert.equal(rights.canManageAll,false);assert.equal(rights.canCreate,false);
 });
