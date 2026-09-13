(() => {
  const NS=globalThis.ChatGPTNET,{C,Geo,Graph}=NS;
  const R=NS.Router={};
  const key=(x,y)=>`${x},${y}`;
  const cell=p=>({x:Math.round(p.x/C.ROUTE_GRID),y:Math.round(p.y/C.ROUTE_GRID)});
  const world=c=>({x:c.x*C.ROUTE_GRID,y:c.y*C.ROUTE_GRID});
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  function ports(rect,toward){
    const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2, dx=toward.x-cx,dy=toward.y-cy;
    const all=[
      {side:'r',p:{x:rect.x+rect.w,y:cy},o:{x:rect.x+rect.w+C.ROUTE_CLEARANCE+C.ROUTE_GRID,y:cy}},
      {side:'l',p:{x:rect.x,y:cy},o:{x:rect.x-C.ROUTE_CLEARANCE-C.ROUTE_GRID,y:cy}},
      {side:'b',p:{x:cx,y:rect.y+rect.h},o:{x:cx,y:rect.y+rect.h+C.ROUTE_CLEARANCE+C.ROUTE_GRID}},
      {side:'t',p:{x:cx,y:rect.y},o:{x:cx,y:rect.y-C.ROUTE_CLEARANCE-C.ROUTE_GRID}}
    ];
    const score=q=>q.side==='r'?-dx:q.side==='l'?dx:q.side==='b'?-dy:dy;
    return all.sort((a,b)=>score(a)-score(b));
  }
  function nodeBlocked(canvas,hidden){
    const blocked=new Set();
    for(const [id,p] of Object.entries(canvas.canvasPlacements)){
      if(hidden.has(id)) continue;
      const r=Geo.nodeRect(p), pad=C.ROUTE_CLEARANCE;
      const x0=Math.floor((r.x-pad)/C.ROUTE_GRID),x1=Math.ceil((r.x+r.w+pad)/C.ROUTE_GRID);
      const y0=Math.floor((r.y-pad)/C.ROUTE_GRID),y1=Math.ceil((r.y+r.h+pad)/C.ROUTE_GRID);
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)blocked.add(key(x,y));
    }
    return blocked;
  }
  function heuristic(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
  class MinHeap{
    constructor(){this.a=[];}
    get length(){return this.a.length;}
    push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
    pop(){const a=this.a,root=a[0],last=a.pop();if(a.length&&last){a[0]=last;let i=0;while(true){let l=i*2+1,r=l+1,b=i;if(l<a.length&&a[l].f<a[b].f)b=l;if(r<a.length&&a[r].f<a[b].f)b=r;if(b===i)break;[a[i],a[b]]=[a[b],a[i]];i=b;}}return root;}
  }
  function astar(start,goal,isBlocked){
    const coordKey=c=>key(c.x,c.y),stateKey=(c,d)=>`${c.x},${c.y},${d||'n'}`,sk=stateKey(start,null),gk=coordKey(goal),open=new MinHeap(),best=new Map([[sk,0]]),prev=new Map();
    open.push({c:start,g:0,f:heuristic(start,goal),dir:null,state:sk});
    let loops=0;
    // Keep a single difficult route from monopolizing Firefox's main thread. Stable and simple
    // low-bend routes take the fast paths below; A* remains a bounded fallback for obstacles.
    while(open.length && loops++<36000){
      const cur=open.pop();if(cur.g!==(best.get(cur.state)??cur.g))continue;
      if(coordKey(cur.c)===gk){const out=[cur.c];let st=cur.state;while(st!==sk){const pr=prev.get(st);if(!pr)break;out.push(pr.c);st=pr.state;}return out.reverse();}
      for(const [dx,dy] of dirs){
        const n={x:cur.c.x+dx,y:cur.c.y+dy};
        if(n.x<0||n.y<0||n.x>Math.ceil(C.WORLD_W/C.ROUTE_GRID)||n.y>Math.ceil(C.WORLD_H/C.ROUTE_GRID))continue;
        const nk=coordKey(n);if(nk!==gk&&nk!==coordKey(start)&&isBlocked(n))continue;
        const nd=dx?'h':'v',turn=cur.dir&&cur.dir!==nd?14:0,ng=cur.g+1+turn,nstate=stateKey(n,nd);
        if(ng>=(best.get(nstate)??Infinity))continue;
        best.set(nstate,ng);prev.set(nstate,{state:cur.state,c:cur.c});open.push({c:n,g:ng,f:ng+heuristic(n,goal),dir:nd,state:nstate});
      }
    }
    return null;
  }
  function cellsAlong(path){
    const out=[];
    for(let i=0;i<path.length-1;i++){
      const a=cell(path[i]),b=cell(path[i+1]);
      let x=a.x,y=a.y; out.push({x,y});
      while(x!==b.x||y!==b.y){ if(x!==b.x)x+=Math.sign(b.x-x); else y+=Math.sign(b.y-y); out.push({x,y}); }
    }
    return out;
  }
  function register(occ,edge,path){
    const cs=cellsAlong(path),total=cs.length;
    cs.forEach((c,i)=>{const k=key(c.x,c.y);if(!occ.has(k))occ.set(k,[]);occ.get(k).push({edge,parentShare:i*C.ROUTE_GRID<=C.ROUTE_TRUNK,childShare:(total-1-i)*C.ROUTE_GRID<=C.ROUTE_TRUNK});});
  }
  function connectorSafe(a,b,nodeBlocks,allowKeys){
    for(const c of cellsAlong([a,b])){const k=key(c.x,c.y);if(nodeBlocks.has(k)&&!allowKeys.has(k))return false;} return true;
  }
  function segmentHitsRect(a,b,r){
    if(a.x===b.x)return a.x>=r.x&&a.x<=r.x+r.w&&Math.max(Math.min(a.y,b.y),r.y)<=Math.min(Math.max(a.y,b.y),r.y+r.h);
    if(a.y===b.y)return a.y>=r.y&&a.y<=r.y+r.h&&Math.max(Math.min(a.x,b.x),r.x)<=Math.min(Math.max(a.x,b.x),r.x+r.w);
    return true;
  }
  function connectorHitsOther(canvas,ownId,a,b,hidden){for(const[id,p]of Object.entries(canvas.canvasPlacements)){if(id===ownId||hidden.has(id))continue;if(segmentHitsRect(a,b,Geo.nodeRect(p)))return true;}return false;}
  function connectorHitsOccupied(occ,edge,a,b,side){for(const c of cellsAlong([a,b])){const uses=occ.get(key(c.x,c.y));if(!uses)continue;for(const u of uses){if(side==='parent'&&u.edge.parentId===edge.parentId&&u.parentShare)continue;if(side==='child'&&u.edge.childId===edge.childId&&u.childShare)continue;return true;}}return false;}
  function snapConnector(a,b,side){if(a.x===b.x||a.y===b.y)return[a,b];return side==='l'||side==='r'?[a,{x:b.x,y:a.y},b]:[a,{x:a.x,y:b.y},b];}
  function routeOne(canvas,edge,nodeBlocks,occ,hidden){
    const pp=canvas.canvasPlacements[edge.parentId],cp=canvas.canvasPlacements[edge.childId]; if(!pp||!cp)return null;
    const pr=Geo.nodeRect(pp),cr=Geo.nodeRect(cp), pc={x:pr.x+pr.w/2,y:pr.y+pr.h/2},cc={x:cr.x+cr.w/2,y:cr.y+cr.h/2};
    const pPorts=ports(pr,cc),cPorts=ports(cr,pc);
    for(const ps of pPorts)for(const cs of cPorts){
      if(connectorHitsOther(canvas,edge.parentId,ps.p,ps.o,hidden)||connectorHitsOther(canvas,edge.childId,cs.p,cs.o,hidden)||connectorHitsOccupied(occ,edge,ps.p,ps.o,'parent')||connectorHitsOccupied(occ,edge,cs.p,cs.o,'child'))continue;
      const s=cell(ps.o),g=cell(cs.o), allowedNode=new Set([key(s.x,s.y),key(g.x,g.y)]);
      const block=c=>{
        const k=key(c.x,c.y); if(nodeBlocks.has(k)&&!allowedNode.has(k))return true;
        const uses=occ.get(k); if(!uses)return false;
        const wp=world(c);
        return uses.some(u=>{
          if(u.edge.parentId===edge.parentId && u.parentShare && Math.hypot(wp.x-ps.p.x,wp.y-ps.p.y)<=C.ROUTE_TRUNK+C.ROUTE_GRID)return false;
          if(u.edge.childId===edge.childId && u.childShare && Math.hypot(wp.x-cs.p.x,wp.y-cs.p.y)<=C.ROUTE_TRUNK+C.ROUTE_GRID)return false;
          return true;
        });
      };
      const grid=astar(s,g,block); if(!grid)continue;
      const mid=grid.map(world),prefix=snapConnector(ps.o,mid[0],ps.side),suffix=snapConnector(mid[mid.length-1],cs.o,cs.side),path=Geo.compressPath([ps.p,...prefix,...mid.slice(1),...suffix.slice(1),cs.p]);
      return path;
    }
    return null;
  }
  let lastSignature=null,lastResult=null;
  function signature(canvas){
    const ps=Object.entries(canvas.canvasPlacements).map(([id,p])=>`${id}:${Number(p.x).toFixed(2)},${Number(p.y).toFixed(2)},${Number(p.width||0).toFixed(2)},${Number(p.height||0).toFixed(2)}`).sort().join('|');
    const es=Graph.edges(canvas).map(e=>`${e.parentId}>${e.childId}`).sort().join('|');return ps+'#'+es;
  }
  function segHitsRect(a,b,r){
    if(a.x===b.x)return a.x>=r.x&&a.x<=r.x+r.w&&Math.max(Math.min(a.y,b.y),r.y)<=Math.min(Math.max(a.y,b.y),r.y+r.h);
    if(a.y===b.y)return a.y>=r.y&&a.y<=r.y+r.h&&Math.max(Math.min(a.x,b.x),r.x)<=Math.min(Math.max(a.x,b.x),r.x+r.w);
    return true;
  }
  function intersections(a,b,c,d){
    const ah=a.y===b.y,ch=c.y===d.y;
    if(ah&&ch){if(a.y!==c.y)return[];const lo=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)),hi=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x));return lo<=hi?[{type:lo===hi?'point':'overlap',a:{x:lo,y:a.y},b:{x:hi,y:a.y}}]:[];}
    if(!ah&&!ch){if(a.x!==c.x)return[];const lo=Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)),hi=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));return lo<=hi?[{type:lo===hi?'point':'overlap',a:{x:a.x,y:lo},b:{x:a.x,y:hi}}]:[];}
    const h=ah?{a,b}:{a:c,b:d},v=ah?{a:c,b:d}:{a,b},x=v.a.x,y=h.a.y;if(x>=Math.min(h.a.x,h.b.x)&&x<=Math.max(h.a.x,h.b.x)&&y>=Math.min(v.a.y,v.b.y)&&y<=Math.max(v.a.y,v.b.y))return[{type:'point',a:{x,y},b:{x,y}}];return[];
  }
  const samePoint=(a,b)=>!!a&&!!b&&Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)<1e-6;
  const axisDir=(a,b)=>a.x===b.x?['v',Math.sign(b.y-a.y)]:a.y===b.y?['h',Math.sign(b.x-a.x)]:[null,0];
  function commonPrefixGeometry(a,b){
    if(!a.length||!b.length||!samePoint(a[0],b[0]))return[];let i=0,j=0,cur={...a[0]},out=[{...cur}],guard=0;
    while(i<a.length-1&&j<b.length-1&&guard++<a.length+b.length+8){
      while(i<a.length-1&&samePoint(cur,a[i+1]))i++;while(j<b.length-1&&samePoint(cur,b[j+1]))j++;if(i>=a.length-1||j>=b.length-1)break;
      const [aa,as]=axisDir(cur,a[i+1]),[ba,bs]=axisDir(cur,b[j+1]);if(!aa||aa!==ba||as!==bs)break;
      const da=Math.abs(a[i+1].x-cur.x)+Math.abs(a[i+1].y-cur.y),db=Math.abs(b[j+1].x-cur.x)+Math.abs(b[j+1].y-cur.y),d=Math.min(da,db);if(d<=1e-9)break;
      const next=aa==='h'?{x:cur.x+as*d,y:cur.y}:{x:cur.x,y:cur.y+as*d};out.push(next);cur=next;if(Math.abs(da-d)<1e-9)i++;if(Math.abs(db-d)<1e-9)j++;
    }
    return out;
  }
  function pointOnPath(p,path){for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1];if(a.x===b.x&&Math.abs(p.x-a.x)<1e-6&&p.y>=Math.min(a.y,b.y)-1e-6&&p.y<=Math.max(a.y,b.y)+1e-6)return true;if(a.y===b.y&&Math.abs(p.y-a.y)<1e-6&&p.x>=Math.min(a.x,b.x)-1e-6&&p.x<=Math.max(a.x,b.x)+1e-6)return true;}return path.length===1&&samePoint(p,path[0]);}
  function allowedTrunk(a,b,pa,pb){if(a.parentId===b.parentId)return commonPrefixGeometry(pa,pb);if(a.childId===b.childId)return commonPrefixGeometry([...pa].reverse(),[...pb].reverse());return[];}
  const onBorder=(p,r)=>((Math.abs(p.x-r.x)<1e-6||Math.abs(p.x-r.x-r.w)<1e-6)&&p.y>=r.y-1e-6&&p.y<=r.y+r.h+1e-6)||((Math.abs(p.y-r.y)<1e-6||Math.abs(p.y-r.y-r.h)<1e-6)&&p.x>=r.x-1e-6&&p.x<=r.x+r.w+1e-6);
  function pathValid(canvas,edge,path,hidden){
    const pp=canvas.canvasPlacements[edge.parentId],cp=canvas.canvasPlacements[edge.childId];if(!pp||!cp||!Array.isArray(path)||path.length<2||!onBorder(path[0],Geo.nodeRect(pp))||!onBorder(path[path.length-1],Geo.nodeRect(cp)))return false;
    for(let i=0;i<path.length-1;i++){if(path[i].x!==path[i+1].x&&path[i].y!==path[i+1].y)return false;for(const[id,p]of Object.entries(canvas.canvasPlacements)){if(hidden.has(id))continue;if(id===edge.parentId&&i===0)continue;if(id===edge.childId&&i===path.length-2)continue;if(segHitsRect(path[i],path[i+1],Geo.nodeRect(p)))return false;}}
    return true;
  }
  R.routesClearOfNodes=(canvas,ids,routes)=>{for(const id of ids){const p=canvas.canvasPlacements[id];if(!p)return false;const r=Geo.nodeRect(p);for(const[eid,path]of Object.entries(routes||{})){const edge=canvas.relations[eid];if(!edge||edge.parentId===id||edge.childId===id)return false;for(let i=0;i<path.length-1;i++)if(segHitsRect(path[i],path[i+1],r))return false;}}return true;};
  function pairValid(a,b,pa,pb){const trunk=allowedTrunk(a,b,pa,pb);for(let i=0;i<pa.length-1;i++)for(let j=0;j<pb.length-1;j++)for(const hit of intersections(pa[i],pa[i+1],pb[j],pb[j+1]))if(!trunk.length||!pointOnPath(hit.a,trunk)||!pointOnPath(hit.b,trunk))return false;return true;}
  function exactValid(canvas,edges,routes,hidden){
    for(const e of edges)if(!pathValid(canvas,e,routes[e.relationId||Graph.edgeId(e.parentId,e.childId)],hidden))return false;
    for(let x=0;x<edges.length;x++)for(let y=x+1;y<edges.length;y++){const a=edges[x],b=edges[y];if(!pairValid(a,b,routes[a.relationId||Graph.edgeId(a.parentId,a.childId)],routes[b.relationId||Graph.edgeId(b.parentId,b.childId)]))return false;}
    return true;
  }
  const center=r=>({x:r.x+r.w/2,y:r.y+r.h/2});
  function edgeSide(canvas,edge){
    const ar=Geo.nodeRect(canvas.canvasPlacements[edge.parentId]),br=Geo.nodeRect(canvas.canvasPlacements[edge.childId]);
    const verticalGap=C.ROUTE_CLEARANCE*2+4;
    const siblings=Graph.childrenOf(canvas,edge.parentId).map(id=>canvas.canvasPlacements[id]).filter(Boolean).map(Geo.nodeRect);
    const allRight=siblings.length&&siblings.every(r=>r.x-(ar.x+ar.w)>verticalGap),allLeft=siblings.length&&siblings.every(r=>ar.x-(r.x+r.w)>verticalGap);
    const allBelow=siblings.length&&siblings.every(r=>r.y-(ar.y+ar.h)>verticalGap),allAbove=siblings.length&&siblings.every(r=>ar.y-(r.y+r.h)>verticalGap);
    if(allRight&&!allBelow&&!allAbove)return'r';
    if(allLeft&&!allBelow&&!allAbove)return'l';
    if(allBelow&&!allRight&&!allLeft)return'b';
    if(allAbove&&!allRight&&!allLeft)return't';
    const a=center(ar),b=center(br),dx=b.x-a.x,dy=b.y-a.y;
    return Math.abs(dx)>Math.abs(dy)?(dx>=0?'r':'l'):(dy>=0?'b':'t');
  }
  function sidePoint(r,side){if(side==='r')return{x:r.x+r.w,y:r.y+r.h/2};if(side==='l')return{x:r.x,y:r.y+r.h/2};if(side==='b')return{x:r.x+r.w/2,y:r.y+r.h};return{x:r.x+r.w/2,y:r.y};}
  const opposite=side=>side==='r'?'l':side==='l'?'r':side==='b'?'t':'b';
  function simpleCandidates(canvas,edges,hidden){
    const routes={},groups=new Map();for(const edge of edges){if(hidden.has(edge.parentId)||hidden.has(edge.childId)||!canvas.canvasPlacements[edge.parentId]||!canvas.canvasPlacements[edge.childId])continue;const side=edgeSide(canvas,edge),k=`${edge.parentId}|${side}`;if(!groups.has(k))groups.set(k,{side,edges:[]});groups.get(k).edges.push(edge);}
    for(const{side,edges:list}of groups.values()){
      const distances=list.map(edge=>{const a=sidePoint(Geo.nodeRect(canvas.canvasPlacements[edge.parentId]),side),b=sidePoint(Geo.nodeRect(canvas.canvasPlacements[edge.childId]),opposite(side));return side==='r'?b.x-a.x:side==='l'?a.x-b.x:side==='b'?b.y-a.y:a.y-b.y;});
      const positive=distances.filter(x=>x>C.ROUTE_CLEARANCE*2+4);if(positive.length!==list.length)continue;const trunk=Math.min(48,Math.max(24,Math.min(...positive)/2));
      list.forEach(edge=>{const start=sidePoint(Geo.nodeRect(canvas.canvasPlacements[edge.parentId]),side),end=sidePoint(Geo.nodeRect(canvas.canvasPlacements[edge.childId]),opposite(side));let path;if(side==='r'||side==='l'){const x=start.x+(side==='r'?trunk:-trunk);path=[start,{x,y:start.y},{x,y:end.y},end];}else{const y=start.y+(side==='b'?trunk:-trunk);path=[start,{x:start.x,y},{x:end.x,y},end];}routes[edge.relationId||Graph.edgeId(edge.parentId,edge.childId)]=Geo.compressPath(path);});
    }
    return routes;
  }
  function simpleRoutes(canvas,edges,hidden){const routes=simpleCandidates(canvas,edges,hidden);return exactValid(canvas,edges,routes,hidden)?routes:null;}
  function tryPreferred(canvas,edges,hidden,nodeBlocks,preferred){
    if(!preferred||!Object.keys(preferred).length)return null;const ordered=[...edges].sort((a,b)=>a.parentId.localeCompare(b.parentId)||a.childId.localeCompare(b.childId)),routes={},kept=[],pending=[];
    for(const edge of ordered){const id=edge.relationId||Graph.edgeId(edge.parentId,edge.childId),path=preferred[id];if(pathValid(canvas,edge,path,hidden)&&kept.every(other=>pairValid(other,edge,routes[other.relationId||Graph.edgeId(other.parentId,other.childId)],path))){routes[id]=path.map(p=>({...p}));kept.push(edge);}else pending.push(edge);}
    const occ=new Map();for(const edge of kept)register(occ,edge,routes[edge.relationId||Graph.edgeId(edge.parentId,edge.childId)]);const simple=simpleCandidates(canvas,ordered,hidden);
    for(const edge of pending){const id=edge.relationId||Graph.edgeId(edge.parentId,edge.childId),candidate=simple[id];let path=candidate&&pathValid(canvas,edge,candidate,hidden)&&kept.every(other=>pairValid(other,edge,routes[other.relationId||Graph.edgeId(other.parentId,other.childId)],candidate))?candidate:null;if(!path)path=routeOne(canvas,edge,nodeBlocks,occ,hidden);if(!path)return null;routes[id]=path;kept.push(edge);register(occ,edge,path);}
    return exactValid(canvas,ordered,routes,hidden)?routes:null;
  }
  function tryOrder(canvas,edges,hidden,nodeBlocks){
    const occ=new Map(),routes={};
    for(const edge of edges){const path=routeOne(canvas,edge,nodeBlocks,occ,hidden);if(!path)return null;routes[edge.relationId||Graph.edgeId(edge.parentId,edge.childId)]=path;register(occ,edge,path);}return exactValid(canvas,edges,routes,hidden)?routes:null;
  }
  function collinearOverlapAt(a,b,c,d,p,tol){
    const ah=Math.abs(a.y-b.y)<1e-6,bh=Math.abs(c.y-d.y)<1e-6;
    if(ah!==bh)return false;
    if(ah){
      if(Math.abs(a.y-c.y)>tol||Math.abs(p.y-a.y)>tol)return false;
      const lo=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)),hi=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x));
      return hi-lo>1e-6&&p.x>=lo-tol&&p.x<=hi+tol;
    }
    if(Math.abs(a.x-c.x)>tol||Math.abs(p.x-a.x)>tol)return false;
    const lo=Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)),hi=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));
    return hi-lo>1e-6&&p.y>=lo-tol&&p.y<=hi+tol;
  }
  R.sharedTrunkAt=(canvas,routes,eid,p,tol=4)=>{
    const edge=canvas.relations[eid],path=routes[eid];if(!edge||!path)return false;
    for(const [oid,other] of Object.entries(canvas.relations)){
      if(oid===eid||!(other.parentId===edge.parentId||other.childId===edge.childId))continue;
      const op=routes[oid];if(!op)continue;
      for(let i=0;i<path.length-1;i++){
        if(Geo.segmentPointDistance(p,path[i],path[i+1])>tol)continue;
        for(let j=0;j<op.length-1;j++){
          if(Geo.segmentPointDistance(p,op[j],op[j+1])>tol)continue;
          if(collinearOverlapAt(path[i],path[i+1],op[j],op[j+1],p,tol))return true;
        }
      }
    }
    return false;
  };
  R.routeHierarchy=(canvas,componentIds,preferredRoutes={})=>{
    const hidden=new Set(),set=new Set(componentIds),all=Graph.edges(canvas),inside=all.filter(e=>set.has(e.parentId)&&set.has(e.childId)),outside=all.filter(e=>!set.has(e.parentId)||!set.has(e.childId)),routes={};
    for(const edge of outside){const id=edge.relationId||Graph.edgeId(edge.parentId,edge.childId),path=preferredRoutes[id];if(!path||!pathValid(canvas,edge,path,hidden))return{ok:false,routes:{}};routes[id]=path.map(p=>({...p}));}
    const structured=simpleCandidates(canvas,inside,hidden),mixed={...routes};for(const edge of inside){const id=edge.relationId||Graph.edgeId(edge.parentId,edge.childId),old=preferredRoutes[id],path=old&&old.length<=4&&pathValid(canvas,edge,old,hidden)?old:structured[id];if(!path||path.length>4)return{ok:false,routes:{}};mixed[id]=path.map(p=>({...p}));}
    if(exactValid(canvas,all,mixed,hidden))return{ok:true,routes:mixed};for(const edge of inside){const id=edge.relationId||Graph.edgeId(edge.parentId,edge.childId),path=structured[id];if(!path||path.length>4)return{ok:false,routes:{}};routes[id]=path;}return exactValid(canvas,all,routes,hidden)?{ok:true,routes}:{ok:false,routes:{}};
  };
  R.routeIncident=(canvas,nodeIds,preferredRoutes={})=>{
    const hidden=new Set(),moved=new Set(nodeIds),all=Graph.edges(canvas),affected=all.filter(e=>moved.has(e.parentId)||moved.has(e.childId)),fixed=all.filter(e=>!moved.has(e.parentId)&&!moved.has(e.childId)),routes={};
    for(const edge of fixed){const id=edge.relationId||Graph.edgeId(edge.parentId,edge.childId),path=preferredRoutes[id];if(!path||!pathValid(canvas,edge,path,hidden))return{ok:false,routes:{}};routes[id]=path.map(p=>({...p}));}
    const structured=simpleCandidates(canvas,affected,hidden),mixed={...routes};for(const edge of affected){const id=edge.relationId||Graph.edgeId(edge.parentId,edge.childId),old=preferredRoutes[id],path=old&&old.length<=4&&pathValid(canvas,edge,old,hidden)?old:structured[id];if(!path||path.length>4)return{ok:false,routes:{}};mixed[id]=path.map(p=>({...p}));}
    if(exactValid(canvas,all,mixed,hidden))return{ok:true,routes:mixed};for(const edge of affected){const id=edge.relationId||Graph.edgeId(edge.parentId,edge.childId),path=structured[id];if(!path||path.length>4)return{ok:false,routes:{}};routes[id]=path;}return exactValid(canvas,all,routes,hidden)?{ok:true,routes}:{ok:false,routes:{}};
  };
  R.routeAll=(canvas,extraEdges=[],preferredRoutes=null)=>{
    const sig=extraEdges.length?null:signature(canvas);if(sig&&sig===lastSignature&&lastResult)return lastResult;
    const hidden=new Set(),base=[...Graph.edges(canvas),...extraEdges];
    const nodeBlocks=nodeBlocked(canvas,hidden);
    const stable=tryPreferred(canvas,base,hidden,nodeBlocks,preferredRoutes);if(stable){const result={ok:true,routes:stable};if(sig){lastSignature=sig;lastResult=result;}return result;}
    const simple=simpleRoutes(canvas,base,hidden);if(simple){const result={ok:true,routes:simple};if(sig){lastSignature=sig;lastResult=result;}return result;}
    const orders=[
      [...base].sort((a,b)=>a.parentId.localeCompare(b.parentId)||a.childId.localeCompare(b.childId)),
      [...base].sort((a,b)=>{const ap=canvas.canvasPlacements[a.parentId],ac=canvas.canvasPlacements[a.childId],bp=canvas.canvasPlacements[b.parentId],bc=canvas.canvasPlacements[b.childId];const ad=ap&&ac?Math.hypot(ap.x-ac.x,ap.y-ac.y):0,bd=bp&&bc?Math.hypot(bp.x-bc.x,bp.y-bc.y):0;return ad-bd;}),
      [...base].reverse()
    ];
    for(const edges of orders){const routes=tryOrder(canvas,edges,hidden,nodeBlocks);if(routes){const result={ok:true,routes};if(sig){lastSignature=sig;lastResult=result;}return result;}}
    const result={ok:false,routes:{}};if(sig){lastSignature=sig;lastResult=result;}return result;
  };
})();
