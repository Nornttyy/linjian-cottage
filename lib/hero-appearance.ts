import {CLOTHING_COLORS,appearanceKey,normalizeAppearance,type Appearance,type ClothingColor} from './appearance';
import type {Atlas,Sprite} from './art';
import {femaleDyeRegistrations,type DyeRegistration} from './female-art-layout';
type Pixels={data:Uint8ClampedArray;width:number;height:number};
type Region={points:number[];x:number;y:number;width:number;height:number};
function regions(p:Pixels,accept:(r:number,g:number,b:number,i:number)=>boolean):Region[]{
    const {width:w,height:h,data:d}=p,seen=new Uint8Array(w*h),result:Region[]=[];
    for(let k=0;k<w*h;k++){
        if(seen[k]||d[k*4+3]<128||!accept(d[k*4],d[k*4+1],d[k*4+2],k))continue;
        let x0=w,y0=h,x1=0,y1=0;const q=[k];seen[k]=1;
        for(let j=0;j<q.length;j++){
            const i=q[j],x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
                const xx=x+dx,yy=y+dy,n=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||seen[n])continue;
                if(d[n*4+3]>=128&&accept(d[n*4],d[n*4+1],d[n*4+2],n)){seen[n]=1;q.push(n);}
            }
        }
        result.push({points:q,x:x0,y:y0,width:x1-x0+1,height:y1-y0+1});
    }
    return result.sort((a,b)=>b.points.length-a.points.length);
}
// Reviewed tool silhouettes in the 128px registered action frames. The blue
// can touches the blue trousers, so connected color alone cannot separate it.
const frontCan=[
    [[58,68,72,85],[71,70,80,79]],[[59,67,74,84],[72,69,83,78]],
    [[60,68,75,86],[74,70,84,80]],[[61,68,77,85],[76,73,89,82]],
    [[58,70,75,88],[73,79,85,90]],[[58,70,75,88],[73,79,85,90]],
    [[57,68,72,85],[70,70,81,79]],[[58,68,73,85],[71,70,82,79]]
];
export function recolorClothes(p:Pixels,appearance:Appearance,frame?:Sprite,registration?:DyeRegistration){
    const water=frame?.match(/^water-(down|up|right)-(\d+)$/),pose=water?Number(water[2])%8:0;
    const toolPixel=(i:number)=>{
        if(!water)return false;
        const x=i%p.width*128/p.width*(registration?.scale??1)+(registration?.x??0),y=Math.floor(i/p.width)*128/p.height*(registration?.scale??1)+(registration?.y??0);
        if(water[1]==='down')return frontCan[pose].some(([x0,y0,x1,y1])=>x>=x0&&x<x1&&y>=y0&&y<y1);
        return water[1]==='right'&&x>=[66,70,70,68,67,68,65,65][pose]&&y<83;
    };
    // Find both masks before writing either color: blue shirts must never be
    // reclassified as pants during the same recolor operation.
    const garments=([['shirt',false],['pants',true]] as const).map(([part,isPants])=>({part,isPants,parts:regions(p,(r,g,b,i)=>{
        const split=appearance.body==='female'?(b-r)*.23:25;
        return !toolPixel(i)&&g>r*1.22&&b>r*1.3&&g>55&&(isPants?b-g>split:b-g<=split&&b-g>-35);
    })}));
    for(const {part,isPants,parts}of garments){
        const color:ClothingColor=appearance[part];if(color==='original')continue;
        const hex=CLOTHING_COLORS[color].color,target=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
        const main=parts[0];if(!main)continue;
        const selected=water&&isPants?parts.filter(r=>r.points.length>=4&&Math.abs(r.y+r.height-main.y-main.height)<=3):[main];
        // Only the connected garment is dyed: detached fishing catches, steel
        // tools, watering cans and splashes keep their original colors.
        for(const region of selected)for(const i of region.points){const k=i*4,d=p.data,shade=(d[k]*.15+d[k+1]*.55+d[k+2]*.30)/(isPants?153:168);
            for(let c=0;c<3;c++)d[k+c]=Math.max(0,Math.min(255,Math.round(target[c]*shade)));
        }
    }
}
const caches=new WeakMap<Atlas,Map<string,HTMLCanvasElement>>();
/** Female and male bodies each have complete independently authored animation atlases. */
export function dressedHero(art:Atlas,frame:Sprite,value?:Appearance):HTMLCanvasElement{
    const a=normalizeAppearance(value),source=art[a.body==='female'?`female-${frame}` as Sprite:frame];
    if(!source)throw Error('角色动作素材缺失：'+a.body+' '+frame);
    if(a.shirt==='original'&&a.pants==='original')return source;
    let cache=caches.get(art);if(!cache){cache=new Map();caches.set(art,cache);}
    const key=frame+':'+appearanceKey(a),found=cache.get(key);if(found)return found;
    const out=document.createElement('canvas');out.width=source.width;out.height=source.height;
    const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0);
    const pixels=ctx.getImageData(0,0,out.width,out.height);
    recolorClothes(pixels,a,frame,femaleDyeRegistrations.get(source));ctx.putImageData(pixels,0,0);
    // Bound memory when a user previews many different outfits in one session.
    if(cache.size>=768)cache.delete(cache.keys().next().value!);cache.set(key,out);return out;
}
