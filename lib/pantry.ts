import type {IngredientId} from './cooking';

// Camp provisions make ingredients outside the current farming system obtainable.
export const PANTRY_OFFERS={
    rice:{item:'rice',quantity:2,cost:{wood:3}},
    nori:{item:'nori',quantity:2,cost:{wood:2}},
    egg:{item:'egg',quantity:2,cost:{wood:3}},
    oil:{item:'oil',quantity:2,cost:{wood:2}},
    sugar:{item:'sugar',quantity:2,cost:{wood:2}},
    milk:{item:'milk',quantity:2,cost:{wood:3}},
    wagyu:{item:'wagyu',quantity:1,cost:{essence:4}},
} as const satisfies Record<string,{item:IngredientId;quantity:number;cost:Partial<Record<'wood'|'essence',number>>}>;
export type PantryOffer=keyof typeof PANTRY_OFFERS;
export function pantryOffer(value:unknown){
    return typeof value==='string'&&Object.hasOwn(PANTRY_OFFERS,value)?PANTRY_OFFERS[value as PantryOffer]:null;
}
