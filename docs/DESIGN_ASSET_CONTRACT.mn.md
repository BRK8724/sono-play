# SONO Play — дизайнерийн asset ба UI handoff

**Төлөв:** дизайнертэй тохирох санал. 2026-11-16. Одоогийн art нь demo; дутуу 12 орчин, skin-ийг бэлэн мэт орлуулахгүй.

## Батлагдсан хүрээ

- Гурван өөр visual theme, тус бүр өглөө/өдөр/орой/шөнө гэсэн дөрвөн төлөв: нийт **12 орчны хувилбар**.
- Нэг удаагийн тоглолтын **server-verified best pipe count**-оор нээгдэх гурваас дөрвөн bird skin. Тоо ба босго playtest-ийн дараа шийдэгдэнэ.
- Гол тоглолтын дэлгэцүүд: Home, Ready, Playing, Game Over. Store, Stats, Gifts, attempts зэрэг үлдсэн UI нь product/core API шийдвэртэй уялдана.
- Цагийн төлөв хэдэн хоолой тутам солигдох нь одоогоор нээлттэй; artwork энэ тооноос хамаарах ёсгүй.

## Орчны файлын санал

## Экспортын хэмжээ ба харьцаа (дизайнерт өгөх шийдвэр)

`2048×2048` хэмжээтэй нэг зураг бүх утас, iPad-д тохирохгүй. Дараах хэмжээ нь **нэг theme/phase-ийн runtime export**; эх Figma/PSD/AI файлыг давхаргатай, үүнээс дор хаяж 2 дахин нягтралтай хадгална. Зураг бүрийн ирмэгийг game canvas-ийн ирмэг гэж үзэхгүй: код viewport-ийн харьцаагаар crop эсвэл repeat хийнэ.

| Asset | Runtime export (px) | Зурах дүрэм |
| --- | ---: | --- |
| Үндсэн босоо sky/lighting | `1024×2048` (1:2) | Гол focal хэсэг төвд, хажуу талд crop хийх зайтай. Боломжтой бол gradient-ийг кодоор, дүрсийг transparent layer-ээр өгнө. |
| iPad/Fold-ийн өргөн орчны нэмэлт зураг | `2048×1536` (4:3), шаардлагатай theme-д | Хажуу талын чимэглэл. Gameplay-ийг зургийн өргөнд сунгахгүй. |
| Far/near parallax strip | `1024×512` (2:1), transparent | Зүүн/баруун ирмэг seamless; horizon ба газрын түвшинг тусдаа anchor-аар өгнө. |
| Ground strip | `1024×512` (2:1), transparent эсвэл opaque | Дээд ирмэг нь **газрын шугам `y=0`**; хэвтээ чиглэлд seamless. Газрын доод хэсгийг дэлгэцийн доод ирмэг хүртэл давтаж/сунгаж болно. |
| Pipe shaft | `256×256` (1:1), transparent | Зөвхөн босоо чиглэлд seamless; хээ/зураас нь tile залгахад тасрахгүй. Урт хоолойг PNG-г сунгаж бүтээхгүй. |
| Pipe upper/lower cap | тус бүр `320×180` (16:9 орчим), transparent | Shaft-аас арай өргөн, нэг x pivot. Upper/lower cap-ийн бодит хэлбэрийг дизайнер нэг set болгон өгнө. |
| Bird body + 3 wing pose | тус бүр `256×256` (1:1), transparent | Ижил canvas, pivot, hitbox; wings-ийн хоосон margin-ийг ижил хадгална. |

Эдгээр нь **эхний export contract**; зураг дахь object-ийн харагдах хэмжээ ба pipeline-д таарсан crop-ийг нэг theme-ээр туршиж батална. Том эх зургийг шууд 12 төлөвт app-д ачихгүй. `2048×2048` RGBA texture GPU-д ойролцоогоор 16 MiB задлагдана; 12 ширхэг нь бусад texture-ээс өмнө ~192 MiB. Нэг удаад идэвхтэй төлөв ба дараагийн төлөвийн asset-ийг л memory-д байлгана.

**Дэлгэцийн бодлого:** portrait утсанд gameplay canvas-ийг дүүргэнэ. Нээгдсэн Fold/Duo болон iPad дээр орчин дэлгэцийг дүүргэж, gameplay corridor-ийг төвд ойролцоогоор 360–440 logical px өргөнөөр барина; хоёр талд parallax/decor гарна. Нугас/таслалыг cross хийсэн control тавихгүй. Flip-ийн жижиг cover screen дээр gameplay эхлүүлэхгүй. Flutter host нь safe area, hinge, viewport resize-ийн мэдээллээ WebView-д өгөх ёстой. Энэ бодлогын iPad/Fold хэрэгжилт demo-д одоогоор бүрэн хийгдээгүй.

