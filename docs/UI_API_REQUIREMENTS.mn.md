# UI дэлгэцүүдэд шаардлагатай backend API өгөгдөл

2026-11-18-нд одоогийн Fine Gold UI, BRD V2.1, frontend код болон live Swagger `/v3/api-docs/player`-ийг тулгав. Live schema HTTP 200 бөгөөд 15 path байна. [Шинэ snapshot](api/player-openapi-2026-11-18-ui-audit.json). Өмнөх 14-path snapshot нь өмнөх шалгалтын эх хэвээр хадгалагдана.

**Төлөвийн тайлбар:** “Байгаа / холбогдсон” нь гэрээ болон frontend adapter байна гэсэн утгатай. “Swagger-д нэмэгдсэн” нь гэрээ байгаа, frontend холболт үлдсэн. “Нэмэх” хүснэгтийн path, field нэрс нь санал бөгөөд одоогийн endpoint гэж үзэхгүй. Энэ шалгалтаар тоглоомын код өөрчлөх, санхүүгийн үйлдэл хийхгүй.

| UI хэсэг | Backend-ээс авах өгөгдөл | Одоогийн API / төлөв |
|---|---|---|
| Нүүр, Ready, HUD, Game Over дахь эрх/нийт оноо | `playerId`, `nickname`, `freePlaysLeft`, `lives`, `playsLeft`, `bestScore`, `totalScore`, `tournamentRank`, `selectedBird` | `GET /api/v1/me` — байгаа / холбогдсон |
| Тэмцээний төлөв | `current`, `next`; тэмцээний `id`, `name`, `startsAt`, `endsAt`, `rankingMode` | `GET /api/v1/tournament` — байгаа / холбогдсон; `current=null` үед эхлэх/амь авахгүй |
| Тоглогчийн нэр, амжилт/давхардсан нэрийн popup | Хадгалсан `nickname`, `NICKNAME_TAKEN`, `NICKNAME_ALREADY_SET`, validation алдаа | `PUT /api/v1/me/nickname` — байгаа / холбогдсон; 3–16 тэмдэгт, нэг удаагийн сонголт |
| Тоглолт эхлэх | `sessionId`, `seed`, `paidWith`, `freePlaysLeft`, `livesLeft`, `config` | `POST /api/v1/games/start` — байгаа / холбогдсон; шинэ action-д UUID key |
| Тоглолтын тохиргоо | `gravity`, `jumpVelocity`, `scrollSpeed`, `pipeGap`, `pipeIntervalMs`, `speed.step/max/thresholds` | Start response-ийн `config` — байгаа / холбогдсон |
| Game Over, дүнгийн төлөв | `status`, `score`, `bestScore`, `newBest`, `rejectReason`, `newlyUnlocked`; эрх/нийт оноог дараах `/me`-ээс шинэчилнэ | `POST /api/v1/games/{sessionId}/finish` — байгаа / холбогдсон; `score`, `durationMs` илгээнэ |
| Store skin жагсаалт, нээгдэх босго | `totalScore`, `selected`, `birds[{code,name,unlockScore,unlocked,selected}]` | `GET /api/v1/birds` — байгаа / холбогдсон |
| Skin идэвхжүүлэх, амжилт/алдааны popup | Хадгалсан `selected`; `BIRD_LOCKED`, `BIRD_NOT_FOUND` | `PUT /api/v1/me/bird` request `{code}` — байгаа / холбогдсон |
| Нийт чансаа | `entries[{rank,nickname,totalScore}]`, `me`, тэмцээний төлөв | `GET /api/v1/leaderboard?limit=10` — байгаа / холбогдсон; өөрийн мөр Top 10-оос гадуур ч ирнэ |
| Амь авах тоо/үнэ | `pointsPerLife`, `maxLivesPerOrder` | `GET /api/v1/lives/price` — байгаа / холбогдсон |
| Амь авах захиалга, pending/success/failure | `orderId`, `status`, `pointsCost`, `lives`, `createdAt`, `expiresAt` | `POST /api/v1/lives/orders`, `GET /api/v1/lives/orders/{orderId}` — байгаа / холбогдсон; жинхэнэ native/Core баталгаажуулалт үлдсэн |
| Амь орсон/зарцуулсан жагсаалт | `tournament`, `entries[{type,title,lives,createdAt}]`, `nextCursor` | **Шинэ `GET /api/v1/lives/history?limit=50`** — Swagger-д нэмэгдсэн; frontend mapper/pagination холбох үлдсэн |
| Өдрийн үнэгүй амийн жагсаалт | `freePlays[{day,type,title,lives}]` | Дээрх `/lives/history` response — Swagger-д байгаа; frontend холболт үлдсэн |
| Өнөөдөр / өмнөх өдрийн чансаа | Өдрийн Top 10, өөрийн байр, оноо, өдөр ба timezone | Нэмэх шаардлагатай; одоогийн `/leaderboard` зөвхөн `limit` параметртэй |
| Миний амжилтууд | Өдөр бүрийн `date`, `score`, `rank`, тэмцээний context, pagination | Нэмэх шаардлагатай |
| Амь авах дэлгэцийн “Таны SONO пойнт” | `balance`, `asOf`, боломжтой бол `balanceVersion` | Нэмэх шаардлагатай; Core нь бодит үлдэгдлийн эх сурвалж |
| Бэлэг | Өдөр/нийт ангилал, байр, бэлгийн нэр, хэмжээ, нэгж, хүчинтэй тэмцээн/хугацаа | Нэмэх шаардлагатай; одоогийн алтны хэмжээ нь дизайны жишээ |
| Ялагчийн popup | Хэрэглэгч үнэхээр ялагч эсэх, тэмцээн/өдөр, байр, бэлэг, notification ID, харуулсан/хаасан төлөв | Core/host notification гэрээ болон Play-ийн баталгаат ялагчийн metadata шаардлагатай |
| Төлбөр бүтэлгүйтсэн / SP хүрээгүй popup | Тогтвортой алдааны code, боломжит тайлбар | Захиалгын `FAILED` дангаараа шалтгаан хэлэхгүй; order response эсвэл native rejection гэрээг өргөтгөнө |
| Settings дахь нэр | `nickname` | `/me`-ээс байгаа |
| Settings дахь утасны optional мөр | Зөвшөөрсөн үед `maskedPhone` | Одоогийн `/me` утас өгдөггүй; мөрийг хадгалах эсэхийг шийднэ |

