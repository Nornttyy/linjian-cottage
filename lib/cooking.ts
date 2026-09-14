/** Pure cooking rules. One array entry is one ingredient unit; order never matters. */
export const MAX_COOKING_INGREDIENTS = 5;

const RAW_INGREDIENTS = {
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
    wood: {name:'木材',source:'forage'},stone:{name:'石头',source:'forage'},copper:{name:'铜矿',source:'forage'},essence:{name:'精华',source:'forage'},
    carrotSeed:{name:'胡萝卜种子',source:'farm'},tomatoSeed:{name:'番茄种子',source:'farm'},wheatSeed:{name:'小麦种子',source:'farm'},meal:{name:'熟食',source:'leftovers'},
} as const;

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
    dubiousMash:{name:'怪味糊糊',method:'roast',hp:1,stamina:3},
    toastedWood:{name:'焦木脆片',method:'roast',hp:0,stamina:2},
    stoneRice:{name:'石头焗饭',method:'roast',hp:0,stamina:4},
    copperLump:{name:'铜锅焦团',method:'roast',hp:0,stamina:0},
    starlightPudding:{name:'星露布丁',method:'bake',hp:50,stamina:55},
    glimmerRice:{name:'奇光饭团',method:'sushi',hp:38,stamina:58},
    seedCracker:{name:'种籽薄饼',method:'bake',hp:16,stamina:40},
    surfTurf:{name:'海陆大杂烩',method:'panFry',hp:48,stamina:44},
    leftoverStew:{name:'剩菜乱炖',method:'panFry',hp:12,stamina:20},
} as const satisfies Record<string, FoodRecovery & { name: string; method: CookMethod }>;
export type DishId = keyof typeof DISHES;
export const DISH_IDS = Object.keys(DISHES) as DishId[];
export const INGREDIENTS={...RAW_INGREDIENTS,...Object.fromEntries(Object.entries(DISHES).map(([id,dish])=>[id,{name:dish.name,source:'leftovers' as const}]))} as typeof RAW_INGREDIENTS & Record<DishId,{name:string;source:'leftovers'}>;
export type IngredientId = keyof typeof INGREDIENTS;
export const INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];
export const ODD_DISH_IDS:readonly DishId[]=['dubiousMash','toastedWood','stoneRice','copperLump','starlightPudding','glimmerRice','seedCracker','surfTurf','leftoverStew'];
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
    recipe('dubiousMash',variant([group('sugar'),group('milk')])),
    recipe('toastedWood',variant([group('wood')])),recipe('stoneRice',variant([group('stone'),group('rice')])),
    recipe('copperLump',variant([group('copper')])),
    recipe('starlightPudding',variant([group('essence'),group('milk'),group('sugar')])),
    recipe('glimmerRice',variant([group('essence'),group('rice'),group('nori')])),
    recipe('seedCracker',variant([group('wheatSeed'),group('wheat'),group('oil')])),
    recipe('surfTurf',variant([group('wagyu'),group('fish'),group('oil')])),
    recipe('leftoverStew',variant([group('meal'),group('carrot')])),
];

