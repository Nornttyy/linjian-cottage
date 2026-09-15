import {colorHex,type Appearance,type DyePart} from './appearance';
import type {Atlas,Sprite} from './art';
import {recolorClothes,type Pixels,type Region} from './hero-appearance';
import {femaleDyeRegistrations} from './female-art-layout';
import {BODY_IDLE_POSES,bodyIdlePose,fullBodyKey,type FULL_BODY_SHEETS,type BodyFamily} from './full-body-layout';
import {fishingRod} from './hero-fishing-art';

type Parts=ReturnType<typeof recolorClothes>;
export type CompleteBody={family:BodyFamily;parts:Parts;rodTip?:readonly [number,number]};
export const completeBodies=new WeakMap<HTMLCanvasElement,CompleteBody>();
const frameCaches=new WeakMap<Atlas,Map<string,HTMLCanvasElement>>();
const guides=new WeakMap<HTMLCanvasElement,Parts>();
const pixels=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height);
const canvas=()=>{const c=document.createElement('canvas');c.width=128;c.height=128;return c;};
function guide(base:HTMLCanvasElement,frame:Sprite,body:Appearance['body']){
    let found=guides.get(base);if(!found){
        const p=pixels(base);found=recolorClothes(p,{body,shirt:'original',pants:'original'},frame,femaleDyeRegistrations.get(base));
        if(/^(plant|cook|eat|pickup)-/.test(frame)){
            const excluded=new Set([...(found.masks.hair??[]),...(found.masks.shoes??[]),...(found.masks.trim??[])]),extra:number[]=[];
            for(let i=0;i<p.width*p.height;i++){
                const y=i/p.width|0,[r,g,b,a]=p.data.subarray(i*4,i*4+4);
                if(a<128||excluded.has(i)||found.head&&y<found.head.y+found.head.height-2||found.pants&&y>found.pants.y+12&&!frame.startsWith('pickup-'))continue;
                if(heldColour(frame,r,g,b))extra.push(i);
            }
            found.protectedPixels=[...new Set([...found.protectedPixels,...extra])];
        }
        guides.set(base,found);
    }return found;
}
function heldColour(frame:Sprite,r:number,g:number,b:number){
    if(frame.startsWith('eat-'))return r>g*1.8&&g>b*1.25||g>r*1.2&&g>b*1.4;
    if(frame.startsWith('pickup-'))return b>g*1.12&&r>g*1.05||Math.max(r,g,b)-Math.min(r,g,b)<20&&r>95;
    if(frame.startsWith('harvest-'))return g>r*1.2&&g>b*1.25||r>g*1.4&&g>b*1.6;
    return r>g*1.03&&g>b*1.4&&(r-g>50||g-b>75)||g>r*1.2&&g>b*1.4;
}
function box(points:number[],w=128):Region|undefined{
    if(!points.length)return;
    let x=w,y=w,right=0,bottom=0;
    for(const i of points){x=Math.min(x,i%w);y=Math.min(y,i/w|0);right=Math.max(right,i%w);bottom=Math.max(bottom,i/w|0);}
    return {points,x,y,width:right-x+1,height:bottom-y+1};
}
function hairColour(r:number,g:number,b:number){return r>g*1.15&&g>b*1.18&&g<195&&r>40;}
function hairRegion(p:Pixels,reference:Region|undefined,tool:Uint8Array,family:BodyFamily){
    const d=p.data,w=p.width,seen=new Uint8Array(w*p.height),groups:Region[]=[];
    const cx=reference?reference.x+reference.width/2:64,cy=reference?reference.y+reference.height/2:48;
    const hair=(i:number)=>{const k=i*4,x=i%w,y=i/w|0;return Math.abs(x-cx)<=20&&Math.abs(y-cy)<=18&&!(tool[i]<=3&&y<cy-3)&&!(family==='mushroom'&&d[k]>160&&d[k]>d[k+1]*2)&&d[k+3]>=128&&hairColour(d[k],d[k+1],d[k+2]);};
    for(let start=0;start<seen.length;start++){
        if(seen[start]||!hair(start))continue;
        const q=[start];seen[start]=1;
        for(let j=0;j<q.length;j++){const i=q[j],x=i%w,y=i/w|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
            const xx=x+dx,yy=y+dy,n=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<p.height&&!seen[n]&&hair(n)){seen[n]=1;q.push(n);}
        }}const b=box(q,w);if(b&&b.points.length>=4&&b.width>=3&&b.height>=2&&b.width>b.height*.3&&b.width<b.height*5)groups.push(b);
    }
    const near=groups.filter(g=>Math.abs(g.x+g.width/2-cx)<18&&Math.abs(g.y+g.height/2-cy)<16);
    near.sort((a,b)=>Math.hypot(a.x+a.width/2-cx,a.y+a.height/2-cy)-Math.sqrt(a.points.length)*2.2-(Math.hypot(b.x+b.width/2-cx,b.y+b.height/2-cy)-Math.sqrt(b.points.length)*2.2));
    const main=near[0];if(!main)return;
    return box(near.filter(g=>g===main||Math.abs(g.y+g.height/2-main.y-main.height/2)<9&&Math.hypot(Math.max(0,main.x-g.x-g.width,g.x-main.x-main.width),Math.max(0,main.y-g.y-g.height,g.y-main.y-main.height))<5).flatMap(g=>g.points),w);
}
export function completeBodyScale(raw:HTMLCanvasElement,base:HTMLCanvasElement,frame:Sprite,body:Appearance['body']){
    const source=bodyAnchor(pixels(raw)),target=bodyAnchor(pixels(base));
    return Math.max(.45,Math.min(1.35,(target.bottom-target.top+1)/(source.bottom-source.top+1)));
}
function bodyAnchor(p:Pixels){
    let top=128,bottom=0;const feet:number[]=[];
    for(let y=0;y<128;y++){let count=0;for(let x=54;x<74;x++)if(p.data[(y*128+x)*4+3]>=128)count++;if(count>=5){top=y;break;}}
    for(let y=Math.max(0,top+20);y<128;y++)for(let x=34;x<94;x++){
        const k=(y*128+x)*4,r=p.data[k],g=p.data[k+1],b=p.data[k+2];
        if(p.data[k+3]>=128&&r>=g&&g>b*1.02)bottom=Math.max(bottom,y);
    }
    for(let y=Math.max(top,bottom-3);y<=bottom;y++)for(let x=34;x<94;x++){
        const k=(y*128+x)*4;if(p.data[k+3]>=128&&p.data[k]>=p.data[k+1]&&p.data[k+1]>p.data[k+2]*1.02)feet.push(x);
    }
    feet.sort((a,b)=>a-b);return {top:Math.min(top,96),bottom:Math.max(bottom,top+10),x:feet.length?(feet[Math.floor(feet.length*.1)]+feet[Math.floor(feet.length*.9)])/2:64};
}
function distances(points:number[]|undefined,w=128,h=128){
    const out=new Uint8Array(w*h);out.fill(255);const queue=new Int32Array(w*h);let end=0;
    for(const i of points??[])if(i>=0&&i<out.length&&out[i]){out[i]=0;queue[end++]=i;}
    for(let j=0;j<end;j++){const i=queue[j],v=out[i]+1;if(v>32)continue;for(const n of [i%w?i-1:-1,i%w<w-1?i+1:-1,i>=w?i-w:-1,i<out.length-w?i+w:-1])if(n>=0&&out[n]>v){out[n]=v;queue[end++]=n;}}
    return out;
}
function regions(p:Pixels,accept:(i:number)=>boolean){
    const seen=new Uint8Array(p.width*p.height),out:Region[]=[];
    for(let start=0;start<seen.length;start++)if(!seen[start]&&accept(start)){
        const q=[start];seen[start]=1;
        for(let j=0;j<q.length;j++){const i=q[j],x=i%p.width,y=i/p.width|0;
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
                const xx=x+dx,yy=y+dy,n=yy*p.width+xx;
                if(xx>=0&&xx<p.width&&yy>=0&&yy<p.height&&!seen[n]&&accept(n)){seen[n]=1;q.push(n);}
            }
        }out.push(box(q,p.width)!);
    }return out;
}
/** Material ownership is calculated once on the original full-body frame,
 * before any user-selected colours are applied. Changing a dye cannot change
 * another material's mask or the authored silhouette. */
