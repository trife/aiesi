const canvasItem = document.getElementById('check-canvas');
const camItem = document.getElementById('check-camera');
const camBtn = document.getElementById('camera-test-btn');
const camStopBtn = document.getElementById('camera-stop-btn');
const camVideo = document.getElementById('camera-preview');

function setCheck(item, state, title, detail) {
  item.classList.remove('is-pending', 'is-ok', 'is-warn');
  item.classList.add(state);
  item.querySelector('.check-title').textContent = title;
  item.querySelector('.check-detail').textContent = detail;
}

// 1. Canvas2D + FileReader support — everything the demos need, and it's synchronous.
const hasCanvas = !!document.createElement('canvas').getContext('2d');
const hasFileReader = typeof FileReader === 'function';
if (hasCanvas && hasFileReader) {
  setCheck(canvasItem, 'is-ok', 'Your browser can run the demos', 'Canvas and file support both work - the demos will start instantly.');
} else {
  setCheck(
    canvasItem,
    'is-warn',
    'Missing browser support',
    'This browser is missing Canvas or file support. Try a recent Chrome, Edge, Firefox, or Safari.'
  );
}

// 2. Camera test — optional, user-gesture gated, always falls back to upload/sample.
let activeStream = null;

function stopCamera() {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
  camVideo.srcObject = null;
  camVideo.hidden = true;
  camStopBtn.hidden = true;
}

camBtn.addEventListener('click', async () => {
  camBtn.disabled = true;
  setCheck(camItem, 'is-pending', 'Requesting camera access…', 'Your browser will ask for permission.');

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia unsupported');
    }
    activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
    camVideo.srcObject = activeStream;
    camVideo.hidden = false;
    camStopBtn.hidden = false;
    setCheck(
      camItem,
      'is-ok',
      'Camera working',
      'You should see a live preview below. Click "Stop camera" when you\'re done - the demos start their own stream fresh.'
    );
  } catch (err) {
    setCheck(
      camItem,
      'is-warn',
      'Camera not available',
      'No camera, permission denied, or unsupported browser. That\'s fine - every demo also accepts uploaded or sample images.'
    );
  } finally {
    camBtn.disabled = false;
  }
});

camStopBtn.addEventListener('click', stopCamera);
window.addEventListener('pagehide', stopCamera);
