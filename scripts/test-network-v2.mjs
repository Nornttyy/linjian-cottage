// Runs protocol 1 and 2 against current sources; no git history or real database required.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'network-v2',api:true,isolates:4});
try {
const [sim,world,delta]=await Promise.all(['simulation','world','world-delta'].map(name=>import(project.module(name))));
const updated=await import(project.route()),legacy=updated;
const isolates=await Promise.all([0,1,2,3].map(index=>import(project.route(index))));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),clone=x=>JSON.parse(JSON.stringify(x));
const hash=async token=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
const tokens=['network-test-one','network-test-two','network-test-three','network-test-four'];const secrets=await Promise.all(tokens.map(hash));
class Database{
 constructor(state,latency=20,room='NETTEST1'){this.row={state:JSON.stringify(state),version:0};this.latency=latency;this.room=room;this.reads=0;this.writes=0;this.conflicts=0;}
 prepare(sql){return{bind:(...values)=>({first:async()=>{this.reads++;await sleep(this.latency);return values[0]===this.room?{...this.row}:null;},run:async()=>{this.writes++;await sleep(this.latency);assert.ok(sql.startsWith('UPDATE'));const [state,,room,version]=values;if(room!==this.room||version!==this.row.version){this.conflicts++;return{meta:{changes:0}};}this.row={state,version:version+1};return{meta:{changes:1}};}})};}
}
function fixture(latency=20,room='NETTEST1'){
 const now=Date.now(),state=sim.createWorld(now);for(let i=0;i<4;i++)state.players['p'+i]=sim.createPlayer('p'+i,secrets[i],'Test '+i,i,now);
 const db=new Database(state,latency,room);globalThis.__networkTestDb=db;return{state,db};
}
function request(route,index,input,extra={}){return route.POST(new Request('https://game.test/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sync',room:globalThis.__networkTestDb.room,token:tokens[index],input,...extra})}));}
const idle=seq=>({seq,dx:0,dy:0,commands:[],movements:[]});let failures=0,passed=0;const report={measurements:[],checks:[]};
async function test(name,fn){try{await fn();passed++;report.checks.push({name,pass:true});console.log('PASS',name);}catch(e){failures++;report.checks.push({name,pass:false,error:e.stack});console.error('FAIL',name,e);}}
for(const dbLatency of [20,80])for(const mode of ['legacy-four','v2-one-worker','v2-four-workers'])await test(`${mode}: four players, D1 operation ${dbLatency}ms`,async()=>{
 const {db}=fixture(dbLatency),started=performance.now();let times=[],bodies=[];
 await Promise.all(tokens.map(async(_,i)=>{const route=mode==='legacy-four'?legacy:mode==='v2-one-worker'?updated:isolates[i];const res=await request(route,i,idle(1),mode==='legacy-four'?{}:{protocol:2,poll:true});assert.equal(res.status,200);bodies.push(await res.json());times.push(Math.round(performance.now()-started));}));
 const state=JSON.parse(db.row.state);for(let i=0;i<4;i++)assert.equal(state.players['p'+i].seq,1);
 const m={mode,dbLatency,replyMs:times.sort((a,b)=>a-b),reads:db.reads,writes:db.writes,conflicts:db.conflicts,version:db.row.version};report.measurements.push(m);console.log(' ',JSON.stringify(m));
 if(mode==='v2-one-worker'){assert.equal(db.writes,1);assert.equal(db.conflicts,0);assert.ok(Math.max(...times)<dbLatency*3+60);}
});
await test('v2 deltas reconstruct exact public state, removal and future schema; no secrets',async()=>{
 const {db}=fixture(1,'DELTATES');let res=await request(updated,0,idle(1),{protocol:2,poll:true});const first=await res.json();
 const changed=JSON.parse(db.row.state);changed.buildings['1:1:wall']={id:'1:1:wall',x:1,y:1,kind:'wall',level:2};changed.crops={'f0':{stage:2,watered:true}};db.row.state=JSON.stringify(changed);
 res=await request(updated,0,idle(2),{protocol:2,poll:true,sinceVersion:first.version});const second=await res.json();assert.ok(second.delta,'delta used');
 const rebuilt=delta.applyWorldDelta(first.state,second.delta);assert.deepEqual(rebuilt,sim.publicWorld(JSON.parse(db.row.state)));assert.equal(JSON.stringify(second).includes(secrets[0]),false);assert.equal(rebuilt.crops.f0.stage,2);
 const third=clone(rebuilt);delete third.buildings['1:1:wall'];assert.deepEqual(delta.applyWorldDelta(rebuilt,delta.worldDelta(rebuilt,third,1)),third);
 console.log('  full',JSON.stringify(first).length,'bytes; delta',JSON.stringify(second).length,'bytes');
});
await test('mixed valid/invalid microbatch never authenticates another player',async()=>{
 const {db}=fixture(1,'AUTHTEST');const good=request(updated,0,idle(1),{protocol:2,poll:true});const bad=updated.POST(new Request('https://game.test/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sync',room:db.room,token:'invalid',input:idle(1),protocol:2,poll:true})}));
 const results=await Promise.all([good,bad]);assert.deepEqual(results.map(r=>r.status),[200,403]);assert.equal(db.writes,1);assert.equal(JSON.parse(db.row.state).players.p1.seq,0);
});
await test('malformed null commands/movement cannot poison another player microbatch',async()=>{
 const {db}=fixture(1,'BADINPUT');const outcomes=await Promise.all([
  request(updated,0,idle(1),{protocol:2,poll:true}),
  request(updated,1,{...idle(1),commands:[null]},{protocol:2,poll:true}),
  request(updated,2,{...idle(1),movements:[null]},{protocol:2,poll:true}),
 ]);assert.deepEqual(outcomes.map(r=>r.status),[200,400,400]);assert.equal(db.writes,1);assert.equal(JSON.parse(db.row.state).players.p0.seq,1);
});
await test('duplicate input seq produces no second damage or fresh-write CAS',async()=>{
 const {db}=fixture(1,'RETRYTES');await request(updated,0,idle(1),{protocol:2,poll:true});const writes=db.writes;await request(updated,0,idle(1),{protocol:2,poll:true});assert.equal(db.writes,writes);assert.equal(db.row.version,1);
});
await test('real HTTP attack resolves at contact before returning without another browser poll',async()=>{
 const {db,state}=fixture(1,'CONTACT1');state.mobs=[];const tree=[...world.RESOURCE_MAP.values()].find(r=>r.kind==='tree');state.players.p0.x=tree.x+.5;state.players.p0.y=tree.y+1.5;db.row.state=JSON.stringify(state);
 const issuedAt=Date.now(),res=await request(updated,0,{...idle(1),commands:[{type:'attack',tool:'axe',target:tree.id,face:'up',id:'contact-test',issuedAt}]},{protocol:2,poll:true});const body=await res.json();
 assert.equal(res.status,200);assert.equal(body.state.resourceHp[tree.id],2);assert.equal(body.state.players.p0.pendingStrike,undefined);assert.equal(body.state.events.filter(e=>e.kind==='hit').length,1);assert.ok(Date.now()-issuedAt>=180);assert.ok(Date.now()-issuedAt<290);console.log('  contact reply',Date.now()-issuedAt,'ms');
});
await test('bounded backdating retains cooldown, target distance and one hit per packet',()=>{
 const now=100000,state=sim.createWorld(now);state.mobs=[];const p=state.players.p=sim.createPlayer('p','s','T',0,now-5000),tree=[...world.RESOURCE_MAP.values()].find(r=>r.kind==='tree');p.x=tree.x+.5;p.y=tree.y+1.5;
 const command={type:'attack',tool:'axe',target:tree.id,issuedAt:now-100000};sim.applyInput(state,'p',{...idle(1),commands:Array.from({length:5},()=>({...command}))},now);
 assert.equal(p.swingStart,now-2000);assert.equal(p.actionAt,now+380);assert.equal(state.resourceHp[tree.id],2);assert.equal(state.events.filter(e=>e.kind==='hit').length,1);
 sim.applyInput(state,'p',{...idle(2),commands:[command]},now+100);assert.equal(state.resourceHp[tree.id],2);
 p.x+=100;sim.applyInput(state,'p',{...idle(3),commands:[{...command,issuedAt:now+400}]},now+400);assert.equal(state.resourceHp[tree.id],2);
});
await test('backdated recovery grants elapsed post-tool movement without granting locked movement',()=>{
 const now=100000,state=sim.createWorld(now);state.mobs=[];for(const id of world.RESOURCE_MAP.keys())state.depleted[id]=true;
 const p=state.players.p=sim.createPlayer('p','s','T',0,now-1000),x=p.x;sim.applyInput(state,'p',{...idle(1),commands:[{type:'attack',tool:'axe',issuedAt:now-600}]},now);
 assert.equal(p.swingUntil,now-240);sim.applyInput(state,'p',{...idle(2),movements:[{dx:1,dy:0,seconds:.54,speed:4.2}]},now+300);assert.ok(Math.abs(p.x-x-.54*4.2)<1e-7);
 const p2=state.players.q=sim.createPlayer('q','s2','T',0,now),x2=p2.x;sim.applyInput(state,'q',{...idle(1),commands:[{type:'attack',tool:'axe',issuedAt:now}]},now);sim.applyInput(state,'q',{...idle(2),movements:[{dx:1,dy:0,seconds:.2}]},now+100);assert.equal(p2.x,x2);
});

