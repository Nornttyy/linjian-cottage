import { terrainAt, type Terrain } from './world';
import type { Atlas } from './art';
export const TILE=24;
const mod=(v:number,n:number)=>((v%n)+n)%n;
export function material(ctx:CanvasRenderingContext2D,texture:HTMLCanvasElement,x:number,y:number,px:number,py:number,w=TILE,h=TILE){
    const period=2, sw=texture.width/period, sh=texture.height/period;
    ctx.drawImage(texture,mod(x,period)*sw,mod(y,period)*sh,sw,sh,px,py,w,h);
}
const priority:Record<Terrain,number>={water:0,path:1,'cave-floor':1,sand:2,rock:3,marsh:4,grass:5,forest:6,snow:7,'cave-wall':8};
export function terrainTile(ctx:CanvasRenderingContext2D,art:Atlas,x:number,y:number,ox:number,oy:number){
    const terrain=terrainAt(x,y),px=x*TILE+ox,py=y*TILE+oy;
    material(ctx,art[`ground-${terrain}`],x,y,px,py);
    // Blend borders using the neighbouring material, while collision remains on the grid.
    for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
        const other=terrainAt(x+dx,y+dy);
        if(other===terrain||priority[other]<=priority[terrain])continue;
        const shore=terrain==='water',depth=shore?4:5;
        ctx.save();ctx.beginPath();
        for(let i=0;i<TILE;i+=3){
            const edge=1+mod((dx?y:x)*19+i*7,depth);
            if(dy===-1)ctx.rect(px+i,py,3,edge);
            if(dy===1)ctx.rect(px+i,py+TILE-edge,3,edge);
            if(dx===-1)ctx.rect(px,py+i,edge,3);
            if(dx===1)ctx.rect(px+TILE-edge,py+i,edge,3);
        }
        ctx.clip();material(ctx,art[`ground-${other}`],x,y,px,py);ctx.restore();
    }
}
