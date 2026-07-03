/**
 * Passport-photo pipeline:
 * camera frame -> background removal -> composite on white -> 35:45 crop -> webp
 *
 * Background removal is behind a small interface so the implementation
 * (@imgly/background-removal WASM model) can be swapped out in one place.
 */

export const PASSPORT_RATIO = 35 / 45;
export const OUTPUT_WIDTH = 700;
export const OUTPUT_HEIGHT = 900;

export type ProgressFn = (label: string, pct: number) => void;

async function removeBg(blob: Blob, onProgress?: ProgressFn): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(blob, {
    progress: (key, current, total) => {
      if (onProgress && total > 0) {
        const label = key.startsWith("fetch") ? "Downloading AI model" : "Processing";
        onProgress(label, Math.round((current / total) * 100));
      }
    },
  });
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return resolve(webp);
        // Fallback to JPEG when the browser can't encode webp
        canvas.toBlob(
          (jpg) => (jpg ? resolve(jpg) : reject(new Error("Encoding failed"))),
          "image/jpeg",
          0.85
        );
      },
      "image/webp",
      0.85
    );
  });
}

/** Capture the current video frame into a PNG blob. */
export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Capture failed"))),
      "image/png"
    );
  });
}

/**
 * Full pipeline: raw capture -> passport photo on white background.
 */
export async function toPassportPhoto(
  rawCapture: Blob,
  onProgress?: ProgressFn
): Promise<Blob> {
  onProgress?.("Removing background", 0);
  const cutout = await removeBg(rawCapture, onProgress);
  onProgress?.("Compositing", 95);

  const img = await loadImage(cutout);

  // Center-crop the source to the passport aspect ratio
  const srcRatio = img.width / img.height;
  let cropW = img.width;
  let cropH = img.height;
  if (srcRatio > PASSPORT_RATIO) {
    cropW = img.height * PASSPORT_RATIO;
  } else {
    cropH = img.width / PASSPORT_RATIO;
  }
  const cropX = (img.width - cropW) / 2;
  const cropY = (img.height - cropH) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT
  );

  onProgress?.("Encoding", 99);
  return canvasToBlob(canvas);
}