**Шинээр нэмэх эсвэл өргөтгөх API-ийн санал**

| Шаардлага | Path / гэрээний санал | Хамгийн бага өгөгдөл |
|---|---|---|
| Өдрийн чансаа | `GET /api/v1/leaderboard?period=today\|previous\|total&limit=10` | `tournament`, `period`, `date`, `timeZone`, `entries`, `me`, `updatedAt`; оноо тэнцэхэд эрэмбэлэх дүрэм |
| Миний өдөр тутмын оноо | `GET /api/v1/me/score-history` | `tournament`, `entries[{date,score,rank}]`, `nextCursor`; rank байхгүй төлөвийг тодорхойлно |
| SP үлдэгдэл | `GET /api/v1/me/points` | `balance`, `asOf`, боломжтой бол `balanceVersion`; frontend Core руу шууд санхүүгийн credential-ээр хандахгүй |
| Бэлгийн metadata | `GET /api/v1/tournament/rewards` | `tournamentId`, өдөр/нийт ангилал, `rank`, `prizeCode/name`, `amount`, `unit`, үйлчлэх хугацаа |
| Ялагчийн мэдээлэл | Host notification эсвэл `GET /api/v1/me/winner-notifications` | `notificationId`, `tournamentId`, `winningDate`, `rank`, `prize`, харуулсан/хаасан төлөв; contactInstruction/хугацааг баталсан copy-той нийлүүлнэ |
| Төлбөрийн алдааны ялгаа | Order response-д `failureCode` / эсвэл native rejection contract | SP хүрээгүй, хэрэглэгч цуцалсан, Core түр боломжгүй зэрэг ялгааг backend/Core баг батална |
| WebView бүрэн хаагдсаны дараах pending сэргээх | Серверээс authenticated хэрэглэгчийн нээлттэй order авах гэрээ | `orderId`, `status`, `pointsCost`, `lives`, `expiresAt`; хадгалсан reference байхгүй үед сэргээх |

`/api/v1/me/life-history` гэсэн өмнөх саналын оронд **бодитоор нэмэгдсэн `/api/v1/lives/history`**-ийг хэрэглэнэ. API path шинээр давхар үүсгэх шаардлагагүй.

**Шинэ амийн түүхийн mapping**

