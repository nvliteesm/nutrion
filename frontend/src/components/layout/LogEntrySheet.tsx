"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CameraIcon,
  CupIcon,
  FileTextIcon,
  ImageIcon,
  PencilIcon,
  UtensilsIcon,
} from "@/components/icons";
import { analyzeAndResume } from "@/components/scan/ScanCaptureSheet";
import { cn } from "@/lib/cn";
import { CameraCapture } from "@/components/scan/CameraCapture";
import { Sheet } from "./Sheet";

type Kind = "drink" | "food" | "medical";

interface SubAction {
  id: "camera" | "gallery" | "manual";
  label: string;
  icon: typeof CameraIcon;
}

const SUB_ACTIONS: SubAction[] = [
  { id: "camera", label: "Camera", icon: CameraIcon },
  { id: "gallery", label: "Gallery", icon: ImageIcon },
  { id: "manual", label: "Manual", icon: PencilIcon },
];

const PRIMARY = [
  {
    kind: "drink" as const,
    title: "Drink",
    blurb: "Label or bottle — camera, gallery, or manual",
    icon: CupIcon,
    iconWrap: "bg-blue-t text-blue-d",
    hasSubs: true,
  },
  {
    kind: "food" as const,
    title: "Food",
    blurb: "Meal photo — camera, gallery, or manual",
    icon: UtensilsIcon,
    iconWrap: "bg-app-bg text-ink",
    hasSubs: true,
  },
  {
    kind: "medical" as const,
    title: "Medical report",
    blurb: "Upload blood sugar or lipid lab results",
    icon: FileTextIcon,
    iconWrap: "bg-red-t text-red-d",
    hasSubs: false,
  },
];

export function LogEntrySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<Kind | null>(null);
  const [cameraFor, setCameraFor] = useState<Kind | null>(null);
  const [galleryFor, setGalleryFor] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setExpanded(null);
      setCameraFor(null);
      setGalleryFor(null);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  function resetLocal() {
    setExpanded(null);
    setCameraFor(null);
    setGalleryFor(null);
    setError(null);
  }

  function handleClose() {
    if (busy) return;
    resetLocal();
    onClose();
  }

  async function runAnalyze(kind: Kind, file: File, fromCamera = false) {
    if (!fromCamera) {
      setBusy(true);
      setExpanded(null);
    }
    setError(null);
    try {
      await analyzeAndResume(kind, file);
      resetLocal();
      setBusy(false);
      onClose();
      router.push(`/scan?mode=${kind}&resume=1`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analyze failed";
      if (fromCamera) throw err instanceof Error ? err : new Error(msg);
      setError(msg);
      setBusy(false);
      setGalleryFor(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onSubAction(kind: Kind, action: SubAction["id"]) {
    if (busy) return;
    setError(null);
    if (action === "manual") {
      handleClose();
      router.push(`/scan/manual?type=${kind}`);
      return;
    }
    if (action === "camera") {
      setCameraFor(kind);
      return;
    }
    // gallery
    setGalleryFor(kind);
    requestAnimationFrame(() => fileRef.current?.click());
  }

  function onMedical() {
    if (busy) return;
    setError(null);
    setGalleryFor("medical");
    requestAnimationFrame(() => fileRef.current?.click());
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const kind = galleryFor;
    if (file && kind) void runAnalyze(kind, file);
  }

  const accept =
    galleryFor === "medical" ? "image/*,.pdf,.txt,.md" : "image/*";

  return (
    <>
      <Sheet open={open} onClose={handleClose}>
        <div className="px-5 pb-2 pt-3">
          <h2 className="text-[20px] font-extrabold tracking-tight text-ink">
            Log an entry
          </h2>
          <p className="mt-1 text-[13px] font-medium text-ink-3">
            {busy
              ? "Hang tight — NutriON is analyzing your upload"
              : "Choose drink, food, or a medical report"}
          </p>
        </div>

        <div
          className={cn(
            "flex flex-col gap-2.5 overflow-y-auto px-4 pb-6 pt-2",
            busy && "pointer-events-none select-none",
          )}
          aria-busy={busy}
        >
          {PRIMARY.map((opt) => {
            const Icon = opt.icon;
            const isOpen = !busy && expanded === opt.kind;

            return (
              <div
                key={opt.kind}
                className={cn(
                  "rounded-[16px] border border-line bg-card transition-colors",
                  busy
                    ? "opacity-55"
                    : "hover:border-line-2 hover:bg-app-bg/50",
                )}
                onMouseEnter={() => {
                  if (!busy && opt.hasSubs) setExpanded(opt.kind);
                }}
                onMouseLeave={() => {
                  if (!busy && opt.hasSubs && expanded === opt.kind) {
                    setExpanded(null);
                  }
                }}
              >
                <button
                  type="button"
                  disabled={busy}
                  tabIndex={busy ? -1 : undefined}
                  onClick={() => {
                    if (busy) return;
                    if (!opt.hasSubs) {
                      onMedical();
                      return;
                    }
                    setExpanded((v) => (v === opt.kind ? null : opt.kind));
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left"
                >
                  <span
                    className={cn(
                      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]",
                      opt.iconWrap,
                    )}
                  >
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-ink">
                      {opt.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-medium text-ink-3">
                      {opt.blurb}
                    </span>
                  </span>
                </button>

                {opt.hasSubs && (
                  <div
                    className={cn(
                      "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="min-h-0">
                      <div className="flex gap-2 border-t border-line/80 px-3 pb-3 pt-2">
                        {SUB_ACTIONS.map((sub) => {
                          const SubIcon = sub.icon;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              disabled={busy}
                              tabIndex={busy ? -1 : undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSubAction(opt.kind, sub.id);
                              }}
                              className="flex flex-1 flex-col items-center gap-1.5 rounded-[12px] border border-transparent bg-app-bg/80 px-2 py-2.5 text-ink-2 transition-colors hover:border-line hover:bg-app-bg hover:text-ink disabled:hover:border-transparent disabled:hover:bg-app-bg/80 disabled:hover:text-ink-2"
                            >
                              <SubIcon size={18} />
                              <span className="text-[11px] font-semibold">
                                {sub.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <p className="pointer-events-auto rounded-[12px] bg-red-t px-3 py-2 text-[12px] font-medium text-red-d">
              {error}
            </p>
          )}
          {busy && (
            <p className="flex items-center justify-center gap-2 text-center text-[12px] font-medium text-ink-3">
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal border-t-transparent"
                aria-hidden
              />
              Analyzing with NutriON…
            </p>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onFileChange}
        />
      </Sheet>

      {cameraFor && (
        <CameraCapture
          title={
            cameraFor === "drink"
              ? "Scan drink"
              : cameraFor === "food"
                ? "Scan food"
                : "Medical report"
          }
          onCapture={(file) => runAnalyze(cameraFor, file, true)}
          onClose={() => setCameraFor(null)}
        />
      )}
    </>
  );
}
