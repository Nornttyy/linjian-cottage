import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'hero-shape'}),saved=Object.getOwnPropertyDescriptor(globalThis,'document');
try{
 const [hero,wardrobe,registration,fishing]=await Promise.all(['hero-appearance','wardrobe-render','hero-registration','hero-fishing-art'].map(n=>import(project.module(n))));
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/hero-shape-actions.json',import.meta.url),'utf8'));
 const read=name=>({width:128,height:128,data:new Uint8ClampedArray(inflateSync(Buffer.from(fixture.frames[name],'base64')))});
 class Canvas{
  width=128;height=128;data=new Uint8ClampedArray(128*128*4);
  constructor(p){if(p)this.data=p.data.slice();}
  getContext(){return {getImageData:()=>({width:128,height:128,data:this.data.slice()}),putImageData:p=>{this.data=p.data.slice();},drawImage:(source,dx=0,dy=0)=>{for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(x+dx>=0&&x+dx<128&&y+dy>=0&&y+dy<128)this.data.set(source.data.subarray((y*128+x)*4,(y*128+x)*4+4),((y+dy)*128+x+dx)*4);}};}
 }
 globalThis.document={createElement:()=>new Canvas()};
 const art=Object.fromEntries(Object.keys(fixture.frames).map(name=>[name,new Canvas(read(name))]));
 const pixel=(p,i)=>Array.from(p.data.subarray(i*4,i*4+4));
 const test=(name,fn)=>{fn();console.log('PASS',name);};
 const partsFor=(name,a)=>{const p=read(name),body=name.startsWith('female-')?'female':'male',frame=name.replace(/^female-/,'');return {p,body,frame,parts:hero.recolorClothes(p,a??{body,shirt:'original',pants:'original'},frame)};};
 test('female cooking and fishing keep planted feet at the same position through every pose',()=>{
  for(const action of ['cook','fish'])for(const dir of ['down','up','right'])for(let f=0;f<8;f++){
   const name=`female-${action}-${dir}-${f}`,{parts,frame}=partsFor(name),[dx,dy]=registration.heroFrameOffset(frame,'female');
   const xs=parts.masks.shoes.map(i=>i%128).sort((a,b)=>a-b),ys=parts.masks.shoes.map(i=>i/128|0);
   const center=(xs[Math.floor(xs.length*.1)]+xs[Math.floor(xs.length*.9)])/2;
   assert(Math.abs(center+dx-64)<=.5,name+' horizontal drift');assert.equal(Math.max(...ys)+1+dy,96,name+' ground');
  }
 });
 test('action registration moves the complete sprite without stretching the face or dropping pixels',()=>{
  for(const name of Object.keys(art).filter(n=>/^female-(cook|fish)-/.test(n))){
   const frame=name.replace('female-',''),raw=art[name],aligned=registration.alignHeroFrame(raw,frame,'female'),[dx,dy]=registration.heroFrameOffset(frame,'female');
   let before=0,after=0;for(let i=0;i<128*128;i++){if(raw.data[i*4+3]){before++;assert.deepEqual(pixel(aligned,i+dx+dy*128),pixel(raw,i),name);}if(aligned.data[i*4+3])after++;}assert.equal(before,after,name+' clipping');
   assert.equal(registration.alignHeroFrame(raw,frame,'female'),aligned,'cached result');
  }
 });
 test('registered fishing line starts at the visible rod and mirrors with the character',()=>{
  for(const dir of ['down','up','right'])for(let f=0;f<8;f++){
   const frame=`fish-${dir}-${f}`,rod=fishing.fishingRod(frame,'female'),[dx,dy]=registration.heroFrameOffset(frame,'female'),a=fishing.fishingLineOrigin(frame,'female'),b=fishing.fishingLineOrigin(frame,'female',true);
   assert.equal(a.x+32,(rod[0]+dx)/2);assert.equal(a.y+48,(rod[1]+dy)/2);assert.equal(b.x,-a.x);assert.equal(b.y,a.y);
  }
 });
}finally{if(saved)Object.defineProperty(globalThis,'document',saved);else delete globalThis.document;project.cleanup();}
