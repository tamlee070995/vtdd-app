const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');

process.env.AUTH_SESSION_SECRET = 'isolated-admin-setup-test-secret';
process.env.FIELD_ENCRYPTION_KEY = 'isolated-admin-setup-encryption-key';

function setup(permission = 'mod') {
  let staff;
  let unavailable = false;
  let writes = 0;
  const jar = new Map();
  const cache = new Map();
  const mocks = {
    'next/headers': { cookies: async () => ({ get: name => jar.has(name) ? { value: jar.get(name) } : undefined }) },
    'next/navigation': { redirect: url => { throw new Error(`REDIRECT:${url}`); } },
    '@/lib/mail': { sendAdminLoginFailedAlertMail: async () => { throw new Error('Unexpected email'); } },
    '@/lib/staff-store': {
      findStaffByMaNV: async code => { if (unavailable) throw new Error('Unavailable'); return code === staff.maNV ? staff : null; },
      ensureStaffAdminHeaders: async () => {},
      updateStaffSecurity: async (_, data) => {
        writes++;
        Object.assign(staff, { password: data.passwordHash, securityQuestion: data.encryptedQuestion, securityAnswer: data.answerHash, gmail: data.encryptedGmail, needSetup: data.needSetup });
      },
    },
  };
  function load(relative) {
    const file = path.resolve(__dirname, '..', relative);
    if (cache.has(file)) return cache.get(file);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const m = { exports: {} };
    new Function('require', 'module', 'exports', source)(name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), m, m.exports);
    cache.set(file, m.exports);
    return m.exports;
  }
  const security = load('lib/staff-security.ts');
  staff = { rowNumber: 2, maNV: '999991', maST: '001', staffName: 'Test', status: 'Active', permission, modulePermissions: 'demo', needSetup: '0', password: security.hashPassword('Complete!2026'), gmail: security.encryptText('test@gmail.com'), securityQuestion: security.encryptText('Question'), securityAnswer: security.hashPassword('Answer') };
  const auth = load('lib/admin-auth.ts');
  const staffAuth = load('lib/staff-auth.ts');
  const session = load('lib/auth-session.ts');
  jar.set(auth.ADMIN_COOKIE, session.createSignedSessionToken('admin', staff.maNV, 3600, { permission, modules: 'demo', name: 'Test' }));
  jar.set(staffAuth.STAFF_SESSION_COOKIE, session.createSignedSessionToken('staff', staff.maNV, 3600));
  const request = (url, body) => new NextRequest('http://localhost' + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') }, body: JSON.stringify(body) });
  return { staff, auth, staffAuth, security, load, request, setUnavailable: () => { unavailable = true; }, writes: () => writes };
}

for (const permission of ['mod', 'admin']) {
  test(`${permission}: NEED_SETUP alone blocks existing sessions and direct admin API access`, async () => {
    const { staff, auth } = setup(permission);
    assert.ok(await auth.requireAdminPage());
    staff.needSetup = '1';
    assert.equal((await auth.getCurrentAdmin()).forceSetup, true);
    await assert.rejects(auth.requireAdminPage(), /REDIRECT:\/admin\/setup/);
    const blocked = await auth.requireAdminApi();
    assert.equal(blocked.response.status, 403);
    assert.equal((await blocked.response.json()).code, 'STAFF_SETUP_REQUIRED');
  });

  test(`${permission}: reset login directs to setup, incomplete updates fail, valid setup restores access`, async () => {
    const ctx = setup(permission);
    Object.assign(ctx.staff, { password: ctx.security.hashPassword('123123'), gmail: '', securityQuestion: '', securityAnswer: '', needSetup: '1' });
    const login = await ctx.load('app/api/auth/admin-login/route.ts').POST(ctx.request('/api/auth/admin-login', { maNV: ctx.staff.maNV, password: '123123' }));
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.equal(loginBody.redirectTo, '/admin/setup');
    assert.equal(loginBody.forceSetup, true);
    assert.equal((await ctx.auth.getCurrentAdmin()).mustChangePassword, true);
    const update = ctx.load('app/api/staff/update-security/route.ts').POST;
    const fields = { currentPassword: '123123', gmail: 'new@gmail.com', question: 'New question', answer: 'New answer' };
    assert.equal((await update(ctx.request('/api/staff/update-security', fields))).status, 400);
    assert.equal(ctx.writes(), 0);
    const passwords = { newPassword: 'New!2026', confirmPassword: 'New!2026' };
    assert.equal((await update(ctx.request('/api/staff/update-security', { ...fields, ...passwords, answer: '' }))).status, 400);
    assert.equal((await update(ctx.request('/api/staff/update-security', { ...fields, ...passwords, currentPassword: 'Wrong' }))).status, 401);
    assert.equal(ctx.writes(), 0);
    const saved = await update(ctx.request('/api/staff/update-security', { ...fields, ...passwords }));
    assert.equal(saved.status, 200);
    assert.equal(ctx.staff.needSetup, '0');
    assert.ok(ctx.security.verifyPassword('New!2026', ctx.staff.password));
    assert.equal(ctx.security.verifyPassword('123123', ctx.staff.password), false);
    assert.equal((await ctx.auth.getCurrentAdmin()).forceSetup, false);
    assert.equal((await ctx.auth.requireAdminApi()).response, null);
    assert.ok(await ctx.auth.requireAdminPage());
  });
}

test('missing security and legacy/default passwords also require setup without the flag', () => {
  const { staff, staffAuth, security } = setup();
  assert.equal(staffAuth.shouldForceStaffSetup(staff, '', ''), false);
  for (const key of ['gmail', 'securityQuestion', 'securityAnswer']) {
    assert.equal(staffAuth.shouldForceStaffSetup({ ...staff, [key]: '' }, '', ''), true);
  }
  for (const password of ['123123', 'Legacy!2026', security.hashPassword('123123')]) {
    assert.equal(staffAuth.shouldForceStaffSetup({ ...staff, password }, '', ''), true);
  }
});

test('an unavailable source cannot use stale signed permissions to bypass a reset', async () => {
  const ctx = setup();
  ctx.setUnavailable();
  assert.equal(await ctx.auth.getCurrentAdmin(), null);
  assert.equal((await ctx.auth.requireAdminApi()).response.status, 401);
});

test('completed login goes straight to admin and revoked roles cannot reuse an old session', async () => {
  const ctx = setup();
  const login = await ctx.load('app/api/auth/admin-login/route.ts').POST(ctx.request('/api/auth/admin-login', { maNV: ctx.staff.maNV, password: 'Complete!2026' }));
  assert.equal((await login.json()).redirectTo, '/admin');
  ctx.staff.permission = '';
  assert.equal(await ctx.auth.getCurrentAdmin(), null);
});
