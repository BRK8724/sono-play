# Цэвэр vendor mini app: файл ба холболт

Энэ folder нь зөвхөн Flappy SONO mini app-ийн ажиллах эх код болон хэрэгтэй runtime asset-уудыг агуулна. Mock account, sample wallet, screen gallery, source design archive, test suite, `.git`, `node_modules` ороогүй.

## Үндсэн файлууд

| Файл | Үүрэг |
|---|---|
| `src/main.ts`, `src/Frontend.ts` | Тоглоомын scene болон UI |
| `src/services/ApiMiniappService.ts` | Player API-ийн session, эрх, catalog, leaderboard, order үйлдэл |
| `src/services/ApiClient.ts` | HTTP, launch token, request idempotency |
| `src/services/HostBridge.ts` | Flutter `SonoBridge` boundary |
| `src/gameplay.ts`, `src/layout.ts`, `src/displayScale.ts` | Тоглоомын тооцоолол, responsive layout, render scale |
| `build/runtime-assets.mjs` | Хувилбарласан static asset болон release manifest |
| `docs/api/player-openapi-2026-11-18-ui-audit.json` | Player API contract |
| `deploy/nginx.conf.example` | HTTPS reverse proxy/static hosting template |

## Урсгал

Flutter `SonoBridge.getLaunchToken()`-оор богино настай launch token өгнө. Frontend Player API-аас player state болон тоглолт эхлэхэд session ID, seed, physics config авна. Тоглолтын явцад API дуудахгүй. Game Over болоход үр дүнг нэг удаа илгээж, API-ийн verification төлөвийг харуулна. Client score нь эрх, оноо, мөнгөн шагналыг баталгаажуулахгүй.

Төлбөр идэвхжсэн үед Flutter `payWithPoints({orderId})` native callback өгч болно. Player API захиалгыг `PAID` гэж баталсны дараа UI амь шинэчлэгдэнэ. PIN болон Core credential WebView рүү орохгүй.

Дэлгэрэнгүйг `README_BACKEND.md`, `docs/SECURITY_SPEC.md`, `docs/DECISIONS_AND_GAPS.md` болон `docs/PRODUCTION_DEPLOYMENT.mn.md`-ээс үзнэ үү.
