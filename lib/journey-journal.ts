// Durable action evidence belongs to the player in this world. Short-lived
// visual events are intentionally not used as a source of tutorial progress.
export type JourneyJournal={wood?:number;stone?:number;copper?:number;mineCopper?:number;fish?:number;harvest?:number;cooked?:string[];planted?:string[];watered?:string[];slept?:number;oak?:boolean;mine?:boolean};
export function addJournal(owner:{journal?:JourneyJournal},key:'wood'|'stone'|'copper'|'fish'|'harvest'|'slept'|'mineCopper',amount=1){const j=owner.journal??={};j[key]=Math.min(1000000,(j[key]??0)+Math.max(0,amount));}
export function rememberJournal(owner:{journal?:JourneyJournal},key:'planted'|'watered'|'cooked',value:string){const j=owner.journal??={};const entries=j[key]??=[];if(!entries.includes(value)&&entries.length<1200)entries.push(value);j[key]=entries;}
