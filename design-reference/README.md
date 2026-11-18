# Sono Play design assets

Source: `/Users/bilguun/Downloads/export-2.pdf` (13 pages). The rendered screens are in `pages/`, and `assets-contact.webp` shows the separated assets at a glance.

The game-ready files are in `../public/assets/sono/` and mirrored in the Pocketwise miniapp at `miniapps/pet/public/assets/sono/`.

| Asset | Origin | Use |
| --- | --- | --- |
| `menu-background.webp` | PDF page 12 embedded background | Menu and store backdrop |
| `menu-logo.png` | PDF page 12 transparent logo | Menu title |
| `gold.png` | PDF page 1 transparent image | Gold skin |
| `santa.png` | PDF page 3 transparent image | Santa skin |
| `sunset-preview.webp`, `city-preview.webp` | PDF page 3 embedded images | Store background previews |
| `sunset-background.webp`, `city-background.webp` | Expanded from PDF page 3 previews | Selectable gameplay backgrounds |
| `coin.png`, `heart.png` | PDF pages 5–11 embedded images | Balance and lives UI |
| `trophy.png` | PDF page 1 embedded image | Additional UI asset |
| `sorry-bird.png`, `success-bird.png`, `profile-bird.png` | PDF pages 4–6 embedded images | Additional character assets |
| `pilot.png` | Background removed from the existing pilot sprite | Playable character |
| `game-background.webp` | Pipes and character removed from PDF gameplay image | Gameplay backdrop |
| `pipe.png` | Recreated from PDF gameplay pipe reference | Moving obstacle |

The source PDF flattens the pilot, pipes, and gameplay backdrop into a single image. These three files are derived cutouts or reconstructions; the other listed assets come directly from embedded PDF images. UI buttons and panels are rendered with CSS so labels and state remain live.
