import assert from 'node:assert/strict';
const base=process.env.GAME_API_URL||'http://localhost:3000/api/game';
const origin='https://nornttyy.github.io';
async function request(body){const response=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify(body)});assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);return{status:response.status,data:await response.json()};}
const preflight=await fetch(base,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
assert.match(preflight.headers.get('Access-Control-Allow-Methods'),/POST/);
const blocked=await fetch(base,{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({action:'create'})});
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