export function completeBodyParts(p:Pixels,reference:Parts,family:BodyFamily,frame:Sprite):Parts{
    const d=p.data,w=p.width,masks:Partial<Record<DyePart,number[]>>={},protectedPixels:number[]=[];
    const distance=Object.fromEntries(['hair','skin','eyes','shirt','pants','shoes','trim'].map(k=>[k,distances(reference.masks[k as DyePart])])) as Record<string,Uint8Array>;
    const tool=distances(reference.protectedPixels),head=hairRegion(p,reference.head,tool,family)??reference.head;
    const skinRegions=regions(p,i=>{const k=i*4,r=d[k],g=d[k+1],b=d[k+2];return d[k+3]>=128&&r>195&&g>135&&b>65&&r>=g*.985&&g>=b*.98&&r-g<65;});
    const anchor=reference.face&&reference.head&&reference.face.y>=reference.head.y?reference.face:reference.head;
    const fx=anchor?anchor.x+anchor.width/2:64,fy=anchor?anchor.y+anchor.height/2:54;
    const faces=!frame.includes('-up-')?skinRegions.filter(b=>b.width<=22&&b.height<=20&&b.points.length>=8&&Math.abs(b.x+b.width/2-fx)<14&&Math.abs(b.y+b.height/2-fy)<14):[];
    const faceScore=(b:Region)=>Math.hypot(b.x+b.width/2-fx,b.y+b.height/2-fy)-Math.sqrt(b.points.length)*.6;
    faces.sort((a,b)=>faceScore(a)-faceScore(b));
    let face:Region|undefined=faces[0],faceShape:Set<number>|undefined;
    if(face){
        const selected=new Set(face.points),queue=[...selected];
        for(let j=0;j<queue.length;j++)for(const n of [queue[j]-1,queue[j]+1,queue[j]-w,queue[j]+w]){
            const x=n%w,y=n/w|0;if(n<0||n>=w*p.height||selected.has(n)||Math.abs(x-fx)>13||Math.abs(y-fy)>12)continue;
            const k=n*4,r=d[k],g=d[k+1],b=d[k+2];
            if(d[k+3]>=128&&r>195&&g>135&&b>65&&r>=g*.985&&g>=b*.98&&r-g<65){selected.add(n);queue.push(n);}
        }
        const grown=box(queue,w)!;if(grown.width<=24&&grown.height<=22)face=grown;
    }
    if(family==='snow'&&!frame.includes('-up-')){
        // Snow cloth and facial highlights share cream paint. Use the small
        // dark eye marks to delimit the face, rather than flooding the coat.
        const eyes=regions(p,i=>{
            const x=i%w,y=i/w|0,k=i*4;
            return Math.abs(x-fx)<13&&Math.abs(y-fy)<12&&d[k+3]>=128&&d[k]<115&&d[k+1]<85&&d[k+2]<75&&d[k]>=d[k+1]*1.05&&d[k+1]>=d[k+2]*.95&&[i-1,i+1,i-w,i+w].filter(n=>d[n*4]>205&&d[n*4+1]>155&&d[n*4+2]>85).length>=2;
        }).filter(b=>b.width<=4&&b.height<=5&&b.points.length<=10);
        const eyeScore=(b:Region)=>Math.hypot(b.x+b.width/2-fx,(b.y+b.height/2-fy+3)*1.4)-b.points.length*.5;
        eyes.sort((a,b)=>eyeScore(a)-eyeScore(b));
        const first=eyes[0];if(first){
            const ax=first.x+first.width/2,ay=first.y+first.height/2;
            const second=eyes.find(b=>b!==first&&Math.abs(b.y+b.height/2-ay)<2.5&&Math.abs(b.x+b.width/2-ax)>=4&&Math.abs(b.x+b.width/2-ax)<=13);
            const bx=second?second.x+second.width/2:ax,cx=(ax+bx)/2,cy=ay+1,rx=second?Math.abs(ax-bx)/2+4:5.5,ry=7,points:number[]=[];
            for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(127,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(127,Math.ceil(cx+rx));x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1.1)points.push(y*w+x);
            faceShape=new Set(points);face=box(points,w);
            if(face)face.points=points.filter(i=>{const k=i*4;return d[k]>195&&d[k+1]>135&&d[k+2]>65&&d[k]>=d[k+1]*.985;});
        }
    }
    const hairPixels=new Set(head?.points??[]),hairDistance=distances(head?.points),skinPixels=new Set(face?.points??[]);
    if(reference.head&&/^(axe|pick|sword|hammer|hoe)-/.test(frame)){
        const originalSkin=new Set(reference.masks.skin??[]);
        for(const palm of regions(p,i=>originalSkin.has(i))){
            const cx=palm.x+palm.width/2,cy=palm.y+palm.height/2;
            if(palm.points.length<4||palm.width>14||palm.height>14||cy>=reference.head.y+reference.head.height*.25)continue;
            for(let y=Math.max(0,palm.y);y<Math.min(128,palm.y+palm.height);y++)for(let x=Math.max(0,palm.x);x<Math.min(128,palm.x+palm.width);x++){
                const i=y*w+x,k=i*4;if(((x-cx)/(palm.width*.5))**2+((y-cy)/(palm.height*.4))**2>1.2)continue;
                if(d[k+3]>=128&&d[k]>195&&d[k+1]>135&&d[k+2]>65&&d[k]>=d[k+1]*.985)skinPixels.add(i);
            }
        }
    }
    // Cream garment motifs are enclosed by cloth. Exposed hands form small
    // separate regions touching the silhouette; a nearby old hand coordinate
    // alone must never turn a sleeve or mushroom spot into skin.
    for(const region of skinRegions){
        if(region===face||region.width>12||region.height>13)continue;
        const exposed=region.points.some(i=>[i-1,i+1,i-w,i+w].some(n=>n>=0&&n<w*p.height&&d[n*4+3]<128));
        if(exposed&&region.points.some(i=>distance.skin[i]<=5))for(const i of region.points)skinPixels.add(i);
    }
    const isHead=(x:number,y:number)=>!!head&&x>=head.x-4&&x<head.x+head.width+4&&y>=head.y-6&&y<head.y+head.height+12;
    const assign=(part:DyePart,i:number)=>(masks[part]??=[]).push(i);
    for(let i=0;i<w*p.height;i++){
        const k=i*4,[r,g,b,a]=d.subarray(k,k+4);if(a<128)continue;
        const x=i%w,y=i/w|0,inHead=isHead(x,y),warm=r>g*1.06&&g>b*1.08;
        const cyan=g>r*1.12&&b>r*1.18,blue=b>g*1.1&&b>r*1.22;
        const paleSkin=r>170&&g>100&&b>55&&r>=g&&g>b*1.025&&r-g<105;
        const metal=b>r*1.03&&b>=g&&b-r<155&&r>80||r>165&&Math.max(r,g,b)-Math.min(r,g,b)<24;
        if(/^(plant|cook|eat|pickup|harvest)-/.test(frame)&&tool[i]<=3&&heldColour(frame,r,g,b)){protectedPixels.push(i);continue;}
        const inFace=faceShape?faceShape.has(i):face&&x>=face.x&&x<face.x+face.width&&y>=face.y&&y<face.y+face.height;
        if(inFace){
            const brightNeighbors=[i-1,i+1,i-w,i+w].filter(n=>d[n*4]>215&&d[n*4+1]>165&&d[n*4+2]>90).length;
            if(r<130&&g<105&&b<100&&brightNeighbors>=2){assign('eyes',i);continue;}
            if(paleSkin&&r>200&&g>140||r>225&&g>210&&b>170){assign('skin',i);continue;}
        }
        if(metal&&tool[i]<=12||(cyan||blue)&&tool[i]<=8&&tool[i]<Math.min(distance.shirt[i],distance.pants[i])+2||tool[i]<=4&&warm&&tool[i]<Math.min(distance.hair[i],distance.skin[i],distance.shirt[i],distance.pants[i])){protectedPixels.push(i);continue;}
        if(inHead){
            if(r>140&&r>g*1.35&&b>g*1.15){assign('trim',i);continue;}
            const backNeck=family==='swim'&&frame.includes('-up-')&&head&&y>=head.y+head.height*.65&&y<head.y+head.height&&r>215&&g>165&&r<g*1.5&&g>b*1.08;
            if(skinPixels.has(i)||inFace&&(paleSkin&&r>200&&g>140||r>225&&g>210&&b>170)||backNeck){assign('skin',i);continue;}
            if(!(family==='mushroom'&&r>160&&r>g*2)&&(hairColour(r,g,b)||Math.max(r,g,b)<105)&&(hairPixels.has(i)||hairDistance[i]<=2)){assign('hair',i);continue;}
        }
        if(family==='swim'){
            if(cyan||blue){assign(distance.shirt[i]<=distance.pants[i]?'shirt':'pants',i);continue;}
            if(warm||paleSkin||r>200&&g>185&&b>155&&r>=g&&g>=b){assign('skin',i);continue;}
            if(r>110&&r>g*1.3&&b>g*1.15){assign('trim',i);continue;}
        }else{
            if(skinPixels.has(i)){assign('skin',i);continue;}
            if(warm&&distance.shoes[i]<=4&&distance.shoes[i]<distance.skin[i]+2){assign('shoes',i);continue;}
            const inLegs=reference.pants&&y>=reference.pants.y-2&&x>=reference.pants.x-3&&x<reference.pants.x+reference.pants.width+3;
            if(blue&&inLegs){assign('pants',i);continue;}
            if(cyan&&family==='mushroom'){assign('shirt',i);continue;}
            const accent=family==='mushroom'?g>r*.67&&r>100:family==='moth'?g>r*1.1&&r>b*1.18||r>170&&g>170:family==='snow'?g>r*1.03&&g>=b*.98:warm;
            assign(accent?'outfitTrim':'outfitColor',i);continue;
        }
    }
    // Eyes and head anchors come from the matching body action, never the
    // garment bounds. A raised tool or billowing cape cannot move a hat.
    return {...reference,masks,protectedPixels,head,face};
}
export function registerCompleteBody(raw:HTMLCanvasElement,base:HTMLCanvasElement,frame:Sprite,body:Appearance['body'],family:BodyFamily,scale:number){
    const reference=guide(base,frame,body),sourcePixels=pixels(raw),basePixels=pixels(base),source=bodyAnchor(sourcePixels),target=bodyAnchor(basePixels);
    let dx=target.x-source.x*scale,dy=target.bottom-source.bottom*scale;
    if(/^(dodge|sleep)-/.test(frame)){
        const bounds=(p:Pixels)=>box(Array.from({length:128*128},(_,i)=>i).filter(i=>p.data[i*4+3]>=128))!;
        const a=bounds(sourcePixels),b=bounds(basePixels);dx=b.x+b.width/2-(a.x+a.width/2)*scale;dy=b.y+b.height/2-(a.y+a.height/2)*scale;
    }
    const out=canvas(),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(raw,Math.round(dx),Math.round(dy),Math.round(128*scale),Math.round(128*scale));
    const p=pixels(out);for(let k=3;k<p.data.length;k+=4)p.data[k]=p.data[k]>=128?255:0;ctx.putImageData(p,0,0);
    const rodTip=completeRodTip(p,frame,body),parts=completeBodyParts(p,reference,family,frame);
    completeBodies.set(out,{family,parts,rodTip});return out;
}
/** Locate the authored pole end inside the corresponding action's rod lane. */
export function completeRodTip(p:Pixels,frame:Sprite,body:Appearance['body']):readonly [number,number]|undefined{
    const rod=fishingRod(frame,body);if(!rod)return;
    const [tx,ty,gx,gy]=rod,dx=tx-gx,dy=ty-gy,length=Math.hypot(dx,dy);
    let best:readonly [number,number]=[tx,ty],score=-Infinity;
    for(let i=0;i<p.width*p.height;i++){
        const x=i%p.width,y=i/p.width|0,k=i*4,r=p.data[k],g=p.data[k+1],b=p.data[k+2];
        if(p.data[k+3]<128||r<=g*1.05||g<=b*1.07)continue;
        const along=((x-gx)*dx+(y-gy)*dy)/length,across=Math.abs((x-gx)*dy-(y-gy)*dx)/length;
        if(across>6||along<length-14||along>length+16)continue;
        const value=along-across*.6;if(value>score){score=value;best=[x,y];}
    }return best;
}
export function dyeCompleteBody(p:Pixels,a:Appearance,info:CompleteBody){
    const bases:Partial<Record<DyePart,number>>={hair:100,skin:205,eyes:80,shirt:168,pants:153,shoes:110,trim:125,outfitColor:160,outfitTrim:180};
    for(const part of Object.keys(bases) as DyePart[]){
        let color=a[part];
        if(info.family==='swim'&&(part==='shirt'||part==='pants')&&(!color||color==='original'))color=a.outfitColor??(a.outfit==='coral-swim'?'#f07d89':undefined);
        if(!color||color==='original')continue;
        const hex=colorHex(color),rgb=[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16));
        for(const i of info.parts.masks[part]??[]){const k=i*4,shade=Math.max(.25,Math.min(1.35,(p.data[k]*.22+p.data[k+1]*.55+p.data[k+2]*.23)/bases[part]!));for(let c=0;c<3;c++)p.data[k+c]=Math.min(255,Math.round(rgb[c]*shade));}
    }
}
export function loadCompleteBodySheet(art:Atlas,spec:typeof FULL_BODY_SHEETS[number],image:HTMLCanvasElement|HTMLImageElement){
    const rows=spec.actions.length*6,page=document.createElement('canvas');page.width=1024;page.height=rows*128;
    const pc=page.getContext('2d')!;pc.imageSmoothingEnabled=false;pc.drawImage(image,0,0,page.width,page.height);
    const pagePixels=pc.getImageData(0,0,page.width,page.height),occupancy=new Uint16Array(page.height);
    for(let y=0;y<page.height;y++)for(let x=0;x<page.width;x++)if(pagePixels.data[(y*page.width+x)*4+3]>=128)occupancy[y]++;
    // Authored rows can sit a few pixels above or below the nominal grid.
    // Cut in the transparent gutter so a ponytail or raised tool cannot be
    // assigned to the neighbouring action.
    const bands:{top:number;bottom:number}[]=[];
    for(let y=0;y<page.height;y++)if(occupancy[y]>8){
        const last=bands[bands.length-1];
        if(last&&y-last.bottom<=8)last.bottom=y;else bands.push({top:y,bottom:y});
    }
    const bodyRows=bands.filter(b=>b.bottom-b.top>=10);
    if(bodyRows.length!==rows)throw Error('角色动作行数不符：'+spec.file);
    const boundaries=[0];
    for(let row=1;row<rows;row++){
        const middle=(bodyRows[row-1].bottom+bodyRows[row].top)/2;
        let best=Math.round(middle),score=Infinity;
        for(let y=bodyRows[row-1].bottom+1;y<bodyRows[row].top;y++){
            const value=occupancy[y]*1000+Math.abs(y-middle);
            if(value<score){score=value;best=y;}
        }
        if(occupancy[best]>8)throw Error('角色动作行缺少透明间隔：'+spec.file+' '+row);
        boundaries.push(best);
    }
    boundaries.push(page.height);
    const columns=Array.from({length:rows},(_,row)=>{
        const counts=new Uint16Array(1024);
        for(let x=0;x<1024;x++)for(let y=boundaries[row];y<boundaries[row+1];y++)if(pagePixels.data[(y*1024+x)*4+3]>=128)counts[x]++;
        const cuts=[0];for(let col=1;col<8;col++){
            let best=col*128,score=Infinity;
            for(let x=col*128-44;x<=col*128+44;x++){const value=counts[x]*1000+Math.abs(x-col*128);if(value<score){score=value;best=x;}}
            if(counts[best]>2)throw Error('角色动作列缺少透明间隔：'+spec.file+' '+row+' '+col);
            cuts.push(best);
        }cuts.push(1024);return cuts;
    });
    let packX=0,packY=0,rowHeight=0;
    const cells=Array.from({length:rows*8},(_,index)=>{
        const row=index/8|0,col=index%8,sourceY=boundaries[row],height=boundaries[row+1]-sourceY,sourceX=columns[row][col],width=columns[row][col+1]-sourceX;
        const p=pc.getImageData(sourceX,sourceY,width,height),points:number[]=[];
        for(let i=0;i<width*height;i++)if(p.data[i*4+3]>=128)points.push(i);
        const b=box(points,width);if(!b)throw Error('完整角色动作为空：'+spec.file+' '+index);
        if(b.height>126||b.width>128)throw Error('角色动作超出单帧尺寸：'+spec.file+' '+index);
        if(packX+b.width+2>512){packX=0;packY+=rowHeight;rowHeight=0;}
        const packed={x:Math.max(0,Math.min(128-b.width,sourceX+b.x-col*128)),y:Math.floor((128-b.height)/2),sourceX:sourceX+b.x,sourceY:sourceY+b.y,width:b.width,height:b.height,packX,packY};packX+=b.width+2;rowHeight=Math.max(rowHeight,b.height+2);return packed;
    });
    const source=document.createElement('canvas');source.width=512;source.height=packY+rowHeight;
    const sc=source.getContext('2d')!;sc.imageSmoothingEnabled=false;
    cells.forEach(b=>sc.drawImage(page,b.sourceX,b.sourceY,b.width,b.height,b.packX,b.packY,b.width,b.height));
    // Discard transparent cell margins without reducing the authored pixel
    // detail. Thin fishing rods and small eyes survive the packing unchanged.
    let cache=frameCaches.get(art);if(!cache){cache=new Map();frameCaches.set(art,cache);}
    for(const [actionIndex,action]of spec.actions.entries())for(const [bodyIndex,body]of (['male','female'] as const).entries())for(const [directionIndex,direction]of (['down','up','right'] as const).entries()){
        const rawFrame=(pose:number)=>{const b=cells[(actionIndex*6+bodyIndex*3+directionIndex)*8+pose],raw=canvas(),ctx=raw.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(source,b.packX,b.packY,b.width,b.height,b.x,b.y,b.width,b.height);return raw;};
        const frames=Array.from({length:8},(_,pose)=>{
            const frame=`${action}-${direction}-${action==='idle'?BODY_IDLE_POSES[pose]:pose}` as Sprite;
            const base=art[body==='female'?`female-${frame}` as Sprite:frame];
            return {base,frame};
        });
        const scale=completeBodyScale(rawFrame(0),frames[0].base,frames[0].frame,body);
        // Keep small atlas pages and materialize only actions currently used.
        // Thousands of eagerly allocated 128px canvases otherwise consume
        // hundreds of megabytes just to open the character picker.
        for(let pose=0;pose<(action==='idle'?32:8);pose++){
            const index=action==='idle'?bodyIdlePose(pose):pose,f=frames[index],key=fullBodyKey(spec.family,body,f.frame);
            Object.defineProperty(art,fullBodyKey(spec.family,body,`${action}-${direction}-${pose}`),{enumerable:true,configurable:true,get(){
                const found=cache!.get(key);if(found){cache!.delete(key);cache!.set(key,found);return found;}
                const sprite=registerCompleteBody(rawFrame(index),f.base,f.frame,body,spec.family,scale);
                if(cache!.size>=96)cache!.delete(cache!.keys().next().value!);cache!.set(key,sprite);return sprite;
            }});
        }
    }
}
