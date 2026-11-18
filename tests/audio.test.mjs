import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../src/audio/GameAudio.ts';

test('WebView storage denial does not prevent game audio initialization', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage disabled by host');
    },
  });
  try {
    const audio = new GameAudio();
    assert.equal(audio.music, true);
    assert.equal(audio.effects, true);
    assert.doesNotThrow(() => audio.setMusic(false));
    assert.doesNotThrow(() => audio.setEffects(false));
    assert.equal(audio.music, false);
    assert.equal(audio.effects, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
