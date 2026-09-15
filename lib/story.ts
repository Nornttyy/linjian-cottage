import type {Player,WorldState} from './simulation';
import {SPAWN} from './world';
export const BEACON={x:367.5,y:406.5};
export const STORY_STAGES=[
    {title:'给过路人留一顿饭',text:'旧驿站已经空了很久。先给营地留两份料理，让下一位旅人能歇歇脚。',target:SPAWN,button:'留下 2 份料理'},
    {title:'重新认一遍旧路',text:'去古木林心和铜石矿洞看看。记下路，才知道那盏旧灯该为谁亮起。',button:'交回路线笔记'},
    {title:'重亮驿站的灯',text:'把材料带到日光石环，修好旧驿站的路灯。以后经过这片草甸，夜里也有光。',target:BEACON,button:'修复 · 20 木 / 12 石 / 6 铜'},
] as const;
export function storyStage(p:Player){return Math.max(0,Math.min(4,p.storyStage??0));}
export function storyObjective(p:Player,s:WorldState){const stage=storyStage(p);if(stage===0)return'重亮林间驿站';if(stage===4)return'驿站的灯已经亮起';if(stage===2)return `旧路笔记 · 古木 ${p.journal?.oak?'✓':'—'} / 矿洞 ${p.journal?.mine?'✓':'—'}`;return stage===3&&s.beaconLit?'回到日光石环，看看亮起的灯':STORY_STAGES[stage-1].title;}
