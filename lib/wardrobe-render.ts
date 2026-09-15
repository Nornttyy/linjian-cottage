import {colorHex,type Appearance,type DyePart} from './appearance';
import type {Atlas,Direction,Sprite} from './art';
import type {Pixels,Region} from './hero-appearance';
import {WEARABLES} from './wardrobe';
type Masks={masks:Partial<Record<DyePart,number[]>>;shirt?:Region;pants?:Region;head?:Region;face?:Region;pelvis?:{x:number;y:number};headVisible?:boolean;protectedPixels?:number[]};
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function tint(data:Uint8ClampedArray,k:number,color:string,base=170){const shade=Math.max(.45,Math.min(1.3,(data[k]*.22+data[k+1]*.55+data[k+2]*.23)/base));for(let c=0;c<3;c++)data[k+c]=Math.round(Math.min(255,parseInt(color.slice(1+c*2,3+c*2),16)*shade));}
export function wardrobePose(frame:Sprite,parts:Masks,w:number){
    const {head,pants}=parts;if(!head||!pants)return;
    const u=w/128,quantile=(v:number[],q:number)=>v[Math.floor((v.length-1)*q)];
    const xs=pants.points.map(i=>i%w).sort((a,b)=>a-b),ys=pants.points.map(i=>Math.floor(i/w)).sort((a,b)=>a-b);
    // Centre between the two legs; a median x would jump to the visible leg
    // whenever a hand or tool covers the other one.
    const pc=parts.pelvis??{x:(quantile(xs,.1)+quantile(xs,.9))/2,y:quantile(ys,.5)};
    const hc={x:head.x+head.width/2,y:head.y+Math.min(11*u,head.height*.4)};
    let angle=0;
    if(frame.startsWith('sleep-')||frame.startsWith('dodge-'))angle=Math.atan2(pc.y-hc.y,pc.x-hc.x)-Math.PI/2;
    // Attach at the pelvis mass. The topmost blue pixel may be a cuff, an
    // outline or a tool crossing the waist and is not a stable joint.
    const hip={x:pc.x+Math.sin(angle)*4*u,y:pc.y-Math.cos(angle)*4*u};
    return {hip,hc,angle};
}
/** Headwear is the only separate accessory; outfits are complete authored bodies. */
export function composeWardrobe(ctx:CanvasRenderingContext2D,art:Atlas,original:Pixels,a:Appearance,frame:Sprite,parts:Masks){
    if(!a.headwear||parts.headVisible===false)return;
    const pose=wardrobePose(frame,parts,original.width);if(!pose)return;
    const {hc,angle}=pose,w=original.width,h=original.height,u=w/128;
    const direction=(frame.match(/-(down|up|right)-/)?.[1]??'down') as Direction;
    const skin=new Set(parts.masks.skin??[]),hair=new Set(parts.masks.hair??[]);
    if(a.headwear){
        const item=WEARABLES.find(item=>item.id===a.headwear&&item.slot==='headwear');if(!item)return;
        const hat=art[`wardrobe-headwear-${item.row}-${direction}`];
        const layer=canvas(w,h),lc=layer.getContext('2d')!;lc.imageSmoothingEnabled=false;
        lc.translate(hc.x,hc.y);lc.rotate(angle);
        const width=[32,34,23,27][item.row]*u,height=[29,30,12,17][item.row]*u;
        const y=[-19,-29,0,-17][item.row]*u;
        lc.drawImage(hat,-width/2,y,width,height);
        const pixels=lc.getImageData(0,0,w,h);
        for(let k=3;k<pixels.data.length;k+=4)pixels.data[k]=pixels.data[k]>=128?255:0;
        if(a.headwearColor)for(let k=0;k<pixels.data.length;k+=4){const[r,g,b,alpha]=pixels.data.subarray(k,k+4);if(alpha>=128&&Math.max(r,g,b)-Math.min(r,g,b)>25)tint(pixels.data,k,colorHex(a.headwearColor),160);}
        if(item.row===0){
            // Hood surrounds the existing head; its opaque lining cannot cover
            // the player's face or replace their hair with a painted oval.
            for(const i of [...hair,...skin])pixels.data[i*4+3]=0;
        }
        lc.setTransform(1,0,0,1,0,0);lc.putImageData(pixels,0,0);ctx.drawImage(layer,0,0);
    }
    if(parts.protectedPixels?.length){
        const final=ctx.getImageData(0,0,w,h);
        for(const i of parts.protectedPixels)final.data.set(original.data.subarray(i*4,i*4+4),i*4);
        ctx.putImageData(final,0,0);
    }
}
