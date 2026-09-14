import type {DishId, IngredientId} from './cooking';

export type FoodSpriteId = Exclude<IngredientId, 'fish' | 'carrot' | 'tomato' | 'wheat'> | DishId;
export type FoodSheet = {
    file: string;
    size: readonly [number, number];
    columns: number;
    rows: number;
    rowBounds?: readonly number[];
    ids: readonly FoodSpriteId[];
};

// Measured against the generated alpha silhouettes. Row dividers sit in the
// empty gaps, keeping shrimp antennae and bottle caps out of neighboring cells.
export const FOOD_SHEETS = [
    {file: 'food-salmon-v1.png', size: [1254, 1254], columns: 1, rows: 1, ids: ['salmon']},
    {file: 'food-ingredients-v1.png', size: [971, 1619], columns: 3, rows: 5,
        rowBounds: [0, 330, 635, 963, 1255, 1619],
        ids: ['salmonBelly', 'salmonFatty', 'tuna', 'tunaBelly', 'tunaFatty', 'sweetShrimp',
            'largeSweetShrimp', 'seaUrchin', 'rice', 'nori', 'egg', 'wagyu', 'oil', 'sugar', 'milk']},
    {file: 'food-cooked-v1.png', size: [1536, 1024], columns: 4, rows: 4,
        rowBounds: [0, 276, 506, 755, 1024],
        ids: ['roastFish', 'roastVegetables', 'roastWagyu', 'roastShrimp',
            'panFriedFish', 'tamagoyaki', 'panFriedWagyu', 'friedRice',
            'friedFish', 'friedShrimp', 'vegetableTempura', 'carrotFritter',
            'bread', 'carrotCake', 'milkPudding', 'milkCake']},
    {file: 'food-sushi-v1.png', size: [1536, 1024], columns: 3, rows: 2,
        ids: ['seaUrchinSushi', 'salmonSushi', 'tunaSushi', 'tamagoyakiSushi', 'wagyuSushi', 'sweetShrimpSushi']},
    {file: 'food-sashimi-v1.png', size: [1774, 887], columns: 4, rows: 2,
        ids: ['salmonSashimi', 'salmonBellySashimi', 'salmonFattySashimi', 'tunaSashimi',
            'tunaBellySashimi', 'tunaFattySashimi', 'sweetShrimpSashimi', 'largeSweetShrimpSashimi']},
    {file:'food-odd-v1.png',size:[1536,1024],columns:3,rows:3,ids:['dubiousMash','toastedWood','stoneRice','copperLump','starlightPudding','glimmerRice','seedCracker','surfTurf','leftoverStew']},
] as const satisfies readonly FoodSheet[];

export const FOOD_ICON_SIZE = 32;
export const foodDetailSize = (id: FoodSpriteId) => id === 'sweetShrimp' ? 24 : 30;
export function foodCellRect(sheet: FoodSheet, index: number): readonly [number, number, number, number] {
    const [width, height] = sheet.size, column = index % sheet.columns, row = Math.floor(index / sheet.columns);
    const x = Math.round(column * width / sheet.columns), right = Math.round((column + 1) * width / sheet.columns);
    const y = sheet.rowBounds?.[row] ?? Math.round(row * height / sheet.rows);
    const bottom = sheet.rowBounds?.[row + 1] ?? Math.round((row + 1) * height / sheet.rows);
    return [x, y, right - x, bottom - y];
}
