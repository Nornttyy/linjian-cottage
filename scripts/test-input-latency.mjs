// Real client/server movement-lock regressions. Copy to scripts/test-movement.mjs or set LINJIAN_SOURCE.
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
  for(const name of ['world','simulation','frame-layout','tiles','animation','atmosphere','renderer','art','client']){
    let path=join(source,'lib',name+'.ts');
    if(overlay){const candidate=join(overlay,name+'.ts');try{await access(candidate);path=candidate;}catch{}}
    const code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
      .replace(/from ['"]\.\/(world|simulation|frame-layout|tiles|animation|atmosphere|renderer|art)(?:\.ts)?['"]/g,"from './$1.mjs'");
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
        const next=Math.min(end,now+10,...tasks.map(t=>t.at));now=next;f.c.animate(now);
        for(;;){const i=tasks.findIndex(t=>t.at<=now);if(i<0)break;const t=tasks.splice(i,1)[0];t.fn();await flushMicrotasks();}
        await flushMicrotasks();
      }
    };
    f.beginSync=()=>void f.c.sync();f.shots=shots;f.changes=changes;f.sends=sends;f.base=base;f.maxInFlight=()=>maxInFlight;
    f.end=()=>{f.c.destroy();tasks.length=0;globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};};
    return f;
  }
  for(const rtt of [0,100,200,300]){
    await test(`RTT ${rtt}: dodge, ordinary movement and delayed speed-boundary segments have no positional corrections`,async()=>{
      const f=network(rtt);try{
        f.c.press('d',true);await f.advanceAsync(100);f.c.command({type:'dodge'});await f.advanceAsync(1900);
        assert.equal(f.maxInFlight(),1,'only one request may be in flight');
        for(const change of f.changes)near(change.delta,0,`correction at ${change.time} ms`,1e-7);
        console.log('  dodge RTT',rtt,'max correction px',Math.max(0,...f.changes.map(c=>Math.abs(c.delta)*24)).toFixed(3));
      }finally{f.end();}
    });
    for(const tool of ['axe','pick','sword'])await test(`RTT ${rtt}: ${tool} flushes immediately and a single action resumes held movement after one finite recovery`,async()=>{
      const f=network(rtt);try{
        f.c.setTool(tool);f.aim(1,0);const start=now;f.c.act();f.c.press('d',true);const x=f.c.pos.x;
        await f.advanceAsync(1);assert.equal(f.sends[0].time,0,'tool bypasses periodic 150 ms wait');
        let resumed=null;while(now-start<1500){await f.advanceAsync(10);if(f.c.pos.x>x+.0001){resumed=now-start;break;}}
        const duration=sim.TOOL_TIMING[tool].duration;
        assert.ok(resumed!==null&&resumed<=duration+rtt/2+11,`resume ${resumed} exceeds one server swing ${duration}+${rtt/2}`);
        assert.equal(f.shots.length,1);assert.equal(f.p.attackQueue?.length??0,0);assert.equal(f.maxInFlight(),1);
        await f.advanceAsync(800);for(const change of f.changes)near(change.delta,0,`post-tool correction at ${change.time} ms`,1e-7);
        console.log('  single',tool,'RTT',rtt,'resume',resumed,'ms; extra',resumed-duration,'ms');
      }finally{f.end();}
    });
    await test(`RTT ${rtt}: holding a tool creates no queue and releasing starts no further action`,async()=>{
      const f=network(rtt);try{
        f.c.setTool('axe');f.aim(1,0);f.c.held=true;f.c.act();await f.advanceAsync(1830);f.c.pointerUp();f.c.press('d',true);
        const released=now,releasedLocalStart=f.c.localSwing?.start,lastStarted=f.shots.length;let resumed=null;
        while(now-released<1500){await f.advanceAsync(10);assert.equal(f.p.attackQueue?.length??0,0);if(f.c.pos.moving&&resumed===null)resumed=now-released;}
        assert.equal(f.c.localSwing?.start,releasedLocalStart,'no extra locally queued attack after release');
        assert.ok(f.shots.length-lastStarted<=1,'only the current unconfirmed attack may reach the server after release');
        assert.ok(resumed!==null&&resumed<=sim.TOOL_TIMING.axe.duration+rtt+20,`release recovery ${resumed} must not drain extra swings`);
        for(const change of f.changes)near(change.delta,0,`release correction at ${change.time} ms`,1e-7);
        assert.equal(f.maxInFlight(),1);console.log('  held RTT',rtt,'shots',f.shots.length,'release -> move',resumed,'ms');
      }finally{f.end();}
    });
  }
  await test('an action queued during an in-flight sync flushes at acknowledgement without another 150 ms timer',async()=>{
    const f=network(300);try{
      f.beginSync();await f.advanceAsync(100);f.aim(1,0);f.c.act();f.c.press('d',true);await f.advanceAsync(201);
      assert.equal(f.sends[1].time,300,'send as soon as previous response arrives');assert.equal(f.maxInFlight(),1);
      await f.advanceAsync(1000);assert.equal(f.shots.length,1);for(const c of f.changes)near(c.delta,0,'in-flight action movement correction');
      console.log('  busy RTT300: click100, send300, server450, unlock810; click-to-unlock710ms');
    }finally{f.end();}
  });
  await test('variable 100/300/200 ms RTT preserves dodge movement across response boundaries',async()=>{
    const f=network(0,[100,300,200,100]);try{
      f.c.press('d',true);await f.advanceAsync(80);f.c.command({type:'dodge'});await f.advanceAsync(2000);
      for(const c of f.changes)near(c.delta,0,'variable RTT correction');assert.equal(f.maxInFlight(),1);
    }finally{f.end();}
  });
  await test('reconnecting while an old sync is pending cannot leave the new session permanently unsynchronized',async()=>{
    const f=network(300);try{
      f.beginSync();await f.advanceAsync(50);
      f.c.generation++;f.c.pending=null;f.c.session={...f.c.session};
      setTimeout(()=>void f.c.sync(),160);await f.advanceAsync(650);
      assert.ok(f.sends.length>=2,'new generation sync resumes after old reply');assert.equal(f.maxInFlight(),1);
    }finally{f.end();}
  });
  await test('variable RTT across tool completion still preserves held movement without a corrective snap',async()=>{
    const f=network(0,[300,100,200,300,100]);try{
      f.c.press('d',true);await f.advanceAsync(100);f.aim(1,0);f.c.act();await f.advanceAsync(2000);
      for(const c of f.changes)near(c.delta,0,'variable tool RTT correction');assert.equal(f.maxInFlight(),1);
    }finally{f.end();}
  });
  await test('server permits at most 330 ms of authorized fast movement; ordinary and forged speeds cannot mint a dodge',()=>{
    const f=fixture();try{
      f.state.mobs=[];for(const id of world.RESOURCE_MAP.keys())f.state.depleted[id]=true;const x=f.p.x;
      const packet=(segments,commands=[])=>sim.applyInput(f.state,'p',{seq:f.p.seq+1,dx:1,dy:0,movements:segments,commands},now);
      now+=200;packet([{dx:1,dy:0,seconds:.2,speed:999}]);near(f.p.x,x+.84,'forged speed is walking');
      const a=f.p.x;packet([],[{type:'dodge'}]);now+=800;
      packet([{dx:1,dy:0,seconds:.75,speed:9}]);near(f.p.x,a+9*.33+4.2*.42,'full fast credit cap');
      const b=f.p.x;now+=200;packet([{dx:1,dy:0,seconds:.2,speed:9}]);near(f.p.x,b+.84,'exhausted credit cannot accelerate');
      now+=1000;packet([],[{type:'dodge'}]);const c=f.p.x;now+=1331;packet([{dx:1,dy:0,seconds:.1,speed:9}]);near(f.p.x,c+.42,'unused expired credit cannot be saved indefinitely');
    }finally{f.c.destroy();}
  });
  await test('legacy room queues are discarded while the already-started authoritative strike still resolves',()=>{
    const f=fixture();try{
      f.p.x=246.1;f.p.y=315.5;const attack={type:'attack',tool:'axe',target:'247:315'};
      sim.applyInput(f.state,'p',{seq:1,dx:0,dy:0,movements:[],commands:[attack,attack,attack]},now);
      assert.equal(f.p.attackQueue?.length??0,0,'early duplicate commands do not queue');
      f.p.attackQueue=[attack,attack];now+=sim.TOOL_TIMING.axe.contact;sim.tickWorld(f.state,now);
      assert.equal(f.p.attackQueue.length,0);assert.equal(f.state.resourceHp['247:315'],2,'current contact survives room upgrade');
      now+=1000;sim.tickWorld(f.state,now);assert.equal(f.state.resourceHp['247:315'],2,'old queued contacts never execute');
    }finally{f.c.destroy();}
  });
  await test('tool hit frames, client recovery and authoritative contact share one timing table',()=>{
    for(const tool of ['axe','pick','sword']){const timing=sim.TOOL_TIMING[tool];assert.equal(animation.swingFrame(tool,timing.contact),tool==='sword'?4:5);assert.equal(animation.swingFrame(tool,timing.duration-1),7);}
  });
  console.log(overlay?'OVERLAY '+overlay:'CURRENT SITE SOURCE',failures+' failure(s)');process.exitCode=failures?1:0;
}finally{Date.now=actual.now;globalThis.setTimeout=actual.setTimeout;globalThis.clearTimeout=actual.clearTimeout;await rm(temp,{recursive:true,force:true});}
