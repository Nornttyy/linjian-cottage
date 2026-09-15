import type {GameEvent,WorldState} from './simulation';
import {resourceAt} from './world';
export type EffectKind='wood'|'stone'|'copper'|'leaves'|'impact'|'hurt'|'spore'|'water'|'splash'|'steam'|'build'|'demolish'|'soil'|'seed'|'harvest'|'dodge'|'sleep'|'eat';
export type EffectPixel={x:number;y:number;w:number;h:number;color:string;alpha:number};
export function eventEffect(e:GameEvent,s:WorldState):EffectKind|null{
    if(e.kind==='hit'){
        const r=e.targetId?resourceAt(Math.floor(e.x),Math.floor(e.y)):undefined;
        if(r&&r.id===e.targetId)return r.kind==='tree'||r.kind==='pine'?'wood':r.kind==='berry'?'leaves':r.kind;
        return s.mobs.some(m=>m.id===e.targetId)||e.amount>1?'impact':null;
    }
    if(e.kind==='build')return e.removed?'demolish':'build';
    const kinds:Partial<Record<GameEvent['kind'],EffectKind>>={hurt:'hurt',spore:'spore',water:'water',fish:'splash',meal:'steam',till:'soil',plant:'seed',harvest:'harvest',dodge:'dodge',sleep:'sleep',eat:'eat'};
    return kinds[e.kind]??null;
}
const durations:Record<EffectKind,number>={wood:440,stone:360,copper:340,leaves:620,impact:220,hurt:380,spore:1100,water:560,splash:720,steam:1100,build:400,demolish:480,soil:420,seed:520,harvest:680,dodge:300,sleep:1100,eat:620};
const seedHash=(seed:string)=>{let n=2166136261;for(let i=0;i<seed.length;i++)n=Math.imul(n^seed.charCodeAt(i),16777619);return n>>>0;};
/** Each family owns its silhouette and motion; no item icons are used as debris.
 * Sampling is deterministic and stateless, so repeats, dropped frames and
 * multiplayer acknowledgements cannot create extra particle emitters. */
