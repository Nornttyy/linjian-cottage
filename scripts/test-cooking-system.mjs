import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';

const project=compileProject({name:'cooking-system'});
let passed=0,failed=0;
try {
    const [sim,world,activities,cooking,pantry,inventory,delta]=await Promise.all(
        ['simulation','world','activities','cooking','pantry','inventory','world-delta'].map(name=>import(project.module(name)))
    );
    const test=(name,fn)=>{try{fn();passed++;console.log('PASS',name);}catch(error){failed++;console.error('FAIL',name,error.stack);}};
    function fixture() {
        const now=100000,s=sim.createWorld(now),p=sim.createPlayer('p','secret','Cook',0,now);
        s.players={p};s.mobs=[];
        for(const resource of world.RESOURCE_MAP.values())s.depleted[resource.id]=true;
        p.x=activities.CAMPFIRE.x;p.y=activities.CAMPFIRE.y-2.2;
        sim.normalizeWorld(s,now);
        return {s,p,now};
    }
    const advance=(f,ms)=>sim.tickWorld(f.s,f.now+ms);
    const send=(f,command,at=f.now)=>sim.applyInput(f.s,'p',{
        seq:f.p.seq+1,dx:0,dy:0,movements:[],
        commands:[{id:'cmd-'+(f.p.seq+1),issuedAt:at,...command}],
    },at);
    function provision(f,ingredients,extra=0) {
        for(const [id,count]of Object.entries(cooking.ingredientCounts(ingredients)))f.p.inventory[id]=count+extra;
    }
    const cook=(f,method,ingredients,at=f.now,extra={})=>send(f,{type:'cook',method,ingredients,...extra},at);
    const contact=activities.ACTIVITY_TIMING.cook.contact;

    for(const id of cooking.DISH_IDS)test(`real cooking consumes and produces ${id} once`,()=>{
        const f=fixture(),ingredients=cooking.recipeExample(id),method=cooking.DISHES[id].method;
        provision(f,ingredients,2);
        const before=structuredClone(f.p.inventory),resolved=cooking.resolveRecipe(method,ingredients);
        assert(resolved);assert.equal(resolved.id,id);
        assert.equal(cook(f,method,[...ingredients].reverse()),null);
        assert.equal(f.p.pendingActivity?.action,'cook');
        advance(f,contact-1);assert.deepEqual(f.p.inventory,before);
        advance(f,contact);
        const expected={...before,[id]:before[id]+resolved.quantity};
        for(const [ingredient,count]of Object.entries(resolved.counts))expected[ingredient]-=count;
        assert.deepEqual(f.p.inventory,expected);
        assert.deepEqual(f.p.cookingResult,{id:'cmd-1',dish:id,quantity:resolved.quantity,time:f.now+contact});
        const event=f.s.events.find(value=>value.kind==='meal');
        assert.equal(event?.item,id);assert.equal(event?.amount,resolved.quantity);
        advance(f,contact+300);advance(f,7000);assert.deepEqual(f.p.inventory,expected);
    });

    test('five ingredient sushi produces two portions with all costs consumed',()=>{
        const f=fixture(),ingredients=['salmon','rice','nori','salmonBelly','rice'];provision(f,ingredients);
        assert.equal(cook(f,'sushi',ingredients),null);advance(f,contact);
        for(const ingredient of new Set(ingredients))assert.equal(f.p.inventory[ingredient],0);
        assert.equal(f.p.inventory.salmonSushi,2);assert.equal(f.p.cookingResult.quantity,2);
    });
    test('five same-cut sashimi ingredients produce five exact-cut portions',()=>{
        const f=fixture(),ingredients=Array(5).fill('tunaFatty');provision(f,ingredients);
        assert.equal(cook(f,'sashimi',ingredients),null);advance(f,contact);
        assert.equal(f.p.inventory.tunaFatty,0);assert.equal(f.p.inventory.tunaFattySashimi,5);
        assert.equal(f.p.inventory.tunaSashimi,0);assert.equal(f.p.inventory.tunaBellySashimi,0);
    });
    test('invalid, sparse, excessive, mismatched and insufficient selections never debit inventory',()=>{
        const cases=[
            {method:'sashimi',ingredients:Array(6).fill('salmon')},
            {method:'sashimi',ingredients:new Array(1)},
            {method:'sashimi',ingredients:['toString']},
            {method:'sashimi',ingredients:['__proto__']},
            {method:'sashimi',ingredients:['salmon','tuna']},
            {method:'sushi',ingredients:['salmon','rice','nori','oil']},
            {method:'unknown',ingredients:['salmon']},
            {method:'sashimi',ingredients:[]},
            {method:'sashimi',ingredients:'salmon'},
            {method:'sashimi',ingredients:['salmon','salmon'],insufficient:true},
        ];
        for(const value of cases){
            const f=fixture();for(const id of cooking.INGREDIENT_IDS)f.p.inventory[id]=10;
            if(value.insufficient)f.p.inventory.salmon=1;
            const before=structuredClone(f.p.inventory);
            assert.equal(cooking.validateSelection(new Array(1)).ok,false);
            assert(cook(f,value.method,value.ingredients),JSON.stringify(value));
            assert.equal(f.p.pendingActivity,undefined);advance(f,5000);
            assert.deepEqual(f.p.inventory,before);assert.equal(f.p.cookingResult,undefined);
        }
    });
    test('cooking needs the ground-level surface campfire',()=>{
        for(const mode of ['far','upstairs','mine']){
            const f=fixture();f.p.inventory.fish=1;
            if(mode==='far')f.p.x+=12;
            if(mode==='upstairs')f.p.level=1;
            if(mode==='mine'){f.p.x=world.MINE.spawn.x;f.p.y=world.MINE.spawn.y;}
            assert(cook(f,'roast',['fish']));advance(f,5000);
            assert.equal(f.p.inventory.fish,1);assert.equal(f.p.inventory.roastFish,0);
        }
    });
    test('lost material, damage, death, moving away or changing floor cancels before settlement',()=>{
        for(const mode of ['material','hurt','dead','moved','floor']){
            const f=fixture(),ingredients=cooking.recipeExample('carrotCake');provision(f,ingredients);
            assert.equal(cook(f,'bake',ingredients),null);
            if(mode==='material')f.p.inventory.egg=0;
            if(mode==='hurt')f.p.hurtAt=f.now+200;
            if(mode==='dead')f.p.hp=0;
            if(mode==='moved')f.p.x+=5;
            if(mode==='floor')f.p.level=1;
            const before=structuredClone(f.p.inventory);
            advance(f,contact);assert.deepEqual(f.p.inventory,before,mode);
            assert.equal(f.p.pendingActivity,undefined);assert.equal(f.p.cookingResult,undefined);
            assert(f.p.swingUntil<=f.now+contact,mode+' must release movement lock');
        }
    });
    test('the server recomputes a saved recipe instead of trusting output, counts or recovery',()=>{
        const f=fixture();f.p.inventory.fish=2;cook(f,'roast',['fish']);
        Object.assign(f.p.pendingActivity.cooking,{output:'wagyuSushi',id:'wagyuSushi',quantity:999,counts:{fish:-999},hp:999,stamina:999});
        advance(f,contact);
        assert.equal(f.p.inventory.fish,1);assert.equal(f.p.inventory.roastFish,1);assert.equal(f.p.inventory.wagyuSushi,0);
    });
    test('replaying a packet or the same command ID cannot produce another dish',()=>{
        const f=fixture();f.p.inventory.fish=3;
        const packet={seq:1,dx:0,dy:0,movements:[],commands:[{type:'cook',id:'once',issuedAt:f.now,method:'roast',ingredients:['fish']}]};
        sim.applyInput(f.s,'p',packet,f.now);advance(f,1800);
        sim.applyInput(f.s,'p',packet,f.now+2000);
        sim.applyInput(f.s,'p',{...packet,seq:2},f.now+2500);
        advance(f,5000);assert.equal(f.p.inventory.roastFish,1);assert.equal(f.p.inventory.fish,2);
    });
    test('overlapping backdated requests cannot instantly multiply meals',()=>{
        const f=fixture();f.p.inventory.fish=10;
        for(let seq=1;seq<=5;seq++)sim.applyInput(f.s,'p',{seq,dx:0,dy:0,movements:[],commands:[{type:'cook',id:'backdated-'+seq,issuedAt:f.now-2000,method:'roast',ingredients:['fish']}]},f.now);
        assert.equal(f.p.inventory.roastFish,1);assert.equal(f.p.inventory.fish,9);
        advance(f,7000);assert.equal(f.p.inventory.roastFish,2);assert.equal(f.p.inventory.fish,8);
    });
    test('full-health players can eat for stamina, with natural regeneration accounted for',()=>{
        const f=fixture();f.p.hp=100;f.p.stamina=0;f.p.inventory.tunaFattySashimi=1;
        const recovery=cooking.foodHeal('tunaFattySashimi');
        assert.equal(send(f,{type:'eat',food:'tunaFattySashimi'}),null);
        assert.equal(f.p.pendingActivity?.action,'eat');
        advance(f,activities.ACTIVITY_TIMING.eat.contact-1);assert.equal(f.p.inventory.tunaFattySashimi,1);
        const previous=f.p.stamina;advance(f,activities.ACTIVITY_TIMING.eat.contact);
        assert.equal(f.p.inventory.tunaFattySashimi,0);assert.equal(f.p.hp,100);
        assert(Math.abs(f.p.stamina-(previous+recovery.stamina+.017))<1e-8);
    });
    test('food caps health and stamina at 100, and full players retain their dish',()=>{
        const f=fixture();f.p.hp=95;f.p.stamina=95;f.p.inventory.wagyuSushi=2;
        send(f,{type:'eat',food:'wagyuSushi'});advance(f,260);
        assert.equal(f.p.hp,100);assert.equal(f.p.stamina,100);assert.equal(f.p.inventory.wagyuSushi,1);
        send(f,{type:'eat',food:'wagyuSushi'},f.now+1000);advance(f,2000);
        assert.equal(f.p.inventory.wagyuSushi,1);assert.equal(f.p.pendingActivity,undefined);
    });
    for(const [id,offer]of Object.entries(pantry.PANTRY_OFFERS))test(`camp provisions ${id} debit exactly the advertised cost`,()=>{
        const f=fixture();f.p.inventory.wood=100;f.p.inventory.essence=100;
        const before=structuredClone(f.p.inventory);
        assert.equal(send(f,{type:'pantry',offer:id}),null);
        const expected={...before,[offer.item]:before[offer.item]+offer.quantity};
        for(const [material,count]of Object.entries(offer.cost))expected[material]-=count;
        assert.deepEqual(f.p.inventory,expected);
        send(f,{type:'pantry',offer:id,id:'cmd-1'},f.now+100);
        assert.deepEqual(f.p.inventory,expected,'duplicate command ID');
    });
    test('provisions reject insufficient cost, invalid offers and distant or upstairs customers',()=>{
        for(const mode of ['poor','invalid','prototype','far','upstairs']){
            const f=fixture();f.p.inventory.wood=mode==='poor'?0:100;
            if(mode==='far')f.p.x+=20;if(mode==='upstairs')f.p.level=1;
            const before=structuredClone(f.p.inventory),offer=mode==='invalid'?'fish':mode==='prototype'?'__proto__':'rice';
            assert(send(f,{type:'pantry',offer}),mode);assert.deepEqual(f.p.inventory,before);
        }
    });
    test('legacy timed fish and automatic cooking are cancelled by migration without rewards',()=>{
        for(const action of ['fish','cook']){
            const f=fixture();delete f.s.activityVersion;f.p.inventory.fish=2;
            f.p.pendingActivity={action,start:f.now,at:f.now+1300,until:f.now+1800,x:f.p.x,y:f.p.y,level:0,fromX:f.p.x,fromY:f.p.y,recipe:{item:'fish',count:1}};
            f.p.workAction=action;f.p.workUntil=f.now+1800;f.p.actionAt=f.now+1800;f.p.swingUntil=f.now+1800;
            sim.normalizeWorld(f.s,f.now+200);assert.equal(f.p.pendingActivity,undefined);
            assert.equal(f.p.workAction,undefined);assert.equal(f.s.activityVersion,2);
            advance(f,5000);assert.equal(f.p.inventory.fish,2);assert.equal(f.p.inventory.meal,0);
            assert.equal(f.p.cookingResult,undefined);
        }
    });
    test('new cooking survives JSON persistence/public deltas and settles only once',()=>{
        const f=fixture();f.p.inventory.fish=1;const before=structuredClone(sim.publicWorld(f.s));
        cook(f,'roast',['fish']);const saved=JSON.parse(JSON.stringify(f.s));
        const replica=delta.applyWorldDelta(before,delta.worldDelta(before,sim.publicWorld(saved),1));
        assert.equal(replica.players.p.pendingActivity.cooking.output,'roastFish');
        assert.equal(replica.players.p.secret,undefined);
        sim.tickWorld(saved,f.now+contact);sim.tickWorld(saved,f.now+4000);
        assert.equal(saved.players.p.inventory.roastFish,1);assert.equal(saved.players.p.inventory.fish,0);
    });
    test('old inventories gain all new keys without losing owned resources and every food fits in the backpack',()=>{
        const f=fixture();f.p.inventory.meal=3;f.p.inventory.wood=4;
        for(const id of [...cooking.INGREDIENT_IDS,...cooking.DISH_IDS])delete f.p.inventory[id];
        sim.normalizeWorld(f.s,f.now);
        for(const id of [...cooking.INGREDIENT_IDS,...cooking.DISH_IDS]){
            assert.equal(f.p.inventory[id],0);assert(inventory.ITEMS[id],id);f.p.inventory[id]=1;
        }
        assert.equal(f.p.inventory.meal,3);assert.equal(f.p.inventory.wood,4);
        const oldSlots=Array(36).fill(null);oldSlots[2]='rod';oldSlots[8]='meal';
        const slots=inventory.restoreSlots(oldSlots,f.p.inventory);
        assert.equal(slots[2],'rod');assert.equal(slots[8],'meal');
        for(const id of [...cooking.INGREDIENT_IDS,...cooking.DISH_IDS])assert(slots.includes(id),id+' must have a visible inventory slot');
        assert.equal(new Set(slots.filter(Boolean)).size,slots.filter(Boolean).length);
    });
    console.log(`${passed} cooking integration checks passed; ${failed} failed`);
    process.exitCode=failed?1:0;
} finally {project.cleanup();}
