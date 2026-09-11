// Original, deterministic sound design. Produces the shipped PCM masters.
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('../public/audio/',import.meta.url)),rate=22050;
await mkdir(directory,{recursive:true});
const assets=[];
function render(name,seconds,sample,peak=.72){
 const length=Math.round(seconds*rate),values=new Float64Array(length);let seed=5381,low=0,max=0;
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 const smooth=()=>low=low*.965+noise()*.035;
 for(let i=0;i<length;i++){const t=i/rate,edge=Math.min(1,t/.008,(seconds-t)/.025);values[i]=sample(t,noise,smooth)*Math.max(0,edge);max=Math.max(max,Math.abs(values[i]));}
 const buffer=Buffer.alloc(44+length*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length*2,40);
 for(let i=0;i<length;i++)buffer.writeInt16LE(Math.round(values[i]/Math.max(max,.001)*peak*32760),44+i*2);
 assets.push({name,seconds,rate,channels:1,peak});return writeFile(directory+name+'.wav',buffer);
}
const tone=(f,t)=>Math.sin(2*Math.PI*f*t),decay=(t,s)=>Math.exp(-t/s);
await render('swing',.22,(t,n)=>n()*Math.sin(Math.PI*t/.22)**2*(.4+.6*Math.sin(Math.PI*t/.22)),.3);
await render('wood',.23,(t,n)=>((tone(186,t)+.38*tone(351,t))*decay(t,.05)+n()*decay(t,.018)*.5),.58);
await render('stone',.32,(t,n)=>(tone(610,t)*decay(t,.075)+.4*tone(1280,t)*decay(t,.04)+n()*decay(t,.022)*.7),.45);
await render('hit',.2,(t,n)=>tone(130-70*t,t)*decay(t,.055)+n()*decay(t,.035)*.45,.48);
await render('build',.38,(t,n)=>{const a=t% .115;return (tone(230,a)*decay(a,.04)+n()*decay(a,.009)*.4)*decay(t,.24);},.48);
await render('door',.43,(t,n)=>tone(145+40*Math.sin(t*12),t)*Math.sin(Math.PI*t/.43)*.5+n()*decay(t,.016)*.2,.26);
await render('grass-step',.15,(t,n)=>n()*decay(t,.032)*.8+tone(90,t)*decay(t,.06),.16);
await render('wood-step',.14,t=>(tone(220,t)+.25*tone(441,t))*decay(t,.035),.18);
await render('till',.28,(t,n,s)=>n()*decay(t,.05)*.45+s()*decay(t,.13)*4+tone(95,t)*decay(t,.07),.28);
await render('plant',.25,(t,n)=>n()*decay(t,.07)*.2+tone(510,t)*decay(t,.022)*.4,.19);
await render('water',.66,(t,n,s)=>s()*4*Math.sin(Math.PI*t/.66)+n()*.1+tone(1700+500*Math.sin(t*40),t)*.06,.2);
await render('harvest',.75,t=>{let v=0;for(const [i,f]of[523.25,659.25,783.99].entries()){const a=t-i*.09;if(a>=0)v+=tone(f,a)*decay(a,.16)*Math.min(1,a/.008);}return v;},.25);
await render('hurt',.28,t=>tone(190-240*t,t)*decay(t,.11)+.3*tone(290,t)*decay(t,.07),.25);
await render('bat',.35,(t,n)=>n()*(.2+.8*Math.sin(t*60)**2)*Math.sin(Math.PI*t/.35),.12);
await render('boar',.45,(t,n,s)=>tone(84+12*Math.sin(t*25),t)*Math.sin(Math.PI*t/.45)+s()*2+n()*.035,.24);
await render('spore',.4,(t,n,s)=>s()*4*Math.sin(Math.PI*t/.4)+tone(380-300*t,t)*decay(t,.16),.22);
await render('forest',24,(t,n,s)=>{let v=s()*.8;for(const [start,f]of[[2.5,1800],[7.1,2240],[14.2,1980],[20.5,2450]]){const a=t-start;if(a>0&&a<.55)v+=tone(f+230*Math.sin(a*21),a)*Math.sin(Math.PI*a/.55)**2*.08;}return v;},.11);
await render('cave',16,(t,n,s)=>{let v=s()*.25;for(const start of[1.3,4.7,9.2,13.1]){const a=t-start;if(a>0&&a<1.2)for(let i=0;i<4;i++){const b=a-i*.14;if(b>=0)v+=tone(920+100*i,b)*decay(b,.025)*(.2/(i+1));}}return v;},.09);
await render('fire',8,(t,n,s)=>s()*.3+n()*(Math.sin(t*107)> .998?.17:.007),.075);
await writeFile(directory+'manifest.json',JSON.stringify({author:'Original procedural sound design for 林间小筑',format:'PCM 16-bit mono',assets},null,2)+'\n');
console.log(`Generated ${assets.length} original WAV sound assets.`);
