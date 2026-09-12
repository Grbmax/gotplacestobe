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

  function shutter() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  const showResult = Boolean(frozenUrl && resultDetections);
  const boxes = showResult ? resultDetections! : preview;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" ref={wrapRef}>
      {!started && !error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-zinc-950 p-6 text-center text-white">
          <div>
            <p className="text-lg font-medium">Camera required</p>
            <p className="mt-2 text-sm text-white/60">Start the rear camera to aim and scan surfaces.</p>
            <button
              type="button"
              onClick={startCamera}
              className="mt-6 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-black"
            >
              Start camera
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-zinc-950 p-6 text-center text-white">
          <div>
            <p className="text-lg font-medium">Camera blocked</p>
            <p className="mt-2 text-sm text-white/60">{error}</p>
            <button
              type="button"
              onClick={startCamera}
              className="mt-6 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-black"
            >
              Retry
            </button>
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
        <DetectorBadge
          detector={showResult && resultDetector ? resultDetector : analyzing ? "preview" : "preview"}
        />
      </div>

      {analyzing && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/50">
          <p className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Analyzing…</p>
        </div>
      )}

      {started && !analyzing && !frozenUrl && (
        <button
          type="button"
          onClick={shutter}
          aria-label="Shutter"
          className="absolute bottom-8 left-1/2 z-10 h-18 w-18 -translate-x-1/2 rounded-full border-4 border-white bg-white/90 shadow-lg"
          style={{ height: 72, width: 72 }}
        />
      )}
    </div>
  );
}
