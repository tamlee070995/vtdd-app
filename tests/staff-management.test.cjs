const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const {matches,query} = require('./helpers/postgrest-fake.cjs');
process.env.AUTH_SESSION_SECRET = 'isolated-staff-management-test-secret';

function setup() {
  const data = [
    { ma_nv: '001', staff_name: 'Admin A', permission: 'admin', status: 'Active', source_row: '2', password_hash: 'secret' },
    { ma_nv: '002', staff_name: 'Admin B', permission: ' ADMIN ', status: 'Active', source_row: '3' },
    { ma_nv: '003', staff_name: 'Mod', permission: 'Moderator', status: 'Active', source_row: '4' },
    { ma_nv: '004', staff_name: 'Nhân viên', permission: '', status: 'Standby', source_row: '5' },
  ];
  let actor = { maNV: '001', permission: 'admin', name: 'Admin A', modules: [] };
  let authorized = true, afterRead = null, failCode = '', conflict = false;
  const deletedCalls = [], audit = [], cache = new Map(), reads=[];
  const db = {
    isSupabaseConfigured: () => true,
    eq: value => 'eq.' + encodeURIComponent(value),
    selectAllRows: async (_,options) => {reads.push({all:true,...options});const result = query(data,options); if (afterRead) { afterRead(); afterRead = null; } return result; },
    selectRows: async (_,options) => {reads.push(options);return query(data,options);},
    countRows: async (_,filters) => data.filter(row=>matches(row,filters)).length,
    insertRows: async (_, records) => {
      if (conflict || records.some(row => data.some(old => old.ma_nv === row.ma_nv))) throw new Error('23505 duplicate key');
      data.push(...structuredClone(records)); return records;
    },
    deleteRows: async (_, filters) => {
      const selected = data.filter(row => matches(row, filters));
      deletedCalls.push(selected.map(row=>row.ma_nv));
      if (selected.some(row=>row.ma_nv===failCode)) throw new Error('Unavailable');
      selected.forEach(row => data.splice(data.indexOf(row),1)); return selected;
    },
  };
  const mocks = {
    'server-only': {}, '@/lib/supabase-rest': db,
    '@/lib/admin-auth': { requireAdminApi: async () => authorized ? { admin: actor, response: null } : { admin: null, response: new Response('{}',{status:401}) }, adminHasAction: () => true, normalizeAdminAccess: value => value },
    '@/lib/staff-store': {
      ensureStaffAdminHeaders: async () => {},
      findStaffByMaNV: async code => { const row = data.find(row => row.ma_nv === code); return row ? { maNV:code, permission:row.permission, status:row.status, password:row.password_hash } : null; },
      getAdminStaffPage: async options => ({ staff:[], meta:{page:1,pages:1,total:0,pageSize:50}, options }),
    },
    '@/lib/mail': {}, '@/lib/system-store': { appendAdminAudit: async value => audit.push(value) },
    'googleapis': { google:{} }, '@/lib/sheets': {},
  };
  function load(relative, actualStore = false) {
    const file = path.resolve(__dirname,'..',relative), key = file + actualStore;
    if(cache.has(key))return cache.get(key);
    const source = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const module = {exports:{}};
    new Function('require','module','exports',source)(name => {
      const alias = name.startsWith('.') ? '@/'+path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),name)).replaceAll('\\','/') : name;
      if(Object.hasOwn(mocks,alias) && !(actualStore && alias==='@/lib/staff-store')) return mocks[alias];
      return alias.startsWith('@/') ? load(alias.slice(2)+'.ts',actualStore) : require(alias);
    },module,module.exports);
    cache.set(key,module.exports);return module.exports;
  }
  const management = load('lib/staff-management-store.ts');
  const route = load('app/api/admin/staff/route.ts');
  const request = (body,origin='http://localhost') => new NextRequest('http://localhost/api/admin/staff',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
  return {data,management,route,request,load,audit,reads,deletedCalls,setActor:value=>actor=value,setAuthorized:value=>authorized=value,setConflict:()=>conflict=true,setAfterRead:fn=>afterRead=fn,setFailCode:code=>failCode=code};
}

