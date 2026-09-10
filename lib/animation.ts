import {frameKey,type Sprite,type Direction} from './art';
import type {Player,Mob,Tool} from './simulation';
export function heroFrame(p:Player,face:Player['face'],moving:boolean,time:number,tool:Tool):Sprite{
    const direction:Direction=face==='left'?'right':face;
    if(time<p.dodgeUntil)return frameKey('dodge',direction,Math.max(0,Math.min(7,Math.floor((time-(p.dodgeUntil-330))/330*8))));
    if(p.hurtAt&&time-p.hurtAt<600)return frameKey('hurt',direction,Math.max(0,Math.min(7,Math.floor((time-p.hurtAt)/600*8))));
    if(time<p.swingUntil){
        const action=p.equipped==='pick'?'pick':p.equipped==='sword'?'sword':p.equipped==='axe'?'axe':tool==='sword'?'sword':tool==='pick'?'pick':'axe';
        const duration=action==='sword'?370:490,start=p.swingStart??p.swingUntil-duration;
        return frameKey(action,direction,Math.max(0,Math.min(7,Math.floor((time-start)/duration*8))));
    }
    if(moving)return frameKey('walk',direction,Math.floor(time/85)%8);
    return frameKey('idle',direction,Math.floor(time/380)%(direction==='down'?4:2));
}
export function slimeFrame(m:Mob,time:number,moving:boolean):Sprite|null{
    if(m.hp<=0){const age=time-(m.deadUntil-90000);return age>=0&&age<480?`slime-death-${Math.min(3,Math.floor(age/120))}`:null;}
    if(time<m.hitUntil)return `slime-hurt-${Math.max(0,Math.min(3,Math.floor((time-m.hitUntil+350)/350*4)))}`;
    if(m.windup)return `slime-attack-${Math.max(0,Math.min(3,Math.floor((time-m.windup+650)/650*4)))}`;
    const sinceAttack=time-(m.cooldown-1100);
    if(m.cooldown&&sinceAttack>=0&&sinceAttack<350)return `slime-attack-${4+Math.min(3,Math.floor(sinceAttack/350*4))}`;
    return `slime-${moving?'move':'idle'}-${Math.floor(time/(moving?90:140))%8}`;
}
