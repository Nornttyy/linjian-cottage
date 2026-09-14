import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {join} from 'node:path';
import {compileProject} from './test-support.mjs';

// Decode the actual committed RGBA PNGs, so a painted checkerboard, empty crop,
// wrong atlas dimensions or a clipped neighboring sprite fails the release check.
function rgbaPng(path) {
    const file=readFileSync(path),chunks=[];
    assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    let width,height;
    for(let offset=8;offset<file.length;){
        const length=file.readUInt32BE(offset),type=file.toString('ascii',offset+4,offset+8),data=file.subarray(offset+8,offset+8+length);
        if(type==='IHDR'){
            width=data.readUInt32BE(0);height=data.readUInt32BE(4);
            assert.equal(data[8],8,'8-bit pixels');assert.equal(data[9],6,'real RGBA transparency');assert.equal(data[12],0,'non-interlaced PNG');
        }
        if(type==='IDAT')chunks.push(data);
        offset+=length+12;
    }
    const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(width*height*4);
    assert.equal(raw.length,(stride+1)*height);
    const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
    for(let y=0;y<height;y++){
        const filter=raw[y*(stride+1)];assert(filter<=4);
        for(let x=0;x<stride;x++){
            const i=y*stride+x,a=x>=4?pixels[i-4]:0,b=y?pixels[i-stride]:0,c=y&&x>=4?pixels[i-stride-4]:0;
            const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);
            pixels[i]=(raw[y*(stride+1)+x+1]+predictor)&255;
        }
    }
    return {width,height,pixels};
}

const project=compileProject({name:'food-art'});
try{
    const {FOOD_SHEETS,foodCellRect,FOOD_ICON_SIZE,foodDetailSize}=await import(project.module('food-art-layout'));
    const {INGREDIENT_IDS,DISH_IDS}=await import(project.module('cooking'));
    const {ART_FILES}=await import(project.module('asset-loading'));
    const existing=['fish','carrot','tomato','wheat'],expected=[...INGREDIENT_IDS.filter(id=>!existing.includes(id)),...DISH_IDS];
    const ids=FOOD_SHEETS.flatMap(sheet=>sheet.ids);
    assert.equal(ids.length,46);assert.equal(new Set(ids).size,46);
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
    console.log('46 food art checks; 0 failures');
}finally{project.cleanup();}
