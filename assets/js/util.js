// Shared canvas/image helpers used by every demo.
//
// Note: the build plan originally called for a withMat() cleanup helper —
// that was for OpenCV.js's manually-freed cv.Mat objects. This site no
// longer uses OpenCV.js (see materials.html/README for why), so there's nothing
// to free: Canvas and ImageData are ordinary garbage-collected JS objects.

// Loads an <img> from a URL or a File/Blob. Revokes any object URL it
// creates once the image has loaded (or failed), so callers don't leak them.
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = source instanceof Blob ? URL.createObjectURL(source) : null;

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${source}`));
    };
    img.src = objectUrl || source;
  });
}

function getSourceDimensions(source) {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

// Draws an image/video/canvas source onto `canvas`, scaling down (never up)
// so the longest edge is at most maxEdge px. Big phone photos would
// otherwise stall the UI during per-pixel processing.
export function downscaleToCanvas(source, maxEdge = 1024, canvas = document.createElement('canvas')) {
  const { width, height } = getSourceDimensions(source);
  if (!width || !height) {
    throw new Error('Image source has no natural dimensions yet.');
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
