import {CAVE_ENTRANCE,MINE_TORCHES,resourcesInRect,SPAWN,sceneAt,terrainAt} from './world';
import type {Atlas} from './art';
import {resourceSprite} from './landscape';
import type {WorldState} from './simulation';
import {floorLevel} from './structures';
import {worldClock} from './day-night';
type Camera={x:number;y:number;level?:number};
let lightLayer:HTMLCanvasElement|undefined;
const lightStamps=new Map<string,HTMLCanvasElement>();
function softLight(color:string){
    let stamp=lightStamps.get(color);
    if(!stamp){
        stamp=document.createElement('canvas');stamp.width=stamp.height=256;
        const ctx=stamp.getContext('2d')!,gradient=ctx.createRadialGradient(128,128,0,128,128,128);
        gradient.addColorStop(0,color);gradient.addColorStop(1,color.slice(0,7)+'00');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);lightStamps.set(color,stamp);
    }
    return stamp;
}
const surfaceLights=[{x:SPAWN.x,y:SPAWN.y-1.4,r:58},{x:CAVE_ENTRANCE.x-1.4,y:CAVE_ENTRANCE.y-.7,r:48},{x:CAVE_ENTRANCE.x+1.4,y:CAVE_ENTRANCE.y-.7,r:48}];
const mineLights=MINE_TORCHES.map(([x,y])=>({x:x+.5,y:y+.5,r:105}));
let daylight:{w:number;h:number;sun:HTMLCanvasElement;haze:HTMLCanvasElement}|undefined;
function daylightFor(w:number,h:number){
    if(!daylight||daylight.w!==w||daylight.h!==h){
        const sized=(color:string,width:number,height:number)=>{
            const c=document.createElement('canvas');c.width=Math.ceil(width);c.height=Math.ceil(height);
            const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.drawImage(softLight(color),0,0,c.width,c.height);return c;
        };
        daylight={w,h,sun:sized('#ffe7af36',w*1.5,h*1.8),haze:sized('#f9edca24',w*1.2,h*.9)};
    }
    return daylight;
}
export function atmosphere(ctx:CanvasRenderingContext2D,s:WorldState,pos:Camera,art:Atlas,time:number,w:number,h:number,ox:number,oy:number){
    const underground=sceneAt(pos.x)==='mine';
    const clock=worldClock(s.dayStartedAt??s.created,time);
    const region=terrainAt(Math.floor(pos.x),Math.floor(pos.y));
    const lights=[...(underground?mineLights:surfaceLights.map(l=>({...l,y:l.y+floorLevel(pos)}))),...Object.values(s.buildings).filter(b=>b.kind==='lantern'&&floorLevel(b)===floorLevel(pos)).map(b=>({x:b.x+.5,y:b.y+.35,r:72}))];
    if(underground){
        lightLayer??=document.createElement('canvas');
        if(lightLayer.width!==w)lightLayer.width=w;if(lightLayer.height!==h)lightLayer.height=h;
        const light=lightLayer.getContext('2d')!;
        light.clearRect(0,0,w,h);light.globalCompositeOperation='source-over';
        light.fillStyle='#747b963b';light.fillRect(0,0,w,h);
        light.globalCompositeOperation='destination-out';
        const clear=softLight('#000000ed');
        for(const l of [{x:pos.x,y:pos.y,r:180},...lights]){
            const x=l.x*24+ox,y=l.y*24+oy;
            if(x<-l.r||x>w+l.r||y<-l.r||y>h+l.r)continue;
            light.drawImage(clear,x-l.r,y-l.r,l.r*2,l.r*2);
        }
        light.globalCompositeOperation='source-over';ctx.drawImage(lightLayer,0,0);
    } else {
        // Warm color grade and lifted shadows remain visible across the whole scene.
        ctx.save();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=.16+.12*clock.daylight;ctx.fillStyle='#efbb72';ctx.fillRect(0,0,w,h);
        ctx.globalCompositeOperation='screen';ctx.globalAlpha=.04+.015*clock.daylight;ctx.fillStyle='#fff0cd';ctx.fillRect(0,0,w,h);ctx.restore();
        // Broad, slow daylight. Stamps are cached.
        const drift=Math.sin(time/18000+pos.x*.006)*18,day=daylightFor(w,h);
        ctx.save();ctx.globalAlpha=.38+.62*clock.daylight;
        ctx.drawImage(day.sun,Math.round(-w*.4+drift),Math.round(-h*.65));
        if(region==='forest'||region==='marsh'){
            ctx.globalAlpha*=region==='forest'?.55:1;
            ctx.drawImage(day.haze,Math.round(-w*.1-drift),Math.round(h*.25));
        }
        ctx.restore();
        const warmTwilight=Math.max(clock.dawn,clock.dusk);
        if(warmTwilight>0){ctx.save();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=.1*warmTwilight;ctx.fillStyle='#e9b58e';ctx.fillRect(0,0,w,h);ctx.restore();}
        if(clock.night>0){
            ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.18*clock.night;ctx.fillStyle='#7486a6';ctx.fillRect(0,0,w,h);ctx.restore();
        }
    }
    ctx.save();ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;
    for(const l of lights){
        const x=l.x*24+ox,y=l.y*24+oy,r=l.r*(1+(underground?0:.12*clock.night))+Math.sin(time/650+l.x);
        if(x<-r||x>w+r||y<-r||y>h+r)continue;
        ctx.drawImage(softLight(underground?'#ffdcac62':'#ffdea04d'),x-r,y-r,r*2,r*2);
    }ctx.restore();
    // Sparse generated pollen and dust drift slowly through the light.
    ctx.save();ctx.globalAlpha=underground?.18:(region==='forest'?.1:.07)+(region==='forest'?.14:.09)*clock.daylight+.07*clock.night;
    for(let i=0;i<(underground?10:7);i++){
        const x=((i*139+time*.004+Math.sin(time/4000+i)*4-pos.x*10)%(w+30)+w+30)%(w+30)-15;
        const y=((i*83+time*.003-pos.y*8)%(h+30)+h+30)%(h+30)-15;
        ctx.drawImage(art.spark,Math.round(x),Math.round(y),2,2);
    }
    ctx.restore();
}
export function treeShadows(ctx:CanvasRenderingContext2D,s:WorldState,pos:Camera,art:Atlas,ox:number,oy:number,time=s.tick){
    if(sceneAt(pos.x)==='mine'||floorLevel(pos)>0)return;
    const light=worldClock(s.dayStartedAt??s.created,time).daylight;
    ctx.save();ctx.globalAlpha=.025+.055*light;ctx.globalCompositeOperation='multiply';
    for(const r of resourcesInRect(pos.x-20,pos.y-15,pos.x+20,pos.y+15)){
        if((r.kind!=='tree'&&r.kind!=='pine')||s.depleted[r.id]||Math.abs(r.x-pos.x)>20||Math.abs(r.y-pos.y)>15)continue;
        ctx.save();ctx.translate((r.x+.5)*24+ox,(r.y+1)*24+oy);ctx.transform(1,.18,-.55,.36,0,0);ctx.drawImage(art[resourceSprite(r)],-22,-58,44,58);ctx.restore();
    }ctx.restore();
}
