import type {Atlas} from './art';
import {atLevel,floorLevel,wallLinks,wallRects,wallOccupies,type Building} from './structures';
import {material} from './tiles';
type Walls=Readonly<Record<string,Building>>;
export const wallConnections=wallLinks;
export function wallLayout(buildings:Walls,x:number,y:number,level=0){
    const links=wallLinks(buildings,x,y,level),vertical=(links.north||links.south)&&!links.east&&!links.west;
    const rects=wallRects(buildings,x,y,level),left=Math.min(...rects.map(r=>r[0])),right=Math.max(...rects.map(r=>r[0]+r[2]));
    return{...links,vertical,x:left,width:right-left};
}
export function floorWallInsets(buildings:Walls,x:number,y:number,level=0){
    if(!atLevel(buildings,x,y,'wall',level))return{left:0,right:0,top:0,bottom:0};
    const has=(dx:number,dy:number)=>!!atLevel(buildings,x+dx,y+dy,'floor',level);
    return{left:!has(-1,0)&&has(1,0)?9:0,right:has(-1,0)&&!has(1,0)?9:0,top:!has(0,-1)&&has(0,1)?9:0,bottom:has(0,-1)&&!has(0,1)?9:0};
}
// The same narrow footprint drives drawing and collision. Only exterior
// boundaries receive outlines: adjoining cells share uninterrupted wood.
function drawWallUncached(ctx:CanvasRenderingContext2D,art:Atlas,buildings:Walls,b:Building,ox:number,oy:number){
    const level=floorLevel(b),rects=wallRects(buildings,b.x,b.y,level),shape=wallLayout(buildings,b.x,b.y,level);
    const x=b.x*24+ox,y=b.y*24+oy,height=b.kind==='fence'?10:19;
    const occupied=(px:number,py:number)=>wallOccupies(buildings,b.x+(px+.5)/24,b.y+(py+.5)/24,level);
    for(let py=0;py<24;py++)for(let px=0;px<24;){
        if(!occupied(px,py)||occupied(px,py+1)){px++;continue;}
        const start=px;while(px<24&&occupied(px,py)&&!occupied(px,py+1))px++;
        material(ctx,art['wall-face'],b.x,b.y,x+start,y+py+1-height,px-start,height);
        ctx.fillStyle='#946237';ctx.fillRect(x+start,y+py,px-start,1);
    }
    ctx.save();ctx.beginPath();for(const [rx,ry,w,h]of rects)ctx.rect(x+rx,y+ry-height,w,h);ctx.clip();
    material(ctx,art['wall-cap'],b.x,b.y,x,y-height,24,24);ctx.restore();
    ctx.fillStyle='#f3c57a';
    for(let py=0;py<24;py++)for(let px=0;px<24;px++)if(occupied(px,py)&&!occupied(px,py-1))ctx.fillRect(x+px,y+py-height,1,1);
    ctx.fillStyle='#a47041';
    for(let py=0;py<24;py++)for(let px=0;px<24;px++)if(occupied(px,py)&&!occupied(px+1,py))ctx.fillRect(x+px,y+py-height,1,1);
    if(b.kind==='window'||b.kind==='door'){
        const img=art[b.kind==='door'?(b.open?'door-open':'door'):'window'];
        if(!shape.vertical)ctx.drawImage(img,x+2,y-13,20,29);
        else if(b.kind==='window')ctx.drawImage(img,x+10,y-9,4,19);
        else if(!b.open)ctx.drawImage(img,x+10,y-10,4,24);
        else{ctx.save();ctx.translate(x+12,y-15);ctx.rotate(Math.PI/2);ctx.drawImage(art['wall-cap'],0,0,14,4);ctx.restore();}
    }
}

