import {drawWaterTile} from './water';
import { terrainAt, type Terrain } from './world';
import {ART_DENSITY, type Atlas} from './art';
export const TILE=24;
const mod=(v:number,n:number)=>((v%n)+n)%n;
const materials = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
export function material(ctx:CanvasRenderingContext2D,texture:HTMLCanvasElement,x:number,y:number,px:number,py:number,w=TILE,h=TILE){
 let entries=materials.get(texture);if(!entries)materials.set(texture,entries=new Map());
 const sx=mod(x,2),sy=mod(y,2),key=sx+':'+sy+':'+w+':'+h;let tile=entries.get(key);
 if(!tile){tile=document.createElement('canvas');tile.width=w*ART_DENSITY;tile.height=h*ART_DENSITY;const tc=tile.getContext('2d')!;tc.scale(ART_DENSITY,ART_DENSITY);tc.imageSmoothingEnabled=false;tc.drawImage(texture,sx*texture.width/2,sy*texture.height/2,texture.width/2,texture.height/2,0,0,w,h);entries.set(key,tile);}
 ctx.drawImage(tile,px,py,w,h);
}
const priority:Record<Terrain,number>={water:0,path:1,'cave-floor':1,sand:2,rock:3,marsh:4,grass:5,forest:6,snow:7,'cave-wall':8};
function terrainTileUncached(ctx:CanvasRenderingContext2D,art:Atlas,x:number,y:number,ox:number,oy:number,base=true){
    const terrain=terrainAt(x,y),px=x*TILE+ox,py=y*TILE+oy;
    if(base)material(ctx,art[`ground-${terrain}`],x,y,px,py);
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

const composites=new WeakMap<Atlas,Map<string,HTMLCanvasElement>>();
export function terrainTile(ctx:CanvasRenderingContext2D,art:Atlas,x:number,y:number,ox:number,oy:number,time=0){
 let entries=composites.get(art);if(!entries)composites.set(art,entries=new Map());
 const terrain=terrainAt(x,y),top=terrainAt(x,y-1),right=terrainAt(x+1,y),bottom=terrainAt(x,y+1),left=terrainAt(x-1,y);
 const key=terrain+':'+top+':'+right+':'+bottom+':'+left+':'+mod(x,20)+':'+mod(y,20);
 let tile=entries.get(key);if(!tile){tile=document.createElement('canvas');tile.width=tile.height=TILE*ART_DENSITY;const tc=tile.getContext('2d')!;tc.scale(ART_DENSITY,ART_DENSITY);tc.imageSmoothingEnabled=false;terrainTileUncached(tc,art,x,y,-x*TILE,-y*TILE,terrain!=='water');if(entries.size>=2048)entries.delete(entries.keys().next().value!);entries.set(key,tile);}
 if(terrain==='water')drawWaterTile(ctx,art,x,y,ox,oy,time);
 ctx.drawImage(tile,x*TILE+ox,y*TILE+oy,TILE,TILE);
}
