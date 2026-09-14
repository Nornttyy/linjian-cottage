import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'wall-materials'}),original=Object.getOwnPropertyDescriptor(globalThis,'document');
try{
 const [{drawConnectedWall},{paintIcon}]=await Promise.all(['connected-wall','art'].map(n=>import(project.module(n))));
 const canvases=[];
 const context=()=>({draws:[],globalAlpha:1,fillStyle:'',imageSmoothingEnabled:false,save(){},restore(){},translate(){},scale(){},rotate(){},beginPath(){},rect(){},clip(){},fillRect(){},clearRect(){},drawImage(...args){this.draws.push(args);}});
 globalThis.document={createElement(){const ctx=context(),canvas={width:0,height:0,ctx,getContext:()=>ctx};canvases.push(canvas);return canvas;}};
 const art=Object.fromEntries(['wall-face','wall-cap','wall','window'].map(name=>[name,{name,width:240,height:240}]));
 const allDraws=()=>canvases.flatMap(c=>c.ctx.draws);
 const stamps={};
 for(const kind of ['wall','window']){
  const b={id:'0:0:wall',kind,x:0,y:0},ctx=context();drawConnectedWall(ctx,art,{[b.id]:b},b,0,0);stamps[kind]=ctx.draws[0][0];
 }
 assert(allDraws().some(draw=>draw[0]===art['wall-face']));assert(allDraws().some(draw=>draw[0]===art['wall-cap']));
 assert(!allDraws().some(draw=>draw[0]===art.wall),'old plaster wall must not cover the wood material');
 const windows=allDraws().filter(draw=>draw[0]===art.window);assert(windows.length>0);
 assert(windows.every(draw=>draw.length===9&&draw[1]>0&&draw[2]>0&&draw[3]<art.window.width/2&&draw[4]<art.window.height/2),'only the inset frame and glass may overlay the shared wood wall');
 console.log('PASS window walls use the existing wood face and cap with only an inset glass/frame');
 for(const kind of ['wall','window']){
  const ctx=context();paintIcon(ctx,kind,art,32);assert.equal(ctx.draws[0][0],stamps[kind],'icon must render the same building stamp as the world');
  console.log('PASS '+kind+' icon matches the actual building instead of the legacy plaster sprite');
 }
}finally{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;project.cleanup();}
