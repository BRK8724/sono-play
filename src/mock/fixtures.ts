import type { CatalogItem, LeaderboardRow, PlayerSnapshot } from '../services/MiniappService';
import { GAME_RULES } from '../gameRules.ts';

// Demo values are replaceable together with MockMiniappService.
export const DEMO_POINT_COST = GAME_RULES.pointsPerLife;
export const birds: CatalogItem[] = [
  { id: 'pilot', name: 'PILOT SONO', image: 'sono/default-bird.webp', price: 0 },
  { id: 'santa', name: 'SANTA SONO', image: 'final/santa-sono-17ec9cf4.png', price: 0 },
  { id: 'gold', name: 'GOLDIE', image: 'final/gold-sono-871113b4.png', price: 0 },
];
export const backgrounds: CatalogItem[] = [
  { id: 'classic', name: 'SONO SKY', image: 'sono/game-background.webp', price: 0 },
  { id: 'city', name: 'CITY', image: 'final/image-edff662b.png', price: 0 },
  { id: 'sunset', name: 'SUNSET', image: 'final/image-ff2ec072.png', price: 350 },
];
export const initialPlayer: PlayerSnapshot & {
  points: number;
  freePlaysLeft: number;
  lives: number;
} = {
  name: 'ROCKET',
  phone: '99•• ••88',
  points: 5000,
  attempts: 3,
  freePlaysLeft: 3,
  lives: 0,
  best: 78,
  total: 120,
  selectedBird: 'pilot',
  selectedBackground: 'classic',
  owned: ['pilot', 'classic', 'city', 'sunset'],
};
export const leaderboard: LeaderboardRow[] = [
  { rank: 1, name: 'SKY SONO', score: 2101 },
  { rank: 2, name: 'NOMAD', score: 1786 },
  { rank: 3, name: 'BOLD', score: 1674 },
  { rank: 4, name: 'FLY HIGH', score: 1610 },
  { rank: 5, name: 'SUNNY', score: 1581 },
  { rank: 6, name: 'PILOT', score: 1543 },
  { rank: 7, name: 'SOYOL', score: 1490 },
  { rank: 8, name: 'TENGER', score: 1345 },
  { rank: 9, name: 'NARAA', score: 1260 },
  { rank: 10, name: 'BIRDIE', score: 1000 },
];
export const prizeRows = [
  [
    '1-2f376ac8.png',
    'emart-7c18301f.png',
    'primeat-60bdaeb6.png',
    'next-587d32f9.png',
    'sono-egg-fc5e46e6.png',
    'narut-med-4ee71895.png',
  ],
  [
    '2-bac79ef2.png',
    'emart-7c18301f.png',
    'primeat-60bdaeb6.png',
    'next-587d32f9.png',
    'sono-egg-fc5e46e6.png',
  ],
  ['3-e056ccfc.png', 'emart-7c18301f.png', 'primeat-60bdaeb6.png', 'next-587d32f9.png'],
  ['4-4de3e1d6.png', 'emart-7c18301f.png', 'primeat-60bdaeb6.png'],
  ['5-23119fa4.png', 'emart-7c18301f.png'],
];

export const otherPlayers: LeaderboardRow[] = Array.from({ length: 47 }, (_, index) => ({
  rank: index + 11,
  name: `SONO ${index + 11}`,
  score: 980 - index * 18,
}));
