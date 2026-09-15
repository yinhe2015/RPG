export function speechText(text,language){
 return String(text).replace(/\$\$?|\\[()[\]]/g,'').replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,language==='en-US'?'$1 over $2':'$1 除以 $2').replace(/\^(?:\{2\}|2(?!\d))/g,language==='en-US'?' squared ':'的平方').replace(/\\(?:times|cdot)\b/g,language==='en-US'?' times ':' 乘以 ').replace(/\\[a-zA-Z]+/g,' ').replace(/[{}*_#`]/g,'').replace(/<[^>]*>/g,'').trim();
}
export function createNarrator(environment=globalThis){
 const synth=environment.speechSynthesis,Utterance=environment.SpeechSynthesisUtterance;
 let generation=0;
 return {
  supported:Boolean(synth&&Utterance),
  voices:()=>synth?.getVoices()||[],
  stop(){generation++;synth?.cancel();},
  speak(text,language,voiceURI,onError=()=>{}){
   if(!synth||!Utterance)return false;
   this.stop();const owner=generation,lang=language==='en-US'?'en-US':'zh-CN';
   const voices=this.voices(),voice=voices.find(v=>v.voiceURI===voiceURI)||voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2)));
   const chunks=speechText(text,language).match(/[^。！？.!?\n]{1,160}[。！？.!?\n]?/g)||[];
   const next=()=>{if(owner!==generation||!chunks.length)return;const utterance=new Utterance(chunks.shift());utterance.lang=lang;if(voice)utterance.voice=voice;utterance.rate=.95;utterance.onend=next;utterance.onerror=event=>{if(owner===generation&&!['canceled','interrupted'].includes(event.error))onError();};synth.speak(utterance);};
   next();return true;
  },
 };
}
