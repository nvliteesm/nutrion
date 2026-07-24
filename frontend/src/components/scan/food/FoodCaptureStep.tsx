"use client";

import { useRouter } from "next/navigation";
import { CameraIcon, ImageIcon } from "@/components/icons";

export function FoodCaptureStep({ onCapture }: { onCapture: () => void }) {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[600px] w-full max-w-[420px] flex-col overflow-hidden rounded-card-lg bg-[#0B1622]">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-[14px] font-semibold text-white">Scan food</span>
        <button
          onClick={() => router.push("/scan")}
          className="text-[13px] font-semibold text-white/60"
        >
          Cancel
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-[#221d16]">
        <div className="absolute inset-x-8 inset-y-16 rounded-2xl border-2 border-white/80" />
        <span className="max-w-[220px] text-center text-[12.5px] font-medium text-white/75">
          Center your whole plate in the frame for the best estimate
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
