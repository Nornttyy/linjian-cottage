// Portable: node scripts/test-tool-effects.mjs or LINJIAN_SOURCE=/path/to/game node /private/tmp/test-tool-effects.mjs
// Optional LINJIAN_TOOL_EFFECTS_OVERLAY=/tmp/dir overrides lib TS files. Uses the real client/simulation/animation/renderer.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const source=resolve(process.env.LINJIAN_SOURCE||fileURLToPath(new URL('..',import.meta.url))),overlay=process.env.LINJIAN_TOOL_EFFECTS_OVERLAY;
const temp=await mkdtemp(join(tmpdir(),'linjian-tool-effects-'));
const original={now:Date.now,window:globalThis.window,Image:globalThis.Image,document:globalThis.document,raf:globalThis.requestAnimationFrame,caf:globalThis.cancelAnimationFrame,timeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
let now=100000,checks=0,failures=0;
try{
 const ts=(await import(pathToFileURL(join(source,'node_modules/typescript/lib/typescript.js')))).default;
 const names=['world','simulation','frame-layout','inventory','roof-visibility','connected-wall','tiles','animation','atmosphere','renderer','art','client'];
 for(const name of names){let path=join(source,'lib',name+'.ts');if(overlay){const candidate=join(overlay,name+'.ts');try{await access(candidate);path=candidate;}catch{}}
  const code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"]\.\/(world|simulation|frame-layout|inventory|roof-visibility|connected-wall|tiles|animation|atmosphere|renderer|art)(?:\.ts)?['"]/g,"from './$1.mjs'");await writeFile(join(temp,name+'.mjs'),code);
 }
 const sim=await import(pathToFileURL(join(temp,'simulation.mjs'))),world=await import(pathToFileURL(join(temp,'world.mjs'))),{render}=await import(pathToFileURL(join(temp,'renderer.mjs'))),{GameClient}=await import(pathToFileURL(join(temp,'client.mjs')));
 const clone=value=>JSON.parse(JSON.stringify(value));
 const art=new Proxy({}, {get:(obj,name)=>obj[name]??={name,width:64,height:64}});
 const gradient=()=>({addColorStop(){}});
 globalThis.document={createElement(){const c={width:1,height:1};const context=new Proxy({drawImage(image){c.name=image.name;},createLinearGradient:gradient,createRadialGradient:gradient},{get:(obj,key)=>key in obj?obj[key]:()=>{}});c.getContext=()=>context;return c;}};
 globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.Image=class{};Date.now=()=>now;
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
 function recordingCanvas(){let matrix=[1,0,0,1,0,0];const saves=[],draws=[];
  const multiply=(a,b,c,d,e,f)=>{const [aa,bb,cc,dd,ee,ff]=matrix;matrix=[aa*a+cc*b,bb*a+dd*b,aa*c+cc*d,bb*c+dd*d,aa*e+cc*f+ee,bb*e+dd*f+ff];};
  const target={globalAlpha:1,globalCompositeOperation:'source-over',save(){saves.push({matrix:[...matrix],alpha:this.globalAlpha,composite:this.globalCompositeOperation});},restore(){const s=saves.pop();if(s){matrix=s.matrix;this.globalAlpha=s.alpha;this.globalCompositeOperation=s.composite;}},translate(x,y){multiply(1,0,0,1,x,y);},scale(x,y){multiply(x,0,0,y,0,0);},rotate(a){multiply(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},transform:multiply,setTransform(...values){matrix=values;},resetTransform(){matrix=[1,0,0,1,0,0];},createLinearGradient:gradient,createRadialGradient:gradient,
   drawImage(image,...args){let[x,y,w,h]=args.length>=8?args.slice(4):args;w??=image.width;h??=image.height;draws.push({name:image.name,matrix:[...matrix],x,y,w,h,alpha:this.globalAlpha,composite:this.globalCompositeOperation});}};
  const ctx=new Proxy(target,{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  return{width:400,height:300,clientWidth:800,clientHeight:600,getContext:()=>ctx,draws,addEventListener(){},removeEventListener(){},getBoundingClientRect(){return{left:0,top:0,width:800,height:600};}};
 }
 function fixture(){now+=10000;const s=sim.createWorld(now),p=sim.createPlayer('p','secret','Test',0,now);s.mobs=[];s.players.p=p;const canvas=recordingCanvas(),c=new GameClient(canvas,()=>{},()=>{},()=>{});
  c.connected=true;c.session={playerId:'p',room:'ROOM',token:'secret-token'};c.world=clone(s);c.pos={x:p.x,y:p.y,face:'down',moving:false};c.flushActions=()=>{};
  const f={s,p,c,canvas,start:now,defer:false,release:null};
  c.request=async body=>{sim.tickWorld(s,now);const message=body.input?sim.applyInput(s,'p',body.input,now):null,reply={room:'ROOM',playerId:'p',state:clone(sim.publicWorld(s)),message};if(f.defer){f.defer=false;return new Promise(resolve=>{f.release=()=>resolve(reply);});}return reply;};
  c.animate(now);c.art=art;
  f.advance=ms=>{for(let i=0;i<ms;i+=10){now+=Math.min(10,ms-i);c.animate(now);}};
  f.aim=face=>{const vector={right:[1,0],left:[-1,0],down:[0,1],up:[0,-1]}[face];c.pointer={x:c.pos.x+vector[0],y:c.pos.y+vector[1]};};
  return f;
 }
 const trails=draws=>draws.filter(d=>typeof d.name==='string'&&d.name.startsWith('trail-'));
 const chips=draws=>draws.filter(d=>['wood','stone-icon','copper-icon'].includes(d.name)&&d.w===4&&d.h===4);
 function draw(f,time=now,options={}){const state=options.state??f.c.world,pos=options.pos??f.c.pos,view={tool:f.c.tool,part:'floor',remove:false,pointer:null,time,roomKey:'ROOM',localSwing:f.c.localSwing,...options.view};const before=JSON.stringify(state),swing=JSON.stringify(view.localSwing);f.canvas.draws.length=0;render(f.canvas,state,options.id??'p',pos,view,art);assert.equal(JSON.stringify(state),before,'renderer changed authoritative WorldState');assert.equal(JSON.stringify(view.localSwing),swing,'renderer changed local action');return [...f.canvas.draws];}
 function drawClient(f){const before=JSON.stringify(f.c.world);f.canvas.draws.length=0;f.c.animate(now);assert.equal(JSON.stringify(f.c.world),before,'client presentation changed authoritative state');return [...f.canvas.draws];}
 function singleTrail(draws){const result=trails(draws);assert.equal(result.length,1,'expected one active tool trail');return result[0];}
 const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: expected${b}, got${a}`);
 async function test(name,run){checks++;try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,'—',e.message);}}
 for(const tool of ['axe','pick','sword'])await test(`real renderer displays all8 ${tool} FX phases at60Hz and ends with the action`,()=>{
  const f=fixture();try{const timing=sim.TOOL_TIMING[tool],start=now,swing={tool,face:'right',start,until:start+timing.duration},seen=new Set();
   assert.equal(trails(draw(f,start,{view:{localSwing:swing}})).length,0);
   for(let frame=1;frame/60*1000<timing.duration;frame++){for(const d of trails(draw(f,start+frame/60*1000,{view:{localSwing:swing}})))seen.add(d.name);}
   assert.deepEqual([...seen].sort(),Array.from({length:8},(_,i)=>`trail-${tool}-${i}`),`observed phases ${[...seen].join(',')}`);
   assert.equal(singleTrail(draw(f,start+timing.contact,{view:{localSwing:swing}})).name,`trail-${tool}-4`);
   assert.equal(trails(draw(f,swing.until,{view:{localSwing:swing}})).length,0);assert.equal(trails(draw(f,swing.until+900,{view:{localSwing:swing}})).length,0);
  }finally{f.c.destroy();}
 });
 await test('action acknowledgement cannot rewind the actual local trail phase',async()=>{const f=fixture();try{f.aim('right');f.c.act();f.advance(180);const before=singleTrail(drawClient(f));await f.c.sync();const after=singleTrail(drawClient(f));assert.equal(after.name,before.name);assert.deepEqual(after.matrix,before.matrix);}finally{f.c.destroy();}});
 await test('a snapshot sent before a new click cannot erase its visible trail',async()=>{const f=fixture();try{f.defer=true;const request=f.c.sync();f.advance(50);f.aim('left');f.c.act();f.advance(180);const before=singleTrail(drawClient(f));f.release();await request;const after=singleTrail(drawClient(f));assert.equal(after.name,before.name);assert.deepEqual(after.matrix,before.matrix);}finally{f.c.destroy();}});
 await test('late acknowledgement after local completion cannot replay the still-active authoritative trail',async()=>{const f=fixture();try{f.aim('right');f.c.act();f.advance(200);f.defer=true;const request=f.c.sync();f.advance(350);f.release();await request;assert.ok(f.c.world.players.p.swingUntil>now,'late reply deliberately still contains an active server swing');assert.equal(trails(drawClient(f)).length,0);}finally{f.c.destroy();}});
 await test('pointer, movement and tool changes retain the captured local tool/direction and layering',async()=>{
  for(const face of ['right','left','down','up']){const f=fixture();try{f.c.setTool('sword');f.aim(face);f.c.act();f.advance(120);f.aim({right:'left',left:'right',down:'up',up:'down'}[face]);f.c.press(face==='up'?'s':'w',true);f.c.setTool('pick');f.advance(10);await f.c.sync();
   const draws=drawClient(f),trail=singleTrail(draws),angle={right:0,left:Math.PI,down:Math.PI/2,up:-Math.PI/2}[face];assert.equal(trail.name,'trail-sword-4');near(trail.matrix[0],Math.cos(angle),'rotation cos');near(trail.matrix[1],Math.sin(angle),'rotation sin');near(trail.matrix[4],f.canvas.width/2,'trail x pivot');near(trail.matrix[5],f.canvas.height/2-12,'trail y pivot');
   const hero=draws.findIndex(d=>typeof d.name==='string'&&d.name.startsWith('sword-')),fx=draws.indexOf(trail);assert.ok(hero>=0);assert.equal(fx<hero,face==='up','up effect is behind actor; other directions in front');
  }finally{f.c.destroy();}}
 });
 await test('remote effects use authoritative attack face/tool, independently of local selection and swing',()=>{const f=fixture();try{const remote=sim.createPlayer('remote','secret','Other',1,now);Object.assign(remote,{x:f.p.x+2,y:f.p.y,face:'left',swingFace:'up',equipped:'axe',swingStart:now,swingUntil:now+360});f.c.world.players.remote=remote;const result=singleTrail(draw(f,now+180,{view:{tool:'pick',localSwing:null}}));assert.equal(result.name,'trail-axe-4');near(result.matrix[1],-1,'captured remote up direction');assert.equal(trails(draw(f,now+360,{view:{localSwing:null}})).length,0);}finally{f.c.destroy();}});
 await test('hurt and dodge suppress both local and authoritative trails with no recovery ghost',()=>{for(const local of [true,false])for(const interruption of ['hurt','dodge']){const f=fixture();try{const player=f.c.world.players.p;Object.assign(player,{equipped:'axe',swingStart:now,swingUntil:now+360});if(interruption==='hurt')player.hurtAt=now;else player.dodgeUntil=now+330;const view=local?{localSwing:{tool:'axe',face:'right',start:now,until:now+360}}:{localSwing:undefined};for(const age of [30,120,180,300])assert.equal(trails(draw(f,now+age,{view})).length,0,`${interruption} at${age}`);assert.equal(trails(draw(f,now+700,{view})).length,0);}finally{f.c.destroy();}}});
 await test('deep-frozen world and local action survive all trail directions without mutation',()=>{const f=fixture();try{function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}freeze(f.c.world);for(const face of ['right','left','up','down'])draw(f,now+180,{view:{localSwing:freeze({tool:'axe',face,start:now,until:now+360})}});}finally{f.c.destroy();}});
 const resourceOf=kind=>[...world.RESOURCE_MAP.values()].find(r=>r.kind===kind);
 function atResource(f,resource){Object.assign(f.p,{x:resource.x-1,y:resource.y+.5});f.c.pos={x:f.p.x,y:f.p.y,face:'right',moving:false};f.c.world=clone(f.s);}
 for(const [kind,tool,icon]of [['tree','axe','wood'],['stone','pick','stone-icon'],['copper','pick','copper-icon']])await test(`actual ${kind} strike emits4 material fragments only after authoritative contact`,()=>{const f=fixture();try{const r=resourceOf(kind);assert.ok(r);atResource(f,r);const command={type:'attack',tool,target:r.id,face:'right'},timing=sim.TOOL_TIMING[tool],start=now,swing={tool,face:'right',start,until:start+timing.duration};sim.applyInput(f.s,'p',{seq:1,dx:0,dy:0,commands:[command],movements:[]},now);sim.tickWorld(f.s,start+timing.contact-1);assert.equal(chips(draw(f,start+timing.contact-1,{state:f.s,view:{localSwing:swing}})).length,0);sim.tickWorld(f.s,start+timing.contact);assert.ok(f.s.events.some(e=>e.kind==='hit'&&e.amount===1));const particles=chips(draw(f,start+timing.contact+20,{state:f.s,view:{localSwing:swing}}));assert.equal(particles.length,4);assert.ok(particles.every(d=>d.name===icon));assert.equal(chips(draw(f,start+timing.contact+340,{state:f.s,view:{localSwing:swing}})).length,0);}finally{f.c.destroy();}});
 await test('empty swings and wrong-tool attempts never synthesize resource fragments or damage',()=>{for(const target of [undefined,resourceOf('stone')]){const f=fixture();try{if(target)atResource(f,target);sim.applyInput(f.s,'p',{seq:1,dx:0,dy:0,movements:[],commands:[{type:'attack',tool:'axe',target:target?.id,face:'right'}]},now);sim.tickWorld(f.s,now+180);assert.equal(f.s.events.filter(e=>e.kind==='hit').length,0);assert.equal(chips(draw(f,now+180,{state:f.s,view:{localSwing:{tool:'axe',face:'right',start:now,until:now+360}}})).length,0);}finally{f.c.destroy();}}});
 await test('resource-fragment drawing requires a current hit event, never hurt/pickup/build/future/expired events',()=>{const f=fixture();try{const r=resourceOf('tree');atResource(f,r);for(const [kind,age,amount]of [['hurt',20,1],['wood',20,6],['build',20,0],['hit',-1,1],['hit',341,1]]){f.s.events=[{id:'contract',kind,time:now-age,x:r.x+.5,y:r.y+.5,amount}];assert.equal(chips(draw(f,now,{state:f.s,view:{localSwing:null}})).length,0,`${kind} age${age} must not emit material chips`);}}finally{f.c.destroy();}});
 await test('authoritative berry harvest does not emit stone mining fragments',()=>{const f=fixture();try{const r=resourceOf('berry');atResource(f,r);sim.applyInput(f.s,'p',{seq:1,dx:0,dy:0,movements:[],commands:[{type:'attack',tool:'axe',target:r.id,face:'right'}]},now);sim.tickWorld(f.s,now+180);assert.ok(f.s.events.some(e=>e.kind==='hit'&&e.amount===1));assert.equal(chips(draw(f,now+200,{state:f.s,view:{localSwing:null}})).length,0);}finally{f.c.destroy();}});
 console.log(`${checks} tool-effects checks; ${failures} failure(s)${overlay?' — overlay '+overlay:''}`);process.exitCode=failures?1:0;
}finally{Date.now=original.now;globalThis.window=original.window;globalThis.Image=original.Image;globalThis.document=original.document;globalThis.requestAnimationFrame=original.raf;globalThis.cancelAnimationFrame=original.caf;globalThis.setTimeout=original.timeout;globalThis.clearTimeout=original.clearTimeout;await rm(temp,{recursive:true,force:true});}
