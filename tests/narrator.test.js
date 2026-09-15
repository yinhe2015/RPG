import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNarrator,speechText} from '../src/learning/narrator.js';

test('optional narration picks the chosen language/voice and cancels old sentence queues',()=>{
 const spoken=[],voices=[{voiceURI:'zh',lang:'zh-CN'},{voiceURI:'en',lang:'en-US'}];let cancelled=0;
 const narrator=createNarrator({speechSynthesis:{getVoices:()=>voices,cancel(){cancelled++;},speak(u){spoken.push(u);}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}});
 assert.ok(narrator.supported);narrator.speak('First sentence. Second sentence.','en-US','');assert.equal(spoken[0].voice.voiceURI,'en');assert.equal(spoken[0].lang,'en-US');
 const old=spoken[0];narrator.speak('新回答。','zh-CN','zh');assert.equal(spoken.at(-1).lang,'zh-CN');assert.equal(spoken.at(-1).voice.voiceURI,'zh');
 const count=spoken.length;old.onend();assert.equal(spoken.length,count);narrator.stop();spoken.at(-1).onend();assert.equal(spoken.length,count);assert.ok(cancelled>=3);
 assert.equal(createNarrator({}).supported,false);assert.equal(createNarrator({}).speak('x','en-US',''),false);
 assert.equal(speechText('$x^2$','zh-CN'),'x的平方');
});
