const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function setup() {
  const rows = new Map([['TRADEIN_PUBLIC_SNAPSHOT_V1',{updated_at_text:'2026-10-25T09:00:00.000Z',value:'BIG PRIVATE SNAPSHOT'}]]);
  const reads = [];
  const mocks = {
    'server-only': {},
    './supabase-rest': {
      isSupabaseConfigured:()=>true,
      selectRows:async(_,options)=>{reads.push(options);const row=rows.get(options.filters.key.slice(3));return row?[structuredClone(row)]:[];},
      insertRows:async(_,items)=>{if(rows.has(items[0].key))throw new Error('23505 duplicate');rows.set(items[0].key,structuredClone(items[0]));return items;},
      updateRows:async(_,filters,item)=>{const old=rows.get(item.key);if(!old||!filters.value.includes(JSON.parse(old.value).revision))return[];rows.set(item.key,structuredClone(item));return[item];},
    },
  };
  const cache=new Map();
  function load(file) {
    if(cache.has(file))return cache.get(file);
    const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const m={exports:{}};
    const localRequire=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);
    new Function('require','module','exports',source)(localRequire,m,m.exports);cache.set(file,m.exports);return m.exports;
  }
  return {rows,reads,control:load(path.resolve(__dirname,'../lib/tradein-control.ts')),store:load(path.resolve(__dirname,'../lib/tradein-control-store.ts'))};
}
test('lock and reopen use revisions and preserve the independent price snapshot',async()=>{
  const {rows,store}=setup();const snapshot=rows.get('TRADEIN_PUBLIC_SNAPSHOT_V1').value;
  const initial=await store.getTradeinAccess();assert.equal(initial.locked,false);
  const locked=await store.writeTradeinAccess({revision:initial.revision,locked:true,message:'Đang cập nhật giá.'},'Admin');
  assert.equal((await store.getPublicTradeinStatus()).locked,true);
  await assert.rejects(store.writeTradeinAccess({revision:initial.revision,locked:false,message:'X'},'Other'),e=>e.status===409);
  const open=await store.writeTradeinAccess({revision:locked.revision,locked:false,message:locked.message},'Admin');
  assert.equal(open.locked,false);assert.equal(rows.get('TRADEIN_PUBLIC_SNAPSHOT_V1').value,snapshot);
});
test('status polls request only snapshot metadata and never expose private settings or full prices',async()=>{
  const {store,reads}=setup();const status=await store.getPublicTradeinStatus();
  assert.deepEqual(status,{locked:false,message:'',priceUpdatedAt:'2026-10-25T09:00:00.000Z'});
  assert.equal(reads.find(q=>q.filters.key.includes('SNAPSHOT')).select,'updated_at_text');
  assert.ok(!JSON.stringify(status).includes('PRIVATE'));
  assert.deepEqual(Object.keys(status).sort(),['locked','message','priceUpdatedAt']);
});
test('invalid maintenance input is rejected before any write',async()=>{
  const {store}=setup();
  for(const payload of [{locked:'true',message:'X'},{locked:true,message:''},{locked:true,message:'x'.repeat(301)}]) {
    await assert.rejects(store.writeTradeinAccess({revision:'initial',...payload},'Admin'),e=>e.status===400);
    assert.equal((await store.getTradeinAccess()).revision,'initial');
  }
});
test('a new price timestamp or reopening prompts reload, while a lock takes priority',()=>{
  const {control}=setup();const open={locked:false,message:'',priceUpdatedAt:'old'};
  assert.equal(control.tradeinRefreshReason(null,open,''),null);
  assert.equal(control.tradeinRefreshReason(open,open,'old'),null);
  assert.equal(control.tradeinRefreshReason(open,{...open,priceUpdatedAt:'new'},'old'),'prices');
  assert.equal(control.tradeinRefreshReason(open,{...open,locked:true,priceUpdatedAt:'new'},'old'),null);
  assert.equal(control.tradeinRefreshReason({...open,locked:true},open,''),'reopened');
  assert.equal(control.TRADEIN_RELOAD_SECONDS,7);
});

