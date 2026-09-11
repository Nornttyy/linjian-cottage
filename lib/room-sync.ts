import {applyInput,tickWorld,publicWorld,type Input,type WorldState} from './simulation';
import {worldDelta,type WorldDelta} from './world-delta';
type Database={prepare(sql:string):{bind(...values:unknown[]):{first<T>():Promise<T|null>;run():Promise<{meta:{changes?:number}}>}}};
type Options={input?:Input;poll?:boolean;sinceVersion?:number;normalize?:(state:WorldState)=>void};
type Result={status:number;room?:string;playerId?:string;state?:WorldState;delta?:WorldDelta;version?:number;message?:string|null;error?:string;attempts?:number};
type Entry={secret:string;options:Options};
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
// Keep all pending I/O and timers inside their originating request. Workers may
// cancel a cross-request Promise when its original request finishes or disconnects.
async function commit(db:Database,room:string,secret:string,options:Options):Promise<Result>{
    const entry={secret,options};
    for(let attempt=1;attempt<=6;attempt++){
        const row=await db.prepare('SELECT state,version FROM worlds WHERE id=?').bind(room).first<{state:string;version:number}>();
        if(!row)return{status:404,error:'房间不存在'};
        const state=JSON.parse(row.state) as WorldState;options.normalize?.(state);
        const playerId=Object.keys(state.players).find(id=>state.players[id].secret===secret);
        if(!playerId)return{status:403,error:'连接已失效'};
        const now=Math.max(Date.now(),state.tick),accepted=!options.poll||!!options.input&&options.input.seq>state.players[playerId].seq;
        const needsTick=now-state.tick>=100||Object.values(state.players).some(p=>p.pendingStrike&&p.pendingStrike.at<=now);
        if(!accepted&&!needsTick)return response(room,playerId,state,row.version,entry,null,attempt);
        tickWorld(state,now);
        let message:string|null=null;
        if(options.input)message=applyInput(state,playerId,options.input,now);
        else if(!options.poll)state.players[playerId].seen=now;
        const result=await db.prepare('UPDATE worlds SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(state),now,room,row.version).run();
        if(result.meta.changes)return response(room,playerId,state,row.version+1,entry,message,attempt);
    }
    return{status:409,error:'世界繁忙，请重试'};
}
export async function syncRoom(db:Database,room:string,secret:string,options:Options):Promise<Result>{
    const input=options.input;
    // Reject malformed payloads before any persistent write.
    if(input&&(!Number.isSafeInteger(input.seq)||!Array.isArray(input.commands)||input.commands.some(c=>!c||typeof c!=='object'||typeof c.type!=='string')||(input.movements!==undefined&&(!Array.isArray(input.movements)||input.movements.some(m=>!m||typeof m!=='object')))))return{status:400,error:'无效输入'};
    // Only accepted attacks wait for their imminent real contact, instead of requiring a second client poll.
    const initial=await commit(db,room,secret,{...options,sinceVersion:undefined});
    const player=initial.state?.players[initial.playerId??''],pending=player?.pendingStrike;
    const attack=options.input?.commands.some(c=>c.type==='attack'&&(!pending?.command.id||c.id===pending.command.id));
    if(initial.status===200&&attack&&pending&&pending.at-Date.now()<=200){
        const delay=Math.max(0,pending.at-Date.now());if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
        const final=await commit(db,room,secret,{...options,input:undefined,poll:true,sinceVersion:options.sinceVersion});
        if(final.status===200)return {...final,message:initial.message};
    }
    if(initial.status===200&&initial.state&&options.sinceVersion!==undefined){
        const old=snapshots.get(room+':'+options.sinceVersion);
        if(old){const delta=worldDelta(JSON.parse(old),initial.state,options.sinceVersion);if(JSON.stringify(delta).length<JSON.stringify(initial.state).length*.8)return{...initial,state:undefined,delta};}
    }
    return initial;
}
