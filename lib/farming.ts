export type CropKind='carrot'|'tomato'|'wheat';
export type SeedKind='carrotSeed'|'tomatoSeed'|'wheatSeed';
export type Plot={x:number;y:number;crop?:CropKind;progress:number;updated:number;wetUntil:number};
export const CROPS:Record<CropKind,{name:string;seed:SeedKind;seconds:number;yield:number;food:number}>={
    carrot:{name:'胡萝卜',seed:'carrotSeed',seconds:90,yield:3,food:12},
    tomato:{name:'番茄',seed:'tomatoSeed',seconds:120,yield:4,food:10},
    wheat:{name:'小麦',seed:'wheatSeed',seconds:150,yield:4,food:0},
};
export const FARM_WATER_MS=100000;
export const plotKey=(x:number,y:number)=>`${x}:${y}`;
export function cropProgress(plot:Plot,time:number){
    if(!plot.crop)return 0;
    const extra=Math.max(0,Math.min(time,plot.wetUntil)-plot.updated)/1000;
    return Math.min(CROPS[plot.crop].seconds,plot.progress+extra);
}
export function cropStage(plot:Plot,time:number){
    if(!plot.crop)return 0;
    const fraction=cropProgress(plot,time)/CROPS[plot.crop].seconds;
    return fraction>=1?3:fraction>=.5?2:fraction>=.16?1:0;
}
export function growPlot(plot:Plot,time:number){
    plot.progress=cropProgress(plot,time);plot.updated=Math.max(plot.updated,time);
}
