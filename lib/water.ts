import {ART_DENSITY,type Atlas} from './art';
import {terrainAt} from './world';
const TILE=24,PERIOD=TILE*2;
export const WATER_FRAME_MS=50;
export const WATER_FRAME_COUNT=96;
export const WATER_CYCLE_MS=WATER_FRAME_MS*WATER_FRAME_COUNT;
const mod=(value:number,n:number)=>((value%n)+n)%n;
export function waterFrameIndex(time:number){return Math.floor(mod(Number.isFinite(time)?time:0,WATER_CYCLE_MS)/WATER_FRAME_MS);}
type WaterCache={pattern:HTMLCanvasElement;frames:(HTMLCanvasElement|undefined)[]};
const caches=new WeakMap<HTMLCanvasElement,WaterCache>();
function canvas(width:number,height:number){const result=document.createElement('canvas');result.width=width*ART_DENSITY;result.height=height*ART_DENSITY;return result;}
function waterFrame(texture:HTMLCanvasElement,index:number){
    let cache=caches.get(texture);
    if(!cache){
        const pattern=canvas(PERIOD*3,PERIOD*3),ctx=pattern.getContext('2d')!;ctx.scale(ART_DENSITY,ART_DENSITY);ctx.imageSmoothingEnabled=false;
        for(let y=0;y<3;y++)for(let x=0;x<3;x++)ctx.drawImage(texture,x*PERIOD,y*PERIOD,PERIOD,PERIOD);
        cache={pattern,frames:[]};caches.set(texture,cache);
    }
    let frame=cache.frames[index];if(frame)return frame;
    frame=canvas(PERIOD,PERIOD);const ctx=frame.getContext('2d')!;ctx.scale(ART_DENSITY,ART_DENSITY);ctx.imageSmoothingEnabled=false;
    const phase=index/WATER_FRAME_COUNT,flow=phase*PERIOD,turn=phase*Math.PI*2;
    // Move the actual generated texture downstream. Small row displacement bends
    // the existing ripples instead of painting unrelated flashing particles.
    for(let row=0;row<PERIOD;row+=2){
        const drift=Math.sin(turn)*1.5+Math.sin(row/PERIOD*Math.PI*2+turn*2)*.7;
        ctx.drawImage(cache.pattern,(PERIOD+drift)*ART_DENSITY,(PERIOD+row-flow)*ART_DENSITY,PERIOD*ART_DENSITY,2*ART_DENSITY,0,row,PERIOD,2);
    }
    cache.frames[index]=frame;return frame;
}
export function drawWaterTile(ctx:CanvasRenderingContext2D,art:Atlas,x:number,y:number,ox:number,oy:number,time:number){
    if(terrainAt(x,y)!=='water')return;
    const index=waterFrameIndex(time),frame=waterFrame(art['ground-water'],index),px=x*TILE+ox,py=y*TILE+oy;
    ctx.save();ctx.beginPath();ctx.rect(px,py,TILE,TILE);ctx.clip();
    ctx.drawImage(frame,mod(x,2)*TILE*ART_DENSITY,mod(y,2)*TILE*ART_DENSITY,TILE*ART_DENSITY,TILE*ART_DENSITY,px,py,TILE,TILE);
    // An inward shoreline wash remains inside the water tile. The unchanged
    // terrain-edge composite is painted above it by tiles.ts.
    const pulse=(Math.sin(index/WATER_FRAME_COUNT*Math.PI*4+(x+y)*.7)+1)/2;
    ctx.globalAlpha*=.10+pulse*.10;ctx.strokeStyle='#d5f3d2';ctx.lineWidth=.5;
    for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])if(terrainAt(x+dx,y+dy)!=='water'){
        const inset=3.5+pulse*1.5;ctx.beginPath();
        for(let step=0;step<=TILE;step+=3){const ripple=Math.sin(step/TILE*Math.PI*2+index/WATER_FRAME_COUNT*Math.PI*2)*.55;
            const a=dx?px+(dx<0?inset:TILE-inset)+ripple:px+step,b=dy?py+(dy<0?inset:TILE-inset)+ripple:py+step;
            if(step===0)ctx.moveTo(a,b);else ctx.lineTo(a,b);
        }ctx.stroke();
    }
    ctx.restore();
}
