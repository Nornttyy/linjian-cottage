export const ROOF_FADE_MS = 300;
export const HIDDEN_ROOF_ALPHA = .14;

type Fade = { from: number; to: number; started: number };
type RoofState = {
    scope: string;
    time: number;
    fades: Map<string, Fade>;
    opacity: Map<string, number>;
};
const canvases = new WeakMap<object, RoofState>();

function sample(fade: Fade, time: number) {
    const progress = Math.max(0, Math.min(1, (time - fade.started) / ROOF_FADE_MS));
    const eased = progress * progress * (3 - 2 * progress);
    return fade.from + (fade.to - fade.from) * eased;
}

// Scope identifies a room/player/scene, never a replaceable network snapshot.
// All roofs advance together, including roofs temporarily outside the viewport.
export function roofVisibility(
    canvas: object,
    scope: string,
    roofs: Iterable<{ x: number; y: number }>,
    hidden: ReadonlySet<string>,
    time: number,
): ReadonlyMap<string, number> {
    let state = canvases.get(canvas);
    if (!state || state.scope !== scope) {
        state = { scope, time, fades: new Map(), opacity: new Map() };
        canvases.set(canvas, state);
    }
    state.time = Math.max(state.time, time);
    const present = new Set<string>();
    for (const roof of roofs) {
        const key = `${roof.x}:${roof.y}`, target = hidden.has(key) ? HIDDEN_ROOF_ALPHA : 1;
        present.add(key);
        let fade = state.fades.get(key);
        // Joining indoors must not flash a fully opaque roof over the player.
        if (!fade) fade = { from: target, to: target, started: state.time };
        const opacity = sample(fade, state.time);
        if (fade.to !== target) fade = { from: opacity, to: target, started: state.time };
        state.fades.set(key, fade);
        state.opacity.set(key, opacity);
    }
    for (const key of state.fades.keys()) {
        if (present.has(key)) continue;
        state.fades.delete(key);
        state.opacity.delete(key);
    }
    return state.opacity;
}
