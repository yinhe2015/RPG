import walk from '../themes/pal-walk.json';

const motions=new WeakMap();
const directionOf=d=>Object.hasOwn(walk.directions,d)?d:'down';

export function palWalkingSprite(facing){
 const direction=directionOf(facing),frame=walk.directions[direction].idle;
 return `<span class="map-pal-hero" data-facing="${direction}" data-frame="${frame}" style="background-image:url('/themes/pal/${walk.src}');--walk-frames:${walk.frames};--walk-position:${frame/(walk.frames-1)*100}%" aria-hidden="true"></span>`;
}

// One tile is one footstep. Consecutive moves alternate feet; a blocked
// move only turns the character. Timers belong to this DOM node, so an old
// scene cannot change the character after a battle or a theme switch.
export function animateMapPlayer(player,facing,moved){
 const previous=motions.get(player)||{foot:0};
 clearTimeout(previous.poseTimer);clearTimeout(previous.stopTimer);
 const sprite=player.querySelector('.map-pal-hero'),direction=directionOf(facing);
 const frames=walk.directions[direction];
 const setFrame=frame=>{if(!sprite)return;sprite.dataset.frame=String(frame);sprite.style.setProperty('--walk-position',`${frame/(walk.frames-1)*100}%`);};
 player.dataset.facing=direction;
 if(sprite)sprite.dataset.facing=direction;
 player.classList.remove('walking');
 if(!moved){setFrame(frames.idle);motions.set(player,previous);return;}
 void player.offsetWidth;
 player.classList.add('walking');
 setFrame(frames.walk[(previous.foot%2)*2]);
 motions.set(player,{
  foot:previous.foot+1,
  poseTimer:setTimeout(()=>setFrame(frames.idle),100),
  stopTimer:setTimeout(()=>player.classList.remove('walking'),170),
 });
}
