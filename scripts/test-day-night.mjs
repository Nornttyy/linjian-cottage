import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {compileProject} from './test-support.mjs';
const project=compileProject({name:'day-night'});let checks=0,failures=0;
const test=(name,run)=>{checks++;try{run();console.log('PASS',name);}catch(error){failures++;console.error('FAIL',name,error?.stack??error);}};
try{
    const [clock,sim,delta,lighting,world]=await Promise.all([import(project.module('day-night')),import(project.module('simulation')),import(project.module('world-delta')),import(project.module('atmosphere')),import(project.module('world'))]);
    const ORIGIN=1_000_000,atHour=hour=>ORIGIN+clock.DAY_LENGTH_MS*((hour-8+24)%24)/24;
    test('new world begins on day one at 08:00 in full daylight',()=>{
        const world=sim.createWorld(ORIGIN),time=clock.worldClock(world.dayStartedAt,ORIGIN);
        assert.equal(world.dayStartedAt,ORIGIN);assert.equal(time.day,1);assert.equal(time.hour,8);assert.equal(time.minute,0);assert.equal(time.phase,'day');assert.equal(time.daylight,1);assert.equal(clock.formatWorldClock(time),'第1天 08:00');
    });
    test('dawn, day, dusk and night boundaries are continuous',()=>{
        const dawn=clock.worldClock(ORIGIN,atHour(5)),day=clock.worldClock(ORIGIN,atHour(7)),dusk=clock.worldClock(ORIGIN,atHour(18)),night=clock.worldClock(ORIGIN,atHour(20));
        assert.deepEqual([dawn.phase,day.phase,dusk.phase,night.phase],['dawn','day','dusk','night']);
        assert.equal(dawn.daylight,0);assert.equal(day.daylight,1);assert.equal(dusk.daylight,1);assert.equal(night.daylight,0);
    });
    test('dawn and dusk lighting stays continuous one millisecond across every boundary',()=>{
        const boundaries=[[5,'night','dawn'],[7,'dawn','day'],[18,'day','dusk'],[20,'dusk','night']];
        for(const [hour,beforePhase,afterPhase] of boundaries){
            const boundary=atHour(hour),before=clock.worldClock(ORIGIN,boundary-1),at=clock.worldClock(ORIGIN,boundary),after=clock.worldClock(ORIGIN,boundary+1);
            assert.equal(before.phase,beforePhase,`${hour}:00 phase before boundary`);assert.equal(at.phase,afterPhase,`${hour}:00 boundary phase`);assert.equal(after.phase,afterPhase,`${hour}:00 phase after boundary`);
            for(const field of ['daylight','night','dawn','dusk']){
                assert(Math.abs(before[field]-at[field])<1e-4,`${hour}:00 ${field} jumped before boundary`);
                assert(Math.abs(after[field]-at[field])<1e-4,`${hour}:00 ${field} jumped after boundary`);
            }
        }
    });
    test('midnight advances the day and a full cycle returns to 08:00',()=>{
        const midnight=clock.worldClock(ORIGIN,atHour(0)),next=clock.worldClock(ORIGIN,ORIGIN+clock.DAY_LENGTH_MS);
        assert.equal(midnight.day,2);assert.equal(midnight.hour,0);assert.equal(next.day,2);assert.equal(next.hour,8);assert.equal(next.minute,0);
    });
    test('clock wraps negative skew without invalid phase values',()=>{
        const value=clock.worldClock(ORIGIN,ORIGIN-clock.DAY_LENGTH_MS/24);
        assert.equal(value.day,1);assert.equal(value.hour,7);assert.equal(value.phase,'day');assert(value.night>=0&&value.night<=1);
    });
    test('old saves begin day one when migrated and ticks never move that origin',()=>{
        const world=sim.createWorld(ORIGIN);delete world.dayStartedAt;sim.normalizeWorld(world,ORIGIN+9999);assert.equal(world.dayStartedAt,ORIGIN+9999);
        const started=world.dayStartedAt;sim.tickWorld(world,ORIGIN+20000);assert.equal(world.dayStartedAt,started);
        const restored=JSON.parse(JSON.stringify(world));sim.normalizeWorld(restored,ORIGIN+30000);assert.equal(restored.dayStartedAt,started);
    });
    test('public snapshots and deltas preserve the shared world clock without secrets',()=>{
        const before=sim.createWorld(ORIGIN);before.players.p=sim.createPlayer('p','secret','P',0,ORIGIN);const after=structuredClone(before);after.dayStartedAt=ORIGIN+123;
        const clean=sim.publicWorld(after);assert.equal(clean.dayStartedAt,ORIGIN+123);assert.equal(clean.players.p.secret,undefined);
        const change=delta.worldDelta(before,after,4);assert.equal(change.set.dayStartedAt,ORIGIN+123);assert.deepEqual(delta.applyWorldDelta(before,change),after);
    });
    test('all players using the same server time see the same phase and label',()=>{
        const now=atHour(19),first=clock.worldClock(ORIGIN,now),second=clock.worldClock(ORIGIN,now);
        assert.deepEqual(first,second);assert.equal(clock.formatWorldClock(first),clock.formatWorldClock(second));assert.equal(clock.phaseName(first.phase),'黄昏');
    });
    test('real atmosphere keeps mine lighting independent while surface lighting follows the clock',()=>{
        const original=Object.getOwnPropertyDescriptor(globalThis,'document');let serial=0;
        const makeContext=(log=[])=>{const stack=[];return{
            globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:false,fillStyle:'',
            save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.imageSmoothingEnabled,this.fillStyle]);log.push(['save']);},
            restore(){[this.globalAlpha,this.globalCompositeOperation,this.imageSmoothingEnabled,this.fillStyle]=stack.pop();log.push(['restore']);},
            clearRect(...args){log.push(['clear',...args]);},
            fillRect(...args){log.push(['fill',this.fillStyle,this.globalAlpha,this.globalCompositeOperation,...args]);},
            drawImage(image,...args){log.push(['draw',image.auditName??image.name??'canvas',this.globalAlpha,this.globalCompositeOperation,...args]);},
            createRadialGradient(){return{addColorStop(){}};},
        };};
        try{
            Object.defineProperty(globalThis,'document',{configurable:true,writable:true,value:{createElement(){const canvas={width:0,height:0,auditName:`canvas-${++serial}`},context=makeContext();canvas.getContext=()=>context;return canvas;}}});
            const state=sim.createWorld(ORIGIN),art={spark:{name:'spark'}};
            const sample=(position,origin)=>{state.dayStartedAt=origin;const log=[],ctx=makeContext(log);lighting.atmosphere(ctx,state,position,art,ORIGIN,800,450,0,0);return log;};
            const dayOrigin=ORIGIN,nightOrigin=ORIGIN-clock.DAY_LENGTH_MS/2;
            assert.deepEqual(sample(world.MINE.spawn,dayOrigin),sample(world.MINE.spawn,nightOrigin),'mine canvas output changed with the surface clock');
            assert.notDeepEqual(sample(world.SPAWN,dayOrigin),sample(world.SPAWN,nightOrigin),'surface canvas output ignored the clock');
        }finally{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;}
    });
    test('renderer grades the world before drawing build guidance and event feedback',()=>{
        const source=readFileSync(join(project.source,'lib/renderer.ts'),'utf8');
        const atmosphereAt=source.indexOf('atmosphere(ctx,s,pos,art,t,w,h,ox,oy);');
        const buildAt=source.indexOf('drawBuildTarget(',atmosphereAt);
        const eventsAt=source.indexOf('for (const e of events)',atmosphereAt);
        assert(atmosphereAt>=0,'renderer must call atmosphere');assert(buildAt>atmosphereAt,'build guidance must remain above the atmosphere grade');assert(eventsAt>buildAt,'event feedback must remain above the atmosphere grade and build guidance');
    });
    test('Game renders a semantic clock and coarse small-screen CSS keeps it visible',()=>{
        const game=readFileSync(join(project.source,'components/Game.tsx'),'utf8'),css=readFileSync(join(project.source,'app/globals.css'),'utf8');
        assert.match(game,/<time className="world-clock" dateTime=\{clockDateTime\(clock\)\}[^>]*>\{formatWorldClock\(clock\)\}<\/time>/);
        const coarseAt=css.indexOf('@media(any-pointer:coarse) and (max-width:700px)'),hideAt=css.lastIndexOf('.region-label{display:none}',coarseAt);
        assert(hideAt>=0&&coarseAt>hideAt,'coarse visibility override must follow narrow-screen hiding rules');
        const coarseEnd=css.indexOf('@media(any-pointer:coarse) and (max-width:360px)',coarseAt),coarse=css.slice(coarseAt,coarseEnd);
        assert.match(coarse,/\.region-label\{display:flex;position:static/);assert.match(coarse,/\.region-name\{display:none/);assert.match(coarse,/\.world-clock\{margin:0;padding:0;border:0/);assert.match(coarse,/\.top-actions span\{display:none/);
    });
    console.log(`${checks} day-night checks; ${failures} failures`);process.exitCode=failures?1:0;
}finally{project.cleanup();}
