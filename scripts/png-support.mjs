import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';

export function rgbaPng(path) {
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
