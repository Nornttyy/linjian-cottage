import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'fishing-rules'});
try{
const {startFishing,advanceFishing,hookFishing,setFishingHeld,cancelFishing,fishingActive,FISHING_STEP_MS,FISHING_HOLD_LEASE_MS}=await import(project.module('fishing'));

let checks=0;
function test(name,fn){fn();checks++;process.stdout.write(`ok ${name}\n`);}
const make=(seed=1,region='coast')=>startFishing(seed,1000,{x:280,y:330},region);
const reel=(seed=1)=>{const s=make(seed);return hookFishing(s,s.biteAt+300).state;};

test('timely hook only; harmless early click; expired hook cannot resurrect fish',()=>{
    const s=make();
    assert.equal(hookFishing(s,s.biteAt-1).state.phase,'waiting');
    assert.equal(hookFishing(s,s.biteAt).state.phase,'reeling');
    assert.equal(hookFishing(s,s.biteUntil-1).state.phase,'reeling');
    assert.equal(hookFishing(s,s.biteUntil).outcome.reason,'missed');
    assert.equal(hookFishing(advanceFishing(s,s.biteAt).state,s.biteAt-1).state.phase,'bite');
});
test('terminal outcome emitted once; cancellation beats pending success; input copies state',()=>{
    const s=reel(),frozen=structuredClone(s),result=cancelFishing(s,s.updatedAt+50,'hurt');
    assert.deepEqual(s,frozen);assert.equal(result.outcome.reason,'hurt');
    for(const update of [advanceFishing(result.state,1e9),hookFishing(result.state,1e9),setFishingHeld(result.state,true,1e9),cancelFishing(result.state,1e9)])assert.equal(update.outcome,undefined);
});
test('nonfinite or stale time cannot change progress/control',()=>{
    const s=reel();
    for(const now of [NaN,Infinity,s.updatedAt-1])for(const update of [advanceFishing(s,now),hookFishing(s,now),setFishingHeld(s,true,now),cancelFishing(s,now)])assert.deepEqual(update.state,s);
});
test('control lease expires without another client release packet',()=>{
    const s=reel();assert.equal(s.held,true);
    const advanced=advanceFishing(s,s.updatedAt+FISHING_HOLD_LEASE_MS+50).state;
    assert.equal(advanced.held,false);assert(advanced.barVelocity<=0);
});
test('fixed integration gives same state at different request cadence',()=>{
    let a=reel(82),b=structuredClone(a),time=a.updatedAt;
    for(let i=0;i<16&&fishingActive(a);i++){
        const held=i%3!==0;a=setFishingHeld(a,held,time).state;b=setFishingHeld(b,held,time).state;
        for(let j=1;j<=5;j++)a=advanceFishing(a,time+j*FISHING_STEP_MS).state;
        b=advanceFishing(b,time+250).state;time+=250;
        assert.deepEqual(a,b);
    }
});
test('all ten seafood IDs reachable; deterministic region pools and serializable state',()=>{
    const caught=new Set();
    for(let seed=0;seed<10000;seed++){
        const s=make(seed);caught.add(s.catchId);assert.deepEqual(make(seed),s);
        assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
        assert(s.biteAt>=s.castUntil+1000&&s.biteAt<s.castUntil+3000);
    }
    assert.equal(caught.size,10);
});
test('very long poll gap is bounded and cannot replay catch result',()=>{
    const s=reel(),result=advanceFishing(s,1e15);
    assert.equal(result.state.phase,'escaped');assert(!result.state.held);
    assert.equal(advanceFishing(result.state,1e15).outcome,undefined);
});

const summary={tracking:{wins:0,seconds:[]},alwaysHeld:0,neverHeld:0};
function play(seed,mode){
    let s=reel(seed);const start=s.updatedAt;
    for(let tick=0;fishingActive(s)&&tick<500;tick++){
        const now=start+tick*50;
        if(tick%3===0){
            // 150 ms reaction cadence and simple inertial anticipation, no oracle.
            const held=mode==='always'||mode==='tracking'&&s.barCenter+s.barVelocity*.16<s.fishPosition;
            s=setFishingHeld(s,held,now).state;
        }
        s=advanceFishing(s,now+50).state;
    }
    assert(!fishingActive(s));return{won:s.phase==='caught',seconds:(s.finishedAt-start)/1000};
}
test('minigame achievable with ordinary 150ms reaction; constant inputs do not farm catches',()=>{
    for(let seed=0;seed<1000;seed++){
        const skilled=play(seed,'tracking');if(skilled.won){summary.tracking.wins++;summary.tracking.seconds.push(skilled.seconds);}
        summary.alwaysHeld+=+play(seed,'always').won;summary.neverHeld+=+play(seed,'never').won;
    }
    assert(summary.tracking.wins>=950,JSON.stringify(summary));
    assert(summary.alwaysHeld===0);assert(summary.neverHeld===0);
});
const seconds=summary.tracking.seconds.sort((a,b)=>a-b);
process.stdout.write(JSON.stringify({checks,seeds:1000,trackingWins:summary.tracking.wins,medianSeconds:seconds[Math.floor(seconds.length/2)],minSeconds:seconds[0],maxSeconds:seconds.at(-1),alwaysHeldWins:summary.alwaysHeld,neverHeldWins:summary.neverHeld},null,2)+'\n');
}finally{project.cleanup();}
