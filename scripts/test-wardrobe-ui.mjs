import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileProject} from './test-support.mjs';
const p=compileProject({name:'wardrobe-ui'});let checks=0;
try{
 const react=join(p.temp,'react.mjs'),jsx=join(p.temp,'jsx.mjs');
 writeFileSync(react,`let cells=[],cursor=0;export const reset=()=>{cells=[];cursor=0};export const begin=()=>{cursor=0};export function useState(initial){const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return[cells[i],value=>cells[i]=typeof value==='function'?value(cells[i]):value];}export const useRef=v=>({current:v});export const useEffect=()=>{};`);
 writeFileSync(jsx,`export const Fragment='fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`);
 const map={react:pathToFileURL(react).href,'react/jsx-runtime':pathToFileURL(jsx).href,'./CharacterPortrait':'data:text/javascript,export default function Portrait(){return null}'};
 const colorsURL=p.compileFile('components/AppearanceColors.tsx',map);map['./AppearanceColors']=colorsURL;
 const [Wardrobe,DeathScreen,StoryPanel,Colors]=await Promise.all(['Wardrobe','DeathScreen','StoryPanel','AppearanceColors'].map(async name=>(await import(p.compileFile(`components/${name}.tsx`,map))).default));
 const hooks=await import(map.react),sim=await import(p.module('simulation'));const player=sim.createPlayer('p','s','林客',0,1),world=sim.createWorld(1);
 const test=(name,run)=>{hooks.reset();run();checks++;console.log('PASS',name);};
 const nodes=(tree,type)=>{const result=[];const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type===type)result.push(node);visit(node.props?.children);};visit(tree);return result;};
 const text=node=>node==null?'':typeof node!=='object'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.props?.children);
 const button=(tree,label)=>nodes(tree,'button').find(n=>text(n).includes(label));
 const render=(component,props)=>{hooks.begin();return component(props);};
 test('wardrobe only enables earned outfits and keeps the headwear slot independent',()=>{
  player.wardrobe=['river-swim','leaf-crown'];player.appearance={body:'male',shirt:'original',pants:'original',headwear:'leaf-crown'};let applied;
  const props={player,onApply:a=>applied=a,onClose(){}};let tree=render(Wardrobe,props);
  assert.equal(button(tree,'溪蓝泳装').props.disabled,false);assert.equal(button(tree,'珊瑚泳装').props.disabled,true);
  button(tree,'溪蓝泳装').props.onClick();tree=render(Wardrobe,props);assert(button(tree,'溪蓝泳装').props['aria-pressed']);button(tree,'穿上这套').props.onClick();assert.equal(applied.outfit,'river-swim');assert.equal(applied.headwear,'leaf-crown');
 });
 test('all seven color regions accept arbitrary hex values without changing other regions',()=>{
  const value={body:'female',shirt:'rose',pants:'blue'};let changed;const tree=Colors({value,onChange:a=>changed=a}),inputs=nodes(tree,'input');assert.equal(inputs.length,7);
  inputs.find(n=>n.props['aria-label']==='眼睛自选颜色').props.onChange({target:{value:'#21ae67'}});assert.deepEqual(changed,{...value,eyes:'#21ae67'});
 });
 test('swimwear exposes independent upper and lower dyes and hides the unused shoe dye',()=>{
  const tree=Colors({value:{body:'male',shirt:'original',pants:'original',outfit:'river-swim'},onChange(){}}),labels=nodes(tree,'input').map(n=>n.props['aria-label']);assert(labels.includes('上衣自选颜色'));assert(labels.includes('下装自选颜色'));assert(!labels.includes('鞋袜自选颜色'));
 });
 test('outer fabric, embroidery and headwear have independent dyes',()=>{
  const value={body:'female',shirt:'#4488bb',pants:'#665544',outfit:'moth-cloak',headwear:'leaf-crown'};let changed;const tree=Colors({value,onChange:a=>changed=a});const inputs=nodes(tree,'input');assert.equal(inputs.length,10);
  inputs.find(n=>n.props['aria-label']==='外装主色自选颜色').props.onChange({target:{value:'#dd7733'}});assert.deepEqual(changed,{...value,outfitColor:'#dd7733'});
  assert(inputs.some(n=>n.props['aria-label']==='外装花纹自选颜色'));assert(inputs.some(n=>n.props['aria-label']==='头饰主色自选颜色'));
 });
 test('death screen requires its full fall delay and a connection before respawn',()=>{
  player.death={at:100,x:2,y:2,level:0,face:'down',cause:'被史莱姆击倒'};let used=0;const props={player,time:100,connected:true,onRespawn(){used++},onExit(){}};
  assert(button(DeathScreen(props),'秒后可复活').props.disabled);assert(button(DeathScreen({...props,time:1900,connected:false}),'等待连接').props.disabled);
  const ready=button(DeathScreen({...props,time:1900}),'回到营地');assert.equal(ready.props.disabled,false);ready.props.onClick();assert.equal(used,1);
 });
 test('optional story can be tracked again without handing in any resources',()=>{
  player.storyStage=1;player.storyTracked=false;let tracked=0,action=0;const tree=StoryPanel({player,world,onTrack(){tracked++},onAction(){action++},onClose(){},status:'需要 2 份料理'});
  button(tree,'追踪这段旅程').props.onClick();assert.equal(tracked,1);assert.equal(action,0);assert(text(tree).includes('需要 2 份料理'));assert.equal(nodes(tree,'p').some(n=>n.props.role==='status'),true);
 });
 console.log(`${checks} wardrobe and story UI checks; 0 failures`);
}finally{p.cleanup();}
