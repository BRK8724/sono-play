import { screens } from './screens';
import { assetUrl } from '../assets';
import './gallery.css';

const groups = [...new Set(screens.map((screen) => screen.group))];
document.title = 'Flappy SONO · Дэлгэцүүд';
document.body.innerHTML = `<header><div><h1>FLAPPY SONO</h1><p>Дэлгэцүүд · V2.1 · Жишээ өгөгдөл</p></div><a href="${import.meta.env.BASE_URL}">ТОГЛООМ НЭЭХ ↗</a></header><main>${groups
  .map(
    (group) =>
      `<section><h2>${group}</h2><div class="screen-grid">${screens
        .filter((screen) => screen.group === group)
        .map(
          (screen) =>
            `<a class="screen-card" href="?mode=mock&screen=${screen.id}"><img loading="lazy" width="390" height="844" src="${assetUrl(`previews/${screen.id}.webp`)}" alt="${screen.title}" /><span>${screen.title}</span></a>`,
        )
        .join('')}</div></section>`,
  )
  .join(
    '',
  )}</main><footer>Santa · 1,500 нийт оноо / Goldie · 3,000 нийт оноо · 20 SP = 1 амь</footer>`;
