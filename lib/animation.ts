import {CREATURES} from './creatures';
import {frameKey,HERO_FRAME_COUNT,HERO_IDLE_FRAME_COUNT,type Sprite,type Direction} from './art';
import {TOOL_TIMING,type Player,type Mob,type Tool,type CombatTool,type WorkAction,WORK_TIMING} from './simulation';
export type HeroSwing={tool:CombatTool;face:Player['face'];start:number;until:number};

export function swingFrame(action:CombatTool,elapsed:number){
    const timing=TOOL_TIMING[action],contactFrame=action==='sword'?4:5;
    const frame=elapsed<timing.contact?Math.floor(elapsed/timing.contact*contactFrame):contactFrame+Math.floor((elapsed-timing.contact)/(timing.duration-timing.contact)*(HERO_FRAME_COUNT-contactFrame));
    return Math.max(0,Math.min(HERO_FRAME_COUNT-1,frame));
}
// undefined selects the authoritative timeline; null explicitly means no local swing.
export function heroFacing(p:Player,face:Player['face'],time:number,swing?:HeroSwing|null):Player['face']{
    if(time<p.dodgeUntil||(p.hurtAt&&time-p.hurtAt<600))return face;
    if(swing!==undefined)return swing&&time<swing.until?swing.face:face;
    return time<p.swingUntil?p.swingFace??face:face;
}
export function heroFrame(p:Player,face:Player['face'],moving:boolean,time:number,tool:Tool,swing?:HeroSwing|null,motionElapsed=time):Sprite{
    const facing=heroFacing(p,face,time,swing);
    const direction:Direction=facing==='left'?'right':facing;
    if(time<p.dodgeUntil)return frameKey('dodge',direction,Math.max(0,Math.min(HERO_FRAME_COUNT-1,Math.floor((time-(p.dodgeUntil-330))/330*HERO_FRAME_COUNT))));
    if(p.hurtAt&&time-p.hurtAt<600)return frameKey('hurt',direction,Math.max(0,Math.min(HERO_FRAME_COUNT-1,Math.floor((time-p.hurtAt)/600*HERO_FRAME_COUNT))));
    if(swing===undefined?time<p.swingUntil:!!swing&&time<swing.until){
        const action=swing?.tool??(p.equipped==='pick'?'pick':p.equipped==='sword'?'sword':p.equipped==='axe'?'axe':tool==='sword'?'sword':tool==='pick'?'pick':'axe');
        const duration=TOOL_TIMING[action].duration,start=swing?.start??p.swingStart??p.swingUntil-duration;
        return frameKey(action,direction,swingFrame(action,time-start));
    }
    if(moving)return frameKey('walk',direction,Math.floor(motionElapsed/85)%HERO_FRAME_COUNT);
    return frameKey('idle',direction,Math.floor(motionElapsed/125)%HERO_IDLE_FRAME_COUNT);
}
export function toolTrailFrame(p:Player,time:number,swing?:HeroSwing|null):Sprite|null{
    const action=swing?.tool??p.equipped;
    if(swing===null||!action||!['axe','pick','sword'].includes(action)||time<p.dodgeUntil||(p.hurtAt&&time-p.hurtAt<600))return null;
    const timing=TOOL_TIMING[action as CombatTool],end=swing?.until??p.swingUntil,start=swing?.start??p.swingStart??end-timing.duration;
    const elapsed=time-start;
    if(time>=end||elapsed<timing.contact*.1)return null;
    const frame=elapsed<timing.contact?Math.floor(elapsed/timing.contact*4):4+Math.floor((elapsed-timing.contact)/(timing.duration-timing.contact)*4);
    return `trail-${action as CombatTool}-${Math.max(0,Math.min(7,frame))}`;
}
export function slimeFrame(m:Mob,time:number,moving:boolean,motionElapsed=time):Sprite|null{
    if(m.hp<=0){const age=time-(m.deadUntil-90000);return age>=0&&age<480?`slime-death-${Math.min(3,Math.floor(age/120))}`:null;}
    if(time<m.hitUntil)return `slime-hurt-${Math.max(0,Math.min(3,Math.floor((time-m.hitUntil+350)/350*4)))}`;
    if(m.windup>time)return `slime-attack-${Math.max(0,Math.min(3,Math.floor((time-m.windup+650)/650*4)))}`;
    const contact=m.windup||(m.cooldown?m.cooldown-1100:0),sinceAttack=time-contact;
    if(contact&&sinceAttack>=0&&sinceAttack<350)return `slime-attack-${4+Math.min(3,Math.floor(sinceAttack/350*4))}`;
    return `slime-${moving?'move':'idle'}-${Math.floor(Math.max(0,motionElapsed)/(moving?90:140))%8}`;
}

export type WorkSwing={action:WorkAction;face:Player['face'];start:number;until:number};
export function workFrame(work:WorkSwing,time:number):Sprite|null{
    if(time<work.start||time>=work.until)return null;
    const timing=WORK_TIMING[work.action],elapsed=time-work.start,contact=4;
    const frame=elapsed<timing.contact?Math.floor(elapsed/timing.contact*contact):contact+Math.floor((elapsed-timing.contact)/(timing.duration-timing.contact)*4);
    const dir=work.face==='left'?'right':work.face;
    return `${work.action}-${dir}-${Math.max(0,Math.min(7,frame))}` as Sprite;
}

export function creatureFrame(m:Mob,time:number,moving:boolean,motionElapsed=time):Sprite|null{
    const kind=m.kind??'slime';if(kind==='slime')return slimeFrame(m,time,moving,motionElapsed);
    const stats=CREATURES[kind];
    if(m.hp<=0){const age=time-(m.deadUntil-90000);return age>=0&&age<480?`${kind}-death-${Math.min(3,Math.floor(age/120))}`:null;}
    if(time<m.hitUntil)return `${kind}-hurt-${Math.max(0,Math.min(3,Math.floor((time-m.hitUntil+350)/350*4)))}`;
    if(m.windup>time)return `${kind}-attack-${Math.max(0,Math.min(3,Math.floor((time-m.windup+stats.windup)/stats.windup*4)))}`;
    if((m.chargeUntil??0)>time)return `${kind}-attack-${4+Math.floor(motionElapsed/70)%3}`;
    if(m.attackAt&&time-m.attackAt<350)return `${kind}-attack-${4+Math.max(0,Math.min(3,Math.floor((time-m.attackAt)/350*4)))}`;
    return `${kind}-${moving?'move':'idle'}-${Math.floor(Math.max(0,motionElapsed)/(moving?(kind==='bat'?65:100):150))%8}`;
}
