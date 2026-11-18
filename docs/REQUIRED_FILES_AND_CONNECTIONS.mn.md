**Flappy SONO-д хэрэгтэй файл, холболт ба хүлээлгэн өгөх мэдээлэл**

2026-11-18-ны кодын төлөвөөр бэлтгэв. Бүтээгдэхүүний дүрэм нь `Flappy_sono_rules_v2.1_2026-11-17.docx`, дүрслэлийн эх нь Figma-ийн `Тоглоом fine gold`, `168:9379` хэсэг. Хэрэгжсэн код ба цааш нийлүүлэх гэрээг доорх төлөвөөр тэмдэглэв. Санал гэсэн мөрүүдийг backend, core, Flutter талуудын бодит гэрээтэй тааруулна.

Frontend нь Vite + Phaser web miniapp. Vendor уг web build-ийг байршуулж SONO Flutter аппын WebView дотор нээнэ. Манай Play server тоглоомын үйлчилгээ, session, эрх, чансаа, log-ийг хариуцна. SONO core нь хэрэглэгчийн үндсэн бүртгэл, SP болон санхүүгийн үйлдлийг эзэмшинэ.

| Төсөлд бэлэн байгаа зүйл | Файл, байрлал | Одоогийн хэрэглээ |
| --- | --- | --- |
| Шинэ дүрэм | `docs/Flappy_sono_rules_v2.1_2026-11-17.docx` | Өдөрт 3 үнэгүй эрх, 20 SP = 1 амь, Santa 1,500 / Goldie 3,000 нийт оноо, өдрийн 1 / нийт 5 ялагч |
| Fine Gold-ийн эх ба asset холбоос | `design-reference/figma-fine-gold/`, `runtime-manifest.json` | Asset бүрийн эх node, локал файл, хэмжээний бүртгэл |
| Үндсэн logo, sponsor, footer icon, rank дүр, алтны зураг | `public/assets/fine-gold/` | Figma-аас авсан тусдаа элементүүд frontend-д орсон |
| Mogul Square font | `public/fonts/mogul-square.ttf` | Web build дотроос ачаална |
| Үндсэн шувуу ба 3 далавчны байрлал | `public/assets/legacy/bird-body.png`, `bird-wing-1.png`, `bird-wing-2.png`, `bird-wing-3.png` | Товшилтын нислэгийн animation |
| Хоолой ба орчны зураг | `public/assets/sono/`, `public/assets/legacy/` | Нэг газрын шугамтай, cap ба shaft нь ижил масштабаар зурагдана |
| Хөгжим, нислэг ба мөргөлтийн дуу | `src/audio/GameAudio.ts` | Кодын audio synthesis |
| Home, Ready, Playing, Game Over ба нэмэлт цонхнууд | `src/Frontend.ts`, `src/main.ts`, `src/style.css` | Нэр, Store, чансаа, дүрэм, бэлэг, амийн түүх, амь авах урсгал |
| Тусгаарласан жишээ өгөгдөл | `src/mock/` | Mock баланс, өдөр тутмын оноо, чансаа, эрхийн бүртгэл |
| 34 дэлгэцийн review | `src/preview/`, `public/previews/` | `?screens=1` жагсаалт, `?screen=...` тусдаа төлөв |
| 2026-11-18-ны шинэ OpenAPI snapshot | `docs/api/player-openapi-2026-11-18-ui-audit.json` | Swagger-ийн 15 path; өмнөх 14-path эхийг тусад нь хадгалсан |
| Player API adapter | `src/services/ApiClient.ts`, `ApiMiniappService.ts` | Өгөгдсөн API collection-д зориулсан холболт |

Одоогийн хөгжүүлэлтийн үндсэн хаяг `http://localhost:5177/` бөгөөд `.env.development` тохиргоогоор LAN Player API ажиллана. `?mode=api` нь API-г, `?mode=mock` нь offline жишээ өгөгдлийг сонгоно. Production build-ийн үндсэн adapter нь API. Mock-ийн худалдан авалт, оноо, бүртгэл нь тухайн хуудсын жишээ өгөгдөл бөгөөд reload хийхэд шинэчлэгдэнэ. API горимд серверийн эрх, захиалга, дүнг уншина. Skin catalog, unlock болон сонголтыг серверээс уншина. Өдрийн чансаа, түүх зэрэг нэмэлт гэрээний төлөвийг UI харуулдаг.

