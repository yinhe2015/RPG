import './style.css';
import {icon} from './art.js';
import {subjects, difficulties, levelFor} from './game.js';
import {configureAudio, initAudio, sound} from './audio.js';
import {audioScene} from './themes/soundtracks.js';
import {calculate} from './calculator.js';
import {createViews} from './ui/views.js';
import {applyTheme,getTheme} from './themes/registry.js';
import {esc} from './ui/html.js';
import {profileText} from './profile-text.js';
import {reconcileBankPreferences} from './bank-preferences.js';
import {playBattleMotion} from './ui/battle-motion.js';
import {dungeonView,syncDungeon,positionCamera,routeTo} from './ui/dungeon.js';
import {createRequestSignal} from './request-signal.js';

async function bootstrap(){
 authState='loading';render();
 try{const response=await fetch('/api/auth/me');if(response.status===401){authState='ready';render();return;}if(!response.ok)throw Error();const data=await response.json();setAccount(data.user);await restoreDungeon();render();}
 catch{authState='error';render();}
}
async function authenticate(form){
 if(authBusy)return;authUsername=form.elements.username.value;
 const password=form.elements.password.value;
 if(authMode==='register'&&password!==form.elements.confirm.value){$('#auth-error').textContent='两次输入的密码不一致。';return;}
 const importing=authMode==='register'&&Boolean(form.elements.importLegacy?.checked);
 authBusy=true;const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='正在进入…';
 try{const data=await api(`auth/${authMode}`,{username:authUsername,password,...(importing?{legacyProgress:old}:{})});
  if(importing){try{localStorage.removeItem(SAVE_KEY);}catch{}old={};}
  setAccount(data.user);await restoreDungeon();render();
 }catch(error){authError=error.message;if($('#auth-error'))$('#auth-error').textContent=authError;}
 finally{authBusy=false;if(submit.isConnected){submit.disabled=false;submit.innerHTML=`${authMode==='register'?'注册并开始':'登录，继续冒险'} ${icon('arrow',18)}`;}}
}
async function logout(){
 if(authBusy)return;authBusy=true;
 try{await saveQueue;if(dungeon){await leaveDungeon();if(dungeon)return;}if(battle){await quitBattle();if(battle)return;}await api('auth/logout',{});
  closeDialog();account=null;result=null;authMode='login';authUsername='';authError='';authState='ready';Object.assign(profile,defaults);configureAudio({music:false,effects:false},false);render();
 }catch(error){toast(error.message);}finally{authBusy=false;}
}
async function useSkill(skill){
 const b=battle;if(!b?.id||b.grading||b.feedback||b.loading||b.skillPending)return;
 b.skillPending=true;
 try{const data=await api('battle/skill',{battleId:b.id,skill},b.controller.signal);if(battle!==b)return;Object.assign(b,{shield:data.battle.shield,shieldUsed:data.battle.shieldUsed,calcReadyAt:data.battle.calcReadyAt});sound('click');
  if(skill==='calculator'){calculatorOpen=true;calcInput='';renderCalculator();tick();}else render();
 }catch(error){if(battle===b)toast(error.message);}finally{b.skillPending=false;}
}

