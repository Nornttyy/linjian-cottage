import {SPAWN,sceneAt,terrainAt} from './world';
import {floorLevel} from './structures';
export const CAMPFIRE={x:SPAWN.x,y:SPAWN.y-1.4};
export const ACTIVITY_TIMING={harvest:{duration:480,contact:220},pickup:{duration:420,contact:200},eat:{duration:600,contact:260},fish:{duration:2400,contact:1900},cook:{duration:1800,contact:1300},sleep:{duration:4000,contact:3600}} as const;
export type FoodKind='carrot'|'tomato'|'meal';
export const FOOD_HEAL:Record<FoodKind,number>={carrot:12,tomato:10,meal:36};
export type CookingIngredient='fish'|'carrot'|'tomato'|'wheat';
export type CookingRecipe={item:CookingIngredient;count:number};
const recipes:CookingRecipe[]=[{item:'fish',count:1},{item:'carrot',count:2},{item:'tomato',count:2},{item:'wheat',count:3}];
export function cookingRecipe(inventory:Readonly<Partial<Record<CookingIngredient,number>>>){return recipes.find(recipe=>(inventory[recipe.item]??0)>=recipe.count);}
export function nearCampfire(point:{x:number;y:number;level?:number}){return floorLevel(point)===0&&sceneAt(point.x)==='surface'&&Math.hypot(point.x-CAMPFIRE.x,point.y-CAMPFIRE.y)<2.6;}
export function canCast(point:{x:number;y:number;level?:number},x:number,y:number){return floorLevel(point)===0&&sceneAt(point.x)==='surface'&&Number.isInteger(x)&&Number.isInteger(y)&&sceneAt(x)==='surface'&&terrainAt(Math.floor(point.x),Math.floor(point.y))!=='water'&&terrainAt(x,y)==='water'&&Math.hypot(point.x-x-.5,point.y-y-.5)<=3.2;}