Дизайнерээс авах үлдсэн гол дүрслэл нь шөнийн gameplay зураг болон Santa, Goldie-ийн далавчны тусдаа pose-ууд. Доорх нэрс нь хүлээлгэн өгөх файлын санал. Нийлүүлсэн asset-ийг manifest болон ачаалах кодтой тааруулж нэмнэ.

| Өгөх файл | Хэрэгцээ | Export-ийн мэдээлэл |
| --- | --- | --- |
| `night-gameplay.webp` | 18:00–07:00-д ашиглах эцсийн шөнийн орчин | Өдрийн зурагтай ижил газрын anchor, crop координаттай нийлмэл зураг. Давхаргатай эх файлыг хамт өгнө |
| `santa-body.png` | Далавчнаас тусгаарласан Santa их бие | Доорх 3 pose-той нэг canvas ба pivot |
| `santa-wing-up.png`, `santa-wing-level.png`, `santa-wing-down.png` | Santa далавчны дээш, үндсэн, доош байрлал | Transparent, ижил хэмжээ, ижил alignment |
| `goldie-body.png` | Далавчнаас тусгаарласан Goldie их бие | Доорх 3 pose-той нэг canvas ба pivot |
| `goldie-wing-up.png`, `goldie-wing-level.png`, `goldie-wing-down.png` | Goldie далавчны 3 байрлал | Transparent, ижил хэмжээ, ижил alignment |

Одоогийн Santa, Goldie-ийн бүтэн зураг болон Store card байна. Тэдгээрийн runtime animation нь их биеийн хөдөлгөөнтэй. Шөнийн орчин одоогоор өнгийн tint ашиглаж байна.

BRD V2.1 нь нэвтрэх цагаар өдөр, шөнийн хоёр төлөв сонгох дүрэмтэй. Өмнөх 3 theme × өглөө/өдөр/орой/шөнө гэсэн 12 төлөвийн төлөвлөгөөг цаашдын visual өргөтгөлийн хамрах хүрээгээр баталгаажуулна. Тэр хүрээ үргэлжилбэл theme бүрийн sky, far/near objects, ground, шаардлагатай pipe өнгийн хувилбарыг давхаргатай өгнө. Одоогийн өдөр/шөнийн холболтод шаардлагатай эцсийн файл нь дээрх шөнийн орчин.

[Asset export-ийн өмнөх санал](DESIGN_ASSET_CONTRACT.mn.md) нь sky-д 1:2, parallax ба ground strip-д 2:1, pipe shaft-д 1:1 харьцаа, bird pose-д ижил canvas санал болгосон. Бодит export-ийг нэг theme дээр runtime-тай тулгаж тааруулна. Доод хоолой, ground texture, collision нь кодын нэг `groundY` координатаас тооцогдоно.

Vendor-т өгөх хөгжүүлэлтийн багцад дараах бүрдэл орно. Ажиллуулах static багц нь build-ийн дараах `dist/` хавтас бүхэлдээ байна.

| Бүрдэл | Зориулалт |
| --- | --- |
| `build/` | Runtime asset-ийн hash URL, manifest үүсгэх compiler; frontend build-д заавал хамт өгнө |
| `deploy/` | Nginx cache/CORS/release layout-ийн тохируулах template |
| `src/` | Тоглоом, UI, audio, API adapter, mock, preview код |
| `public/` | Runtime зураг, font, review thumbnail |
| `index.html`, `vite.config.ts`, `tsconfig.json` | Web entry ба build тохиргоо |
| `package.json`, `package-lock.json` | Dependency болон давтагдах build |
| `.prettierrc.json`, `.prettierignore`, `tests/` | Formatting ба автомат шалгалт |
| `.env.example` | Байршуулалтын тохиргооны жишээ |
| `README_VENDOR.md`, `README_BACKEND.md`, `INTEGRATION.md` | Vendor, API, Flutter-ийн заавар |
| Шинэ BRD, `docs/SECURITY_SPEC.md`, энэ жагсаалт | Дүрэм, одоогийн аюулгүй байдлын шийдвэр, хүлээлгэн өгөх гэрээ |