test('scheduled locking and reopening use server time without writes or an open administrator page',()=>{
  const {control}=setup();
  const access={revision:'x',locked:false,message:'Đang sửa giá.',schedule:{lockAt:'2030-01-01T02:00:00.000Z',reopenAt:'2030-01-01T03:00:00.000Z'}};
  const at=time=>control.effectiveTradeinAccess(access,Date.parse(time)).locked;
  assert.equal(at('2030-01-01T01:59:59Z'),false);
  assert.equal(at('2030-01-01T02:00:00Z'),true);
  assert.equal(at('2030-01-01T02:59:59Z'),true);
  assert.equal(at('2030-01-01T03:00:00Z'),false);
  assert.equal(access.locked,false);
  assert.equal(control.effectiveTradeinAccess({...access,locked:true,schedule:{lockAt:null,reopenAt:access.schedule.reopenAt}},Date.parse('2030-01-01T03:00:00Z')).locked,false);
  assert.equal(control.effectiveTradeinAccess({...access,schedule:{lockAt:access.schedule.lockAt,reopenAt:null}},Date.parse('2031-01-01T00:00:00Z')).locked,true);
});

test('schedule validation rejects past, malformed and inverted dates and uses Viet Nam time',()=>{
  const {control}=setup();const now=Date.parse('2030-01-01T00:00:00Z');
  for(const payload of [{lockAt:'bad',reopenAt:null},{lockAt:1,reopenAt:null},{lockAt:'2029-12-31T23:59:00Z',reopenAt:null},{lockAt:'2030-01-01T03:00:00Z',reopenAt:'2030-01-01T02:00:00Z'}])
    assert.throws(()=>control.normalizeTradeinSchedule(payload,now),e=>e.status===400);
  assert.deepEqual(control.normalizeTradeinSchedule({lockAt:null,reopenAt:null},now),{lockAt:null,reopenAt:null});
  assert.equal(control.tradeinScheduleIso('2030-01-01T09:00'),'2030-01-01T02:00:00.000Z');
  assert.equal(control.tradeinScheduleInput('2030-01-01T02:00:00.000Z'),'2030-01-01T09:00');
});

test('schedule changes preserve prices, enforce revision checks, and manual overrides cancel the schedule',async()=>{
  const {rows,store}=setup();const snapshot=structuredClone(rows.get('TRADEIN_PUBLIC_SNAPSHOT_V1'));
  const scheduled=await store.writeTradeinAccess({action:'SET_SCHEDULE',revision:'initial',message:'Đang sửa giá.',lockAt:'2099-01-01T02:00:00.000Z',reopenAt:'2099-01-01T03:00:00.000Z'},'Admin');
  assert.equal((await store.getPublicTradeinStatus()).locked,false);
  await assert.rejects(store.writeTradeinAccess({action:'SET_SCHEDULE',revision:'initial',message:'X',lockAt:null,reopenAt:null},'Admin'),e=>e.status===409);
  const updated=await store.writeTradeinAccess({revision:scheduled.revision,locked:false,message:'Thông báo mới',keepSchedule:true},'Admin');
  assert.deepEqual(updated.schedule,scheduled.schedule);
  const manual=await store.writeTradeinAccess({revision:updated.revision,locked:true,message:'Thông báo mới'},'Admin');
  assert.equal(manual.locked,true);assert.equal(manual.schedule,undefined);
  const again=await store.writeTradeinAccess({action:'SET_SCHEDULE',revision:manual.revision,message:'X',lockAt:null,reopenAt:'2099-01-01T03:00:00.000Z'},'Admin');
  const cancelled=await store.writeTradeinAccess({action:'SET_SCHEDULE',revision:again.revision,message:'X',lockAt:null,reopenAt:null},'Admin');
  assert.equal(cancelled.locked,true);assert.equal(cancelled.schedule,undefined);
  assert.deepEqual(rows.get('TRADEIN_PUBLIC_SNAPSHOT_V1'),snapshot);
});