test('new employee import accepts two columns, Excel paste and reordered quoted CSV, preserves leading zeros', () => {
  const {load} = setup(), parser=load('lib/staff-import.ts');
  assert.deepEqual(parser.parseNewStaffImport('Mã nhân viên\tTên nhân viên\n00123\tNguyễn Văn An'),[{maNV:'00123',staffName:'Nguyễn Văn An',maST:''}]);
  assert.deepEqual(parser.parseNewStaffImport('Tên nhân viên;Mã siêu thị;MANV\n"An; Bình";001;NV00456.0'),[{maNV:'00456',staffName:'An; Bình',maST:'001'}]);
  assert.throws(()=>parser.parseNewStaffImport('Mã nhân viên\n123'),/họ tên/);
  assert.throws(()=>parser.parseNewStaffImport('123,An\n123,Bình'),/trùng/);
  assert.throws(()=>parser.validateNewStaffRows(Array.from({length:201},(_,i)=>({maNV:String(i),staffName:'A'}))),/200/);
  assert.throws(()=>parser.parseNewStaffImport('abc,An'),/mã nhân viên/);
});

test('create one or many skips existing accounts, salts passwords and never accepts elevated rights from client', async () => {
  const ctx=setup(), entries=[{maNV:'001',staffName:'Overwrite'},{maNV:'005',staffName:'An',permission:'admin'},{maNV:'006',staffName:'Bình',maST:'001'}];
  const result=await ctx.management.createManagedStaff(entries,'Temporary!2026','Standby');
  assert.deepEqual(result,{created:['005','006'],skipped:['001']});
  assert.equal(ctx.data[0].staff_name,'Admin A');
  const fresh=ctx.data.slice(4);
  assert.ok(fresh.every(row=>row.permission==='' && row.module_permissions==='' && row.status==='Standby' && row.need_setup==='1' && row.gmail===''));
  assert.notEqual(fresh[0].password_hash,fresh[1].password_hash);
  assert.ok(ctx.load('lib/staff-security.ts').verifyPassword('Temporary!2026',fresh[0].password_hash));
  await assert.rejects(ctx.management.createManagedStaff([{maNV:'007',staffName:'A'}],'123','Active'),/6/);
  ctx.setConflict(); await assert.rejects(ctx.management.createManagedStaff([{maNV:'007',staffName:'A'}],'Temporary!2026','Active'),error=>error.status===409);
  assert.equal(ctx.data.length,6);
});

test('deletion preview normalizes role aliases, excludes current admin, exposes no credentials and deletes only previewed roles', async () => {
  const ctx=setup(), preview=await ctx.management.previewStaffDeletion(['admin','mod'],'001');
  assert.deepEqual(preview.staff.map(row=>row.maNV),['002','003']);assert.equal(preview.skippedSelf,true);
  assert.equal(JSON.stringify(preview).includes('password_hash'),false);
  const result=await ctx.management.deletePreviewedStaff(preview.token,'001');
  assert.deepEqual(result.deleted.sort(),['002','003']);assert.deepEqual(ctx.data.map(row=>row.ma_nv),['001','004']);
  await assert.rejects(ctx.management.deletePreviewedStaff(preview.token,'001'),error=>error.status===409);
});

test('changed staff, tampered tokens, wrong actor and expired preview cannot authorize deletions', async () => {
  const ctx=setup(), preview=await ctx.management.previewStaffDeletion(['user'],'001');
  await assert.rejects(ctx.management.deletePreviewedStaff(preview.token+'x','001'));
  await assert.rejects(ctx.management.deletePreviewedStaff(preview.token,'002'),error=>error.status===409);
  const now=Date.now;try{Date.now=()=>preview.expiresAt+1;await assert.rejects(ctx.management.deletePreviewedStaff(preview.token,'001'),error=>error.status===409);}finally{Date.now=now;}
  ctx.data.push({ma_nv:'005',permission:'',staff_name:'New',status:'Active',source_row:'6'});
  await assert.rejects(ctx.management.deletePreviewedStaff(preview.token,'001'),error=>error.status===409);
  assert.equal(ctx.deletedCalls.length,0);
});

test('conditional deletion protects a row changed after validation and reports a partial backend failure', async () => {
  const ctx=setup();let preview=await ctx.management.previewStaffDeletion(['user'],'001');
  ctx.setAfterRead(()=>ctx.data.find(row=>row.ma_nv==='004').permission='admin');
  const result=await ctx.management.deletePreviewedStaff(preview.token,'001');
  assert.deepEqual(result.deleted,[]);assert.deepEqual(result.skipped,['004']);assert.ok(ctx.data.some(row=>row.ma_nv==='004'));
  preview=await ctx.management.previewStaffDeletion(['mod'],'001');ctx.setFailCode('003');
  const partial=await ctx.management.deletePreviewedStaff(preview.token,'001');assert.deepEqual(partial.failed,['003']);
  assert.ok(ctx.data.some(row=>row.ma_nv==='003'));
});

