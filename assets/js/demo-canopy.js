// Canopy cover demo: RGB -> HSV, threshold a green band, report % masked.
// This is the template the other three demos copy — keep the shape:
//   1. mountImageInput() caches ImageData for the current source image
//   2. sliders re-run process() on that cached ImageData (no re-fetching)
//   3. process() writes a same-size result canvas + updates the readout

import { mountImageInput } from './image-input.js';

const sourceCanvas = document.getElementById('source-canvas');
const resultCanvas = document.getElementById('result-canvas');
const readoutValue = document.getElementById('readout-value');

const sliders = {
  hMin: document.getElementById('h-min'),
  hMax: document.getElementById('h-max'),
  sMin: document.getElementById('s-min'),
  sMax: document.getElementById('s-max'),
  vMin: document.getElementById('v-min'),
  vMax: document.getElementById('v-max'),
};
const outputs = {
  hMin: document.getElementById('h-min-out'),
  hMax: document.getElementById('h-max-out'),
  sMin: document.getElementById('s-min-out'),
  sMax: document.getElementById('s-max-out'),
  vMin: document.getElementById('v-min-out'),
  vMax: document.getElementById('v-max-out'),
};

let currentImageData = null;

// r,g,b in 0-255 -> [h in 0-360, s in 0-100, v in 0-100]
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) h = 60 * (((g - b) / diff) % 6);
    else if (max === g) h = 60 * ((b - r) / diff + 2);
    else h = 60 * ((r - g) / diff + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : diff / max;
  const v = max;
  return [h, s * 100, v * 100];
}

function formatSliderValue(key, value) {
  return key.startsWith('h') ? `${value}°` : `${value}%`;
}

function syncSliderLabels() {
  Object.entries(sliders).forEach(([key, el]) => {
    outputs[key].textContent = formatSliderValue(key, el.value);
  });
}

function process() {
  if (!currentImageData) return;

  const { data, width, height } = currentImageData;
  const hMin = Number(sliders.hMin.value);
  const hMax = Number(sliders.hMax.value);
  const sMin = Number(sliders.sMin.value);
  const sMax = Number(sliders.sMax.value);
  const vMin = Number(sliders.vMin.value);
  const vMax = Number(sliders.vMax.value);

  const resultCtx = resultCanvas.getContext('2d');
  const resultImageData = resultCtx.createImageData(width, height);
  const out = resultImageData.data;

  let matched = 0;
  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s, v] = rgbToHsv(r, g, b);
    const isMatch = h >= hMin && h <= hMax && s >= sMin && s <= sMax && v >= vMin && v <= vMax;

    if (isMatch) {
      matched++;
      out[i] = 230;
      out[i + 1] = 20;
      out[i + 2] = 140;
      out[i + 3] = 220;
    } else {
      out[i] = r * 0.55;
      out[i + 1] = g * 0.55;
      out[i + 2] = b * 0.55;
      out[i + 3] = 255;
    }
  }

  resultCtx.putImageData(resultImageData, 0, 0);

  const pct = total ? (matched / total) * 100 : 0;
  readoutValue.textContent = `${Math.round(pct)}%`;
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
  defaultSampleId: 'canopy-even',
  onImage: (canvas) => {
    resultCanvas.width = canvas.width;
    resultCanvas.height = canvas.height;
    const ctx = canvas.getContext('2d');
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    process();
  },
});
