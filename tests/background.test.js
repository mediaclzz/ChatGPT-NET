const fs=require('fs'),vm=require('vm'),assert=require('assert');if(!globalThis.crypto)globalThis.crypto=require('crypto').webcrypto;
const local={},session={};let listener=null;
const area=data=>({async get(key){if(key==null)return structuredClone(data);if(Array.isArray(key))return Object.fromEntries(key.filter(k=>k in data).map(k=>[k,structuredClone(data[k])]));return key in data?{[key]:structuredClone(data[key])}:{};},async set(values){Object.assign(data,structuredClone(values));},async remove(key){for(const k of(Array.isArray(key)?key:[key]))delete data[k];}});
globalThis.browser={storage:{local:area(local),session:area(session)},action:{onClicked:{addListener(){}},async setIcon(){},async setTitle(){}},tabs:{onRemoved:{addListener(){}},onUpdated:{addListener(){}},async sendMessage(){}},runtime:{onMessage:{addListener(fn){listener=fn;}}}};
for(const file of ['src/shared/constants.js','src/shared/utils.js','src/shared/schema.js','background.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
assert.ok(listener);
(async()=>{
  const exported=await listener({type:'EXPORT_ALL'},{});assert.strictEqual(exported.bundle.baseline,'1.5');
  for(const baseline of ['1.3','1.4','1.5']){const result=await listener({type:'IMPORT_BUNDLE',bundle:{product:'ChatGPT NET',baseline,schemaVersion:1,canvases:[]},decisions:{}},{});assert.strictEqual(result.ok,true);}
  const rejected=await listener({type:'IMPORT_BUNDLE',bundle:{product:'ChatGPT NET',baseline:'1.2',schemaVersion:1,canvases:[]},decisions:{}},{});assert.ok(rejected.error);
  console.log('background.test.js: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
