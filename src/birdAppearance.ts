// The 128x128 default sprite is scaled to match the previous Pilot's visible size.
const PILOT_BODY_SIZE = { width: 54.2, height: 52.8 };

// Santa and Gold are single-image skins; their alpha bounds match the default.
const SKIN_VISIBLE_HEIGHT = { santa: 464 / 512, gold: 460 / 512 };

export function birdBodyDisplaySize(appearance: string) {
  if (appearance === 'pilot') return PILOT_BODY_SIZE;
  const skinVisibleHeight =
    appearance === 'santa' ? SKIN_VISIBLE_HEIGHT.santa : SKIN_VISIBLE_HEIGHT.gold;
  return {
    width: PILOT_BODY_SIZE.width,
    height: PILOT_BODY_SIZE.height / skinVisibleHeight,
  };
}
