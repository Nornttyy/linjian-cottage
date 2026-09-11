import {beginAssets,loadedAsset,finishAssets,failAssets,getAssetLoading} from './asset-loading';
import {farmLayout} from './farm-layout';
import type { Terrain } from './world';
import {creatureLayouts} from './creature-layout';
import {toolFrames,toolAnchors,toolBodyHeights,baseAnchorX,heroLayouts} from './frame-layout';
import {workHeroLayouts} from './new-hero-layout';
Object.assign(heroLayouts,workHeroLayouts);
export type Direction='down'|'up'|'right';
export type HeroAction='harvest'|'pickup'|'eat'|'fish'|'cook'|'sleep'|'idle'|'walk'|'hurt'|'dodge'|'axe'|'pick'|'sword'|'hammer'|'hoe'|'water'|'plant';
type BaseSprite='hammer'|'hoe'|'water'|'seed-bag'|'stairs'|'stairs-down'|'ascend'|'descend'|'planter'|'fence'|'lantern'|'sign'|'carrot-seed'|'tomato-seed'|'wheat-seed'|'water-drop'|'carrot'|'tomato'|'wheat'|'wall-face'|'wall-cap'|'roof-ridge'|'soil-dry'|'soil-wet'|'mine-exit'|`crop-${'carrot'|'tomato'|'wheat'}-${number}`|`${'bat'|'boar'|'mushroom'}-${'idle'|'move'|'attack'|'hurt'|'death'}-${number}`|'tree'|'pine'|'stone'|'copper'|'berry'|'stump'|'daisies'|'wildflowers'|'reeds'|'wall'|'window'|'door'|'door-open'|`fire${number}`|'chest'|'floor'|'roof'|'plaster'|'beam'|'bridge'|'foundation'|'cave-entrance'|'axe'|'pick'|'sword'|'remove'|'wood'|'stone-icon'|'copper-icon'|'essence'|'heart'|'stamina'|'map'|'room'|'torch'|'tuft'|'mushrooms'|'spark'|'down'|'up'|'right'|'slime'|`trail-${'axe'|'pick'|'sword'}-${number}`|`ground-${Terrain}`|`${HeroAction}-${Direction}-${number}`|`slime-${'idle'|'move'|'attack'|'hurt'|'death'}-${number}`;
export type Sprite=BaseSprite|'rod'|'fish'|'meal'|'bed'|'ground-meadow'|'ground-moss'|'region-oak'|'region-birch'|'region-maple'|'region-snowpine'|'region-berry'|'region-stone'|'flowers-white'|'flowers-pink'|'ancient-oak'|'frost-cairn'|'sunstone-circle'|'firefly-meadow'|`${'boar'|'mushroom'}-${'right'|'up'}-${'idle'|'move'|'attack'|'hurt'|'death'}-${number}`;
export type Atlas=Record<Sprite,HTMLCanvasElement>;
export const ART_DENSITY=2;
export const HERO_FRAME_COUNT=8;
export const HERO_IDLE_FRAME_COUNT=32;
export const HERO_SIZE={width:64,height:64,anchorX:32,anchorY:48};
export const FIRE_SIZE={width:64,height:64,anchorX:32,anchorY:52};
export const FIRE_FRAME_COUNT=24;
export const FIRE_FRAME_MS=50;
export const SLIME_SIZE={width:40,height:40,anchorX:20,anchorY:35};
export const CROP_SIZE={width:40,height:40,anchorX:20,anchorY:35,groundX:.5,groundY:.85};
// Source-cell pivots, before the 2 px inset. Shared ground per action retains jumps.
const slimeAnchors=[
    [114,188],[113,188],[111,188],[111.5,188],[119.5,188],[113.5,188],[112,188],[111.5,188],
    [114,195],[113,195],[111,195],[112.5,195],[113.5,195],[114,195],[112.5,195],[112,195],
    [113,191],[113,199],[110,199],[110,199],[108,199],[117,199],[112.5,199],[111.5,191],
    [116.5,180],[112,180],[105.5,180],[112.5,180],[111,185],[111,185],[110.5,185],[111,185]
];
export const frameKey=(action:HeroAction,direction:Direction,frame:number)=>`${action}-${direction}-${frame}` as Sprite;
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c;};
// Keep world sizes logical; sample source art directly into denser sprite buffers.
const detailCanvas=(w:number,h:number)=>{const c=canvas(w*ART_DENSITY,h*ART_DENSITY),ctx=c.getContext('2d')!;ctx.scale(ART_DENSITY,ART_DENSITY);ctx.imageSmoothingEnabled=false;return c;};
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
    const img=new Image(),attempt=getAssetLoading().attempt;
    const cleanup=()=>{clearTimeout(timeout);img.onload=null;img.onerror=null;};
    const timeout=setTimeout(()=>{cleanup();reject(new Error('素材加载超时'));},20000);
    (timeout as unknown as {unref?:()=>void}).unref?.();
    img.onload=()=>{cleanup();try{loadedAsset(attempt,src);resolve(img);}catch(error){reject(error);}};
    img.onerror=()=>{cleanup();reject(new Error('素材加载失败'));};img.src='.'+src;
});
function transparentMatte(c:HTMLCanvasElement,landscapeKey=false,snowKey=false){
    const ctx=c.getContext('2d',{willReadFrequently:true})!,data=ctx.getImageData(0,0,c.width,c.height),p=data.data,w=c.width,h=c.height;
    let transparent=0;for(let i=3;i<p.length;i+=4)if(p[i]<8)transparent++;
    if(transparent>w*h*.02)return;
    // New landscape atlases use a saturated pink key; keep lavender flowers,
    // white birch bark and snowy edges instead of treating them as backdrop.
    if(landscapeKey){
        for(let i=0;i<p.length;i+=4){const r=p[i],g=p[i+1],b=p[i+2];if(r>90&&b>90&&g<Math.min(r,b)*(snowKey?.82:.38)&&Math.abs(r-b)<(snowKey?85:40))p[i+3]=0;}
        ctx.putImageData(data,0,0);return;
    }
    // Decode the actual backdrop color; gray tool highlights are not magenta matte.
    const magenta=(r:number,g:number,b:number)=>r>90&&b>90&&g<Math.min(r,b)*.55&&r<b*1.65&&b<r*1.65;
    const gray=(r:number,g:number,b:number)=>Math.min(r,g,b)>145&&Math.max(r,g,b)-Math.min(r,g,b)<28;
    let magentaEdge=0,grayEdge=0;
    const sample=(i:number)=>{const k=i*4;if(magenta(p[k],p[k+1],p[k+2]))magentaEdge++;if(gray(p[k],p[k+1],p[k+2]))grayEdge++;};
    for(let x=0;x<w;x++){sample(x);sample((h-1)*w+x);}for(let y=1;y<h-1;y++){sample(y*w);sample(y*w+w-1);}
    // Key all magenta, including closed spaces between hands, tools and clothes.
    // Gray backgrounds retain edge-only removal so steel highlights stay intact.
    if(magentaEdge>grayEdge){for(let i=0;i<p.length;i+=4)if(magenta(p[i],p[i+1],p[i+2]))p[i+3]=0;ctx.putImageData(data,0,0);return;}
    const matte=magentaEdge>grayEdge?magenta:gray;
    const seen=new Uint8Array(w*h),queue:number[]=[];
    const add=(i:number)=>{if(i<0||i>=w*h||seen[i])return;const k=i*4;if(matte(p[k],p[k+1],p[k+2])){seen[i]=1;queue.push(i);}};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
    for(let q=0;q<queue.length;q++){const i=queue[q];p[i*4+3]=0;if(i%w)add(i-1);if(i%w<w-1)add(i+1);if(i>=w)add(i-w);if(i<w*(h-1))add(i+w);}
    ctx.putImageData(data,0,0);
}
function cleanFragments(c:HTMLCanvasElement){
    const ctx=c.getContext('2d')!,data=ctx.getImageData(0,0,c.width,c.height),pixels=data.data,w=c.width,h=c.height,seen=new Uint8Array(w*h),groups:number[][]=[];
    for(let start=0;start<w*h;start++){
        if(seen[start]||pixels[start*4+3]<=32)continue;
        const q=[start];seen[start]=1;
        for(let j=0;j<q.length;j++){const i=q[j],x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
            if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
            const n=i+dy*w+dx;if(!seen[n]&&pixels[n*4+3]>32){seen[n]=1;q.push(n);}
        }}groups.push(q);
    }
    const largest=Math.max(0,...groups.map(g=>g.length));
    for(const group of groups)if(group.length<largest*.035)for(const i of group)pixels[i*4+3]=0;
    ctx.putImageData(data,0,0);
}
function bounds(c:HTMLCanvasElement){
    const p=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    return {x0,y0,x1,y1};
}
function cropped(c:HTMLCanvasElement){const b=bounds(c),out=canvas(b.x1-b.x0+1,b.y1-b.y0+1);out.getContext('2d')!.drawImage(c,b.x0,b.y0,out.width,out.height,0,0,out.width,out.height);return out;}
async function sheet(file:string,cols:number,rows:number,kind:'texture'|'prop'|'hero'|'slime'|'effect'){
    const img=await load('/art/'+file),cells:HTMLCanvasElement[]=[];
    const layout=heroLayouts[file],tool=layout?undefined:file.match(/^hero-(axe|pick|sword)/)?.[1] as keyof typeof toolFrames|undefined;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const bands=file==='landscape-props-v3.png'?[0,550/img.height,1]:file==='objects-final.png'?[0,.358,.559,.777,1]:file==='icons-final.png'?[0,.27,.50,.718,1]:Array.from({length:rows+1},(_,i)=>i/rows);
        const startY=Math.round(bands[row]*img.height),endY=Math.round(bands[row+1]*img.height);
        const columns=file==='landscape-props-v3.png'?[0,480,880,1345,img.width]:Array.from({length:cols+1},(_,i)=>Math.round(i*img.width/cols));
        const standard=[columns[col],startY,columns[col+1]-columns[col],endY-startY];
        const [x,y,w,h]=layout?.frames[row*cols+col]??(tool?toolFrames[tool][row*cols+col]:standard),inset=layout?.inset??(kind==='texture'?1:2);
        const c=canvas(w-inset*2,h-inset*2);c.getContext('2d')!.drawImage(img,x+inset,y+inset,c.width,c.height,0,0,c.width,c.height);
        if(kind!=='texture')transparentMatte(c,file==='landscape-props-v3.png'||file==='landscape-landmarks-v3.png',file==='landscape-landmarks-v3.png'&&row===0&&col===1);
        if(kind==='hero')cleanFragments(c);
        cells.push(kind==='prop'?cropped(c):c);
    }
    if(kind==='hero'&&layout){
        cells.forEach((c,i)=>{
            const row=Math.floor(i/cols),out=detailCanvas(HERO_SIZE.width,HERO_SIZE.height),ctx=out.getContext('2d')!;
            ctx.imageSmoothingEnabled=false;
            if(layout.scaledCellSizes&&layout.scaledAnchors){
                const size=layout.scaledCellSizes[row],scaled=detailCanvas(size,size),scaledContext=scaled.getContext('2d')!;
                scaledContext.imageSmoothingEnabled=false;scaledContext.drawImage(c,0,0,size,size);
                const [ax,ay]=layout.scaledAnchors[i];ctx.drawImage(scaled,HERO_SIZE.anchorX-ax,HERO_SIZE.anchorY-ay,size,size);
            }else{
                const scale=(layout.targetHeight??31)/layout.bodyHeights[row],inset=layout.inset??2,[ax,ay]=layout.anchors[i];
                ctx.drawImage(c,Math.round(HERO_SIZE.anchorX-(ax-inset)*scale),Math.round(HERO_SIZE.anchorY-(ay-inset)*scale),c.width*scale,c.height*scale);
            }
            cells[i]=out;
        });
    }else if(kind==='hero'){
        // One scale per sequence preserves differences between poses and stable feet.
        for(let row=0;row<rows;row++){
            const group=cells.slice(row*cols,(row+1)*cols),boxes=group.map(bounds);
            const y0=Math.min(...boxes.map(b=>b.y0)),y1=Math.max(...boxes.map(b=>b.y1)),height=y1-y0+1;
            group.forEach((c,col)=>{const out=detailCanvas(HERO_SIZE.width,HERO_SIZE.height),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;const scale=tool?32/toolBodyHeights[tool][row]:32/height;
                const anchor=tool?toolAnchors[tool][row*cols+col][1]-2:file==='hero-motion.png'&&row<3?y1+1:boxes[col].y1+1;
                const anchorX=tool?toolAnchors[tool][row*cols+col][0]:baseAnchorX[file]?.[row*cols+col];
                const correction=file==='hero-walk.png'&&row===2?[-1.5,-.5,0,.5,.5,0,0,1.5][col]:file==='hero-motion.png'&&row===0&&col===7?2:file==='hero-motion.png'&&row===2&&col===3?-3.5:0;
                const drawX=(anchorX===undefined?(HERO_SIZE.width-c.width*scale)/2:HERO_SIZE.anchorX-(anchorX-2)*scale)+correction;
                ctx.drawImage(c,drawX,HERO_SIZE.anchorY-anchor*scale,c.width*scale,c.height*scale);cells[row*cols+col]=out;});
        }
    }
    if(kind==='slime')cells.forEach((c,i)=>{
        const out=detailCanvas(SLIME_SIZE.width,SLIME_SIZE.height),ctx=out.getContext('2d')!,scale=40/218,[x,y]=slimeAnchors[i];
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(c,SLIME_SIZE.anchorX-(x-2)*scale,SLIME_SIZE.anchorY-(y-2)*scale,c.width*scale,c.height*scale);cells[i]=out;
    });
    return cells;
}
function idleFrames(base:HTMLCanvasElement,closed:HTMLCanvasElement,eyes:number[][]){
    const blink=detailCanvas(HERO_SIZE.width,HERO_SIZE.height),ctx=blink.getContext('2d')!;
    ctx.drawImage(base,0,0,HERO_SIZE.width,HERO_SIZE.height);
    // Copy only the eyelids from the original full-body sprite, at native scale.
    for(const [sx,sy,dx,dy] of eyes)ctx.drawImage(closed,sx*ART_DENSITY,sy*ART_DENSITY,2*ART_DENSITY,2*ART_DENSITY,dx,dy,2,2);
    return Array.from({length:HERO_IDLE_FRAME_COUNT},(_,frame)=>{
        const out=detailCanvas(HERO_SIZE.width,HERO_SIZE.height);
        const bob=Math.round(Math.sin(frame/HERO_IDLE_FRAME_COUNT*Math.PI*2)*.6);
        out.getContext('2d')!.drawImage(frame===27||frame===28?blink:base,0,bob,HERO_SIZE.width,HERO_SIZE.height);
        return out;
    });
}
async function creatureSheet(kind:string){
    const img=await load('/art/'+kind+'.png'),layout=creatureLayouts[kind];
    return layout.frames.map(([x,y,w,h],i)=>{
        const source=canvas(w,h);source.getContext('2d')!.drawImage(img,x,y,w,h,0,0,w,h);transparentMatte(source);
        const [sw,sh]=layout.scaledSizes?.[i]??[Math.round(w*layout.scale),Math.round(h*layout.scale)];
        const resized=detailCanvas(sw,sh),rc=resized.getContext('2d')!;rc.imageSmoothingEnabled=false;rc.drawImage(source,0,0,sw,sh);
        const [ax,ay]=layout.scaledAnchors?.[i]??layout.anchors[i].map(v=>Math.round(v*layout.scale));
        const out=detailCanvas(layout.size[0],layout.size[1]);out.getContext('2d')!.drawImage(resized,layout.anchor[0]-ax,layout.anchor[1]-ay,sw,sh);return out;
    });
}
async function creatureDirections(kind:'boar'|'mushroom'){
    const img=await load('/art/'+kind+'-directions.png');
    // Measured row bands: generated row spacing is not an exact eighth.
    const rows=kind==='boar'?[[58,156],[209,309],[365,466],[513,620],[644,769],[787,923],[936,1063],[1091,1212]]:[[46,163],[204,322],[351,482],[530,636],[673,789],[821,943],[963,1087],[1124,1232]];
    const cells=rows.flatMap(([top,bottom])=>Array.from({length:8},(_,col)=>{
        const x=Math.round(col*img.width/8),width=Math.round((col+1)*img.width/8)-x,c=canvas(width,bottom-top+5);
        c.getContext('2d')!.drawImage(img,x,top-2,c.width,c.height,0,0,c.width,c.height);transparentMatte(c);cleanFragments(c);return c;
    })),boxes=cells.map(bounds);
    const bodyBoxes=boxes.filter((_,i)=>Math.floor(i/8)%4<3);
    const scale=(kind==='boar'?29:25)/Math.max(...bodyBoxes.map(b=>Math.max(b.x1-b.x0+1,b.y1-b.y0+1)));
    // One scale for the entire sheet. Register feet without resizing each pose.
    return cells.map((cell,i)=>{
        const out=detailCanvas(SLIME_SIZE.width,SLIME_SIZE.height),ctx=out.getContext('2d')!;
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(cell,Math.round(SLIME_SIZE.anchorX-cell.width*scale/2),Math.round(SLIME_SIZE.anchorY-(boxes[i].y1+1)*scale),cell.width*scale,cell.height*scale);
        return out;
    });
}
let cached:Promise<Atlas>|undefined;
export function loadArt(){
    if(cached)return cached;
    const attempt=beginAssets();
    cached=loadAll().then(art=>{finishAssets(attempt);return art;}).catch(error=>{
        if(getAssetLoading().attempt===attempt){cached=undefined;failAssets(attempt,error);}throw error;
    });
    return cached;
}
async function loadAll():Promise<Atlas>{
    const extraActions=['harvest','pickup','eat','fish','cook','sleep','roll'] as const;
    const [materials,objects,icons,walk,oldWalk,motion,axe,pick,sword,slime,entrance,hurt,fire,flames,trails,textures,farm,home,bat,boar,mushroom,hammer,hoe,water,plant,mineExit,boarDirections,mushroomDirections,activityItems,extraSheets,beds]=await Promise.all([
        sheet('surfaces-final.png',4,4,'texture'),sheet('objects-final.png',4,4,'prop'),sheet('icons-final.png',4,4,'prop'),
        sheet('hero-walk-v2.png',8,3,'hero'),sheet('hero-walk.png',8,4,'hero'),sheet('hero-motion.png',8,4,'hero'),sheet('hero-axe-v3.png',8,3,'hero'),sheet('hero-pick-v3.png',8,3,'hero'),sheet('hero-sword-v3.png',8,3,'hero'),sheet('slime.png',8,4,'slime'),load('/art/cave-entrance.png'),sheet('hero-hurt-directions.png',8,2,'hero'),sheet('campfire-v2.png',4,3,'effect'),sheet('campfire-flames-24.png',6,4,'effect'),sheet('tool-trails.png',8,3,'effect'),sheet('homestead-textures-v2.png',3,2,'texture'),load('/art/farm-growth.png'),sheet('homestead-items.png',4,4,'prop'),creatureSheet('bat'),creatureSheet('boar'),creatureSheet('mushroom'),sheet('hero-hammer.png',8,3,'hero'),sheet('hero-hoe.png',8,3,'hero'),sheet('hero-water.png',8,3,'hero'),sheet('hero-plant.png',8,3,'hero'),load('/art/mine-exit.png')
        ,creatureDirections('boar'),creatureDirections('mushroom'),sheet('activity-items.png',2,2,'prop'),Promise.all(extraActions.map(action=>sheet(`hero-${action}.png`,8,3,'hero'))),sheet('bed-horizontal.png',1,1,'prop')
    ]);
    const art={} as Atlas;
    const assign=(names:Sprite[],cells:HTMLCanvasElement[])=>names.forEach((name,i)=>art[name]=cells[i]);
    const [landTextures,landProps,landmarks]=await Promise.all([sheet('landscape-terrain-v3.png',4,3,'texture'),sheet('landscape-props-v3.png',4,2,'prop'),sheet('landscape-landmarks-v3.png',2,2,'prop')]);
    assign(['region-oak','region-birch','region-maple','region-snowpine','region-berry','region-stone','flowers-white','flowers-pink'],landProps);
    assign(['ancient-oak','frost-cairn','sunstone-circle','firefly-meadow'],landmarks);
    assign(['rod','fish','meal','bed'],activityItems);
    art.bed=beds[0];
    assign(['ground-grass','ground-forest','ground-path','ground-sand','ground-rock','ground-snow','ground-marsh','ground-water','floor','roof','plaster','ground-cave-floor','ground-cave-wall','beam','bridge','foundation'],materials);
    assign(['ground-grass','ground-forest','ground-water','ground-sand','ground-rock','ground-snow','ground-marsh','ground-path','ground-cave-floor','ground-cave-wall','ground-meadow','ground-moss'],landTextures);
    assign(['tree','pine','stone','copper','berry','stump','daisies','reeds','wall','window','door','door-open','fire0','fire1','fire2','chest'],objects);
    assign(['wall-face','wall-cap','roof','roof-ridge','soil-dry','soil-wet'],textures);
    assign(['hammer','hoe','water','seed-bag','stairs','stairs-down','ascend','descend','planter','fence','lantern','sign','carrot-seed','tomato-seed','wheat-seed','water-drop'],home);
    const farmCells=farmLayout.frames.map(([x,y,w,h])=>{const c=canvas(w,h);c.getContext('2d')!.drawImage(farm,x,y,w,h,0,0,w,h);transparentMatte(c);return c;});
    assign(['carrot','tomato','wheat'],farmCells.slice(12,15).map(cropped));
    for(const [row,crop]of(['carrot','tomato','wheat'] as const).entries()){
        const scale=farmLayout.rowScales[row];
        for(let f=0;f<4;f++){const i=row*4+f,c=farmCells[i],[ax,ay]=farmLayout.anchors[i],out=detailCanvas(CROP_SIZE.width,CROP_SIZE.height),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(c,Math.round(CROP_SIZE.anchorX-ax*scale),Math.round(CROP_SIZE.anchorY-ay*scale),c.width*scale,c.height*scale);art[`crop-${crop}-${f}`]=out;}
    }
    for(const [kind,cells]of [['bat',bat],['boar',boar],['mushroom',mushroom]] as const){for(let row=0;row<3;row++)for(let f=0;f<8;f++)art[`${kind}-${(['idle','move','attack'] as const)[row]}-${f}`]=cells[row*8+f];for(let f=0;f<4;f++){art[`${kind}-hurt-${f}`]=cells[24+f];art[`${kind}-death-${f}`]=cells[28+f];}}
    for(const [kind,cells]of [['boar',boarDirections],['mushroom',mushroomDirections]] as const)for(const [direction,dir]of(['right','up'] as const).entries()){
        const start=direction*32;
        for(let row=0;row<3;row++)for(let f=0;f<8;f++)art[`${kind}-${dir}-${(['idle','move','attack'] as const)[row]}-${f}`]=cells[start+row*8+f];
        for(let f=0;f<4;f++){art[`${kind}-${dir}-hurt-${f}`]=cells[start+24+f];art[`${kind}-${dir}-death-${f}`]=cells[start+28+f];}
    }
    const base=detailCanvas(FIRE_SIZE.width,FIRE_SIZE.height),baseContext=base.getContext('2d')!,baseScale=34/263;
    baseContext.imageSmoothingEnabled=false;
    baseContext.drawImage(fire[0],FIRE_SIZE.anchorX-(184-2)*baseScale,FIRE_SIZE.anchorY-(343-2)*baseScale,fire[0].width*baseScale,fire[0].height*baseScale);
    // Register the fire root, not the changing silhouette or detached sparks.
    const flameRoots=[
        [127,246],[127,244],[129,246],[126,245],[130,245],[131,244],
        [123,241],[128,241],[128,241],[125.5,242],[130,244],[130,243],
        [127,231],[127,231],[126,230],[128,231],[130,231],[131,231],
        [126,213],[126,214],[127,213],[129,213],[130,214],[130,213]
    ];
    flameRoots.forEach(([x,y],i)=>{
        const out=detailCanvas(FIRE_SIZE.width,FIRE_SIZE.height),ctx=out.getContext('2d')!,flame=flames[i],scale=.116;
        ctx.imageSmoothingEnabled=false;ctx.drawImage(base,0,0,FIRE_SIZE.width,FIRE_SIZE.height);
        ctx.drawImage(flame,32-(x-2)*scale,45-(y-2)*scale,flame.width*scale,flame.height*scale);
        art[`fire${i}`]=out;
    });
    assign(['axe','pick','sword','remove','wood','stone-icon','copper-icon','essence','heart','stamina','map','room','torch','tuft','mushrooms','spark'],icons);
    for(const [row,tool] of (['sword','axe','pick'] as const).entries())for(let f=0;f<8;f++)art[`trail-${tool}-${f}`]=trails[row*8+f];
    for(const [row,dir] of (['down','up','right'] as const).entries())for(let f=0;f<8;f++){
        art[frameKey('walk',dir,f)]=walk[row*8+f];art[frameKey('hurt',dir,f)]=oldWalk[24+f];art[frameKey('dodge',dir,f)]=motion[row*8+f];
        art[frameKey('axe',dir,f)]=axe[row*8+f];art[frameKey('pick',dir,f)]=pick[row*8+f];art[frameKey('sword',dir,f)]=sword[row*8+(heroLayouts['hero-sword-v3.png'].order?.[row]?.[f]??f)];
    }
    for(const [action,cells]of [['hammer',hammer],['hoe',hoe],['water',water],['plant',plant]] as const)for(const [row,dir]of(['down','up','right'] as const).entries())for(let f=0;f<8;f++)art[frameKey(action,dir,f)]=cells[row*8+(heroLayouts[`hero-${action}.png`]?.order?.[row]?.[f]??f)];
    extraActions.forEach((action,i)=>{for(const [row,dir]of(['down','up','right'] as const).entries())for(let f=0;f<8;f++)art[frameKey(action==='roll'?'dodge':action,dir,f)]=extraSheets[i][row*8+f];});
    for(let f=0;f<8;f++){art[frameKey('hurt','up',f)]=hurt[f];art[frameKey('hurt','right',f)]=hurt[8+f];}
    const idle={
        down:idleFrames(motion[24],motion[26],[[29,27,29,26],[33,27,34,26]]),
        up:idleFrames(motion[28],motion[28],[]),
        right:idleFrames(motion[30],motion[31],[[34,25,34,24]])
    };
    for(const dir of ['down','up','right'] as const)idle[dir].forEach((frame,i)=>art[frameKey('idle',dir,i)]=frame);
    for(let row=0;row<3;row++)for(let f=0;f<8;f++)art[`slime-${(['idle','move','attack'] as const)[row]}-${f}`]=slime[row*8+f];
    for(let f=0;f<4;f++){art[`slime-hurt-${f}`]=slime[24+f];art[`slime-death-${f}`]=slime[28+f];}
    const c=canvas(entrance.width,entrance.height);c.getContext('2d')!.drawImage(entrance,0,0);transparentMatte(c);art['cave-entrance']=cropped(c);
    const exit=canvas(mineExit.width,mineExit.height);exit.getContext('2d')!.drawImage(mineExit,0,0);transparentMatte(exit);art['mine-exit']=cropped(exit);
    art.down=art['idle-down-0'];art.up=art['idle-up-0'];art.right=art['idle-right-0'];art.slime=art['slime-idle-0'];art.wildflowers=art.daisies;
    return art;
}
export function paintIcon(ctx:CanvasRenderingContext2D,name:string,art:Atlas|undefined,size:number){
    ctx.clearRect(0,0,size,size);ctx.imageSmoothingEnabled=false;
    const key=({build:'wall',stone:'stone-icon',copper:'copper-icon'} as Record<string,Sprite>)[name]||name as Sprite;
    const sprite=art?.[key];if(!sprite)return;
    const scale=Math.min((size-4)/sprite.width,(size-4)/sprite.height);
    ctx.drawImage(sprite,Math.round((size-sprite.width*scale)/2),Math.round((size-sprite.height*scale)/2),Math.round(sprite.width*scale),Math.round(sprite.height*scale));
}
