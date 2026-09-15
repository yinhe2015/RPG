import {scene} from '../paper.js';
import {student} from '../../art.js';
import {paperMonster} from '../monsters.js';
import {defaultMapStep} from '../map-motion.js';

export default {
 scene,
 dungeon:{hero:()=>student(),enemy:({foe})=>paperMonster(foe),step:defaultMapStep},
 motion:{actors:['.player-character','.monster-character']},
 classes:{question:''},
};
