/** Pure cooking rules. One array entry is one ingredient unit; order never matters. */
export const MAX_COOKING_INGREDIENTS = 5;

export const INGREDIENTS = {
    fish: { name: '鲜鱼', source: 'fishing' },
    carrot: { name: '胡萝卜', source: 'farm' },
    tomato: { name: '番茄', source: 'farm' },
    wheat: { name: '小麦', source: 'farm' },
    salmon: { name: '三文鱼', source: 'fishing' },
    salmonBelly: { name: '三文鱼腩', source: 'fishing' },
    salmonFatty: { name: '三文鱼大腩', source: 'fishing' },
    tuna: { name: '金枪鱼', source: 'fishing' },
    tunaBelly: { name: '金枪鱼腩', source: 'fishing' },
    tunaFatty: { name: '金枪鱼大腩', source: 'fishing' },
    sweetShrimp: { name: '小甜虾', source: 'fishing' },
    largeSweetShrimp: { name: '大甜虾', source: 'fishing' },
    seaUrchin: { name: '海胆', source: 'fishing' },
    rice: { name: '米饭', source: 'camp' },
    nori: { name: '海苔', source: 'camp' },
    egg: { name: '鸡蛋', source: 'camp' },
    wagyu: { name: '和牛', source: 'camp' },
    oil: { name: '食用油', source: 'camp' },
    sugar: { name: '糖', source: 'camp' },
    milk: { name: '牛奶', source: 'camp' },
} as const;
export type IngredientId = keyof typeof INGREDIENTS;
export const INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];

export const COOK_METHODS = {
    roast: { name: '烤物', verb: '烘烤' },
    panFry: { name: '煎物', verb: '香煎' },
    deepFry: { name: '炸物', verb: '油炸' },
    bake: { name: '糕点', verb: '烘焙' },
    sushi: { name: '寿司', verb: '捏制' },
    sashimi: { name: '刺身', verb: '切片' },
} as const;
export type CookMethod = keyof typeof COOK_METHODS;
export type FoodRecovery = { hp: number; stamina: number };

export const DISHES = {
    roastFish: { name: '烤鱼', method: 'roast', hp: 32, stamina: 28 },
    roastVegetables: { name: '烤时蔬', method: 'roast', hp: 24, stamina: 34 },
    roastWagyu: { name: '烤和牛', method: 'roast', hp: 58, stamina: 50 },
    roastShrimp: { name: '烤甜虾', method: 'roast', hp: 34, stamina: 36 },
    panFriedFish: { name: '香煎鱼排', method: 'panFry', hp: 40, stamina: 32 },
    tamagoyaki: { name: '玉子烧', method: 'panFry', hp: 28, stamina: 40 },
    panFriedWagyu: { name: '香煎和牛', method: 'panFry', hp: 64, stamina: 54 },
    friedRice: { name: '田园炒饭', method: 'panFry', hp: 38, stamina: 65 },
    friedFish: { name: '炸鱼', method: 'deepFry', hp: 44, stamina: 42 },
    friedShrimp: { name: '炸甜虾', method: 'deepFry', hp: 46, stamina: 46 },
    vegetableTempura: { name: '蔬菜天妇罗', method: 'deepFry', hp: 32, stamina: 50 },
    carrotFritter: { name: '胡萝卜炸饼', method: 'deepFry', hp: 36, stamina: 56 },
    bread: { name: '牛奶面包', method: 'bake', hp: 24, stamina: 58 },
    carrotCake: { name: '胡萝卜蛋糕', method: 'bake', hp: 46, stamina: 68 },
    milkPudding: { name: '牛奶布丁', method: 'bake', hp: 36, stamina: 52 },
    milkCake: { name: '奶香蛋糕', method: 'bake', hp: 40, stamina: 62 },
    seaUrchinSushi: { name: '海胆寿司', method: 'sushi', hp: 56, stamina: 48 },
    salmonSushi: { name: '三文鱼寿司', method: 'sushi', hp: 38, stamina: 42 },
    tunaSushi: { name: '金枪鱼寿司', method: 'sushi', hp: 44, stamina: 42 },
    tamagoyakiSushi: { name: '玉子烧寿司', method: 'sushi', hp: 30, stamina: 48 },
    wagyuSushi: { name: '和牛寿司', method: 'sushi', hp: 60, stamina: 52 },
    sweetShrimpSushi: { name: '甜虾寿司', method: 'sushi', hp: 40, stamina: 44 },
    salmonSashimi: { name: '三文鱼刺身', method: 'sashimi', hp: 26, stamina: 18 },
    salmonBellySashimi: { name: '三文鱼腩刺身', method: 'sashimi', hp: 38, stamina: 28 },
    salmonFattySashimi: { name: '三文鱼大腩刺身', method: 'sashimi', hp: 52, stamina: 38 },
    tunaSashimi: { name: '金枪鱼刺身', method: 'sashimi', hp: 30, stamina: 20 },
    tunaBellySashimi: { name: '金枪鱼腩刺身', method: 'sashimi', hp: 44, stamina: 30 },
    tunaFattySashimi: { name: '金枪鱼大腩刺身', method: 'sashimi', hp: 60, stamina: 42 },
    sweetShrimpSashimi: { name: '小甜虾刺身', method: 'sashimi', hp: 24, stamina: 22 },
    largeSweetShrimpSashimi: { name: '大甜虾刺身', method: 'sashimi', hp: 40, stamina: 34 },
} as const satisfies Record<string, FoodRecovery & { name: string; method: CookMethod }>;
export type DishId = keyof typeof DISHES;
export const DISH_IDS = Object.keys(DISHES) as DishId[];
export type IngredientCounts = Partial<Record<IngredientId, number>>;
export type SelectionValidation =
    | { ok: true; ingredients: IngredientId[]; counts: IngredientCounts }
    | { ok: false; error: string; ingredients: []; counts: IngredientCounts };

