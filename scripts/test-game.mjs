import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'linjian-tests-'));
try{
 for(const name of ['world','simulation']){const source=await readFile(new URL('../lib/'+name+'.ts',import.meta.url),'utf8');const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from './world'","from './world.mjs'");await writeFile(join(dir,name+'.mjs'),output);}
 const sim=await import(pathToFileURL(join(dir,'simulation.mjs'))),world=await import(pathToFileURL(join(dir,'world.mjs')));
 let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
 function fixture(){const now=100000,state=sim.createWorld(now),p=sim.createPlayer('p','private-secret','Tester',0,now);state.players.p=p;return{now,state,p};}
 function command(f,c,time=550){f.now+=time;const result=sim.applyInput(f.state,'p',{seq:f.p.seq+1,dx:0,dy:0,commands:[c]},f.now);if(c.type==='attack'){f.now+=280;sim.tickWorld(f.state,f.now);}return result;}
 test('fixed world is large, with traversable spawn and separate biomes',()=>{assert.equal(world.WORLD_SIZE,512);assert.equal(world.terrainAt(256,320),'path');assert.equal(world.terrainAt(350,80),'snow');assert.equal(world.terrainAt(350,205),'rock');assert.equal(world.terrainAt(160,414),'marsh');assert.equal(world.terrainAt(283,328),'water');});
 test('harvesting requires the correct tool and proximity; three hits yield six wood',()=>{const f=fixture(),r=world.RESOURCE_MAP.get('247:315');assert(r);f.p.x=r.x-.6;f.p.y=r.y+.5;assert.equal(command(f,{type:'attack',tool:'pick',target:r.id}),'使用斧头');assert.equal(f.state.resourceHp[r.id],undefined);for(let i=0;i<3;i++)command(f,{type:'attack',tool:'axe',target:r.id});assert.equal(f.p.inventory.wood,6);assert.equal(f.state.depleted[r.id],true);command(f,{type:'attack',tool:'axe',target:r.id});assert.equal(f.p.inventory.wood,6);const far=world.RESOURCES.find(x=>x.kind==='tree'&&x.x<50);assert.equal(command(f,{type:'attack',tool:'axe',target:far.id}),'距离太远');});
 test('replayed input cannot duplicate gathering or construction',()=>{const f=fixture();f.p.inventory.wood=20;const input={seq:1,dx:0,dy:0,commands:[{type:'build',part:'floor',x:259,y:322}]};sim.applyInput(f.state,'p',input,f.now+300);sim.applyInput(f.state,'p',input,f.now+600);assert.equal(f.p.inventory.wood,18);assert.equal(Object.keys(f.state.buildings).length,1);});
 test('house modules require floors, consume resources and fully refund on removal',()=>{const f=fixture();f.p.inventory.wood=20;assert.equal(command(f,{type:'build',part:'wall',x:259,y:322}),'需要地板');for(const part of ['floor','wall','roof'])assert.equal(command(f,{type:'build',part,x:259,y:322}),null);assert.equal(f.p.inventory.wood,13);assert.equal(sim.isBlocked(f.state,259.5,322.5),true);for(let i=0;i<3;i++)command(f,{type:'remove',x:259,y:322});assert.equal(f.p.inventory.wood,20);assert.equal(Object.keys(f.state.buildings).length,0);});
 test('building rejects insufficient materials, occupied player cells and invalid components',()=>{const f=fixture();assert.equal(command(f,{type:'build',part:'floor',x:259,y:322}),'材料不足');f.p.inventory.wood=20;command(f,{type:'build',part:'floor',x:259,y:322});f.p.x=259.5;f.p.y=322.5;assert.equal(command(f,{type:'build',part:'wall',x:259,y:322}),'有人站在这里');assert.equal(command(f,{type:'build',part:'__proto__',x:260,y:322}),'无效构件');});
 test('doors toggle collision and cannot close on a player',()=>{const f=fixture();f.p.inventory.wood=20;f.p.x=258.5;f.p.y=322.5;command(f,{type:'build',part:'floor',x:259,y:322});command(f,{type:'build',part:'door',x:259,y:322});assert.equal(sim.isBlocked(f.state,259.5,322.5),false);command(f,{type:'interact'});assert.equal(sim.isBlocked(f.state,259.5,322.5),true);command(f,{type:'interact'});f.p.x=259.5;assert.equal(command(f,{type:'interact'}),'门口有人');});
 test('three sword hits defeat a slime and award one drop only',()=>{const f=fixture(),m=f.state.mobs[0];f.p.x=m.x-1.4;f.p.y=m.y;for(let i=0;i<3;i++){m.x=f.p.x+1.4;command(f,{type:'attack',tool:'sword',target:m.id});}assert.equal(m.hp,0);assert.equal(f.p.inventory.essence,2);assert.equal(f.p.kills,1);command(f,{type:'attack',tool:'sword',target:m.id});assert.equal(f.p.inventory.essence,2);});
 test('monster windup deals damage; dodging avoids the hit',()=>{for(const dodge of [false,true]){const f=fixture(),m=f.state.mobs[0];f.p.x=m.x-1;f.p.y=m.y;sim.tickWorld(f.state,f.now+100);assert(m.windup>0);if(dodge)f.p.dodgeUntil=m.windup+100;sim.tickWorld(f.state,m.windup+1);assert.equal(f.p.hp,dodge?100:86);}});
 test('death returns the player to camp without deleting materials',()=>{const f=fixture();f.p.hp=0;f.p.x=350;f.p.inventory.wood=17;sim.tickWorld(f.state,f.now+100);assert.equal(f.p.x,world.SPAWN.x);assert.equal(f.p.hp,75);assert.equal(f.p.inventory.wood,17);});
 test('solid resource trunks block movement; harvesting opens the tile',()=>{const f=fixture(),r=world.RESOURCE_MAP.get('247:315');assert.equal(sim.isBlocked(f.state,r.x+.5,r.y+.5),true);f.state.depleted[r.id]=true;assert.equal(sim.isBlocked(f.state,r.x+.5,r.y+.5),false);assert.equal(sim.isBlocked(f.state,283.5,328.5),true);});
 test('essence restores health and cannot be wasted at full health',()=>{const f=fixture();f.p.inventory.essence=2;f.p.hp=85;command(f,{type:'heal'});assert.equal(f.p.hp,100);assert.equal(f.p.inventory.essence,1);command(f,{type:'heal'});assert.equal(f.p.inventory.essence,1);});
 test('closed walls block melee attacks',()=>{const f=fixture(),m=f.state.mobs[0];f.p.x=265.8;f.p.y=322.5;m.x=267.2;m.y=322.5;f.state.buildings['266:322:wall']={id:'266:322:wall',x:266,y:322,kind:'wall'};command(f,{type:'attack',tool:'sword',target:m.id});assert.equal(m.hp,54);});
 test('saved state round-trips and public snapshots never expose session secrets',()=>{const f=fixture();f.p.inventory.wood=31;f.state.depleted['247:315']=true;const saved=JSON.parse(JSON.stringify(f.state));assert.equal(saved.players.p.inventory.wood,31);assert.equal(saved.depleted['247:315'],true);const publicState=sim.publicWorld(saved);assert.equal(publicState.players.p.secret,undefined);assert.equal(saved.players.p.secret,'private-secret');});

 test('cave entrance changes scene, preserves inventory, and returns to the surface exit',()=>{
  const f=fixture();f.p.x=world.CAVE_ENTRANCE.x;f.p.y=world.CAVE_ENTRANCE.y;f.p.inventory.wood=17;
  sim.applyInput(f.state,'p',{seq:1,dx:0,dy:0,commands:[]},f.now+100);
  assert.equal(world.sceneAt(f.p.x),'mine');assert.equal(f.p.x,world.MINE.spawn.x);assert.equal(f.p.inventory.wood,17);
  f.p.x=world.MINE.exit.x;f.p.y=world.MINE.exit.y;
  assert.equal(sim.transitionScene(f.p,f.now+200,.8),false,'portal cooldown prevents bouncing');
  assert.equal(sim.transitionScene(f.p,f.now+2000,.8),true);assert.equal(world.sceneAt(f.p.x),'surface');assert.equal(f.p.y,world.CAVE_ENTRANCE.y+2);
 });
 test('fixed cave rooms are connected and cave walls block movement',()=>{
  const start=[Math.floor(world.MINE.spawn.x),Math.floor(world.MINE.spawn.y)],seen=new Set([start.join(':')]),q=[start];
  for(let i=0;i<q.length;i++)for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){const [x,y]=q[i],p=[x+dx,y+dy],key=p.join(':');if(!seen.has(key)&&world.caveFloor(...p)){seen.add(key);q.push(p);}}
  for(const [x,y] of [[688,80],[686,60],[665,42],[704,37],[684,18]])assert(seen.has(x+':'+y),'unreachable cave room');
  const f=fixture();assert(sim.isBlocked(f.state,641,1));f.p.x=world.MINE.spawn.x;f.p.y=world.MINE.spawn.y;f.p.inventory.wood=100;assert.equal(sim.canBuild(f.state,f.p,688,82,'floor'),'矿洞内无法建造');
 });
 test('harvest damage waits for the generated swing contact frame',()=>{
  const f=fixture(),r=world.RESOURCE_MAP.get('247:315');f.p.x=r.x-.6;f.p.y=r.y+.5;
  sim.applyInput(f.state,'p',{seq:1,dx:0,dy:0,commands:[{type:'attack',tool:'axe',target:r.id}]},f.now+100);
  assert.equal(f.state.resourceHp[r.id],undefined);sim.tickWorld(f.state,f.now+300);assert.equal(f.state.resourceHp[r.id],undefined);sim.tickWorld(f.state,f.now+350);assert.equal(f.state.resourceHp[r.id],2);
  sim.tickWorld(f.state,f.now+450);assert.equal(f.state.resourceHp[r.id],2);
 });
 console.log(`${checks} game rules passed`);
}finally{await rm(dir,{recursive:true,force:true});}
