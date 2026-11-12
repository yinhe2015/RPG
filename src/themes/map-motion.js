const timers=new WeakMap();
export function defaultMapStep(player,facing,moved){
 clearTimeout(timers.get(player));player.dataset.facing=facing||'down';player.classList.remove('walking');
 if(!moved)return;void player.offsetWidth;player.classList.add('walking');
 timers.set(player,setTimeout(()=>player.classList.remove('walking'),170));
}
