(() => {
  const NS=globalThis.ChatGPTNET,{C,Graph}=NS;
  const H=NS.Hierarchy={};
  const SIBLING_GAP=44,LEVEL_GAP=88;
  const centerX=(c,id)=>{const p=c.canvasPlacements[id];return p.x+p.width/2;};
  const createdAt=(c,id)=>Number(c.entities[id]?.createdAt)||0;
  const stableCompare=(canvas,a,b,orderIndex={})=>centerX(canvas,a)-centerX(canvas,b)||(orderIndex[a]??Infinity)-(orderIndex[b]??Infinity)||createdAt(canvas,a)-createdAt(canvas,b)||a.localeCompare(b);

  H.component=(canvas,seeds)=>{
    const found=new Set((seeds||[]).filter(id=>canvas.canvasPlacements[id])),queue=[...found];
    while(queue.length){const id=queue.shift();for(const next of [...Graph.parentsOf(canvas,id),...Graph.childrenOf(canvas,id)])if(canvas.canvasPlacements[next]&&!found.has(next)){found.add(next);queue.push(next);}}
    return [...found];
  };

  function topology(canvas,ids,options={}){
    const set=new Set(ids),indegree=new Map(ids.map(id=>[id,0])),rank=new Map(ids.map(id=>[id,0]));
    for(const e of Graph.edges(canvas))if(set.has(e.parentId)&&set.has(e.childId))indegree.set(e.childId,indegree.get(e.childId)+1);
    const stable=(a,b)=>canvas.canvasPlacements[a].y-canvas.canvasPlacements[b].y||stableCompare(canvas,a,b,options.orderIndex),queue=ids.filter(id=>indegree.get(id)===0).sort(stable),order=[];
    while(queue.length){const id=queue.shift();order.push(id);for(const child of Graph.childrenOf(canvas,id).filter(x=>set.has(x))){rank.set(child,Math.max(rank.get(child),rank.get(id)+1));indegree.set(child,indegree.get(child)-1);if(indegree.get(child)===0){queue.push(child);queue.sort(stable);}}}
    if(order.length!==ids.length)return null;const max=Math.max(0,...rank.values()),layers=Array.from({length:max+1},()=>[]);for(const id of order)layers[rank.get(id)].push(id);return{set,rank,layers,order};
  }

  function treeTopDown(canvas,topo,root,options){
    const children=id=>Graph.childrenOf(canvas,id).filter(x=>topo.set.has(x)).sort((a,b)=>stableCompare(canvas,a,b,options.orderIndex)),span=new Map(),positions={};
    const measure=id=>{const kids=children(id),p=canvas.canvasPlacements[id],childWidth=kids.reduce((n,k)=>n+measure(k),0)+SIBLING_GAP*Math.max(0,kids.length-1),w=Math.max(p.width,childWidth);span.set(id,w);return w;};measure(root);
    const heights=topo.layers.map(layer=>Math.max(...layer.map(id=>canvas.canvasPlacements[id].height))),ys=[];let y=0;for(let r=0;r<heights.length;r++){ys[r]=y;y+=heights[r]+LEVEL_GAP;}
    const place=(id,left)=>{const p=canvas.canvasPlacements[id],width=span.get(id),kids=children(id);if(kids.length){const total=kids.reduce((n,k)=>n+span.get(k),0)+SIBLING_GAP*(kids.length-1);let x=left+(width-total)/2;for(const kid of kids){place(kid,x);x+=span.get(kid)+SIBLING_GAP;}const first=positions[kids[0]],last=positions[kids[kids.length-1]],mid=(first.x+canvas.canvasPlacements[kids[0]].width/2+last.x+canvas.canvasPlacements[kids[kids.length-1]].width/2)/2;positions[id]={x:mid-p.width/2,y:ys[topo.rank.get(id)]};}else positions[id]={x:left+(width-p.width)/2,y:ys[topo.rank.get(id)]};};place(root,0);return positions;
  }

  function layerCenters(canvas,layers){const out=new Map();for(const layer of layers){const width=layer.reduce((n,id)=>n+canvas.canvasPlacements[id].width,0)+SIBLING_GAP*Math.max(0,layer.length-1);let x=-width/2;for(const id of layer){const w=canvas.canvasPlacements[id].width;out.set(id,x+w/2);x+=w+SIBLING_GAP;}}return out;}
  function reduceCrossings(canvas,topo,options){
    const{layers,rank}=topo,index=()=>new Map(layers.flatMap(layer=>layer.map((id,i)=>[id,i]))),sortLayer=(r,neighbors,order)=>{const old=new Map(layers[r].map((id,i)=>[id,i]));layers[r].sort((a,b)=>{const score=id=>{const ns=neighbors(canvas,id).filter(n=>rank.has(n)&&rank.get(n)!==r);return ns.length?ns.reduce((v,n)=>v+(order.get(n)??0),0)/ns.length:old.get(id);};return score(a)-score(b)||old.get(a)-old.get(b);});};
    layers.forEach(layer=>layer.sort((a,b)=>stableCompare(canvas,a,b,options.orderIndex)));for(let pass=0;pass<5;pass++){let order=index();for(let r=1;r<layers.length;r++)sortLayer(r,Graph.parentsOf,order);order=index();for(let r=layers.length-2;r>=0;r--)sortLayer(r,Graph.childrenOf,order);}return layers;
  }
  function dagTopDown(canvas,topo,options){
    const layers=reduceCrossings(canvas,topo,options),centers=layerCenters(canvas,layers),pack=(layer,desired)=>{const next=[];for(let i=0;i<layer.length;i++){const id=layer[i],want=desired.get(id)??centers.get(id);if(!i)next[i]=want;else{const prev=layer[i-1],distance=(canvas.canvasPlacements[prev].width+canvas.canvasPlacements[id].width)/2+SIBLING_GAP;next[i]=Math.max(want,next[i-1]+distance);}}const shift=layer.reduce((n,id,i)=>n+(desired.get(id)??centers.get(id))-next[i],0)/Math.max(1,layer.length);layer.forEach((id,i)=>centers.set(id,next[i]+shift));};
    for(let pass=0;pass<6;pass++){for(let r=1;r<layers.length;r++){const d=new Map();for(const id of layers[r]){const ns=Graph.parentsOf(canvas,id).filter(n=>topo.set.has(n));if(ns.length)d.set(id,ns.reduce((n,x)=>n+centers.get(x),0)/ns.length);}pack(layers[r],d);}for(let r=layers.length-2;r>=0;r--){const d=new Map();for(const id of layers[r]){const ns=Graph.childrenOf(canvas,id).filter(n=>topo.set.has(n));if(ns.length)d.set(id,ns.reduce((n,x)=>n+centers.get(x),0)/ns.length);}pack(layers[r],d);}}
    const heights=layers.map(layer=>Math.max(...layer.map(id=>canvas.canvasPlacements[id].height))),ys=[];let y=0;for(let r=0;r<layers.length;r++){ys[r]=y;y+=heights[r]+LEVEL_GAP;}const positions={};for(const id of topo.order){const p=canvas.canvasPlacements[id];positions[id]={x:centers.get(id)-p.width/2,y:ys[topo.rank.get(id)]};}return positions;
  }

  function bounds(canvas,ids,positions){const rects=ids.map(id=>({x:positions[id].x,y:positions[id].y,w:canvas.canvasPlacements[id].width,h:canvas.canvasPlacements[id].height}));return{minX:Math.min(...rects.map(r=>r.x)),minY:Math.min(...rects.map(r=>r.y)),maxX:Math.max(...rects.map(r=>r.x+r.w)),maxY:Math.max(...rects.map(r=>r.y+r.h))};}
  function normalize(canvas,ids,positions,referenceIds=ids){
    const refs=referenceIds.filter(id=>ids.includes(id)&&positions[id]&&canvas.canvasPlacements[id]);if(!refs.length)refs.push(...ids);let b=bounds(canvas,ids,positions),old=refs.map(id=>canvas.canvasPlacements[id]),next=bounds(canvas,refs,positions),oldCenter=(Math.min(...old.map(p=>p.x))+Math.max(...old.map(p=>p.x+p.width)))/2,oldTop=Math.min(...old.map(p=>p.y)),dx=oldCenter-(next.minX+next.maxX)/2,dy=oldTop-next.minY;
    for(const id of ids)positions[id]={x:positions[id].x+dx,y:positions[id].y+dy};b=bounds(canvas,ids,positions);if(b.maxX-b.minX>C.WORLD_W||b.maxY-b.minY>C.WORLD_H)return null;dx=b.minX<0?-b.minX:b.maxX>C.WORLD_W?C.WORLD_W-b.maxX:0;dy=b.minY<0?-b.minY:b.maxY>C.WORLD_H?C.WORLD_H-b.maxY:0;for(const id of ids){positions[id].x=Math.round(positions[id].x+dx);positions[id].y=Math.round(positions[id].y+dy);}return positions;
  }

  H.arrange=(canvas,seeds,options={})=>{
    const ids=H.component(canvas,seeds);if(ids.length<2)return null;const topo=topology(canvas,ids,options);if(!topo)return null;const roots=topo.layers[0],isTree=roots.length===1&&ids.every(id=>id===roots[0]||Graph.parentsOf(canvas,id).filter(x=>topo.set.has(x)).length===1);let positions;
    if(isTree)positions=treeTopDown(canvas,topo,roots[0],options);else positions=dagTopDown(canvas,topo,options);
    positions=normalize(canvas,ids,positions,options.referenceIds);return positions?{ids,positions,layers:topo.layers.map(layer=>[...layer]),rank:topo.rank,orientation:'top-down',isTree}:null;
  };

  H.topDown=(canvas,ids)=>{const set=new Set(ids);return Graph.edges(canvas).filter(e=>set.has(e.parentId)&&set.has(e.childId)).every(e=>{const p=canvas.canvasPlacements[e.parentId],c=canvas.canvasPlacements[e.childId];return p&&c&&p.y+p.height<c.y;});};

  H.translationCandidates=(canvas,layout)=>{
    const set=new Set(layout.ids),b=bounds(canvas,layout.ids,layout.positions),xs=new Set([0]),ys=new Set([0]),gap=C.NODE_GAP;
    for(const d of[40,80,120,180,240,320,440,600,800]){xs.add(d);xs.add(-d);ys.add(d);ys.add(-d);}
    for(const[id,p]of Object.entries(canvas.canvasPlacements))if(!set.has(id)){
      const r={x:p.x,y:p.y,w:p.width,h:p.height};
      xs.add(Math.round(r.x-gap-b.maxX));xs.add(Math.round(r.x+r.w+gap-b.minX));
      ys.add(Math.round(r.y-gap-b.maxY));ys.add(Math.round(r.y+r.h+gap-b.minY));
    }
    xs.add(Math.round(-b.minX));xs.add(Math.round(C.WORLD_W-b.maxX));ys.add(Math.round(-b.minY));ys.add(Math.round(C.WORLD_H-b.maxY));
    const nearest=s=>[...s].sort((a,b)=>Math.abs(a)-Math.abs(b)||a-b).slice(0,36),pairs=[];
    for(const dx of nearest(xs))for(const dy of nearest(ys))if(b.minX+dx>=0&&b.maxX+dx<=C.WORLD_W&&b.minY+dy>=0&&b.maxY+dy<=C.WORLD_H)pairs.push([dx,dy]);
    pairs.sort((a,b)=>a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]||Math.abs(a[1])-Math.abs(b[1]));
    const seen=new Set(),out=[];for(const pair of pairs){const k=pair.join(',');if(seen.has(k))continue;seen.add(k);out.push(pair);if(out.length>=640)break;}return out;
  };
})();
