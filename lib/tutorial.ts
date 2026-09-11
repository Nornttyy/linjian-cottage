import type {ClientState,Session} from './client';
import {atLevel,floorLevel} from './structures';
import {sceneAt} from './world';

export const TUTORIAL_STEPS=['move','wood','floor','wall','combat'] as const;
export type TutorialStep=typeof TUTORIAL_STEPS[number];
export type TutorialProgress={version:1;done:TutorialStep[];hammer:boolean;travel:number;dismissed:boolean};
export function savedSession(raw:string|null):Session|null{
    try{const value=JSON.parse(raw||'null');return value&&typeof value==='object'&&typeof value.room==='string'&&/^[A-Z0-9]{8}$/.test(value.room)&&typeof value.token==='string'&&value.token.trim().length>0&&value.token.length<=100&&typeof value.playerId==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value.playerId)?{room:value.room,token:value.token,playerId:value.playerId}:null;}catch{return null;}
}
export const tutorialKey=(session:Pick<Session,'room'|'playerId'>)=>`linjian-tutorial:${session.room}:${session.playerId}`;
export function readTutorial(raw:string|null):TutorialProgress{
    let value;try{value=JSON.parse(raw||'null');}catch{}
    if(value?.version!==1)return{version:1,done:[],hammer:false,travel:0,dismissed:false};
    return{version:1,done:TUTORIAL_STEPS.filter(step=>Array.isArray(value.done)&&value.done.includes(step)),hammer:value.hammer===true,travel:Number.isFinite(value.travel)?Math.max(0,Math.min(3.01,value.travel)):0,dismissed:value.dismissed===true};
}
export type TutorialTracker={progress:TutorialProgress;last:{x:number;y:number;level:number;scene:string;tick:number};wood:number;events:Set<string>;buildings:Map<string,string>};
export function startTutorial(state:ClientState,progress=readTutorial(null)):TutorialTracker{
    const p=state.world.players[state.session!.playerId];
    if(!progress.dismissed&&p.inventory.wood>0&&!progress.done.includes('wood'))progress={...progress,done:TUTORIAL_STEPS.filter(step=>step==='wood'||progress.done.includes(step))};
    return{progress,last:{x:p.x,y:p.y,level:floorLevel(p),scene:sceneAt(p.x),tick:state.world.tick},wood:p.woodGathered??0,events:new Set(state.world.events.map(event=>event.id)),buildings:new Map(Object.values(state.world.buildings).map(b=>[b.id,b.kind]))};
}
export function observeTutorial(tracker:TutorialTracker,state:ClientState):TutorialProgress{
    const p=state.session?state.world.players[state.session.playerId]:undefined;if(!p||!state.connected)return tracker.progress;
    const previous=tracker.progress,done=new Set(previous.done),next={...previous,done:previous.done.slice()};
    const level=floorLevel(p),scene=sceneAt(p.x),distance=Math.hypot(p.x-tracker.last.x,p.y-tracker.last.y);
    // A portal, respawn or floor change is not a walked tutorial step.
    if(!previous.dismissed&&level===tracker.last.level&&scene===tracker.last.scene&&distance<=3&&state.world.tick>=tracker.last.tick&&!(p.portalUntil&&p.portalUntil>=tracker.last.tick))next.travel=Math.min(3.01,next.travel+distance);
    if(next.travel>3)done.add('move');
    if(!previous.dismissed&&(p.woodGathered??0)>tracker.wood)done.add('wood');
    if(!previous.dismissed&&state.tool==='build')next.hammer=true;
    for(const event of state.world.events){
        if(tracker.events.has(event.id)||previous.dismissed||event.actorId!==p.id)continue;
        if(event.kind==='wood'&&event.amount>0)done.add('wood');
        if(event.kind==='hit'&&event.amount>0&&state.world.mobs.some(mob=>mob.id===event.targetId))done.add('combat');
        if(event.kind==='build')for(const part of ['floor','wall'] as const){
            const building=atLevel(state.world.buildings,Math.floor(event.x),Math.floor(event.y),part,floorLevel(event));
            if(building?.kind===part&&event.targetId===building.id&&tracker.buildings.get(building.id)!==part)done.add(part);
        }
    }
    tracker.last={x:p.x,y:p.y,level,scene,tick:state.world.tick};tracker.wood=p.woodGathered??0;
    tracker.events=new Set(state.world.events.map(event=>event.id));tracker.buildings=new Map(Object.values(state.world.buildings).map(b=>[b.id,b.kind]));
    next.done=TUTORIAL_STEPS.filter(step=>done.has(step));
    if(next.travel!==previous.travel||next.hammer!==previous.hammer||next.done.length!==previous.done.length)tracker.progress=next;
    return tracker.progress;
}