const owns = (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key);
export function isIngredient(value: unknown): value is IngredientId {
    return typeof value === 'string' && owns(INGREDIENTS, value);
}
export function isCookMethod(value: unknown): value is CookMethod {
    return typeof value === 'string' && owns(COOK_METHODS, value);
}
export function isDish(value: unknown): value is DishId {
    return typeof value === 'string' && owns(DISHES, value);
}
export function ingredientCounts(ingredients: readonly IngredientId[]): IngredientCounts {
    const counts: IngredientCounts = {};
    for (const ingredient of ingredients) counts[ingredient] = (counts[ingredient] ?? 0) + 1;
    return counts;
}
export function validateSelection(value: unknown, inventory?: Readonly<IngredientCounts>): SelectionValidation {
    const fail = (error: string): SelectionValidation => ({ ok: false, error, ingredients: [], counts: {} });
    if (!Array.isArray(value) || value.length === 0) return fail('请加入食材');
    if (value.length > MAX_COOKING_INGREDIENTS) return fail('最多加入5份食材');
    const entries: unknown[] = [...value];
    if (!entries.every(isIngredient)) return fail('含有不能烹饪的物品');
    const ingredients: IngredientId[] = [...entries];
    const counts = ingredientCounts(ingredients);
    if (inventory) {
        for (const ingredient of INGREDIENT_IDS) {
            const needed = counts[ingredient] ?? 0;
            if (!needed) continue;
            const available = inventory[ingredient] ?? 0;
            if (!Number.isFinite(available) || available < needed) return fail(`${INGREDIENTS[ingredient].name}不足`);
        }
    }
    return { ok: true, ingredients, counts };
}

