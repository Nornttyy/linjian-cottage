// Deterministic four-player client simulations; browser globals and storage are temporary.
import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'client-network-v2'});
const globals=['Date','setTimeout','clearTimeout','fetch','window','Image','requestAnimationFrame','cancelAnimationFrame','localStorage'];
const descriptors=new Map(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){return null;},setItem(){},removeItem(){}}});
try {
const [client,sim,world]=await Promise.all(['client','simulation','world'].map(name=>import(project.module(name))));
const {GameClient}=client;
const clone=x=>JSON.parse(JSON.stringify(x)),real={now:Date.now,setTimeout,clearTimeout,fetch};let now=100000,failures=0,passed=0;const reports=[];
async function micro(){for(let i=0;i<15;i++)await Promise.resolve();}
function fixture({rtt=600,offset=0,pattern,dbWork=0}={}){
 now+=20000;const base=now,state=sim.createWorld(now+offset);state.mobs=[];for(const id of world.RESOURCE_MAP.keys())state.depleted[id]=true;
 const tasks=[],clients=[],sounds=[[],[],[],[]],messages=[[],[],[],[]],sends=[[],[],[],[]],corrections=[[],[],[],[]],shots=[[],[],[],[]],active=[0,0,0,0],maxActive=[0,0,0,0],beforeReply=[];let nextId=0;
 Date.now=()=>now;globalThis.setTimeout=(fn,ms=0)=>{const id=++nextId;tasks.push({id,fn,at:now+ms});return id;};globalThis.clearTimeout=id=>{const i=tasks.findIndex(t=>t.id===id);if(i>=0)tasks.splice(i,1);};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.Image=class{};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 for(let i=0;i<4;i++){
  const id='p'+i,p=state.players[id]=sim.createPlayer(id,'secret'+i,'Test',i,now+offset);p.x=260+i*4;p.y=320;
  const canvas={width:800,height:400,clientWidth:1600,clientHeight:800,addEventListener(){},removeEventListener(){},getBoundingClientRect(){return{left:0,top:0,width:1600,height:800}}};
  const c=new GameClient(canvas,()=>{if(beforeReply[i]){corrections[i].push({at:now-base,x:c.pos.x-beforeReply[i].x,y:c.pos.y-beforeReply[i].y});beforeReply[i]=null;}},message=>messages[i].push(message),()=>{});
  c.connected=true;c.ready=true;c.session={room:'CLIENT01',playerId:id,token:String(i)};c.pos={x:p.x,y:p.y,face:'right',moving:false};c.networkVersion=2;c.serverOffset=offset;c.lastInputAt=now-1000;c.audio.play=(sound,...args)=>sounds[i].push({sound,at:now-base,args});clients.push(c);
 }
 clients.forEach(c=>{c.world=clone(state);c.animate(now);});
 globalThis.fetch=(_,options)=>new Promise(resolve=>{
  const body=JSON.parse(options.body),i=Number(body.token),latency=pattern?.[sends[i].length%pattern.length]??rtt,up=latency/2,down=latency/2;active[i]++;maxActive[i]=Math.max(maxActive[i],active[i]);sends[i].push({at:now-base,input:clone(body.input??null)});
  setTimeout(()=>{const received=now+offset;setTimeout(()=>{
   const p=state.players['p'+i],previous=p.swingStart;sim.tickWorld(state,now+offset);if(body.input)sim.applyInput(state,p.id,body.input,now+offset);if(previous!==p.swingStart)shots[i].push({at:now-base,start:p.swingStart-base-offset,until:p.swingUntil-base-offset});
   const finish=()=>{sim.tickWorld(state,now+offset);const response={state:clone(sim.publicWorld(state)),room:'CLIENT01',playerId:p.id,version:1,networkVersion:2,serverReceivedAt:received,serverSentAt:now+offset};setTimeout(()=>{active[i]--;beforeReply[i]={...clients[i].pos};resolve({ok:true,json:async()=>response});},down);};
   if(body.input?.commands.some(c=>c.type==='attack')&&p.pendingStrike)setTimeout(finish,Math.max(0,p.pendingStrike.at-offset-now));else finish();
  },dbWork);},up);
 });
 async function advance(ms){await micro();const end=now+ms;let guard=0;while(now<end){if(++guard>100000)throw Error('timer livelock');now=Math.min(end,now+10,...tasks.map(t=>t.at));clients.forEach(c=>c.animate(now));for(;;){const i=tasks.findIndex(t=>t.at<=now);if(i<0)break;tasks.splice(i,1)[0].fn();await micro();}await micro();}}
 return{state,clients,advance,sends,corrections,shots,maxActive,base,sounds,messages,end(){clients.forEach(c=>c.destroy());tasks.length=0;Object.assign(globalThis,{setTimeout:real.setTimeout,clearTimeout:real.clearTimeout,fetch:real.fetch});Date.now=real.now;}};
}
async function test(name,fn){try{await fn();passed++;console.log('PASS',name);}catch(e){failures++;console.log('FAIL',name,e.stack);}}
const maxCorrection=f=>Math.max(0,...f.corrections.flat().map(v=>Math.hypot(v.x,v.y)*24));
for(const rtt of [100,300,600,1200])await test(`four clients RTT ${rtt}: single attack resumes at local end, no correction or queue`,async()=>{
 const f=fixture({rtt});try{f.clients.forEach(c=>{c.act();c.press('d',true);});let resumed=[null,null,null,null];const xs=f.clients.map(c=>c.pos.x);
 for(let elapsed=0;elapsed<500;elapsed+=10){await f.advance(10);f.clients.forEach((c,i)=>{if(resumed[i]===null&&c.pos.x>xs[i]+1e-5)resumed[i]=now-f.base;});}
 assert.deepEqual(resumed,[370,370,370,370]);await f.advance(3000);assert.ok(maxCorrection(f)<.05,`correction ${maxCorrection(f)}px`);assert.deepEqual(f.maxActive,[1,1,1,1]);f.shots.forEach(s=>assert.equal(s.length,1));f.clients.forEach(c=>assert.equal(c.unconfirmedSwing,null));
 reports.push({case:'single',rtt,resumed,maxCorrectionPx:maxCorrection(f),sendTimes:f.sends[0].map(s=>s.at)});
 }finally{f.end();}
});
await test('clock skew +20s: NTP estimate keeps local tool duration and authoritative time distinct',async()=>{
 const f=fixture({rtt:300,offset:20000,dbWork:80});try{const c=f.clients[0];void c.sync();await f.advance(400);assert.equal(c.timeOffset,20000);assert.equal(c.serverNow(now),now+20000);c.act();const start=c.localSwing.start;assert.equal(start,now);c.press('d',true);await f.advance(400);assert.ok(c.pos.moving);assert.equal(c.localSwing.start,start);await f.advance(1000);assert.ok(maxCorrection(f)<.05);}finally{f.end();}
});
await test('queued attack waits for dispatch; post-swing history is never coalesced before attack',async()=>{
 const f=fixture({rtt:1200});try{const c=f.clients[0];void c.sync();await f.advance(100);c.act();c.press('d',true);const x=c.pos.x;await f.advance(1000);assert.equal(c.pos.x,x,'attack cannot move while still unsent');await f.advance(200);assert.ok(c.pos.x>x);const attackPacket=f.sends[0].find(s=>s.input?.commands.some(c=>c.type==='attack'));assert.equal(attackPacket.at,1200);assert.equal(attackPacket.input.movements.length,0);await f.advance(4000);assert.ok(maxCorrection(f)<.05,`${maxCorrection(f)} px`);assert.equal(f.shots[0].length,1);}finally{f.end();}
});
await test('four held tools with 100/900/300/1200ms jitter: release ends current action, no accumulated attacks',async()=>{
 const f=fixture({pattern:[100,900,300,1200]});try{f.clients.forEach(c=>{c.held=true;c.act();});await f.advance(2430);f.clients.forEach(c=>{c.pointerUp();c.press('d',true);});const start=f.clients.map(c=>c.localSwing.start),shots=f.shots.map(s=>s.length);await f.advance(4200);f.clients.forEach((c,i)=>{assert.equal(c.localSwing.start,start[i]);assert.ok(f.shots[i].length-shots[i]<=1);assert.equal(f.state.players['p'+i].attackQueue?.length??0,0);});assert.ok(maxCorrection(f)<.05,`${maxCorrection(f)} px`);assert.deepEqual(f.maxActive,[1,1,1,1]);reports.push({case:'held-jitter',maxCorrectionPx:maxCorrection(f),shots:f.shots.map(s=>s.length)});}finally{f.end();}
});
await test('fixed start cadence removes RTT+150ms gap and idle heartbeat retains liveness',async()=>{
 const f=fixture({rtt:600});try{void f.clients[0].sync();await f.advance(2200);assert.deepEqual(f.sends[0].map(s=>s.at),[0,600,1200,1800]);assert.equal(f.sends[0][1].input,null);assert.ok(f.sends[0][2].input);assert.ok(now-f.state.players.p0.seen<1200);}finally{f.end();}
});
await test('legacy backend retains acknowledgement gate',async()=>{
 const f=fixture({rtt:600});try{const c=f.clients[0];c.networkVersion=1;c.act();c.press('d',true);const x=c.pos.x;await f.advance(400);assert.equal(c.pos.x,x);await f.advance(300);assert.ok(c.pos.x>x);}finally{f.end();}
});

for(const [tool,action] of [['hoe','hoe'],['water','water'],['seed','plant'],['build','hammer']])for(const rtt of [100,600,1200])await test(`${tool} RTT ${rtt}: one local action, exact recovery and no post-work correction`,async()=>{
 const f=fixture({rtt});try{const c=f.clients[0],p=f.state.players.p0,x=Math.floor(p.x),y=Math.floor(p.y)+1;
 p.inventory.wood=30;p.inventory.stone=10;f.state.plots??={};if(tool==='water'||tool==='seed')f.state.plots[`${x}:${y}`]={x,y,progress:0,updated:now,wetUntil:0};
 c.world=clone(f.state);c.setTool(tool);c.pointer={x:x+.5,y:y+.5};c.act();assert.equal(c.localWork?.action,action);c.press('d',true);const startX=c.pos.x,duration=sim.WORK_TIMING[action].duration;await f.advance(duration-10);assert.equal(c.pos.x,startX);await f.advance(20);assert.ok(c.pos.x>startX);await f.advance(2500);assert.ok(maxCorrection(f)<.05,`correction ${maxCorrection(f)}px`);assert.equal(f.sends[0].flatMap(s=>s.input?.commands??[]).filter(cmd=>['till','plant','water','build'].includes(cmd.type)).length,1);assert.ok(!c.workCommand,'accepted work confirmation cleared');
 }finally{f.end();}
});
await test('unconfirmed work cannot start a second local work or block recovered movement',async()=>{
 const f=fixture({rtt:1200});try{const c=f.clients[0],p=f.state.players.p0,x=Math.floor(p.x),y=Math.floor(p.y)+1;f.state.plots={[`${x}:${y}`]:{x,y,progress:0,updated:now,wetUntil:0},[`${x+1}:${y}`]:{x:x+1,y,progress:0,updated:now,wetUntil:0}};c.world=clone(f.state);c.setTool('water');c.pointer={x:x+.5,y:y+.5};c.act();const started=c.localWork.start;await f.advance(510);c.pointer={x:x+1.5,y:y+.5};c.act();assert.equal(c.localWork.start,started,'second click while first unconfirmed must not start another local animation');c.press('d',true);const before=c.pos.x;await f.advance(20);assert.ok(c.pos.x>before);await f.advance(1800);assert.equal(c.workCommand,null);assert.ok(maxCorrection(f)<.05);}finally{f.end();}
});
for(const rtt of [0,50,100,600])await test(`harvest RTT ${rtt}: feedback is played once across prediction and authority; resources only once`,async()=>{
 const f=fixture({rtt});try{const c=f.clients[0],p=f.state.players.p0,x=Math.floor(p.x),y=Math.floor(p.y)+1;f.state.plots={[`${x}:${y}`]:{x,y,crop:'carrot',progress:90,updated:now,wetUntil:now}};c.world=clone(f.state);c.setTool('hoe');c.pointer={x:x+.5,y:y+.5};c.act();assert.equal(c.world.players.p0.inventory.carrot,0);await f.advance(1600);assert.equal(f.state.players.p0.inventory.carrot,3);assert.equal(f.sounds[0].filter(v=>v.sound==='harvest').length,1,'one perceived harvest, one sound');}finally{f.end();}
});
await test('switching from unconfirmed attack to farming cannot queue a second tool lock',async()=>{
 const f=fixture({rtt:1200});try{const c=f.clients[0],p=f.state.players.p0,x=Math.floor(p.x),y=Math.floor(p.y)+1;f.state.plots={[`${x}:${y}`]:{x,y,progress:0,updated:now,wetUntil:0}};c.world=clone(f.state);c.act();await f.advance(400);c.setTool('water');c.pointer={x:x+.5,y:y+.5};c.act();assert.equal(c.localWork,null,'farm animation must wait for previous attack confirmation');c.press('d',true);const before=c.pos.x;await f.advance(20);assert.ok(c.pos.x>before,'tool switch must not re-lock recovered movement');}finally{f.end();}
});
await test('predicted contact uses local timing with 20s clock skew and deduplicates later hit',async()=>{
 const f=fixture({rtt:600,offset:20000});try{const c=f.clients[0],p=f.state.players.p0,tree=[...world.RESOURCE_MAP.values()].find(r=>r.kind==='tree');delete f.state.depleted[tree.id];p.x=tree.x+.5;p.y=tree.y+1.5;c.world=clone(f.state);c.pos.x=p.x;c.pos.y=p.y;c.pointer={x:tree.x+.5,y:tree.y+.5};c.act();await f.advance(179);assert.equal(f.sounds[0].filter(v=>v.sound==='wood').length,0);await f.advance(2);assert.equal(f.sounds[0].filter(v=>v.sound==='wood').length,1);assert.equal(c.world.resourceHp[tree.id],undefined,'prediction must not damage resource');await f.advance(1200);assert.equal(f.state.resourceHp[tree.id],2);assert.equal(f.sounds[0].filter(v=>v.sound==='wood').length,1);assert.equal(f.state.events.filter(e=>e.kind==='hit').length,1);}finally{f.end();}
});
console.log(`${passed} passed, ${failures} failed`);if(failures)process.exitCode=1;
} finally {
 for(const [name,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
 project.cleanup();
}
