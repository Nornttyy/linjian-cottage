import type {Sprite} from './art';
import type {Pixels} from './hero-appearance';
import {heroFrameOffset} from './hero-registration';

type Segment=readonly [number,number,number,number];
// Reviewed rod tips and grips in the existing 128px action buffers.
// The rod touches the hair in several poses, so colour connectivity cannot
// distinguish the two materials. Rows are down, up, right; columns are poses.
const RODS:Record<'male'|'female',readonly (readonly Segment[])[]>={
    male:[
        [[79,52,68,70],[53,35,47,51],[111,43,81,64],[105,48,78,62],[91,55,72,68],[94,47,76,64],[83,31,77,61],[79,52,69,68]],
        [[50,45,55,61],[55,32,56,51],[113,39,89,56],[112,44,89,55],[89,51,77,62],[98,44,84,60],[56,32,58,50],[51,48,55,61]],
        [[87,38,77,63],[59,32,55,52],[114,41,90,60],[115,42,89,59],[97,54,81,65],[98,43,80,61],[94,31,82,53],[86,42,78,61]],
    ],
    female:[
        [[81,52,69,71],[50,35,45,56],[112,43,84,62],[109,47,83,60],[94,55,77,68],[103,48,86,64],[95,29,83,62],[90,52,79,70]],
        [[50,48,54,59],[52,32,55,49],[112,40,92,55],[115,43,94,53],[93,51,83,59],[105,45,91,58],[65,32,67,49],[89,51,83,58]],
        [[90,40,80,61],[57,32,50,50],[113,41,91,56],[115,42,90,57],[101,54,82,67],[106,44,89,60],[103,30,92,56],[98,48,90,65]],
    ],
};
export function fishingRod(frame:Sprite,body:'male'|'female'):Segment|undefined{
    const match=frame.match(/^fish-(down|up|right)-(\d+)$/);if(!match)return;
    return RODS[body][['down','up','right'].indexOf(match[1])][Number(match[2])%8];
}
/** Follow small authored pose shifts without treating the whole hair mass as wood. */
export function authoredFishingRod(p:Pixels,frame:Sprite,body:'male'|'female'):Segment|undefined{
    const base=fishingRod(frame,body);if(!base)return;
    const [tx,ty,gx,gy]=base,vx=tx-gx,vy=ty-gy,length=Math.hypot(vx,vy);
    const wood=(x:number,y:number)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=p.width||y>=p.height)return false;const k=(y*p.width+x)*4,[r,g,b,a]=p.data.subarray(k,k+4);return a>=128&&r>g*1.08&&g>b*1.12&&g<185;};
    let best=base,score=-Infinity;
    for(let dy=-10;dy<=10;dy++)for(let dx=-10;dx<=10;dx++){
        let hits=0,misses=0;
        // The outer half of a pole is clear of hands and hair in the casting
        // poses. It gives a stable registration for the rest of the shaft.
        for(let step=0;step<=Math.ceil(length*.65);step++){
            const x=Math.round(tx+dx-vx/length*step),y=Math.round(ty+dy-vy/length*step);
            if(x<0||y<0||x>=p.width||y>=p.height)continue;
            if(wood(x,y))hits+=wood(x-vy/length*3,y+vx/length*3)&&wood(x+vy/length*3,y-vx/length*3)?-.8:1;else misses++;
        }
        const value=hits-misses*.65-Math.hypot(dx,dy)*.12;
        if(value>score){score=value;best=[tx+dx,ty+dy,gx+dx,gy+dy];}
    }return score>3?best:undefined;
}
export function fishingRodPixel(p:Pixels,i:number,rod:Segment|undefined,authored=false){
    if(!rod)return false;
    const [tx,ty,gx,gy]=rod,x=i%p.width*128/p.width,y=Math.floor(i/p.width)*128/p.height;
    const dx=gx-tx,dy=gy-ty,length=dx*dx+dy*dy,t=((x-tx)*dx+(y-ty)*dy)/length;
    if(t<-.06||t>1.03||(x-tx-t*dx)**2+(y-ty-t*dy)**2>3.2)return false;
    const [r,g,b,a]=p.data.subarray(i*4,i*4+4);
    if(authored){
        const len=Math.sqrt(length),wide=[-3,3].every(n=>{
            const xx=Math.round(x-dy/len*n),yy=Math.round(y+dx/len*n);if(xx<0||yy<0||xx>=p.width||yy>=p.height)return false;
            const k=(yy*p.width+xx)*4,[rr,gg,bb,aa]=p.data.subarray(k,k+4);return aa>=128&&rr>gg*1.08&&gg>bb*1.12&&gg<185;
        });if(wide)return false;
    }
    return a>=128&&r>g*1.04&&g>b*1.06;
}
/** The live line runs from this tip to the actual bobber, including left mirroring. */
export function fishingLineOrigin(frame:Sprite,body:'male'|'female',left=false){
    const rod=fishingRod(frame,body);if(!rod)return {x:0,y:-24};
    const [dx,dy]=heroFrameOffset(frame,body);
    return {x:((rod[0]+dx)/2-32)*(left?-1:1),y:(rod[1]+dy)/2-48};
}
export function removeBakedFishingLine(p:Pixels,frame:Sprite,body:'male'|'female'){
    const rod=fishingRod(frame,body),pose=Number(frame.split('-').at(-1));if(!rod||pose<2||pose>6)return;
    for(let i=0;i<p.width*p.height;i++){
        const x=i%p.width*128/p.width,y=Math.floor(i/p.width)*128/p.height,k=i*4;
        const [r,g,b,a]=p.data.subarray(k,k+4);
        if(a&&x>rod[0]+1&&y>=rod[1]&&(rod[0]>75||Math.min(r,g,b)>150&&Math.max(r,g,b)-Math.min(r,g,b)<70))p.data[k+3]=0;
    }
}
