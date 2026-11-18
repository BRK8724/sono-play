# Figma Fine Gold source

Source file [тоглоом](https://www.figma.com/design/CJOrtDhCJqWJQHf1IFtOGF/тоглоом?node-id=168-9379), section `Тоглоом fine gold`, node `168:9379`, retrieved 2026-11-17.

The Figma MCP Starter plan returned its tool-call limit. The user's already-open Safari Figma editor supplied a new local copy through Save local copy. Figma stalled at Downloading images 31/31, so Save partial file was used. The saved archive contains 88 bitmap entries. The requested section's 1,463 nodes were decoded, and all 45 referenced bitmap hashes are present. The partial label does not imply a missing bitmap in the requested section. Assets elsewhere in the file were not part of this audit.

`source.fig` preserves that downloaded archive. `canvas.fig` is its scene data. `nodes.json` contains the requested section only. `image-index.json` maps the 45 originals to their Figma nodes and SHA-256 hashes. `named/` preserves original bitmaps without recompression. `runtime-manifest.json` maps the 19 individually used UI assets to the runtime exports in `public/assets/fine-gold/`.

Runtime raster exports retain transparency and use WebP. Rank images support the largest displayed badge at 3× pixel density. The logo's two image layers use the Figma paint crop transforms and 3× exports. Life-history and music SVGs preserve the original outlined vector geometry and frame dimensions. Full-screen design images are references only. The application still lays out interactive views in DOM/CSS and gameplay in Phaser.

The file uses Mogul Square Regular for game text. The supplied font is bundled in `public/fonts/mogul-square.ttf`, allowing WebViews on other devices to render it without relying on locally installed fonts.

Local binary decoding follows the self-describing Kiwi schema and original vector geometry. Technical references are [Kiwi](https://github.com/evanw/kiwi), [Figma file parser](https://github.com/sunyui/figma-parser/blob/main/scripts/decode_kiwi.cjs) and [vector format notes](https://github.com/OpenFig-org/openfig-core/blob/main/docs/vector.md). The extraction dependencies were installed in a temporary tools directory and were not added to runtime dependencies.
