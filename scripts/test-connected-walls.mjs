import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const temp=await mkdtemp(join(tmpdir(),'linjian-wall-test-'));
try {
 const source=process.env.LINJIAN_WALL_MODULE??new URL('../lib/connected-wall.ts',import.meta.url);
 const js=ts.transpileModule(await readFile(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 await writeFile(join(temp,'walls.mjs'),js);
 const {wallLayout,wallConnections,floorWallInsets}=await import(pathToFileURL(join(temp,'walls.mjs')));
 const add=(map,x,y,kind='wall',open=false)=>map[`${x}:${y}:${kind==='floor'?'floor':'wall'}`]={id:'test',x,y,kind,open};
 const neighbors=[[0,-1],[1,0],[0,1],[-1,0]];
 let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS',name);};
 test('all 16 masks retain a central 8 px joint and stay inside the build cell',()=>{
  for(let mask=0;mask<16;mask++){const map={};neighbors.forEach(([x,y],i)=>{if(mask&(1<<i))add(map,x,y);});const shape=wallLayout(map,0,0);assert.ok(shape.x>=0&&shape.x<=8);assert.ok(shape.x+shape.width>=16&&shape.x+shape.width<=24);if((mask&5)&&!(mask&10)){assert.equal(shape.x,8);assert.equal(shape.width,8);}if(!(mask&5)){assert.equal(shape.x,0);assert.equal(shape.width,24);}}
 });
 test('every east/west connection meets at exactly the tile boundary',()=>{
  for(let mask=0;mask<16;mask++){const map={};add(map,0,0);add(map,1,0);neighbors.forEach(([x,y],i)=>{if(mask&(1<<i))add(map,x,y);});const a=wallLayout(map,0,0),b=wallLayout(map,1,0);assert.equal(a.x+a.width,24);assert.equal(b.x,0);}
 });
 test('north/south, corner and T connections always overlap in the central strip',()=>{
  for(let a=0;a<16;a++)for(let b=0;b<16;b++){const map={};add(map,0,0);add(map,0,1);neighbors.forEach(([x,y],i)=>{if(a&(1<<i))add(map,x,y);if(b&(1<<i))add(map,x,y+1);});const upper=wallLayout(map,0,0),lower=wallLayout(map,0,1);assert.ok(Math.min(upper.x+upper.width,lower.x+lower.width)-Math.max(upper.x,lower.x)>=8);}
 });
 test('window and open/closed door tiles participate in the same wall connections',()=>{
  for(const kind of ['wall','window','door'])for(const open of [false,true]){const map={};add(map,0,-1,kind,open);add(map,0,1,kind,open);assert.equal(wallLayout(map,0,0).width,8);assert.equal(wallConnections(map,0,0).north,true);}
 });
 test('only exposed perimeter floor edges are inset; interior floor stays connected',()=>{
  const map={};add(map,0,0);add(map,0,1);add(map,1,0,'floor');assert.deepEqual(floorWallInsets(map,0,0),{left:8,right:0});
  add(map,-1,0,'floor');assert.deepEqual(floorWallInsets(map,0,0),{left:0,right:0});delete map['1:0:floor'];assert.deepEqual(floorWallInsets(map,0,0),{left:0,right:8});
 });
 test('ordinary floors and horizontal walls do not crop the floor tile',()=>{
  const map={};add(map,1,0,'floor');assert.deepEqual(floorWallInsets(map,0,0),{left:0,right:0});add(map,0,0);add(map,1,0);assert.deepEqual(floorWallInsets(map,0,0),{left:0,right:0});
 });
 console.log(`${passed} wall topology checks passed`);
} finally {await rm(temp,{recursive:true,force:true});}
