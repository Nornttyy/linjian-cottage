/** Server-authoritative, deterministic fishing. Coordinates inside the minigame
 * increase from bottom (0) to top (1). All supplied times are server times. */
export const FISHING_STEP_MS=50;
export const FISHING_CAST_MS=550;
export const FISHING_HOOK_MS=1600;
export const FISHING_REEL_MS=20000;
export const FISHING_HOLD_LEASE_MS=1800;
export const FISHING_BAR_SIZE=.32;
export type FishingRegion='river'|'lake'|'coast';
export type CatchKind='fish'|'salmon'|'salmonBelly'|'salmonFatty'|'tuna'|'tunaBelly'|'tunaFatty'|'sweetShrimp'|'largeSweetShrimp'|'seaUrchin';
export type FishingPhase='waiting'|'bite'|'reeling'|'caught'|'escaped';
export type FishingEscape='missed'|'lost'|'timeout'|'cancelled'|'hurt'|'moved'|'disconnected';
export type FishingState={
    id?:string;seed:number;region:FishingRegion;catchId:CatchKind;target:{x:number;y:number};
    phase:FishingPhase;startedAt:number;updatedAt:number;castUntil:number;biteAt:number;biteUntil:number;
    reelStartedAt?:number;deadline?:number;finishedAt?:number;reason?:FishingEscape;
    barCenter:number;barVelocity:number;fishPosition:number;progress:number;held:boolean;heldUntil:number;
};
export type FishingOutcome={kind:'caught';catchId:CatchKind}|{kind:'escaped';reason:FishingEscape};
export type FishingUpdate={state:FishingState;outcome?:FishingOutcome};

const POOLS:Record<FishingRegion,readonly (readonly [CatchKind,number])[]>={
    river:[['fish',46],['salmon',26],['salmonBelly',10],['salmonFatty',4],['sweetShrimp',10],['largeSweetShrimp',4]],
    lake:[['fish',30],['salmon',23],['salmonBelly',10],['salmonFatty',4],['tuna',13],['tunaBelly',5],['tunaFatty',2],['sweetShrimp',8],['largeSweetShrimp',3],['seaUrchin',2]],
    coast:[['fish',8],['salmon',15],['salmonBelly',8],['salmonFatty',4],['tuna',21],['tunaBelly',10],['tunaFatty',5],['sweetShrimp',13],['largeSweetShrimp',7],['seaUrchin',9]],
};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
function random(seed:number,salt:number){
    let n=(seed^Math.imul(salt,0x9e3779b9))>>>0;
    n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);
    return((n^(n>>>15))>>>0)/4294967296;
}
function chooseCatch(seed:number,region:FishingRegion):CatchKind{
    const entries=POOLS[region],total=entries.reduce((sum,pair)=>sum+pair[1],0);let n=random(seed,1)*total;
    for(const [kind,weight] of entries){n-=weight;if(n<0)return kind;}
    return entries[entries.length-1][0];
}
/** Fish movement uses elapsed time, never client frame rate or client score. */
export function fishingPosition(seed:number,elapsedMs:number){
    const t=Math.max(0,elapsedMs)/1000;
    return clamp(.5+.245*Math.sin(t*(.92+random(seed,3)*.32)+random(seed,4)*Math.PI*2)+.065*Math.sin(t*2.2+random(seed,5)*Math.PI*2),.17,.83);
}
export function startFishing(seed:number,now:number,target:{x:number;y:number},region:FishingRegion='river'):FishingState{
    seed=seed>>>0;const biteAt=now+FISHING_CAST_MS+1000+Math.floor(random(seed,2)*2000);
    return{seed,region,catchId:chooseCatch(seed,region),target:{...target},phase:'waiting',startedAt:now,updatedAt:now,castUntil:now+FISHING_CAST_MS,biteAt,biteUntil:biteAt+FISHING_HOOK_MS,barCenter:.5,barVelocity:0,fishPosition:fishingPosition(seed,0),progress:.2,held:false,heldUntil:0};
}
export const fishingActive=(state:FishingState|undefined)=>!!state&&state.phase!=='caught'&&state.phase!=='escaped';
function finish(state:FishingState,now:number,reason?:FishingEscape):FishingUpdate{
    const next: FishingState={...state,phase:reason?'escaped':'caught',updatedAt:now,finishedAt:now,held:false,heldUntil:0,barVelocity:0,...(reason?{reason}:{progress:1})};
    return{state:next,outcome:reason?{kind:'escaped',reason}:{kind:'caught',catchId:state.catchId}};
}

