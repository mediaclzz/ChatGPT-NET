const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');if(!globalThis.crypto)globalThis.crypto=require('crypto').webcrypto;
for(const f of ['src/shared/constants.js','src/shared/utils.js','src/shared/schema.js','src/shared/graph.js','src/shared/geometry.js','src/content/hierarchy.js','src/content/router.js'])vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
const {C,Schema,Graph,Geo,Hierarchy,Router}=globalThis.ChatGPTNET;
function add(c,id,x,y,w=150,h=52){const e=Schema.newEntity({kind:'free',text:id,color:C.COLORS[0]});e.entityId=id;c.entities[id]=e;c.canvasPlacements[id]={entityId:id,x,y,width:w,height:h,subtreeCollapsed:false};}
function apply(c,s){for(const id of s.ids)Object.assign(c.canvasPlacements[id],s.positions[id]);}

// A normal hierarchy becomes a tidy top-down tree, while unrelated content stays untouched.
{
 const c=Schema.newCanvas('tree');[['r',1300,1200],['a',300,200],['b',2100,1400],['a1',1700,300],['a2',800,1900],['b1',2500,2100],['other',80,3000]].forEach(x=>add(c,...x));
 Graph.addEdge(c,'r','a');Graph.addEdge(c,'r','b');Graph.addEdge(c,'a','a1');Graph.addEdge(c,'a','a2');Graph.addEdge(c,'b','b1');const other={...c.canvasPlacements.other},s=Hierarchy.arrange(c,['r']);assert.ok(s);assert.strictEqual(s.orientation,'top-down');apply(c,s);assert.deepStrictEqual(c.canvasPlacements.other,other);
 for(const e of Graph.edges(c))assert.ok(c.canvasPlacements[e.parentId].y+c.canvasPlacements[e.parentId].height<c.canvasPlacements[e.childId].y,`${e.relationId} must point down`);
 const children=Graph.childrenOf(c,'r').map(id=>c.canvasPlacements[id]),rootCenter=c.canvasPlacements.r.x+c.canvasPlacements.r.width/2,childCenter=(Math.min(...children.map(p=>p.x))+Math.max(...children.map(p=>p.x+p.width)))/2;assert.ok(Math.abs(rootCenter-childCenter)<2,'root must be centered above its child span');assert.ok(Schema.validateCanvas(c),Schema.validateCanvasDetailed(c).reason);const rr=Router.routeAll(c);assert.ok(rr.ok);assert.ok(rr.routes['r=>a'].length<=4&&rr.routes['r=>b'].length<=4,JSON.stringify(rr.routes));
}

// Longest-path layers keep an allowed multi-parent DAG coherent.
{
 const c=Schema.newCanvas('dag');add(c,'r',1200,1400);add(c,'p1',300,300);add(c,'p2',2200,1900);add(c,'shared',1000,100);Graph.addEdge(c,'r','p1');Graph.addEdge(c,'r','p2');Graph.addEdge(c,'p1','shared');Graph.addEdge(c,'p2','shared');const s=Hierarchy.arrange(c,['shared']);assert.ok(s&&!s.isTree);apply(c,s);assert.ok(c.canvasPlacements.r.y<c.canvasPlacements.p1.y&&c.canvasPlacements.r.y<c.canvasPlacements.p2.y);assert.ok(c.canvasPlacements.shared.y>c.canvasPlacements.p1.y&&c.canvasPlacements.shared.y>c.canvasPlacements.p2.y);assert.ok(Schema.validateCanvas(c),Schema.validateCanvasDetailed(c).reason);const rr=Router.routeHierarchy(c,s.ids);assert.ok(rr.ok);assert.ok(Object.values(rr.routes).every(path=>path.length<=4));
}

// A relation component moves as a whole around unrelated notes instead of falling back to detours.
{
 const c=Schema.newCanvas('obstacles');[['r',1150,500],['a',900,800],['b',1400,800],['a1',900,1100],['note1',100,100],['note2',200,200]].forEach(x=>add(c,...x));Graph.addEdge(c,'r','a');Graph.addEdge(c,'r','b');Graph.addEdge(c,'a','a1');const s=Hierarchy.arrange(c,['r']);assert.ok(s);Object.assign(c.canvasPlacements.note1,{x:s.positions.a.x,y:s.positions.a.y});Object.assign(c.canvasPlacements.note2,{x:s.positions.b.x,y:s.positions.b.y});const candidate=Hierarchy.translationCandidates(c,s).find(([dx,dy])=>{const p={};for(const id of s.ids)p[id]={x:s.positions[id].x+dx,y:s.positions[id].y+dy};return Geo.groupLegal(c,s.ids,p);});assert.ok(candidate,'must find a whole-component offset around unrelated notes');const[dx,dy]=candidate;for(const id of s.ids)Object.assign(c.canvasPlacements[id],{x:s.positions[id].x+dx,y:s.positions[id].y+dy});assert.ok(Router.routeHierarchy(c,s.ids).ok);
}

