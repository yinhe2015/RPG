import {audioForTheme,audioSceneFor} from './themes/audio-profiles.js';

let audioContext=null,musicTimer=null,noteIndex=0,trackKey='';
let profile={music:false,effects:true},scene='home';
let musicPlayer=null;
const effectPlayers=new Set();
const voices={music:new Set(),effects:new Set()};
export function configureAudio(preferences,nextScene='home'){
 const oldTheme=profile.theme;profile={...preferences};scene=typeof nextScene==='boolean'?(nextScene?'battle':'home'):nextScene;
 if(!profile.effects||oldTheme!==profile.theme){stopVoices('effects');for(const player of effectPlayers)player.pause();effectPlayers.clear();}
 setMusic();
}
export function initAudio(){
 try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}
 // Retry a browser-blocked play on the next user gesture; never restart a finished fanfare.
 if(musicPlayer?.paused&&!musicPlayer.ended&&profile.music&&!document.hidden)musicPlayer.play().catch(()=>{});
}
function stopVoices(bus){for(const voice of voices[bus]){try{voice.stop();}catch{}voice.disconnect();}voices[bus].clear();}
function tone(midi,duration,type,volume,delay=0,bus='effects'){
 if(!audioContext||!midi)return;
 const t=audioContext.currentTime+delay,o=audioContext.createOscillator(),g=audioContext.createGain();
 o.type=type;o.frequency.value=440*2**((midi-69)/12);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
 o.connect(g);g.connect(audioContext.destination);voices[bus].add(o);
 o.onended=()=>{voices[bus].delete(o);o.disconnect();g.disconnect();};o.start(t);o.stop(t+duration);
}
export function sound(kind){
 if(!profile.effects||document.hidden)return;initAudio();
 const style=audioForTheme(profile.theme),effect=style.effects[kind];
 if(style.mutedEffects.includes(kind))return;
 if(effect){
  const player=new Audio(effect.src);player.volume=effect.volume??.38;effectPlayers.add(player);
  const done=()=>effectPlayers.delete(player);player.onended=done;player.onerror=done;player.play().catch(done);return;
 }
 const phrases={click:[0],step:[-24],right:[0,4,7],wrong:[-7,-13],win:[0,4,7,12],lose:[0,-3,-7,-12],encounter:[-12,-5,0,-1]};
 const phrase=phrases[kind]||phrases.click,short=kind==='step'||kind==='click';
 phrase.forEach((n,i)=>tone(style.effectRoot+n,short?.065:.3,style.effectWave,style.effectWave==='square'?.012:.035,i*(short?.03:.1)));
}
export function setMusic(){
 const style=audioForTheme(profile.theme),theme=style.id;
 const currentScene=audioSceneFor(style,scene);
 const key=profile.music&&!document.hidden?`${theme}:${currentScene}`:'';
 // Preference saves and UI interactions should not restart the current phrase.
 if(key===trackKey)return;
 clearInterval(musicTimer);musicTimer=null;stopVoices('music');trackKey=key;noteIndex=0;
 if(musicPlayer){musicPlayer.pause();musicPlayer.removeAttribute('src');musicPlayer.load();musicPlayer=null;}
 if(key&&style.music[currentScene]){
  const track=style.music[currentScene];musicPlayer=new Audio(track.src);musicPlayer.loop=Boolean(track.loop);musicPlayer.volume=track.volume??.5;musicPlayer.preload='auto';
  musicPlayer.play().catch(()=>{});return;
 }
 if(!key)return;initAudio();if(!audioContext){trackKey='';return;}
 const track=style.tracks[currentScene],beat=30/track.bpm;
 const play=()=>{
  const n=noteIndex++%track.melody.length;
  tone(track.melody[n],beat*style.release,style.lead,.025,0,'music');
  if(n%4===0){
   const root=track.bass[Math.floor(n/4)%track.bass.length];
   tone(root,beat*3.8,style.backing,.022,0,'music');
   tone(root+7,beat*3,style.backing,.009,beat*.15,'music');
  }
  if(currentScene==='battle'&&n%2===0)tone(track.bass[Math.floor(n/4)%track.bass.length]-12,.09,'triangle',.028,0,'music');
 };
 play();musicTimer=setInterval(play,beat*1000);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopVoices('effects');for(const player of effectPlayers)player.pause();effectPlayers.clear();}setMusic();});