test('staff API rejects anonymous, cross-site and Mod creation, checks current password before group deletion', async () => {
  const ctx=setup(), body={action:'CREATE_STAFF',staff:[{maNV:'005',staffName:'An'}],temporaryPassword:'Temporary!2026',status:'Standby'};
  ctx.setAuthorized(false);assert.equal((await ctx.route.POST(ctx.request(body))).status,401);ctx.setAuthorized(true);
  assert.equal((await ctx.route.POST(ctx.request(body,'https://foreign.example'))).status,403);
  ctx.setActor({maNV:'003',permission:'mod',modules:['people']});assert.equal((await ctx.route.POST(ctx.request(body))).status,403);
  ctx.setActor({maNV:'001',permission:'admin',modules:[]});
  const response=await ctx.route.POST(ctx.request(body));assert.equal(response.status,200);assert.deepEqual((await response.json()).result.created,['005']);
  assert.equal(JSON.stringify(ctx.audit).includes('Temporary!2026'),false);
  const preview=(await (await ctx.route.POST(ctx.request({action:'PREVIEW_DELETE_STAFF',roles:['user']}))).json()).preview;
  assert.equal((await ctx.route.POST(ctx.request({action:'DELETE_STAFF_GROUP',token:preview.token,adminPassword:'wrong'}))).status,401);
  assert.equal(ctx.deletedCalls.length,0);
  const removed=await ctx.route.POST(ctx.request({action:'DELETE_STAFF_GROUP',token:preview.token,adminPassword:'secret'}));assert.equal(removed.status,200);
  assert.deepEqual((await removed.json()).result.deleted.sort(),['004','005']);assert.ok(ctx.data.some(row=>row.ma_nv==='001'));
});

test('employee list applies role/status/search before pagination and excludes private fields', async () => {
  const ctx=setup(), store=ctx.load('lib/staff-store.ts',true);
  const page=await store.getAdminStaffPage({role:'mod',status:'Active',q:'Mod',page:1,pageSize:50});
  assert.deepEqual(page.staff.map(row=>row.maNV),['003']);assert.equal(page.meta.total,1);
  assert.equal(page.staff[0].password,undefined);assert.equal(page.staff[0].securityAnswer,undefined);
});

test('default list and code searches load only a database page, with correct summary and role filters', async () => {
  const ctx=setup(),store=ctx.load('lib/staff-store.ts',true);
  for(let i=0;i<2100;i++)ctx.data.push({ma_nv:String(900000+i),staff_name:'Test',permission:'',status:'Standby',source_row:String(10+i)});
  const first=await store.getAdminStaffPage({page:1,pageSize:50});assert.equal(first.staff.length,50);assert.equal(first.meta.total,2104);assert.equal(first.meta.pages,43);assert.equal(first.meta.summary.active,3);
  assert.ok(ctx.reads.every(read=>!read.all && read.select && !read.select.includes('password')));
  const admin=await store.getAdminStaffPage({role:'admin',page:1,pageSize:50});assert.deepEqual(admin.staff.map(row=>row.maNV),['001','002']);
  const user=await store.getAdminStaffPage({role:'user',q:'900001',page:1,pageSize:50});assert.deepEqual(user.staff.map(row=>row.maNV),['900001']);
});

test('large role groups use conditional batches while preserving other roles and the acting admin', async () => {
  const ctx=setup();for(let i=0;i<2100;i++)ctx.data.push({ma_nv:String(900000+i),staff_name:'Test',permission:'',status:'Standby',source_row:String(10+i)});
  const preview=await ctx.management.previewStaffDeletion(['user'],'001');assert.equal(preview.count,2101);
  const removed=await ctx.management.deletePreviewedStaff(preview.token,'001');assert.equal(removed.deleted.length,2101);assert.deepEqual(removed.failed,[]);
  assert.equal(ctx.deletedCalls.length,85);assert.deepEqual(ctx.data.map(row=>row.ma_nv),['001','002','003']);
});