const $=s=>document.querySelector(s), SAVE_KEY='subject-quest-v1';
const gradeNames=['小学','初中','高中'];
const typeNames={mixed:'混合题型',choice:'选择题',fill:'填空题',short:'简答题',open:'开放题'};
const defaults={xp:0,wins:0,correct:0,battles:0,bestCombo:0,dungeonClears:0,defeated:[],history:[],cards:{},music:false,effects:true,grade:1,difficulty:'normal',subject:'math',questionType:'mixed',pace:0,theme:'paper',themeAccent:'',reducedMotion:false,questionBank:'starter'};
let old={};try{old=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{};}catch{}
const profile={...defaults};
let account=null,authState='loading',authMode='login',authBusy=false,authError='',authUsername='',saveQueue=Promise.resolve();
if(!subjects.some(s=>s.id===profile.subject))profile.subject='math';
if(!difficulties[profile.difficulty])profile.difficulty='normal';
if(![0,1,2].includes(profile.grade))profile.grade=1;
if(!typeNames[profile.questionType])profile.questionType='mixed';
if(![0,300,600].includes(profile.pace))profile.pace=0;
for(const k of ['xp','wins','correct','battles','bestCombo'])if(!Number.isFinite(profile[k])||profile[k]<0)profile[k]=0;
for(const k of ['defeated','history'])if(!Array.isArray(profile[k]))profile[k]=[];
let dungeon=null,exploreBusy=false,moveBusy=false,routeVersion=0,lastMoveAt=0,returnBusy=false;
let battle=null,result=null,activeDialog=null,tickTimer=null,toastTimer=null,calculatorOpen=false,calcInput='',aiConfigured=null,availableBanks=[],profileCopy='',renameBusy=false;
const level=()=>levelFor(profile.xp);
const rank=()=>level()>=5?'知识征服者':level()>=3?'进阶冒险家':'见习冒险家';
const subject=()=>subjects.find(s=>s.id===(battle?.subject||dungeon?.subject||profile.subject));

const view=()=>createViews({profile,battle,dungeon,exploreBusy,account,result,authMode,authState,authUsername,authError,old,aiConfigured,availableBanks,calcInput,profileCopy});
const authScreen=(...args)=>view().authScreen(...args);
const header=(...args)=>view().header(...args);
const home=(...args)=>view().home(...args);
const skillButtons=(...args)=>view().skillButtons(...args);
const questionContent=(...args)=>view().questionContent(...args);
const combat=(...args)=>view().combat(...args);
const settingsContent=(...args)=>view().settingsContent(...args);
const skillsContent=(...args)=>view().skillsContent(...args);
const progressContent=(...args)=>view().progressContent(...args);
const resultContent=(...args)=>view().resultContent(...args);

function save(){
 if(!account)return Promise.resolve();
 const owner=account.id,preferences=Object.fromEntries(['music','effects','grade','difficulty','subject','questionType','pace','theme','themeAccent','reducedMotion','questionBank'].map(k=>[k,profile[k]]));
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{if(account?.id!==owner)return;await api('profile/settings',preferences);}).catch(error=>{if(account?.id===owner)toast(error.message);});return saveQueue;
}
function setAccount(user){account={id:user.id,username:user.username,displayName:user.displayName||user.username};Object.assign(profile,defaults,user);authState='ready';authError='';updateAudio();if(!availableBanks.length)fetch('/api/question-banks').then(r=>r.json()).then(data=>{availableBanks=data.banks||[];if(!battle&&!dungeon){reconcileBankPreferences(profile,availableBanks);render();}if(activeDialog==='settings')showDialog('settings');}).catch(()=>{});}
function expireLogin(){battle?.controller.abort();battle=null;dungeon=null;account=null;result=null;clearInterval(tickTimer);calculatorOpen=false;closeDialog();authState='ready';authError='登录已失效，请重新登录。';configureAudio({music:false,effects:false},false);render();}

function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function updateAudio(){configureAudio(profile,audioScene({battle,dungeon,result}));}
async function api(path,body,signal){
 const request=createRequestSignal(70000,signal);
 try{
  const response=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:request.signal});
  let data;try{data=await response.json();}catch{throw new Error('游戏服务暂时没有响应，请重试。');}
  if(!response.ok){if(response.status===401&&!path.startsWith('auth/'))expireLogin();const error=new Error(data.error||'暂时无法连接，请稍后重试。');error.status=response.status;throw error;}return data;
 }finally{request.dispose();}
}

