import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';

const project=compileProject({name:'roof-visibility',overrides:process.env.LINJIAN_ROOF_MODULE?{'lib/roof-visibility.ts':process.env.LINJIAN_ROOF_MODULE}:{}});
try {
const {roofVisibility,HIDDEN_ROOF_ALPHA}=await import(project.module('roof-visibility'));
    const roofs=[{x:1,y:1},{x:2,y:1},{x:9,y:9}],inside=new Set(['1:1','2:1']),outside=new Set();
    const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
    const read=(canvas,hidden,time,scope='room-A:player:surface',tiles=roofs)=>roofVisibility(canvas,scope,tiles,hidden,time);
    let passed=0;
    const test=(name,fn)=>{fn();passed++;console.log('PASS',name);};
    test('entry fades over 300 ms, with exact midpoint and endpoints',()=>{
        const c={};near(read(c,outside,0).get('1:1'),1);near(read(c,inside,10).get('1:1'),1);
        near(read(c,inside,85).get('1:1'),.865625);near(read(c,inside,160).get('1:1'),.57);
        near(read(c,inside,310).get('1:1'),HIDDEN_ROOF_ALPHA);near(read(c,inside,5000).get('1:1'),HIDDEN_ROOF_ALPHA);
    });
    test('exit fades back to fully opaque in 300 ms',()=>{
        const c={};near(read(c,inside,0).get('1:1'),.14);near(read(c,outside,100).get('1:1'),.14);
        near(read(c,outside,250).get('1:1'),.57);near(read(c,outside,400).get('1:1'),1);
    });
    test('direction reversal starts from current alpha without a jump',()=>{
        const c={};read(c,outside,0);read(c,inside,100);const before=read(c,inside,220).get('1:1');
        near(read(c,outside,220).get('1:1'),before);const rising=read(c,outside,300).get('1:1');assert.ok(rising>before&&rising<1);
        near(read(c,inside,300).get('1:1'),rising);near(read(c,inside,600).get('1:1'),.14);
    });
    test('fresh snapshots and new roof objects do not restart a fade',()=>{
        const c={};read(c,outside,0);read(c,inside,50);
        for(let t=60;t<=350;t+=10)read(c,new Set(inside),t,undefined,roofs.map(r=>({...r})));
        near(read(c,inside,350).get('1:1'),.14);
    });
    test('canvas instances are isolated',()=>{
        const a={},b={};read(a,outside,0);read(a,inside,100);near(read(a,inside,250).get('1:1'),.57);near(read(b,outside,250).get('1:1'),1);
    });
    test('room and scene changes reset state, including clock origin',()=>{
        const c={};read(c,inside,1000);near(read(c,outside,5,'room-B:player:surface').get('1:1'),1);
        near(read(c,inside,6,'room-B:player:mine').get('1:1'),.14);
    });
    test('connected roofs share opacity while another house remains opaque',()=>{
        const c={};read(c,outside,0);read(c,inside,100);const alphas=read(c,inside,250);near(alphas.get('1:1'),alphas.get('2:1'));near(alphas.get('9:9'),1);
    });
    test('deleted roofs are pruned and replacement roofs have fresh state',()=>{
        const c={};read(c,inside,0);const empty=read(c,outside,10,undefined,[]);assert.equal(empty.size,0);near(read(c,outside,20).get('1:1'),1);
    });
    test('joining indoors starts hidden without a roof flash',()=>near(read({},inside,0).get('1:1'),.14));
    test('a backwards clock does not reverse the fade',()=>{
        const c={};read(c,outside,0);read(c,inside,100);const a=read(c,inside,250).get('1:1');near(read(c,inside,225).get('1:1'),a);near(read(c,inside,400).get('1:1'),.14);
    });
    console.log(`${passed} roof timing checks passed`);
} finally {project.cleanup();}