export type ResolvedRecipe = FoodRecovery & {
    id: DishId; output: DishId; method: CookMethod; ingredients: IngredientId[];
    counts: IngredientCounts; quantity: number; key:string;
};
// Main ingredients determine the dish; every other edible ingredient is a garnish.
// There is no exact recipe or unlock requirement for cooking.
function resolveLegacyRecipe(method: unknown, ingredients: unknown): ResolvedRecipe | null {
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
    const nutrition=selection.ingredients.reduce((sum,id)=>({hp:sum.hp+nutritionOf(id)[0],stamina:sum.stamina+nutritionOf(id)[1]}),{hp:0,stamina:0});
    const dish=DISHES[output],key=method+':'+INGREDIENT_IDS.flatMap(id=>n(id)?[id+'='+n(id)]:[]).join(',');
    return {id:output,output,method,ingredients:[...selection.ingredients],counts,quantity,key,
        hp:Math.min(100,Math.round(dish.hp*.55+nutrition.hp/quantity*.65)),
        stamina:Math.min(100,Math.round(dish.stamina*.55+nutrition.stamina/quantity*.65))};
}
const NUTRITION:Partial<Record<IngredientId,readonly [number,number]>>={
    fish:[14,10],carrot:[10,6],tomato:[8,10],wheat:[4,18],
    salmon:[16,11],salmonBelly:[23,16],salmonFatty:[31,22],
    tuna:[19,12],tunaBelly:[27,18],tunaFatty:[36,25],
    sweetShrimp:[14,13],largeSweetShrimp:[24,21],seaUrchin:[30,18],
    rice:[3,22],nori:[7,3],egg:[13,12],wagyu:[34,23],oil:[2,8],sugar:[0,14],milk:[12,10],
};
const seeds:readonly IngredientId[]=['carrotSeed','tomatoSeed','wheatSeed'];
const failedDishes:readonly DishId[]=['dubiousMash','toastedWood','stoneRice','copperLump'];
function nutritionOf(id:IngredientId):readonly [number,number]{
    if(NUTRITION[id])return NUTRITION[id]!;
    if(isDish(id))return [Math.min(12,DISHES[id].hp/3),Math.min(18,DISHES[id].stamina/3)];
    return seeds.includes(id)?[2,8]:id==='essence'?[20,12]:id==='meal'?[10,12]:[0,0];
}
/** Flexible ingredient families, with incompatible mixtures producing real odd dishes. */
export function resolveRecipe(method:unknown,ingredients:unknown):ResolvedRecipe|null{
    if(!isCookMethod(method))return null;
    const selection=validateSelection(ingredients);if(!selection.ok)return null;
    const {counts}=selection,n=(id:IngredientId)=>counts[id]??0,has=(ids:readonly IngredientId[])=>ids.some(id=>n(id)>0);
    const only=(ids:readonly IngredientId[])=>selection.ingredients.every(id=>ids.includes(id));
    const seafood=[...fish,...shrimp,'seaUrchin'] as IngredientId[];
    const legacy=resolveLegacyRecipe(method,ingredients);
    let special:DishId|undefined;
    // Mineral/wood experiments always take precedence, even with expensive food.
    if(n('copper'))special='copperLump';
    else if(n('stone'))special=n('rice')?'stoneRice':'dubiousMash';
    else if(n('wood'))special='toastedWood';
    else if(has(failedDishes))special='dubiousMash';
    else if(n('essence')){
        special=method==='bake'&&n('milk')&&n('sugar')&&only(['essence','milk','sugar','egg'])?'starlightPudding':
            method==='sushi'&&n('rice')&&n('nori')&&only(['essence','rice','nori','egg'])?'glimmerRice':'dubiousMash';
    }else if(has(seeds))special=method==='bake'&&n('wheat')&&n('oil')&&only([...seeds,'wheat','oil','egg','milk','sugar'])?'seedCracker':'dubiousMash';
    else if(selection.ingredients.some(id=>isDish(id)||id==='meal'))special=(method==='panFry'||method==='roast')&&!n('sugar')&&only([...DISH_IDS.filter(id=>!failedDishes.includes(id)&&!['bread','carrotCake','milkPudding','milkCake','starlightPudding'].includes(id)),'meal',...vegetables,'rice','egg','oil','nori'])?'leftoverStew':'dubiousMash';
    else if(n('wagyu')&&has(seafood))special=(method==='roast'||method==='panFry')&&!n('sugar')&&only(['wagyu',...seafood,...vegetables,'oil','rice','nori'])?'surfTurf':'dubiousMash';
    else {
        let reasonable=false;
        if(method==='roast')reasonable=!!legacy&&n('sugar')<=1&&only([...fish,...shrimp,'wagyu',...vegetables,'oil','rice','nori','milk','sugar']);
        if(method==='panFry')reasonable=!!legacy&&!!n('oil')&&n('sugar')<=1&&only([...fish,...shrimp,'wagyu',...vegetables,'oil','rice','nori','milk','sugar','egg']);
        if(method==='deepFry')reasonable=!!legacy&&!!n('oil')&&(!!n('wheat')||!!n('egg'))&&only([...fish,...shrimp,...vegetables,'oil','wheat','egg','rice','nori']);
        if(method==='bake')reasonable=!!legacy&&!!n('milk')&&(!!n('wheat')||!!n('egg'))&&only(['wheat','milk','egg','sugar','carrot']);
        if(method==='sushi')reasonable=!!legacy&&only(['rice','nori',...salmon,...tuna,...shrimp,'wagyu','seaUrchin','egg',...(n('egg')?['sugar' as const]:[])]);
        if(method==='sashimi')reasonable=!!legacy&&only([legacy.ingredients.find(id=>id+'Sashimi'===legacy.id)!,'nori']);
        if(reasonable)return legacy;
        special='dubiousMash';
    }
    const output=special!,dish=DISHES[output],nutrition=selection.ingredients.reduce((sum,id)=>[sum[0]+nutritionOf(id)[0],sum[1]+nutritionOf(id)[1]],[0,0]);
    const failed=failedDishes.includes(output),leftovers=output==='leftoverStew';
    return {id:output,output,method,ingredients:[...selection.ingredients],counts,quantity:1,
        key:method+':'+INGREDIENT_IDS.flatMap(id=>n(id)?[id+'='+n(id)]:[]).join(','),
        hp:failed?dish.hp:Math.min(leftovers?24:90,Math.round(dish.hp*.55+nutrition[0]*.45)),
        stamina:failed?dish.stamina:Math.min(leftovers?36:90,Math.round(dish.stamina*.55+nutrition[1]*.45))};
}

