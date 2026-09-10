// Generated parts are rasterized once, then articulated at fixed dimensions.
// Heads are never re-scaled or repainted between poses.
export const HERO_FRAME_COUNT=24;
export const HERO_IDLE_FRAME_COUNT=32;
export type RigDirection='down'|'up'|'right';
type Point={x:number;y:number};
type Parts=Record<string,HTMLCanvasElement>;
export const HERO_PART_CROPS:Record<string,number[]>={
    'head-down':[67,110,139,144],'head-up':[306,109,145,141],'head-right':[554,104,154,150],
    'torso-down':[58,343,153,125],'torso-up':[307,341,149,125],'torso-right':[583,333,90,134],
    'upperarm-down':[95,567,67,82],'upperarm-up':[354,566,65,83],'upperarm-right':[594,566,73,78],
    'forearmhand-down':[101,821,60,127],'forearmhand-up':[352,820,60,128],'forearmhand-right':[612,820,60,128],
    'thigh-down':[91,1042,88,145],'thigh-up':[333,1040,93,146],'thigh-right':[598,1031,84,156],
    'shinboot-down':[99,1272,74,171],'shinboot-up':[338,1272,77,168],'shinboot-right':[595,1280,100,159],
    axe:[857,54,88,199],pick:[808,314,155,185],sword:[849,540,79,201]
};
const make=(w=64,h=64)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function sized(source:HTMLCanvasElement,w:number,h:number){const out=make(w,h),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,w,h);return out;}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
function sample(keys:number[][],phase:number){
    let index=0;while(index<keys.length-2&&phase>keys[index+1][0])index++;
    const a=keys[index],b=keys[index+1],t=Math.max(0,Math.min(1,(phase-a[0])/(b[0]-a[0]))),e=t*t*(3-2*t);
    return a.slice(1).map((value,i)=>lerp(value,b[i+1],e));
}
function joint(start:Point,end:Point,a:number,b:number,bend:number):Point{
    const dx=end.x-start.x,dy=end.y-start.y,d=Math.max(.1,Math.min(a+b-.01,Math.hypot(dx,dy)));
    const angle=Math.atan2(dy,dx)+bend*Math.acos(Math.max(-1,Math.min(1,(a*a+d*d-b*b)/(2*a*d))));
    return{x:start.x+Math.cos(angle)*a,y:start.y+Math.sin(angle)*a};
}
function bone(ctx:CanvasRenderingContext2D,img:HTMLCanvasElement,from:Point,to:Point,pivotY=0){
    ctx.save();ctx.translate(from.x,from.y);ctx.rotate(Math.atan2(to.y-from.y,to.x-from.x)-Math.PI/2);
    ctx.drawImage(img,-img.width/2,-pivotY);ctx.restore();
}
export function createHeroFrames(parts:Parts,blinkParts:Parts){
    const frames:Parts={};
    for(const dir of ['down','up','right'] as const){
        const side=dir==='right',head=sized(parts['head-'+dir],11,11);
        const blink=make(11,11),bctx=blink.getContext('2d')!;bctx.drawImage(head,0,0);
        if(blinkParts['head-'+dir]){
            const closed=sized(blinkParts['head-'+dir],11,11);
            // Only the eye band changes; hair, jaw, mouth and neck remain identical.
            if(dir==='down'){bctx.drawImage(closed,2,6,3,2,2,6,3,2);bctx.drawImage(closed,6,6,3,2,6,6,3,2);}
            else if(side)bctx.drawImage(closed,6,6,3,2,6,6,3,2);
        }
        const torso=sized(parts['torso-'+dir],side?6:10,10);
        const upper=sized(parts['upperarm-'+dir],3,5),fore=sized(parts['forearmhand-'+dir],3,6);
        const thigh=sized(parts['thigh-'+dir],4,7),shin=sized(parts['shinboot-'+dir],side?5:4,8);
        const tools={axe:sized(parts.axe,8,19),pick:sized(parts.pick,13,19),sword:sized(parts.sword,7,20)};
        for(const action of ['idle','walk','axe','pick','sword','hurt','dodge'] as const){
            const count=action==='idle'?HERO_IDLE_FRAME_COUNT:HERO_FRAME_COUNT;
            for(let frame=0;frame<count;frame++){
                const p=frame/count,walk=action==='walk',dodge=action==='dodge',using=action==='axe'||action==='pick'||action==='sword';
                const out=make(),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;
                const wave=Math.sin(p*Math.PI*2),crouch=dodge?Math.sin(p*Math.PI)*4:0;
                const bob=action==='idle'?Math.round(Math.sin(p*Math.PI*2)*.6):walk?Math.round(Math.cos(p*Math.PI*4)*.55):0;
                const recoil=action==='hurt'?Math.round(Math.sin(p*Math.PI*3)*(1-p)*1.5):0;
                const cx=32+recoil,hipY=35+(walk?bob:0)+crouch,neckY=25+bob+crouch;
                if(dodge){
                    ctx.translate(32,33);ctx.rotate(p*Math.PI*2*(side?1:-1));ctx.translate(-32,-33);
                }
                const leftHip={x:cx+(side?-1:-2),y:hipY},rightHip={x:cx+(side?1:2),y:hipY};
                const legs=[leftHip,rightHip].map((hip,index)=>{
                    const step=wave*(index?-1:1),lift=walk?Math.max(0,step)*2:0;
                    const ankle={x:hip.x+(walk&&side?step*3:0),y:45.5-lift-(dodge?crouch:0)};
                    const knee=joint(hip,ankle,5.5,5.5,side?-1:index?1:-1);
                    return()=>{bone(ctx,thigh,hip,knee,.5);bone(ctx,shin,knee,ankle,.5);};
                });
                legs[0]();legs[1]();
                const shoulders=[{x:cx+(side?-1:-4),y:neckY+2},{x:cx+(side?2:4),y:neckY+2}];
                let grip:Point|undefined,angle=0;
                if(using){
                    const contact=action==='sword'?10/24:.5;
                    const keys=action==='sword'
                        ? [[0,side?5:3,9,2.2],[.2,side?-2:-5,1,-1.3],[contact,side?7:4,6,1.55],[.72,side?6:3,11,2.5],[1,side?5:3,9,2.2]]
                        : [[0,side?5:3,9,2.6],[.22,-3,1,-1],[.36,0,-3,0],[contact,side?7:3,9,side?1.55:2.55],[.7,side?6:3,11,2.7],[1,side?5:3,9,2.6]];
                    const upKeys=action==='sword'
                        ? [[0,3,6,.7],[.2,-4,3,-1.3],[contact,5,2,1.1],[.72,4,4,.9],[1,3,6,.7]]
                        : [[0,3,6,.7],[.22,-3,1,-1],[.36,0,-3,0],[contact,3,2,.35],[.7,3,5,.6],[1,3,6,.7]];
                    const values=sample(dir==='up'?upKeys:keys,p);grip={x:cx+values[0],y:neckY+values[1]};angle=values[2];
                }
                const armDraws=shoulders.map((shoulder,index)=>{
                    const step=walk?wave*(index?-1:1):0;
                    let hand={x:shoulder.x+(side?step*2.3:step*.35),y:shoulder.y+9-Math.abs(step)*.8};
                    if(dodge)hand={x:shoulder.x+(index?-1:1)*2,y:shoulder.y+5};
                    if(grip){const second=index===0?2:0;hand={x:grip.x-Math.sin(angle)*second,y:grip.y+Math.cos(angle)*second};}
                    const elbow=joint(shoulder,hand,4.5,4.5,index?1:-1);
                    return()=>{bone(ctx,upper,shoulder,elbow,.5);bone(ctx,fore,elbow,hand,.5);};
                });
                const body=()=>{
                    ctx.drawImage(torso,Math.round(cx-torso.width/2),Math.round(neckY));
                    const blinking=action==='idle'&&(frame===27||frame===28);
                    ctx.drawImage(blinking?blink:head,Math.round(cx-head.width/2+(side?.5:0)),Math.round(neckY-10));
                };
                const weapon=()=>{
                    if(!grip||!using)return;
                    const img=tools[action];ctx.save();ctx.translate(grip.x,grip.y);ctx.rotate(angle);
                    // The generated handles are vertical; hands hold the lower handle, not the blade.
                    ctx.drawImage(img,-(action==='axe'?2.5:img.width/2),-img.height+(action==='pick'?4:3));ctx.restore();
                };
                if(dir==='up'){armDraws[0]();armDraws[1]();weapon();body();}
                else{armDraws[0]();body();weapon();armDraws[1]();if(!side)armDraws[0]();}
                if(dodge){
                    // Ground the baked roll without changing the generated part proportions.
                    const pixels=ctx.getImageData(0,0,64,64).data;
                    let bottom=0;
                    for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(pixels[(y*64+x)*4+3]>16)bottom=y+1;
                    const grounded=make(),ground=48-Math.round(Math.sin(p*Math.PI));
                    grounded.getContext('2d')!.drawImage(out,0,ground-bottom);
                    frames[`${action}-${dir}-${frame}`]=grounded;
                }else frames[`${action}-${dir}-${frame}`]=out;
            }
        }
    }
    return frames;
}
