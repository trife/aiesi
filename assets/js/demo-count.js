// Count-objects demo: grayscale -> threshold -> connected components
// (the vanilla-JS stand-in for findContours) -> filter by area -> draw + count.

import { mountImageInput } from './image-input.js';

const sourceCanvas = document.getElementById('source-canvas');
const resultCanvas = document.getElementById('result-canvas');
const readoutValue = document.getElementById('readout-value');

const sliders = {
  threshold: document.getElementById('threshold'),
  minArea: document.getElementById('min-area'),
};
const outputs = {
  threshold: document.getElementById('threshold-out'),
  minArea: document.getElementById('min-area-out'),
};

let currentImageData = null;

function toGray(data, width, height) {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

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

      components.push({ area, minX, maxX, minY, maxY });
    }
  }

  return components;
}

function formatSliderValue(key, value) {
  return key === 'minArea' ? `${value}px²` : value;
}

function syncSliderLabels() {
  Object.entries(sliders).forEach(([key, el]) => {
    outputs[key].textContent = formatSliderValue(key, el.value);
  });
}

function process() {
  if (!currentImageData) return;
  const { data, width, height } = currentImageData;

  const threshold = Number(sliders.threshold.value);
  const minArea = Number(sliders.minArea.value);

  const gray = toGray(data, width, height);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = gray[i] < threshold ? 1 : 0;
  }

  const components = labelComponents(mask, width, height);
  const kept = components.filter((c) => c.area >= minArea);

  const resultCtx = resultCanvas.getContext('2d');
  const resultImageData = resultCtx.createImageData(width, height);
  const out = resultImageData.data;
  for (let i = 0, p = 0; i < out.length; i += 4, p++) {
    const v = mask[p] ? 60 : 235;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  resultCtx.putImageData(resultImageData, 0, 0);

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
  defaultSampleId: 'seeds-clumped',
  onImage: (canvas) => {
    resultCanvas.width = canvas.width;
    resultCanvas.height = canvas.height;
    const ctx = canvas.getContext('2d');
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    process();
  },
});
