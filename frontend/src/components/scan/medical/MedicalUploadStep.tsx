"use client";

import { useRef } from "react";
import { Card, Button, Badge } from "@/components/ui";
import { FileTextIcon, InfoIcon, SparkleIcon } from "@/components/icons";
import { MEDICAL_DISCLAIMER } from "@/lib/medical";

export function MedicalUploadStep({ onUpload }: { onUpload: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2.5">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
          Medical report
        </h1>
        <Badge tone="amber">
          <SparkleIcon size={10} />
          PREMIUM
        </Badge>
      </div>
      <p className="mb-5 text-[13px] font-medium leading-relaxed text-ink-2">
        Upload lab results for educational, nutrition-linked context. You confirm
        every value — only confirmed values are stored and used.
      </p>

      <Card className="flex flex-col items-center px-6 py-10 text-center">
        <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-[16px] bg-navy/[0.06] text-navy">
          <FileTextIcon size={28} />
        </span>
        <div className="text-[15px] font-bold text-ink">
          Upload a report
        </div>
        <p className="mt-1 max-w-[300px] text-[12.5px] font-medium text-ink-2">
          PDF, JPG, JPEG or PNG. We&rsquo;ll extract the metrics and ask you to
          confirm each one.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={onUpload}
        />
        <Button className="mt-4" onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
        <button
          onClick={onUpload}
          className="mt-2 text-[12px] font-semibold text-ink-3 underline"
        >
          Use a sample report
        </button>
      </Card>

      <div className="mt-4 flex items-start gap-2.5 rounded-card bg-blue-t px-4 py-3.5">
        <InfoIcon size={18} className="mt-px shrink-0 text-blue-d" />
        <p className="text-[11.5px] font-medium leading-relaxed text-blue-d">
          {MEDICAL_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
