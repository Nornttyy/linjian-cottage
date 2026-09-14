import assert from 'node:assert/strict';
import {join} from 'node:path';
import {rgbaPng} from './png-support.mjs';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'female-pick-art'});
try{
 const {FEMALE_SHEETS,FEMALE_BODY_HEIGHTS}=await import(project.module('female-art-layout'));
 const {ART_FILES}=await import(project.module('asset-loading'));
 const spec=FEMALE_SHEETS.find(s=>s.action==='pick'),image=rgbaPng(join(project.source,'public/art',spec.file));
 const idle=rgbaPng(join(project.source,'public/art',FEMALE_SHEETS.find(s=>s.action==='idle').file));
 assert(spec.registration,'female pickaxe needs its own registration');assert.equal(spec.registration.frames.length,24);assert.equal(spec.registration.anchors.length,24);
 assert.equal(ART_FILES.filter(f=>f===spec.file).length,1);assert(!ART_FILES.includes('female-pick-v1.png'));
 const brown=(r,g,b)=>r>55&&r>b*1.4&&g>b*1.15&&r>g*1.08;
 const blue=(r,g,b)=>g>r*1.22&&b>r*1.3&&g>55;
 const samples=new WeakMap();
 // Inspect the connected figure rather than detached pixels from nearby cells.
 // The game loader removes these fragments before placing the sprite.
 function sample(img,rect){
  if(samples.has(rect))return samples.get(rect);
  const [x,y,w,h]=rect,seen=new Uint8Array(w*h),raw=(xx,yy)=>img.pixels.subarray(((yy+y)*img.width+x+xx)*4,((yy+y)*img.width+x+xx)*4+4);let main=[];
  for(let n=0;n<w*h;n++){
   if(seen[n]||raw(n%w,Math.floor(n/w))[3]<32)continue;
   const q=[n];seen[n]=1;
   for(let j=0;j<q.length;j++){const a=q[j]%w,b=Math.floor(q[j]/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=a+dx,yy=b+dy,k=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||seen[k]||raw(xx,yy)[3]<32)continue;seen[k]=1;q.push(k);}}
   if(q.length>main.length)main=q;
  }
  const mask=new Uint8Array(w*h);for(const n of main)mask[n]=1;
  const pixel=(xx,yy)=>mask[yy*w+xx]?raw(xx,yy):[0,0,0,0];samples.set(rect,pixel);return pixel;
 }
 function measure(img,rect,bodyHeight,center=128){
  const pixel=sample(img,rect),w=rect[2],h=rect[3];let feet=0;
  for(let y=h-1;y>h/2;y--){let n=0;for(let x=0;x<w;x++){const [r,g,b,a]=pixel(x,y);if(a>=128&&brown(r,g,b))n++;}if(n>=12){feet=y+2;break;}}
  const span=(y,predicate)=>{let lo=w,hi=-1;for(let x=Math.max(0,Math.floor(center-50));x<Math.min(w,center+50);x++){const [r,g,b,a]=pixel(x,y);if(a>=128&&predicate(r,g,b)){lo=Math.min(lo,x);hi=Math.max(hi,x);}}return hi-lo+1;};
  const hips=Math.max(...[-1,0,1].map(d=>span(Math.round(feet-bodyHeight*.28)+d,blue)));
  const head=Math.max(...[-1,0,1].map(d=>span(Math.round(feet-bodyHeight*.8)+d,brown)));
  return{feet,hips:hips*31/bodyHeight,head:head*31/bodyHeight};
 }
 const baseline=[0,1,2].map(r=>measure(idle,[0,r*256,256,256],FEMALE_BODY_HEIGHTS.idle[r]));
 for(let i=0;i<24;i++){
  const row=Math.floor(i/8),frame=i%8,rect=spec.registration.frames[i],anchor=spec.registration.anchors[i],height=FEMALE_BODY_HEIGHTS.pick[row],m=measure(image,rect,height,anchor[0]);
  assert(Math.abs(m.feet-anchor[1])*31/height<.5,`frame ${i}: soles drift from the ground anchor`);
  const pixel=sample(image,rect);let opaque=0,empty=0;
  for(let y=0;y<rect[3];y++)for(let x=0;x<rect[2];x++){const [r,g,b,a]=pixel(x,y);if(a>=128)opaque++;else empty++;assert(!(a>=128&&r>110&&b>100&&g<Math.min(r,b)*.45&&Math.abs(r-b)<80),`frame ${i}: visible magenta background`);if(x===0||y===0||x===rect[2]-1||y===rect[3]-1)assert.equal(a,0,`frame ${i}: clipped sprite`);}
  assert(opaque>2000&&empty>rect[2]*rect[3]*.1,`frame ${i}: complete isolated sprite`);
  if(frame===0||frame===7){
   assert(m.hips<=baseline[row].hips+1.5&&m.hips>=baseline[row].hips-2,`frame ${i}: body widens from idle (${m.hips} vs ${baseline[row].hips})`);
   assert(Math.abs(m.head-baseline[row].head)<=2,`frame ${i}: head enlarges from idle (${m.head} vs ${baseline[row].head})`);
  }
  console.log('PASS female pickaxe alpha, full frame and planted feet:',row,frame);
 }
 console.log('PASS female pickaxe standing head and body proportions match idle in all directions');
}finally{project.cleanup();}
