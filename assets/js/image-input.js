// Reusable image-input widget: sample picker / upload / webcam.
// Mounted once per demo page. Draws whichever image the user picks onto a
// caller-supplied source canvas (downscaled) and calls onImage with it.
//
// Usage:
//   import { mountImageInput } from './image-input.js';
//   mountImageInput({
//     mount: '#image-input',
//     sourceCanvas: document.getElementById('source-canvas'),
//     onImage: (canvas) => { /* re-run this demo's processing */ },
//   });

import { loadImage, downscaleToCanvas } from './util.js';

// Resolved relative to this module's own location (assets/js/), not the
// calling page's URL — so this works the same from root pages and from
// demos/*.html without every caller having to get relative paths right.
const DEFAULT_MANIFEST_URL = new URL('../../data/samples/manifest.json', import.meta.url).href;

export function mountImageInput({
  mount,
  sourceCanvas,
  onImage,
  maxEdge = 1024,
  manifestUrl = DEFAULT_MANIFEST_URL,
  defaultSampleId,
  demo,
}) {
  const container = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!container) throw new Error('mountImageInput: mount point not found');
  if (!sourceCanvas) throw new Error('mountImageInput: sourceCanvas is required');

  container.innerHTML = `
    <div class="image-input">
      <div class="image-input-tabs" role="tablist">
        <button type="button" class="image-input-tab is-active" data-tab="sample">Sample image</button>
        <button type="button" class="image-input-tab" data-tab="upload">Upload</button>
        <button type="button" class="image-input-tab" data-tab="webcam">Webcam</button>
      </div>

      <div class="image-input-panel" data-panel="sample">
        <select class="image-input-sample-select"></select>
        <p class="image-input-sample-desc"></p>
      </div>

      <div class="image-input-panel" data-panel="upload" hidden>
        <label class="image-input-file-label">
          Choose an image…
          <input type="file" accept="image/*" class="visually-hidden image-input-file" />
        </label>
      </div>

      <div class="image-input-panel" data-panel="webcam" hidden>
        <video class="image-input-video" autoplay playsinline muted hidden></video>
        <div class="image-input-webcam-row">
          <button type="button" class="btn btn-secondary image-input-webcam-start">Start webcam</button>
          <button type="button" class="btn btn-primary image-input-webcam-capture" hidden>Capture frame</button>
          <button type="button" class="btn btn-secondary image-input-webcam-stop" hidden>Stop webcam</button>
        </div>
        <p class="image-input-msg"></p>
      </div>
    </div>
  `;

  const tabs = container.querySelectorAll('.image-input-tab');
  const panels = container.querySelectorAll('.image-input-panel');
  const sampleSelect = container.querySelector('.image-input-sample-select');
  const sampleDesc = container.querySelector('.image-input-sample-desc');
  const fileInput = container.querySelector('.image-input-file');
  const video = container.querySelector('.image-input-video');
  const webcamStartBtn = container.querySelector('.image-input-webcam-start');
  const webcamCaptureBtn = container.querySelector('.image-input-webcam-capture');
  const webcamStopBtn = container.querySelector('.image-input-webcam-stop');
  const webcamMsg = container.querySelector('.image-input-msg');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const target = tab.dataset.tab;
      panels.forEach((p) => {
        p.hidden = p.dataset.panel !== target;
      });
    });
  });

  function applyImage(imgSource) {
    downscaleToCanvas(imgSource, maxEdge, sourceCanvas);
    onImage(sourceCanvas);
  }

  // --- Sample images ---
  const sampleBaseUrl = manifestUrl.replace(/[^/]*$/, ''); // directory portion of manifestUrl
  let manifest = [];

  function loadSampleById(id) {
    const entry = manifest.find((e) => e.id === id);
    if (!entry) return;
    sampleDesc.textContent = `${entry.label} · difficulty: ${entry.difficulty}`;
    loadImage(`${sampleBaseUrl}${entry.file}`).then(applyImage);
  }

  fetch(manifestUrl)
    .then((res) => res.json())
    .then((data) => {
      manifest = demo ? data.filter((entry) => entry.demo === demo) : data;
      sampleSelect.innerHTML = '';
      manifest.forEach((entry) => {
        const opt = document.createElement('option');
        opt.value = entry.id;
        opt.textContent = entry.label;
        sampleSelect.appendChild(opt);
      });
      if (manifest.length) {
        const initial = manifest.find((e) => e.id === defaultSampleId) || manifest[0];
        sampleSelect.value = initial.id;
        loadSampleById(initial.id);
      }
    })
    .catch(() => {
      sampleDesc.textContent = 'Could not load sample images. Try uploading your own instead.';
    });

  sampleSelect.addEventListener('change', () => loadSampleById(sampleSelect.value));

  // --- Upload ---
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    loadImage(file).then(applyImage);
  });

  // --- Webcam (optional; always falls back to sample/upload) ---
  let activeStream = null;

  function stopWebcam() {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
    video.hidden = true;
    video.srcObject = null;
    webcamCaptureBtn.hidden = true;
    webcamStopBtn.hidden = true;
    webcamStartBtn.hidden = false;
  }

  webcamStartBtn.addEventListener('click', async () => {
    webcamMsg.textContent = '';
    webcamMsg.classList.remove('is-warn');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      webcamMsg.textContent = 'Camera not supported in this browser. Use upload or a sample image instead.';
      webcamMsg.classList.add('is-warn');
      return;
    }

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = activeStream;
      video.hidden = false;
      webcamStartBtn.hidden = true;
      webcamCaptureBtn.hidden = false;
      webcamStopBtn.hidden = false;
    } catch (err) {
      webcamMsg.textContent = 'Camera access denied or unavailable. Use upload or a sample image instead.';
      webcamMsg.classList.add('is-warn');
    }
  });

  webcamCaptureBtn.addEventListener('click', () => applyImage(video));
  webcamStopBtn.addEventListener('click', stopWebcam);
  window.addEventListener('pagehide', stopWebcam);

  return { destroy: stopWebcam };
}
