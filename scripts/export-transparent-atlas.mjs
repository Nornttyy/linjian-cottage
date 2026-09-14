// Export generated artwork without its accidentally painted neutral checkerboard.
// Retained RGB pixels stay untouched. Food sprites are also translated into
// separated grid cells so smoke cannot be clipped by a neighboring row.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url),sharp=createRequire(require.resolve('next/package.json'))('sharp');
const [source,target,mode='food']=process.argv.slice(2);
if(!source||!target)throw Error('Usage: node scripts/export-transparent-atlas.mjs source.png target.png [food|hero]');
const {data,info}=await sharp(resolve(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const {width:w,height:h}=info,size=w*h,mask=new Uint8Array(size),seen=new Uint8Array(size),queue=new Int32Array(size);
let originalTransparent=0;for(let i=0;i<size;i++)if(data[i*4+3]<8)originalTransparent++;
if(originalTransparent>size*.2){
    mkdirSync(dirname(resolve(target)),{recursive:true});
    await sharp(resolve(source)).png({compressionLevel:9}).toFile(resolve(target));
    console.log(JSON.stringify({source,target,width:w,height:h,transparent:originalTransparent,preservedGeneratedAlpha:true}));
    process.exit(0);
}
const magenta=(r,g,b)=>r>110&&b>100&&g<Math.min(r,b)*.45&&Math.abs(r-b)<80;
const keyed=mode==='hero'&&[0,w-1,(h-1)*w,size-1].filter(i=>magenta(data[i*4],data[i*4+1],data[i*4+2])).length>=3;
for(let i=0;i<size;i++){const k=i*4,r=data[k],g=data[k+1],b=data[k+2];mask[i]=(keyed?magenta(r,g,b):Math.min(r,g,b)>=75&&Math.max(r,g,b)-Math.min(r,g,b)<=25)?1:0;if(keyed&&mask[i])seen[i]=1;}
let head=0,tail=0;
function add(i){if(i<0||i>=size||seen[i]||!mask[i])return;seen[i]=1;queue[tail++]=i;}
for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
while(head<tail){const i=queue[head++],x=i%w;if(x)add(i-1);if(x<w-1)add(i+1);if(i>=w)add(i-w);if(i<size-w)add(i+w);}
let holes=0;
if(mode==='hero'&&!keyed){
    // Closed gaps inside bent arms or between a tool and the body can contain
    // the same regular checkerboard. Require repeated four-way alternation,
    // not merely gray, so gray steel highlights remain opaque.
    const visited=seen.slice();
    for(let start=0;start<size;start++){
        if(visited[start]||!mask[start])continue;
        let read=0,end=1;queue[0]=start;visited[start]=1;let checker=0;
        while(read<end){const i=queue[read++],x=i%w,y=Math.floor(i/w);
            if(x>=8&&x<w-8&&y>=8&&y<h-8){
                const neighbors=[i-8,i+8,i-8*w,i+8*w];
                if(neighbors.every(n=>mask[n])){const c=data[i*4],v=neighbors.map(n=>data[n*4]);if(Math.max(...v)-Math.min(...v)<18&&Math.abs(c-v.reduce((a,b)=>a+b)/4)>18)checker++;}
            }
            for(const n of [x?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i<size-w?i+w:-1])if(n>=0&&!visited[n]&&mask[n]){visited[n]=1;queue[end++]=n;}
        }
        if(end>=30&&checker>=Math.max(3,end*.012)){holes++;for(let n=0;n<end;n++)seen[queue[n]]=1;}
    }
}
let removed=0;for(let i=0;i<size;i++){if(seen[i]){data.fill(0,i*4,i*4+4);removed++;}else data[i*4+3]=255;}
if(removed<size*(mode==='hero'?.55:.2)||removed>size*.97)throw Error('Unexpected background coverage: '+removed/size);
let output=data;
if(mode==='food'){
    const visited=new Uint8Array(size),parts=[];
    for(let start=0;start<size;start++){
        if(visited[start]||!data[start*4+3])continue;
        let read=0,end=1,x0=w,y0=h,x1=0,y1=0;queue[0]=start;visited[start]=1;
        while(read<end){const i=queue[read++],x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,n=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!visited[n]&&data[n*4+3]){visited[n]=1;queue[end++]=n;}}
        }
        parts.push({pixels:Array.from(queue.subarray(0,end)),x0,y0,x1,y1});
    }
    const dishes=parts.filter(p=>p.pixels.length>20000);
    if(dishes.length!==9)throw Error('Expected nine separated plates, found '+dishes.length);
    const slot=p=>Math.min(2,Math.floor((p.y0+p.y1)/2/(h/3)))*3+Math.min(2,Math.floor((p.x0+p.x1)/2/(w/3)));
    dishes.sort((a,b)=>slot(a)-slot(b));
    if(new Set(dishes.map(slot)).size!==9)throw Error('Dishes do not occupy all nine cells');
    for(const part of parts.filter(p=>!dishes.includes(p))){const dish=dishes[slot(part)];dish.pixels.push(...part.pixels);dish.x0=Math.min(dish.x0,part.x0);dish.y0=Math.min(dish.y0,part.y0);dish.x1=Math.max(dish.x1,part.x1);dish.y1=Math.max(dish.y1,part.y1);}
    output=Buffer.alloc(data.length);
    dishes.forEach((dish,index)=>{const dx=Math.round((index%3+.5)*w/3-(dish.x0+dish.x1)/2),dy=Math.round((Math.floor(index/3)+.5)*h/3-(dish.y0+dish.y1)/2);
        for(const i of dish.pixels){const dest=((Math.floor(i/w)+dy)*w+i%w+dx)*4;data.copy(output,dest,i*4,i*4+4);}
    });
}
mkdirSync(dirname(resolve(target)),{recursive:true});await sharp(output,{raw:{width:w,height:h,channels:4}}).png({compressionLevel:9}).toFile(resolve(target));
console.log(JSON.stringify({source,target,width:w,height:h,transparent:removed,coverage:removed/size,closedBackgroundGaps:holes}));
