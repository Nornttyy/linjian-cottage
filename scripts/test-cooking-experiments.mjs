import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'cooking-experiments'});let checks=0;
try{
 const [cook,sim,act,inv]=await Promise.all(['cooking','simulation','activities','inventory'].map(name=>import(project.module(name))));
 const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
 const result=(method,ingredients)=>{const r=cook.resolveRecipe(method,ingredients);assert(r);return r;};
 test('all stackable inventory resources can enter the pot while permanent tools cannot',()=>{
   for(const [id,item]of Object.entries(inv.ITEMS))assert.equal(cook.isIngredient(id),item.kind==='resource',id);
   assert(!cook.validateSelection(['axe']).ok);assert(!cook.validateSelection(['__proto__']).ok);
 });
 test('reasonable variants remain flexible without being exact recipes',()=>{
   const plain=result('roast',['fish']),cream=result('roast',['fish','milk']),garden=result('roast',['fish','carrot','oil']);
   for(const r of [plain,cream,garden])assert.equal(r.id,'roastFish');
   assert.notEqual(plain.hp,cream.hp);assert.notEqual(cream.stamina,garden.stamina);
   assert.equal(result('panFry',['egg','oil']).id,'tamagoyaki');assert.equal(result('sushi',['rice','salmonBelly']).id,'salmonSushi');
 });
 test('wrong cooking methods and incompatible foods produce a real low-recovery odd dish',()=>{
   for(const [method,ingredients]of [['sashimi',['oil','sugar']],['sashimi',['salmon','milk']],['bake',['milk','salmon']],['sushi',['rice','salmon','milk']],['roast',['fish','sugar','sugar']],['deepFry',['fish']],['panFry',['rice']]]){
     const r=result(method,ingredients);assert.equal(r.id,'dubiousMash',JSON.stringify({method,ingredients}));assert(r.hp<=2&&r.stamina<=6);
   }
 });
 test('wood and minerals take precedence over nutritious ingredients',()=>{
   for(const [ingredients,id]of [[['wood','wagyu'],'toastedWood'],[['stone','rice','tunaFatty'],'stoneRice'],[['copper','milk','egg'],'copperLump']]){const r=result('roast',ingredients);assert.equal(r.id,id);assert(r.hp===0&&r.stamina<=4);}
 });
 test('each unusual success has logical ingredients and multiple combinations',()=>{
   for(const [method,ingredients,id,garnish]of [['bake',['essence','milk','sugar'],'starlightPudding','egg'],['sushi',['essence','rice','nori'],'glimmerRice','egg'],['bake',['wheatSeed','wheat','oil'],'seedCracker','milk'],['panFry',['wagyu','fish'],'surfTurf','carrot'],['roast',['meal','rice'],'leftoverStew','carrot']]){
     const a=result(method,ingredients),b=result(method,[...ingredients,garnish]);assert.equal(a.id,id);assert.equal(b.id,id);assert(a.hp!==b.hp||a.stamina!==b.stamina);
   }
 });
 test('adding valuable ingredients never rescues failed leftovers or raw minerals',()=>{
   assert.equal(result('bake',['dubiousMash','milk','sugar','essence']).id,'dubiousMash');
   assert.equal(result('bake',['stone','milk','sugar','essence']).id,'dubiousMash');
   assert.equal(result('roast',['milkCake','roastFish']).id,'dubiousMash');
 });
 test('odd results are discovered after settlement, consume every input once and survive save/load',()=>{
   const now=100000,s=sim.createWorld(now),p=sim.createPlayer('p','s','Cook',0,now);s.players={p};s.mobs=[];p.x=act.CAMPFIRE.x;p.y=act.CAMPFIRE.y-2;sim.normalizeWorld(s,now);p.inventory.wood=2;p.inventory.fish=1;
   sim.applyInput(s,'p',{seq:1,dx:0,dy:0,commands:[{id:'odd-1',type:'cook',method:'sashimi',ingredients:['wood','fish'],issuedAt:now}]},now);
   assert.equal(cook.knownRecipes(p).length,0);assert.equal(p.inventory.wood,2);
   sim.tickWorld(s,now+act.ACTIVITY_TIMING.cook.contact);assert.equal(p.inventory.wood,1);assert.equal(p.inventory.fish,0);assert.equal(p.inventory.toastedWood,1);assert.equal(cook.knownRecipes(p)[0].method,'sashimi');
   const saved=JSON.parse(JSON.stringify(s));sim.normalizeWorld(saved,now+2000);sim.tickWorld(saved,now+2000);assert.equal(saved.players.p.inventory.toastedWood,1);assert.deepEqual(cook.mealRecovery(saved.players.p,'toastedWood'),{hp:0,stamina:2});
 });
 test('cooking leftovers consumes the correct tracked batch without changing the remaining food',()=>{
   const now=100000,s=sim.createWorld(now),p=sim.createPlayer('p','s','Cook',0,now);s.players={p};s.mobs=[];p.x=act.CAMPFIRE.x;p.y=act.CAMPFIRE.y-2;sim.normalizeWorld(s,now);
   const first=result('roast',['fish']),second=result('roast',['fish','milk']);
   for(const r of [first,second]){cook.rememberCooking(p,r,now);p.inventory.roastFish++;}
   sim.applyInput(s,'p',{seq:1,dx:0,dy:0,commands:[{id:'reuse',type:'cook',method:'roast',ingredients:['roastFish'],issuedAt:now}]},now);
   sim.tickWorld(s,now+act.ACTIVITY_TIMING.cook.contact);assert.equal(p.inventory.roastFish,1);assert.equal(p.meals.roastFish.length,1);assert.deepEqual(cook.mealRecovery(p,'roastFish'),{hp:second.hp,stamina:second.stamina});assert.equal(p.inventory.leftoverStew,1);
 });
 test('legacy food keeps its original recovery even if that combination now produces odd food',()=>{
   const s=sim.createWorld(1),p=sim.createPlayer('p','s','Cook',0,1);s.players={p};delete s.cookingVersion;
   p.inventory.salmonSashimi=1;p.meals={salmonSashimi:[{ingredients:['salmon','milk'],quantity:1}]};p.recipes={'sashimi:salmon=1,milk=1':{method:'sashimi',ingredients:['salmon','milk'],discoveredAt:1}};
   sim.normalizeWorld(s,2);const recovery=cook.mealRecovery(p,'salmonSashimi');assert.deepEqual(recovery,{hp:33,stamina:24});assert.equal(p.inventory.salmonSashimi,1);assert.equal(result('sashimi',['salmon','milk']).id,'dubiousMash');assert.equal(cook.knownRecipes(p).length,0);
   sim.normalizeWorld(s,3);assert.deepEqual(cook.mealRecovery(p,'salmonSashimi'),recovery);assert.equal(s.cookingVersion,3);
 });
 console.log(`${checks} cooking experiment checks; 0 failures`);
}finally{project.cleanup();}
