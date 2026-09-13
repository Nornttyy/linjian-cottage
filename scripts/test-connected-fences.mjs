import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';

const project=compileProject({name:'connected-fences'});
try{
 const [str,sim,world]=await Promise.all(['structures','simulation','world'].map(name=>import(project.module(name))));
 const X=260,Y=330,directions=[['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]];
 let passed=0;
 const test=(name,fn)=>{fn();passed++;console.log('PASS',name);};
 const add=(buildings,x,y,kind='fence',level=0)=>{
  const id=str.buildingKey(x,y,kind,level);
  return buildings[id]={id,x,y,kind,level,...(kind==='door'?{open:false}:{})};
 };
 const expectedRects=links=>{
  const rects=[[9,9,6,6]];
  if(links.north)rects.push([9,0,6,9]);
  if(links.south)rects.push([9,15,6,9]);
  if(links.west)rects.push([0,9,9,6]);
  if(links.east)rects.push([15,9,9,6]);
  return rects;
 };

 test('fenceLinks and fenceRects preserve every fence-only connection mask',()=>{
  for(let mask=0;mask<16;mask++){
   const buildings={};add(buildings,X,Y);
   const expected={north:false,east:false,south:false,west:false};
   directions.forEach(([name,dx,dy],index)=>{if(mask&(1<<index)){add(buildings,X+dx,Y+dy);expected[name]=true;}});
   assert.deepEqual(str.fenceLinks(buildings,X,Y),expected,`links mask ${mask}`);
   assert.deepEqual(str.fenceRects(buildings,X,Y),expectedRects(expected),`rects mask ${mask}`);
  }
 });

 test('fence links stay on their requested floor',()=>{
  const buildings={};add(buildings,X,Y,'fence',1);add(buildings,X,Y-1,'fence',0);add(buildings,X+1,Y,'fence',1);
  assert.deepEqual(str.fenceLinks(buildings,X,Y,1),{north:false,east:true,south:false,west:false});
  assert.deepEqual(str.fenceRects(buildings,X,Y,1),[[9,9,6,6],[15,9,9,6]]);
 });

 test('walls and fences never alter each other connection topology',()=>{
  const fenceNetwork={};add(fenceNetwork,X,Y);add(fenceNetwork,X,Y-1,'wall');add(fenceNetwork,X+1,Y,'window');add(fenceNetwork,X,Y+1,'door');add(fenceNetwork,X-1,Y,'fence');
  assert.deepEqual(str.fenceLinks(fenceNetwork,X,Y),{north:false,east:false,south:false,west:true});
  assert.deepEqual(str.fenceRects(fenceNetwork,X,Y),[[9,9,6,6],[0,9,9,6]]);

  const wallNetwork={};add(wallNetwork,X,Y,'wall');add(wallNetwork,X,Y-1,'fence');add(wallNetwork,X+1,Y,'fence');add(wallNetwork,X,Y+1,'fence');add(wallNetwork,X-1,Y,'door');
  assert.deepEqual(str.wallLinks(wallNetwork,X,Y),{north:false,east:false,south:false,west:true});
  assert.deepEqual(str.wallRects(wallNetwork,X,Y),[[0,9,24,6]]);
 });

 let site;
 outer:for(let y=310;y<360;y++)for(let x=240;x<275;x++){
  if(!['grass','forest'].includes(world.terrainAt(x,y)))continue;
  if(Math.hypot(x-world.SPAWN.x,y-world.SPAWN.y)<=12||Math.hypot(x-world.CAVE_ENTRANCE.x,y-world.CAVE_ENTRANCE.y)<=8)continue;
  site={x,y};break outer;
 }
 assert(site,'no buildable test site');
 const fixture=()=>{
  const now=100000,state=sim.createWorld(now),player=sim.createPlayer('p','secret','Tester',0,now);
  state.players={p:player};state.mobs=[];state.buildings={};state.plots={};
  for(const resource of world.RESOURCE_MAP.values())state.depleted[resource.id]=true;
  player.x=site.x+.5;player.y=site.y-1;player.inventory.wood=100;player.inventory.stone=100;player.inventory.copper=100;
  add(state.buildings,site.x,site.y,'floor');
  return{state,player};
 };

 test('a fence cannot share one build cell with any wall-family piece',()=>{
  for(const kind of ['wall','window','door']){
   const {state,player}=fixture();add(state.buildings,site.x,site.y,kind);
   assert.equal(sim.canBuild(state,player,site.x,site.y,'fence'),'已被占用',`existing ${kind}`);
  }
 });

 test('wall-family pieces cannot share one build cell with a fence',()=>{
  for(const kind of ['wall','window','door']){
   const {state,player}=fixture();add(state.buildings,site.x,site.y,'fence');
   assert.equal(sim.canBuild(state,player,site.x,site.y,kind),'已被占用',`placing ${kind}`);
  }
 });

 test('all fence footprints block only their actual center and connected arms',()=>{
  for(let mask=0;mask<16;mask++){
   const {state}=fixture(),{x,y}=site;
   add(state.buildings,x,y);
   directions.forEach(([,dx,dy],index)=>{if(mask&(1<<index))add(state.buildings,x+dx,y+dy);});
   for(let py=0;py<24;py++)for(let px=0;px<24;px++){
    const center=px>=9&&px<15&&py>=9&&py<15;
    const north=(mask&1)&&px>=9&&px<15&&py<9;
    const east=(mask&2)&&px>=15&&py>=9&&py<15;
    const south=(mask&4)&&px>=9&&px<15&&py>=15;
    const west=(mask&8)&&px<9&&py>=9&&py<15;
    assert.equal(sim.isBlocked(state,x+(px+.5)/24,y+(py+.5)/24),Boolean(center||north||east||south||west),`mask ${mask}, pixel ${px},${py}`);
   }
  }
 });

 test('moving through a thin fence stops the full player body at its visible strip',()=>{
  const {state,player}=fixture(),{x,y}=site;
  add(state.buildings,x,y);add(state.buildings,x,y-1);add(state.buildings,x,y+1);
  player.x=x-.3;player.y=y+.5;
  sim.move(state,player,1.6,0);
  assert(Math.abs(player.x-(x+9/24-.2))<.001);
 });

 test('old overlapping wall and fence records remain intact and retain both physical arms',()=>{
  const {state}=fixture(),{x,y}=site;
  add(state.buildings,x,y,'wall');add(state.buildings,x,y);add(state.buildings,x,y+1);
  const before=structuredClone(state.buildings);
  sim.normalizeWorld(state,100001);
  assert.deepEqual(state.buildings,before);
  assert(str.wallOccupies(state.buildings,x+.1,y+.5));
  assert(str.wallOccupies(state.buildings,x+.5,y+.9));
 });

 console.log(`${passed} connected-fence checks passed`);
}finally{project.cleanup();}
