import {teachers} from '../src/learning/teachers.js';
import {subjects} from '../src/game.js';
import {banks} from './banks/registry.js';
import {validateTutorReply} from './tutor.js';
import {languages} from '../src/learning/languages.js';

export function createLearningService(store,tutor){
 const pending=new Set();let active=0;
 const catalog=[...new Map([...banks.values()].flatMap(b=>b.questions.map(q=>({subject:q.subject,grade:q.grade,name:q.knowledgePoint.name}))).map(p=>[`${p.subject}:${p.grade}:${p.name}`,p])).values()];
 return async(user,action,body={},options={})=>{
  if(action==='current')return {...await store.learning(user.id),topics:catalog};
  if(pending.has(user.id))throw Error('LEARNING_BUSY');
  if(active>=6)throw Error('RATE_LIMIT');
  if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Error('INVALID_LESSON');
  pending.add(user.id);active++;
  try{
   const saved=await store.learning(user.id);
   let lesson,text='';
   if(action==='start'){
    const previous=saved.sessions.find(s=>s.startRequestId===body.requestId);if(previous)return {session:previous};
    if(!teachers.some(t=>t.id===body.teacherId))throw Error('INVALID_LESSON');
    const reference=body.mistakeId?saved.mistakes.find(m=>m.id===body.mistakeId):null;
    if(body.mistakeId&&!reference)throw Error('LESSON_REFERENCE_MISSING');
    const subject=reference?.subject||body.subject,grade=reference?.grade??body.grade,topic=reference?.knowledgePoint?.name||body.topic;
    if(!subjects.some(s=>s.id===subject)||![0,1,2].includes(grade)||typeof topic!=='string'||!topic.trim()||topic.length>120)throw Error('INVALID_LESSON');
    lesson={id:body.requestId,startRequestId:body.requestId,teacherId:body.teacherId,subject,grade,topic:topic.trim(),reference,messages:[],createdAt:new Date().toISOString()};
   }else{
    lesson=saved.sessions.find(s=>s.id===body.sessionId);if(!lesson)throw Error('LESSON_MISSING');
    if(lesson.messages.some(m=>m.requestId===body.requestId))return {session:lesson};
    if(lesson.messages.length>=81)throw Error('LESSON_FULL');
    if(body.version!==lesson.messages.length)throw Error('LESSON_CHANGED');
    if(typeof body.text!=='string'||!body.text.trim()||body.text.length>2000)throw Error('INVALID_LESSON');
    text=body.text.trim();
   }
   if(body.language!==undefined&&!languages.some(l=>l.id===body.language))throw Error('INVALID_LESSON');
   lesson.language=body.language||lesson.language||'zh-CN';
   options.onEvent?.('ready',{session:lesson});
   const reply=validateTutorReply(await tutor(lesson,text,{signal:options.signal,onDelta:delta=>options.onEvent?.('delta',{text:delta})})),date=new Date().toISOString();
   options.signal?.throwIfAborted();
   if(text)lesson.messages.push({role:'user',content:text,date});
   lesson.messages.push({role:'assistant',content:reply.message,requestId:body.requestId,date,language:lesson.language,truncated:reply.truncated});
   Object.assign(lesson,{focus:reply.focus,summary:reply.summary,stage:reply.stage,quickReplies:reply.quickReplies,updatedAt:date});
   return {session:await store.saveLesson(user.id,lesson)};
  }finally{pending.delete(user.id);active--;}
 };
}
