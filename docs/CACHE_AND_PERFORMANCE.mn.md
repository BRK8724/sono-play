# SONO Play cache, release ба ачааллын төлөвлөгөө

Энэ баримтын Nginx domain, зам, TTL болон Redis key нь хэрэгжүүлэх жишээ. `deploy/nginx.conf.example` нь идэвхтэй серверийн тохиргоонд суулгахын өмнө тухайн hosting-д тааруулж шалгах template. Play backend-ийн эх код энэ frontend repository-д нийлүүлэгдэхийг хүлээж байна. Redis leaderboard хэсэг нь backend-ийн хийх ажил байна.

**Frontend-ийн cache бодлого**

| URL төрөл | Header / хадгалалт |
|---|---|
| `/sono-play/`, `index.html`, `release-manifest.json` | `Cache-Control: no-cache`, release бүрт revalidate |
| `assets/static/…/<нэр>-<16 hex hash>.<ext>` | Нэг жилийн `public, immutable`; агуулга өөрчлөгдөхөд URL өөрчлөгдөнө |
| Vite-ийн hash-тай JS/CSS | Нэг жилийн `public, immutable` |
| Бусад hash-гүй static файл | Revalidate; immutable дүрэмд оруулахгүй |
| `/api/v1/…` | `private, no-store`; Nginx/CDN proxy cache унтраалттай |

