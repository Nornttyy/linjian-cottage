import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'appearance'});let checks=0;
const original=new Map(['window','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
try{
 const [appearance,hero,chars,sim]=await Promise.all(['appearance','hero-appearance','characters','simulation'].map(n=>import(project.module(n))));
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
 console.log(`${checks} appearance checks; 0 failures`);
}finally{for(const [k,value]of original){if(value)Object.defineProperty(globalThis,k,value);else delete globalThis[k];}project.cleanup();}
