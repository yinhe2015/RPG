import {scene} from '../voxel.js';
import '../voxel.css';

export default {
 scene,
 dungeon:{hero:()=>'<span class="map-voxel-hero"><i></i><b></b></span>',enemy:({foe,monster})=>`<span class="map-voxel-foe" style="--foe-hue:${foe.hue}deg">${monster.boss?'♛':'◆'}</span>`},
 motion:{actors:['.voxel-player','.voxel-monster']},
};
