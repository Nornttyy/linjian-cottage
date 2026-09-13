import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'client-fishing'}),savedNow=Date.now;
const names=['window','Image','requestAnimationFrame','cancelAnimationFrame','localStorage','setTimeout','clearTimeout'],savedGlobals=new Map(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
let now=100000,passed=0,failed=0;const clients=[];
try{
    Date.now=()=>now;globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.Image=class{};
    globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem(){}}});
    const [sim,world,activities,fishing,delta,{GameClient}]=await Promise.all(['simulation','world','activities','fishing','world-delta','client'].map(name=>import(project.module(name))));
    async function test(name,fn){try{await fn();passed++;console.log('PASS',name);}catch(error){failed++;console.error('FAIL',name,error.stack);}finally{for(const client of clients.splice(0))client.destroy();now=100000;}}
    function make(){
        const c=new GameClient({addEventListener(){},removeEventListener(){},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})},()=>{},()=>{},()=>{}),s=sim.createWorld(now),p=sim.createPlayer('p','secret','P',0,now);
        s.players={p};s.mobs=[];for(const r of world.RESOURCE_MAP.values())s.depleted[r.id]=true;
        c.world=s;c.session={room:'FISH',playerId:'p',token:'t'};c.connected=true;c.ready=true;c.networkVersion=2;c.worldVersion=1;c.flushActions=()=>{};
        for(let y=310;y<345;y++)for(let x=270;x<300;x++)if(world.terrainAt(x,y)==='water')for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
            const point={x:x+dx+.5,y:y+dy+.5};if(activities.canCast(point,x,y)&&!sim.isBlocked(s,point.x,point.y)){
                Object.assign(p,point);c.pos={...point,face:'right',level:0,moving:false};c.pointer={x:x+.5,y:y+.5};c.slots[0]='rod';c.applySlot();clients.push(c);return{c,s,p,target:{x,y}};
            }
        }
        throw Error('no shoreline');
    }
    function active(phase='reeling'){
        const f=make(),state=fishing.startFishing(82,now,f.target,'river');state.id='cast-p-1';f.p.fishing=state;f.p.fishingOrigin={x:f.p.x,y:f.p.y,level:0};
        if(phase==='bite'){now=state.biteAt+200;f.p.fishing=fishing.advanceFishing(state,now).state;}
        if(phase==='reeling'){now=state.biteAt+200;f.p.fishing=fishing.hookFishing(state,now).state;f.p.fishing=fishing.setFishingHeld(f.p.fishing,false,now).state;}
        f.p.workAction='fish';f.p.workStart=state.startedAt;f.p.workUntil=state.biteUntil+20000;f.p.swingUntil=f.p.workUntil;f.p.actionAt=f.p.workUntil;f.p.seen=now;
        return f;
    }
    const key=(value,repeat=false)=>({key:value,repeat,shiftKey:false,target:{matches:()=>false},preventDefault(){}});
    const pointer=(id=4,button=0,type='mouse')=>({pointerId:id,button,pointerType:type,clientX:400,clientY:300,preventDefault(){}});
    async function reply(f,state){f.c.request=async()=>({room:'FISH',playerId:'p',state,activityVersion:2,structureVersion:1,version:(f.c.worldVersion??0)+1});await f.c.sync();}

    await test('casting queues one command, uses 550ms animation and keeps movement locked awaiting receipt',()=>{
        const {c}=make();c.act();assert.equal(c.commands.length,1);assert.equal(c.commands[0].type,'fish');assert.equal(c.localWork.until-c.localWork.start,550);assert.equal(c.feedbackQueue[0].at,now+250);
        c.keys.add('d');now+=900;assert.deepEqual(c.movement(),{x:0,y:0});c.act();assert.equal(c.commands.length,1);
    });
    await test('old server capability rejects unsupported fishing without trapping movement',()=>{
        const {c}=make();delete c.world.activityVersion;c.act();assert.equal(c.commands.length,0);assert.equal(c.fishingBusy,false);assert.equal(c.localWork,null);
    });
    await test('Space and F hook once, do not dodge/interact, and key release queues release',()=>{
        for(const name of [' ','f']){const {c,p}=active('bite');c.keyDown(key(name));c.keyDown(key(name,true));assert.equal(c.commands.length,1);assert.equal(c.commands[0].type,'fishHook');assert.equal(c.commands[0].fishingId,p.fishing.id);c.keyUp(key(name));assert.equal(c.commands.at(-1).type,'fishControl');assert.equal(c.commands.at(-1).held,false);assert.equal(c.fishingHeld,false);}
    });
    await test('holding early during waiting cannot auto-hook a later bite without a new press',()=>{
        const {c,p}=active('waiting');c.keyDown(key(' '));assert.equal(c.fishingHeld,false);now=p.fishing.biteAt+200;c.animate(2000);assert.equal(c.commands.filter(command=>command.type==='fishHook').length,0);
    });
    await test('canvas pointer capture and touch release only respond to owning pointer',()=>{
        for(const type of ['mouse','touch']){const {c}=active();c.pointerDown(pointer(4,0,type));assert.equal(c.fishingHeld,true);assert.equal(c.fishingPointerId,4);c.pointerUp(pointer(5,0,type));assert.equal(c.fishingHeld,true);c.pointerUp(pointer(4,0,type));assert.equal(c.fishingHeld,false);assert.equal(c.commands.at(-1).held,false);}
    });
    await test('right-click and Escape cancel the current batch without a delayed tool action',()=>{
        for(const mode of ['right','escape']){const {c,p}=active();if(mode==='right')c.pointerDown(pointer(4,2));else c.keyDown(key('Escape'));assert.equal(c.commands.at(-1).type,'fishCancel');assert.equal(c.commands.at(-1).fishingId,p.fishing.id);assert.equal(c.fishingHeld,false);}
    });
    await test('500ms hold renewal sends a current-batch command without accumulating duplicates',()=>{
        const {c,p}=active();c.fishingPress(true);assert.equal(c.commands.length,1);now+=499;c.animate(1000);assert.equal(c.commands.length,1);const id=c.commands[0].id;now+=1;c.animate(1500);assert.equal(c.commands.length,1);assert.notEqual(c.commands[0].id,id);assert.equal(c.commands[0].fishingId,p.fishing.id);assert.equal(c.commands[0].held,true);
    });
    await test('pause and blur release hold, discard movement keys, and allow explicit cancellation',()=>{
        const {c}=active();c.keys.add('d');c.fishingPress(true);c.paused=true;c.pauseControls();assert.equal(c.fishingHeld,false);assert.equal(c.keys.size,0);assert.equal(c.commands.at(-1).held,false);assert(c.cancelFishing());assert.equal(c.commands.at(-1).type,'fishCancel');
        c.paused=false;c.fishingPress(true);c.blur();assert.equal(c.fishingHeld,false);assert.equal(c.fishingPointerId,null);
    });
    await test('releasing while disconnected always clears local hold and does not revive it on reconnect',async()=>{
        const f=active();f.c.fishingPress(true);f.c.connected=false;f.c.fishingPress(false);assert.equal(f.c.fishingHeld,false);
        await reply(f,structuredClone(f.s));assert.equal(f.c.fishingHeld,false);
    });
    await test('press and release change velocity prospectively without jumping displayed position',()=>{
        const {c}=active();now+=350;const before=c.getFishingView();c.fishingPress(true);const pressed=c.getFishingView();assert(Math.abs(pressed.barCenter-before.barCenter)<.001,'press re-simulated already elapsed motion');assert.equal(pressed.progress,before.progress);
        now+=300;const beforeRelease=c.getFishingView();c.fishingPress(false);const released=c.getFishingView();assert(Math.abs(released.barCenter-beforeRelease.barCenter)<.001,'release re-simulated already elapsed motion');assert.equal(released.progress,beforeRelease.progress);
    });
    await test('local preview never awards inventory, mutates shared world or announces unconfirmed catch',()=>{
        const {c,p}=active();p.fishing.progress=.999;p.fishing.barCenter=.5;p.fishing.fishPosition=.5;const before=JSON.stringify(c.world);now+=50;const view=c.getFishingView();assert.equal(JSON.stringify(c.world),before);assert.notEqual(view.phase,'caught');assert.equal(p.inventory.fish,0);
    });
    await test('successful receipt replaces local prediction, clears cast animation and immediately unlocks movement',async()=>{
        const f=active();f.c.fishingPress(true);f.c.localWork={action:'fish',face:'down',start:now,until:now+20000};const next=structuredClone(f.s),p=next.players.p;
        p.fishing={...p.fishing,phase:'caught',progress:1,finishedAt:now,held:false};p.inventory[p.fishing.catchId]=1;p.workAction=undefined;p.workUntil=p.swingUntil=p.actionAt=now;
        await reply(f,next);assert.equal(f.c.getFishingView().phase,'caught');assert.equal(f.c.localWork,null);assert.equal(f.c.fishingHeld,false);assert.equal(f.c.fishingBusy,false);f.c.keys.add('d');assert.equal(f.c.movement().x,1);
    });
    await test('full and delta receipts keep authoritative fishing state and reject stale cast results',async()=>{
        const f=active(),base=structuredClone(f.s),next=structuredClone(base);next.players.p.fishing={...next.players.p.fishing,barCenter:.72,progress:.65};
        f.c.request=async()=>({room:'FISH',playerId:'p',delta:delta.worldDelta(base,next,1),activityVersion:2,structureVersion:1,version:2});await f.c.sync();assert.equal(f.c.fishing.barCenter,.72);assert.equal(f.c.fishing.progress,.65);
        const oldId=f.c.fishing.id;f.c.world.players.p.fishing={...f.c.fishing,id:'new-cast'};f.c.fishingPress(true);assert.equal(f.c.commands.at(-1).fishingId,'new-cast');assert.notEqual(f.c.commands.at(-1).fishingId,oldId);
    });
    await test('Escape before a cast is sent cancels the queued cast and clears its local action lock',()=>{
        const {c}=make();c.act();assert(c.workCommand);c.keyDown(key('Escape'));assert.equal(c.commands.filter(command=>command.type==='fish').length,0);assert.equal(c.workCommand,null);assert.equal(c.localWork,null);assert.equal(c.fishingBusy,false);c.keys.add('d');assert.equal(c.movement().x,1);
    });
    await test('cancel while cast request is in flight queues cancellation for the same cast ID',()=>{
        const {c}=make();c.act();const command=c.commands.shift();c.pending={seq:1,dx:0,dy:0,commands:[command]};c.cancelFishing();assert(c.commands.some(item=>item.type==='fishCancel'&&item.fishingId===command.id));
    });
    await test('actual local request loop completes the minigame using the rendered preview and restores movement',async()=>{
        const {c}=active();c.localMode=true;
        for(let i=0;fishing.fishingActive(c.fishing)&&i<450;i++){
            if(i%3===0){const view=c.getFishingView();c.fishingPress(view.barCenter+view.barVelocity*.16<view.fishPosition);await c.sync();}
            now+=50;c.animate(1000+i*50);
        }
        await c.sync();assert.equal(c.fishing.phase,'caught');assert.equal(c.world.players.p.inventory[c.fishing.catchId],1);assert.equal(c.fishingBusy,false);c.keys.add('d');assert.equal(c.movement().x,1);
    });
    console.log(`${passed} client fishing checks passed; ${failed} failed`);process.exitCode=failed?1:0;
}finally{
    for(const c of clients)c.destroy();Date.now=savedNow;for(const[k,d]of savedGlobals)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];project.cleanup();
}
