// Edge-detection demo: a hand-rolled Canny pipeline (grayscale -> Gaussian
// blur -> Sobel gradients -> non-max suppression -> hysteresis threshold).
//
// Only the final hysteresis step depends on the two sliders, so the
// expensive blur/gradient/suppression work runs once per image load and is
// cached — slider drags just re-run the cheap final step.

import { mountImageInput } from './image-input.js';

const sourceCanvas = document.getElementById('source-canvas');
const resultCanvas = document.getElementById('result-canvas');
const readoutValue = document.getElementById('readout-value');

const sliders = {
  low: document.getElementById('low-threshold'),
  high: document.getElementById('high-threshold'),
};
const outputs = {
  low: document.getElementById('low-threshold-out'),
  high: document.getElementById('high-threshold-out'),
};

let currentSuppressed = null; // { data: Float32Array, width, height }

function toGray(data, width, height) {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

const GAUSSIAN_KERNEL = [
  2, 4, 5, 4, 2,
  4, 9, 12, 9, 4,
  5, 12, 15, 12, 5,
  4, 9, 12, 9, 4,
  2, 4, 5, 4, 2,
];
const GAUSSIAN_SUM = 159;

function gaussianBlur(gray, width, height) {
  const out = new Float32Array(width * height);
  const r = 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < r || x >= width - r || y < r || y >= height - r) {
        out[y * width + x] = gray[y * width + x];
        continue;
      }
      let sum = 0;
      let k = 0;
      for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          sum += gray[(y + ky) * width + (x + kx)] * GAUSSIAN_KERNEL[k];
          k++;
        }
      }
      out[y * width + x] = sum / GAUSSIAN_SUM;
    }
  }
  return out;
}

// Sobel gradient magnitude + direction, bucketed into 4 orientations
// (0=horizontal, 1=45deg, 2=vertical, 3=135deg) for non-max suppression.
function sobel(gray, width, height) {
  const magnitude = new Float32Array(width * height);
  const direction = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const tl = gray[idx - width - 1];
      const t = gray[idx - width];
      const tr = gray[idx - width + 1];
      const l = gray[idx - 1];
      const rr = gray[idx + 1];
      const bl = gray[idx + width - 1];
      const b = gray[idx + width];
      const br = gray[idx + width + 1];

      const gx = (tr + 2 * rr + br) - (tl + 2 * l + bl);
      const gy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);

      let angle = Math.atan2(gy, gx) * (180 / Math.PI);
      if (angle < 0) angle += 180;
      if (angle < 22.5 || angle >= 157.5) direction[idx] = 0;
      else if (angle < 67.5) direction[idx] = 1;
      else if (angle < 112.5) direction[idx] = 2;
      else direction[idx] = 3;
    }
  }

  return { magnitude, direction };
}

// Thin edges to 1px by keeping only local maxima along the gradient direction.
function nonMaxSuppression(magnitude, direction, width, height) {
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const m = magnitude[idx];
      if (m === 0) continue;

      let m1;
      let m2;
      switch (direction[idx]) {
        case 0:
          m1 = magnitude[idx - 1];
          m2 = magnitude[idx + 1];
          break;
        case 1:
          m1 = magnitude[idx - width + 1];
          m2 = magnitude[idx + width - 1];
          break;
        case 2:
          m1 = magnitude[idx - width];
          m2 = magnitude[idx + width];
          break;
        default:
          m1 = magnitude[idx - width - 1];
          m2 = magnitude[idx + width + 1];
      }

      if (m >= m1 && m >= m2) out[idx] = m;
    }
  }
  return out;
}

// Strong edges (>= high) survive automatically; weak edges (>= low) survive
// only if connected (8-conn) to a strong edge. Iterative stack, no recursion.
function hysteresis(suppressed, width, height, lowThresh, highThresh) {
  const result = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let sp = 0;

  for (let i = 0; i < suppressed.length; i++) {
    if (suppressed[i] >= highThresh) {
      result[i] = 1;
      stack[sp++] = i;
    }
  }

  while (sp > 0) {
    const idx = stack[--sp];
    const cx = idx % width;
    const cy = (idx / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (!result[nIdx] && suppressed[nIdx] >= lowThresh) {
          result[nIdx] = 1;
          stack[sp++] = nIdx;
        }
      }
    }
  }

  return result;
}

function computeEdgeBase(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const gray = toGray(imageData.data, width, height);
  const blurred = gaussianBlur(gray, width, height);
  const { magnitude, direction } = sobel(blurred, width, height);
  const suppressed = nonMaxSuppression(magnitude, direction, width, height);
  currentSuppressed = { data: suppressed, width, height };
}

function formatSliderValue(value) {
  return value;
}

function syncSliderLabels() {
  Object.entries(sliders).forEach(([key, el]) => {
    outputs[key].textContent = formatSliderValue(el.value);
  });
}

function process() {
  if (!currentSuppressed) return;
  const { data, width, height } = currentSuppressed;
  const low = Number(sliders.low.value);
  const high = Number(sliders.high.value);

  const edges = hysteresis(data, width, height, low, high);

  const resultCtx = resultCanvas.getContext('2d');
  const resultImageData = resultCtx.createImageData(width, height);
  const out = resultImageData.data;

  let edgeCount = 0;
  for (let i = 0, p = 0; i < out.length; i += 4, p++) {
    const v = edges[p] ? 255 : 15;
    if (edges[p]) edgeCount++;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  resultCtx.putImageData(resultImageData, 0, 0);

  const pct = (edgeCount / (width * height)) * 100;
  readoutValue.textContent = `${pct.toFixed(1)}%`;
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
    outputs[key].textContent = formatSliderValue(el.value);
    scheduleProcess();
  });
});

syncSliderLabels();

mountImageInput({
  mount: '#image-input',
  sourceCanvas,
  defaultSampleId: 'shape-edges',
  onImage: (canvas) => {
    resultCanvas.width = canvas.width;
    resultCanvas.height = canvas.height;
    computeEdgeBase(canvas);
    process();
  },
});
