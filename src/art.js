export const icon = (name, size = 20) => {
 const paths = {
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  sword:'<path d="m14 4 6-1-1 6L8 20l-4-4Z M5 12l7 7 M3 21l3-3"/>',
  bag:'<rect x="5" y="7" width="14" height="14" rx="4"/><path d="M9 7V5a3 3 0 0 1 6 0v2 M8 14h8v4H8Z"/>',
  trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 2h8"/>',
  settings:'<path d="M9.13 5.07L10.57 4.64L10.44 2.12L13.56 2.12L13.43 4.64L14.87 5.07L16.19 5.78L17.88 3.91L20.09 6.12L18.22 7.81L18.93 9.13L19.36 10.57L21.88 10.44L21.88 13.56L19.36 13.43L18.93 14.87L18.22 16.19L20.09 17.88L17.88 20.09L16.19 18.22L14.87 18.93L13.43 19.36L13.56 21.88L10.44 21.88L10.57 19.36L9.13 18.93L7.81 18.22L6.12 20.09L3.91 17.88L5.78 16.19L5.07 14.87L4.64 13.43L2.12 13.56L2.12 10.44L4.64 10.57L5.07 9.13L5.78 7.81L3.91 6.12L6.12 3.91L7.81 5.78Z"/><circle cx="12" cy="12" r="3"/>',
  sound:'<path d="M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="M11 4 6 8H3v8h3l5 4ZM16 9l5 6m0-6-5 6"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8L21 9h-8Z"/>',
  heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 3 11 8 15 5-4 13-10 8-15Z"/>',
  book:'<path d="M12 6C9 3 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-4-1-7 0-10 2Zm0 0v15"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  check:'<path d="m5 12 5 5L20 7"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  bulb:'<path d="M9 18v-2a7 7 0 1 1 6 0v2Zm0 3h6m-3-9V8"/>',
  calculator:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 6h8v4H8Zm0 8h1m3 0h1m3 0h.1M8 18h1m3 0h1m3 0h.1"/>',
  shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-4 9 3 3 5-5"/>',
  flag:'<path d="M5 22V3m0 1c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
  fire:'<path d="M13 2s2 7-2 10c-2-1-3-3-3-3S1 17 8 21c7 4 14-2 11-9-2-5-6-10-6-10Z"/>',
  leaf:'<path d="M20 3C2 1 1 14 7 18c7 5 13-4 13-15ZM5 21 16 9"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3h.01"/>',
 };
 return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>`;
};

export function student(extra='') {
 return `<svg class="student-art ${extra}" viewBox="0 0 240 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="拿着铅笔剑的学生勇者" role="img"><ellipse cx="115" cy="261" rx="73" ry="9" fill="#283e34" opacity=".12"/><g stroke="#303c32" stroke-width="4" stroke-linejoin="round"><path d="m62 140-21 15 8 59 36 1 13-70Z" fill="#edb750"/><path d="m83 213-4 34-19 5c-6 6-4 11 2 12l39-1 7-47m16-3 7 38 25 2c9 2 12 9 5 12h-40l-17-48" fill="#344a42"/><path d="m85 126-19 35 12 56c19 9 46 9 61-3l3-62-24-26Z" fill="#fff9e9"/><path d="m96 133 10 18 14-20m-16 20 1 26"/><path d="m72 145-18 27 24 15 12-13-12-8 11-16" fill="#fff9e9"/><path d="m119 136 25 10 25-30 14 10-29 45c-5 8-10 6-15 4l-19-10" fill="#fff9e9"/><path d="m167 118 3-12c1-5 5-4 7 0l3 6 7-4c10-2 13 9 5 16l-11 7Z" fill="#f0b68f"/><path d="m83 178 13-1c14 2 9 16-1 15l-13-5" fill="#f0b68f"/><path d="m173 115 31-84 10 4-27 85Z" fill="#f2b843"/><path d="m204 31 12-17-2 21Z" fill="#fff7dc"/><path d="m216 14-3 5"/><path d="m164 115 28 10" stroke-width="6"/><path d="m98 113-3 18c8 10 19 10 25 0l-3-22" fill="#f0b68f"/><path d="M61 78c-8-10-1-20 8-17-3-23 22-48 50-34 26-5 42 17 33 37l-5 36-74 9Z" fill="#344a42"/><path d="M76 73c-15-8-21 14-5 20l7 1c4 34 47 43 64 15 7-12 7-26 5-36-17 3-31-4-40-17-4 12-17 20-31 17Z" fill="#f0b68f"/><path d="m73 79 4 7m27 1v5m24-6v5"/><path d="M107 107q11 10 18-3" fill="#fff9e9"/><path d="m115 91-2 7 5 1" stroke-width="2"/><path d="m84 124-5 9 16 10 9-10m15-5 8 8-12 10-10-13" fill="#fff9e9"/><path d="m130 187 3 16-16 2" stroke="#b9bbae" stroke-width="2"/></g><circle cx="93" cy="101" r="6" fill="#e88972" opacity=".6"/></svg>`;
}

