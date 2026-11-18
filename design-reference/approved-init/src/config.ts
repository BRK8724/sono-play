// PROPOSED tune values; requires product QA approval before production.
export const CONFIG = {
  width: 360, height: 640, groundY: 565,
  gravity: 800, flapVelocity: -265,
  birdX: 102, scrollSpeed: 180, pipeWidth: 64, spawnStartX: 408,
  difficulty: [
    {at:0,gap:170,spacing:240},{at:25,gap:165,spacing:235},
    {at:50,gap:160,spacing:230},{at:75,gap:155,spacing:225},
    {at:100,gap:150,spacing:220},{at:150,gap:145,spacing:215},
    {at:200,gap:140,spacing:210}
  ],
  themes:['morning','day','evening','night'] as const,
  skinUnlocks:[0,50,100,200],
} as const;
export type ThemeName = typeof CONFIG.themes[number];
export function difficultyFor(score:number) { return [...CONFIG.difficulty].reverse().find(x=>score>=x.at)!; }
export function themeFor(score:number):ThemeName {return CONFIG.themes[Math.floor(score/25)%4];}