/** Returns an outcome only on the first transition to a terminal state. Persist
 * the returned state and award its outcome together in the same room transaction.
 * 600 steps cover the maximum 20-second reel, even after a long polling gap. */
export function advanceFishing(state:FishingState,now:number):FishingUpdate{
    if(!fishingActive(state)||!Number.isFinite(now)||now<state.updatedAt)return{state};
    const next={...state};
    if(next.phase==='waiting'){
        if(now<next.biteAt)return{state:next};
        next.phase='bite';next.updatedAt=next.biteAt;
    }
    if(next.phase==='bite')return now>=next.biteUntil?finish(next,next.biteUntil,'missed'):{state:next};
    const reelStart=next.reelStartedAt!,deadline=next.deadline!;
    const endpoint=Math.min(now,deadline);
    let steps=0;
    while(next.updatedAt+FISHING_STEP_MS<=endpoint&&steps++<600){
        const at=next.updatedAt+FISHING_STEP_MS,dt=FISHING_STEP_MS/1000;
        const held=next.held&&at<=next.heldUntil;
        if(!held&&at>next.heldUntil)next.held=false;
        const targetVelocity=held?.68:-.59;
        next.barVelocity+=clamp(targetVelocity-next.barVelocity,-3.8*dt,3.8*dt);
        next.barCenter=clamp(next.barCenter+next.barVelocity*dt,FISHING_BAR_SIZE/2,1-FISHING_BAR_SIZE/2);
        if(next.barCenter===FISHING_BAR_SIZE/2||next.barCenter===1-FISHING_BAR_SIZE/2)next.barVelocity=0;
        next.fishPosition=fishingPosition(next.seed,at-reelStart);
        const overlap=Math.abs(next.fishPosition-next.barCenter)<=FISHING_BAR_SIZE/2;
        next.progress=clamp(next.progress+dt*(overlap?.135:-.065),0,1);
        next.updatedAt=at;
        if(next.progress>=1)return finish(next,at);
        if(next.progress<=0&&at-reelStart>=2000)return finish(next,at,'lost');
    }
    if(now>=deadline)return finish(next,deadline,'timeout');
    // Corrupt or unsupported states cannot create an unbounded catch-up loop.
    if(steps>=600&&next.updatedAt+FISHING_STEP_MS<=endpoint)return finish(next,now,'disconnected');
    return{state:next};
}
/** A press while waiting is harmless. Hook deadlines are evaluated before input,
 * so replayed/late client timestamps cannot resurrect a fish that already left. */
export function hookFishing(state:FishingState,now:number):FishingUpdate{
    if(!Number.isFinite(now)||now<state.updatedAt)return{state};
    const update=advanceFishing(state,now);
    if(update.state.phase!=='bite')return update;
    return{state:{...update.state,phase:'reeling',updatedAt:now,reelStartedAt:now,deadline:now+FISHING_REEL_MS,barCenter:.5,barVelocity:0,fishPosition:fishingPosition(state.seed,0),progress:.2,held:true,heldUntil:now+FISHING_HOLD_LEASE_MS}};
}
/** Send only press/release plus a heartbeat while pressed. Renewing held input
 * never changes elapsed simulation time; client score and catch IDs are ignored. */
export function setFishingHeld(state:FishingState,held:boolean,now:number):FishingUpdate{
    if(!Number.isFinite(now)||now<state.updatedAt)return{state};
    const update=advanceFishing(state,now);
    if(update.state.phase!=='reeling')return update;
    return{state:{...update.state,held:held===true,heldUntil:held===true?now+FISHING_HOLD_LEASE_MS:now}};
}
/** Cancellation takes priority over an unprocessed success. Check hurt/movement
 * guards before advanceFishing so a hit cannot grant a catch on the same tick. */
export function cancelFishing(state:FishingState,now:number,reason:FishingEscape='cancelled'):FishingUpdate{
    if(!fishingActive(state)||!Number.isFinite(now)||now<state.updatedAt)return{state};
    return finish(state,Math.max(state.updatedAt,now),reason);
}
