// Real local workerd request contexts and D1. No public network or deployment.
// LINJIAN_ROOM_SYNC_MODULE may select a saved pre-fix room-sync.ts for comparison.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'workers-lifecycle',overrides:process.env.LINJIAN_ROOM_SYNC_MODULE?{'lib/room-sync.ts':process.env.LINJIAN_ROOM_SYNC_MODULE}:{}});
const {Miniflare,Log,LogLevel}=createRequire(join(project.source,'package.json'))('miniflare');
const logs=[],results=[];let mf;
class RuntimeLog extends Log {log(message){logs.push(String(message));}}
const script=`
import {syncRoom} from './lib/room-sync.mjs';
import {normalizeWorld} from './lib/simulation.mjs';
import {getStore} from './lib/store.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export default {async fetch(request){
  const base=await getStore();
  if(new URL(request.url).pathname==='/cold')return Response.json(await base.prepare('SELECT 1 AS ok').first());
  const body=await request.json();
  // The delay controls overlap, while actual reads and CAS writes use real D1.
  const db={prepare(sql){return {bind(...values){const statement=base.prepare(sql).bind(...values);return {
    async first(){await delay(body.delay??30);return statement.first();},
    async run(){await delay(body.delay??30);return statement.run();}
  };}};}};
  const task=syncRoom(db,body.room,'key'+body.index,{input:{seq:body.seq??1,dx:0,dy:0,commands:[],movements:[]},protocol:2,poll:true,normalize:state=>normalizeWorld(state,Date.now())});
  if(body.abandon){
    // Model the originating request ending while its unawaited operation is pending.
    // No waitUntil is used: another request must never depend on this lifetime.
    void task.catch(()=>{});await delay(12);return new Response('originating request ended',{status:202});
  }
  const result=await task;return Response.json(result,{status:result.status});
}};
`;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
    const paths=['simulation','world','map-features','farming','activities','creatures','structures','world-delta','room-sync','store'];
    const modules=[{type:'ESModule',path:join(project.temp,'worker.mjs'),contents:script},...paths.map(name=>({type:'ESModule',path:join(project.temp,'lib',name+'.mjs'),contents:readFileSync(join(project.temp,'lib',name+'.mjs'),'utf8')}))];
    mf=new Miniflare({modules,modulesRoot:project.temp,compatibilityDate:'2026-05-15',host:'127.0.0.1',port:0,cf:false,d1Databases:['DB'],log:new RuntimeLog(LogLevel.ERROR),outboundService:()=>new Response('External networking disabled',{status:503})});
    await mf.ready;
    const db=await mf.getD1Database('DB'),sim=await import(project.module('simulation'));
    async function test(name,run){try{const detail=await run();results.push({name,pass:true,detail});console.log('PASS',name);}catch(error){results.push({name,pass:false,error:error.message});console.log('FAIL',name,error.message);}}
    async function seed(room){const now=Date.now(),state=sim.createWorld(now);for(let index=0;index<4;index++)state.players['p'+index]=sim.createPlayer('p'+index,'key'+index,'Runtime test',index,now);await db.prepare('INSERT INTO worlds (id,state,version,updated_at) VALUES (?,?,0,?)').bind(room,JSON.stringify(state),now).run();}
    async function send(body,signal=AbortSignal.timeout(2500)){
        try{const response=await mf.dispatchFetch('http://worker.test/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const text=await response.text();let data;try{data=JSON.parse(text);}catch{}return{status:response.status,data,error:data?undefined:text.slice(0,300)};}
        catch(error){return{status:0,error:error.message};}
    }
    await test('four independent cold requests initialize D1 without sharing a pending initialization promise',async()=>{
        const replies=await Promise.all([0,1,2,3].map(async()=>{const response=await mf.dispatchFetch('http://worker.test/cold',{signal:AbortSignal.timeout(2500)});return{status:response.status,data:await response.json()};}));
        assert.deepEqual(replies.map(r=>r.status),[200,200,200,200]);for(const reply of replies)assert.equal(reply.data.ok,1);return replies.map(r=>r.status);
    });
    await test('four concurrent workerd request contexts each finish their own CAS commit',async()=>{
        const room='RUNTIME1';await seed(room);const replies=await Promise.all([0,1,2,3].map(index=>send({room,index,delay:30})));
        assert.deepEqual(replies.map(r=>r.status),[200,200,200,200],JSON.stringify(replies));
        const row=await db.prepare('SELECT state,version FROM worlds WHERE id=?').bind(room).first(),state=JSON.parse(row.state);
        assert.equal(row.version,4,'four independent request commits');for(let index=0;index<4;index++)assert.equal(state.players['p'+index].seq,1);return{statuses:replies.map(r=>r.status),version:row.version};
    });
    await test('requests arriving during the first D1 operation survive the first response ending',async()=>{
        const room='RUNTIME2';await seed(room);const tasks=[];
        for(let index=0;index<4;index++){tasks.push(send({room,index,delay:40}));await pause(12);}
        const replies=await Promise.all(tasks);assert.deepEqual(replies.map(r=>r.status),[200,200,200,200],JSON.stringify(replies));
        const row=await db.prepare('SELECT state,version FROM worlds WHERE id=?').bind(room).first(),state=JSON.parse(row.state);
        for(let index=0;index<4;index++)assert.equal(state.players['p'+index].seq,1);return{statuses:replies.map(r=>r.status),version:row.version};
    });
    await test('ending the originating request cannot cancel another player or poison later requests',async()=>{
        const room='RUNTIME3';await seed(room);const first=send({room,index:0,delay:70,abandon:true});await pause(5);const second=send({room,index:1,delay:20});
        const replies=await Promise.all([first,second]);assert.deepEqual(replies.map(r=>r.status),[202,200],JSON.stringify(replies));
        const third=await send({room,index:2,delay:20});assert.equal(third.status,200,JSON.stringify(third));
        const row=await db.prepare('SELECT state,version FROM worlds WHERE id=?').bind(room).first(),state=JSON.parse(row.state);
        assert.equal(state.players.p1.seq,1);assert.equal(state.players.p2.seq,1);return{statuses:[...replies.map(r=>r.status),third.status]};
    });
    await test('aborting the first HTTP caller leaves concurrent and subsequent request contexts usable',async()=>{
        const room='RUNTIME4';await seed(room);const controller=new AbortController(),first=send({room,index:0,delay:70},controller.signal);await pause(7);const second=send({room,index:1,delay:20});await pause(7);controller.abort();
        const replies=await Promise.all([first,second]);assert.equal(replies[1].status,200,JSON.stringify(replies));
        const third=await send({room,index:2,delay:20});assert.equal(third.status,200,JSON.stringify(third));
        const row=await db.prepare('SELECT state FROM worlds WHERE id=?').bind(room).first(),state=JSON.parse(row.state);assert.equal(state.players.p1.seq,1);assert.equal(state.players.p2.seq,1);return{statuses:[...replies.map(r=>r.status),third.status]};
    });
}finally{
    if(mf)await mf.dispose();project.cleanup();
    const report={runtime:'local Miniflare/workerd with real local D1; not public performance measurements',sourceOverride:process.env.LINJIAN_ROOM_SYNC_MODULE??null,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results,logs};
    if(process.env.LINJIAN_WORKERS_REPORT)writeFileSync(process.env.LINJIAN_WORKERS_REPORT,JSON.stringify(report,null,2));
    console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
