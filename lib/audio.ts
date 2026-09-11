export type Sound='swing'|'wood'|'stone'|'hit'|'build'|'door'|'grass-step'|'wood-step'|'till'|'plant'|'water'|'harvest'|'hurt'|'bat'|'boar'|'spore'|'forest'|'cave'|'fire';
const names:Sound[]=['swing','wood','stone','hit','build','door','grass-step','wood-step','till','plant','water','harvest','hurt','bat','boar','spore','forest','cave','fire'];
export class GameAudio{
    enabled=true;
    private context?:AudioContext;
    private master?:GainNode;
    private buffers=new Map<Sound,AudioBuffer>();
    private loading?:Promise<void>;
    private lastLoad=-Infinity;
    private last=new Map<Sound,number>();
    private loops=new Map<Sound,{source:AudioBufferSourceNode;gain:GainNode}>();
    private disposed=false;
    constructor(){try{this.enabled=localStorage.getItem('linjian-audio')!=='off';}catch{}}
    unlock(){
        if(this.disposed||!this.enabled||typeof AudioContext==='undefined')return;
        this.context??=new AudioContext();
        if(!this.master){this.master=this.context.createGain();this.master.gain.value=.65;this.master.connect(this.context.destination);}
        void this.context.resume().catch(()=>{});
        if(this.loading||this.buffers.size===names.length||Date.now()-this.lastLoad<5000)return;
        this.lastLoad=Date.now();
        this.loading=Promise.all(names.filter(name=>!this.buffers.has(name)).map(async name=>{
            try{const response=await fetch(`./audio/${name}.wav`);if(!response.ok)return;const buffer=await this.context!.decodeAudioData(await response.arrayBuffer());if(!this.disposed)this.buffers.set(name,buffer);}catch{}
        })).then(()=>{}).finally(()=>{this.loading=undefined;});
    }
    toggle(){this.enabled=!this.enabled;try{localStorage.setItem('linjian-audio',this.enabled?'on':'off');}catch{}if(this.enabled)this.unlock();else this.stopLoops();if(this.master)this.master.gain.setTargetAtTime(this.enabled?.65:0,this.context!.currentTime,.08);return this.enabled;}
    play(name:Sound,volume=1,pan=0){
        const context=this.context,buffer=this.buffers.get(name);
        if(!this.enabled||!context||context.state!=='running'||!buffer)return;
        const now=context.currentTime;if(now-(this.last.get(name)??-1)<.045)return;this.last.set(name,now);
        const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=Math.max(0,Math.min(1,volume));
        source.connect(gain);if(typeof context.createStereoPanner==='function'){const panner=context.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(panner);panner.connect(this.master!);}else gain.connect(this.master!);source.start();
    }
    ambience(underground:boolean,nearFire:number){
        if(!this.enabled||!this.context||this.context.state!=='running')return;
        for(const [name,volume]of [[underground?'cave':'forest',.65],[underground?'forest':'cave',0],['fire',nearFire*.5]] as [Sound,number][]){
            let loop=this.loops.get(name);const buffer=this.buffers.get(name);
            if(!loop&&volume>0&&buffer){const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(this.master!);source.start();loop={source,gain};this.loops.set(name,loop);}
            loop?.gain.gain.setTargetAtTime(volume,this.context.currentTime,.6);
        }
    }
    private stopLoops(){for(const {source}of this.loops.values())source.stop();this.loops.clear();}
    destroy(){this.disposed=true;this.stopLoops();void this.context?.close();}
}
