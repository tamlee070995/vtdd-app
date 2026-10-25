const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadSource(file) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const localRequire = name => name.startsWith('.') ? loadSource(path.resolve(path.dirname(file), name + '.ts')) : require(name);
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const content = loadSource(path.resolve(__dirname, '../lib/demo-content.ts'));
const { defaultDemoBrands, emptyDemoGuide, changeDemoBrand, normalizeDemoGuide, hasDemoContent, demoGuideHtml, demoVideoEmbed, demoUrl } = content;
const edit = (brand, action, guide, extra = {}) => changeDemoBrand(brand, { action, revision: brand.revision, guide, ...extra }, 'rev-' + Math.random(), '2026-10-25T00:00:00Z');

test('four initial brands expose no fabricated instructions', () => {
  assert.deepEqual(defaultDemoBrands().map(b => b.slug), ['oppo','vivo','realme','honor']);
  assert.ok(defaultDemoBrands().every(b => b.visible && b.published && !hasDemoContent(b.published)));
});
test('saving a draft never changes the published guide; publishing copies a snapshot', () => {
  const initial = defaultDemoBrands()[0];
  const guide = { ...initial.draft, name: 'OPPO mới', body: '<h2>Bước 1</h2><p>Hướng dẫn đã kiểm tra.</p>' };
  const draft = edit(initial, 'SAVE_DRAFT', guide);
  assert.equal(draft.published.name, 'OPPO');
  assert.equal(draft.published.body, '');
  const published = edit(draft, 'PUBLISH', draft.draft);
  assert.equal(published.published.name, 'OPPO mới');
  assert.equal(published.slug, 'oppo');
  published.draft.body = 'Changed later';
  assert.equal(published.published.body, guide.body);
});
test('hiding and unpublishing preserve drafts for later reuse', () => {
  const initial = defaultDemoBrands()[1];
  const hidden = edit(initial, 'SET_VISIBILITY', undefined, { visible: false });
  assert.equal(hidden.visible, false);
  assert.deepEqual(hidden.draft, initial.draft);
  const unpublished = edit(hidden, 'UNPUBLISH');
  assert.equal(unpublished.published, null);
  assert.deepEqual(unpublished.draft, initial.draft);
});
test('stale edits are rejected instead of overwriting another editor', () => {
  const initial = defaultDemoBrands()[0];
  const changed = edit(initial, 'SAVE_DRAFT', initial.draft);
  assert.throws(() => changeDemoBrand(changed, { action: 'PUBLISH', revision: initial.revision, guide: initial.draft }, 'another', ''), error => error.status === 409);
});
test('HTML and unsafe URLs cannot become executable page content', () => {
  const guide = normalizeDemoGuide({ ...emptyDemoGuide('Test'), body: '<script>alert(1)</script><p onclick="x()">OK</p><img src="https://example.com/a.jpg" onerror="alert(1)">' });
  assert.ok(!guide.body.includes('script'));
  assert.ok(!guide.body.includes('onclick'));
  assert.ok(!guide.body.includes('onerror'));
  for (const url of ['javascript:alert(1)', 'data:text/html,foo', '//evil.example/x', '/\\evil.example/x', 'https://user:pass@example.com/a']) {
    assert.throws(() => demoUrl(url));
  }
  assert.throws(() => normalizeDemoGuide({ ...emptyDemoGuide('Test'), images:[{url:'javascript:alert(1)',label:'x'}] }));
});
test('disabled sections do not render or count as available guidance', () => {
  const guide = { ...emptyDemoGuide('Test'), body:'<img src="https://example.com/a.jpg">', images:[{url:'https://example.com/b.jpg',label:''}], features:{text:true,images:false,video:false,files:false} };
  assert.ok(!demoGuideHtml(guide).includes('<img'));
  assert.equal(hasDemoContent(guide), false);
  guide.body = '<p>Text remains</p><img src="https://example.com/a.jpg">';
  assert.ok(demoGuideHtml(guide).includes('Text remains'));
  assert.equal(hasDemoContent(guide), true);
});
test('only supported video links are embedded', () => {
  assert.equal(demoVideoEmbed('https://youtu.be/abcdefghijk'), 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(demoVideoEmbed('https://vimeo.com/1234567'), 'https://player.vimeo.com/video/1234567');
  assert.equal(demoVideoEmbed('https://youtube.com.evil.example/watch?v=abcdefghijk'), '');
  assert.equal(demoVideoEmbed('not-a-url'), '');
  assert.throws(() => normalizeDemoGuide({ ...emptyDemoGuide('Test'), videoUrl:'https://example.com/page' }));
});
test('invalid publication, oversized lists, and invalid order are rejected', () => {
  assert.throws(() => normalizeDemoGuide({ ...emptyDemoGuide(''), title:'' }));
  assert.throws(() => normalizeDemoGuide({ ...emptyDemoGuide('Test'), images:Array(21).fill({url:'https://example.com/a.jpg'}) }));
  assert.throws(() => normalizeDemoGuide({ ...emptyDemoGuide('Test'), body:'<img src="blob:unsaved">' }));
  assert.throws(() => edit(defaultDemoBrands()[0], 'SET_ORDER', undefined, { order:-1 }));
});

test('origin validation works behind a reverse proxy and rejects cross-site writes', () => {
  const { isSameOriginRequest } = loadSource(path.resolve(__dirname, '../lib/request-origin.ts'));
  const req = (origin, host, proto='https') => ({url:'http://localhost:3000/api/admin/demo',headers:new Headers({origin,host,'x-forwarded-proto':proto})});
  assert.equal(isSameOriginRequest(req('https://vienthongdidong.com','vienthongdidong.com')),true);
  assert.equal(isSameOriginRequest(req('http://127.0.0.1:3010','127.0.0.1:3010','http')),true);
  assert.equal(isSameOriginRequest(req('https://other.example','vienthongdidong.com')),false);
  assert.equal(isSameOriginRequest(req('null','vienthongdidong.com')),false);
  assert.equal(isSameOriginRequest(req('http://vienthongdidong.com','vienthongdidong.com')),false);
});
