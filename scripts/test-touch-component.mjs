import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileProject} from './test-support.mjs';

const project=compileProject({name:'touch-component'});let checks=0,failures=0;
try{
    mkdirSync(join(project.temp,'components'),{recursive:true});
    const hostPath=join(project.temp,'components/touch-host.mjs');
    writeFileSync(hostPath,`export const states=[],refs=[],effects=[];let si=0,ri=0,ei=0;export function reset(){si=0;ri=0;ei=0;}export function useState(value){const i=si++;if(!(i in states))states[i]=value;return[states[i],next=>states[i]=typeof next==='function'?next(states[i]):next];}export function useRef(value){const i=ri++;return refs[i]??={current:value};}export function useCallback(fn){return fn;}export function useEffect(fn){effects[ei++]=fn;}export function jsx(type,props,key){return{type,props:props||{},key};}export const jsxs=jsx;`);
    const host=await import(pathToFileURL(hostPath));
    const{default:TouchControls}=await import(project.compileFile('components/TouchControls.tsx',{'react':'./touch-host.mjs','react/jsx-runtime':'./touch-host.mjs'}));
    const keys=new Set(),calls=[];let heldId=null;
    const client={press:(key,down)=>{calls.push(['press',key,down]);if(down)keys.add(key);else keys.delete(key);},startTouchUse:id=>{if(heldId!==null)return false;heldId=id;calls.push(['start',id]);return true;},stopTouchUse:id=>{if(id!==undefined&&heldId!==id)return false;calls.push(['stop',id]);heldId=null;return true;}};
    host.refs[0]={current:{getBoundingClientRect:()=>({left:0,top:0,width:124,height:124})}};
    const pointer=(id,x=102,y=62)=>({pointerId:id,clientX:x,clientY:y,preventDefault(){},currentTarget:{setPointerCapture(){}}});
    const nodes=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(5).flatMap(nodes)];
    const render=()=>{host.reset();return nodes(TouchControls({client:{current:client},useLabel:'使用'}));};
    const test=(name,run)=>{checks++;try{run();console.log('PASS',name);}catch(error){failures++;console.log('FAIL',name,error.message);}};

    test('unmounting touch controls releases both thumbs and a fresh mount starts clean',()=>{
        globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
        let tree=render(),stick=tree.find(node=>node.props.className==='touch-stick'),use=tree.find(node=>node.props.className==='touch-use'),cleanup=host.effects[0]();
        stick.props.onPointerDown(pointer(1));use.props.onPointerDown(pointer(2));assert.deepEqual([...keys],['d']);assert.equal(heldId,2);
        tree=render();assert(tree.find(node=>String(node.props.className).includes('touch-use is-active')));
        cleanup();assert.equal(keys.size,0);assert.equal(heldId,null);
        const presses=calls.length;stick.props.onPointerMove(pointer(1));assert.equal(calls.length,presses);
        host.states.length=0;host.refs.length=0;host.refs[0]={current:{getBoundingClientRect:()=>({left:0,top:0,width:124,height:124})}};
        tree=render();assert.equal(tree.find(node=>node.type==='i').props.style.transform,'translate(0px,0px)');assert(!tree.some(node=>String(node.props.className).includes('touch-use is-active')));
        cleanup=host.effects[0]();tree.find(node=>node.props.className==='touch-stick').props.onPointerDown(pointer(3));assert.deepEqual([...keys],['d']);cleanup();
    });
    console.log(`${checks} touch component checks; ${failures} failures`);process.exitCode=failures?1:0;
}finally{project.cleanup();}