export type WallLayer={image:HTMLCanvasElement;sx:number;sy:number;width:number;height:number;x:number;y:number;depth:number};
type WallStamp={image:HTMLCanvasElement;layers?:WallLayer[]};
const wallStamps=new WeakMap<Atlas,Map<string,WallStamp>>();
function wallStamp(art:Atlas,buildings:Walls,b:Building){
    let cache=wallStamps.get(art);if(!cache){cache=new Map();wallStamps.set(art,cache);}
    const level=floorLevel(b),neighbors=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>{
        const n=atLevel(buildings,b.x+dx,b.y+dy,'wall',level)??atLevel(buildings,b.x+dx,b.y+dy,'fence',level);
        return n&&(['wall','door','window','fence'] as string[]).includes(n.kind)?n.kind+':'+!!n.open:'';
    });
    const key=[b.kind,!!b.open,...neighbors,b.x%2,b.y%2].join(':');let stamp=cache.get(key);
    if(!stamp){
        const image=document.createElement('canvas');image.width=40;image.height=64;
        const context=image.getContext('2d',{willReadFrequently:true})!;context.imageSmoothingEnabled=false;
        drawWallUncached(context,art,buildings,b,-b.x*24+8,-b.y*24+32);stamp={image};
        if(cache.size>=512)cache.delete(cache.keys().next().value!);cache.set(key,stamp);
    }
    return stamp;
}
// Partition the final visible pixels, so a pixel belongs to exactly one depth.
// Fading multiple wall layers therefore never darkens overlapping faces twice.
export function connectedWallLayers(art:Atlas,buildings:Walls,b:Building):readonly WallLayer[]{
    const stamp=wallStamp(art,buildings,b);if(stamp.layers)return stamp.layers;
    const context=stamp.image.getContext('2d')!,pixels=context.getImageData(0,0,40,64).data;
    const level=floorLevel(b),rects=wallRects(buildings,b.x,b.y,level),shape=wallLayout(buildings,b.x,b.y,level),height=b.kind==='fence'?10:19;
    let facade:Uint8ClampedArray|undefined;
    if(!shape.vertical&&(b.kind==='door'||b.kind==='window')){
        const mask=document.createElement('canvas');mask.width=40;mask.height=64;const ctx=mask.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingEnabled=false;
        ctx.drawImage(art[b.kind==='door'?(b.open?'door-open':'door'):'window'],10,19,20,29);facade=ctx.getImageData(0,0,40,64).data;
    }
    const groups=new Map<number,{indices:number[];left:number;top:number;right:number;bottom:number}>();
    for(let sy=0;sy<64;sy++)for(let sx=0;sx<40;sx++){
        const index=(sy*40+sx)*4;if(!pixels[index+3])continue;
        const x=sx-8,y=sy-32;let depth=-Infinity;
        for(const [rx,ry,w,h]of rects)if(x>=rx&&x<rx+w&&y>=ry-height&&y<ry+h)depth=Math.max(depth,Math.min(y+height+1,ry+h));
        if(facade?.[index+3])depth=15;
        if(!Number.isFinite(depth))depth=shape.vertical?Math.max(1,Math.min(24,y+height+1)):15;
        let group=groups.get(depth);if(!group){group={indices:[],left:sx,top:sy,right:sx,bottom:sy};groups.set(depth,group);}
        group.indices.push(index);group.left=Math.min(group.left,sx);group.top=Math.min(group.top,sy);group.right=Math.max(group.right,sx);group.bottom=Math.max(group.bottom,sy);
    }
    const rows=[...groups.entries()].sort((a,b)=>a[0]-b[0]),packed=document.createElement('canvas');
    packed.width=Math.max(1,...rows.map(([,g])=>g.right-g.left+1));packed.height=Math.max(1,rows.reduce((sum,[,g])=>sum+g.bottom-g.top+1,0));
    const ctx=packed.getContext('2d')!,output=ctx.createImageData(packed.width,packed.height),layers:WallLayer[]=[];let cursor=0;
    for(const [depth,g]of rows){
        const width=g.right-g.left+1,height=g.bottom-g.top+1;
        for(const i of g.indices){const pixel=i/4,x=pixel%40-g.left,y=Math.floor(pixel/40)-g.top+cursor;output.data.set(pixels.subarray(i,i+4),(y*packed.width+x)*4);}
        layers.push({image:packed,sx:0,sy:cursor,width,height,x:g.left-8,y:g.top-32,depth:depth/24});cursor+=height;
    }
    ctx.putImageData(output,0,0);stamp.layers=layers;return layers;
}
export function drawWallLayer(ctx:CanvasRenderingContext2D,part:WallLayer,b:Building,ox:number,oy:number){
    ctx.drawImage(part.image,part.sx,part.sy,part.width,part.height,b.x*24+ox+part.x,b.y*24+oy+part.y,part.width,part.height);
}
export function drawConnectedWall(ctx:CanvasRenderingContext2D,art:Atlas,buildings:Walls,b:Building,ox:number,oy:number){
    ctx.drawImage(wallStamp(art,buildings,b).image,b.x*24+ox-8,b.y*24+oy-32);
}
