import {applyWorldDelta,type WorldDelta} from './world-delta';
import { loadArt, type Atlas } from './art';
import { createWorld, move, canBuild, distance, clearLine, WORK_TIMING, TOOL_TIMING, type WorkAction, type GameEvent, type WorldState, type Tool, type Part, type Command, type Input, type Movement } from './simulation';
import { render, pointerWorld, pickResource, buildTarget, type Position } from './renderer';
import { SPAWN, sceneAt } from './world';
import type {HeroSwing,WorkSwing} from './animation';
import {CROPS,cropProgress,plotKey,type CropKind} from './farming';
import {atLevel,floorLevel} from './structures';
import {GameAudio,type Sound} from './audio';
import {resourceAt,RESOURCE_MAP} from './world';
import {HOTBAR_SIZE,ITEMS,defaultSlots,restoreSlots,swapSlots,quickTransfer,type ItemKey,type ItemSlot} from './inventory';
type ApiReply = {
    room: string;
    playerId: string;
    token?: string;
    state: WorldState;
    networkVersion?:number;
    version?:number;
    delta?:WorldDelta;
    serverReceivedAt?:number;
    serverSentAt?:number;
    error?: string;
    message?: string;
};
export type Session = {
    room: string;
    token: string;
    playerId: string;
};
export type ClientState = {
    world: WorldState;
    session: Session | null;
    tool: Tool;
    part: Part;
    remove: boolean;
    connected: boolean;
    error: string;
    art?: Atlas;
    slots:ItemSlot[];
    selectedSlot:number;
    sound:boolean;
};
export class GameClient {
    world = createWorld();
    session: Session | null = null;
    pos: Position = { ...SPAWN, face: 'down', moving: false };
    tool: Tool = 'axe';
    part: Part = 'floor';
    remove = false;
    slots=defaultSlots();
    selectedSlot=0;
    paused = false;
    private audio=new GameAudio();
    private localWork:WorkSwing|null=null;
    private workCommand:Command|null=null;
    private predictedEvents:(GameEvent&{predicted?:boolean})[]=[];
    private feedbackQueue:{command:Command;at:number}[]=[];
    private feedbackSeen=new Map<string,number>();
    private playedEvents=new Map<string,number>();
    private suppressedHits:Record<string,number>={};
    private lastStep=0;
    private crop:CropKind='carrot';
    art?: Atlas;
    keys = new Set<string>();
    pointer: {
        x: number;
        y: number;
    } | null = null;
    screenPointer: {
        x: number;
        y: number;
    } | null = null;
    held = false;
    private heldButton=0;
    private localSwing: HeroSwing | null = null;
    private poseState='';
    private poseStarted=0;
    private unconfirmedSwing: Command | null = null;
    private movements:Movement[]=[];
    connected = false;
    error = '';
    private disposed = false;
    private frame = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private last = 0;
    private lastClick = 0;
    private seq = 0;
    private commands: Command[] = [];
    private pending: Input | null = null;
    private syncing = false;
    private flushRequested = false;
    private buildStamp = '';
    private generation = 0;
    private fadeUntil = 0;
    private networkVersion=1;
    private worldVersion:number|undefined;
    private serverOffset=0;
    private bestNetworkRtt=Infinity;
    private clockSampleAt=0;
    private commandSequence=0;
    private lastInputAt=0;
    constructor(public canvas: HTMLCanvasElement, private changed: (value: ClientState) => void, private message: (message: string) => void, private mapToggle: () => void, private apiUrl = '/api/game', private inventoryToggle:()=>void=()=>{}) {
        canvas.addEventListener('pointermove', this.pointerMove);
        canvas.addEventListener('pointerdown', this.pointerDown);
        canvas.addEventListener('contextmenu', this.contextMenu);
        canvas.addEventListener('wheel',this.wheel,{passive:false});
        window.addEventListener('pointerup', this.pointerUp);
        window.addEventListener('keydown', this.keyDown);
        window.addEventListener('keyup', this.keyUp);
        window.addEventListener('blur', this.blur);
        loadArt().then(art => { if (this.disposed)
            return; this.art = art; this.notify(); }).catch(() => { this.error = '素材加载失败'; this.notify(); });
        this.frame = requestAnimationFrame(this.animate);
    }
    notify() { if (!this.disposed)
        this.changed({ world: this.world, session: this.session, tool: this.tool, part: this.part, remove: this.remove, connected: this.connected, error: this.error, art: this.art,slots:this.slots,selectedSlot:this.selectedSlot,sound:this.audio.enabled }); }
    serverNow(localNow=Date.now()){return localNow+this.serverOffset;}
    get timeOffset(){return this.serverOffset;}
    private async request(body: unknown) {
        const sentAt=Date.now();
        const response=await fetch(this.apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
        const result=await response.json() as ApiReply,receivedAt=Date.now();
        if(!response.ok||(!result.state&&!result.delta))throw new Error(result.error||'连接失败');
        if(result.networkVersion===2&&Number.isFinite(result.serverReceivedAt)&&Number.isFinite(result.serverSentAt)){
            this.networkVersion=2;
            const rtt=Math.max(0,receivedAt-sentAt-(result.serverSentAt!-result.serverReceivedAt!));
            // Prefer the least asymmetric transit sample; permit clock refresh after a minute.
            if(rtt<=this.bestNetworkRtt+10||receivedAt-this.clockSampleAt>60000){
                this.serverOffset=((result.serverReceivedAt!-sentAt)+(result.serverSentAt!-receivedAt))/2;
                this.bestNetworkRtt=rtt;this.clockSampleAt=receivedAt;
            }
        }
        return result;
    }
    async connect(mode: 'resume' | 'create' | 'join' = 'resume', room = '') {
        const generation = ++this.generation;
        if (this.timer)
            clearTimeout(this.timer);
        this.keys.clear();
        this.pending = null;
        this.flushRequested = false;
        this.localSwing = null;
        this.unconfirmedSwing = null;
        this.movements = [];this.localWork=null;this.workCommand=null;this.feedbackQueue=[];this.predictedEvents=[];this.feedbackSeen.clear();this.playedEvents.clear();this.suppressedHits={};
        this.commands = [];
        this.worldVersion=undefined;
        this.connected = false;
        this.error = '';
        this.notify();
        try {
            let saved: Session | null = null;
            try {
                saved = JSON.parse(localStorage.getItem('linjian-session') || 'null');
            }
            catch { }
            const valid = saved && typeof saved.token === 'string' && typeof saved.room === 'string' && typeof saved.playerId === 'string';
            const body = mode === 'resume' && valid ? { action: 'sync', ...saved } : mode === 'join' ? { action: 'join', room: room.trim().toUpperCase() } : { action: 'create' };
            const result = await this.request(body);
            if (this.disposed || generation !== this.generation)
                return;
            this.session = { room: result.room, playerId: result.playerId, token: result.token || (valid ? saved!.token : '') };
            localStorage.setItem('linjian-session', JSON.stringify(this.session));
            this.world = result.state;
            this.worldVersion=result.version;
            const p = this.world.players[this.session.playerId];
            this.pos = { x: p.x, y: p.y,level:floorLevel(p), face: p.face, moving: false };
            this.seq = p.seq;
            this.loadLayout();
            this.connected = true;
            this.notify();
            this.timer = setTimeout(() => this.sync(), 160);
        }
        catch (e) {
            this.error = e instanceof Error ? e.message : '连接失败';
            this.notify();
        }
    }
    private flushActions() {
        this.flushRequested=true;
        if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
        // Finish constructing the local action before starting its request.
        queueMicrotask(()=>{if(this.flushRequested)void this.sync();});
    }
    private async sync() {
        if (this.disposed || !this.session || this.syncing)
            return;
        const sentAt=Date.now();
        this.syncing=true;
        this.flushRequested=false;
        if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
        const session = this.session, generation = this.generation;
        const delta = this.movement();
        if(!this.pending&&(this.networkVersion<2||this.commands.length||this.movements.length||sentAt-this.lastInputAt>=1000)){
            this.pending={seq:++this.seq,dx:delta.x,dy:delta.y,face:this.pos.face,commands:this.commands.splice(0,5),movements:this.movements.splice(0,64)};
            this.lastInputAt=sentAt;
        }
        try {
            const submitted = this.pending;
            const result = await this.request({ action: 'sync', ...session, input: submitted, protocol:2, poll:true, sinceVersion:this.worldVersion });
            if (this.disposed || generation !== this.generation || session !== this.session)
                return;
            if(result.delta && result.delta.base!==this.worldVersion){this.worldVersion=undefined;throw new Error('正在重新同步');}
            this.world = result.state ?? applyWorldDelta(this.world,result.delta!);
            this.worldVersion=result.version;
            if(this.unconfirmedSwing && submitted?.commands.includes(this.unconfirmedSwing))this.unconfirmedSwing=null;
            if(this.workCommand&&submitted?.commands.includes(this.workCommand))this.workCommand=null;
            this.pending = null;
            this.connected = true;
            this.error = '';
            const p = this.world.players[session.playerId];
            if(sceneAt(p.x)!==sceneAt(this.pos.x)||floorLevel(p)!==floorLevel(this.pos)){
                this.movements=[];this.keys.clear();this.held=false;this.localSwing=null;this.localWork=null;this.workCommand=null;this.feedbackQueue=[];this.unconfirmedSwing=null;this.fadeUntil=Date.now()+500;
            }
            this.pos.x=p.x;this.pos.y=p.y;this.pos.level=floorLevel(p);
            for(const segment of this.movements)move(this.world,this.pos,segment.dx*(segment.speed??4.2)*segment.seconds,segment.dy*(segment.speed??4.2)*segment.seconds);
            if (result.message)
                this.message(result.message);
            this.notify();
        }
        catch (e) {
            if (this.disposed || generation !== this.generation)
                return;
            this.connected = false;
            this.error = e instanceof Error ? e.message : '连接中断';
            this.notify();
        }
        finally {
            this.syncing=false;
            // A new connection may have attempted its first sync while the previous one was pending.
            if(!this.disposed && generation!==this.generation && this.connected && this.session)this.flushActions();
        }
        if (!this.disposed && generation === this.generation) {
            if(this.connected && this.flushRequested)this.flushActions();
            else this.timer = setTimeout(() => this.sync(), this.connected ? Math.max(0,150-(Date.now()-sentAt)) : 1600);
        }
    }
    private layoutKey(){return this.session?`linjian-layout:${this.session.room}:${this.session.playerId}`:null;}
    private loadLayout(){
        this.slots=defaultSlots();this.selectedSlot=0;
        try{const key=this.layoutKey(),saved=key?JSON.parse(localStorage.getItem(key)||'null'):null;
            if(saved){this.slots=restoreSlots(saved.slots);if(Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<HOTBAR_SIZE)this.selectedSlot=saved.selected;}
        }catch{}
        this.applySlot();
    }
    private saveLayout(){try{const key=this.layoutKey();if(key)localStorage.setItem(key,JSON.stringify({slots:this.slots,selected:this.selectedSlot}));}catch{}}
    private applySlot(){
        const item=this.slots[this.selectedSlot];this.remove=false;this.buildStamp='';
        if(item==='hammer')this.tool='build';
        else if(item==='hoe'||item==='water'||item==='pick'||item==='sword')this.tool=item;
        else if(item==='carrotSeed'||item==='tomatoSeed'||item==='wheatSeed'){this.tool='seed';this.crop=item==='carrotSeed'?'carrot':item==='tomatoSeed'?'tomato':'wheat';}
        else this.tool='axe';
    }
    selectSlot(index:number){if(!Number.isInteger(index)||index<0||index>=HOTBAR_SIZE)return;this.selectedSlot=index;this.applySlot();this.saveLayout();this.notify();}
    moveSlot(from:number,to:number){this.slots=swapSlots(this.slots,from,to);this.applySlot();this.saveLayout();this.notify();}
    quickMoveSlot(from:number){const p=this.session?this.world.players[this.session.playerId]:undefined;this.slots=quickTransfer(this.slots,from,p?.inventory);this.applySlot();this.saveLayout();this.notify();}
    private equipItem(item:ItemKey){const index=this.slots.indexOf(item);if(index>=0&&index<HOTBAR_SIZE)this.selectSlot(index);else if(index>=0){this.moveSlot(index,this.selectedSlot);} }
    setTool(tool:Tool){this.equipItem(tool==='build'?'hammer':tool==='seed'?CROPS[this.crop].seed:tool);}
    setPart(part:Part){this.part=part;this.equipItem('hammer');this.notify();}
    toggleRemove() {const next=!this.remove;this.setPart(this.part);this.remove=next;this.notify();}
    pauseControls(){this.keys.clear();this.held=false;this.heldButton=0;this.buildStamp='';}
    toggleSound(){this.audio.toggle();this.notify();}
    press(key: string, down: boolean) { this.audio.unlock();if (down)
        this.keys.add(key);
    else
        this.keys.delete(key); }
    private toolLockUntil() {
        const p=this.session?this.world.players[this.session.playerId]:undefined;
        return Math.max(this.localSwing?.until??0,this.localWork?.until??0,(p?.swingUntil??0)-this.serverOffset);
    }
    private toolLocked(now=Date.now()) {
        // Before dispatch, movement must stay out of the attack's pre-action movement batch.
        // Once sent, the bounded server timestamp lets local recovery finish before its acknowledgement.
        const awaitingDispatch=!!this.unconfirmedSwing&&(this.networkVersion<2||this.commands.includes(this.unconfirmedSwing));
        return awaitingDispatch||!!this.workCommand&&this.commands.includes(this.workCommand)||now<this.toolLockUntil();
    }
    private dodgePending() {
        return this.commands.some(c=>c.type==='dodge') || !!this.pending?.commands.some(c=>c.type==='dodge');
    }
    command(command: Command) {
        if(command.type==='dodge' && this.toolLocked())return false;
        if(this.paused || !this.connected || this.commands.length>=5)return false;
        command.id??=`${this.session?.playerId}:${++this.commandSequence}:${Date.now()}`;command.issuedAt??=this.serverNow();command.face??=this.pos.face;
        this.commands.push(command);this.flushActions();
        return true;
    }
    private movement() { if (this.paused || !this.connected || this.toolLocked())
        return { x: 0, y: 0 }; const x = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')), y = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')); const n = Math.max(1, Math.hypot(x, y)); return { x: x / n, y: y / n }; }
    private startWork(action:WorkAction,command:Command,now:number){
        if(!this.command(command))return false;
        this.workCommand=command;this.localWork={action,face:this.pos.face,start:now,until:now+WORK_TIMING[action].duration};
        this.feedbackQueue.push({command,at:now+WORK_TIMING[action].contact});return true;
    }
    private act(){
        if(this.paused||!this.connected||!this.session)return;
        const now=Date.now(),p=this.world.players[this.session.playerId],item=this.slots[this.selectedSlot];
        if(!item||!p)return;
        const farm=this.tool==='hoe'||this.tool==='water'||this.tool==='seed';
        if(ITEMS[item].kind==='resource'&&!farm){
            if(now-this.lastClick>=400){if(item==='essence')this.command({type:'heal'});else if(item==='carrot'||item==='tomato')this.command({type:'eat',crop:item});this.lastClick=now;}return;
        }
        if(this.workCommand||this.unconfirmedSwing||this.toolLocked(now)||this.dodgePending()||this.serverNow(now)<p.dodgeUntil)return;
        const point=this.pointer??{x:this.pos.x+(this.pos.face==='right'?1:this.pos.face==='left'?-1:0),y:this.pos.y+(this.pos.face==='down'?1:this.pos.face==='up'?-1:0)};
        const dx=point.x-this.pos.x,dy=point.y-this.pos.y;if(Math.hypot(dx,dy)>.1)this.pos.face=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
        if(this.tool==='build'){
            if(now-this.lastClick<300)return;
            const removing=this.remove||this.heldButton===2,cell=buildTarget(point,this.world,removing,floorLevel(this.pos)),stamp=`${cell.x}:${cell.y}:${this.part}:${removing}:${floorLevel(this.pos)}`;
            if(this.held&&stamp===this.buildStamp)return;this.buildStamp=stamp;
            if(!removing){const error=canBuild(this.world,{...p,...this.pos},cell.x,cell.y,this.part);if(error){this.message(error);return;}}
            if(!this.startWork('hammer',removing?{type:'remove',...cell}:{type:'build',...cell,part:this.part},now))return;
        }else if(farm){
            if(this.serverNow(now)<p.actionAt)return;
            const x=Math.floor(point.x),y=Math.floor(point.y),plot=this.world.plots?.[plotKey(x,y)],ripe=plot?.crop&&cropProgress(plot,this.serverNow(now))>=CROPS[plot.crop].seconds;
            const type=ripe?'harvest':this.tool==='hoe'?'till':this.tool==='water'?'water':'plant',stamp=`${x}:${y}:${type}:${this.crop}`;
            if(this.held&&stamp===this.buildStamp)return;this.buildStamp=stamp;
            if(type==='harvest'){if(!this.startWork('plant',{type,x,y},now))return;}
            else if(!this.startWork(type==='till'?'hoe':type==='water'?'water':'plant',{type,x,y,crop:this.crop},now))return;
        }else{
            if(this.unconfirmedSwing||this.serverNow(now)<p.actionAt)return;
            const tool=this.tool as 'axe'|'pick'|'sword';if(now-this.lastClick<TOOL_TIMING[tool].cooldown)return;
            const target=tool==='sword'?this.world.mobs.filter(m=>m.hp>0&&floorLevel(m)===floorLevel(this.pos)&&Math.hypot(point.x-m.x,point.y-m.y)<1.8).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0]?.id:pickResource(point,this.world,this.pos)?.id;
            const command:Command={type:'attack',tool,target,face:this.pos.face};if(!this.command(command))return;
            this.unconfirmedSwing=command;this.localSwing={tool,face:this.pos.face,start:now,until:now+TOOL_TIMING[tool].duration};
            this.feedbackQueue.push({command,at:now+TOOL_TIMING[tool].contact});this.audio.play('swing',.65);
        }
        this.lastClick=now;
    }
    private feedback(now:number){
        const time=this.serverNow(now);
        for(const entry of this.feedbackQueue.filter(v=>v.at<=now)){
            const c=entry.command;
            if(c.type==='attack'){
                let target:{id:string;x:number;y:number}|undefined,sound:Sound='hit',amount=18;
                if(c.tool==='sword')target=this.world.mobs.find(m=>m.id===c.target&&m.hp>0&&floorLevel(m)===floorLevel(this.pos)&&distance(this.pos,m)<2.3&&clearLine(this.world,this.pos,m))??this.world.mobs.filter(m=>m.hp>0&&floorLevel(m)===floorLevel(this.pos)&&distance(this.pos,m)<1.9&&clearLine(this.world,this.pos,m)).sort((a,b)=>distance(this.pos,a)-distance(this.pos,b))[0];
                else{const r=c.target?RESOURCE_MAP.get(c.target):undefined;if(r&&floorLevel(this.pos)===0&&!this.world.depleted[r.id]&&distance(this.pos,{x:r.x+.5,y:r.y+.5})<2.5&&c.tool===(r.kind==='tree'||r.kind==='pine'||r.kind==='berry'?'axe':'pick')){target={id:r.id,x:r.x+.5,y:r.y+.5};sound=r.kind==='tree'||r.kind==='pine'||r.kind==='berry'?'wood':'stone';amount=1;}}
                if(target){this.predictedEvents.push({id:'predicted:'+c.id,time,x:target.x,y:target.y,kind:'hit',amount,actorId:this.session?.playerId,commandId:c.id,targetId:target.id,level:floorLevel(this.pos),predicted:true});this.audio.play(sound,.8);if(c.id)this.feedbackSeen.set(c.id,time);}
            }else{this.audio.play(c.type==='build'||c.type==='remove'?'build':c.type==='harvest'?'harvest':c.type==='till'?'till':c.type==='water'?'water':'plant',.7);if(c.id)this.feedbackSeen.set(c.id,time);}
        }
        this.feedbackQueue=this.feedbackQueue.filter(v=>v.at>now);
        for(const event of this.world.events){
            if(event.actorId===this.session?.playerId&&event.commandId&&this.feedbackQueue.some(entry=>entry.command.id===event.commandId&&entry.at>now))continue;
            if(this.playedEvents.has(event.id)||time-event.time>1400)continue;this.playedEvents.set(event.id,time);
            const anticipated=['hit','harvest','build','till','plant','water'].includes(event.kind)&&!!event.commandId&&this.feedbackSeen.has(event.commandId);
            if(anticipated&&event.targetId){const mob=this.world.mobs.find(m=>m.id===event.targetId);if(mob)this.suppressedHits[mob.id]=mob.hitUntil;}
            if(anticipated||floorLevel(event)!==floorLevel(this.pos)||sceneAt(event.x)!==sceneAt(this.pos.x))continue;
            const d=distance(this.pos,event);if(d>14)continue;
            let sound:Sound|undefined;
            if(event.kind==='hit'){const r=event.amount===1?resourceAt(event.x,event.y):undefined;sound=r?(r.kind==='tree'||r.kind==='pine'||r.kind==='berry'?'wood':'stone'):'hit';}
            else if(['door','hurt','spore','harvest'].includes(event.kind))sound=event.kind as Sound;
            else if(['wood','stone','copper','essence'].includes(event.kind))sound='harvest';
            else if(event.actorId!==this.session?.playerId&&['build','till','plant','water'].includes(event.kind))sound=event.kind as Sound;
            if(sound)this.audio.play(sound,Math.max(.1,1-d/14),Math.max(-1,Math.min(1,(event.x-this.pos.x)/8)));
        }
        for(const mob of this.world.mobs){const key=`mob:${mob.id}:${mob.windup}`;if(mob.windup>time&&!this.playedEvents.has(key)&&distance(this.pos,mob)<12){if(mob.kind==='bat'||mob.kind==='boar')this.audio.play(mob.kind,.55,(mob.x-this.pos.x)/12);this.playedEvents.set(key,time);}}
        this.predictedEvents=this.predictedEvents.filter(v=>time-v.time<420);
        for(const [id,t]of this.feedbackSeen)if(time-t>8000)this.feedbackSeen.delete(id);
        for(const [id,t]of this.playedEvents)if(time-t>8000)this.playedEvents.delete(id);
        if(this.pos.moving&&now-this.lastStep>260){this.audio.play(atLevel(this.world.buildings,Math.floor(this.pos.x),Math.floor(this.pos.y),'floor',floorLevel(this.pos))?'wood-step':'grass-step',.55);this.lastStep=now;}
        this.audio.ambience(sceneAt(this.pos.x)==='mine',Math.max(0,1-distance(this.pos,SPAWN)/8));
    }
    private animate = (time: number) => {
        if (this.disposed)
            return;
        const frameDt = Math.min(.045, (time - this.last) / 1000 || 0);
        const dt = Math.max(0,Math.min(frameDt,(Date.now()-this.toolLockUntil())/1000));
        this.last = time;
        const d = this.movement();
        this.pos.moving = !!(d.x || d.y);
        if (this.pos.moving) {
            this.pos.face = Math.abs(d.x) > Math.abs(d.y) ? d.x > 0 ? 'right' : 'left' : d.y > 0 ? 'down' : 'up';
            const player = this.session ? this.world.players[this.session.playerId] : undefined;
            const speed = player && Date.now()+this.serverOffset < player.dodgeUntil ? 9 : 4.2;
            move(this.world, this.pos, d.x * speed * dt, d.y * speed * dt);
            const last=this.movements[this.movements.length-1];
            if(last && last.dx===d.x && last.dy===d.y && last.speed===speed && last.seconds<.3)last.seconds+=dt;
            else this.movements.push({dx:d.x,dy:d.y,seconds:dt,speed});
        }
        if (this.screenPointer)
            this.pointer = pointerWorld(this.canvas, this.pos, this.screenPointer.x, this.screenPointer.y);
        if (this.held)
            this.act();
        const now=Date.now();this.feedback(now);const pose=now<Math.max(this.localSwing?.until??0,this.localWork?.until??0)?'tool':this.pos.moving?'walk':'idle';
        if(pose!==this.poseState){this.poseState=pose;this.poseStarted=now;}
        if (this.art)
            render(this.canvas, this.world, this.session?.playerId || '', this.pos, { tool: this.tool, part: this.part, remove: this.remove||this.heldButton===2, pointer: this.pointer, time: now+this.serverOffset, roomKey: this.session?.room, fadeUntil:this.fadeUntil+this.serverOffset, localSwing:this.localSwing?{...this.localSwing,start:this.localSwing.start+this.serverOffset,until:this.localSwing.until+this.serverOffset}:null, motionElapsed:now-this.poseStarted,localWork:this.localWork?{...this.localWork,start:this.localWork.start+this.serverOffset,until:this.localWork.until+this.serverOffset}:null,predictedEvents:this.predictedEvents,suppressedHits:this.suppressedHits,settledCommands:new Set(this.feedbackSeen.keys()) }, this.art);
        this.frame = requestAnimationFrame(this.animate);
    };
    private pointerMove = (e: PointerEvent) => { this.screenPointer = { x: e.clientX, y: e.clientY }; this.pointer = pointerWorld(this.canvas, this.pos, e.clientX, e.clientY); };
    private pointerDown=(e:PointerEvent)=>{
        this.audio.unlock();if(e.button!==0&&e.button!==2)return;
        if(this.paused)return;
        if(e.button===2&&this.tool!=='build'){
            e.preventDefault();this.pointerMove(e);
            const point=this.pointer,door=point?atLevel(this.world.buildings,Math.floor(point.x),Math.floor(point.y),'wall',floorLevel(this.pos)):undefined;
            if(door?.kind==='door')this.command({type:'interact',target:door.id});
            return;
        }
        e.preventDefault();this.pointerMove(e);this.held=true;this.heldButton=e.button;this.buildStamp='';
        if(e.button===0||this.tool==='build')this.act();
    };
    private pointerUp = () => { this.held = false; this.heldButton=0; this.buildStamp = ''; };
    private contextMenu = (e: Event) => e.preventDefault();
    private wheel=(e:WheelEvent)=>{if(this.paused||!e.deltaY||e.ctrlKey)return;e.preventDefault();this.selectSlot((this.selectedSlot+(e.deltaY>0?1:-1)+HOTBAR_SIZE)%HOTBAR_SIZE);};
    private keyDown = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement)?.matches('input,textarea'))
            return;
        this.audio.unlock();const key = e.key.toLowerCase();
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key))
            e.preventDefault();
        this.keys.add(key);
        if (e.repeat)
            return;
        if(key==='e'){e.preventDefault();this.pauseControls();this.inventoryToggle();return;}
        if (key === 'm') {
            this.mapToggle();
            return;
        }
        if (this.paused)
            return;
        if (/^[1-9]$/.test(key)){e.preventDefault();this.selectSlot(Number(key)-1);return;}
        if (key === 'b')
            this.setTool(this.tool === 'build' ? 'axe' : 'build');
        if (key === 'x')
            this.toggleRemove();
        if (key === 'r')
            this.command({ type: 'heal' });
        if (key === 'f')
            this.command({ type: e.shiftKey?'descend':'interact' });
        if (key === ' ')
            this.command({ type: 'dodge' });
    };
    private keyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    private blur = () => { this.keys.clear(); this.held = false; this.heldButton=0; };
    destroy() { this.audio.destroy();this.disposed = true; cancelAnimationFrame(this.frame); if (this.timer)
        clearTimeout(this.timer); this.canvas.removeEventListener('pointermove', this.pointerMove); this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('contextmenu', this.contextMenu);this.canvas.removeEventListener('wheel',this.wheel); window.removeEventListener('pointerup', this.pointerUp); window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur); }
}
