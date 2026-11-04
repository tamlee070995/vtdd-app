function splitTop(value) {
  const result=[]; let start=0, depth=0, quoted=false, escaped=false;
  for(let i=0;i<value.length;i++) {
    const char=value[i];
    if(escaped) { escaped=false; continue; }
    if(quoted && char==='\\') {escaped=true;continue;}
    if(char==='"')quoted=!quoted;
    if(quoted)continue;
    if(char==='(')depth++;if(char===')')depth--;
    if(char===',' && depth===0){result.push(value.slice(start,i));start=i+1;}
  }
  result.push(value.slice(start));return result;
}
function valueOf(raw) {return raw.startsWith('"')?JSON.parse(raw):decodeURIComponent(raw);}
function condition(row,expr) {
  for(const logical of ['and','or'])if(expr.startsWith(logical+'(')){
    const items=splitTop(expr.slice(logical.length+1,-1));
    return logical==='and'?items.every(item=>condition(row,item)):items.some(item=>condition(row,item));
  }
  const separator=expr.indexOf('.'), key=expr.slice(0,separator), term=expr.slice(separator+1);
  return termMatch(row[key],term);
}
function termMatch(value,term) {
  if(term.startsWith('not.'))return !termMatch(value,term.slice(4));
  const dot=term.indexOf('.'),op=term.slice(0,dot),raw=term.slice(dot+1);
  if(op==='is')return raw==='null'?value==null:false;
  if(value==null)return false;
  if(op==='in')return splitTop(raw.slice(1,-1)).map(valueOf).includes(String(value));
  const pattern=valueOf(raw);
  if(op==='eq')return String(value)===pattern;
  if(op==='neq')return String(value)!==pattern;
  if(op==='imatch')return new RegExp(pattern,'i').test(String(value));
  if(op==='like' || op==='ilike')return new RegExp('^'+[...pattern].map(char=>char==='*'||char==='%'?'.*':char==='_'?'.':char.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$',op==='ilike'?'i':'').test(String(value));
  throw new Error('Unsupported fake filter '+term);
}
function matches(row,filters={}) {
  return Object.entries(filters).every(([key,term])=>{
    if(['select','order','limit','offset','on_conflict'].includes(key))return true;
    if(key==='or'||key==='and')return condition(row,key+term);
    return termMatch(row[key],term);
  });
}
function query(data,options={}) {
  let list=data.filter(row=>matches(row,options.filters));
  if(options.order)list.sort((a,b)=>{
    for(const order of options.order.split(',')) {const [key,direction]=order.split('.');const comparison=String(a[key]||'').localeCompare(String(b[key]||''));if(comparison)return direction==='desc'?-comparison:comparison;}
    return 0;
  });
  list=list.slice(options.offset||0,options.limit===undefined?undefined:(options.offset||0)+options.limit);
  return structuredClone(list.map(row=>options.select && options.select!=='*'?Object.fromEntries(options.select.split(',').map(key=>[key,row[key]??null])):row));
}
module.exports={matches,query};
