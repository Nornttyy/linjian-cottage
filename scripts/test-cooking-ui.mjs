import assert from 'node:assert/strict';
import {mkdirSync,symlinkSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileProject} from './test-support.mjs';

const project=compileProject({name:'cooking-ui'});
let passed=0,failed=0;
const clients=[],globals=['window','Image','requestAnimationFrame','cancelAnimationFrame','localStorage','setTimeout','clearTimeout'];
const originals=new Map(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
const savedNow=Date.now;
try{
    const [sim,act,cooking,world,{GameClient}]=await Promise.all(['simulation','activities','cooking','world','client'].map(name=>import(project.module(name))));
    const test=async(name,fn)=>{try{await fn();passed++;console.log('PASS',name);}catch(error){failed++;console.error('FAIL',name,error.stack);}};
    function fixture(){const now=100000,s=sim.createWorld(now),p=sim.createPlayer('p','secret','Chef',0,now);s.players={p};s.mobs=[];for(const r of world.RESOURCE_MAP.values())s.depleted[r.id]=true;p.x=act.CAMPFIRE.x;p.y=act.CAMPFIRE.y-2.2;sim.normalizeWorld(s,now);p.inventory.fish=6;p.inventory.wood=20;p.inventory.salmon=3;p.inventory.rice=3;p.inventory.nori=3;return{s,p,now};}
    const callbacks={onClose(){},onCook(){return false;},onPantry(){return false;}};
    const props=f=>({player:f.p,busy:false,supported:true,connected:true,...callbacks});

    // Real React server rendering checks semantic HTML independently of the click harness.
    symlinkSync(join(project.source,'node_modules'),join(project.temp,'node_modules'),'dir');
    const require=createRequire(join(project.source,'package.json'));
    const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
    project.compileFile('components/ItemIcon.tsx');
    const {default:ServerPanel}=await import(project.compileFile('components/CookingPanel.tsx'));
    await test('React SSR emits one modal, five named slots, six methods and no automatic action',()=>{
        const f=fixture(),calls=[];
        const html=renderToStaticMarkup(React.createElement(ServerPanel,{...props(f),onCook:(...args)=>{calls.push(args);return true;}}));
        assert.match(html,/role="dialog"/);assert.match(html,/aria-modal="true"/);
        assert.equal((html.match(/aria-label="食材槽[1-5]：空"/g)??[]).length,5);
        for(const entry of Object.values(cooking.COOK_METHODS))assert(html.includes(entry.name),entry.name);
        assert.match(html,/class="cook-submit" disabled=""/);assert.equal(calls.length,0);
    });
    await test('React SSR for an older server explains capability and hides actionable cooking controls',()=>{
        const html=renderToStaticMarkup(React.createElement(ServerPanel,{...props(fixture()),supported:false}));
        assert(html.includes('尚未支持新版料理'));assert(!html.includes('class="cook-submit"'));
        assert(!html.includes('class="ingredient-grid"'));
    });

    mkdirSync(join(project.temp,'components'),{recursive:true});
    const hostPath=join(project.temp,'components/kitchen-ui-host.mjs');
    writeFileSync(hostPath,`export const states=[],refs=[],effects=[];let si=0,ri=0,ei=0;export function reset(){si=0;ri=0;ei=0;}export function clear(){states.length=0;refs.length=0;effects.length=0;reset();}export function useState(value){const i=si++;if(!(i in states))states[i]=typeof value==='function'?value():value;return[states[i],next=>states[i]=typeof next==='function'?next(states[i]):next];}export function useRef(value){const i=ri++;return refs[i]??={current:value};}export function useEffect(fn){effects[ei++]=fn;}export function useMemo(fn){return fn();}export function useCallback(fn){return fn;}export function jsx(type,props,key){return{type,props:props||{},key};}export const jsxs=jsx;export const Fragment='fragment';export default function Icon(){return null;}`);
    const host=await import(pathToFileURL(hostPath));
    const harnessUrl=project.compileFile('components/CookingPanel.tsx',{'react':'./kitchen-ui-host.mjs','react/jsx-runtime':'./kitchen-ui-host.mjs','./ItemIcon':'./kitchen-ui-host.mjs'});
    const {default:Panel}=await import(harnessUrl+'?interactions');
    const nodes=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(8).flatMap(nodes)];
    const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):'';
    const render=properties=>{host.reset();let tree=Panel(properties);for(const effect of host.effects)effect();host.reset();tree=Panel(properties);return nodes(tree);};
    const find=(tree,className)=>tree.find(node=>node.props.className===className);
    const add=(tree,id)=>tree.find(node=>node.type==='button'&&String(node.props['aria-label']).startsWith('加入'+cooking.INGREDIENTS[id].name+'，'));
    const filled=tree=>tree.filter(node=>node.type==='button'&&/^食材槽/.test(node.props['aria-label'])&&node.props.className==='filled');
    const click=node=>{assert(node,'missing button');assert(!node.props.disabled,'button unexpectedly disabled');node.props.onClick();};

    await test('five ingredient slots allow repeats without debiting the bag and reject a sixth',()=>{
        host.clear();const f=fixture(),properties=props(f),before=structuredClone(f.p.inventory);
        let tree=render(properties);for(let i=0;i<5;i++){click(add(tree,'fish'));tree=render(properties);}
        assert.equal(filled(tree).length,5);assert.equal(add(tree,'fish').props.disabled,true);
        assert.deepEqual(f.p.inventory,before);click(filled(tree)[2]);tree=render(properties);assert.equal(filled(tree).length,4);
        click(add(tree,'salmon'));tree=render(properties);assert.equal(filled(tree).length,5);assert.deepEqual(f.p.inventory,before);
    });
    await test('undiscovered previews conceal the dish and failed local submission retains selection',()=>{
        host.clear();const f=fixture(),calls=[],properties={...props(f),onCook:(...args)=>{calls.push(args);return false;}};
        let tree=render(properties);click(add(tree,'fish'));tree=render(properties);
        assert(!text(find(tree,'recipe-preview')).includes('烤鱼'));assert(text(find(tree,'recipe-preview')).includes('新的搭配'));
        click(find(tree,'cook-submit'));tree=render(properties);assert.equal(filled(tree).length,1);
        assert.deepEqual(calls,[['roast',['fish']]]);assert.equal(f.p.inventory.fish,6);
    });
    await test('recipe-book selection chooses ingredients without submitting or debiting them',()=>{
        host.clear();const f=fixture(),calls=[],properties={...props(f),onCook:(...args)=>{calls.push(args);return true;}};
        cooking.rememberCooking(f.p,cooking.resolveRecipe('roast',['fish']),90000);
        let tree=render(properties);click(tree.find(node=>node.type==='button'&&text(node)==='食谱'));tree=render(properties);
        click(tree.find(node=>node.props['aria-label']==='选择烤鱼配方'));tree=render(properties);
        assert.equal(filled(tree).length,1);assert.equal(calls.length,0);assert.equal(f.p.inventory.fish,6);
    });
    await test('queued and cancelled cooking keep ingredients, successful cooking clears them without another click',()=>{
        host.clear();const f=fixture(),calls=[],properties={...props(f),onCook:(...args)=>{calls.push(args);return true;}};let tree=render(properties);
        click(add(tree,'fish'));tree=render(properties);click(find(tree,'cook-submit'));
        tree=render({...properties,busy:true});assert.equal(filled(tree).length,1,'queueing is not server completion');
        tree=render({...properties,busy:false});assert.equal(filled(tree).length,1,'cancel/rejection should allow retry with selected materials');
        f.p.cookingResult={id:'new-success',dish:'roastFish',quantity:1,time:90000};
        f.p.inventory.fish=0;tree=render(properties);assert.equal(filled(tree).length,0);assert(text(find(tree,'kitchen-footer')).includes('烤鱼 ×1 已放入背包'));assert(find(tree,'cook-submit').props.disabled);assert.equal(calls.length,1);click(add(tree,'salmon'));tree=render(properties);assert.equal(filled(tree).length,1,'a fresh selection must survive unchanged result updates');
    });
    await test('completion notices use result identity, independent of device/server clock skew',()=>{
        for(const shift of [-3600000,3600000]){
            host.clear();const f=fixture();f.p.cookingResult={id:'old',dish:'roastFish',quantity:1,time:Date.now()+shift};
            let tree=render(props(f));assert(!text(find(tree,'kitchen-footer')).includes('已放入背包'));
            f.p.cookingResult={id:'fresh',dish:'salmonSushi',quantity:2,time:Date.now()+shift};tree=render(props(f));
            assert(text(find(tree,'kitchen-footer')).includes('三文鱼寿司 ×2 已放入背包'));
        }
    });
    await test('disconnected, busy and out-of-range panels cannot add or submit ingredients',()=>{
        for(const mode of ['disconnected','busy','far']){
            host.clear();const f=fixture(),properties=props(f);let tree=render(properties);click(add(tree,'fish'));
            if(mode==='disconnected')properties.connected=false;if(mode==='busy')properties.busy=true;if(mode==='far')f.p.x+=20;
            tree=render(properties);assert(find(tree,'cook-submit').props.disabled);assert(add(tree,'fish').props.disabled);
            assert(filled(tree).every(node=>node.props.disabled));
        }
    });
    await test('pantry displays material cost and calls exchange only after the button is pressed',()=>{
        host.clear();const f=fixture(),calls=[],properties={...props(f),onPantry:id=>{calls.push(id);return true;}};
        let tree=render(properties);click(tree.find(node=>node.type==='button'&&text(node)==='食材补给'));tree=render(properties);
        const cards=tree.filter(node=>node.props.className==='pantry-card');assert.equal(cards.length,7);assert.equal(calls.length,0);
        assert(text(cards[0]).includes('木材 3 / 20'));
        click(nodes(cards[0]).find(node=>node.type==='button'));assert.deepEqual(calls,['rice']);assert.equal(f.p.inventory.wood,20);
    });

    Date.now=()=>100000;
    globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.Image=class{};
    globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
    const storage=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}});
    function clientFixture(){const f=fixture(),notices=[],changes=[];
        const canvas={addEventListener(){},removeEventListener(){},width:800,height:600,clientWidth:800,clientHeight:600};
        const client=new GameClient(canvas,value=>changes.push(value),value=>notices.push(value),()=>{});clients.push(client);
        client.world=f.s;client.session={room:'KITCHEN1',playerId:'p',token:'token'};client.connected=true;client.ready=true;
        client.pos={x:f.p.x,y:f.p.y,level:0,face:'down',moving:false};client.flushActions=()=>{};client.prepareScene=async()=>{};
        return{...f,client,notices,changes};
    }
    await test('opening the kitchen only changes UI state; paused kitchen permits cook but blocks gameplay',()=>{
        const f=clientFixture(),c=f.client,before=structuredClone(f.p.inventory);assert(c.tryActivity());
        assert.equal(c.cookingOpen,true);assert.equal(c.commands.length,0);assert.deepEqual(f.p.inventory,before);
        c.paused=true;assert.equal(c.command({type:'attack',tool:'sword'}),false);assert.equal(c.command({type:'build',part:'wall',x:1,y:1}),false);
        assert.equal(c.command({type:'eat',food:'meal'}),false);assert.equal(c.command({type:'fish',x:1,y:1}),false);
        assert.equal(c.cook('roast',['fish']),true);assert.deepEqual(c.commands.map(value=>value.type),['cook']);assert.deepEqual(f.p.inventory,before);
    });
    await test('paused menus cannot issue cooking or pantry when the kitchen is closed',()=>{
        const f=clientFixture(),c=f.client;c.paused=true;
        assert.equal(c.cook('roast',['fish']),false);assert.equal(c.takePantry('rice'),false);
        assert.equal(c.command({type:'cook',method:'roast',ingredients:['fish']}),false);
        c.cookingOpen=true;assert.equal(c.takePantry('rice'),true);assert.equal(c.takePantry('rice'),false,'pending exchange locks a duplicate click');
    });
    await test('full-health client dispatches eating when stamina is low',()=>{
        const f=clientFixture(),c=f.client;f.p.hp=100;f.p.stamina=10;f.p.inventory.salmonSushi=1;
        c.slots[0]='salmonSushi';c.applySlot();c.pointer={x:f.p.x+2,y:f.p.y};c.act();
        assert.equal(c.commands[0]?.type,'eat');assert.equal(c.commands[0]?.food,'salmonSushi');assert.equal(f.p.inventory.salmonSushi,1);
    });
    await test('server capability controls new cooking after full snapshots and delta rollback',async()=>{
        const f=clientFixture(),c=f.client;
        let reply={room:'KITCHEN1',playerId:'p',token:'token',version:1,state:f.s};c.request=async()=>structuredClone(reply);
        await c.connect('create');c.ready=true;c.cookingOpen=true;c.paused=true;
        assert.equal(c.world.activityVersion,undefined);assert.equal(c.cook('roast',['fish']),false);assert.equal(c.takePantry('rice'),false);
        reply={...reply,activityVersion:2,version:2};await c.sync();assert.equal(c.world.activityVersion,2);
        reply={room:'KITCHEN1',playerId:'p',version:3,delta:{base:2,set:{activityVersion:2},maps:{}}};await c.sync();
        assert.equal(c.world.activityVersion,undefined);assert.equal(c.cook('roast',['fish']),false);
    });
    await test('world switching clears kitchen, pending requests and selected cooking work',async()=>{
        const f=clientFixture(),c=f.client;c.cookingOpen=true;c.pantryPending={type:'pantry',offer:'rice'};
        c.workCommand={type:'cook',method:'roast',ingredients:['fish']};c.localWork={action:'cook',start:100000,until:101800,face:'down'};c.commands=[c.workCommand];
        c.request=async()=>({room:'KITCHEN2',playerId:'p',token:'new',activityVersion:2,state:fixture().s});
        await c.connect('create');assert.equal(c.cookingOpen,false);assert.equal(c.pantryPending,null);assert.equal(c.workCommand,null);
        assert.equal(c.localWork,null);assert.equal(c.commands.length,0);assert.equal(c.cookingBusy,false);
    });
    console.log(`${passed} cooking UI/client checks passed; ${failed} failed`);process.exitCode=failed?1:0;
}finally{
    for(const client of clients)client.destroy();Date.now=savedNow;
    for(const[name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
    project.cleanup();
}
