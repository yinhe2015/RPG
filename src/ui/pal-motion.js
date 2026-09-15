
export function setPalFrame(actor,frame){
 const sprite=actor?.querySelector('.pal-frames');if(!sprite)return;
 const count=Number(sprite.dataset.frames),index=Math.min(frame,count-1);
 sprite.dataset.frame=index;sprite.style.backgroundPosition=`${count>1?index/(count-1)*100:0}% 0`;
}

// Original F.MKF poses: 7 ready, 8 strike, 9 follow-through, 4 hurt, 3 defend, 2 fallen.
export async function palAttack(root,battle,{sound}){
 const player=root.querySelector('.pal-leader'),enemy=root.querySelector('.pal-enemy'),layer=root.querySelector('.arena-effects');
 if(!player||!enemy||!layer)return;
 const right=battle.lastCorrect,attacker=right?player:enemy,target=right?enemy:player;
 const action=battle.lastAction,spell=action?.move.kind==='spell';
 const animations=[],effects=[];
 const live=()=>root.isConnected&&!battle.controller?.signal.aborted;
 const motion=async(node,frames,duration)=>{
  if(!live())return;
  const a=node.animate(frames,{duration,easing:'ease-in-out',fill:'forwards'});animations.push(a);
  await a.finished.catch(()=>{});
 };
 const abort=()=>animations.forEach(a=>a.cancel());battle.controller?.signal.addEventListener('abort',abort,{once:true});
 const label=document.createElement('div');label.className='battle-move-label';label.textContent=action?.move.name||'挥剑';layer.append(label);effects.push(label);
 root.dataset.choreography='windup';
 try{
  sound(spell?'magic':right?'attack':'encounter');setPalFrame(attacker,right?(spell?5:7):1);
  await motion(attacker,[{filter:'brightness(1)'},{filter:'brightness(1.35)'},{filter:'brightness(1)'}],220);
  if(!live())return;
  const p=attacker.getBoundingClientRect(),e=target.getBoundingClientRect(),bounds=root.getBoundingClientRect();
  const gap=e.x+e.width/2-(p.x+p.width/2),direction=Math.sign(gap);
  const dx=spell?0:gap-direction*(e.width*.35+p.width*.25),dy=spell?0:e.bottom-p.bottom+12;
  root.dataset.choreography='approach';
  await motion(attacker,[{translate:'0 0'},{translate:`${dx*.6}px ${dy-24}px`,offset:.65},{translate:`${dx}px ${dy}px`}],300);
  if(!live())return;
  root.dataset.choreography='strike';setPalFrame(attacker,right?(spell?6:8):Math.min(2,Number(attacker.querySelector('.pal-frames').dataset.frames)-1));
  await motion(attacker,[{filter:'brightness(1)'},{filter:'brightness(1.25)'}],130);
  if(!live())return;
  setPalFrame(attacker,right?(spell?6:9):1);if(!right)setPalFrame(player,battle.blocked?3:4);
  sound(battle.blocked&&!right?'shield':spell?'magic':right?'right':'wrong');
  const tx=e.x+e.width/2-bounds.x,ty=e.y+e.height*.45-bounds.y;
  const slash=document.createElement('span');slash.className=battle.blocked&&!right?'pal-impact-slash guard':spell?`pal-spell spell-${action.move.element}`:'pal-impact-slash';slash.style.left=`${tx}px`;slash.style.top=`${ty}px`;layer.append(slash);effects.push(slash);
  const damage=document.createElement('b');damage.className='arena-damage';damage.textContent=battle.blocked&&!right?'格挡':`−${action?.damage??(right?(battle.combo>=3?35:25):{easy:15,normal:20,hard:25}[battle.difficulty])}`;damage.style.left=`${tx}px`;damage.style.top=`${ty-35}px`;layer.append(damage);effects.push(damage);
  const numbers=motion(damage,[{opacity:0,translate:'-50% 0'},{opacity:1,translate:'-50% -25px',offset:.2},{opacity:1,translate:'-50% -45px',offset:.7},{opacity:0,translate:'-50% -65px'}],1050);
  const flash=motion(slash,[{opacity:0,scale:'.3',rotate:'-30deg'},{opacity:1,scale:'1.4',rotate:'15deg',offset:.3},{opacity:0,scale:'1.8',rotate:'35deg'}],500);
  root.dataset.choreography='impact';
  await motion(target,[{translate:'0 0',filter:'brightness(1)'},{translate:`${direction*18}px -4px`,filter:'brightness(2)'},{translate:`${-direction*8}px 0`,filter:'brightness(1)'},{translate:'0 0'}],420);
  if(!live())return;
  root.dataset.choreography='return';setPalFrame(attacker,right?7:0);
  await motion(attacker,[{translate:`${dx}px ${dy}px`},{translate:'0 0'}],320);
  setPalFrame(player,0);setPalFrame(enemy,0);
  for(const assist of action?.assists||[]){
   if(!live())return;
   root.dataset.choreography='assist';label.textContent=assist.name;label.dataset.assist=assist.id;
   const actors=assist.actor==='both'?[root.querySelector('.pal-companion-one'),root.querySelector('.pal-companion-two')]:[root.querySelector(assist.actor==='linger'?'.pal-companion-one':'.pal-companion-two')];
   sound('magic');
   for(const actor of actors){setPalFrame(actor,5);actor?.classList.add('assisting');}
   await Promise.all(actors.filter(Boolean).map(actor=>motion(actor,[{translate:'0 0',filter:'brightness(1)'},{translate:'-12px -20px',filter:'brightness(1.8)'}],260)));
   for(const actor of actors)setPalFrame(actor,6);
   for(const actor of actors.filter(Boolean)){
    const start=actor.getBoundingClientRect(),bolt=document.createElement('span');bolt.className=`assist-bolt spell-${assist.element}`;bolt.style.left=`${start.x+start.width/2-bounds.x}px`;bolt.style.top=`${start.y+start.height/2-bounds.y}px`;layer.append(bolt);effects.push(bolt);
    await motion(bolt,[{translate:'0 0',opacity:0},{opacity:1,offset:.15},{translate:`${tx-(start.x+start.width/2-bounds.x)}px ${ty-(start.y+start.height/2-bounds.y)}px`,opacity:1}],230);
    bolt.remove();
   }
   const burst=document.createElement('span');burst.className=`pal-spell spell-${assist.element}`;burst.style.left=`${tx}px`;burst.style.top=`${ty}px`;layer.append(burst);effects.push(burst);
   const extra=document.createElement('b');extra.className='arena-damage assist-damage';extra.textContent=`−${assist.damage}${assist.heal?` / 体力 +${assist.heal}`:''}`;extra.style.left=`${tx}px`;extra.style.top=`${ty-40}px`;layer.append(extra);effects.push(extra);
   await Promise.all([motion(burst,[{opacity:0,scale:'.3'},{opacity:1,scale:'1.5',offset:.35},{opacity:0,scale:'2'}],480),motion(extra,[{opacity:1,translate:'-50% 0'},{opacity:1,translate:'-50% -25px',offset:.65},{opacity:0,translate:'-50% -45px'}],600),motion(enemy,[{filter:'brightness(1)'},{filter:'brightness(2.3)'},{filter:'brightness(1)'}],380)]);
   for(const actor of actors){setPalFrame(actor,0);actor?.classList.remove('assisting');}
   await Promise.all(actors.filter(Boolean).map(actor=>motion(actor,[{translate:'-12px -20px'},{translate:'0 0',filter:'brightness(1)'}],180)));
  }
  if(battle.outcome){
   root.dataset.choreography='outcome';
   if(battle.outcome==='lose'){setPalFrame(player,2);sound('lose');}
   await motion(battle.outcome==='win'?enemy:player,[{opacity:1},{opacity:battle.outcome==='win'?0:.55,filter:'grayscale(1)'}],650);
  }
  await Promise.all([numbers,flash]);
 }finally{
  abort();effects.forEach(e=>e.remove());delete root.dataset.choreography;
  setPalFrame(player,battle.outcome==='lose'?2:0);setPalFrame(enemy,0);
  root.querySelectorAll('.pal-companion').forEach(actor=>{setPalFrame(actor,0);actor.classList.remove('assisting');});
  battle.controller?.signal.removeEventListener('abort',abort);
 }
}
