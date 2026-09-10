// Door interaction and delayed movement regressions against the real client/server.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const source=resolve(process.env.LINJIAN_SOURCE || fileURLToPath(new URL('..',import.meta.url)));
const ts=(await import(pathToFileURL(join(source,'node_modules/typescript/lib/typescript.js')))).default;
const overlay=process.env.LINJIAN_INPUT_OVERLAY;
const temp=await mkdtemp(join(tmpdir(),'linjian-animation-test-'));
let now=100000,failures=0;
const actual={now:Date.now,setTimeout,clearTimeout};
try{
  for(const name of ['world','simulation','frame-layout','connected-wall','inventory','roof-visibility','tiles','animation','atmosphere','renderer','art','client']){
    let path=join(source,'lib',name+'.ts');
    if(overlay){const candidate=join(overlay,name+'.ts');try{await access(candidate);path=candidate;}catch{}}
    const code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
      .replace(/from ['"]\.\/(world|simulation|frame-layout|connected-wall|inventory|roof-visibility|tiles|animation|atmosphere|renderer|art)(?:\.ts)?['"]/g,"from './$1.mjs'");
    await writeFile(join(temp,name+'.mjs'),code);
  }
  const sim=await import(pathToFileURL(join(temp,'simulation.mjs')));
  const world=await import(pathToFileURL(join(temp,'world.mjs')));
  const animation=await import(pathToFileURL(join(temp,'animation.mjs')));
  const {GameClient}=await import(pathToFileURL(join(temp,'client.mjs')));
  Date.now=()=>now;
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.Image=class{};
  globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
  const clone=x=>JSON.parse(JSON.stringify(x));
  function fixture(){
    now+=10000;
    const state=sim.createWorld(now),p=sim.createPlayer('p','secret','Audit',0,now);state.players.p=p;
    const canvas={width:800,height:400,clientWidth:1600,clientHeight:800,addEventListener(){},removeEventListener(){},getBoundingClientRect(){return{left:0,top:0,width:1600,height:800};}};
    const c=new GameClient(canvas,()=>{},()=>{},()=>{},'https://example.test/api/game');
    c.connected=true;c.session={playerId:'p',room:'TESTROOM',token:'test-token'};c.world=clone(state);c.pos={x:p.x,y:p.y,face:'down',moving:false};
    const f={c,state,p,defer:false,release:null};
    c.request=async body=>{
      sim.tickWorld(state,now);const message=body.input?sim.applyInput(state,'p',body.input,now):null;
      const reply={room:'TESTROOM',playerId:'p',state:clone(sim.publicWorld(state)),message};
      if(f.defer){f.defer=false;return new Promise(resolve=>{f.release=()=>resolve(reply);});}
      return reply;
    };
    c.animate(now);
    f.advance=ms=>{for(let i=0;i<ms;i+=10){now+=Math.min(10,ms-i);c.animate(now);}};
    f.frame=()=>animation.heroFrame(c.world.players.p,c.pos.face,c.pos.moving,now,c.tool,c.localSwing);
    f.aim=(dx,dy)=>{c.pointer={x:c.pos.x+dx,y:c.pos.y+dy};};
    return f;
  }
  async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){failures++;console.log('FAIL',name,'—',e.message);}}



  const near=(a,b,label,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} vs ${b}`);
  async function flushMicrotasks(){for(let i=0;i<5;i++)await Promise.resolve();}
  function network(rtt=0,delayPattern){
    const f=fixture();f.state.mobs=[];for(const id of world.RESOURCE_MAP.keys())f.state.depleted[id]=true;
    f.c.world=clone(f.state);const tasks=[],base=now,shots=[],changes=[],sends=[];let inFlight=0,maxInFlight=0,requestCount=0;
    let taskId=0;
    globalThis.setTimeout=(fn,ms=0)=>{const id=++taskId;tasks.push({id,at:now+ms,fn});return id;};
    globalThis.clearTimeout=id=>{const i=tasks.findIndex(t=>t.id===id);if(i>=0)tasks.splice(i,1);};
    f.c.request=body=>new Promise(resolve=>{
      const latency=delayPattern?.[requestCount++%delayPattern.length]??rtt;inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);sends.push({time:now-base,input:clone(body.input)});
      setTimeout(()=>{
        const previous=f.p.swingStart;sim.tickWorld(f.state,now);sim.applyInput(f.state,'p',body.input,now);
        if(f.p.swingStart!==previous)shots.push({time:now-base,until:f.p.swingUntil-base});
        const reply={room:'TESTROOM',playerId:'p',state:clone(sim.publicWorld(f.state))};
        setTimeout(()=>{inFlight--;const before=f.c.pos.x;resolve(reply);queueMicrotask(()=>changes.push({time:now-base,delta:f.c.pos.x-before}));},latency/2);
      },latency/2);
    });
    f.advanceAsync=async ms=>{
      await flushMicrotasks();const end=now+ms;
      while(now<end){
        const next=Math.min(end,now+(f.frameStride??10),...tasks.map(t=>t.at));now=next;f.c.animate(now);
        for(;;){const i=tasks.findIndex(t=>t.at<=now);if(i<0)break;const t=tasks.splice(i,1)[0];t.fn();await flushMicrotasks();}
        await flushMicrotasks();
      }
    };
    f.beginSync=()=>void f.c.sync();f.shots=shots;f.changes=changes;f.sends=sends;f.base=base;f.maxInFlight=()=>maxInFlight;
    f.end=()=>{f.c.destroy();tasks.length=0;globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};};
    return f;
  }

  for(const pattern of [[300],[800],[1200],[1800],[1200,100,1800,300]])await test(`walking RTT ${pattern}`,async()=>{
    const f=network(0,pattern);try{
      f.c.press('d',true);f.beginSync();await f.advanceAsync(6000);
      for(const c of f.changes)near(c.delta,0,'self-position correction',1e-7);
    }finally{f.end();}
  });
  for(const rtt of [800,1200,1800])await test(`walking after tool RTT ${rtt}`,async()=>{
    const f=network(rtt);try{
      f.aim(1,0);f.c.act();f.c.press('d',true);await f.advanceAsync(6000);
      for(const c of f.changes)near(c.delta,0,'post-tool correction',1e-7);
    }finally{f.end();}
  });

  function doorFixture(){
    const f=fixture();f.c.flushActions=()=>{};f.state.mobs=[];for(const id of world.RESOURCE_MAP.keys())f.state.depleted[id]=true;
    const id='259:322:wall',door={id,x:259,y:322,kind:'door',open:true};f.state.buildings[id]=door;
    f.p.x=259.5;f.p.y=323.5;f.c.world=clone(f.state);f.c.pos.x=f.p.x;f.c.pos.y=f.p.y;
    f.packet=(commands,dx=0,dy=0,seconds=0,id='p')=>sim.applyInput(f.state,id,{seq:f.state.players[id].seq+1,dx,dy,movements:seconds?[{dx,dy,seconds,speed:4.2}]:[],commands},now);
    f.door=door;return f;
  }
  await test('walking out of an open doorway and interacting in one input closes it immediately from either side',()=>{
    for(const side of [-1,1]){const f=doorFixture();try{
      f.p.y=322.5+side*.3;now+=150;const message=f.packet([{type:'interact'}],0,side,.15);
      assert.equal(message,null);assert.equal(f.door.open,false);assert.equal(sim.isBlocked(f.state,259.5,322.5),true);
      assert.ok(side<0?f.p.y<322-.2:f.p.y>323+.2,'full player body has left the door');
    }finally{f.c.destroy();}}
  });
  await test('a real client walk-then-interact request commits the walked-out position before closing',async()=>{
    const f=doorFixture();try{
      f.p.y=322.8;f.c.world=clone(f.state);f.c.pos.y=f.p.y;f.c.press('s',true);f.advance(150);f.c.press('s',false);
      f.c.command({type:'interact',target:f.door.id});await f.c.sync();assert.equal(f.door.open,false);near(f.c.pos.y,f.p.y,'client position');
    }finally{f.c.destroy();}
  });
  await test('doors repeatedly open and close from both sides; a player standing in the opening cannot be trapped',()=>{
    const f=doorFixture();try{
      for(const y of [321.5,323.5]){f.p.y=y;for(let i=0;i<4;i++){now+=100;f.packet([{type:'interact',target:f.door.id}]);assert.equal(f.door.open,i%2===1);assert.equal(sim.isBlocked(f.state,259.5,322.5),i%2===0);}}
      f.p.y=322.5;assert.equal(f.packet([{type:'interact'}]),'门口有人');assert.equal(f.door.open,true);
      f.p.y=323.1;assert.equal(f.packet([{type:'interact'}]),'门口有人','body overlaps despite center being outside cell');assert.equal(f.door.open,true);
      f.p.y=323.3;assert.equal(f.packet([{type:'interact'}]),null);assert.equal(f.door.open,false);
    }finally{f.c.destroy();}
  });
  await test('another active player blocks closing by body overlap; disconnected room entries do not block forever',()=>{
    const f=doorFixture();try{
      const q=sim.createPlayer('q','secret','Guest',1,now);f.state.players.q=q;q.x=259.9;q.y=322.5;
      assert.equal(f.packet([{type:'interact',target:f.door.id}]),'门口有人');assert.equal(f.door.open,true);
      q.x=260.1;assert.equal(f.packet([{type:'interact',target:f.door.id}]),'门口有人');
      q.seen=now-8001;assert.equal(f.packet([{type:'interact',target:f.door.id}]),null);assert.equal(f.door.open,false);
      q.x=259.5;q.y=321.5;now+=50;f.packet([{type:'interact',target:f.door.id}],0,0,0,'q');assert.equal(f.door.open,true,'other player can reopen from opposite side');
      now+=50;f.packet([{type:'interact',target:f.door.id}]);assert.equal(f.door.open,false,'host can close after guest has fully left');
    }finally{f.c.destroy();}
  });
  await test('untargeted interaction chooses the nearest door center; explicit target never bypasses range/type checks',()=>{
    const f=doorFixture();try{
      f.p.x=260.2;f.p.y=323.3;const other={id:'260:324:wall',x:260,y:324,kind:'door',open:true};f.state.buildings[other.id]=other;
      f.packet([{type:'interact'}]);assert.equal(f.door.open,false);assert.equal(other.open,true,'farther door did not toggle');
      f.packet([{type:'interact',target:other.id}]);assert.equal(other.open,false,'in-range explicit door accepted');
      f.p.x=250;f.p.y=322.5;f.packet([{type:'interact',target:f.door.id}]);assert.equal(f.door.open,false,'far door rejected');
      f.p.x=260.2;f.p.y=323.3;other.kind='wall';f.packet([{type:'interact',target:other.id}]);assert.equal(other.open,false,'non-door rejected');
      f.packet([{type:'interact',target:'missing'}]);assert.equal(f.door.open,false,'bad explicit target does not fall back to another door');
    }finally{f.c.destroy();}
  });
  await test('delayed authorized movement still stops at closed walls and replayed seq cannot move twice',()=>{
    const f=doorFixture();try{
      f.door.open=false;f.p.x=258.5;f.p.y=322.5;now+=3000;
      const input={seq:1,dx:1,dy:0,movements:[{dx:1,dy:0,seconds:3,speed:4.2}],commands:[]};
      sim.applyInput(f.state,'p',input,now);assert.ok(f.p.x<259-.19,'three-second history cannot cross closed door');const x=f.p.x;
      sim.applyInput(f.state,'p',input,now+3000);near(f.p.x,x,'replayed seq cannot apply twice');
    }finally{f.c.destroy();}
  });
  await test('history budget uses only elapsed server time, normalizes direction/speed, and remains bounded',()=>{
    const f=doorFixture();try{
      f.state.buildings={};const x=f.p.x,y=f.p.y;
      const input={seq:1,dx:1,dy:1,movements:[{dx:100,dy:100,seconds:99,speed:999}],commands:[]};
      now+=100;sim.applyInput(f.state,'p',input,now);near(Math.hypot(f.p.x-x,f.p.y-y),.15*4.2,'only100ms plus initial50ms credit');
      now+=100000;f.packet([]);assert.ok(f.p.moveCredit<=8,'idle credit never exceeds request-history bound');
    }finally{f.c.destroy();}
  });
  for(const rtt of [800,1200,1800])await test(`dodge followed by continued movement RTT ${rtt} remains bounded and snap-free`,async()=>{
    const f=network(rtt);try{
      f.c.press('d',true);await f.advanceAsync(100);f.c.command({type:'dodge'});await f.advanceAsync(5500);
      for(const c of f.changes)near(c.delta,0,'post-roll high RTT correction',1e-7);
    }finally{f.end();}
  });
  await test('ordinary client movement into a known wall at high RTT never crosses or jumps backwards',async()=>{
    const f=network(1200);try{
      const wall={id:'259:320:wall',kind:'wall',x:259,y:320};f.state.buildings[wall.id]=wall;f.c.world=clone(f.state);
      f.c.press('d',true);f.beginSync();await f.advanceAsync(4500);
      assert.ok(f.p.x<258.81&&f.c.pos.x<258.81,'both stop before wall');for(const c of f.changes)near(c.delta,0,'wall correction (under 0.01 screen pixel)',.01/24);
    }finally{f.end();}
  });
  await test('long 200 ms animation frames under high jitter RTT retain their recorded movement without a snap',async()=>{
    const f=network(0,[1200,300,1800,800]);try{
      f.frameStride=200;f.c.press('d',true);f.beginSync();await f.advanceAsync(6500);
      for(const c of f.changes)near(c.delta,0,'long-frame correction',1e-7);
      assert.equal(f.maxInFlight(),1);
    }finally{f.end();}
  });
  console.log(failures+' failure(s)');process.exitCode=failures?1:0;
}finally{Date.now=actual.now;globalThis.setTimeout=actual.setTimeout;globalThis.clearTimeout=actual.clearTimeout;await rm(temp,{recursive:true,force:true});}
