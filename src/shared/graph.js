(() => {
  const NS = globalThis.ChatGPTNET, {U} = NS;
  const G = NS.Graph = {};
  G.edges = c => Object.values(c.relations);
  G.parentsOf = (c,id) => G.edges(c).filter(e=>e.childId===id).map(e=>e.parentId);
  G.childrenOf = (c,id) => G.edges(c).filter(e=>e.parentId===id).map(e=>e.childId);
  G.hasEdge = (c,p,ch) => G.edges(c).some(e=>e.parentId===p && e.childId===ch);
  G.edgeId = (p,ch) => `${p}=>${ch}`;
  G.descendants = (c,id) => { const out=new Set(), q=[id]; while(q.length){ const n=q.shift(); for(const ch of G.childrenOf(c,n)) if(!out.has(ch)){out.add(ch);q.push(ch);} } return out; };
  G.independentSubtree = (c,id) => {
    if(!c.canvasPlacements[id]||G.parentsOf(c,id).length)return null;
    const members=G.descendants(c,id);members.add(id);
    for(const edge of G.edges(c))if(members.has(edge.parentId)!==members.has(edge.childId))return null;
    return [...members];
  };
  G.wouldCycle = (c,parentId,childId) => parentId===childId || G.descendants(c,childId).has(parentId);
  G.parentSetsIndependent = c => {const children=new Set(G.edges(c).map(e=>e.childId));for(const child of children){const parents=G.parentsOf(c,child);for(let i=0;i<parents.length;i++)for(let j=i+1;j<parents.length;j++)if(G.descendants(c,parents[i]).has(parents[j])||G.descendants(c,parents[j]).has(parents[i]))return false;}return true;};
  G.parentHierarchyConflictAfterAdd = (c,parentId,childId) => {if(G.hasEdge(c,parentId,childId)||G.wouldCycle(c,parentId,childId))return false;const id=G.edgeId(parentId,childId),temp={relations:{...c.relations,[id]:{relationId:id,parentId,childId,createdAt:U.now()}}};return !G.parentSetsIndependent(temp);};
  G.canAdd = (c,parentId,childId) => !G.hasEdge(c,parentId,childId) && !G.wouldCycle(c,parentId,childId) && !G.parentHierarchyConflictAfterAdd(c,parentId,childId);
  G.addEdge = (c,parentId,childId) => { const id=G.edgeId(parentId,childId); c.relations[id]={relationId:id,parentId,childId,createdAt:U.now()}; return id; };
  G.removeEdge = (c,parentId,childId) => delete c.relations[G.edgeId(parentId,childId)];
  G.removeEntityEdges = (c,id) => { for (const [eid,e] of Object.entries(c.relations)) if(e.parentId===id || e.childId===id) delete c.relations[eid]; };
  G.canCollapse = (c,id) => { const ds=G.descendants(c,id); for(const d of ds) if(G.parentsOf(c,d).length>1) return false; return true; };
  G.hiddenByCollapse = (c) => { const hidden=new Set(); for(const [id,p] of Object.entries(c.canvasPlacements)) if(p.subtreeCollapsed){ for(const d of G.descendants(c,id)) hidden.add(d); } return hidden; };
  G.cloneForBranch = (source, targetConversationId, title, allowedEntityIds) => {
    const out = NS.Schema.newCanvas(targetConversationId,title);
    out.colorOverride = [...NS.StoreRuntime.colorsFor(source)];
    out.view.activeColorSlot = 0;
    out.branchOrigin = {sourceCanvasId:source.canvasId, sourceConversationId:source.conversationId, capturedAt:U.now()};
    const map = new Map(), sectionMap=new Map();
    for(const sid of Object.keys(source.memoSections||{}))sectionMap.set(sid,U.uuid());
    for(const ent of Object.values(source.entities)){
      if(ent.kind==='free' || (ent.anchor && allowedEntityIds.has(ent.entityId))){
        const ne=U.deepClone(ent), nid=U.uuid(); ne.entityId=nid; if(ne.anchor) ne.anchor.conversationId=targetConversationId; out.entities[nid]=ne; map.set(ent.entityId,nid);
        if(source.canvasPlacements[ent.entityId]) out.canvasPlacements[nid]={...U.deepClone(source.canvasPlacements[ent.entityId]),entityId:nid};
        if(source.memoPlacements[ent.entityId]){const mp=source.memoPlacements[ent.entityId];out.memoPlacements[nid]={...U.deepClone(mp),entityId:nid,sectionId:mp.sectionId?sectionMap.get(mp.sectionId)||null:null};}
      }
    }
    for(const e of G.edges(source)){ const p=map.get(e.parentId), ch=map.get(e.childId); if(p&&ch) G.addEdge(out,p,ch); }
    for(const [oldSid,sec] of Object.entries(source.memoSections||{})){const sid=sectionMap.get(oldSid),ids=(sec.itemIds||[]).map(x=>map.get(x)).filter(Boolean);out.memoSections[sid]={...U.deepClone(sec),sectionId:sid,itemIds:ids};}
    out.memoOrder=[];for(const token of source.memoOrder||[]){if(token.startsWith('e:')){const id=map.get(token.slice(2));if(id&&out.memoPlacements[id]?.sectionId==null)out.memoOrder.push(`e:${id}`);}else if(token.startsWith('s:')){const sid=sectionMap.get(token.slice(2));if(sid)out.memoOrder.push(`s:${sid}`);}}
    return out;
  };
})();