/** Groups in one variant are disjoint. Every selected ingredient must be consumed. */
export type RecipeGroup = { ingredients: readonly IngredientId[]; min: number; max: number };
export type RecipeVariant = { groups: readonly RecipeGroup[]; quantity: number };
export type CookingRecipe = { id: DishId; method: CookMethod; variants: readonly RecipeVariant[] };
const group = (ingredients: IngredientId | readonly IngredientId[], min = 1, max = min): RecipeGroup => ({ ingredients: typeof ingredients === 'string' ? [ingredients] : ingredients, min, max });
const variant = (groups: readonly RecipeGroup[], quantity = 1): RecipeVariant => ({ groups, quantity });
const salmon: readonly IngredientId[] = ['salmon', 'salmonBelly', 'salmonFatty'];
const tuna: readonly IngredientId[] = ['tuna', 'tunaBelly', 'tunaFatty'];
const fish: readonly IngredientId[] = ['fish', ...salmon, ...tuna];
const shrimp: readonly IngredientId[] = ['sweetShrimp', 'largeSweetShrimp'];
const vegetables: readonly IngredientId[] = ['carrot', 'tomato'];
const recipe = (id: DishId, ...variants: RecipeVariant[]): CookingRecipe => ({ id, method: DISHES[id].method, variants });
const sushiVariants = (protein: readonly IngredientId[]) => [
    variant([group('rice'), group('nori'), group(protein)]),
    variant([group('rice', 2), group('nori'), group(protein, 2)], 2),
];
const sashimiVariants = (ingredient: IngredientId) => Array.from({ length: MAX_COOKING_INGREDIENTS }, (_, index) => variant([group(ingredient, index + 1)], index + 1));

export const RECIPES: readonly CookingRecipe[] = [
    recipe('roastFish', variant([group(fish), group('oil', 0, 1), group(vegetables, 0, 2), group('rice', 0, 1)])),
    recipe('roastVegetables', variant([group('carrot'), group('tomato'), group('oil', 0, 1), group('rice', 0, 1)])),
    recipe('roastWagyu', variant([group('wagyu'), group('oil', 0, 1), group(vegetables, 0, 2), group('rice', 0, 1)])),
    recipe('roastShrimp', variant([group(shrimp), group('oil', 0, 1), group(vegetables, 0, 2), group('rice', 0, 1)])),
    recipe('panFriedFish', variant([group(fish), group('oil'), group(vegetables, 0, 2), group('rice', 0, 1)])),
    recipe('tamagoyaki', variant([group('egg', 2), group('sugar'), group('oil'), group('milk', 0, 1)])),
    recipe('panFriedWagyu', variant([group('wagyu'), group('oil'), group(vegetables, 0, 2), group('rice', 0, 1)])),
    recipe('friedRice', variant([group('rice'), group('egg'), group('oil'), group('carrot'), group('tomato', 0, 1)])),
    recipe('friedFish', variant([group(fish), group('wheat'), group('oil'), group('egg', 0, 1), group('carrot', 0, 1)])),
    recipe('friedShrimp', variant([group(shrimp), group('wheat'), group('oil'), group('egg', 0, 1), group('carrot', 0, 1)])),
    recipe('vegetableTempura', variant([group('carrot'), group('tomato'), group('wheat'), group('oil'), group('egg', 0, 1)])),
    recipe('carrotFritter', variant([group('carrot', 2), group('wheat'), group('oil'), group('egg')])),
    recipe('bread', variant([group('wheat', 2), group('milk'), group('sugar', 0, 1)])),
    recipe('carrotCake', variant([group('wheat'), group('carrot'), group('egg'), group('sugar'), group('milk')])),
    recipe('milkPudding', variant([group('milk', 2), group('egg'), group('sugar')])),
    recipe('milkCake', variant([group('wheat'), group('egg'), group('sugar'), group('milk', 1, 2)])),
    recipe('seaUrchinSushi', ...sushiVariants(['seaUrchin'])),
    recipe('salmonSushi', ...sushiVariants(salmon)),
    recipe('tunaSushi', ...sushiVariants(tuna)),
    recipe('tamagoyakiSushi', variant([group('rice'), group('nori'), group('egg'), group('sugar')])),
    recipe('wagyuSushi', ...sushiVariants(['wagyu'])),
    recipe('sweetShrimpSushi', ...sushiVariants(shrimp)),
    recipe('salmonSashimi', ...sashimiVariants('salmon')),
    recipe('salmonBellySashimi', ...sashimiVariants('salmonBelly')),
    recipe('salmonFattySashimi', ...sashimiVariants('salmonFatty')),
    recipe('tunaSashimi', ...sashimiVariants('tuna')),
    recipe('tunaBellySashimi', ...sashimiVariants('tunaBelly')),
    recipe('tunaFattySashimi', ...sashimiVariants('tunaFatty')),
    recipe('sweetShrimpSashimi', ...sashimiVariants('sweetShrimp')),
    recipe('largeSweetShrimpSashimi', ...sashimiVariants('largeSweetShrimp')),
];

