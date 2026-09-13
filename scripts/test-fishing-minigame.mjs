import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'fishing-minigame'});let passed=0;
try{
    const [sim,world,act,rules,delta]=await Promise.all(['simulation','world','activities','fishing','world-delta'].map(name=>import(project.module(name))));
    const caughtKinds=['fish','salmon','salmonBelly','salmonFatty','tuna','tunaBelly','tunaFatty','sweetShrimp','largeSweetShrimp','seaUrchin'];
    const total=p=>caughtKinds.reduce((sum,key)=>sum+(p.inventory[key]??0),0);
    function test(name,fn){fn();passed++;console.log('PASS',name);}
    function fixture(seed=42){
        const now=100000,s=sim.createWorld(now),p=sim.createPlayer('p','secret','P',0,now);s.players={p};s.mobs=[];
        for(const r of world.RESOURCE_MAP.values())s.depleted[r.id]=true;
        return{s,p,now,seed};
    }
    function shore(f,minY=310,maxY=345){
        for(let y=minY;y<maxY;y++)for(let x=200;x<325;x++)if(world.terrainAt(x,y)==='water')for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
            const point={x:x+dx+.5,y:y+dy+.5};if(act.canCast(point,x,y)&&!sim.isBlocked(f.s,point.x,point.y)){Object.assign(f.p,point);return{x,y};}
        }
        throw Error('test shoreline missing');
    }
    function send(f,c,at=f.now,p=f.p){return sim.applyInput(f.s,p.id,{seq:p.seq+1,dx:0,dy:0,movements:[],commands:[{id:`cmd-${p.id}-${p.seq+1}`,issuedAt:at,...c}]},at);}
    function tick(f,at){sim.tickWorld(f.s,at);f.now=at;}
    function begin(f,coast=false,p=f.p){
        const target=shore(f,coast?410:310,coast?450:345),oldRandom=Math.random;
        if(p!==f.p){p.x=f.p.x;p.y=f.p.y;}
        try{Math.random=()=>f.seed/4294967296;assert.equal(send(f,{type:'fish',...target},f.now,p),null);}finally{Math.random=oldRandom;}
        assert(p.fishing);return p.fishing.id;
    }
    function hook(f,p=f.p){const now=p.fishing.biteAt+250;tick(f,now);send(f,{type:'fishHook',fishingId:p.fishing.id},now,p);assert.equal(p.fishing.phase,'reeling');return now;}
    function track(f,players=[f.p],{restoreAt=-1}={}){
        let now=f.now,iterations=0;
        while(players.some(p=>rules.fishingActive(p.fishing))&&iterations++<450){
            for(const p of players)if(rules.fishingActive(p.fishing)&&iterations%3===1){const fish=p.fishing,held=fish.barCenter+fish.barVelocity*.16<fish.fishPosition;send(f,{type:'fishControl',fishingId:fish.id,held},now,p);}
            tick(f,now+=50);
            if(iterations===restoreAt){f.s=JSON.parse(JSON.stringify(f.s));f.p=f.s.players.p;players=players.map(p=>f.s.players[p.id]);}
        }
        assert(iterations<450);return players;
    }
    function unlocked(p,now){assert.equal(p.workAction,undefined);assert(p.swingUntil<=now);assert(p.workUntil<=now);assert(p.actionAt<=now);assert.equal(p.moveCredit??0,0);}

    test('casting does not auto-award, requires bite and timely hook, holds player still',()=>{
        const f=fixture(),id=begin(f),before={x:f.p.x,y:f.p.y};
        send(f,{type:'fishHook',fishingId:id},f.now+500);assert.equal(f.p.fishing.phase,'waiting');
        tick(f,f.now+1900);assert.equal(total(f.p),0);
        sim.applyInput(f.s,'p',{seq:f.p.seq+1,dx:-1,dy:0,movements:[{dx:-1,dy:0,seconds:.2}],commands:[]},f.now+100);
        assert.equal(f.p.x,before.x);assert.equal(f.p.y,before.y);assert.equal(f.p.moveCredit,0);
        const hookAt=f.p.fishing.biteAt+300;tick(f,hookAt);send(f,{type:'fishHook',fishingId:id},hookAt);assert.equal(f.p.fishing.phase,'reeling');assert.equal(total(f.p),0);
    });
    test('late and backdated hook cannot catch missed fish and automatically unlocks',()=>{
        const f=fixture();begin(f);const end=f.p.fishing.biteUntil;
        send(f,{type:'fishHook',fishingId:f.p.fishing.id,issuedAt:f.p.fishing.biteAt},end);
        assert.equal(f.p.fishing.reason,'missed');assert.equal(total(f.p),0);unlocked(f.p,end);
    });
    test('150ms controls grant exactly one server-selected fish and one event',()=>{
        const f=fixture();begin(f);hook(f);const selected=f.p.fishing.catchId,id=f.p.fishing.id;
        track(f);assert.equal(f.p.fishing.phase,'caught');assert.equal(f.p.inventory[selected],1);assert.equal(total(f.p),1);unlocked(f.p,f.now);
        assert.equal(f.s.events.filter(e=>e.kind==='fish'&&e.actorId==='p').length,1);
        send(f,{type:'fishHook',fishingId:id},f.now+20);send(f,{type:'fishControl',fishingId:id,held:true,catchId:'tunaFatty',progress:1},f.now+30);tick(f,f.now+100);
        assert.equal(total(f.p),1);
    });
    test('client-supplied score, catch ID and control values cannot choose reward or skip minigame',()=>{
        const f=fixture();begin(f);const selected=f.p.fishing.catchId;hook(f);
        send(f,{type:'fishControl',fishingId:f.p.fishing.id,held:'true',progress:1,catchId:'tunaFatty',fish:{phase:'caught'}},f.now);
        assert.equal(total(f.p),0);assert.equal(f.p.fishing.catchId,selected);assert.equal(f.p.fishing.progress,.2);assert.equal(f.p.fishing.phase,'reeling');
    });
    test('cancel ends waiting or reeling immediately without a leftover action lock',()=>{
        for(const phase of ['waiting','reeling']){const f=fixture();begin(f);if(phase==='reeling')hook(f);send(f,{type:'fishCancel',fishingId:f.p.fishing.id},f.now+1);assert.equal(f.p.fishing.reason,'cancelled');assert.equal(total(f.p),0);unlocked(f.p,f.now+1);}
    });
    test('damage, changing scene, floor or position cancels before awarding',()=>{
        for(const reason of ['hurt','dead','scene','floor','moved']){
            const f=fixture();begin(f);hook(f);const now=f.now+50;
            if(reason==='hurt')f.p.hurtAt=now;if(reason==='dead')f.p.hp=0;if(reason==='scene'){f.p.x=world.MINE.spawn.x;f.p.y=world.MINE.spawn.y;}if(reason==='floor')f.p.level=1;if(reason==='moved')f.p.x+=1;
            tick(f,now);assert.equal(f.p.fishing.phase,'escaped');assert.equal(f.p.fishing.reason,['hurt','dead'].includes(reason)?'hurt':'moved');assert.equal(total(f.p),0);unlocked(f.p,now);
        }
    });
    test('expired fishing IDs do not hook, hold or cancel a newer cast',()=>{
        const f=fixture(),oldId=begin(f);send(f,{type:'fishCancel',fishingId:oldId},f.now+10);f.now+=20;begin(f);const id=f.p.fishing.id;
        assert.notEqual(id,oldId);for(const type of ['fishHook','fishControl','fishCancel'])send(f,{type,fishingId:oldId,held:true},f.now+10);
        assert.equal(f.p.fishing.id,id);assert.equal(f.p.fishing.phase,'waiting');assert.equal(f.p.fishing.held,false);
    });
    test('duplicate sequence and cast command ID cannot restart or duplicate a session',()=>{
        const f=fixture(),target=shore(f),packet={seq:1,dx:0,dy:0,movements:[],commands:[{type:'fish',id:'once',...target}]};
        sim.applyInput(f.s,'p',packet,f.now);const original=structuredClone(f.p.fishing);sim.applyInput(f.s,'p',packet,f.now+100);assert.deepEqual(f.p.fishing,original);
        send(f,{type:'fishCancel',fishingId:'once'},f.now+110);send(f,{type:'fish',id:'once',...target},f.now+120);assert.equal(f.p.fishing.phase,'escaped');assert.equal(total(f.p),0);
    });
    test('saved and public-delta state resumes the same minigame without losing or duplicating reward',()=>{
        const f=fixture(),before=sim.publicWorld(structuredClone(f.s));begin(f);hook(f);
        const publicState=sim.publicWorld(f.s),change=delta.worldDelta(before,publicState,7),replica=delta.applyWorldDelta(before,change);
        assert.deepEqual(replica.players.p.fishing,f.p.fishing);assert.equal(replica.players.p.secret,undefined);
        const [p]=track(f,[f.p],{restoreAt:35});assert.equal(p.fishing.phase,'caught');assert.equal(total(p),1);
        const restored=JSON.parse(JSON.stringify(f.s));sim.tickWorld(restored,f.now+100);sim.tickWorld(restored,f.now+200);assert.equal(total(restored.players.p),1);
    });
    test('two players at same water tile control and receive their own independent fish',()=>{
        const f=fixture(),q=sim.createPlayer('q','secret-q','Q',1,f.now);f.s.players.q=q;begin(f,true);f.seed=380;begin(f,true,q);
        assert.deepEqual(f.p.fishing.target,q.fishing.target);assert.notEqual(f.p.fishing.id,q.fishing.id);
        const hookAt=Math.max(f.p.fishing.biteAt,q.fishing.biteAt)+100;
        // Seeded wait variance can exceed the bite overlap. Hook each at its own window.
        const order=[f.p,q].sort((a,b)=>a.fishing.biteAt-b.fishing.biteAt);
        for(const p of order){tick(f,p.fishing.biteAt+100);send(f,{type:'fishHook',fishingId:p.fishing.id},f.now,p);}
        assert(hookAt<=f.now+1600);
        const before=structuredClone(q.fishing);send(f,{type:'fishCancel',fishingId:q.fishing.id},f.now,f.p);assert.deepEqual(q.fishing,before);assert(rules.fishingActive(f.p.fishing));
        track(f,[f.p,q]);assert.equal(f.p.fishing.phase,'caught');assert.equal(q.fishing.phase,'caught');assert.equal(total(f.p),1);assert.equal(total(q),1);
    });
    test('lease release and inactivity cannot leave a permanent lock or earn an unattended fish',()=>{
        const f=fixture();begin(f);hook(f);const now=f.now;tick(f,now+1900);assert.equal(f.p.fishing.held,false);
        tick(f,now+9000);assert.equal(f.p.fishing.phase,'escaped');assert.equal(total(f.p),0);unlocked(f.p,now+9000);
        const g=fixture();begin(g);const end=g.p.fishing.biteUntil;tick(g,end);assert.equal(g.p.fishing.reason,'missed');unlocked(g.p,end);
    });
    test('a fish kept on the line without completing capture times out at 20 seconds and unlocks',()=>{
        const f=fixture(234);begin(f);hook(f);const deadline=f.p.fishing.deadline;let follow=true;
        for(let i=0;rules.fishingActive(f.p.fishing)&&i<450;i++){
            if(i%3===0){
                const fish=f.p.fishing;if(fish.progress>.55)follow=false;if(fish.progress<.3)follow=true;
                const held=follow?fish.barCenter+fish.barVelocity*.16<fish.fishPosition:fish.fishPosition<.5;
                send(f,{type:'fishControl',fishingId:fish.id,held},f.now);
            }
            tick(f,f.now+50);
        }
        assert.equal(f.p.fishing.reason,'timeout');assert.equal(f.p.fishing.finishedAt,deadline);assert.equal(total(f.p),0);unlocked(f.p,f.now);
    });
    test('all coastal catch types have a reachable actual water tile and river uses its own pool',()=>{
        const seen=new Set();
        for(let seed=0;seed<400;seed++){const f=fixture(seed);begin(f,true);assert.equal(f.p.fishing.region,'coast');seen.add(f.p.fishing.catchId);}
        assert.equal(seen.size,caughtKinds.length);const river=fixture();begin(river);assert.equal(river.p.fishing.region,'river');
    });
    test('old automatic fishing activity migrates without granting an unearned fish',()=>{
        const f=fixture();delete f.s.activityVersion;f.p.pendingActivity={action:'fish',start:f.now-2000,at:f.now,until:f.now+500,x:280,y:330,level:0,fromX:f.p.x,fromY:f.p.y};
        f.p.workAction='fish';f.p.workUntil=f.now+500;f.p.swingUntil=f.now+500;tick(f,f.now);assert.equal(f.p.pendingActivity,undefined);assert.equal(total(f.p),0);unlocked(f.p,f.now);
    });
    console.log(`${passed} fishing minigame checks passed`);
}finally{project.cleanup();}
