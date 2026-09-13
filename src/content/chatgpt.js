(() => {
  const NS=globalThis.ChatGPTNET,{U}=NS;
  const Chat=NS.Chat={};
  const MSG_SELECTOR='[data-message-author-role]';
  const IGNORED_MESSAGE_TEXT='[data-chatgpt-net-root],[data-chatgpt-net-overlay],input,textarea,button,[role="button"],[role="menuitem"],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"])';
  const normalizeTitle=t=>(t||'ChatGPT').replace(/\s*[-–—]\s*ChatGPT\s*$/i,'').trim()||'ChatGPT';
  Chat.conversationId=()=>{const m=location.pathname.match(/\/c\/([^/?#]+)/);return m?decodeURIComponent(m[1]):null;};
  Chat.title=()=>normalizeTitle(document.title);
  Chat.messages=()=>Array.from(document.querySelectorAll(MSG_SELECTOR));
  Chat.messageInfo=(el,index=null)=>{
    const messages=Chat.messages(),i=index??messages.indexOf(el),text=messageText(el), role=el.getAttribute('data-message-author-role')||'unknown';
    const host=el.closest('[data-message-id]')||el;
    return {element:el,index:i,role,text,messageId:host.getAttribute?.('data-message-id')||null,messageTextHash:U.hash(text)};
  };
  const ignoredTextNode=n=>!!n.parentElement?.closest(IGNORED_MESSAGE_TEXT);
  Chat.isMessageContentTarget=target=>target instanceof Element && !!target.closest(MSG_SELECTOR) && !target.closest(IGNORED_MESSAGE_TEXT);
  function selectedTextInMessage(range,msg){
    const walker=document.createTreeWalker(msg,NodeFilter.SHOW_TEXT),parts=[];
    while(walker.nextNode()){
      const n=walker.currentNode;if(ignoredTextNode(n))continue;let hit=false;try{hit=range.intersectsNode(n);}catch{}if(!hit)continue;
      let a=0,b=n.data.length;
      if(range.startContainer===n)a=range.startOffset;
      if(range.endContainer===n)b=range.endOffset;
      if(range.startContainer===range.endContainer&&range.startContainer===n){a=range.startOffset;b=range.endOffset;}
      if(b>a)parts.push(n.data.slice(a,b));
    }
    return parts.join('');
  }
  Chat.selectionParts=()=>{
    const sel=window.getSelection();if(!sel||sel.rangeCount===0||sel.isCollapsed)return[];
    const range=sel.getRangeAt(0),out=[],messages=Chat.messages();
    messages.forEach((msg,index)=>{let intersects=false;try{intersects=range.intersectsNode(msg);}catch{}if(!intersects)return;const text=selectedTextInMessage(range,msg);if(!text.trim())return;const info=Chat.messageInfo(msg,index),raw=info.text,idx=raw.indexOf(text);out.push({text,originalText:text,anchor:{conversationId:Chat.conversationId(),messageId:info.messageId,messageIndex:index,role:info.role,messageTextHash:info.messageTextHash,quote:text,prefix:idx>=0?raw.slice(Math.max(0,idx-48),idx):'',suffix:idx>=0?raw.slice(idx+text.length,idx+text.length+48):''}});});
    return out;
  };
  function textNodesWithOffsets(el){const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),arr=[];let off=0;while(w.nextNode()){const n=w.currentNode;if(ignoredTextNode(n))continue;arr.push({node:n,start:off,end:off+n.data.length});off+=n.data.length;}return{arr,text:arr.map(x=>x.node.data).join('')};}
  function messageText(el){return textNodesWithOffsets(el).text;}
  function rangeFromOffsets(el,start,end,cached=null){const arr=cached||textNodesWithOffsets(el).arr;let s=null,e=null;for(const x of arr){if(!s&&start>=x.start&&start<=x.end)s={node:x.node,off:start-x.start};if(end>=x.start&&end<=x.end){e={node:x.node,off:end-x.start};break;}}if(!s||!e)return null;const r=document.createRange();r.setStart(s.node,Math.min(s.off,s.node.data.length));r.setEnd(e.node,Math.min(e.off,e.node.data.length));return r;}
  Chat.buildMessageIndex=()=>{
    const records=Chat.messages().map((element,index)=>{const data=textNodesWithOffsets(element),host=element.closest('[data-message-id]')||element;return{element,index,role:element.getAttribute('data-message-author-role')||'unknown',messageId:host.getAttribute?.('data-message-id')||null,text:data.text,nodes:data.arr,hash:U.hash(data.text)};}),byId=new Map(),byHash=new Map();
    const add=(map,key,rec)=>{if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(rec);};for(const rec of records){add(byId,rec.messageId,rec);add(byHash,rec.hash,rec);}return{records,byId,byHash};
  };
  Chat.locateAnchor=(anchor,index=null)=>{
    if(!anchor)return null;index=index||Chat.buildMessageIndex();const {records,byId,byHash}=index,quote=anchor.quote||'';
    const exactIn=rec=>{
      if(!quote)return null;const {text}=rec,hits=[];let at=0;
      while((at=text.indexOf(quote,at))>=0){hits.push(at);at+=Math.max(1,quote.length);}
      if(hits.length===1)return rangeFromOffsets(rec.element,hits[0],hits[0]+quote.length,rec.nodes);
      if(hits.length>1){const p=anchor.prefix||'',q=anchor.suffix||'',matched=hits.filter(i=>(!p||text.slice(Math.max(0,i-p.length),i).endsWith(p))&&(!q||text.slice(i+quote.length,i+quote.length+q.length).startsWith(q)));if(matched.length===1)return rangeFromOffsets(rec.element,matched[0],matched[0]+quote.length,rec.nodes);}
      return null;
    };
    let msg=null,reliableMessage=false;
    if(anchor.messageId){const hits=byId.get(anchor.messageId)||[];if(hits.length===1){msg=hits[0];reliableMessage=true;}}
    if(!msg&&anchor.messageTextHash){const hits=byHash.get(anchor.messageTextHash)||[];if(hits.length===1){msg=hits[0];reliableMessage=true;}}
    if(msg){const range=exactIn(msg);if(range)return{message:msg.element,range,status:'exact'};if(reliableMessage)return{message:msg.element,range:null,status:'message'};}
    if(quote){const exact=[];for(const rec of records){if(anchor.role&&rec.role!==anchor.role)continue;const range=exactIn(rec);if(range)exact.push({message:rec.element,range});}if(exact.length===1)return{...exact[0],status:'exact'};}
    const contextual=records.filter(rec=>{if(anchor.role&&rec.role!==anchor.role)return false;const t=rec.text,p=anchor.prefix||'',q=anchor.suffix||'';if(!p&&!q)return false;return (!p||t.includes(p))&&(!q||t.includes(q));});
    if(contextual.length===1)return{message:contextual[0].element,range:null,status:'message'};
    return null;
  };
  Chat.reliablyLocatableEntityIds=source=>{const index=Chat.buildMessageIndex();return new Set(Object.values(source.entities||{}).filter(e=>{if(!e.anchor)return false;const loc=Chat.locateAnchor({...e.anchor,conversationId:Chat.conversationId()},index);return loc?.status==='exact';}).map(e=>e.entityId));};
  Chat.conversationFingerprint=()=>Chat.buildMessageIndex().records.map(m=>`${m.role}:${m.hash}`);
  Chat.matchesBranchFingerprint=source=>{
    if(!Array.isArray(source)||!source.length)return false;const target=Chat.conversationFingerprint();if(!target.length)return false;const n=Math.min(source.length,target.length);
    for(let i=0;i<n;i++)if(source[i]!==target[i])return false;
    // A branch may end at an earlier source message, but its loaded history must be a non-empty exact prefix.
    return true;
  };
  Chat.waitForBranchFingerprint=async(source,timeout=3200)=>{const end=Date.now()+timeout;while(Date.now()<end){if(Chat.matchesBranchFingerprint(source))return true;await new Promise(r=>setTimeout(r,200));}return false;};
  Chat.scrollAnchor=anchor=>{const loc=Chat.locateAnchor(anchor);if(!loc)return{ok:false};loc.message.scrollIntoView({behavior:'smooth',block:'center'});return{ok:true,...loc};};
  Chat.watchNavigation=callback=>{
    let last=location.href;const check=()=>{if(location.href!==last){const prev=last;last=location.href;callback(location.href,prev);}};
    // ChatGPT uses SPA history updates. A low-frequency URL poll avoids observing every streamed DOM
    // mutation while still catching pushState/replaceState; popstate/hashchange remain immediate.
    const timer=setInterval(check,650);window.addEventListener('popstate',check);window.addEventListener('hashchange',check);
    return()=>{clearInterval(timer);window.removeEventListener('popstate',check);window.removeEventListener('hashchange',check);};
  };
  Chat.watchTitle=callback=>{let last=document.title;const mo=new MutationObserver(()=>{if(document.title!==last){last=document.title;callback(Chat.title());}});mo.observe(document.head,{childList:true,subtree:true,characterData:true});return()=>mo.disconnect();};
  Chat.watchMessages=callback=>{let timer=null;const root=document.body,mo=new MutationObserver(ms=>{const relevant=ms.some(m=>(m.target instanceof Element&&m.target.closest?.(MSG_SELECTOR))||[...m.addedNodes].some(n=>n instanceof Element&&(n.matches?.(MSG_SELECTOR)||n.querySelector?.(MSG_SELECTOR))));if(!relevant)return;clearTimeout(timer);timer=setTimeout(callback,320);});mo.observe(root,{childList:true,subtree:true,characterData:true});return()=>{clearTimeout(timer);mo.disconnect();};};
  Chat.watchBranchIntent=callback=>{const fn=e=>{const el=e.target instanceof Element?e.target.closest('button,[role="menuitem"],a'):null;if(!el)return;const text=(el.textContent||el.getAttribute('aria-label')||'').trim();if(/branch in new chat|在新聊天.*分支|分支.*新聊天/i.test(text))callback();};document.addEventListener('click',fn,true);return()=>document.removeEventListener('click',fn,true);};
})();
