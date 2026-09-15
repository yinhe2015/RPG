import katex from 'katex';
import {esc} from './html.js';

// Only math delimiters are interpreted. Ordinary text remains escaped, including imported HTML.
export function questionText(value){
 const input=String(value??''),pattern=/\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$]+?)(?<!\\)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
 let output='',end=0;
 for(const match of input.matchAll(pattern)){
  output+=esc(input.slice(end,match.index));
  const formula=match[1]??match[2]??match[3]??match[4];
  try{output+=`<span class="question-math">${katex.renderToString(formula,{displayMode:Boolean(match[1]||match[4]),throwOnError:true,trust:false,strict:'ignore',maxSize:15,maxExpand:1000})}</span>`;}
  catch{output+=`<span class="math-fallback">${esc(match[0])}</span>`;}
  end=match.index+match[0].length;
 }
 return output+esc(input.slice(end));
}
