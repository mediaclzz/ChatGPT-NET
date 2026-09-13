(() => {
  const NS = globalThis.ChatGPTNET, {C,U} = NS;
  const Geo = NS.Geo = {};
  Geo.nodeRect = p => ({x:p.x,y:p.y,w:p.width||C.NODE_W,h:p.height||C.NODE_MIN_H});
  Geo.inWorld = r => r.x>=0 && r.y>=0 && r.x+r.w<=C.WORLD_W && r.y+r.h<=C.WORLD_H;
  Geo.placementLegal = (canvas,id,rect,ignore=new Set()) => {
    if(!Geo.inWorld(rect)) return false;
    for(const [oid,p] of Object.entries(canvas.canvasPlacements)){
      if(oid===id || ignore.has(oid)) continue;
      if(U.rectsOverlap(rect,Geo.nodeRect(p),C.NODE_GAP)) return false;
    }
    return true;
  };
  Geo.groupLegal = (canvas, ids, positions) => {
    const moving=new Set(ids);
    for(const id of ids){ const p=canvas.canvasPlacements[id], pos=positions[id], r={x:pos.x,y:pos.y,w:p.width,h:p.height}; if(!Geo.placementLegal(canvas,id,r,moving)) return false; }
    const arr=ids.map(id=>({id,r:{x:positions[id].x,y:positions[id].y,w:canvas.canvasPlacements[id].width,h:canvas.canvasPlacements[id].height}}));
    for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++) if(U.rectsOverlap(arr[i].r,arr[j].r,C.NODE_GAP)) return false;
    return true;
  };
  Geo.nearestGroupCandidates = (canvas, ids, desired, limit=96) => {
    const out=[];if(Geo.groupLegal(canvas,ids,desired))out.push(desired);
    const origin={}; for(const id of ids) origin[id]={...desired[id]};
    const step=C.NODE_GAP+12;
    for(let radius=step; radius<=360; radius+=step){
      const offsets=[];
      for(let dx=-radius;dx<=radius;dx+=step){ offsets.push([dx,-radius],[dx,radius]); }
      for(let dy=-radius+step;dy<radius;dy+=step){ offsets.push([-radius,dy],[radius,dy]); }
      offsets.sort((a,b)=>a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]);
      for(const [dx,dy] of offsets){ const cand={}; for(const id of ids)cand[id]={x:origin[id].x+dx,y:origin[id].y+dy}; if(Geo.groupLegal(canvas,ids,cand)){out.push(cand);if(out.length>=limit)return out;} }
    }
    return out;
  };
  Geo.findNearestGroup = (canvas, ids, desired) => Geo.nearestGroupCandidates(canvas,ids,desired,1)[0]||null;
  Geo.segmentPointDistance = (p,a,b) => {
    if(a.x===b.x){ if(p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y)) return Math.abs(p.x-a.x); return Math.hypot(p.x-a.x, Math.min(Math.abs(p.y-a.y),Math.abs(p.y-b.y))); }
    if(a.y===b.y){ if(p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)) return Math.abs(p.y-a.y); return Math.hypot(p.y-a.y, Math.min(Math.abs(p.x-a.x),Math.abs(p.x-b.x))); }
    return Infinity;
  };
  Geo.pathHit = (path,p,tol=6) => { for(let i=0;i<path.length-1;i++) if(Geo.segmentPointDistance(p,path[i],path[i+1])<=tol) return true; return false; };
  Geo.compressPath = path => {
    if(path.length<3) return path;
    const out=[path[0]]; for(let i=1;i<path.length-1;i++){ const a=out[out.length-1],b=path[i],c=path[i+1]; if((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y)) continue; out.push(b); } out.push(path[path.length-1]); return out;
  };
})();
