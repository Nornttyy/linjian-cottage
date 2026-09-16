import {colorHex,appearanceKey,normalizeAppearance,type Appearance,type ClothingColor,type DyePart} from './appearance';
import type {Atlas,Sprite} from './art';
import {composeWardrobe} from './wardrobe-render';
import {femaleDyeRegistrations,type DyeRegistration} from './female-art-layout';
import {fishingRod,authoredFishingRod,fishingRodPixel,fishingLineOrigin} from './hero-fishing-art';
import {toolDyeExclusion} from './hero-tool-masks';
import {alignHeroFrame,heroFrameOffset} from './hero-registration';
import {bodyFamily,fullBodyKey} from './full-body-layout';
import {completeBodies,dyeCompleteBody} from './full-body-art';
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
// Native-frame bounds for folded boots. Here leather touches a palm, or a
// raised foot is closer to the head than the hips, so component order is unsafe.
const reviewedBoots:Record<string,number[][]>={
    'male:dodge-right-3':[[62,58,81,71]],
    'female:dodge-right-3':[[63,57,81,71]],
    'male:dodge-up-2':[[56,89,66,96],[69,88,79,96]],
    'male:dodge-up-5':[[47,85,58,95],[60,82,71,97]],
    'female:dodge-up-5':[[49,87,59,95],[62,82,72,97]],
    'female:harvest-right-4':[[57,88,68,97],[67,87,78,96]],
    'female:hammer-down-4':[[45,82,59,92],[69,82,83,92]]
};
export function recolorClothes(p:Pixels,appearance:Appearance,frame?:Sprite,registration?:DyeRegistration){
    let reviewedTools=toolDyeExclusion(frame,appearance.body,p.width,p.height);
    if(registration?.revised&&reviewedTools?.size){
        const expanded=new Set(reviewedTools),radius=Math.ceil(p.width/64),d=p.data;
        for(const i of reviewedTools){
            const k=i*4;if(d[k+3]<128)continue;
            for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
                const x=i%p.width+dx,y=(i/p.width|0)+dy;if(x<0||x>=p.width||y<0||y>=p.height)continue;
                const n=y*p.width+x,t=n*4;
                if(d[t+3]>=128&&Math.hypot(d[t]-d[k],d[t+1]-d[k+1],d[t+2]-d[k+2])<65)expanded.add(n);
            }
        }
        reviewedTools=expanded;
    }
    const rod=frame?(registration?.revised?authoredFishingRod(p,frame,appearance.body):fishingRod(frame,appearance.body)):undefined;
    const rodPixels=new Set<number>();if(rod)for(let i=0;i<p.width*p.height;i++)if(fishingRodPixel(p,i,rod,registration?.revised))rodPixels.add(i);
    const water=frame?.match(/^water-(down|up|right)-(\d+)$/),pose=water?Number(water[2])%8:0;
    // At impact the pick blade sits between the legs and shares the trousers'
    // blue palette. Its narrow, vertical silhouette belongs to the tool.
    const pickImpact=frame?.match(/^pick-down-([45])$/);
    const bladeTip=pickImpact?regions(p,(r,g,b,i)=>Math.floor(i/p.width)>p.height*.70&&g>r*1.15&&b>r*1.2)
        .filter(r=>r.height>r.width*1.6&&r.height>6*p.width/128)[0]:undefined;
    const blade=bladeTip?{...bladeTip,y:(pickImpact![1]==='4'?79:77)*p.height/128,height:bladeTip.y+bladeTip.height-(pickImpact![1]==='4'?79:77)*p.height/128}:undefined;
    const handles=new Set(!reviewedTools&&/^(axe|pick|sword|hammer|hoe|water|fish|cook)-/.test(frame??'')?regions(p,(r,g,b)=>r>g*1.08&&g>b*1.1&&g<175&&r<240)
        .filter(r=>r.width>25*p.width/128&&r.width>r.height*2.2||r.height>28*p.width/128&&r.height>r.width*2.2).flatMap(r=>r.points):[]);
    let upperCan:Region|undefined;
    const toolPixel=(i:number)=>{
        if(registration?.revised&&water?.[1]==='up'&&(pose===1||pose===2)){
            const x=i%p.width*128/p.width,y=Math.floor(i/p.width)*128/p.height;
            if(y>=53&&y<64&&x>=(pose===1?78:79)&&x<(pose===1?86:88))return true;
        }
        if(registration?.revised&&frame==='hoe-down-5'){
            const x=i%p.width*128/p.width,y=Math.floor(i/p.width)*128/p.height,k=i*4,r=p.data[k],g=p.data[k+1],b=p.data[k+2];
            return x>=37&&x<=47&&y>=88&&y<=98||x>=39&&x<=57&&y>=77&&y<=93&&x+y>=130&&x+y<=136&&r>g*1.04&&g>b*1.06;
        }
        if(reviewedTools?.has(i))return true;
        if(rodPixels.has(i))return true;
        if(handles.has(i))return true;
        if(blade){const x=i%p.width,y=Math.floor(i/p.width);if(x>=blade.x-1&&x<=blade.x+blade.width&&y>=blade.y-1&&y<=blade.y+blade.height)return true;}
        if(!water)return false;
        if(water[1]==='up'&&upperCan){const x=i%p.width,y=Math.floor(i/p.width);return x>=upperCan.x-1&&x<=upperCan.x+upperCan.width&&y>=upperCan.y-1&&y<=upperCan.y+upperCan.height;}
        const x=i%p.width*128/p.width*(registration?.scale??1)+(registration?.x??0),y=Math.floor(i/p.width)*128/p.height*(registration?.scale??1)+(registration?.y??0);
        if(water[1]==='down')return frontCan[pose].some(([x0,y0,x1,y1])=>x>=x0&&x<x1&&y>=y0&&y<y1);
        return water[1]==='right'&&x>=[66,70,70,68,67,68,65,65][pose]&&y>=60&&y<83;
    };
    const upright=!frame?.startsWith('sleep-')&&!frame?.startsWith('dodge-'),u=p.width/128;
    const belts=registration?.revised&&upright?regions(p,(r,g,b,i)=>!toolPixel(i)&&r>g*1.08&&g>b*1.1&&g<185&&r>70)
        .filter(r=>r.width>=7*u&&r.width<=28*u&&r.height<=8*u&&r.width>=r.height*1.7&&r.y+r.height/2>=68*u&&r.y+r.height/2<90*u&&Math.abs(r.x+r.width/2-64*u)<28*u):[];
    belts.sort((a,b)=>Math.abs(a.y+a.height/2-74*u)-Math.abs(b.y+b.height/2-74*u));
    const belt=registration?.revised&&frame==='hoe-down-5'?{x:49*u,y:76*u,width:22*u,height:2*u,points:[]}:belts[0],belowBelt=(i:number)=>!!belt&&Math.floor(i/p.width)>=belt.y+belt.height-1&&i%p.width>=belt.x-14*u&&i%p.width<=belt.x+belt.width+14*u;
    // Find both masks before writing either color: blue shirts must never be
    // reclassified as pants during the same recolor operation.
    const garments=([['shirt',false],['pants',true]] as const).map(([part,isPants])=>({part,isPants,parts:regions(p,(r,g,b,i)=>{
        const split=appearance.body==='female'?(b-r)*.23:25;
        return !toolPixel(i)&&g>r*1.22&&b>r*1.3&&g>32&&(belt?(isPants?belowBelt(i):!belowBelt(i)):(isPants?b-g>split:b-g<=split&&b-g>-35));
    })}));
    if(water?.[1]==='up')upperCan=regions(p,(r,g,b,i)=>i%p.width>p.width*.55&&Math.floor(i/p.width)<p.height*.59&&b>r*1.25&&b-g>20&&g>60)[0];
    const shirt=garments[0].parts[0];let pants=garments[1].parts[0];
    if(upright&&shirt){
        // A sleeve shadow may contain more blue pixels than either leg. Pick
        // the lower garment by its position before attaching the other leg.
        garments[1].parts.sort((a,b)=>Number(b.y+b.height/2>shirt.y+shirt.height*.65)-Number(a.y+a.height/2>shirt.y+shirt.height*.65)||b.points.length-a.points.length);
        pants=garments[1].parts[0];
    }
    const masks:Partial<Record<DyePart,number[]>>={};
    for(const {part,isPants,parts}of garments){
        const main=parts[0];if(!main)continue;
        // Sleeves and the two trouser legs can be disconnected by skin, belt or
        // outlines. Include their nearby components, not just the largest one.
        const selected=parts.filter(r=>r===main||(isPants&&upright&&shirt&&r.points.length>=3&&Math.abs(r.x+r.width/2-shirt.x-shirt.width/2)<18*p.width/128&&Math.abs(r.y+r.height-main.y-main.height)<7*p.width/128)||(!isPants&&r.points.length>=3&&(!upright||!pants||r.y<pants.y+2*p.width/128)&&Math.hypot(Math.max(0,main.x-r.x-r.width,r.x-main.x-main.width),Math.max(0,main.y-r.y-r.height,r.y-main.y-main.height))<12*p.width/128)||r.points.length>=4&&
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
    let standingWaist=-Infinity;
    if(frame&&upright&&pantsSet.size){
        const rows=[...pantsSet].map(i=>Math.floor(i/p.width)).sort((a,b)=>a-b);
        standingWaist=belt?belt.y+belt.height-1:rows[Math.floor(rows.length*.5)]-8*unit;
        for(const i of pantsSet)if(Math.floor(i/p.width)<standingWaist){pantsSet.delete(i);shirtSet.add(i);}
    }
    for(const [part,selected,other]of [['shirt',shirtSet,pantsSet],['pants',pantsSet,shirtSet]] as const){
        const queue=[...selected];for(let q=0;q<queue.length;q++){
            const i=queue[q],x=i%p.width,y=Math.floor(i/p.width);
            for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
                const xx=x+dx,yy=y+dy,n=yy*p.width+xx;if(xx<0||xx>=p.width||yy<0||yy>=p.height||selected.has(n)||other.has(n)||toolPixel(n))continue;
                if(part==='pants'&&yy<standingWaist)continue;
                if(belt&&part==='shirt'&&belowBelt(n))continue;
                const [r,g,b,a]=p.data.subarray(n*4,n*4+4);
                if(a>=128&&g>r*1.06&&b>r*1.12&&g>24&&b-g>-50){selected.add(n);queue.push(n);}
            }
        }masks[part]=[...selected];
    }
    if(frame&&!/^(axe|pick|sword|hammer|hoe|water|fish|cook)-/.test(frame)){
        // Rolling and sleeping can detach a small cuff from the main shirt.
        // In these tool-free poses, assign each remaining cloth pixel to its
        // nearest established material instead of leaving its original cyan.
        const distance=(i:number,points:Set<number>)=>{let nearest=Infinity;for(const n of points)nearest=Math.min(nearest,(i%p.width-n%p.width)**2+(Math.floor(i/p.width)-Math.floor(n/p.width))**2);return nearest;};
        for(let i=0;i<p.width*p.height;i++){
            if(shirtSet.has(i)||pantsSet.has(i)||toolPixel(i))continue;
            const [r,g,b,a]=p.data.subarray(i*4,i*4+4);
            if(a<128||g<=r*1.06||b<=r*1.12||g<=24||b-g<=-50)continue;
            const ds=distance(i,shirtSet),dp=distance(i,pantsSet);if(Math.min(ds,dp)>(lying?576:36)*unit*unit)continue;
            (ds<=dp?shirtSet:pantsSet).add(i);
        }
        masks.shirt=[...shirtSet];masks.pants=[...pantsSet];
    }
    if(shirt&&pants&&frame&&upright&&pantsSet.size){
        // A pale trouser leg can share the shirt's cyan highlights. The shirt
        // flood must not claim it merely because that leg has no dark core.
        const xs=[...pantsSet].map(i=>i%p.width),left=Math.min(...xs)-3*unit,right=Math.max(...xs)+3*unit;
        const waist=Math.max(standingWaist,shirt.y+shirt.height);
        for(const i of shirtSet)if(Math.floor(i/p.width)>=waist&&i%p.width>=left&&i%p.width<=right){shirtSet.delete(i);pantsSet.add(i);}
        masks.shirt=[...shirtSet];masks.pants=[...pantsSet];
    }
    if(masks.pants?.length){
        const points=masks.pants,xs=points.map(i=>i%p.width),ys=points.map(i=>Math.floor(i/p.width)),x=Math.min(...xs),y=Math.min(...ys);
        pants={points,x,y,width:Math.max(...xs)-x+1,height:Math.max(...ys)-y+1};
    }
    let face:Region|undefined;
    const w=p.width,warm=(r:number,g:number,b:number)=>r>g*1.08&&g>b*1.1;
    const hairParts=regions(p,(r,g,b,i)=>!toolPixel(i)&&warm(r,g,b)&&g<150&&r<225);
    // The hair mass identifies the head even when a raised sleeve sits above it,
    // or the whole character lies sideways. Thin wooden handles are excluded.
    const candidates=hairParts.filter(r=>r.width>=4*unit&&r.height>=2*unit&&r.width>r.height*.3&&(!pants||lying||r.y+r.height/2<pants.y-9*unit));
    if(!lying&&pants)candidates.sort((a,b)=>Math.hypot(a.x+a.width/2-pants.x-pants.width/2,a.y+a.height/2-(pants.y-26*unit))-Math.hypot(b.x+b.width/2-pants.x-pants.width/2,b.y+b.height/2-(pants.y-26*unit)));
    // This authored back-facing roll frame hides the head behind the torso.
    // A boot is not a substitute head / hat anchor.
    const hiddenHead=appearance.body==='male'&&frame==='dodge-up-3';
    const head=hiddenHead&&shirt?{points:[],x:shirt.x+shirt.width/2-11*unit,y:shirt.y+shirt.height-8*unit,width:22*unit,height:12*unit}:candidates[0];
    if(head){
        masks.hair=hiddenHead?[]:hairParts.filter(r=>r===head||r.points.length>=3&&r.x+r.width>head!.x-2*unit&&r.x<head!.x+head!.width+2*unit&&r.y+r.height>head!.y&&r.y<head!.y+head!.height||lying&&r.points.length>=12&&r.width>=6*unit&&r.height>3*unit&&Math.hypot(Math.max(0,head.x-r.x-r.width,r.x-head.x-head.width),Math.max(0,head.y-r.y-r.height,r.y-head.y-head.height))<8*unit).flatMap(r=>r.points);
        const skins=regions(p,(r,g,b,i)=>!toolPixel(i)&&r>175&&g>115&&b>65&&r>=g*.99&&g>=b*.96&&r-b>15&&!(r-g>55&&g-b>50));
        const hx=head.x+head.width/2,hy=head.y+head.height/2;
        // The face is the substantial skin patch beside the hair, not the
        // nearest tiny warm highlight inside the hair itself.
        face=hiddenHead?undefined:skins.filter(r=>Math.hypot(r.x+r.width/2-hx,r.y+r.height/2-hy)<22*unit&&r.points.length>=8).sort((a,b)=>b.points.length-a.points.length)[0];
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
            masks.shoes=regions(p,(r,g,b,i)=>!toolPixel(i)&&warm(r,g,b)).filter(r=>{
                if(r.points.length<4||Math.hypot(r.x+r.width/2-px,r.y+r.height/2-py)>=24*unit)return false;
                if(!upright)return ((r.x+r.width/2-px)*dx+(r.y+r.height/2-py)*dy)/len>2*unit;
                // Crouches raise the feet. Follow the pelvis instead of a fixed
                // screen row, and keep the much lighter palms out of leather.
                const greens=r.points.map(i=>p.data[i*4+1]).sort((a,b)=>a-b);
                return r.y+r.height/2>=py+3*unit&&greens[Math.floor(greens.length/2)]<175;
            }).flatMap(r=>r.points);
        }
        if(shirt)masks.trim=regions(p,(r,g,b,i)=>{const x=i%w,y=Math.floor(i/w);return !toolPixel(i)&&warm(r,g,b)&&pants&&x>=pants.x-2*unit&&x<pants.x+pants.width+2*unit&&y>=pants.y-4*unit&&y<pants.y+2*unit;}).filter(r=>r.width>r.height*1.8).flatMap(r=>r.points);
    }
    if(head){
        const rawHands=regions(p,(r,g,b,i)=>!toolPixel(i)&&r>175&&g>115&&b>65&&r>=g*.99&&g>=b*.96&&r-b>15);
        const added=rawHands.filter(r=>r.points.length>=4&&r.width<14*unit&&r.height<14*unit&&!(r.x>=head.x-2*unit&&r.x+r.width<=head.x+head.width+2*unit&&r.y>=head.y-2*unit&&r.y+r.height<=head.y+head.height+5*unit)&&r.points.some(i=>[i-1,i+1,i-w,i+w,i-2,i+2,i-w*2,i+w*2].some(n=>shirtSet.has(n)))).flatMap(r=>r.points);
        masks.skin=[...new Set([...(masks.skin??[]),...added])];
        const skinSet=new Set(masks.skin),hairSet=new Set(masks.hair??[]),queue=[...hairSet];
        for(let q=0;q<queue.length;q++)for(const n of [queue[q]-1,queue[q]+1,queue[q]-w,queue[q]+w]){
            const x=n%w,y=Math.floor(n/w);if(n<0||n>=w*p.height||hairSet.has(n)||skinSet.has(n)||toolPixel(n)||x<head.x-1||x>=head.x+head.width+1||y<head.y||y>=head.y+head.height)continue;
            if(face&&x>=face.x-1&&x<=face.x+face.width&&y>=face.y-1&&y<=face.y+face.height)continue;
            const[r,g,b,a]=p.data.subarray(n*4,n*4+4);if(a>=128&&r>g*1.06&&g>b*1.04){hairSet.add(n);queue.push(n);}
        }
        masks.hair=[...hairSet].filter(i=>!skinSet.has(i)&&!masks.eyes?.includes(i));
    }
    if(head&&appearance.body==='female')masks.trim=[...(masks.trim??[]),...regions(p,(r,g,b,i)=>r>140&&r>g*1.2&&b>g*1.1&&i%w>=head.x&&i%w<head.x+head.width&&Math.floor(i/w)>=head.y&&Math.floor(i/w)<head.y+head.height).flatMap(r=>r.points)];
    const bootBounds=reviewedBoots[appearance.body+':'+frame];
    if(bootBounds)masks.shoes=regions(p,(r,g,b,i)=>!toolPixel(i)&&warm(r,g,b)&&bootBounds.some(([x0,y0,x1,y1])=>i%w>=x0*unit&&i%w<x1*unit&&Math.floor(i/w)>=y0*unit&&Math.floor(i/w)<y1*unit)).flatMap(r=>r.points);
    let pelvis:{x:number;y:number}|undefined;
    if(appearance.body==='male'&&frame==='dodge-up-4'&&shirt){
        // The trousers are completely occluded. The two remaining blue pixels
        // are a cuff, not a hip joint at the far left of the character.
        pelvis={x:shirt.x+shirt.width/2,y:shirt.y+4*unit};
        masks.shirt=[...new Set([...(masks.shirt??[]),...(masks.pants??[])])];masks.pants=[];
        const upperHair=hairParts.filter(r=>r.y<70*unit&&r.width>20*unit).flatMap(r=>r.points);
        masks.hair=[...new Set([...(masks.hair??[]),...upperHair])];
        const upper=new Set(upperHair);masks.skin=masks.skin?.filter(i=>!upper.has(i));
    }
    // Every material owns its pixels once. In folded poses a warm boot can sit
    // in the belt band, and light leather can otherwise be mistaken for skin.
    masks.eyes=(masks.eyes??[]).filter(i=>!toolPixel(i));
    const eyes=new Set(masks.eyes),shoes=new Set(masks.shoes??[]);
    masks.skin=(masks.skin??[]).filter(i=>!shoes.has(i)&&!eyes.has(i)&&!toolPixel(i));
    const skin=new Set(masks.skin);
    masks.hair=(masks.hair??[]).filter(i=>!skin.has(i)&&!shoes.has(i)&&!eyes.has(i)&&!toolPixel(i));
    const hair=new Set(masks.hair);
    masks.trim=(masks.trim??[]).filter(i=>!skin.has(i)&&!hair.has(i)&&!shoes.has(i)&&!eyes.has(i)&&!toolPixel(i));
    function paint(i:number,color:ClothingColor,base:number){
        const hex=colorHex(color),target=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),k=i*4,d=p.data;
        const shade=Math.max(.4,Math.min(1.3,(d[k]*.22+d[k+1]*.55+d[k+2]*.23)/base));
        for(let c=0;c<3;c++)d[k+c]=Math.max(0,Math.min(255,Math.round(target[c]*shade)));
    }
    const bases={shirt:168,pants:153,hair:100,skin:205,eyes:80,shoes:110,trim:125};
    for(const part of Object.keys(bases) as (keyof typeof bases)[]){const color=appearance[part];if(!color||color==='original')continue;for(const i of masks[part]??[])paint(i,color,bases[part]);}
    const protectedPixels=Array.from({length:p.width*p.height},(_,i)=>i).filter(i=>p.data[i*4+3]>=128&&toolPixel(i));
    return {masks,shirt,pants,head,face,pelvis,headVisible:!hiddenHead,protectedPixels};
}
const caches=new WeakMap<Atlas,Map<string,HTMLCanvasElement>>();
const authoredRodTips=new WeakMap<HTMLCanvasElement,readonly [number,number]|null>();
export function dressedFishingLineOrigin(art:Atlas,frame:Sprite,value?:Appearance,left=false){
    const a=normalizeAppearance(value),family=bodyFamily(a.outfit);
    let tip=family?completeBodies.get(art[fullBodyKey(family,a.body,frame)])?.rodTip:undefined;
    const source=!family&&a.body==='female'?art[`female-${frame}` as Sprite]:undefined;
    if(source&&femaleDyeRegistrations.get(source)?.revised){
        if(!authoredRodTips.has(source)){
            const p=source.getContext('2d')!.getImageData(0,0,source.width,source.height),rod=authoredFishingRod(p,frame,a.body);
            authoredRodTips.set(source,rod?[rod[0],rod[1]]:null);
        }tip=authoredRodTips.get(source)??undefined;
    }
    if(!tip)return fishingLineOrigin(frame,a.body,left);
    const [dx,dy]=heroFrameOffset(frame,a.body);
    return {x:((tip[0]+dx)/2-32)*(left?-1:1),y:(tip[1]+dy)/2-48};
}
/** Female and male bodies each have complete independently authored animation atlases. */
export function dressedHero(art:Atlas,frame:Sprite,value?:Appearance):HTMLCanvasElement{
    const a=normalizeAppearance(value),family=bodyFamily(a.outfit);
    let cache=caches.get(art);if(!cache){cache=new Map();caches.set(art,cache);}
    const key=frame+':'+appearanceKey(a),found=cache.get(key);if(found)return found;
    const source=family?art[fullBodyKey(family,a.body,frame)]:art[a.body==='female'?`female-${frame}` as Sprite:frame];
    if(!source)throw Error('角色动作素材缺失：'+a.body+' '+frame);
    if(a.shirt==='original'&&a.pants==='original'&&!a.hair&&!a.skin&&!a.eyes&&!a.shoes&&!a.trim&&!a.headwear&&!a.outfit)return alignHeroFrame(source,frame,a.body);
    const out=document.createElement('canvas');out.width=source.width;out.height=source.height;
    const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0);
    const pixels=ctx.getImageData(0,0,out.width,out.height);
    const original=ctx.getImageData(0,0,out.width,out.height);
    const complete=completeBodies.get(source);
    if(family&&!complete)throw Error('完整角色动作信息缺失：'+a.outfit+' '+frame);
    const regions=complete?complete.parts:recolorClothes(pixels,a,frame,femaleDyeRegistrations.get(source));
    if(complete)dyeCompleteBody(pixels,a,complete);
    ctx.putImageData(pixels,0,0);
    if(a.headwear)composeWardrobe(ctx,art,original,{...a,outfit:undefined},frame,regions);
    // Bound memory when a user previews many different outfits in one session.
    const registered=alignHeroFrame(out,frame,a.body);
    if(cache.size>=768)cache.delete(cache.keys().next().value!);cache.set(key,registered);return registered;
}
