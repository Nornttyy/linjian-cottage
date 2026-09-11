import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const overlay=process.env.LINJIAN_LOCK_OVERLAY;
const project=compileProject({name:'movement',overlay});
let now=100000,failures=0;
const actual={now:Date.now,setTimeout,clearTimeout};
try {
  const sim=await import(project.module('simulation'));
  const world=await import(project.module('world'));
  const animation=await import(project.module('animation'));
  const {GameClient}=await import(project.module('client'));
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
    c.connected=true;c.ready=true;c.session={playerId:'p',room:'TESTROOM',token:'test-token'};c.world=clone(state);c.pos={x:p.x,y:p.y,face:'down',moving:false};
    const f={c,state,p,defer:false,release:null};
    c.request=async body=>{
      sim.tickWorld(state,now);const message=body.input?sim.applyInput(state,'p',body.input,now):null;
      const reply={room:'TESTROOM',playerId:'p',state:clone(sim.publicWorld(state)),message};
      if(f.defer){f.defer=false;return new Promise(resolve=>{f.release=()=>resolve(reply);});}
      return reply;
    };
    // This fixture controls delivery explicitly; test-input-latency covers immediate scheduling.
    c.flushActions=()=>{};
    c.animate(now);
    f.advance=ms=>{for(let i=0;i<ms;i+=10){now+=Math.min(10,ms-i);c.animate(now);}};
    f.frame=()=>animation.heroFrame(c.world.players.p,c.pos.face,c.pos.moving,now,c.tool,c.localSwing);
    f.aim=(dx,dy)=>{c.pointer={x:c.pos.x+dx,y:c.pos.y+dy};};
    return f;
  }
  async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){failures++;console.log('FAIL',name,'—',e.message);}}


  const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-8,`${message}: ${a} vs ${b}`);
  function packet(f,{move=0,commands=[]}={}){return sim.applyInput(f.state,'p',{seq:f.p.seq+1,dx:move?1:0,dy:0,movements:move?[{dx:1,dy:0,seconds:move}]:[],commands},now);}
  for(const [tool,duration] of Object.entries(sim.TOOL_TIMING).map(([tool,timing])=>[tool,timing.duration])){
    await test(`${tool}: held movement is locked until the shared local and backdated authoritative deadline then resumes`,async()=>{
      const f=fixture();try{
        const x=f.c.pos.x;f.c.setTool(tool);f.aim(1,0);f.c.act();f.c.press('d',true);
        f.advance(100);near(f.c.pos.x,x,'before acknowledgement');await f.c.sync();
        f.advance(duration-101);near(f.c.pos.x,x,'through shared recovery deadline');
        assert.equal(f.c.keys.has('d'),true,'direction input survives lock');
        f.advance(1);near(f.c.pos.x,x,'no retroactive movement at exact unlock');
        f.advance(100);near(f.c.pos.x,x+.42,'held movement resumes');await f.c.sync();
        near(f.p.x,x+.42,'authoritative movement matches prediction');near(f.c.pos.x,f.p.x,'no correction');
      }finally{f.c.destroy();}
    });
    await test(`${tool}: server rejects fabricated movement and discards all locked movement credit`,()=>{
      const f=fixture();try{
        const x=f.p.x;packet(f,{commands:[{type:'attack',tool}]});
        now+=duration-1;packet(f,{move:.75});near(f.p.x,x,'cannot move during tool');near(f.p.moveCredit,0,'no credit accumulated');
        now+=3;packet(f,{move:.75});near(f.p.x,x+.0084,'only the two unlocked milliseconds may move');
      }finally{f.c.destroy();}
    });
  }
  await test('a walk followed by click in one request keeps the exact earlier predicted displacement',async()=>{
    const f=fixture();try{
      const x=f.c.pos.x;f.c.press('d',true);f.advance(100);near(f.c.pos.x,x+.42,'pre-click displacement');
      f.aim(1,0);f.c.act();f.advance(50);near(f.c.pos.x,x+.42,'stopped after click');await f.c.sync();
      near(f.p.x,x+.42,'server commits movement before this packet attack');near(f.c.pos.x,f.p.x,'no snap backward');
      f.advance(100);await f.c.sync();near(f.c.pos.x,x+.42,'no extra movement in later locked packet');
    }finally{f.c.destroy();}
  });
  await test('an old reply cannot release the movement lock for a newer unacknowledged action',async()=>{
    const f=fixture();try{
      f.defer=true;const older=f.c.sync();f.advance(20);f.aim(1,0);f.c.act();f.c.press('d',true);const x=f.c.pos.x;
      f.advance(600);f.release();await older;f.advance(10);near(f.c.pos.x,x,'unacknowledged action remains locked after old reply');
      await f.c.sync();assert.ok(f.p.swingUntil<=now,'late accepted attack retains its original deadline');
      f.advance(10);near(f.c.pos.x,x+.042,'completed backdated action resumes movement on the next frame');
    }finally{f.c.destroy();}
  });
  await test('late acknowledgement of a completed server action does not add a new movement-lock duration',async()=>{
    const f=fixture();try{
      f.aim(1,0);f.c.act();f.c.press('d',true);const x=f.c.pos.x;f.defer=true;const sent=f.c.sync();
      f.advance(1000);f.release();await sent;f.advance(10);near(f.c.pos.x,x+.042,'move on next frame, without restarting lock');
    }finally{f.c.destroy();}
  });
  await test('dodge cannot interrupt a tool, including an unconfirmed tool or attack+dodge in one packet',async()=>{
    const f=fixture();try{
      f.aim(1,0);f.c.act();assert.equal(f.c.command({type:'dodge'}),false);assert.ok(!f.c.commands.some(c=>c.type==='dodge'));
      packet(f,{commands:[{type:'attack',tool:'axe'},{type:'dodge'}]});assert.equal(f.p.dodgeUntil,0);assert.equal(f.p.stamina,100);
      now+=200;packet(f,{commands:[{type:'dodge'}]});assert.equal(f.p.dodgeUntil,0);assert.equal(f.p.stamina,100);
    }finally{f.c.destroy();}
  });
  await test('client waits for pending/active dodge; server rejects early attacks until all 330 ms of dodge finish',async()=>{
    const f=fixture();try{
      assert.equal(f.c.command({type:'dodge'}),true);f.aim(1,0);f.c.act();assert.equal(f.c.localSwing,null,'pending dodge wins');await f.c.sync();
      f.advance(200);f.c.act();assert.equal(f.c.localSwing,null,'active dodge wins');
      packet(f,{commands:[{type:'attack',tool:'sword'}]});assert.equal(f.p.swingStart,undefined);assert.equal(f.p.attackQueue?.length??0,0);
      now+=129;sim.tickWorld(f.state,now);assert.equal(f.p.swingStart,undefined);
      now+=1;sim.tickWorld(f.state,now);assert.equal(f.p.swingStart,undefined,'rejected input is not delayed');packet(f,{commands:[{type:'attack',tool:'sword'}]});assert.equal(f.p.swingStart,now);assert.equal(f.p.swingUntil-now,sim.TOOL_TIMING.sword.duration);
    }finally{f.c.destroy();}
  });
  await test('unlocked dodge retains existing 9 tile/s movement and 28 stamina cost',()=>{
    const f=fixture();try{
      const x=f.p.x;now+=100;packet(f,{move:.1,commands:[{type:'dodge'}]});near(f.p.x,x+.9,'dodge displacement');assert.equal(f.p.stamina,72);assert.equal(f.p.dodgeUntil-now,330);
    }finally{f.c.destroy();}
  });
  await test('early attacks neither interrupt recovery nor create a post-release backlog',()=>{
    const f=fixture();try{
      packet(f,{commands:[{type:'attack',tool:'axe'}]});const firstStart=now;now+=100;
      packet(f,{commands:[{type:'attack',tool:'axe'},{type:'attack',tool:'sword'}]});
      assert.equal(f.p.swingStart,firstStart);assert.equal(f.p.attackQueue?.length??0,0);
      now=firstStart+sim.TOOL_TIMING.axe.duration-1;const x=f.p.x;packet(f,{move:.75});near(f.p.x,x,'current recovery still locks');
      now=firstStart+1000;sim.tickWorld(f.state,now);assert.equal(f.p.swingStart,firstStart,'no second action after release');
      packet(f,{move:.1});assert.ok(f.p.x>x,'movement resumes without queue drain');
    }finally{f.c.destroy();}
  });
  await test('changing selected tool cannot release or shorten an axe recovery',()=>{
    const f=fixture();try{
      f.aim(1,0);f.c.act();const first=f.c.localSwing;f.advance(sim.TOOL_TIMING.axe.duration-80);f.c.setTool('sword');f.c.act();assert.equal(f.c.localSwing,first);f.c.press('d',true);const x=f.c.pos.x;f.advance(70);near(f.c.pos.x,x,'no tool-switch escape');
    }finally{f.c.destroy();}
  });
  await test('slime marks real wandering motion beyond player aggro radius and clears marker when idle or blocked',()=>{
    const f=fixture();try{
      const m=f.state.mobs[0];m.x=259.5;m.y=320.5;m.homeX=m.x;m.homeY=m.y;
      f.p.x=249.5;f.p.y=320.5;now+=150;f.p.seen=now;const x=m.x,y=m.y;sim.tickWorld(f.state,now);
      assert.ok(Math.hypot(m.x-x,m.y-y)>0,'wander really moved');assert.equal(m.movingUntil,now+250,'wander uses movement frames despite player being >8 tiles away');
      f.p.x=300;f.p.y=320;now+=150;sim.tickWorld(f.state,now);assert.equal(m.movingUntil,0,'no nearby active player means no movement');
      m.x=259.5;m.y=320.5;f.p.x=262;f.p.y=320.5;
      f.state.buildings['259:320:wall']={id:'259:320:wall',x:259,y:320,kind:'wall'};now+=150;sim.tickWorld(f.state,now);assert.equal(m.movingUntil,0,'blocked movement is not animated');
      delete m.movingUntil;assert.equal(now<(m.movingUntil??0),false,'older room snapshots are safe');
    }finally{f.c.destroy();}
  });
  await test('continuous harvesting executes accepted actions once and releasing leaves only the current contact',async()=>{
    const f=fixture();try{
      f.p.x=246.1;f.p.y=315.5;f.state.resourceHp['247:315']=100;f.c.world=clone(f.state);f.c.pos.x=f.p.x;f.c.pos.y=f.p.y;f.c.pointer={x:247.5,y:315.5};
      f.c.held=true;const starts=new Set();
      for(let elapsed=10;elapsed<=4000;elapsed+=10){f.advance(10);if(f.c.localSwing)starts.add(f.c.localSwing.start);if(elapsed%150===0)await f.c.sync();assert.equal(f.p.attackQueue?.length??0,0);}
      f.c.pointerUp();const lastLocal=f.c.localSwing.start;
      for(let i=0;i<8;i++){f.advance(150);await f.c.sync();}
      assert.ok(starts.size>3);assert.equal(100-f.state.resourceHp['247:315'],starts.size);assert.equal(f.c.localSwing.start,lastLocal);assert.equal(f.p.pendingStrike,undefined);assert.equal(f.p.attackQueue?.length??0,0);
    }finally{f.c.destroy();}
  });
  await test('a cave transition waits for the active swing to finish',()=>{
    const f=fixture();try{
      f.p.x=world.CAVE_ENTRANCE.x;f.p.y=world.CAVE_ENTRANCE.y;
      packet(f,{commands:[{type:'attack',tool:'axe'},{type:'interact'}]});
      assert.equal(world.sceneAt(f.p.x),'surface');
      now+=sim.TOOL_TIMING.axe.duration-1;assert.equal(sim.transitionScene(f.p,now,2),false);
      now+=1;assert.equal(sim.transitionScene(f.p,now,2),true);
      assert.equal(world.sceneAt(f.p.x),'mine');
    }finally{f.c.destroy();}
  });
  console.log(overlay?'OVERLAY '+overlay:'CURRENT SITE SOURCE',failures+' failure(s)');process.exitCode=failures?1:0;
}finally{Date.now=actual.now;globalThis.setTimeout=actual.setTimeout;globalThis.clearTimeout=actual.clearTimeout;project.cleanup();}
