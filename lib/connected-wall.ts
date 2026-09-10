import type { Atlas } from './art';
import type { Building } from './simulation';

type Walls = Readonly<Record<string, Building>>;
export function wallConnections(buildings: Walls, x: number, y: number) {
    return {
        north: !!buildings[`${x}:${y - 1}:wall`],
        east: !!buildings[`${x + 1}:${y}:wall`],
        south: !!buildings[`${x}:${y + 1}:wall`],
        west: !!buildings[`${x - 1}:${y}:wall`],
    };
}

export function wallLayout(buildings: Walls, x: number, y: number) {
    const links = wallConnections(buildings, x, y);
    const vertical = (links.north || links.south) && !links.east && !links.west;
    const isolated = !links.north && !links.east && !links.south && !links.west;
    const horizontal = !links.north && !links.south;
    const left = links.west || isolated || horizontal ? 0 : 8;
    const right = links.east || isolated || horizontal ? 24 : 16;
    return { ...links, vertical, x: vertical ? 8 : left, width: vertical ? 8 : right - left };
}

export function floorWallInsets(buildings: Walls, x: number, y: number) {
    if (!buildings[`${x}:${y}:wall`]) return { left: 0, right: 0 };
    const links = wallConnections(buildings, x, y);
    if (!links.north && !links.south) return { left: 0, right: 0 };
    const west = !!buildings[`${x - 1}:${y}:floor`], east = !!buildings[`${x + 1}:${y}:floor`];
    return { left: !west && east ? 8 : 0, right: west && !east ? 8 : 0 };
}

// Use the generated wall/door/window sprites. Only screen-space shape changes;
// building coordinates and the existing collision layer remain one 24 px cell.
export function drawConnectedWall(ctx: CanvasRenderingContext2D, art: Atlas, buildings: Walls, b: Building, ox: number, oy: number) {
    const shape = wallLayout(buildings, b.x, b.y);
    const img = art[b.kind === 'door' && b.open ? 'door-open' : b.kind];
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (b.kind === 'wall') {
        if (shape.vertical) {
            // A narrow continuous wooden strip, without a post on every tile.
            sx = Math.floor(img.width * .35); sw = Math.max(1, Math.floor(img.width * .3));
            const top = shape.north ? Math.floor(img.height * .18) : 0;
            const bottom = shape.south ? Math.floor(img.height * .12) : 0;
            sy = top; sh -= top + bottom;
        } else {
            const left = shape.west ? Math.floor(img.width * .12) : 0;
            const right = shape.east ? Math.floor(img.width * .12) : 0;
            sx = left; sw -= left + right;
        }
    }
    const dx = b.x * 24 + ox + shape.x, dy = b.y * 24 + oy - 7;
    if (b.kind === 'wall' && shape.vertical) {
        // Retain the existing generated wooden frame along the thin side wall.
        // These three strips do not overlap, so foreground fade stays uniform.
        const post = Math.max(1, Math.floor(img.width * .09)), inset = Math.floor(img.width * .05);
        ctx.drawImage(img, sx, sy, sw, sh, dx + 1, dy, 6, 31);
        ctx.drawImage(img, inset, sy, post, sh, dx, dy, 1, 31);
        ctx.drawImage(img, img.width - inset - post, sy, post, sh, dx + 7, dy, 1, 31);
    } else ctx.drawImage(img, sx, sy, sw, sh, dx, dy, shape.width, 31);
}
