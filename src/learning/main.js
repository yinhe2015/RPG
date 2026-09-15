import './style.css';
import 'katex/dist/katex.min.css';
import {teachers} from './teachers.js';
import {subjects} from '../game.js';
import {esc} from '../ui/html.js';
import {questionText} from '../ui/question-text.js';
import assets from '../themes/pal-assets.json';
import {streamEvents} from '../stream-events.js';
import {languages,languageOf} from './languages.js';
import {createNarrator} from './narrator.js';

const root=document.querySelector('#learning-app'),stages=['小学','初中','高中'];
let user=null,data={sessions:[],mistakes:[],topics:[]},session=null,busy=false,error='',loading=true,authMode='login',drawer=false,draft='',attempt=null;
let choice={teacherId:'linger',subject:'math',grade:1,topic:'',source:'topic',mistakeId:'',language:'zh-CN'};
let preview=null,streamText='',partialReply='',starting=false;
const narrator=createNarrator();let voicePrefs={enabled:false,voiceURI:''};
try{const saved=JSON.parse(localStorage.getItem('quest-learning-voice')||'{}');voicePrefs={enabled:saved.enabled===true,voiceURI:typeof saved.voiceURI==='string'?saved.voiceURI:''};}catch{}
function saveVoice(){try{localStorage.setItem('quest-learning-voice',JSON.stringify(voicePrefs));}catch{}}
function readAloud(message){if(!message)return;narrator.speak(message.content,message.language||choice.language,voicePrefs.voiceURI,()=>{const label=root.querySelector('#speech-status');if(label)label.textContent='此设备暂时无法朗读，请换一个声音。';});}
function languageSelect(id){return `<label class="language-picker">回复语言<select id="${id}" ${busy?'disabled':''}>${languages.map(l=>`<option value="${l.id}" ${choice.language===l.id?'selected':''}>${l.name}</option>`).join('')}</select></label>`;}
function voiceControls(){return `<div class="voice-controls"><button data-action="voice-toggle" ${!narrator.supported?'disabled':''} aria-pressed="${voicePrefs.enabled}">自动朗读：${voicePrefs.enabled?'开':'关'}</button><button data-action="read-aloud" ${!narrator.supported||busy?'disabled':''}>朗读回复</button><button data-action="stop-reading">停止朗读</button><label class="sr-only" for="learn-voice">朗读声音</label><select id="learn-voice" aria-label="朗读声音" ${!narrator.supported?'disabled':''}><option value="">系统默认声音</option>${narrator.voices().filter(v=>/^(zh|en)/i.test(v.lang)).map(v=>`<option value="${esc(v.voiceURI)}" ${v.voiceURI===voicePrefs.voiceURI?'selected':''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}</select><small id="speech-status">${narrator.supported?'':'此浏览器不支持朗读'}</small></div>`;}
const nameOf=id=>subjects.find(s=>s.id===id)?.name||id;
const teacherOf=id=>teachers.find(t=>t.id===id)||teachers[0];
const portrait=t=>`<img src="/themes/pal/${assets.players[t.sprite].poses[0].src}" alt="${t.name}" class="teacher-sprite">`;
async function request(path,body,onEvent){
 const response=await fetch(`/api/${path}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(onEvent?{Accept:'text/event-stream'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(100000)});
 if(!response.ok){const value=await response.json();if(response.status===401){narrator.stop();user=null;session=null;preview=null;data={sessions:[],mistakes:[],topics:[]};draft='';attempt=null;}throw Error(value.error||'暂时无法连接，请重试。');}
 if(onEvent&&response.headers.get('content-type')?.includes('text/event-stream')){
  let result;for await(const event of streamEvents(response.body)){
   const value=JSON.parse(event.data);if(event.event==='error')throw Error(value.error);
   if(event.event==='done'){result=value;break;}onEvent(event.event,value);
  }
  if(!result)throw Error('回复途中连接中断，请重试。你的输入已保留。');return result;
 }
 return response.json();
}
function reference(q,withAnswer=false){
 return `<div class="reference"><small>${esc(q.bankName||'冒险错题')} · ${esc(q.knowledgePoint?.name||'')}</small><p>${questionText(q.text)}</p>${q.options?.length?`<ol type="A">${q.options.map(v=>`<li>${questionText(v)}</li>`).join('')}</ol>`:''}<p class="original-answer">你当时的回答：${questionText(q.studentAnswer)}</p>${withAnswer?`<details><summary>查看原参考思路</summary><p>${questionText(q.reference)}</p><p>${questionText(q.explanation)}</p></details>`:''}</div>`;
}
function setup(){
 const selected=data.mistakes.find(q=>q.id===choice.mistakeId),topics=data.topics.filter(t=>t.subject===choice.subject&&t.grade===choice.grade);
 return `<section class="study-setup"><div class="setup-title"><small>不急着给答案 · 先找到你卡住的那一步</small><h1>今天，想弄懂什么？</h1><p>选一位老师，从一个知识点，或一道错题聊起。</p></div>
 <form id="lesson-start"><fieldset ${busy?'disabled':''}><legend>选择你的老师</legend><div class="teacher-options">${teachers.map(t=>`<button type="button" data-action="teacher" data-id="${t.id}" aria-pressed="${choice.teacherId===t.id}" class="teacher-option ${choice.teacherId===t.id?'selected':''}">${portrait(t)}<span><b>${t.name}</b><em>${t.role}</em><small>${t.trait}</small></span></button>`).join('')}</div>
 <div class="source-tabs" aria-label="学习起点"><button type="button" data-action="source" data-id="topic" aria-pressed="${choice.source==='topic'}">从知识点开始</button><button type="button" data-action="source" data-id="mistake" aria-pressed="${choice.source==='mistake'}">从错题开始 <small>${data.mistakes.length}</small></button></div>
 ${choice.source==='topic'?`<div class="topic-fields"><label>学科<select id="learn-subject">${subjects.map(s=>`<option value="${s.id}" ${choice.subject===s.id?'selected':''}>${s.name}</option>`).join('')}</select></label><label>学段<select id="learn-grade">${stages.map((s,i)=>`<option value="${i}" ${choice.grade===i?'selected':''}>${s}</option>`).join('')}</select></label><label class="topic-label">想学的知识点<input id="learn-topic" value="${esc(choice.topic)}" maxlength="120" list="topic-suggestions" placeholder="如：一元一次方程、古诗意象、浮力…" required autocomplete="off"><datalist id="topic-suggestions">${topics.map(t=>`<option value="${esc(t.name)}"></option>`).join('')}</datalist></label></div><p class="quiet">可以选题库里的知识点，也可以自己填写。</p>`:
 `<label>选择一道错题<select id="learn-mistake" required><option value="">请选择…</option>${data.mistakes.map(q=>`<option value="${q.id}" ${choice.mistakeId===q.id?'selected':''}>${nameOf(q.subject)} · ${stages[q.grade]} · ${esc(q.text.slice(0,65))}</option>`).join('')}</select></label>${selected?reference(selected):`<p class="empty">${data.mistakes.length?'老师会结合你当时的答案，帮你找出问题所在。':'还没有记录错题。今后冒险中答错的题会自动出现在这里，也可以先从知识点开始。'}</p>`}`}
 <div class="setup-language">${languageSelect('start-language')}</div><button class="primary begin" type="submit" ${busy?'disabled':''}>${busy?'老师正在准备第一个问题…':'开始学习 →'}</button><p class="quiet">不限时 · 对话自动保存 · 每次只解决一点</p></fieldset></form></section>`;
}
function conversation(session){
 const t=teacherOf(session.teacherId);
 return `<main class="study-room"><section class="lesson"><header class="lesson-heading"><div class="lesson-title"><small>${nameOf(session.subject)} / ${stages[session.grade]}</small><h2>${esc(session.topic)}</h2><span class="saved">${busy?'正在回复…':'已保存'}</span></div><aside class="mentor"><div><small>你的 AI 老师</small><h1>${t.name}</h1><p>${t.role}</p></div><div class="mentor-scene">${portrait(t)}</div></aside></header>
 <div class="lesson-options">${languageSelect('reply-language')}${voiceControls()}</div>
 ${session.reference?`<details class="lesson-reference"><summary>引用错题 · 查看原题和我的回答</summary>${reference(session.reference,true)}</details>`:''}
 <div class="messages" role="log" aria-label="与老师的对话" aria-live="polite">${session.messages.map(m=>`<article class="message ${m.role}"><small>${m.role==='assistant'?t.name:esc(user.displayName||user.username)}</small><div>${questionText(m.content)}</div>${m.truncated?'<small>这一段较长，可发送“请继续”接着讲。</small>':''}</article>`).join('')}${busy?`${!starting?`<article class="message user"><small>你</small><div>${questionText(draft)}</div></article>`:''}<article class="message assistant streaming"><small>${t.name} · 正在回复</small><div id="stream-reply">${esc(streamText)||'正在看你的思路…'}</div></article>`:''}</div>
 <div class="composer"><div class="quick-replies">${(session.quickReplies||[]).map((s,i)=>`<button data-action="quick" data-index="${i}" ${busy?'disabled':''}>${esc(s)}</button>`).join('')}</div><form id="lesson-chat"><label class="sr-only" for="learn-message">你的思路或问题</label><textarea id="learn-message" rows="3" maxlength="2000" placeholder="说说你的想法，或者告诉老师哪里没跟上…" ${busy?'disabled':''}>${esc(draft)}</textarea><div><small>Enter 换行 · Ctrl / ⌘ + Enter 发送</small><button class="primary" type="submit" ${busy?'disabled':''}>${busy?'思考中…':'发送 →'}</button></div></form></div>
 </section></main>`;
}
function render(){
 root.innerHTML=`<div class="learning-shell"><header class="learning-header"><a class="brand" href="/learn.html"><span>学</span><div>仙剑学堂<small>知识学习版</small></div></a><nav><a href="/">返回冒险</a>${user?`<button data-action="new" ${busy?'disabled':''}>新学习</button><button data-action="history" ${busy?'disabled':''}>学习记录</button><button data-action="logout" ${busy?'disabled':''} aria-label="退出登录">${esc(user.displayName||user.username)} · 退出</button>`:''}</nav></header>
 ${error?`<div class="notice" role="alert">${esc(error)}${user&&attempt?'<button data-action="retry-turn" '+(busy?'disabled':'')+'>重试这次回复</button>':''}${user?'<button data-action="reload" '+(busy?'disabled':'')+'>重新读取记录</button>':''}${partialReply?`<details><summary>查看收到的部分回复（未保存）</summary><p>${questionText(partialReply)}</p></details>`:''}</div>`:''}
 ${loading?'<p class="loading" role="status">正在打开学堂…</p>':!user?`<section class="study-auth"><small>仙剑人物陪你学习</small><h1>${authMode==='login'?'回到学堂':'开始你的学习'}</h1><p>和冒险版使用同一个账号，学习记录独立保存。</p><form id="learning-auth"><label>账号<input name="username" autocomplete="username" minlength="2" maxlength="32" required></label><label>密码<input name="password" type="password" autocomplete="${authMode==='login'?'current-password':'new-password'}" minlength="4" maxlength="128" required></label>${authMode==='register'?'<label>再次输入密码<input name="confirm" type="password" autocomplete="new-password" required></label>':''}<button type="submit" class="primary" ${busy?'disabled':''}>${busy?'正在进入…':authMode==='login'?'登录学堂':'注册并进入'}</button></form><button data-action="auth-mode">${authMode==='login'?'还没有账号？注册':'已有账号，去登录'}</button></section>`:(session||preview)?conversation(session||preview):setup()}
 ${drawer?`<div class="drawer-backdrop"><aside class="history-drawer" role="dialog" aria-modal="true" aria-label="学习记录"><header><h2>学习记录</h2><button data-action="history" aria-label="关闭学习记录">×</button></header><p class="quiet">保留最近 12 次学习、100 道错题。</p>${data.sessions.length?data.sessions.map(s=>`<button class="history-entry" data-action="resume" data-id="${s.id}"><small>${teacherOf(s.teacherId).name} · ${nameOf(s.subject)} · ${stages[s.grade]}</small><b>${esc(s.topic)}</b><span>${esc(s.focus)}</span><small>${new Date(s.updatedAt).toLocaleString('zh-CN')}</small></button>`).join(''):'<p class="empty">开始第一次对话后，记录会出现在这里。</p>'}</aside></div>`:''}
 <footer class="learning-footer">AI 老师陪你思考 · 有疑问时，可以请老师换一种解释</footer></div>`;
 if(session||preview){const log=root.querySelector('.messages');if(log)log.scrollTop=log.scrollHeight;}
}
function setUrl(id){history.replaceState(null,'',id?`/learn.html?session=${encodeURIComponent(id)}`:'/learn.html');}
async function load(){
 loading=true;error='';render();
 try{const auth=await request('auth/me');user=auth.user;data=await request('learning/current');
  const params=new URLSearchParams(location.search);session=data.sessions.find(s=>s.id===params.get('session'))||null;
  preview=null;choice.language=session?.language||choice.language;
  choice.subject=user.subject;choice.grade=user.grade;
  const mistake=params.get('mistake');if(mistake){choice.source='mistake';choice.mistakeId=mistake;if(!data.mistakes.some(q=>q.id===mistake))error='这道错题暂时不在记录里，请从列表选择其他题目。';}
 }catch(e){if(user||e.message!=='请先登录，再继续冒险。')error=e.message;}
 finally{loading=false;render();}
}
async function send(start=false){
 if(busy)return;if(!start&&!draft.trim())return;
 const payload=start?{teacherId:choice.teacherId,subject:choice.subject,grade:choice.grade,topic:choice.topic,language:choice.language,...(choice.source==='mistake'?{mistakeId:choice.mistakeId}:{})}:{sessionId:session.id,text:draft,version:session.messages.length,language:choice.language};
 const signature=JSON.stringify(payload);if(attempt?.signature!==signature)attempt={signature,start,requestId:crypto.randomUUID()};
 narrator.stop();busy=true;starting=start;error='';streamText='';partialReply='';render();
 try{
  const response=await request(`learning/${start?'start':'chat'}`,{...payload,requestId:attempt.requestId},(event,value)=>{
   if(event==='ready'){if(start){preview=value.session;render();}return;}
   if(event==='delta'){
    streamText+=value.text;const log=root.querySelector('.messages'),node=root.querySelector('#stream-reply');
    const atBottom=log&&log.scrollHeight-log.scrollTop-log.clientHeight<80;
    if(node)node.textContent=streamText;if(atBottom)log.scrollTop=log.scrollHeight;
   }
  });
  session=response.session;data.sessions=[session,...data.sessions.filter(s=>s.id!==session.id)].slice(0,12);draft='';attempt=null;setUrl(session.id);
  if(voicePrefs.enabled)readAloud(session.messages.at(-1));
 }catch(e){error=e.message;partialReply=streamText;}
 finally{busy=false;preview=null;starting=false;render();if(session)root.querySelector('#learn-message')?.focus({preventScroll:true});}
}
root.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 if(event.target.id==='lesson-start'){send(true);return;}if(event.target.id==='lesson-chat'){send();return;}
 if(event.target.id==='learning-auth'){
  const form=event.target;if(authMode==='register'&&form.elements.password.value!==form.elements.confirm.value){error='两次密码不一致。';render();return;}
  const body={username:form.elements.username.value,password:form.elements.password.value};busy=true;form.querySelector('[type="submit"]').disabled=true;
  try{const auth=await request(`auth/${authMode}`,body);user=auth.user;draft='';attempt=null;await load();}catch(e){error=e.message;}finally{busy=false;render();}
 }
});
root.addEventListener('input',event=>{if(event.target.id==='learn-message')draft=event.target.value;if(event.target.id==='learn-topic')choice.topic=event.target.value;});
root.addEventListener('change',event=>{
 if(['start-language','reply-language'].includes(event.target.id)){choice.language=event.target.value;narrator.stop();return;}
 if(event.target.id==='learn-voice'){voicePrefs.voiceURI=event.target.value;saveVoice();narrator.stop();return;}
 if(event.target.id==='learn-subject'){choice.subject=event.target.value;choice.topic='';render();}
 if(event.target.id==='learn-grade'){choice.grade=Number(event.target.value);choice.topic='';render();}
 if(event.target.id==='learn-mistake'){choice.mistakeId=event.target.value;render();}
});
root.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;
 if(action==='stop-reading'){narrator.stop();return;}
 if(action==='voice-toggle'){voicePrefs.enabled=!voicePrefs.enabled;saveVoice();if(!voicePrefs.enabled)narrator.stop();button.textContent=`自动朗读：${voicePrefs.enabled?'开':'关'}`;button.setAttribute('aria-pressed',String(voicePrefs.enabled));return;}
 if(busy)return;
 if(action==='read-aloud'){readAloud(session?.messages.filter(m=>m.role==='assistant').at(-1));return;}
 if(action==='retry-turn'){send(attempt?.start);return;}
 if(action==='teacher')choice.teacherId=button.dataset.id;
 if(action==='source')choice.source=button.dataset.id;
 if(action==='new'){narrator.stop();session=null;draft='';error='';partialReply='';attempt=null;setUrl();}
 if(action==='history')drawer=!drawer;
 if(action==='resume'){narrator.stop();session=data.sessions.find(s=>s.id===button.dataset.id);choice.language=session.language||'zh-CN';drawer=false;draft='';error='';partialReply='';attempt=null;setUrl(session.id);}
 if(action==='quick'){draft=session.quickReplies[Number(button.dataset.index)];render();root.querySelector('#learn-message').focus();return;}
 if(action==='auth-mode'){authMode=authMode==='login'?'register':'login';error='';}
 if(action==='reload'){await load();return;}
 if(action==='logout'){try{await request('auth/logout',{});narrator.stop();user=null;session=null;data={sessions:[],mistakes:[],topics:[]};draft='';error='';partialReply='';attempt=null;drawer=false;setUrl();}catch(e){error=e.message;}}
 render();if(drawer)root.querySelector('.history-drawer button')?.focus();
});
root.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&drawer){drawer=false;render();}
 if(event.target.id==='learn-message'&&!event.isComposing&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();send();}
 if(drawer&&event.key==='Tab'){const buttons=[...root.querySelectorAll('.history-drawer button')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
window.addEventListener('pagehide',()=>narrator.stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden)narrator.stop();});
globalThis.speechSynthesis?.addEventListener('voiceschanged',()=>{const controls=root.querySelector('.voice-controls');if(controls){const temp=document.createElement('div');temp.innerHTML=voiceControls();controls.replaceWith(temp.firstElementChild);}});
load();