export function effectPixels(kind:EffectKind,age:number,seed=''):EffectPixel[]{
    const duration=durations[kind];if(age<0||age>=duration)return[];
    const t=age/duration,hash=seedHash(seed),result:EffectPixel[]=[];
    const random=(i:number)=>((Math.imul(hash^(i*374761393),668265263)>>>0)%997)/997;
    const rect=(x:number,y:number,w:number,h:number,color:string,alpha=1)=>result.push({x:Math.round(x),y:Math.round(y),w,h,color,alpha:Math.max(0,Math.min(1,alpha*Math.min(1,(1-t)*3)))});
    const ring=(r:number,y:number,color:string,alpha=.65)=>{for(let i=0;i<12;i++){const a=i*Math.PI/6;rect(Math.cos(a)*r,y+Math.sin(a)*r*.35,2,1,color,alpha);}};
    if(kind==='impact'){
        const r=1+t*10;
        for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){rect(dx*r-1,dy*r-12,dx?4:1,dy?4:1,'#fff2b0',1-t);}
        if(t<.35){rect(-3,-14,7,3,'#fff8d0');rect(-1,-16,3,7,'#ffe27b');}
    }else if(kind==='wood'||kind==='demolish'){
        for(let i=0;i<(kind==='wood'?6:10);i++){const dir=i%2?1:-1,x=dir*(1+random(i+9)*4+t*(8+random(i)*11)),y=-10-random(i+12)*6-(8+random(i+3)*13)*t+25*t*t,flip=Math.floor(t*5+i)%2;
            rect(x,y,flip?3:1,flip?1:3,i%3?'#dba45c':'#a97140');rect(x+(flip?1:0),y,1,1,'#f7d68a');}
    }else if(kind==='stone'||kind==='copper'){
        for(let i=0;i<5;i++){const angle=(i/5+.1+random(i)*.08)*Math.PI*2,x=Math.cos(angle)*(2+t*(8+random(i+6)*8)),y=-6+Math.sin(angle)*3-(3+random(i)*15)*t+24*t*t;
            rect(x,y,3,2,kind==='copper'?'#d98e54':'#939ca8');rect(x+1,y-1,2,1,kind==='copper'?'#ffd27e':'#dce3df');}
        if(kind==='copper'&&t<.5)for(let i=0;i<3;i++)rect((i-1)*t*24,-12-t*(10+i*2),1,3,'#fff3bd',1-t*2);
    }else if(kind==='water'||kind==='splash'){
        const count=kind==='splash'?8:6;
        for(let i=0;i<count;i++){const launch=kind==='water'?(i%3)*.05:0,u=Math.max(0,t-launch),x=(i-(count-1)/2)*(kind==='water'?3:2+u*4),y=kind==='water'?-12+random(i)*4+18*u*u:-3-random(i+8)*3-(15+random(i)*14)*u+32*u*u;
            rect(x,y,1,3,'#91e6f4',.85);rect(x-1,y+2,3,2,'#51bcd8',.85);rect(x,y+1,1,1,'#e2ffff');}
        if(t>.18)ring(3+t*(kind==='splash'?18:9),3,'#c2f5e8',.7*(1-t));
    }else if(kind==='steam'){
        for(let i=0;i<3;i++){const u=(t+i*.23)%1,x=(i-1)*5+Math.sin(u*7+i)*3,y=-10-u*25,size=u>.45?3:2;
            rect(x,y,size,2,'#fff2d5',(1-u)*.55);rect(x+2,y-2,2,size,'#dcebd8',(1-u)*.4);}
    }else if(kind==='spore'){
        for(let i=0;i<10;i++){const a=i*2.4,r=4+Math.sqrt(t)*(12+random(i)*14),x=Math.cos(a)*r+Math.sin(t*4+i)*3,y=Math.sin(a)*r*.6-t*6;
            rect(x,y,2,2,i%2?'#e4c867':'#c7ad6c',.7);if(i%3===0)rect(x+1,y-1,1,1,'#fff0a5',.8);}
    }else if(kind==='soil'||kind==='dodge'){
        for(let i=0;i<6;i++){const x=(i-2.5)*(2+t*5),y=(kind==='dodge'?1:0)-Math.sin(t*Math.PI)*(kind==='dodge'?2:6+random(i)*5),size=i%2+1;
            rect(x,y,size+1,size,kind==='soil'?(i%2?'#ac7044':'#d09859'):'#d8c69b',kind==='dodge'?.55:1);}
    }else if(kind==='seed'){
        const y=-9+Math.min(1,t*2)*11;rect(-1,y,2,2,'#b77a36');rect(0,y,1,1,'#f1ce77');
        if(t>.5){rect(-3,1,2,1,'#caa46c');rect(2,1,2,1,'#caa46c');}
    }else if(kind==='harvest'){
        for(let i=0;i<6;i++){const x=(i-2.5)*(1+t*3),y=-4-(12+i)*Math.sin(t*Math.PI)+t*5;rect(x,y,1,3,i%2?'#eec66b':'#9ed26a');rect(x+1,y+1,1,1,'#fff0a3');}
    }else if(kind==='leaves'){
        for(let i=0;i<5;i++){const x=(i-2)*(3+t*4)+Math.sin(t*8+i)*2,y=-8-Math.sin(t*Math.PI)*(8+i)+t*7;
            rect(x,y,3,1,i%2?'#98cb63':'#5da05c');rect(x+1,y-1,2,1,'#d0df80');}
    }else if(kind==='build'){
        for(const [x,y]of [[-9,-6],[8,-6],[-9,4],[8,4]]){rect(x*(1-t*.3),y,2,2,'#c9a873');if(t<.4){rect(x-1,y-2,4,1,'#f9df92');rect(x+1,y-3,1,4,'#f9df92');}}
    }else if(kind==='hurt'){
        for(let i=0;i<5;i++){const angle=i*2.4,x=Math.cos(angle)*(2+t*15),y=-12+Math.sin(angle)*(2+t*8)+t*t*10;rect(x,y,i%2+1,2,i%2?'#e68f7b':'#f8c5a2');}
    }else if(kind==='sleep'){
        for(let i=0;i<2;i++){const x=4+i*6+t*4,y=-24-i*9-t*10;rect(x,y,4,1,'#d0dfeb',.6);rect(x+2,y+1,1,1,'#d0dfeb',.6);rect(x+1,y+2,1,1,'#d0dfeb',.6);rect(x,y+3,4,1,'#d0dfeb',.6);}
    }else if(kind==='eat'){
        for(let i=0;i<3;i++)rect((i-1)*3,-19+t*(8+i),1,1,'#efc783');
        rect(7,-22-t*9,1,5,'#a7dc8c',.7);rect(5,-20-t*9,5,1,'#a7dc8c',.7);
    }
    return result;
}
export function drawEffect(ctx:CanvasRenderingContext2D,kind:EffectKind,x:number,y:number,age:number,seed=''){
    ctx.save();for(const p of effectPixels(kind,age,seed)){ctx.fillStyle=p.color;ctx.globalAlpha=p.alpha;ctx.fillRect(Math.round(x)+p.x,Math.round(y)+p.y,p.w,p.h);}ctx.restore();
}
