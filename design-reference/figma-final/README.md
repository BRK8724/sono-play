# Final Figma design extraction

Source: `https://www.figma.com/design/CJOrtDhCJqWJQHf1IFtOGF/тоглоом?node-id=0-1`

The Figma file is accessible through the connected account. It contains 18 portrait frames at 428 × 926. The `screens/` directory holds frame renders for visual comparison; these renders are **reference only**, not runtime game textures. `raw/` contains original image fills, and `svg/` contains exported vector assets. `manifest.json` maps each downloaded file to its Figma frame ID.

12 frames were exported: Home, Ready (two states), Playing, Game Over (buy/retry), buy attempts (two states), PIN reference, purchase success/failure, and Settings. There are 146 downloaded files; 52 have distinct content hashes because Figma repeats the same artwork across frames. The files have not yet been integrated into the game.

The Figma web editor's **Save local copy** action supplied the complete `source.fig` after an initial partial export. Its canvas tree parses successfully: 18 frames and 747 descendant layers. `layer-index.json` records the frame hierarchy, sizes, transforms, text, and referenced image hashes. `image-index.json` maps every image reference to its source frame/layer and a local named file. The ZIP contains 64 distinct embedded bitmap files, extracted into `fig-images/`; all **39/39 source image hashes referenced by the frames** are present and copied into `named/` without resizing or recompression. Source image SHA-1 hashes and ZIP integrity were checked.

The Figma MCP Starter plan tool-call limit interrupted **standalone PNG frame-render** extraction of the remaining 6 screens: second Settings (`87:777`), Store (`87:551`), second Store (`129:456`), Stats (`87:594`), Gifts (`87:659`), and SONO host entry (`123:238`). Their full layer structure and all source image fills are present in `source.fig`. These six PNG reference renders can be exported later from Figma; they are not required as runtime textures. The full source file and its extracted layers/assets are the authoritative design handoff.

The SONO host entry and PIN are Flutter/core-owned references. Real SP purchases, rewards, and verified scores remain disabled until the backend and finance contracts are approved. Visual reference layers do not override those security requirements.
