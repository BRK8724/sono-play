import { ApiError } from './ApiClient';

const messages: Record<string, string> = {
  NICKNAME_REQUIRED: 'Тоглогчийн нэрээ эхлээд сонгоно уу.',
  NICKNAME_TAKEN: 'Энэ нэрийг өөр тоглогч авсан байна.',
  NICKNAME_ALREADY_SET: 'Тоглогчийн нэрийг нэг удаа сонгоно.',
  VALIDATION_FAILED: 'Оруулсан мэдээллээ шалгана уу.',
  TOURNAMENT_NOT_ACTIVE: 'Одоогоор тэмцээн явагдаагүй байна.',
  INSUFFICIENT_LIVES: 'Тоглох эрх дууссан байна.',
  RATE_LIMITED: 'Түр хүлээгээд дахин оролдоно уу.',
  HOST_REQUIRED: 'SONO апп-аас тоглоомоо нээнэ үү.',
  HOST_PAYMENT_REQUIRED: 'Төлбөрийг SONO апп-аар баталгаажуулна.',
  NETWORK_ERROR: 'Сервертэй холбогдсонгүй. Дахин оролдоно уу.',
  CONNECTION_LOST: 'Сервертэй холбогдсонгүй. Дахин оролдоно уу.',
  REQUEST_TIMEOUT: 'Серверийн хариу удаж байна. Дахин оролдоно уу.',
  LEADERBOARD_UNAVAILABLE: 'Чансааг түр ачаалах боломжгүй байна.',
  RESULT_PENDING: 'Өмнөх тоглолтын дүнг эхлээд илгээнэ үү.',
  ORDER_FAILED: 'Төлбөр амжилтгүй болсон байна.',
  ORDER_EXPIRED: 'Захиалгын хугацаа дууссан байна.',
  ORDER_NOT_FOUND: 'Захиалга олдсонгүй. Амь авах хүсэлтээ дахин үүсгэнэ үү.',
  ORDER_PENDING: 'Өмнөх захиалгын төлбөрийн төлөвийг эхлээд шалгана уу.',
  ORDER_STATE_CONFLICT: 'Захиалгын мэдээлэл зөрсөн байна. Өмнөх захиалгаа шалгана уу.',
  INVALID_RESPONSE: 'Серверийн хариуг уншиж чадсангүй. Дахин оролдоно уу.',
  CATALOG_UNAVAILABLE: 'Загварын мэдээлэл серверээс ирэхийг хүлээж байна.',
  BIRD_LOCKED: 'Энэ загварыг нээх нийт оноо хүрээгүй байна.',
  BIRD_NOT_FOUND: 'Энэ загвар серверийн жагсаалтаас олдсонгүй.',
  UNAUTHORIZED: 'Нэвтрэх эрх дууслаа. Дахин нээнэ үү.',
};

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return messages[error.code] ?? 'Хүсэлтийг гүйцэтгэж чадсангүй.';
  return error instanceof Error ? error.message : 'Хүсэлтийг гүйцэтгэж чадсангүй.';
}
