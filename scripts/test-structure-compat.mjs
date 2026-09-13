import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'structure-compat'});
const names=['window','location','Image','requestAnimationFrame','cancelAnimationFrame','localStorage','fetch','setTimeout','clearTimeout'];
const originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
const clients=[],storage=new Map();let timer=0,checks=0;
try{
 globalThis.window={addEventListener(){},removeEventListener(){}};
 globalThis.location={href:'https://nornttyy.github.io/linjian-cottage/',origin:'https://nornttyy.github.io'};
 globalThis.Image=class{};
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 globalThis.setTimeout=()=>++timer;globalThis.clearTimeout=()=>{};
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
 const [{GameClient},sim,str,fence,delta]=await Promise.all(['client','simulation','structures','connected-fence','world-delta'].map(name=>import(project.module(name))));
 const canvas={width:800,height:600,clientWidth:800,clientHeight:600,addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
 const world=sim.createWorld(100000);world.players.p=sim.createPlayer('p','s','P',0,100000);
 world.buildings={};world.mobs=[];
 const put=(x,y,kind='fence')=>{const id=str.buildingKey(x,y,kind);world.buildings[id]={id,x,y,kind};};
 put(260,330);put(263,330,'wall');put(263,329);put(265,330);put(265,329,'door');
 const test=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
 let reply={room:'FENCE001',playerId:'p',token:'test',version:1,state:world};
 globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(reply)});
 const client=new GameClient(canvas,()=>{},()=>{},()=>{});clients.push(client);
 await test('old server capability overrides a newer migration marker retained in its saved world',async()=>{
  await client.connect('create');assert.equal(client.connected,true,client.error);
  assert.equal(client.world.structureVersion,undefined);
  assert.equal(world.structureVersion,1,'reply source was mutated');
  assert.deepEqual(str.barrierRects(client.world.buildings,260,330,0,client.world.structureVersion??0),[[0,9,24,6]]);
  assert.equal(fence.fenceMask(client.world.buildings,260,330,0,0)&15,10,'old standalone span must remain visible');
  assert.equal(str.wallLinks(client.world.buildings,263,330,0,0).north,true);
  assert.equal(fence.fenceConnections(client.world.buildings,265,330,0,0).north,true);
 });
 await test('upgraded server full snapshots enable independent fence geometry',async()=>{
  reply={...reply,structureVersion:1,version:2};await client.sync();
  assert.equal(client.world.structureVersion,1);
  assert.deepEqual(str.barrierRects(client.world.buildings,260,330),[[9,9,6,6]]);
  assert.equal(fence.fenceMask(client.world.buildings,260,330),0);
  assert.equal(str.wallLinks(client.world.buildings,263,330).north,false);
 });
 await test('server rollback full snapshots restore legacy prediction even when saved metadata says version one',async()=>{
  delete reply.structureVersion;reply.version=3;await client.sync();
  assert.equal(client.world.structureVersion,undefined);
 });
 await test('capability is reapplied after an incremental update rather than inherited from local state',async()=>{
  reply={room:'FENCE001',playerId:'p',version:4,structureVersion:1,delta:{base:3,set:{},maps:{}}};await client.sync();
  assert.equal(client.world.structureVersion,1);
  reply={room:'FENCE001',playerId:'p',version:5,delta:{base:4,set:{structureVersion:1},maps:{}}};await client.sync();
  assert.equal(client.world.structureVersion,undefined);
  assert.equal(client.worldVersion,5);
 });
 await test('local worlds retain new construction rules without a remote capability response',async()=>{
  const local=new GameClient(canvas,()=>{},()=>{},()=>{});clients.push(local);
  await local.connect('local');assert.equal(local.world.structureVersion,1);await local.sync();
  assert.equal(local.world.structureVersion,1);assert.equal(local.session.local,true);
 });
 await test('unsupported or malformed capability values retain known legacy rules',async()=>{
  for(const capability of [2,'1',null]){
   reply={room:'FENCE001',playerId:'p',state:world,structureVersion:capability};await client.sync();
   assert.equal(client.world.structureVersion,undefined);
  }
 });
 await test('world deltas carry the new rules marker when the authoritative simulation upgrades an old save',()=>{
  const previous=structuredClone(world);delete previous.structureVersion;
  const next=structuredClone(previous);sim.normalizeWorld(next,100001);
  const change=delta.worldDelta(previous,next,12);assert.equal(change.set.structureVersion,1);
  assert.equal(delta.applyWorldDelta(previous,change).structureVersion,1);
 });
 console.log(`${checks} structure compatibility checks passed`);
}finally{
 for(const client of clients)client.destroy();
 for(const[name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
 project.cleanup();
}
