import {getQuestion} from '../server/banks/starter.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAnswer,levelFor,subjects,difficulties} from '../src/game.js';

const initial=()=>({combo:0,correct:0,answered:0,monsterHP:100,playerHP:100,difficulty:'normal',shield:false});
test('all subjects and learning stages provide valid answer options',()=>{
 for(const subject of subjects)for(const grade of [0,1,2])for(const difficulty of Object.keys(difficulties))for(let i=0;i<12;i++){
  const q=getQuestion(subject.id,grade,difficulty,i);
  assert.ok(q.text&&q.explanation);
  assert.equal(q.options.filter(a=>a===q.answer).length,1);
  assert.equal(new Set(q.options).size,q.options.length);
  assert.equal(q.options.length,difficulty==='easy'?3:4);
 }
});
test('three consecutive correct answers enable bonus damage and record best combo',()=>{
 let b=initial();for(let i=0;i<3;i++)b=applyAnswer(b,true);
 assert.equal(b.monsterHP,15);assert.equal(b.combo,3);assert.equal(b.bestCombo,3);
 b=applyAnswer(b,false);assert.equal(b.combo,0);assert.equal(b.bestCombo,3);assert.equal(b.playerHP,80);
 b=applyAnswer(b,true);assert.equal(b.outcome,'win');assert.equal(b.monsterHP,0);
});
test('wrong answers exhaust player health and end combat',()=>{
 let b=initial();for(let i=0;i<5;i++)b=applyAnswer(b,false);
 assert.equal(b.playerHP,0);assert.equal(b.outcome,'lose');assert.equal(b.correct,0);
});
test('shield absorbs exactly one incorrect answer',()=>{
 let b={...initial(),shield:true};b=applyAnswer(b,false);
 assert.equal(b.playerHP,100);assert.equal(b.shield,false);
 b=applyAnswer(b,false);assert.equal(b.playerHP,80);
});
test('experience levels advance at exact thresholds',()=>{
 assert.equal(levelFor(0),1);assert.equal(levelFor(99),1);assert.equal(levelFor(100),2);assert.equal(levelFor(250),3);
});
