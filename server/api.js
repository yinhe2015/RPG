import {randomBytes,randomUUID} from 'node:crypto';
import {createQuestion,gradeObjective} from './questions.js';
import {gradeWithDeepseek,readApiKey,MODEL} from './deepseek.js';
import {createAccountStore} from './accounts.js';
import {applyAnswer,difficulties} from '../src/game.js';
import {listBanks,getBank} from './banks/registry.js';
import {generateDungeon,moveInDungeon,applyDungeonBattle,publicDungeon} from './dungeons.js';
import {rollAction} from '../src/combat-cards.js';
import {tutorWithDeepseek} from './tutor.js';
import {createLearningService} from './learning.js';

const messages={
 EMPTY_TUTOR_REPLY:'老师暂时没有返回内容，请重试。你的输入已保留。',STREAM_INTERRUPTED:'回复途中连接中断，未完成的回复没有保存。请重试。',REPLY_TOO_LONG:'这次回复过长，请让老师分步讲解。你的输入已保留。',
 INVALID_LESSON:'请选择老师、学科和学段，并填写知识点（120 字内）或回答（2000 字内）。',LESSON_MISSING:'这段学习记录不存在或已超过保留范围，请重新选择。',LESSON_REFERENCE_MISSING:'这道错题不存在或已超过保留范围，请重新选择。',LEARNING_BUSY:'老师正在回复，请稍候。',LESSON_CHANGED:'这段对话已在别处更新，请重新打开记录后继续。',LESSON_FULL:'本次对话已达到 40 轮，请新开一次学习。已有记录已保存。',INVALID_TUTOR_REPLY:'老师这次的回复不完整，请重试。你的输入已保留。',
 DUNGEON_MISSING:'这段迷宫已结束或服务已重启，请重新进入迷宫。',DUNGEON_FINISHED:'本次探索已结束，可以开始新的迷宫。',DUNGEON_ACTIVE:'先离开当前迷宫，再开始新的探险。',INVALID_MOVE:'无法向这个方向移动。',
 INVALID_DISPLAY_NAME:'名字需为 1～32 个字符，不能包含换行、控制字符或尖括号。',
 BANK_TYPE:'这个题库不支持所选题型，请在设置中选择它提供的题型。',
 BANK_MISSING:'所选题库已移除，请在设置中选择其他题库。',BANK_EMPTY:'这个题库暂时没有符合当前学科、学段和难度的题目，请换一个题库或学段。',
 INVALID_USERNAME:'账号需为 2～32 个字符，可使用中文、字母、数字、下划线、点和连字符。',
 INVALID_PASSWORD:'密码长度需要为 4～128 个字符。',INVALID_CREDENTIALS:'请输入账号和密码。',
 USERNAME_TAKEN:'这个账号已经注册了，请换一个，或直接登录。',LOGIN_FAILED:'账号或密码不正确。',
 LOGIN_REQUIRED:'请先登录，再继续冒险。',ACCOUNT_STORAGE:'账号文件暂时无法读写，请稍后重试。已有存档不会被覆盖。',
 KEY_MISSING:'判卷服务尚未配置密钥。你的答案已保留，可以稍后重试或换一道题。',
 KEY_REJECTED:'判卷服务暂时无法认证。你的答案已保留，本次不会扣血。',BALANCE:'判卷服务额度不足。你的答案已保留，本次不会扣血。',
 RATE_LIMIT:'判卷服务有些忙，请稍等再试。你的答案已保留。',INVALID_GRADING:'这次判卷结果不完整，请重试。本次不会扣血。',
 BATTLE_MISSING:'本场战斗已结束或失效，请返回营地重新开始。',QUESTION_MISSING:'这道题已失效，请重新连接或换题。本次不会扣血。',
 BATTLE_BUSY:'正在处理这道题，请稍等。',SKILL_UNAVAILABLE:'这个技能尚未就绪或本场已经用过。',INVALID_QUESTION:'题目设置不正确，请重新开始。',
};
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
export function blockPrivateFiles(req,res,next){
 let path;try{path=decodeURIComponent(req.url).toLowerCase();}catch{json(res,400,{error:'无效地址'});return;}
 if(/apikey|(?:\/|%2f)\.env|\/server(?:\/|\.|%2f)|vite\.config|\/data(?:\/|%2f)|\/question-banks(?:\/|%2f)|^\/pal(?:\/|%2f)|accounts\.json/.test(path)){json(res,404,{error:'Not found'});return;}next();
}
async function readBody(req){
 let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>40000)throw new Error('BODY_TOO_LARGE');}
 try{const value=JSON.parse(body);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new Error('BAD_JSON');}
}
const publicBattle=b=>Object.fromEntries(['id','subject','grade','difficulty','questionType','questionBank','pace','playerHP','monsterHP','maxHP','combo','bestCombo','correct','answered','round','shield','shieldUsed','hintUsed','calcReadyAt','outcome','dungeonId','monsterId','boss','encounterPoint','variant','combatLevel','cards','lastAction'].map(k=>[k,b[k]]));
const publicQuestion=(id,q)=>({id,type:q.type,text:q.text,options:q.options,knowledgePoint:q.knowledgePoint,bankName:q.bankName,maxLength:q.type==='fill'?100:2000});

