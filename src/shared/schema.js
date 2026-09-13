(() => {
  const NS = globalThis.ChatGPTNET, {C,U} = NS;
  const S = NS.Schema = {};
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const finite = v => Number.isFinite(v);
  const color = v => {
    if(typeof v!=='string')return false;
    if(/^#[0-9a-f]{6}$/i.test(v))return true;
    const m=v.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    return !!m && [m[1],m[2],m[3]].every(x=>Number(x)>=0&&Number(x)<=255);
  };
  const fail = reason => ({ok:false,reason});
  const ok = () => ({ok:true,reason:null});
  const optionalString = v => v == null || typeof v === 'string';

  // Keep a conservative, platform-independent lower bound in the persisted model. The browser
  // still measures the real DOM height, but imports with obviously undersized long-text nodes are
  // rejected before they can render over another node.
  S.minimumNodeHeight = (text, width) => {
    const usable=Math.max(1,Number(width)-22),charsPerLine=Math.max(8,Math.floor(usable/7));
    const lines=Math.max(1,Math.ceil(Array.from(String(text||'')).length/charsPerLine));
    return Math.max(C.NODE_MIN_H,C.NODE_MIN_H+Math.max(0,lines-2)*12);
  };

  S.defaultGlobal = () => ({
    schemaVersion: C.SCHEMA_VERSION,
    colorSlots: [...C.COLORS],
    sidebarWidth: C.DEFAULT_SIDEBAR_W,
    memoRatio: C.DEFAULT_MEMO_RATIO
  });

  S.newCanvas = (conversationId, title = 'ChatGPT') => {
    const now = U.now();
    return {
      schemaVersion: C.SCHEMA_VERSION,
      canvasId: U.uuid(),
      conversationId,
      title,
      createdAt: now,
      modifiedAt: now,
      revision: 0,
      entities: {},
      canvasPlacements: {},
      relations: {},
      memoPlacements: {},
      memoSections: {},
      memoOrder: [],
      view: {
        zoom: C.DEFAULT_ZOOM,
        panX: C.WORLD_W * 0.5 - (C.INITIAL_VIEW_W / C.DEFAULT_ZOOM) * 0.5,
        panY: C.WORLD_H * 0.25 - (C.INITIAL_VIEW_H / C.DEFAULT_ZOOM) * 0.5,
        sidebarWidth: C.DEFAULT_SIDEBAR_W,
        memoRatio: C.DEFAULT_MEMO_RATIO,
        activeColorSlot: 0,
        autoGroupIds: [],
        hierarchyLayoutVersion: C.HIERARCHY_LAYOUT_VERSION
      },
      colorOverride: null,
      branchOrigin: null
    };
  };

  S.newEntity = ({kind='free', text='', originalText='', anchor=null, color=C.COLORS[0]}) => ({
    entityId: U.uuid(), kind, text, originalText, anchor, color,
    createdAt: U.now(), modifiedAt: U.now(), anchorStatus: anchor ? 'ok' : 'none'
  });

  S.validateGlobalDetailed = g => {
    if(!obj(g) || g.schemaVersion !== C.SCHEMA_VERSION) return fail('global schema');
    if(!Array.isArray(g.colorSlots) || g.colorSlots.length !== C.COLORS.length || !g.colorSlots.every(color)) return fail('global colors');
    if(!finite(g.sidebarWidth) || g.sidebarWidth < C.MIN_SIDEBAR_W || g.sidebarWidth > C.MAX_SIDEBAR_W) return fail('global sidebar width');
    if(!finite(g.memoRatio) || g.memoRatio < C.MIN_MEMO_RATIO || g.memoRatio > C.MAX_MEMO_RATIO) return fail('global memo ratio');
    return ok();
  };
  S.validateGlobal = g => S.validateGlobalDetailed(g).ok;

  S.validateCanvasDetailed = v => {
    if(!obj(v) || v.schemaVersion !== C.SCHEMA_VERSION) return fail('canvas schema');
    if(typeof v.canvasId !== 'string' || !v.canvasId || typeof v.conversationId !== 'string' || !v.conversationId) return fail('canvas identity');
    if(typeof v.title!=='string'||!finite(v.createdAt)||!finite(v.modifiedAt)||!Number.isInteger(v.revision)||v.revision<0) return fail('canvas metadata');
    if(!obj(v.entities) || !obj(v.canvasPlacements) || !obj(v.relations) || !obj(v.memoPlacements) || !obj(v.memoSections) || !Array.isArray(v.memoOrder) || !obj(v.view)) return fail('canvas containers');
    if(v.colorOverride != null && (!Array.isArray(v.colorOverride) || v.colorOverride.length !== C.COLORS.length || !v.colorOverride.every(color))) return fail('canvas colors');
    if(v.branchOrigin!=null&&(!obj(v.branchOrigin)||typeof v.branchOrigin.sourceCanvasId!=='string'||!v.branchOrigin.sourceCanvasId||typeof v.branchOrigin.sourceConversationId!=='string'||!v.branchOrigin.sourceConversationId||!finite(v.branchOrigin.capturedAt))) return fail('branch origin');

    const entityIds = Object.keys(v.entities), canvasIds = new Set(Object.keys(v.canvasPlacements)), memoIds = new Set(Object.keys(v.memoPlacements));
    for(const id of entityIds){
      const e=v.entities[id];
      if(!obj(e) || e.entityId!==id || !['free','anchor'].includes(e.kind) || typeof e.text!=='string' || typeof e.originalText!=='string' || !color(e.color)||!finite(e.createdAt)||!finite(e.modifiedAt)||!['none','ok','message','missing'].includes(e.anchorStatus)) return fail(`entity ${id}`);
      if(e.kind==='free' && e.anchor!=null) return fail(`free anchor ${id}`);
      if(e.kind==='anchor' && (!obj(e.anchor)||typeof e.anchor.conversationId!=='string'||!e.anchor.conversationId||typeof e.anchor.quote!=='string'||!e.anchor.quote)) return fail(`anchor ${id}`);
      if(e.kind==='anchor'&&(!optionalString(e.anchor.messageId)||!(e.anchor.messageIndex==null||(Number.isInteger(e.anchor.messageIndex)&&e.anchor.messageIndex>=0))||!optionalString(e.anchor.role)||!optionalString(e.anchor.messageTextHash)||!optionalString(e.anchor.prefix)||!optionalString(e.anchor.suffix))) return fail(`anchor fields ${id}`);
      if(canvasIds.has(id)===memoIds.has(id)) return fail(`entity placement ${id}`); // exactly one location
    }
    if(canvasIds.size + memoIds.size !== entityIds.length) return fail('orphan or unknown placement');

    const rects=[];
    for(const [id,p] of Object.entries(v.canvasPlacements)){
      if(!v.entities[id] || !obj(p) || p.entityId!==id || !finite(p.x) || !finite(p.y) || !finite(p.width) || !finite(p.height)||typeof p.subtreeCollapsed!=='boolean') return fail(`canvas placement ${id}`);
      if(p.width<C.NODE_MIN_W || p.width>C.NODE_MAX_W || p.height<S.minimumNodeHeight(v.entities[id].text,p.width) || p.x<0 || p.y<0 || p.x+p.width>C.WORLD_W || p.y+p.height>C.WORLD_H) return fail(`canvas bounds ${id}`);
      rects.push([id,{x:p.x,y:p.y,w:p.width,h:p.height}]);
    }
    for(let i=0;i<rects.length;i++) for(let j=i+1;j<rects.length;j++) if(U.rectsOverlap(rects[i][1],rects[j][1],C.NODE_GAP)) return fail(`node overlap ${rects[i][0]} ${rects[j][0]}`);

    for(const [id,p] of Object.entries(v.memoPlacements)){
      if(!v.entities[id] || !obj(p) || p.entityId!==id || !(p.sectionId==null || typeof p.sectionId==='string')) return fail(`memo placement ${id}`);
    }

    const outgoing=new Map(),incomingParents=new Map();
    for(const [rid,e] of Object.entries(v.relations)){
      if(!obj(e) || e.relationId!==rid || rid!==`${e.parentId}=>${e.childId}` || !canvasIds.has(e.parentId) || !canvasIds.has(e.childId) || e.parentId===e.childId||!finite(e.createdAt)) return fail(`relation ${rid}`);
      if(!outgoing.has(e.parentId)) outgoing.set(e.parentId,[]);
      outgoing.get(e.parentId).push(e.childId);
      if(!incomingParents.has(e.childId)) incomingParents.set(e.childId,[]);
      incomingParents.get(e.childId).push(e.parentId);
    }
    // The hierarchy is a DAG: reject every cycle, including longer cycles.
    const state=new Map();
    const dfs=id=>{const s=state.get(id)||0;if(s===1)return false;if(s===2)return true;state.set(id,1);for(const ch of outgoing.get(id)||[])if(!dfs(ch))return false;state.set(id,2);return true;};
    for(const id of canvasIds) if(!dfs(id)) return fail('relation cycle');
    const descendants=id=>{const out=new Set(),q=[id];while(q.length){const n=q.shift();for(const ch of outgoing.get(n)||[])if(!out.has(ch)){out.add(ch);q.push(ch);}}return out;};
    for(const parents of incomingParents.values())for(let i=0;i<parents.length;i++)for(let j=i+1;j<parents.length;j++)if(descendants(parents[i]).has(parents[j])||descendants(parents[j]).has(parents[i]))return fail('multi-parent hierarchy conflict');

    const sectionMembers=new Set();
    for(const [sid,sec] of Object.entries(v.memoSections)){
      if(!obj(sec) || sec.sectionId!==sid || typeof sec.title!=='string' || typeof sec.collapsed!=='boolean' || !Array.isArray(sec.itemIds)||!finite(sec.createdAt)||!finite(sec.modifiedAt)) return fail(`memo section ${sid}`);
      const local=new Set();
      for(const id of sec.itemIds){
        if(local.has(id) || sectionMembers.has(id) || !memoIds.has(id) || v.memoPlacements[id].sectionId!==sid) return fail(`memo section membership ${sid}`);
        local.add(id); sectionMembers.add(id);
      }
    }
    for(const [id,p] of Object.entries(v.memoPlacements)){
      if(p.sectionId!=null && (!v.memoSections[p.sectionId] || !sectionMembers.has(id))) return fail(`memo section link ${id}`);
      if(p.sectionId==null && sectionMembers.has(id)) return fail(`memo ungrouped link ${id}`);
    }

    const orderSeen=new Set(), expectedTokens=new Set();
    for(const [id,p] of Object.entries(v.memoPlacements)) if(p.sectionId==null) expectedTokens.add(`e:${id}`);
    for(const sid of Object.keys(v.memoSections)) expectedTokens.add(`s:${sid}`);
    for(const token of v.memoOrder){
      if(typeof token!=='string' || orderSeen.has(token) || !expectedTokens.has(token)) return fail(`memo order ${token}`);
      orderSeen.add(token);
    }
    if(orderSeen.size!==expectedTokens.size) return fail('memo order incomplete');

    const vw=v.view;
    if(!finite(vw.zoom)||vw.zoom<C.MIN_ZOOM||vw.zoom>C.MAX_ZOOM||!finite(vw.panX)||!finite(vw.panY)||vw.panX<0||vw.panY<0||vw.panX>C.WORLD_W||vw.panY>C.WORLD_H||!finite(vw.sidebarWidth)||!finite(vw.memoRatio)) return fail('view numbers');
    if(vw.sidebarWidth<C.MIN_SIDEBAR_W||vw.sidebarWidth>C.MAX_SIDEBAR_W||vw.memoRatio<C.MIN_MEMO_RATIO||vw.memoRatio>C.MAX_MEMO_RATIO) return fail('view bounds');
    if(!Number.isInteger(vw.activeColorSlot)||vw.activeColorSlot<0||vw.activeColorSlot>=C.COLORS.length) return fail('active color slot');
    if(vw.autoGroupIds!=null && (!Array.isArray(vw.autoGroupIds)||new Set(vw.autoGroupIds).size!==vw.autoGroupIds.length||vw.autoGroupIds.some(id=>!canvasIds.has(id)))) return fail('auto group');
    if(vw.hierarchyLayoutVersion!=null&&(!Number.isInteger(vw.hierarchyLayoutVersion)||vw.hierarchyLayoutVersion<0||vw.hierarchyLayoutVersion>C.HIERARCHY_LAYOUT_VERSION)) return fail('hierarchy layout version');

    // A collapsed branch may not hide a descendant that has multiple parents.
    for(const [id,p] of Object.entries(v.canvasPlacements)) if(p.subtreeCollapsed){for(const d of descendants(id)) if((incomingParents.get(d)||[]).length>1) return fail(`invalid collapse ${id}`);}

    return ok();
  };
  S.validateCanvas = v => S.validateCanvasDetailed(v).ok;
  S.exportBundle = (canvases, global) => ({product:C.PRODUCT, baseline:C.BASELINE, schemaVersion:C.SCHEMA_VERSION, exportedAt:new Date().toISOString(), global, canvases});
})();
