const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
if(!globalThis.crypto)globalThis.crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..');
for(const f of ['src/shared/constants.js','src/shared/utils.js','src/shared/schema.js','src/shared/graph.js','src/shared/geometry.js','src/content/router.js'])vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
const {C,Schema,Graph,Router}=globalThis.ChatGPTNET;
globalThis.ChatGPTNET.StoreRuntime={colorsFor:c=>c.colorOverride||C.COLORS};
const c=Schema.newCanvas('stress-500-360'), ids=[];
let seq=0;
for(let row=0;row<25;row++)for(let col=0;col<20;col++){
  const id=`s${++seq}`,e=Schema.newEntity({kind:'free',text:id,color:C.COLORS[0]});e.entityId=id;c.entities[id]=e;
  c.canvasPlacements[id]={entityId:id,x:40+col*136,y:40+row*132,width:110,height:52,subtreeCollapsed:false};ids.push(id);
}
for(let col=0;col<15;col++)for(let row=0;row<24;row++)Graph.addEdge(c,ids[row*20+col],ids[(row+1)*20+col]);
const t0=performance.now(),valid=Schema.validateCanvasDetailed(c),t1=performance.now();assert.ok(valid.ok,valid.reason);
const routed=Router.routeAll(c),t2=performance.now();assert.ok(routed.ok,'router failed at 500 nodes / 360 relations');
assert.strictEqual(Object.keys(routed.routes).length,360);
for(const path of Object.values(routed.routes))for(let i=0;i<path.length-1;i++)assert.ok(path[i].x===path[i+1].x||path[i].y===path[i+1].y,'diagonal route segment');
console.log(JSON.stringify({nodes:500,relations:360,validateMs:+(t1-t0).toFixed(1),routeMs:+(t2-t1).toFixed(1)}));
console.log('router_stress.test.js: PASS');
