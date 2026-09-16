import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'revised-appearance'});
try{
 const {recolorClothes}=await import(project.module('hero-appearance'));
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/female-revised-actions.json',import.meta.url)));
 const decode=f=>({width:128,height:128,data:new Uint8ClampedArray(inflateSync(Buffer.from(f.rgba,'base64')))});
 const dyes={shirt:'#e92bc0',pants:'#406be5',hair:'#7c39d2',skin:'#b77b56',eyes:'#17cc9c',shoes:'#35915a',trim:'#f5c638'};
 const original={body:'female',shirt:'original',pants:'original'};
 for(const[file,hash]of Object.entries(fixture.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../public/art/'+file,import.meta.url))).digest('hex'),hash,'stale revised fixture: '+file);
 const reviewed={
  'water-down-0':[['shirt',60,65],['pants',56,84],['shoes',57,92],['tool',64,77]],
  'water-down-2':[['shirt',60,65]],'water-down-6':[['shirt',60,65]],
  'water-right-0':[['hair',71,44],['skin',69,40]],
  'water-up-1':[['tool',82,57]],'water-up-2':[['tool',84,58]],
  'hoe-down-5':[['shirt',60,73],['pants',63,84],['shoes',50,90],['hair',66,50],['tool',40,94]],
 };
 for(const[frame,f]of Object.entries(fixture.frames)){
  const base=decode(f),parts=recolorClothes(decode(f),original,frame,f.registration),dyed=decode(f);
  recolorClothes(dyed,{...original,...dyes},frame,f.registration);
  for(let i=3;i<base.data.length;i+=4)assert.equal(dyed.data[i],base.data[i],frame+' changed silhouette');
  for(const i of parts.protectedPixels)assert.deepEqual(dyed.data.slice(i*4,i*4+4),base.data.slice(i*4,i*4+4),frame+' dyed its tool');
  for(const[part,x,y]of reviewed[frame]??[]){
   const i=y*128+x;assert.equal(base.data[i*4+3],255,frame+' reviewed pixel is visible');
   assert((part==='tool'?parts.protectedPixels:parts.masks[part])?.includes(i),frame+' material at '+x+','+y+' must be '+part);
   for(const channel of Object.keys(dyes)){
    const p=decode(f);recolorClothes(p,{...original,[channel]:dyes[channel]},frame,f.registration);
    if(channel===part)assert.notDeepEqual(p.data.slice(i*4,i*4+3),base.data.slice(i*4,i*4+3));
    else assert.deepEqual(p.data.slice(i*4,i*4+4),base.data.slice(i*4,i*4+4),frame+' '+channel+' bleeds into '+part);
   }
  }
 }
 console.log('PASS revised female action fixtures preserve tools, silhouettes and independent face, hair, garment and boot dyes');
}finally{project.cleanup();}
