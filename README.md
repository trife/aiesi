# AI and Image Data for Plant Sciences

Workshop hub + four in-browser computer-vision demos for the 2026 AI
Educator Summer Institute. Static site, no backend, no build step — the
repo *is* the deployed site.

## Adding a sample image

Each demo's "Sample image" tab is powered by `data/samples/manifest.json`.
To add one:

1. Drop the image file into `data/samples/` (`.jpg`, `.png`, `.svg` all
   work — anything `<img>` can load).
2. Add one entry to `data/samples/manifest.json`:
   ```json
   { "id": "unique-id", "file": "your-file.jpg", "label": "Shown in the dropdown", "difficulty": "easy" }
   ```
3. Refresh any demo page — the new sample shows up in the picker
   automatically, no code changes needed.

The `canopy-even`, `leaf-gradient`, and `shape-edges` samples are
hand-drawn SVG placeholders; the rest are real workshop photos.