```bash
npm ci
npm run check
npm run build -- --base=/sono-play/
```

`/sono-play/` нь байршуулалтын замын жишээ. Vendor эцсийн URL, subpath-ийг өгсний дараа тэр замаар build хийнэ. WebView нь байршуулсан directory URL-ийг нээнэ. `index.html` шинэ хувилбараа авах cache тохиргоотой, hash-тай bundle-ууд хувилбарын cache-тай байхаар host-оо тохируулна. API тусдаа origin-д байвал `VITE_API_BASE_URL`-ийг build хийх үед зарлаж, frontend origin-ийг CORS-д зөвшөөрнө.

Flutter талын одоогийн JavaScript гэрээ дараах хоёр method-оос бүрдэнэ. `window.SonoBridge` нэрийг ашиглана. Код нь `window.bridge` нэрийг мөн уншдаг.

| Flutter-ээс өгөх method эсвэл утга | Хүлээгдэж буй хэлбэр | Хэрэглээ |
| --- | --- | --- |
| `getLaunchToken()` | Promise нь string эсвэл `{ launchToken }` буцаана | Play server-ийн auth exchange-д ашиглах богино хугацааны launch token |
| `payWithPoints({ orderId })` | Native баталгаажуулалт дуусах Promise | Тухайн Play order-ийг native PIN/biometric урсгалаар батална |
| `window.__SONO_SAFE_AREA__` | `{ top, right, bottom, left }`, CSS pixel | Notch, status bar, home indicator-ийн зай |
| `sono-safe-area` event | Insets өөрчлөгдсөний дараа dispatch хийнэ | Fold, эргэлт, WebView resize үед layout дахин тааруулах |

Native төлбөрийн Promise амжилттай дууссаны дараа web тал Player API-аас order төлөвийг шалгана. Core төлбөрөө баталж Play server захиалгыг `PAID` болгосны дараа эрх шинэчлэгдэнэ. PIN болон core credential-ийг native/core давхарга хариуцна. Одоогийн mock баталгаажуулалтын дэлгэц нь visual keypad болон туршилтын товчтой.

Код `visibilitychange`, `pagehide` үед идэвхтэй тоглолтыг дуусгаж, хожуу ирсэн start response-ийг тухайн exit/background төлөвтэй нэг удаа эцэслэх логиктой. Flutter-ийн `AppLifecycleState`, native Back болон WebView хаалтыг бодит төхөөрөмж дээр эдгээр event-тэй тулгана. Native lifecycle тусдаа дамжуулга шаардвал тэр adapter-ийн гэрээг Flutter багтай тааруулна. Safe-area custom event-ийн дэмжлэг кодод байгаа. Dedicated native lifecycle method одоогийн bridge-д нэмэгдээгүй.

Live Swagger одоо 15 path-тай. Frontend-ийн одоогийн adapter 14-ийг ашигладаг; шинээр нэмэгдсэн `/lives/history`-ийг холбох үлдсэн. Доорх endpoint-уудыг `src/services/ApiClient.ts`, `ApiMiniappService.ts` болон 2026-11-18-ны шинэ Swagger schema `/v3/api-docs/player`-тай тулгав. Одоогийн dev base URL нь `http://192.168.1.196:8080`, тухайн LAN-д хандах боломжтой орчинд ашиглана.

