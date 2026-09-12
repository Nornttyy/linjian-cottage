import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';

const project=compileProject({name:'touch-input',overlay:process.env.LINJIAN_OVERLAY});
const globals=['window','Image','requestAnimationFrame','cancelAnimationFrame','localStorage','setTimeout','clearTimeout'];
const original=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
const clients=[];let checks=0,failures=0;
try{
    const [{GameClient},sim,touch]=await Promise.all([import(project.module('client')),import(project.module('simulation')),import(project.module('touch'))]);
    const windowEvents=new Map(),timers=new Map();let timerId=0;
    globalThis.window={addEventListener:(name,listener)=>windowEvents.set(name,listener),removeEventListener:(name,listener)=>{if(windowEvents.get(name)===listener)windowEvents.delete(name);}};
    globalThis.Image=class{};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
    globalThis.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};globalThis.clearTimeout=id=>timers.delete(id);
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem(){}}});
    function fixture(){
        const events=new Map(),captures=[];
        const canvas={width:800,height:400,addEventListener:(name,listener)=>events.set(name,listener),removeEventListener:(name,listener)=>{if(events.get(name)===listener)events.delete(name);},setPointerCapture:id=>captures.push(id),getBoundingClientRect:()=>({left:0,top:0,width:800,height:400})};
        const c=new GameClient(canvas,()=>{},()=>{},()=>{});clients.push(c);
        const now=Date.now(),world=sim.createWorld(now),player=sim.createPlayer('p','secret','P',0,now);
        world.players={p:player};c.world=world;c.session={room:'TOUCH001',playerId:'p',token:'secret'};c.pos={x:player.x,y:player.y,face:'down',moving:false};c.connected=true;c.ready=true;c.request=()=>new Promise(()=>{});
        return{c,events,captures};
    }
    const pointer=(pointerId,extra={})=>({button:0,pointerId,pointerType:'touch',clientX:400,clientY:224,preventDefault(){},...extra});
    async function test(name,run){checks++;try{await run();console.log('PASS',name);}catch(error){failures++;console.log('FAIL',name,error.message);}}

    await test('touch stick maps its dead zone, cardinal directions and diagonals',()=>{
        assert.deepEqual(touch.touchMoveKeys(2,1,20),[]);
        assert.deepEqual(touch.touchMoveKeys(20,0,20),['d']);
        assert.deepEqual(touch.touchMoveKeys(-20,-20,20),['w','a']);
        assert.deepEqual(touch.touchMoveKeys(20,20,20),['s','d']);
        const clamped=touch.clampTouchStick(30,40,20);assert.equal(Math.round(Math.hypot(clamped.x,clamped.y)),20);
    });
    await test('a second finger ending cannot release the active canvas tool finger',()=>{
        const{c,events,captures}=fixture();events.get('pointerdown')(pointer(11));
        assert.equal(c.held,true);assert.deepEqual(captures,[11]);const aimed={...c.pointer};
        events.get('pointermove')(pointer(22,{clientX:700,clientY:50}));assert.deepEqual(c.pointer,aimed);
        windowEvents.get('pointerup')(pointer(22));assert.equal(c.held,true);
        windowEvents.get('pointerup')(pointer(11));assert.equal(c.held,false);assert.equal(c.pointer,null);assert.equal(c.screenPointer,null);
    });
    await test('pointer cancellation releases only its matching held action',()=>{
        const{c,events}=fixture();events.get('pointerdown')(pointer(31));
        windowEvents.get('pointercancel')(pointer(32));assert.equal(c.held,true);
        windowEvents.get('pointercancel')(pointer(31));assert.equal(c.held,false);
    });
    await test('the facing use button supports hold, matching release and item changes',()=>{
        const{c}=fixture();c.pointer={x:999,y:999};c.screenPointer={x:1,y:1};
        assert.equal(c.startTouchUse(41),true);assert.equal(c.held,true);assert.equal(c.pointer,null);assert.equal(c.screenPointer,null);
        assert.equal(c.stopTouchUse(42),false);assert.equal(c.held,true);
        c.selectSlot(1);assert.equal(c.held,false);
        assert.equal(c.stopTouchUse(41),true);
    });
    await test('resize and blur clear movement, held input and stale touch aim',()=>{
        const{c}=fixture();c.press('w',true);c.startTouchUse(51);c.screenPointer={x:20,y:30};c.pointer={x:1,y:2};
        windowEvents.get('resize')();assert.equal(c.keys.size,0);assert.equal(c.held,false);assert.equal(c.pointer,null);assert.equal(c.screenPointer,null);
        c.press('d',true);c.startTouchUse(52);windowEvents.get('blur')();assert.equal(c.keys.size,0);assert.equal(c.held,false);
    });
    await test('rapid dodge and interaction touches queue only one command each',()=>{
        const{c}=fixture();assert.equal(c.command({type:'dodge'}),true);assert.equal(c.command({type:'dodge'}),false);
        c.commands=[];c.pending=null;c.world.players.p.dodgeUntil=c.serverNow()-100;assert.equal(c.command({type:'dodge'}),false);
        c.world.players.p.dodgeUntil=0;assert.equal(c.command({type:'interact'}),true);assert.equal(c.command({type:'interact'}),false);
        c.commands=[];c.pending=null;assert.equal(c.command({type:'interact'}),false);
    });
    console.log(`${checks} touch checks; ${failures} failures`);process.exitCode=failures?1:0;
}finally{
    clients.forEach(client=>client.destroy());project.cleanup();
    for(const[key,value]of original)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];
}
