"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoxOverlay } from "@/components/BoxOverlay";
import { livePreview } from "@/lib/livePreview";
import type { Detection } from "@/lib/types";

type Props = {
  onCapture: (dataUrl: string) => void;
  analyzing: boolean;
  resultDetections?: Detection[] | null;
  frozenUrl?: string | null;
  /** Previous scan of this surface, shown faint over the live feed so the shot lines up. */
  ghostUrl?: string | null;
};

export function Viewfinder({
  onCapture,
  analyzing,
  resultDetections,
  frozenUrl,
  ghostUrl,
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

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return media;
      });
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
  }, [measure]);

  useEffect(() => {
    void startCamera();
  }, [startCamera]);

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
    if (!file) return;
    const looksImage =
      file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
    if (!looksImage) {
      setError("Please choose a photo (JPEG, PNG, or WebP).");
      return;
    }
    setError(null);
    try {
      let dataUrl: string | null = null;
      try {
        const bitmap = await createImageBitmap(file);
        try {
          dataUrl = toJpegDataUrl(bitmap, bitmap.width, bitmap.height);
        } finally {
          bitmap.close();
        }
      } catch {
        // HEIC / odd formats: fall back to FileReader (may still fail in some browsers).
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        if (!dataUrl.startsWith("data:image/")) {
          throw new Error("unsupported");
        }
      }
      if (!dataUrl) throw new Error("empty");
      onCapture(dataUrl);
    } catch {
      setError("Could not read that image. Try a JPEG or PNG export.");
    }
  }

  const showResult = Boolean(frozenUrl && resultDetections);
  const boxes = showResult ? resultDetections! : preview;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" ref={wrapRef}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
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
            <p className="text-sm text-white/70">Opening camera…</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 text-xs text-zinc-400 underline underline-offset-4"
            >
              Upload instead
            </button>
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

      {/* Always mounted — swapping this for an <img> on capture used to unmount the
          element and drop its srcObject, so "back to live" required a full camera
          restart. The frozen frame now layers on top instead of replacing it. */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      {frozenUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={frozenUrl} alt="Frozen frame" className="absolute inset-0 h-full w-full object-cover" />
      )}

      {/* Line the shot up with last time — never blocks the shutter if it doesn't fit perfectly. */}
      {ghostUrl && !frozenUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ghostUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity"
        />
      )}

      {size.w > 0 && (
        <BoxOverlay
          detections={boxes}
          width={size.w}
          height={size.h}
          className="pointer-events-none absolute inset-0 h-full w-full"
          labeled={showResult}
        />
      )}

      {analyzing && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/50">
          <p className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Looking…</p>        </div>
      )}

      {started && !analyzing && !frozenUrl && (
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-white/40 bg-black/50 px-3 py-2 text-[11px] text-white/80"
          >
            Upload instead
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
