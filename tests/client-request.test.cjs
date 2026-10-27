const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const m = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/client-request.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, m, m.exports);
const { requestJson, clientErrorMessage } = m.exports;
test('network failures have a Vietnamese explanation and do not automatically repeat writes', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); };
  try {
    await assert.rejects(requestJson('/api/test', { method: 'POST' }), error => /Không kết nối/.test(clientErrorMessage(error)));
    assert.equal(calls, 1);
  } finally { global.fetch = original; }
});
test('timeouts and caller cancellation abort the active request', async () => {
  const original = global.fetch;
  global.fetch = (_, init) => new Promise((resolve, reject) => {
    if (init.signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  try {
    await assert.rejects(requestJson('/slow', {}, 10), error => /quá lâu/.test(clientErrorMessage(error)));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(requestJson('/cancel', { signal: controller.signal }), error => error.name === 'AbortError');
  } finally { global.fetch = original; }
});
test('failed API responses and invalid JSON never report success', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => new Response(JSON.stringify({ success: false, message: 'Không có quyền.' }), { status: 403 });
    await assert.rejects(requestJson('/denied'), /Không có quyền/);
    global.fetch = async () => new Response('<html>Error</html>', { status: 502 });
    await assert.rejects(requestJson('/bad-json'), /chưa trả về kết quả/);
  } finally { global.fetch = original; }
});
