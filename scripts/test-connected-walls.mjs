import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';

const project=compileProject({name:'connected-walls',overrides:process.env.LINJIAN_WALL_MODULE?{'lib/connected-wall.ts':process.env.LINJIAN_WALL_MODULE}:{}});
try {
const {wallLayout,wallConnections,floorWallInsets}=await import(project.module('connected-wall'));
 const add=(map,x,y,kind='wall',open=false)=>map[`${x}:${y}:${kind==='floor'?'floor':'wall'}`]={id:'test',x,y,kind,open};
 const neighbors=[[0,-1],[1,0],[0,1],[-1,0]];
 let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS',name);};
 test('all 16 masks retain a central 6 px joint and stay inside the build cell',()=>{
  for(let mask=0;mask<16;mask++){const map={};neighbors.forEach(([x,y],i)=>{if(mask&(1<<i))add(map,x,y);});const shape=wallLayout(map,0,0);assert.ok(shape.x>=0&&shape.x<=9);assert.ok(shape.x+shape.width>=15&&shape.x+shape.width<=24);if((mask&5)&&!(mask&10)){assert.equal(shape.x,9);assert.equal(shape.width,6);}if(!(mask&5)){assert.equal(shape.x,0);assert.equal(shape.width,24);}}
 });
 test('every east/west connection meets at exactly the tile boundary',()=>{
  for(let mask=0;mask<16;mask++){const map={};add(map,0,0);add(map,1,0);neighbors.forEach(([x,y],i)=>{if(mask&(1<<i))add(map,x,y);});const a=wallLayout(map,0,0),b=wallLayout(map,1,0);assert.equal(a.x+a.width,24);assert.equal(b.x,0);}
 });
 test('north/south, corner and T connections always overlap in the central strip',()=>{
  for(let a=0;a<16;a++)for(let b=0;b<16;b++){const map={};add(map,0,0);add(map,0,1);neighbors.forEach(([x,y],i)=>{if(a&(1<<i))add(map,x,y);if(b&(1<<i))add(map,x,y+1);});const upper=wallLayout(map,0,0),lower=wallLayout(map,0,1);assert.ok(Math.min(upper.x+upper.width,lower.x+lower.width)-Math.max(upper.x,lower.x)>=6);}
 });
 test('window and open/closed door tiles participate in the same wall connections',()=>{
  for(const kind of ['wall','window','door'])for(const open of [false,true]){const map={};add(map,0,-1,kind,open);add(map,0,1,kind,open);assert.equal(wallLayout(map,0,0).width,6);assert.equal(wallConnections(map,0,0).north,true);}
 });
 test('only exposed perimeter floor edges are inset; interior floor stays connected',()=>{
  const map={};add(map,0,0);add(map,0,1);add(map,1,0,'floor');assert.deepEqual(floorWallInsets(map,0,0),{left:9,right:0,top:0,bottom:0});
  add(map,-1,0,'floor');assert.deepEqual(floorWallInsets(map,0,0),{left:0,right:0,top:0,bottom:0});delete map['1:0:floor'];assert.deepEqual(floorWallInsets(map,0,0),{left:0,right:9,top:0,bottom:0});
 });
 test('ordinary floors remain whole and perimeter wall edges crop toward the interior',()=>{
  const map={};add(map,1,0,'floor');assert.deepEqual(floorWallInsets(map,0,0),{left:0,right:0,top:0,bottom:0});add(map,0,0);add(map,1,0);assert.deepEqual(floorWallInsets(map,0,0),{left:9,right:0,top:0,bottom:0});add(map,0,1,'floor');assert.deepEqual(floorWallInsets(map,0,0),{left:9,right:0,top:9,bottom:0});
 });
 console.log(`${passed} wall topology checks passed`);
} finally {project.cleanup();}
