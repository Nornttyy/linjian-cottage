import type {Atlas} from './art';
import {fenceLinks,floorLevel,type Building} from './structures';

type Buildings=Readonly<Record<string,Building>>;
export const FENCE_BITS={north:1,east:2,south:4,west:8} as const;
export const fenceConnections=fenceLinks;
export type FenceConnections=ReturnType<typeof fenceLinks>;
export function fenceMask(buildings:Buildings,x:number,y:number,level=0,rules=1){
    const links=fenceLinks(buildings,x,y,level,rules);
    const mask=(links.north?1:0)|(links.east?2:0)|(links.south?4:0)|(links.west?8:0);
    // Older rooms use a full horizontal footprint without north/south links.
    // End caps keep that physical span visible while retaining open fence gaps.
    return rules===0&&!(mask&5)?mask|10|(!links.west?16:0)|(!links.east?32:0):mask;
}
export type FenceLayer={
    image:HTMLCanvasElement;sx:number;sy:number;sourceWidth:number;sourceHeight:number;
    width:number;height:number;x:number;y:number;depth:number;
};
type FenceKit={post:HTMLCanvasElement;picket:HTMLCanvasElement;rail:HTMLCanvasElement;side:HTMLCanvasElement};
type FenceStamp={image:HTMLCanvasElement;layers:readonly FenceLayer[]};
const TILE=24,TOP=16,HEIGHT=40;
const caches=new WeakMap<Atlas,{kit:FenceKit;stamps:Map<number,FenceStamp>}>();
function canvas(width:number,height:number){
    const image=document.createElement('canvas');image.width=width;image.height=height;
    image.getContext('2d')!.imageSmoothingEnabled=false;return image;
}

// Measured crops from the generated homestead fence, after transparent margins
// are removed. Sample once onto whole game pixels; only rails may be rotated.
function fenceKit(source:HTMLCanvasElement):FenceKit{
    const sample=(rect:readonly[number,number,number,number],width:number,height:number)=>{
        const out=canvas(width,height),ctx=out.getContext('2d')!,[x,y,w,h]=rect;
        ctx.drawImage(source,x/246*source.width,y/165*source.height,w/246*source.width,h/165*source.height,0,0,width,height);
        const pixels=ctx.getImageData(0,0,width,height);
        for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>=128?255:0;
        ctx.putImageData(pixels,0,0);return out;
    };
    const rail=sample([53,78,8,35],12,3),slim=sample([53,78,8,35],12,2),side=canvas(2,12),ctx=side.getContext('2d')!;
    ctx.translate(2,0);ctx.rotate(Math.PI/2);ctx.drawImage(slim,0,0);
    return{post:sample([0,0,51,165],6,18),picket:sample([64,23,49,137],4,14),rail,side};
}
function makeStamp(kit:FenceKit,mask:number):FenceStamp{
    const parts=[canvas(TILE,HEIGHT),canvas(TILE,HEIGHT),canvas(TILE,HEIGHT)];
    const [back,middle,front]=parts.map(image=>image.getContext('2d')!);
    if(mask&1){back.drawImage(kit.side,9,TOP-10);back.drawImage(kit.side,13,TOP-4);}
    if(mask&4){front.drawImage(kit.side,9,TOP+2);front.drawImage(kit.side,13,TOP+8);}
    for(const [bit,x,picketX]of [[8,0,4],[2,12,16]])if(mask&bit){
        middle.drawImage(kit.rail,x,TOP+3);middle.drawImage(kit.rail,x,TOP+9);
        const endCap=bit===8?(mask&16):(mask&32);
        middle.drawImage(kit.picket,endCap?(bit===8?0:20):picketX,TOP+1);
    }
    middle.drawImage(kit.post,9,TOP-3);

    // Each visible pixel belongs to exactly one component. Upright posts win
    // overlaps and keep a fixed depth when neighbors are added. Three cached
    // draws per tile at most, with no fractional destination pixels.
    const inputs=parts.map(image=>image.getContext('2d')!.getImageData(0,0,TILE,HEIGHT));
    const visible=inputs.map(()=>new Uint8ClampedArray(TILE*HEIGHT*4));
    const image=canvas(TILE,HEIGHT),ctx=image.getContext('2d')!,output=ctx.createImageData(TILE,HEIGHT);
    for(let i=0;i<output.data.length;i+=4){
        const owner=inputs[1].data[i+3]?1:inputs[2].data[i+3]?2:inputs[0].data[i+3]?0:-1;
        if(owner<0)continue;
        const pixel=inputs[owner].data.subarray(i,i+4);output.data.set(pixel,i);visible[owner].set(pixel,i);
    }
    ctx.putImageData(output,0,0);
    const depths=[6,15,24],layers:FenceLayer[]=[];
    for(let part=0;part<3;part++){
        let left=TILE,right=-1,top=HEIGHT,bottom=-1;
        const pixels=visible[part];
        for(let y=0;y<HEIGHT;y++)for(let x=0;x<TILE;x++)if(pixels[(y*TILE+x)*4+3]){
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        }
        if(right<left)continue;
        const width=right-left+1,height=bottom-top+1,layer=canvas(width,height),lc=layer.getContext('2d')!,data=lc.createImageData(width,height);
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
            const source=((y+top)*TILE+x+left)*4;data.data.set(pixels.subarray(source,source+4),(y*width+x)*4);
        }
        lc.putImageData(data,0,0);
        layers.push({image:layer,sx:0,sy:0,sourceWidth:width,sourceHeight:height,width,height,x:left,y:top-TOP,depth:depths[part]/TILE});
    }
    return{image,layers};
}
function fenceStamp(art:Atlas,mask:number){
    let cache=caches.get(art);
    if(!cache){cache={kit:fenceKit(art.fence),stamps:new Map()};caches.set(art,cache);}
    let stamp=cache.stamps.get(mask);
    if(!stamp){stamp=makeStamp(cache.kit,mask);cache.stamps.set(mask,stamp);}
    return stamp;
}
export function connectedFenceLayers(art:Atlas,buildings:Buildings,b:Building,rules=1):readonly FenceLayer[]{
    return fenceStamp(art,fenceMask(buildings,b.x,b.y,floorLevel(b),rules)).layers;
}
export function drawFenceLayer(ctx:CanvasRenderingContext2D,part:FenceLayer,b:Building,ox:number,oy:number){
    ctx.drawImage(part.image,Math.round(b.x*TILE+ox+part.x),Math.round(b.y*TILE+oy+part.y));
}
export function drawConnectedFence(ctx:CanvasRenderingContext2D,art:Atlas,buildings:Buildings,b:Building,ox:number,oy:number,rules=1){
    ctx.drawImage(fenceStamp(art,fenceMask(buildings,b.x,b.y,floorLevel(b),rules)).image,Math.round(b.x*TILE+ox),Math.round(b.y*TILE+oy-TOP));
}
