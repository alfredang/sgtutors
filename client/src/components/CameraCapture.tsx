import { useEffect, useRef, useState } from "react";
import {
  captureFrame,
  toPassportPhoto,
  PASSPORT_RATIO,
} from "../lib/photoPipeline";

type Stage = "idle" | "live" | "processing" | "preview" | "error";

interface Props {
  onPhoto: (photo: Blob) => void;
}

export function CameraCapture({ onPhoto }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopStream(), []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage("live");
      // Attach after render
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError(
        "Could not access your camera. Please allow camera permission and try again."
      );
      setStage("error");
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setStage("processing");
    setProgress({ label: "Capturing", pct: 0 });
    try {
      const raw = await captureFrame(video);
      stopStream();
      const passport = await toPassportPhoto(raw, (label, pct) =>
        setProgress({ label, pct })
      );
      setPreviewUrl(URL.createObjectURL(passport));
      setStage("preview");
      onPhoto(passport);
    } catch (e) {
      console.error(e);
      setError(
        "Photo processing failed. Please try again with good lighting and your face centred."
      );
      setStage("error");
    } finally {
      setProgress(null);
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    void start();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {stage === "idle" && (
        <div className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          <p className="text-sm text-slate-600">
            We'll take a passport-style photo with your camera and automatically
            place it on a white background.
          </p>
          <button type="button" className="btn-primary" onClick={start}>
            Open Camera
          </button>
        </div>
      )}

      {stage === "live" && (
        <>
          <div className="relative w-full max-w-sm overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full -scale-x-100"
            />
            {/* Passport-ratio face guide */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-[50%] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{ height: "78%", aspectRatio: String(PASSPORT_RATIO) }}
              />
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs font-medium text-white drop-shadow">
              Centre your face in the oval, look straight at the camera
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={capture}>
            Take Photo
          </button>
        </>
      )}

      {stage === "processing" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-slate-200 p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-700">
            {progress?.label ?? "Processing"}…
          </p>
          {progress && progress.pct > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded bg-slate-100">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          )}
          <p className="text-xs text-slate-400">
            First-time use downloads a small AI model — this can take a moment.
          </p>
        </div>
      )}

      {stage === "preview" && previewUrl && (
        <>
          <img
            src={previewUrl}
            alt="Passport photo preview"
            className="w-44 rounded-xl border border-slate-200 shadow-md"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={retake}>
              Retake
            </button>
            <span className="btn-primary pointer-events-none opacity-80">
              ✓ Photo ready
            </span>
          </div>
        </>
      )}

      {stage === "error" && (
        <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" className="btn-secondary mt-3" onClick={start}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
