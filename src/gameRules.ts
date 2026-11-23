function ulaanbaatarHour(date: Date) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ulaanbaatar',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
}

/** Day 08:00–16:00, evening 16:00–19:00, night 19:00–08:00 (Asia/Ulaanbaatar). */
export function backgroundVariant(date = new Date()): 'day' | 'evening' | 'night' {
  const hour = ulaanbaatarHour(date);
  if (hour >= 8 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';
}

/** Evening counts as day; night is 19:00–08:00. */
export function backgroundPeriod(date = new Date()): 'day' | 'night' {
  return backgroundVariant(date) === 'night' ? 'night' : 'day';
}
