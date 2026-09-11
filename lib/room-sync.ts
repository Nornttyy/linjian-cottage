import {applyInput,tickWorld,publicWorld,type Input,type WorldState} from './simulation';
import {worldDelta,type WorldDelta} from './world-delta';
type Database={prepare(sql:string):{bind(...values:unknown[]):{first<T>():Promise<T|null>;run():Promise<{meta:{changes?:number}}>}}};
type Options={input?:Input;poll?:boolean;sinceVersion?:number;normalize?:(state:WorldState)=>void};
type Result={status:number;room?:string;playerId?:string;state?:WorldState;delta?:WorldDelta;version?:number;message?:string|null;error?:string;attempts?:number};
type Entry={secret:string;options:Options;resolve:(result:Result)=>void;reject:(error:unknown)=>void};
type Batch={db:Database;room:string;entries:Entry[];running:boolean;timer?:ReturnType<typeof setTimeout>};
const batches=new Map<string,Batch>();
// Cache only public snapshots. Missing/evicted baselines always receive a full snapshot.
const snapshots=new Map<string,string>();let snapshotBytes=0;
function remember(room:string,version:number,state:WorldState){
    const key=room+':'+version;if(snapshots.has(key))return;const text=JSON.stringify(state);
    if(text.length>512000)return;snapshots.set(key,text);snapshotBytes+=text.length;
    while(snapshotBytes>1048576||snapshots.size>64){const first=snapshots.keys().next().value!;snapshotBytes-=snapshots.get(first)!.length;snapshots.delete(first);}
}
function response(room:string,playerId:string,state:WorldState,version:number,entry:Entry,message:string|null,attempts:number):Result{
    const clean=publicWorld(state),baseline=entry.options.sinceVersion,old=Number.isSafeInteger(baseline)?snapshots.get(room+':'+baseline):undefined;
    const delta=old?worldDelta(JSON.parse(old),clean,baseline!):undefined;
    const useDelta=delta&&JSON.stringify(delta).length<JSON.stringify(clean).length*.8;
    remember(room,version,clean);
    return {status:200,room,playerId,version,message,attempts,...(useDelta?{delta}:{state:clean})};
}
async function commit(batch:Batch,entries:Entry[]):Promise<Result[]>{
    for(let attempt=1;attempt<=6;attempt++){
        const row=await batch.db.prepare('SELECT state,version FROM worlds WHERE id=?').bind(batch.room).first<{state:string;version:number}>();
        if(!row)return entries.map(()=>({status:404,error:'房间不存在'}));
        const state=JSON.parse(row.state) as WorldState;entries[0]?.options.normalize?.(state);
        const now=Math.max(Date.now(),state.tick),identities=entries.map(entry=>Object.keys(state.players).find(id=>state.players[id].secret===entry.secret));
        const accepted=identities.map((id,i)=>!!id&&(!entries[i].options.poll||!!entries[i].options.input&&entries[i].options.input!.seq>state.players[id].seq));
        const due=Object.values(state.players).some(p=>p.pendingStrike&&p.pendingStrike.at<=now);
        const needsTick=now-state.tick>=100||due;
        if(!identities.some(Boolean))return entries.map(()=>({status:403,error:'连接已失效'}));
        if(!accepted.some(Boolean)&&!needsTick)return entries.map((entry,i)=>identities[i]?response(batch.room,identities[i]!,state,row.version,entry,null,attempt):{status:403,error:'连接已失效'});
        tickWorld(state,now);
        const messages=entries.map((entry,i)=>{
            const id=identities[i];if(!id)return null;
            if(entry.options.input)return applyInput(state,id,entry.options.input,now);
            if(!entry.options.poll)state.players[id].seen=now;return null;
        });
        const result=await batch.db.prepare('UPDATE worlds SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(state),now,batch.room,row.version).run();
        if(!result.meta.changes)continue;
        return entries.map((entry,i)=>identities[i]?response(batch.room,identities[i]!,state,row.version+1,entry,messages[i],attempt):{status:403,error:'连接已失效'});
    }
    return entries.map(()=>({status:409,error:'世界繁忙，请重试'}));
}
function schedule(batch:Batch,delay=4){if(batch.running||batch.timer)return;batch.timer=setTimeout(()=>void flush(batch),delay);}
async function flush(batch:Batch){
    batch.timer=undefined;batch.running=true;const entries=batch.entries.splice(0,32);
    try{const results=await commit(batch,entries);entries.forEach((entry,i)=>entry.resolve(results[i]));}
    catch(error){entries.forEach(entry=>entry.reject(error));}
    finally{batch.running=false;if(batch.entries.length)schedule(batch,0);else batches.delete(batch.room);}
}
function enqueue(db:Database,room:string,secret:string,options:Options):Promise<Result>{
    let batch=batches.get(room);if(!batch){batch={db,room,entries:[],running:false};batches.set(room,batch);}
    return new Promise((resolve,reject)=>{batch!.entries.push({secret,options,resolve,reject});schedule(batch!);});
}
export async function syncRoom(db:Database,room:string,secret:string,options:Options):Promise<Result>{
    const input=options.input;
    // A malformed player's payload must not abort the other players sharing this microbatch.
    if(input&&(!Number.isSafeInteger(input.seq)||!Array.isArray(input.commands)||input.commands.some(c=>!c||typeof c!=='object'||typeof c.type!=='string')||(input.movements!==undefined&&(!Array.isArray(input.movements)||input.movements.some(m=>!m||typeof m!=='object')))))return{status:400,error:'无效输入'};
    // Only accepted attacks wait for their imminent real contact, instead of requiring a second client poll.
    const initial=await enqueue(db,room,secret,{...options,sinceVersion:undefined});
    const player=initial.state?.players[initial.playerId??''],pending=player?.pendingStrike;
    const attack=options.input?.commands.some(c=>c.type==='attack'&&(!pending?.command.id||c.id===pending.command.id));
    if(initial.status===200&&attack&&pending&&pending.at-Date.now()<=200){
        const delay=Math.max(0,pending.at-Date.now());if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
        const final=await enqueue(db,room,secret,{...options,input:undefined,poll:true,sinceVersion:options.sinceVersion});
        if(final.status===200)return {...final,message:initial.message};
    }
    if(initial.status===200&&initial.state&&options.sinceVersion!==undefined){
        const old=snapshots.get(room+':'+options.sinceVersion);
        if(old){const delta=worldDelta(JSON.parse(old),initial.state,options.sinceVersion);if(JSON.stringify(delta).length<JSON.stringify(initial.state).length*.8)return{...initial,state:undefined,delta};}
    }
    return initial;
}
