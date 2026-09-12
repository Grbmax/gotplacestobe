"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoxOverlay } from "@/components/BoxOverlay";
import { DetectorBadge } from "@/components/DetectorBadge";
import { livePreview } from "@/lib/livePreview";
import type { Detection } from "@/lib/types";

type Props = {
  onCapture: (dataUrl: string) => void;
  analyzing: boolean;
  resultDetections?: Detection[] | null;
  resultDetector?: "gemini" | "mock" | null;
  frozenUrl?: string | null;
};

export function Viewfinder({
  onCapture,
  analyzing,
  resultDetections,
  resultDetector,
  frozenUrl,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [preview, setPreview] = useState<Detection[]>([]);
  const [started, setStarted] = useState(false);

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure, started]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  async function startCamera() {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setStream(media);
      setStarted(true);
      const video = videoRef.current;
      if (video) {
        video.srcObject = media;
        await video.play();
      }
      requestAnimationFrame(measure);
    } catch {
      setError("Camera permission denied. Allow camera access and retry.");
      setStarted(false);
    }
  }

  useEffect(() => {
    if (!started || analyzing || frozenUrl) return;
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const video = videoRef.current;
      if (video && video.videoWidth > 0) {
        const max = 416;
        const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
        setPreview(livePreview(video.videoWidth * scale, video.videoHeight * scale));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [started, analyzing, frozenUrl]);

  function toJpegDataUrl(source: CanvasImageSource, width: number, height: number) {
    // Cap the long edge — cheaper for Gemini and smaller when stored inline in Mongo.
    const MAX_EDGE = 1440;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function shutter() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const dataUrl = toJpegDataUrl(video, video.videoWidth, video.videoHeight);
    if (dataUrl) onCapture(dataUrl);
  }

  async function onUploadFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    const bitmap = await createImageBitmap(file);
    try {
      const dataUrl = toJpegDataUrl(bitmap, bitmap.width, bitmap.height);
      if (dataUrl) onCapture(dataUrl);
    } finally {
      bitmap.close();
    }
  }

  const showResult = Boolean(frozenUrl && resultDetections);
  const boxes = showResult ? resultDetections! : preview;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" ref={wrapRef}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onUploadFile(file).catch(() => setError("Could not read that image."));
        }}
      />

      {!started && !error && !frozenUrl && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-zinc-950 p-6 text-center text-white">
          <div>
            <p className="text-lg font-medium">Scan a surface</p>
            <p className="mt-2 text-sm text-white/60">
              Use the camera, or upload a photo/frame for Gemini to label mold, water, cracks, and peeling.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={startCamera}
                className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-black"
              >
                Start camera
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-full border border-zinc-600 px-6 py-3 text-sm font-semibold text-white"
              >
                Upload photo
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !frozenUrl && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-zinc-950 p-6 text-center text-white">
          <div>
            <p className="text-lg font-medium">Camera blocked</p>
            <p className="mt-2 text-sm text-white/60">{error}</p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={startCamera}
                className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-black"
              >
                Retry camera
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-full border border-zinc-600 px-6 py-3 text-sm font-semibold text-white"
              >
                Upload photo instead
              </button>
            </div>
          </div>
        </div>
      )}

      {frozenUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={frozenUrl} alt="Frozen frame" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
      )}

      {size.w > 0 && (
        <BoxOverlay
          detections={boxes}
          width={size.w}
          height={size.h}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      )}

      <div className="absolute left-3 top-3 z-10">
        <DetectorBadge detector={showResult && resultDetector ? resultDetector : "preview"} />
      </div>

      {analyzing && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/50">
          <p className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
            Analyzing with Gemini…
          </p>
        </div>
      )}

      {started && !analyzing && !frozenUrl && (
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-white/40 bg-black/50 px-4 py-2 text-xs font-medium text-white"
          >
            Upload
          </button>
          <button
            type="button"
            onClick={shutter}
            aria-label="Shutter"
            className="rounded-full border-4 border-white bg-white/90 shadow-lg"
            style={{ height: 72, width: 72 }}
          />
          <span className="w-[4.5rem]" aria-hidden />
        </div>
      )}
    </div>
  );
}
