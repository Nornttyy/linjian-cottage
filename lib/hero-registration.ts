import type {Sprite} from './art';

// Reviewed sole pivots of the independently drawn female sheets, in native
// 128 px buffers. Those sheets drift inside the older male atlas coordinates.
// Translate the completed sprite once; never stretch a face or individual pose.
const FEMALE_OFFSETS:Record<string,readonly (readonly (readonly [number,number])[])[]>={"fish":[[[-2,0],[-1,1],[-10,0],[-6,1],[-6,0],[-10,0],[-10,0],[-12,1]],[[0,0],[-5,0],[-10,-2],[-10,0],[-6,0],[-14,0],[-16,0],[-14,0]],[[-4,0],[-6,0],[-11,0],[-10,0],[-8,0],[-12,0],[-16,0],[-16,0]]],"cook":[[[6,0],[2,0],[2,0],[0,0],[-3,0],[-2,0],[-4,0],[-7,0]],[[6,1],[4,1],[4,1],[0,1],[-2,1],[-2,1],[-4,1],[-6,1]],[[2,2],[0,2],[0,2],[-2,2],[-4,2],[-5,2],[-6,2],[-9,2]]]};
export function heroFrameOffset(frame:Sprite,body:'male'|'female'):readonly [number,number]{
    if(body!=='female')return [0,0];
    const match=frame.match(/^(fish|cook)-(down|up|right)-(\d+)$/);
    return match?FEMALE_OFFSETS[match[1]][['down','up','right'].indexOf(match[2])][Number(match[3])%8]:[0,0];
}
const aligned=new WeakMap<HTMLCanvasElement,HTMLCanvasElement>();
export function alignHeroFrame(source:HTMLCanvasElement,frame:Sprite,body:'male'|'female'){
    const [dx,dy]=heroFrameOffset(frame,body);if(!dx&&!dy)return source;
    const cached=aligned.get(source);if(cached)return cached;
    const out=document.createElement('canvas');out.width=source.width;out.height=source.height;
    const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(source,Math.round(dx*source.width/128),Math.round(dy*source.height/128));
    aligned.set(source,out);return out;
}
