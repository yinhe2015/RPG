import {test} from 'node:test';
import assert from 'node:assert/strict';
import {soundtracks,audioScene} from '../src/themes/soundtracks.js';
import palAudio from '../src/themes/pal-audio.json' with {type:'json'};
import {statSync,existsSync} from 'node:fs';

test('paper and voxel provide distinct scene melodies, including independent victory and defeat scores',()=>{
 const melodies=new Set();
 for(const theme of [soundtracks.paper,soundtracks.voxel])for(const scene of ['home','dungeon','battle','victory','defeat']){
  const score=theme.tracks[scene];assert.ok(score.bpm>0&&score.bass.length>0);
  const signature=JSON.stringify(score.melody);assert.ok(!melodies.has(signature));melodies.add(signature);
 }
 assert.equal(melodies.size,10);
});
test('audio follows exploration and results without stale results taking over the next scene',()=>{
 assert.equal(audioScene(), 'home');
 assert.equal(audioScene({dungeon:{}}),'dungeon');
 assert.equal(audioScene({battle:{},dungeon:{}}),'battle');
 assert.equal(audioScene({battle:{},result:{win:true}}),'victory');
 assert.equal(audioScene({battle:{},result:{win:false}}),'defeat');
 assert.equal(audioScene({dungeon:{},result:{win:true}}),'dungeon');
 assert.equal(audioScene({result:{win:false}}),'home');
 assert.equal(audioScene({battle:{boss:true}}),'boss');
 assert.equal(audioScene({battle:{boss:true,outcome:'win',animating:false}}),'bossVictory');
 assert.equal(audioScene({battle:{outcome:'lose',animating:true}}),'battle');
 assert.equal(audioScene({battle:{outcome:'lose',animating:false}}),'defeat');
});
test('native PAL music and sound files exist and result cues do not loop',{skip:!existsSync(new URL('../public/themes/pal/',import.meta.url))&&'PAL assets are local-only; configure authorized resources to run this check'},()=>{
 assert.equal(new Set(Object.values(palAudio.music).map(t=>t.src)).size,7);
 for(const t of Object.values(palAudio.music)){assert.equal(t.archive,'MUS.MKF');assert.ok(t.duration>3);assert.ok(statSync(new URL('../public'+t.src,import.meta.url)).size>1000);}
 for(const scene of ['victory','bossVictory','defeat'])assert.equal(palAudio.music[scene].loop,false);
 for(const t of Object.values(palAudio.effects)){assert.equal(t.archive,'VOC.MKF');assert.ok(statSync(new URL('../public'+t.src,import.meta.url)).size>100);}
});
test('audio switches tracks, cancels voices, respects independent toggles, and pauses hidden tabs',async t=>{
 const oscillators=[],timers=new Map(),listeners={};let timerId=0;
 t.mock.method(globalThis,'setInterval',(fn)=>{timers.set(++timerId,fn);return timerId;});
 t.mock.method(globalThis,'clearInterval',id=>timers.delete(id));
 const originalWindow=globalThis.window,originalDocument=globalThis.document,originalAudio=globalThis.Audio,media=[];
 globalThis.Audio=class{constructor(src){this.src=src;this.paused=true;media.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}};
 globalThis.document={hidden:false,addEventListener:(name,fn)=>listeners[name]=fn};
 globalThis.window={AudioContext:class{
  currentTime=0;state='running';destination={};
  createOscillator(){const node={frequency:{},connect(){},disconnect(){},start(){},stop(time){if(time===undefined)this.cancelled=true;}};oscillators.push(node);return node;}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }};
 try{
  const {configureAudio,sound}=await import('../src/audio.js');
  const prefs={theme:'paper',music:true,effects:true};
  configureAudio(prefs,'home');assert.equal(timers.size,1);const home=[...oscillators];
  configureAudio(prefs,'home');assert.equal(oscillators.length,home.length,'unchanged preferences must not restart music');
  configureAudio(prefs,'battle');assert.ok(home.every(n=>n.cancelled));assert.equal(timers.size,1);
  const battle=oscillators.slice(home.length);configureAudio({...prefs,theme:'pal'},'battle');assert.ok(battle.every(n=>n.cancelled));
  assert.equal(timers.size,0,'native score replaces the synthesized loop');assert.equal(media.at(-1).src,palAudio.music.battle.src);
  const nativeBattle=media.at(-1);configureAudio({...prefs,theme:'pal'},'victory');assert.ok(nativeBattle.paused);assert.equal(media.at(-1).loop,false);
  sound('right');assert.equal(media.at(-1).src,palAudio.effects.weapon.src);
  configureAudio({...prefs,music:false},'victory');assert.equal(timers.size,0);assert.ok(oscillators.every(n=>n.cancelled));
  sound('win');const win=oscillators.slice(-4);assert.ok(win.every(n=>!n.cancelled),'effects play with music disabled');
  configureAudio({...prefs,music:false,effects:false},'victory');assert.ok(win.every(n=>n.cancelled));
  const count=oscillators.length;sound('lose');assert.equal(oscillators.length,count);
  configureAudio({...prefs,effects:false},'defeat');assert.equal(timers.size,1,'music plays with effects disabled');
  document.hidden=true;listeners.visibilitychange();assert.equal(timers.size,0);assert.ok(oscillators.every(n=>n.cancelled));
  document.hidden=false;listeners.visibilitychange();assert.equal(timers.size,1);
  configureAudio({music:false,effects:false});assert.equal(timers.size,0);
 }finally{globalThis.window=originalWindow;globalThis.document=originalDocument;globalThis.Audio=originalAudio;}
});