function render(){
 applyTheme(profile);document.documentElement.dataset.battle=String(Boolean(battle));document.documentElement.dataset.exploring=String(Boolean(dungeon&&!battle));
 // Keep live dialogs and notices when the scene is rebuilt (for example after switching themes).
 const layers=[$('#overlay'),$('#toast')];for(const layer of layers)document.body.append(layer);
 $('#app').innerHTML=account?`<div class="game-shell ${battle?'in-battle':dungeon?'in-dungeon':''}">${battle?combat():dungeon?dungeonView({dungeon,profile,account},header()):header()+home()}</div>`:authScreen();
 const host=$('#battle-arena')||$('#dungeon-screen')||document.body;for(const layer of layers)host.append(layer);
 if(dungeon&&!battle)positionCamera(dungeon);if(calculatorOpen&&battle)renderCalculator();tick();
}
function renderHeader(){$('#game-header').outerHTML=header();}

async function copyProfile(){
 profileCopy=profileText(account,profile,availableBanks);
 try{await navigator.clipboard.writeText(profileCopy);toast('全部个人信息和已保存战绩已复制。');}
 catch{if(!account)return;showDialog('copy-profile');$('#profile-copy')?.select();}
}
async function renameProfile(form){
 if(renameBusy||!account)return;
 const owner=account.id,displayName=form.elements.displayName.value,button=form.querySelector('[type="submit"]');
 renameBusy=true;button.disabled=true;button.textContent='正在保存…';$('#rename-error').textContent='';
 try{
  await saveQueue;if(account?.id!==owner)return;
  const {user}=await api('profile/rename',{displayName});if(account?.id!==owner)return;
  account.displayName=user.displayName;profile.displayName=user.displayName;
  if(battle?.settlement)battle.settlement.user.displayName=user.displayName;
  render();if(activeDialog==='rename-profile')showDialog('progress');toast('名字已保存。');
 }catch(error){if(account?.id!==owner)return;if(form.isConnected)form.querySelector('#rename-error').textContent=error.message;else toast(error.message);}
 finally{renameBusy=false;if(button.isConnected){button.disabled=false;button.textContent='保存名字';}}
}

