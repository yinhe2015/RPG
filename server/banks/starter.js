import {getBank} from './registry.js';

export function shuffle(list){
 const result=[...list];
 for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 return result;
}

// Parameterized questions are a provider, not part of battle rules or UI code.
export function mathQuestion(grade,difficulty){
 const n=()=>Math.floor(Math.random()*(difficulty==='hard'?18:difficulty==='easy'?5:9))+2;
 const a=n(),b=n();let answer,text,explanation;
 if(grade===0){answer=a*b;text=`${a} × ${b} = ?`;explanation=`${a} × ${b} = ${answer}。乘法表示 ${a} 个 ${b} 相加。`;}
 else if(grade===1){answer=b;text=`解方程：${a}x + ${a+2} = ${a*b+a+2}，x = ?`;explanation=`先两边减去 ${a+2}，得 ${a}x = ${a*b}，再除以 ${a}，所以 x = ${b}。`;}
 else{answer=(a+b)**2;text=`已知 a = ${a}，b = ${b}，求 a² + 2ab + b²。`;explanation=`由完全平方公式 (a + b)² = (${a} + ${b})² = ${answer}。`;}
 const name=['乘法运算','一元一次方程','完全平方公式'][grade];
 return {id:`math-${grade}-${a}-${b}`,type:'choice',subject:'math',grade,difficulty,text,answer:String(answer),options:shuffle([answer,answer+1,answer-2,...(difficulty==='easy'?[]:[answer+a])].map(String)),explanation,knowledgePoint:{id:`math:${name}`,name},hint:'先辨认运算顺序，再把问题拆成几个小步骤。'};
}

export function getQuestion(subject,grade,difficulty,index=0){
 if(subject==='math')return mathQuestion(grade,difficulty);
 const entries=getBank('starter').questions.filter(q=>q.subject===subject&&q.grade===grade&&q.type==='choice');
 const q=entries[index%entries.length];
 return {...q,options:shuffle([q.answer,...q.options.filter(o=>o!==q.answer).slice(0,difficulty==='easy'?2:3)])};
}