export type ResolvedRecipe = FoodRecovery & {
    id: DishId; output: DishId; method: CookMethod; ingredients: IngredientId[];
    counts: IngredientCounts; quantity: number; key:string;
};
// Main ingredients determine the dish; every other edible ingredient is a garnish.
// There is no exact recipe or unlock requirement for cooking.
export function resolveRecipe(method: unknown, ingredients: unknown): ResolvedRecipe | null {
    if (!isCookMethod(method)) return null;
    const selection=validateSelection(ingredients);if(!selection.ok)return null;
    const {counts}=selection,n=(id:IngredientId)=>counts[id]??0;
    const total=(ids:readonly IngredientId[])=>ids.reduce((sum,id)=>sum+n(id),0);
    const dominant=(ids:readonly IngredientId[])=>[...ids].filter(id=>n(id)>0).sort((a,b)=>n(b)-n(a)||INGREDIENT_IDS.indexOf(a)-INGREDIENT_IDS.indexOf(b))[0];
    const protein=dominant(['wagyu',...fish,...shrimp,'seaUrchin','egg']);
    let output:DishId|undefined,quantity=1;
    if(method==='roast')output=protein==='wagyu'?'roastWagyu':protein&&shrimp.includes(protein)?'roastShrimp':protein&&fish.includes(protein)?'roastFish':total(vegetables)?'roastVegetables':undefined;
    if(method==='panFry')output=n('rice')?'friedRice':protein==='wagyu'?'panFriedWagyu':protein&&fish.includes(protein)?'panFriedFish':n('egg')?'tamagoyaki':undefined;
    if(method==='deepFry')output=protein&&fish.includes(protein)?'friedFish':protein&&shrimp.includes(protein)?'friedShrimp':n('carrot')&&(!n('tomato')||n('carrot')>=2)?'carrotFritter':total(vegetables)?'vegetableTempura':undefined;
    if(method==='bake')output=n('carrot')&&n('wheat')?'carrotCake':n('wheat')&&n('milk')&&(n('egg')||n('sugar'))&&n('wheat')<2?'milkCake':n('wheat')?'bread':n('milk')?'milkPudding':undefined;
    if(method==='sushi'&&n('rice')){
        output=protein==='wagyu'?'wagyuSushi':protein==='seaUrchin'?'seaUrchinSushi':protein==='egg'?'tamagoyakiSushi':protein&&salmon.includes(protein)?'salmonSushi':protein&&tuna.includes(protein)?'tunaSushi':protein&&shrimp.includes(protein)?'sweetShrimpSushi':undefined;
        quantity=Math.max(1,Math.min(n('rice'),total([...salmon,...tuna,...shrimp,'wagyu','seaUrchin','egg'])));
    }
    if(method==='sashimi'){
        const main=dominant([...salmon,...tuna,...shrimp]);
        if(main){output=(`${main}Sashimi`) as DishId;quantity=n(main);}
    }
    if(!output)return null;
    const nutrition=selection.ingredients.reduce((sum,id)=>({hp:sum.hp+NUTRITION[id][0],stamina:sum.stamina+NUTRITION[id][1]}),{hp:0,stamina:0});
    const dish=DISHES[output],key=method+':'+INGREDIENT_IDS.flatMap(id=>n(id)?[id+'='+n(id)]:[]).join(',');
    return {id:output,output,method,ingredients:[...selection.ingredients],counts,quantity,key,
        hp:Math.min(100,Math.round(dish.hp*.55+nutrition.hp/quantity*.65)),
        stamina:Math.min(100,Math.round(dish.stamina*.55+nutrition.stamina/quantity*.65))};
}
const NUTRITION:Record<IngredientId,readonly [number,number]>={
    fish:[14,10],carrot:[10,6],tomato:[8,10],wheat:[4,18],
    salmon:[16,11],salmonBelly:[23,16],salmonFatty:[31,22],
    tuna:[19,12],tunaBelly:[27,18],tunaFatty:[36,25],
    sweetShrimp:[14,13],largeSweetShrimp:[24,21],seaUrchin:[30,18],
    rice:[3,22],nori:[7,3],egg:[13,12],wagyu:[34,23],oil:[2,8],sugar:[0,14],milk:[12,10],
};
export type DiscoveredRecipe={method:CookMethod;ingredients:IngredientId[];discoveredAt:number};
export type CookedBatch={ingredients:IngredientId[];quantity:number};
export type CookingJournal={recipes?:Record<string,DiscoveredRecipe>;meals?:Partial<Record<DishId,CookedBatch[]>>};
export type CookingOwner=CookingJournal&{inventory:Partial<Record<DishId,number>>};
export function knownRecipes(owner:CookingJournal){
    return Object.values(owner.recipes??{}).flatMap(entry=>{
        const result=entry&&resolveRecipe(entry.method,entry.ingredients);return result?[result]:[];
    });
}
export function rememberCooking(owner:CookingOwner,recipe:ResolvedRecipe,now:number){
    owner.recipes??={};const discovered=!Object.hasOwn(owner.recipes,recipe.key);
    if(discovered)owner.recipes[recipe.key]={method:recipe.method,ingredients:[...recipe.ingredients],discoveredAt:now};
    owner.meals??={};const batches=owner.meals[recipe.output]??=[];
    // Old dishes without batch data retain their original recovery and are eaten first.
    const last=batches.at(-1);
    if(last&&resolveRecipe(recipe.method,last.ingredients)?.key===recipe.key)last.quantity+=recipe.quantity;
    else batches.push({ingredients:[...recipe.ingredients],quantity:recipe.quantity});
    return discovered;
}
export function mealRecovery(owner:CookingOwner|undefined,food:unknown):FoodRecovery|null{
    if(!owner||!isDish(food))return foodHeal(food);
    const batches=owner.meals?.[food]??[],tracked=batches.reduce((sum,b)=>sum+b.quantity,0);
    if((owner.inventory[food]??0)>tracked)return foodHeal(food);
    const result=batches[0]&&resolveRecipe(DISHES[food].method,batches[0].ingredients);
    return result?.output===food?{hp:result.hp,stamina:result.stamina}:foodHeal(food);
}
export function consumeMeal(owner:CookingOwner,food:unknown){
    if(!isDish(food))return;
    const batches=owner.meals?.[food];if(!batches?.length)return;
    if((owner.inventory[food]??0)>batches.reduce((sum,b)=>sum+b.quantity,0))return;
    if(--batches[0].quantity<=0)batches.shift();
}

/** An explicit example for a recipe book/autofill. It never includes optional garnish. */
export function recipeExample(id: DishId): IngredientId[] {
    const entry = RECIPES.find(value => value.id === id);
    return entry ? entry.variants[0].groups.flatMap(value => Array<IngredientId>(value.min).fill(value.ingredients[0])) : [];
}

/** Unknown and uncooked seafood are not directly edible. Legacy meal stays compatible. */
export function foodHeal(food: unknown): FoodRecovery | null {
    if (food === 'carrot') return { hp: 12, stamina: 8 };
    if (food === 'tomato') return { hp: 10, stamina: 10 };
    if (food === 'meal') return { hp: 36, stamina: 30 };
    return isDish(food) ? { hp: DISHES[food].hp, stamina: DISHES[food].stamina } : null;
}