Зураг, font, SVG болон бусад runtime asset нь build-ийн `assets/static/` namespace-д агуулгын hash-тай гарна. `release-manifest.json` нь тухайн release-ийн зураглалыг өгнө. API доторх Top 10-ийг Redis-ээр хуваалцаж cache хийх боломжтой ч HTTP-ийн хэрэглэгчтэй холбогдсон response envelope нь хувийн `me`, profile, order болон token мэдээлэл агуулдаг. Тиймээс API response-д public cache хэрэглэхгүй. Nginx template нь статик болон API cache-ийг өөр location-оор тохируулсан. [Nginx headers](https://nginx.org/en/docs/http/ngx_http_headers_module.html), [Nginx proxy cache](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

**Release байршуулах санал**

```text
/srv/sono-play/
  releases/<release-id>/sono-play/   # тухайн build-ийн dist файлууд
  current -> releases/<release-id>  # идэвхтэй release
  shared/sono-play/assets/          # одоогийн + хуучин content-hash файлууд
```

Тусдаа API origin ашиглах build-ийн жишээ дараах байдалтай. Domain нь placeholder, `VITE_API_BASE_URL` нь `/api/v1` хэсгийг агуулахгүй.

```bash
npm ci
npm run check
VITE_SERVICE_MODE=api VITE_API_BASE_URL=https://play-api.example.com npm run build -- --base=/sono-play/
```

Зорилтот Linux VPS дээр шинэ release-ийн `dist/`-ийг `releases/<шинэ-id>/sono-play/` руу бүтнээр хуулна. `dist/assets/`-ийн hash файлуудыг `shared/sono-play/assets/` руу нэмэлтээр хуулж дуусгаад `current` symlink-ийг атомик rename-аар шинэ release рүү шилжүүлнэ. Shared хавтсанд хуучин hash-уудыг үлдээж, нээлттэй WebView болон rollback-ийн дэмжих хугацаатай нийцүүлэн цэвэрлэнэ. Assets-ийг байршуулсны дараа шинэ HTML-ийг идэвхжүүлэх нь хуучин/шинэ bundle холилдож 404 үүсэхээс сэргийлнэ.

Root `/` дээр host хийх бол `--base=/` ашиглаж, release дотор `dist/`-ийг шууд байрлуулна. Shared assets нь `shared/assets/` болно. Template-ийн `/sono-play/` prefix-үүдийг `/` болгон тааруулж, `/sono-play` → `/sono-play/` redirect block-ийг авна. Одоогийн UI query route ашигладаг тул үл мэдэгдэх asset/path-д HTML fallback өгөх шаардлагагүй.

Template-ийн static vhost-ийг vendor hosting-д, API vhost/upstream-ийг манай Play VPS-д тохируулна. TLS certificate, бодит domain болон backend listen address-ийг hosting тал нийлүүлнэ. Template нь CORS response header-ийг Nginx дээр нэгтгэж, давхардал үүсгэх upstream CORS header-уудыг дарна. Тусдаа origin-ийн CORS нь зөвшөөрсөн frontend origin болон одоогийн `Authorization`, `Content-Type`, `Idempotency-Key` header-уудыг дэмжинэ. Same-origin `/api/v1/` proxy сонговол template-ийн optional block-ийг тухайн namespace-тай уялдуулж, API base-ийг хоосон өгнө. Энэ route нь origin root дээр байна.

Зорилтот Nginx дээр `nginx -t` хийж, reload-ийн дараа бодит URL-уудын header-ийг шалгана. Локал орчинд Nginx binary олдоогүй тул template-ийн Nginx syntax шалгалт хүлээгдэж байна.

```bash
nginx -t
curl -I https://miniapps.example.com/sono-play/
curl -I https://miniapps.example.com/sono-play/release-manifest.json
# Доорхыг build manifest дахь бодит hash URL-аар орлуулна.
curl -I https://miniapps.example.com/sono-play/assets/static/fonts/mogul-square-HASH.ttf
curl -i -X OPTIONS https://play-api.example.com/api/v1/me -H 'Origin: https://miniapps.example.com' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: Authorization'
curl -i https://play-api.example.com/api/v1/me
```

HTML/manifest дээр revalidation, hash asset дээр immutable, 401 зэрэг API алдааны response дээр ч `no-store` гарч байгааг шалгана. Authenticated API header шалгалтыг staging-ийн нэвтэрсэн WebView-ээр хийж token-ийг report/log-д бичихээс зайлсхийнэ. CORS зөвшөөрөл нь серверийн хэрэглэгчийн authentication-тай хамт ажиллана.

**Redis leaderboard — backend хэрэгжүүлэх санал**

| Key-ийн жишээ | Агуулга |
|---|---|
| `lb:{5:total}:scores` | Tournament 5-ийн server-accepted aggregate score ZSET |
| `lb:{5:total}:top:10` | Бүх хэрэглэгчид хуваалцсан Top 10 + үүсгэсэн цаг/revision |
| `lb:{5:total}:me:402` | Зөвхөн authenticated player 402-ийн rank/score |
| `lb:{5:day:2026-11-18}:scores` | Өдрийн standings endpoint нэмэгдэх үеийн УБ өдрийн namespace |

Одоогийн Player API зөвхөн тэмцээний нийт leaderboard өгдөг. Өнөөдөр/өмнөх өдрийн standings, хувийн болон амийн түүх, SP balance-ийн endpoint-ууд backend интеграц хүлээж байна. Key-д tournament ба period оруулж, шинэ тэмцээний оноо өмнөх тэмцээний cache-тай холилдохоос хамгаална.

Server FINISHED дүнг өгөгдлийн санд нэг удаа commit хийсний дараа aggregate total + revision бүхий outbox event гаргана. Redis worker нь баталгаажсан aggregate-ийг `ZADD`-аар шинэчилж, хуучин/давхардсан revision-ийг transaction/Lua-гаар алгасана. Client-ийн дурын оноог cache-д шууд нэмж эрх/шагнал тооцох суваг үүсгэхгүй. Top 10-д `ZRANGE … REV WITHSCORES`, өөрийн байранд `ZREVRANK + 1` хэрэглэж болно. Тэнцсэн онооны эрэмбэлэх дүрмийг backend-ийн баталсан дүрэмтэй нийцүүлнэ. [Redis sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/), [Redis ZREVRANK](https://redis.io/docs/latest/commands/zrevrank/).

Эхлэх туршилтын утга болгон shared Top 10-д 15 секунд, own-rank cache-д 5 секунд санал болгож байна. Accepted finish дээр ZSET/revision шинэчилж, тухайн хэрэглэгчийн own-rank key-ийг invalidate хийнэ. Top 10-д dirty marker тавьж, жишээлбэл таван секундийн цонхоор нэгтгэн rebuild хийнэ. Өөрийн rank-ийн бусад хэрэглэгчид нөлөөлсөн өөрчлөлт TTL-ээр шинэчлэгдэнэ. Ижил үеийн cache miss-үүдийг single-flight-аар нэгтгэж, олон Play instance байвал owner-token/хугацаатай Redis lock эсвэл нэг rebuild worker хэрэглэнэ. Request бүрт бүх rank cache-ийг устгах ачааллаас зайлсхийнэ. TTL болон rebuild давтамжийг staging-ийн бодит ачааллаар тааруулна.

`me`-ийн player ID-г сервер access token-оос тогтооно. Shared Top 10 cache-д өөрийн байр, SP, profile болон order мэдээлэл хийхгүй. Redis доголдвол одоогийн `LEADERBOARD_UNAVAILABLE` алдаа болон хяналттай сэргээх урсгал ашиглаж, Core-оос онооны жагсаалт дахин тооцох ачаалал үүсгэхгүй. Тэмцээний эцсийн дүн, эрх болон санхүүгийн бүртгэлийн хадгалалт DB/серверийн гэрээгээр шийдэгдэнэ. SEC-02 trusted-score болон бодит шагналын шийдэл тусдаа хүлээгдэж байна.

**Клиент ба VPS дээр хэмжих зүйл**

Dev URL-ийн `?mode=mock&perf=1` нь FPS, p95 frame interval, Phaser canvas-ийн rendered-frame тоог локал overlay-д харуулна. Console дахь `window.__SONO_PERFORMANCE__.snapshot()` / `reset()`-ийг ашиглаж болно. Timing sample 1,800-аар хязгаарлагдаж browser memory-д байрлана. HTTP telemetry болон хэрэглэгчийн өгөгдөл хадгалах урсгал үүсгэхгүй. `jsHeapMiB` нь browser дэмжсэн үеийн JS heap бөгөөд GPU memory хэмжилт тусдаа хэрэгтэй. Production build-д энэ dev diagnostic хасагдана.

Staging дээр frame timing, background/idle үеийн render, texture өсөлт, WebView дахин нээх memory-г төхөөрөмжөөр хэмжинэ. Play backend дээр p95/p99 start/finish/leaderboard latency, Redis hit rate, rebuild/queue lag, DB connection, CPU/RAM болон request rate-ийг зэрэг хэмжинэ. 200,000 зэрэг хэрэглэгчийн даацыг frontend build эсвэл Redis key төлөвлөгөөнөөс урьдчилан батлах боломжийн хэмжилт хүлээгдэж байна.

Flutter bridge, Core callback, hosting ownership болон production шилжүүлэх урсгалын тайлбар нь deployment баримтад байна. [Production deployment](PRODUCTION_DEPLOYMENT.mn.md), [Current backend integration](../README_BACKEND.md).


2026-11-18 timing засвар: Phaser-ийн default smoothing нь бага FPS дээр wake бүрийн эхний хугацааг 60Hz target-аар хавчиж, дараа нь бодит хурд руу шилжүүлж байсныг `GAME_FRAME_TIMING.smoothStep=false` болгож зассан. Physics fixed120Hz хэвээр. Dev snapshot дахь `rawFrameMs`, `gameFrameMs`, `clockSmoothing` болон overlay-ийн Clock raw/game утгаар төхөөрөмж дээр дахин шалгана. 30/60/120 FPS replay болон frame-rate шилжилтийн regression тест нэмэгдсэн.
