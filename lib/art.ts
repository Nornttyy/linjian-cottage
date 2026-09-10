import type { Terrain } from './world';
import {toolFrames,toolAnchors,toolBodyHeights,baseAnchorX} from './frame-layout';
export type Direction='down'|'up'|'right';
export type HeroAction='idle'|'walk'|'hurt'|'dodge'|'axe'|'pick'|'sword';
export type Sprite='tree'|'pine'|'stone'|'copper'|'berry'|'stump'|'daisies'|'wildflowers'|'reeds'|'wall'|'window'|'door'|'door-open'|'fire0'|'fire1'|'fire2'|'chest'|'floor'|'roof'|'plaster'|'beam'|'bridge'|'foundation'|'cave-entrance'|'axe'|'pick'|'sword'|'remove'|'wood'|'stone-icon'|'copper-icon'|'essence'|'heart'|'stamina'|'map'|'room'|'torch'|'tuft'|'mushrooms'|'spark'|'down'|'up'|'right'|'slime'|`ground-${Terrain}`|`${HeroAction}-${Direction}-${number}`|`slime-${'idle'|'move'|'attack'|'hurt'|'death'}-${number}`;
export type Atlas=Record<Sprite,HTMLCanvasElement>;
export const HERO_SIZE={width:64,height:64,anchorX:32,anchorY:48};
export const frameKey=(action:HeroAction,direction:Direction,frame:number)=>`${action}-${direction}-${frame}` as Sprite;
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c;};
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('素材加载失败'));img.src='.'+src;});
function transparentMatte(c:HTMLCanvasElement){
    const ctx=c.getContext('2d',{willReadFrequently:true})!,data=ctx.getImageData(0,0,c.width,c.height),p=data.data,w=c.width,h=c.height;
    let transparent=0;for(let i=3;i<p.length;i+=4)if(p[i]<8)transparent++;
    if(transparent>w*h*.02)return;
    // Decode the actual backdrop color; gray tool highlights are not magenta matte.
    const magenta=(r:number,g:number,b:number)=>r>90&&b>90&&g<Math.min(r,b)*.55&&r<b*1.65&&b<r*1.65;
    const gray=(r:number,g:number,b:number)=>Math.min(r,g,b)>145&&Math.max(r,g,b)-Math.min(r,g,b)<28;
    let magentaEdge=0,grayEdge=0;
    const sample=(i:number)=>{const k=i*4;if(magenta(p[k],p[k+1],p[k+2]))magentaEdge++;if(gray(p[k],p[k+1],p[k+2]))grayEdge++;};
    for(let x=0;x<w;x++){sample(x);sample((h-1)*w+x);}for(let y=1;y<h-1;y++){sample(y*w);sample(y*w+w-1);}
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
async function sheet(file:string,cols:number,rows:number,kind:'texture'|'prop'|'hero'|'slime'){
    const img=await load('/art/'+file),cells:HTMLCanvasElement[]=[];
    const tool=file.match(/^hero-(axe|pick|sword)/)?.[1] as keyof typeof toolFrames|undefined;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const bands=file==='objects-final.png'?[0,.358,.559,.777,1]:file==='icons-final.png'?[0,.27,.50,.718,1]:[0,1/rows,2/rows,3/rows,1];
        const startY=Math.round(bands[row]*img.height),endY=Math.round(bands[row+1]*img.height);
        const standard=[Math.round(col*img.width/cols),startY,Math.round((col+1)*img.width/cols)-Math.round(col*img.width/cols),endY-startY];
        const [x,y,w,h]=tool?toolFrames[tool][row*cols+col]:standard,inset=kind==='texture'?1:2;
        const c=canvas(w-inset*2,h-inset*2);c.getContext('2d')!.drawImage(img,x+inset,y+inset,c.width,c.height,0,0,c.width,c.height);
        if(kind!=='texture')transparentMatte(c);
        if(kind==='hero')cleanFragments(c);
        cells.push(kind==='prop'?cropped(c):c);
    }
    if(kind==='hero'){
        // One scale per sequence preserves differences between poses and stable feet.
        for(let row=0;row<rows;row++){
            const group=cells.slice(row*cols,(row+1)*cols),boxes=group.map(bounds);
            const y0=Math.min(...boxes.map(b=>b.y0)),y1=Math.max(...boxes.map(b=>b.y1)),height=y1-y0+1;
            group.forEach((c,col)=>{const out=canvas(HERO_SIZE.width,HERO_SIZE.height),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;const scale=tool?32/toolBodyHeights[tool][row]:32/height;
                const anchor=tool?toolAnchors[tool][row*cols+col][1]-2:file==='hero-motion.png'&&row<3?y1+1:boxes[col].y1+1;
                const anchorX=tool?toolAnchors[tool][row*cols+col][0]:baseAnchorX[file]?.[row*cols+col];
                const correction=file==='hero-walk.png'&&row===2?[-1.5,-.5,0,.5,.5,0,0,1.5][col]:file==='hero-motion.png'&&row===0&&col===7?2:file==='hero-motion.png'&&row===2&&col===3?-3.5:0;
                const drawX=(anchorX===undefined?(HERO_SIZE.width-c.width*scale)/2:HERO_SIZE.anchorX-(anchorX-2)*scale)+correction;
                ctx.drawImage(c,drawX,HERO_SIZE.anchorY-anchor*scale,c.width*scale,c.height*scale);cells[row*cols+col]=out;});
        }
    }
    if(kind==='slime')cells.forEach((c,i)=>{const out=canvas(40,40),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(c,0,0,40,40);cells[i]=out;});
    return cells;
}
let cached:Promise<Atlas>|undefined;
export function loadArt(){return cached??=loadAll();}
async function loadAll():Promise<Atlas>{
    const [materials,objects,icons,walk,motion,axe,pick,sword,slime,entrance,hurt]=await Promise.all([
        sheet('surfaces-final.png',4,4,'texture'),sheet('objects-final.png',4,4,'prop'),sheet('icons-final.png',4,4,'prop'),
        sheet('hero-walk.png',8,4,'hero'),sheet('hero-motion.png',8,4,'hero'),sheet('hero-axe-v2.png',8,3,'hero'),sheet('hero-pick-v2.png',8,3,'hero'),sheet('hero-sword-v2.png',8,3,'hero'),sheet('slime.png',8,4,'slime'),load('/art/cave-entrance.png'),sheet('hero-hurt-directions.png',8,2,'hero')
    ]);
    const art={} as Atlas;
    const assign=(names:Sprite[],cells:HTMLCanvasElement[])=>names.forEach((name,i)=>art[name]=cells[i]);
    assign(['ground-grass','ground-forest','ground-path','ground-sand','ground-rock','ground-snow','ground-marsh','ground-water','floor','roof','plaster','ground-cave-floor','ground-cave-wall','beam','bridge','foundation'],materials);
    assign(['tree','pine','stone','copper','berry','stump','daisies','reeds','wall','window','door','door-open','fire0','fire1','fire2','chest'],objects);
    assign(['axe','pick','sword','remove','wood','stone-icon','copper-icon','essence','heart','stamina','map','room','torch','tuft','mushrooms','spark'],icons);
    for(const [row,dir] of (['down','up','right'] as const).entries())for(let f=0;f<8;f++){
        art[frameKey('walk',dir,f)]=walk[row*8+f];art[frameKey('hurt',dir,f)]=walk[24+f];art[frameKey('dodge',dir,f)]=motion[row*8+f];
        art[frameKey('axe',dir,f)]=axe[row*8+f];art[frameKey('pick',dir,f)]=pick[row*8+f];art[frameKey('sword',dir,f)]=sword[row*8+(dir==='up'?[0,2,1,3,4,5,6,7][f]:f)];
    }
    for(let f=0;f<4;f++)art[frameKey('idle','down',f)]=motion[24+f];
    for(let f=0;f<8;f++){art[frameKey('hurt','up',f)]=hurt[f];art[frameKey('hurt','right',f)]=hurt[8+f];}
    for(let f=0;f<2;f++){art[frameKey('idle','up',f)]=motion[28+f];art[frameKey('idle','right',f)]=motion[30+f];}
    for(let row=0;row<3;row++)for(let f=0;f<8;f++)art[`slime-${(['idle','move','attack'] as const)[row]}-${f}`]=slime[row*8+f];
    for(let f=0;f<4;f++){art[`slime-hurt-${f}`]=slime[24+f];art[`slime-death-${f}`]=slime[28+f];}
    const c=canvas(entrance.width,entrance.height);c.getContext('2d')!.drawImage(entrance,0,0);transparentMatte(c);art['cave-entrance']=cropped(c);
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
