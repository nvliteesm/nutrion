"use client";

import { useRouter } from "next/navigation";
import { CameraIcon, ImageIcon } from "@/components/icons";

/** Dark camera-style capture screen. Any action proceeds to processing. */
export function CaptureStep({ onCapture }: { onCapture: () => void }) {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[600px] w-full max-w-[420px] flex-col overflow-hidden rounded-card-lg bg-[#0B1622]">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-[14px] font-semibold text-white">
          Scan drink label
        </span>
        <button
          onClick={() => router.push("/scan")}
          className="text-[13px] font-semibold text-white/60"
        >
          Cancel
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-[#16110c]">
        <div className="absolute inset-x-8 inset-y-11 rounded-2xl border-2 border-white/85" />
        <div className="absolute left-8 top-9 h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-teal" />
        <div className="absolute bottom-9 right-8 h-6 w-6 rounded-br-xl border-b-[3px] border-r-[3px] border-teal" />
        <span className="max-w-[200px] text-center text-[12.5px] font-medium text-white/75">
          Line up the Nutrition Facts panel inside the frame
        </span>
      </div>

      <div className="flex items-center justify-between bg-[#0B1622] px-5 pb-7 pt-5">
        <button
          onClick={onCapture}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/80"
        >
          <ImageIcon size={18} />
          Upload
        </button>
        <button
          onClick={onCapture}
          aria-label="Capture"
          className="h-16 w-16 rounded-full border-4 border-white/35 bg-white"
        />
        <button
          onClick={onCapture}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/80"
        >
          <CameraIcon size={18} />
          Flip
        </button>
      </div>
    </div>
  );
}
