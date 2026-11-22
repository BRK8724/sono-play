# Сервергүй үеийн local mock

Энэ горим нь зөвхөн UI болон тоглоомын урсгал шалгах зориулалттай. Бодит эрх, оноо, SONO point, төлбөр, шагнал үүсгэхгүй. Дэлгэцийн зүүн дээд талд **ТУРШИЛТЫН ГОРИМ** гэсэн тэмдэг харагдана.

## Асаах

```sh
VITE_LOCAL_MOCK_API=1 npm run dev -- --port 4177
```

Тоглоомыг `http://<компьютерийн-LAN-IP>:4177/?mock=1` хаягаар нээнэ. `?mock=1`-гүй хаяг бодит Player API болон Flutter bridge-ийн урсгалаар ажиллана. Одоогийн local preview нь mock flag-тай build-ээр ассан байгаа.

Production build дээр `VITE_LOCAL_MOCK_API`-г **бүү** тохируул. Flag байхгүй үед mock API модуль bundle-д орохгүй, `?mock=1` ямар ч mock эрх үүсгэхгүй. Сервер буцаж ажиллахад энэ flag-ийг хасахад хангалттай. Кодыг бүрмөсөн авах бол `src/services/LocalMockApi.ts`, `src/services/createService.ts` дахь сонголт, `index.html`-ийн mock toolbar, `src/Frontend.ts`-ийн mock toolbar callback болон `src/style.css`-ийн mock toolbar style-ийг устгана.

## Өгөгдөл ба шалгах зүйл

- Анх нээхэд nickname асууна. Нэр, тоглолтын оноо, амь, сонгосон шувуу, туршилтын point нь зөвхөн тухайн браузерийн `localStorage`-ийн `sono.local-mock.v1` түлхүүрт хадгалагдана.
- Шинэ тоглогч 3 үнэгүй тоглолт, 200 **туршилтын** point-той эхэлнэ. Нийт/өдрийн Top 10 болон өнгөрсөн 32 өдрийн календарь нь жишээ тоглогчдоор дүүрсэн байна. Тухайн төхөөрөмжийн жинхэнэ тоглолтын дүн жагсаалтад нэмэгдэнэ.
- Start/finish, серверээс өгөгдөх seed ба physics config, nickname, leaderboard, bird catalog/selection, life history, price/order/status гэсэн Player API замуудыг `ApiMiniappService` хэвээр ашиглана. Зөвхөн fetch-ийн цаадах хариуг [LocalMockApi.ts](../src/services/LocalMockApi.ts) дотроос авна.
- `+50 ОНОО` нь зөвхөн mock нийт болон өдрийн оноонд нэмнэ; 50 оноонд Santa, 150 оноонд Gold загвар нээгдэнэ. `АМЬ АВАХ` товч туршилтын point-оор амь авах дэлгэцийг нээнэ; 1 амь = 10 туршилтын point. `+10 ТЕСТ АМЬ` нь амийн түүхэнд мөн харагдана.
- `ЭХНЭЭС НЬ` товч зөвхөн энэ төхөөрөмжийн mock өгөгдлийг цэвэрлэж nickname-ийг дахин асууна.

Төхөөрөмж бүр тусдаа `localStorage`-тай тул mock leaderboard нь олон утасны оноог хооронд нь синхрончлохгүй. Олон хүний бодит өрсөлдөөн, төлбөр болон шагналын шалгалтыг Player API сэргэсний дараа хийнэ.
