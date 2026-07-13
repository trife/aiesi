// Count-objects demo, mirroring the ImageJ/Fiji workflow: Make Binary
// converts the working image to black/white in place (Step 1), then
// Analyze Particles finds and marks the ones big enough to count on that
// same image (Step 2). One working image throughout, not a separate
// preview per stage — particles that don't meet the size filter stay
// visible in the binary image, they just don't get boxed/numbered.

import { mountImageInput } from './image-input.js';

const sourceCanvas = document.getElementById('source-canvas');
const resultCanvas = document.getElementById('result-canvas');
const readoutValue = document.getElementById('readout-value');

const sliders = {
  rMin: document.getElementById('r-min'),
  rMax: document.getElementById('r-max'),
  gMin: document.getElementById('g-min'),
  gMax: document.getElementById('g-max'),
  bMin: document.getElementById('b-min'),
  bMax: document.getElementById('b-max'),
  minArea: document.getElementById('min-area'),
};
const outputs = {
  rMin: document.getElementById('r-min-out'),
  rMax: document.getElementById('r-max-out'),
  gMin: document.getElementById('g-min-out'),
  gMax: document.getElementById('g-max-out'),
  bMin: document.getElementById('b-min-out'),
  bMax: document.getElementById('b-max-out'),
  minArea: document.getElementById('min-area-out'),
};

// The min-area slider is raw 0-100 but mapped through a quadratic curve to
// an actual px² threshold (0-3000) — most real "clumped vs. noise" decisions
// happen well under 500px², so a plain linear 0-3000 slider spent most of
// its travel on a range that's rarely useful and left almost none for the
// range that matters. Quadratic gives fine control low, coarse control high.
const MIN_AREA_MAX = 3000;
function rawToArea(raw) {
  return Math.round((raw / 100) ** 2 * MIN_AREA_MAX);
}

let currentImageData = null;

// 8-connected flood fill labeling — the vanilla-JS stand-in for cv.findContours.
// Iterative (stack-based), not recursive, so it doesn't blow the call stack
// on a big blob.
function labelComponents(mask, width, height) {
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  let nextLabel = 0;
  const components = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx] || labels[idx] !== 0) continue;

      nextLabel++;
      let sp = 0;
      stack[sp++] = idx;
      labels[idx] = nextLabel;

      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (sp > 0) {
        const cur = stack[--sp];
        const cx = cur % width;
        const cy = (cur / width) | 0;
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const nIdx = ny * width + nx;
            if (mask[nIdx] && labels[nIdx] === 0) {
              labels[nIdx] = nextLabel;
              stack[sp++] = nIdx;
            }
          }
        }
      }

      components.push({ label: nextLabel, area, minX, maxX, minY, maxY });
    }
  }

  return { labels, components };
}

function formatSliderValue(key, value) {
  return key === 'minArea' ? `${rawToArea(value)}px²` : value;
}

function syncSliderLabels() {
  Object.entries(sliders).forEach(([key, el]) => {
    outputs[key].textContent = formatSliderValue(key, el.value);
  });
}

function process() {
  if (!currentImageData) return;
  const { data, width, height } = currentImageData;

  const rMin = Number(sliders.rMin.value);
  const rMax = Number(sliders.rMax.value);
  const gMin = Number(sliders.gMin.value);
  const gMax = Number(sliders.gMax.value);
  const bMin = Number(sliders.bMin.value);
  const bMax = Number(sliders.bMax.value);
  const minArea = rawToArea(Number(sliders.minArea.value));

  // Step 1 (Make Binary): RGB range -> binary. A pixel is foreground only if
  // its R, G, and B each fall inside their own slider range. Nothing after
  // this point ever looks at the original pixels again — everything
  // downstream operates on `mask`, and the result canvas becomes this binary
  // image.
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    mask[p] = r >= rMin && r <= rMax && g >= gMin && g <= gMax && b >= bMin && b <= bMax ? 1 : 0;
  }

  const resultCtx = resultCanvas.getContext('2d');
  const resultImageData = resultCtx.createImageData(width, height);
  const out = resultImageData.data;
  for (let i = 0, p = 0; i < out.length; i += 4, p++) {
    const v = mask[p] ? 0 : 255;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  resultCtx.putImageData(resultImageData, 0, 0);

  // Step 2 (Analyze Particles): connected components on that same binary
  // image, filtered by size. Blobs below the minimum stay visible in the
  // image above — they just don't get boxed or numbered.
  const { components } = labelComponents(mask, width, height);
  const kept = components.filter((c) => c.area >= minArea);

  resultCtx.lineWidth = 3;
  resultCtx.strokeStyle = '#e0a526';
  resultCtx.fillStyle = '#e0a526';
  resultCtx.font = 'bold 16px sans-serif';
  kept.forEach((c, i) => {
    const w = c.maxX - c.minX + 1;
    const h = c.maxY - c.minY + 1;
    resultCtx.strokeRect(c.minX, c.minY, w, h);
    const labelY = c.minY - 4 < 12 ? c.minY + 14 : c.minY - 4;
    resultCtx.fillText(String(i + 1), c.minX + 2, labelY);
  });

  readoutValue.textContent = `${kept.length}`;
}

let rafPending = false;
function scheduleProcess() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    process();
  });
}

Object.entries(sliders).forEach(([key, el]) => {
  el.addEventListener('input', () => {
    outputs[key].textContent = formatSliderValue(key, el.value);
    scheduleProcess();
  });
});

syncSliderLabels();

mountImageInput({
  mount: '#image-input',
  sourceCanvas,
  demo: 'count-objects',
  defaultSampleId: 'count-2',
  onImage: (canvas) => {
    resultCanvas.width = canvas.width;
    resultCanvas.height = canvas.height;
    const ctx = canvas.getContext('2d');
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    process();
  },
});
