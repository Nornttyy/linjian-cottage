export const DAY_LENGTH_MS=12*60*1000;
export const DAY_START_MINUTE=8*60;
export type DayPhase='dawn'|'day'|'dusk'|'night';
export type WorldClock={day:number;minuteOfDay:number;hour:number;minute:number;phase:DayPhase;daylight:number;night:number;dawn:number;dusk:number};
const mod=(value:number,size:number)=>((value%size)+size)%size;
const smooth=(value:number)=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
export function worldClock(origin:number,now:number):WorldClock{
    const start=Number.isFinite(origin)?origin:now,elapsed=Number.isFinite(now)?now-start:0;
    const totalMinutes=DAY_START_MINUTE+elapsed/DAY_LENGTH_MS*1440,minuteOfDay=mod(totalMinutes,1440);
    const day=Math.max(1,Math.floor(totalMinutes/1440)+1),hour=Math.floor(minuteOfDay/60),minute=Math.floor(minuteOfDay-hour*60);
    let phase:DayPhase,daylight=0,dawn=0,dusk=0;
    if(minuteOfDay>=300&&minuteOfDay<420){
        phase='dawn';const progress=(minuteOfDay-300)/120;daylight=smooth(progress);dawn=Math.sin(progress*Math.PI);
    }else if(minuteOfDay>=420&&minuteOfDay<1080){phase='day';daylight=1;
    }else if(minuteOfDay>=1080&&minuteOfDay<1200){
        phase='dusk';const progress=(minuteOfDay-1080)/120;daylight=1-smooth(progress);dusk=Math.sin(progress*Math.PI);
    }else phase='night';
    return{day,minuteOfDay,hour,minute,phase,daylight,night:1-daylight,dawn,dusk};
}
export function formatWorldClock(clock:WorldClock){
    const rounded=Math.floor(clock.minuteOfDay/10)*10,hour=Math.floor(rounded/60)%24,minute=rounded%60;
    return`第${clock.day}天 ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}
export function clockDateTime(clock:WorldClock){
    const rounded=Math.floor(clock.minuteOfDay/10)*10;
    return`${String(Math.floor(rounded/60)%24).padStart(2,'0')}:${String(rounded%60).padStart(2,'0')}`;
}
export const phaseName=(phase:DayPhase)=>({dawn:'清晨',day:'白天',dusk:'黄昏',night:'夜晚'} as const)[phase];
