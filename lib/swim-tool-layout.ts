import type {Sprite} from './art';

/** Reviewed 128px registrations for the female swim v3 sheets. In these
 * two poses the cyan hip strap touches the blue watering can, so a color
 * flood must stop at the authored boundary between the two materials. */
export const SWIM_CAN_LEFT:Partial<Record<Sprite,number>>={
    'water-down-1':71,
    'water-down-6':73,
};

/** Authored hammer silhouettes, excluding the gripping palm. The wooden
 * head shares brown shades with hair, so color alone cannot isolate it. */
export const SWIM_HAMMER_TOOLS:Partial<Record<Sprite,readonly (readonly [number,number,number,number])[]>>={
    'hammer-down-1':[[33,50,14,3],[33,53,15,1],[33,54,16,4],[33,58,15,1],[33,59,13,1],[33,60,12,2],[33,62,8,1]],
    'hammer-down-2':[[37,36,15,7],[37,43,14,3],[37,46,12,2]],
    'hammer-down-4':[[59,78,2,5],[56,83,9,2],[54,85,12,13]],
    'hammer-down-5':[[76,79,5,3],[75,82,9,1],[74,83,11,1],[73,84,12,2],[72,86,13,1],[71,87,13,8],[72,95,11,3]],
    'hammer-up-1':[[75,42,15,9],[76,51,14,1],[77,52,13,3],[80,55,8,1],[82,56,4,1]],
    'hammer-up-2':[[68,28,16,6],[69,34,15,2],[70,36,14,1],[71,37,13,2],[73,39,10,1],[73,40,9,1],[73,41,8,2]],
    'hammer-up-3':[[85,55,7,3],[84,58,8,1],[82,59,10,2],[81,61,10,2],[81,63,9,2],[81,65,8,3]],
    'hammer-up-4':[[60,86,13,15]],
    'hammer-up-5':[[92,71,13,16],[91,75,1,9]],
    'hammer-right-1':[[47,50,7,2],[44,52,11,1],[42,53,13,6],[43,59,13,2],[44,61,11,1],[46,62,5,2]],
    'hammer-right-2':[[39,32,18,7],[39,39,17,4],[40,43,14,2],[41,45,11,3]],
    'hammer-right-3':[[78,68,12,5],[75,73,15,5],[74,78,16,6]],
    'hammer-right-4':[[74,74,12,17],[72,80,2,4]],
    'hammer-right-5':[[78,75,13,8],[77,78,1,1],[75,79,3,4],[74,83,15,10]],
};
