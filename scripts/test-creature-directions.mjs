import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'creature-directions'});
try{
const sim=await import(project.module('simulation')),world=await import(project.module('world'));
const {creatureFrame,creatureFacing}=await import(project.module('animation'));
const {CREATURES}=await import(project.module('creatures'));
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS',name);};
const T=1000000;
function fixture(kind){
 const s=sim.createWorld(T),p=sim.createPlayer('p','secret','p',0,T);
 s.players={p};s.mobs=[];s.buildings={};s.creatureVersion=1;
 for(const r of world.RESOURCE_MAP.values())s.depleted[r.id]=true;
 let spot;for(let y=310;y<350&&!spot;y++)for(let x=240;x<275&&!spot;x++){
  if(Math.hypot(x-world.SPAWN.x,y-world.SPAWN.y)<15)continue;
  if(Array.from({length:9},(_,i)=>Array.from({length:9},(_,j)=>world.terrainAt(x+i-4,y+j-4))).flat().every(t=>!['water','cave-wall'].includes(t)))spot={x:x+.5,y:y+.5};
 }
 assert(spot);const m={id:kind,kind,...spot,homeX:spot.x,homeY:spot.y,hp:CREATURES[kind].hp,windup:0,cooldown:T+10000,deadUntil:0,hitUntil:0,face:'down'};
 s.mobs=[m];return{s,p,m};
}
for(const kind of ['boar','mushroom']){
 test(`${kind} follows a target through all four directions and selects matching artwork`,()=>{
  const {s,p,m}=fixture(kind);let now=T;
  for(const [face,dx,dy]of[['right',5,0],['up',0,-5],['left',-5,0],['down',0,5]]){
   p.x=m.x+dx;p.y=m.y+dy;p.seen=now+=100;sim.tickWorld(s,now);
   assert.equal(m.face,face);assert.equal(creatureFacing(m,now),face);
   const prefix=face==='down'?kind:kind+'-'+(face==='left'?'right':face);
   assert.equal(creatureFrame(m,now,true,0),prefix+'-move-0');
  }
 });
 test(`${kind} holds its telegraphed aim, then turns to the moved target after recovery`,()=>{
  const {s,p,m}=fixture(kind);m.cooldown=0;p.x=m.x+3;p.y=m.y;
  sim.tickWorld(s,T+10);assert.equal(m.face,'right');const impact=m.windup;
  p.x=m.x-3;sim.tickWorld(s,impact-1);assert.equal(m.face,'right');
  assert.match(creatureFrame(m,impact-1,false),new RegExp('^'+kind+'-right-attack-'));
  sim.tickWorld(s,impact);const end=kind==='boar'?m.chargeUntil+1:impact+351;
  p.x=m.x-3;p.seen=end;sim.tickWorld(s,end);assert.equal(m.face,'left');
 });
 test(`${kind} wandering updates facing from actual movement`,()=>{
  const {s,p,m}=fixture(kind);p.x=m.x+10;p.y=m.y;const x=m.x,y=m.y;
  sim.tickWorld(s,T+500);const dx=m.x-x,dy=m.y-y;assert(Math.hypot(dx,dy)>0);
  assert.equal(m.face,Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
 });
 test(`${kind} retains direction through hurt and death without replaying an attack`,()=>{
  const {m}=fixture(kind);m.face='up';m.hitUntil=T+350;
  assert.equal(creatureFrame(m,T,false),kind+'-up-hurt-0');
  m.hp=0;m.deadUntil=T+90000;assert.equal(creatureFrame(m,T,false),kind+'-up-death-0');
  assert.equal(creatureFrame(m,T+480,false),null);
 });
}
test('boar charge artwork follows its locked velocity even in an old snapshot with stale face',()=>{
 const {m}=fixture('boar');m.face='down';m.chargeUntil=T+550;m.chargeX=-1;m.chargeY=0;
 assert.equal(creatureFacing(m,T),'left');assert.equal(creatureFrame(m,T,true,0),'boar-right-attack-4');
 m.chargeX=0;m.chargeY=-1;assert.equal(creatureFrame(m,T,true,0),'boar-up-attack-4');
});
console.log(`${passed} creature direction checks passed`);
}finally{project.cleanup();}
