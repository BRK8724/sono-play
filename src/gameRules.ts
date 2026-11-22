export function backgroundPeriod(date = new Date()): 'day' | 'night' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ulaanbaatar',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
  return hour >= 7 && hour < 18 ? 'day' : 'night';
}

export function backgroundVariant(date = new Date()): 'day' | 'evening' | 'night' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ulaanbaatar',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
  if (hour >= 17 && hour < 18) return 'evening';
  return hour >= 7 && hour < 18 ? 'day' : 'night';
}
