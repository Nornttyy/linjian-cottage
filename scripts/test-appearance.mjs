import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'appearance'});let checks=0;
const original=new Map(['window','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
try{
 const [appearance,hero,chars,sim,wardrobe,fishingArt]=await Promise.all(['appearance','hero-appearance','characters','simulation','wardrobe-render','hero-fishing-art'].map(n=>import(project.module(n))));
 const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
 test('old profiles keep the original male body and colors; corrupt appearance is normalized',()=>{
  assert.deepEqual(appearance.normalizeAppearance(null),{body:'male',shirt:'original',pants:'original'});
  assert.deepEqual(appearance.normalizeAppearance({body:'female',shirt:'__proto__',pants:'#000'}),{body:'female',shirt:'original',pants:'original'});
  const list=chars.readCharacters(JSON.stringify({version:1,active:'a',characters:[{id:'a',name:'旅人',createdAt:1}]}));assert.deepEqual(list.characters[0].appearance,appearance.DEFAULT_APPEARANCE);
 });
 test('appearance edits persist independently without touching existing world session keys',()=>{
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};globalThis.window={dispatchEvent(){}};
  const a=chars.createCharacter('小夏',{body:'female',shirt:'rose',pants:'cream'}),b=chars.createCharacter('旅人');
  const session={room:'WORLD123',playerId:'a',token:'local',local:true};chars.saveCharacterSession(session,a.id);
  chars.renameCharacter(a.id,'小夏子',{body:'female',shirt:'moss',pants:'cream'});
  const list=chars.readCharacters(chars.characterSnapshot());assert.deepEqual(list.characters.find(p=>p.id===a.id).appearance,{body:'female',shirt:'moss',pants:'cream'});assert.deepEqual(list.characters.find(p=>p.id===b.id).appearance,appearance.DEFAULT_APPEARANCE);assert.deepEqual(chars.characterSession(a.id),session);assert.equal(chars.characterSession(b.id),null);
 });
 function fixture(){const width=24,height=24,data=new Uint8ClampedArray(width*height*4);const rect=(x,y,w,h,rgb)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)data.set([...rgb,255],(yy*width+xx)*4);};rect(8,2,7,5,[148,88,39]);rect(9,7,5,2,[244,205,152]);rect(7,9,10,5,[30,190,200]);rect(9,14,6,4,[40,145,210]);rect(9,18,6,2,[148,88,39]);rect(1,1,3,2,[40,145,210]);rect(19,3,2,3,[30,190,200]);return{width,height,data};}
 test('clothing dye leaves skin, hair, boots, detached tools and alpha unchanged',()=>{
  const p=fixture(),before=p.data.slice();hero.recolorClothes(p,{body:'female',shirt:'rose',pants:'cream'});
  const pixel=(x,y)=>Array.from(p.data.slice((y*p.width+x)*4,(y*p.width+x)*4+4));
  assert.notDeepEqual(pixel(10,10),[30,190,200,255]);assert.notDeepEqual(pixel(10,15),[40,145,210,255]);
  for(const [x,y]of [[10,3],[10,7],[10,18],[2,1],[19,3]]){const i=(y*p.width+x)*4;assert.deepEqual(p.data.slice(i,i+4),before.slice(i,i+4));}
  for(let i=3;i<p.data.length;i+=4)assert.equal(p.data[i],before[i]);
 });
 test('original colors are pixel-identical and a single dye does not recolor the other garment',()=>{
  const p=fixture(),before=p.data.slice();hero.recolorClothes(p,appearance.DEFAULT_APPEARANCE);assert.deepEqual(p.data,before);
  hero.recolorClothes(p,{body:'male',shirt:'rose',pants:'original'});const i=(15*p.width+10)*4;assert.deepEqual(p.data.slice(i,i+4),before.slice(i,i+4));
  const sprite={width:128,height:128},female={width:128,height:128};const art={'walk-down-0':sprite,'female-walk-down-0':female};assert.equal(hero.dressedHero(art,'walk-down-0'),sprite);assert.equal(hero.dressedHero(art,'walk-down-0',{...appearance.DEFAULT_APPEARANCE,body:'female'}),female);
 });
 test('blue or green shirt choices cannot be captured by the second garment color pass',()=>{
  for(const shirt of Object.keys(appearance.CLOTHING_COLORS)){
   const only=fixture(),both=fixture();hero.recolorClothes(only,{body:'male',shirt,pants:'original'});hero.recolorClothes(both,{body:'male',shirt,pants:'rose'});
   for(let y=9;y<14;y++)for(let x=7;x<17;x++){const i=(y*24+x)*4;assert.deepEqual(both.data.slice(i,i+4),only.data.slice(i,i+4),shirt);}
  }
 });
 test('appearance survives world JSON migration without changing spawn, name or inventory',()=>{
  const s=sim.createWorld(1),p=sim.createPlayer('p','secret','小夏',2,1);p.appearance={body:'female',shirt:'lavender',pants:'cream'};p.inventory.wood=37;s.players={p};const saved=JSON.parse(JSON.stringify(s));sim.normalizeWorld(saved,2);assert.deepEqual(saved.players.p.appearance,p.appearance);assert.equal(saved.players.p.x,p.x);assert.equal(saved.players.p.name,p.name);assert.equal(saved.players.p.inventory.wood,37);assert.equal(saved.players.p.color,2);
 });
 test('female water tool masks follow registration changes while the adjacent trousers still dye',()=>{
  const p={width:128,height:128,data:new Uint8ClampedArray(128*128*4)};
  const rect=(x,y,w,h)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)p.data.set([40,145,210,255],(yy*128+xx)*4);};
  rect(39,76,9,16);rect(48,68,14,17);const before=p.data.slice();
  hero.recolorClothes(p,{body:'female',shirt:'original',pants:'rose'},'water-down-0',{scale:1,x:10,y:0});
  for(let y=68;y<85;y++)for(let x=48;x<62;x++){const i=(y*128+x)*4;assert.deepEqual(p.data.slice(i,i+4),before.slice(i,i+4));}
  const trouser=(88*128+43)*4;assert.notDeepEqual(p.data.slice(trouser,trouser+3),before.slice(trouser,trouser+3));
 });
 test('raised blue sleeve shadows and pale seams follow the upper garment dye',()=>{
  const width=128,height=128,data=new Uint8ClampedArray(width*height*4);
  const rect=(x,y,w,h,rgb)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)data.set([...rgb,255],(yy*width+xx)*4);};
  rect(55,58,18,17,[30,190,200]);rect(50,46,5,20,[30,140,220]);rect(55,78,18,14,[40,145,210]);rect(56,60,2,8,[194,245,250]);rect(49,48,1,15,[12,37,69]);
  const before=data.slice();hero.recolorClothes({width,height,data},{body:'female',shirt:'#de427c',pants:'original'},'pick-down-3');
  for(const[x,y]of [[52,50],[56,62],[49,52]]){const i=(y*width+x)*4;assert.notDeepEqual(data.slice(i,i+3),before.slice(i,i+3));assert(data[i]>data[i+1]);}
  for(let y=78;y<92;y++)for(let x=55;x<73;x++){const i=(y*width+x)*4;assert.deepEqual(data.slice(i,i+4),before.slice(i,i+4));}
 });
 test('arbitrary colors persist on all seven parts without accepting malformed CSS',()=>{
  const custom={body:'female',shirt:'#A1B2C3',pants:'#1100aa',hair:'#CC1188',skin:'#A97751',eyes:'#18AA22',shoes:'#F0A819',trim:'#65EEAA'};
  const a=appearance.normalizeAppearance(custom);for(const key of Object.keys(custom).filter(key=>key!=='body'))assert.equal(a[key],custom[key].toLowerCase());
  assert.equal(appearance.normalizeAppearance({...custom,skin:'url(secret)'}).skin,undefined);
 });
 const real=JSON.parse(readFileSync(new URL('./fixtures/hero-dye-actions.json',import.meta.url),'utf8'));
 const framePixels=key=>({width:real.width,height:real.height,data:new Uint8ClampedArray(inflateSync(Buffer.from(real.frames[key],'base64')))});
 const rgba=(p,x,y)=>p.data.slice((y*p.width+x)*4,(y*p.width+x)*4+4);
 test('real pick frames keep the face independent from hair dye',()=>{
  const p=framePixels('pick-down-0'),before=p.data.slice();
  hero.recolorClothes(p,{body:'male',shirt:'original',pants:'original',hair:'#9c42cf'},'pick-down-0');
  for(const[x,y]of [[64,55],[63,56],[65,57]])assert.deepEqual(rgba(p,x,y),rgba({...p,data:before},x,y));
  const skin=framePixels('pick-down-0');hero.recolorClothes(skin,{body:'male',shirt:'original',pants:'original',skin:'#a97751'},'pick-down-0');
  assert.notDeepEqual(rgba(skin,64,55),rgba({...p,data:before},64,55));
 });
 test('real impact frames dye both trouser legs while preserving the pick blade',()=>{
  const checks=[['pick-down-4',66,95],['pick-down-5',64,94],['female-pick-down-5',64,97]];
  for(const[key,x,y]of checks){
   const p=framePixels(key),before=p.data.slice(),body=key.startsWith('female-')?'female':'male';
   hero.recolorClothes(p,{body,shirt:'#e9447d',pants:'#8155bf',hair:'#9c42cf',skin:'#b68058',shoes:'#eebd3e',trim:'#23ded8'},key.replace(/^female-/,''));
   assert.deepEqual(rgba(p,x,y),rgba({...p,data:before},x,y),key+' blade');
   if(body==='male')for(const lx of [56,72])assert.notDeepEqual(rgba(p,lx,84),rgba({...p,data:before},lx,84),key+' leg');
  }
 });
 test('both boots are recolored in the real female impact pose',()=>{
  const p=framePixels('female-pick-down-5'),before=p.data.slice();
  const parts=hero.recolorClothes(p,{body:'female',shirt:'original',pants:'original',shoes:'#eebd3e'},'pick-down-5');
  for(const x of [56,70]){assert(parts.masks.shoes.includes(93*128+x));assert.notDeepEqual(rgba(p,x,93),rgba({...p,data:before},x,93));}
 });
 test('the pelvis stays registered through the full pick swing and impact',()=>{
  const poses=[0,3,4,5,7].map(f=>{const p=framePixels('pick-down-'+f),parts=hero.recolorClothes(p,appearance.DEFAULT_APPEARANCE,'pick-down-'+f);return wardrobe.wardrobePose('pick-down-'+f,parts,p.width);});
  assert(Math.max(...poses.map(p=>p.hip.y))-Math.min(...poses.map(p=>p.hip.y))<=4);
  assert(Math.max(...poses.map(p=>p.hip.x))-Math.min(...poses.map(p=>p.hip.x))<=4);
  for(const p of poses)assert.equal(p.angle,0);
 });
 test('the occluded head in the back roll is not replaced by a boot',()=>{
  const p=framePixels('dodge-up-3'),before=p.data.slice(),parts=hero.recolorClothes(p,{...appearance.DEFAULT_APPEARANCE,hair:'#9c42cf'},'dodge-up-3');
  assert.equal(parts.headVisible,false);assert.equal(parts.masks.hair.length,0);assert.deepEqual(p.data,before);
  const pose=wardrobe.wardrobePose('dodge-up-3',parts,p.width);assert(Math.cos(pose.angle)<-.8);
 });
 test('real rolling and sleeping cuffs have no undyed blue cloth islands',()=>{
  for(const key of ['dodge-down-3','dodge-right-4','female-dodge-up-3','female-sleep-down-3']){
   const p=framePixels(key),parts=hero.recolorClothes(p,{body:key.startsWith('female-')?'female':'male',shirt:'original',pants:'original'},key.replace(/^female-/,''));
   const covered=new Set([...parts.masks.shirt,...parts.masks.pants]);
   for(let i=0;i<p.width*p.height;i++){const[r,g,b,a]=p.data.slice(i*4,i*4+4);if(a>=128&&g>r*1.22&&b>r*1.3&&g>60&&b-g>-35)assert(covered.has(i),key+' pixel '+i);}
  }
 });
 test('all real regression frames preserve transparency and protected tool pixels under every dye',()=>{
  for(const key of Object.keys(real.frames)){
   const p=framePixels(key),before=p.data.slice(),parts=hero.recolorClothes(p,{body:key.startsWith('female-')?'female':'male',shirt:'#e9447d',pants:'#8155bf',hair:'#9c42cf',skin:'#b68058',shoes:'#eebd3e',trim:'#23ded8',eyes:'#23ff44'},key.replace(/^female-/,''));
   for(let k=3;k<p.data.length;k+=4)assert.equal(p.data[k],before[k]);
   for(const i of parts.protectedPixels)assert.deepEqual(p.data.slice(i*4,i*4+4),before.slice(i*4,i*4+4),key+' protected '+i);
  }
 });
 test('all real fishing poses keep the rod out of the hair and headwear anchor',()=>{
  for(const key of Object.keys(real.frames).filter(k=>k.includes('fish-'))){
   const p=framePixels(key),before=p.data.slice(),body=key.startsWith('female-')?'female':'male',frame=key.replace(/^female-/,'');
   const parts=hero.recolorClothes(p,{body,shirt:'original',pants:'original',hair:'#9145dd'},frame);
   assert(parts.head.width<=34&&parts.head.height<=35,key+' head includes rod');
   const rod=fishingArt.fishingRod(frame,body);assert(rod);
   for(let i=0;i<p.width*p.height;i++)if(fishingArt.fishingRodPixel({...p,data:before},i,rod))assert.deepEqual(p.data.slice(i*4,i*4+4),before.slice(i*4,i*4+4),key+' dyed rod '+i);
  }
 });
 test('the clipped baked fishing lines are removed without moving either body',()=>{
  for(const key of ['female-fish-up-3','female-fish-right-3']){
   const p=framePixels(key),before=p.data.slice();fishingArt.removeBakedFishingLine(p,key.replace('female-',''),'female');
   for(let y=25;y<100;y++)for(let x=35;x<95;x++)assert.deepEqual(rgba(p,x,y),rgba({...p,data:before},x,y));
   for(let y=0;y<128;y++)assert.equal(rgba(p,127,y)[3],0);
   assert.notDeepEqual(p.data,before);
  }
 });
 test('live fishing lines follow each body and mirrored rod tip, not the chest',()=>{
  for(const body of ['male','female'])for(const direction of ['down','up','right'])for(let f=0;f<8;f++){
   const frame=`fish-${direction}-${f}`,rod=fishingArt.fishingRod(frame,body),right=fishingArt.fishingLineOrigin(frame,body),left=fishingArt.fishingLineOrigin(frame,body,true);
   assert.equal(32+right.x,rod[0]/2);assert.equal(48+right.y,rod[1]/2);assert.equal(left.x,-right.x);assert.equal(left.y,right.y);
  }
  assert.notDeepEqual(fishingArt.fishingLineOrigin('fish-down-3','female'),fishingArt.fishingLineOrigin('fish-down-3','male'));
 });
 test('skin and belt dyes never repaint boots or each other in folded action poses',()=>{
  for(const key of Object.keys(real.frames)){
   const body=key.startsWith('female-')?'female':'male',frame=key.replace(/^female-/,''),base=framePixels(key),parts=hero.recolorClothes(base,{body,shirt:'original',pants:'original'},frame);
   const used=new Set();for(const part of ['skin','hair','eyes','shoes','trim'])for(const i of parts.masks[part]??[]){assert(!used.has(i),key+' overlapping '+part);used.add(i);}
   for(const part of ['skin','trim']){
    const p=framePixels(key);hero.recolorClothes(p,{body,shirt:'original',pants:'original',[part]:'#00ff44'},frame);
    for(const i of parts.masks.shoes??[])assert.deepEqual(p.data.slice(i*4,i*4+4),base.data.slice(i*4,i*4+4),key+' boots repainted by '+part);
   }
  }
 });
 test('raised boots dye fully without recoloring touching palms in real roll frames',()=>{
  const cases=[
   ['dodge-right-3',[[71,63]],[[61,80]]],
   ['female-dodge-right-3',[[71,63]],[[61,79]]],
   ['dodge-up-2',[[61,92],[74,92]],[[51,90],[82,90]]],
   ['dodge-up-5',[[52,91],[66,90]],[[76,90]]],
   ['female-dodge-up-5',[[54,91],[67,89]],[[77,89]]]
  ];
  for(const[key,boots,palms]of cases){
   const p=framePixels(key),before=p.data.slice(),parts=hero.recolorClothes(p,{body:key.startsWith('female-')?'female':'male',shirt:'original',pants:'original',shoes:'#00ff44'},key.replace(/^female-/,''));
   for(const[x,y]of boots){assert(parts.masks.shoes.includes(y*128+x),key+' missing boot');assert.notDeepEqual(rgba(p,x,y),rgba({...p,data:before},x,y));}
   for(const[x,y]of palms)assert.deepEqual(rgba(p,x,y),rgba({...p,data:before},x,y),key+' shoe dye on palm');
  }
 });
 test('the fully occluded trousers do not pull the rolling outfit onto a cuff',()=>{
  const p=framePixels('dodge-up-4'),parts=hero.recolorClothes(p,appearance.DEFAULT_APPEARANCE,'dodge-up-4'),pose=wardrobe.wardrobePose('dodge-up-4',parts,128);
  assert.equal(parts.masks.pants.length,0);assert(Math.abs(pose.hip.x-65)<2);assert(Math.cos(pose.angle)<-.95);assert(pose.hip.y>=69&&pose.hip.y<=73);
 });
 test('real metal blades and wooden tools keep their colors under independent body dyes',()=>{
  for(const[key,x,y]of [['sword-down-4',90,85],['pick-up-1',44,44],['hammer-down-3',64,83]]){
   const p=framePixels(key),before=p.data.slice(),parts=hero.recolorClothes(p,{body:'male',shirt:'#ff00aa',pants:'#00ff00',hair:'#8844ff',skin:'#44aaff',shoes:'#ffff00',trim:'#ff4444'},key);
   assert(parts.protectedPixels.includes(y*128+x),key+' missing tool');assert.deepEqual(rgba(p,x,y),rgba({...p,data:before},x,y),key+' dyed tool');
   assert(parts.head.width<=34);assert(parts.pants.width<=30);
  }
 });
 test('trouser highlights follow trousers without taking the shirt color during a raised pick',()=>{
  const key='female-pick-down-2',shirt=framePixels(key),pants=framePixels(key),before=shirt.data.slice();
  hero.recolorClothes(shirt,{body:'female',shirt:'#ff00aa',pants:'original'},'pick-down-2');
  hero.recolorClothes(pants,{body:'female',shirt:'original',pants:'#00ff44'},'pick-down-2');
  assert.deepEqual(rgba(shirt,70,82),rgba({...shirt,data:before},70,82));assert.notDeepEqual(rgba(pants,70,82),rgba({...pants,data:before},70,82));
 });
 test('harvesting dyes both boots while keeping the held carrot separate from shoes and skin',()=>{
  const key='female-harvest-right-4';for(const part of ['shoes','skin']){
   const p=framePixels(key),before=p.data.slice();hero.recolorClothes(p,{body:'female',shirt:'original',pants:'original',[part]:'#00ff44'},'harvest-right-4');
   assert.deepEqual(rgba(p,80,84),rgba({...p,data:before},80,84),'dyed carrot');
   for(const[x,y]of [[65,92],[73,91]])if(part==='shoes')assert.notDeepEqual(rgba(p,x,y),rgba({...p,data:before},x,y));else assert.deepEqual(rgba(p,x,y),rgba({...p,data:before},x,y));
  }
 });
 test('crouched feet above the standing baseline still dye independently from the hammer',()=>{
  for(const key of ['hammer-down-4','female-hammer-down-4']){
   const p=framePixels(key),before=p.data.slice();hero.recolorClothes(p,{body:key.startsWith('female-')?'female':'male',shirt:'original',pants:'original',shoes:'#00ff44'},'hammer-down-4');
   for(const x of [50,75])assert.notDeepEqual(rgba(p,x,85),rgba({...p,data:before},x,85),key+' boot');
   assert.deepEqual(rgba(p,61,93),rgba({...p,data:before},61,93),key+' wooden hammer');
  }
 });
 console.log(`${checks} appearance checks; 0 failures`);
}finally{for(const [k,value]of original){if(value)Object.defineProperty(globalThis,k,value);else delete globalThis[k];}project.cleanup();}