async function restoreDungeon(){
 try{const response=await fetch('/api/dungeon/current');if(!response.ok)return;const data=await response.json();dungeon=data.dungeon;if(data.encounter)await enterEncounter(data.encounter,true);updateAudio();}catch{}
}
async function startDungeon(){
 if(!account||exploreBusy||battle||dungeon)return;exploreBusy=true;render();
 try{await saveQueue;const data=await api('dungeon/start',{subject:profile.subject,grade:profile.grade,difficulty:profile.difficulty,questionType:profile.questionType,pace:profile.pace,questionBank:profile.questionBank});dungeon=data.dungeon;initAudio();sound('click');updateAudio();closeDialog(true);render();}
 catch(error){toast(error.message);}finally{exploreBusy=false;render();}
}
async function enterEncounter(encounter,restoring=false){
 if(!encounter?.battle)return;routeVersion++;
 if(!restoring)sound('encounter');
 if(!restoring&&!profile.reducedMotion&&!matchMedia('(prefers-reduced-motion: reduce)').matches){$('#dungeon-screen')?.classList.add('encounter-entering');await new Promise(r=>setTimeout(r,350));}
 const b={...encounter.battle,loading:!encounter.question,grading:false,feedback:false,draft:'',hidden:[],controller:new AbortController(),question:encounter.question};
 battle=b;calculatorOpen=false;result=null;updateAudio();clearInterval(tickTimer);tickTimer=setInterval(tick,250);
 if(encounter.feedback){Object.assign(b,{feedback:true,gradeResult:encounter.feedback,lastCorrect:encounter.feedback.correct,blocked:encounter.feedback.blocked,settlement:encounter.settlement||encounter.feedback.settlement});}
 if(encounter.settlement)b.settlement=encounter.settlement;
 render();if(b.outcome&&b.settlement){finishBattle();return;}
 if(!b.question)await loadQuestion();else{b.questionEnds=b.pace?Date.now()+b.pace*1000:null;tick();}
}
async function moveDungeon(direction){
 if(!dungeon||battle||activeDialog||moveBusy||dungeon.status!=='active'||Date.now()-lastMoveAt<170)return false;
 moveBusy=true;lastMoveAt=Date.now();const owner=dungeon.id;
 try{const before=dungeon.player,data=await api('dungeon/move',{dungeonId:owner,direction,step:dungeon.steps});if(dungeon?.id!==owner)return false;dungeon=data.dungeon;
  syncDungeon(dungeon,{moved:before.x!==dungeon.player.x||before.y!==dungeon.player.y});
  if(data.encounter){await enterEncounter(data.encounter);return false;}
  if(data.healed){sound('right');toast('灵泉让体力恢复到了 100。');}else if(!data.blocked){sound('step');}
  return !data.blocked;
 }catch(error){toast(error.message);return false;}finally{moveBusy=false;}
}
async function walkTo(x,y){
 if(!dungeon||battle||activeDialog)return;const version=++routeVersion,path=routeTo(dungeon,x,y);
 for(const direction of path){if(version!==routeVersion||battle||activeDialog)break;const wait=Math.max(0,180-(Date.now()-lastMoveAt));if(wait)await new Promise(r=>setTimeout(r,wait));if(!await moveDungeon(direction))break;}
}
async function returnToDungeon(){
 if(!dungeon||!battle?.outcome||returnBusy)return;returnBusy=true;
 try{const data=await api('dungeon/continue',{dungeonId:dungeon.id});dungeon=data.dungeon;closeDialog(true);battle?.controller.abort();battle=null;clearInterval(tickTimer);calculatorOpen=false;updateAudio();render();}
 catch(error){toast(error.message);}finally{returnBusy=false;}
}
async function leaveDungeon(){
 if(!dungeon||returnBusy)return;returnBusy=true;routeVersion++;
 try{await api('dungeon/leave',{dungeonId:dungeon.id});battle?.controller.abort();battle=null;dungeon=null;clearInterval(tickTimer);calculatorOpen=false;closeDialog(true);updateAudio();render();}
 catch(error){if(error.status===404){battle=null;dungeon=null;closeDialog(true);updateAudio();render();}else toast(error.message);}finally{returnBusy=false;}
}
async function restartDungeon(){await leaveDungeon();if(!dungeon)await startDungeon();}
window.addEventListener('resize',()=>{if(dungeon&&!battle)positionCamera(dungeon);});
let moveHold=null;
document.addEventListener('pointerdown',event=>{const button=event.target.closest('[data-action="move"]');if(!button)return;routeVersion++;clearInterval(moveHold);moveHold=setInterval(()=>moveDungeon(button.dataset.direction),190);});
for(const type of ['pointerup','pointercancel','blur'])window.addEventListener(type,()=>{clearInterval(moveHold);moveHold=null;});

