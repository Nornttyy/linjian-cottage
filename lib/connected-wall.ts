import {ART_DENSITY,type Atlas} from './art';
import {atLevel,floorLevel,wallLinks,wallRects,type Building} from './structures';
import {material} from './tiles';
type Walls=Readonly<Record<string,Building>>;
export const wallConnections=wallLinks;
export function wallLayout(buildings:Walls,x:number,y:number,level=0,rules=1){
    const links=wallLinks(buildings,x,y,level,rules),vertical=(links.north||links.south)&&!links.east&&!links.west;
    const rects=wallRects(buildings,x,y,level,rules),left=Math.min(...rects.map(r=>r[0])),right=Math.max(...rects.map(r=>r[0]+r[2]));
    return{...links,vertical,x:left,width:right-left};
}
export function floorWallInsets(buildings:Walls,x:number,y:number,level=0){
    if(!atLevel(buildings,x,y,'wall',level))return{left:0,right:0,top:0,bottom:0};
    const has=(dx:number,dy:number)=>!!atLevel(buildings,x+dx,y+dy,'floor',level);
    return{left:!has(-1,0)&&has(1,0)?9:0,right:has(-1,0)&&!has(1,0)?9:0,top:!has(0,-1)&&has(0,1)?9:0,bottom:has(0,-1)&&!has(0,1)?9:0};
}
// The same narrow footprint drives drawing and collision. Only exterior
// boundaries receive outlines: adjoining cells share uninterrupted wood.
function drawWallUncached(ctx:CanvasRenderingContext2D,art:Atlas,buildings:Walls,b:Building,ox:number,oy:number,rules:number){
    const level=floorLevel(b),rects=wallRects(buildings,b.x,b.y,level,rules),shape=wallLayout(buildings,b.x,b.y,level,rules);
    const x=b.x*24+ox,y=b.y*24+oy,height=19;
    const occupied=(px:number,py:number)=>{
        const tx=b.x+Math.floor(px/24),ty=b.y+Math.floor(py/24);
        if(!atLevel(buildings,tx,ty,'wall',level)&&!(rules===0&&atLevel(buildings,tx,ty,'fence',level)?.kind==='fence'))return false;
        const x=((px%24)+24)%24+.5,y=((py%24)+24)%24+.5;
        return wallRects(buildings,tx,ty,level,rules).some(([rx,ry,w,h])=>x>=rx&&x<rx+w&&y>=ry&&y<ry+h);
    };
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
function wallStamp(art:Atlas,buildings:Walls,b:Building,rules:number){
    let cache=wallStamps.get(art);if(!cache){cache=new Map();wallStamps.set(art,cache);}
    const level=floorLevel(b),neighbors=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>{
        const fixture=rules===0?atLevel(buildings,b.x+dx,b.y+dy,'fence',level):undefined;
        const n=atLevel(buildings,b.x+dx,b.y+dy,'wall',level)??(fixture?.kind==='fence'?fixture:undefined);
        return n?n.kind+':'+!!n.open:'';
    });
    const key=[rules,b.kind,!!b.open,...neighbors,b.x%2,b.y%2].join(':');let stamp=cache.get(key);
    if(!stamp){
        const image=document.createElement('canvas');image.width=40*ART_DENSITY;image.height=64*ART_DENSITY;
        const context=image.getContext('2d',{willReadFrequently:true})!;context.imageSmoothingEnabled=false;context.scale(ART_DENSITY,ART_DENSITY);
        drawWallUncached(context,art,buildings,b,-b.x*24+8,-b.y*24+32,rules);stamp={image};
        if(cache.size>=512)cache.delete(cache.keys().next().value!);cache.set(key,stamp);
    }
    return stamp;
}
// Partition the final visible pixels, so a pixel belongs to exactly one depth.
// Fading multiple wall layers therefore never darkens overlapping faces twice.
export function connectedWallLayers(art:Atlas,buildings:Walls,b:Building,rules=1):readonly WallLayer[]{
    const stamp=wallStamp(art,buildings,b,rules);if(stamp.layers)return stamp.layers;
    const sourceWidth=40*ART_DENSITY,sourceHeight=64*ART_DENSITY;
    const context=stamp.image.getContext('2d')!,pixels=context.getImageData(0,0,sourceWidth,sourceHeight).data;
    const level=floorLevel(b),rects=wallRects(buildings,b.x,b.y,level,rules),shape=wallLayout(buildings,b.x,b.y,level,rules),height=19;
    let facade:Uint8ClampedArray|undefined;
    if(!shape.vertical&&(b.kind==='door'||b.kind==='window')){
        const mask=document.createElement('canvas');mask.width=sourceWidth;mask.height=sourceHeight;const ctx=mask.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingEnabled=false;ctx.scale(ART_DENSITY,ART_DENSITY);
        ctx.drawImage(art[b.kind==='door'?(b.open?'door-open':'door'):'window'],10,19,20,29);facade=ctx.getImageData(0,0,sourceWidth,sourceHeight).data;
    }
    const groups=new Map<number,{indices:number[];left:number;top:number;right:number;bottom:number}>();
    for(let sy=0;sy<sourceHeight;sy++)for(let sx=0;sx<sourceWidth;sx++){
        const index=(sy*sourceWidth+sx)*4;if(!pixels[index+3])continue;
        const x=Math.floor(sx/ART_DENSITY)-8,y=Math.floor(sy/ART_DENSITY)-32;let depth=-Infinity;
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
        for(const i of g.indices){const pixel=i/4,x=pixel%sourceWidth-g.left,y=Math.floor(pixel/sourceWidth)-g.top+cursor;output.data.set(pixels.subarray(i,i+4),(y*packed.width+x)*4);}
        layers.push({image:packed,sx:0,sy:cursor,width:width/ART_DENSITY,height:height/ART_DENSITY,x:g.left/ART_DENSITY-8,y:g.top/ART_DENSITY-32,depth:depth/24});cursor+=height;
    }
    ctx.putImageData(output,0,0);stamp.layers=layers;return layers;
}
export function drawWallLayer(ctx:CanvasRenderingContext2D,part:WallLayer,b:Building,ox:number,oy:number){
    ctx.drawImage(part.image,part.sx,part.sy,part.width*ART_DENSITY,part.height*ART_DENSITY,b.x*24+ox+part.x,b.y*24+oy+part.y,part.width,part.height);
}
export function drawConnectedWall(ctx:CanvasRenderingContext2D,art:Atlas,buildings:Walls,b:Building,ox:number,oy:number,rules=1){
    ctx.drawImage(wallStamp(art,buildings,b,rules).image,b.x*24+ox-8,b.y*24+oy-32,40,64);
}
