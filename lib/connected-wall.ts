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

const wallStamps=new WeakMap<Atlas,Map<string,HTMLCanvasElement>>();
export function drawConnectedWall(ctx:CanvasRenderingContext2D,art:Atlas,buildings:Walls,b:Building,ox:number,oy:number){
    let cache=wallStamps.get(art);if(!cache){cache=new Map();wallStamps.set(art,cache);}
    const links=wallLinks(buildings,b.x,b.y,floorLevel(b));
    const key=[b.kind,!!b.open,...Object.values(links),b.x%2,b.y%2].join(':');let stamp=cache.get(key);
    if(!stamp){stamp=document.createElement('canvas');stamp.width=40;stamp.height=64;const context=stamp.getContext('2d')!;context.imageSmoothingEnabled=false;drawWallUncached(context,art,buildings,b,-b.x*24+8,-b.y*24+32);if(cache.size>=512)cache.delete(cache.keys().next().value!);cache.set(key,stamp);}
    ctx.drawImage(stamp,b.x*24+ox-8,b.y*24+oy-32);
}
