// Input, synchronization and drawing regression checks against the real modules.
// Usage: node scripts/test-regression.mjs
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const source = resolve(process.env.LINJIAN_SOURCE || fileURLToPath(new URL('..', import.meta.url)));
const temp = await mkdtemp(join(tmpdir(), 'linjian-regression-modules-'));
const real = {
  now: Date.now, timeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  window: globalThis.window, Image: globalThis.Image,
  raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame,
};
let now = 100000;
let failures = 0;
try {
  const ts = (await import(pathToFileURL(join(source, 'node_modules/typescript/lib/typescript.js')))).default;
  for (const name of ['world', 'simulation', 'frame-layout','hero-rig', 'tiles', 'animation', 'atmosphere', 'renderer', 'art', 'client']) {
    const text = await readFile(join(source, 'lib', name + '.ts'), 'utf8');
    const js = ts.transpileModule(text, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    }}).outputText.replace(/from ['"]\.\/(world|simulation|frame-layout|hero-rig|tiles|animation|atmosphere|renderer|art)(?:\.ts)?['"]/g, "from './$1.mjs'");
    await writeFile(join(temp, name + '.mjs'), js);
  }
  const sim = await import(pathToFileURL(join(temp, 'simulation.mjs')));
  const world = await import(pathToFileURL(join(temp, 'world.mjs')));
  const { GameClient } = await import(pathToFileURL(join(temp, 'client.mjs')));
  const { render } = await import(pathToFileURL(join(temp, 'renderer.mjs')));
  Date.now = () => now;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.Image = class {}; // Keep art loading unresolved; input tests do not render.
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.setTimeout = () => 1; // Sync cadence is controlled explicitly below.
  globalThis.clearTimeout = () => {};

  const clone = value => JSON.parse(JSON.stringify(value));
  const close = (a, b, label, tolerance = .06) => assert.ok(Math.abs(a - b) <= tolerance,
    `${label}: expected ${b.toFixed(4)}, got ${a.toFixed(4)}`);
  async function test(name, run) {
    try { await run(); console.log('PASS', name); }
    catch (error) { failures++; console.error('FAIL', name, '\n ', error.message); }
  }
  function fixture() {
    now += 10000;
    const state = sim.createWorld(now);
    const player = sim.createPlayer('p', 'test-secret', 'Audit', 0, now);
    state.players.p = player;
    const canvas = {
      width: 800, height: 400, clientWidth: 1600, clientHeight: 800,
      addEventListener() {}, removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 800 }),
    };
    const client = new GameClient(canvas, () => {}, () => {}, () => {});
    client.connected = true;
    client.session = { playerId: 'p', room: 'TESTROOM', token: 'test-token' };
    client.world = clone(state);
    client.pos = { x: player.x, y: player.y, face: 'down', moving: false };
    const f = { state, player, client, requests: [], delayNext: false, failNextAfterApply: false, release: null };
    client.request = async body => {
      f.requests.push(clone(body));
      sim.tickWorld(state, now);
      const message = body.input ? sim.applyInput(state, 'p', body.input, now) : null;
      const reply = { room: 'TESTROOM', playerId: 'p', state: clone(sim.publicWorld(state)), message };
      if (f.failNextAfterApply) { f.failNextAfterApply = false; throw Error('simulated lost response'); }
      if (f.delayNext) {
        f.delayNext = false;
        return new Promise(resolve => { f.release = () => resolve(reply); });
      }
      return reply;
    };
    // This fixture controls delivery explicitly; test-input-latency covers immediate scheduling.
    client.flushActions=()=>{};
    client.animate(now);
    f.advance = ms => { for (let t = 0; t < ms; t += 10) { now += Math.min(10, ms - t); client.animate(now); } };
    f.sync = () => client.sync();
    f.reposition = (x, y) => {
      player.x = x; player.y = y;
      client.world = clone(state);
      client.pos.x = x; client.pos.y = y;
    };
    return f;
  }

  await test('100 ms movement tap survives a 150 ms sync boundary', async () => {
    const f = fixture(), x = f.player.x;
    try {
      f.client.press('d', true); f.advance(100);
      f.client.press('d', false); f.advance(50);
      await f.sync();
      close(f.player.x, x + .42, 'authoritative short-tap displacement');
      close(f.client.pos.x, x + .42, 'visible short-tap displacement');
      for (let i = 0; i < 3; i++) { f.advance(150); await f.sync(); }
      close(f.client.pos.x, x + .42, 'position after three idle replies');
    } finally { f.client.destroy(); }
  });

  await test('direction changes inside one sync interval preserve their ordered durations', async () => {
    const f = fixture(), x = f.player.x, y = f.player.y;
    try {
      for (const [key, ms] of [['d', 40], ['w', 40], ['a', 40], ['s', 20]]) {
        f.client.press(key, true); f.advance(ms); f.client.press(key, false);
      }
      f.advance(10); await f.sync();
      close(f.player.x, x, 'ordered horizontal cancellation');
      close(f.player.y, y - .084, 'ordered vertical displacement', .025);
    } finally { f.client.destroy(); }
  });

  await test('a delayed acknowledgement preserves and later commits only unacknowledged motion', async () => {
    const f = fixture(), x = f.player.x, y = f.player.y;
    try {
      f.client.press('d', true); f.advance(150); f.client.press('d', false);
      f.delayNext = true;
      const pending = f.sync();
      assert.equal(typeof f.release, 'function', 'deferred reply must be captured');
      f.client.press('w', true); f.advance(100); f.client.press('w', false);
      f.release(); await pending;
      close(f.client.pos.x, x + .63, 'acknowledged x');
      close(f.client.pos.y, y - .42, 'unacknowledged y retained after reply');
      f.advance(50); await f.sync();
      close(f.player.x, x + .63, 'acknowledged motion not applied twice');
      close(f.player.y, y - .42, 'remaining motion committed exactly once');
    } finally { f.client.destroy(); }
  });

  await test('retrying a committed input after a lost response cannot double movement', async () => {
    const f = fixture(), x = f.player.x;
    try {
      f.client.press('d', true); f.advance(150); f.client.press('d', false);
      f.failNextAfterApply = true; await f.sync();
      const committed = f.player.x;
      close(committed, x + .63, 'first committed input');
      f.advance(150); await f.sync();
      close(f.player.x, committed, 'replayed sequence position', .001);
      close(f.client.pos.x, committed, 'client after replay acknowledgement');
    } finally { f.client.destroy(); }
  });

  await test('repeated harvest inputs execute accepted actions once without a queued backlog', async () => {
    const f = fixture(), resource = world.RESOURCE_MAP.get('247:315');
    assert.ok(resource, 'fixed test tree exists');
    try {
      f.reposition(246.1, 315.5);
      f.state.resourceHp[resource.id] = 100;
      f.client.world = clone(f.state);
      f.client.tool = 'axe';
      f.client.pointer = { x: resource.x + .5, y: resource.y + .5 };
      let attempts = 0;
      for (let elapsed = 10; elapsed <= 12000; elapsed += 10) {
        f.advance(10);
        if (elapsed <= 10400 && elapsed % 520 === 0) { f.client.act(); attempts++; }
        if (elapsed % 150 === 0) await f.sync();
      }
      // Full 490 ms swings can start only on a 150 ms authoritative tick; drain the
      // remaining recovery/contact without changing the 20 original input times.
      const drainDeadline = now + 1500;
      while ((f.player.attackQueue?.length || f.player.pendingStrike) && now < drainDeadline) {
        f.advance(150); await f.sync();
      }
      assert.equal(f.player.attackQueue?.length ?? 0, 0, 'all queued attacks drained');
      assert.equal(f.player.pendingStrike, undefined, 'last contact resolved within the bounded drain');
      const accepted = 100 - (f.state.resourceHp[resource.id] ?? 0);
      const emitted = f.requests.flatMap(r=>r.input?.commands||[]).filter(c=>c.type==='attack').length;
      assert.equal(attempts, 20);
      assert.ok(emitted>0 && emitted<=attempts);
      assert.equal(accepted, emitted, `${emitted} accepted inputs; ${accepted} actually harvested`);
      assert.equal(f.player.attackQueue?.length??0,0,'no retained attack backlog');
      const attackInput = f.requests.filter(r => r.input?.commands?.some(c => c.type === 'attack')).at(-1)?.input;
      assert.ok(attackInput, 'an attack-bearing input was sent');
      const hp = f.state.resourceHp[resource.id];
      sim.applyInput(f.state, 'p', attackInput, now + 150);
      sim.tickWorld(f.state, now + 1200);
      assert.equal(f.state.resourceHp[resource.id], hp, 'replayed seq must not queue damage again');
    } finally { f.client.destroy(); }
  });

  await test('holding right mouse in build mode emits only removal commands', async () => {
    const f = fixture();
    try {
      f.player.inventory.wood = 100;
      const id = sim.buildingKey(259, 322, 'floor');
      f.state.buildings[id] = { id, x: 259, y: 322, kind: 'floor' };
      f.client.world = clone(f.state); f.client.tool = 'build';
      f.client.pointerDown({ preventDefault() {}, clientX: 944, clientY: 496, button: 2, pointerId: 1 });
      for (let i = 0; i < 3; i++) { f.advance(150); await f.sync(); }
      f.client.pointerUp({ pointerId: 1 });
      const commands = f.requests.flatMap(r => r.input?.commands || []);
      assert.ok(commands.some(c => c.type === 'remove'), 'right click must remove');
      assert.ok(commands.every(c => c.type === 'remove'), 'right click issued: ' + JSON.stringify(commands));
      assert.equal(f.state.buildings[id], undefined, 'removed floor must stay removed');
    } finally { f.client.destroy(); }
  });

  await test('every authored monster spawn is traversable and permits movement', () => {
    const state = sim.createWorld(now);
    for (const mob of state.mobs) {
      assert.equal(sim.isBlocked(state, mob.x, mob.y), false, `${mob.id} inside a solid tile at ${mob.x},${mob.y}`);
      const escapable = [[.4, 0], [-.4, 0], [0, .4], [0, -.4]].some(([dx, dy]) => {
        const p = { x: mob.x, y: mob.y }; sim.move(state, p, dx, dy);
        return Math.hypot(p.x - mob.x, p.y - mob.y) > .2;
      });
      assert.ok(escapable, `${mob.id} cannot leave its spawn`);
    }
  });

  await test('roof ghost and placed roof use the same screen bounds', () => {
    const f = fixture();
    try {
      const matrix = () => [1, 0, 0, 1, 0, 0];
      let transform = matrix(); const saves = []; const draws = [];
      const target = {
        globalAlpha: 1,
        save() { saves.push({ transform: [...transform], alpha: this.globalAlpha }); },
        restore() { const s = saves.pop(); if (s) { transform = s.transform; this.globalAlpha = s.alpha; } },
        translate(x, y) { transform[4] += transform[0] * x + transform[2] * y; transform[5] += transform[1] * x + transform[3] * y; },
        scale(x, y) { transform[0] *= x; transform[1] *= x; transform[2] *= y; transform[3] *= y; },
        setTransform(a, b, c, d, e, f) { transform = [a, b, c, d, e, f]; },
        resetTransform() { transform = matrix(); },
        createLinearGradient() { return { addColorStop() {} }; },
        createRadialGradient() { return { addColorStop() {} }; },
        drawImage(image, ...args) {
          let [x, y, w, h] = args.length >= 8 ? args.slice(4) : args;
          w ??= image.width; h ??= image.height;
          const points = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => [transform[0] * px + transform[2] * py + transform[4], transform[1] * px + transform[3] * py + transform[5]]);
          draws.push({ name: image.name, alpha: this.globalAlpha, bounds: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] });
        },
      };
      const ctx = new Proxy(target, { get: (obj, key) => key in obj ? obj[key] : () => {} });
      const art = new Proxy({}, { get: (obj, name) => obj[name] ??= { name, width: 24, height: 24 } });
      const canvas = { width: 800, height: 400, clientWidth: 1600, clientHeight: 800, getContext: () => ctx };
      f.player.inventory.wood = 100;
      for (const kind of ['floor', 'roof']) {
        const id = sim.buildingKey(259, 322, kind);
        f.state.buildings[id] = { id, x: 259, y: 322, kind };
      }
      render(canvas, f.state, 'p', f.client.pos, { tool: 'build', part: 'roof', remove: false, pointer: { x: 259.5, y: 322.5 }, time: now }, art);
      const roofs = draws.filter(d => d.name === 'roof');
      assert.equal(roofs.length, 2, 'expected one placed roof and one ghost');
      assert.deepEqual(roofs[1].bounds, roofs[0].bounds, 'ghost bounds must equal final placed bounds');
    } finally { f.client.destroy(); }
  });

  console.log(failures ? `${failures} regression check(s) failed` : 'All regression checks passed');
  process.exitCode = failures ? 1 : 0;
} finally {
  Date.now = real.now;
  globalThis.setTimeout = real.timeout; globalThis.clearTimeout = real.clearTimeout;
  globalThis.window = real.window; globalThis.Image = real.Image;
  globalThis.requestAnimationFrame = real.raf; globalThis.cancelAnimationFrame = real.caf;
  await rm(temp, { recursive: true, force: true });
}
