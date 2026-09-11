import type {WorldState} from './simulation';
export type WorldDelta={base:number;set:Record<string,unknown>;maps:Record<string,{set:Record<string,unknown>;remove:string[]}>};
const dictionary=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function worldDelta(previous:WorldState,current:WorldState,base:number):WorldDelta{
    const before=previous as unknown as Record<string,unknown>,after=current as unknown as Record<string,unknown>,delta:WorldDelta={base,set:{},maps:{}};
    for(const [field,value] of Object.entries(after)){
        const old=before[field];
        if(dictionary(value)&&dictionary(old)){
            const set:Record<string,unknown>={},remove=Object.keys(old).filter(key=>!Object.hasOwn(value,key));
            for(const [key,item] of Object.entries(value))if(JSON.stringify(item)!==JSON.stringify(old[key]))set[key]=item;
            if(remove.length||Object.keys(set).length)delta.maps[field]={set,remove};
        }else if(JSON.stringify(value)!==JSON.stringify(old))delta.set[field]=value;
    }
    return delta;
}
export function applyWorldDelta(previous:WorldState,delta:WorldDelta):WorldState{
    const state={...previous,...delta.set} as unknown as Record<string,unknown>;
    for(const [field,changes] of Object.entries(delta.maps)){
        const map={...(state[field] as Record<string,unknown>),...changes.set};
        for(const key of changes.remove)delete map[key];state[field]=map;
    }
    return state as unknown as WorldState;
}
