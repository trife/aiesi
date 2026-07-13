// Color-health demo: classify each pixel as green or brown/yellow by hue,
// report the ratio as a "health index." The number is only as meaningful
// as the hue split and saturation cutoff that define it — that's the point.

import { mountImageInput } from './image-input.js';

const sourceCanvas = document.getElementById('source-canvas');
const resultCanvas = document.getElementById('result-canvas');
const readoutValue = document.getElementById('readout-value');

const sliders = {
  hueSplit: document.getElementById('hue-split'),
  satMin: document.getElementById('sat-min'),
};
const outputs = {
  hueSplit: document.getElementById('hue-split-out'),
  satMin: document.getElementById('sat-min-out'),
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
  return [h, s * 100];
}

function formatSliderValue(key, value) {
  return key === 'hueSplit' ? `${value}°` : `${value}%`;
}

function syncSliderLabels() {
  Object.entries(sliders).forEach(([key, el]) => {
    outputs[key].textContent = formatSliderValue(key, el.value);
  });
}

function process() {
  if (!currentImageData) return;
  const { data, width, height } = currentImageData;

  const hueSplit = Number(sliders.hueSplit.value);
  const satMin = Number(sliders.satMin.value);

  const resultCtx = resultCanvas.getContext('2d');
  const resultImageData = resultCtx.createImageData(width, height);
  const out = resultImageData.data;

  let greenCount = 0;
  let brownCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s] = rgbToHsv(r, g, b);

    if (s < satMin) {
      // near-gray / background — not classified either way
      out[i] = r * 0.35;
      out[i + 1] = g * 0.35;
      out[i + 2] = b * 0.35;
      out[i + 3] = 255;
      continue;
    }

    if (h >= hueSplit) {
      greenCount++;
      out[i] = 40;
      out[i + 1] = 210;
      out[i + 2] = 90;
      out[i + 3] = 230;
    } else {
      brownCount++;
      out[i] = 210;
      out[i + 1] = 110;
      out[i + 2] = 30;
      out[i + 3] = 230;
    }
  }

  resultCtx.putImageData(resultImageData, 0, 0);

  const classified = greenCount + brownCount;
  const pct = classified ? (greenCount / classified) * 100 : 0;
  readoutValue.textContent = classified ? `${Math.round(pct)}%` : '-';
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
  demo: 'color-health',
  defaultSampleId: 'leaf-gradient',
  onImage: (canvas) => {
    resultCanvas.width = canvas.width;
    resultCanvas.height = canvas.height;
    const ctx = canvas.getContext('2d');
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    process();
  },
});