| Method ба path | Request-ийн гол өгөгдөл | Frontend-д ашиглах response |
| --- | --- | --- |
| `POST /api/v1/auth/exchange` | `launchToken` | Game-service `accessToken`, refresh-ийн боломж ба token |
| `POST /api/v1/auth/refresh` | `refreshToken` | Шинэ game-service credential |
| `GET /api/v1/me` | Bearer game session | `playerId`, `nickname`, `freePlaysLeft`, `lives`, `playsLeft`, `bestScore`, `totalScore`, `selectedBird` |
| `PUT /api/v1/me/nickname` | `nickname` | Хадгалсан `nickname` |
| `GET /api/v1/birds` | Bearer game session | `totalScore`, `selected`, `birds[{code,name,unlockScore,unlocked,selected}]` |
| `PUT /api/v1/me/bird` | `code` | Серверийн баталсан `selected` code |
| `GET /api/v1/tournament` | Bearer game session | `current` тэмцээн, `id`, `name`, `endsAt`, `rankingMode` |
| `GET /api/v1/lives/history` | `limit`, боломжит `cursor` | `tournament`, `entries[{type,title,lives,createdAt}]`, `freePlays[{day,type,title,lives}]`, `nextCursor`; frontend холболт үлдсэн |
| `GET /api/v1/lives/price` | Bearer game session | `pointsPerLife`, `maxLivesPerOrder` |
| `POST /api/v1/games/start` | Шинэ үйлдлийн `Idempotency-Key` | `sessionId`, `seed`, `config`, `freePlaysLeft`, `livesLeft` |
| `POST /api/v1/games/{sessionId}/finish` | `score`, `durationMs` | `FINISHED` эсвэл `REJECTED`, `score`, `bestScore`, боломжит `rejectReason` |
| `GET /api/v1/leaderboard?limit=10` | Bearer game session | `entries`, `me`, мөр бүрийн `rank`, `nickname`, `totalScore` |
| `POST /api/v1/lives/orders` | `quantity`, шинэ үйлдлийн `Idempotency-Key` | `orderId`, `status`, `pointsCost`, `lives`, `expiresAt` |
| `GET /api/v1/lives/orders/{orderId}` | Захиалгын дугаар | `PENDING`, `PAID`, `FAILED`, `EXPIRED` төлөв ба захиалгын мэдээлэл |
| `POST /api/v1/dev/lives` | `lives` | Dev тестийн эрх нэмэх үр дүн |

Bird сонголтын local ID нь `pilot=sono`, `santa=santa_sono`, `gold=goldy_sono` гэж backend code руу хөрвөнө. `birdCatalog` metadata дахь `unlockScore`, `unlocked`, `selected`-ийг Store ашиглана. `selectItem`-ийн API bird сонголт Promise буцааж, серверийн хариуны дараа UI шинэчлэгдэнэ.

Одоогийн local-dev орчин Pilot/Santa/Goldie-г 0/50/150 нийт оноогоор нээдэг. BRD V2.1 болон mock нь 0/1,500/3,000 босготой. API нь серверийн catalog-ийг дагана. Эцсийн тэмцээний backend тохиргоог BRD-тэй тулгаж шинэчилнэ. Шинэ тэмцээнд нийт оноо 0-оос эхлэхэд skin дахин түгжигдэж, хадгалсан сонголт дахин нээгдэх хүртэл default bird үйлчилнэ.

Шинэ start, шинэ life order бүр UUID key-тэй. Timeout-ийн дараах ижил үйлдлийн retry нь өмнөх key, payload-аа хадгална. Finish retry нь анхны score, duration-аа хадгална. Код credential refresh-ийг давхардсан 401 хүсэлтүүдэд нэг удаа хийдэг.

Серверийн gameplay config нь `pipeIntervalMs`, `gravity`, `jumpVelocity`, `scrollSpeed`, `pipeGap`, `speed.step`, `speed.max`, `speed.thresholds` талбаруудтай. Backend-ийн config-ийг V2.1-ийн 10, 25, 45, 70… босготой тааруулна. Server replay ашиглах шийдэл сонговол seed-ийн төрөл, random generator, physics/config version болон evidence protocol-оо хоёр тал ижил тодорхойлох шаардлагатай. Одоогийн frontend seed-ийн бүх int64 цифрийг хадгалдаг.

Одоогийн `FINISHED` төлөв нь Player API үр дүн бүртгэсэн гэдгийг харуулна. Backend-ийн итгэмжлэгдсэн оноо шалгах SEC-02 гэрээ, шагналын eligibility, core settlement нь цааш хэрэгжих хэсэг. Native approval, core callback, серверийн эрх нэмэгдэл гэсэн бүтэн урсгалыг staging дээр тулгана.

Нэмэлт дэлгэцүүдийг API горимд бодит мэдээлэлтэй болгоход дараах өгөгдөл хэрэгтэй. Доорх path болон нэмэлт талбарын нэрс нь санал. Одоогийн Player API-ийн хэрэгжсэн endpoint гэж үзэхгүй.

