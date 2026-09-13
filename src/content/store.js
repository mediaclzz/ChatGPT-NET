(() => {
  const NS=globalThis.ChatGPTNET,{C,U,Schema}=NS;
  const SR=NS.StoreRuntime={
    global:Schema.defaultGlobal(),
    colorsFor(canvas){return canvas.colorOverride ? canvas.colorOverride : this.global.colorSlots;}
  };
  const Store=NS.Store={};
  Store.send=async msg=>{ const res=await browser.runtime.sendMessage(msg); if(res?.error)throw Object.assign(new Error(res.error),{code:res.code}); return res; };
  Store.loadGlobal=async()=>{ const r=await Store.send({type:'GET_GLOBAL'}); SR.global=r.global; return r.global; };
  Store.saveGlobal=async global=>{ const r=await Store.send({type:'SAVE_GLOBAL',global}); SR.global=r.global; return r.global; };
  Store.loadCanvas=async conversationId=>{ const r=await Store.send({type:'GET_CANVAS',conversationId}); return r.canvas; };
  Store.saveCanvas=async(canvas,expectedRevision)=>Store.send({type:'SAVE_CANVAS',canvas,expectedRevision});
  Store.deleteCanvas=async conversationId=>Store.send({type:'DELETE_CANVAS',conversationId});
  Store.exportAll=async()=>Store.send({type:'EXPORT_ALL'});
  Store.importBundle=async(bundle,decisions)=>Store.send({type:'IMPORT_BUNDLE',bundle,decisions});
  Store.tabState=async()=>Store.send({type:'GET_TAB_STATE'});
})();
