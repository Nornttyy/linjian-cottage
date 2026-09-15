import {colorHex,type Appearance,type DyePart} from './appearance';
import type {Atlas,Direction,Sprite} from './art';
import type {Pixels,Region} from './hero-appearance';
import {WEARABLES} from './wardrobe';
type Masks={masks:Partial<Record<DyePart,number[]>>;shirt?:Region;pants?:Region;head?:Region;face?:Region;pelvis?:{x:number;y:number};headVisible?:boolean;protectedPixels?:number[]};
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const box=(points:number[],w:number)=>{let x=Infinity,y=Infinity,right=0,bottom=0;for(const i of points){x=Math.min(x,i%w);y=Math.min(y,Math.floor(i/w));right=Math.max(right,i%w);bottom=Math.max(bottom,Math.floor(i/w));}return{x,y,width:right-x+1,height:bottom-y+1};};
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
        const skinSamples=Array.from({length:20},(_,n)=>sample(54+n,88)).filter(j=>dp[j+3]>=128&&dp[j]>175&&dp[j+1]>110&&dp[j+2]>70&&dp[j]>dp[j+1]*1.1).sort((a,b)=>dp[a+1]-dp[b+1]);
        const skinIndex=skinSamples[Math.floor(skinSamples.length*.6)]??sample(59,88);
        const skinColor=a.skin&&a.skin!=='original'?colorHex(a.skin):'#f2bd88';
        const sole=box(masks.shoes??[],w),bottom=Number.isFinite(sole.y)?sole.y+sole.height:pants.y+pants.height+6*u;
        // Expand by one source pixel only into dark clothing seams; keep every
        // original hand, face, wooden tool and metal pixel intact.
        const replace=new Set([...garment,...(masks.shoes??[]),...(masks.trim??[])]);
        for(const i of [...replace])for(const n of [i-1,i+1,i-w,i+w]){
            if(n<0||n>=w*h||skin.has(n)||hair.has(n)||src[n*4+3]<128)continue;
            const [r,g,b]=src.subarray(n*4,n*4+3);if((b>r*1.08&&g>r*1.05)||(r<115&&g<100&&b<100))replace.add(n);
        }
        const torsoWidth=(direction==='right'?15:a.body==='female'?19:21)*u;
        for(const i of replace){
            const k=i*4,x=i%w,y=Math.floor(i/w),q=project(x,y);
            const inTorso=Math.abs(q.x)<=torsoWidth/2&&q.y>=-18*u&&q.y<=7*u;
            if(inTorso){
                const donorX=64+q.x/u,donorY=76+q.y/u,j=sample(donorX,donorY);
                if(dp[j+3]>=128){d.set(dp.subarray(j,j+4),k);const[r,g,b]=dp.subarray(j,j+3);
                    if(g>r*1.15&&b>r*1.2)tint(d,k,(q.y<0?a.shirt:a.pants)==='original'?swimColor:colorHex(q.y<0?a.shirt:a.pants),150);
                    else if(a.skin)tint(d,k,skinColor,205);
                }else d[k+3]=0;
            }else{
                // Generated skin palette replaces sleeves and trouser legs.
                // Preserve the animated limb path, while trimming garment bulk.
                const isLeg=q.y>7*u,edge=!replace.has(i-1)||!replace.has(i+1);
                const shoe=(masks.shoes??[]).includes(i);
                if((isLeg&&edge)||(shoe&&y<bottom-4*u&&edge)){d[k+3]=0;continue;}
                if(shoe&&Math.abs(angle)<.15){
                    let left=x,right=x;while(left>0&&replace.has(y*w+left-1))left--;while(right<w-1&&replace.has(y*w+right+1))right++;
                    const maxWidth=(y<bottom-4*u?5:8)*u;
                    if(Math.abs(x-(left+right)/2)>maxWidth/2){d[k+3]=0;continue;}
                }
                const base=shoe?110:isLeg?153:168,shade=Math.max(.4,Math.min(1.2,(src[k]*.22+src[k+1]*.55+src[k+2]*.23)/base));
                for(let channel=0;channel<3;channel++)d[k+channel]=Math.round(Math.min(255,dp[skinIndex+channel]*shade));d[k+3]=255;
                if(a.skin&&d[k+3])tint(d,k,skinColor,205);
                const shoulderDistance=Math.min(Math.hypot(q.x-8*u,q.y+15*u),Math.hypot(q.x+8*u,q.y+15*u));
                if(a.body==='male'&&!isLeg&&shoulderDistance<7*u)tint(d,k,a.shirt==='original'?swimColor:colorHex(a.shirt),180);
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
