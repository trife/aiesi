# AI and Image Data for Plant Sciences

Workshop hub + four in-browser computer-vision demos for the 2026 AI
Educator Summer Institute. Static site, no backend, no build step — the
repo *is* the deployed site.

## Architecture note: no OpenCV.js

The original build plan called for OpenCV.js (WebAssembly). That was tried
first and dropped: the full default OpenCV.js build takes multiple minutes
to initialize on ordinary laptops (confirmed across Chrome, Edge, and
Firefox) — bundling modules (dnn, video, stitching, calib3d, ml, photo)
none of the four demos use. That's disqualifying for a room of mixed
laptops on workshop Wi-Fi.

Instead, all four demos are hand-written vanilla JavaScript operating
directly on `<canvas>` `ImageData` — no WASM, no vendored binary, no load
wait. Same pedagogy, same UI, different implementation underneath. See
`assets/js/demo-canopy.js`, `demo-count.js`, `demo-color.js`, and
`demo-edges.js`.

## Running locally

**`file://` will not work.** Opening `index.html` directly from disk blocks
ES module imports (`<script type="module">`) and `fetch()` calls (used to
load `data/samples/manifest.json` and the sample images) under the
`file://` protocol. You need an actual HTTP server — any static file
server works, since there's no backend logic to run.

From the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**On Windows**, `python3` often isn't on PATH even when Python is
installed (it resolves to a Microsoft Store stub instead). Use the `py`
launcher instead:

```powershell
py -3 -m http.server 8000
```

Any other static server works too (`npx serve`, VS Code's Live Server
extension, etc.) — there's nothing server-specific about this site.

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

The four images currently in `data/samples/` are hand-drawn SVG
placeholders standing in for real workshop photos (see "Needs your input"
below) — they exercise each demo's logic reasonably but aren't real plant
photography.

## Deploying to GitHub Pages

1. Push this repo to GitHub. The repo must be **public** for free Pages
   (or a GitHub Pro/Team plan for private Pages).
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a
   branch**.
4. Branch: `main`, folder: **`/ (root)`** — this repo's root *is* the site,
   don't select `/docs`.
5. Save. GitHub Pages builds and publishes automatically on every push to
   `main` (usually live within a minute or two).
6. HTTPS is automatic and required — the webcam features
   (`getUserMedia`) won't work over plain HTTP.
7. `.nojekyll` is already present at the repo root, which tells Pages to
   serve every file as-is (without it, Jekyll would ignore files/folders
   starting with `_` and could mangle other things).

No custom domain is needed for the workshop; can be added later under
Pages settings if wanted.

## Technical gotchas

- **Webcam** needs HTTPS (Pages provides this) + a user gesture + camera
  permission. Every demo and `materials.html` fall back gracefully to
  upload/sample images if the camera is unavailable or denied — never
  required.
- **Downscaling:** `assets/js/util.js`'s `downscaleToCanvas()` caps the
  longest edge at 1024px before any per-pixel processing runs, so a big
  phone photo doesn't stall the UI. This runs once per image load, not per
  slider tick.
- **Per-image vs. per-slider work:** every demo caches the expensive
  per-pixel work (reading `ImageData`, and for edge-detection specifically
  also the Gaussian blur + Sobel + non-max suppression) once when a new
  image loads, and only re-runs the cheap final step (thresholding /
  hysteresis) on slider drags, throttled via `requestAnimationFrame`. Copy
  this pattern if you add a fifth demo.
- **Path resolution:** `image-input.js` resolves `data/samples/` relative
  to its own file location (`assets/js/`), not the calling page's URL —
  this is what makes it work correctly from both root pages (`materials.html`)
  and `demos/*.html` without every caller needing to pass the right
  relative path.

## Needs your input before the workshop

- **Real sample images.** `data/samples/*.svg` are synthetic placeholders
  I drew by hand — replace with real workshop photos (canopy/plot shot,
  seeds or plants to count — include a genuinely hard one with clumping/
  shadows per the original plan, a healthy-to-diseased leaf series, and a
  general scene for edge detection). Update `manifest.json` to match.
- **Real trust-check worksheet.** `downloads/trust-check.pdf` is a
  generated placeholder with six generic starter questions — replace with
  your actual six-question trust check.
- **Real activity template.** `downloads/activity-template.pdf` is a bare
  section skeleton — replace with your real template.
- **Session 1 slides link.** `index.html`'s downloads section currently
  says "Link coming soon" — add the real link once you have it.
- **Facilitator run-of-show content.** `facilitator.html` is a
  timing/structure stub with `[TODO]`-marked talking points — fill in your
  own before the session.
- **Teachable Machine pre-trained model (optional).** `teachable-machine.html`
  has an inert embed slot for a pre-trained TM model, documented inline —
  only wire it up if you want a working live classifier on the page even
  when someone's own training fails. The plan explicitly flags this as
  optional and asks you to verify the current TM export flow before
  relying on it, since Google has changed that UI before.
- **Push to GitHub + enable Pages.** Nothing has been pushed anywhere —
  see "Deploying to GitHub Pages" above.
- **Decide repo visibility** (public, for free Pages — or private with a
  paid plan).
