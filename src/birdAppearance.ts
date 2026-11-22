// The default body and shared wings use the same 490x501 source canvas.
// Their visible body area matches the former 54x53 gameplay sprite.
export const SONO_SHEET_SIZE = { width: 74.4, height: 78 };

export function birdBodyDisplaySize(appearance: string) {
  if (appearance === 'pilot') return SONO_SHEET_SIZE;
  if (appearance === 'gold') return { width: 54.2, height: 49.9 };
  // The supplied wingless Santa body is tightly cropped around the character.
  return { width: 54.4, height: 58.7 };
}

export function birdBodyOffsetY(appearance: string) {
  return appearance === 'santa' ? -2.2 : 0;
}
