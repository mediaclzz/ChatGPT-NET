import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const firefox=process.env.CHATGPT_NET_FIREFOX;
if(!firefox)throw new Error('Set CHATGPT_NET_FIREFOX to your Firefox executable before running this integration test.');
const driver=process.env.CHATGPT_NET_GECKODRIVER||resolve(root,'output','geckodriver','geckodriver.exe');
const xpi=process.env.CHATGPT_NET_XPI||resolve(root,'dist','ChatGPT-NET-1.5.0.xpi');
const output=resolve(root,'output','firefox');
const port=Number(process.env.CHATGPT_NET_WEBDRIVER_PORT||4545),base=`http://127.0.0.1:${port}`;
mkdirSync(output,{recursive:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(path,method='GET',body){
  const response=await fetch(base+path,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>({}));if(!response.ok||json.value?.error)throw new Error(`${method} ${path}: ${json.value?.message||response.status}`);return json.value;
}
async function waitFor(fn,timeout=12000,interval=120){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(e){last=e;}await sleep(interval);}throw last||new Error('Timed out');}
async function execute(script,args=[]){return request(`/session/${session}/execute/sync`,'POST',{script,args});}
async function elements(selector){return request(`/session/${session}/elements`,'POST',{using:'css selector',value:selector});}
const elementId=e=>e['element-6066-11e4-a52e-4f735466cecf'];
const nodeSelector=id=>`.cgn-node[data-id="${id}"]`;
async function click(selector,index=0){const found=await waitFor(async()=>{const all=await elements(selector);return all[index];});await request(`/session/${session}/element/${elementId(found)}/click`,'POST',{});}
async function doubleClick(selector){const found=(await elements(selector))[0];if(!found)throw new Error(`Missing double-click target: ${selector}`);await request(`/session/${session}/actions`,'POST',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:found,x:0,y:0},{type:'pointerDown',button:0},{type:'pointerUp',button:0},{type:'pause',duration:80},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});await sleep(350);}
async function drag(fromSelector,toSelector,fromIndex=0,toIndex=0,x=0,y=0){
  const from=(await elements(fromSelector))[fromIndex],to=(await elements(toSelector))[toIndex];if(!from||!to)throw new Error(`Missing drag endpoint: ${fromSelector} -> ${toSelector}`);
  await request(`/session/${session}/actions`,'POST',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:from,x:0,y:0},{type:'pointerDown',button:0},{type:'pause',duration:80},{type:'pointerMove',duration:420,origin:to,x,y},{type:'pause',duration:80},{type:'pointerUp',button:0}]}]});await sleep(450);
}
async function dragBy(selector,index,dx,dy){
  const from=(await elements(selector))[index];if(!from)throw new Error(`Missing drag source: ${selector}[${index}]`);
  await request(`/session/${session}/actions`,'POST',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:from,x:0,y:0},{type:'pointerDown',button:0},{type:'pause',duration:80},{type:'pointerMove',duration:420,origin:'pointer',x:dx,y:dy},{type:'pause',duration:80},{type:'pointerUp',button:0}]}]});await sleep(450);
}
async function dragPoints(from,to){
  await request(`/session/${session}/actions`,'POST',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:'viewport',x:Math.round(from.x+from.w/2),y:Math.round(from.y+from.h/2)},{type:'pointerDown',button:0},{type:'pause',duration:100},{type:'pointerMove',duration:480,origin:'viewport',x:Math.round(to.x+to.w/2),y:Math.round(to.y+to.h/2)},{type:'pause',duration:120},{type:'pointerUp',button:0}]}]});await sleep(500);
}
async function pressEscape(){await request(`/session/${session}/actions`,'POST',{actions:[{type:'key',id:'keyboard',actions:[{type:'keyDown',value:'\uE00C'},{type:'keyUp',value:'\uE00C'}]}]});await sleep(80);}
async function shortcut(...keys){await request(`/session/${session}/actions`,'POST',{actions:[{type:'key',id:'keyboard',actions:[...keys.map(value=>({type:'keyDown',value})),...keys.reverse().map(value=>({type:'keyUp',value}))]}]});await sleep(450);}
async function state(){return execute(`return (()=>{const nodes=[...document.querySelectorAll('.cgn-node')].map(n=>{const r=n.getBoundingClientRect();return{id:n.dataset.id,x:r.x,y:r.y,w:r.width,h:r.height,wx:parseFloat(n.style.left),wy:parseFloat(n.style.top),ww:parseFloat(n.style.width),wh:parseFloat(n.style.height)}}),edges=[...document.querySelectorAll('.cgn-edge')].map(e=>({id:e.dataset.edgeId,points:e.getAttribute('points')}));return{nodes,edges,memo:document.querySelectorAll('.cgn-memo-item[data-id]').length,toasts:[...document.querySelectorAll('.cgn-toast')].map(x=>x.textContent),sidebar:!!document.querySelector('.cgn-sidebar')};})()`);}
async function addFree(count=1){for(let i=0;i<count;i++){await click(`.cgn-btn[title="自由节点"]`);await execute('document.activeElement?.blur()');await pressEscape();await sleep(120);}}
function durable(value){return JSON.stringify({nodes:value.nodes.map(n=>({id:n.id,x:n.wx,y:n.wy,w:n.ww,h:n.wh})).sort((a,b)=>a.id.localeCompare(b.id)),edges:value.edges.map(e=>e.id).sort(),memo:value.memo});}
function processSnapshot(pid){const command=`$p=Get-Process -Id ${pid} -ErrorAction Stop; [pscustomobject]@{Cpu=$p.CPU;WorkingSet=$p.WorkingSet64;PrivateMemory=$p.PrivateMemorySize64;Threads=$p.Threads.Count}|ConvertTo-Json -Compress`;const out=spawnSync('powershell',['-NoProfile','-Command',command],{encoding:'utf8'});return out.status===0?JSON.parse(out.stdout.trim()):null;}

