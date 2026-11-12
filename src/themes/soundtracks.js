// Original procedural scores: MIDI pitches, 0 = rest. Scene scores can be replaced independently.
const score=(bpm,melody,bass)=>({bpm,melody,bass});
export const soundtracks={
 paper:{lead:'sine',backing:'triangle',release:1.5,effectRoot:72,effectWave:'sine',tracks:{
  home:score(88,[72,76,79,0,76,74,72,0,69,72,76,79,74,71,72,0],[48,53,45,55]),
  dungeon:score(104,[64,67,72,74,72,67,64,0,65,69,72,76,74,69,67,0],[48,45,53,55]),
  battle:score(144,[69,72,76,72,69,76,79,76,65,69,74,69,64,68,71,76],[45,41,50,40]),
  victory:score(112,[72,0,76,79,84,0,83,79,81,79,76,74,72,0,0,0],[48,55,53,48]),
  defeat:score(66,[76,0,74,72,71,0,69,0,72,71,67,0,69,0,0,0],[45,41,43,45]),
 }},
 // PAL scores and combat sounds come from pal-audio.json. Only tiny UI clicks use synthesis.
 pal:{effectRoot:74,effectWave:'triangle'},
 voxel:{lead:'sine',backing:'triangle',release:2.7,effectRoot:67,effectWave:'square',tracks:{
  home:score(64,[67,0,74,0,78,0,74,71,66,0,73,0,76,0,71,0],[43,47,40,45]),
  dungeon:score(80,[71,0,66,69,74,0,78,0,76,73,0,69,66,0,64,0],[40,43,47,42]),
  battle:score(132,[64,71,76,0,79,76,71,74,62,69,74,0,78,74,69,66],[40,43,38,42]),
  victory:score(100,[67,71,74,0,79,0,78,74,76,0,71,74,79,0,0,0],[43,47,48,43]),
  defeat:score(58,[74,0,71,0,66,0,64,0,67,66,0,62,64,0,0,0],[40,36,38,40]),
 }},
};
export function audioScene({battle,dungeon,result}={}){
 if(battle&&result)return result.win?(battle.boss?'bossVictory':'victory'):'defeat';
 if(battle?.outcome&&!battle.animating)return battle.outcome==='win'?(battle.boss?'bossVictory':'victory'):'defeat';
 return battle?(battle.boss?'boss':'battle'):dungeon?'dungeon':'home';
}
