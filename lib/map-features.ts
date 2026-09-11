// A fixed, authored world plan. These are presentation features, never obstacles.
export type MapPoint={x:number;y:number};
export type LandBiome='grass'|'forest'|'rock'|'snow'|'marsh';
export type NaturalLandmark={id:'ancient-oak'|'frost-cairn'|'sunstone-circle'|'firefly-meadow';name:string;x:number;y:number;width:number;height:number;biome:LandBiome};
export const NATURAL_LANDMARKS:readonly NaturalLandmark[]=[
    {id:'ancient-oak',name:'古木林心',x:140,y:204,width:6,height:5,biome:'forest'},
    {id:'frost-cairn',name:'霜石垒',x:374,y:90,width:6,height:5,biome:'snow'},
    {id:'sunstone-circle',name:'日光石环',x:364,y:404,width:6,height:5,biome:'grass'},
    {id:'firefly-meadow',name:'萤草甸',x:153,y:422,width:6,height:5,biome:'marsh'},
];
export const landmarkCenter=(landmark:NaturalLandmark):MapPoint=>({x:landmark.x+landmark.width/2,y:landmark.y+landmark.height/2});
export type AuthoredTrail={id:string;name:string;halfWidth:number;points:readonly MapPoint[]};
// Control points are deliberately positioned on each bank; the old bridge is the only crossing.
const routes:[string,string,number,number[][]][]=[
    ['camp-mine','营地矿道',1.35,[[214,319.5],[240,319.5],[258,319.5],[280,319.5],[294,319.5],[301,309],[306,288],[302,267],[311,244],[332,230],[350.5,217.5]]],
    ['old-wood','古木支路',.9,[[224,319.5],[214,307],[207,283],[188,269],[180,245],[158,225],[143,209]]],
    ['marsh-walk','萤草支路',.9,[[244,331],[231,352],[213,374],[203,399],[180,409],[156,424.5]]],
    ['ridge-walk','霜岭支路',.95,[[350.5,217.5],[361,193],[351,168],[364,146],[366,119],[377,92.5]]],
    ['sun-meadow','日光支路',.95,[[301,310],[320,328],[336,349],[342,373],[359,392],[367,406.5]]],
];
function curve(points:number[][]):MapPoint[]{
    const result:MapPoint[]=[];
    for(let i=0;i<points.length-1;i++){
        const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)],steps=Math.max(2,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/2));
        for(let n=0;n<steps;n++){const t=n/steps,t2=t*t,t3=t2*t;const axis=(k:number)=>(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3)/2;result.push({x:axis(0),y:axis(1)});}
    }
    const end=points[points.length-1];result.push({x:end[0],y:end[1]});return result;
}
export const AUTHORED_TRAILS:readonly AuthoredTrail[]=routes.map(([id,name,halfWidth,points])=>({id,name,halfWidth,points:curve(points)}));
export const MEADOW_CLEARINGS:readonly {name:string;x:number;y:number;rx:number;ry:number}[]=[
    {name:'营地草甸',x:254,y:322,rx:35,ry:29},
    {name:'西风草坡',x:179,y:324,rx:32,ry:25},
    {name:'古木林隙',x:159,y:225,rx:24,ry:18},
    {name:'南岸缓坡',x:241,y:373,rx:26,ry:26},
    {name:'日光草甸',x:367,y:406,rx:33,ry:26},
    {name:'东原草甸',x:409,y:311,rx:40,ry:32},
    {name:'远野草甸',x:429,y:462,rx:35,ry:26},
];
// Fixed smooth profiles replace the old rectangular biome splits.
function profile(knots:readonly number[][]){
    const values=new Float32Array(512);let segment=1;
    for(let i=0;i<512;i++){while(segment<knots.length-1&&i>knots[segment][0])segment++;const a=knots[segment-1],b=knots[segment],t=Math.max(0,Math.min(1,(i-a[0])/(b[0]-a[0]))),s=t*t*(3-2*t);values[i]=a[1]+(b[1]-a[1])*s;}return values;
}
const snowWest=profile([[0,249],[40,257],[85,277],[130,300],[180,323],[512,323]]);
const snowSouth=profile([[0,65],[220,70],[260,82],[290,118],[320,135],[360,126],[402,149],[452,120],[512,155]]);
const ridgeWest=profile([[0,300],[100,306],[145,291],[185,309],[223,320],[250,350],[286,397],[305,434],[330,484],[350,525],[512,525]]);
const wetlandEast=profile([[0,80],[300,112],[335,155],[365,198],[392,222],[430,207],[468,193],[512,235]]);
const wetlandNorth=profile([[0,382],[55,360],[112,352],[150,367],[205,385],[250,410],[512,450]]);
const forestSouth=profile([[0,347],[100,339],[170,307],[240,278],[290,285],[360,266],[430,290],[512,270]]);
const westWood=profile([[0,198],[100,218],[190,216],[275,239],[330,222],[370,174],[430,112],[512,145]]);
const eastWood=profile([[0,330],[280,363],[320,367],[370,307],[430,337],[512,297]]);
const BIOMES:readonly LandBiome[]=['grass','forest','rock','snow','marsh'];
const land=new Uint8Array(512*512),paths=new Uint8Array(512*512);
for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    let biome=0;
    if(x>snowWest[y]&&y<snowSouth[x])biome=3;
    else if(x>ridgeWest[y])biome=2;
    else if(x<wetlandEast[y]&&y>wetlandNorth[x])biome=4;
    else if(y<forestSouth[x]||x<westWood[y]||(y>300&&x>eastWood[y]))biome=1;
    if(biome===1&&MEADOW_CLEARINGS.some(m=>((x-m.x)/m.rx)**2+((y-m.y)/m.ry)**2<1))biome=0;
    // Keep the established open homestead and soil around camp unchanged.
    if(x>233&&x<276&&y>297&&y<344)biome=0;
    land[y*512+x]=biome;
}
for(const trail of AUTHORED_TRAILS)for(let i=1;i<trail.points.length;i++){
    const a=trail.points[i-1],b=trail.points[i],r=trail.halfWidth,d=(b.x-a.x)**2+(b.y-a.y)**2;
    for(let y=Math.max(0,Math.floor(Math.min(a.y,b.y)-r));y<=Math.min(511,Math.ceil(Math.max(a.y,b.y)+r));y++)for(let x=Math.max(0,Math.floor(Math.min(a.x,b.x)-r));x<=Math.min(511,Math.ceil(Math.max(a.x,b.x)+r));x++){
        const t=d?Math.max(0,Math.min(1,((x+.5-a.x)*(b.x-a.x)+(y+.5-a.y)*(b.y-a.y))/d)):0;
        if((x+.5-a.x-t*(b.x-a.x))**2+(y+.5-a.y-t*(b.y-a.y))**2<=r*r)paths[y*512+x]=1;
    }
}
// Hydrology, mines and resource occupancy are applied by world.ts after this visual plan.
export function authoredLandAt(x:number,y:number):LandBiome{return BIOMES[land[Math.floor(y)*512+Math.floor(x)]??0];}
export function authoredTrailAt(x:number,y:number){return x>=0&&y>=0&&x<512&&y<512&&paths[Math.floor(y)*512+Math.floor(x)]===1;}
