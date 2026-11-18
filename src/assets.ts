import runtimeAssets from 'virtual:sono-runtime-assets';

/** Every runtime asset has a content-versioned production URL and a normal dev URL. */
export function assetUrl(path: string): string {
  const original = path.replace(/^\/+/, '');
  const versioned = runtimeAssets[original];
  if (!versioned) throw new Error(`Runtime asset is not registered: ${original}`);
  return `${import.meta.env.BASE_URL}${versioned}`;
}
