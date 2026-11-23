import { ApiError } from './ApiClient';

/**
 * Player-facing text per error code. Server codes are the backend's `ErrorCode` values (stable, see
 * docs/api/flappy-player-api.json); the others are raised in this app or by the host bridge.
 */
const messages: Record<string, string> = {
  // Server
  VALIDATION_FAILED: 'Оруулсан мэдээллээ шалгана уу.',
  MALFORMED_REQUEST: 'Хүсэлт буруу байна. Аппаа шинэчлээд дахин оролдоно уу.',
  IDEMPOTENCY_KEY_REQUIRED: 'Хүсэлт буруу байна. Аппаа шинэчлээд дахин оролдоно уу.',
  UNAUTHORIZED: 'Нэвтрэх эрх дууслаа. Дахин нээнэ үү.',
  INVALID_LAUNCH_TOKEN: 'Нэвтрэх хугацаа дууссан байна. SONO апп-аас дахин нээнэ үү.',
  INVALID_REFRESH_TOKEN: 'Нэвтрэх хугацаа дууссан байна. SONO апп-аас дахин нээнэ үү.',
  REFRESH_UNAVAILABLE: 'Нэвтрэх хугацаа дууссан байна. SONO апп-аас дахин нээнэ үү.',
  FORBIDDEN: 'Энэ үйлдлийг хийх эрхгүй байна.',
  NOT_FOUND: 'Мэдээлэл олдсонгүй.',
  SESSION_NOT_FOUND: 'Тоглолт олдсонгүй.',
  SESSION_NOT_ACTIVE: 'Тоглолтын хугацаа дууссан байна.',
  SESSION_ALREADY_FINISHED: 'Энэ тоглолтын дүн аль хэдийн бүртгэгдсэн байна.',
  ORDER_NOT_FOUND: 'Захиалга олдсонгүй. Амь авах хүсэлтээ дахин үүсгэнэ үү.',
  BIRD_NOT_FOUND: 'Энэ загвар серверийн жагсаалтаас олдсонгүй.',
  INSUFFICIENT_LIVES: 'Тоглох эрх дууссан байна.',
  TOURNAMENT_NOT_ACTIVE: 'Одоогоор тэмцээн явагдаагүй байна.',
  NICKNAME_REQUIRED: 'Тоглогчийн нэрээ эхлээд сонгоно уу.',
  NICKNAME_TAKEN: 'Энэ нэрийг өөр тоглогч авсан байна.',
  NICKNAME_ALREADY_SET: 'Тоглогчийн нэрийг нэг удаа сонгоно.',
  BIRD_LOCKED: 'Энэ загварыг нээх нийт оноо хүрээгүй байна.',
  ORDER_STATE_CONFLICT: 'Захиалгын мэдээлэл зөрсөн байна. Өмнөх захиалгаа шалгана уу.',
  RATE_LIMITED: 'Түр хүлээгээд дахин оролдоно уу.',
  INTERNAL_ERROR: 'Серверт алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
  CORE_APP_UNAVAILABLE: 'SONO систем түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.',
  LEADERBOARD_UNAVAILABLE: 'Чансааг түр ачаалах боломжгүй байна.',
  HTTP_ERROR: 'Серверт алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
  // Order status (GET /lives/orders/{id})
  ORDER_FAILED: 'Төлбөр амжилтгүй болсон байна.',
  ORDER_EXPIRED: 'Захиалгын хугацаа дууссан байна.',
  // Host bridge
  HOST_REQUIRED: 'SONO апп-аас тоглоомоо нээнэ үү.',
  HOST_METHOD_UNAVAILABLE: 'SONO аппаа шинэчлээд дахин оролдоно уу.',
  HOST_PAYMENT_REQUIRED: 'Төлбөрийг SONO апп-аар баталгаажуулна.',
  HOST_EXTERNAL_URL_UNAVAILABLE: 'Гадаад холбоос нээх тохиргоо SONO апп-д алга байна.',
  PAYMENT_CANCELLED: 'Төлбөрийг цуцаллаа. Амь нэмэгдээгүй.',
  PAYMENT_FAILED: 'Төлбөр амжилтгүй боллоо. SONO пойнтоо шалгаад дахин оролдоно уу.',
  INSUFFICIENT_POINTS: 'SONO пойнт хүрэлцэхгүй байна.',
  // This app
  INVALID_TOKEN_RESPONSE: 'Нэвтрэх token серверээс ирсэнгүй. Дахин оролдоно уу.',
  NETWORK_ERROR: 'Сервертэй холбогдсонгүй. Дахин оролдоно уу.',
  CONNECTION_LOST: 'Сервертэй холбогдсонгүй. Дахин оролдоно уу.',
  REQUEST_TIMEOUT: 'Серверийн хариу удаж байна. Дахин оролдоно уу.',
  INVALID_RESPONSE: 'Серверийн хариуг уншиж чадсангүй. Дахин оролдоно уу.',
  RESULT_PENDING: 'Өмнөх тоглолтын дүнг эхлээд илгээнэ үү.',
  ORDER_PENDING: 'Өмнөх захиалгын төлбөрийн төлөвийг эхлээд шалгана уу.',
  CATALOG_UNAVAILABLE: 'Загварын мэдээлэл серверээс ирэхийг хүлээж байна.',
  GAME_CONFIG_REQUIRED: 'Тоглолтын тохиргоо ирсэнгүй. Дахин оролдоно уу.',
  INVALID_DAY: 'Өдөр буруу байна.',
};

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return messages[error.code] ?? 'Хүсэлтийг гүйцэтгэж чадсангүй.';
  return error instanceof Error ? error.message : 'Хүсэлтийг гүйцэтгэж чадсангүй.';
}

/** A failure worth retrying unchanged: no answer, or a server-side error. */
export function isTransient(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === 'CONNECTION_LOST' || error.code === 'REQUEST_TIMEOUT' || error.status >= 500)
  );
}

export const NICKNAME_RULES =
  'Нэр 3–16 тэмдэгт: зөвхөн кирилл эсвэл зөвхөн латин үсэг, тоо, _ ашиглана. Дор хаяж нэг үсэг орно.';

const LATIN = /^[A-Za-z0-9_]{3,16}$/;
const CYRILLIC = /^[А-яЁёӨөҮү0-9_]{3,16}$/;

/** The backend's rule (Nickname.java): one alphabet, digits and '_', at least one letter. */
export function validNickname(raw: string) {
  const value = raw.trim().normalize('NFC');
  return (LATIN.test(value) || CYRILLIC.test(value)) && /[^0-9_]/.test(value);
}
