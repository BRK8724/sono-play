# SONO Play байршуулалт ба Flutter / Play / Core холболт

2026-11-18-ны код болон Player API гэрээнд үндэслэв. Доорх domain, hosting path болон архитектурын сонголтууд нь хэрэгжүүлэх санал бүхий жишээ. Бодит DNS, орчин, эрх болон сервер хоорондын гэрээг талууд нийлүүлнэ.

| Хэсэг | Санал болгосон жишээ байршил | Хариуцах тал |
|---|---|---|
| Miniapp HTML, JS, зураг, Mogul Square font | `https://miniapps.example.com/sono-play/` | Vendor-ийн static hosting/CDN |
| Play Player API | `https://play-api.example.com/api/v1/…` | Манай Play backend, өгөгдлийн сан, cache, лог |
| Core identity, SP, зээл, санхүүгийн бүртгэл | `https://core.internal.example/` гэсэн дотоод үйлчилгээний жишээ | Core эзэмшигч болон түүний vendor |
| Flutter доторх Play → Sono’s World | Дээрх miniapp URL-ийг нээх WebView | Flutter vendor |

Товшилт, нислэг, дүрслэл утсан дээр ажиллана. Session эхлүүлэх/дуусгах, эрх, чансаа, skin болон лог Play серверээр дамжина. Core нь identity, бодит SP суутгал, зээлийн үйлдэл болон төлөлтийн мэдээллийн эх үүсвэр байна.

1. **Frontend build ба байршуулах файл**

Node.js 22.18+ болон lockfile-тай эх кодоос build хийнэ. Доорх нь тусдаа API origin сонгосон `.env.production`-ийн жишээ. `VITE_API_BASE_URL` нь `/api/v1` нэмээгүй origin байна. Код endpoint-ийн `/api/v1/…` хэсгийг өөрөө нэмдэг.

```dotenv
VITE_API_BASE_URL=https://play-api.example.com
# Production launch token comes from SonoBridge.
```

```bash
npm ci
npm run format:check
npm run build -- --base=/sono-play/
```

Үүссэн `dist/` хавтсыг бүхлээр нь vendor-ийн `/sono-play/` замд байршуулж, Flutter-д төгсгөлдөө `/` тэмдэгтэй HTTPS URL өгнө. Mogul Square болон зураг/font файлууд build-д хамт орно. `index.html` болон `release-manifest.json`-ийг revalidate хийнэ. Runtime зураг, font, thumbnail нь build-ээр content hash-тай `assets/static/` URL авна. Эдгээр файл болон Vite-ийн hash-тай JS/CSS-д immutable cache хэрэглэж болно. Нээлттэй WebView болон rollback-д зориулж өмнөх hash файлуудыг хадгална. Шинэ asset нэмэхдээ `build/runtime-assets.mjs` бүртгэлийг шинэчилнэ. [Cache болон release-ийн заавар](CACHE_AND_PERFORMANCE.mn.md), [Nginx template](../deploy/nginx.conf.example)-ийг hosting дээр тааруулна.

Production build нь зөвхөн Player API adapter-тай. Native-аас үндсэн тоглоомын URL-ийг нээнэ. `VITE_*` утгууд хэрэглэгчид хүрэх bundle-д ордог тул нууц түлхүүрийг серверийн тохиргоонд байрлуулна.

2. **API routing-ийн хоёр боломж**

Тусдаа origin ашиглавал Play API нь frontend origin-д CORS зөвшөөрнө. Одоогийн client `Authorization`, `Content-Type`, `Idempotency-Key` header болон GET/POST/PUT хүсэлт ашигладаг. OPTIONS preflight-ийг gateway/API зөв боловсруулах хэрэгтэй.

Vendor-ийн CDN/gateway дээр same-origin proxy сонговол build-ийн `VITE_API_BASE_URL`-ийг хоосон өгнө. Тэр origin-ийн `/api/v1/*` хүсэлтийг манай Play API руу дамжуулна. Жишээ нь `https://miniapps.example.com/api/v1/me` → `https://play-api.example.com/api/v1/me`. Frontend-ийн `/sono-play/` static зам, origin root-ийн `/api/v1/` route гэсэн хоёр замтай. Vendor-ийн тухайн origin дээр энэ namespace ямар үйлчилгээнд харьяалагдахыг эхлээд тохирно. Энэ proxy нь CDN/gateway давхаргын үүрэг байна.

