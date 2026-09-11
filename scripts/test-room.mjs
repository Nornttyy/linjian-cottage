// Defaults to the current real API route with an isolated in-memory room store.
// Set GAME_API_URL explicitly to exercise an external server instead.
import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'room',api:true});
const previousDb=globalThis.__networkTestDb;
try {
const rows=new Map();
globalThis.__networkTestDb={prepare(sql){return{bind(...values){return{
 async first(){const row=rows.get(values[0]);return row?{...row}:null;},
 async run(){
  if(sql.startsWith('INSERT')){const [id,state,updated]=values;assert.ok(!rows.has(id));rows.set(id,{state,version:0,updated});return{meta:{changes:1}};}
  assert.ok(sql.startsWith('UPDATE'));const [state,updated,id,version]=values,row=rows.get(id);
  if(!row||row.version!==version)return{meta:{changes:0}};
  rows.set(id,{state,version:version+1,updated});return{meta:{changes:1}};
 }
};}};}};
const route=await import(project.route());
const requestRoute=process.env.GAME_API_URL?fetch:(url,options)=>route[options.method](new Request(url,options));
const base=process.env.GAME_API_URL||'http://localhost:3000/api/game';
const origin='https://nornttyy.github.io';
async function request(body){const response=await requestRoute(base,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify(body)});assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);return{status:response.status,data:await response.json()};}
const preflight=await requestRoute(base,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
assert.match(preflight.headers.get('Access-Control-Allow-Methods'),/POST/);
const blocked=await requestRoute(base,{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({action:'create'})});
assert.equal(blocked.status,403);assert.equal(blocked.headers.get('Access-Control-Allow-Origin'),null);
const host=await request({action:'create'});assert.equal(host.status,200);const h=host.data;
assert.equal(Object.keys(h.state.players).length,1);assert.equal(h.state.players[h.playerId].secret,undefined);
const guests=[];for(let i=0;i<3;i++){const result=await request({action:'join',room:h.room});assert.equal(result.status,200);guests.push(result.data);}
assert.equal((await request({action:'join',room:h.room})).status,409);
assert.equal((await request({action:'sync',room:h.room,token:'invalid-token'})).status,403);
const sessions=[h,guests[0]];
const results=await Promise.all(sessions.map(s=>request({action:'sync',room:s.room,token:s.token,input:{seq:1,dx:0,dy:0,commands:[]}})));
for(const result of results)assert.equal(result.status,200);
const state=(await request({action:'sync',room:h.room,token:h.token})).data.state;
assert.equal(Object.keys(state.players).length,4);
for(const s of sessions)assert.equal(state.players[s.playerId].seq,1);
assert.equal(JSON.stringify(state).includes('secret'),false);
assert.equal((await request({action:'sync',room:'NOTREAL0',token:h.token})).status,404);
console.log('PASS: GitHub Pages CORS, rejected foreign origins, four-player room, capacity, token protection, concurrent updates and persisted state');

} finally {globalThis.__networkTestDb=previousDb;project.cleanup();}
