import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const ts=(await import(pathToFileURL(join(source,'node_modules/typescript/lib/typescript.js')))).default;
const overlay=process.env.LINJIAN_ANIMATION_OVERLAY;
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
    // This fixture controls delivery explicitly; test-input-latency covers immediate scheduling.
    c.flushActions=()=>{};
    c.animate(now);
    f.advance=ms=>{for(let i=0;i<ms;i+=10){now+=Math.min(10,ms-i);c.animate(now);}};
    f.frame=()=>animation.heroFrame(c.world.players.p,c.pos.face,c.pos.moving,now,c.tool,c.localSwing);
    f.aim=(dx,dy)=>{c.pointer={x:c.pos.x+dx,y:c.pos.y+dy};};
    return f;
  }
  async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){failures++;console.log('FAIL',name,'—',e.message);}}

  await test('acknowledgement never rewinds an already visible swing frame',async()=>{
    const f=fixture();try{
      f.aim(1,0);f.c.act();f.advance(150);const before=f.frame();
      await f.c.sync();const after=f.frame();
      assert.equal(after,before,`before ${before}, after ${after}`);
    }finally{f.c.destroy();}
  });
  await test('an older in-flight snapshot cannot erase a newer click',async()=>{
    const f=fixture();try{
      f.defer=true;const syncing=f.c.sync();
      f.advance(60);f.aim(1,0);f.c.act();f.advance(80);const before=f.frame();
      f.release();await syncing;
      assert.equal(f.frame(),before,`before ${before}, after ${f.frame()}`);
      f.advance(10);await f.c.sync();
      assert.equal(f.frame(),`axe-right-${animation.swingFrame('axe',90)}`);
    }finally{f.c.destroy();}
  });
  await test('movement cannot turn a swing after its aim direction is chosen',async()=>{
    const f=fixture();try{
      f.aim(1,0);f.c.act();f.c.press('w',true);f.advance(20);
      assert.match(f.frame(),/^axe-right-/);
      assert.equal(animation.heroFacing?.(f.c.world.players.p,f.c.pos.face,now,f.c.localSwing),'right');
      await f.c.sync();
      assert.match(animation.heroFrame(f.p,f.p.face,true,now,'axe'),/^axe-right-/,'remote actor must use the captured attack face');
    }finally{f.c.destroy();}
  });
  await test('left-facing attack remains mirrored after opposite movement',async()=>{
    const f=fixture();try{
      f.aim(-1,0);f.c.act();f.c.press('d',true);f.advance(40);
      assert.equal(animation.heroFacing?.(f.c.world.players.p,f.c.pos.face,now,f.c.localSwing),'left');
      assert.match(f.frame(),/^axe-right-/,'left uses the right sheet plus renderer mirroring');
    }finally{f.c.destroy();}
  });
  await test('tool selection alone cannot change the weapon in an active swing',async()=>{
    const f=fixture();try{
      f.aim(1,0);f.c.act();f.advance(100);f.c.setTool('pick');await f.c.sync();
      assert.match(f.frame(),/^axe-right-/);
      f.advance(400);assert.match(f.frame(),/^idle-/,'completed local swing must not replay the later server timeline');
    }finally{f.c.destroy();}
  });
  await test('completed local attack is not restarted by a very late reply',async()=>{
    const f=fixture();try{
      f.aim(1,0);f.c.act();f.advance(200);f.defer=true;const syncing=f.c.sync();
      f.advance(350);f.release();await syncing;
      assert.match(f.frame(),/^idle-/);
    }finally{f.c.destroy();}
  });
  await test('damage and resource changes remain exclusively authoritative at existing contact time',async()=>{
    const f=fixture();try{
      f.p.x=246.1;f.p.y=315.5;f.c.world=clone(f.state);f.c.pos.x=f.p.x;f.c.pos.y=f.p.y;
      f.c.pointer={x:247.5,y:315.5};f.c.act();
      assert.equal(f.state.resourceHp['247:315'],undefined);
      await f.c.sync();f.advance(sim.TOOL_TIMING.axe.contact-1);sim.tickWorld(f.state,now);
      assert.equal(f.state.resourceHp['247:315'],undefined);
      f.advance(1);sim.tickWorld(f.state,now);
      assert.equal(f.state.resourceHp['247:315'],2);
    }finally{f.c.destroy();}
  });
  await test('API URL constructor argument remains available',()=>{
    const f=fixture();try{assert.equal(f.c.apiUrl,'https://example.test/api/game');}finally{f.c.destroy();}
  });
  await test('generated contact poses line up with authoritative strike timing',()=>{
    assert.equal(animation.swingFrame('axe',sim.TOOL_TIMING.axe.contact-1),4);
    assert.equal(animation.swingFrame('axe',sim.TOOL_TIMING.axe.contact),5);
    assert.equal(animation.swingFrame('pick',sim.TOOL_TIMING.pick.contact),5);
    assert.equal(animation.swingFrame('sword',sim.TOOL_TIMING.sword.contact-1),3);
    assert.equal(animation.swingFrame('sword',sim.TOOL_TIMING.sword.contact),4);
    for(const tool of ['axe','pick','sword']){
      const end=sim.TOOL_TIMING[tool].duration;
      const frames=new Set(Array.from({length:end},(_,i)=>animation.swingFrame(tool,i)));
      assert.equal(frames.size,8,`${tool} must use every generated pose`);
    }
  });
  console.log(overlay?'OVERLAY '+overlay:'CURRENT SITE SOURCE',failures+' failure(s)');process.exitCode=failures?1:0;
}finally{Date.now=actual.now;globalThis.setTimeout=actual.setTimeout;globalThis.clearTimeout=actual.clearTimeout;await rm(temp,{recursive:true,force:true});}
