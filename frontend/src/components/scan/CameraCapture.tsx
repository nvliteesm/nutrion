"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, XIcon } from "@/components/icons";

type Phase = "live" | "flash" | "processing" | "error";

/**
 * Live camera capture using getUserMedia. On shutter: snaps a still, stops
 * the live stream, shows a processing animation over the photo, then awaits
 * the caller's analyze/upload. Requires HTTPS or localhost.
 */
export function CameraCapture({
  title,
  onCapture,
  onClose,
}: {
  title: string;
  /** Analyze/upload the snapped file. Resolve to proceed; reject to allow retake. */
  onCapture: (file: File) => void | Promise<void>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("live");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function clearPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }

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
      stopStream();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  async function restartLive() {
    clearPreview();
    setProcessError(null);
    setPhase("live");
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
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

  async function capture() {
    if (phase !== "live" || !ready) return;
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

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;

    const file = new File([blob], `scan_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreviewUrl(url);

    // Freeze to still — stop live tracks so the preview doesn't keep moving.
    stopStream();
    setPhase("flash");

    await new Promise((r) => setTimeout(r, 180));
    setPhase("processing");

    try {
      await onCapture(file);
      // Parent navigates / unmounts on success.
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Couldn't analyze this photo.";
      setProcessError(msg);
      setPhase("error");
    }
  }

  const showStill = phase !== "live" && previewUrl;
  const canClose = phase === "live" || phase === "error";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0B1622]">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-[14px] font-semibold text-white">{title}</span>
        {canClose && (
          <button
            onClick={onClose}
            aria-label="Close camera"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-white/70 hover:bg-white/10"
          >
            <XIcon size={20} />
          </button>
        )}
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={
            showStill
              ? "pointer-events-none absolute h-0 w-0 opacity-0"
              : "h-full w-full object-cover"
          }
        />
        {showStill && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Captured photo"
            className="h-full w-full object-cover"
          />
        )}

        {phase === "live" && ready && !error && (
          <>
            <div className="pointer-events-none absolute inset-x-10 inset-y-24 rounded-2xl border-2 border-white/80" />
            <div className="pointer-events-none absolute left-10 top-24 h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-teal" />
            <div className="pointer-events-none absolute bottom-24 right-10 h-6 w-6 rounded-br-xl border-b-[3px] border-r-[3px] border-teal" />
          </>
        )}

        {phase === "flash" && (
          <div className="pointer-events-none absolute inset-0 animate-[camera-flash_180ms_ease-out_forwards] bg-white" />
        )}

        {phase === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B1622]/55">
            <div className="relative h-40 w-40 overflow-hidden rounded-2xl border-2 border-teal/80 shadow-[0_0_40px_rgba(18,184,134,0.35)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl!}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-x-0 h-1 animate-[camera-scan-line_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-teal to-transparent shadow-[0_0_12px_rgba(18,184,134,0.9)]" />
              </div>
              <div className="pointer-events-none absolute inset-0 animate-pulse bg-teal/10" />
            </div>
            <p className="mt-5 text-[14px] font-bold text-white">
              Analyzing with NutriON…
            </p>
            <p className="mt-1 text-[12px] font-medium text-white/60">
              Reading your photo
            </p>
          </div>
        )}

        {error && phase === "live" && (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] font-medium text-white/80">
            {error}
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0B1622]/70 px-8 text-center">
            <p className="text-[13px] font-medium text-white/90">
              {processError ?? "Couldn't analyze this photo."}
            </p>
            <button
              type="button"
              onClick={() => void restartLive()}
              className="rounded-card-sm bg-teal px-5 py-3 text-[13px] font-bold text-navy-ink"
            >
              Retake photo
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 bg-[#0B1622] px-5 pb-8 pt-5">
        {error && phase === "live" ? (
          <button
            onClick={onClose}
            className="rounded-card-sm bg-white/10 px-5 py-3 text-[13px] font-bold text-white"
          >
            Close
          </button>
        ) : phase === "live" ? (
          <button
            onClick={() => void capture()}
            disabled={!ready}
            aria-label="Capture photo"
            className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/40 bg-white text-navy-ink disabled:opacity-50"
          >
            <CameraIcon size={26} />
          </button>
        ) : phase === "processing" || phase === "flash" ? (
          <div
            className="h-16 w-16 animate-pulse rounded-full border-4 border-teal/40 bg-teal/20"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
