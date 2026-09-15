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
/** Generated body and garments are fitted to the existing skeleton, never to a tool's bounds. */
export function composeWardrobe(ctx:CanvasRenderingContext2D,art:Atlas,original:Pixels,a:Appearance,frame:Sprite,parts:Masks){
    const {masks,shirt,pants,head}=parts;if(!shirt||!pants||!head)return;
    const direction=(frame.match(/-(down|up|right)-/)?.[1]??'down') as Direction;
    const w=original.width,h=original.height,u=w/128;
    const {hip,hc,angle}=wardrobePose(frame,parts,w)!;
    const ca=Math.cos(angle),sa=Math.sin(angle),project=(x:number,y:number)=>({x:(x-hip.x)*ca+(y-hip.y)*sa,y:-(x-hip.x)*sa+(y-hip.y)*ca});
    const dressed=ctx.getImageData(0,0,w,h),d=dressed.data,src=original.data;
    const garment=new Set([...(masks.shirt??[]),...(masks.pants??[])]),skin=new Set(masks.skin??[]),hair=new Set(masks.hair??[]);
    const swim=a.outfit?.endsWith('-swim');
    if(swim){
        const donor=art[`swim-${a.body}-${direction}`],dp=donor.getContext('2d')!.getImageData(0,0,donor.width,donor.height).data;
        const swimColor=a.outfit==='coral-swim'?'#f07d89':'#19bbce';
        const sample=(x:number,y:number)=>{const xx=Math.max(0,Math.min(127,Math.round(x))),yy=Math.max(0,Math.min(127,Math.round(y)));return (yy*128+xx)*4;};
        // Use the same skin as the animated face. A separately generated donor
        // has a different complexion; tinting it twice leaves a visible seam.
        // Median complexion of each original idle face. Sampling a moving
        // face can select a cheek highlight or a pink hair tie on back views.
        const skinBase=a.body==='female'?[254,232,207]:[253,214,156];
        const skinLight=(skinBase[0]*.22+skinBase[1]*.55+skinBase[2]*.23)/205;
        const skinColor=a.skin&&a.skin!=='original'?colorHex(a.skin):undefined;
        const skinPalette=skinColor?[1,3,5].map(n=>parseInt(skinColor.slice(n,n+2),16)*skinLight):skinBase;
        const paintSkin=(k:number,shade:number)=>{for(let ch=0;ch<3;ch++)d[k+ch]=Math.round(Math.min(255,skinPalette[ch]*Math.pow(shade,skinColor?1:[1,1.15,1.4][ch])));d[k+3]=255;};
        // Expand by one source pixel only into dark clothing seams; keep every
        // original hand, face, wooden tool and metal pixel intact.
        const shoes=new Set(masks.shoes??[]),protectedPixels=new Set([...(parts.protectedPixels??[]),...(masks.eyes??[]),...skin,...hair]);
        // Hair ties share the trim dye with the belt, but are not swimwear.
        const bodyTrim=(masks.trim??[]).filter(i=>{const q=project(i%w,Math.floor(i/w));return q.y>=-6*u&&q.y<=4*u&&[i-1,i+1,i-w,i+w].some(n=>garment.has(n));});
        const replace=new Set([...garment,...shoes,...bodyTrim]);
        for(const i of [...replace])for(const n of [i-1,i+1,i-w,i+w]){
            if(n<0||n>=w*h||protectedPixels.has(n)||src[n*4+3]<128)continue;
            const [r,g,b]=src.subarray(n*4,n*4+3);if((b>r*1.08&&g>r*1.05)||(r<115&&g<100&&b<100))replace.add(n);
        }
        const torsoWidth=(direction==='right'?15:a.body==='female'?19:21)*u;
        // Compress the torso with the neck-to-hip distance during crouches.
        // Keep the original limb paths; a standing torso cannot fit every pose.
        const torsoTop=Math.max(-22*u,Math.min(-8*u,project(hc.x,hc.y).y+13*u));
        for(const i of replace){
            if(protectedPixels.has(i))continue;
            const k=i*4,x=i%w,y=Math.floor(i/w),q=project(x,y);
            const inTorso=Math.abs(q.x)<=torsoWidth/2&&q.y>=torsoTop&&q.y<=7*u;
            if(inTorso){
                const donorX=64+q.x/u,donorY=76+(q.y<0?q.y/(-torsoTop)*18:q.y/u),j=sample(donorX,donorY);
                if(dp[j+3]>=128){const[r,g,b]=dp.subarray(j,j+3);
                    d.set(dp.subarray(j,j+4),k);
                    if(g>r*1.15&&b>r*1.2)tint(d,k,(q.y<0?a.shirt:a.pants)==='original'?swimColor:colorHex(q.y<0?a.shirt:a.pants),150);
                    else paintSkin(k,Math.max(.78,Math.min(1.05,(r*.22+g*.55+b*.23)/205)));
                }else paintSkin(k,.9);
            }else{
                // Do not erode every row boundary: clothing seams and occluded
                // knees split rows, so that operation punched holes in limbs.
                // A short skin ramp removes denim folds and leather highlights.
                const isLeg=q.y>7*u,base=shoes.has(i)?110:isLeg?153:168;
                const light=(src[k]*.22+src[k+1]*.55+src[k+2]*.23)/base;
                paintSkin(k,light<.58?.78:light<.82?.90:light>1.12?1.04:1);
                const shoulderDistance=Math.min(Math.hypot(q.x-8*u,q.y+15*u),Math.hypot(q.x+8*u,q.y+15*u));
                if(a.body==='male'&&!isLeg&&shoulderDistance<7*u)tint(d,k,a.shirt==='original'?swimColor:colorHex(a.shirt),180);
            }
        }
        // Replace the boot silhouette with the generated bare foot, anchored
        // at the original sole. The knee and leg animation stay intact.
        if(!/^(dodge|sleep)-/.test(frame)&&shoes.size){
            const feet=[...shoes].map(i=>({i,...project(i%w,Math.floor(i/w))}));
            const spread=Math.max(...feet.map(p=>p.x))-Math.min(...feet.map(p=>p.x));
            const two=direction!=='right'||spread>15*u;
            const split=direction==='right'?(Math.min(...feet.map(p=>p.x))+Math.max(...feet.map(p=>p.x)))/2:0;
            const groups=two?[feet.filter(p=>p.x<split),feet.filter(p=>p.x>=split)]:[feet];
            for(const [index,points]of groups.entries()){
                if(!points.length)continue;
                const xs=points.map(p=>p.x).sort((a,b)=>a-b),footX=(xs[Math.floor(xs.length*.2)]+xs[Math.floor(xs.length*.8)])/2;
                const bottom=Math.max(...points.map(p=>p.y))+1*u,top=bottom-6*u;
                const sourceX=direction==='right'?63.5:index===0?(a.body==='male'&&direction==='down'?58:59):68.5;
                const sourceWidth=direction==='right'?12:10;
                const left=Math.min(...points.map(p=>p.x))-u,right=Math.max(...points.map(p=>p.x))+u;
                for(let i=0;i<w*h;i++){const q=project(i%w,Math.floor(i/w));if(q.y>=top&&q.y<=bottom&&q.x>=left&&q.x<=right&&!protectedPixels.has(i))d[i*4+3]=0;}
                for(let i=0;i<w*h;i++){
                    if(protectedPixels.has(i))continue;
                    const q=project(i%w,Math.floor(i/w));if(q.y<top||q.y>=bottom)continue;
                    const dx=(q.x-footX)/u;if(Math.abs(dx)>sourceWidth/2)continue;
                    const donorX=sourceX+dx;
                    if(direction!=='right'&&(index===0?Math.round(donorX)>=64:Math.round(donorX)<64))continue;
                    const j=sample(donorX,90+(q.y-top)/u),[r,g,b,alpha]=dp.subarray(j,j+4);
                    if(alpha<128)continue;
                    paintSkin(i*4,Math.max(.38,Math.min(1.08,(r*.22+g*.55+b*.23)/205)));
                }
            }
        }
        ctx.putImageData(dressed,0,0);
    }else if(a.outfit){
        const item=WEARABLES.find(item=>item.id===a.outfit&&item.slot==='outfit');
        if(item&&item.row>=0){
            const source=art[`wardrobe-outfit-${item.row}-${direction}`],layer=canvas(w,h),lc=layer.getContext('2d')!;
            lc.imageSmoothingEnabled=false;lc.translate(hip.x,hip.y);lc.rotate(angle);
            const width=(direction==='right'?26:34)*u,height=31*u;
            lc.drawImage(source,-width/2,-19*u,width,height);
            const cp=lc.getImageData(0,0,w,h),colors=['#d55258','#30b3a7','#e0e4cf','#67a744'],baseColor=colors[item.row];
            for(let k=3;k<cp.data.length;k+=4)cp.data[k]=cp.data[k]>=128?255:0;
            for(let i=0;i<w*h;i++){
                const k=i*4;if(cp.data[k+3]<128)continue;
                const[r,g,b]=cp.data.subarray(k,k+3),accent=r>g*1.08&&g>b*1.15;
                if(a.outfitColor&&!accent)tint(cp.data,k,colorHex(a.outfitColor),170);
                if(a.outfitTrim&&accent)tint(cp.data,k,colorHex(a.outfitTrim),170);
                if(!skin.has(i)&&!hair.has(i)&&!(masks.eyes??[]).includes(i))d.set(cp.data.subarray(k,k+4),k);
            }
            // Match the body sleeves to the generated outer garment, including
            // exposed parts during swings; the torso receives the actual cloth art.
            for(const i of masks.shirt??[]){if(cp.data[i*4+3]<128)tint(d,i*4,a.shirt==='original'?(a.outfitColor?colorHex(a.outfitColor):baseColor):colorHex(a.shirt),168);}
            ctx.putImageData(dressed,0,0);lc.setTransform(1,0,0,1,0,0);lc.putImageData(cp,0,0);
            ctx.save();ctx.globalCompositeOperation='destination-over';ctx.drawImage(layer,0,0);ctx.restore();
        }
    }
    if(a.headwear&&parts.headVisible!==false){
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
    if(parts.protectedPixels?.length||/^(axe|pick|sword|hammer|hoe|water|fish|cook)-/.test(frame)){
        const final=ctx.getImageData(0,0,w,h);
        for(let i=0;i<w*h;i++){
            const k=i*4,[r,g,b,alpha]=src.subarray(k,k+4);
            if(alpha>=128&&!garment.has(i)&&!skin.has(i)&&!hair.has(i)&&r>100&&b>=g&&b>r*1.05&&b-r<130)final.data.set(src.subarray(k,k+4),k);
        }
        for(const i of parts.protectedPixels??[])final.data.set(src.subarray(i*4,i*4+4),i*4);
        ctx.putImageData(final,0,0);
    }
}
