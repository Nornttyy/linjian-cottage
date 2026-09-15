import {colorHex,appearanceKey,normalizeAppearance,type Appearance,type ClothingColor,type DyePart} from './appearance';
import type {Atlas,Sprite} from './art';
import {composeWardrobe} from './wardrobe-render';
import {femaleDyeRegistrations,type DyeRegistration} from './female-art-layout';
export type Pixels={data:Uint8ClampedArray;width:number;height:number};
export type Region={points:number[];x:number;y:number;width:number;height:number};
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
    let upperCan:Region|undefined;
    const toolPixel=(i:number)=>{
        if(!water)return false;
        if(water[1]==='up'&&upperCan){const x=i%p.width,y=Math.floor(i/p.width);return x>=upperCan.x-1&&x<=upperCan.x+upperCan.width&&y>=upperCan.y-1&&y<=upperCan.y+upperCan.height;}
        const x=i%p.width*128/p.width*(registration?.scale??1)+(registration?.x??0),y=Math.floor(i/p.width)*128/p.height*(registration?.scale??1)+(registration?.y??0);
        if(water[1]==='down')return frontCan[pose].some(([x0,y0,x1,y1])=>x>=x0&&x<x1&&y>=y0&&y<y1);
        return water[1]==='right'&&x>=[66,70,70,68,67,68,65,65][pose]&&y<83;
    };
    // Find both masks before writing either color: blue shirts must never be
    // reclassified as pants during the same recolor operation.
    const garments=([['shirt',false],['pants',true]] as const).map(([part,isPants])=>({part,isPants,parts:regions(p,(r,g,b,i)=>{
        const split=appearance.body==='female'?(b-r)*.23:25;
        return !toolPixel(i)&&g>r*1.22&&b>r*1.3&&g>32&&(isPants?b-g>split:b-g<=split&&b-g>-35);
    })}));
    if(water?.[1]==='up')upperCan=regions(p,(r,g,b,i)=>i%p.width>p.width*.55&&Math.floor(i/p.width)<p.height*.59&&b>r*1.25&&b-g>20&&g>60)[0];
    const shirt=garments[0].parts[0];let pants=garments[1].parts[0];
    const masks:Partial<Record<DyePart,number[]>>={};
    for(const {part,isPants,parts}of garments){
        const main=parts[0];if(!main)continue;
        // Sleeves and the two trouser legs can be disconnected by skin, belt or
        // outlines. Include their nearby components, not just the largest one.
        const selected=parts.filter(r=>r===main||(!isPants&&r.points.length>=3&&Math.hypot(Math.max(0,main.x-r.x-r.width,r.x-main.x-main.width),Math.max(0,main.y-r.y-r.height,r.y-main.y-main.height))<12*p.width/128)||r.points.length>=4&&
            (water&&isPants?Math.abs(r.y+r.height-main.y-main.height)<=3:
                r.x+r.width>=main.x-main.width*.35&&r.x<=main.x+main.width*1.35&&r.y+r.height>=main.y&&r.y<=main.y+main.height));
        masks[part]=selected.flatMap(r=>r.points).filter(i=>!toolPixel(i));
    }
    const unit=p.width/128,lying=frame?.startsWith('sleep-')||frame?.startsWith('dodge-');
    if(pants&&!lying&&!water){
        // Blue shadows on raised sleeves are still part of the shirt. Hue alone
        // cannot assign them to trousers; their pose relative to the waist does.
        const upper=garments[1].parts.filter(r=>r.y+r.height/2<pants.y-3*unit&&r.y+r.height>pants.y-35*unit&&Math.abs(r.x+r.width/2-pants.x-pants.width/2)<22*unit).flatMap(r=>r.points);
        const upperSet=new Set(upper);masks.shirt=[...new Set([...(masks.shirt??[]),...upper])];masks.pants=masks.pants?.filter(i=>!upperSet.has(i));
    }
    // Grow each material from its identified core into pale highlights and dark
    // seams. Stop at skin, tools and the other garment, not at an arbitrary RGB.
    const shirtSet=new Set(masks.shirt??[]),pantsSet=new Set(masks.pants??[]);
    for(const [part,selected,other]of [['shirt',shirtSet,pantsSet],['pants',pantsSet,shirtSet]] as const){
        const queue=[...selected];for(let q=0;q<queue.length;q++){
            const i=queue[q],x=i%p.width,y=Math.floor(i/p.width);
            for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
                const xx=x+dx,yy=y+dy,n=yy*p.width+xx;if(xx<0||xx>=p.width||yy<0||yy>=p.height||selected.has(n)||other.has(n)||toolPixel(n))continue;
                const [r,g,b,a]=p.data.subarray(n*4,n*4+4);
                if(a>=128&&g>r*1.06&&b>r*1.12&&g>24&&b-g>-50){selected.add(n);queue.push(n);}
            }
        }masks[part]=[...selected];
    }
    if(masks.pants?.length){
        const points=masks.pants,xs=points.map(i=>i%p.width),ys=points.map(i=>Math.floor(i/p.width)),x=Math.min(...xs),y=Math.min(...ys);
        pants={points,x,y,width:Math.max(...xs)-x+1,height:Math.max(...ys)-y+1};
    }
    let face:Region|undefined;
    const w=p.width,warm=(r:number,g:number,b:number)=>r>g*1.08&&g>b*1.1;
    const hairParts=regions(p,(r,g,b)=>warm(r,g,b)&&g<150&&r<225);
    // The hair mass identifies the head even when a raised sleeve sits above it,
    // or the whole character lies sideways. Thin wooden handles are excluded.
    const candidates=hairParts.filter(r=>r.width>=4*unit&&r.height>=2*unit&&r.width>r.height*.3&&(!pants||lying||r.y+r.height/2<pants.y-9*unit));
    if(!lying&&pants)candidates.sort((a,b)=>Math.hypot(a.x+a.width/2-pants.x-pants.width/2,a.y+a.height/2-(pants.y-26*unit))-Math.hypot(b.x+b.width/2-pants.x-pants.width/2,b.y+b.height/2-(pants.y-26*unit)));
    const head=candidates[0];
    if(head){
        masks.hair=hairParts.filter(r=>r===head||r.points.length>=3&&r.x+r.width>head!.x-2*unit&&r.x<head!.x+head!.width+2*unit&&r.y+r.height>head!.y&&r.y<head!.y+head!.height).flatMap(r=>r.points);
        const skins=regions(p,(r,g,b,i)=>!toolPixel(i)&&r>175&&g>115&&b>65&&r>=g*.99&&g>=b*.96&&r-b>15&&!(r-g>55&&g-b>50));
        const hx=head.x+head.width/2,hy=head.y+head.height/2;
        face=skins.filter(r=>Math.hypot(r.x+r.width/2-hx,r.y+r.height/2-hy)<22*unit&&r.points.length>=8).sort((a,b)=>Math.hypot(a.x+a.width/2-hx,a.y+a.height/2-hy)-Math.hypot(b.x+b.width/2-hx,b.y+b.height/2-hy))[0];
        masks.skin=skins.filter(r=>r===face||r.points.length>=4&&r.width<14*unit&&r.height<14*unit).flatMap(r=>r.points);
        masks.eyes=[];
        if(face&&!frame?.includes('-up-'))for(let y=Math.ceil(face.y+face.height*.12);y<face.y+face.height*.72;y++)for(let x=face.x;x<face.x+face.width;x++){
            const i=y*w+x,k=i*4,[r,g,b,a]=p.data.subarray(k,k+4);
            const lightNeighbors=[i-1,i+1,i-w,i+w].filter(n=>p.data[n*4]>175&&p.data[n*4+1]>130&&p.data[n*4+2]>80).length;
            if(a>128&&r<150&&g<110&&b<100&&lightNeighbors>=2)masks.eyes.push(i);
        }
        masks.hair=masks.hair.filter(i=>!masks.eyes!.includes(i));
        if(pants){
            const px=pants.x+pants.width/2,py=pants.y+pants.height/2,dx=px-hx,dy=py-hy,len=Math.hypot(dx,dy)||1;
            masks.shoes=regions(p,(r,g,b)=>warm(r,g,b)).filter(r=>r.points.length>=4&&((r.x+r.width/2-px)*dx+(r.y+r.height/2-py)*dy)/len>2*unit&&Math.hypot(r.x+r.width/2-px,r.y+r.height/2-py)<24*unit).flatMap(r=>r.points);
        }
        if(shirt)masks.trim=regions(p,(r,g,b,i)=>{const x=i%w,y=Math.floor(i/w);return warm(r,g,b)&&pants&&x>=pants.x-2*unit&&x<pants.x+pants.width+2*unit&&y>=pants.y-4*unit&&y<pants.y+2*unit;}).filter(r=>r.width>r.height*1.8).flatMap(r=>r.points);
    }
    if(head){
        const rawHands=regions(p,(r,g,b,i)=>!toolPixel(i)&&r>175&&g>115&&b>65&&r>=g*.99&&g>=b*.96&&r-b>15);
        const added=rawHands.filter(r=>r.points.length>=4&&r.width<14*unit&&r.height<14*unit&&!(r.x>=head.x-2*unit&&r.x+r.width<=head.x+head.width+2*unit&&r.y>=head.y-2*unit&&r.y+r.height<=head.y+head.height+5*unit)&&r.points.some(i=>[i-1,i+1,i-w,i+w,i-2,i+2,i-w*2,i+w*2].some(n=>shirtSet.has(n)))).flatMap(r=>r.points);
        masks.skin=[...new Set([...(masks.skin??[]),...added])];
        const skinSet=new Set(masks.skin),hairSet=new Set(masks.hair??[]),queue=[...hairSet];
        for(let q=0;q<queue.length;q++)for(const n of [queue[q]-1,queue[q]+1,queue[q]-w,queue[q]+w]){
            const x=n%w,y=Math.floor(n/w);if(n<0||n>=w*p.height||hairSet.has(n)||skinSet.has(n)||x<head.x-1||x>=head.x+head.width+1||y<head.y||y>=head.y+head.height)continue;
            if(face&&x>=face.x-1&&x<=face.x+face.width&&y>=face.y-1&&y<=face.y+face.height)continue;
            const[r,g,b,a]=p.data.subarray(n*4,n*4+4);if(a>=128&&r>g*1.06&&g>b*1.04){hairSet.add(n);queue.push(n);}
        }
        masks.hair=[...hairSet].filter(i=>!skinSet.has(i)&&!masks.eyes?.includes(i));
    }
    if(head&&appearance.body==='female')masks.trim=[...(masks.trim??[]),...regions(p,(r,g,b,i)=>r>140&&r>g*1.2&&b>g*1.1&&i%w>=head.x&&i%w<head.x+head.width&&Math.floor(i/w)>=head.y&&Math.floor(i/w)<head.y+head.height).flatMap(r=>r.points)];
    function paint(i:number,color:ClothingColor,base:number){
        const hex=colorHex(color),target=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),k=i*4,d=p.data;
        const shade=Math.max(.4,Math.min(1.3,(d[k]*.22+d[k+1]*.55+d[k+2]*.23)/base));
        for(let c=0;c<3;c++)d[k+c]=Math.max(0,Math.min(255,Math.round(target[c]*shade)));
    }
    const bases={shirt:168,pants:153,hair:100,skin:205,eyes:80,shoes:110,trim:125};
    for(const part of Object.keys(bases) as (keyof typeof bases)[]){const color=appearance[part];if(!color||color==='original')continue;for(const i of masks[part]??[])paint(i,color,bases[part]);}
    return {masks,shirt,pants,head,face};
}
const caches=new WeakMap<Atlas,Map<string,HTMLCanvasElement>>();
/** Female and male bodies each have complete independently authored animation atlases. */
export function dressedHero(art:Atlas,frame:Sprite,value?:Appearance):HTMLCanvasElement{
    const a=normalizeAppearance(value),source=art[a.body==='female'?`female-${frame}` as Sprite:frame];
    if(!source)throw Error('角色动作素材缺失：'+a.body+' '+frame);
    if(a.shirt==='original'&&a.pants==='original'&&!a.hair&&!a.skin&&!a.eyes&&!a.shoes&&!a.trim&&!a.headwear&&!a.outfit)return source;
    let cache=caches.get(art);if(!cache){cache=new Map();caches.set(art,cache);}
    const key=frame+':'+appearanceKey(a),found=cache.get(key);if(found)return found;
    const out=document.createElement('canvas');out.width=source.width;out.height=source.height;
    const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0);
    const pixels=ctx.getImageData(0,0,out.width,out.height);
    const original=ctx.getImageData(0,0,out.width,out.height);
    const regions=recolorClothes(pixels,a,frame,femaleDyeRegistrations.get(source));ctx.putImageData(pixels,0,0);
    if(a.headwear||a.outfit)composeWardrobe(ctx,art,original,a,frame,regions);
    // Bound memory when a user previews many different outfits in one session.
    if(cache.size>=768)cache.delete(cache.keys().next().value!);cache.set(key,out);return out;
}
