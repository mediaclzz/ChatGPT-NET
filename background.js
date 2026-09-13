const C={PREFIX:'chatgpt-net:v1:',CANVAS:'chatgpt-net:v1:canvas:',GLOBAL:'chatgpt-net:v1:global',SCHEMA:1,BASELINE:'1.5',IMPORT_BASELINES:new Set(['1.3','1.4','1.5'])};
const tabEnabled=new Map(),locks=new Map();
function withLock(k,fn){const prev=locks.get(k)||Promise.resolve(),next=prev.catch(()=>{}).then(fn);locks.set(k,next);next.finally(()=>{if(locks.get(k)===next)locks.delete(k);}).catch(()=>{});return next;}
function withLocks(keys,fn){const ks=[...new Set(keys)].sort();const run=i=>i>=ks.length?fn():withLock(ks[i],()=>run(i+1));return run(0);}
const DEFAULT_GLOBAL={schemaVersion:1,colorSlots:['#C9D5E6','#C9D9C5','#E7DBB9'],sidebarWidth:420,memoRatio:.25};
const sessionKey=id=>`chatgpt-net:tab:${id}`;
async function getTabEnabled(id){if(tabEnabled.has(id))return tabEnabled.get(id);try{const o=await browser.storage.session.get(sessionKey(id));const v=o[sessionKey(id)];if(typeof v==='boolean'){tabEnabled.set(id,v);return v;}}catch{}tabEnabled.set(id,true);return true;}
async function setTabEnabled(id,on){tabEnabled.set(id,on);try{await browser.storage.session.set({[sessionKey(id)]:on});}catch{}}
async function clearTabEnabled(id){tabEnabled.delete(id);try{await browser.storage.session.remove(sessionKey(id));}catch{}}
const icon=async(tabId,on)=>{try{await browser.action.setIcon({tabId,path:{32:on?'icons/net-on.svg':'icons/net-off.svg'}});await browser.action.setTitle({tabId,title:on?'ChatGPT NET':'ChatGPT NET（已关闭）'});}catch{}};
browser.action.onClicked.addListener(async tab=>{if(tab.id==null)return;const on=!(await getTabEnabled(tab.id));await setTabEnabled(tab.id,on);await icon(tab.id,on);try{await browser.tabs.sendMessage(tab.id,{type:'TAB_ENABLED',enabled:on});}catch{}});
browser.tabs.onRemoved.addListener(id=>{clearTabEnabled(id);});
browser.tabs.onUpdated.addListener(async(id,info)=>{if(info.status==='loading'||info.status==='complete')await icon(id,await getTabEnabled(id));});
function normalizeGlobal(g){const out=structuredClone(g||DEFAULT_GLOBAL);out.schemaVersion=1;out.colorSlots=Array.isArray(out.colorSlots)?out.colorSlots.slice(0,3):[...DEFAULT_GLOBAL.colorSlots];while(out.colorSlots.length<3)out.colorSlots.push(DEFAULT_GLOBAL.colorSlots[out.colorSlots.length]);return out;}
function normalizeCanvas(c){if(!c)return null;const out=structuredClone(c);if(Array.isArray(out.colorOverride)){out.colorOverride=out.colorOverride.slice(0,3);while(out.colorOverride.length<3)out.colorOverride.push(DEFAULT_GLOBAL.colorSlots[out.colorOverride.length]);}if(out.view){out.view.activeColorSlot=Math.max(0,Math.min(2,Number(out.view.activeColorSlot)||0));delete out.view.collapsed;}return out;}
async function getGlobal(){const o=await browser.storage.local.get(C.GLOBAL),g=normalizeGlobal(o[C.GLOBAL]||DEFAULT_GLOBAL);return validGlobal(g)?g:structuredClone(DEFAULT_GLOBAL);}
async function allCanvases(){const o=await browser.storage.local.get(null),out=[];for(const[k,v]of Object.entries(o))if(k.startsWith(C.CANVAS)&&v?.schemaVersion===C.SCHEMA){const c=normalizeCanvas(v);if(validCanvas(c))out.push(c);}return out;}
function key(id){return C.CANVAS+id;}
const SharedSchema=globalThis.ChatGPTNET?.Schema;
function validGlobal(g){return !!SharedSchema?.validateGlobal(g);}
function validCanvas(c){return !!SharedSchema?.validateCanvas(c);}
browser.runtime.onMessage.addListener(async(msg,sender)=>{
  try{
    const tabId=sender.tab?.id;
    switch(msg?.type){
      case 'GET_TAB_STATE': return {enabled:tabId==null?true:await getTabEnabled(tabId)};
      case 'GET_GLOBAL': return {global:await getGlobal()};
      case 'SAVE_GLOBAL': {const g=msg.global;if(!validGlobal(g))throw new Error('Invalid global settings');await browser.storage.local.set({[C.GLOBAL]:g});return{global:g};}
      case 'GET_CANVAS': {const o=await browser.storage.local.get(key(msg.conversationId));return{canvas:normalizeCanvas(o[key(msg.conversationId)]||null)};}
      case 'SAVE_CANVAS': {
        const c=structuredClone(msg.canvas);if(!validCanvas(c))throw new Error('Invalid canvas');
        const k=key(c.conversationId),expected=msg.expectedRevision;
        return await withLock(k,async()=>{const o=await browser.storage.local.get(k),cur=o[k]||null;if(cur){if(expected!==cur.revision)return{error:'revision conflict',code:'CONFLICT',currentRevision:cur.revision};}else if(expected!==null&&expected!==0)return{error:'revision conflict',code:'CONFLICT',currentRevision:null};c.revision=(cur?.revision||0)+1;c.modifiedAt=Date.now();await browser.storage.local.set({[k]:c});return{canvas:c};});
      }
      case 'DELETE_CANVAS': await browser.storage.local.remove(key(msg.conversationId));return{ok:true};
      case 'EXPORT_ALL': return {bundle:{product:'ChatGPT NET',baseline:C.BASELINE,schemaVersion:1,exportedAt:new Date().toISOString(),global:await getGlobal(),canvases:await allCanvases()}};
      case 'IMPORT_BUNDLE': {
        const b=msg.bundle;if(!b||b.product!=='ChatGPT NET'||!C.IMPORT_BASELINES.has(b.baseline)||b.schemaVersion!==1||!Array.isArray(b.canvases)||!b.canvases.every(validCanvas)|| (b.global&&!validGlobal(b.global)))throw new Error('Unsupported or invalid backup format');
        const seen=new Set();for(const c of b.canvases){if(seen.has(c.conversationId))throw new Error('Duplicate conversation in backup');seen.add(c.conversationId);}
        const importIds=b.canvases.filter(c=>(msg.decisions?.[c.conversationId]?.choice||msg.decisions?.[c.conversationId])==='imported').map(c=>c.conversationId),keys=importIds.map(key);
        return await withLocks(keys,async()=>{const current=await browser.storage.local.get(keys),writes={};if(b.global?.schemaVersion===1&&msg.decisions?.__global==='imported')writes[C.GLOBAL]=b.global;for(const c0 of b.canvases){const d=msg.decisions?.[c0.conversationId],choice=d?.choice||d||'imported';if(choice!=='imported')continue;const k=key(c0.conversationId),cur=current[k]||null,expected=d&&typeof d==='object'?d.expectedRevision:(cur?.revision??null);if((cur?.revision??null)!==expected)return{error:'revision conflict during import',code:'CONFLICT'};const c=structuredClone(c0);c.revision=(cur?.revision||0)+1;c.modifiedAt=Date.now();writes[k]=c;}await browser.storage.local.set(writes);return{ok:true};});
      }
      default:return null;
    }
  }catch(e){return{error:e?.message||String(e),code:e?.code||'ERROR'};}
});