export function monster(type, extra='') {
 const palettes = { chinese:['#93b69b','#e1e8cb'], math:['#edaa69','#f9d4a0'], english:['#a69bc6','#e3daf0'], history:['#d6b771','#f4e0b0'], geography:['#8db0a8','#c6ded0'], physics:['#90adc9','#d9e7ec'] };
 const [c,l]=palettes[type] || palettes.math;
 let body='';
 if(type==='chinese') body=`<path d="m53 73 49-6 18 13 18-13 48 7-7 89-44-3-15 9-18-10-43 5Z" fill="${c}"/><path d="m63 80 40-4 16 12 17-12 39 5-5 68-34-2-16 11-18-11-34 4Z" fill="${l}"/><path d="M119 88v64"/><path d="M78 94h20m-24 12h20m48-13h19m-18 14h20" stroke-width="3"/><path d="m90 127 10-5m40 0 10 5"/><path d="m108 136 10 7 13-8" fill="#fff"/><path d="m113 67 4-23 8 8 7-15 5 35" fill="#df784e"/>`;
 else if(type==='math') body=`<path d="m67 66 94-8 17 94-21 17-89-3-15-15Z" fill="${c}"/><path d="m66 66 13-14 94-5-12 11m12-11 19 98-14 7" fill="${l}"/><path d="m75 78 70-6 5 35-69 6Z" fill="#fff2cc"/><path d="m90 90 8 8 7-10m18-1 12 8m-12 0 12-8"/><rect x="82" y="123" width="14" height="12" rx="3" fill="${l}"/><rect x="106" y="121" width="14" height="12" rx="3" fill="${l}"/><rect x="130" y="119" width="14" height="12" rx="3" fill="${l}"/><path d="m108 145 10 5 11-7"/><path d="m61 68-9-22 19 11m83 0 10-23 8 14" fill="${c}"/>`;
 else if(type==='english') body=`<path d="M66 156c-17-25-12-51 6-64-5-30 20-49 40-33 26-27 52-12 53 10 27 0 31 27 18 45 16 28 0 52-23 45-14 17-38 18-51 6-19 14-35 7-43-9Z" fill="${c}"/><path d="M77 103c8-18 57-27 82-7l-2 47-66 6Z" fill="${l}" stroke="none"/><path d="m89 108 10 5 7-8m28 0 8 7 9-7m-41 25 12 6 13-9"/><path d="m85 66-2-16m7 1-15 4"/><text x="165" y="67" stroke="none" fill="#6a5a80" font-family="Georgia" font-size="34" font-weight="bold">?</text>`;
 else if(type==='history') body=`<path d="M74 74h89l10 86H64Z" fill="${c}"/><path d="M68 75 57 62l24-8 10-25 25 12 25-12 10 25 24 8-10 14Z" fill="${l}"/><path d="m80 82 77 0-3 21H83Z" fill="#9b7850"/><path d="m88 112 13 2m32 0 13-2m-45 21 14 8 15-9"/><path d="m77 151 14-8m60 8-13-8"/><path d="M116 47v16m-8-8h16"/><path d="m69 110-14 10-17-10m130 1 17 10 15-12"/>`;
 else if(type==='geography') body=`<circle cx="119" cy="112" r="58" fill="${c}"/><path d="m90 63 19 20-12 14 8 17-18 14-21-13m65-58-3 27 21 14 22-4m-32 25-19 17 5 25 16 4 25-25Z" fill="${l}"/><path d="m96 110 7 5 8-7m22 0 7 7 9-5m-36 23 10 5 10-6"/><path d="m74 65 9-15c38-23 73-3 89 26m-5 84c-29 22-69 17-93-9"/><path d="m126 172-2 14m-18 0h37"/>`;
 else body=`<path d="m99 58-6 33-31 44c-15 26 8 39 26 39h64c22 0 38-15 22-40l-31-43-5-33Z" fill="${l}"/><path d="m78 119-15 24c-6 14 10 23 26 23h62c19 0 29-10 19-24l-15-23c-28 9-47-10-77 0Z" fill="${c}" stroke="none"/><rect x="93" y="46" width="51" height="15" rx="6" fill="${c}"/><path d="m97 130 8 5 7-6m19 1 8 5 7-7m-34 21 10 5 9-6"/><circle cx="112" cy="98" r="5" fill="white" stroke="none"/><circle cx="135" cy="78" r="4" fill="white" stroke="none"/><path d="m159 64 10-12m-5-5 5 5 8 1"/>`;
 return `<svg class="monster-art ${extra}" viewBox="0 0 240 210" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="学科知识怪物"><ellipse cx="120" cy="190" rx="65" ry="7" fill="#303d34" opacity=".09"/><g stroke="#3b4437" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="m82 155-9 29-12 3m91-32 10 30 13 1M62 112l-19 17-12-8m144-6 19 15 14-12"/>${body}</g></svg>`;
}

export function heroArt() {
return `<div class="hero-art"><span class="art-spark spark-one">✦</span><span class="art-spark spark-two">✧</span><span class="art-formula">A+ ↑</span><span class="art-orbit"></span><span class="art-label">知识就是战斗力！</span><div class="hero-student">${student()}</div><span class="versus">VS</span><div class="hero-monster">${monster('math')}</div><span class="art-ground"></span><span class="art-doodle">✳</span><span class="floating-paper">x + y<br/> = ?</span></div>`;
}
