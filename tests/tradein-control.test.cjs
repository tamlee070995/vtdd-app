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