await test('native plots and two-level buildings survive delta updates/removal exactly',()=>{
 const before=sim.createWorld(100000),p=before.players.p=sim.createPlayer('p','secret','T',0,100000);p.level=1;
 before.plots={'260:320':{x:260,y:320,crop:'carrot',progress:20,updated:100000,wetUntil:180000}};
 for(const level of [0,1]){const id=sim.buildingKey(260,320,'floor',level);before.buildings[id]={id,x:260,y:320,kind:'floor',level};}
 const after=clone(before);after.plots['260:320'].progress=40;after.plots['261:320']={x:261,y:320,progress:0,updated:120000,wetUntil:0};delete after.buildings[sim.buildingKey(260,320,'floor',1)];after.players.p.level=0;after.players.p.inventory.carrotSeed--;
 const clean=sim.publicWorld(before),rebuilt=delta.applyWorldDelta(clean,delta.worldDelta(clean,sim.publicWorld(after),22));assert.deepEqual(rebuilt,sim.publicWorld(after));assert.equal(rebuilt.players.p.secret,undefined);assert.equal(before.players.p.inventory.carrotSeed,6,'delta must not mutate previous state');
});
await test('farm retry is idempotent and seed/plot mutation remains authoritative',async()=>{
 const {db,state}=fixture(1,'FARMRETR');const p=state.players.p0,x=Math.floor(p.x)+1,y=Math.floor(p.y);state.mobs=[];state.plots={[`${x}:${y}`]:{x,y,progress:0,updated:Date.now(),wetUntil:0}};db.row.state=JSON.stringify(state);
 const input={...idle(1),commands:[{type:'plant',crop:'carrot',x,y,id:'one-seed',issuedAt:Date.now()-600}]};const first=await request(updated,0,input,{protocol:2,poll:true});assert.equal(first.status,200);const planted=await first.json();assert.equal(planted.state.players.p0.inventory.carrotSeed,5);assert.equal(planted.state.plots[`${x}:${y}`].crop,'carrot');
 const second=await request(updated,0,input,{protocol:2,poll:true});assert.equal(second.status,200);assert.equal(JSON.parse(db.row.state).players.p0.inventory.carrotSeed,5);assert.equal(JSON.parse(db.row.state).events.filter(e=>e.kind==='plant').length,1);
});
await test('legacy room migration preserves inventory, plots, house keys and authenticates sync v2',async()=>{
 const {db,state}=fixture(1,'MIGRATE1');delete state.plots;delete state.creatureVersion;for(const p of Object.values(state.players)){delete p.level;for(const key of ['carrotSeed','tomatoSeed','wheatSeed','carrot','tomato','wheat'])delete p.inventory[key];p.inventory.wood=17;}
 state.buildings['260:320:floor']={id:'260:320:floor',x:260,y:320,kind:'floor'};db.row.state=JSON.stringify(state);
 const res=await request(updated,0,idle(1),{protocol:2,poll:true});assert.equal(res.status,200);const body=await res.json();assert.equal(body.state.players.p0.inventory.wood,17);assert.equal(body.state.players.p0.inventory.carrotSeed,6);assert.equal(body.state.players.p0.level,0);assert.ok(body.state.plots);assert.ok(body.state.buildings['260:320:floor']);assert.equal(body.state.creatureVersion,1);
});
report.passed=passed;report.failures=failures;
console.log(`${passed} passed, ${failures} failed`);if(failures)process.exitCode=1;
} finally { delete globalThis.__networkTestDb; project.cleanup(); }