async function startBattle(){
 if(!account||authBusy)return;await saveQueue;
 closeDialog();result=null;calculatorOpen=false;battle?.controller.abort();
 const pending={id:null,subject:profile.subject,grade:profile.grade,difficulty:profile.difficulty,questionType:profile.questionType,pace:profile.pace,questionBank:profile.questionBank,playerHP:100,monsterHP:difficulties[profile.difficulty].hp,maxHP:difficulties[profile.difficulty].hp,combo:0,bestCombo:0,correct:0,answered:0,round:0,shield:false,shieldUsed:false,hintUsed:false,loading:true,grading:false,feedback:false,draft:'',hidden:[],calcReadyAt:Date.now()+20000,controller:new AbortController()};
 battle=pending;initAudio();sound('click');updateAudio();clearInterval(tickTimer);tickTimer=setInterval(tick,250);render();window.scrollTo(0,0);
 try{const data=await api('battle/start',{subject:profile.subject,grade:profile.grade,difficulty:profile.difficulty,questionType:profile.questionType,pace:profile.pace,questionBank:profile.questionBank},pending.controller.signal);if(battle!==pending)return;Object.assign(pending,data.battle);await loadQuestion();}
 catch(error){if(battle!==pending)return;battle=null;clearInterval(tickTimer);updateAudio();render();toast(error.message);}
}
async function loadQuestion(overrideType){
 if(!battle)return;const b=battle;
 if(b.question?.knowledgePoint)b.lastKnowledgePoint=b.question.knowledgePoint;
 Object.assign(b,{loading:true,feedback:false,grading:false,error:null,question:null,draft:'',hint:null,hidden:[],selected:null});calculatorOpen=false;render();
 try{const q=await api('question',{battleId:b.id,swap:Boolean(overrideType)},b.controller.signal);if(battle!==b)return;b.question=q;b.loading=false;b.questionEnds=b.pace?Date.now()+b.pace*1000:null;b.reminded=false;}
 catch(error){if(battle!==b)return;b.loading=false;b.error=error.message;}
 render();if(b.question)await playBattleMotion(b.answered?'summon':'enter',profile.theme,b);
}
async function submitAnswer(value){
 const b=battle;if(!b?.question||b.grading||b.feedback||b.loading||activeDialog)return;
 const answer=typeof value==='string'?value:b.draft;
 if(!answer.trim()){toast('先写下你的想法，再出招吧。');$('#written-answer')?.focus();return;}
 if(b.question.type==='choice'&&(!b.question.options.includes(answer)||b.hidden.includes(answer)))return;
 b.selected=answer;b.grading=true;b.error=null;b.pauseStart=Date.now();render();
 try{const grade=await api('grade',{questionId:b.question.id,answer},b.controller.signal);if(battle!==b)return;Object.assign(b,grade.battle,{grading:false,feedback:true,animating:true,gradeResult:grade,lastCorrect:grade.correct,blocked:grade.blocked,settlement:grade.settlement});if(grade.dungeon)dungeon=grade.dungeon;if(grade.settlement)setAccount(grade.settlement.user);calculatorOpen=false;}
 catch(error){if(battle!==b)return;b.grading=false;b.error=error.message;if(b.questionEnds)b.questionEnds+=Date.now()-b.pauseStart;}
 render();
 if(b.animating){try{await playBattleMotion('attack',profile.theme,b);}finally{if(battle===b){b.animating=false;updateAudio();render();}}}
}
function nextQuestion(){if(!battle?.feedback||battle.animating)return;if(battle.outcome){finishBattle();return;}battle.round++;loadQuestion();}
function tick(){const b=battle;if(!b)return;const cd=Math.max(0,Math.ceil((b.calcReadyAt-Date.now())/1000));if($('#calc-cooldown')){$('#calc-cooldown').textContent=cd?`${cd}s`:'就绪';$('#calc-skill').disabled=cd>0||b.loading||b.grading||b.feedback||b.animating;}if(!b.questionEnds||b.loading||b.grading||b.feedback||activeDialog)return;const seconds=Math.max(0,Math.ceil((b.questionEnds-Date.now())/1000));if($('#time-label'))$('#time-label').innerHTML=`${icon('clock',14)} ${seconds?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'慢慢来，继续思考'}`;if(seconds===0&&!b.reminded){b.reminded=true;toast('已经想了一会儿啦，可以继续思考，时间不会让你掉血。');}}
function finishBattle(){
 if(!battle?.settlement)return;const b=battle;
 setAccount(b.settlement.user);result=b.settlement.result;b.controller.abort();clearInterval(tickTimer);calculatorOpen=false;updateAudio();render();sound(result.win?'win':'lose');showDialog('result');
}
async function quitBattle(){
 const b=battle;if(!b)return;
 try{const data=await api('battle/leave',{battleId:b.id});if(battle!==b)return;if(data.dungeon)dungeon=data.dungeon;if(data.settlement){b.settlement=data.settlement;closeDialog();finishBattle();return;}}
 catch(error){if(battle!==b)return;if(error.status!==404){toast(error.message);return;}}
 b.controller.abort();battle=null;clearInterval(tickTimer);calculatorOpen=false;closeDialog();updateAudio();render();
}

