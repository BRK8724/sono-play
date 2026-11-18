import type { PlayerSnapshot } from '../services/MiniappService';

export type PreviewScreen = {
  id: string;
  title: string;
  group: string;
  panel?: string;
  scene?: 'READY' | 'PLAYING' | 'GAME_OVER';
  score?: number;
  fixture?: Partial<PlayerSnapshot>;
  skin?: number;
  tab?: 'total' | 'day' | 'history';
  previous?: boolean;
  muted?: boolean;
  host?: boolean;
};

export const screens: PreviewScreen[] = [
  { id: 'host', title: 'SONO аппын нүүр', group: 'Тоглох хэсэг', host: true },
  {
    id: 'nickname',
    title: 'Тоглогчийн нэр',
    group: 'Nickname хэсэг',
    panel: 'nickname',
    fixture: { nicknameRequired: true },
  },
  {
    id: 'nickname-success',
    title: 'Нэр амжилттай үүслээ',
    group: 'Nickname хэсэг',
    panel: 'nickname-success',
  },
  {
    id: 'nickname-failure',
    title: 'Нэр давхардсан',
    group: 'Nickname хэсэг',
    panel: 'nickname-failure',
  },
  { id: 'home', title: 'Үндсэн цэс', group: 'Тоглох хэсэг' },
  { id: 'home-muted', title: 'Хөгжим унтраасан', group: 'Тоглох хэсэг', muted: true },
  { id: 'ready', title: 'Эхлэх · 3 эрх', group: 'Тоглох хэсэг', scene: 'READY' },
  {
    id: 'playing',
    title: 'Тоглож байгаа · 78 оноо',
    group: 'Тоглох хэсэг',
    scene: 'PLAYING',
    score: 78,
  },
  {
    id: 'gameover-retry',
    title: 'Дахин тоглох · 2 эрх',
    group: 'Тоглох хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    fixture: { attempts: 2 },
  },
  {
    id: 'ready-two',
    title: 'Эхлэх · 2 эрх',
    group: 'Тоглох хэсэг',
    scene: 'READY',
    fixture: { attempts: 2 },
  },
  {
    id: 'gameover-empty',
    title: 'Эрх дууссан',
    group: 'Тоглох хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    fixture: { attempts: 0 },
  },
  { id: 'store-pilot', title: 'Pilot · идэвхтэй', group: 'Store хэсэг', panel: 'store', skin: 0 },
  { id: 'store-santa', title: 'Santa · 1,500 оноо', group: 'Store хэсэг', panel: 'store', skin: 1 },
  { id: 'store-gold', title: 'Goldie · 3,000 оноо', group: 'Store хэсэг', panel: 'store', skin: 2 },
  {
    id: 'store-santa-unlocked',
    title: 'Santa · нээгдсэн',
    group: 'Store хэсэг',
    panel: 'store',
    skin: 1,
    fixture: { total: 1500 },
  },
  {
    id: 'store-gold-unlocked',
    title: 'Goldie · нээгдсэн',
    group: 'Store хэсэг',
    panel: 'store',
    skin: 2,
    fixture: { total: 3000 },
  },
  {
    id: 'skin-success',
    title: 'Загвар идэвхжлээ',
    group: 'Store хэсэг',
    panel: 'skin-success',
    fixture: { total: 1500, selectedBird: 'santa' },
  },
  { id: 'skin-failure', title: 'Загварын алдаа', group: 'Store хэсэг', panel: 'skin-failure' },
  { id: 'stats-total', title: 'Нийт чансаа', group: 'Stats хэсэг', panel: 'stats', tab: 'total' },
  {
    id: 'stats-today',
    title: 'Өнөөдрийн чансаа',
    group: 'Stats хэсэг',
    panel: 'stats',
    tab: 'day',
  },
  {
    id: 'stats-previous',
    title: 'Өмнөх өдрийн чансаа',
    group: 'Stats хэсэг',
    panel: 'stats',
    tab: 'day',
    previous: true,
  },
  {
    id: 'stats-history',
    title: 'Миний амжилтууд',
    group: 'Stats хэсэг',
    panel: 'stats',
    tab: 'history',
  },
  {
    id: 'buy-warning',
    title: 'Дахин тоглох эрх',
    group: 'Амь авах хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    fixture: { attempts: 0 },
    panel: 'buy-warning',
  },
  {
    id: 'buy-one',
    title: '1 амь · 20 SP',
    group: 'Амь авах хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    fixture: { attempts: 0, points: 1750 },
    panel: 'buy',
  },
  {
    id: 'buy-two',
    title: '2 амь · 40 SP',
    group: 'Амь авах хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    fixture: { attempts: 0, points: 1750 },
    panel: 'buy',
  },
  {
    id: 'points-refresh',
    title: 'Пойнт шинэчлэх',
    group: 'Амь авах хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    fixture: { attempts: 0, points: 1750 },
    panel: 'buy',
  },
  {
    id: 'native-confirmation',
    fixture: { attempts: 0, points: 1750 },
    title: 'SONO баталгаажуулалтын загвар',
    group: 'Амь авах хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    panel: 'pin-preview',
  },
  {
    id: 'purchase-success',
    title: 'Амь нэмэгдлээ',
    group: 'Амь авах хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    fixture: { attempts: 2, freePlaysLeft: 0, lives: 2, points: 1710 },
    panel: 'success',
  },
  {
    id: 'purchase-failure',
    title: 'Пойнт хүрэлцэхгүй',
    group: 'Амь авах хэсэг',
    scene: 'GAME_OVER',
    score: 78,
    fixture: { attempts: 0, points: 0 },
    panel: 'failure',
  },
  { id: 'gifts', title: 'Өдрийн ба нийт бэлэг', group: 'Бэлэг хэсэг', panel: 'gifts' },
  { id: 'rules', title: 'Дүрэм · V2.1', group: 'Дүрэм хэсэг', panel: 'rules' },
  { id: 'lives', title: 'Амь авсан жагсаалт', group: 'Амийн жагсаалт', panel: 'lives' },
  {
    id: 'winner',
    title: 'Өдрийн ялагчийн popup',
    group: 'Ялагчийн popup',
    host: true,
    panel: 'winner',
  },
  { id: 'settings', title: 'Дуу ба чичиргээ', group: 'Тохиргоо', panel: 'settings' },
];
