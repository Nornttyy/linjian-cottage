import {frameKey,HERO_FRAME_COUNT,HERO_IDLE_FRAME_COUNT,type Sprite,type Direction} from './art';
import {TOOL_TIMING,type Player,type Mob,type Tool} from './simulation';
export type HeroSwing={tool:Exclude<Tool,'build'>;face:Player['face'];start:number;until:number};

export function swingFrame(action:Exclude<Tool,'build'>,elapsed:number){
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
export function slimeFrame(m:Mob,time:number,moving:boolean):Sprite|null{
    if(m.hp<=0){const age=time-(m.deadUntil-90000);return age>=0&&age<480?`slime-death-${Math.min(3,Math.floor(age/120))}`:null;}
    if(time<m.hitUntil)return `slime-hurt-${Math.max(0,Math.min(3,Math.floor((time-m.hitUntil+350)/350*4)))}`;
    if(m.windup)return `slime-attack-${Math.max(0,Math.min(3,Math.floor((time-m.windup+650)/650*4)))}`;
    const sinceAttack=time-(m.cooldown-1100);
    if(m.cooldown&&sinceAttack>=0&&sinceAttack<350)return `slime-attack-${4+Math.min(3,Math.floor(sinceAttack/350*4))}`;
    return `slime-${moving?'move':'idle'}-${Math.floor(time/(moving?90:140))%8}`;
}
