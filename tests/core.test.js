const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
if(!globalThis.crypto)globalThis.crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..');
for(const f of ['src/shared/constants.js','src/shared/utils.js','src/shared/schema.js','src/shared/graph.js','src/shared/geometry.js','src/content/router.js'])vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
const {C,Schema,Graph,Router,U}=globalThis.ChatGPTNET;
assert.strictEqual(Schema.exportBundle([],Schema.defaultGlobal()).baseline,'1.5','new backups must identify Functional Baseline 1.5');
globalThis.ChatGPTNET.StoreRuntime={colorsFor:c=>c.colorOverride||C.COLORS};
let seq=0;
function add(c,x,y,w=140,h=60,kind='free',anchor=null){const id=`n${++seq}`,e=Schema.newEntity({kind,text:id,originalText:kind==='anchor'?id:'',anchor,color:C.COLORS[0]});e.entityId=id;c.entities[id]=e;c.canvasPlacements[id]={entityId:id,x,y,width:w,height:h,subtreeCollapsed:false};return id;}
function rel(c,p,ch){Graph.addEdge(c,p,ch);}
function orthogonal(routes){for(const p of Object.values(routes))for(let i=0;i<p.length-1;i++)assert.ok(p[i].x===p[i+1].x||p[i].y===p[i+1].y,'route contains diagonal segment');}

// Multi-parent DAG, cycles, collapse rule and exact routing.
{
 const c=Schema.newCanvas('conv-core');
 const p=add(c,500,200),a=add(c,280,560),b=add(c,720,560),x=add(c,500,900);
 rel(c,p,a);rel(c,p,b);rel(c,a,x);
 assert.strictEqual(Graph.parentsOf(c,a).length,1);
 rel(c,b,x);assert.strictEqual(Graph.parentsOf(c,x).length,2);
 assert.strictEqual(Graph.canCollapse(c,a),false);
 assert.strictEqual(Graph.wouldCycle(c,x,p),true);
 const rr=Router.routeAll(c);assert.strictEqual(rr.ok,true);orthogonal(rr.routes);
 assert.strictEqual(Schema.validateCanvas(c),true,Schema.validateCanvasDetailed(c).reason);
 const bad=structuredClone(c);Graph.addEdge(bad,x,p);assert.strictEqual(Schema.validateCanvas(bad),false);
}

// Co-parents may be unrelated or peers, but never ancestors/descendants of each other.
{
 const valid=Schema.newCanvas('parent-independence-valid'),root=add(valid,500,80),a=add(valid,300,300),b=add(valid,700,300),child=add(valid,500,620);rel(valid,root,a);rel(valid,root,b);rel(valid,a,child);
 assert.strictEqual(Graph.canAdd(valid,b,child),true);rel(valid,b,child);assert.ok(Schema.validateCanvas(valid),Schema.validateCanvasDetailed(valid).reason);
 assert.strictEqual(Graph.parentHierarchyConflictAfterAdd(valid,a,b),true);assert.strictEqual(Graph.canAdd(valid,a,b),false,'co-parents must not later become ancestor/descendant');
 const invalid=Schema.newCanvas('parent-independence-invalid'),up=add(invalid,200,80),down=add(invalid,200,320),shared=add(invalid,500,600);rel(invalid,up,down);rel(invalid,down,shared);
 assert.strictEqual(Graph.parentHierarchyConflictAfterAdd(invalid,up,shared),true);assert.strictEqual(Graph.canAdd(invalid,up,shared),false);
 rel(invalid,up,shared);assert.strictEqual(Schema.validateCanvas(invalid),false);assert.match(Schema.validateCanvasDetailed(invalid).reason,/multi-parent hierarchy conflict/);
}

// Clear organization-chart geometry uses a real shared trunk and stable routing preserves unrelated edges.
{
 const c=Schema.newCanvas('route-stability'),p=add(c,500,100),a=add(c,280,420),b=add(c,720,420),p2=add(c,1200,120),c2=add(c,1200,460),free=add(c,1800,900);rel(c,p,a);rel(c,p,b);rel(c,p2,c2);
 const first=Router.routeAll(c);assert.ok(first.ok);const ea=Graph.edgeId(p,a),eb=Graph.edgeId(p,b),other=Graph.edgeId(p2,c2),pa=first.routes[ea],pb=first.routes[eb];
 assert.deepStrictEqual(pa[0],pb[0]);assert.deepStrictEqual(pa[1],pb[1]);assert.ok(Router.sharedTrunkAt(c,first.routes,ea,{x:(pa[0].x+pa[1].x)/2,y:(pa[0].y+pa[1].y)/2},2));assert.ok(pa.length<=4&&pb.length<=4);
  const oldOther=structuredClone(first.routes[other]);c.canvasPlacements[free].x+=100;let next=Router.routeAll(c,[],first.routes);assert.ok(next.ok);assert.deepStrictEqual(next.routes,first.routes,'moving an unrelated free node must preserve every legal route');
  assert.strictEqual(Router.routesClearOfNodes(c,[free],first.routes),true,'an isolated node clear of existing lines needs no reroute');
  c.canvasPlacements[free].x=pa[0].x-20;c.canvasPlacements[free].y=(pa[0].y+pa[1].y)/2-20;assert.strictEqual(Router.routesClearOfNodes(c,[free],first.routes),false,'an isolated node may not cover an existing relation line');
  c.canvasPlacements[free].x=1900;c.canvasPlacements[free].y=900;
  c.canvasPlacements[a].x-=60;next=Router.routeAll(c,[],next.routes);assert.ok(next.ok);assert.deepStrictEqual(next.routes[other],oldOther,'moving one component must not reroute another component');
}