const logPath=resolve(output,'geckodriver.log'),log=[];
const service=spawn(driver,['--port',String(port),'--log','info'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
service.stdout.on('data',b=>log.push(b));service.stderr.on('data',b=>log.push(b));
let session=null,firefoxPid=null;
try{
  await waitFor(()=>request('/status').then(v=>v.ready),12000);
  const created=await request('/session','POST',{capabilities:{alwaysMatch:{browserName:'firefox',pageLoadStrategy:'eager',acceptInsecureCerts:true,'moz:firefoxOptions':{binary:firefox,args:['-headless'],prefs:{'browser.shell.checkDefaultBrowser':false,'browser.startup.homepage_override.mstone':'ignore','dom.webnotifications.enabled':false}}}}});
  session=created.sessionId||created.capabilities?.sessionId;const capabilities=created.capabilities||created;firefoxPid=capabilities['moz:processID']||null;if(!session)throw new Error(`No WebDriver session: ${JSON.stringify(created)}`);
  await request(`/session/${session}/moz/addon/install`,'POST',{path:xpi,temporary:true});
  await request(`/session/${session}/url`,'POST',{url:'https://chatgpt.com/'});
  await waitFor(()=>execute("return document.readyState==='interactive'||document.readyState==='complete'"),30000);
  await execute("history.replaceState({},'', '/c/cgn-firefox-acceptance');window.dispatchEvent(new PopStateEvent('popstate'));return location.href;");
  await waitFor(()=>elements('.cgn-sidebar').then(x=>x.length===1),18000);
  await waitFor(()=>elements('.cgn-btn[title="自由节点"]:not(:disabled)').then(x=>x.length===1),18000);

  const initial=processSnapshot(firefoxPid);
  await addFree(2);let current=await state();if(current.nodes.length!==2)throw new Error(`Expected two nodes: ${JSON.stringify(current)}`);
  const isolatedBefore=current,isolatedId=current.nodes[0].id;await dragBy(nodeSelector(isolatedId),0,48,24);current=await state();const isolatedAfter=current.nodes.find(n=>n.id===isolatedId),isolatedPeer=current.nodes.find(n=>n.id!==isolatedId),oldPeer=isolatedBefore.nodes.find(n=>n.id===isolatedPeer.id);if(isolatedAfter.wx===isolatedBefore.nodes[0].wx&&isolatedAfter.wy===isolatedBefore.nodes[0].wy)throw new Error('Isolated node position intent was ignored');if(isolatedPeer.wx!==oldPeer.wx||isolatedPeer.wy!==oldPeer.wy)throw new Error('Isolated move displaced another node');
  const preRelationSnapshot=durable(current);await drag('.cgn-node','.cgn-node',0,1);current=await state();if(current.edges.length!==1)throw new Error(`Relation not created: ${JSON.stringify(current)}`);
  const [parent,child]=current.edges[0].id.split('=>'),byId=Object.fromEntries(current.nodes.map(n=>[n.id,n]));if(!(byId[parent].wy+byId[parent].wh<byId[child].wy))throw new Error('Relation did not auto-arrange top-down');
  const arrangedSnapshot=durable(current);await shortcut('\uE009','z');current=await waitFor(async()=>{const value=await state();return durable(value)===preRelationSnapshot?value:null;},5000);await shortcut('\uE009','\uE008','z');current=await waitFor(async()=>{const value=await state();return durable(value)===arrangedSnapshot?value:null;},5000);

  const beforeRigid=current,rootIndex=current.nodes.findIndex(n=>n.id===parent);await dragBy('.cgn-node',rootIndex,90,45);current=await state();const old=Object.fromEntries(beforeRigid.nodes.map(n=>[n.id,n])),now=Object.fromEntries(current.nodes.map(n=>[n.id,n])),rootDx=Math.round(now[parent].wx-old[parent].wx),rootDy=Math.round(now[parent].wy-old[parent].wy);if(Math.round(now[child].wx-old[child].wx)!==rootDx||Math.round(now[child].wy-old[child].wy)!==rootDy)throw new Error('Independent subtree did not move rigidly');

  await addFree(1);await doubleClick('.cgn-btn[title^="双击恢复"]');current=await state();let secondParent=current.nodes.find(n=>n.id!==parent&&n.id!==child);await dragPoints(current.nodes.find(n=>n.id===child),secondParent);current=await state();if(current.edges.length!==2)throw new Error(`Legal second parent was not added: ${JSON.stringify(current)}`);
  secondParent=current.nodes.find(n=>n.id===secondParent.id);const conflictBefore=JSON.stringify({nodes:current.nodes,edges:current.edges});await dragPoints(current.nodes.find(n=>n.id===parent),secondParent);current=await state();if(JSON.stringify({nodes:current.nodes,edges:current.edges})!==conflictBefore||!current.toasts.some(x=>x.includes('多个上游节点')))throw new Error('Related co-parent relation was not atomically rejected');

  const parentsBefore=Object.fromEntries(current.nodes.filter(n=>n.id!==child).map(n=>[n.id,n])),childBefore=current.nodes.find(n=>n.id===child);await dragBy(nodeSelector(child),0,54,0);current=await state();const childAfter=current.nodes.find(n=>n.id===child);if(childAfter.wx===childBefore.wx&&childAfter.wy===childBefore.wy)throw new Error('Legal connected-node position intent was ignored');for(const [id,p] of Object.entries(parentsBefore)){const q=current.nodes.find(n=>n.id===id);if(q.wx!==p.wx||q.wy!==p.wy)throw new Error('Connected-node movement rearranged an unrelated hierarchy member');}

  const canvasIds=current.nodes.map(n=>n.id).sort(),canvasCoords=JSON.stringify(current.nodes.map(n=>({id:n.id,x:n.wx,y:n.wy})).sort((a,b)=>a.id.localeCompare(b.id)));for(const url of ['/g/project-a/c/cgn-firefox-acceptance','/g/project-b/c/cgn-firefox-acceptance','/c/cgn-firefox-acceptance']){await execute(`history.replaceState({},'', arguments[0]);window.dispatchEvent(new PopStateEvent('popstate'));`,[url]);await sleep(850);const moved=await state();if(moved.nodes.map(n=>n.id).sort().join('|')!==canvasIds.join('|')||JSON.stringify(moved.nodes.map(n=>({id:n.id,x:n.wx,y:n.wy})).sort((a,b)=>a.id.localeCompare(b.id)))!==canvasCoords)throw new Error(`Project move changed the canvas at ${url}`);}

  await drag(nodeSelector(parent),'.cgn-memo');current=await state();if(current.memo!==1||current.nodes.length!==2)throw new Error(`Canvas-to-memo conversion failed: ${JSON.stringify(current)}`);await execute(`const source=document.querySelector('.cgn-memo-item[data-id]'),target=document.querySelector('.cgn-canvas-wrap'),r=target.getBoundingClientRect(),data=new DataTransfer(),event=(type,node)=>node.dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:data,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));event('dragstart',source);event('dragenter',target);event('dragover',target);event('drop',target);event('dragend',source);return [...data.types];`);await sleep(650);current=await state();if(current.memo!==0||current.nodes.length!==3)throw new Error(`Memo-to-canvas return failed: ${JSON.stringify(current)}`);

  await execute("const host=document.createElement('div');host.id='cgn-scroll-host';host.style.cssText='position:fixed;left:0;top:0;width:120px;height:300px;overflow:auto';host.innerHTML='<div style=height:3000px></div>';document.body.append(host);host.scrollTop=240;return host.scrollTop;");
  const canvas=(await elements('.cgn-canvas-wrap'))[0];await request(`/session/${session}/actions`,'POST',{actions:[{type:'wheel',id:'wheel',actions:[{type:'scroll',duration:220,origin:canvas,x:0,y:0,deltaX:0,deltaY:540}]}]});await sleep(180);if(await execute("return document.querySelector('#cgn-scroll-host').scrollTop")!==240)throw new Error('Canvas wheel leaked into page scrolling');

  const screenshot=await request(`/session/${session}/screenshot`,'GET');writeFileSync(resolve(output,'firefox-1.5-extension.png'),Buffer.from(screenshot,'base64'));
  await sleep(2500);const busy=processSnapshot(firefoxPid);await sleep(5000);const idle=processSnapshot(firefoxPid),cpuDelta=busy&&idle?Math.max(0,idle.Cpu-busy.Cpu):null;if(cpuDelta!=null&&cpuDelta>1.5)throw new Error(`Firefox consumed ${cpuDelta.toFixed(2)} CPU seconds while idle`);
  const result={firefox:capabilities.browserVersion,geckodriver:basename(driver),extension:basename(xpi),nodes:current.nodes.length,relations:current.edges.length,rigidSubtree:{dx:rootDx,dy:rootDy},projectPaths:3,scrollIsolation:true,resources:{initial,busy,idle,idleCpuSeconds:cpuDelta}};writeFileSync(resolve(output,'firefox-1.5-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({firefox_extension_integration:'PASS',...result}));
}finally{
  if(session)await request(`/session/${session}`,'DELETE').catch(()=>{});service.kill();writeFileSync(logPath,Buffer.concat(log).toString('utf8'));
}
