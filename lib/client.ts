import {CAMPFIRE,cookingRecipe,nearCampfire,canCast} from './activities';
import {applyWorldDelta,type WorldDelta} from './world-delta';
import { loadArt, type Atlas } from './art';
import {getAssetLoading,subscribeAssets} from './asset-loading';
import { applyInput,createPlayer,createWorld,normalizeWorld,tickWorld,move,canBuild,distance,clearLine,isBlocked,WORK_TIMING,TOOL_TIMING,type WorkAction,type GameEvent,type WorldState,type Tool,type Part,type Command,type Input,type Movement } from './simulation';
import { render, prepareWorldMap, pointerWorld, pickResource, buildTarget, type Position } from './renderer';
import { SPAWN, sceneAt, CAVE_ENTRANCE, MINE } from './world';
import type {HeroSwing,WorkSwing} from './animation';
import {CROPS,cropProgress,plotKey,type CropKind} from './farming';
import {atLevel,floorLevel,SIGN_TEXT_LIMIT,normalizeSignText} from './structures';
import {GameAudio,type Sound} from './audio';
import {resourceAt,RESOURCE_MAP} from './world';
import {HOTBAR_SIZE,ITEMS,defaultSlots,restoreSlots,reconcileSlots,swapSlots,quickTransfer,type ItemKey,type ItemSlot} from './inventory';
type ApiReply = {
    room: string;
    playerId: string;
    token?: string;
    state: WorldState;
    networkVersion?:number;
    structureVersion?:1;
    version?:number;
    delta?:WorldDelta;
    serverReceivedAt?:number;
    serverSentAt?:number;
    error?: string;
    message?: string;
};
class MultiplayerUnavailableError extends Error{}
export type Session = {
    room: string;
    token: string;
    playerId: string;
    local?:true;
};
export type LoadingState={generation:number;phase:'assets'|'world'|'scene'|'ready'|'error';completed:number;total:number;error:string};
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
    localSaved:boolean;
    loading:LoadingState;
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
    private sleepDispatchId:string|undefined;
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
    private heldPointerId:number|null=null;
    private localSwing: HeroSwing | null = null;
    private poseState='';
    private poseStarted=0;
    private unconfirmedSwing: Command | null = null;
    private movements:Movement[]=[];
    connected = false;
    error = '';
    ready = false;
    private preparationFrame=0;
    private preparationResolve:(()=>void)|undefined;
    private preparingGeneration=-1;
    private scenePrepared=false;
    private sceneError='';
    private stopAssets=()=>{};
    private disposed = false;
    private frame = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private last = 0;
    private lastClick = 0;
    private lastInteractAt=0;
    private seq = 0;
    private commands: Command[] = [];
    private pending: Input | null = null;
    private syncing = false;
    private flushRequested = false;
    private buildStamp = '';
    private generation = 0;
    private connectionIntent:{mode:'resume'|'create'|'join'|'local';room:string}={mode:'resume',room:''};
    private fadeUntil = 0;
    private networkVersion=1;
    private worldVersion:number|undefined;
    private serverOffset=0;
    private bestNetworkRtt=Infinity;
    private clockSampleAt=0;
    private commandSequence=0;
    private lastInputAt=0;
    private localMode=false;
    private localSaved=false;
    private lastLocalSaveAt=0;
    private activeSignId:string|null=null;
    private signSave:{command:Command;resolve:(error:string|null)=>void}|null=null;
    constructor(public canvas: HTMLCanvasElement, private changed: (value: ClientState) => void, private message: (message: string) => void, private mapToggle: () => void, private apiUrl = '/api/game', private inventoryToggle:()=>void=()=>{},private signToggle:(id:string|null)=>void=()=>{}) {
        canvas.addEventListener('pointermove', this.pointerMove);
        canvas.addEventListener('pointerdown', this.pointerDown);
        canvas.addEventListener('contextmenu', this.contextMenu);
        canvas.addEventListener('wheel',this.wheel,{passive:false});
        window.addEventListener('pointerup', this.pointerUp);
        window.addEventListener('pointercancel',this.pointerUp);
        window.addEventListener('keydown', this.keyDown);
        window.addEventListener('keyup', this.keyUp);
        window.addEventListener('blur', this.blur);
        window.addEventListener('resize',this.viewportChanged);
        this.stopAssets=subscribeAssets(()=>this.notify());
        void this.loadAssets();
        this.frame = requestAnimationFrame(this.animate);
    }
    notify() { if (!this.disposed)
        this.changed({ world: this.world, session: this.session, tool: this.tool, part: this.part, remove: this.remove, connected: this.connected, error: this.error, art: this.art,slots:this.slots,selectedSlot:this.selectedSlot,sound:this.audio.enabled,localSaved:this.localSaved,loading:this.loading }); }
    get playable(){return this.ready&&this.connected&&!this.disposed;}
    get loading():LoadingState{
        const assets=getAssetLoading(),total=assets.total+4;
        const completed=assets.loaded+Number(!!this.art)+Number(this.connected)+Number(this.scenePrepared)+Number(this.ready);
        const error=this.sceneError||this.error||assets.error;
        return{generation:this.generation,phase:this.ready?'ready':error?'error':!this.art?'assets':!this.connected?'world':'scene',completed,total,error:this.ready?'':error};
    }
    private async loadAssets(){
        try{const art=await loadArt();if(this.disposed)return;this.art=art;this.notify();void this.prepareScene();}
        catch{if(!this.disposed)this.notify();}
    }
    private nextPreparationFrame=()=>new Promise<void>(resolve=>{
        this.preparationResolve=resolve;
        this.preparationFrame=requestAnimationFrame(()=>{this.preparationFrame=0;this.preparationResolve=undefined;resolve();});
    });
    private cancelPreparation(){
        cancelAnimationFrame(this.preparationFrame);this.preparationFrame=0;
        this.preparationResolve?.();this.preparationResolve=undefined;this.preparingGeneration=-1;
    }
    private async prepareScene(){
        if(this.disposed||!this.art||!this.connected||!this.session||this.ready||this.preparingGeneration===this.generation)return;
        const generation=this.generation,active=()=>!this.disposed&&generation===this.generation&&this.connected;
        this.preparingGeneration=generation;this.sceneError='';this.notify();
        try{
            // Paint the loader before map generation and its first game frame.
            await this.nextPreparationFrame();if(!active())return;
            await prepareWorldMap(this.nextPreparationFrame,active);if(!active())return;
            this.scenePrepared=true;this.notify();
            await this.nextPreparationFrame();if(!active())return;
            this.draw(Date.now());this.pauseControls();this.last=0;this.ready=true;this.notify();
        }catch(error){if(active()){this.sceneError=error instanceof Error?error.message:'场景准备失败';this.notify();}}
        finally{if(generation===this.generation)this.preparingGeneration=-1;}
    }
    serverNow(localNow=Date.now()){return localNow+this.serverOffset;}
    get timeOffset(){return this.serverOffset;}
    private localStorageKey(session:Pick<Session,'room'|'playerId'>){return`linjian-local-world:${session.room}:${session.playerId}`;}
    private localId(){try{return crypto.randomUUID().replaceAll('-','');}catch{return Math.random().toString(36).slice(2)+Date.now().toString(36);}}
    private newLocalReply(now=Date.now()):ApiReply{
        const seed=this.localId().toUpperCase(),room=('LOCAL'+seed).slice(0,8),playerId=this.localId().slice(0,8),token='local-'+this.localId();
        const state=createWorld(now);state.players[playerId]=createPlayer(playerId,'local','旅人',0,now);
        return{room,playerId,token,state};
    }
    private restoredLocalReply(saved:Session,now=Date.now()):ApiReply{
        let state:WorldState|undefined;
        try{const value=JSON.parse(localStorage.getItem(this.localStorageKey(saved))||'null') as WorldState|null;if(value&&typeof value==='object'&&value.players&&value.players[saved.playerId]){normalizeWorld(value,now);state=value;}}catch{}
        if(!state)throw new Error('本机存档无法读取，请返回主菜单新建世界');
        return{room:saved.room,playerId:saved.playerId,token:saved.token,state};
    }
    private saveLocalWorld(force=false){
        if(!this.localMode||!this.session)return false;
        const now=Date.now();
        if(!this.localSaved&&this.lastLocalSaveAt>0&&now-this.lastLocalSaveAt<5000)return false;
        if(!force&&now-this.lastLocalSaveAt<1000)return this.localSaved;
        this.lastLocalSaveAt=now;
        try{
            const session=JSON.stringify(this.session),world=JSON.stringify(this.world);
            localStorage.setItem(this.localStorageKey(this.session),world);
            localStorage.setItem('linjian-session',session);
            this.localSaved=true;
        }catch{this.localSaved=false;}
        return this.localSaved;
    }
    private localRequest(body:unknown):ApiReply{
        if(!this.session)throw new Error('本机世界尚未准备好');
        const payload=body as{action?:string;input?:Input};const now=Date.now();tickWorld(this.world,now);
        const player=this.world.players[this.session.playerId];let message:string|null=null;
        if(payload.action==='sync'&&player){if(payload.input)message=applyInput(this.world,player.id,payload.input,now);else player.seen=now;}
        this.saveLocalWorld(!!payload.input?.commands.length);
        return{room:this.session.room,playerId:this.session.playerId,token:this.session.token,state:this.world,message:message??undefined};
    }
    private connectionError(error:unknown){
        const message=error instanceof Error?error.message:'';
        if(typeof DOMException!=='undefined'&&error instanceof DOMException&&error.name==='TimeoutError')return'多人服务器连接超时';
        if(error instanceof TypeError||/failed to fetch|load failed|networkerror|unexpected token|json/i.test(message))return'多人服务器暂时无法连接';
        return message||'连接失败';
    }
    private canAutoFallback(error:unknown){
        try{return error instanceof MultiplayerUnavailableError&&typeof location!=='undefined'&&new URL(this.apiUrl,location.href).origin!==location.origin;}catch{return false;}
    }
    private async request(body: unknown) {
        if(this.localMode)return this.localRequest(body);
        const sentAt=Date.now(),requestGeneration=this.generation;
        let response:Response;
        try{response=await fetch(this.apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});}
        catch(error){
            const timedOut=typeof DOMException!=='undefined'&&error instanceof DOMException&&error.name==='TimeoutError';
            if(error instanceof TypeError||timedOut)throw new MultiplayerUnavailableError(timedOut?'多人服务器连接超时':'多人服务器暂时无法连接');
            throw error;
        }
        let result:ApiReply;try{result=await response.json() as ApiReply;}catch{
            if(response.status===403||response.status===429||response.status>=500)throw new MultiplayerUnavailableError('多人服务器暂时无法连接');
            throw new Error('服务器响应异常');
        }
        const receivedAt=Date.now();
        if(!response.ok){if(response.status===403||response.status===429||response.status>=500)throw new MultiplayerUnavailableError(result.error||'多人服务器暂时无法连接');throw new Error(result.error||'连接失败');}
        if(!result.state&&!result.delta)throw new Error(result.error||'连接失败');
        if(this.disposed||requestGeneration!==this.generation)return result;
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
    async retryConnection(){
        if(this.disposed)return;
        this.sceneError='';
        if(!this.art)void this.loadAssets();
        if(!this.connected)return this.connect(this.connectionIntent.mode,this.connectionIntent.room);
        void this.prepareScene();this.notify();
    }
    async connect(mode: 'resume' | 'create' | 'join' | 'local' = 'resume', room = '') {
        if(this.disposed)return;
        this.connectionIntent={mode,room};
        this.signSave?.resolve('已切换世界');this.signSave=null;if(this.activeSignId){this.activeSignId=null;this.signToggle(null);}
        const generation = ++this.generation;
        this.cancelPreparation();this.ready=false;this.scenePrepared=false;this.sceneError='';
        if (this.timer)
            clearTimeout(this.timer);
        this.pauseControls();
        this.pending = null;
        this.flushRequested = false;
        this.localSwing = null;
        this.unconfirmedSwing = null;
        this.movements = [];this.localWork=null;this.workCommand=null;this.feedbackQueue=[];this.predictedEvents=[];this.feedbackSeen.clear();this.playedEvents.clear();this.suppressedHits={};
        this.commands = [];
        this.worldVersion=undefined;
        this.connected = false;
        this.localSaved=false;
        this.lastLocalSaveAt=0;
        this.error = '';
        this.notify();
        try {
            let saved: Session | null = this.session;
            try {
                if(!saved)saved = JSON.parse(localStorage.getItem('linjian-session') || 'null');
            }
            catch { }
            const valid = !!(saved && typeof saved.token === 'string' && typeof saved.room === 'string' && typeof saved.playerId === 'string');
            let result:ApiReply;
            if(mode==='local'){
                this.localMode=true;result=this.newLocalReply();
            }else if(mode==='resume'&&valid&&saved!.local){
                this.localMode=true;result=this.restoredLocalReply(saved!);
            }else{
                this.localMode=false;
                const body = mode === 'resume' && valid ? { action: 'sync', ...saved } : mode === 'join' ? { action: 'join', room: room.trim().toUpperCase() } : { action: 'create' };
                try{result=await this.request(body);}catch(error){
                    if(mode!=='create'||!this.canAutoFallback(error))throw error;
                    this.localMode=true;result=this.newLocalReply();
                }
            }
            if (this.disposed || generation !== this.generation)
                return;
            this.session = { room: result.room, playerId: result.playerId, token: result.token || (valid ? saved!.token : ''),...(this.localMode?{local:true as const}:{}) };
            this.world = result.state;
            // Trust the responding server's capability, not a saved world's
            // migration marker (which could survive a server rollback).
            this.world={...this.world,structureVersion:this.localMode||result.structureVersion===1?1:undefined};
            this.worldVersion=result.version;

            const p = this.world.players[this.session.playerId];
            this.pos = { x: p.x, y: p.y,level:floorLevel(p), face: p.face, moving: false };
            this.seq = p.seq;
            this.loadLayout();
            this.connected = true;
            if(this.localMode){
                this.networkVersion=2;this.serverOffset=0;this.bestNetworkRtt=Infinity;this.clockSampleAt=0;
                const saved=this.saveLocalWorld(true);this.message(saved?(mode==='local'?'已进入本机世界':'多人服务器不可用，已进入本机世界'):'已进入本机世界，但此设备无法保存');
            }else try{localStorage.setItem('linjian-session', JSON.stringify(this.session));}catch{}
            this.connectionIntent={mode:'resume',room:''};
            this.notify();void this.prepareScene();
            this.timer = setTimeout(() => this.sync(), 160);
        }
        catch (e) {
            if(this.disposed||generation!==this.generation)return;
            this.error = this.connectionError(e);
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
            const sleep=submitted?.commands.find(command=>command.type==='sleep');
            if(sleep&&sleep.id!==this.sleepDispatchId){
                this.sleepDispatchId=sleep.id;sleep.issuedAt=this.serverNow(sentAt);
                const bed=sleep.target?this.world.buildings[sleep.target]:undefined;
                if(bed?.kind==='bed')this.pos={...this.pos,x:bed.x+.5,y:bed.y+.75,face:'up'};
                this.localWork={action:'sleep',face:'up',start:sentAt,until:sentAt+WORK_TIMING.sleep.duration};
                this.feedbackQueue.push({command:sleep,at:sentAt+WORK_TIMING.sleep.contact});
            }
            const result = await this.request({ action: 'sync', ...session, input: submitted, protocol:2, poll:true, sinceVersion:this.worldVersion });
            if (this.disposed || generation !== this.generation || session !== this.session)
                return;
            if(result.delta && result.delta.base!==this.worldVersion){this.worldVersion=undefined;throw new Error('正在重新同步');}
            this.world = result.state ?? applyWorldDelta(this.world,result.delta!);
            this.world={...this.world,structureVersion:this.localMode||result.structureVersion===1?1:undefined};
            this.worldVersion=result.version;
            if(this.signSave&&submitted?.commands.includes(this.signSave.command)){
                const save=this.signSave;this.signSave=null;
                const sign=this.world.buildings[save.command.target!];
                save.resolve(sign?.kind==='sign'&&sign.text===save.command.text?null:result.message||'保存失败，请重试');
            }
            if(this.unconfirmedSwing && submitted?.commands.includes(this.unconfirmedSwing))this.unconfirmedSwing=null;
            if(this.workCommand&&submitted?.commands.includes(this.workCommand))this.workCommand=null;
            this.pending = null;
            this.connected = true;
            this.error = '';
            const p = this.world.players[session.playerId];
            const sleepKnown=this.sleepDispatchId&&(sleep?.id===this.sleepDispatchId||p.lastCommandId===this.sleepDispatchId);
            if(this.localWork?.action==='sleep'&&((sleepKnown&&(p.lastCommandId!==this.sleepDispatchId||p.workAction!=='sleep'||(p.workUntil??0)<=this.serverNow()))||(p.hurtAt??-Infinity)>=this.serverNow(this.localWork.start))){
                this.localWork=null;this.feedbackQueue=this.feedbackQueue.filter(entry=>entry.command.id!==this.sleepDispatchId);
            }
            if(sceneAt(p.x)!==sceneAt(this.pos.x)||floorLevel(p)!==floorLevel(this.pos)){
                this.movements=[];this.keys.clear();this.held=false;this.localSwing=null;this.localWork=null;this.workCommand=null;this.feedbackQueue=[];this.unconfirmedSwing=null;this.fadeUntil=Date.now()+500;
            }
            this.pos.x=p.x;this.pos.y=p.y;this.pos.level=floorLevel(p);
            for(const segment of this.movements)move(this.world,this.pos,segment.dx*(segment.speed??4.2)*segment.seconds,segment.dy*(segment.speed??4.2)*segment.seconds);
            this.syncSlots();
            if (result.message)
                this.message(result.message);
            this.notify();if(!this.ready)void this.prepareScene();
        }
        catch (e) {
            if (this.disposed || generation !== this.generation)
                return;
            this.connected = false;
            this.error = this.connectionError(e);
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
    private signAt(target:string){
        const sign=Object.hasOwn(this.world.buildings,target)?this.world.buildings[target]:undefined;
        return sign?.kind==='sign'&&floorLevel(sign)===floorLevel(this.pos)&&distance(this.pos,{x:sign.x+.5,y:sign.y+.5})<=2.7?sign:undefined;
    }
    readSign(target?:string){
        if(this.paused||!this.playable||!this.session||this.toolLocked()||this.workCommand||this.unconfirmedSwing)return false;
        const sign=target?this.signAt(target):Object.values(this.world.buildings).filter(b=>this.signAt(b.id)).sort((a,b)=>distance(this.pos,{x:a.x+.5,y:a.y+.5})-distance(this.pos,{x:b.x+.5,y:b.y+.5}))[0];
        if(!sign)return false;
        this.wakeSleep();this.pauseControls();this.paused=true;this.activeSignId=sign.id;this.signToggle(sign.id);return true;
    }
    closeSign(){this.activeSignId=null;}
    saveSign(target:string,value:string):Promise<string|null>{
        if(this.disposed||!this.playable||!this.session)return Promise.resolve('连接中断，请重试');
        if(this.signSave)return Promise.resolve('正在保存');
        if(this.activeSignId!==target||!this.signAt(target))return Promise.resolve('请靠近同层告示牌');
        const text=normalizeSignText(value);if(Array.from(text).length>SIGN_TEXT_LIMIT)return Promise.resolve('最多240字');
        return new Promise(resolve=>{
            const command:Command={type:'writeSign',target,text};this.signSave={command,resolve};
            if(!this.command(command)){this.signSave=null;resolve('暂时无法保存，请重试');}
        });
    }
    interact(){
        if(this.paused||!this.playable||!this.session)return false;
        const now=Date.now(),p=this.world.players[this.session.playerId];if(!p)return false;
        const level=floorLevel(this.pos),near=(b:{x:number;y:number},range:number)=>distance(this.pos,{x:b.x+.5,y:b.y+.5})<range;
        if(level===0&&distance(this.pos,sceneAt(this.pos.x)==='mine'?MINE.exit:CAVE_ENTRANCE)<=2)return this.command({type:'interact'});
        const stairs=Object.values(this.world.buildings).filter(b=>b.kind==='stairs'&&(floorLevel(b)===level||floorLevel(b)===level-1)&&near(b,2.3)).sort((a,b)=>Math.abs(floorLevel(a)-level)-Math.abs(floorLevel(b)-level)||distance(this.pos,a)-distance(this.pos,b))[0];
        if(stairs)return this.command({type:'interact',target:stairs.id});
        const plot=level===0&&sceneAt(this.pos.x)!=='mine'?Object.values(this.world.plots??{}).filter(plot=>plot.crop&&cropProgress(plot,this.serverNow(now))>=CROPS[plot.crop].seconds&&distance(this.pos,plot)<2).sort((a,b)=>distance(this.pos,a)-distance(this.pos,b))[0]:undefined;
        if(plot){
            this.wakeSleep();
            if(this.workCommand||this.unconfirmedSwing||this.toolLocked(now)||this.dodgePending()||this.serverNow(now)<Math.max(p.actionAt,p.dodgeUntil))return false;
            const dx=plot.x+.5-this.pos.x,dy=plot.y+.5-this.pos.y;if(Math.hypot(dx,dy)>.1)this.pos.face=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
            return this.startWork('harvest',{type:'harvest',x:plot.x,y:plot.y},now);
        }
        const door=Object.values(this.world.buildings).filter(b=>b.kind==='door'&&floorLevel(b)===level&&near(b,2)).sort((a,b)=>distance(this.pos,a)-distance(this.pos,b))[0];
        if(door)return this.command({type:'interact',target:door.id});
        if(this.tryActivity())return true;
        if(this.readSign())return true;
        return this.command({type:'interact'});
    }
    private layoutKey(){return this.session?`linjian-layout:${this.session.room}:${this.session.playerId}`:null;}
    private loadLayout(){
        const inventory=this.session?this.world.players[this.session.playerId]?.inventory:undefined;
        this.slots=defaultSlots(inventory);this.selectedSlot=0;
        try{const key=this.layoutKey(),saved=key?JSON.parse(localStorage.getItem(key)||'null'):null;
            if(saved){this.slots=restoreSlots(saved.slots,inventory);if(Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<HOTBAR_SIZE)this.selectedSlot=saved.selected;}
        }catch{}
        this.applySlot();
    }
    private syncSlots(){
        const inventory=this.session?this.world.players[this.session.playerId]?.inventory:undefined;if(!inventory)return;
        const next=reconcileSlots(this.slots,inventory);if(next===this.slots)return;
        const selected=this.slots[this.selectedSlot];this.slots=next;
        if(selected!==this.slots[this.selectedSlot])this.applySlot();
        this.saveLayout();
    }
    private saveLayout(){try{const key=this.layoutKey();if(key)localStorage.setItem(key,JSON.stringify({slots:this.slots,selected:this.selectedSlot}));}catch{}}
    private applySlot(){
        const item=this.slots[this.selectedSlot];this.remove=false;this.buildStamp='';
        if(item==='hammer')this.tool='build';
        else if(item==='hoe'||item==='water'||item==='pick'||item==='sword'||item==='rod')this.tool=item;
        else if(item==='carrotSeed'||item==='tomatoSeed'||item==='wheatSeed'){this.tool='seed';this.crop=item==='carrotSeed'?'carrot':item==='tomatoSeed'?'tomato':'wheat';}
        else this.tool='axe';
    }
    selectSlot(index:number){if(!Number.isInteger(index)||index<0||index>=HOTBAR_SIZE)return;this.releaseHeld();this.selectedSlot=index;this.applySlot();this.saveLayout();this.notify();}
    moveSlot(from:number,to:number){this.releaseHeld();this.slots=swapSlots(this.slots,from,to);this.applySlot();this.saveLayout();this.notify();}
    quickMoveSlot(from:number){this.releaseHeld();this.slots=quickTransfer(this.slots,from);this.applySlot();this.saveLayout();this.notify();}
    private equipItem(item:ItemKey){this.syncSlots();const index=this.slots.indexOf(item);if(index>=0&&index<HOTBAR_SIZE)this.selectSlot(index);else if(index>=0){this.moveSlot(index,this.selectedSlot);} }
    setTool(tool:Tool){this.equipItem(tool==='build'?'hammer':tool==='seed'?CROPS[this.crop].seed:tool);}
    setPart(part:Part){this.part=part;this.equipItem('hammer');this.notify();}
    toggleRemove() {const next=!this.remove;this.setPart(this.part);this.remove=next;this.notify();}
    private releaseHeld(pointerId?:number){
        if(this.heldPointerId!==null&&pointerId!==undefined&&pointerId!==this.heldPointerId)return false;
        this.held=false;this.heldButton=0;this.heldPointerId=null;this.buildStamp='';return true;
    }
    pauseControls(){this.keys.clear();this.releaseHeld();}
    startTouchUse(pointerId?:number){
        this.audio.unlock();
        if(this.paused||!this.playable||this.held)return false;
        this.screenPointer=null;this.pointer=null;this.held=true;this.heldButton=0;
        this.heldPointerId=Number.isFinite(pointerId)?pointerId!:null;this.buildStamp='';this.act();return true;
    }
    stopTouchUse(pointerId?:number){
        const released=this.releaseHeld(pointerId);
        if(released){this.screenPointer=null;this.pointer=null;}
        return released;
    }
    toggleSound(){this.audio.toggle();this.notify();}
    press(key: string, down: boolean) { if(!this.playable){this.keys.delete(key);return;}this.audio.unlock();if (down)
        this.keys.add(key);
    else
        this.keys.delete(key); }
    private toolLockUntil() {
        const p=this.session?this.world.players[this.session.playerId]:undefined;
        return Math.max(this.localSwing?.until??0,(this.localWork?.action==='sleep'?0:this.localWork?.until??0),(p?.swingUntil??0)-this.serverOffset);
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
        const localNow=Date.now(),player=this.session?this.world.players[this.session.playerId]:undefined;
        if(command.type==='dodge'&&(this.toolLocked()||this.dodgePending()||!!player&&this.serverNow(localNow)<player.dodgeUntil+450))return false;
        if(command.type==='interact'&&(localNow-this.lastInteractAt<250||this.commands.some(c=>c.type==='interact')||this.pending?.commands.some(c=>c.type==='interact')))return false;
        if(this.paused&&command!==this.signSave?.command || !this.playable || this.commands.length>=5)return false;
        if(command.type!=='wake'&&command.type!=='sleep')this.wakeSleep();
        if(this.commands.length>=5)return false;
        if(command.type==='interact')this.lastInteractAt=localNow;
        command.id??=`${this.session?.playerId}:${++this.commandSequence}:${localNow}`;command.issuedAt??=this.serverNow(localNow);command.face??=this.pos.face;
        this.commands.push(command);this.flushActions();
        return true;
    }
    private movement(){
        if(this.paused||!this.playable)return{x:0,y:0};
        const x=Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft')),y=Number(this.keys.has('s')||this.keys.has('arrowdown'))-Number(this.keys.has('w')||this.keys.has('arrowup'));
        if(x||y)this.wakeSleep();
        if(this.toolLocked())return{x:0,y:0};
        const n=Math.max(1,Math.hypot(x,y));return{x:x/n,y:y/n};
    }
    private wakeSleep(){
        const now=Date.now(),p=this.session?this.world.players[this.session.playerId]:undefined;
        const queued=this.commands.some(command=>command.type==='sleep'),inFlight=!!this.pending?.commands.some(command=>command.type==='sleep');
        const authoritative=p?.workAction==='sleep'&&this.serverNow(now)<(p.workUntil??0);
        const sleeping=queued||this.localWork?.action==='sleep'&&now<this.localWork.until||authoritative;
        if(!sleeping)return;
        this.localWork=null;if(this.workCommand?.type==='sleep')this.workCommand=null;
        this.commands=this.commands.filter(command=>command.type!=='sleep');
        this.feedbackQueue=this.feedbackQueue.filter(entry=>entry.command.type!=='sleep');
        if(queued&&!inFlight&&!authoritative)return;
        if(!this.commands.some(c=>c.type==='wake')&&!this.pending?.commands.some(c=>c.type==='wake'))this.command({type:'wake'});
    }
    tryActivity(point?:{x:number;y:number}){
        if(this.paused||!this.playable||!this.session)return false;
        const now=Date.now(),p=this.world.players[this.session.playerId];if(!p)return false;
        if(this.workCommand?.type==='sleep'&&this.commands.includes(this.workCommand)||this.localWork?.action==='sleep'&&now<this.localWork.until){this.wakeSleep();this.held=false;return true;}
        if(this.workCommand||this.unconfirmedSwing||this.toolLocked(now)||this.dodgePending()||this.serverNow(now)<p.dodgeUntil)return false;
        const clicked=point?atLevel(this.world.buildings,Math.floor(point.x),Math.floor(point.y),'bed',floorLevel(this.pos)):undefined;
        const bed=point?clicked?.kind==='bed'?clicked:undefined:Object.values(this.world.buildings).filter(b=>b.kind==='bed'&&floorLevel(b)===floorLevel(this.pos)&&distance(this.pos,{x:b.x+.5,y:b.y+.5})<=1.8).sort((a,b)=>distance(this.pos,a)-distance(this.pos,b))[0];
        if(bed&&distance(this.pos,{x:bed.x+.5,y:bed.y+.5})<=1.8){
            this.held=false;const position={x:bed.x+.5,y:bed.y+.75,level:floorLevel(this.pos)};
            if(!clearLine(this.world,this.pos,position)||[-.2,.2].some(dx=>[-.2,.2].some(dy=>isBlocked(this.world,position.x+dx,position.y+dy,position.level)))){this.message('床边需要留出空间');return true;}
            return this.startWork('sleep',{type:'sleep',target:bed.id,face:'up'},now);
        }
        if(nearCampfire(this.pos)&&(!point||distance(point,CAMPFIRE)<1.2)){
            this.held=false;if(!cookingRecipe(p.inventory)){this.message('需要1条鱼、2根胡萝卜、2个番茄或3份小麦');return true;}
            return this.startWork('cook',{type:'cook'},now);
        }
        return false;
    }
    private startWork(action:WorkAction,command:Command,now:number){
        if(!this.command(command))return false;
        this.workCommand=command;
        if(action==='sleep')return true;
        this.localWork={action,face:this.pos.face,start:now,until:now+WORK_TIMING[action].duration};
        this.feedbackQueue.push({command,at:now+WORK_TIMING[action].contact});return true;
    }
    private act(){
        if(this.paused||!this.playable||!this.session)return;
        const now=Date.now(),p=this.world.players[this.session.playerId],item=this.slots[this.selectedSlot];
        if(!p)return;
        if(this.workCommand||this.unconfirmedSwing||this.toolLocked(now)||this.dodgePending()||this.serverNow(now)<p.dodgeUntil)return;
        const point=this.pointer??{x:this.pos.x+(this.pos.face==='right'?1:this.pos.face==='left'?-1:0),y:this.pos.y+(this.pos.face==='down'?1:this.pos.face==='up'?-1:0)};
        const dx=point.x-this.pos.x,dy=point.y-this.pos.y;if(Math.hypot(dx,dy)>.1)this.pos.face=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
        const x=Math.floor(point.x),y=Math.floor(point.y);
        const sign=atLevel(this.world.buildings,x,y,'sign',floorLevel(this.pos));
        if(item!=='hammer'&&sign?.kind==='sign'&&this.readSign(sign.id))return;
        const plot=this.world.plots?.[plotKey(x,y)];
        if(item!=='hammer'&&this.tryActivity(point))return;
        const ripe=plot?.crop&&cropProgress(plot,this.serverNow(now))>=CROPS[plot.crop].seconds;
        if(item!=='hammer'&&ripe){
            if(floorLevel(this.pos)>0||sceneAt(this.pos.x)==='mine'||distance(this.pos,{x:x+.5,y:y+.5})>2.7)return;
            if(this.serverNow(now)<p.actionAt)return;
            const stamp=`${x}:${y}:harvest`;
            if(this.held&&stamp===this.buildStamp)return;
            if(!this.startWork('harvest',{type:'harvest',x,y},now))return;
            this.buildStamp=stamp;this.lastClick=now;return;
        }
        if(!item)return;
        const berry=this.tool!=='build'&&this.tool!=='rod'?pickResource(point,this.world,this.pos):undefined;
        if(berry?.kind==='berry'&&distance(this.pos,{x:berry.x+.5,y:berry.y+.5})<=2.5){
            this.held=false;this.startWork('pickup',{type:'collect',target:berry.id},now);this.lastClick=now;return;
        }
        const farm=this.tool==='hoe'||this.tool==='water'||this.tool==='seed';
        if(ITEMS[item].kind==='resource'&&!farm){
            if(now-this.lastClick>=400){if(item==='essence')this.command({type:'heal'});else if((item==='carrot'||item==='tomato'||item==='meal')&&p.hp<100)this.startWork('eat',{type:'eat',food:item},now);this.lastClick=now;}return;
        }
        if(this.tool==='build'){
            if(now-this.lastClick<300)return;
            const removing=this.remove||this.heldButton===2,cell=buildTarget(point,this.world,removing,floorLevel(this.pos)),stamp=`${cell.x}:${cell.y}:${this.part}:${removing}:${floorLevel(this.pos)}`;
            if(this.held&&stamp===this.buildStamp)return;this.buildStamp=stamp;
            if(!removing){const error=canBuild(this.world,{...p,...this.pos},cell.x,cell.y,this.part);if(error){this.message(error);return;}}
            if(!this.startWork('hammer',removing?{type:'remove',...cell}:{type:'build',...cell,part:this.part},now))return;
        }else if(this.tool==='rod'){
            if(!canCast(this.pos,x,y)){this.message('站在岸边，点击附近的水面');this.held=false;return;}
            if(!this.startWork('fish',{type:'fish',x,y},now))return;
        }else if(farm){
            if(this.serverNow(now)<p.actionAt)return;
            const type=this.tool==='hoe'?'till':this.tool==='water'?'water':'plant',stamp=`${x}:${y}:${type}:${this.crop}`;
            if(this.held&&stamp===this.buildStamp)return;this.buildStamp=stamp;
            if(!this.startWork(type==='till'?'hoe':type==='water'?'water':'plant',{type,x,y,crop:this.crop},now))return;
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
            }else{if(c.type!=='sleep')this.audio.play(c.type==='build'||c.type==='remove'||c.type==='cook'?'build':c.type==='harvest'||c.type==='collect'?'harvest':c.type==='till'?'till':c.type==='water'||c.type==='fish'?'water':'plant',.7);if(c.id)this.feedbackSeen.set(c.id,time);}
        }
        this.feedbackQueue=this.feedbackQueue.filter(v=>v.at>now);
        for(const event of this.world.events){
            if(event.actorId===this.session?.playerId&&event.commandId&&this.feedbackQueue.some(entry=>entry.command.id===event.commandId&&entry.at>now))continue;
            if(this.playedEvents.has(event.id)||time-event.time>1400)continue;this.playedEvents.set(event.id,time);
            const anticipated=['hit','harvest','build','till','plant','water','fish','meal','eat','sleep','essence'].includes(event.kind)&&!!event.commandId&&this.feedbackSeen.has(event.commandId);
            if(anticipated&&event.targetId){const mob=this.world.mobs.find(m=>m.id===event.targetId);if(mob)this.suppressedHits[mob.id]=mob.hitUntil;}
            if(anticipated||floorLevel(event)!==floorLevel(this.pos)||sceneAt(event.x)!==sceneAt(this.pos.x))continue;
            const d=distance(this.pos,event);if(d>14)continue;
            let sound:Sound|undefined;
            if(event.kind==='hit'){const r=event.amount===1?resourceAt(event.x,event.y):undefined;sound=r?(r.kind==='tree'||r.kind==='pine'||r.kind==='berry'?'wood':'stone'):'hit';}
            else if(['door','hurt','spore','harvest'].includes(event.kind))sound=event.kind as Sound;
            else if(['wood','stone','copper','essence','fish','meal'].includes(event.kind))sound='harvest';
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
        if(!this.ready){this.last=time;this.frame=requestAnimationFrame(this.animate);return;}
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
        this.draw(now);
        this.frame = requestAnimationFrame(this.animate);
    };
    private draw(now:number){
        if (this.art)
            render(this.canvas, this.world, this.session?.playerId || '', this.pos, { tool: this.tool, part: this.part, remove: this.remove||this.heldButton===2, pointer: this.pointer, time: now+this.serverOffset, roomKey: this.session?.room, fadeUntil:this.fadeUntil+this.serverOffset, localSwing:this.localSwing?{...this.localSwing,start:this.localSwing.start+this.serverOffset,until:this.localSwing.until+this.serverOffset}:null, motionElapsed:now-this.poseStarted,localWork:this.localWork?{...this.localWork,start:this.localWork.start+this.serverOffset,until:this.localWork.until+this.serverOffset}:null,predictedEvents:this.predictedEvents,suppressedHits:this.suppressedHits,settledCommands:new Set(this.feedbackSeen.keys()) }, this.art);
    }
    private pointerMove = (e: PointerEvent) => {
        if(this.held&&this.heldPointerId!==null&&e.pointerId!==this.heldPointerId)return;
        this.screenPointer = { x: e.clientX, y: e.clientY }; this.pointer = pointerWorld(this.canvas, this.pos, e.clientX, e.clientY);
    };
    private pointerDown=(e:PointerEvent)=>{
        this.audio.unlock();if(e.button!==0&&e.button!==2)return;
        if(this.paused||!this.playable)return;
        if(e.button===2&&this.tool!=='build'){
            e.preventDefault();this.pointerMove(e);
            const point=this.pointer,door=point?atLevel(this.world.buildings,Math.floor(point.x),Math.floor(point.y),'wall',floorLevel(this.pos)):undefined;
            if(door?.kind==='door')this.command({type:'interact',target:door.id});
            return;
        }
        if(this.held&&this.heldPointerId!==null&&e.pointerId!==this.heldPointerId){e.preventDefault();return;}
        e.preventDefault();this.canvas.setPointerCapture?.(e.pointerId);this.pointerMove(e);this.held=true;this.heldButton=e.button;this.heldPointerId=Number.isFinite(e.pointerId)?e.pointerId:null;this.buildStamp='';
        if(e.button===0||this.tool==='build')this.act();
    };
    private pointerUp = (e?:PointerEvent) => {
        if(!this.releaseHeld(e?.pointerId))return;
        if(e?.pointerType==='touch'){this.screenPointer=null;this.pointer=null;}
    };
    private contextMenu = (e: Event) => e.preventDefault();
    private wheel=(e:WheelEvent)=>{if(!this.playable||this.paused||!e.deltaY||e.ctrlKey)return;e.preventDefault();this.selectSlot((this.selectedSlot+(e.deltaY>0?1:-1)+HOTBAR_SIZE)%HOTBAR_SIZE);};
    private keyDown = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement)?.matches('input,textarea'))
            return;
        if(!this.playable)return;
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
        if (key === 'f') {
            if(e.shiftKey)this.command({type:'descend'});else this.interact();
        }
        if (key === ' ')
            this.command({ type: 'dodge' });
    };
    private keyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    private viewportChanged=()=>{this.screenPointer=null;this.pointer=null;this.pauseControls();};
    private blur = () => { this.viewportChanged(); };
    destroy() { this.saveLocalWorld(true);this.cancelPreparation();this.stopAssets();this.pauseControls();this.ready=false;this.signSave?.resolve('已离开世界');this.signSave=null;this.audio.destroy();this.disposed = true; cancelAnimationFrame(this.frame); if (this.timer)
        clearTimeout(this.timer); this.canvas.removeEventListener('pointermove', this.pointerMove); this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('contextmenu', this.contextMenu);this.canvas.removeEventListener('wheel',this.wheel); window.removeEventListener('pointerup', this.pointerUp);window.removeEventListener('pointercancel',this.pointerUp); window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur);window.removeEventListener('resize',this.viewportChanged); }
}
