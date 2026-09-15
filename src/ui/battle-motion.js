import {sound} from '../audio.js';
import {getTheme} from '../themes/registry.js';
const reduced=()=>document.documentElement.dataset.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
const animate=(element,frames,options)=>element?.animate(frames,{fill:'none',...options});
const finished=animation=>animation?.finished.catch(()=>{});

// Animation consumes confirmed server results. It never changes health or awards XP.
export async function playBattleMotion(kind,theme,battle){
 const root=document.querySelector('#battle-arena');
 if(!root||reduced()){if(kind==='attack')sound(battle.lastCorrect?'right':'wrong');return;}
 const adapter=getTheme(theme);
 if(kind==='attack'&&adapter.motion.attack)return adapter.motion.attack(root,battle,{sound});
 if(kind==='attack')sound(battle.lastCorrect?'right':'wrong');
 const [playerSelector,monsterSelector]=adapter.motion.actors;
 const player=root.querySelector(playerSelector),monster=root.querySelector(monsterSelector),layer=root.querySelector('.arena-effects');
 if(!player||!monster)return;
 if(kind==='enter'){
  await Promise.all([finished(animate(player,[{opacity:0,translate:'-45px 0'},{opacity:1,translate:'0 0'}],{duration:650,easing:'ease-out'})),finished(animate(monster,[{opacity:0,translate:'45px 0',scale:'.8'},{opacity:1,translate:'0 0',scale:'1'}],{duration:800,easing:'ease-out'}))]);return;
 }
 if(kind==='summon'){
  await finished(animate(monster,[{opacity:.15,scale:'.65',filter:'brightness(2)'},{opacity:1,scale:'1',filter:'brightness(1)'}],{duration:600,easing:'ease-out'}));return;
 }
 const right=battle.lastCorrect,attacker=right?player:monster,target=right?monster:player;
 const bounds=root.getBoundingClientRect(),a=attacker.getBoundingClientRect(),t=target.getBoundingClientRect();
 const ax=a.x+a.width/2-bounds.x,ay=a.y+a.height*.5-bounds.y,tx=t.x+t.width/2-bounds.x,ty=t.y+t.height*.5-bounds.y;
 const direction=Math.sign(tx-ax),travel=Math.min(180,Math.abs(tx-ax)*.4);
 const lunge=animate(attacker,[{translate:'0 0'},{translate:`${direction*travel}px -15px`,offset:.38},{translate:`${direction*travel*.8}px -6px`,offset:.6},{translate:'0 0'}],{duration:750,easing:'ease-in-out'});
 const bolt=document.createElement('span');bolt.className=`arena-bolt ${right?'friendly':'hostile'} ${theme} spell-${battle.lastAction?.move.element||'spirit'}`;layer.append(bolt);
 bolt.style.left=`${ax}px`;bolt.style.top=`${ay}px`;
 const flight=animate(bolt,[{translate:'0 0',opacity:0,scale:'.4'},{translate:'0 0',opacity:1,scale:'1',offset:.2},{translate:`${tx-ax}px ${ty-ay}px`,opacity:1,scale:right&&battle.combo>=3?'1.7':'1',offset:.85},{translate:`${tx-ax}px ${ty-ay}px`,opacity:0,scale:'.3'}],{duration:620,delay:180,easing:'ease-in'});
 const impact=animate(target,[{translate:'0 0',filter:'brightness(1)'},{translate:`${direction*12}px 0`,filter:'brightness(2.2)',offset:.25},{translate:`${-direction*7}px 0`,filter:'brightness(1)',offset:.5},{translate:`${direction*5}px 0`,offset:.7},{translate:'0 0',filter:'brightness(1)'}],{duration:450,delay:620});
 for(let i=0;i<10;i++){
  const spark=document.createElement('i');spark.className=`arena-spark ${right?'friendly':'hostile'}`;spark.style.left=`${tx}px`;spark.style.top=`${ty}px`;layer.append(spark);
  const angle=i*Math.PI/5,distance=35+(i%3)*19;
  finished(animate(spark,[{translate:'0 0',opacity:0},{opacity:1,offset:.05},{translate:`${Math.cos(angle)*distance}px ${Math.sin(angle)*distance}px`,opacity:0,scale:'.1'}],{duration:650,delay:630,easing:'ease-out'})).then(()=>spark.remove());
 }
 const damage=document.createElement('b');damage.className='arena-damage';damage.textContent=battle.blocked&&!right?'格挡':`−${battle.lastAction?.totalDamage??(right?(battle.combo>=3?35:25):{easy:15,normal:20,hard:25}[battle.difficulty])}`;damage.style.left=`${tx}px`;damage.style.top=`${ty-35}px`;layer.append(damage);
 const number=animate(damage,[{opacity:0,translate:'-50% 10px',scale:'.6'},{opacity:1,translate:'-50% -10px',scale:'1.2',offset:.2},{opacity:1,translate:'-50% -35px',scale:'1',offset:.65},{opacity:0,translate:'-50% -65px',scale:'.9'}],{duration:1150,delay:600,easing:'ease-out'});
 if(battle.outcome){
  const defeated=battle.outcome==='win'?monster:player;
  await finished(animate(defeated,[{opacity:1,rotate:'0deg',scale:'1'},{opacity:1,rotate:'0deg',scale:'1',offset:.5},{opacity:.18,rotate:battle.outcome==='lose'?'-65deg':'0deg',scale:'.7'}],{duration:1700,easing:'ease-out'}));
 }
 await Promise.all([finished(lunge),finished(flight),finished(impact),finished(number)]);
 bolt.remove();damage.remove();
}