function showDialog(type){
 if(!activeDialog&&battle)battle.dialogOpened=Date.now();activeDialog=type;
 $('#overlay').innerHTML=view().dialogHtml(type);document.body.classList.add('modal-open');$('#overlay button')?.focus();
}
function closeDialog(force=false){
 if(!force&&activeDialog==='result'&&battle?.dungeonId){returnToDungeon();return;}
 const leavingResult=activeDialog==='result';
 if(battle?.dialogOpened){if(battle.questionEnds)battle.questionEnds+=Date.now()-battle.dialogOpened;battle.dialogOpened=null;}
 activeDialog=null;$('#overlay').innerHTML='';document.body.classList.remove('modal-open');
 if(leavingResult&&battle){battle.controller.abort();battle=null;clearInterval(tickTimer);calculatorOpen=false;updateAudio();render();}
}
async function useHint(){
 const b=battle;if(!b?.question||level()<3||b.hintUsed||b.grading||b.feedback||b.loading)return;const questionId=b.question.id;b.hintUsed=true;render();
 try{const data=await api('hint',{questionId},b.controller.signal);if(battle!==b||b.question?.id!==questionId)return;b.hint=data.hint;b.hidden=data.eliminated||[];Object.assign(b,{shield:data.battle.shield,shieldUsed:data.battle.shieldUsed,calcReadyAt:data.battle.calcReadyAt});sound('click');}
 catch{if(battle!==b||b.question?.id!==questionId)return;b.hintUsed=false;toast('提示暂时没送到，技能没有消耗，可以重试。');}render();
}
function renderCalculator(){$('.calculator-popover')?.remove();const div=document.createElement('section');div.className='calculator-popover';div.setAttribute('aria-label','口袋计算器');div.innerHTML=view().calculatorContent();($('#battle-arena')||$('.game-shell')).append(div);}

