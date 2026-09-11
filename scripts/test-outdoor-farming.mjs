import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'outdoor-farming'});
let failures=0;
try{
 const [sim,str,world]=await Promise.all(['simulation','structures','world'].map(name=>import(project.module(name))));
 let x,y;outer:for(let b=310;b<360;b++)for(let a=240;a<275;a++)if(['grass','forest'].includes(world.terrainAt(a,b))&&Math.hypot(a-world.SPAWN.x,b-world.SPAWN.y)>12){x=a;y=b;break outer;}
 for(const part of ['fence','planter','lantern','sign'])try{
  const now=100000,s=sim.createWorld(now),p=sim.createPlayer('p','secret','Tester',0,now);s.players={p};s.mobs=[];s.buildings={};s.plots={};p.x=x+.5;p.y=y-1;p.inventory.wood=100;p.inventory.stone=100;p.inventory.copper=100;for(const r of world.RESOURCE_MAP.values())s.depleted[r.id]=true;
  assert.equal(sim.applyInput(s,'p',{seq:1,dx:0,dy:0,commands:[{type:'build',part,x,y}]},now),null);
  const id=str.buildingKey(x,y,part),before=structuredClone(s.buildings[id]);
  const result=sim.applyInput(s,'p',{seq:2,dx:0,dy:0,commands:[{type:'till',x,y}]},now+1000);
  assert(!s.plots[`${x}:${y}`],`${part}: till created a plot overlapping outdoor fixture; response=${result}`);
  assert.deepEqual(s.buildings[id],before);
  console.log('PASS',part,'cannot till occupied outdoor fixture');
 }catch(error){failures++;console.log('FAIL',error.message);}
 console.log(`${4-failures} passed, ${failures} failed`);process.exitCode=failures?1:0;
}finally{project.cleanup();}
