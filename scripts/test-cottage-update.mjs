import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'cottage-update'});
const originals=new Map(['window','localStorage','Image','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
const clients=[];
try{
 const [sim,world,cook,act,animation,delta,chars,{GameClient},inv]=await Promise.all(['simulation','world','cooking','activities','animation','world-delta','characters','client','inventory'].map(n=>import(project.module(n))));
 let checks=0;const test=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
 function fixture(){const now=100000,s=sim.createWorld(now),p=sim.createPlayer('p','secret','Chef',0,now);s.players={p};s.mobs=[];for(const r of world.RESOURCE_MAP.values())s.depleted[r.id]=true;p.x=act.CAMPFIRE.x;p.y=act.CAMPFIRE.y-2;return{s,p,now};}
 function send(f,c){const result=sim.applyInput(f.s,'p',{seq:f.p.seq+1,dx:0,dy:0,movements:[],commands:[{...c,id:'cmd'+(f.p.seq+1),issuedAt:f.now}]},f.now);assert.equal(result,null);}
 function finish(f,ms){sim.tickWorld(f.s,f.now+ms);f.now+=2000;}
 for(const id of cook.DISH_IDS.filter(id=>!['dubiousMash','toastedWood','stoneRice','copperLump'].includes(id)))await test(id+' supports multiple combinations with different recovery',()=>{
   const ingredients=cook.recipeExample(id),first=cook.resolveRecipe(cook.DISHES[id].method,ingredients);assert.equal(first.id,id);
   const candidates=[...cook.INGREDIENT_IDS.map(extra=>[...ingredients,extra]),...ingredients.map((_,i)=>ingredients.filter((_,j)=>i!==j))];
   const other=candidates.map(items=>cook.resolveRecipe(first.method,items)).find(r=>r&&r.id===id&&(r.hp!==first.hp||r.stamina!==first.stamina));
   assert(other,id+' has no alternative');assert.notEqual(first.key,other.key);
   assert.deepEqual(cook.resolveRecipe(first.method,[...ingredients].reverse()),{...first,ingredients:[...ingredients].reverse()});
 });
 await test('new dishes unlock only after settlement and each cooked combination is recorded once',()=>{
   const f=fixture();f.p.inventory.fish=3;f.p.inventory.milk=1;
   send(f,{type:'cook',method:'roast',ingredients:['fish']});assert.equal(cook.knownRecipes(f.p).length,0);finish(f,1300);assert.equal(cook.knownRecipes(f.p).length,1);assert.equal(f.p.cookingResult.discovered,true);
   send(f,{type:'cook',method:'roast',ingredients:['fish']});finish(f,1300);assert.equal(cook.knownRecipes(f.p).length,1);assert.equal(f.p.cookingResult.discovered,false);
   send(f,{type:'cook',method:'roast',ingredients:['fish','milk']});finish(f,1300);assert.equal(cook.knownRecipes(f.p).length,2);assert.equal(f.p.meals.roastFish.length,2);assert.equal(f.p.meals.roastFish[0].quantity,2);
   const before=JSON.parse(JSON.stringify(sim.publicWorld(f.s))),saved=JSON.parse(JSON.stringify(f.s));sim.normalizeWorld(saved,f.now);assert.deepEqual(saved.players.p.recipes,f.p.recipes);assert.deepEqual(delta.applyWorldDelta(before,delta.worldDelta(before,sim.publicWorld(saved),1)),sim.publicWorld(saved));
 });
 await test('different finished batches really heal differently, including after JSON restore',()=>{
   const f=fixture();f.p.inventory.fish=2;f.p.inventory.milk=1;
   for(const ingredients of [['fish'],['fish','milk']]){send(f,{type:'cook',method:'roast',ingredients});finish(f,1300);}
   f.s=JSON.parse(JSON.stringify(f.s));sim.normalizeWorld(f.s,f.now);f.p=f.s.players.p;
   const gains=[];for(let i=0;i<2;i++){f.p.hp=1;f.p.stamina=0;const recovery=cook.mealRecovery(f.p,'roastFish');assert(inv.itemDescription('roastFish',f.p).includes('生命+'+recovery.hp));send(f,{type:'eat',food:'roastFish'});finish(f,260);gains.push(f.p.hp-1);assert.equal(gains.at(-1),recovery.hp);}
   assert(gains[1]>gains[0]);assert.equal(f.p.inventory.roastFish,0);assert.equal(f.p.meals.roastFish.length,0);
 });
 await test('legacy dishes retain their effects before new batches are eaten',()=>{
   const owner={inventory:{roastFish:2}},r=cook.resolveRecipe('roast',['fish','milk']);cook.rememberCooking(owner,r,1);owner.inventory.roastFish++;
   for(let i=0;i<2;i++){assert.deepEqual(cook.mealRecovery(owner,'roastFish'),cook.foodHeal('roastFish'));cook.consumeMeal(owner,'roastFish');owner.inventory.roastFish--;}
   assert.equal(cook.mealRecovery(owner,'roastFish').hp,r.hp);assert.equal(owner.meals.roastFish[0].quantity,1);
 });
 await test('clearing a stump yields one to three wood once, requires an axe and survives saving',()=>{
   const f=fixture(),r=world.RESOURCE_MAP.get('247:315');f.p.x=r.x-.6;f.p.y=r.y+.5;
   sim.applyInput(f.s,'p',{seq:1,dx:0,dy:0,commands:[{type:'attack',tool:'pick',target:r.id}]},f.now);finish(f,200);assert.equal(f.p.inventory.wood,0);
   send(f,{type:'attack',tool:'axe',target:r.id});finish(f,200);const gained=f.p.inventory.wood;assert(gained>=1&&gained<=3);assert.equal(f.s.removedStumps[r.id],true);assert.equal(f.p.woodGathered,gained);
   f.s=JSON.parse(JSON.stringify(f.s));f.p=f.s.players.p;send(f,{type:'attack',tool:'axe',target:r.id});finish(f,200);assert.equal(f.p.inventory.wood,gained);
   const q=sim.createPlayer('q','q','Q',0,f.now);q.x=f.p.x;q.y=f.p.y;f.s.players.q=q;sim.applyInput(f.s,'q',{seq:1,dx:0,dy:0,commands:[{type:'attack',tool:'axe',target:r.id}]},f.now);sim.tickWorld(f.s,f.now+200);assert.equal(q.inventory.wood,0);
 });
 await test('a built campfire costs materials, cooks at its own location and stops cooking if removed',()=>{
   const f=fixture();f.p.x=270.5;f.p.y=330.5;f.p.inventory.wood=20;f.p.inventory.stone=10;f.p.inventory.fish=2;
   assert.equal(act.nearCampfire(f.p,f.s.buildings),false);send(f,{type:'build',part:'campfire',x:271,y:330});finish(f,500);
   assert.equal(f.p.inventory.wood,12);assert.equal(f.p.inventory.stone,6);assert(act.nearCampfire(f.p,f.s.buildings));
   send(f,{type:'cook',method:'roast',ingredients:['fish']});finish(f,1300);assert.equal(f.p.inventory.roastFish,1);const meal=f.s.events.find(e=>e.kind==='meal');assert.equal(meal.x,271.5);assert.equal(meal.y,330.5);
   send(f,{type:'cook',method:'roast',ingredients:['fish']});f.s.buildings={};finish(f,1300);assert.equal(f.p.inventory.fish,1);assert.equal(f.p.inventory.roastFish,1);
   assert(!act.nearCampfire({...f.p,level:1},{fire:{id:'fire',kind:'campfire',x:271,y:330,level:0}}));
 });
 await test('fishing keeps the rod cast for the entire minigame and retrieves it only once',()=>{
   const fishing={startedAt:1000,castUntil:1550,phase:'reeling',reelStartedAt:2000};
   for(const face of ['down','up','right','left'])for(let t=2000;t<22000;t+=37)assert.equal(animation.fishingFrame(fishing,face,t),`fish-${face==='left'?'right':face}-3`);
   const caught={...fishing,phase:'caught',finishedAt:22000};assert.equal(animation.fishingFrame(caught,'down',22050),'fish-down-6');assert.equal(animation.fishingFrame(caught,'down',22250),'fish-down-7');assert.equal(animation.fishingFrame(caught,'down',22400),null);assert.equal(animation.fishingFrame({...caught,phase:'escaped',reason:'hurt'},'down',22020),null);
 });
 const storage=new Map();globalThis.window={addEventListener(){},removeEventListener(){},dispatchEvent(){}};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}});
 globalThis.Image=class{};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
 await test('character selection preserves the legacy save and never borrows another character session',async()=>{
   const old={room:'OLDWORLD',playerId:'old',token:'old-secret',local:true};storage.set('linjian-session',JSON.stringify(old));chars.importLegacyCharacter();assert.deepEqual(chars.characterSession('legacy'),old);
   const hero=chars.createCharacter('小林');assert.equal(chars.activeCharacter().id,hero.id);assert.equal(chars.characterSession(hero.id),null);assert.deepEqual(chars.characterSession('legacy'),old);
   const canvas={width:800,height:400,addEventListener(){},removeEventListener(){}};
   const c=new GameClient(canvas,()=>{},()=>{},()=>{},'/api/game',()=>{},()=>{},hero.id,hero.name);clients.push(c);await c.connect('local');assert(c.connected);const session=c.session,p=c.world.players[session.playerId];assert.equal(p.name,'小林');p.inventory.wood=42;c.destroy();
   const second=chars.createCharacter('小夏');assert.equal(chars.characterSession(second.id),null);chars.selectCharacter(hero.id);chars.renameCharacter(hero.id,'小林子');
   const resume=new GameClient(canvas,()=>{},()=>{},()=>{},'/api/game',()=>{},()=>{},hero.id,'小林子');clients.push(resume);await resume.connect('resume');assert(resume.connected);assert.equal(resume.world.players[session.playerId].inventory.wood,42);assert.equal(resume.world.players[session.playerId].name,'小林子');assert.deepEqual(chars.characterSession('legacy'),old);
 });
 console.log(`${checks} cottage update checks passed`);
}finally{clients.forEach(c=>c.destroy());for(const[k,v]of originals)if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];project.cleanup();}
