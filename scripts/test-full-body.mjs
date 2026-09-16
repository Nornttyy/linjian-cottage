import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';import{inflateSync}from'node:zlib';import{createHash}from'node:crypto';import{compileProject}from'./test-support.mjs';
const project=compileProject({name:'full-body'}),saved=Object.getOwnPropertyDescriptor(globalThis,'document');
try{
 const{completeBodyParts,completeBodies,dyeCompleteBody}=await import(project.module('full-body-art'));
 const{dressedHero,dressedFishingLineOrigin}=await import(project.module('hero-appearance'));
 const{fullBodyKey}=await import(project.module('full-body-layout'));
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/full-body-actions.json',import.meta.url)));
 const decode=f=>({width:128,height:128,data:new Uint8ClampedArray(inflateSync(Buffer.from(f.rgba,'base64')))});
 const reference=f=>JSON.parse(inflateSync(Buffer.from(f.reference,'base64')).toString());
 const original={shirt:'original',pants:'original'},dyes={shirt:'#e92bc0',pants:'#406be5',hair:'#7c39d2',skin:'#b77b56',eyes:'#17cc9c',shoes:'#35915a',trim:'#f5c638',outfitColor:'#cb40b9',outfitTrim:'#52c98b'};
 const outfit=f=>f.family==='swim'?'river-swim':f.family+'-cloak';
 const rgba=(p,x,y)=>Array.from(p.data.subarray((y*128+x)*4,(y*128+x)*4+4));
 class Canvas{width=128;height=128;data=new Uint8ClampedArray(128*128*4);constructor(p){if(p)this.data=p.data.slice();}getContext(){return{getImageData:()=>({width:128,height:128,data:this.data.slice()}),putImageData:p=>{this.data=p.data.slice();},drawImage:source=>{this.data=source.data.slice();}};}}
 globalThis.document={createElement:()=>new Canvas()};
 for(const[file,hash]of Object.entries(fixture.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../public/art/'+file,import.meta.url))).digest('hex'),hash,'real sprite fixture is stale: '+file);
 console.log('PASS real body fixtures match the authored assets');
 for(const f of fixture.frames){
  const p=decode(f),info={family:f.family,parts:completeBodyParts(p,reference(f),f.family,f.frame,f.body)},source=new Canvas(p),base=new Canvas();base.data.set([255,0,0,255],0);
  completeBodies.set(source,info);const art={[f.body==='female'?'female-'+f.frame:f.frame]:base,[fullBodyKey(f.family,f.body,f.frame)]:source};
  const a={body:f.body,...original,outfit:outfit(f)},result=dressedHero(art,f.frame,a);
  assert.deepEqual(result.data,p.data,f.family+' '+f.frame+' must use the complete authored body, including its transparent silhouette');
  const dyed=dressedHero(art,f.frame,{...a,...dyes});for(let i=3;i<p.data.length;i+=4)assert.equal(dyed.data[i],p.data[i],f.family+' '+f.frame+' dye changed anatomy');
  assert.deepEqual(source.data,p.data,'preview must not mutate the shared atlas');
  Object.defineProperty(art,fullBodyKey(f.family,f.body,f.frame),{get(){throw Error('cached pose was unnecessarily decoded again');}});
  assert.equal(dressedHero(art,f.frame,{...a,...dyes}),dyed);
 }
 console.log(`PASS ${fixture.frames.length} real male/female poses retain authored silhouettes and leave their source atlas intact`);
 for(const[frame,part,x,y]of [['axe-up-3','hair',62,37],['water-down-1','pants',64,77],['water-down-3','skin',62,82],['water-down-3','pants',62,76],['water-down-3','shirt',62,67],['water-down-6','pants',64,77],['hammer-down-2','skin',44,55],['hammer-down-3','skin',58,82],['hammer-down-3','pants',62,76],['hammer-down-3','hair',62,40]]){
  const f=fixture.frames.find(f=>f.family==='swim'&&f.body==='female'&&f.frame===frame),p=decode(f),info={family:'swim',parts:completeBodyParts(p,reference(f),'swim',frame,'female')};
  assert.equal(p.data[(y*128+x)*4+3],255);
  assert(info.parts.masks[part]?.includes(y*128+x),`${frame} ${part} must own reviewed pixel ${x},${y}`);
  for(const other of Object.keys(dyes)){
   // Outfit color intentionally supplies the default for undyed swimwear.
   if(other==='outfitColor'&&(part==='shirt'||part==='pants'))continue;
   const changed=decode(f);dyeCompleteBody(changed,{body:'female',...original,[other]:dyes[other]},info);
   if(other===part)assert.notDeepEqual(rgba(changed,x,y),rgba(p,x,y),`${frame} ${part} must recolor`);else assert.deepEqual(rgba(changed,x,y),rgba(p,x,y),`${frame} ${other} must not bleed into ${part}`);
  }
 }
 console.log('PASS narrow swimwear keeps the crown, exposed legs and separate bikini pieces in their own dye channels');
 for(const[frame,x,y]of [['pick-up-3',59,31],['water-down-1',81,75],['water-down-3',83,76],['water-down-6',80,75],['hammer-down-2',44,40],['hammer-up-2',76,32],['hammer-right-3',82,72]]){
  const f=fixture.frames.find(f=>f.family==='swim'&&f.body==='female'&&f.frame===frame),p=decode(f),info={family:'swim',parts:completeBodyParts(p,reference(f),'swim',f.frame,'female')},changed=decode(f);
  dyeCompleteBody(changed,{body:'female',...original,...dyes},info);
  assert.equal(p.data[(y*128+x)*4+3],255);
  assert.deepEqual(rgba(changed,x,y),rgba(p,x,y),`${frame} must keep the reviewed tool pixel at ${x},${y} in its authored color`);
 }
 console.log('PASS swimwear preserves the actual pick handle, watering can and wooden hammer');
 const f=fixture.frames.find(f=>f.family==='mushroom'&&f.body==='female'&&f.frame==='pick-down-3'),p=decode(f),info={family:f.family,parts:completeBodyParts(p,reference(f),f.family,f.frame)};
 for(const[part,x,y]of [['skin',64,60],['skin',58,60],['skin',61,61],['eyes',66,60],['skin',69,61],['hair',68,46],['outfitColor',55,56],['shoes',59,92]]){
  assert(info.parts.masks[part]?.includes(y*128+x),part+' must own the reviewed pixel '+x+','+y);
  for(const other of Object.keys(dyes)){
   const changed=decode(f);dyeCompleteBody(changed,{body:'female',...original,[other]:dyes[other]},info);
   if(other===part)assert.notDeepEqual(rgba(changed,x,y),rgba(p,x,y),part+' must recolor');else assert.deepEqual(rgba(changed,x,y),rgba(p,x,y),other+' must not bleed into '+part);
  }
 }
 console.log('PASS raised pick keeps the reviewed face, hair, sleeve and boot pixels in separate dye channels');
 const blade=30*128+58;assert.equal(p.data[blade*4+3],255);const dyed=decode(f);dyeCompleteBody(dyed,{body:'female',...original,...dyes},info);assert.deepEqual(Array.from(dyed.data.slice(blade*4,blade*4+4)),Array.from(p.data.slice(blade*4,blade*4+4)));
 console.log('PASS pick blade keeps its authored metal color under every body dye');
 const pole=new Canvas();completeBodies.set(pole,{family:'swim',parts:info.parts,rodTip:[110,40]});
 const fishingArt={[fullBodyKey('swim','female','fish-right-3')]:pole},swimmer={body:'female',...original,outfit:'river-swim'};
 assert.deepEqual(dressedFishingLineOrigin(fishingArt,'fish-right-3',swimmer),{x:18,y:-28});
 assert.deepEqual(dressedFishingLineOrigin(fishingArt,'fish-right-3',swimmer,true),{x:-18,y:-28});
 console.log('PASS complete outfit rod tips follow the female anchor and left-facing mirror');
 assert.throws(()=>dressedHero({'idle-down-0':new Canvas()},'idle-down-0',{body:'male',...original,outfit:'river-swim'}),/素材缺失/);
 console.log('PASS a missing complete body cannot silently fall back to a pasted outfit');
}finally{if(saved)Object.defineProperty(globalThis,'document',saved);else delete globalThis.document;project.cleanup();}
