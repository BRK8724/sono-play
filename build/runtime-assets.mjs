import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

const virtualId = 'virtual:sono-runtime-assets';
const resolvedVirtualId = '\0' + virtualId;

// Keep active runtime files explicit. Original artwork and reference exports stay in public/.
const runtimeFiles = [
  'assets/sono/menu-background.webp',
  'assets/sono/menu-background-mobile.webp',
  'assets/sono/sono-body.png',
  'assets/sono/sono-wing-1.png',
  'assets/sono/sono-wing-2.png',
  'assets/sono/sono-wing-3.png',
  'assets/sono/santa-body.webp',
  'assets/sono/gold-body.webp',
  'assets/sono/gold-wing-1.webp',
  'assets/sono/gold-wing-2.webp',
  'assets/sono/gold-wing-3.webp',
  'assets/sono/store-pilot.webp',
  'assets/sono/store-santa.webp',
  'assets/sono/store-gold.webp',
  'assets/sono/game-background.webp',
  'assets/sono/evening-background.webp',
  'assets/sono/night-background.webp',
  'assets/sono/pipe-cap.webp',
  'assets/sono/pipe-shaft.webp',
  'assets/sono/pipe-evening-shaft.webp',
  'assets/sono/pipe-evening-lower-cap.webp',
  'assets/sono/pipe-evening-upper-cap.webp',
  'assets/sono/pipe-night-shaft.webp',
  'assets/sono/pipe-night-lower-cap.webp',
  'assets/sono/pipe-night-upper-cap.webp',
  'assets/final/coin-2a011ea2.png',
  'assets/final/effects.svg',
  'assets/final/emoji-1-55041f66.png',
  'assets/final/emotes-1-33046200.png',
  'assets/final/exchange.svg',
  'assets/final/gift-icon-1eb244c8.png',
  'assets/final/gold-sono-871113b4.png',
  'assets/final/hearth-icon-fee12fa6.png',
  'assets/final/music.svg',
  'assets/final/phone-vibration-icon-96b2b300.png',
  'assets/final/shop-2-f322f500.png',
  'fonts/mogul-square.woff2',
  'fonts/nunito-800.woff2',
];

function hash(source) {
  return createHash('sha256').update(source).digest('hex');
}

function filesIn(publicDir, directory, extension) {
  return readdirSync(join(publicDir, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => `${directory}/${entry.name}`);
}

export function versionedAssetPath(original, source) {
  const { dir, name, ext } = posix.parse(original);
  return `assets/static/${dir}/${name}-${hash(source).slice(0, 16)}${ext}`;
}

/** Vite public URL rewriting happens before CSS and HTML bundle hashes are calculated. */
export function runtimeAssetsPlugin(options = {}) {
  let config;
  let building = false;
  let entries = [];
  let byOriginal = new Map();

  return {
    name: 'sono-runtime-assets',
    enforce: 'post',
    config(_config, environment) {
      building = environment.command === 'build';
      return {
        build: { copyPublicDir: false },
        experimental: {
          renderBuiltUrl(filename, context) {
            if (context.type !== 'public') return;
            const entry = byOriginal.get(filename);
            if (!entry) throw new Error(`Public asset is not registered: ${filename}`);
            if (config.base === './' || config.base === '') {
              const relative = posix.relative(posix.dirname(context.hostId), entry.file);
              return relative.startsWith('.') ? relative : './' + relative;
            }
            return config.base + entry.file;
          },
        },
      };
    },
    configResolved(resolved) {
      config = resolved;
      const files = options.files ?? [
        ...runtimeFiles,
        ...filesIn(config.publicDir, 'assets/fine-gold', '.webp'),
        ...filesIn(config.publicDir, 'assets/fine-gold', '.svg'),
      ];
      entries = [...new Set(files)].sort().map((original) => {
        if (original.startsWith('/') || original.split('/').includes('..'))
          throw new Error(`Invalid runtime asset path: ${original}`);
        const source = readFileSync(join(config.publicDir, original));
        return {
          original,
          file: versionedAssetPath(original, source),
          sha256: hash(source),
          bytes: source.byteLength,
          source,
        };
      });
      byOriginal = new Map(entries.map((entry) => [entry.original, entry]));
    },
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
    },
    load(id) {
      if (id !== resolvedVirtualId) return;
      const mapping = Object.fromEntries(
        entries.map((entry) => [entry.original, building ? entry.file : entry.original]),
      );
      return `export default ${JSON.stringify(mapping)};`;
    },
    buildStart() {
      if (!building) return;
      for (const entry of entries)
        this.emitFile({ type: 'asset', fileName: entry.file, source: entry.source });
    },
    generateBundle: {
      order: 'post',
      handler(_output, bundle) {
        const files = Object.fromEntries(
          Object.entries(bundle)
            .sort()
            .map(([file, output]) => {
              const source = output.type === 'chunk' ? output.code : output.source;
              return [file, { sha256: hash(source), bytes: Buffer.byteLength(source) }];
            }),
        );
        const assets = Object.fromEntries(
          entries.map(({ source: _source, original, ...entry }) => [
            original,
            { ...entry, url: config.base + entry.file },
          ]),
        );
        const manifest = {
          schemaVersion: 1,
          releaseId: hash(JSON.stringify(files)),
          base: config.base,
          assets,
          files,
        };
        this.emitFile({
          type: 'asset',
          fileName: 'release-manifest.json',
          source: JSON.stringify(manifest, null, 2) + '\n',
        });
      },
    },
  };
}