3. **Flutter bridge ба нэвтрэх урсгал**

Bridge-ийн гэрээг backend багийн `docs/core-integration.md` §1 тодорхойлно (дэлгэрэнгүй: [INTEGRATION.md](../INTEGRATION.md#host-bridge)):

```ts
window.SonoBridge.call(method: string, params: object): Promise<object>
// getLaunchToken {}          → { launchToken }
// payWithPoints { orderId }  → { orderId, result: 'COMPLETED' | 'CANCELLED' | 'FAILED' }
// getPointBalance {}         → { points }
// openExternalUrl { url }    → {}
```

Ижил method-уудыг шууд функц хэлбэрээр (`window.SonoBridge.getLaunchToken(params)`) өгсөн host-ийг ч web хүлээн авна. Өөр global (жишээ нь `window.bridge`) уншихгүй. Vendor native channel, Promise resolve/reject, алдаа болон цуцлалтын хариуг хэрэгжүүлнэ. Bridge-ийг web authentication эхлэхээс өмнө бэлэн болгоно. Зөвхөн `onPageFinished` дээр нэмэхэд эхний auth дуудлагатай уралдах боломжтой.

Flutter нь нэвтэрсэн хэрэглэгчид зориулсан богино хугацаатай нэг удаагийн launch assertion авна. Web түүнийг `POST /api/v1/auth/exchange` руу дамжуулж game access/refresh token авна. Core-ийн assertion олгох, Play-ийн баталгаажуулах бодит гэрээ, issuer/audience, хугацаа, replay хамгаалалт болон түлхүүрийн солилцоог хоёр backend баг эцэслэх шаардлагатай. Native/Core credential болон HMAC secret сервер/native талд хадгалагдана. Development болон production host хоёулаа `SonoBridge` launch token өгөх шаардлагатай; browser mock identity байхгүй.

Vendor safe-area-г CSS pixel-ээр `window.__SONO_SAFE_AREA__ = {top,right,bottom,left}` хэлбэрээр өгч, өөрчлөгдөхөд `sono-safe-area` event илгээнэ. Web нь `visibilitychange`/`pagehide`-ийг ажигладаг. Native app lifecycle, WebView хаах/буцах үйлдэл, серверийн session дуусгах гэрээг бодит Flutter төхөөрөмж дээр уялдуулж шалгана. Production Flutter wrapper болон тусгай native termination hook-ийн хэрэгжилт/баталгаажуулалт хүлээгдэж байна.

4. **Амь авах ба бодит SP суутгал**

Web → Play `POST /api/v1/lives/orders` руу quantity болон шинэ action UUID илгээнэ. Timeout-ийн дараах ижил үйлдэлд өмнөх UUID-г дахин ашиглана. Play үнэ болон `PENDING` order үүсгэнэ. Web нь `payWithPoints({orderId})`-оор native төлбөрийн дэлгэц нээнэ. Core/native нь захиалга, хэрэглэгч, дүнг баталгаажуулж PIN болон SP суутгалыг гүйцэтгэнэ. Core → Play баталгаажсан debit callback ирж, Play нэг удаа эрх олгоод order-ийг `PAID` болгоно. Web order GET-ээр эцсийн төлөвийг уншина.

Callback-ийн URL, гарын үсэг, retry, debit ID, reconciliation болон буцаалтын гэрээг Core/Play багууд нийлүүлэх ажил үлдсэн. Одоогийн Player API snapshot эдгээр Core endpoint-ийг тодорхойлоогүй. Native дэлгэц хаагдсан үйл явдлын дараа ч төлбөрийн эцсийн төлөвийг Play API-аас авна. Бодит SP болон зээлийн өөрчлөлтийн санхүүгийн бүртгэлийг Core хөтөлж, Play өөрийн тоглох эрхийн бүртгэлийг хөтөлнө.

5. **Core ачааллыг багасгах төлөлтийн мэдээлэл**

Санал болгосон урсгал нь Core-ийн төлөлт баталгаажсан transaction-тай холбогдсон durable outbox/event delivery байна. Play event ID болон хуваарь/үйлдлийн business key-ээр давхардлыг шалгаж, эрхийн өөрчлөлтийг өөрийн ledger-д нэг удаа бүртгэнэ. Эрт төлөлтийн +10 нь хугацаандаа төлөлтийн +10-ыг орлох дүрмийг нэг хуваарь дээр давхардуулж олголгүй хэрэгжүүлнэ. Event schema, delivery transport, retry болон reconciliation хугацааг backend гэрээгээр батална.

Play нь хэрэглэгчийн шаардлагатай projection/cache-ийг хадгалж, тоглолт бүрт Core-ийн зээлийн мэдээллийг дахин унших ачааллыг багасгана. SP cache-ийг харуулахад хэрэглэж, суутгах үед Core ledger-ийн тухайн үеийн үлдэгдлээр баталгаажуулна. Сүлжээгээр frame/товшилт бүрт хүсэлт илгээх шаардлага одоогийн client урсгалд үүсдэггүй. Зэрэгцээ хэрэглэгчийн даац болон event burst-ийг Play backend-ийн ачааллын туршилтаар тогтооно.

6. **Staging, production ба хүлээлгэн өгөх ажил**

Staging-д тусдаа frontend/API origin, Core sandbox, хэрэглэгч, өгөгдөл болон түлхүүр ашиглана. Launch → profile → nickname → start/finish → skin selection → native approval → callback → PAID урсгалыг бодит iOS/Android Flutter WebView дээр шалгасны дараа production release бэлтгэнэ. Vendor HTTPS, WebView origin/navigation бодлого, production debugging тохиргоо, CSP болон cache header-уудыг hosting дээр тохируулна. Одоогийн `index.html`/Vite config-д production CSP policy суулгах тохиргоо хүлээгдэж байна.

| Үлдсэн шийдэл/нийлүүлэлт | Хариуцах тал |
|---|---|
| Release version, эх код, lockfile, `public/`, build artifact, API/bridge гэрээ | Frontend баг → vendor |
| HTTPS hosting, routing/CORS/CSP, rollback, Flutter bridge ба lifecycle | Vendor болон Play hosting баг |
| Launch assertion issuance/validation, төлбөрийн callback, repayment event/reconciliation | Core + Play backend |
| SEC-02 trusted score validation, reward eligibility, replay/multidevice/timeout хамгаалалт | Play backend + аюулгүй байдал/санхүү |
| Өнөөдөр/өмнөх өдрийн standings, хувийн онооны түүх, SP balance, prize metadata endpoint; шинэ `/lives/history` frontend холболт | Backend болон frontend багууд |
| Live skin 0/50/150 босгыг BRD V2.1-ийн 0/1,500/3,000 болон баталсан speed config-той нийцүүлэх | Product owner + Play backend |

Одоогийн API нь дүнг FINISHED/REJECTED гэж бүртгэж, хугацаа/хурдны хязгаар шалгадаг. Санхүүгийн шагналд хэрэглэх trusted score-ийн SEC-02 шийдэл хүлээгдэж байна. Дэлгэрэнгүй одоогийн хэрэгжилт, үлдсэн гэрээнүүд нь төслийн backend болон security баримтад байна. [Player API integration](../README_BACKEND.md), [Security Specification](SECURITY_SPEC.md), [Decisions and gaps](DECISIONS_AND_GAPS.md).

Build base path, static hosting, build-time environment болон Flutter WebView-ийн албан ёсны тайлбаруудыг deployment тохиргоотой хамт ашиглана. [Vite build](https://vite.dev/guide/build.html), [Vite static deployment](https://vite.dev/guide/static-deploy.html), [Vite environment and modes](https://vite.dev/guide/env-and-mode.html), [Flutter webview_flutter](https://pub.dev/packages/webview_flutter).