// A modest multi-parent hierarchy stays layered and uses only structured routes.
{
 const c=Schema.newCanvas('complex-dag');[['r',900,900],['p',1900,300],['a',400,1300],['b',1200,200],['shared',2200,1600],['a1',200,2000],['p1',2500,800]].forEach(x=>add(c,...x));Graph.addEdge(c,'r','a');Graph.addEdge(c,'r','b');Graph.addEdge(c,'r','shared');Graph.addEdge(c,'a','a1');Graph.addEdge(c,'p','shared');Graph.addEdge(c,'p','p1');const s=Hierarchy.arrange(c,['shared']);assert.ok(s&&!s.isTree);apply(c,s);const rr=Router.routeHierarchy(c,s.ids);assert.ok(rr.ok,JSON.stringify(c.canvasPlacements));assert.ok(Object.values(rr.routes).every(path=>path.length<=4),JSON.stringify(rr.routes));for(const e of Graph.edges(c)){const pp=c.canvasPlacements[e.parentId],cp=c.canvasPlacements[e.childId];assert.ok(pp.y+pp.height<cp.y,`${e.relationId} must point downward`);}
}

// A hierarchy that cannot fit top-down inside the finite world is rejected instead of silently
// switching direction or placing content outside the reachable canvas.
{
 const c=Schema.newCanvas('wide');add(c,'root',1200,500,176,52);for(let i=0;i<18;i++){add(c,`c${i}`,100+(i%9)*280,1000+Math.floor(i/9)*300,176,52);Graph.addEdge(c,'root',`c${i}`);}assert.strictEqual(Hierarchy.arrange(c,['root']),null);
}

// Existing sibling order is deterministic, while an explicit relation-drop x order can insert a
// new child between existing siblings without retaining its exact coordinate.
{
 const c=Schema.newCanvas('stable-order');add(c,'root',1000,200);add(c,'left',700,700);add(c,'right',1300,700);add(c,'middle',1000,1700);Graph.addEdge(c,'root','left');Graph.addEdge(c,'root','right');Graph.addEdge(c,'root','middle');const options={orderIndex:{left:0,middle:1,right:2},referenceIds:['root','left','right']},s=Hierarchy.arrange(c,['root'],options);assert.ok(s);apply(c,s);assert.ok(c.canvasPlacements.left.x<c.canvasPlacements.middle.x&&c.canvasPlacements.middle.x<c.canvasPlacements.right.x);const first=JSON.stringify(s.positions),again=Hierarchy.arrange(c,['root'],options);assert.ok(again);assert.strictEqual(JSON.stringify(again.positions),first);
}

// A root with no incoming or cross-boundary relation owns one rigid independent subtree; a
// multi-parent descendant connected from outside prevents that classification.
{
 const c=Schema.newCanvas('subtree');add(c,'root',500,100);add(c,'child',500,400);add(c,'outside',1000,100);Graph.addEdge(c,'root','child');assert.deepStrictEqual(new Set(Graph.independentSubtree(c,'root')),new Set(['root','child']));Graph.addEdge(c,'outside','child');assert.strictEqual(Graph.independentSubtree(c,'root'),null);
}

// Representative hierarchy layout remains inexpensive.
{
 const c=Schema.newCanvas('perf');for(let i=0;i<31;i++)add(c,`n${i}`,80+(i%10)*230,100+Math.floor(i/10)*180,110,52);for(let i=1;i<31;i++)Graph.addEdge(c,`n${Math.floor((i-1)/2)}`,`n${i}`);const started=performance.now(),s=Hierarchy.arrange(c,['n0']),ms=performance.now()-started;assert.ok(s);apply(c,s);assert.ok(ms<100,`layout took ${ms.toFixed(1)} ms`);assert.ok(Router.routeAll(c).ok);
}
console.log('hierarchy.test.js: PASS');
