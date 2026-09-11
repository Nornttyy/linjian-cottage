import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileProject} from './test-support.mjs';
const overrides=process.env.LINJIAN_GAME_CANDIDATE?{'components/Game.tsx':process.env.LINJIAN_GAME_CANDIDATE}:{};
const project=compileProject({name:'build-cost-ui',overrides});
let checks=0;const globals=['window','requestAnimationFrame','cancelAnimationFrame'],original=new Map(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
try{
 const [sim,str,inv]=await Promise.all(['simulation','structures','inventory'].map(name=>import(project.module(name))));
 mkdirSync(join(project.temp,'components'),{recursive:true});
 const hostPath=join(project.temp,'components/react-host.mjs');writeFileSync(hostPath,`export const states=[],refs=[],effects=[];let si=0,ri=0,ei=0;export let updates=0;export function reset(){si=0;ri=0;ei=0;}export function useState(v){const i=si++;if(!(i in states))states[i]=v;return[states[i],v=>{updates++;states[i]=typeof v==='function'?v(states[i]):v;}];}export function useRef(v){const i=ri++;return refs[i]??=({current:v});}export function useEffect(fn){effects[ei++]=fn;}export function jsx(type,props,key){return{type,props:props||{},key};}export const jsxs=jsx;export const Fragment='fragment';export class GameClient{}export default function Stub(){return null;}`);
 const host=await import(pathToFileURL(hostPath)),{default:Game}=await import(project.compileFile('components/Game.tsx',Object.fromEntries(['react','react/jsx-runtime','@/lib/client','./Minimap','./Tutorial','./LoadingScreen','./Inventory','./SignPanel','./ItemIcon'].map(key=>[key,'./react-host.mjs']))));
 const canvasEvents=new Map(),windowEvents=new Map(),frames=new Map();let nextFrame=0;
 globalThis.window={addEventListener:(k,f)=>windowEvents.set(k,f),removeEventListener:(k,f)=>{if(windowEvents.get(k)===f)windowEvents.delete(k);}};
 globalThis.requestAnimationFrame=f=>{frames.set(++nextFrame,f);return nextFrame;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const world=sim.createWorld(100000),p=sim.createPlayer('p','test','Tester',0,100000);world.players={p};world.buildings={};p.inventory.wood=12;p.inventory.stone=4;p.inventory.copper=1;
 const state={world,session:{playerId:'p'},slots:inv.defaultSlots(p.inventory),selectedSlot:3,tool:'build',part:'stairs',remove:false,connected:true};
 const selected=[];const game={pos:{x:260.5,y:319.5,face:'down',level:0},pointer:{x:260.8,y:320.3},world,setPart:part=>selected.push(part),canvas:{addEventListener:(k,f)=>canvasEvents.set(k,f),removeEventListener:(k,f)=>{if(canvasEvents.get(k)===f)canvasEvents.delete(k);}}};
 host.states[0]=state;host.refs[2]={current:game};
 function nodes(n){if(!n||typeof n!=='object')return[];return[n,...[n.props?.children].flat(5).flatMap(nodes)];}
 function render(){host.reset();return nodes(Game({}));}
 function material(item){return render().find(n=>n.type==='li'&&n.props['aria-label'].startsWith(inv.ITEMS[item].name+'：'));}
 function text(n){return typeof n==='string'||typeof n==='number'?String(n):n&&typeof n==='object'?[n.props?.children].flat(5).map(text).join(''):'';}
 function addFloor(x,y,level){const id=str.buildingKey(x,y,'floor',level);world.buildings[id]={id,x,y,kind:'floor',level};}
 function test(name,fn){fn();checks++;console.log('PASS',name);}
 function tick(){const entries=[...frames];frames.clear();entries.forEach(([,fn])=>fn());}
 render();const cleanup=host.effects[4]();
 test('active build preview follows the same pointed cell as placement',()=>assert.deepEqual(host.states[8],{x:260,y:320,level:0,removing:false}));
 test('stairs list actual 20 wood and 4 stone with all upper floors missing',()=>{assert.equal(text(material('wood')),'木材20 / 12缺8');assert.equal(text(material('stone')),'石头4 / 4');assert.equal(text(material('copper')),'铜矿0 / 1');assert.equal(material('wood').props.className,'insufficient');assert.equal(material('stone').props.className,'');});
 test('stairs reduce cost for every existing upper floor and inventory updates immediately',()=>{addFloor(260,320,1);addFloor(261,320,1);assert.equal(text(material('wood')),'木材16 / 12缺4');p.inventory.wood=16;assert.equal(text(material('wood')),'木材16 / 16');assert.equal(material('wood').props.className,'');addFloor(260,321,1);addFloor(261,321,1);assert.equal(text(material('wood')),'木材12 / 16');});
 test('moving target updates costs without waiting for a server state notification',()=>{game.pointer={x:270.2,y:330.1};tick();assert.deepEqual(host.states[8],{x:270,y:330,level:0,removing:false});assert.equal(text(material('wood')),'木材20 / 16缺4');});
 test('unchanged target does not trigger another React state update each frame',()=>{const before=host.updates;tick();tick();assert.equal(host.updates,before);});
 test('upper-level preview charges floors only on the next level',()=>{game.pointer={x:260.2,y:320.4};game.pos.level=1;tick();assert.equal(host.states[8].level,1);assert.equal(text(material('wood')),'木材20 / 16缺4');addFloor(260,320,2);assert.equal(text(material('wood')),'木材18 / 16缺2');});
 test('keyboard-only construction preview uses facing target',()=>{game.pointer=null;game.pos={x:261.5,y:321.5,face:'left',level:0};tick();assert.deepEqual(host.states[8],{x:260,y:321,level:0,removing:false});});
 test('non-stair parts show required owned and clear zero-cost entries',()=>{state.part='lantern';p.inventory.copper=0;assert.equal(text(material('wood')),'木材2 / 16');assert.equal(text(material('stone')),'石头0 / 4');assert.equal(text(material('copper')),'铜矿1 / 0缺1');assert.equal(material('copper').props.className,'insufficient');});
 test('insufficient materials never disable selecting a construction part',()=>{const button=render().find(n=>n.type==='button'&&n.props.title===str.PART_NAMES.lantern);assert(!button.props.disabled);button.props.onClick();assert.deepEqual(selected,['lantern']);});
 test('right-button temporary demolition hides costs and release restores them',()=>{canvasEvents.get('pointerdown')({button:2});assert(!render().some(n=>n.props.className==='build-materials'));windowEvents.get('pointerup')();assert(render().some(n=>n.props.className==='build-materials'));});
 test('latched demolition and non-building tools do not advertise construction costs',()=>{state.remove=true;assert(!render().some(n=>n.props.className==='build-materials'));state.remove=false;state.tool='axe';assert(!render().some(n=>n.props['aria-label']==='建造菜单'));state.tool='build';});
 test('preview cleanup removes observer callbacks and animation frame',()=>{cleanup();assert.equal(canvasEvents.size,0);assert.equal(windowEvents.size,0);assert.equal(frames.size,0);});
 console.log(`${checks} checks; 0 failures`);
}finally{for(const[k,v]of original)if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];project.cleanup();}
