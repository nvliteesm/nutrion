"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, ImageIcon, PencilIcon } from "@/components/icons";
import { analyzeDrink, analyzeFood, analyzeMedical } from "@/lib/api";
import { cn } from "@/lib/cn";
import { CameraCapture } from "@/components/scan/CameraCapture";
import { Sheet } from "@/components/layout/Sheet";

export const SCAN_RESUME_KEY = "nutrion.scan.resume";

export type ScanKind = "drink" | "food" | "medical";

/** Analyze a file and stash the result for /scan?resume=1 review. */
export async function analyzeAndResume(
  kind: ScanKind,
  file: File,
): Promise<void> {
  let payload: unknown;
  if (kind === "drink") {
    payload = { mode: "drink", ...(await analyzeDrink(file)) };
  } else if (kind === "food") {
    payload = { mode: "food", ...(await analyzeFood(file)) };
  } else {
    payload = { mode: "medical", ...(await analyzeMedical(file)) };
  }
  sessionStorage.setItem(SCAN_RESUME_KEY, JSON.stringify(payload));
}

/**
 * Popup: Camera / Gallery (and optional Manual) for drink or food.
 * Runs the matching backend analyze API, then opens the review screen.
 */
export function ScanCaptureSheet({
  open,
  kind,
  onClose,
  showManual = true,
}: {
  open: boolean;
  kind: "drink" | "food" | null;
  onClose: () => void;
  showManual?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCameraOpen(false);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  if (!kind) return null;

  const title = kind === "drink" ? "Log a drink" : "Log food";
  const blurb =
    kind === "drink"
      ? "Scan a label or bottle with camera or gallery"
      : "Snap or upload a meal for an AI estimate";

  async function run(file: File, fromCamera = false) {
    if (!kind) return;
    if (!fromCamera) setBusy(true);
    setError(null);
    try {
      await analyzeAndResume(kind, file);
      setCameraOpen(false);
      onClose();
      router.push(`/scan?mode=${kind}&resume=1`);
    } catch (err) {
      if (fromCamera) throw err;
      setError(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      if (!fromCamera) {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    }
  }

  const actions = [
    {
      id: "camera" as const,
      label: "Camera",
      blurb: "Take a photo now",
      icon: CameraIcon,
      onClick: () => setCameraOpen(true),
    },
    {
      id: "gallery" as const,
      label: "Gallery",
      blurb: "Choose an existing photo",
      icon: ImageIcon,
      onClick: () => fileRef.current?.click(),
    },
    ...(showManual
      ? [
          {
            id: "manual" as const,
            label: "Manual",
            blurb: "Type the details yourself",
            icon: PencilIcon,
            onClick: () => {
              onClose();
              router.push(`/scan/manual?type=${kind}`);
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div className="px-5 pb-2 pt-3">
          <h2 className="text-[20px] font-extrabold tracking-tight text-ink">
            {title}
          </h2>
          <p className="mt-1 text-[13px] font-medium text-ink-3">{blurb}</p>
        </div>

        <div className="flex flex-col gap-2.5 overflow-y-auto px-4 pb-6 pt-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={action.onClick}
                className={cn(
                  "flex items-center gap-3 rounded-[16px] border border-line bg-card px-3.5 py-3.5 text-left transition-colors",
                  "hover:border-line-2 hover:bg-app-bg/50 disabled:opacity-60",
                )}
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-app-bg text-ink">
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] font-medium text-ink-3">
                    {action.blurb}
                  </span>
                </span>
              </button>
            );
          })}

          {error && (
            <p className="rounded-[12px] bg-red-t px-3 py-2 text-[12px] font-medium text-red-d">
              {error}
            </p>
          )}
          {busy && (
            <p className="text-center text-[12px] font-medium text-ink-3">
              Analyzing with NutriON…
            </p>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void run(file);
          }}
        />
      </Sheet>

      {cameraOpen && (
        <CameraCapture
          title={title}
          onCapture={(file) => run(file, true)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );
}