export function createApiMiddleware({aiGrader=gradeWithDeepseek,aiTutor=tutorWithDeepseek,accountStore=createAccountStore(),now=()=>Date.now(),random=Math.random}={}){
 const learning=createLearningService(accountStore,aiTutor);
 const dungeons=new Map();
 const questions=new Map(),battles=new Map(),sessions=new Map(),rates=new Map();let gradingCount=0;
 function loginSession(res,user){const token=randomBytes(32).toString('hex');sessions.set(token,{userId:user.id,expires:now()+7*86400000});res.setHeader('Set-Cookie',`quest_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`);}
 function ownedBattle(id,user){const b=battles.get(id);if(!b||b.userId!==user.id||b.cancelled)throw new Error('BATTLE_MISSING');return b;}
 async function settle(b){if(b.outcome&&!b.settlement)b.settlement=await accountStore.settle(b.userId,b);return b.settlement;}
 async function processGrade(entry,b,answer){
  entry.answer??=answer;answer=entry.answer;
  if(!entry.result){
   if(entry.question.type==='choice'||entry.question.type==='fill')entry.result=gradeObjective(entry.question,answer);
   else{if(gradingCount>=6)throw new Error('RATE_LIMIT');gradingCount++;try{entry.result=await aiGrader(entry.question,answer);}finally{gradingCount--;}}
  }
  if(b.cancelled)throw new Error('BATTLE_MISSING');
  if(!entry.result.correct&&!entry.mistakeSaved){
   const q=entry.question;
   await accountStore.recordMistake(b.userId,{id:b.questionId,subject:b.subject,grade:b.grade,knowledgePoint:q.knowledgePoint,text:q.text,options:q.options||[],type:q.type,bankName:q.bankName,studentAnswer:answer,reference:entry.result.reference,explanation:entry.result.explanation,date:new Date(now()).toISOString()});entry.mistakeSaved=true;
  }
  if(!entry.applied){const blocked=!entry.result.correct&&b.shield;Object.assign(b,applyAnswer(b,entry.result.correct,rollAction(b,entry.result.correct,random)));entry.blocked=blocked;entry.applied=true;}
  const settlement=await settle(b);
  const dungeon=b.dungeonId?dungeons.get(b.userId):null;if(dungeon&&dungeon.id===b.dungeonId&&b.outcome)applyDungeonBattle(dungeon,b);
  return {...entry.result,...(dungeon?{dungeon:publicDungeon(dungeon)}:{}),blocked:entry.blocked,battle:publicBattle(b),settlement};
 }
 function snapshot(d){
  const b=d?.battleId?battles.get(d.battleId):null,entry=b?questions.get(b.questionId):null;
  return {dungeon:publicDungeon(d),encounter:b&&!b.cancelled?{battle:publicBattle(b),question:entry?publicQuestion(b.questionId,entry.question):null,feedback:entry?.response||null,settlement:b.settlement||null}:null};
 }
 function dungeonBattle(d,m,user,time){
  const questionCount=getBank(d.questionBank).questions.filter(q=>q.subject===d.subject&&q.grade===d.grade&&q.knowledgePoint.id===m.knowledgePoint.id&&q.difficulties.includes(d.difficulty)).length||(d.questionBank==='starter'&&d.subject==='math'?100:1);
  const baseHP=Math.round(difficulties[d.difficulty].hp*(m.boss?1.7:.7)/5)*5;
  const hp=m.boss?baseHP:Math.min(baseHP,Math.max(25,questionCount*25));
  const b={id:randomUUID(),userId:user.id,created:time,subject:d.subject,grade:d.grade,difficulty:d.difficulty,questionBank:d.questionBank,questionType:d.questionType,pace:d.pace,
   dungeonId:d.id,monsterId:m.id,boss:m.boss,encounterPoint:m.knowledgePoint,variant:m.variant,playerHP:d.hp,monsterHP:hp,maxHP:hp,combo:0,bestCombo:0,correct:0,answered:0,round:0,shield:false,shieldUsed:false,hintUsed:false,calcReadyAt:time+20000,outcome:null};
  b.combatLevel=user.level;b.cards=structuredClone(user.cards||{});
  battles.set(b.id,b);d.battleId=b.id;return b;
 }
 return async(req,res,next)=>{
  const pathname=req.url.split('?')[0];if(!pathname.startsWith('/api/'))return next();
  const origin=req.headers.origin;
  if(req.headers['sec-fetch-site']==='cross-site'||(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)){json(res,403,{error:'请从游戏页面访问。'});return;}
  const time=now();
  for(const [id,d]of dungeons)if(time-d.created>86400000)dungeons.delete(id);
  for(const [id,q]of questions)if(time-q.created>86400000)questions.delete(id);
  for(const [id,b]of battles)if(time-b.created>86400000)battles.delete(id);
  for(const [id,s]of sessions)if(time>s.expires)sessions.delete(id);
  for(const [ip,r]of rates)if(time-r.start>60000)rates.delete(ip);
  const authRoute=['/api/auth/login','/api/auth/register'].includes(pathname);
  const rateKey=(req.socket.remoteAddress||'local')+(authRoute?':auth':pathname==='/api/dungeon/move'?':move':':api');
  const rate=rates.get(rateKey)||{start:time,count:0};rate.count++;rates.set(rateKey,rate);
  if(rate.count>(authRoute?20:pathname==='/api/dungeon/move'?1200:180)){json(res,429,{error:'操作有些频繁，请稍后再试。'});return;}
  const token=req.headers.cookie?.match(/(?:^|;\s*)quest_auth=([a-f0-9]{64})(?:;|$)/)?.[1];
  try{
   if(req.method==='GET'&&pathname==='/api/status'){json(res,200,{configured:await readApiKey().then(()=>true,()=>false),model:MODEL});return;}
   if(req.method==='POST'&&authRoute){
    const body=await readBody(req),user=pathname.endsWith('register')?await accountStore.register(body):await accountStore.login(body);
    if(token)sessions.delete(token);loginSession(res,user);json(res,200,{user});return;
   }
   if(req.method==='POST'&&pathname==='/api/auth/logout'){sessions.delete(token);res.setHeader('Set-Cookie','quest_auth=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');json(res,200,{ok:true});return;}
   const session=sessions.get(token),user=session?await accountStore.get(session.userId):null;
   if(!user){json(res,401,{error:messages.LOGIN_REQUIRED});return;}
   if(req.method==='GET'&&pathname==='/api/auth/me'){json(res,200,{user});return;}
   if(req.method==='GET'&&pathname==='/api/learning/current'){json(res,200,await learning(user,'current'));return;}
   if(req.method==='POST'&&['/api/learning/start','/api/learning/chat'].includes(pathname)){
    const body=await readBody(req),stream=req.headers.accept?.includes('text/event-stream'),controller=new AbortController();let heartbeat;
    const stop=()=>{if(!res.writableEnded)controller.abort();};res.once('close',stop);
    const emit=(event,value)=>{
     if(res.destroyed)return;
     if(!res.headersSent){res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': keep-alive\n\n');},15000);heartbeat.unref();}
     res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
    };
    try{const result=await learning(user,pathname.split('/').at(-1),body,{signal:controller.signal,onEvent:stream?emit:undefined});if(!res.destroyed){if(stream){emit('done',result);res.end();}else json(res,200,result);}}
    finally{clearInterval(heartbeat);res.off('close',stop);}return;
   }
   if(req.method==='GET'&&pathname==='/api/question-banks'){json(res,200,{banks:listBanks()});return;}
   if(req.method==='GET'&&pathname==='/api/dungeon/current'){json(res,200,snapshot(dungeons.get(user.id)));return;}
   const routes=['/api/dungeon/start','/api/dungeon/move','/api/dungeon/continue','/api/dungeon/leave','/api/profile/settings','/api/profile/rename','/api/battle/start','/api/battle/leave','/api/battle/skill','/api/question','/api/grade','/api/hint'];
   if(req.method!=='POST'||!routes.includes(pathname)){json(res,404,{error:'接口不存在'});return;}
   const body=await readBody(req);
   if(pathname==='/api/profile/rename'){json(res,200,{user:await accountStore.rename(user.id,body.displayName)});return;}
   if(pathname==='/api/profile/settings'){json(res,200,{user:await accountStore.preferences(user.id,body)});return;}
   if(pathname==='/api/dungeon/start'){
    const previous=dungeons.get(user.id);if(previous?.status==='active')throw Error('DUNGEON_ACTIVE');
    const settings={subject:body.subject??user.subject,grade:body.grade??user.grade,difficulty:body.difficulty??user.difficulty,questionType:body.questionType??user.questionType,questionBank:body.questionBank??user.questionBank,pace:[0,300,600].includes(body.pace)?body.pace:user.pace};
    const d=generateDungeon(settings);d.created=time;dungeons.set(user.id,d);json(res,200,snapshot(d));return;
   }
   if(pathname.startsWith('/api/dungeon/')){
    const d=dungeons.get(user.id);if(!d||d.id!==body.dungeonId)throw Error('DUNGEON_MISSING');
    const active=d.battleId?battles.get(d.battleId):null;
    if(pathname==='/api/dungeon/leave'){
     if(active&&questions.get(active.questionId)?.pending)throw Error('BATTLE_BUSY');
     if(active&&!active.outcome)active.cancelled=true;dungeons.delete(user.id);json(res,200,{dungeon:null});return;
    }
    if(pathname==='/api/dungeon/continue'){
     if(active&&!active.outcome&&!active.cancelled)throw Error('BATTLE_BUSY');d.battleId=null;json(res,200,snapshot(d));return;
    }
    if(active&&!active.cancelled){json(res,200,snapshot(d));return;}
    const moved=moveInDungeon(d,body.direction,body.step);if(moved.monster)dungeonBattle(d,moved.monster,user,time);
    json(res,200,{...snapshot(d),blocked:Boolean(moved.blocked),healed:Boolean(moved.healed)});return;
   }
   if(pathname==='/api/battle/start'){
    const settings={subject:body.subject??user.subject,grade:body.grade??user.grade,difficulty:body.difficulty??user.difficulty,type:body.questionType??user.questionType,questionBank:body.questionBank??user.questionBank};
    createQuestion(settings);
    const b={id:randomUUID(),userId:user.id,created:time,...settings,questionType:settings.type,pace:[0,300,600].includes(body.pace)?body.pace:user.pace,
     playerHP:100,monsterHP:difficulties[settings.difficulty].hp,maxHP:difficulties[settings.difficulty].hp,combo:0,bestCombo:0,correct:0,answered:0,round:0,shield:false,shieldUsed:false,hintUsed:false,calcReadyAt:time+20000,outcome:null};
    b.combatLevel=user.level;b.cards=structuredClone(user.cards||{});
    if(battles.size>=2000)battles.delete(battles.keys().next().value);battles.set(b.id,b);json(res,200,{battle:publicBattle(b)});return;
   }
   if(pathname==='/api/battle/leave'){const b=ownedBattle(body.battleId,user);if(b.outcome){await settle(b);json(res,200,{settlement:b.settlement});}else{if(questions.get(b.questionId)?.pending)throw Error('BATTLE_BUSY');b.cancelled=true;const d=dungeons.get(user.id);if(d?.battleId===b.id)d.battleId=null;json(res,200,{ok:true,dungeon:publicDungeon(d)});}return;}
   if(pathname==='/api/question'){
    const b=ownedBattle(body.battleId,user);if(b.outcome)throw new Error('BATTLE_MISSING');
    const current=questions.get(b.questionId);
    if(current?.pending)throw new Error('BATTLE_BUSY');
    if(current&&!current.applied&&!body.swap){json(res,200,publicQuestion(b.questionId,current.question));return;}
    if(current){b.round++;questions.delete(b.questionId);}
    const q=createQuestion({subject:b.subject,grade:b.grade,difficulty:b.difficulty,type:body.swap?'choice':b.questionType,round:b.round,questionBank:b.questionBank,exclude:b.usedQuestions||[],knowledgePointId:b.boss?undefined:b.encounterPoint?.id}),id=randomUUID();
    b.usedQuestions=[...(b.usedQuestions||[]),q.id].slice(-100);
    questions.set(id,{question:q,created:time,battleId:b.id,userId:user.id});b.questionId=id;json(res,200,publicQuestion(id,q));return;
   }
   if(pathname==='/api/battle/skill'){
    const b=ownedBattle(body.battleId,user);if(b.outcome||questions.get(b.questionId)?.pending)throw new Error('BATTLE_BUSY');
    if(body.skill==='shield'){if(user.level<2||b.shieldUsed)throw new Error('SKILL_UNAVAILABLE');b.shield=true;b.shieldUsed=true;}
    else if(body.skill==='calculator'){if(time<b.calcReadyAt)throw new Error('SKILL_UNAVAILABLE');b.calcReadyAt=time+45000;}
    else throw new Error('SKILL_UNAVAILABLE');json(res,200,{battle:publicBattle(b)});return;
   }
   const entry=questions.get(body.questionId);if(!entry||entry.userId!==user.id)throw new Error('QUESTION_MISSING');
   const b=ownedBattle(entry.battleId,user),q=entry.question;
   if(pathname==='/api/hint'){
    if(entry.hint){json(res,200,entry.hint);return;}
    if(user.level<3||b.hintUsed||entry.applied||entry.pending||b.outcome)throw new Error('SKILL_UNAVAILABLE');
    b.hintUsed=true;entry.hint={hint:q.hint,eliminated:q.options?.filter(a=>a!==q.answer).slice(0,2),battle:publicBattle(b)};json(res,200,entry.hint);return;
   }
   if(typeof body.answer!=='string'||!body.answer.trim()||body.answer.length>(q.type==='fill'?100:2000)){json(res,400,{error:'请先写下你的答案，并控制在字数限制内。'});return;}
   if(q.type==='choice'&&!q.options.includes(body.answer)){json(res,400,{error:'请选择题目中的选项。'});return;}
   if(entry.response){json(res,200,entry.response);return;}
   if(entry.pending){json(res,200,await entry.pending);return;}
   entry.pending=processGrade(entry,b,body.answer);
   try{entry.response=await entry.pending;json(res,200,entry.response);}finally{entry.pending=null;}
  }catch(error){
   if(pathname.startsWith('/api/learning/')){
    const learningErrors={KEY_MISSING:'学习老师尚未配置密钥，请配置后重试。',KEY_REJECTED:'学习老师暂时无法连接模型，请检查密钥后重试。',BALANCE:'学习老师的模型额度不足，请补充后重试。',RATE_LIMIT:'老师有些忙，请稍等再试。'};
    const status=error.message==='INVALID_LESSON'?400:['LESSON_MISSING','LESSON_REFERENCE_MISSING'].includes(error.message)?404:['LEARNING_BUSY','LESSON_CHANGED','LESSON_FULL'].includes(error.message)?409:503;
    const body={error:learningErrors[error.message]||messages[error.message]||'老师暂时没有回复。你的输入已保留，请稍后重试。'};
    if(!res.destroyed){if(res.headersSent){res.write(`event: error\ndata: ${JSON.stringify(body)}\n\n`);res.end();}else json(res,status,body);}return;
   }
   const badRequest=['INVALID_MOVE','DUNGEON_FINISHED','BANK_TYPE','INVALID_USERNAME','INVALID_PASSWORD','INVALID_CREDENTIALS','INVALID_DISPLAY_NAME','INVALID_QUESTION','BAD_JSON','BODY_TOO_LARGE'].includes(error.message);
   const status=badRequest?400:error.message==='USERNAME_TAKEN'?409:error.message==='LOGIN_FAILED'||error.message==='LOGIN_REQUIRED'?401:['DUNGEON_MISSING','BATTLE_MISSING','QUESTION_MISSING'].includes(error.message)?404:['DUNGEON_ACTIVE','SKILL_UNAVAILABLE','BATTLE_BUSY'].includes(error.message)?409:503;
   json(res,status,{error:messages[error.message]||(badRequest?'请求内容不正确，请重试。':'暂时没能完成操作，请重试。你的答案已保留。')});
  }
 };
}