document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action]');if(!target||target.disabled)return;const action=target.dataset.action;
 if(action==='auth-mode'){if(authBusy)return;authUsername=$('#auth-username')?.value||authUsername;authMode=target.dataset.mode;authError='';render();return;}
 if(action==='retry-session'){bootstrap();return;}
 if(action==='logout'){logout();return;}
 if(!account)return;
 if(battle?.animating&&action!=='music'){toast('正在出招，请稍候。');return;}
 if(action==='home'){event.preventDefault();if(battle)showDialog('leave');else if(dungeon)showDialog('dungeon-leave');else{closeDialog();render();}}
 else if(action==='subject'&&!battle&&!dungeon){profile.subject=target.dataset.id;save();sound('click');render();}
 else if(action==='start')startDungeon();
 else if(action==='practice')startBattle();
 else if(action==='move'){routeVersion++;moveDungeon(target.dataset.direction);}
 else if(action==='walk-to')walkTo(Number(target.dataset.x),Number(target.dataset.y));
 else if(action==='dungeon-return')returnToDungeon();
 else if(action==='dungeon-leave')showDialog('dungeon-leave');
 else if(action==='dungeon-home'||action==='dungeon-quit')leaveDungeon();
 else if(action==='dungeon-restart')restartDungeon();
 else if(action==='copy-profile')copyProfile();
 else if(action==='rename-profile'){showDialog('rename-profile');$('#display-name')?.focus();$('#display-name')?.select();}
 else if(action==='theme'){profile.theme=getTheme(target.dataset.theme).id;profile.themeAccent='';save();updateAudio();render();showDialog('settings');}
 else if(action==='reset-theme'){profile.themeAccent='';save();render();showDialog('settings');}
 else if(action==='focus-answer'){const el=$('#written-answer')||$('.answer-option')||$('#question-title');el?.scrollIntoView({behavior:profile.reducedMotion?'instant':'smooth',block:'center'});el?.focus();}
 else if(['settings','skills','progress','help'].includes(action))showDialog(action);
 else if(action==='close')closeDialog();
 else if(action==='leave'){if(battle?.outcome)finishBattle();else showDialog('leave');}
 else if(action==='quit')quitBattle();
 else if(action==='answer')submitAnswer(battle?.question?.options[Number(target.dataset.index)]);
 else if(action==='next')nextQuestion();
 else if(action==='retry-question')loadQuestion();
 else if(action==='retry-answer')submitAnswer(battle?.question?.type==='choice'?battle.selected:battle?.draft);
 else if(action==='swap-question'){if(battle){battle.round++;loadQuestion('choice');}}
 else if(action==='music'){profile.music=!profile.music;save();initAudio();updateAudio();renderHeader();if(activeDialog==='settings')showDialog('settings');}
 else if(action==='effects'){profile.effects=!profile.effects;save();updateAudio();sound('click');showDialog('settings');}
 else if(action==='shield')useSkill('shield');
 else if(action==='hint')useHint();
 else if(action==='calculator')useSkill('calculator');
 else if(action==='close-calculator'){calculatorOpen=false;$('.calculator-popover')?.remove();}
 else if(action==='calc-key'){const k=target.dataset.key;if(k==='C')calcInput='';else if(k==='⌫')calcInput=calcInput.slice(0,-1);else if(k==='='){try{calcInput=calculate(calcInput);}catch{toast('检查一下算式，除数不能为 0。');return;}}else if(calcInput.length<30)calcInput+=k;$('.calculator-display').textContent=calcInput||'0';sound('click');}
});
document.addEventListener('submit',event=>{if(event.target.id==='rename-form'){event.preventDefault();renameProfile(event.target);return;}if(event.target.id==='auth-form'){event.preventDefault();authenticate(event.target);return;}if(event.target.id==='answer-form'){event.preventDefault();submitAnswer();}});
document.addEventListener('input',event=>{if(event.target.id==='written-answer'&&battle)battle.draft=event.target.value;});
document.addEventListener('change',event=>{
 const key=event.target.id;
 if(['themeAccent','reducedMotion'].includes(key)){profile[key]=key==='reducedMotion'?event.target.checked:event.target.value;save();render();return;}
 if(!['grade','difficulty','questionType','pace','questionBank'].includes(key)||battle||dungeon)return;
 profile[key]=['grade','pace'].includes(key)?Number(event.target.value):event.target.value;reconcileBankPreferences(profile,availableBanks);save();render();if(key==='questionBank'&&activeDialog==='settings')showDialog('settings');
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){if(calculatorOpen){calculatorOpen=false;$('.calculator-popover')?.remove();}else if(activeDialog)closeDialog();else if(battle)showDialog('leave');else if(dungeon)showDialog('dungeon-leave');return;}
 if(activeDialog&&event.key==='Tab'){const focusable=[...$('#overlay').querySelectorAll('button:not(:disabled),select:not(:disabled),input,textarea')],first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&(document.activeElement===first||!$('#overlay').contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!$('#overlay').contains(document.activeElement))){event.preventDefault();first?.focus();}}
 if(activeDialog||calculatorOpen||event.isComposing)return;
 if(event.target.matches('input,textarea,select')){if(event.target.id==='written-answer'&&(event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();submitAnswer();}return;}
 if(dungeon&&!battle){const direction={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[event.key]||{w:'up',s:'down',a:'left',d:'right'}[event.key.toLowerCase()];if(direction){event.preventDefault();routeVersion++;moveDungeon(direction);}return;}
 if(battle?.question?.type==='choice'&&/^[abcd]$/i.test(event.key))submitAnswer(battle.question.options[event.key.toLowerCase().charCodeAt(0)-97]);
});
document.addEventListener('pointerdown',()=>{if(account){initAudio();updateAudio();}});
fetch('/api/status').then(r=>r.json()).then(s=>{aiConfigured=s.configured;}).catch(()=>{aiConfigured=false;});
render();bootstrap();