**Хоолойг газардуулах:** `groundY` нь game scene-ийн ганц үнэн координат. Ground layer-ийн дээд ирмэг, collision шугам, доод хоолойн shaft-ийн төгсгөл бүгд түүнээс тооцогдоно. Shaft-ийг газрын шугамаас 8 logical px илүү үргэлжлүүлж, ground layer-ийг shaft-ийн дээр зурж залгаасыг далдална. Designer-ийн export-д газрын шугам тогтмол `y=0` anchor-тай байна. Theme солигдоход hitbox-ийг зурагт тааруулж үсрүүлэхгүй.

| Давхарга | Дизайнераас авах зүйл | Кодод хэрэглэх шалтгаан |
| --- | --- | --- |
| Sky / light | 12 төлөвийн gradient эсвэл зураг, нэг theme дотор horizon/гэрлийн байрлал ижил | Өглөө→өдөр→орой→шөнө зөөлөн солих |
| Far background | 12 төлөвийн холын объект, тусдаа transparent layer | Parallax, огтлолцолгүй давталт |
| Near background | 12 төлөвийн бут/ойрын объект, тусдаа transparent layer | Хөдөлгөөний гүн, хоолойг зөв давхарлах |
| Ground | 12 төлөвийн газрын дээд зааг ба tileable texture | Хоолойн доод үзүүр газарт хүрэх, collision тогтвортой байх |
| Pipe set | Theme бүрт хэрэгтэй shaft + хоёр cap, эсвэл нэг нийтлэг set-ийг ил тод батлах | Сунгахад stripe/cap гажихгүй, seam гарахгүй |

**Газар ба collision:** Бүх 12 төлөвт газар/хоолойн hitbox-ийн logical координатыг ижил байлгана. Export бүр газрын дээд ирмэгийг `y=0` anchor-т тааруулна; theme солигдоход collision шилжихгүй. Давтагдах layer-уудын зүүн/баруун ирмэг залгагдах, transparent PNG/WebP-ийн canvas ба pivot тогтмол байх шаардлагатай.

Файлын нэрийн жишээ: `themes/theme-a/morning/sky.webp`, `.../far.webp`, `.../near.webp`, `.../ground.webp`. `theme-a/b/c` нь түр ID; эцсийн нэрийг дизайнер/product тогтооно. Source файл (Figma/PSD/AI), export, өнгөний token, ашигласан font-ийн лицензийг хамт өгнө. Runtime-д эхний theme/phase-ийг түрүүлж татаж, бусдыг дараа нь ачаална; 12 том composite-ийг зэрэг татахгүй.

## Bird skin

Skin бүрт `body`, `wing-up`, `wing-level`, `wing-down` pose нэг хэмжээтэй canvas, ижил pivot ба bird hitbox-той байна. Одоогийн demo-д өгсөн гурван wing pose-ийн логикийг хадгална. Нүүрэн талд propeller нэмэхгүй. Skin сонгох UI, locked/unlocked/selected дүрслэлийг дизайнер тусад нь өгнө. Түгжээ тайлах босго artwork-д hardcode байхгүй; server config-д байна.

## Responsive UI шалгах хэмжээ

- Portrait: 320×568, 390×844, 402×874, том Android 430×932; notch/dynamic island ба доод safe area-г тооцно.
- Landscape ба tablet дээр full bleed орчин + төв gameplay corridor-ийн дээрх бодлогыг хэрэгжүүлж, hitbox, UI crop, hinge-ийг төхөөрөмж дээр шалгана.
- HUD score/best, Back, start/retry, Game Over-ийн товч нь background дээр уншигдах contrast-тай, touch target нь хангалттай, ямар ч theme/phase дээр хоолойд дарагдахгүй байх ёстой.
- 12 visual state-ийн art export болон Home/Ready/Playing/Game Over-ийн нэг суурь responsive layout өгнө. Төлөв солигдохыг төлөөлөх хэдэн screenshot-аар хамт шалгана; screen бүрт 12 тусдаа layout заавал зурах шаардлагагүй. Эхний reference-ийн чиглэл хадгалагдана, харин шинэ design нь vendor-ийн Flutter safe area-д таарна.

## Нээлттэй шийдвэр

Theme-ийг тоглогч сонгох уу эсвэл автоматаар эргэх үү; time-of-day солих cadence; transition duration; 3 эсвэл 4 skin; skin босго; UI дахь meter ба pipe count-ийн утга; Store/Stats/Gifts-ийн эцсийн урсгал. Эдгээрийг artist файл дотор дүрэм болгон шингээхгүй.
