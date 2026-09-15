import {scene,commands} from '../pal.js';
import assets from '../pal-assets.json';
import {palSpriteFor} from '../pal-monsters.js';
import {palWalkingSprite,animateMapPlayer} from '../../ui/pal-walk.js';
import {palAttack} from '../../ui/pal-motion.js';
import '../pal.css';

export default {
 scene,commands,
 dungeon:{hero:({dungeon})=>palWalkingSprite(dungeon.facing),enemy:({foe})=>`<img src="/themes/pal/${assets.enemies[palSpriteFor(foe)].poses[0].src}" alt="">`,step:animateMapPlayer},
 motion:{actors:['.pal-leader','.pal-enemy'],attack:palAttack},
 classes:{question:'pal-question'},
};
