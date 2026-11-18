import type { LeaderboardRow } from '../services/MiniappService';
import { leaderboard } from './fixtures.ts';

export const dailyLeaders: LeaderboardRow[] = leaderboard.map((row) => ({
  ...row,
  score: Math.floor(row.score * 0.35),
}));
export const previousLeaders: LeaderboardRow[] = leaderboard.map((row) => ({
  ...row,
  score: Math.floor(row.score * 0.25),
}));
export const scoreHistory = [
  { date: '2026.11.17', score: 78, rank: 58 },
  { date: '2026.11.16', score: 22, rank: 62 },
  { date: '2026.11.15', score: 12, rank: 71 },
  { date: '2026.11.14', score: 5, rank: 82 },
  { date: '2026.11.13', score: 2, rank: 96 },
  { date: '2026.11.12', score: 1, rank: 120 },
  { date: '2026.11.11', score: 0, rank: 200 },
];
export const lifeHistory = [
  { date: '11.16 18:45', reason: 'Тоглолт · 10 удаа', amount: -10 },
  { date: '11.16 10:45', reason: 'Хугацаандаа төлөлт', amount: 10 },
  { date: '11.15 17:10', reason: 'Тоглолт · 3 удаа', amount: -3 },
  { date: '11.15 16:20', reason: 'Зээл сунгасан', amount: 3 },
  { date: '11.14 14:12', reason: 'Тоглолт · 2 удаа', amount: -2 },
  { date: '11.14 11:40', reason: 'SONO пойнт', amount: 2 },
];
export const freeLifeHistory = [
  { date: '2026.11.17', reason: 'Өдрийн үнэгүй эрх', amount: 3 },
  { date: '2026.11.16', reason: 'Өдрийн үнэгүй эрх', amount: 3 },
  { date: '2026.11.15', reason: 'Өдрийн үнэгүй эрх', amount: 3 },
  { date: '2026.11.14', reason: 'Өдрийн үнэгүй эрх', amount: 3 },
];
export const earnedLifeRows = [
  ['Хугацаандаа төлөлт', '+10'],
  ['Эрт төлөлт · 3+ хоног', '+10'],
  ['Хоцролт барагдуулах', '+5'],
  ['Зээл сунгах', '+3'],
  ['Зээл хаах · 7+ хоног', '+15'],
  ['Хоцорч зээл хаах', '+5'],
  ['20 SONO пойнт', '+1'],
];
