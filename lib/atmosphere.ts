import {CAVE_ENTRANCE,MINE_TORCHES,RESOURCES,SPAWN,sceneAt,terrainAt} from './world';
import type {Atlas} from './art';
import type {WorldState} from './simulation';
type Camera={x:number;y:number};
let lightLayer:HTMLCanvasElement|undefined;
export function atmosphere(ctx:CanvasRenderingContext2D,s:WorldState,pos:Camera,art:Atlas,time:number,w:number,h:number,ox:number,oy:number){
    const underground=sceneAt(pos.x)==='mine';
    const region=terrainAt(Math.floor(pos.x),Math.floor(pos.y));
    const lights=underground?MINE_TORCHES.map(([x,y])=>({x:x+.5,y:y+.5,r:95})):[{x:SPAWN.x,y:SPAWN.y-1.4,r:52},{x:CAVE_ENTRANCE.x-1.4,y:CAVE_ENTRANCE.y-.7,r:45},{x:CAVE_ENTRANCE.x+1.4,y:CAVE_ENTRANCE.y-.7,r:45}];
    if(underground){
        lightLayer??=document.createElement('canvas');
        if(lightLayer.width!==w)lightLayer.width=w;if(lightLayer.height!==h)lightLayer.height=h;
        const light=lightLayer.getContext('2d')!;
        light.clearRect(0,0,w,h);light.globalCompositeOperation='source-over';
        light.fillStyle='#48587970';light.fillRect(0,0,w,h);
        light.globalCompositeOperation='destination-out';
        for(const l of [{x:pos.x,y:pos.y,r:155},...lights]){
            const x=l.x*24+ox,y=l.y*24+oy,g=light.createRadialGradient(x,y,12,x,y,l.r);
            g.addColorStop(0,'#000000dd');g.addColorStop(.55,'#00000099');g.addColorStop(1,'#00000000');light.fillStyle=g;light.fillRect(x-l.r,y-l.r,l.r*2,l.r*2);
        }
        light.globalCompositeOperation='source-over';ctx.drawImage(lightLayer,0,0);
    } else {
        // Subtle daylight moves over the fixed landscape; it never obscures the terrain.
        ctx.save();ctx.globalAlpha=.045;ctx.fillStyle='#fff1b2';
        const drift=(time/450+pos.x*7)%440;
        for(let i=-2;i<4;i++){ctx.beginPath();ctx.moveTo(i*260+drift,-30);ctx.lineTo(i*260+drift+75,-30);ctx.lineTo(i*260+drift-110,h+30);ctx.lineTo(i*260+drift-180,h+30);ctx.fill();}ctx.restore();
        if(region==='forest'||region==='marsh'){
            ctx.save();ctx.globalAlpha=region==='marsh'?.055:.025;
            const haze=ctx.createLinearGradient(0,h*.35,w,h*.8);haze.addColorStop(0,'#e8f8e400');haze.addColorStop(.5,'#e8f8e4');haze.addColorStop(1,'#e8f8e400');ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);ctx.restore();
        }
    }
    ctx.save();ctx.globalCompositeOperation='screen';
    for(const l of lights){
        const x=l.x*24+ox,y=l.y*24+oy,r=l.r+(Math.sin(time/150+l.x)*2);
        if(x<-r||x>w+r||y<-r||y>h+r)continue;
        const glow=ctx.createRadialGradient(x,y,2,x,y,r);glow.addColorStop(0,underground?'#ffc36055':'#ffd07c35');glow.addColorStop(1,'#ffd27c00');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
    }ctx.restore();
    // Generated flecks provide sparse airborne dust / falling leaves.
    for(let i=0;i<(underground?12:8);i++){
        const x=((i*139+time*(underground?.004:.013)-pos.x*10)% (w+30)+w+30)%(w+30)-15;
        const y=((i*83+time*.009-pos.y*8)%(h+30)+h+30)%(h+30)-15;
        ctx.save();ctx.globalAlpha=underground?.2:region==='forest'?.35:.16;ctx.drawImage(art[underground?'spark':'tuft'],x,y,underground?3:5,underground?3:5);ctx.restore();
    }
}
export function treeShadows(ctx:CanvasRenderingContext2D,s:WorldState,pos:Camera,art:Atlas,ox:number,oy:number){
    if(sceneAt(pos.x)==='mine')return;
    ctx.save();ctx.globalAlpha=.12;ctx.globalCompositeOperation='multiply';
    for(const r of RESOURCES){
        if((r.kind!=='tree'&&r.kind!=='pine')||s.depleted[r.id]||Math.abs(r.x-pos.x)>20||Math.abs(r.y-pos.y)>15)continue;
        ctx.save();ctx.translate((r.x+.5)*24+ox,(r.y+1)*24+oy);ctx.transform(1,.18,-.55,.36,0,0);ctx.drawImage(art[r.kind],-22,-58,44,58);ctx.restore();
    }ctx.restore();
}