| Нэмэх өгөгдөл | Path-ийн санал | Response-д хэрэгтэй гол талбар |
| --- | --- | --- |
| Өнөөдөр, өмнөх өдөр, нийт чансаа | `GET /api/v1/leaderboard?period=today\|previous\|total&limit=10` | `period`, `date`, `timeZone`, `entries`, `me`, `updatedAt`, tie-break дүрэм |
| Миний өдөр тутмын оноо | `GET /api/v1/me/score-history` | `date`, `score`, `rank`, pagination |
| SP харагдах үлдэгдэл | `GET /api/v1/me/points` | `balance`, `asOf`, боломжтой бол `balanceVersion` |
| Бэлэг, ялагчийн popup | `GET /api/v1/tournament/rewards` болон notification contract | Өдрийн/нийт ангилал, байр, бэлгийн нэр/дүн/нэгж, ялагчийн төлөв, мэдээллийн хугацаа |
| Итгэмжлэгдсэн run result | Backend багийн сонгох endpoint/event protocol | `verificationStatus`, `verifiedScore`, `rejectReason`, `rewardStatus`, result/config version |

Одоогийн `MiniappService` interface-д `standings(period)` болон `history()` нь нэмэлт боломж хэлбэрээр орсон. Mock эдгээрийг тоглолт, эрхийн худалдан авалт, өдөр солигдох үед шинэчилдэг. API adapter шинэ endpoint-оо холбох үед энэ бүтэцтэй тааруулж UI-д өгнө. Bird catalog болон skin сонголтын гэрээ нь дээрх хоёр endpoint-оор хэрэгжсэн.

Хоёр серверийн ажил дараах байдлаар хуваарилагдана.

| Үйлдэл | Play server | SONO core / Flutter |
| --- | --- | --- |
| Тоглоомд нэвтрэх | Launch token шалгах, game session олгох | Flutter богино launch token авна, core харилцагчийн эрхийг батална |
| Тоглолт эхлэх | Нэг active run, эрхийн зарцуулалт, seed/config, хугацааг удирдах | Native нь lifecycle мэдээллээ дамжуулна |
| Нислэг, хоолой, оноо шалгах | Backend-ийн сонгосон evidence/result protocol-оор баталгаажуулах | Core руу frame/tap/хоолой бүрийн хүсэлт очих урсгал үүсгэхгүй |
| SP-ээр амь авах | Order үүсгэх, төлөв хадгалах, `PAID` бол эрх олгох, давхардлыг шалгах | Native approval, core SP debit, сервер хоорондын callback |
| Зээлийн төлөлтөөс эрх авах | Тэмцээний эрхийн ledger, event давхардал ба хугацааг удирдах | Core нь төлөлт, сунгалт, хаалтын бодит үйлдлийн эх сурвалж |
| Skin ба leaderboard | Серверийн оноонд үндэслэсэн ownership, сонголт, чансаа | Flutter нь web UI-г байршуулж нээнэ |
| Шагналын санхүүгийн үр дүн | Баталгаажсан ялагч ба шагналын хүсэлтийн төлөв, reconciliation | Core бодит SP/санхүүгийн өөрчлөлтөө гүйцэтгэж transaction төлөв өгнө |

Core → Play төлөлтийн event, Play → Core debit/reward болон callback-ийн URL, auth, schema одоогийн frontend collection-д нийлүүлэгдээгүй. Эдгээр нь сервер хоорондын гэрээ. Core ачааллыг бага байлгах санал нь launch дээр эхний шаардлагатай snapshot авч, дараа нь эрх өөрчлөх санхүүгийн үйлдэл болон бодит purchase/reward дээр шинэчлэх. Чансаа, тоглоомын run, log нь Play server дээр ажиллана.

Эрх олголтын event-ийн санал болгож буй хамгийн бага мэдээлэл нь `eventId`, `playerRef`, `occurredAt`, `rightsDelta`, `ruleVersion`, боломжит `expiresAt`. Хэрэв эрхийн дүрмийг Play server тооцохоор шийдвэл core нь шаардлагатай installment/loan event-ийн баталгаат талбаруудыг сервер хооронд өгнө. Эрт төлөлтийн +10 ба хугацаандаа төлөлтийн +10 давхардахгүй байх, бүтэн дүн төлсөн эсэх, нэг хуваарьт нэг удаа олгох нөхцөлийг гэрээнд тусгана.

