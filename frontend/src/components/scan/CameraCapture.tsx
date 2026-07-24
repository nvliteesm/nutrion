"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, XIcon } from "@/components/icons";

/**
 * Live camera capture using getUserMedia. Shows a rear-camera preview with a
 * framing guide, captures a still to a File, and hands it back to the caller.
 * Requires HTTPS or localhost. Falls back to an error message if unavailable.
 */
export function CameraCapture({
  title,
  onCapture,
  onClose,
}: {
  title: string;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera isn't available on this device or browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError(
          "Couldn't access the camera. Check permissions, or use “Choose file” instead.",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `scan_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0B1622]">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-[14px] font-semibold text-white">{title}</span>
        <button
          onClick={onClose}
          aria-label="Close camera"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-white/70 hover:bg-white/10"
        >
          <XIcon size={20} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {ready && !error && (
          <>
            <div className="pointer-events-none absolute inset-x-10 inset-y-24 rounded-2xl border-2 border-white/80" />
            <div className="pointer-events-none absolute left-10 top-24 h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-teal" />
            <div className="pointer-events-none absolute bottom-24 right-10 h-6 w-6 rounded-br-xl border-b-[3px] border-r-[3px] border-teal" />
          </>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] font-medium text-white/80">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 bg-[#0B1622] px-5 pb-8 pt-5">
        {error ? (
          <button
            onClick={onClose}
            className="rounded-card-sm bg-white/10 px-5 py-3 text-[13px] font-bold text-white"
          >
            Close
          </button>
        ) : (
          <button
            onClick={capture}
            disabled={!ready}
            aria-label="Capture photo"
            className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/40 bg-white text-navy-ink disabled:opacity-50"
          >
            <CameraIcon size={26} />
          </button>
        )}
      </div>
    </div>
  );
}
