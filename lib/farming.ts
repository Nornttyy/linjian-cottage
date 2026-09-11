export type CropKind='carrot'|'tomato'|'wheat';
export type SeedKind='carrotSeed'|'tomatoSeed'|'wheatSeed';
export type Plot={x:number;y:number;crop?:CropKind;progress:number;updated:number;wetUntil:number;drySince?:number};
export const CROPS:Record<CropKind,{name:string;seed:SeedKind;seconds:number;yield:number;food:number}>={
    carrot:{name:'胡萝卜',seed:'carrotSeed',seconds:90,yield:3,food:12},
    tomato:{name:'番茄',seed:'tomatoSeed',seconds:120,yield:4,food:10},
    wheat:{name:'小麦',seed:'wheatSeed',seconds:150,yield:4,food:0},
};
export const FARM_WATER_MS=100000;
export const SOIL_RECOVERY_MS=60000;
// Empty soil recovers on its own clock. Old saves fall back to their last
// recorded soil activity; rendering never starts or changes that clock.
export function soilRecovery(plot:Readonly<Plot>,time:number){
    if(plot.crop||time<plot.wetUntil)return 0;
    const since=plot.drySince??Math.max(plot.updated,plot.wetUntil);
    return Math.max(0,Math.min(1,(time-since)/SOIL_RECOVERY_MS));
}
export function soilOpacity(plot:Readonly<Plot>,time:number){return 1-soilRecovery(plot,time);}
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
    // Pin the legacy fallback before updated advances, including repeated ticks.
    if(plot.crop)delete plot.drySince;
    else plot.drySince??=Math.max(plot.updated,plot.wetUntil);
    plot.progress=cropProgress(plot,time);plot.updated=Math.max(plot.updated,time);
}
