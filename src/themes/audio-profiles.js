import {soundtracks} from './soundtracks.js';
import palAudio from './pal-audio.json' with {type:'json'};
import {themeDefinition} from './catalog.js';

const presets={
 paper:{...soundtracks.paper,music:{},effects:{},mutedEffects:[]},
 voxel:{...soundtracks.voxel,music:{},effects:{},mutedEffects:[]},
 pal:{...soundtracks.paper,...soundtracks.pal,music:palAudio.music,effects:Object.fromEntries(Object.entries({attack:'attack',right:'weapon',wrong:'dying',shield:'cover',magic:'magic',lose:'death',encounter:'critical'}).map(([event,asset])=>[event,palAudio.effects[asset]])),mutedEffects:['win']},
};
export function audioForTheme(id,definitionFor=themeDefinition){
 const theme=definitionFor(id),options=theme.audio||{},base=options.preset?presets[options.preset]:theme.extends?audioForTheme(theme.extends,definitionFor):presets.paper;
 if(!base)throw Error(`Theme ${theme.id}: unknown audio preset ${options.preset}`);
 return {...base,...options,id:theme.id,tracks:{...base.tracks,...options.tracks},music:{...base.music,...options.music},effects:{...base.effects,...options.effects},mutedEffects:options.mutedEffects||base.mutedEffects};
}
export function audioSceneFor(style,scene){
 const fallback={boss:'battle',bossVictory:'victory'};
 for(const name of [scene,fallback[scene],'home'])if(name&&(style.music[name]||style.tracks[name]))return name;
 throw Error(`Theme ${style.id}: missing home music`);
}
