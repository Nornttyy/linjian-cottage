import assert from 'node:assert/strict';
import {rgbaPng} from './png-support.mjs';
import {join} from 'node:path';
import {compileProject} from './test-support.mjs';

// Decode the actual committed RGBA PNGs, so a painted checkerboard, empty crop,
// wrong atlas dimensions or a clipped neighboring sprite fails the release check.

const project=compileProject({name:'food-art'});
try{
    const {FOOD_SHEETS,foodCellRect,FOOD_ICON_SIZE,foodDetailSize}=await import(project.module('food-art-layout'));
    const {INGREDIENT_IDS,DISH_IDS}=await import(project.module('cooking'));
    const {ART_FILES}=await import(project.module('asset-loading'));
    const existing=['fish','carrot','tomato','wheat','wood','stone','copper','essence','carrotSeed','tomatoSeed','wheatSeed','meal'],expected=[...INGREDIENT_IDS.filter(id=>!existing.includes(id)&&!DISH_IDS.includes(id)),...DISH_IDS];
    const ids=FOOD_SHEETS.flatMap(sheet=>sheet.ids);
    assert.equal(ids.length,55);assert.equal(new Set(ids).size,55);
    assert.deepEqual([...ids].sort(),[...expected].sort());
    assert(ids.every(id=>!existing.includes(id)),'existing food sprites are preserved');
    assert.equal(FOOD_ICON_SIZE,32);
    assert(foodDetailSize('sweetShrimp')<foodDetailSize('largeSweetShrimp'));
    for(const sheet of FOOD_SHEETS){
        assert.equal(ART_FILES.filter(file=>file===sheet.file).length,1,'each sheet participates in loading progress exactly once');
        assert.equal(sheet.ids.length,sheet.columns*sheet.rows);
        const image=rgbaPng(join(project.source,'public/art',sheet.file));
        assert.deepEqual([image.width,image.height],[...sheet.size]);
        for(const [index,id] of sheet.ids.entries()){
            const [left,top,width,height]=foodCellRect(sheet,index);
            assert(left>=0&&top>=0&&left+width<=image.width&&top+height<=image.height);
            let solid=0,empty=0,edge=0;
            for(let y=0;y<height;y++)for(let x=0;x<width;x++){
                const alpha=image.pixels[((top+y)*image.width+left+x)*4+3];
                if(alpha===0)empty++;
                if(alpha>=128){solid++;if(x<2||y<2||x>=width-2||y>=height-2)edge++;}
            }
            assert(solid>width*height*.08,`${id}: visible food`);
            assert(empty>width*height*.15,`${id}: transparent surrounding space`);
            assert.equal(edge,0,`${id}: no opaque pixels clipped by the cell boundary`);
            assert(foodDetailSize(id)<=30,`${id}: at least one transparent pixel around the native icon`);
            console.log('PASS generated food icon, alpha and atlas cell:',id);
        }
    }
    console.log('55 food art checks; 0 failures');
}finally{project.cleanup();}