- `entries`: хамгийн шинэ мөр эхэнд; `title`-ийг харуулж, `type`-ийг icon/логикт ашиглана. `lives>0` олголт, `lives<0` зарцуулалт/хугацаа дуусалт. Үнэгүй эрхээр тоглосон game энэ жагсаалтад орохгүй.
- `freePlays`: тэмцээний өдөр бүрийн үнэгүй олголт. Энэ нь тухайн өдрийн үлдсэн эрх эсвэл бүрэн зарцуулалтын ledger биш; үлдсэн эрх `/me.freePlaysLeft`-ээс ирнэ.
- `freePlays` нь cursor page бүрт давтагдана. Entries-ийг дараагийн page-аар нэмэхдээ freePlays-ийг давхар append хийхгүй.
- Эхний хүсэлт cursor-гүй. Дараагийн хүсэлт `cursor=nextCursor`; `nextCursor=null` бол төгсөнө. Backend-ийн limit 1–100, default 50.
- `tournament.running=false` бол дууссан сүүлийн тэмцээн, `tournament=null` бол өмнөх тэмцээн ч байхгүй төлөв.

**API авах шаардлагагүй эсвэл сонголтоор нэмэх зүйл**

Хөгжим/дууны toggle, далавчны animation, хоолойн дүрслэл, responsive layout, background хөдөлгөөн, font/logo/icon болон static зураг нь frontend/build-ийн хэсэг. Frame эсвэл хоолой бүрт endpoint үүсгэхгүй. Зураг сонгох код болон серверийн catalog code-ийг нийлүүлсэн asset manifest-тай тааруулна.

Хөгжим/дууны тохиргоо localStorage-д; өдөр/шөнийн зураг нэвтрэх үеийн Asia/Ulaanbaatar цагаар сонгогдоно. Баталсан BRD-ийн дүрмийн copy-г version-той static build-д байлгаж болно. Үйл ажиллагааны баг release хийхгүйгээр дүрэм/кампанит metadata өөрчлөх шаардлагатай бол `ruleVersion`, dailyFreePlays, timezone/reset, эрх олголтын нөхцөл, winner counts, schedule бүхий remote-config гэрээг тусад нь батална. Одоогийн API үнэ, gameplay config, skin босго өгч байгаа тул тэдгээрийг давхар шинээр зохиохгүй.

Background сонголт account хооронд/төхөөрөмж хооронд хадгалах бүтээгдэхүүний шаардлага батлагдвал background catalog/selection нэмнэ. Одоогийн UI Store нь milestone skin бөгөөд хуучин дизайн дахь SP-ээр skin/background худалдаж авах endpoint-ийг автоматаар шаардахгүй.

**Flutter / Core хариуцах хэсэг**

- SONO host-ийн нүүр дэх SP, зээл, notification нь үндсэн апп/Core-ийн өгөгдөл. Miniapp нь тоглоомд хэрэгтэй, зөвшөөрсөн subset-ийг авна.
- PIN/биометр нь native. Game JavaScript PIN хадгалах/илгээхгүй. `getLaunchToken()` болон `payWithPoints({orderId})` гэсэн bridge-ийг vendor хэрэгжүүлнэ.
- Захиалга `PAID` болох, төлөлтөөс эрх үүсэх, ялагчийн санхүүгийн settlement нь Core ↔ Play сервер хоорондын callback/event гэрээгээр хийгдэнэ. UI-ийн “амжилттай” popup нь зөвхөн серверийн эцсийн төлөвийн дараа гарна.
- Winner зурагт байгаа “24 цагийн дотор холбогдоно” зэрэг өгүүлбэрийг бүтээгдэхүүний баталсан contactInstruction/хугацаатай тааруулна. UI reference-ээс шууд мөнгөн шагнал claim хийх flow зохиохгүй.

**Нийтлэг гэрээ ба тэргүүлэх ажил**

Bearer game session, шинэ start/order-д шинэ UUID, ижил retry-д өмнөх key/payload, stable error code/traceId, ISO datetime ба Asia/Ulaanbaatar өдрийн зааг, null/empty/pagination, тэмцээн дууссан төлөвийг бүх endpoint-д нэг ойлголтоор тодорхойлно. Серверийн FINISHED нь бүртгэгдсэн дүн; trusted score болон reward eligibility-ийн SEC-02 гэрээ хүлээгдэж байна.

Эхний ажил: байгаа `/lives/history`-ийг frontend-д холбох; дараа нь өдрийн чансаа, миний онооны түүх, SP balance, бэлэг/ялагчийн metadata болон төлбөрийн failure reason-ийг нийлүүлэх. Live skin босго 50/150 нь BRD V2.1-ийн 1,500/3,000-тай зөрсөн тохиргооны асуудал хэвээр тул production дүрэмтэй backend-ээ нийцүүлнэ.
