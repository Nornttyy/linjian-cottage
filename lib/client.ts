import { loadArt, type Atlas } from './art';
import { createWorld, move, TOOL_TIMING, type WorldState, type Tool, type Part, type Command, type Input, type Movement } from './simulation';
import { render, pointerWorld, pickResource, buildTarget, type Position } from './renderer';
import { SPAWN, sceneAt } from './world';
import type { HeroSwing } from './animation';
type ApiReply = {
    room: string;
    playerId: string;
    token?: string;
    state: WorldState;
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
};
export class GameClient {
    world = createWorld();
    session: Session | null = null;
    pos: Position = { ...SPAWN, face: 'down', moving: false };
    tool: Tool = 'axe';
    part: Part = 'floor';
    remove = false;
    paused = false;
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
    constructor(public canvas: HTMLCanvasElement, private changed: (value: ClientState) => void, private message: (message: string) => void, private mapToggle: () => void, private apiUrl = '/api/game') {
        canvas.addEventListener('pointermove', this.pointerMove);
        canvas.addEventListener('pointerdown', this.pointerDown);
        canvas.addEventListener('contextmenu', this.contextMenu);
        window.addEventListener('pointerup', this.pointerUp);
        window.addEventListener('keydown', this.keyDown);
        window.addEventListener('keyup', this.keyUp);
        window.addEventListener('blur', this.blur);
        loadArt().then(art => { if (this.disposed)
            return; this.art = art; this.notify(); }).catch(() => { this.error = '素材加载失败'; this.notify(); });
        this.frame = requestAnimationFrame(this.animate);
    }
    notify() { if (!this.disposed)
        this.changed({ world: this.world, session: this.session, tool: this.tool, part: this.part, remove: this.remove, connected: this.connected, error: this.error, art: this.art }); }
    private async request(body: unknown) { const response = await fetch(this.apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); const result = await response.json() as ApiReply; if (!response.ok || !result.state)
        throw new Error(result.error || '连接失败'); return result; }
    async connect(mode: 'resume' | 'create' | 'join' = 'resume', room = '') {
        const generation = ++this.generation;
        if (this.timer)
            clearTimeout(this.timer);
        this.keys.clear();
        this.pending = null;
        this.flushRequested = false;
        this.localSwing = null;
        this.unconfirmedSwing = null;
        this.movements = [];
        this.commands = [];
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
            const p = this.world.players[this.session.playerId];
            this.pos = { x: p.x, y: p.y, face: p.face, moving: false };
            this.seq = p.seq;
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
        this.syncing=true;
        this.flushRequested=false;
        if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
        const session = this.session, generation = this.generation;
        const delta = this.movement();
        this.pending ??= { seq: ++this.seq, dx: delta.x, dy: delta.y, face: this.pos.face, commands: this.commands.splice(0, 5), movements: this.movements.splice(0,64) };
        try {
            const submitted = this.pending;
            const result = await this.request({ action: 'sync', ...session, input: submitted });
            if (this.disposed || generation !== this.generation || session !== this.session)
                return;
            this.world = result.state;
            if(this.unconfirmedSwing && submitted.commands.includes(this.unconfirmedSwing))this.unconfirmedSwing=null;
            this.pending = null;
            this.connected = true;
            this.error = '';
            const p = this.world.players[session.playerId];
            if(sceneAt(p.x)!==sceneAt(this.pos.x)){
                this.movements=[];this.keys.clear();this.held=false;this.localSwing=null;this.unconfirmedSwing=null;this.fadeUntil=Date.now()+500;
            }
            this.pos.x=p.x;this.pos.y=p.y;
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
            else this.timer = setTimeout(() => this.sync(), this.connected ? 150 : 1600);
        }
    }
    setTool(tool: Tool) { this.tool = tool; this.remove = false; this.buildStamp = ''; this.notify(); }
    setPart(part: Part) { this.tool = 'build'; this.part = part; this.remove = false; this.notify(); }
    toggleRemove() { this.tool = 'build'; this.remove = !this.remove; this.notify(); }
    press(key: string, down: boolean) { if (down)
        this.keys.add(key);
    else
        this.keys.delete(key); }
    private toolLockUntil() {
        const p=this.session?this.world.players[this.session.playerId]:undefined;
        return Math.max(this.localSwing?.until??0,p?.swingUntil??0);
    }
    private toolLocked(now=Date.now()) {
        return !!this.unconfirmedSwing || now<this.toolLockUntil();
    }
    private dodgePending() {
        return this.commands.some(c=>c.type==='dodge') || !!this.pending?.commands.some(c=>c.type==='dodge');
    }
    command(command: Command) {
        if(command.type==='dodge' && this.toolLocked())return false;
        if(!this.connected || this.commands.length>=5)return false;
        this.commands.push(command);
        if(command.type==='attack'||command.type==='dodge')this.flushActions();
        return true;
    }
    private movement() { if (this.paused || !this.connected || this.toolLocked())
        return { x: 0, y: 0 }; const x = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')), y = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')); const n = Math.max(1, Math.hypot(x, y)); return { x: x / n, y: y / n }; }
    private act() {
        if (this.paused || !this.connected || !this.session)
            return;
        const now = Date.now();
        const p=this.world.players[this.session.playerId];
        if(this.tool!=='build' && (this.toolLocked(now) || now<(p?.actionAt??0) || now<(p?.dodgeUntil??0) || this.dodgePending()))return;
        if (now - this.lastClick < (this.tool === 'build' ? 150 : TOOL_TIMING[this.tool].cooldown))
            return;
        const point = this.pointer || { x: this.pos.x + (this.pos.face === 'right' ? 1 : this.pos.face === 'left' ? -1 : 0), y: this.pos.y + (this.pos.face === 'down' ? 1 : this.pos.face === 'up' ? -1 : 0) };
        if (this.tool === 'build') {
            const removing=this.remove||this.heldButton===2;
            const cell=buildTarget(point,this.world,removing);
            const x=cell.x,y=cell.y,stamp=`${x}:${y}:${this.part}:${removing}`;
            if (this.held && stamp === this.buildStamp)
                return;
            this.buildStamp = stamp;
            this.command(removing ? { type: 'remove', x, y } : { type: 'build', x, y, part: this.part });
        }
        else {
            const aimX=point.x-this.pos.x,aimY=point.y-this.pos.y;
            if(Math.hypot(aimX,aimY)>.1)this.pos.face=Math.abs(aimX)>Math.abs(aimY)?aimX>0?'right':'left':aimY>0?'down':'up';
            const target = this.tool === 'sword' ? this.world.mobs.filter(m => m.hp > 0 && Math.hypot(point.x - m.x, point.y - m.y) < 1.8).sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0]?.id : pickResource(point, this.world, this.pos)?.id;
            const face = this.pos.face;
            const command:Command={ type: 'attack', tool: this.tool, target, face };
            if(!this.command(command))return;
            this.unconfirmedSwing=command;
            // Local presentation has its own clock; snapshots still own damage and inventory.
            this.localSwing = { tool: this.tool, face, start: now, until: now + TOOL_TIMING[this.tool].duration };
        }
        this.lastClick = now;
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
            const speed = player && Date.now() < player.dodgeUntil ? 9 : 4.2;
            move(this.world, this.pos, d.x * speed * dt, d.y * speed * dt);
            const last=this.movements[this.movements.length-1];
            if(last && last.dx===d.x && last.dy===d.y && last.speed===speed && last.seconds<.3)last.seconds+=dt;
            else this.movements.push({dx:d.x,dy:d.y,seconds:dt,speed});
        }
        if (this.screenPointer)
            this.pointer = pointerWorld(this.canvas, this.pos, this.screenPointer.x, this.screenPointer.y);
        if (this.held)
            this.act();
        const now=Date.now(),pose=now<(this.localSwing?.until??0)?'tool':this.pos.moving?'walk':'idle';
        if(pose!==this.poseState){this.poseState=pose;this.poseStarted=now;}
        if (this.art)
            render(this.canvas, this.world, this.session?.playerId || '', this.pos, { tool: this.tool, part: this.part, remove: this.remove||this.heldButton===2, pointer: this.pointer, time: now, fadeUntil:this.fadeUntil, localSwing:this.localSwing, motionElapsed:now-this.poseStarted }, this.art);
        this.frame = requestAnimationFrame(this.animate);
    };
    private pointerMove = (e: PointerEvent) => { this.screenPointer = { x: e.clientX, y: e.clientY }; this.pointer = pointerWorld(this.canvas, this.pos, e.clientX, e.clientY); };
    private pointerDown=(e:PointerEvent)=>{
        if(e.button!==0&&e.button!==2)return;
        if(e.button===2&&this.tool!=='build')return;
        e.preventDefault();this.pointerMove(e);this.held=true;this.heldButton=e.button;this.buildStamp='';
        if(e.button===0||this.tool==='build')this.act();
    };
    private pointerUp = () => { this.held = false; this.heldButton=0; this.buildStamp = ''; };
    private contextMenu = (e: Event) => e.preventDefault();
    private keyDown = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement)?.matches('input,textarea'))
            return;
        const key = e.key.toLowerCase();
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key))
            e.preventDefault();
        this.keys.add(key);
        if (e.repeat)
            return;
        if (key === 'm') {
            this.mapToggle();
            return;
        }
        if (this.paused)
            return;
        if (key === '1')
            this.setTool('axe');
        if (key === '2')
            this.setTool('pick');
        if (key === '3')
            this.setTool('sword');
        if (key === '4' || key === 'b')
            this.setTool(this.tool === 'build' ? 'axe' : 'build');
        if (key === 'x')
            this.toggleRemove();
        if (key === 'r')
            this.command({ type: 'heal' });
        if (key === 'e')
            this.command({ type: 'interact' });
        if (key === ' ')
            this.command({ type: 'dodge' });
    };
    private keyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    private blur = () => { this.keys.clear(); this.held = false; this.heldButton=0; };
    destroy() { this.disposed = true; cancelAnimationFrame(this.frame); if (this.timer)
        clearTimeout(this.timer); this.canvas.removeEventListener('pointermove', this.pointerMove); this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('contextmenu', this.contextMenu); window.removeEventListener('pointerup', this.pointerUp); window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur); }
}