SP snapshot нь UI-ийн үлдэгдлийг харуулна. Бодит debit, reward бүрийн эцсийн үлдэгдэл, transaction-ийг core эзэмшинэ. Callback бүр давхар хүргэгдэж болохыг order/event ID-аар шийдэж, core commit болсон боловч Play grant хүлээгдсэн төлөвийг reconciliation-аар дуусгана. Гарын үсэг болон server credential-ийг серверийн тохиргоонд хадгална.

Vendor болон backend баг тест, байршуулалтын дараах мэдээллийг өгөхөд холболтын ажил үргэлжилнэ.

| Өгөх тал | Хэрэгтэй мэдээлэл | Ямар ажлыг дуусгах вэ |
| --- | --- | --- |
| Vendor hosting | Staging/production HTTPS URL, subpath, frontend origin, release/rollback хариуцагч | Build path, asset loading, caching ба WebView URL |
| Play backend | Хандах боломжтой staging base URL, шинэ OpenAPI/collection, error code, retry/idempotency тайлбар | LAN-аас гадуурх API тест, шинэ endpoint-уудын adapter |
| Flutter баг | Bridge implementation, тест build, дэмжих OS/WebView хувилбар, native Back/lifecycle урсгал | Launch, safe area, эргэлт/Fold, background/exit, native approval |
| Core / payment баг | Launch token шалгах гэрээ, SP order approve/debit/callback schema, transaction lookup | `PAID`, `FAILED`, `EXPIRED`, timeout, давхар callback, үлдэгдлийн тулгалт |
| Core / эрхийн баг | Төлөлт/сунгалт/хаалтын event ба V2.1 эрхийн тооцооны owner | Нэг хуваарьт нэг удаагийн эрх, эрт төлөлтийн орлуулалт, expiry |
| Play backend | Итгэмжлэгдсэн score/result protocol, active-run/timeout шийдэл | Client score өөрчлөх, replay, хоёр төхөөрөмж, тасарсан run-ийн серверийн төлөв |
| Бүтээгдэхүүн / дизайн | Шөнийн final asset, Santa/Goldie pose, бэлгийн эцсийн metadata | Үлдсэн animation, шөнийн дүрслэл, бодит ялагчийн мэдэгдэл |
| Бүх тал | Тусгай staging хэрэглэгчид, 0 эрх/хангалттай эрх, SP хүрэлцэх/хүрэлцэхгүй, давхардсан нэр, order төлөвийн тест боломж | Сөрөг ба сэргээгдэх урсгалын хамтарсан шалгалт |

Холболтын шалгалтыг stage дээр launch → nickname → birds catalog → unlocked bird сонгох → start → finish → leaderboard, дараа нь order → native approval → core callback → Play `PAID` → эрх шинэчлэгдэх дарааллаар хийнэ. Дараах давталтад timeout/retry, app background, WebView хаалт, pending start, давхар хүсэлт, хоёр төхөөрөмж, expired order болон core/Play тасарсан төлөвийг тулгана. Өмнө батлагдсан аюулгүй байдлын шийдвэрүүд [Security Specification](SECURITY_SPEC.md)-д, одоогийн хэрэгжүүлэлтийн нотолгоо [implementation status](IMPLEMENTATION_STATUS.md)-д бий.


2026-11-18-ны performance/cache нэмэлт: `src/renderPerformance.ts` нь idle render, texture reuse, resize coalescing; `src/performance.ts` нь dev-only FPS/frame хэмжүүр; `src/assets.ts`, `build/runtime-assets.mjs` нь runtime URL/manifest-ийг хариуцна. Build artifact дотор `release-manifest.json` хамт гарна. `docs/CACHE_AND_PERFORMANCE.mn.md` болон `deploy/nginx.conf.example`-ийг vendor/hosting багт хамт өгнө. Redis shared leaderboard-ийг backend төслийн эх код дээр нэмж, VPS-ийн бодит тохиргоотой тулгах ажил хүлээгдэж байна.


UI дэлгэц бүрийн backend өгөгдөл, одоогийн болон нэмж нийлүүлэх гэрээний дэлгэрэнгүй нь [UI API шаардлагын жагсаалт](UI_API_REQUIREMENTS.mn.md)-д бий. `/lives/history`-ийн entries/freePlays-ийг mapper-аар холбож, давтагдах freePlays-ийг cursor бүрт дахин нэмэхгүй.
