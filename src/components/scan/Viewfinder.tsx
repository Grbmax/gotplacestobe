"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoxOverlay } from "@/components/scan/BoxOverlay";
import { DetectorBadge } from "@/components/scan/DetectorBadge";
import { livePreview } from "@/lib/scan/livePreview";
import type { Detection } from "@/lib/scan/types";

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
    <div className="relative h-full w-full overflow-hidden bg-ink" ref={wrapRef}>
      {!started && !error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-moss p-6 text-center text-paper">
          <div>
            <p className="serif text-2xl">Camera required</p>
            <p className="mt-2 text-sm text-paper/65">
              Start the rear camera to inspect a wall, ceiling, or fixture.
            </p>
            <button
              type="button"
              onClick={startCamera}
              className="mt-6 rounded-full bg-leaf px-6 py-3 text-sm font-semibold text-ink"
            >
              Start camera
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-moss p-6 text-center text-paper">
          <div>
            <p className="serif text-2xl">Camera blocked</p>
            <p className="mt-2 text-sm text-paper/65">{error}</p>
            <button
              type="button"
              onClick={startCamera}
              className="mt-6 rounded-full bg-leaf px-6 py-3 text-sm font-semibold text-ink"
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
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink/50">
          <p className="rounded-full bg-leaf px-4 py-2 text-sm font-medium text-ink">Analyzing…</p>
        </div>
      )}

      {started && !analyzing && !frozenUrl && (
        <button
          type="button"
          onClick={shutter}
          aria-label="Shutter"
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full border-4 border-paper bg-paper/90 shadow-lg"
          style={{ height: 72, width: 72 }}
        />
      )}
    </div>
  );
}
