"use client";

import { useRef, useState } from "react";
import { Button, SourceBadge, useToast } from "@/components/ui";
import {
  CupIcon,
  ImageIcon,
  PencilIcon,
  TrashIcon,
  UtensilsIcon,
  XIcon,
} from "@/components/icons";
import { formatNumber, formatTime } from "@/lib/format";
import { patchEntry, removeEntry, uploadEntryImage } from "@/lib/api";
import type { IntakeEntry } from "@/lib/types";
import { cn } from "@/lib/cn";
import { EditEntryDialog } from "./EditEntryDialog";

export function EntryDetailModal({
  entry,
  onClose,
  onChanged,
}: {
  entry: IntakeEntry;
  onClose: () => void;
  /** Called after a successful edit or delete so parents can refresh. */
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState(entry.imageUrl);

  const isDrink = entry.type === "drink" || entry.type === "water";
  const TypeIcon = isDrink ? CupIcon : UtensilsIcon;

  async function handleSave(id: string, patch: Partial<IntakeEntry>) {
    setBusy(true);
    try {
      await patchEntry(id, patch);
      toast({ title: "Entry updated", variant: "success" });
      setEditing(false);
      onChanged?.();
      onClose();
    } catch (err) {
      toast({
        title: "Couldn’t update entry",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await removeEntry(entry);
      toast({ title: "Entry removed", variant: "success" });
      onChanged?.();
      onClose();
    } catch (err) {
      toast({
        title: "Couldn’t remove entry",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  async function onImagePicked(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Choose an image",
        description: "Photos only (JPG, PNG, WebP).",
        variant: "error",
      });
      return;
    }
    setBusy(true);
    try {
      const url = await uploadEntryImage(entry, file);
      setImageUrl(url);
      toast({ title: imageUrl ? "Photo updated" : "Photo added", variant: "success" });
      onChanged?.();
    } catch (err) {
      toast({
        title: "Couldn’t save photo",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (editing) {
    return (
      <EditEntryDialog
        entry={entry}
        onClose={() => setEditing(false)}
        onSave={handleSave}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onClick={busy ? undefined : onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={entry.name}
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-[420px] overflow-hidden rounded-card-lg border border-line bg-card shadow-card-lg"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
              isDrink ? "bg-blue-t text-blue-d" : "bg-teal-t text-teal-d",
            )}
          >
            <TypeIcon size={12} />
            {isDrink ? "Drink" : "Food"}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-app-bg text-ink-2 hover:text-ink disabled:opacity-50"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="relative mx-5 mt-4 overflow-hidden rounded-card border border-line-2 bg-app-bg">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={entry.name}
              className="h-44 w-full object-cover"
            />
          ) : (
            <div className="flex h-44 flex-col items-center justify-center gap-2 border-dashed border-line-2 bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,rgba(128,128,128,0.06)_8px,rgba(128,128,128,0.06)_16px)]">
              <ImageIcon size={22} className="text-ink-3" />
              <span className="text-[12px] font-medium text-ink-3">
                No image
              </span>
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-[10px] bg-card/95 px-2.5 py-1.5 text-[11px] font-bold text-ink shadow-card backdrop-blur-sm transition hover:bg-card disabled:opacity-50"
          >
            <ImageIcon size={13} />
            {imageUrl ? "Change image" : "No image"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onImagePicked(e.target.files?.[0])}
          />
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
              {entry.name}
            </h2>
            <SourceBadge source={entry.source} />
          </div>
          <p className="mt-1 text-[12.5px] font-medium text-ink-3">
            Logged at {formatTime(entry.loggedAt)}
            {entry.portion ? ` · ${entry.portion}` : ""}
            {entry.volumeMl ? ` · ${Math.round(entry.volumeMl)} ml` : ""}
          </p>

          <div className="mt-4 font-display text-[28px] font-bold text-ink">
            {formatNumber(entry.nutrients.calories)}{" "}
            <span className="text-[16px] font-semibold text-ink-2">kcal</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Metric
              label="Added sugar"
              value={`${Math.round(entry.nutrients.addedSugar_g)} g`}
            />
            <Metric
              label="Carbs"
              value={`${Math.round(entry.nutrients.carbs_g)} g`}
            />
          </div>

          {confirmDelete ? (
            <div className="mt-5 rounded-[14px] border border-red/25 bg-red-t/60 px-3.5 py-3">
              <p className="text-[13px] font-semibold text-red-d">
                Remove this entry?
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-ink-3">
                This can’t be undone from here.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleDelete()}
                  className="flex-1 !bg-red !text-white hover:!bg-red-d"
                >
                  {busy ? "Removing…" : "Remove"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setEditing(true)}
                className="flex-1"
              >
                <PencilIcon size={14} />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                className="flex-1 !border-red/30 !text-red-d hover:!bg-red-t"
              >
                <TrashIcon size={14} />
                Remove
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card-sm bg-app-bg px-3.5 py-3">
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
      <div className="mt-1 font-display text-[18px] font-bold text-ink">
        {value}
      </div>
    </div>
  );
}
