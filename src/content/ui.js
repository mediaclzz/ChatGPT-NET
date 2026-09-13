(() => {
  const NS=globalThis.ChatGPTNET,{C,U}=NS;
  const UI=NS.UI={};
  UI.el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
  UI.toast=(text)=>{document.querySelector('.cgn-toast')?.remove();const t=UI.el('div','cgn-toast',text);t.dataset.chatgptNetOverlay='';document.body.append(t);setTimeout(()=>t.remove(),C.TOAST_MS);};
  UI.modal=(title,build)=>{const b=UI.el('div','cgn-modal-backdrop');b.dataset.chatgptNetRoot='';const p=UI.el('div','cgn-panel'),h=UI.el('h3','',title);p.append(h);build(p,()=>b.remove());b.append(p);b.addEventListener('pointerdown',e=>{if(e.target===b)b.remove();});document.body.append(b);return b;};
  UI.inlineEdit=(el,value,onCommit,onCancel)=>{el.textContent=value;el.contentEditable='true';el.focus();const sel=getSelection(),r=document.createRange();r.selectNodeContents(el);r.collapse(false);sel.removeAllRanges();sel.addRange(r);let done=false;const finish=commit=>{if(done)return;done=true;el.contentEditable='false';const v=el.textContent.trim();if(commit&&v)onCommit(v);else{el.textContent=value;onCancel?.();}};el.addEventListener('blur',()=>finish(true),{once:true});el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish(false);el.blur();}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finish(true);el.blur();}});};
  UI.createSelectionPopup=onCreate=>{const b=UI.el('button','cgn-create-popup','创建节点');b.dataset.chatgptNetOverlay='';b.hidden=true;document.body.append(b);let parts=[];b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>{const p=parts;parts=[];b.hidden=true;onCreate(p);};return{show(p,rect){parts=p;b.hidden=false;b.style.left=`${U.clamp(rect.left,8,innerWidth-100)}px`;b.style.top=`${U.clamp(rect.bottom+6,8,innerHeight-38)}px`;},hide(){parts=[];b.hidden=true;},destroy(){b.remove();}};};

  const rgbOf=color=>{
    const m=/^#([0-9a-f]{6})$/i.exec(color||'');
    if(m){const n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255];}
    const r=/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color||'');
    return r?[+r[1],+r[2],+r[3]]:[201,213,230];
  };
  const alpha=(color,a)=>{const [r,g,b]=rgbOf(color);return`rgba(${r},${g},${b},${a})`;};
  UI.createHighlights=(onClick)=>{
    let items=[];
    const clear=()=>{items.forEach(x=>x.el.remove());items=[];};
    const render=(anchors,flashId=null)=>{
      clear();const statuses={},rectGroups=new Map();if(!anchors.length)return statuses;const index=NS.Chat.buildMessageIndex();
      for(const a of anchors){
        const loc=NS.Chat.locateAnchor(a.anchor,index);statuses[a.entityId]=!loc?'missing':(loc.range?'ok':'message');if(!loc?.range)continue;
        for(const rect of loc.range.getClientRects()){
          if(rect.width<1||rect.height<1)continue;
          const key=[rect.left,rect.top,rect.width,rect.height].map(v=>Math.round(v*2)/2).join('|');
          if(!rectGroups.has(key))rectGroups.set(key,{rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height},refs:[]});
          rectGroups.get(key).refs.push({entityId:a.entityId,color:a.color||C.COLORS[0],flash:a.entityId===flashId});
        }
      }
      for(const g of rectGroups.values()){
        const el=UI.el('div','cgn-highlight'+(g.refs.some(x=>x.flash)?' flash':'')),colors=[...new Set(g.refs.map(x=>x.color))],a=g.refs.some(x=>x.flash)?.5:.32;
        if(colors.length===1)el.style.background=alpha(colors[0],a);
        else{const stops=[];colors.forEach((c,i)=>{const lo=i/colors.length*100,hi=(i+1)/colors.length*100;stops.push(`${alpha(c,a)} ${lo}%`,`${alpha(c,a)} ${hi}%`);});el.style.background=`linear-gradient(to bottom,${stops.join(',')})`;}
        el.style.borderBottom=`2px solid ${colors[0]}`;
        Object.assign(el.style,{left:`${g.rect.left}px`,top:`${g.rect.top}px`,width:`${g.rect.width}px`,height:`${g.rect.height}px`});document.body.append(el);
        items.push({entityIds:[...new Set(g.refs.map(x=>x.entityId))],rect:g.rect,el});
      }
      return statuses;
    };
    const click=e=>{const hits=items.filter(x=>e.clientX>=x.rect.left&&e.clientX<=x.rect.right&&e.clientY>=x.rect.top&&e.clientY<=x.rect.bottom);if(hits.length){e.preventDefault();e.stopPropagation();onClick([...new Set(hits.flatMap(x=>x.entityIds))]);}};document.addEventListener('click',click,true);
    return{render,clear,destroy(){clear();document.removeEventListener('click',click,true);}};
  };

  UI.reservePage=(width,enabled=true)=>{
    const marker='data-chatgpt-net-reserved',saved='data-chatgpt-net-saved-layout',props=['width','max-width','margin-right','min-width','box-sizing'];
    const restore=el=>{if(!(el instanceof HTMLElement))return;let prev={};try{prev=JSON.parse(el.getAttribute(saved)||'{}');}catch{}for(const prop of props){const rec=prev[prop];if(rec&&rec.value!=null)el.style.setProperty(prop,rec.value,rec.priority||'');else el.style.removeProperty(prop);}el.removeAttribute(marker);el.removeAttribute(saved);};
    const restoreAll=()=>document.querySelectorAll(`[${marker}]`).forEach(restore);
    if(!enabled||innerWidth-width<C.MIN_CHAT_RESERVED_W){restoreAll();return{mode:'overlay',host:null};}
    const reservedRight=innerWidth-width,excluded=el=>!(el instanceof HTMLElement)||el.closest?.('[data-chatgpt-net-root],[data-chatgpt-net-overlay]');
    const message=document.querySelector('[data-message-author-role]'),main=document.querySelector('main'),known=document.querySelector('#root,#__next,[data-testid="page-root"]');
    const bodyAncestor=el=>{if(!(el instanceof Element))return null;let cur=el;while(cur.parentElement&&cur.parentElement!==document.body)cur=cur.parentElement;return cur.parentElement===document.body?cur:null;};
    const candidates=[bodyAncestor(message),bodyAncestor(main),known].filter(x=>x&&!excluded(x));
    const direct=[...document.body.children].filter(x=>x instanceof HTMLElement&&!excluded(x)&&!['SCRIPT','STYLE','LINK'].includes(x.tagName));
    direct.sort((a,b)=>{const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();return B.width*B.height-A.width*A.height;});
    if(direct[0])candidates.push(direct[0]);
    const host=candidates.find((x,i)=>candidates.indexOf(x)===i&&x.isConnected);
    if(!host){restoreAll();return{mode:'overlay',host:null};}
    for(const el of document.querySelectorAll(`[${marker}]`))if(el!==host)restore(el);
    const save=el=>{if(el.hasAttribute(marker))return;const prev={};for(const prop of props)prev[prop]={value:el.style.getPropertyValue(prop)||null,priority:el.style.getPropertyPriority(prop)||''};el.setAttribute(saved,JSON.stringify(prev));el.setAttribute(marker,'');};
    save(host);host.style.setProperty('width',`calc(100vw - ${width}px)`,'important');host.style.setProperty('max-width',`calc(100vw - ${width}px)`,'important');host.style.setProperty('margin-right',`${width}px`,'important');host.style.setProperty('min-width','0','important');host.style.setProperty('box-sizing','border-box','important');
    // ChatGPT can place the conversation and composer in separate fixed/100vw shells. Shrink the
    // ancestors of both surfaces when they still intrude into the reserved strip; never resize the
    // message/composer element itself. This preserves the left rail while forcing real reflow.
    const composer=document.querySelector('#prompt-textarea,[data-testid*="composer"],form textarea,textarea');
    for(const anchor of [message,composer]){if(!anchor||excluded(anchor))continue;let el=anchor.parentElement;while(el&&el!==host&&el!==document.body){if(!excluded(el)){const r=el.getBoundingClientRect(),allow=reservedRight-r.left;if(r.right>reservedRight+2&&r.width>allow+2&&allow>=C.MIN_CHAT_RESERVED_W*.6){save(el);el.style.setProperty('width',`${allow}px`,'important');el.style.setProperty('max-width',`${allow}px`,'important');el.style.setProperty('min-width','0','important');el.style.setProperty('box-sizing','border-box','important');}}el=el.parentElement;}}
    return{mode:'reserved',host};
  };
})();