export type DiscoveredRecipe={method:CookMethod;ingredients:IngredientId[];discoveredAt:number;dish?:DishId};
export type CookedBatch={ingredients:IngredientId[];quantity:number;method?:CookMethod;recovery?:FoodRecovery};
export type CookingJournal={recipes?:Record<string,DiscoveredRecipe>;meals?:Partial<Record<DishId,CookedBatch[]>>};
export type CookingOwner=CookingJournal&{inventory:Partial<Record<DishId,number>>};
export function knownRecipes(owner:CookingJournal){
    return Object.values(owner.recipes??{}).flatMap(entry=>{
        const result=entry&&resolveRecipe(entry.method,entry.ingredients);return result&&(!entry.dish||entry.dish===result.id)?[result]:[];
    });
}
export function rememberCooking(owner:CookingOwner,recipe:ResolvedRecipe,now:number){
    owner.recipes??={};const previous=owner.recipes[recipe.key],discovered=!previous||(previous.dish!==undefined&&previous.dish!==recipe.id);
    if(discovered)owner.recipes[recipe.key]={method:recipe.method,ingredients:[...recipe.ingredients],discoveredAt:now,dish:recipe.id};
    owner.meals??={};const batches=owner.meals[recipe.output]??=[];
    // Old dishes without batch data retain their original recovery and are eaten first.
    const last=batches.at(-1);
    if(last&&last.method===recipe.method&&last.recovery?.hp===recipe.hp&&last.recovery?.stamina===recipe.stamina&&resolveRecipe(recipe.method,last.ingredients)?.key===recipe.key)last.quantity+=recipe.quantity;
    else batches.push({ingredients:[...recipe.ingredients],quantity:recipe.quantity,method:recipe.method,recovery:{hp:recipe.hp,stamina:recipe.stamina}});
    return discovered;
}
export function mealRecovery(owner:CookingOwner|undefined,food:unknown):FoodRecovery|null{
    if(!owner||!isDish(food))return foodHeal(food);
    const batches=owner.meals?.[food]??[],tracked=batches.reduce((sum,b)=>sum+b.quantity,0);
    if((owner.inventory[food]??0)>tracked)return foodHeal(food);
    const batch=batches[0];if(batch?.recovery)return {hp:batch.recovery.hp,stamina:batch.recovery.stamina};
    const result=batch&&resolveRecipe(batch.method??DISHES[food].method,batch.ingredients);
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

/** Preserve the recovery of food already cooked before ingredient compatibility changed. */
export function migrateCooking(owner:CookingOwner){
    for(const entry of Object.values(owner.recipes??{})){const result=resolveLegacyRecipe(entry.method,entry.ingredients);if(result)entry.dish??=result.id;}
    for(const id of DISH_IDS)for(const batch of owner.meals?.[id]??[]){
        const result=resolveLegacyRecipe(batch.method??DISHES[id].method,batch.ingredients);
        if(result?.id===id){batch.method??=DISHES[id].method;batch.recovery??={hp:result.hp,stamina:result.stamina};}
    }
}
