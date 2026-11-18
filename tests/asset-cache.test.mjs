import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  rm,
  readdir,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer } from 'vite';
import { runtimeAssetsPlugin, versionedAssetPath } from '../build/runtime-assets.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assets = ['assets/art/logo.svg', 'fonts/demo.woff2', 'fonts/OFL.txt', 'previews/home.webp'];
const originalNodeEnv = process.env.NODE_ENV;
afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'sono-asset-cache-')));
  for (const directory of ['public/assets/art', 'public/fonts', 'public/previews', 'src'])
    await mkdir(join(root, directory), { recursive: true });
  await writeFile(
    join(root, 'public/assets/art/logo.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>',
  );
  await writeFile(join(root, 'public/fonts/demo.woff2'), 'font fixture');
  await writeFile(join(root, 'public/fonts/OFL.txt'), 'font license fixture');
  await writeFile(join(root, 'public/previews/home.webp'), 'thumbnail fixture');
  await writeFile(join(root, 'public/unreferenced.png'), 'source reference image');
  await writeFile(
    join(root, 'index.html'),
    '<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head><body><img src="/assets/art/logo.svg"><script type="module" src="/src/main.ts"></script></body></html>',
  );
  await writeFile(
    join(root, 'src/style.css'),
    '@font-face{font-family:demo;src:url("/fonts/demo.woff2")}body{background-image:url("/assets/art/logo.svg")}',
  );
  await writeFile(
    join(root, 'src/main.ts'),
    'import {assetUrl} from "./assets"; window.fixtureAssets=[assetUrl("assets/art/logo.svg"),assetUrl("previews/home.webp")];',
  );
  await copyFile(new URL('../src/assets.ts', import.meta.url), join(root, 'src/assets.ts'));
  return root;
}

async function compile(root, base, outDir) {
  await build({
    root,
    configFile: false,
    base,
    logLevel: 'silent',
    plugins: [runtimeAssetsPlugin({ files: assets })],
    build: { outDir },
  });
  return JSON.parse(await readFile(join(outDir, 'release-manifest.json'), 'utf8'));
}

test('content paths change with bytes and remain stable for unchanged assets', () => {
  const original = 'assets/art/logo.svg';
  assert.equal(versionedAssetPath(original, 'first'), versionedAssetPath(original, 'first'));
  assert.notEqual(versionedAssetPath(original, 'first'), versionedAssetPath(original, 'second'));
  assert.match(
    versionedAssetPath(original, 'first'),
    /^assets\/static\/assets\/art\/logo-[a-f0-9]{16}\.svg$/,
  );
});

test('root and subpath builds rewrite HTML, CSS and runtime URLs, preserve licenses and verify output hashes', async () => {
  const root = await fixture();
  try {
    const manifests = [];
    for (const base of ['/', '/sono-play/']) {
      const outDir = join(root, base === '/' ? 'out-root' : 'out-subpath');
      const manifest = await compile(root, base, outDir);
      manifests.push(manifest);
      assert.equal(manifest.base, base);
      assert.equal(manifest.releaseId, digest(JSON.stringify(manifest.files)));
      assert.deepEqual(Object.keys(manifest.assets).sort(), [...assets].sort());
      for (const [original, entry] of Object.entries(manifest.assets)) {
        const source = await readFile(join(root, 'public', original));
        const emitted = await readFile(join(outDir, entry.file));
        assert.deepEqual(emitted, source);
        assert.equal(entry.sha256, digest(source));
        assert.equal(entry.url, base + entry.file);
        assert.ok(entry.file.includes(entry.sha256.slice(0, 16)));
      }
      for (const [file, integrity] of Object.entries(manifest.files)) {
        const output = await readFile(join(outDir, file));
        assert.equal(integrity.sha256, digest(output), file);
        assert.equal(integrity.bytes, output.byteLength, file);
      }
      const html = await readFile(join(outDir, 'index.html'), 'utf8');
      const files = await readdir(join(outDir, 'assets'));
      const css = await readFile(
        join(
          outDir,
          'assets',
          files.find((name) => name.endsWith('.css')),
        ),
        'utf8',
      );
      const script = await readFile(
        join(
          outDir,
          'assets',
          files.find((name) => name.endsWith('.js')),
        ),
        'utf8',
      );
      assert.ok(html.includes(manifest.assets['assets/art/logo.svg'].url));
      assert.ok(css.includes(manifest.assets['assets/art/logo.svg'].url));
      assert.ok(css.includes(manifest.assets['fonts/demo.woff2'].url));
      assert.ok(script.includes(manifest.assets['previews/home.webp'].file));
      assert.ok(script.includes(base));
      await assert.rejects(readFile(join(outDir, 'assets/art/logo.svg')));
      await assert.rejects(readFile(join(outDir, 'unreferenced.png')));
    }
    assert.equal(
      manifests[0].assets['fonts/demo.woff2'].file,
      manifests[1].assets['fonts/demo.woff2'].file,
    );
    const repeated = await compile(root, '/', join(root, 'out-repeated'));
    assert.equal(repeated.releaseId, manifests[0].releaseId);
    assert.deepEqual(repeated.files, manifests[0].files);
    const oldCss = Object.keys(manifests[0].files).find((file) => file.endsWith('.css'));
    await writeFile(
      join(root, 'public/assets/art/logo.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="6"/></svg>',
    );
    const changed = await compile(root, '/', join(root, 'out-changed'));
    assert.notEqual(
      changed.assets['assets/art/logo.svg'].file,
      manifests[0].assets['assets/art/logo.svg'].file,
    );
    assert.equal(
      changed.assets['fonts/demo.woff2'].file,
      manifests[0].assets['fonts/demo.woff2'].file,
    );
    assert.notEqual(
      Object.keys(changed.files).find((file) => file.endsWith('.css')),
      oldCss,
    );
    assert.notEqual(changed.releaseId, manifests[0].releaseId);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('missing files and unregistered public references fail during build', async () => {
  const root = await fixture();
  try {
    await assert.rejects(
      build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [runtimeAssetsPlugin({ files: [...assets, 'assets/missing.svg'] })],
        build: { outDir: join(root, 'out-missing') },
      }),
      /missing\.svg/,
    );
    const index = await readFile(join(root, 'index.html'), 'utf8');
    await writeFile(
      join(root, 'index.html'),
      index.replace('</body>', '<img src="/unreferenced.png"></body>'),
    );
    await assert.rejects(
      compile(root, '/', join(root, 'out-unregistered')),
      /Public asset is not registered: unreferenced\.png/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runtime helper validates dynamic paths while development serves original URLs', async () => {
  const root = await fixture();
  let server;
  try {
    server = await createServer({
      root,
      configFile: false,
      base: '/sono-play/',
      logLevel: 'silent',
      plugins: [runtimeAssetsPlugin({ files: assets })],
      server: { middlewareMode: true },
    });
    const { assetUrl } = await server.ssrLoadModule('/src/assets.ts');
    assert.equal(assetUrl('assets/art/logo.svg'), '/sono-play/assets/art/logo.svg');
    assert.throws(() => assetUrl('assets/missing.svg'), /Runtime asset is not registered/);
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
