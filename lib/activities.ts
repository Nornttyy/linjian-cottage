import {SPAWN,sceneAt,terrainAt} from './world';
import {floorLevel,type Building} from './structures';
import {DISHES,type DishId} from './cooking';
export const CAMPFIRE={x:SPAWN.x,y:SPAWN.y-1.4};
export const ACTIVITY_TIMING={harvest:{duration:480,contact:220},pickup:{duration:420,contact:200},eat:{duration:600,contact:260},fish:{duration:550,contact:250},cook:{duration:1800,contact:1300},sleep:{duration:4000,contact:3600}} as const;
export type FoodKind='carrot'|'tomato'|'meal'|DishId;
export const FOOD_HEAL={carrot:12,tomato:10,meal:36,...Object.fromEntries(Object.entries(DISHES).map(([id,dish])=>[id,dish.hp]))} as Record<FoodKind,number>;
export type CookingIngredient='fish'|'carrot'|'tomato'|'wheat';
export type CookingRecipe={item:CookingIngredient;count:number};
const recipes:CookingRecipe[]=[{item:'fish',count:1},{item:'carrot',count:2},{item:'tomato',count:2},{item:'wheat',count:3}];
export function cookingRecipe(inventory:Readonly<Partial<Record<CookingIngredient,number>>>){return recipes.find(recipe=>(inventory[recipe.item]??0)>=recipe.count);}
export function campfireNear(point:{x:number;y:number;level?:number},buildings:Readonly<Record<string,Building>>={},target?:{x:number;y:number}){
    const fires=[...(floorLevel(point)===0&&sceneAt(point.x)==='surface'?[CAMPFIRE]:[]),...Object.values(buildings).filter(b=>b.kind==='campfire'&&floorLevel(b)===floorLevel(point)&&sceneAt(b.x)===sceneAt(point.x)).map(b=>({x:b.x+.5,y:b.y+.5}))];
    return fires.filter(f=>Math.hypot(point.x-f.x,point.y-f.y)<2.6&&(!target||Math.hypot(target.x-f.x,target.y-f.y)<1.2)).sort((a,b)=>Math.hypot(point.x-a.x,point.y-a.y)-Math.hypot(point.x-b.x,point.y-b.y))[0];
}
export function nearCampfire(point:{x:number;y:number;level?:number},buildings:Readonly<Record<string,Building>>={}){return !!campfireNear(point,buildings);}
export function canCast(point:{x:number;y:number;level?:number},x:number,y:number){return floorLevel(point)===0&&sceneAt(point.x)==='surface'&&Number.isInteger(x)&&Number.isInteger(y)&&sceneAt(x)==='surface'&&terrainAt(Math.floor(point.x),Math.floor(point.y))!=='water'&&terrainAt(x,y)==='water'&&Math.hypot(point.x-x-.5,point.y-y-.5)<=3.2;}
