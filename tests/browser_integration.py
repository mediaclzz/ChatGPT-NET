from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, sys, time

ROOT=Path(__file__).resolve().parents[1]
SCRIPTS=[
 'src/shared/constants.js','src/shared/utils.js','src/shared/schema.js','src/shared/graph.js','src/shared/geometry.js','src/content/hierarchy.js',
 'src/content/chatgpt.js','src/content/store.js','src/content/router.js','src/content/ui.js','src/content/main.js'
]

def main():
    with sync_playwright() as p:
        engine=os.environ.get('CHATGPT_NET_BROWSER','chromium').lower()
        if engine not in ('chromium','firefox'):
            raise ValueError('CHATGPT_NET_BROWSER must be chromium or firefox')
        browser_type=getattr(p,engine);launch={}
        executable=os.environ.get('CHATGPT_NET_FIREFOX' if engine=='firefox' else 'CHATGPT_NET_CHROMIUM')
        if executable:
            launch['executable_path']=executable
        elif engine=='chromium' and sys.platform.startswith('linux') and Path('/usr/bin/chromium').exists():
            launch['executable_path']='/usr/bin/chromium'
            launch['args']=['--no-sandbox']
        browser=browser_type.launch(headless=not bool(os.environ.get('CHATGPT_NET_HEADED')), **launch)
        context=browser.new_context(viewport={'width':1564,'height':1000})
        page=context.new_page()
        page.set_content('''<!doctype html><html><head><title>Mock conversation - ChatGPT</title><style>
 html,body{margin:0;width:100%;height:100%;overflow:hidden}#app-shell{width:100vw;height:100vh;position:relative;background:#fff}#rail{position:fixed;left:0;top:0;bottom:0;width:48px;background:#eee}.viewport-shell{position:fixed;left:48px;top:0;width:calc(100vw - 48px);height:100vh;overflow:auto;background:#fff}.conversation{width:760px;margin:120px auto 0;padding-bottom:1400px}.msg{font:16px sans-serif;line-height:1.5;padding:20px;background:#fafafa}
</style></head><body><div id="app-shell"><div id="rail"></div><div class="viewport-shell"><main class="conversation"><article data-message-id="m1"><div class="msg" data-message-author-role="assistant">This is a unique highlight target inside a mock ChatGPT assistant message.<button type="button">Copy response</button><span aria-hidden="true">Hidden control label</span></div></article><article data-message-id="m2"><div class="msg" data-message-author-role="user">Second mock message for cross-message selection.</div></article></main></div><div class="composer-shell" style="position:fixed;left:48px;bottom:20px;width:calc(100vw - 48px)"><textarea id="prompt-textarea" style="display:block;width:680px;margin:auto"></textarea></div></div></body></html>''')
        pre_box=page.locator('.conversation').bounding_box(); assert pre_box
        pre_conversation_center=pre_box['x']+pre_box['width']/2
        page.add_style_tag(path=str(ROOT/'src/content/styles.css'))
        page.add_script_tag(content='''
window.__storageListeners=new Set();window.__runtimeListeners=[];
window.__mockGlobal={schemaVersion:1,colorSlots:['#C9D5E6','#C9D9C5','#E7DBB9'],sidebarWidth:420,memoRatio:.25};window.__mockCanvas=null;
window.browser={
 runtime:{
   onMessage:{addListener(fn){window.__runtimeListeners.push(fn)}},
   async sendMessage(msg){
     if(msg.type==='GET_GLOBAL')return{global:structuredClone(window.__mockGlobal)};
     if(msg.type==='SAVE_GLOBAL'){window.__mockGlobal=structuredClone(msg.global);return{global:structuredClone(window.__mockGlobal)}};
     if(msg.type==='GET_TAB_STATE')return{enabled:true};
     if(msg.type==='GET_CANVAS')return{canvas:window.__mockCanvas?structuredClone(window.__mockCanvas):null};
     if(msg.type==='SAVE_CANVAS'){const c=structuredClone(msg.canvas);c.revision=(window.__mockCanvas?.revision||0)+1;window.__mockCanvas=c;return{canvas:structuredClone(c)}};
      if(msg.type==='EXPORT_ALL')return{bundle:{product:'ChatGPT NET',baseline:'1.5',schemaVersion:1,global:structuredClone(window.__mockGlobal),canvases:window.__mockCanvas?[structuredClone(window.__mockCanvas)]:[]}};
     if(msg.type==='IMPORT_BUNDLE')return{ok:true};
     return{};
   }
 },
 storage:{onChanged:{addListener(fn){window.__storageListeners.add(fn)},removeListener(fn){window.__storageListeners.delete(fn)}}}
};
''')
        for rel in SCRIPTS[:7]:
            page.add_script_tag(path=str(ROOT/rel))
        page.evaluate("()=>{ChatGPTNET.Chat.conversationId=()=> 'test-conversation';}")
        for rel in SCRIPTS[7:]:
            page.add_script_tag(path=str(ROOT/rel))
        page.wait_for_function("window.ChatGPTNET?.app?.mounted === true && document.querySelector('.cgn-sidebar')")

        # 1) real page reservation, including an inner fixed 100vw shell.
        metrics=page.evaluate('''()=>({
          viewport:innerWidth,panel:document.querySelector('.cgn-sidebar').getBoundingClientRect().width,
          appRight:document.querySelector('#app-shell').getBoundingClientRect().right,
          innerRight:document.querySelector('.viewport-shell').getBoundingClientRect().right,
          messageRight:document.querySelector('[data-message-author-role]').getBoundingClientRect().right,
          composerRight:document.querySelector('.composer-shell').getBoundingClientRect().right,
          conversationCenter:(()=>{const r=document.querySelector('.conversation').getBoundingClientRect();return r.left+r.width/2})(),
          railRight:document.querySelector('#rail').getBoundingClientRect().right,
          toolbar:[...document.querySelectorAll('.cgn-toolbar button')].map(x=>x.textContent.trim()),
          colors:document.querySelectorAll('.cgn-color').length
        })''')
        boundary=metrics['viewport']-metrics['panel']
        assert metrics['appRight'] <= boundary+2, metrics
        assert metrics['innerRight'] <= boundary+2, metrics
        assert metrics['messageRight'] <= boundary+2, metrics
        assert metrics['composerRight'] <= boundary+2, metrics
        assert metrics['railRight'] == 48, metrics
        assert metrics['conversationCenter'] < pre_conversation_center-150, (pre_conversation_center,metrics)
        assert '>>' not in metrics['toolbar'], metrics
        assert '解除' in metrics['toolbar'] and '解除层级' not in metrics['toolbar'], metrics
        assert metrics['colors']==3, metrics
        initial=page.evaluate('''()=>{const a=ChatGPTNET.app,v=a.viewportWorld();return{cx:v.x+v.w/2,cy:v.y+v.h/2}}''')
        assert abs(initial['cx']-1440)<2 and abs(initial['cy']-900)<2, initial
        clean_message=page.evaluate('''()=>{const el=document.querySelector('[data-message-author-role]'),r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);return{info:ChatGPTNET.Chat.messageInfo(el).text,part:ChatGPTNET.Chat.selectionParts()[0]?.text||''}}''')
        assert 'Copy response' not in clean_message['info'] and 'Copy response' not in clean_message['part'], clean_message
        assert 'Hidden control label' not in clean_message['info'] and 'Hidden control label' not in clean_message['part'], clean_message

        # Real selection gesture: ordinary mode shows the nearby create control; clicking it keeps
        # the native selection when possible. Continuous mode creates immediately, while Ctrl bypasses.
        def select_and_mouseup(quote,ctrl=False,shift=False):
            page.evaluate('''([quote,ctrl,shift])=>{const el=document.querySelector('[data-message-author-role]'),n=el.firstChild,t=n.data,i=t.indexOf(quote);if(i<0)throw new Error('quote missing');const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+quote.length);const s=getSelection();s.removeAllRanges();s.addRange(r);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,ctrlKey:ctrl,shiftKey:shift}));}''',[quote,ctrl,shift])
        q='unique highlight target'
        select_and_mouseup(q);page.wait_for_timeout(80)
        popup=page.locator('.cgn-create-popup');assert popup.is_visible()
        popup.click();page.wait_for_timeout(180)
        sel_created=page.evaluate("()=>({anchors:Object.values(ChatGPTNET.app.canvas.entities).filter(e=>e.kind==='anchor').length,selection:getSelection()?.toString()||''})")
        assert sel_created['anchors']==1 and q in sel_created['selection'], sel_created
        page.evaluate('''async()=>{ChatGPTNET.app.canvasSelection=new Set(Object.keys(ChatGPTNET.app.canvas.canvasPlacements));await ChatGPTNET.app.deleteSelected();}''');page.wait_for_timeout(120)
        page.evaluate('''()=>document.querySelector(".cgn-btn[title='连续摘录']").click()''')
        select_and_mouseup('mock ChatGPT assistant');page.wait_for_timeout(200)
        assert page.evaluate("()=>Object.values(ChatGPTNET.app.canvas.entities).filter(e=>e.kind==='anchor').length")==1
        select_and_mouseup('inside a mock',ctrl=True);page.wait_for_timeout(150)
        assert page.evaluate("()=>Object.values(ChatGPTNET.app.canvas.entities).filter(e=>e.kind==='anchor').length")==1
        assert page.evaluate("()=>document.querySelector('.cgn-create-popup').hidden") is True
        page.evaluate('''()=>document.querySelector(".cgn-btn[title='连续摘录']").click()''')
        page.evaluate('''async()=>{ChatGPTNET.app.canvasSelection=new Set(Object.keys(ChatGPTNET.app.canvas.canvasPlacements));await ChatGPTNET.app.deleteSelected();}''');page.wait_for_timeout(120)

        # A range spanning two messages is split at message boundaries and created atomically.
        before_undo=page.evaluate("()=>ChatGPTNET.app.undoStack.length")
        page.evaluate('''()=>{const ms=document.querySelectorAll('[data-message-author-role]'),a=ms[0].firstChild,b=ms[1].firstChild,r=document.createRange();r.setStart(a,a.data.indexOf('inside'));r.setEnd(b,b.data.indexOf('selection')+9);const s=getSelection();s.removeAllRanges();s.addRange(r);ms[1].dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));}''');page.wait_for_timeout(90)
        assert popup.is_visible();popup.click();page.wait_for_timeout(220)
        cross=page.evaluate("before=>({anchors:Object.values(ChatGPTNET.app.canvas.entities).filter(e=>e.kind==='anchor').length,undoDelta:ChatGPTNET.app.undoStack.length-before})",before_undo)
        assert cross=={'anchors':2,'undoDelta':1}, cross
        page.evaluate('''async()=>{ChatGPTNET.app.canvasSelection=new Set(Object.keys(ChatGPTNET.app.canvas.canvasPlacements));await ChatGPTNET.app.deleteSelected();}''');page.wait_for_timeout(120)

        # 2) node click must not recreate/detach the node or leave an orphan ghost.
        page.evaluate('''async()=>{await ChatGPTNET.app.createFreeNode();}''')
        page.wait_for_timeout(80)
        page.keyboard.press('Escape')
        page.wait_for_timeout(50)
        node=page.locator('.cgn-node').first
        assert node.count()==1
        box=node.bounding_box(); assert box
        page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
        page.wait_for_timeout(50)
        click_state=page.evaluate("()=>({nodes:document.querySelectorAll('.cgn-node').length,ghosts:document.querySelectorAll('.cgn-ghost').length,selected:document.querySelectorAll('.cgn-node.selected').length,drag:!!ChatGPTNET.app.drag})")
        assert click_state=={'nodes':1,'ghosts':0,'selected':1,'drag':False}, click_state

        # Drag should move the real node and clean its temporary ghost.
        before=page.evaluate("()=>{const id=Object.keys(ChatGPTNET.app.canvas.canvasPlacements)[0],p=ChatGPTNET.app.canvas.canvasPlacements[id];return{id,x:p.x,y:p.y}}")
        box=node.bounding_box();
        page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
        page.mouse.down()
        page.mouse.move(box['x']+box['width']/2+80,box['y']+box['height']/2+40,steps=8)
        page.mouse.up()
        page.wait_for_timeout(180)
        after=page.evaluate("id=>{const p=ChatGPTNET.app.canvas.canvasPlacements[id];return{x:p.x,y:p.y,ghosts:document.querySelectorAll('.cgn-ghost').length,drag:!!ChatGPTNET.app.drag}}",before['id'])
        assert (after['x'],after['y'])!=(before['x'],before['y']), (before,after)
        assert after['ghosts']==0 and after['drag'] is False, after

        # Delete must remove the node with no orphan visual box.
        page.locator('.cgn-btn',has_text='删除').click()
        page.wait_for_timeout(150)
        deleted=page.evaluate("()=>({nodes:document.querySelectorAll('.cgn-node').length,ghosts:document.querySelectorAll('.cgn-ghost').length})")
        assert deleted=={'nodes':0,'ghosts':0}, deleted

        # 3) actual pointer hierarchy gesture: drag one root onto another, then unlink.
        page.evaluate('''async()=>{await ChatGPTNET.app.createFreeNode();}'''); page.wait_for_timeout(60); page.keyboard.press('Escape')
        page.evaluate('''async()=>{await ChatGPTNET.app.createFreeNode();}'''); page.wait_for_timeout(60); page.keyboard.press('Escape')
        nodes=page.locator('.cgn-node'); assert nodes.count()==2
        b0=nodes.nth(0).bounding_box(); b1=nodes.nth(1).bounding_box(); assert b0 and b1
        relation_before=page.evaluate("()=>structuredClone(ChatGPTNET.app.canvas.canvasPlacements)")
        page.evaluate('''()=>{const a=ChatGPTNET.app,original=a.finishRelationDrop.bind(a);a.finishRelationDrop=async(...args)=>{const started=performance.now();try{return await original(...args);}finally{window.__relationDropMs=performance.now()-started;}};}''')
        page.mouse.move(b0['x']+b0['width']/2,b0['y']+b0['height']/2); page.mouse.down(); page.mouse.move(b1['x']+b1['width']/2,b1['y']+b1['height']/2,steps=10); page.mouse.up(); page.wait_for_timeout(300)
        relation=page.evaluate('''before=>{const a=ChatGPTNET.app,e=Object.values(a.canvas.relations)[0],p=a.canvas.canvasPlacements[e.parentId],c=a.canvas.canvasPlacements[e.childId],route=ChatGPTNET.Router.routeAll(a.canvas,[],a.routes);return{count:Object.keys(a.canvas.relations).length,route:route.ok,points:route.routes[e.relationId]?.length,parentAbove:p.y+p.height<c.y,centered:Math.abs(p.x+p.width/2-c.x-c.width/2)<2,componentArranged:p.x!==before[e.parentId].x||p.y!==before[e.parentId].y||c.x!==before[e.childId].x||c.y!==before[e.childId].y,dropMs:window.__relationDropMs,overlap:!ChatGPTNET.Schema.validateCanvas(a.canvas),ghosts:document.querySelectorAll('.cgn-ghost').length};}''',relation_before)
        assert relation['count']==1 and relation['route'] is True and relation['points']<=4 and relation['parentAbove'] is True and relation['centered'] is True and relation['componentArranged'] is True, relation
        assert relation['dropMs']<700 and relation['overlap'] is False and relation['ghosts']==0, relation
        page.locator('.cgn-btn',has_text='解除').click(); page.wait_for_timeout(180)
        assert page.evaluate("()=>Object.keys(ChatGPTNET.app.canvas.relations).length")==0

        # Low-bend organization-chart buses are shared by siblings. Legal routes and their SVG
        # elements remain unchanged when an unrelated free node or another component moves.
        stable_routes=page.evaluate('''async()=>{
          const a=ChatGPTNET.app;
          await a.mutate(c=>{
            c.entities={};c.canvasPlacements={};c.relations={};c.memoPlacements={};c.memoSections={};c.memoOrder=[];c.view.autoGroupIds=[];
            const specs=[['p',1250,450],['a',1150,700],['b',1450,700],['q',1850,450],['d',1850,700],['free',2200,900]];
            for(const[id,x,y]of specs){const e=ChatGPTNET.Schema.newEntity({kind:'free',text:id,color:ChatGPTNET.C.COLORS[0]});e.entityId=id;c.entities[id]=e;c.canvasPlacements[id]={entityId:id,x,y,width:176,height:52,subtreeCollapsed:false};}
            ChatGPTNET.Graph.addEdge(c,'p','a');ChatGPTNET.Graph.addEdge(c,'p','b');ChatGPTNET.Graph.addEdge(c,'q','d');return true;
          });
          const first=structuredClone(a.routes),ea='p=>a',eb='p=>b',other='q=>d';window.__stableOtherEdge=document.querySelector(`.cgn-edge[data-edge-id="${other}"]`);window.__stableSiblingEdge=document.querySelector(`.cgn-edge[data-edge-id="${eb}"]`);
          const shared=first[ea].length<=4&&first[eb].length<=4&&first[ea][0].x===first[eb][0].x&&first[ea][0].y===first[eb][0].y&&ChatGPTNET.Router.sharedTrunkAt(a.canvas,first,ea,first[ea][1]);
          await a.mutate(c=>{c.canvasPlacements.free.x+=80;return true;});
          const freeStable=JSON.stringify(a.routes)===JSON.stringify(first),freeDom=document.querySelector(`.cgn-edge[data-edge-id="${other}"]`)===window.__stableOtherEdge;
          const otherBefore=JSON.stringify(a.routes[other]),siblingBefore=JSON.stringify(a.routes[eb]),stationaryBefore=JSON.stringify([a.canvas.canvasPlacements.p,a.canvas.canvasPlacements.b]),ap=a.canvas.canvasPlacements.a;await a.finishMoveDrop({ids:['a'],orig:{a:{x:ap.x,y:ap.y}},dx:-40,dy:0});
          const started=performance.now();for(let i=0;i<20;i++)a.render();const renderMs=performance.now()-started;
          return{shared,freeStable,freeDom,componentStable:JSON.stringify(a.routes[other])===otherBefore,componentDom:document.querySelector(`.cgn-edge[data-edge-id="${other}"]`)===window.__stableOtherEdge,siblingStable:JSON.stringify(a.routes[eb])===siblingBefore,siblingDom:document.querySelector(`.cgn-edge[data-edge-id="${eb}"]`)===window.__stableSiblingEdge,stationary:JSON.stringify([a.canvas.canvasPlacements.p,a.canvas.canvasPlacements.b])===stationaryBefore,pointsA:first[ea].length,pointsB:first[eb].length,renderMs};
        }''')
        assert stable_routes['shared'] and stable_routes['freeStable'] and stable_routes['freeDom'], stable_routes
        assert stable_routes['componentStable'] and stable_routes['componentDom'] and stable_routes['siblingStable'] and stable_routes['siblingDom'] and stable_routes['stationary'], stable_routes
        assert stable_routes['renderMs']<1500, stable_routes
        # Amended Baseline 1.3 clause 83: unrelated co-parents are allowed, but a later relation
        # between those parents is rejected with the specific message and no data mutation.
        multiparent=page.evaluate('''async()=>{
          const a=ChatGPTNET.app;await a.mutate(c=>{c.relations={};Object.assign(c.canvasPlacements.p,{x:1000,y:500});Object.assign(c.canvasPlacements.q,{x:1500,y:500});Object.assign(c.canvasPlacements.a,{x:1250,y:800});ChatGPTNET.Graph.addEdge(c,'p','a');ChatGPTNET.Graph.addEdge(c,'q','a');return true;});
          const before=JSON.stringify(a.canvas),p=a.canvas.canvasPlacements.q,d={ids:['q'],orig:{q:{x:p.x,y:p.y}},dx:0,dy:0};await a.finishRelationDrop(d,'p');
          return{unchanged:JSON.stringify(a.canvas)===before,relations:Object.keys(a.canvas.relations).length,toast:[...document.querySelectorAll('.cgn-toast')].at(-1)?.textContent||''};
        }''')
        assert multiparent['unchanged'] and multiparent['relations']==2 and '多个上游节点' in multiparent['toast'], multiparent

        # A realistic multi-parent graph must remain top-down and structured even when unrelated
        # notes occupy the component's first-choice layout area.
        complex_hierarchy=page.evaluate('''async()=>{
          const a=ChatGPTNET.app,specs=[['r',1200,700],['p',1650,700],['a',1050,1000],['b',1250,1000],['shared',1450,1000],['a1',1050,1250],['p1',1700,1000],['note1',1150,840],['note2',1450,840]];
          await a.mutate(c=>{c.entities={};c.canvasPlacements={};c.relations={};c.memoPlacements={};c.memoSections={};c.memoOrder=[];c.view.autoGroupIds=[];for(const[id,x,y]of specs){const e=ChatGPTNET.Schema.newEntity({kind:'free',text:id,color:ChatGPTNET.C.COLORS[0]});e.entityId=id;c.entities[id]=e;c.canvasPlacements[id]={entityId:id,x,y,width:150,height:52,subtreeCollapsed:false};}return true;});
          const notes=JSON.stringify([a.canvas.canvasPlacements.note1,a.canvas.canvasPlacements.note2]),started=performance.now(),rel=async(child,parent)=>{const p=a.canvas.canvasPlacements[child];await a.finishRelationDrop({ids:[child],orig:{[child]:{x:p.x,y:p.y}},dx:0,dy:0},parent);};
          await rel('a','r');await rel('b','r');await rel('shared','r');await rel('a1','a');await rel('p1','p');await rel('shared','p');
          const edges=ChatGPTNET.Graph.edges(a.canvas),component=Object.keys(a.canvas.canvasPlacements).filter(id=>!id.startsWith('note')),structured=ChatGPTNET.Router.routeHierarchy(a.canvas,component,{}),down=edges.every(e=>{const p=a.canvas.canvasPlacements[e.parentId],c=a.canvas.canvasPlacements[e.childId];return p.y+p.height<c.y;});
          const layoutMs=performance.now()-started,ps=Object.values(a.canvas.canvasPlacements),minX=Math.min(...ps.map(x=>x.x)),maxX=Math.max(...ps.map(x=>x.x+x.width)),minY=Math.min(...ps.map(x=>x.y)),maxY=Math.max(...ps.map(x=>x.y+x.height)),z=.4;a.canvas.view.zoom=z;a.canvas.view.panX=(minX+maxX)/2-a.canvasWrap.clientWidth/z/2;a.canvas.view.panY=(minY+maxY)/2-a.canvasWrap.clientHeight/z/2;a.clampPan(false);a.render();return{count:edges.length,down,structured:structured.ok,short:structured.ok&&Object.values(structured.routes).every(path=>path.length<=4),notesStable:JSON.stringify([a.canvas.canvasPlacements.note1,a.canvas.canvasPlacements.note2])===notes,valid:ChatGPTNET.Schema.validateCanvas(a.canvas)&&ChatGPTNET.Router.routeAll(a.canvas,[],a.routes).ok,layoutMs};
        }''')
        assert all(complex_hierarchy[k]==v for k,v in {'count':6,'down':True,'structured':True,'short':True,'notesStable':True,'valid':True}.items()), complex_hierarchy
        assert complex_hierarchy['layoutMs']<700, complex_hierarchy

        # A persisted pre-upgrade layout is repaired once on load. Unrelated notes stay fixed,
        # every relation points downward, and no A* detour remains in the migrated component.
        migrated=page.evaluate('''async()=>{
          const a=ChatGPTNET.app,legacy=structuredClone(a.canvas),pos={r:[1200,900],p:[1720,900],a:[760,650],b:[1080,1120],shared:[1460,650],a1:[440,920],p1:[2100,1120],note1:[120,2600],note2:[430,2600]};
          for(const[id,xy]of Object.entries(pos))Object.assign(legacy.canvasPlacements[id],{x:xy[0],y:xy[1]});delete legacy.view.hierarchyLayoutVersion;window.__mockCanvas=legacy;const noteBefore=JSON.stringify([legacy.canvasPlacements.note1,legacy.canvasPlacements.note2]),revision=legacy.revision;await a.loadConversation('test-conversation');
          const component=Object.keys(a.canvas.canvasPlacements).filter(id=>!id.startsWith('note')),rr=ChatGPTNET.Router.routeHierarchy(a.canvas,component,{}),down=ChatGPTNET.Graph.edges(a.canvas).every(e=>{const p=a.canvas.canvasPlacements[e.parentId],c=a.canvas.canvasPlacements[e.childId];return p.y+p.height<c.y;});
          return{version:a.canvas.view.hierarchyLayoutVersion,revision:a.canvas.revision,saved:window.__mockCanvas.view.hierarchyLayoutVersion,down,structured:rr.ok,short:rr.ok&&Object.values(rr.routes).every(path=>path.length<=4),notesStable:JSON.stringify([a.canvas.canvasPlacements.note1,a.canvas.canvasPlacements.note2])===noteBefore,undo:a.undoStack.length,valid:ChatGPTNET.Schema.validateCanvas(a.canvas),oldRevision:revision};
        }''')
        assert migrated['version']==1 and migrated['saved']==1 and migrated['revision']>migrated['oldRevision'], migrated
        assert migrated['down'] and migrated['structured'] and migrated['short'] and migrated['notesStable'] and migrated['undo']==0 and migrated['valid'], migrated

        # Blank-canvas movement is a position intent. A legal connected-node move preserves the
        # drop without rearranging the hierarchy; an illegal move is cancelled rather than
        # silently snapping the whole component back into an automatic layout.
        connected_move=page.evaluate('''async()=>{const a=ChatGPTNET.app,id='shared',p=a.canvas.canvasPlacements[id],component=ChatGPTNET.Hierarchy.component(a.canvas,[id]),stationary=Object.fromEntries(component.filter(x=>x!==id).map(x=>[x,structuredClone(a.canvas.canvasPlacements[x])])),before={x:p.x,y:p.y};await a.finishMoveDrop({ids:[id],orig:{[id]:before},dx:72,dy:0});const after={x:a.canvas.canvasPlacements[id].x,y:a.canvas.canvasPlacements[id].y},manual=after.x!==before.x||after.y!==before.y,othersStable=Object.entries(stationary).every(([x,q])=>JSON.stringify(a.canvas.canvasPlacements[x])===JSON.stringify(q)),accepted=structuredClone(a.canvas),undo=a.undoStack.length;const now=a.canvas.canvasPlacements[id];await a.finishMoveDrop({ids:[id],orig:{[id]:{x:now.x,y:now.y}},dx:0,dy:-900});return{manual,othersStable,rejected:JSON.stringify(a.canvas)===JSON.stringify(accepted),undoSingle:a.undoStack.length===undo,valid:ChatGPTNET.Schema.validateCanvas(a.canvas)&&ChatGPTNET.Router.routeAll(a.canvas,[],a.routes).ok};}''')
        assert all(connected_move.values()), connected_move

        # Moving the root of an independent subtree translates every member and internal route by
        # one rigid offset. Adding an outside co-parent removes that subtree privilege.
        rigid_subtree=page.evaluate('''async()=>{const a=ChatGPTNET.app;await a.mutate(c=>{c.entities={};c.canvasPlacements={};c.relations={};c.memoPlacements={};c.memoSections={};c.memoOrder=[];for(const[id,x,y]of[['root',900,500],['child',900,780],['leaf',900,1060],['outside',1700,500]]){const e=ChatGPTNET.Schema.newEntity({kind:'free',text:id,color:ChatGPTNET.C.COLORS[0]});e.entityId=id;c.entities[id]=e;c.canvasPlacements[id]={entityId:id,x,y,width:150,height:52,subtreeCollapsed:false};}ChatGPTNET.Graph.addEdge(c,'root','child');ChatGPTNET.Graph.addEdge(c,'child','leaf');return true;});const ids=['root','child','leaf'],before=Object.fromEntries(ids.map(id=>[id,structuredClone(a.canvas.canvasPlacements[id])])),routes=structuredClone(a.routes),p=a.canvas.canvasPlacements.root;await a.finishMoveDrop({ids:['root'],orig:{root:{x:p.x,y:p.y}},dx:240,dy:120});const dx=a.canvas.canvasPlacements.root.x-before.root.x,dy=a.canvas.canvasPlacements.root.y-before.root.y,rigid=ids.every(id=>a.canvas.canvasPlacements[id].x-before[id].x===dx&&a.canvas.canvasPlacements[id].y-before[id].y===dy),routeRigid=Object.entries(routes).every(([eid,path])=>JSON.stringify(a.routes[eid])===JSON.stringify(path.map(q=>({x:q.x+dx,y:q.y+dy}))));await a.mutate(c=>{ChatGPTNET.Graph.addEdge(c,'outside','child');return true;});return{rigid,routeRigid,independent:ChatGPTNET.Graph.independentSubtree(a.canvas,'root')===null,valid:ChatGPTNET.Schema.validateCanvas(a.canvas)&&ChatGPTNET.Router.routeAll(a.canvas,[],a.routes).ok};}''')
        assert all(rigid_subtree.values()), rigid_subtree

        # Project URL changes keep the same conversation id and therefore reuse the exact canvas;
        # a genuinely new conversation id does not infer migration from title or content.
        project_move=page.evaluate('''async()=>{const a=ChatGPTNET.app,original=ChatGPTNET.Chat.conversationId,canvasId=a.canvas.canvasId,revision=a.canvas.revision;history.replaceState({},'', '/g/project-a/c/test-conversation');const idA=original();await a.onNavigation();history.replaceState({},'', '/g/project-b/c/test-conversation');const idB=original();await a.onNavigation();history.replaceState({},'', '/c/test-conversation');const idOut=original();await a.onNavigation();return{idA,idB,idOut,same:a.canvas.canvasId===canvasId&&a.canvas.revision===revision,stored:window.__mockCanvas.canvasId===canvasId};}''')
        assert project_move=={'idA':'test-conversation','idB':'test-conversation','idOut':'test-conversation','same':True,'stored':True}, project_move
        if os.environ.get('CHATGPT_NET_SCREENSHOT'):
            side=page.locator('.cgn-sidebar').bounding_box();assert side
            page.screenshot(path=os.environ['CHATGPT_NET_SCREENSHOT'],clip=side)

        # Hot interaction paths must not recreate all nodes or reroute the graph. The large DOM
        # fixture uses legal isolated notes to keep this a renderer/gesture test rather than a
        # routing stress test.
        interaction_perf=page.evaluate('''async()=>{const a=ChatGPTNET.app;await a.mutate(c=>{c.entities={};c.canvasPlacements={};c.relations={};c.memoPlacements={};c.memoSections={};c.memoOrder=[];for(let i=0;i<360;i++){const id=`perf${i}`,e=ChatGPTNET.Schema.newEntity({kind:'free',text:id,color:ChatGPTNET.C.COLORS[0]});e.entityId=id;c.entities[id]=e;c.canvasPlacements[id]={entityId:id,x:20+(i%20)*140,y:20+Math.floor(i/20)*132,width:110,height:52,subtreeCollapsed:false};}return true;});const nodes=[...document.querySelectorAll('.cgn-node')],first=nodes[0],started=performance.now();for(let i=0;i<100;i++){a.canvasSelection=new Set([`perf${i%360}`]);a.syncSelectionUi();a.canvas.view.panX=i%120;a.canvas.view.panY=i%80;a.applyTransform();}const hotMs=performance.now()-started,same=nodes.every((el,i)=>document.querySelectorAll('.cgn-node')[i]===el),rendered=performance.now();for(let i=0;i<10;i++)a.render();const renderMs=performance.now()-rendered;return{count:document.querySelectorAll('.cgn-node').length,same,hotMs,renderMs,valid:ChatGPTNET.Schema.validateCanvas(a.canvas)};}''')
        assert interaction_perf['count']==360 and interaction_perf['same'] and interaction_perf['valid'], interaction_perf
        assert interaction_perf['hotMs']<500 and interaction_perf['renderMs']<1200, interaction_perf
        # Batch hierarchy is atomic: two selected roots become peers under one common parent, and one undo removes both edges.
        page.evaluate('''async()=>{ChatGPTNET.app.canvasSelection=new Set(Object.keys(ChatGPTNET.app.canvas.canvasPlacements));await ChatGPTNET.app.deleteSelected();await ChatGPTNET.app.createFreeNode();}''');page.wait_for_timeout(60);page.keyboard.press('Escape')
        page.evaluate('''async()=>{await ChatGPTNET.app.createFreeNode();}''');page.wait_for_timeout(60);page.keyboard.press('Escape')
        page.evaluate('''async()=>{await ChatGPTNET.app.createFreeNode();}''');page.wait_for_timeout(60);page.keyboard.press('Escape')
        ids=page.evaluate("()=>Object.keys(ChatGPTNET.app.canvas.canvasPlacements)")
        n0=page.locator(f'.cgn-node[data-id="{ids[0]}"]');n1=page.locator(f'.cgn-node[data-id="{ids[1]}"]');n2=page.locator(f'.cgn-node[data-id="{ids[2]}"]')
        q0=n0.bounding_box();q1=n1.bounding_box();q2=n2.bounding_box();assert q0 and q1 and q2
        page.mouse.click(q0['x']+q0['width']/2,q0['y']+q0['height']/2)
        page.keyboard.down('Control');page.mouse.click(q1['x']+q1['width']/2,q1['y']+q1['height']/2);page.keyboard.up('Control');page.wait_for_timeout(40)
        assert set(page.evaluate("()=>[...ChatGPTNET.app.canvasSelection]"))==set(ids[:2])
        # Ordinary click on one member of a multi-selection must collapse to that object, while an
        # actual drag from a selected member must still preserve and move the whole group.
        page.mouse.click(q0['x']+q0['width']/2,q0['y']+q0['height']/2);page.wait_for_timeout(40)
        assert page.evaluate("()=>[...ChatGPTNET.app.canvasSelection]")==[ids[0]]
        page.keyboard.down('Control');page.mouse.click(q1['x']+q1['width']/2,q1['y']+q1['height']/2);page.keyboard.up('Control');page.wait_for_timeout(40)
        page.mouse.move(q0['x']+q0['width']/2,q0['y']+q0['height']/2);page.mouse.down();page.mouse.move(q2['x']+q2['width']/2,q2['y']+q2['height']/2,steps=10);page.mouse.up();page.wait_for_timeout(350)
        batch=page.evaluate('''ids=>{const a=ChatGPTNET.app,es=Object.values(a.canvas.relations),p=a.canvas.canvasPlacements[ids[2]],cs=ids.slice(0,2).map(id=>a.canvas.canvasPlacements[id]),rs=ChatGPTNET.Router.routeAll(a.canvas,[],a.routes),paths=es.map(e=>rs.routes[e.relationId]);return{count:es.length,parents:[...new Set(es.map(e=>e.parentId))],children:es.map(e=>e.childId).sort(),undo:a.undoStack.length,valid:ChatGPTNET.Schema.validateCanvas(a.canvas)&&rs.ok,parentAbove:cs.every(c=>p.y+p.height<c.y),sameRank:Math.max(...cs.map(c=>c.y))-Math.min(...cs.map(c=>c.y))<2,parentCentered:Math.abs(p.x+p.width/2-(Math.min(...cs.map(c=>c.x))+Math.max(...cs.map(c=>c.x+c.width)))/2)<2,sharedBus:paths.every(path=>path.length<=4)&&paths[0][0].x===paths[1][0].x&&paths[0][0].y===paths[1][0].y&&paths[0][1].x===paths[1][1].x&&paths[0][1].y===paths[1][1].y}}''',ids)
        assert batch['count']==2 and batch['parents']==[ids[2]] and batch['children']==sorted(ids[:2]) and batch['valid'] is True, batch
        assert batch['parentAbove'] and batch['sameRank'] and batch['parentCentered'] and batch['sharedBus'], batch
        page.evaluate('''async()=>{await ChatGPTNET.app.undo();}''');page.wait_for_timeout(220)
        assert page.evaluate("()=>Object.keys(ChatGPTNET.app.canvas.relations).length")==0

        # Canvas-to-memo drag accepts the enlarged split-area target, gives unmistakable feedback,
        # and converts only on release.
        page.evaluate('''async()=>{ChatGPTNET.app.canvasSelection=new Set(Object.keys(ChatGPTNET.app.canvas.canvasPlacements));await ChatGPTNET.app.deleteSelected();await ChatGPTNET.app.createFreeNode();}''');page.wait_for_timeout(60);page.keyboard.press('Escape')
        mn=page.locator('.cgn-node').first;mb=mn.bounding_box();mr=page.locator('.cgn-memo').bounding_box();sr=page.locator('.cgn-split').bounding_box();assert mb and mr and sr
        page.mouse.move(mb['x']+mb['width']/2,mb['y']+mb['height']/2);page.mouse.down();page.mouse.move(mb['x']+mb['width']/2+16,mb['y']+mb['height']/2+16,steps=4);page.mouse.move(mr['x']+mr['width']/2,sr['y']-10,steps=14);page.wait_for_timeout(80)
        drop_feedback=page.evaluate("()=>({ghosts:document.querySelectorAll('.cgn-ghost[data-cgn-node-ghost]').length,active:document.querySelector('.cgn-memo').classList.contains('node-drop-active')})")
        assert drop_feedback=={'ghosts':1,'active':True}, drop_feedback
        page.mouse.up();page.wait_for_timeout(220)
        memo_state=page.evaluate("()=>({canvas:Object.keys(ChatGPTNET.app.canvas.canvasPlacements).length,memo:Object.keys(ChatGPTNET.app.canvas.memoPlacements).length,ghosts:document.querySelectorAll('.cgn-ghost').length})")
        assert memo_state=={'canvas':0,'memo':1,'ghosts':0}, memo_state

        # Single memo item can be dragged back through the real HTML5 DnD path and becomes a root.
        cw=page.locator('.cgn-canvas-wrap');cwb=cw.bounding_box();assert cwb
        page.locator('.cgn-memo-item[data-id]').first.drag_to(cw,target_position={'x':cwb['width']*.55,'y':cwb['height']*.45})
        page.wait_for_timeout(300)
        back=page.evaluate("()=>({canvas:Object.keys(ChatGPTNET.app.canvas.canvasPlacements).length,memo:Object.keys(ChatGPTNET.app.canvas.memoPlacements).length,relations:Object.keys(ChatGPTNET.app.canvas.relations).length,valid:ChatGPTNET.Schema.validateCanvas(ChatGPTNET.app.canvas)&&ChatGPTNET.Router.routeAll(ChatGPTNET.app.canvas).ok})")
        assert back=={'canvas':1,'memo':0,'relations':0,'valid':True}, back
        page.evaluate('''async()=>{ChatGPTNET.app.canvasSelection=new Set(Object.keys(ChatGPTNET.app.canvas.canvasPlacements));await ChatGPTNET.app.deleteSelected();}''');page.wait_for_timeout(120)

        # Multi-memo drag-back is all-or-none and consumes one undo record for the return operation.
        page.evaluate('''async()=>{await ChatGPTNET.app.createFreeNode();}''');page.wait_for_timeout(50);page.keyboard.press('Escape')
        page.evaluate('''async()=>{await ChatGPTNET.app.createFreeNode();}''');page.wait_for_timeout(50);page.keyboard.press('Escape')
        page.evaluate('''async()=>{const ids=Object.keys(ChatGPTNET.app.canvas.canvasPlacements);await ChatGPTNET.app.toMemo(ids);}''');page.wait_for_timeout(140)
        assert page.evaluate("()=>ChatGPTNET.app.memoSelection.size")==2
        cwb=cw.bounding_box();assert cwb
        page.locator('.cgn-memo-item[data-id]').first.drag_to(cw,target_position={'x':cwb['width']*.5,'y':cwb['height']*.5})
        page.wait_for_timeout(350)
        multi_back=page.evaluate("()=>({canvas:Object.keys(ChatGPTNET.app.canvas.canvasPlacements).length,memo:Object.keys(ChatGPTNET.app.canvas.memoPlacements).length,valid:ChatGPTNET.Schema.validateCanvas(ChatGPTNET.app.canvas)&&ChatGPTNET.Router.routeAll(ChatGPTNET.app.canvas).ok})")
        assert multi_back=={'canvas':2,'memo':0,'valid':True}, multi_back
        page.evaluate('''async()=>{await ChatGPTNET.app.undo();}''');page.wait_for_timeout(220)
        assert page.evaluate("()=>({canvas:Object.keys(ChatGPTNET.app.canvas.canvasPlacements).length,memo:Object.keys(ChatGPTNET.app.canvas.memoPlacements).length})")=={'canvas':0,'memo':2}
        group_visual=page.evaluate('''async()=>{const a=ChatGPTNET.app,ids=Object.keys(a.canvas.memoPlacements),now=Date.now();await a.mutate(c=>{c.memoSections.s1={sectionId:'s1',title:'Grouped notes',collapsed:false,itemIds:[...ids],createdAt:now,modifiedAt:now};ids.forEach(id=>c.memoPlacements[id].sectionId='s1');c.memoOrder=['s:s1'];return true;},{validateRoutes:false});const sec=document.querySelector('.cgn-section'),head=document.querySelector('.cgn-section-head'),body=document.querySelector('.cgn-section-drop'),item=body?.querySelector('.cgn-memo-item'),style=getComputedStyle(sec),itemStyle=getComputedStyle(item);return{badge:document.querySelector('.cgn-section-badge')?.textContent,items:body?.querySelectorAll('.cgn-memo-item').length,border:parseFloat(style.borderLeftWidth),background:style.backgroundColor,itemHeight:item?.getBoundingClientRect().height,headHeight:head?.getBoundingClientRect().height,itemMargin:parseFloat(itemStyle.marginTop)+parseFloat(itemStyle.marginBottom),sectionMargin:parseFloat(style.marginTop)+parseFloat(style.marginBottom)};}''')
        assert group_visual['badge']=='分组' and group_visual['items']==2 and group_visual['border']>=3, group_visual
        assert group_visual['itemHeight']<=28 and group_visual['headHeight']<=24 and group_visual['itemMargin']<=4 and group_visual['sectionMargin']<=7, group_visual
        page.evaluate("async()=>{await ChatGPTNET.app.deleteSection('s1');}");page.wait_for_timeout(100)
        page.evaluate('''async()=>{ChatGPTNET.app.memoSelection=new Set(Object.keys(ChatGPTNET.app.canvas.memoPlacements));await ChatGPTNET.app.deleteSelected();}''');page.wait_for_timeout(150)

        # 4) anchor highlight follows entity actual color.
        page.evaluate('''async()=>{
          await ChatGPTNET.app.applyColorSlot(1);
          const msg=document.querySelector('[data-message-author-role]'),info=ChatGPTNET.Chat.messageInfo(msg),quote='unique highlight target',raw=info.text,idx=raw.indexOf(quote);
          await ChatGPTNET.app.createFromSelection([{text:quote,originalText:quote,anchor:{conversationId:ChatGPTNET.Chat.conversationId(),messageId:info.messageId,messageIndex:info.index,role:info.role,messageTextHash:info.messageTextHash,quote,prefix:raw.slice(Math.max(0,idx-48),idx),suffix:raw.slice(idx+quote.length,idx+quote.length+48)}}]);
          ChatGPTNET.app.renderHighlightsSoon();
        }''')
        page.wait_for_timeout(220)
        colors=page.evaluate('''()=>{const e=Object.values(ChatGPTNET.app.canvas.entities).find(x=>x.kind==='anchor'),h=document.querySelector('.cgn-highlight');return{entity:e?.color,node:[...document.querySelectorAll('.cgn-node')].find(n=>n.textContent.includes('unique highlight target'))?.style.background,highlight:h?.style.background,border:h?.style.borderBottomColor}}''')
        assert colors['entity']=='#C9D9C5', colors
        assert colors['node']=='rgb(201, 217, 197)', colors
        assert '201, 217, 197' in (colors['highlight'] or ''), colors
        anchor_batch=page.evaluate('''()=>{const anchor=Object.values(ChatGPTNET.app.canvas.entities).find(x=>x.anchor).anchor,original=document.createTreeWalker.bind(document);let walks=0;document.createTreeWalker=(...args)=>{walks++;return original(...args);};const started=performance.now(),index=ChatGPTNET.Chat.buildMessageIndex();for(let i=0;i<50;i++)ChatGPTNET.Chat.locateAnchor(anchor,index);const ms=performance.now()-started;document.createTreeWalker=original;return{walks,ms,messages:index.records.length};}''')
        assert anchor_batch['walks']==anchor_batch['messages'] and anchor_batch['ms']<100, anchor_batch

        # Canvas/memo selections must never coexist, including the Shift+anchor navigation path.
        page.evaluate('''async()=>{await ChatGPTNET.app.createFreeNode();}''');page.wait_for_timeout(60);page.keyboard.press('Escape')
        free_id=page.evaluate("()=>Object.keys(ChatGPTNET.app.canvas.canvasPlacements).find(id=>ChatGPTNET.app.canvas.entities[id].kind==='free')")
        page.evaluate("async id=>{await ChatGPTNET.app.toMemo([id]);}",free_id);page.wait_for_timeout(120)
        assert page.evaluate("()=>ChatGPTNET.app.memoSelection.size")==1
        anchor_id=page.evaluate("()=>Object.keys(ChatGPTNET.app.canvas.canvasPlacements).find(id=>ChatGPTNET.app.canvas.entities[id].kind==='anchor')")
        ab=page.locator(f'.cgn-node[data-id="{anchor_id}"]').bounding_box();assert ab
        page.keyboard.down('Shift');page.mouse.click(ab['x']+ab['width']/2,ab['y']+ab['height']/2);page.keyboard.up('Shift');page.wait_for_timeout(160)
        exclusive=page.evaluate("()=>({canvas:ChatGPTNET.app.canvasSelection.size,memo:ChatGPTNET.app.memoSelection.size})")
        assert exclusive['memo']==0, exclusive
        page.evaluate("id=>{ChatGPTNET.app.memoSelection=new Set([id]);ChatGPTNET.app.canvasSelection.clear();}",free_id)
        page.evaluate('''async()=>{await ChatGPTNET.app.deleteSelected();}''');page.wait_for_timeout(100)

        # Canvas gestures are fully contained and never scroll the ChatGPT conversation.
        cb=page.locator('.cgn-canvas-wrap').bounding_box(); assert cb
        page.evaluate("()=>{document.querySelector('.viewport-shell').scrollTop=320;}")
        scroll_before=page.evaluate("()=>document.querySelector('.viewport-shell').scrollTop")
        page.mouse.click(cb['x']+20,cb['y']+20);page.mouse.move(cb['x']+30,cb['y']+30);page.mouse.wheel(0,420);page.wait_for_timeout(80)
        scroll_after=page.evaluate("()=>document.querySelector('.viewport-shell').scrollTop")
        assert scroll_before==320 and scroll_after==scroll_before, (scroll_before,scroll_after)

        # 5) toolbar close removes UI, restores page width, stops runtime listeners/timers, and
        # cancels any page gesture that is still active when browser chrome is clicked.
        page.mouse.move(cb['x']+20,cb['y']+20);page.mouse.down();page.wait_for_timeout(20)
        assert page.evaluate("()=>!!ChatGPTNET.app.pan") is True
        page.evaluate("()=>ChatGPTNET.UI.toast(ChatGPTNET.C.MESSAGES.SAVE_FAILED)")
        page.evaluate("async()=>{await window.__runtimeListeners[0]({type:'TAB_ENABLED',enabled:false});}")
        page.wait_for_timeout(120);page.mouse.up()
        closed=page.evaluate('''()=>({sidebar:!!document.querySelector('.cgn-sidebar'),highlights:document.querySelectorAll('.cgn-highlight').length,toasts:document.querySelectorAll('.cgn-toast').length,reserved:document.querySelectorAll('[data-chatgpt-net-reserved]').length,appRight:document.querySelector('#app-shell').getBoundingClientRect().right,runtime:ChatGPTNET.app.runtimeActive,sleepTimer:ChatGPTNET.app.sleepTimer,storageListeners:window.__storageListeners.size,pan:ChatGPTNET.app.pan,drag:ChatGPTNET.app.drag,resize:ChatGPTNET.app.resize,split:ChatGPTNET.app.splitDrag,sidebarDrag:ChatGPTNET.app.sidebarDrag})''')
        assert closed['sidebar'] is False and closed['highlights']==0 and closed['reserved']==0, closed
        assert closed['toasts']==1, closed
        assert abs(closed['appRight']-1564)<=2, closed
        assert closed['runtime'] is False and closed['sleepTimer'] is None and closed['storageListeners']==0, closed
        assert closed['pan'] is None and closed['drag'] is None and closed['resize'] is None and closed['split'] is None and closed['sidebarDrag'] is None, closed

        # Reopen via the same toolbar message path.
        page.evaluate("async()=>{await window.__runtimeListeners[0]({type:'TAB_ENABLED',enabled:true});}")
        page.wait_for_function("document.querySelector('.cgn-sidebar') && ChatGPTNET.app.runtimeActive === true")
        reopened=page.evaluate("()=>({colors:document.querySelectorAll('.cgn-color').length,storageListeners:window.__storageListeners.size,reserved:document.querySelectorAll('[data-chatgpt-net-reserved]').length})")
        assert reopened['colors']==3 and reopened['storageListeners']==1 and reopened['reserved']>=1, reopened

        # Invalid persisted data is never replaced with a blank writable canvas.
        invalid=page.evaluate('''async()=>{const saved=structuredClone(window.__mockCanvas),id=Object.keys(saved.canvasPlacements)[0];window.__mockCanvas=structuredClone(saved);window.__mockCanvas.canvasPlacements[id].height=1;await ChatGPTNET.app.loadConversation('test-conversation');const state={blocked:ChatGPTNET.app.dataInvalid,canvas:ChatGPTNET.app.canvas,storedHeight:window.__mockCanvas.canvasPlacements[id].height};window.__mockCanvas=saved;await ChatGPTNET.app.loadConversation('test-conversation');return state;}''')
        assert invalid['blocked'] is True and invalid['canvas'] is None and invalid['storedHeight']==1, invalid

        context.close();browser.close()
        print(json.dumps({'browser_integration':'PASS','engine':engine,'relationDropMs':round(relation['dropMs'],1),'complexHierarchyMs':round(complex_hierarchy['layoutMs'],1),'stableRender20Ms':round(stable_routes['renderMs'],1),'manualConnectedMove':connected_move,'rigidSubtree':rigid_subtree,'projectMove':project_move,'interaction360Hot100Ms':round(interaction_perf['hotMs'],1),'interaction360Render10Ms':round(interaction_perf['renderMs'],1),'anchorBatchMs':round(anchor_batch['ms'],1),'reservationBoundary':boundary,'toolbar':metrics['toolbar'],'highlightColor':colors['entity']}))

if __name__=='__main__':
    try: main()
    except Exception as e:
        print(f'browser_integration.py: FAIL: {e}',file=sys.stderr)
        raise