// Shared-trunk hit detection distinguishes true collinear overlap from merely nearby lines.
{
 const c=Schema.newCanvas('conv-trunk'),p=add(c,100,100),a=add(c,300,40),b=add(c,300,180);rel(c,p,a);rel(c,p,b);
 const ea=Graph.edgeId(p,a),eb=Graph.edgeId(p,b),routes={};routes[ea]=[{x:160,y:130},{x:220,y:130},{x:220,y:70}];routes[eb]=[{x:160,y:130},{x:220,y:130},{x:220,y:210}];
 assert.strictEqual(Router.sharedTrunkAt(c,routes,ea,{x:190,y:130},3),true);
 assert.strictEqual(Router.sharedTrunkAt(c,routes,ea,{x:220,y:90},3),false);
 routes[eb]=[{x:160,y:138},{x:220,y:138},{x:220,y:210}];
 assert.strictEqual(Router.sharedTrunkAt(c,routes,ea,{x:190,y:130},3),false);
}

// Import validator rejects overlap, duplicate location and malformed memo grouping.
{
 const c=Schema.newCanvas('conv-schema');const a=add(c,100,100),b=add(c,300,100);
 assert.ok(Schema.validateCanvas(c));
 let bad=structuredClone(c);bad.canvasPlacements[b].x=110;assert.ok(!Schema.validateCanvas(bad));
 bad=structuredClone(c);bad.memoPlacements[a]={entityId:a,sectionId:null};bad.memoOrder=[`e:${a}`];assert.ok(!Schema.validateCanvas(bad));
 bad=structuredClone(c);bad.entities[a].color='rgb(';assert.ok(!Schema.validateCanvas(bad));
 bad=structuredClone(c);bad.canvasPlacements[a].height=1;assert.ok(!Schema.validateCanvas(bad));
 bad=structuredClone(c);bad.entities[a].text='A'.repeat(400);bad.canvasPlacements[a].height=C.NODE_MIN_H;assert.ok(!Schema.validateCanvas(bad),'undersized long-text node must be rejected');
 bad=structuredClone(c);bad.canvasPlacements[a].subtreeCollapsed='false';assert.ok(!Schema.validateCanvas(bad));
 bad=structuredClone(c);bad.view.autoGroupIds=[a,a];assert.ok(!Schema.validateCanvas(bad));
 const anchored=Schema.newCanvas('conv-anchor-schema');const ae=Schema.newEntity({kind:'anchor',text:'a',originalText:'a',anchor:{conversationId:'conv-anchor-schema',quote:'a'},color:C.COLORS[0]});ae.entityId='a1';anchored.entities.a1=ae;anchored.canvasPlacements.a1={entityId:'a1',x:100,y:100,width:140,height:60,subtreeCollapsed:false};assert.ok(Schema.validateCanvas(anchored));bad=structuredClone(anchored);bad.entities.a1.anchor={};assert.ok(!Schema.validateCanvas(bad));
 const m=Schema.newCanvas('conv-memo'),now=Date.now();const e=Schema.newEntity({kind:'free',text:'memo',color:C.COLORS[1]});e.entityId='m1';m.entities.m1=e;m.memoPlacements.m1={entityId:'m1',sectionId:'s1'};m.memoSections.s1={sectionId:'s1',title:'S',collapsed:false,itemIds:['m1'],createdAt:now,modifiedAt:now};m.memoOrder=['s:s1'];assert.ok(Schema.validateCanvas(m),Schema.validateCanvasDetailed(m).reason);
}

// Branch copy preserves only free or reliably anchored entities and legal surviving edges.
{
 const c=Schema.newCanvas('source');const free=add(c,100,100),hash='h1',anchor={conversationId:'source',messageTextHash:hash,quote:'q'},kept=add(c,400,100,140,60,'anchor',anchor),lost=add(c,700,100,140,60,'anchor',{conversationId:'source',messageTextHash:'h2',quote:'z'});rel(c,free,kept);rel(c,kept,lost);
 const out=Graph.cloneForBranch(c,'target','T',new Set([kept]));assert.strictEqual(Object.keys(out.entities).length,2);assert.strictEqual(Object.keys(out.relations).length,1);assert.strictEqual(out.view.activeColorSlot,0);assert.ok(Schema.validateCanvas(out),Schema.validateCanvasDetailed(out).reason);
}

// 500-node practical stress: structural validation + sparse routed network.
{
 const c=Schema.newCanvas('conv-500');const ids=[];seq=1000;
 const cols=18,dx=154,dy=118;
 for(let i=0;i<500;i++){const col=i%cols,row=Math.floor(i/cols);ids.push(add(c,40+col*dx,40+row*dy,110,52));}
 // Sparse, non-crossing adjacent relationships in separated columns.
 for(let col=0;col<10;col++)for(let row=0;row<10;row++){const i=row*cols+col,j=(row+1)*cols+col;rel(c,ids[i],ids[j]);}
 const t0=performance.now();assert.ok(Schema.validateCanvas(c),Schema.validateCanvasDetailed(c).reason);const t1=performance.now();const rr=Router.routeAll(c);const t2=performance.now();assert.ok(rr.ok,'500-node router failed');orthogonal(rr.routes);
 console.log(JSON.stringify({nodes:500,relations:Object.keys(c.relations).length,validateMs:+(t1-t0).toFixed(1),routeMs:+(t2-t1).toFixed(1)}));
}
console.log('core.test.js: PASS');
